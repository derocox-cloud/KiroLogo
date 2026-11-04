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
import { GENERADORES } from './generadores-mundo-1.js';
import { GENERADORES_M2 } from './generadores-mundo-2.js';
import type { Nivel } from '../niveles/tipos.js';
import { buscarGenerador } from '../niveles/generadores/registro.js';

// Generadores por semilla de los mundos 1 y 2: comparten el mismo contrato
// `(semilla) => ResultadoGenerador`, así que se fusionan en un único registro
// una sola vez a nivel de módulo (no por llamada) para una búsqueda plana por
// idGenerador. El registro del mundo 0, con otro contrato (reintento y
// parámetros), se consulta aparte y tiene prioridad.
const GENERADORES_POR_SEMILLA = { ...GENERADORES, ...GENERADORES_M2 };

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

/**
 * Intentos máximos del lazo de reintento de un generador. Con los rangos
 * verificados de los generadores del mundo 0, el lazo acepta en pocos intentos;
 * 200 deja un margen amplísimo y nunca se alcanza en la práctica.
 */
const INTENTOS_MAXIMOS_GENERADOR = 200;

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
  const busqueda = buscarNivel(idNivel);
  if (!busqueda.hallado) {
    return { exito: false, error: crearError('nivelDesconocido', {}) };
  }
  const nivel = busqueda.nivel;

  // El programa de referencia y la semilla efectiva salen de una de dos vías:
  //  - autorado: la referencia fija del nivel; la semilla recibida se ignora y la
  //    efectiva es la del nivel.
  //  - generado: el generador del `idGenerador` produce la referencia a partir de
  //    la semilla recibida; la efectiva es la que produjo el candidato aceptable
  //    (puede diferir de la pedida si hubo descartes).
  let referencia: Programa;
  let semillaEfectiva: number;

  if (nivel.origen.tipo === 'autorado') {
    referencia = nivel.origen.referencia;
    semillaEfectiva = nivel.origen.semilla;
  } else {
    // Niveles generados. Dos familias de registros conviven con contratos
    // distintos: el del mundo 0 (niveles/generadores/registro.ts, con reintento y
    // parámetros) y los por semilla de los mundos 1 y 2 (fusionados en
    // GENERADORES_POR_SEMILLA). Se busca primero el del mundo 0; si el id no está
    // ahí, se intenta el registro por semilla.
    const idGenerador = nivel.origen.idGenerador;
    const generador = buscarGenerador(idGenerador);
    if (generador !== null) {
      const generado = generador({
        semilla,
        parametros: nivel.origen.parametros,
        intentosMaximos: INTENTOS_MAXIMOS_GENERADOR,
      });
      if (!generado.exito) {
        // El generador agotó sus intentos: propaga su error del catálogo.
        return { exito: false, error: generado.error };
      }
      referencia = generado.referencia;
      semillaEfectiva = generado.semillaEfectiva;
    } else {
      const fn = GENERADORES_POR_SEMILLA[idGenerador];
      if (fn === undefined) {
        return { exito: false, error: crearError('generadorDesconocido', {}) };
      }
      const resultado = fn(semilla);
      referencia = resultado.programa;
      semillaEfectiva = resultado.semillaUsada;
    }
  }

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
