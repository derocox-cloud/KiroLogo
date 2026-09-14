// Reto de KiroLogo: resolución de (idNivel, semilla)
// Ejecuta el programa de referencia UNA SOLA VEZ y de ahí salen la demostración
// y los segmentos objetivo, así que nunca pueden desincronizarse.

import type { Programa } from '../lenguaje/ast.js';
import { crearError, type ErrorKiroLogo } from '../lenguaje/errores.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { ejecutar, type Operacion } from '../lenguaje/interprete.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';
import { extraerSegmentos, type Segmento } from '../motor/segmentos.js';
import { codificar } from '../azar/codigo-semilla.js';
import { buscarNivel } from '../niveles/catalogo.js';
import type { Nivel } from '../niveles/tipos.js';

// ============================================================================
// Tipos públicos
// ============================================================================

export interface Reto {
  readonly nivel: Nivel;
  readonly semillaEfectiva: number;
  readonly codigoSemilla: string;
  readonly referencia: Programa;
  readonly operaciones: readonly Operacion[];
  readonly segmentos: readonly Segmento[];
  readonly presupuestoEstrella: number;
  readonly limiteDuro: number;
  readonly limiteDuroActivo: boolean;
}

export type ResultadoReto =
  | { readonly exito: true; readonly reto: Reto }
  | { readonly exito: false; readonly error: ErrorKiroLogo };

/** Margen por omisión del límite duro cuando el nivel no declara ninguno. */
const MARGEN_LIMITE_DURO_POR_OMISION = 3;

/** El límite duro se activa desde el mundo 3. */
const PRIMER_MUNDO_CON_LIMITE_DURO = 3;

// ============================================================================
// Resolución
// ============================================================================

/**
 * Resuelve un reto a partir del identificador de nivel y una semilla. Ejecuta el
 * programa de referencia una sola vez. No mantiene estado a nivel de módulo.
 *
 * @param idNivel Identificador del nivel, como `0.1`
 * @param semilla Semilla recibida (se usa solo en niveles generados)
 * @returns El reto resuelto, o un fallo de programación
 */
export function resolverReto(idNivel: string, semilla: number): ResultadoReto {
  // En esta spec solo hay niveles autorados, que ignoran la semilla recibida y
  // usan la fija del nivel. La variante generada (spec 01) la usará como efectiva.
  void semilla;

  const busqueda = buscarNivel(idNivel);
  if (!busqueda.hallado) {
    return { exito: false, error: crearError('nivelDesconocido', {}) };
  }
  const nivel = busqueda.nivel;

  // Esta spec solo resuelve niveles autorados; los generados no tienen generador.
  if (nivel.origen.tipo !== 'autorado') {
    return { exito: false, error: crearError('referenciaNoEjecutable', {}) };
  }

  const referencia = nivel.origen.referencia;
  // Semilla efectiva: en un nivel autorado, la que declara el nivel.
  const semillaEfectiva = nivel.origen.semilla;

  // Ejecutar la referencia una sola vez, con los comandos del mundo del nivel.
  const permitidos = comandosDelMundo(nivel.mundo);
  const generador = ejecutar(referencia, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: permitidos,
    semilla: semillaEfectiva,
  });
  let paso = generador.next();
  while (!paso.done) {
    paso = generador.next();
  }
  const resultadoEjecucion = paso.value;

  // Una guarda o un error al ejecutar la referencia es un fallo de programación:
  // un nivel autorado nunca debería producirlo.
  if (resultadoEjecucion.error !== null || resultadoEjecucion.guardaActivada !== null) {
    return { exito: false, error: crearError('referenciaNoEjecutable', {}) };
  }

  const operaciones = resultadoEjecucion.operaciones;
  const segmentos = extraerSegmentos(operaciones);

  // Presupuesto: el conteo de la referencia.
  const conteo = contarInstrucciones(referencia);
  if (!conteo.exito) {
    return { exito: false, error: crearError('referenciaNoEjecutable', {}) };
  }
  const presupuestoEstrella = conteo.instrucciones;

  // Límite duro: presupuesto + margen (3 por omisión); activo desde el mundo 3.
  const margen = nivel.margenLimiteDuro ?? MARGEN_LIMITE_DURO_POR_OMISION;
  const limiteDuro = presupuestoEstrella + margen;
  const limiteDuroActivo = nivel.mundo >= PRIMER_MUNDO_CON_LIMITE_DURO;

  // Código de semilla, calculado siempre sobre la semilla efectiva.
  const codigo = codificar(semillaEfectiva);
  if (!codigo.exito) {
    return { exito: false, error: crearError('referenciaNoEjecutable', {}) };
  }

  return {
    exito: true,
    reto: {
      nivel,
      semillaEfectiva,
      codigoSemilla: codigo.codigo,
      referencia,
      operaciones,
      segmentos,
      presupuestoEstrella,
      limiteDuro,
      limiteDuroActivo,
    },
  };
}
