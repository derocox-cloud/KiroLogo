// Encuadre de KiroLogo: caja envolvente, figura no encuadrada y figura degenerada.
// Calcula los límites de una lista de segmentos y decide si cabe en el lienzo.

import type { Punto } from './tortuga.js';
import type { Segmento } from './segmentos.js';

// ============================================================================
// Tipos públicos
// ============================================================================

export interface CajaEnvolvente {
  readonly izquierda: number;
  readonly derecha: number;
  readonly abajo: number;
  readonly arriba: number;
  readonly ancho: number;    // ≥ 0
  readonly alto: number;     // ≥ 0
  readonly centro: Punto;
}

export type LimiteFuera = 'izquierda' | 'derecha' | 'abajo' | 'arriba';

export type ResultadoEncuadre =
  | {
      readonly hayCaja: true;
      readonly caja: CajaEnvolvente;
      readonly noEncuadrada: readonly LimiteFuera[];
      readonly degenerada: boolean;
    }
  | { readonly hayCaja: false; readonly degenerada: true };

// ============================================================================
// Constantes del lienzo
// ============================================================================

/** Límite del lienzo lógico: [−400, 400] inclusive en ambos ejes. */
const LIMITE_LIENZO = 400;

/** Ancho o alto mínimo para que la figura no sea degenerada (200 no cuenta). */
const DIMENSION_MINIMA = 200;

// ============================================================================
// Función principal
// ============================================================================

/**
 * Calcula la caja envolvente de una lista de segmentos y los indicadores de
 * figura no encuadrada y figura degenerada. No modifica la lista recibida y es
 * determinista.
 *
 * @param segmentos Lista de segmentos
 * @returns El encuadre; para una lista vacía, `hayCaja: false` con `degenerada: true`
 */
export function calcularEncuadre(segmentos: readonly Segmento[]): ResultadoEncuadre {
  if (segmentos.length === 0) {
    // Lista sin segmentos: no hay figura. No se devuelven límites en 0.
    return { hayCaja: false, degenerada: true };
  }

  let izquierda = Infinity;
  let derecha = -Infinity;
  let abajo = Infinity;
  let arriba = -Infinity;

  for (const seg of segmentos) {
    for (const punto of [seg.desde, seg.hasta]) {
      if (punto.x < izquierda) izquierda = punto.x;
      if (punto.x > derecha) derecha = punto.x;
      if (punto.y < abajo) abajo = punto.y;
      if (punto.y > arriba) arriba = punto.y;
    }
  }

  const ancho = derecha - izquierda;
  const alto = arriba - abajo;

  const caja: CajaEnvolvente = {
    izquierda,
    derecha,
    abajo,
    arriba,
    ancho,
    alto,
    centro: { x: (izquierda + derecha) / 2, y: (abajo + arriba) / 2 },
  };

  // Figura no encuadrada: cada límite que cae fuera de [−400, 400]. Exactamente
  // −400 o 400 no cuenta como fuera.
  const noEncuadrada: LimiteFuera[] = [];
  if (izquierda < -LIMITE_LIENZO) noEncuadrada.push('izquierda');
  if (derecha > LIMITE_LIENZO) noEncuadrada.push('derecha');
  if (abajo < -LIMITE_LIENZO) noEncuadrada.push('abajo');
  if (arriba > LIMITE_LIENZO) noEncuadrada.push('arriba');

  // Figura degenerada: ancho o alto menor que 200. Exactamente 200 no cuenta.
  const degenerada = ancho < DIMENSION_MINIMA || alto < DIMENSION_MINIMA;

  return { hayCaja: true, caja, noEncuadrada, degenerada };
}
