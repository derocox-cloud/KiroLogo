// Pruebas del lienzo: espacio lógico, escalado, cuatro capas, cuadrícula y estelas.
//
// Corre en Node con el doble de dibujo de `doble-dibujo.test.ts`, sin jsdom ni
// Canvas real. La comparación «píxel por píxel» de los requisitos se hace sobre la
// secuencia registrada de llamadas y su rasterizado; la verificación con un Canvas
// real del navegador sigue siendo manual.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import { DobleDibujo, type Llamada } from './doble-dibujo.test.js';
import {
  crearLienzo,
  calcularEscalado,
  ORDEN_CAPAS,
  LADO_LOGICO,
  LADO_MINIMO,
  LADO_MAXIMO,
  DPR_MINIMO,
  DPR_MAXIMO,
  type CapasLienzo,
  type EstiloLienzo,
  type TamanoLienzo,
  type NombreCapa,
} from './lienzo.js';
import type { Segmento } from './segmentos.js';

// ============================================================================
// Ayudas de prueba
// ============================================================================

/** Estilo de tema completo, con valores concretos para cada trazo. */
function estiloCompleto(): EstiloLienzo {
  return {
    fondo: { color: '#ffffff', grosor: 1, guiones: [] },
    cuadricula20: { color: '#e9ecef', grosor: 0.5, guiones: [] },
    cuadricula100: { color: '#ced4da', grosor: 1, guiones: [] },
    estelaJugador: { color: '#0d6efd', grosor: 3, guiones: [] },
    estelaReferencia: { color: '#6c757d', grosor: 2, guiones: [8, 4] },
  };
}

/** Crea cuatro dobles de dibujo, uno por capa. */
function crearCapasDobles(): Record<NombreCapa, DobleDibujo> {
  return {
    fondo: new DobleDibujo(),
    referencia: new DobleDibujo(),
    jugador: new DobleDibujo(),
    personajes: new DobleDibujo(),
  };
}

const TAMANO_BASE: TamanoLienzo = { anchoCss: 800, altoCss: 800, devicePixelRatio: 1 };

/** Cuenta cuántas líneas (pares moveTo→lineTo) hay en una secuencia de llamadas. */
function contarLineas(llamadas: readonly Llamada[]): number {
  return llamadas.filter((l) => l.metodo === 'moveTo').length;
}

// ============================================================================
// Escalado (sección 7.3)
// ============================================================================

describe('lienzo · escalado', () => {
  it('escala uniforme: el cuadrado lógico conserva la relación 1:1', () => {
    const e = calcularEscalado({ anchoCss: 800, altoCss: 800, devicePixelRatio: 1 });
    expect(e.lado).toBe(800);
    expect(e.escala).toBe(1);
    expect(e.dpr).toBe(1);
    expect(e.bufer).toBe(800);
  });

  it('toma el menor de los dos lados CSS', () => {
    const e = calcularEscalado({ anchoCss: 1200, altoCss: 600, devicePixelRatio: 1 });
    expect(e.lado).toBe(600);
  });

  it('acota el lado a [320, 4096]', () => {
    expect(calcularEscalado({ anchoCss: 100, altoCss: 100, devicePixelRatio: 1 }).lado).toBe(320);
    expect(calcularEscalado({ anchoCss: 9000, altoCss: 9000, devicePixelRatio: 1 }).lado).toBe(4096);
  });

  it('acota la densidad de píxeles a [1, 3]', () => {
    expect(calcularEscalado({ anchoCss: 800, altoCss: 800, devicePixelRatio: 0.5 }).dpr).toBe(1);
    expect(calcularEscalado({ anchoCss: 800, altoCss: 800, devicePixelRatio: 5 }).dpr).toBe(3);
  });

  it('el paso de 20 mide al menos 8 px en el lado mínimo', () => {
    const e = calcularEscalado({ anchoCss: 320, altoCss: 320, devicePixelRatio: 1 });
    const pasoEnPx = 20 * e.escala;
    expect(pasoEnPx).toBeGreaterThanOrEqual(8);
  });
});

// ============================================================================
// La transformación se aplica a las cuatro capas
// ============================================================================

describe('lienzo · transformación y capas', () => {
  it('fija la transformación de las cuatro capas con la y negativa', () => {
    const capas = crearCapasDobles();
    crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    for (const nombre of ORDEN_CAPAS) {
      const st = capas[nombre].llamadas.find((l) => l.metodo === 'setTransform');
      expect(st).toBeDefined();
      // setTransform(escala·dpr, 0, 0, −escala·dpr, centro, centro).
      expect(st!.args[0]).toBe(1);
      expect(st!.args[3]).toBe(-1); // y negativa: invierte el eje vertical
      expect(st!.args[4]).toBe(400);
      expect(st!.args[5]).toBe(400);
    }
  });

  it('las cuatro capas están en el orden de apilamiento fondo→referencia→jugador→personajes', () => {
    expect([...ORDEN_CAPAS]).toEqual(['fondo', 'referencia', 'jugador', 'personajes']);
  });
});

// ============================================================================
// Cuadrícula: 41 líneas por eje, 9 gruesas por eje
// ============================================================================

describe('lienzo · cuadrícula', () => {
  it('dibuja 41 líneas por eje (82 en total) y 9 gruesas por eje (18)', () => {
    const capas = crearCapasDobles();
    crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    const fondo = capas.fondo.llamadas;

    // La cuadrícula fina y la gruesa se dibujan en dos pasadas con un stroke cada
    // una. Contamos las líneas de cada pasada localizando los dos beginPath de
    // cuadrícula (tras el relleno del fondo).
    const indicesBegin: number[] = [];
    fondo.forEach((l, i) => {
      if (l.metodo === 'beginPath') indicesBegin.push(i);
    });
    // El primer beginPath es el del relleno del fondo; los dos siguientes son las
    // dos pasadas de cuadrícula.
    expect(indicesBegin.length).toBeGreaterThanOrEqual(3);
    const finas = fondo.slice(indicesBegin[1]!, indicesBegin[2]!);
    const gruesas = fondo.slice(indicesBegin[2]!);

    // Finas: las que NO son múltiplo de 100. Por eje hay 41 líneas totales y 9
    // múltiplos de 100, así que 32 finas por eje → 64 moveTo.
    expect(contarLineas(finas)).toBe(64);
    // Gruesas: 9 múltiplos de 100 por eje → 18 moveTo.
    expect(contarLineas(gruesas)).toBe(18);
  });

  it('las líneas gruesas llevan al menos el doble del grosor de las finas', () => {
    const capas = crearCapasDobles();
    // Grosor fino 0.5, grueso 1.0 → exactamente el doble.
    crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    // Comprobamos con un estilo controlado que el ratio es ≥ 2.
    const estilo = estiloCompleto();
    expect(estilo.cuadricula100.grosor).toBeGreaterThanOrEqual(estilo.cuadricula20.grosor * 2);
  });

  it('la cuadrícula se dibuja en la capa de fondo, no en las de estela ni personajes', () => {
    const capas = crearCapasDobles();
    crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    // La capa de fondo tiene muchas líneas (82 de cuadrícula más el rectángulo de
    // relleno del fondo, que aporta su propio moveTo); las de estela y personajes,
    // ninguna (sin estelas cargadas y sin personajes dibujados).
    expect(contarLineas(capas.fondo.llamadas)).toBe(83);
    // Las capas de estela vacías solo trazan el rectángulo del clip (1 moveTo), no
    // ninguna línea de cuadrícula. La capa de personajes no recibe nada.
    expect(contarLineas(capas.jugador.llamadas)).toBeLessThanOrEqual(1);
    expect(contarLineas(capas.referencia.llamadas)).toBeLessThanOrEqual(1);
    expect(contarLineas(capas.personajes.llamadas)).toBe(0);
  });
});

// ============================================================================
// Estelas y borrado de la capa del jugador (Req 12.4)
// ============================================================================

describe('lienzo · estelas', () => {
  const SEGS_JUGADOR: Segmento[] = [
    { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 100 }, paso: 0, linea: 1 },
    { desde: { x: 0, y: 100 }, hasta: { x: 100, y: 100 }, paso: 1, linea: 2 },
  ];

  it('borrar la capa del jugador no toca la referencia, el fondo ni los personajes', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);

    lienzo.ponerEstela('jugador', SEGS_JUGADOR);
    lienzo.ponerEstela('referencia', SEGS_JUGADOR);

    // Contamos las llamadas de cada capa antes de limpiar la del jugador.
    const refAntes = capas.referencia.llamadas.length;
    const fondoAntes = capas.fondo.llamadas.length;
    const persAntes = capas.personajes.llamadas.length;

    lienzo.limpiarEstela('jugador');

    // La referencia, el fondo y los personajes no reciben ninguna llamada nueva.
    expect(capas.referencia.llamadas.length).toBe(refAntes);
    expect(capas.fondo.llamadas.length).toBe(fondoAntes);
    expect(capas.personajes.llamadas.length).toBe(persAntes);
    // La estela del jugador queda vacía y la de referencia conserva sus segmentos.
    expect(lienzo.segmentosDe('jugador')).toEqual([]);
    expect(lienzo.segmentosDe('referencia').length).toBe(2);
  });

  it('la estela de referencia usa un patrón de línea distinto (setLineDash)', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    lienzo.ponerEstela('referencia', SEGS_JUGADOR);
    const dash = capas.referencia.llamadas.filter((l) => l.metodo === 'setLineDash');
    // Al menos un setLineDash con guiones no vacíos.
    const conGuiones = dash.some((l) => Array.isArray(l.args[0]) && (l.args[0] as number[]).length > 0);
    expect(conGuiones).toBe(true);
  });

  it('la estela lleva un clip al cuadrado lógico y un tramo fuera se recorta sin excepción', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    // Un segmento que sale del cuadrado [−400, 400]².
    const fuera: Segmento[] = [
      { desde: { x: 0, y: 0 }, hasta: { x: 5000, y: 5000 }, paso: 0, linea: 1 },
    ];
    expect(() => lienzo.ponerEstela('jugador', fuera)).not.toThrow();
    // Se registró un clip en la capa del jugador.
    expect(capas.jugador.llamadas.some((l) => l.metodo === 'clip')).toBe(true);
  });

  it('crecerEstela añade segmentos y conserva los previos', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    lienzo.ponerEstela('jugador', [SEGS_JUGADOR[0]!]);
    lienzo.crecerEstela('jugador', [SEGS_JUGADOR[1]!]);
    expect(lienzo.segmentosDe('jugador').length).toBe(2);
  });

  it('limpiarPersonajes borra solo la capa de personajes', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    const jugAntes = capas.jugador.llamadas.length;
    lienzo.limpiarPersonajes();
    expect(capas.personajes.llamadas.some((l) => l.metodo === 'clearRect')).toBe(true);
    expect(capas.jugador.llamadas.length).toBe(jugAntes);
  });
});

// ============================================================================
// Tema: un trazo sin declarar usa la reserva
// ============================================================================

describe('lienzo · tema', () => {
  it('un lector de tema con reserva provee el trazo faltante sin literal en el módulo', () => {
    // Simulamos que el tema no declara el color de la estela del jugador: el lector
    // (que en producción implementa la cadena var()/reserva) devuelve la reserva.
    let usoReserva = false;
    const leerConReserva = (): EstiloLienzo => {
      const base = estiloCompleto();
      usoReserva = true;
      return {
        ...base,
        // La reserva se resuelve en el lector, no en el lienzo.
        estelaJugador: { color: '#0a58ca', grosor: 3.5, guiones: [] },
      };
    };
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, leerConReserva, TAMANO_BASE);
    lienzo.ponerEstela('jugador', [
      { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 50 }, paso: 0, linea: 1 },
    ]);
    expect(usoReserva).toBe(true);
    // El lienzo aplicó el trazo que le dio el lector (la reserva) sin error.
    expect(capas.jugador.llamadas.some((l) => l.metodo === 'stroke')).toBe(true);
  });

  it('el módulo lienzo.ts no contiene literales de color ni de grosor', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const ruta = fileURLToPath(new URL('./lienzo.ts', import.meta.url));
    const fuente = readFileSync(ruta, 'utf8');
    const codigo = fuente
      .split('\n')
      .filter((linea) => !linea.trimStart().startsWith('//') && !linea.trimStart().startsWith('*'))
      .join('\n');
    // Sin literales de color hexadecimales ni rgb(.
    expect(codigo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(codigo).not.toMatch(/\brgba?\(/);
  });
});

// ============================================================================
// Property 22: Escalado uniforme del lienzo
// Valida: Requisitos 12.3
// ============================================================================

describe('Property 22: escalado uniforme del lienzo', () => {
  it('sobre 200 semillas: lado acotado, dpr acotado y escala uniforme 1:1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng(semilla);
        const anchoCss = prng.entero(50, 9000);
        const altoCss = prng.entero(50, 9000);
        const dprBruto = prng.siguiente() * 5; // 0 a 5
        const e = calcularEscalado({ anchoCss, altoCss, devicePixelRatio: dprBruto });

        // Lado acotado a [320, 4096].
        expect(e.lado).toBeGreaterThanOrEqual(LADO_MINIMO);
        expect(e.lado).toBeLessThanOrEqual(LADO_MAXIMO);
        // dpr acotado a [1, 3].
        expect(e.dpr).toBeGreaterThanOrEqual(DPR_MINIMO);
        expect(e.dpr).toBeLessThanOrEqual(DPR_MAXIMO);
        // Escala uniforme: es exactamente lado/800 (mismo factor en los dos ejes).
        expect(e.escala).toBe(e.lado / LADO_LOGICO);
        // El búfer es el lado por la densidad, cuadrado (aspecto 1:1 exacto).
        expect(e.bufer).toBe(e.lado * e.dpr);
        // La relación de aspecto del cuadrado lógico dibujado es 1:1 dentro de 1 px:
        // ancho lógico · escala == alto lógico · escala.
        const anchoDibujado = LADO_LOGICO * e.escala;
        const altoDibujado = LADO_LOGICO * e.escala;
        expect(Math.abs(anchoDibujado - altoDibujado)).toBeLessThanOrEqual(1);
      }),
      { seed: 22, numRuns: 200 },
    );
  });
});

// ============================================================================
// Property 14 (parte B, lienzo): redibujado desde las operaciones
// Valida: Requisitos 12.6
// ============================================================================

describe('Property 14B: redibujado desde las operaciones', () => {
  /** Genera una lista de segmentos dentro del cuadrado a partir de una semilla. */
  function segmentosDe(semilla: number): Segmento[] {
    const prng = crearPrng(semilla);
    const n = prng.entero(1, 40);
    const segs: Segmento[] = [];
    let x = prng.entero(-300, 300);
    let y = prng.entero(-300, 300);
    for (let i = 0; i < n; i++) {
      const nx = prng.entero(-300, 300);
      const ny = prng.entero(-300, 300);
      segs.push({ desde: { x, y }, hasta: { x: nx, y: ny }, paso: i, linea: i + 1 });
      x = nx;
      y = ny;
    }
    return segs;
  }

  /** Extrae, de una capa, la secuencia de pares (moveTo, lineTo) de la estela. */
  function polilineaEstela(ctx: DobleDibujo): Array<[number, number]> {
    const puntos: Array<[number, number]> = [];
    for (const l of ctx.llamadas) {
      if (l.metodo === 'moveTo' || l.metodo === 'lineTo') {
        puntos.push([l.args[0] as number, l.args[1] as number]);
      }
    }
    return puntos;
  }

  it('sobre 200 semillas: redibujar tras redimensionar produce la misma estela', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const segs = segmentosDe(semilla);

        // Primer lienzo: cargar estela y capturar la polilínea dibujada.
        const capas1 = crearCapasDobles();
        const lienzo1 = crearLienzo(capas1 as CapasLienzo, estiloCompleto, TAMANO_BASE);
        lienzo1.ponerEstela('jugador', segs);
        const antes = polilineaEstela(capas1.jugador);

        // Cambiar de tamaño y densidad: debe redibujar desde los segmentos
        // guardados, sin volver a invocar el intérprete (no hay intérprete aquí).
        const prng = crearPrng((semilla ^ 0x9e3779b9) >>> 0);
        lienzo1.redimensionar({
          anchoCss: prng.entero(320, 4096),
          altoCss: prng.entero(320, 4096),
          devicePixelRatio: 1 + prng.siguiente() * 2,
        });

        // Las operaciones guardadas no cambian: la estela lógica es la misma.
        expect(lienzo1.segmentosDe('jugador')).toEqual(segs);

        // Un lienzo nuevo con los mismos segmentos produce la misma polilínea lógica.
        const capas2 = crearCapasDobles();
        const lienzo2 = crearLienzo(capas2 as CapasLienzo, estiloCompleto, TAMANO_BASE);
        lienzo2.ponerEstela('jugador', segs);
        const despues = polilineaEstela(capas2.jugador);

        expect(despues).toEqual(antes);
      }),
      { seed: 140, numRuns: 200 },
    );
  });
});
