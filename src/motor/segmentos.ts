// Extracción de segmentos de KiroLogo
// De una secuencia de operaciones a los segmentos dibujados, para validar la
// figura. Un solo recorrido en orden de paso, sin recortar ni redondear.

import type { Operacion } from '../lenguaje/interprete.js';
import type { Punto } from './tortuga.js';

// ============================================================================
// Tipo público
// ============================================================================

export interface Segmento {
  readonly desde: Punto;
  readonly hasta: Punto;
  readonly paso: number;    // el de la Operacion que lo produjo
  readonly linea: number;   // el de la Operacion que lo produjo
}

/** Longitud mínima para que un `mover` cuente como trazo. */
const LONGITUD_MINIMA = 0.0001;

// ============================================================================
// Función principal
// ============================================================================

/**
 * Extrae los segmentos dibujados de una secuencia de operaciones, en orden de
 * paso. Aporta un segmento por cada `mover` con el lápiz abajo y longitud mayor
 * o igual que 0.0001; `limpiar` descarta los segmentos acumulados y el recorrido
 * continúa. No recorta al lienzo ni redondea, y no modifica la entrada.
 *
 * @param operaciones Secuencia de operaciones del intérprete
 * @returns Lista de segmentos, o vacía si ninguno cumple la condición
 */
export function extraerSegmentos(operaciones: readonly Operacion[]): readonly Segmento[] {
  let acumulados: Segmento[] = [];

  for (const operacion of operaciones) {
    switch (operacion.tipo) {
      case 'mover': {
        // Solo con el lápiz abajo y longitud suficiente.
        if (!operacion.lapizAbajo) break;
        const dx = operacion.hasta.x - operacion.desde.x;
        const dy = operacion.hasta.y - operacion.desde.y;
        const longitud = Math.sqrt(dx * dx + dy * dy);
        if (longitud < LONGITUD_MINIMA) break;

        acumulados.push({
          // Copiar los puntos tal como la operación los registró.
          desde: { x: operacion.desde.x, y: operacion.desde.y },
          hasta: { x: operacion.hasta.x, y: operacion.hasta.y },
          paso: operacion.paso,
          linea: operacion.linea,
        });
        break;
      }
      case 'limpiar':
        // Descartar todo lo acumulado; los posteriores conservan su paso y línea.
        acumulados = [];
        break;
      // `girar`, `reubicar`, `lapiz` y `visibilidad` no aportan nada.
      case 'girar':
      case 'reubicar':
      case 'lapiz':
      case 'visibilidad':
        break;
    }
  }

  return acumulados;
}
