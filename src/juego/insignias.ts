// Insignias de KiroLogo.
//
// Las insignias de concepto se otorgan al dominar un mundo entero: las tres
// estrellas en todos sus niveles. Aquí se reconocen cinco: *Secuencia* (mundo 0),
// *Iteración* (mundo 1), *Descomposición* (mundo 2), *Simetría* (mundo 3) y *Generalización* (mundo 4). El
// otorgamiento se deriva
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

/**
 * Las insignias de esta spec: cuatro por concepto (una por mundo) y cuatro
 * transversales, que premian formas de jugar en lugar de completar un mundo.
 */
export type IdInsigniaDeConcepto = 'secuencia' | 'iteracion' | 'descomposicion' | 'simetria' | 'generalizacion';
export type IdInsigniaTransversal = 'depurador' | 'minimalista' | 'sinPistas' | 'buenOjo';
export type IdInsignia = IdInsigniaDeConcepto | IdInsigniaTransversal;

/**
 * El mundo al que pertenece cada insignia **por concepto**. Las transversales
 * NO tienen mundo: se derivan de señales del progreso, y por eso su identificador
 * no es clave de este registro y consultarlo no compila (R14.2, R14.3).
 */
export const MUNDO_DE_INSIGNIA: Readonly<Record<IdInsigniaDeConcepto, number>> = {
  secuencia: 0,
  iteracion: 1,
  descomposicion: 2,
  simetria: 3,
  generalizacion: 4,
};

/** Recorrido tipado de las insignias de concepto, sin aserciones de tipo (R14.4). */
export const INSIGNIAS_DE_CONCEPTO: readonly IdInsigniaDeConcepto[] = [
  'secuencia',
  'iteracion',
  'descomposicion',
  'simetria',
  'generalizacion',
];

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

/**
 * ¿Se otorga la insignia *Simetría*? Verdadero solo si los cuatro niveles del
 * mundo 3 tienen las tres estrellas cada uno. Falta una sola estrella en
 * cualquiera y no se otorga. Reconoce el dominio de la iteración anidada.
 *
 * @param progreso Progreso del jugador
 */
export function insigniaSimetriaOtorgada(progreso: Progreso): boolean {
  return mundoCompletoConTresEstrellas(3, progreso);
}

/**
 * ¿Se otorga la insignia *Generalización*? Verdadero solo si los cuatro niveles
 * del mundo 4 tienen las tres estrellas cada uno. Reconoce el dominio de los
 * procedimientos con parámetros. El nombre visible sale de `MUNDOS[4]`.
 *
 * @param progreso Progreso del jugador
 */
export function insigniaGeneralizacionOtorgada(progreso: Progreso): boolean {
  return mundoCompletoConTresEstrellas(4, progreso);
}

// ============================================================================
// Insignias transversales
// ============================================================================
// Premian la forma de jugar, no completar un mundo. Cada una es un predicado
// puro del progreso guardado: al no tener estado propio, se mantiene otorgada
// exactamente una vez (R9.5) y su verificación es reproducible por pruebas
// (R9.6). *Minimalista* se deriva de las estrellas que el progreso ya guardaba;
// las otras tres leen las señales anónimas que la spec 04 añadió al progreso.

/** Niveles con estrella de economía que exige *Minimalista*. */
const NIVELES_ECONOMIA_MINIMALISTA = 10;

/** Aprobaciones posteriores a la reproducción en paralelo que exige *Depurador*. */
const APROBACIONES_DEPURADOR = 5;

/**
 * ¿Se otorga *Minimalista*? Verdadero cuando el jugador ganó la estrella de
 * economía en al menos diez niveles. Se cuenta sobre el catálogo, usando las
 * estrellas ya guardadas; no necesita ninguna señal nueva (R9.2).
 *
 * @param progreso Progreso del jugador
 */
export function insigniaMinimalistaOtorgada(progreso: Progreso): boolean {
  const conEconomia = CATALOGO.filter((n) => progreso.estrellasDe(n.id)?.economia === true).length;
  return conEconomia >= NIVELES_ECONOMIA_MINIMALISTA;
}

/**
 * ¿Se otorga *Depurador*? Verdadero cuando el jugador aprobó al menos cinco
 * niveles *después* de haber usado la reproducción en paralelo. "Después" se
 * mide con la bandera anónima del progreso: cuenta los niveles cuya aprobación
 * con precisión ocurrió mientras la reproducción ya estaba marcada como usada
 * (R9.1).
 *
 * @param progreso Progreso del jugador
 */
export function insigniaDepuradorOtorgada(progreso: Progreso): boolean {
  const posteriores = CATALOGO.filter((n) => progreso.aprobadoTrasReproduccionParalelaEn(n.id)).length;
  return posteriores >= APROBACIONES_DEPURADOR;
}

/**
 * ¿Se otorga *Sin pistas*? Verdadero cuando existe al menos un mundo completado
 * entero (todos sus niveles aprobados con precisión) en el que no se abrió
 * ninguna pista en ninguno de sus niveles (R9.3).
 *
 * @param progreso Progreso del jugador
 */
export function insigniaSinPistasOtorgada(progreso: Progreso): boolean {
  const mundos = new Set(CATALOGO.map((n) => n.mundo));
  for (const mundo of mundos) {
    const niveles = nivelesDelMundo(mundo);
    if (niveles.length === 0) continue;
    const completoSinPistas = niveles.every(
      (n) => progreso.estrellasDe(n.id)?.precision === true && !progreso.pistaAbiertaEn(n.id),
    );
    if (completoSinPistas) return true;
  }
  return false;
}

/**
 * ¿Se otorga *Buen ojo*? Verdadero cuando existe al menos un nivel resuelto con
 * precisión cuya demostración se vio exactamente una vez (R9.4).
 *
 * @param progreso Progreso del jugador
 */
export function insigniaBuenOjoOtorgada(progreso: Progreso): boolean {
  return CATALOGO.some(
    (n) => progreso.estrellasDe(n.id)?.precision === true && progreso.vistasDemostracionDe(n.id) === 1,
  );
}

// ============================================================================
// Insignias por mundo
// ============================================================================

/** Los predicados de las insignias de concepto, indexados por su identificador. */
const OTORGADA_DE_CONCEPTO: Readonly<Record<IdInsigniaDeConcepto, (progreso: Progreso) => boolean>> = {
  secuencia: insigniaSecuenciaOtorgada,
  iteracion: insigniaIteracionOtorgada,
  descomposicion: insigniaDescomposicionOtorgada,
  simetria: insigniaSimetriaOtorgada,
  generalizacion: insigniaGeneralizacionOtorgada,
};

/**
 * Las insignias otorgadas de un mundo. Hoy el mundo 0 tiene *Secuencia*, el
 * mundo 1 tiene *Iteración*, el mundo 2 tiene *Descomposición* y el mundo 3
 * tiene *Simetría* y el mundo 4 tiene *Generalización*; cualquier otro mundo devuelve una lista vacía.
 *
 * @param mundo Número de mundo (0 a 5)
 * @param progreso Progreso del jugador
 * @returns Los identificadores de las insignias otorgadas de ese mundo
 */
export function insigniasDelMundo(mundo: number, progreso: Progreso): readonly IdInsignia[] {
  const otorgadas: IdInsignia[] = [];
  for (const id of INSIGNIAS_DE_CONCEPTO) {
    if (MUNDO_DE_INSIGNIA[id] === mundo && OTORGADA_DE_CONCEPTO[id](progreso)) otorgadas.push(id);
  }
  return otorgadas;
}

/**
 * Las insignias transversales otorgadas hoy. Es una función pura del progreso
 * (sin estado propio), de modo que las pruebas de punta a punta recargan el
 * progreso del almacén y le preguntan aquí si una insignia quedó otorgada
 * (R9.5, R9.6, R11.10).
 *
 * @param progreso Progreso del jugador
 */
export function insigniasTransversalesOtorgadas(progreso: Progreso): readonly IdInsigniaTransversal[] {
  const otorgadas: IdInsigniaTransversal[] = [];
  if (insigniaDepuradorOtorgada(progreso)) otorgadas.push('depurador');
  if (insigniaMinimalistaOtorgada(progreso)) otorgadas.push('minimalista');
  if (insigniaSinPistasOtorgada(progreso)) otorgadas.push('sinPistas');
  if (insigniaBuenOjoOtorgada(progreso)) otorgadas.push('buenOjo');
  return otorgadas;
}
