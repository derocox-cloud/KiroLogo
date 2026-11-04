// Tramos para dibujar: los segmentos de la estela del jugador con el color y el
// grosor que pidió con PONCOLOR y PONGROSOR (mundo 2, R4.1, R4.4).
//
// Es un extractor APARTE de `extraerSegmentos`, a propósito: el validador sigue
// recibiendo solo `Segmento` (geometría), así que el color y el grosor no pueden
// influir en la precisión (R4.8) por construcción. Este módulo solo alimenta al
// lienzo y al animador.
//
// Un tramo sin estilo pedido es idéntico, campo a campo, a un `Segmento`: `color`
// y `grosor` solo aparecen cuando el jugador los pidió. Así, un programa sin
// decoración se dibuja exactamente como siempre, con el color y el grosor del tema.

import type { Operacion } from '../lenguaje/interprete.js';
import type { Color } from '../lenguaje/colores.js';
import type { Punto } from './tortuga.js';
import type { Segmento } from './segmentos.js';
import type { TrazoTema } from './lienzo.js';

// ============================================================================
// Tipos públicos
// ============================================================================

/** Color y grosor que el jugador pidió; un campo ausente significa «el del tema». */
export interface EstiloPedido {
  readonly color?: Color;
  readonly grosor?: number;
}

/** Un segmento de la estela con el estilo vigente cuando se dibujó. */
export interface TramoDibujo extends Segmento, EstiloPedido {}

/** Estilo de partida: nada pedido, todo del tema. */
export const SIN_ESTILO: EstiloPedido = {};

/** Longitud mínima para que un `mover` cuente como trazo (el mismo criterio que `extraerSegmentos`). */
const LONGITUD_MINIMA = 0.0001;

// ============================================================================
// Estilo vigente
// ============================================================================

/**
 * Estilo vigente después de una operación. Solo PONCOLOR (`color`) y PONGROSOR
 * (`grosor`) lo cambian. RELLENA lleva su propio color y no toca el del lápiz, y
 * BORRAPANTALLA descarta la estela pero no el estilo, igual que en el intérprete.
 */
export function avanzarEstilo(estilo: EstiloPedido, operacion: Operacion): EstiloPedido {
  if (operacion.tipo === 'color') return { ...estilo, color: operacion.color };
  if (operacion.tipo === 'grosor') return { ...estilo, grosor: operacion.grosor };
  return estilo;
}

/** Un tramo de geometría dada con el estilo pedido (sin campos de estilo si no hay ninguno). */
export function tramoConEstilo(
  desde: Punto,
  hasta: Punto,
  paso: number,
  linea: number,
  estilo: EstiloPedido,
): TramoDibujo {
  return {
    desde: { x: desde.x, y: desde.y },
    hasta: { x: hasta.x, y: hasta.y },
    paso,
    linea,
    ...(estilo.color !== undefined ? { color: estilo.color } : {}),
    ...(estilo.grosor !== undefined ? { grosor: estilo.grosor } : {}),
  };
}

/** El tramo que deja un `mover` con el lápiz abajo y longitud suficiente, o null. */
export function tramoDeMover(operacion: Operacion, estilo: EstiloPedido): TramoDibujo | null {
  if (operacion.tipo !== 'mover' || !operacion.lapizAbajo) return null;
  const dx = operacion.hasta.x - operacion.desde.x;
  const dy = operacion.hasta.y - operacion.desde.y;
  if (Math.sqrt(dx * dx + dy * dy) < LONGITUD_MINIMA) return null;
  return tramoConEstilo(operacion.desde, operacion.hasta, operacion.paso, operacion.linea, estilo);
}

// ============================================================================
// Extractor
// ============================================================================

/**
 * Extrae los tramos dibujados de una secuencia de operaciones, en orden de paso,
 * cada uno con el estilo vigente. Su geometría coincide siempre con la de
 * `extraerSegmentos` (mismo criterio de lápiz, longitud y `limpiar`). No modifica
 * la entrada.
 */
export function extraerTramosDibujo(operaciones: readonly Operacion[]): readonly TramoDibujo[] {
  let estilo = SIN_ESTILO;
  let acumulados: TramoDibujo[] = [];
  for (const operacion of operaciones) {
    const tramo = tramoDeMover(operacion, estilo);
    if (tramo !== null) acumulados.push(tramo);
    if (operacion.tipo === 'limpiar') acumulados = [];
    estilo = avanzarEstilo(estilo, operacion);
  }
  return acumulados;
}

// ============================================================================
// Del tramo al trazo del lienzo
// ============================================================================

/** Dos componentes de color 0..255 a hexadecimal de dos cifras. */
function hex2(valor: number): string {
  const v = Math.min(255, Math.max(0, Math.round(valor)));
  return v.toString(16).padStart(2, '0');
}

/**
 * Texto CSS del color que pidió el jugador, en hexadecimal. No es un color escrito
 * a mano: se arma en ejecución desde el `Color` resuelto por el intérprete.
 */
export function cssDeColor(color: Color): string {
  return '#' + hex2(color.r) + hex2(color.g) + hex2(color.b);
}

/**
 * Trazo con que se pinta un tramo: el color y el grosor pedidos y, para lo que no
 * se pidió, el del tema. Sin nada pedido devuelve el trazo del tema tal cual (el
 * mismo objeto), así que el dibujo es exactamente el de siempre.
 */
export function trazoDeTramo(tramo: EstiloPedido, tema: TrazoTema): TrazoTema {
  if (tramo.color === undefined && tramo.grosor === undefined) return tema;
  return {
    color: tramo.color !== undefined ? cssDeColor(tramo.color) : tema.color,
    grosor: tramo.grosor ?? tema.grosor,
    guiones: tema.guiones,
  };
}

/** ¿Dos tramos piden el mismo estilo? (para agrupar los seguidos en un solo trazo) */
export function mismoEstilo(a: EstiloPedido, b: EstiloPedido): boolean {
  const colorIgual =
    a.color === undefined || b.color === undefined
      ? a.color === b.color
      : a.color.r === b.color.r && a.color.g === b.color.g && a.color.b === b.color.b;
  return colorIgual && a.grosor === b.grosor;
}
