// Pruebas del cálculo del área a rellenar (reseña del PR #24, punto 7b; R4.6, R4.7).
//
// El área se calcula sobre una máscara hecha desde los trazos (no leyendo píxeles
// del canvas): inundación 4-conexa desde la tortuga, y si llega al borde del
// lienzo no hay área cerrada.

import { describe, it, expect } from 'vitest';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { ESTADO_INICIAL, type Punto } from './tortuga.js';
import { extraerSegmentos, type Segmento } from './segmentos.js';
import { calcularRelleno, type Corrida } from './relleno.js';

/** Segmentos y posición final de la tortuga de un texto del mundo 2. */
function dibujo(texto: string): { segmentos: readonly Segmento[]; tortuga: Punto } {
  const { programa, errores } = analizar(analizarLexico(texto).tokens, { mundo: 2 });
  expect(errores).toEqual([]);
  const g = ejecutar(programa!, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(2), semilla: 0 });
  let p = g.next();
  while (!p.done) p = g.next();
  const ops = p.value.operaciones;
  const ultima = ops[ops.length - 1];
  return { segmentos: extraerSegmentos(ops), tortuga: ultima ? ultima.estadoDespues.posicion : { x: 0, y: 0 } };
}

const area = (corridas: readonly Corrida[]) => corridas.reduce((s, c) => s + (c.x1 - c.x0), 0);

/** Caja de las corridas: [xmin, xmax] × [ymin, ymax] en unidades lógicas. */
function caja(corridas: readonly Corrida[]) {
  return {
    xmin: Math.min(...corridas.map((c) => c.x0)),
    xmax: Math.max(...corridas.map((c) => c.x1)),
    ymin: Math.min(...corridas.map((c) => c.y)),
    ymax: Math.max(...corridas.map((c) => c.y + 1)),
  };
}

const CUADRADO = 'REPITE 4 [AV 100 GD 90]';

describe('relleno · área cerrada', () => {
  it('un punto dentro de un cuadrado cerrado rellena el cuadrado y nada más', () => {
    const { segmentos } = dibujo(CUADRADO);
    const corridas = calcularRelleno(segmentos, { x: 50, y: 50 });
    expect(corridas).not.toBeNull();
    // El interior de 100 × 100 más, como mucho, las celdas de la propia línea.
    expect(area(corridas!)).toBeGreaterThanOrEqual(99 * 99);
    expect(area(corridas!)).toBeLessThanOrEqual(102 * 102);
    const c = caja(corridas!);
    expect(c.xmin).toBeGreaterThanOrEqual(-1);
    expect(c.xmax).toBeLessThanOrEqual(102);
    expect(c.ymin).toBeGreaterThanOrEqual(-2);
    expect(c.ymax).toBeLessThanOrEqual(101);
  });

  it('con la tortuga sobre la esquina del cuadrado (justo al terminar de dibujarlo) rellena el interior', () => {
    const { segmentos, tortuga } = dibujo(CUADRADO);
    // Vuelve al punto de partida (salvo redondeo de coma flotante), sobre la línea.
    expect(tortuga.x).toBeCloseTo(0, 9);
    expect(tortuga.y).toBeCloseTo(0, 9);
    const corridas = calcularRelleno(segmentos, tortuga);
    expect(corridas).not.toBeNull();
    expect(area(corridas!)).toBeGreaterThanOrEqual(99 * 99);
    expect(area(corridas!)).toBeLessThanOrEqual(102 * 102);
  });

  it('un triángulo de lados inclinados no deja escapar el relleno por sus diagonales', () => {
    const { segmentos, tortuga } = dibujo('REPITE 3 [AV 100 GD 120]');
    const corridas = calcularRelleno(segmentos, tortuga);
    expect(corridas).not.toBeNull();
    // Área del triángulo equilátero de lado 100 ≈ 4330.
    expect(area(corridas!)).toBeGreaterThan(4000);
    expect(area(corridas!)).toBeLessThan(4700);
    const c = caja(corridas!);
    expect(c.xmin).toBeGreaterThanOrEqual(-1);
    expect(c.xmax).toBeLessThanOrEqual(89);
  });

  it('de dos cuadrados separados, solo rellena el que contiene a la tortuga', () => {
    const { segmentos } = dibujo(`${CUADRADO} SL GD 90 AV 200 GI 90 BL ${CUADRADO}`);
    const corridas = calcularRelleno(segmentos, { x: 250, y: 50 });
    expect(corridas).not.toBeNull();
    expect(caja(corridas!).xmin).toBeGreaterThanOrEqual(199);
    expect(area(corridas!)).toBeLessThanOrEqual(102 * 102);
  });
});

describe('relleno · sin área cerrada no hay relleno (R4.7)', () => {
  it('un punto fuera del cuadrado llega al borde: no hay relleno', () => {
    const { segmentos } = dibujo(CUADRADO);
    expect(calcularRelleno(segmentos, { x: -50, y: -50 })).toBeNull();
  });

  it('una figura abierta (tres lados) no encierra nada', () => {
    const { segmentos } = dibujo('REPITE 3 [AV 100 GD 90]');
    expect(calcularRelleno(segmentos, { x: 50, y: 50 })).toBeNull();
  });

  it('sin trazos no hay relleno', () => {
    expect(calcularRelleno([], { x: 0, y: 0 })).toBeNull();
  });

  it('con la tortuga sobre una línea que no encierra nada, no hay relleno', () => {
    const { segmentos, tortuga } = dibujo('AV 100');
    expect(calcularRelleno(segmentos, tortuga)).toBeNull();
  });

  it('una tortuga fuera del lienzo no rellena nada', () => {
    const { segmentos } = dibujo(CUADRADO);
    expect(calcularRelleno(segmentos, { x: 900, y: 0 })).toBeNull();
  });
});

describe('relleno · búferes reutilizados entre llamadas', () => {
  // calcularRelleno comparte búferes de trabajo entre llamadas (reservarlos por
  // llamada costaba ≈ 5,7 MB cada vez). Estas pruebas fijan que compartirlos no
  // filtra estado de una llamada a la siguiente.
  it('dos cuadrados en distintas posiciones dan cada uno su propio relleno', () => {
    const izq = dibujo(CUADRADO);
    const der = dibujo(`SL GD 90 AV 200 GI 90 BL ${CUADRADO}`);
    const a = calcularRelleno(izq.segmentos, { x: 50, y: 50 });
    const b = calcularRelleno(der.segmentos, { x: 250, y: 50 });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // El segundo no arrastra celdas del primero: su caja está a la derecha.
    expect(caja(b!).xmin).toBeGreaterThanOrEqual(199);
    // Y repetir el primero da el mismo resultado que la primera vez (sin arrastre).
    const a2 = calcularRelleno(izq.segmentos, { x: 50, y: 50 });
    expect(area(a2!)).toBe(area(a!));
  });

  it('una llamada que no encierra nada no contamina la siguiente que sí', () => {
    const { segmentos } = dibujo(CUADRADO);
    expect(calcularRelleno(segmentos, { x: -50, y: -50 })).toBeNull();
    const dentro = calcularRelleno(segmentos, { x: 50, y: 50 });
    expect(dentro).not.toBeNull();
    expect(area(dentro!)).toBeGreaterThanOrEqual(99 * 99);
  });
});
