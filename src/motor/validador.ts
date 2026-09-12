// Validador geométrico de KiroLogo
// Compara la figura del jugador contra la del programa de referencia sobre una
// máscara propia de 800 × 800, sin OffscreenCanvas, sin document y sin Canvas.
// Se valida el dibujo, no el código.

import type { Punto } from './tortuga.js';
import type { Segmento } from './segmentos.js';
import { calcularEncuadre } from './encuadre.js';

// ============================================================================
// Normalización (forma mínima que necesita el validador)
// ============================================================================

// El validador solo necesita saber si cada componente es libre o fija. El tipo
// `NormalizacionNivel` completo lo declara `src/niveles/tipos.ts` (tarea 15) y
// es estructuralmente compatible con este: los mismos campos con estos valores.
export type ComponenteNormalizacion = 'libre' | 'fija';

export interface NormalizacionNivel {
  readonly traslacion: ComponenteNormalizacion;
  readonly rotacion: ComponenteNormalizacion;
  readonly escala: 'exacta';
}

// ============================================================================
// Máscara y mapeo de coordenadas (sección 9.3)
// ============================================================================

/** Máscara de 800 × 800 posiciones (0 o 1), índice = iy·800 + ix. */
export type Mascara = Uint8Array;

/** Lado del arreglo, en posiciones. */
export const LADO = 800;

/** Número total de posiciones de la máscara. */
const TOTAL = LADO * LADO;

/** Crea una máscara vacía (todas las posiciones apagadas). */
export function crearMascara(): Mascara {
  return new Uint8Array(TOTAL);
}

/**
 * Mapea una coordenada lógica al índice de columna del arreglo.
 * `ix = ⌊x + 400⌋`, válido si 0 ≤ ix ≤ 799.
 */
export function aColumna(x: number): number {
  return Math.floor(x + 400);
}

/**
 * Mapea una coordenada lógica al índice de fila del arreglo.
 * `iy = ⌊400 − y⌋`, válido si 0 ≤ iy ≤ 799.
 */
export function aFila(y: number): number {
  return Math.floor(400 - y);
}

/** Enciende la posición (ix, iy) si cae dentro del arreglo. */
function encender(mascara: Mascara, ix: number, iy: number): void {
  if (ix < 0 || ix >= LADO || iy < 0 || iy >= LADO) return;
  mascara[iy * LADO + ix] = 1;
}

// ============================================================================
// Trazado DDA (sección 9.4)
// ============================================================================

/** Paso de muestreo del DDA, en unidades lógicas. */
const PASO_DDA = 0.5;

/**
 * Traza un segmento en la máscara con DDA de paso 0.5 unidades lógicas,
 * encendiendo la celda de cada muestra y siempre las dos celdas de los extremos.
 * Las posiciones fuera del arreglo se descartan sin escribir fuera de límites.
 */
export function trazarSegmento(mascara: Mascara, desde: Punto, hasta: Punto): void {
  const dx = hasta.x - desde.x;
  const dy = hasta.y - desde.y;
  const longitud = Math.sqrt(dx * dx + dy * dy);

  // Encender siempre las dos celdas de los extremos.
  encender(mascara, aColumna(desde.x), aFila(desde.y));
  encender(mascara, aColumna(hasta.x), aFila(hasta.y));

  if (longitud === 0) return;

  const n = Math.ceil(longitud / PASO_DDA);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    const x = desde.x + dx * t;
    const y = desde.y + dy * t;
    encender(mascara, aColumna(x), aFila(y));
  }
}

/**
 * Rasteriza una lista de segmentos en una máscara nueva, opcionalmente
 * trasladando cada punto por `traslacion` (en unidades lógicas).
 */
export function rasterizar(segmentos: readonly Segmento[], traslacion: Punto = { x: 0, y: 0 }): Mascara {
  const mascara = crearMascara();
  for (const seg of segmentos) {
    trazarSegmento(
      mascara,
      { x: seg.desde.x + traslacion.x, y: seg.desde.y + traslacion.y },
      { x: seg.hasta.x + traslacion.x, y: seg.hasta.y + traslacion.y },
    );
  }
  return mascara;
}

// ============================================================================
// Dilatación del disco de 8 píxeles (sección 9.5)
// ============================================================================

/**
 * Semianchos de las 17 corridas horizontales del disco `dx² + dy² ≤ 64`, para
 * `dy` de −8 a 8. `w(dy) = ⌊√(64 − dy²)⌋`.
 */
const SEMIANCHOS: readonly number[] = [0, 3, 5, 6, 6, 7, 7, 7, 8, 7, 7, 7, 6, 6, 5, 3, 0];

/** Desplazamiento vertical mínimo del disco (índice 0 de SEMIANCHOS es dy = −8). */
const DY_MINIMO = -8;

/**
 * Dilata una máscara por el disco de radio 8 (distancia euclidiana ≤ 8). Produce
 * exactamente la misma máscara que el elemento estructurante circular, con coste
 * fijo e independiente de la tinta: sumas de prefijo por fila y el OR de las 17
 * corridas desplazadas.
 *
 * @param origen Máscara a dilatar (no se modifica)
 * @returns Máscara nueva dilatada
 */
export function dilatar(origen: Mascara): Mascara {
  const salida = crearMascara();

  // Sumas de prefijo por fila: pre[y] tiene LADO+1 entradas, pre[y][x] = suma de
  // origen[y][0..x-1]. Así la suma de una corrida [a, b] es pre[b+1] − pre[a].
  // Para ahorrar memoria, calculamos las sumas de prefijo fila por fila bajo
  // demanda dentro del bucle de salida.
  const prefijos: Int32Array[] = new Array(LADO);
  for (let y = 0; y < LADO; y++) {
    const pre = new Int32Array(LADO + 1);
    const base = y * LADO;
    for (let x = 0; x < LADO; x++) {
      pre[x + 1] = pre[x]! + origen[base + x]!;
    }
    prefijos[y] = pre;
  }

  for (let iy = 0; iy < LADO; iy++) {
    const salidaBase = iy * LADO;
    for (let ix = 0; ix < LADO; ix++) {
      let encendida = 0;
      // OR sobre las 17 corridas: la corrida `k` está en la fila `iy − dy`.
      for (let k = 0; k < SEMIANCHOS.length && encendida === 0; k++) {
        const dy = DY_MINIMO + k;
        const filaFuente = iy - dy;
        if (filaFuente < 0 || filaFuente >= LADO) continue;
        const w = SEMIANCHOS[k]!;
        const pre = prefijos[filaFuente]!;
        const a = Math.max(0, ix - w);
        const b = Math.min(LADO - 1, ix + w);
        if (pre[b + 1]! - pre[a]! > 0) {
          encendida = 1;
        }
      }
      salida[salidaBase + ix] = encendida;
    }
  }

  return salida;
}

// ============================================================================
// IoU, exceso y las tres regiones (sección 9.6)
// ============================================================================

/** Umbral mínimo de IoU para conceder la coincidencia. */
export const UMBRAL_IOU = 0.9;

/** Umbral máximo de exceso de trazo (en porcentaje) para conceder la coincidencia. */
export const UMBRAL_EXCESO = 5;

export type MotivoVeredicto = 'coincide' | 'excesoDeTrazo' | 'iouInsuficiente' | 'sinEstelaDelJugador';

export interface Comparacion {
  readonly iou: number;                 // sin redondear
  readonly excesoPorcentaje: number;    // sin redondear
  readonly coincide: boolean;
  readonly motivo: MotivoVeredicto;
  readonly coincidencia: Mascara;       // Ad ∩ Bd
  readonly exceso: Mascara;             // Bd \ Ad
  readonly falta: Mascara;              // Ad \ Bd
}

/**
 * Compara la máscara objetivo dilatada `ad` contra la del jugador dilatada `bd`.
 * Calcula el IoU, el exceso de trazo y las tres regiones, y decide el veredicto.
 *
 * @param ad Máscara objetivo dilatada (y girada, si aplica)
 * @param bd Máscara del jugador dilatada
 * @returns La comparación completa
 */
export function comparar(ad: Mascara, bd: Mascara): Comparacion {
  const coincidencia = crearMascara();
  const exceso = crearMascara();
  const falta = crearMascara();

  let interseccion = 0;
  let soloAd = 0;   // falta
  let soloBd = 0;   // exceso
  let totalAd = 0;

  for (let i = 0; i < TOTAL; i++) {
    const a = ad[i]!;
    const b = bd[i]!;
    if (a === 1) totalAd += 1;
    if (a === 1 && b === 1) {
      coincidencia[i] = 1;
      interseccion += 1;
    } else if (b === 1 && a === 0) {
      exceso[i] = 1;
      soloBd += 1;
    } else if (a === 1 && b === 0) {
      falta[i] = 1;
      soloAd += 1;
    }
  }

  const union = interseccion + soloAd + soloBd;

  // IoU = 0 cuando la unión o la máscara objetivo no tiene ninguna posición encendida.
  const iou = union === 0 || totalAd === 0 ? 0 : interseccion / union;
  // exceso% = |exceso| / |Ad| · 100; 0 cuando el objetivo está vacío.
  const excesoPorcentaje = totalAd === 0 ? 0 : (soloBd / totalAd) * 100;

  // Motivo con precedencia fija: excesoDeTrazo antes que iouInsuficiente.
  let coincide = false;
  let motivo: MotivoVeredicto;
  if (excesoPorcentaje > UMBRAL_EXCESO) {
    motivo = 'excesoDeTrazo';
  } else if (iou < UMBRAL_IOU) {
    motivo = 'iouInsuficiente';
  } else {
    coincide = true;
    motivo = 'coincide';
  }

  return { iou, excesoPorcentaje, coincide, motivo, coincidencia, exceso, falta };
}

// ============================================================================
// Búsqueda del mejor giro (sección 9.8)
// ============================================================================

/** Umbral de |Ad| por encima del cual el barrido usa el nivel grueso. */
export const UMBRAL_BUSQUEDA_GRUESA = 120_000;

/** Centro de giro del arreglo, en coordenadas de índice. */
const CENTRO_INDICE = 399.5;

/** Índice de las posiciones encendidas de una máscara, respecto del centro de giro. */
interface IndiceEncendidas {
  readonly dx: Int16Array;   // ix − 399.5, como entero redondeado no: se guarda el offset real
  readonly dy: Int16Array;
  readonly cantidad: number;
}

/** Construye el índice de posiciones encendidas de una máscara. */
function construirIndice(m: Mascara): IndiceEncendidas {
  let cantidad = 0;
  for (let i = 0; i < TOTAL; i++) cantidad += m[i]!;
  const dx = new Int16Array(cantidad);
  const dy = new Int16Array(cantidad);
  let k = 0;
  for (let iy = 0; iy < LADO; iy++) {
    const base = iy * LADO;
    for (let ix = 0; ix < LADO; ix++) {
      if (m[base + ix] === 1) {
        // Desplazamiento respecto del centro de giro (399.5, 399.5), como medio entero.
        // Guardamos el doble del desplazamiento para mantener enteros exactos.
        dx[k] = ix * 2 - 799;   // 2·(ix − 399.5)
        dy[k] = iy * 2 - 799;
        k += 1;
      }
    }
  }
  return { dx, dy, cantidad };
}

/**
 * Estima el IoU de `Ad` girada `θ` grados contra `Bd`, recorriendo el índice de
 * `Ad`. Devuelve la intersección y el número de posiciones que caen dentro.
 */
function estimarInterseccion(indice: IndiceEncendidas, bd: Mascara, cos: number, sin: number): number {
  let inter = 0;
  const { dx, dy, cantidad } = indice;
  for (let k = 0; k < cantidad; k++) {
    // dx[k]/2 y dy[k]/2 son los desplazamientos reales; giramos y volvemos a índice.
    const ox = dx[k]! / 2;
    const oy = dy[k]! / 2;
    const ix = Math.floor(CENTRO_INDICE + (ox * cos - oy * sin) + 0.5);
    const iy = Math.floor(CENTRO_INDICE + (ox * sin + oy * cos) + 0.5);
    if (ix < 0 || ix >= LADO || iy < 0 || iy >= LADO) continue;
    inter += bd[iy * LADO + ix]!;
  }
  return inter;
}

/**
 * Materializa `Ad` girada `θ` grados por mapeo inverso: para cada celda de
 * destino se gira al revés y se muestrea `Ad`, evitando huecos de redondeo.
 */
function girarMascara(ad: Mascara, grados: number): Mascara {
  const salida = crearMascara();
  const rad = (grados * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  for (let iy = 0; iy < LADO; iy++) {
    const oy = iy - CENTRO_INDICE;
    for (let ix = 0; ix < LADO; ix++) {
      const ox = ix - CENTRO_INDICE;
      // Mapeo inverso: girar −θ para hallar la celda de origen.
      const fx = CENTRO_INDICE + (ox * cos + oy * sin);
      const fy = CENTRO_INDICE + (-ox * sin + oy * cos);
      const sx = Math.floor(fx + 0.5);
      const sy = Math.floor(fy + 0.5);
      if (sx < 0 || sx >= LADO || sy < 0 || sy >= LADO) continue;
      if (ad[sy * LADO + sx] === 1) salida[iy * LADO + ix] = 1;
    }
  }
  return salida;
}

/** Submuestrea una máscara por factor 4 (200 × 200), celda encendida si alguna fina lo está. */
function submuestrear(m: Mascara): { datos: Uint8Array; lado: number } {
  const lado = LADO / 4; // 200
  const datos = new Uint8Array(lado * lado);
  for (let iy = 0; iy < LADO; iy++) {
    const gy = (iy / 4) | 0;
    const base = iy * LADO;
    for (let ix = 0; ix < LADO; ix++) {
      if (m[base + ix] === 1) {
        datos[gy * lado + ((ix / 4) | 0)] = 1;
      }
    }
  }
  return { datos, lado };
}

export interface MejorGiro {
  readonly angulo: number;          // 0 a 359
  readonly adGirada: Mascara;       // Ad ya girada al ángulo ganador
  readonly comparacion: Comparacion;
}

/**
 * Busca el ángulo entero (0–359) que maximiza el IoU exacto de `Ad` girada
 * contra `Bd`, con desempate por menor ángulo. Dilata una sola vez (se recibe ya
 * dilatada) y gira la dilatada. Usa un barrido barato para ordenar candidatos y
 * un afinado exacto de los 8 mejores más el ángulo 0.
 *
 * @param ad Máscara objetivo dilatada
 * @param bd Máscara del jugador dilatada
 * @returns El mejor giro, con su comparación exacta
 */
export function buscarMejorGiro(ad: Mascara, bd: Mascara): MejorGiro {
  const indice = construirIndice(ad);

  // Barrido de 360 ángulos para estimar y ordenar. Con |Ad| grande, usar el
  // nivel grueso (submuestreo por factor 4) solo para ordenar.
  const usarGrueso = indice.cantidad > UMBRAL_BUSQUEDA_GRUESA;
  const estimaciones: Array<{ angulo: number; inter: number }> = [];

  if (usarGrueso) {
    const indiceGrueso = construirIndiceGrueso(ad);
    const bdGrueso = construirBdGrueso(bd);
    for (let angulo = 0; angulo < 360; angulo++) {
      const rad = (angulo * Math.PI) / 180;
      const inter = estimarInterseccionGrueso(indiceGrueso, bdGrueso, Math.cos(rad), Math.sin(rad));
      estimaciones.push({ angulo, inter });
    }
  } else {
    for (let angulo = 0; angulo < 360; angulo++) {
      const rad = (angulo * Math.PI) / 180;
      const inter = estimarInterseccion(indice, bd, Math.cos(rad), Math.sin(rad));
      estimaciones.push({ angulo, inter });
    }
  }

  // Ordenar por intersección estimada descendente; tomar los 8 mejores.
  estimaciones.sort((a, b) => b.inter - a.inter || a.angulo - b.angulo);
  const candidatos = new Set<number>([0]);
  for (let i = 0; i < 8 && i < estimaciones.length; i++) {
    candidatos.add(estimaciones[i]!.angulo);
  }

  // Afinado exacto de cada candidato.
  let mejor: MejorGiro | null = null;
  const angulosOrdenados = [...candidatos].sort((a, b) => a - b);
  for (const angulo of angulosOrdenados) {
    const adGirada = girarMascara(ad, angulo);
    const comparacion = comparar(adGirada, bd);
    if (
      mejor === null ||
      comparacion.iou > mejor.comparacion.iou ||
      (comparacion.iou === mejor.comparacion.iou && angulo < mejor.angulo)
    ) {
      mejor = { angulo, adGirada, comparacion };
    }
  }

  // Siempre hay al menos el ángulo 0, así que `mejor` nunca es null.
  return mejor!;
}

// ---- Auxiliares del nivel grueso ------------------------------------------

interface IndiceGrueso {
  readonly dx: Int16Array;
  readonly dy: Int16Array;
  readonly cantidad: number;
  readonly lado: number;
}

function construirIndiceGrueso(ad: Mascara): IndiceGrueso {
  const { datos, lado } = submuestrear(ad);
  let cantidad = 0;
  for (let i = 0; i < datos.length; i++) cantidad += datos[i]!;
  const dx = new Int16Array(cantidad);
  const dy = new Int16Array(cantidad);
  const centro = (lado - 1) / 2;
  let k = 0;
  for (let iy = 0; iy < lado; iy++) {
    for (let ix = 0; ix < lado; ix++) {
      if (datos[iy * lado + ix] === 1) {
        dx[k] = Math.round((ix - centro) * 2);
        dy[k] = Math.round((iy - centro) * 2);
        k += 1;
      }
    }
  }
  return { dx, dy, cantidad, lado };
}

function construirBdGrueso(bd: Mascara): Uint8Array {
  return submuestrear(bd).datos;
}

function estimarInterseccionGrueso(indice: IndiceGrueso, bd: Uint8Array, cos: number, sin: number): number {
  let inter = 0;
  const { dx, dy, cantidad, lado } = indice;
  const centro = (lado - 1) / 2;
  for (let k = 0; k < cantidad; k++) {
    const ox = dx[k]! / 2;
    const oy = dy[k]! / 2;
    const ix = Math.floor(centro + (ox * cos - oy * sin) + 0.5);
    const iy = Math.floor(centro + (ox * sin + oy * cos) + 0.5);
    if (ix < 0 || ix >= lado || iy < 0 || iy >= lado) continue;
    inter += bd[iy * lado + ix]!;
  }
  return inter;
}

// ============================================================================
// validar (secciones 9.7 y 9.9)
// ============================================================================

export interface Veredicto {
  readonly coincide: boolean;
  readonly iou: number;                  // sin redondear
  readonly excesoPorcentaje: number;     // sin redondear
  readonly motivo: MotivoVeredicto;
  readonly traslacion: Punto;            // aplicada, en posiciones enteras
  readonly angulo: number;               // 0 a 359
  readonly mascaraObjetivo: Mascara;     // dilatada y ya girada al ángulo ganador
  readonly mascaraJugador: Mascara;      // dilatada
  readonly coincidencia: Mascara;
  readonly exceso: Mascara;
  readonly falta: Mascara;
}

/**
 * Calcula la traslación que lleva el centro de la caja envolvente de una figura
 * al centro del arreglo, redondeada a posiciones enteras. Devuelve (0,0) si la
 * figura no tiene caja (lista vacía).
 */
function traslacionAlCentro(segmentos: readonly Segmento[]): Punto {
  const encuadre = calcularEncuadre(segmentos);
  if (!encuadre.hayCaja) return { x: 0, y: 0 };
  return {
    x: Math.round(-encuadre.caja.centro.x),
    y: Math.round(-encuadre.caja.centro.y),
  };
}

/**
 * Valida la figura del jugador contra la del programa de referencia, aplicando
 * la normalización del nivel. Devuelve el veredicto con el IoU, el exceso, la
 * traslación, el ángulo, las dos máscaras dilatadas y las tres regiones.
 *
 * @param segmentosJugador Segmentos de la estela del jugador
 * @param segmentosObjetivo Segmentos del programa de referencia
 * @param normalizacion Normalización declarada por el nivel
 * @returns El veredicto completo
 */
export function validar(
  segmentosJugador: readonly Segmento[],
  segmentosObjetivo: readonly Segmento[],
  normalizacion: NormalizacionNivel,
): Veredicto {
  // Traslación: libre centra cada figura; fija no transforma.
  const traslacionJugador = normalizacion.traslacion === 'libre'
    ? traslacionAlCentro(segmentosJugador)
    : { x: 0, y: 0 };
  const traslacionObjetivo = normalizacion.traslacion === 'libre'
    ? traslacionAlCentro(segmentosObjetivo)
    : { x: 0, y: 0 };

  const mascaraJugador = dilatar(rasterizar(segmentosJugador, traslacionJugador));
  const objetivoBase = dilatar(rasterizar(segmentosObjetivo, traslacionObjetivo));

  // Caso: estela del jugador vacía o ninguna posición dentro del arreglo.
  let jugadorTieneTinta = false;
  for (let i = 0; i < TOTAL; i++) {
    if (mascaraJugador[i] === 1) { jugadorTieneTinta = true; break; }
  }
  if (!jugadorTieneTinta) {
    const coincidencia = crearMascara();
    const exceso = crearMascara();
    // La falta es toda la máscara objetivo dilatada.
    const falta = objetivoBase.slice() as Mascara;
    return {
      coincide: false,
      iou: 0,
      excesoPorcentaje: 0,
      motivo: 'sinEstelaDelJugador',
      traslacion: traslacionJugador,
      angulo: 0,
      mascaraObjetivo: objetivoBase,
      mascaraJugador,
      coincidencia,
      exceso,
      falta,
    };
  }

  // Rotación: libre busca el mejor giro; fija evalúa solo el ángulo 0.
  if (normalizacion.rotacion === 'libre') {
    const mejor = buscarMejorGiro(objetivoBase, mascaraJugador);
    const c = mejor.comparacion;
    return {
      coincide: c.coincide,
      iou: c.iou,
      excesoPorcentaje: c.excesoPorcentaje,
      motivo: c.motivo,
      traslacion: traslacionJugador,
      angulo: mejor.angulo,
      mascaraObjetivo: mejor.adGirada,
      mascaraJugador,
      coincidencia: c.coincidencia,
      exceso: c.exceso,
      falta: c.falta,
    };
  }

  // Rotación fija: solo el ángulo 0.
  const c = comparar(objetivoBase, mascaraJugador);
  return {
    coincide: c.coincide,
    iou: c.iou,
    excesoPorcentaje: c.excesoPorcentaje,
    motivo: c.motivo,
    traslacion: traslacionJugador,
    angulo: 0,
    mascaraObjetivo: objetivoBase,
    mascaraJugador,
    coincidencia: c.coincidencia,
    exceso: c.exceso,
    falta: c.falta,
  };
}
