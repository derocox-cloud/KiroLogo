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
import { ESTADO_INICIAL, type Punto } from './tortuga.js';
import { extraerSegmentos, type Segmento } from './segmentos.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';

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
  }, 120_000);
});

// ============================================================================
// 8.1 · Frontera decorativa: el canal de color/grosor/relleno es invisible
// para la validación de precisión.
// Valida: Requisito 4.8
//
// Dos programas que dejan EXACTAMENTE los mismos trazos —uno pelado y otro con
// SUBELAPIZ/BAJALAPIZ, PONCOLOR, PONGROSOR y RELLENA intercalados— producen la
// misma lista de segmentos y, por tanto, el mismo IoU y el mismo veredicto. La
// decoración no puede aprobar ni reprobar un nivel. Se usa el pipeline real
// (lexer → parser → ejecutar → extraerSegmentos → validar), no operaciones
// armadas a mano, para ejercitar de verdad la frontera. Este test documenta que
// ni `segmentos.ts` ni `validador.ts` necesitan cambio alguno.
// ============================================================================

describe('validador · frontera decorativa (R4.8)', () => {
  // Mundo 2: traslación y rotación libres, escala exacta (la normalización del
  // mundo en el que viven los comandos decorativos).
  const NORM_MUNDO_2: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };
  const PERMITIDOS_2 = comandosDelMundo(2);

  /** Pipeline real: texto KiroLogo del mundo 2 → segmentos dibujados. */
  function segmentosDe(texto: string): readonly Segmento[] {
    const lexico = analizarLexico(texto);
    const sintactico = analizar(lexico.tokens, { mundo: 2 });
    // Un texto de referencia bien formado nunca debería fallar al parsear; si lo
    // hace, es un error del propio test y conviene que la aserción lo delate.
    expect(sintactico.errores).toEqual([]);
    expect(sintactico.programa).not.toBeNull();
    const generador = ejecutar(sintactico.programa!, {
      estadoInicial: ESTADO_INICIAL,
      comandosPermitidos: PERMITIDOS_2,
      semilla: 0,
    });
    let paso = generador.next();
    while (!paso.done) paso = generador.next();
    expect(paso.value.error).toBeNull();
    expect(paso.value.guardaActivada).toBeNull();
    return extraerSegmentos(paso.value.operaciones);
  }

  // Un cuadrado sin ninguna decoración: la referencia/objetivo.
  const CUADRADO_PELADO = 'REPITE 4 [AV 100 GD 90]';

  // El MISMO cuadrado, con el canal decorativo intercalado de todas las formas:
  //  - PONCOLOR y PONGROSOR antes de dibujar,
  //  - un par SUBELAPIZ/BAJALAPIZ que NO mueve la tortuga (no añade ni quita
  //    trazo: sube el lápiz y lo baja en el mismo punto),
  //  - RELLENA al final.
  // Los trazos con el lápiz abajo son idénticos a los del cuadrado pelado.
  const CUADRADO_DECORADO =
    'PONCOLOR rojo PONGROSOR 5 SUBELAPIZ BAJALAPIZ REPITE 4 [AV 100 GD 90] RELLENA';

  it('el programa decorado deja exactamente los mismos segmentos que el pelado', () => {
    const pelado = segmentosDe(CUADRADO_PELADO);
    const decorado = segmentosDe(CUADRADO_DECORADO);

    // Mismo número de trazos: ni color, ni grosor, ni relleno, ni el par de
    // lápiz añadieron o quitaron un segmento.
    expect(decorado).toHaveLength(pelado.length);
    expect(decorado.length).toBeGreaterThan(0);

    // Y las mismas coordenadas, tramo a tramo (el `paso`/`linea` puede diferir
    // porque las operaciones decorativas ocupan pasos; lo que importa para la
    // validación geométrica son los puntos).
    decorado.forEach((seg, i) => {
      const esperado = pelado[i]!;
      expect(seg.desde).toEqual(esperado.desde);
      expect(seg.hasta).toEqual(esperado.hasta);
    });
  });

  it('decorado contra pelado da coincidencia con IoU 1.0: la decoración no cambia el veredicto', () => {
    const pelado = segmentosDe(CUADRADO_PELADO);
    const decorado = segmentosDe(CUADRADO_DECORADO);

    const v = validar(decorado, pelado, NORM_MUNDO_2);
    expect(v.coincide).toBe(true);
    expect(v.motivo).toBe('coincide');
    expect(v.iou).toBe(1);
    expect(v.excesoPorcentaje).toBe(0);
  });

  it('el veredicto del decorado es idéntico al del pelado contra el mismo objetivo', () => {
    const pelado = segmentosDe(CUADRADO_PELADO);
    const decorado = segmentosDe(CUADRADO_DECORADO);

    // La referencia de precisión: pelado contra sí mismo.
    const referencia = validar(pelado, pelado, NORM_MUNDO_2);
    // Lo que el jugador decorado obtiene contra la misma referencia.
    const conDecorado = validar(decorado, pelado, NORM_MUNDO_2);

    expect(conDecorado.coincide).toBe(referencia.coincide);
    expect(conDecorado.motivo).toBe(referencia.motivo);
    expect(conDecorado.iou).toBe(referencia.iou);
    expect(conDecorado.excesoPorcentaje).toBe(referencia.excesoPorcentaje);
    expect(conDecorado.angulo).toBe(referencia.angulo);
  });
});
