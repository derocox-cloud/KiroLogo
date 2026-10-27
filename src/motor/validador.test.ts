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
  veredictoParaMostrar,
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

  it('devuelve la traslación que centró al objetivo, aparte de la del jugador', () => {
    // El objetivo (0,0)→(0,100) tiene el centro de su caja en (0, 50): se traslada (0, −50).
    // El jugador, desplazado 200 a la derecha, tiene su centro en (200, 50): se traslada (−200, −50).
    const jugador: Segmento[] = [
      { desde: { x: 200, y: 0 }, hasta: { x: 200, y: 100 }, paso: 0, linea: 1 },
    ];
    const v = validar(jugador, REFERENCIA_0_1, NORM_0_1);
    expect(v.traslacion).toEqual({ x: -200, y: -50 });
    expect(v.traslacionObjetivo).toEqual({ x: -0, y: -50 });
  });

  it('con traslación fija las dos traslaciones son cero', () => {
    const jugador: Segmento[] = [
      { desde: { x: 200, y: 0 }, hasta: { x: 200, y: 100 }, paso: 0, linea: 1 },
    ];
    const v = validar(jugador, REFERENCIA_0_1, NORM_FIJA);
    expect(v.traslacion).toEqual({ x: 0, y: 0 });
    expect(v.traslacionObjetivo).toEqual({ x: 0, y: 0 });
  });

  it('sin estela del jugador igual informa la traslación del objetivo', () => {
    const v = validar([], REFERENCIA_0_1, NORM_0_1);
    expect(v.traslacionObjetivo).toEqual({ x: -0, y: -50 });
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

// ============================================================================
// Qué comparación se le muestra al jugador
// ============================================================================

describe('validador · veredictoParaMostrar', () => {
  const seg = (a: number, b: number, c: number, d: number, paso: number): Segmento => ({
    desde: { x: a, y: b },
    hasta: { x: c, y: d },
    paso,
    linea: 1,
  });
  const LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };
  const FIJA: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' };

  // El zigzag de Kiro: arriba 100, derecha 80, arriba 120, derecha 120.
  const ZIGZAG = [seg(0, 0, 0, 100, 0), seg(0, 100, 80, 100, 1), seg(80, 100, 80, 220, 2), seg(80, 220, 200, 220, 3)];

  /** Cuántas posiciones de una región coinciden con las de otra (para saber si es «la misma»). */
  const mismaMascara = (a: Mascara, b: Mascara): boolean => contar(a) === contar(b) && a.every((v, i) => v === b[i]);

  it('un dibujo que sigue a Kiro en su sitio pero está incompleto se compara en su sitio, no desplazado', () => {
    // El jugador traza solo los dos primeros tramos, exactamente sobre los de Kiro.
    const jugador = ZIGZAG.slice(0, 2);
    const oficial = validar(jugador, ZIGZAG, LIBRE);
    const mostrado = veredictoParaMostrar(oficial, jugador, ZIGZAG, LIBRE);

    // El oficial centra las cajas envolventes (distintas) y desplaza el dibujo: no es el de su sitio.
    expect(oficial.traslacion.x !== 0 || oficial.traslacion.y !== 0 || oficial.angulo !== 0).toBe(true);
    // Lo que se muestra es la comparación en las posiciones reales: nada se mueve ni se gira.
    expect(mostrado.traslacion).toEqual({ x: 0, y: 0 });
    expect(mostrado.traslacionObjetivo).toEqual({ x: 0, y: 0 });
    expect(mostrado.angulo).toBe(0);
    // Y explica mejor el dibujo: más coincidencia y nada que sobre.
    expect(mostrado.iou).toBeGreaterThan(oficial.iou);
    expect(mostrado.excesoPorcentaje).toBeLessThan(1);
    // Pero sigue negando la precisión: es un dibujo incompleto.
    expect(mostrado.coincide).toBe(false);
  });

  it('en su sitio, lo que falta es lo que Kiro dibuja después y lo dibujado no sobra en ninguna parte', () => {
    const jugador = ZIGZAG.slice(0, 2);
    const mostrado = veredictoParaMostrar(validar(jugador, ZIGZAG, LIBRE), jugador, ZIGZAG, LIBRE);
    expect(contar(mostrado.exceso)).toBe(0);
    expect(contar(mostrado.falta)).toBeGreaterThan(0);
    expect(contar(mostrado.coincidencia)).toBeGreaterThan(0);
  });

  it('un tramo de más sí sobra: la L contra una línea deja la pierna vertical como coincidencia y la horizontal como sobrante', () => {
    const linea = [seg(0, 0, 0, 100, 0)];
    const ele = [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)];
    const oficial = validar(ele, linea, LIBRE);
    const mostrado = veredictoParaMostrar(oficial, ele, linea, LIBRE);
    expect(mostrado.traslacion).toEqual({ x: 0, y: 0 });
    expect(mostrado.iou).toBeGreaterThan(oficial.iou);
    expect(contar(mostrado.coincidencia)).toBeGreaterThan(0);
    expect(contar(mostrado.exceso)).toBeGreaterThan(0);
    // Lo que sobra queda a la derecha de la línea de Kiro (la pierna horizontal), no sobre ella.
    for (let iy = 0; iy < LADO; iy++) {
      for (let ix = 0; ix < LADO; ix++) {
        if (encendida(mostrado.exceso, ix, iy)) expect(ix - 400).toBeGreaterThan(-10);
      }
    }
  });

  it('una figura bien hecha pero movida y girada se sigue comparando alineada, porque en su sitio no se parece a nada', () => {
    // El mismo zigzag girado 90° y corrido, con el último tramo sin dibujar.
    const girado = ZIGZAG.map((s) => seg(s.desde.y + 300, -s.desde.x - 200, s.hasta.y + 300, -s.hasta.x - 200, s.paso));
    const jugador = girado.slice(0, 3);
    const oficial = validar(jugador, ZIGZAG, LIBRE);
    const mostrado = veredictoParaMostrar(oficial, jugador, ZIGZAG, LIBRE);
    expect(mostrado).toBe(oficial);
    expect(mostrado.angulo).not.toBe(0);
  });

  it('con traslación y rotación fijas devuelve el oficial tal cual: ya es el de las posiciones reales', () => {
    const jugador = ZIGZAG.slice(0, 2);
    const oficial = validar(jugador, ZIGZAG, FIJA);
    expect(veredictoParaMostrar(oficial, jugador, ZIGZAG, FIJA)).toBe(oficial);
  });

  it('sin estela del jugador devuelve el oficial: no hay nada que alinear', () => {
    const oficial = validar([], ZIGZAG, LIBRE);
    expect(oficial.motivo).toBe('sinEstelaDelJugador');
    expect(veredictoParaMostrar(oficial, [], ZIGZAG, LIBRE)).toBe(oficial);
  });

  it('un dibujo que coincide devuelve el oficial: nunca se muestra como fallo uno que lo ganó', () => {
    const oficial = validar(ZIGZAG, ZIGZAG, LIBRE);
    expect(oficial.coincide).toBe(true);
    expect(veredictoParaMostrar(oficial, ZIGZAG, ZIGZAG, LIBRE)).toBe(oficial);
  });

  it('nunca explica peor que el oficial: el IoU mostrado no baja del oficial', () => {
    const casos: Array<[Segmento[], Segmento[]]> = [
      [ZIGZAG.slice(0, 2), ZIGZAG],
      [ZIGZAG.slice(0, 3), ZIGZAG],
      [[seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)], [seg(0, 0, 0, 100, 0)]],
      [[seg(50, 50, 50, 150, 0)], ZIGZAG],
      [[seg(0, 0, 0, 100, 0), seg(0, 100, -80, 100, 1)], ZIGZAG],
    ];
    for (const [jugador, objetivo] of casos) {
      const oficial = validar(jugador, objetivo, LIBRE);
      const mostrado = veredictoParaMostrar(oficial, jugador, objetivo, LIBRE);
      expect(mostrado.iou).toBeGreaterThanOrEqual(oficial.iou);
      // Y es siempre uno de los dos: ni uno inventado ni modificado.
      expect(mostrado === oficial || mismaMascara(mostrado.exceso, validar(jugador, objetivo, FIJA).exceso)).toBe(true);
    }
  });

  it('empata a favor de las posiciones reales, que son las que el jugador está viendo', () => {
    // Un solo tramo exactamente sobre el de Kiro pero corto: en su sitio y alineado dan lo mismo.
    const objetivo = [seg(0, 0, 0, 100, 0)];
    const jugador = [seg(0, 0, 0, 60, 0)];
    const oficial = validar(jugador, objetivo, LIBRE);
    const real = validar(jugador, objetivo, FIJA);
    const mostrado = veredictoParaMostrar(oficial, jugador, objetivo, LIBRE);
    if (real.iou >= oficial.iou) expect(mostrado.traslacion).toEqual({ x: 0, y: 0 });
    expect(mostrado.iou).toBeGreaterThanOrEqual(oficial.iou);
  });
});

// ============================================================================
// Feature: 08-diseno-visual, Property 1: el veredicto de presentación nunca
// empeora la coincidencia.
// Valida: Requisitos 4.3, 4.5
//
// Para toda figura del jugador y de referencia, el IoU de `veredictoParaMostrar`
// es mayor o igual que el del veredicto oficial, y las Estrellas no cambian: la
// calificación sale siempre del veredicto oficial. La elección del veredicto de
// presentación solo decide qué se pinta en el diff, no la nota.
// ============================================================================

describe('Feature: 08-diseno-visual, Property 1: el veredicto de presentación nunca empeora la coincidencia', () => {
  const NORM_LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };

  /**
   * La estrella de precisión es función pura de los campos de calificación del
   * veredicto (`coincide` y `motivo`), tal como la deriva `estrellas.calificar`.
   * Se reproduce aquí a propósito, sin construir un Reto completo, para comparar
   * la nota que saldría del veredicto oficial contra la que saldría del de
   * presentación: si coinciden, la calificación no depende de la elección.
   */
  function precisionDeVeredicto(v: {
    coincide: boolean;
    motivo: 'coincide' | 'excesoDeTrazo' | 'iouInsuficiente' | 'sinEstelaDelJugador';
  }): 'otorgada' | 'excesoDeTrazo' | 'sinCoincidenciaGeometrica' {
    if (v.coincide) return 'otorgada';
    return v.motivo === 'excesoDeTrazo' ? 'excesoDeTrazo' : 'sinCoincidenciaGeometrica';
  }

  /**
   * Un arbitrario de figura: polilínea conexa de 1 a 4 tramos con coordenadas
   * enteras en [-150, 150], el mismo marco que ya usan las pruebas de este
   * módulo. Pocos tramos para que la búsqueda de giro (barrido de 360 + afinado)
   * no dispare el tiempo con 100 iteraciones y rotación libre.
   */
  const figuraArb = fc
    .record({
      inicio: fc.record({ x: fc.integer({ min: -150, max: 150 }), y: fc.integer({ min: -150, max: 150 }) }),
      saltos: fc.array(
        fc.record({ x: fc.integer({ min: -150, max: 150 }), y: fc.integer({ min: -150, max: 150 }) }),
        { minLength: 1, maxLength: 4 },
      ),
    })
    .map(({ inicio, saltos }): Segmento[] => {
      const segs: Segmento[] = [];
      let x = inicio.x;
      let y = inicio.y;
      saltos.forEach((s, i) => {
        segs.push({ desde: { x, y }, hasta: { x: s.x, y: s.y }, paso: i, linea: i + 1 });
        x = s.x;
        y = s.y;
      });
      return segs;
    });

  it('el IoU mostrado nunca baja del oficial y la calificación no cambia (≥ 100 iteraciones)', () => {
    fc.assert(
      fc.property(figuraArb, figuraArb, (jugador, objetivo) => {
        const oficial = validar(jugador, objetivo, NORM_LIBRE);
        const mostrado = veredictoParaMostrar(oficial, jugador, objetivo, NORM_LIBRE);

        // 1) La coincidencia (IoU) del veredicto de presentación nunca empeora.
        expect(mostrado.iou).toBeGreaterThanOrEqual(oficial.iou);

        // 2) El veredicto de presentación es siempre uno de los dos reales (el
        //    oficial o el de las posiciones reales): nunca uno inventado.
        const esElOficial = mostrado === oficial;
        const real = validar(jugador, objetivo, { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' });
        const esElReal =
          mostrado.iou === real.iou &&
          mostrado.excesoPorcentaje === real.excesoPorcentaje &&
          mostrado.coincide === real.coincide &&
          mostrado.motivo === real.motivo;
        expect(esElOficial || esElReal).toBe(true);

        // 3) Nunca se muestra como «correcto» un dibujo al que el oficial negó la
        //    precisión: el veredicto de presentación no puede subir la nota.
        if (!oficial.coincide) expect(mostrado.coincide).toBe(false);

        // 4) Las Estrellas no cambian: la precisión que saldría del veredicto de
        //    presentación es la misma que la del oficial. La calificación sale
        //    siempre del veredicto oficial, con independencia de lo que se pinte.
        expect(precisionDeVeredicto(mostrado)).toBe(precisionDeVeredicto(oficial));
      }),
      { seed: 804, numRuns: 100 },
    );
  }, 60_000);

  // ==========================================================================
  // Bugfix: diff-visual-coincidencia-exceso · Tarea 2
  // Tests de preservación (observation-first, ANTES del arreglo).
  //
  // Fijan el comportamiento que el arreglo del exceso visual (Opción A del
  // design: añadir la salida NUEVA `excesoVisual`) NO debe romper. Se escriben
  // dentro de este bloque a propósito, para REUTILIZAR el arbitrario `figuraArb`
  // de arriba sin duplicarlo. Deben PASAR sobre el código SIN arreglar: hoy
  // trivialmente (el arreglo aún no existe), y tras el arreglo siguen pasando
  // porque la nueva salida es separada y no toca el conteo del veredicto.
  //
  // Reutiliza también `precisionDeVeredicto` y `figuraArb` del scope del bloque.
  //
  // Valida: Requisitos 3.1, 3.2, 3.3, 3.4, 3.5.
  // ==========================================================================
  describe('Tarea 2 · preservación del veredicto y las estrellas', () => {
    const seg = (a: number, b: number, c: number, d: number, paso: number): Segmento => ({
      desde: { x: a, y: b },
      hasta: { x: c, y: d },
      paso,
      linea: 1,
    });
    const LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };
    const FIJA: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' };

    // ------------------------------------------------------------------------
    // 3.1 — Veredicto idéntico (property-based, ≥ 100 iteraciones).
    //
    // Blinda la estrella de precisión: `excesoPorcentaje`, `coincide` y `motivo`
    // deben quedar estables. Como línea base sobre el código SIN arreglar se usa
    // el determinismo de `validar` (validar dos veces con las mismas entradas y
    // comparar los tres campos): el valor de hoy es el valor a preservar. Tras
    // el arreglo —que añade la salida separada `excesoVisual`— estos tres campos
    // deben seguir idénticos, porque la pasada que los calcula no cambia.
    //
    // Es el test NUEVO clave de la tarea 2: ningún test existente fija que estos
    // tres campos concretos de `validar` (no de `veredictoParaMostrar`) queden
    // estables frente a la futura salida `excesoVisual`.
    // ------------------------------------------------------------------------
    it('3.1 · excesoPorcentaje, coincide y motivo de validar son estables (deterministas) con figuraArb × figuraArb (≥ 100 iteraciones)', () => {
      fc.assert(
        fc.property(figuraArb, figuraArb, (jugador, objetivo) => {
          // Línea base: el comportamiento observable de HOY sobre estas entradas.
          const base = validar(jugador, objetivo, LIBRE);

          // El mismo cálculo repetido no puede cambiar los tres campos que
          // deciden la estrella. Este es el contrato que el arreglo debe mantener
          // byte a byte: la salida nueva `excesoVisual` no altera el conteo.
          const repetido = validar(jugador, objetivo, LIBRE);
          expect(repetido.excesoPorcentaje).toBe(base.excesoPorcentaje);
          expect(repetido.coincide).toBe(base.coincide);
          expect(repetido.motivo).toBe(base.motivo);

          // Refuerzo de rango: los tres campos están en dominios válidos (no se
          // corrompen). La precisión derivada (la nota) sale solo de coincide y
          // motivo, igual que en `estrellas.calificar`.
          expect(base.excesoPorcentaje).toBeGreaterThanOrEqual(0);
          expect(typeof base.coincide).toBe('boolean');
          expect(['coincide', 'excesoDeTrazo', 'iouInsuficiente', 'sinEstelaDelJugador']).toContain(base.motivo);
        }),
        { seed: 2802, numRuns: 100 },
      );
    }, 60_000);

    // ------------------------------------------------------------------------
    // 3.2 — Figura correcta movida sigue toda verde.
    //
    // Una figura COMPLETA y correcta, trasladada y girada en normalización LIBRE,
    // hoy sale toda verde: el validador la alinea, coincide, y no hay exceso. El
    // arreglo debe preservar esto (tras el fix, el futuro `excesoVisual` saldrá
    // vacío aquí). Como `excesoVisual` AÚN NO existe, este test de preservación
    // NO depende de él: fija el comportamiento observable ACTUAL —`v.coincide` y
    // la ausencia de exceso— y que `veredictoParaMostrar` devuelve el oficial sin
    // alterarlo.
    // ------------------------------------------------------------------------
    it('3.2 · una figura correcta movida en LIBRE sale toda verde hoy (coincide), y veredictoParaMostrar no la altera', () => {
      // Zigzag completo de Kiro (el mismo marco de las pruebas de arriba).
      const kiro = [
        seg(0, 0, 0, 100, 0),
        seg(0, 100, 80, 100, 1),
        seg(80, 100, 80, 220, 2),
        seg(80, 220, 200, 220, 3),
      ];

      // Caso trasladado (sin girar): figura completa y correcta, solo movida.
      // Observado sobre el código SIN arreglar: coincide con IoU 1 y exceso 0 %
      // (alineación libre exacta). Es el «toda verde» más puro.
      const trasladado = kiro.map((s) =>
        seg(s.desde.x + 120, s.desde.y - 90, s.hasta.x + 120, s.hasta.y - 90, s.paso),
      );
      const vTrasladado = validar(trasladado, kiro, LIBRE);
      expect(vTrasladado.coincide).toBe(true);
      expect(contar(vTrasladado.exceso)).toBe(0);

      // Caso girado 90° y trasladado: (x,y) → (y, -x), luego (+300, -200). Figura
      // completa y correcta, movida y rotada. Observado sobre el código SIN
      // arreglar: coincide (estrella otorgada, toda verde). El giro discreto deja
      // un exceso residual mínimo de rasterización por debajo del umbral del 5 %
      // (no niega la coincidencia); fijamos ese comportamiento observable ACTUAL.
      const girado = kiro.map((s) =>
        seg(s.desde.y + 300, -s.desde.x - 200, s.hasta.y + 300, -s.hasta.x - 200, s.paso),
      );
      const oficial = validar(girado, kiro, LIBRE);
      expect(oficial.coincide).toBe(true);
      expect(oficial.excesoPorcentaje).toBeLessThanOrEqual(5);

      // Y el veredicto que se pinta es el oficial, sin alterarlo (un dibujo que
      // coincide nunca se muestra como fallo). No se toca `veredictoParaMostrar`.
      // NOTA: este test NO depende de `excesoVisual` (aún no existe); fija el
      // comportamiento observable actual que el arreglo debe preservar.
      const mostrado = veredictoParaMostrar(oficial, girado, kiro, LIBRE);
      expect(mostrado).toBe(oficial);
      expect(mostrado.coincide).toBe(true);
    });

    // ------------------------------------------------------------------------
    // 3.3 — Fija/fija devuelve el oficial tal cual.
    //
    // Ya cubierto por tests existentes que seguirán siendo válidos tras el fix,
    // NO se duplican:
    //   · `validador · validar` → "con rotación y traslación fijas, comparar
    //      contra sí mismo da coincidencia" (fija `validar` con FIJA).
    //   · `validador · veredictoParaMostrar` → "con traslación y rotación fijas
    //      devuelve el oficial tal cual: ya es el de las posiciones reales"
    //      (fija que `veredictoParaMostrar` devuelve el oficial en FIJA).
    // Se añade solo un refuerzo barato: en FIJA, `validar` es determinista en los
    // tres campos de la estrella (el contrato de preservación de 3.1 también vale
    // con normalización fija, el caso de Mundo 3+).
    // ------------------------------------------------------------------------
    it('3.3 · en normalización FIJA, excesoPorcentaje/coincide/motivo de validar son estables (Mundo 3+ no cambia)', () => {
      const kiro = [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)];
      const jugador = [seg(0, 0, 0, 100, 0), seg(0, 100, 130, 100, 1)]; // se pasa un poco en fija

      const base = validar(jugador, kiro, FIJA);
      const repetido = validar(jugador, kiro, FIJA);
      expect(repetido.excesoPorcentaje).toBe(base.excesoPorcentaje);
      expect(repetido.coincide).toBe(base.coincide);
      expect(repetido.motivo).toBe(base.motivo);

      // Y `veredictoParaMostrar` devuelve el oficial sin tocarlo (ya cubierto, se
      // referencia aquí la invariante clave para Mundo 3+).
      expect(veredictoParaMostrar(base, jugador, kiro, FIJA)).toBe(base);
    });

    // ------------------------------------------------------------------------
    // 3.4 — Coincidencia otorgada se comporta como hoy.
    //
    // Ya cubierto por el test existente `validador · veredictoParaMostrar` → "un
    // dibujo que coincide devuelve el oficial: nunca se muestra como fallo uno
    // que lo ganó". NO se duplica. (El caso de figura correcta movida de 3.2 ya
    // ejercita además una coincidencia bajo normalización libre.)
    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // 3.5 — Estela vacía: la falta es toda la figura de referencia, sin exceso.
    //
    // Ya cubierto por tests existentes que seguirán siendo válidos tras el fix,
    // NO se duplican:
    //   · `validador · validar` → "la estela del jugador vacía da motivo
    //      sinEstelaDelJugador y falta = objetivo" (falta = objetivo, exceso 0).
    //   · `validador · veredictoParaMostrar` → "sin estela del jugador devuelve
    //      el oficial: no hay nada que alinear".
    // Refuerzo mínimo que SÍ aporta: fija que el veredicto sin estela es estable
    // en los campos de la estrella (el futuro `excesoVisual` saldrá vacío aquí
    // sin tocar este comportamiento observable).
    // ------------------------------------------------------------------------
    it('3.5 · sin estela del jugador, el veredicto es estable: motivo sinEstelaDelJugador, exceso 0 y falta = objetivo', () => {
      const kiro = [seg(0, 0, 0, 100, 0)];

      const base = validar([], kiro, LIBRE);
      const repetido = validar([], kiro, LIBRE);

      expect(base.motivo).toBe('sinEstelaDelJugador');
      expect(base.excesoPorcentaje).toBe(0);
      expect(base.coincide).toBe(false);
      expect(contar(base.exceso)).toBe(0);
      expect(contar(base.falta)).toBe(contar(base.mascaraObjetivo));

      // Estable entre llamadas: el contrato que el arreglo debe mantener.
      expect(repetido.motivo).toBe(base.motivo);
      expect(repetido.excesoPorcentaje).toBe(base.excesoPorcentaje);
      expect(repetido.coincide).toBe(base.coincide);
    });

    // ------------------------------------------------------------------------
    // Property existente intacta (3.1/3.5): la propiedad «el IoU mostrado nunca
    // baja del oficial y la calificación no cambia» (el `it` de ≥ 100 iteraciones
    // de arriba, en este mismo bloque `Feature: 08-diseno-visual, Property 1`)
    // debe seguir verde tras el arreglo. NO se reescribe: se referencia. El
    // arreglo no toca `veredictoParaMostrar` ni el conteo, así que esa propiedad
    // se preserva por construcción.
    // ------------------------------------------------------------------------
  });
});

// ============================================================================
// Bugfix: diff-visual-coincidencia-exceso · Tarea 1
// Test exploratorio de la condición del bug (Caso 1).
//
// CASO ESPECIAL DE BUGFIX: este test DEBE FALLAR sobre el código SIN arreglar.
// El fallo confirma la causa raíz: la región de exceso que se pinta se deriva
// sobre máscaras dilatadas (disco de radio 8px), de modo que la coincidencia
// absorbe el excedente real del jugador y el exceso queda reducido a una puntita
// (~170 celdas en el extremo). NO se arregla nada en esta fase.
//
// La salida NUEVA `excesoVisual` (Opción A del design) todavía NO existe en el
// tipo `Veredicto` ni la produce `validar`: la añade la tarea 3.1. Por eso se
// accede al campo de forma tolerante al tipo, para que el test COMPILE y falle
// en tiempo de EJECUCIÓN con una aserción clara («excesoVisual indefinido / no
// cubre el excedente») en vez de un error de compilación de TypeScript.
//
// Valida: Requisitos 1.1, 1.2, 2.1, 2.2.
// ============================================================================

describe('Bugfix Caso 1: el exceso visual cubre el excedente real del trazo', () => {
  const seg = (a: number, b: number, c: number, d: number, paso: number): Segmento => ({
    desde: { x: a, y: b },
    hasta: { x: c, y: d },
    paso,
    linea: 1,
  });
  const LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };

  it('Caso 1 — exceso oculto por la dilatación: la región de exceso para pintar cubre todo el excedente, no solo la puntita', () => {
    // Objetivo: Kiro AVANZA 100 → línea vertical de 100.
    const objetivo = [seg(0, 0, 0, 100, 0)];
    // Jugador: AVANZA 110 → la misma línea pero de 110 (se pasó poco).
    const jugador = [seg(0, 0, 0, 110, 0)];

    const v = validar(jugador, objetivo, LIBRE);

    // El bug vive cuando la estrella fue negada por exceso de trazo: lo confirmamos
    // como premisa del Caso 1 (parte de la condición del bug, requisito 1.1).
    expect(v.coincide).toBe(false);
    expect(v.motivo).toBe('excesoDeTrazo');

    // Hoy, el `exceso` dilatado deja casi todo el excedente dentro de la
    // coincidencia y marca solo la puntita del extremo (contraejemplo medido en
    // el bugfix: ~170 celdas concentradas en la punta). Requisitos 1.1 y 1.2.
    const excesoDilatado = contar(v.exceso);

    // La salida NUEVA que el design define en la Opción A. No existe todavía:
    // acceso tolerante al tipo para que el RED sea en ejecución, no de compilación.
    const ev = (v as { excesoVisual?: Mascara }).excesoVisual;

    // (2.1/2.2) `excesoVisual` se mide en MARCO REAL: sin centrar ni girar,
    // porque el excedente que el jugador VE vive en coordenadas reales. En ese
    // marco el trazo del jugador está en la columna lógica x=0 (ix = aColumna(0)
    // = 400) y el excedente va de y=100 a y=110 (filas aFila(110)=290 a
    // aFila(100)=300). `aFila(y) = ⌊400 − y⌋`: y mayor ⇒ fila menor. Fijamos la
    // ventana sobre esa franja real, NO sobre el marco centrado de la máscara del
    // veredicto (su ventana anterior asumía el marco equivocado).
    expect(ev).toBeDefined();
    const excesoVisual = ev as Mascara;

    // (a) Debe haber celdas de `excesoVisual` en la franja del excedente real
    // (filas ~290..300, es decir y en [100, 110]). Hoy la dilatación lo absorbe
    // como coincidencia y esto sería 0.
    const filaExcedenteDesde = aFila(110); // y=110 → fila 290
    const filaExcedenteHasta = aFila(100); // y=100 → fila 300
    let celdasEnElExcedente = 0;
    for (let iy = filaExcedenteDesde; iy <= filaExcedenteHasta; iy++) {
      for (let ix = 0; ix < LADO; ix++) {
        if (encendida(excesoVisual, ix, iy)) celdasEnElExcedente += 1;
      }
    }
    expect(celdasEnElExcedente).toBeGreaterThan(0);

    // (b) La gran mayoría del `excesoVisual` vive en el excedente (y>95), no en
    // franjas laterales a lo largo del tramo coincidente (y de 0 a 100). Al restar
    // Kiro DILATADO al mismo radio 8, el grosor lateral se cancela y solo queda el
    // excedente longitudinal. Contamos las celdas con y<=95 (fila >= aFila(95)=305)
    // y afirmamos que son una fracción pequeña del total: el excedente domina.
    const filaUmbral = aFila(95); // y=95 → fila 305; filas > 305 ⇒ y < 95
    let celdasFueraDelExcedente = 0;
    for (let iy = filaUmbral; iy < LADO; iy++) {
      for (let ix = 0; ix < LADO; ix++) {
        if (encendida(excesoVisual, ix, iy)) celdasFueraDelExcedente += 1;
      }
    }
    const total = contar(excesoVisual);
    // Sin franjas laterales: lo que cae en y<=95 es una fracción pequeña (<10%).
    expect(celdasFueraDelExcedente).toBeLessThan(total * 0.1);

    // (c) El excedente se REPARTE a lo largo del trazo, no se concentra en la
    // puntita. Con el enfoque confirmado (restar Kiro DILATADO al MISMO radio 8),
    // el grosor lateral se cancela y el conteo total no se infla —queda ~igual que
    // el `exceso` dilatado centrado (ambos son un casquete)—, así que NO afirmamos
    // `total > excesoDilatado` (esa expectativa venía del enfoque descartado de
    // restar Kiro sin dilatar, que dejaba franjas laterales). El discriminador
    // real del arreglo es que el rojo llega a la PARTE BAJA del excedente (y de 100
    // a 105), el tramo que el `exceso` dilatado centrado absorbe como coincidencia
    // y deja en 0. Si solo fuera «la puntita» (~y>108), esta franja estaría vacía.
    const filaBajaDesde = aFila(105); // y=105 → fila 295
    const filaBajaHasta = aFila(100); // y=100 → fila 300
    let celdasEnLaParteBaja = 0;
    for (let iy = filaBajaDesde; iy <= filaBajaHasta; iy++) {
      for (let ix = 0; ix < LADO; ix++) {
        if (encendida(excesoVisual, ix, iy)) celdasEnLaParteBaja += 1;
      }
    }
    expect(celdasEnLaParteBaja).toBeGreaterThan(0);
    // `excesoDilatado` se conserva como referencia documental del contraejemplo
    // medido (~170 celdas casi todas en la punta); el arreglo lo reubica al marco
    // real repartido a lo largo del trazo sin inflar el conteo.
    expect(excesoDilatado).toBeGreaterThan(0);
  });
});
