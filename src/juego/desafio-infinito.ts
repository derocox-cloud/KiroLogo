// Desafío infinito de KiroLogo (requisito 7).
//
// Secuencia determinista e ilimitada de retos generados de un mundo, derivada de
// una semilla raíz con el PRNG del proyecto, que rota entre los niveles generados
// del mundo y no retrocede. Es retroactivo: cualquier mundo con niveles generados
// (0, 1, 2 y 3 hoy) tiene desafío; los que no tienen generados (4 y 5) no.
//
// Módulo **puro y sin estado propio persistido**: no guarda la secuencia, la
// recalcula de (mundo, raíz, índice). Así dos corridas con la misma raíz producen
// exactamente la misma secuencia (R7.4) y basta guardar la terna para reanudar.
// Puede importar de `niveles/` (catálogo), `azar/` (PRNG) y `juego/` (progreso),
// nunca de `motor/` ni `ui/`. Todo el azar pasa por `crearPrng`, nunca
// `Math.random` (R7.3).

import { crearPrng, SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../azar/prng.js';
import { CATALOGO } from '../niveles/catalogo.js';
import type { Progreso } from './progreso.js';
import type { Mundo } from '../lenguaje/vocabulario.js';

// ============================================================================
// Niveles generados de un mundo
// ============================================================================

/**
 * Los niveles **generados** de un mundo, por su id, en el orden en que el catálogo
 * los declara (R7.6). Un mundo sin niveles generados devuelve la lista vacía, lo
 * que determina por datos —sin casos especiales— que no tiene desafío (R7.8).
 *
 * @param mundo Número de mundo (0 a 5)
 */
export function nivelesGeneradosDelMundo(mundo: Mundo): readonly string[] {
  return CATALOGO.filter((n) => n.mundo === mundo && n.origen.tipo === 'generado').map((n) => n.id);
}

// ============================================================================
// Disponibilidad
// ============================================================================

/**
 * ¿Están aprobados (estrella de precisión) todos los niveles del mundo? Un mundo
 * sin niveles declarados no cuenta como completo.
 */
function mundoCompleto(mundo: Mundo, progreso: Progreso): boolean {
  const niveles = CATALOGO.filter((n) => n.mundo === mundo);
  if (niveles.length === 0) return false;
  return niveles.every((n) => progreso.estrellasDe(n.id)?.precision === true);
}

/**
 * ¿Está disponible el desafío infinito del mundo? Lo está solo si el mundo tiene
 * al menos un nivel generado (R7.8) y está **completo**: todos sus niveles con la
 * estrella de precisión (R7.1, R7.2). Mientras el mundo no esté completo, no se
 * puede iniciar (R7.2). Es retroactivo a los mundos 0, 1 y 2 (R7.7).
 *
 * Se comprueba «mundo completo» de forma directa en lugar de apoyarse en
 * `mundoDesbloqueado(mundo + 1)` («si el siguiente está abierto, el actual está
 * completo»): aunque ese atajo da el resultado correcto incluso para el mundo 5
 * —`mundoDesbloqueado(6)` pide todos los niveles del mundo 5 aprobados—, obliga a
 * razonar sobre un mundo 6 inexistente y a un `mundo + 1` que no es un `Mundo`
 * válido. La comprobación directa es más explícita y no depende de esa indirección.
 *
 * @param mundo Número de mundo (0 a 5)
 * @param progreso Progreso del jugador
 */
export function desafioDisponible(mundo: Mundo, progreso: Progreso): boolean {
  if (nivelesGeneradosDelMundo(mundo).length === 0) return false; // R7.8
  return mundoCompleto(mundo, progreso); // R7.1, R7.2
}

// ============================================================================
// El reto en un índice de la secuencia
// ============================================================================

export interface RetoDesafio {
  readonly idNivel: string;
  readonly semilla: number;
}

/**
 * El reto en el índice `indice` (≥ 0) de la secuencia del mundo, derivado de la
 * raíz. Rota entre los niveles generados del mundo en el orden del catálogo
 * (R7.6) y deriva la semilla con el PRNG del proyecto (R7.3). Determinista: misma
 * (mundo, raíz, índice) ⇒ mismo reto (R7.4).
 *
 * La API **solo avanza**: el llamador pasa `indice + 1` para el siguiente reto y
 * no existe ninguna forma de pedir un reto anterior de la secuencia (R7.5).
 *
 * El llamador debe comprobar `desafioDisponible` antes: un mundo sin niveles
 * generados no tiene una secuencia válida y pedir su reto es un error de
 * programación del catálogo, no una situación que este módulo deba inventar un
 * idNivel para tapar.
 *
 * @param mundo Número de mundo con niveles generados
 * @param raiz Semilla raíz de la corrida, en el dominio del PRNG
 * @param indice Posición en la secuencia (0, 1, 2, …)
 */
export function retoDesafio(mundo: Mundo, raiz: number, indice: number): RetoDesafio {
  const generados = nivelesGeneradosDelMundo(mundo);
  if (generados.length === 0) {
    // El mundo no tiene desafío. El llamador debió filtrar con desafioDisponible.
    throw new Error(`desafio-infinito: el mundo ${mundo} no tiene niveles generados`);
  }
  const idNivel = generados[indice % generados.length]!;
  const semilla = derivarSemilla(raiz, indice);
  return { idNivel, semilla };
}

/**
 * Semilla determinista del paso `indice` a partir de la raíz, en el dominio
 * `[SEMILLA_MINIMA, SEMILLA_MAXIMA]`. Avanza el PRNG `indice + 1` pasos, de modo
 * que cada índice separa su propio valor y la misma (raíz, índice) produce siempre
 * la misma semilla (R7.4). Nunca usa `Math.random` (R7.3).
 *
 * Se exporta para poder verificar el determinismo de forma aislada.
 *
 * @param raiz Semilla raíz, en el dominio del PRNG (si no, `crearPrng` lanza)
 * @param indice Posición en la secuencia (≥ 0)
 */
export function derivarSemilla(raiz: number, indice: number): number {
  const prng = crearPrng(raiz);
  let valor = 0;
  for (let paso = 0; paso <= indice; paso++) valor = prng.siguiente();
  return Math.floor(valor * (SEMILLA_MAXIMA - SEMILLA_MINIMA + 1)) + SEMILLA_MINIMA;
}
