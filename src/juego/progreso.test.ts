// Pruebas de la persistencia del progreso (formato versión 2, spec 01).
// Ejemplos con un doble de Storage, migración v1→v2 y la Property 20.

import { describe, it, expect, vi } from 'vitest';
import { cargarProgreso, CLAVE, CLAVE_V1, VERSION_FORMATO } from './progreso.js';
import type { Calificacion } from './estrellas.js';
import { crearPrng } from '../azar/prng.js';

// ============================================================================
// Doble de Storage en memoria
// ============================================================================

function crearAlmacen(inicial: Record<string, string> = {}): Storage & { datos: Map<string, string>; escrituras: string[] } {
  const datos = new Map<string, string>(Object.entries(inicial));
  const escrituras: string[] = [];
  return {
    datos,
    escrituras,
    get length() {
      return datos.size;
    },
    clear() {
      datos.clear();
    },
    getItem(clave: string) {
      return datos.has(clave) ? datos.get(clave)! : null;
    },
    key(indice: number) {
      return [...datos.keys()][indice] ?? null;
    },
    removeItem(clave: string) {
      datos.delete(clave);
    },
    setItem(clave: string, valor: string) {
      escrituras.push(clave);
      datos.set(clave, valor);
    },
  };
}

/** Calificación con las tres estrellas otorgadas o negadas y un conteo opcional. */
function calif(p: boolean, e: boolean, a: boolean, conteo = 1): Calificacion {
  const est = (o: boolean) => (o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } });
  return { precision: est(p), economia: est(e), abstraccion: est(a), conteoJugador: conteo, presupuestoEstrella: 1 };
}

// ============================================================================
// Escritura (formato v2)
// ============================================================================

describe('progreso · escritura', () => {
  it('escribe un solo texto JSON en la clave v2, sin tocar otras claves', () => {
    const almacen = crearAlmacen({ 'otra.clave': 'no-tocar' });
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 42, calif(true, true, true), 1);

    expect(almacen.escrituras).toEqual([CLAVE]);
    expect(CLAVE).toBe('kirologo.progreso.v2');
    expect(almacen.getItem('otra.clave')).toBe('no-tocar');

    const guardado = JSON.parse(almacen.getItem(CLAVE)!);
    expect(guardado.version).toBe(VERSION_FORMATO);
    expect(VERSION_FORMATO).toBe(2);
    expect(guardado.niveles['0.1'].estrellas).toEqual({ precision: true, economia: true, abstraccion: true });
    expect(guardado.niveles['0.1'].mejorConteo).toBe(1);
    expect(guardado.niveles['0.1'].ultimaSemilla).toBe(42);
    expect(guardado.ultimoReto).toEqual({ idNivel: '0.1', semilla: 42 });
    expect(guardado.guiaVista).toBe(false);
  });

  it('las estrellas nunca retroceden entre intentos', () => {
    const almacen = crearAlmacen();
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 42, calif(true, false, false), 5); // gana precisión
    progreso.guardar('0.1', 42, calif(false, true, false), 9); // gana economía
    expect(progreso.estrellasDe('0.1')).toEqual({ precision: true, economia: true, abstraccion: false });
  });

  it('el mejor conteo solo baja y solo cuenta con precisión otorgada', () => {
    const almacen = crearAlmacen();
    const progreso = cargarProgreso(almacen);
    // Sin precisión: no fija mejor conteo aunque el conteo sea bajo.
    progreso.guardar('0.1', 1, calif(false, false, false), 2);
    expect(progreso.mejorConteoDe('0.1')).toBeNull();
    // Con precisión: fija el conteo.
    progreso.guardar('0.1', 1, calif(true, false, false), 6);
    expect(progreso.mejorConteoDe('0.1')).toBe(6);
    // Un conteo mayor no sube el mejor.
    progreso.guardar('0.1', 1, calif(true, false, false), 9);
    expect(progreso.mejorConteoDe('0.1')).toBe(6);
    // Un conteo menor sí baja.
    progreso.guardar('0.1', 1, calif(true, true, true), 4);
    expect(progreso.mejorConteoDe('0.1')).toBe(4);
    // Un conteo aún menor pero SIN precisión no cambia el mejor.
    progreso.guardar('0.1', 1, calif(false, false, false), 1);
    expect(progreso.mejorConteoDe('0.1')).toBe(4);
  });

  it('el último reto se actualiza aunque el intento no gane ninguna estrella', () => {
    const almacen = crearAlmacen();
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 42, calif(false, false, false), 3);
    expect(progreso.ultimoReto()).toEqual({ idNivel: '0.1', semilla: 42 });
  });

  it('no guarda ningún dato personal ni texto del jugador', () => {
    const almacen = crearAlmacen();
    cargarProgreso(almacen).guardar('0.1', 42, calif(true, true, true), 1);
    const obj = JSON.parse(almacen.getItem(CLAVE)!);
    // Solo version, niveles, ultimoReto y guiaVista.
    expect(Object.keys(obj).sort()).toEqual(['guiaVista', 'niveles', 'ultimoReto', 'version']);
  });
});

// ============================================================================
// Guía de primeros pasos (requisito 10.5)
// ============================================================================

describe('progreso · guía de primeros pasos', () => {
  it('marcarUltimoReto registra el reto en curso sin tocar estrellas', () => {
    const almacen = crearAlmacen();
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 1, calif(true, true, true), 1);
    progreso.marcarUltimoReto('0.3', 777);
    expect(progreso.ultimoReto()).toEqual({ idNivel: '0.3', semilla: 777 });
    // No tocó las estrellas del 0.1.
    expect(progreso.estrellasDe('0.1')).toEqual({ precision: true, economia: true, abstraccion: true });
    // Persistió: una recarga lo recuerda.
    expect(cargarProgreso(almacen).ultimoReto()).toEqual({ idNivel: '0.3', semilla: 777 });
  });

  it('arranca sin completar y se marca una sola vez, persistiendo', () => {
    const almacen = crearAlmacen();
    const progreso = cargarProgreso(almacen);
    expect(progreso.guiaCompletada()).toBe(false);
    progreso.marcarGuiaCompletada();
    expect(progreso.guiaCompletada()).toBe(true);
    // Persistió: una recarga la recuerda.
    expect(cargarProgreso(almacen).guiaCompletada()).toBe(true);
    // Marcar de nuevo no escribe otra vez.
    const antes = almacen.escrituras.length;
    progreso.marcarGuiaCompletada();
    expect(almacen.escrituras.length).toBe(antes);
  });
});

// ============================================================================
// Lectura tolerante
// ============================================================================

describe('progreso · lectura tolerante', () => {
  it('clave ausente arranca con progreso vacío', () => {
    const progreso = cargarProgreso(crearAlmacen());
    expect(progreso.estrellasDe('0.1')).toBeNull();
    expect(progreso.mejorConteoDe('0.1')).toBeNull();
    expect(progreso.ultimoReto()).toBeNull();
    expect(progreso.guiaCompletada()).toBe(false);
  });

  it('JSON ilegible arranca vacío y lo conserva hasta el primer guardado', () => {
    const almacen = crearAlmacen({ [CLAVE]: '{roto' });
    const progreso = cargarProgreso(almacen);
    expect(progreso.estrellasDe('0.1')).toBeNull();
    expect(almacen.getItem(CLAVE)).toBe('{roto');
    progreso.guardar('0.1', 1, calif(true, true, true), 1);
    expect(almacen.getItem(CLAVE)).not.toBe('{roto');
  });

  it('versión no reconocida (ni 1 ni 2) arranca vacío', () => {
    const almacen = crearAlmacen({ [CLAVE]: JSON.stringify({ version: 999, niveles: {}, ultimoReto: null }) });
    const progreso = cargarProgreso(almacen);
    expect(progreso.estrellasDe('0.1')).toBeNull();
  });

  it('descarta solo el registro inválido y conserva los demás', () => {
    const almacen = crearAlmacen({
      [CLAVE]: JSON.stringify({
        version: VERSION_FORMATO,
        niveles: {
          '0.1': { estrellas: { precision: true, economia: true, abstraccion: true }, mejorConteo: 1, ultimaSemilla: 42 },
          '9.9': { estrellas: { precision: true, economia: true, abstraccion: true }, mejorConteo: 1, ultimaSemilla: 1 }, // nivel inexistente
          '0.2': { estrellas: {}, mejorConteo: 1, ultimaSemilla: 'x' }, // semilla y estrellas inválidas
        },
        ultimoReto: null,
        guiaVista: false,
      }),
    });
    const progreso = cargarProgreso(almacen);
    expect(progreso.estrellasDe('0.1')).not.toBeNull();
    expect(progreso.estrellasDe('9.9')).toBeNull();
    expect(progreso.estrellasDe('0.2')).toBeNull();
  });

  it('cuota agotada avisa una sola vez y conserva el resultado en memoria', () => {
    const almacen = crearAlmacen();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    almacen.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 1, calif(true, true, true), 1);
    progreso.guardar('0.1', 2, calif(true, true, true), 1);
    expect(progreso.ultimoReto()).toEqual({ idNivel: '0.1', semilla: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('almacén null funciona entero en memoria', () => {
    const progreso = cargarProgreso(null);
    progreso.guardar('0.1', 7, calif(true, false, false), 3);
    expect(progreso.estrellasDe('0.1')).toEqual({ precision: true, economia: false, abstraccion: false });
    expect(progreso.mejorConteoDe('0.1')).toBe(3);
    expect(progreso.ultimoReto()).toEqual({ idNivel: '0.1', semilla: 7 });
  });
});

// ============================================================================
// Migración v1 → v2 (requisito 6.4)
// ============================================================================

describe('progreso · migración v1 → v2', () => {
  it('migra las estrellas de la v1, deja el mejor conteo sin valor y no borra la v1', () => {
    const contenidoV1 = JSON.stringify({
      version: 1,
      niveles: {
        '0.1': { semilla: 42, estrellas: { precision: true, economia: true, abstraccion: false } },
        '0.2': { semilla: 7, estrellas: { precision: true, economia: false, abstraccion: false } },
      },
      ultimoReto: { idNivel: '0.2', semilla: 7 },
    });
    const almacen = crearAlmacen({ [CLAVE_V1]: contenidoV1 });

    const progreso = cargarProgreso(almacen);
    // Estrellas conservadas.
    expect(progreso.estrellasDe('0.1')).toEqual({ precision: true, economia: true, abstraccion: false });
    expect(progreso.estrellasDe('0.2')).toEqual({ precision: true, economia: false, abstraccion: false });
    // El mejor conteo arranca sin valor (la v1 no lo guardaba).
    expect(progreso.mejorConteoDe('0.1')).toBeNull();
    // El último reto se conserva.
    expect(progreso.ultimoReto()).toEqual({ idNivel: '0.2', semilla: 7 });
    // La clave v1 sigue intacta; aún no se ha escrito la v2 (solo lecturas).
    expect(almacen.getItem(CLAVE_V1)).toBe(contenidoV1);
    expect(almacen.getItem(CLAVE)).toBeNull();

    // Al guardar, se escribe la v2 y la v1 permanece.
    progreso.guardar('0.3', 1, calif(true, true, true), 5);
    expect(almacen.getItem(CLAVE)).not.toBeNull();
    expect(almacen.getItem(CLAVE_V1)).toBe(contenidoV1);
  });

  it('la guía se da por vista si algún nivel ya tenía precisión en la v1', () => {
    const almacen = crearAlmacen({
      [CLAVE_V1]: JSON.stringify({
        version: 1,
        niveles: { '0.1': { semilla: 1, estrellas: { precision: true, economia: false, abstraccion: false } } },
        ultimoReto: null,
      }),
    });
    expect(cargarProgreso(almacen).guiaCompletada()).toBe(true);
  });

  it('sin ningún nivel aprobado en la v1, la guía sigue pendiente', () => {
    const almacen = crearAlmacen({
      [CLAVE_V1]: JSON.stringify({
        version: 1,
        niveles: { '0.1': { semilla: 1, estrellas: { precision: false, economia: false, abstraccion: false } } },
        ultimoReto: null,
      }),
    });
    expect(cargarProgreso(almacen).guiaCompletada()).toBe(false);
  });

  it('si existe la clave v2, no migra de la v1', () => {
    const almacen = crearAlmacen({
      [CLAVE_V1]: JSON.stringify({
        version: 1,
        niveles: { '0.1': { semilla: 1, estrellas: { precision: true, economia: true, abstraccion: true } } },
        ultimoReto: null,
      }),
      [CLAVE]: JSON.stringify({ version: 2, niveles: {}, ultimoReto: null, guiaVista: false }),
    });
    // La v2 (vacía) manda; no se migra la v1.
    expect(cargarProgreso(almacen).estrellasDe('0.1')).toBeNull();
  });
});

// ============================================================================
// Property 20: la persistencia va y vuelve, nunca retrocede, no guarda de más
// ============================================================================

describe('Property 20: persistencia', () => {
  it('recargar el almacén recupera las estrellas y el mejor conteo, sobre 200 semillas', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const prng = crearPrng(semilla);
      const almacen = crearAlmacen();
      const p1 = cargarProgreso(almacen);
      const s = prng.entero(0, 4_294_967_295);
      const p = prng.siguiente() < 0.5;
      const c = calif(p, prng.siguiente() < 0.5, prng.siguiente() < 0.5, prng.entero(1, 20));
      p1.guardar('0.1', s, c, c.conteoJugador);
      const estrellas1 = p1.estrellasDe('0.1')!;
      const mejor1 = p1.mejorConteoDe('0.1');

      // Recargar desde el mismo almacén: mismo contenido.
      const p2 = cargarProgreso(almacen);
      expect(p2.estrellasDe('0.1')).toEqual(estrellas1);
      expect(p2.mejorConteoDe('0.1')).toBe(mejor1);
      expect(p2.ultimoReto()).toEqual({ idNivel: '0.1', semilla: s });
    }
  });

  it('las estrellas nunca retroceden bajo cualquier secuencia de intentos, sobre 200 semillas', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const prng = crearPrng(semilla);
      const progreso = cargarProgreso(crearAlmacen());
      let acumP = false;
      let acumE = false;
      let acumA = false;
      const intentos = prng.entero(1, 6);
      for (let i = 0; i < intentos; i++) {
        const p = prng.siguiente() < 0.5;
        const e = prng.siguiente() < 0.5;
        const a = prng.siguiente() < 0.5;
        acumP = acumP || p;
        acumE = acumE || e;
        acumA = acumA || a;
        progreso.guardar('0.1', 1, calif(p, e, a), prng.entero(1, 20));
        expect(progreso.estrellasDe('0.1')).toEqual({ precision: acumP, economia: acumE, abstraccion: acumA });
      }
    }
  });
});
