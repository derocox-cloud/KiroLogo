// Relleno de KiroLogo: el área cerrada donde está la tortuga (R4.6, R4.7).
//
// El área se calcula sobre una máscara hecha desde los TRAZOS, no leyendo píxeles
// del canvas: así el resultado es determinista, se prueba en Node y no depende del
// color ni del antialiasing del navegador. Este módulo solo sirve para dibujar; el
// validador no lo usa (R4.8: el relleno no cuenta para la precisión).
//
// Algoritmo:
//   1. Muros: cada trazo se marca en una cuadrícula de 800 × 800 celdas de una
//      unidad lógica con DDA de paso 0,5. Dos muestras seguidas caen en celdas
//      vecinas (también en diagonal), así que cada trazo es una línea 8-conexa.
//   2. Inundación 4-conexa desde la celda de la tortuga. Una inundación 4-conexa no
//      atraviesa una línea 8-conexa: un polígono cerrado no tiene fugas, ni siquiera
//      por sus lados inclinados.
//   3. Si la región alcanza el borde del lienzo, no hay área cerrada y no se
//      rellena nada (R4.7).
//
// La tortuga sobre una línea: justo al terminar `REPITE 4 [AV 100 GD 90]` la
// tortuga vuelve a su punto de partida, que está SOBRE el trazo (la esquina). Sin
// tratar ese caso, el uso más natural de RELLENA nunca rellenaría. Si la celda de la
// tortuga es muro, se prueban las celdas libres a su alrededor (hasta un radio de
// 3 celdas, de la más cercana a la más lejana y en un orden fijo) y se rellena la
// primera región CERRADA que se encuentre; las regiones abiertas se descartan.
//
// La región rellena incluye las celdas de muro que la tocan, para que el color
// llegue hasta la línea y no deje un hueco con un trazo fino: el relleno se pinta
// debajo de los trazos, así que estos lo tapan.

import type { Punto } from './tortuga.js';
import type { Segmento } from './segmentos.js';

// ============================================================================
// Tipos públicos
// ============================================================================

/**
 * Corrida horizontal de celdas rellenas, en unidades lógicas: cubre
 * `x ∈ [x0, x1)` e `y ∈ [y, y + 1)`. Las corridas de una región no se solapan.
 */
export interface Corrida {
  readonly y: number;
  readonly x0: number;
  readonly x1: number;
}

// ============================================================================
// Cuadrícula de celdas
// ============================================================================

/** Lado de la cuadrícula, en celdas de una unidad lógica. */
const LADO = 800;

/** Mitad del lado: el espacio lógico va de −400 a 400. */
const SEMILADO = 400;

/** Paso de muestreo del trazado, en unidades lógicas. */
const PASO = 0.5;

/** Radio máximo, en celdas, para buscar una celda libre si la tortuga está sobre una línea. */
const RADIO_BUSQUEDA = 3;

/** Columna de la celda que contiene la abscisa `x`. */
function columna(x: number): number {
  return Math.floor(x + SEMILADO);
}

/** Fila de la celda que contiene la ordenada `y` (fila 0 arriba, `y` hacia arriba). */
function fila(y: number): number {
  return Math.floor(SEMILADO - y);
}

function dentro(ix: number, iy: number): boolean {
  return ix >= 0 && ix < LADO && iy >= 0 && iy < LADO;
}

/** Marca los trazos como muros con DDA de paso 0,5 (y siempre sus dos extremos). */
function marcarMuros(trazos: readonly Segmento[]): Uint8Array {
  const muros = new Uint8Array(LADO * LADO);
  const marcar = (x: number, y: number): void => {
    const ix = columna(x);
    const iy = fila(y);
    if (dentro(ix, iy)) muros[iy * LADO + ix] = 1;
  };
  for (const t of trazos) {
    const dx = t.hasta.x - t.desde.x;
    const dy = t.hasta.y - t.desde.y;
    marcar(t.desde.x, t.desde.y);
    marcar(t.hasta.x, t.hasta.y);
    const n = Math.ceil(Math.sqrt(dx * dx + dy * dy) / PASO);
    for (let k = 1; k < n; k++) {
      marcar(t.desde.x + (dx * k) / n, t.desde.y + (dy * k) / n);
    }
  }
  return muros;
}

/**
 * Inunda 4-conexamente desde `inicio` las celdas libres no visitadas. Marca en
 * `visitadas` todas las celdas de la región (con el número `marca`) y devuelve si
 * la región toca el borde de la cuadrícula.
 */
function inundar(
  muros: Uint8Array,
  visitadas: Int32Array,
  inicio: number,
  marca: number,
  cola: Int32Array,
): boolean {
  let cabeza = 0;
  let fin = 0;
  let tocaBorde = false;
  visitadas[inicio] = marca;
  cola[fin++] = inicio;
  while (cabeza < fin) {
    const celda = cola[cabeza++]!;
    const ix = celda % LADO;
    const iy = (celda - ix) / LADO;
    if (ix === 0 || iy === 0 || ix === LADO - 1 || iy === LADO - 1) tocaBorde = true;
    // Vecinas 4-conexas: izquierda, derecha, arriba, abajo.
    if (ix > 0) fin = encolar(muros, visitadas, celda - 1, marca, cola, fin);
    if (ix < LADO - 1) fin = encolar(muros, visitadas, celda + 1, marca, cola, fin);
    if (iy > 0) fin = encolar(muros, visitadas, celda - LADO, marca, cola, fin);
    if (iy < LADO - 1) fin = encolar(muros, visitadas, celda + LADO, marca, cola, fin);
  }
  return tocaBorde;
}

function encolar(
  muros: Uint8Array,
  visitadas: Int32Array,
  celda: number,
  marca: number,
  cola: Int32Array,
  fin: number,
): number {
  if (muros[celda] === 1 || visitadas[celda] !== 0) return fin;
  visitadas[celda] = marca;
  cola[fin] = celda;
  return fin + 1;
}

/**
 * Celdas desde las que probar la inundación: la de la tortuga si está libre; si es
 * muro, las libres a su alrededor, de la más cercana a la más lejana (anillos
 * cuadrados de radio 1 a 3), cada anillo en un orden fijo.
 */
function celdasDeInicio(muros: Uint8Array, ix: number, iy: number): number[] {
  const propia = iy * LADO + ix;
  if (muros[propia] === 0) return [propia];
  const candidatas: number[] = [];
  for (let r = 1; r <= RADIO_BUSQUEDA; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // solo el anillo de radio r
        const cx = ix + dx;
        const cy = iy + dy;
        if (!dentro(cx, cy)) continue;
        const celda = cy * LADO + cx;
        if (muros[celda] === 0) candidatas.push(celda);
      }
    }
  }
  return candidatas;
}

// ============================================================================
// Función principal
// ============================================================================

/**
 * Calcula el área cerrada que contiene a la tortuga, delimitada por los trazos
 * dados. Devuelve sus corridas horizontales o `null` si no hay área cerrada (la
 * región llega al borde del lienzo, no hay trazos o la tortuga está fuera del
 * lienzo). Determinista; no modifica la entrada.
 *
 * @param trazos Trazos de la estela en el momento de rellenar
 * @param punto Posición de la tortuga
 */
export function calcularRelleno(trazos: readonly Segmento[], punto: Punto): readonly Corrida[] | null {
  const ix = columna(punto.x);
  const iy = fila(punto.y);
  if (trazos.length === 0 || !dentro(ix, iy)) return null;

  const muros = marcarMuros(trazos);
  const visitadas = new Int32Array(LADO * LADO);
  const cola = new Int32Array(LADO * LADO);

  let marca = 0;
  for (const inicio of celdasDeInicio(muros, ix, iy)) {
    if (visitadas[inicio] !== 0) continue; // ya pertenece a una región probada
    marca += 1;
    const abierta = inundar(muros, visitadas, inicio, marca, cola);
    if (!abierta) return corridasDeRegion(muros, visitadas, marca);
  }
  return null;
}

/**
 * Corridas horizontales de la región `marca`, ampliada con las celdas de muro que
 * la tocan (para que el color llegue hasta la línea).
 */
function corridasDeRegion(muros: Uint8Array, visitadas: Int32Array, marca: number): Corrida[] {
  const enRegion = (celda: number): boolean => visitadas[celda] === marca;
  const pintada = (ix: number, iy: number): boolean => {
    const celda = iy * LADO + ix;
    if (enRegion(celda)) return true;
    if (muros[celda] !== 1) return false;
    return (
      (ix > 0 && enRegion(celda - 1)) ||
      (ix < LADO - 1 && enRegion(celda + 1)) ||
      (iy > 0 && enRegion(celda - LADO)) ||
      (iy < LADO - 1 && enRegion(celda + LADO))
    );
  };

  const corridas: Corrida[] = [];
  for (let iy = 0; iy < LADO; iy++) {
    let ix = 0;
    while (ix < LADO) {
      if (!pintada(ix, iy)) {
        ix += 1;
        continue;
      }
      const desde = ix;
      while (ix < LADO && pintada(ix, iy)) ix += 1;
      // La fila iy cubre y ∈ [400 − iy − 1, 400 − iy); la columna ix, x ∈ [ix − 400, ix − 399).
      corridas.push({ y: SEMILADO - iy - 1, x0: desde - SEMILADO, x1: ix - SEMILADO });
    }
  }
  return corridas;
}
