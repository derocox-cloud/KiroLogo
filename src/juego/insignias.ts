// Insignias de KiroLogo.
//
// En esta spec existe una sola insignia: *Secuencia*, la del mundo 0. Se otorga
// cuando, y solo cuando, los cinco niveles del mundo 0 tienen las tres estrellas
// guardadas. El otorgamiento se deriva **solo** del progreso y el catálogo, sin
// estado propio persistido, de modo que es reproducible a partir de las estrellas
// guardadas (requisito 8.4). Ninguna insignia de otro mundo ni transversal se
// otorga aquí (requisito 8.5).

import { CATALOGO } from '../niveles/catalogo.js';
import type { Nivel } from '../niveles/tipos.js';
import type { Progreso } from './progreso.js';

// ============================================================================
// Identificadores de insignia
// ============================================================================

/** La única insignia de esta spec: la del mundo 0. */
export type IdInsignia = 'secuencia';

/** El mundo al que pertenece cada insignia por concepto. */
const MUNDO_DE_INSIGNIA: Readonly<Record<IdInsignia, number>> = {
  secuencia: 0,
};

// ============================================================================
// Helpers
// ============================================================================

/** Los niveles de un mundo, en el orden del catálogo. */
function nivelesDelMundo(mundo: number): readonly Nivel[] {
  return CATALOGO.filter((n) => n.mundo === mundo);
}

/** ¿El nivel tiene las tres estrellas guardadas? */
function tresEstrellas(idNivel: string, progreso: Progreso): boolean {
  const e = progreso.estrellasDe(idNivel);
  return e !== null && e.precision && e.economia && e.abstraccion;
}

/** ¿Todos los niveles de un mundo tienen las tres estrellas? */
function mundoCompletoConTresEstrellas(mundo: number, progreso: Progreso): boolean {
  const niveles = nivelesDelMundo(mundo);
  // Un mundo sin niveles declarados no puede estar completo.
  if (niveles.length === 0) return false;
  return niveles.every((n) => tresEstrellas(n.id, progreso));
}

// ============================================================================
// La insignia Secuencia
// ============================================================================

/**
 * ¿Se otorga la insignia *Secuencia*? Verdadero solo si los cinco niveles del
 * mundo 0 tienen las tres estrellas cada uno. Falta una sola estrella en
 * cualquiera y no se otorga.
 *
 * @param progreso Progreso del jugador
 */
export function insigniaSecuenciaOtorgada(progreso: Progreso): boolean {
  return mundoCompletoConTresEstrellas(0, progreso);
}

// ============================================================================
// Insignias por mundo
// ============================================================================

/**
 * Las insignias otorgadas de un mundo. En esta spec solo el mundo 0 tiene una
 * insignia (*Secuencia*); cualquier otro mundo devuelve una lista vacía.
 *
 * @param mundo Número de mundo (0 a 5)
 * @param progreso Progreso del jugador
 * @returns Los identificadores de las insignias otorgadas de ese mundo
 */
export function insigniasDelMundo(mundo: number, progreso: Progreso): readonly IdInsignia[] {
  const otorgadas: IdInsignia[] = [];
  for (const id of Object.keys(MUNDO_DE_INSIGNIA) as IdInsignia[]) {
    if (MUNDO_DE_INSIGNIA[id] !== mundo) continue;
    if (id === 'secuencia' && insigniaSecuenciaOtorgada(progreso)) {
      otorgadas.push(id);
    }
  }
  return otorgadas;
}
