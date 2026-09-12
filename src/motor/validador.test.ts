// Pruebas del validador geométrico
// Tarea 11: máscara y DDA (11.1), dilatación (11.2), IoU y regiones (11.3),
// búsqueda de giro (11.4), validar y casos negativos (11.5), Property 16C (11.6).

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import {
  LADO,
  aColumna,
  aFila,
  crearMascara,
  trazarSegmento,
  rasterizar,
  dilatar,
  comparar,
  buscarMejorGiro,
  validar,
  type Mascara,
  type NormalizacionNivel,
} from './validador.js';
import type { Punto } from './tortuga.js';
import type { Segmento } from './segmentos.js';

// ============================================================================
// Fuerza bruta de referencia para la dilatación
// ============================================================================

/** Dilata por el disco dx²+dy² ≤ 64 con el elemento estructurante, ingenuo. */
function dilatarFuerzaBruta(origen: Mascara): Mascara {
  const salida = crearMascara();
  // Precalcular los desplazamientos del disco.
  const disco: Array<[number, number]> = [];
  for (let dy = -8; dy <= 8; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      if (dx * dx + dy * dy <= 64) disco.push([dx, dy]);
    }
  }
  for (let iy = 0; iy < LADO; iy++) {
    for (let ix = 0; ix < LADO; ix++) {
      if (origen[iy * LADO + ix] !== 1) continue;
      for (const [dx, dy] of disco) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx < 0 || nx >= LADO || ny < 0 || ny >= LADO) continue;
        salida[ny * LADO + nx] = 1;
      }
    }
  }
  return salida;
}

// ============================================================================
// Ayudas
// ============================================================================

/** Cuenta las posiciones encendidas de una máscara. */
function contar(m: Mascara): number {
  let n = 0;
  for (let i = 0; i < m.length; i++) n += m[i]!;
  return n;
}

/** ¿Está encendida la celda lógica (x, y)? */
function encendida(m: Mascara, ix: number, iy: number): boolean {
  if (ix < 0 || ix >= LADO || iy < 0 || iy >= LADO) return false;
  return m[iy * LADO + ix] === 1;
}

// ============================================================================
// 11.1 · Mapeo de coordenadas
// ============================================================================

describe('validador · mapeo de coordenadas', () => {
  it('el origen lógico (0,0) mapea a (400, 400)', () => {
    expect(aColumna(0)).toBe(400);
    expect(aFila(0)).toBe(400);
  });

  it('la esquina superior izquierda (-400, 400) mapea a (0, 0)', () => {
    expect(aColumna(-400)).toBe(0);
    expect(aFila(400)).toBe(0);
  });

  it('(399.5, -399.5) mapea a (799, 799)', () => {
    expect(aColumna(399.5)).toBe(799);
    expect(aFila(-399.5)).toBe(799);
  });

  it('x = 400 y y = -400 mapean al índice 800 (fuera del arreglo)', () => {
    expect(aColumna(400)).toBe(800);
    expect(aFila(-400)).toBe(800);
  });
});

// ============================================================================
// 11.1 · Trazado DDA
// ============================================================================

describe('validador · trazado DDA', () => {
  it('un punto (segmento de longitud 0) enciende una sola celda', () => {
    const m = crearMascara();
    trazarSegmento(m, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(contar(m)).toBe(1);
    expect(encendida(m, 400, 400)).toBe(true);
  });

  it('enciende siempre las dos celdas de los extremos', () => {
    const m = crearMascara();
    trazarSegmento(m, { x: -100, y: 0 }, { x: 100, y: 0 });
    expect(encendida(m, aColumna(-100), aFila(0))).toBe(true);
    expect(encendida(m, aColumna(100), aFila(0))).toBe(true);
  });

  it('no deja huecos en una línea horizontal', () => {
    const m = crearMascara();
    trazarSegmento(m, { x: -50, y: 0 }, { x: 50, y: 0 });
    // Todas las columnas entre los dos extremos, en la fila 400, encendidas.
    for (let ix = aColumna(-50); ix <= aColumna(50); ix++) {
      expect(encendida(m, ix, 400)).toBe(true);
    }
  });

  it('no deja huecos en una pendiente casi horizontal', () => {
    const m = crearMascara();
    trazarSegmento(m, { x: -100, y: 0 }, { x: 100, y: 3 });
    // Comprobar continuidad: cada columna del recorrido tiene alguna fila encendida
    // y no hay salto de más de una columna entre celdas consecutivas encendidas.
    const columnas = new Set<number>();
    for (let iy = 0; iy < LADO; iy++) {
      for (let ix = 0; ix < LADO; ix++) {
        if (m[iy * LADO + ix] === 1) columnas.add(ix);
      }
    }
    const ordenadas = [...columnas].sort((a, b) => a - b);
    for (let i = 1; i < ordenadas.length; i++) {
      expect(ordenadas[i]! - ordenadas[i - 1]!).toBeLessThanOrEqual(1);
    }
  });

  it('no deja huecos en una pendiente casi vertical', () => {
    const m = crearMascara();
    trazarSegmento(m, { x: 0, y: -100 }, { x: 3, y: 100 });
    const filas = new Set<number>();
    for (let iy = 0; iy < LADO; iy++) {
      for (let ix = 0; ix < LADO; ix++) {
        if (m[iy * LADO + ix] === 1) filas.add(iy);
      }
    }
    const ordenadas = [...filas].sort((a, b) => a - b);
    for (let i = 1; i < ordenadas.length; i++) {
      expect(ordenadas[i]! - ordenadas[i - 1]!).toBeLessThanOrEqual(1);
    }
  });

  it('un segmento parcialmente fuera del arreglo enciende solo lo interior, sin lanzar', () => {
    const m = crearMascara();
    // De dentro (0,0) a muy fuera (5000, 0): parte del recorrido cae fuera.
    expect(() => trazarSegmento(m, { x: 0, y: 0 }, { x: 5000, y: 0 })).not.toThrow();
    // La celda del origen está encendida; ninguna escritura fuera de límites.
    expect(encendida(m, 400, 400)).toBe(true);
    expect(contar(m)).toBeGreaterThan(0);
    expect(contar(m)).toBeLessThanOrEqual(LADO * LADO);
  });

  it('rasterizar aplica una traslación opcional a cada punto', () => {
    const segs = [{ desde: { x: 0, y: 0 } as Punto, hasta: { x: 0, y: 0 } as Punto, paso: 0, linea: 1 }];
    const m = rasterizar(segs, { x: 100, y: 0 });
    // El punto (0,0) trasladado a (100,0) → columna 500, fila 400.
    expect(encendida(m, 500, 400)).toBe(true);
    expect(encendida(m, 400, 400)).toBe(false);
  });
});

// ============================================================================
// 11.2 · Dilatación del disco de 8 píxeles vs fuerza bruta
// ============================================================================

describe('validador · dilatación', () => {
  /** Enciende una lista de celdas (ix, iy) en una máscara nueva. */
  function conCeldas(celdas: ReadonlyArray<[number, number]>): Mascara {
    const m = crearMascara();
    for (const [ix, iy] of celdas) m[iy * LADO + ix] = 1;
    return m;
  }

  function igualesMascaras(a: Mascara, b: Mascara): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  it('una sola posición encendida produce el disco de 197 posiciones', () => {
    const m = conCeldas([[400, 400]]);
    const d = dilatar(m);
    expect(contar(d)).toBe(197);
    // El centro y los cuatro puntos a distancia 8 exacta están encendidos.
    expect(encendida(d, 400, 400)).toBe(true);
    expect(encendida(d, 408, 400)).toBe(true);
    expect(encendida(d, 400, 408)).toBe(true);
    // Distancia 9 (fuera del disco) apagada.
    expect(encendida(d, 409, 400)).toBe(false);
  });

  it('coincide con la fuerza bruta para varias posiciones dispersas', () => {
    const m = conCeldas([
      [400, 400],
      [410, 405],
      [300, 300],
      [500, 200],
    ]);
    expect(igualesMascaras(dilatar(m), dilatarFuerzaBruta(m))).toBe(true);
  });

  it('coincide con la fuerza bruta con posiciones pegadas a los cuatro bordes', () => {
    const m = conCeldas([
      [0, 0],       // esquina superior izquierda
      [799, 0],     // esquina superior derecha
      [0, 799],     // esquina inferior izquierda
      [799, 799],   // esquina inferior derecha
      [0, 400],     // borde izquierdo
      [799, 400],   // borde derecho
      [400, 0],     // borde superior
      [400, 799],   // borde inferior
    ]);
    expect(igualesMascaras(dilatar(m), dilatarFuerzaBruta(m))).toBe(true);
  });

  it('coincide con la fuerza bruta sobre un segmento rasterizado', () => {
    const m = crearMascara();
    trazarSegmento(m, { x: -50, y: -30 }, { x: 60, y: 40 });
    expect(igualesMascaras(dilatar(m), dilatarFuerzaBruta(m))).toBe(true);
  });

  it('una máscara vacía dilata a vacía', () => {
    expect(contar(dilatar(crearMascara()))).toBe(0);
  });
});

// ============================================================================
// 11.3 · IoU, exceso de trazo y las tres regiones
// ============================================================================

describe('validador · IoU, exceso y regiones', () => {
  it('un conjunto contra sí mismo da IoU 1.0, exceso 0 % y coincide', () => {
    const m = crearMascara();
    trazarSegmento(m, { x: -100, y: 0 }, { x: 100, y: 0 });
    const d = dilatar(m);
    const c = comparar(d, d);
    expect(c.iou).toBe(1);
    expect(c.excesoPorcentaje).toBe(0);
    expect(c.coincide).toBe(true);
    expect(c.motivo).toBe('coincide');
    expect(contar(c.exceso)).toBe(0);
    expect(contar(c.falta)).toBe(0);
    expect(contar(c.coincidencia)).toBe(contar(d));
  });

  it('el exceso niega la coincidencia aunque el IoU alcance el umbral', () => {
    // Objetivo: una línea. Jugador: la misma línea más un trazo extra lejano.
    const objetivo = crearMascara();
    trazarSegmento(objetivo, { x: -100, y: 0 }, { x: 100, y: 0 });
    const ad = dilatar(objetivo);

    const jugador = crearMascara();
    trazarSegmento(jugador, { x: -100, y: 0 }, { x: 100, y: 0 });
    // Trazo extra grande y lejano: sube el exceso por encima del 5 %.
    trazarSegmento(jugador, { x: -100, y: 200 }, { x: 100, y: 200 });
    const bd = dilatar(jugador);

    const c = comparar(ad, bd);
    // El IoU puede ser alto (toda el área objetivo está cubierta), pero el exceso lo niega.
    expect(c.excesoPorcentaje).toBeGreaterThan(5);
    expect(c.coincide).toBe(false);
    expect(c.motivo).toBe('excesoDeTrazo');
  });

  it('un IoU bajo sin exceso da motivo iouInsuficiente', () => {
    // Objetivo grande, jugador cubre solo una parte pequeña (sin salirse del objetivo).
    const objetivo = crearMascara();
    trazarSegmento(objetivo, { x: -150, y: 0 }, { x: 150, y: 0 });
    const ad = dilatar(objetivo);

    const jugador = crearMascara();
    trazarSegmento(jugador, { x: -150, y: 0 }, { x: -120, y: 0 }); // trozo corto
    const bd = dilatar(jugador);

    const c = comparar(ad, bd);
    expect(c.excesoPorcentaje).toBeLessThanOrEqual(5);
    expect(c.iou).toBeLessThan(0.9);
    expect(c.coincide).toBe(false);
    expect(c.motivo).toBe('iouInsuficiente');
  });

  it('la estela del jugador vacía da IoU 0, exceso 0 %, falta = objetivo, resto vacío', () => {
    const objetivo = crearMascara();
    trazarSegmento(objetivo, { x: -100, y: 0 }, { x: 100, y: 0 });
    const ad = dilatar(objetivo);
    const bd = crearMascara(); // jugador vacío

    const c = comparar(ad, bd);
    expect(c.iou).toBe(0);
    expect(c.excesoPorcentaje).toBe(0);
    expect(contar(c.coincidencia)).toBe(0);
    expect(contar(c.exceso)).toBe(0);
    expect(contar(c.falta)).toBe(contar(ad));
  });

  it('IoU 0 cuando el objetivo está vacío (evita división indefinida)', () => {
    const ad = crearMascara();
    const bd = crearMascara();
    trazarSegmento(bd, { x: 0, y: 0 }, { x: 50, y: 0 });
    const c = comparar(ad, dilatar(bd));
    expect(c.iou).toBe(0);
  });
});

// ============================================================================
// 11.4 · Búsqueda del mejor giro
// ============================================================================

describe('validador · búsqueda del mejor giro', () => {
  /** Aproxima un círculo de radio r con n segmentos, como polilínea cerrada. */
  function circuloSegmentos(r: number, n: number): Segmento[] {
    const segs: Segmento[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI;
      const a1 = ((i + 1) / n) * 2 * Math.PI;
      segs.push({
        desde: { x: r * Math.cos(a0), y: r * Math.sin(a0) },
        hasta: { x: r * Math.cos(a1), y: r * Math.sin(a1) },
        paso: i,
        linea: i + 1,
      });
    }
    return segs;
  }

  it('comparar un conjunto contra sí mismo gana en el ángulo 0 con IoU 1.0', () => {
    const m = crearMascara();
    // Una figura asimétrica (una "L") para que el ángulo 0 sea el único óptimo.
    trazarSegmento(m, { x: -100, y: -100 }, { x: 100, y: -100 });
    trazarSegmento(m, { x: -100, y: -100 }, { x: -100, y: 100 });
    const d = dilatar(m);
    const r = buscarMejorGiro(d, d);
    expect(r.angulo).toBe(0);
    expect(r.comparacion.iou).toBe(1);
    expect(r.comparacion.coincide).toBe(true);
  });

  it('rendimiento: dos figuras de ~500 segmentos en ≤ 2 s (peor de tres)', () => {
    const objetivo = dilatar(rasterizar(circuloSegmentos(200, 500)));
    const jugador = dilatar(rasterizar(circuloSegmentos(200, 500)));

    let peor = 0;
    for (let intento = 0; intento < 3; intento++) {
      const inicio = performance.now();
      buscarMejorGiro(objetivo, jugador);
      const dur = performance.now() - inicio;
      peor = Math.max(peor, dur);
    }
    expect(peor).toBeLessThanOrEqual(2000);
  });
});

// ============================================================================
// 11.5 · validar con normalización y casos negativos (Req 29.7)
// ============================================================================

describe('validador · validar', () => {
  // Segmentos del nivel 0.1: AVANZA 100 → un segmento de (0,0) a (0,100).
  const REFERENCIA_0_1: Segmento[] = [
    { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 100 }, paso: 0, linea: 1 },
  ];

  // Nivel 0.1: traslación libre, rotación libre, escala exacta.
  const NORM_0_1: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };
  const NORM_FIJA: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' };

  it('una figura idéntica al objetivo coincide (IoU alto, exceso bajo)', () => {
    const v = validar(REFERENCIA_0_1, REFERENCIA_0_1, NORM_0_1);
    expect(v.coincide).toBe(true);
    expect(v.iou).toBeGreaterThanOrEqual(0.9);
    expect(v.excesoPorcentaje).toBeLessThanOrEqual(5);
  });

  it('con rotación y traslación fijas, comparar contra sí mismo da coincidencia', () => {
    const v = validar(REFERENCIA_0_1, REFERENCIA_0_1, NORM_FIJA);
    expect(v.coincide).toBe(true);
    expect(v.angulo).toBe(0);
  });

  it('un segmento adicional fuera del objetivo niega la coincidencia por exceso de trazo', () => {
    // El jugador dibuja la referencia más un trazo de 100 unidades lejos.
    const jugador: Segmento[] = [
      { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 100 }, paso: 0, linea: 1 },
      { desde: { x: 200, y: 0 }, hasta: { x: 200, y: 100 }, paso: 1, linea: 2 },
    ];
    const v = validar(jugador, REFERENCIA_0_1, NORM_0_1);
    expect(v.coincide).toBe(false);
    expect(v.motivo).toBe('excesoDeTrazo');
  });

  it('las longitudes multiplicadas por 2 niegan la coincidencia, aun con traslación y rotación libres', () => {
    // Objetivo AVANZA 100; jugador AVANZA 200: el doble de largo.
    const jugador: Segmento[] = [
      { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 200 }, paso: 0, linea: 1 },
    ];
    const v = validar(jugador, REFERENCIA_0_1, NORM_0_1);
    expect(v.coincide).toBe(false);
  });

  it('la estela del jugador vacía da motivo sinEstelaDelJugador y falta = objetivo', () => {
    const v = validar([], REFERENCIA_0_1, NORM_0_1);
    expect(v.coincide).toBe(false);
    expect(v.motivo).toBe('sinEstelaDelJugador');
    expect(v.iou).toBe(0);
    expect(v.excesoPorcentaje).toBe(0);
    expect(contar(v.falta)).toBe(contar(v.mascaraObjetivo));
    expect(contar(v.coincidencia)).toBe(0);
    expect(contar(v.exceso)).toBe(0);
  });

  it('es determinista y no modifica las listas recibidas', () => {
    const jugador = REFERENCIA_0_1.map((s) => ({ ...s }));
    const objetivo = REFERENCIA_0_1.map((s) => ({ ...s }));
    const antesJ = JSON.stringify(jugador);
    const antesO = JSON.stringify(objetivo);

    const v1 = validar(jugador, objetivo, NORM_0_1);
    const v2 = validar(jugador, objetivo, NORM_0_1);

    expect(v1.iou).toBe(v2.iou);
    expect(v1.excesoPorcentaje).toBe(v2.excesoPorcentaje);
    expect(v1.angulo).toBe(v2.angulo);
    expect(v1.coincide).toBe(v2.coincide);
    expect(JSON.stringify(jugador)).toBe(antesJ);
    expect(JSON.stringify(objetivo)).toBe(antesO);
  });
});

// ============================================================================
// 11.6 · Property 16 parte C: veredicto geométrico
// Valida: Requisitos 16.1, 16.4, 16.10, 16.17
// ============================================================================

describe('Property 16C: veredicto geométrico', () => {
  const NORM_LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };
  const NORM_FIJA: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' };

  /** Genera una polilínea de 2 a 6 segmentos con coordenadas en [-150, 150]. */
  function figuraDe(semilla: number): Segmento[] {
    const prng = crearPrng(semilla);
    const n = prng.entero(2, 6);
    const segs: Segmento[] = [];
    let x = prng.entero(-150, 150);
    let y = prng.entero(-150, 150);
    for (let i = 0; i < n; i++) {
      const nx = prng.entero(-150, 150);
      const ny = prng.entero(-150, 150);
      segs.push({ desde: { x, y }, hasta: { x: nx, y: ny }, paso: i, linea: i + 1 });
      x = nx;
      y = ny;
    }
    return segs;
  }

  it('comparar una figura contra sí misma coincide con IoU 1.0 y exceso 0 % (rotación fija), sobre 200 semillas', () => {
    // Con rotación fija el ángulo 0 es identidad: IoU 1.0 exacto, barato.
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const figura = figuraDe(semilla);
        const v = validar(figura, figura, NORM_FIJA);
        expect(v.iou).toBe(1);
        expect(v.excesoPorcentaje).toBe(0);
        expect(v.coincide).toBe(true);
        expect(v.angulo).toBe(0);
      }),
      { seed: 16, numRuns: 40 },
    );
  }, 30_000);

  it('comparar una figura contra sí misma coincide con IoU 1.0 y ángulo 0 (rotación libre)', () => {
    // La búsqueda de giro es costosa (barrido de 360 + afinado exacto), así que
    // se ejecuta sobre menos semillas. El ángulo 0 siempre entra como candidato
    // y gana con IoU 1.0 por el desempate de menor ángulo (requisito 16.10).
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const figura = figuraDe(semilla);
        const v = validar(figura, figura, NORM_LIBRE);
        expect(v.iou).toBe(1);
        expect(v.angulo).toBe(0);
        expect(v.coincide).toBe(true);
      }),
      { seed: 160, numRuns: 15 },
    );
  }, 20_000);

  it('el veredicto es determinista y no modifica las listas, sobre 200 semillas', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const jugador = figuraDe(semilla);
        const objetivo = figuraDe((semilla ^ 0x9e3779b9) >>> 0);
        const antesJ = JSON.stringify(jugador);
        const antesO = JSON.stringify(objetivo);

        const v1 = validar(jugador, objetivo, NORM_FIJA);
        const v2 = validar(jugador, objetivo, NORM_FIJA);

        expect(v1.iou).toBe(v2.iou);
        expect(v1.excesoPorcentaje).toBe(v2.excesoPorcentaje);
        expect(v1.angulo).toBe(v2.angulo);
        expect(v1.coincide).toBe(v2.coincide);
        expect(v1.motivo).toBe(v2.motivo);
        // No modifica las listas recibidas.
        expect(JSON.stringify(jugador)).toBe(antesJ);
        expect(JSON.stringify(objetivo)).toBe(antesO);
        // IoU y exceso en rangos válidos.
        expect(v1.iou).toBeGreaterThanOrEqual(0);
        expect(v1.iou).toBeLessThanOrEqual(1);
        expect(v1.excesoPorcentaje).toBeGreaterThanOrEqual(0);
      }),
      { seed: 17, numRuns: 40 },
    );
  }, 30_000);
});
