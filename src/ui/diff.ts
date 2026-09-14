// Diff visual de KiroLogo: dibuja las tres regiones que devuelve el validador
// —coincidencia, exceso y falta— sobre la vista de superposición, aplicando la
// misma traslación y el mismo ángulo del veredicto para que queden alineadas con
// las estelas que el jugador vio dibujar.
//
// No rasteriza, no invoca al validador y no ejecuta el intérprete: recibe las
// tres máscaras ya calculadas. Color y grosor salen del tema (sin literales); los
// tres estados se distinguen por patrón de guiones y por grosor además del color.

import type { ContextoDibujo } from '../motor/lienzo.js';
import type { Mascara } from '../motor/validador.js';
import { LADO } from '../motor/validador.js';
import type { Punto } from '../motor/tortuga.js';

// ============================================================================
// Tema del diff: la única fuente de color, grosor y patrón de guiones
// ============================================================================

export interface TrazoDiff {
  readonly color: string;
  readonly grosor: number;
  /** Patrón de guiones en unidades lógicas; vacío para línea continua. */
  readonly guiones: readonly number[];
}

export interface EstiloDiff {
  readonly coincidencia: TrazoDiff;
  readonly exceso: TrazoDiff;
  readonly falta: TrazoDiff;
}

export type LectorTemaDiff = () => EstiloDiff;

// ============================================================================
// Entrada: las tres regiones y la transformación del veredicto
// ============================================================================

export interface RegionesDiff {
  readonly coincidencia: Mascara;
  readonly exceso: Mascara;
  readonly falta: Mascara;
  /** Traslación aplicada por el validador, en posiciones enteras. */
  readonly traslacion: Punto;
  /** Ángulo del validador, 0 a 359 grados. */
  readonly angulo: number;
}

// ============================================================================
// Dependencias
// ============================================================================

export interface DependenciasDiff {
  /** Contexto de dibujo de la capa de superposición (o doble en pruebas). */
  readonly ctx: ContextoDibujo;
  /** Lee el estilo del diff del tema; se invoca en cada dibujado. */
  readonly leerTema: LectorTemaDiff;
}

// ============================================================================
// Estado del diff que se dibuja: nombra por lo que significa, nunca por color
// ============================================================================

export type EstadoDiff = 'coincidencia' | 'exceso' | 'falta';

/** Nombre en español de un estado, por lo que significa. */
export const NOMBRE_ESTADO: Readonly<Record<EstadoDiff, string>> = {
  coincidencia: 'lo que coincide',
  exceso: 'lo que sobra',
  falta: 'lo que falta',
};

// ============================================================================
// Interfaz pública
// ============================================================================

export interface Diff {
  /**
   * Dibuja las tres regiones con la traslación y el ángulo dados. Si la máscara
   * del jugador no encendió nada (coincidencia y exceso vacías), dibuja solo la
   * falta. No modifica las máscaras recibidas.
   */
  dibujar(regiones: RegionesDiff): void;
}

// ============================================================================
// Rasterizado inverso de una máscara a segmentos de dibujo
// ============================================================================

/**
 * Recorre una máscara y, por cada corrida horizontal de posiciones encendidas,
 * emite un segmento (moveTo/lineTo) en coordenadas lógicas, aplicando la
 * traslación y el ángulo inverso del validador para volver del marco del arreglo
 * al marco lógico del lienzo. Una corrida por trazo, para que el patrón de
 * guiones se lea sobre cada tramo.
 *
 * El arreglo tiene el origen lógico en (399.5, 399.5): `x = ix − 399.5`,
 * `y = 399.5 − iy`. El validador giró la máscara objetivo θ grados; para alinear
 * el dibujo con lo que el jugador vio, se gira cada punto −θ y se resta la
 * traslación aplicada.
 */
function trazarMascara(
  ctx: ContextoDibujo,
  mascara: Mascara,
  traslacion: Punto,
  angulo: number,
): boolean {
  const rad = (-angulo * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  let dibujoAlgo = false;

  const centro = (LADO - 1) / 2; // 399.5

  for (let iy = 0; iy < LADO; iy++) {
    const base = iy * LADO;
    let ix = 0;
    while (ix < LADO) {
      if (mascara[base + ix] !== 1) {
        ix += 1;
        continue;
      }
      // Extiende la corrida horizontal de celdas encendidas.
      const inicio = ix;
      while (ix < LADO && mascara[base + ix] === 1) ix += 1;
      const fin = ix - 1;

      // Convierte los dos extremos a coordenadas lógicas y aplica giro y traslación.
      const p1 = aLogico(inicio, iy, centro, cos, sen, traslacion);
      const p2 = aLogico(fin, iy, centro, cos, sen, traslacion);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      dibujoAlgo = true;
    }
  }
  return dibujoAlgo;
}

/** Convierte una posición del arreglo a coordenada lógica, girada −θ y trasladada. */
function aLogico(
  ix: number,
  iy: number,
  centro: number,
  cos: number,
  sen: number,
  traslacion: Punto,
): Punto {
  // Marco del arreglo → lógico: y hacia arriba.
  const lx = ix - centro;
  const ly = centro - iy;
  // Gira −θ alrededor del centro (ya en el origen).
  const rx = lx * cos - ly * sen;
  const ry = lx * sen + ly * cos;
  // Deshace la traslación que el validador aplicó al centrar.
  return { x: rx - traslacion.x, y: ry - traslacion.y };
}

/** ¿Tiene la máscara alguna posición encendida? */
function tieneAlgo(mascara: Mascara): boolean {
  for (let i = 0; i < mascara.length; i++) {
    if (mascara[i] === 1) return true;
  }
  return false;
}

// ============================================================================
// Creación
// ============================================================================

export function crearDiff(deps: DependenciasDiff): Diff {
  const ctx = deps.ctx;

  /** Aplica un trazo del tema al contexto: color, grosor y patrón de guiones. */
  function aplicarTrazo(trazo: TrazoDiff): void {
    ctx.strokeStyle = trazo.color;
    ctx.lineWidth = trazo.grosor;
    ctx.setLineDash(trazo.guiones.length > 0 ? [...trazo.guiones] : []);
  }

  function dibujarRegion(mascara: Mascara, trazo: TrazoDiff, regiones: RegionesDiff): void {
    aplicarTrazo(trazo);
    ctx.beginPath();
    trazarMascara(ctx, mascara, regiones.traslacion, regiones.angulo);
    ctx.stroke();
  }

  return {
    dibujar(regiones: RegionesDiff): void {
      const estilo = deps.leerTema();

      const hayJugador = tieneAlgo(regiones.coincidencia) || tieneAlgo(regiones.exceso);

      if (!hayJugador) {
        // El jugador no ejecutó nada (o no encendió nada): solo la falta.
        dibujarRegion(regiones.falta, estilo.falta, regiones);
        return;
      }

      // Coincidencia continua, exceso más grueso, falta punteada.
      dibujarRegion(regiones.coincidencia, estilo.coincidencia, regiones);
      dibujarRegion(regiones.exceso, estilo.exceso, regiones);
      dibujarRegion(regiones.falta, estilo.falta, regiones);
    },
  };
}
