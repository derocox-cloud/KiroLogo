<<<<<<< HEAD
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
=======
// Insignias de KiroLogo: reglas de otorgamiento.
// Una insignia de concepto se gana al dominar un mundo entero, es decir, con
// las tres estrellas en todos sus niveles. El estado de juego se consulta a
// través de la interfaz de progreso, que es la única fuente de las estrellas
// guardadas por nivel.

import type { Mundo } from '../lenguaje/vocabulario.js';
import type { EstrellasGuardadas } from './progreso.js';
import { CATALOGO } from '../niveles/catalogo.js';

// ============================================================================
// Tipos públicos
// ============================================================================

export interface Insignia {
  readonly id: string;
  readonly nombre: string;
  readonly mundo: Mundo;
}

/**
 * Estado de juego que una insignia necesita consultar. Es un subconjunto de la
 * interfaz `Progreso`: solo las estrellas por nivel. Pedir lo mínimo mantiene la
 * evaluación probable con un objeto simulado y desacoplada de la persistencia.
 */
export interface EstadoInsignias {
  estrellasDe(idNivel: string): EstrellasGuardadas | null;
}

// ============================================================================
// Catálogo de insignias de concepto
// ============================================================================

/**
 * Las insignias de concepto, una por mundo. En esta spec existe la del mundo 1.
 * Agregar una insignia es agregar una entrada aquí: la condición de otorgamiento
 * (tres estrellas en todos los niveles del mundo) es la misma para todas.
 */
export const INSIGNIAS: readonly Insignia[] = [
  { id: 'iteracion', nombre: 'Iteración', mundo: 1 },
];

// ============================================================================
// Evaluación
// ============================================================================

/** ¿Un nivel tiene las tres estrellas en el estado dado? */
function tieneTresEstrellas(estado: EstadoInsignias, idNivel: string): boolean {
  const estrellas = estado.estrellasDe(idNivel);
  if (estrellas === null) return false;
  return estrellas.precision && estrellas.economia && estrellas.abstraccion;
}

/**
 * Evalúa si una insignia está otorgada en el estado de juego dado.
 *
 * La condición es: las tres estrellas en todos los niveles del mundo de la
 * insignia. Los niveles se derivan del catálogo (no se repiten aquí) para que la
 * insignia siga siendo correcta cuando el mundo gane o pierda niveles.
 *
 * @param id Identificador de la insignia, como `iteracion`
 * @param estado Estado de juego que resuelve las estrellas por nivel
 * @returns `true` si la insignia se gana con ese estado, `false` en otro caso
 *          (incluido un `id` desconocido)
 */
export function evaluarInsignia(id: string, estado: EstadoInsignias): boolean {
  const insignia = INSIGNIAS.find((candidata) => candidata.id === id);
  if (insignia === undefined) return false;

  const nivelesDelMundo = CATALOGO.filter((nivel) => nivel.mundo === insignia.mundo);
  // Un mundo sin niveles no otorga insignia: no hay nada que dominar.
  if (nivelesDelMundo.length === 0) return false;

  return nivelesDelMundo.every((nivel) => tieneTresEstrellas(estado, nivel.id));
>>>>>>> 5e8e690 (spec-02-mundo-1: figuras geometricas, REPITE, reproduccion en paralelo e insignia Iteracion)
}
