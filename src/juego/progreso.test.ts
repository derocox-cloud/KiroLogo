// Pruebas de la persistencia del progreso
// Ejemplos (16.7) con un doble de Storage, y la Property 20 (16.8).

import { describe, it, expect, vi } from 'vitest';
import fc from 'fast-check';
import { cargarProgreso, CLAVE, VERSION_FORMATO } from './progreso.js';
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

/** Calificación con las tres estrellas otorgadas o negadas. */
function calif(p: boolean, e: boolean, a: boolean): Calificacion {
  const est = (o: boolean) => (o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } });
  return { precision: est(p), economia: est(e), abstraccion: est(a), conteoJugador: 1, presupuestoEstrella: 1 };
}

// ============================================================================
// Ejemplos (16.7)
// ============================================================================

describe('progreso · escritura', () => {
  it('escribe un solo texto JSON en la clave con versión, sin tocar otras claves', () => {
    const almacen = crearAlmacen({ 'otra.clave': 'no-tocar' });
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 42, calif(true, true, true));

    // Solo se escribió la clave del progreso.
    expect(almacen.escrituras).toEqual([CLAVE]);
    expect(almacen.getItem('otra.clave')).toBe('no-tocar');

    const guardado = JSON.parse(almacen.getItem(CLAVE)!);
    expect(guardado.version).toBe(VERSION_FORMATO);
    expect(guardado.niveles['0.1'].estrellas).toEqual({ precision: true, economia: true, abstraccion: true });
    expect(guardado.ultimoReto).toEqual({ idNivel: '0.1', semilla: 42 });
  });

  it('las estrellas nunca retroceden entre intentos', () => {
    const almacen = crearAlmacen();
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 42, calif(true, false, false)); // gana precisión
    progreso.guardar('0.1', 42, calif(false, true, false)); // gana economía
    expect(progreso.estrellasDe('0.1')).toEqual({ precision: true, economia: true, abstraccion: false });
  });

  it('el último reto se actualiza aunque el intento no gane ninguna estrella', () => {
    const almacen = crearAlmacen();
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 42, calif(false, false, false));
    expect(progreso.ultimoReto()).toEqual({ idNivel: '0.1', semilla: 42 });
  });

  it('no guarda ningún dato personal ni texto del jugador', () => {
    const almacen = crearAlmacen();
    cargarProgreso(almacen).guardar('0.1', 42, calif(true, true, true));
    const texto = almacen.getItem(CLAVE)!;
    // Solo version, niveles, semillas, estrellas y ultimoReto.
    const obj = JSON.parse(texto);
    expect(Object.keys(obj).sort()).toEqual(['niveles', 'ultimoReto', 'version']);
  });
});

// ============================================================================
// Lectura tolerante (16.7)
// ============================================================================

describe('progreso · lectura tolerante', () => {
  it('clave ausente arranca con progreso vacío', () => {
    const progreso = cargarProgreso(crearAlmacen());
    expect(progreso.estrellasDe('0.1')).toBeNull();
    expect(progreso.ultimoReto()).toBeNull();
  });

  it('JSON ilegible arranca vacío y lo conserva hasta el primer guardado', () => {
    const almacen = crearAlmacen({ [CLAVE]: '{roto' });
    const progreso = cargarProgreso(almacen);
    expect(progreso.estrellasDe('0.1')).toBeNull();
    // El valor no reconocido se conserva hasta el primer guardado exitoso.
    expect(almacen.getItem(CLAVE)).toBe('{roto');
    progreso.guardar('0.1', 1, calif(true, true, true));
    expect(almacen.getItem(CLAVE)).not.toBe('{roto');
  });

  it('versión no reconocida arranca vacío', () => {
    const almacen = crearAlmacen({ [CLAVE]: JSON.stringify({ version: 999, niveles: {}, ultimoReto: null }) });
    const progreso = cargarProgreso(almacen);
    expect(progreso.estrellasDe('0.1')).toBeNull();
  });

  it('descarta solo el registro inválido y conserva los demás', () => {
    const almacen = crearAlmacen({
      [CLAVE]: JSON.stringify({
        version: VERSION_FORMATO,
        niveles: {
          '0.1': { semilla: 42, estrellas: { precision: true, economia: true, abstraccion: true } },
          '9.9': { semilla: 1, estrellas: { precision: true, economia: true, abstraccion: true } }, // nivel inexistente
          '0.1malo': { semilla: 'x', estrellas: {} }, // semilla inválida
        },
        ultimoReto: null,
      }),
    });
    const progreso = cargarProgreso(almacen);
    expect(progreso.estrellasDe('0.1')).not.toBeNull();
    expect(progreso.estrellasDe('9.9')).toBeNull();
  });

  it('cuota agotada avisa una sola vez y conserva el resultado en memoria', () => {
    const almacen = crearAlmacen();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Forzar el fallo de escritura.
    almacen.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    const progreso = cargarProgreso(almacen);
    progreso.guardar('0.1', 1, calif(true, true, true));
    progreso.guardar('0.1', 2, calif(true, true, true));
    // El resultado sigue disponible en memoria.
    expect(progreso.ultimoReto()).toEqual({ idNivel: '0.1', semilla: 2 });
    // El aviso se dio una sola vez.
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('almacén null funciona entero en memoria', () => {
    const progreso = cargarProgreso(null);
    progreso.guardar('0.1', 7, calif(true, false, false));
    expect(progreso.estrellasDe('0.1')).toEqual({ precision: true, economia: false, abstraccion: false });
    expect(progreso.ultimoReto()).toEqual({ idNivel: '0.1', semilla: 7 });
  });
});

// ============================================================================
// Property 20: la persistencia va y vuelve, nunca retrocede, no guarda de más (16.8)
// Valida: Requisitos 20.3, 20.6, 20.9
// ============================================================================

describe('Property 20: persistencia', () => {
  it('recargar el almacén recupera las estrellas guardadas, sobre 200 semillas', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng(semilla);
        const almacen = crearAlmacen();
        const p1 = cargarProgreso(almacen);
        const s = prng.entero(0, 4_294_967_295);
        const c = calif(prng.siguiente() < 0.5, prng.siguiente() < 0.5, prng.siguiente() < 0.5);
        p1.guardar('0.1', s, c);
        const guardadas1 = p1.estrellasDe('0.1')!;

        // Recargar desde el mismo almacén: mismo contenido.
        const p2 = cargarProgreso(almacen);
        expect(p2.estrellasDe('0.1')).toEqual(guardadas1);
        expect(p2.ultimoReto()).toEqual({ idNivel: '0.1', semilla: s });
      }),
      { seed: 20, numRuns: 200 },
    );
  });

  it('las estrellas nunca retroceden bajo cualquier secuencia de intentos, sobre 200 semillas', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
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
          progreso.guardar('0.1', 1, calif(p, e, a));
          // El guardado nunca retrocede respecto del máximo acumulado.
          expect(progreso.estrellasDe('0.1')).toEqual({ precision: acumP, economia: acumE, abstraccion: acumA });
        }
      }),
      { seed: 21, numRuns: 200 },
    );
  });
});
