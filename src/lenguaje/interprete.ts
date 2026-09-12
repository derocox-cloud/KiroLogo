// Intérprete de KiroLogo: AST → generador de operaciones, y las tres guardas.
// Único flujo de ejecución del proyecto. Emite una Operacion por instrucción y
// suspende hasta que el consumidor pide la siguiente. Es el único módulo que
// invoca las transformaciones de la tortuga.

import type { Programa, Instruccion } from './ast.js';
import { buscarComando, type EntradaVocabulario } from './vocabulario.js';
import { crearError, type ErrorKiroLogo } from './errores.js';
import {
  ESTADO_INICIAL,
  desplazar,
  girar,
  alCentro,
  type EstadoTortuga,
  type Punto,
} from '../motor/tortuga.js';

// ============================================================================
// Operaciones
// ============================================================================

export type SentidoGiro = 'derecha' | 'izquierda';

export interface OperacionBase {
  readonly paso: number;             // desde 0, consecutivo dentro de la ejecución
  readonly linea: number;            // desde 1, la del nodo que la produjo
  readonly profundidad: number;      // 0 a 100, 0 en el cuerpo principal
  readonly estadoAntes: EstadoTortuga;
  readonly estadoDespues: EstadoTortuga;
}

/** Desplazamiento. Lleva los puntos y el lápiz vigente durante el movimiento. */
export interface OperacionMover extends OperacionBase {
  readonly tipo: 'mover';
  readonly desde: Punto;
  readonly hasta: Punto;
  readonly lapizAbajo: boolean;
}

/** Giro. Lleva los grados y el sentido. */
export interface OperacionGirar extends OperacionBase {
  readonly tipo: 'girar';
  readonly grados: number;
  readonly sentido: SentidoGiro;
}

/** Cambio de lápiz. Declarado; ninguna ejecución del mundo 0 lo emite. */
export interface OperacionLapiz extends OperacionBase {
  readonly tipo: 'lapiz';
  readonly lapizAbajo: boolean;
}

/** Cambio de visibilidad. Declarado; ninguna ejecución del mundo 0 lo emite. */
export interface OperacionVisibilidad extends OperacionBase {
  readonly tipo: 'visibilidad';
  readonly visible: boolean;
}

/** Limpieza de pantalla: descarta los segmentos acumulados y va al centro. */
export interface OperacionLimpiar extends OperacionBase {
  readonly tipo: 'limpiar';
}

/** Reubicación al centro sin borrar la estela. */
export interface OperacionReubicar extends OperacionBase {
  readonly tipo: 'reubicar';
}

export type Operacion =
  | OperacionMover
  | OperacionGirar
  | OperacionLapiz
  | OperacionVisibilidad
  | OperacionLimpiar
  | OperacionReubicar;

// ============================================================================
// Guardas y límites
// ============================================================================

export type TipoGuarda = 'pasos' | 'recursion' | 'tiempo';

export interface LimitesEjecucion {
  readonly maximoPasos: number;
  readonly maximaProfundidad: number;
  readonly maximoTiempoMs: number;
  readonly pasosEntreMediciones: number;
}

/** Límites por omisión: 200 000 pasos, 100 niveles, 5 000 ms, 1 000 pasos entre mediciones. */
export const LIMITES_PREDETERMINADOS: LimitesEjecucion = {
  maximoPasos: 200_000,
  maximaProfundidad: 100,
  maximoTiempoMs: 5_000,
  pasosEntreMediciones: 1_000,
};

export interface OpcionesEjecucion {
  readonly estadoInicial?: EstadoTortuga;
  readonly comandosPermitidos: readonly EntradaVocabulario[];
  readonly semilla: number;
  readonly ahora?: () => number;
  readonly limites?: LimitesEjecucion;
}

export interface ResultadoEjecucion {
  readonly operaciones: readonly Operacion[];
  readonly guardaActivada: TipoGuarda | null;
  readonly error: ErrorKiroLogo | null;
}

// ============================================================================
// Marcos de ejecución
// ============================================================================

interface Marco {
  readonly instrucciones: readonly Instruccion[];
  indice: number;
  readonly nombre: string | null;        // nombre del procedimiento (null en el marco raíz)
  readonly lineaInvocacion: number | null;
}

// ============================================================================
// Función principal
// ============================================================================

/**
 * Ejecuta un programa como generador de operaciones. Emite una `Operacion` por
 * instrucción y suspende hasta que el consumidor pide la siguiente. Devuelve el
 * resultado completo (operaciones, guarda activada y error) al terminar.
 *
 * @param programa Programa a ejecutar
 * @param opciones Estado inicial, comandos permitidos, semilla, fuente de tiempo y límites
 * @yields cada `Operacion` en orden de ejecución
 * @returns el `ResultadoEjecucion` con las operaciones, la guarda y el error
 */
export function* ejecutar(
  programa: Programa,
  opciones: OpcionesEjecucion,
): Generator<Operacion, ResultadoEjecucion, void> {
  const limites = opciones.limites ?? LIMITES_PREDETERMINADOS;
  const ahora = opciones.ahora ?? (() => 0);
  const permitidos = new Set(opciones.comandosPermitidos.map((e) => e.nombre));

  // El PRNG se crea al inicio de cada ejecución; no se usa en el mundo 0, pero
  // deja el punto de siembra listo para specs futuras (AZAR).
  // (No se instancia aún para no arrastrar dependencia innecesaria en esta spec.)

  // Estado que se pone en cero al comenzar cada ejecución, sin arrastrar nada.
  let paso = 0;
  let estado: EstadoTortuga = opciones.estadoInicial ?? ESTADO_INICIAL;
  const inicioTiempo = ahora();

  const operaciones: Operacion[] = [];

  // Pila explícita de marcos: profundidad = pila.length - 1 (marco raíz = 0).
  const pila: Marco[] = [
    { instrucciones: programa.instrucciones, indice: 0, nombre: null, lineaInvocacion: null },
  ];

  // ---- Ayudas internas ----------------------------------------------------

  function profundidadActual(): number {
    return pila.length - 1;
  }

  /** Comprueba las tres guardas en orden fijo y devuelve la primera que aplica. */
  function comprobarGuardas(entrandoAMarco: { nombre: string | null; linea: number | null } | null): TipoGuarda | null {
    // 1) Pasos: la operación que va a emitirse sería la número (paso + 1);
    //    se rechaza si superaría el máximo.
    if (entrandoAMarco === null && paso >= limites.maximoPasos) {
      return 'pasos';
    }
    // 2) Recursión: al entrar a un marco nuevo, la nueva profundidad no puede
    //    superar el máximo. profundidadActual() es la del marco donde estamos;
    //    el nuevo nivel sería profundidadActual() + 1.
    if (entrandoAMarco !== null && profundidadActual() + 1 > limites.maximaProfundidad) {
      return 'recursion';
    }
    // 3) Tiempo: más de maximoTiempoMs desde el inicio (estrictamente mayor).
    if (ahora() - inicioTiempo > limites.maximoTiempoMs) {
      return 'tiempo';
    }
    return null;
  }

  function errorDeGuarda(guarda: TipoGuarda, entrandoAMarco: { nombre: string | null; linea: number | null } | null): ErrorKiroLogo {
    switch (guarda) {
      case 'pasos':
        return crearError('guardaPasos', {});
      case 'recursion': {
        if (entrandoAMarco && entrandoAMarco.nombre) {
          return crearError('guardaRecursion', { nombre: entrandoAMarco.nombre });
        }
        const linea = entrandoAMarco?.linea ?? 0;
        return crearError('guardaRecursion', { linea });
      }
      case 'tiempo':
        return crearError('guardaTiempo', {});
    }
  }

  function terminar(guarda: TipoGuarda, error: ErrorKiroLogo): ResultadoEjecucion {
    return { operaciones, guardaActivada: guarda, error };
  }

  // ---- Bucle principal ----------------------------------------------------

  // Contador de operaciones desde la última medición de tiempo.
  let desdeUltimaMedicion = 0;

  while (pila.length > 0) {
    const marco = pila[pila.length - 1]!;

    // Marco agotado: se desapila (retorno del procedimiento).
    if (marco.indice >= marco.instrucciones.length) {
      pila.pop();
      continue;
    }

    const instruccion = marco.instrucciones[marco.indice]!;
    marco.indice += 1;

    // --- Nodos de procedimiento (decisión D6: sin parámetros ni retorno) ---
    if (instruccion.tipo === 'definicionProcedimiento') {
      // Una definición no ejecuta su cuerpo aquí; se registra implícitamente.
      // En el mundo 0 el parser no produce estos nodos, pero el intérprete los
      // acepta para las specs 03+ (ejecución sin parámetros).
      continue;
    }

    if (instruccion.tipo === 'invocacionProcedimiento') {
      // Entrar a un marco nuevo: comprobar la guarda de recursión (y tiempo).
      const entrada = { nombre: instruccion.nombre, linea: instruccion.linea };
      const guarda = comprobarGuardas(entrada);
      if (guarda !== null) {
        return terminar(guarda, errorDeGuarda(guarda, entrada));
      }
      // Buscar la definición del procedimiento en el programa raíz.
      const definicion = buscarDefinicion(programa, instruccion.nombre);
      if (definicion === null) {
        const error = crearError('comandoNoPermitido', { nombre: instruccion.nombre }, { linea: instruccion.linea });
        return { operaciones, guardaActivada: null, error };
      }
      pila.push({ instrucciones: definicion.cuerpo, indice: 0, nombre: instruccion.nombre, lineaInvocacion: instruccion.linea });
      continue;
    }

    // --- Nodos reservados que esta spec no ejecuta ---
    if (instruccion.tipo !== 'invocacionComando') {
      const error = crearError('nodoNoImplementado', {}, { linea: instruccion.linea });
      return { operaciones, guardaActivada: null, error };
    }

    // --- Invocación de comando ---
    // Resolver el comando a su entrada de vocabulario (acepta nombre largo o
    // abreviatura) y comprobar que su nombre canónico esté permitido.
    const busqueda = buscarComando(instruccion.nombre);
    const nombreCanonico = busqueda.hallada ? busqueda.entrada.nombre : instruccion.nombre;
    if (!permitidos.has(nombreCanonico)) {
      const error = crearError('comandoNoPermitido', { nombre: nombreCanonico }, { linea: instruccion.linea });
      return { operaciones, guardaActivada: null, error };
    }

    // Guarda de pasos y de tiempo antes de emitir la operación.
    const guardaPasos = comprobarGuardas(null);
    if (guardaPasos !== null) {
      return terminar(guardaPasos, errorDeGuarda(guardaPasos, null));
    }

    // Producir la operación según la semántica del comando (por nombre canónico).
    const operacion = ejecutarComando(nombreCanonico, argumento(instruccion), estado, paso, instruccion.linea, profundidadActual());
    if (operacion === null) {
      // Comando permitido pero no ejecutable en esta spec (no debería ocurrir en mundo 0).
      const error = crearError('comandoNoPermitido', { nombre: instruccion.nombre }, { linea: instruccion.linea });
      return { operaciones, guardaActivada: null, error };
    }

    operaciones.push(operacion);
    estado = operacion.estadoDespues;
    paso += 1;

    // Medición de tiempo periódica.
    desdeUltimaMedicion += 1;
    if (desdeUltimaMedicion >= limites.pasosEntreMediciones) {
      desdeUltimaMedicion = 0;
      if (ahora() - inicioTiempo > limites.maximoTiempoMs) {
        return terminar('tiempo', errorDeGuarda('tiempo', null));
      }
    }

    yield operacion;
  }

  return { operaciones, guardaActivada: null, error: null };
}

// ============================================================================
// Semántica de los comandos del mundo 0
// ============================================================================

/** Extrae el argumento numérico literal de una invocación, o null si no tiene. */
function argumento(instruccion: Instruccion & { tipo: 'invocacionComando' }): number | null {
  const primero = instruccion.argumentos[0];
  if (primero && primero.tipo === 'numeroLiteral') {
    return primero.valor;
  }
  return null;
}

/**
 * Ejecuta un comando del mundo 0 y produce su operación. Devuelve null si el
 * comando no pertenece al mundo 0 (no ejecutable en esta spec).
 */
function ejecutarComando(
  nombre: string,
  arg: number | null,
  estadoAntes: EstadoTortuga,
  paso: number,
  linea: number,
  profundidad: number,
): Operacion | null {
  const base = { paso, linea, profundidad, estadoAntes };

  switch (nombre) {
    case 'AVANZA':
    case 'RETROCEDE': {
      const distancia = arg ?? 0;
      const sentido = nombre === 'AVANZA' ? 'adelante' : 'atras';
      const r = desplazar(estadoAntes, distancia, sentido);
      const estadoDespues = r.valido ? r.estado : estadoAntes;
      return {
        ...base,
        tipo: 'mover',
        desde: { x: estadoAntes.posicion.x, y: estadoAntes.posicion.y },
        hasta: { x: estadoDespues.posicion.x, y: estadoDespues.posicion.y },
        lapizAbajo: estadoAntes.lapizAbajo,
        estadoDespues,
      };
    }
    case 'GIRADERECHA':
    case 'GIRAIZQUIERDA': {
      const grados = arg ?? 0;
      const sentido: SentidoGiro = nombre === 'GIRADERECHA' ? 'derecha' : 'izquierda';
      const r = girar(estadoAntes, grados, sentido);
      const estadoDespues = r.valido ? r.estado : estadoAntes;
      return { ...base, tipo: 'girar', grados, sentido, estadoDespues };
    }
    case 'CENTRO': {
      const estadoDespues = alCentro(estadoAntes);
      return { ...base, tipo: 'reubicar', estadoDespues };
    }
    case 'BORRAPANTALLA': {
      // Va al centro con rumbo 0, conservando lápiz y visibilidad; descarta la
      // estela (lo aplica el extractor de segmentos al ver la operación limpiar).
      const estadoDespues = alCentro(estadoAntes);
      return { ...base, tipo: 'limpiar', estadoDespues };
    }
    default:
      return null;
  }
}

// ============================================================================
// Búsqueda de definiciones de procedimiento
// ============================================================================

/** Busca una definición de procedimiento por nombre en el programa raíz. */
function buscarDefinicion(
  programa: Programa,
  nombre: string,
): (Instruccion & { tipo: 'definicionProcedimiento' }) | null {
  for (const inst of programa.instrucciones) {
    if (inst.tipo === 'definicionProcedimiento' && inst.nombre === nombre) {
      return inst;
    }
  }
  return null;
}
