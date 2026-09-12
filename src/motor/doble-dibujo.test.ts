// Doble de dibujo compartido para las pruebas del motor de dibujo.
//
// Implementa `ContextoDibujo` en Node, sin jsdom ni Canvas real. Hace dos cosas:
//   1. Registra la secuencia de llamadas con sus argumentos.
//   2. Aplana cada trazo (`stroke`) y cada relleno (`fill`) a polilíneas que
//      rasteriza en un `Uint8Array` de 800 × 800, para medir en Node el IoU de
//      una silueta bajo rotación, su inscripción en un círculo y la igualdad de
//      dos dibujos.
//
// Sobre «píxel por píxel» de los requisitos 13.9 y 23.9: lo que se compara es la
// secuencia registrada de llamadas y su rasterizado. Dos secuencias idénticas
// producen el mismo resultado en cualquier Canvas 2D determinista, así que la
// igualdad de la secuencia es una condición MÁS FUERTE que la igualdad de píxeles.
// La verificación con un Canvas real del navegador sigue siendo MANUAL.
//
// Este archivo es un archivo de prueba (`.test.ts`), no un módulo de `src/`, y por
// eso lleva su propia prueba de auto-comprobación al final.

import { describe, it, expect } from 'vitest';
import type { ContextoDibujo } from './lienzo.js';

// ============================================================================
// Registro de llamadas
// ============================================================================

export interface Llamada {
  readonly metodo: string;
  readonly args: readonly unknown[];
}

/** Punto en el espacio de rasterizado (coordenadas ya transformadas). */
interface P {
  x: number;
  y: number;
}

/** Un subtrazado en construcción: lista de puntos y si está cerrado. */
interface Subtrazado {
  puntos: P[];
  cerrado: boolean;
}

/** Matriz de transformación afín 2D: [a, b, c, d, e, f]. */
type Matriz = [number, number, number, number, number, number];

const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0];

/** Multiplica dos matrices afines (m aplicada después de n): resultado = m · n. */
function multiplicar(m: Matriz, n: Matriz): Matriz {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** Aplica una matriz afín a un punto. */
function transformar(m: Matriz, x: number, y: number): P {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

// ============================================================================
// El doble de dibujo
// ============================================================================

/** Lado del arreglo de rasterizado, en píxeles lógicos. */
export const LADO_RASTER = 800;

/** Muestreo de las curvas de Bézier y cuadráticas, en pasos. */
const PASOS_CURVA = 24;

/** Muestreo de arcos y elipses, en pasos por vuelta completa. */
const PASOS_ARCO = 64;

export class DobleDibujo implements ContextoDibujo {
  // --- Propiedades que exige ContextoDibujo (registradas, no usadas al pintar) ---
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  lineJoin: CanvasLineJoin = 'miter';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000';
  fillStyle: string | CanvasGradient | CanvasPattern = '#000';

  /** Secuencia de todas las llamadas con sus argumentos, en orden. */
  readonly llamadas: Llamada[] = [];

  /** Rasterizado acumulado de todos los trazos y rellenos. */
  private raster = new Uint8Array(LADO_RASTER * LADO_RASTER);

  // --- Estado gráfico (pila de matrices y trayecto) ---
  private matriz: Matriz = [...IDENTIDAD];
  private pila: Matriz[] = [];
  private subtrazados: Subtrazado[] = [];
  private actual: Subtrazado | null = null;

  private registrar(metodo: string, ...args: unknown[]): void {
    this.llamadas.push({ metodo, args });
  }

  private puntoActual(): P {
    // Punto de referencia para curvas relativas: el último punto del subtrazado.
    if (this.actual && this.actual.puntos.length > 0) {
      return this.actual.puntos[this.actual.puntos.length - 1]!;
    }
    return { x: 0, y: 0 };
  }

  // --- Transformaciones ---
  save(): void {
    this.registrar('save');
    this.pila.push([...this.matriz]);
  }

  restore(): void {
    this.registrar('restore');
    const previa = this.pila.pop();
    if (previa) this.matriz = previa;
  }

  setTransform(
    a?: number | DOMMatrix2DInit,
    b?: number,
    c?: number,
    d?: number,
    e?: number,
    f?: number,
  ): void {
    // El lienzo siempre invoca la forma de seis números; la sobrecarga con
    // DOMMatrix2DInit se declara solo para satisfacer el tipo del DOM.
    if (typeof a === 'number') {
      this.registrar('setTransform', a, b, c, d, e, f);
      this.matriz = [a, b ?? 0, c ?? 0, d ?? 0, e ?? 0, f ?? 0];
    } else {
      this.registrar('setTransform', a);
      this.matriz = [...IDENTIDAD];
    }
  }

  translate(x: number, y: number): void {
    this.registrar('translate', x, y);
    this.matriz = multiplicar(this.matriz, [1, 0, 0, 1, x, y]);
  }

  rotate(angulo: number): void {
    this.registrar('rotate', angulo);
    const cos = Math.cos(angulo);
    const sen = Math.sin(angulo);
    this.matriz = multiplicar(this.matriz, [cos, sen, -sen, cos, 0, 0]);
  }

  scale(x: number, y: number): void {
    this.registrar('scale', x, y);
    this.matriz = multiplicar(this.matriz, [x, 0, 0, y, 0, 0]);
  }

  // --- Trayecto ---
  beginPath(): void {
    this.registrar('beginPath');
    this.subtrazados = [];
    this.actual = null;
  }

  closePath(): void {
    this.registrar('closePath');
    if (this.actual) this.actual.cerrado = true;
  }

  moveTo(x: number, y: number): void {
    this.registrar('moveTo', x, y);
    this.actual = { puntos: [transformar(this.matriz, x, y)], cerrado: false };
    this.subtrazados.push(this.actual);
  }

  lineTo(x: number, y: number): void {
    this.registrar('lineTo', x, y);
    if (!this.actual) this.moveTo(x, y);
    else this.actual.puntos.push(transformar(this.matriz, x, y));
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void {
    this.registrar('quadraticCurveTo', cpx, cpy, x, y);
    const p0 = this.puntoActual();
    const c = transformar(this.matriz, cpx, cpy);
    const p1 = transformar(this.matriz, x, y);
    if (!this.actual) this.moveTo(cpx, cpy);
    for (let i = 1; i <= PASOS_CURVA; i++) {
      const t = i / PASOS_CURVA;
      const u = 1 - t;
      const px = u * u * p0.x + 2 * u * t * c.x + t * t * p1.x;
      const py = u * u * p0.y + 2 * u * t * c.y + t * t * p1.y;
      this.actual!.puntos.push({ x: px, y: py });
    }
  }

  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ): void {
    this.registrar('bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y);
    const p0 = this.puntoActual();
    const c1 = transformar(this.matriz, cp1x, cp1y);
    const c2 = transformar(this.matriz, cp2x, cp2y);
    const p1 = transformar(this.matriz, x, y);
    if (!this.actual) this.moveTo(cp1x, cp1y);
    for (let i = 1; i <= PASOS_CURVA; i++) {
      const t = i / PASOS_CURVA;
      const u = 1 - t;
      const px = u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x;
      const py = u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y;
      this.actual!.puntos.push({ x: px, y: py });
    }
  }

  arc(
    x: number,
    y: number,
    radio: number,
    inicio: number,
    fin: number,
    antihorario = false,
  ): void {
    this.registrar('arc', x, y, radio, inicio, fin, antihorario);
    this.muestrearArco(x, y, radio, radio, 0, inicio, fin, antihorario);
  }

  ellipse(
    x: number,
    y: number,
    radioX: number,
    radioY: number,
    rotacion: number,
    inicio: number,
    fin: number,
    antihorario = false,
  ): void {
    this.registrar('ellipse', x, y, radioX, radioY, rotacion, inicio, fin, antihorario);
    this.muestrearArco(x, y, radioX, radioY, rotacion, inicio, fin, antihorario);
  }

  private muestrearArco(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rotacion: number,
    inicio: number,
    fin: number,
    antihorario: boolean,
  ): void {
    // Normalizar el barrido angular.
    let barrido = fin - inicio;
    if (antihorario) {
      if (barrido > 0) barrido -= 2 * Math.PI;
    } else if (barrido < 0) {
      barrido += 2 * Math.PI;
    }
    const pasos = Math.max(2, Math.ceil((Math.abs(barrido) / (2 * Math.PI)) * PASOS_ARCO));
    const cosR = Math.cos(rotacion);
    const senR = Math.sin(rotacion);
    for (let i = 0; i <= pasos; i++) {
      const a = inicio + (barrido * i) / pasos;
      const ex = rx * Math.cos(a);
      const ey = ry * Math.sin(a);
      // Aplicar la rotación de la elipse y trasladar al centro, en el marco local.
      const lx = cx + ex * cosR - ey * senR;
      const ly = cy + ex * senR + ey * cosR;
      const p = transformar(this.matriz, lx, ly);
      if (i === 0 && !this.actual) {
        this.actual = { puntos: [p], cerrado: false };
        this.subtrazados.push(this.actual);
      } else if (i === 0) {
        this.actual!.puntos.push(p);
      } else {
        this.actual!.puntos.push(p);
      }
    }
  }

  rect(x: number, y: number, ancho: number, alto: number): void {
    this.registrar('rect', x, y, ancho, alto);
    this.moveTo(x, y);
    this.lineTo(x + ancho, y);
    this.lineTo(x + ancho, y + alto);
    this.lineTo(x, y + alto);
    this.closePath();
  }

  clip(): void {
    this.registrar('clip');
    // El recorte no altera el rasterizado del doble; solo se registra.
  }

  // --- Pintado: rasteriza los subtrazados actuales ---
  fill(): void {
    this.registrar('fill');
    // Relleno aproximado: rasterizamos el contorno cerrado como polilínea, que
    // basta para el IoU y el radio máximo (los puntos del borde son los extremos).
    for (const sub of this.subtrazados) {
      this.dibujados.push(sub.puntos.map((p) => ({ ...p })));
      this.rasterizarPolilinea(sub.puntos, true);
    }
  }

  stroke(): void {
    this.registrar('stroke');
    for (const sub of this.subtrazados) {
      this.dibujados.push(sub.puntos.map((p) => ({ ...p })));
      this.rasterizarPolilinea(sub.puntos, sub.cerrado);
    }
  }

  clearRect(x: number, y: number, ancho: number, alto: number): void {
    this.registrar('clearRect', x, y, ancho, alto);
    // Borra el rasterizado por completo (se usa para limpiar una capa).
    this.raster = new Uint8Array(LADO_RASTER * LADO_RASTER);
    this.dibujados = [];
  }

  setLineDash(segmentos: number[]): void {
    this.registrar('setLineDash', segmentos);
  }

  // --- Rasterizado ---
  private encender(ix: number, iy: number): void {
    if (ix < 0 || ix >= LADO_RASTER || iy < 0 || iy >= LADO_RASTER) return;
    this.raster[iy * LADO_RASTER + ix] = 1;
  }

  /**
   * Mapea un punto ya transformado a índices del arreglo de rasterizado. El punto
   * está en «espacio de dibujo»: para el rasterizado tratamos su origen en el
   * centro del arreglo (400, 400) con `y` hacia arriba, que es el convenio del
   * marco lógico del proyecto. Un `setTransform` con la `y` negativa del lienzo ya
   * habrá invertido el eje antes de llegar aquí, así que la conversión es lineal.
   */
  private aIndice(p: P): { ix: number; iy: number } {
    return { ix: Math.floor(p.x + 400), iy: Math.floor(400 - p.y) };
  }

  private trazarLinea(a: P, b: P): void {
    const ia = this.aIndice(a);
    const ib = this.aIndice(b);
    const dx = ib.ix - ia.ix;
    const dy = ib.iy - ia.iy;
    const pasos = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let i = 0; i <= pasos; i++) {
      const t = i / pasos;
      this.encender(Math.round(ia.ix + dx * t), Math.round(ia.iy + dy * t));
    }
  }

  private rasterizarPolilinea(puntos: readonly P[], cerrar: boolean): void {
    if (puntos.length === 0) return;
    if (puntos.length === 1) {
      const i = this.aIndice(puntos[0]!);
      this.encender(i.ix, i.iy);
      return;
    }
    for (let i = 1; i < puntos.length; i++) {
      this.trazarLinea(puntos[i - 1]!, puntos[i]!);
    }
    if (cerrar) this.trazarLinea(puntos[puntos.length - 1]!, puntos[0]!);
  }

  // --- Consultas para las pruebas ---
  /** Copia del rasterizado acumulado. */
  mascara(): Uint8Array {
    return this.raster.slice();
  }

  /** Número de píxeles encendidos. */
  encendidos(): number {
    let n = 0;
    for (let i = 0; i < this.raster.length; i++) n += this.raster[i]!;
    return n;
  }

  /** Todos los subtrazados enviados a fill o stroke, en coordenadas transformadas. */
  private dibujados: P[][] = [];

  /**
   * Radio máximo de todo punto trazado o rellenado, medido desde el origen (0,0).
   * Los puntos están en el marco transformado, que en las pruebas de personajes es
   * el marco lógico (sin la transformación del lienzo). Para cumplir el círculo de
   * 40 unidades, súmese aparte la mitad del grosor de trazo.
   */
  radioMaximoDesdeOrigen(): number {
    let maximo = 0;
    for (const sub of this.dibujados) {
      for (const p of sub) {
        const r = Math.hypot(p.x, p.y);
        if (r > maximo) maximo = r;
      }
    }
    return maximo;
  }
}

// ============================================================================
// Utilidades de comparación de máscaras
// ============================================================================

/** IoU (intersección sobre unión) de dos máscaras del mismo tamaño. */
export function iou(a: Uint8Array, b: Uint8Array): number {
  let interseccion = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai === 1 && bi === 1) interseccion++;
    if (ai === 1 || bi === 1) union++;
  }
  return union === 0 ? 0 : interseccion / union;
}

/** ¿Son idénticas dos máscaras píxel por píxel? */
export function mascarasIguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ============================================================================
// Auto-comprobación del doble de dibujo
// ============================================================================

describe('doble de dibujo', () => {
  it('registra la secuencia de llamadas con sus argumentos', () => {
    const ctx = new DobleDibujo();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(100, 0);
    ctx.stroke();
    const metodos = ctx.llamadas.map((l) => l.metodo);
    expect(metodos).toEqual(['beginPath', 'moveTo', 'lineTo', 'stroke']);
    expect(ctx.llamadas[1]!.args).toEqual([0, 0]);
    expect(ctx.llamadas[2]!.args).toEqual([100, 0]);
  });

  it('rasteriza un trazo a píxeles y cuenta encendidos', () => {
    const ctx = new DobleDibujo();
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.lineTo(50, 0);
    ctx.stroke();
    expect(ctx.encendidos()).toBeGreaterThan(0);
    // El origen lógico (0,0) → índice (400, 400).
    const m = ctx.mascara();
    expect(m[400 * LADO_RASTER + 400]).toBe(1);
  });

  it('registra setTransform con sus seis argumentos', () => {
    const ctx = new DobleDibujo();
    ctx.setTransform(2, 0, 0, -2, 400, 400);
    const llamada = ctx.llamadas.find((l) => l.metodo === 'setTransform');
    expect(llamada).toBeDefined();
    expect(llamada!.args).toEqual([2, 0, 0, -2, 400, 400]);
  });

  it('el IoU de una máscara contra sí misma es 1', () => {
    const ctx = new DobleDibujo();
    ctx.beginPath();
    ctx.moveTo(-30, -30);
    ctx.lineTo(30, 30);
    ctx.stroke();
    const m = ctx.mascara();
    expect(iou(m, m)).toBe(1);
    expect(mascarasIguales(m, m)).toBe(true);
  });

  it('clearRect vacía el rasterizado', () => {
    const ctx = new DobleDibujo();
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
    expect(ctx.encendidos()).toBeGreaterThan(0);
    ctx.clearRect(0, 0, 800, 800);
    expect(ctx.encendidos()).toBe(0);
  });

  it('muestrea arcos y curvas sin lanzar', () => {
    const ctx = new DobleDibujo();
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.quadraticCurveTo(10, 10, 20, 0);
    ctx.bezierCurveTo(1, 1, 2, 2, 3, 3);
    ctx.ellipse(0, 0, 5, 3, 0, 0, Math.PI * 2);
    expect(() => ctx.fill()).not.toThrow();
    expect(ctx.encendidos()).toBeGreaterThan(0);
  });
});
