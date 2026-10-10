// Desbloqueo de niveles y de mundos de KiroLogo.
//
// Puro y derivado **solo** del progreso y del catálogo: no persiste nada propio,
// de modo que el estado de disponibilidad es reproducible a partir de las
// estrellas guardadas (requisito 7.6). Un nivel está «aprobado» cuando tiene su
// estrella de precisión guardada; esa es la moneda del desbloqueo.

import { CATALOGO, buscarNivel } from '../niveles/catalogo.js';
import type { Nivel } from '../niveles/tipos.js';
import type { Mundo } from '../lenguaje/vocabulario.js';
import type { Progreso } from './progreso.js';

// ============================================================================
// Estado de un nivel
// ============================================================================

export type EstadoNivel = 'bloqueado' | 'desbloqueado' | 'aprobado' | 'tresEstrellas';

// ============================================================================
// Helpers sobre el catálogo
// ============================================================================

/** Los niveles de un mundo, en el orden en que el catálogo los declara. */
function nivelesDelMundo(mundo: Mundo): readonly Nivel[] {
  return CATALOGO.filter((n) => n.mundo === mundo);
}

/** ¿El nivel tiene su estrella de precisión guardada? (está «aprobado») */
function aprobado(idNivel: string, progreso: Progreso): boolean {
  return progreso.estrellasDe(idNivel)?.precision === true;
}

/** ¿El nivel tiene las tres estrellas guardadas? */
function tresEstrellas(idNivel: string, progreso: Progreso): boolean {
  const e = progreso.estrellasDe(idNivel);
  return e !== null && e.precision && e.economia && e.abstraccion;
}

// ============================================================================
// Desbloqueo de mundos
// ============================================================================

/**
 * ¿Está desbloqueado un mundo? El mundo 0, al ser el primero, siempre. Un mundo
 * posterior se abre cuando **todos** los niveles del mundo anterior están
 * aprobados (estrella de precisión).
 *
 * @param mundo Número de mundo (0 a 5)
 * @param progreso Progreso del jugador
 */
export function mundoDesbloqueado(mundo: number, progreso: Progreso): boolean {
  if (mundo <= 0) return true; // el primer mundo siempre está abierto
  const anterior = nivelesDelMundo((mundo - 1) as Mundo);
  // Un mundo anterior sin niveles declarados no puede abrir el siguiente.
  if (anterior.length === 0) return false;
  return anterior.every((n) => aprobado(n.id, progreso));
}

// ============================================================================
// Desbloqueo de niveles
// ============================================================================

/**
 * ¿Está desbloqueado un nivel? Lo está si su mundo lo está y, dentro del mundo,
 * es el primero o el nivel inmediatamente anterior en el orden del mundo está
 * aprobado. El primer nivel del mundo 0 (`0.1`) siempre está desbloqueado.
 *
 * @param idNivel Identificador del nivel, como `0.3`
 * @param progreso Progreso del jugador
 */
export function nivelDesbloqueado(idNivel: string, progreso: Progreso): boolean {
  const busqueda = buscarNivel(idNivel);
  if (!busqueda.hallado) return false;
  const nivel = busqueda.nivel;

  // El mundo del nivel debe estar abierto.
  if (!mundoDesbloqueado(nivel.mundo, progreso)) return false;

  const niveles = nivelesDelMundo(nivel.mundo);
  const indice = niveles.findIndex((n) => n.id === idNivel);
  // El primer nivel del mundo está abierto en cuanto el mundo lo está.
  if (indice <= 0) return true;
  // Los siguientes, cuando el anterior en el orden del mundo está aprobado.
  const anterior = niveles[indice - 1]!;
  return aprobado(anterior.id, progreso);
}

// ============================================================================
// Estado de un nivel
// ============================================================================

/**
 * Clasifica un nivel en uno de cuatro estados, derivado del progreso:
 *   - `bloqueado`     — todavía no se puede entrar.
 *   - `desbloqueado`  — se puede entrar, pero aún no está aprobado.
 *   - `aprobado`      — tiene la estrella de precisión, le faltan otras.
 *   - `tresEstrellas` — tiene las tres estrellas.
 *
 * Un identificador desconocido se trata como `bloqueado`.
 *
 * @param idNivel Identificador del nivel
 * @param progreso Progreso del jugador
 */
export function estadoDeNivel(idNivel: string, progreso: Progreso): EstadoNivel {
  if (!buscarNivel(idNivel).hallado) return 'bloqueado';
  if (!nivelDesbloqueado(idNivel, progreso)) return 'bloqueado';
  if (tresEstrellas(idNivel, progreso)) return 'tresEstrellas';
  if (aprobado(idNivel, progreso)) return 'aprobado';
  return 'desbloqueado';
}
