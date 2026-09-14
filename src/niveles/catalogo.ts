// Catálogo de niveles de KiroLogo
// Reúne los mundos declarados y expone la búsqueda de un nivel por su id.
// En esta spec solo existe el mundo 0.

import type { Nivel } from './tipos.js';
import { MUNDO_0 } from './mundo-0-primeros-pasos.js';

// ============================================================================
// Catálogo completo
// ============================================================================

/**
 * Todos los niveles del juego, ordenados por mundo y, dentro de cada mundo, en
 * el orden en que el mundo los declara. En esta spec solo el mundo 0.
 */
export const CATALOGO: readonly Nivel[] = [...MUNDO_0];

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
