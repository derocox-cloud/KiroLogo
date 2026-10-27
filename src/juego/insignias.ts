// Insignias de KiroLogo.
//
// Las insignias de concepto se otorgan al dominar un mundo entero: las tres
// estrellas en todos sus niveles. Aquí se reconocen tres: *Secuencia* (mundo 0),
// *Iteración* (mundo 1) y *Descomposición* (mundo 2). El otorgamiento se deriva
// **solo** del progreso y el catálogo, sin estado propio persistido, de modo que
// es reproducible a partir de las estrellas guardadas y, por lo mismo, se
// mantiene otorgado exactamente una vez sin crear una segunda instancia. Ninguna
// otra insignia por concepto ni transversal se otorga aquí.

import { CATALOGO } from '../niveles/catalogo.js';
import type { Nivel } from '../niveles/tipos.js';
import type { Progreso } from './progreso.js';

// ============================================================================
// Identificadores de insignia
// ============================================================================

/** Las insignias por concepto disponibles en esta spec. */
export type IdInsignia = 'secuencia' | 'iteracion' | 'descomposicion';

/** El mundo al que pertenece cada insignia por concepto. */
const MUNDO_DE_INSIGNIA: Readonly<Record<IdInsignia, number>> = {
  secuencia: 0,
  iteracion: 1,
  descomposicion: 2,
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
// Insignias por concepto
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

/**
 * ¿Se otorga la insignia *Iteración*? Verdadero solo si todos los niveles del
 * mundo 1 tienen las tres estrellas cada uno.
 *
 * @param progreso Progreso del jugador
 */
export function insigniaIteracionOtorgada(progreso: Progreso): boolean {
  return mundoCompletoConTresEstrellas(1, progreso);
}

/**
 * ¿Se otorga la insignia *Descomposición*? Verdadero solo si todos los niveles
 * del mundo 2 tienen las tres estrellas cada uno. Falta una sola estrella en
 * cualquiera y no se otorga.
 *
 * @param progreso Progreso del jugador
 */
export function insigniaDescomposicionOtorgada(progreso: Progreso): boolean {
  return mundoCompletoConTresEstrellas(2, progreso);
}

// ============================================================================
// Insignias por mundo
// ============================================================================

/**
 * Las insignias otorgadas de un mundo. Hoy el mundo 0 tiene *Secuencia*, el
 * mundo 1 tiene *Iteración* y el mundo 2 tiene *Descomposición*; cualquier otro
 * mundo devuelve una lista vacía.
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
    if (id === 'iteracion' && insigniaIteracionOtorgada(progreso)) {
      otorgadas.push(id);
    }
    if (id === 'descomposicion' && insigniaDescomposicionOtorgada(progreso)) {
      otorgadas.push(id);
    }
  }
  return otorgadas;
}
