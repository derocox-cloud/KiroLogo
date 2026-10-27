// Catálogo de niveles de KiroLogo
// Reúne los mundos declarados y expone la búsqueda de un nivel por su id.
// En esta spec existen los mundos 0, 1 y 2.

import type { Nivel } from './tipos.js';
import { MUNDO_0 } from './mundo-0-primeros-pasos.js';
import { MUNDO_1 } from './mundo-1-figuras.js';
import { MUNDO_2 } from './mundo-2-composicion.js';

// ============================================================================
// Catálogo completo
// ============================================================================

/**
 * Todos los niveles del juego, ordenados por mundo y, dentro de cada mundo, en
 * el orden en que el mundo los declara.
 */
export const CATALOGO: readonly Nivel[] = [...MUNDO_0, ...MUNDO_1, ...MUNDO_2];

// ============================================================================
// Búsqueda
// ============================================================================

export type ResultadoBusquedaNivel =
  | { readonly hallado: true; readonly nivel: Nivel }
  | { readonly hallado: false };

/**
 * Busca un nivel por su identificador.
 *
 * @param id Identificador del nivel, como `0.1`
 * @returns Resultado explícito de búsqueda
 */
export function buscarNivel(id: string): ResultadoBusquedaNivel {
  for (const nivel of CATALOGO) {
    if (nivel.id === id) {
      return { hallado: true, nivel };
    }
  }
  return { hallado: false };
}
