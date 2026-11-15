// Intérprete de KiroLogo: AST → generador de operaciones, y las tres guardas.
// Único flujo de ejecución del proyecto. Emite una Operacion por instrucción y
// suspende hasta que el consumidor pide la siguiente. Es el único módulo que
// invoca las transformaciones de la tortuga.

import type { Programa, Instruccion } from './ast.js';
import { buscarComando, type EntradaVocabulario } from './vocabulario.js';
import { crearError, type ErrorKiroLogo } from './errores.js';
import { evaluar, cantidadDeRepeticiones, formatearNumero, type ContextoEvaluacion } from './evaluador.js';
import {
  resolverColorPorNombre,
  resolverColorRGB,
  type Color,
} from './colores.js';
import {
  ESTADO_INICIAL,
  desplazar,
  girar,
  alCentro,
  conLapiz,
  conVisibilidad,
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
  /** Línea de la llamada a procedimiento más interna en curso; sin definir en el cuerpo principal. */
  readonly lineaLlamada?: number;
}

/** Campos comunes de una operación salvo `estadoDespues`, que cada caso fija. */
type BaseSinDespues = Omit<OperacionBase, 'estadoDespues'>;

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

// --- Canal decorativo (mundo 2) ------------------------------------------
// Estas tres operaciones viajan al renderizador para que el dibujo se vea con
// el color, el grosor y el relleno que pidió el jugador, pero NUNCA se vuelven
// un segmento: `extraerSegmentos` solo mira `mover` con el lápiz abajo, así que
// el validador —que compara máscaras de segmentos— no las ve. Esa es la
// frontera que hace que la decoración no pueda aprobar ni reprobar un nivel
// (R4.8). Mantener esa invariante es la razón de que no muevan la tortuga.

/** Cambio de color del trazo. Decorativa: no produce segmento, no la lee el validador. */
export interface OperacionColor extends OperacionBase {
  readonly tipo: 'color';
  readonly color: Color;             // nombre resuelto o terna RGB
}

/** Cambio de grosor del trazo. Decorativa. */
export interface OperacionGrosor extends OperacionBase {
  readonly tipo: 'grosor';
  readonly grosor: number;           // entero 1..50
}

/** Relleno del área cerrada donde está la tortuga. Decorativa. */
export interface OperacionRelleno extends OperacionBase {
  readonly tipo: 'relleno';
  readonly color: Color;
}

/** Texto para la consola. No mueve la tortuga ni produce segmentos. */
export interface OperacionEscribir extends OperacionBase {
  readonly tipo: 'escribir';
  readonly texto: string;            // número formateado, o la palabra sin comilla
}

/** Rótulo en el lienzo en la posición de la tortuga, que no se mueve. */
export interface OperacionRotular extends OperacionBase {
  readonly tipo: 'rotular';
  readonly texto: string;
  readonly posicion: Punto;
  readonly color: Color | null;      // el de PONCOLOR; null = el del tema
}

export type Operacion =
  | OperacionEscribir
  | OperacionRotular
  | OperacionMover
  | OperacionGirar
  | OperacionLapiz
  | OperacionVisibilidad
  | OperacionLimpiar
  | OperacionReubicar
  | OperacionColor
  | OperacionGrosor
  | OperacionRelleno;

// ============================================================================
// Guardas y límites
// ============================================================================

export type TipoGuarda = 'pasos' | 'recursion' | 'tiempo' | 'rellenos' | 'escrituras';

export interface LimitesEjecucion {
  readonly maximoPasos: number;
  readonly maximaProfundidad: number;
  readonly maximoTiempoMs: number;
  readonly pasosEntreMediciones: number;
  /**
   * Operaciones RELLENA por ejecución. Las otras guardas no la cubren: para el
   * intérprete un RELLENA es una operación barata, pero el lienzo calcula su área
   * con una inundación sobre 800 × 800 celdas, y el modo inmediato y el de
   * movimiento reducido aplican todas las operaciones en un solo bucle sincrónico.
   * Sin este tope, `REPITE 50000 [RELLENA "azul]` pasa las guardas de pasos y de
   * tiempo y cuelga la pestaña en el lienzo.
   */
  readonly maximoRellenos: number;
  /** `ESCRIBE` y `ROTULA` por ejecución (500 si se omite). */
  readonly maximoEscrituras?: number;
  /** Instrucciones despachadas e iteraciones por ejecución (2 000 000 si se omite). */
  readonly maximoCiclos?: number;
}

/**
 * Límites por omisión: 200 000 pasos, 100 niveles, 5 000 ms, 1 000 pasos entre
 * mediciones y 100 rellenos. Cien rellenos sobran para cualquier figura del juego
 * (la cuadrícula más grande del mundo 2 tiene 9 paneles) y acotan el costo del
 * lienzo en el peor caso.
 */
const MAXIMO_CICLOS_PREDETERMINADO = 2_000_000;
const MAXIMO_ESCRITURAS_PREDETERMINADO = 500;

export const LIMITES_PREDETERMINADOS: LimitesEjecucion = {
  maximoPasos: 200_000,
  maximaProfundidad: 100,
  maximoTiempoMs: 5_000,
  pasosEntreMediciones: 1_000,
  maximoRellenos: 100,
};

export interface OpcionesEjecucion {
  readonly estadoInicial?: EstadoTortuga;
  readonly comandosPermitidos: readonly EntradaVocabulario[];
  readonly semilla: number;
  readonly ahora?: () => number;
  /**
   * Fábrica del azar de la ejecución: recibe la semilla y devuelve `n => entero en [0, n-1]`.
   * Se inyecta para que `lenguaje/` no dependa de `azar/`; solo se invoca si el programa usa AZAR
   * (una vez por ejecución). Ver `fabricaAzar` en `azar/prng.ts`.
   */
  readonly fabricaAzar?: (semilla: number) => (n: number) => number;
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

type Entorno = ReadonlyMap<string, number>;

interface Marco {
  readonly instrucciones: readonly Instruccion[];
  indice: number;
  /** Iteraciones que faltan tras la actual (REPITE); 0 si el marco no es un REPITE. */
  restantes: number;
  /** Valores de los parámetros del procedimiento dueño; vacío en el programa principal. */
  readonly entorno: Entorno;
  /** Nombre del procedimiento si es el cuerpo de una llamada; null en el resto. */
  readonly procedimiento: string | null;
  /** Línea de la llamada a procedimiento más interna en curso. */
  readonly lineaLlamada: number | undefined;
}

const ENTORNO_VACIO: Entorno = new Map();

// ============================================================================
// Estado decorativo (mundo 2)
// ============================================================================

/**
 * Color, grosor y relleno vigentes durante la ejecución. Vive en el intérprete
 * y NO en `EstadoTortuga`: la tortuga pura no conoce color ni grosor (su modelo
 * es posición, rumbo y lápiz). El intérprete lo arrastra entre operaciones y lo
 * adjunta a las operaciones decorativas que emite. Arranca en negro y grosor 1.
 */
interface EstadoDecorativo {
  color: Color | null;   // null = el jugador no pidió color; el renderizador usa el del tema
  grosor: number;
}

/**
 * Resultado de ejecutar un comando. Distingue tres desenlaces que el bucle
 * principal trata distinto:
 *  - 'operacion': el comando produjo una operación (y, si aplica, un nuevo
 *    estado decorativo);
 *  - 'error': el comando se reconoció pero su argumento es inválido (color o
 *    grosor fuera de rango). Detiene la ejecución conservando el estado vigente;
 *  - 'noEjecutable': el comando está permitido pero esta capa no lo ejecuta
 *    (no debería ocurrir con el vocabulario de los mundos 0-2).
 */
type ResultadoComando =
  | { readonly clase: 'operacion'; readonly operacion: Operacion; readonly decorativo: EstadoDecorativo }
  | { readonly clase: 'error'; readonly error: ErrorKiroLogo }
  | { readonly clase: 'noEjecutable' };

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

  // Una instancia de PRNG por ejecución, creada solo si el programa llama a AZAR.
  let azarCreado: ((n: number) => number) | null = null;
  const azarDeEjecucion = (n: number): number => {
    if (azarCreado === null) {
      if (opciones.fabricaAzar === undefined) {
        throw new Error('ejecutar: el programa usa AZAR pero no se inyectó opciones.fabricaAzar.');
      }
      azarCreado = opciones.fabricaAzar(opciones.semilla);
    }
    return azarCreado(n);
  };

  // Estado que se pone en cero al comenzar cada ejecución, sin arrastrar nada.
  let paso = 0;
  let rellenos = 0;
  let estado: EstadoTortuga = opciones.estadoInicial ?? ESTADO_INICIAL;
  // El estado decorativo arranca en los valores por omisión (negro, grosor 1) y
  // se actualiza al ejecutar PONCOLOR/PONGROSOR. RELLENA lleva su propio color y no lo cambia.
  let decorativo: EstadoDecorativo = { color: null, grosor: 1 };
  const inicioTiempo = ahora();

  const operaciones: Operacion[] = [];

  // Pila explícita de marcos. REPITE apila un solo marco con contador, así que
  // la pila no crece con la cantidad de repeticiones.
  const pila: Marco[] = [
    {
      instrucciones: programa.instrucciones,
      indice: 0,
      restantes: 0,
      entorno: ENTORNO_VACIO,
      procedimiento: null,
      lineaLlamada: undefined,
    },
  ];
  let nivelProcedimientos = 0;

  // Definiciones indexadas una vez, en lugar de recorrer el programa en cada llamada.
  const definiciones = new Map<string, Instruccion & { tipo: 'definicionProcedimiento' }>();
  for (const inst of programa.instrucciones) {
    if (inst.tipo === 'definicionProcedimiento') definiciones.set(inst.nombre, inst);
  }

  // ---- Ayudas internas ----------------------------------------------------

  /** Profundidad = marcos de procedimiento en curso (0 en el cuerpo principal). */
  function profundidadActual(): number {
    return nivelProcedimientos;
  }

  function contextoDe(marco: Marco, linea: number): ContextoEvaluacion {
    return { valores: marco.entorno, linea, azar: azarDeEjecucion };
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
      case 'rellenos':
        return crearError('guardaRellenos', { maximo: limites.maximoRellenos });
      case 'escrituras':
        return crearError('guardaEscrituras', {});
    }
  }

  function terminar(guarda: TipoGuarda, error: ErrorKiroLogo): ResultadoEjecucion {
    return { operaciones, guardaActivada: guarda, error };
  }

  // ---- Bucle principal ----------------------------------------------------

  // Ciclos: instrucciones despachadas e iteraciones de REPITE, aunque el cuerpo no emita nada.
  // Cortan un REPITE de cantidad enorme con cuerpo vacío, que no suma pasos (D5). El tiempo se
  // mide cada pasosEntreMediciones ciclos, no solo cada operación emitida.
  const maximoCiclos = limites.maximoCiclos ?? MAXIMO_CICLOS_PREDETERMINADO;
  const maximoEscrituras = limites.maximoEscrituras ?? MAXIMO_ESCRITURAS_PREDETERMINADO;
  let ciclos = 0;
  let escrituras = 0;
  let desdeUltimaMedicion = 0;

  /** Cuenta un ciclo y devuelve la guarda que corta la ejecución, si alguna. */
  function contarCiclo(): TipoGuarda | null {
    ciclos += 1;
    if (ciclos > maximoCiclos) return 'pasos';
    desdeUltimaMedicion += 1;
    if (desdeUltimaMedicion >= limites.pasosEntreMediciones) {
      desdeUltimaMedicion = 0;
      if (ahora() - inicioTiempo > limites.maximoTiempoMs) return 'tiempo';
    }
    return null;
  }

  while (pila.length > 0) {
    const marco = pila[pila.length - 1]!;

    // Marco agotado: se desapila (retorno del procedimiento).
    if (marco.indice >= marco.instrucciones.length) {
      if (marco.restantes > 0) {
        const guardaCiclo = contarCiclo();
        if (guardaCiclo !== null) return terminar(guardaCiclo, errorDeGuarda(guardaCiclo, null));
        marco.restantes -= 1;
        marco.indice = 0;
        continue;
      }
      pila.pop();
      if (marco.procedimiento !== null) nivelProcedimientos -= 1;
      continue;
    }

    const instruccion = marco.instrucciones[marco.indice]!;
    marco.indice += 1;

    const guardaCicloInstruccion = contarCiclo();
    if (guardaCicloInstruccion !== null) {
      return terminar(guardaCicloInstruccion, errorDeGuarda(guardaCicloInstruccion, null));
    }

    // --- Nodos de procedimiento (decisión D6: sin parámetros ni retorno) ---
    if (instruccion.tipo === 'definicionProcedimiento') {
      // Una definición no ejecuta su cuerpo aquí; se registra implícitamente.
      // En el mundo 0 el parser no produce estos nodos, pero el intérprete los
      // acepta para las specs 03+ (ejecución sin parámetros).
      continue;
    }

    if (instruccion.tipo === 'invocacionProcedimiento') {
      const definicion = definiciones.get(instruccion.nombre);
      if (definicion === undefined) {
        const error = crearError('comandoNoPermitido', { nombre: instruccion.nombre, linea: instruccion.linea }, { linea: instruccion.linea });
        return { operaciones, guardaActivada: null, error };
      }
      // Los argumentos se evalúan de izquierda a derecha en el entorno de quien
      // llama. Si alguno falla no se crea marco (R7.4).
      const contextoLlamada = contextoDe(marco, instruccion.linea);
      const entornoNuevo = new Map<string, number>();
      for (let i = 0; i < definicion.parametros.length; i++) {
        const expresion = instruccion.argumentos[i];
        if (expresion === undefined) break;
        const r = evaluar(expresion, contextoLlamada);
        if (!r.exito) return { operaciones, guardaActivada: null, error: r.error };
        entornoNuevo.set(definicion.parametros[i]!, r.valor);
      }
      // Entrar a un marco nuevo: comprobar la guarda de recursión (y tiempo).
      const entrada = { nombre: instruccion.nombre, linea: instruccion.linea };
      const guarda = comprobarGuardas(entrada);
      if (guarda !== null) {
        return terminar(guarda, errorDeGuarda(guarda, entrada));
      }
      pila.push({
        instrucciones: definicion.cuerpo,
        indice: 0,
        restantes: 0,
        entorno: entornoNuevo,
        procedimiento: instruccion.nombre,
        lineaLlamada: instruccion.linea,
      });
      nivelProcedimientos += 1;
      continue;
    }

    // --- Repeticion: un solo marco con contador de iteraciones ---
    if (instruccion.tipo === 'repeticion') {
      const r = evaluar(instruccion.veces, contextoDe(marco, instruccion.linea));
      if (!r.exito) return { operaciones, guardaActivada: null, error: r.error };
      const veces = cantidadDeRepeticiones(r.valor);
      if (veces === null) {
        const error = crearError('vecesInvalidas', { linea: instruccion.linea, valor: r.valor }, { linea: instruccion.linea });
        return { operaciones, guardaActivada: null, error };
      }
      if (veces > 0) {
        pila.push({
          instrucciones: instruccion.cuerpo,
          indice: 0,
          restantes: veces - 1,
          entorno: marco.entorno,
          procedimiento: null,
          lineaLlamada: marco.lineaLlamada,
        });
      }
      continue;
    }

    // --- Nodos reservados que esta spec no ejecuta ---
    if (instruccion.tipo !== 'invocacionComando') {
      const error = crearError('nodoNoImplementado', { linea: instruccion.linea }, { linea: instruccion.linea });
      return { operaciones, guardaActivada: null, error };
    }

    // --- Invocación de comando ---
    // Resolver el comando a su entrada de vocabulario (acepta nombre largo o
    // abreviatura) y comprobar que su nombre canónico esté permitido.
    const busqueda = buscarComando(instruccion.nombre);
    const nombreCanonico = busqueda.hallada ? busqueda.entrada.nombre : instruccion.nombre;
    if (!permitidos.has(nombreCanonico)) {
      const error = crearError('comandoNoPermitido', { nombre: nombreCanonico, linea: instruccion.linea }, { linea: instruccion.linea });
      return { operaciones, guardaActivada: null, error };
    }

    // Guarda de pasos y de tiempo antes de emitir la operación.
    const guardaPasos = comprobarGuardas(null);
    if (guardaPasos !== null) {
      return terminar(guardaPasos, errorDeGuarda(guardaPasos, null));
    }

    // Guarda de rellenos: se corta ANTES de emitir el que pasaría el tope, igual
    // que la de pasos, para que ningún consumidor reciba más de maximoRellenos.
    if (nombreCanonico === 'RELLENA' && rellenos >= limites.maximoRellenos) {
      return terminar('rellenos', errorDeGuarda('rellenos', null));
    }

    // Guarda de escrituras: la operación 501 no se emite y se conservan las 500 anteriores (R9.10).
    const esEscritura = nombreCanonico === 'ESCRIBE' || nombreCanonico === 'ROTULA';
    if (esEscritura && escrituras >= maximoEscrituras) {
      return terminar('escrituras', errorDeGuarda('escrituras', null));
    }

    // Evaluar el argumento en el entorno del marco antes de ejecutar (R4.1, R9.2, R9.3).
    const argumentoEvaluado = evaluarArgumento(busqueda.hallada ? busqueda.entrada : null, instruccion, contextoDe(marco, instruccion.linea));
    if (!argumentoEvaluado.exito) {
      return { operaciones, guardaActivada: null, error: argumentoEvaluado.error };
    }

    // Producir la operación según la semántica del comando (por nombre canónico).
    const resultado = ejecutarComando(nombreCanonico, instruccion, argumentoEvaluado, estado, decorativo, paso, instruccion.linea, profundidadActual());
    if (resultado.clase === 'noEjecutable') {
      // Comando permitido pero no ejecutable en esta capa (no debería ocurrir).
      const error = crearError('comandoNoPermitido', { nombre: instruccion.nombre, linea: instruccion.linea }, { linea: instruccion.linea });
      return { operaciones, guardaActivada: null, error };
    }
    if (resultado.clase === 'error') {
      // Argumento inválido (color o grosor): se detiene conservando el estado
      // decorativo vigente, sin emitir operación por esta instrucción.
      return { operaciones, guardaActivada: null, error: resultado.error };
    }

    const operacion: Operacion =
      marco.lineaLlamada === undefined ? resultado.operacion : { ...resultado.operacion, lineaLlamada: marco.lineaLlamada };
    operaciones.push(operacion);
    estado = operacion.estadoDespues;
    decorativo = resultado.decorativo;
    paso += 1;
    if (operacion.tipo === 'relleno') rellenos += 1;
    if (esEscritura) escrituras += 1;

    yield operacion;
  }

  return { operaciones, guardaActivada: null, error: null };
}

// ============================================================================
// Semántica de los comandos del mundo 0
// ============================================================================

/** Primer argumento ya evaluado: número, texto (palabra con comilla) o ninguno. */
interface ArgumentoEvaluado {
  readonly exito: true;
  readonly valor: number | null;
  readonly palabra: string | null;
}

/**
 * Evalúa el primer argumento de un comando de tipo `numero` o `valorEscribible`.
 * Los de color y los sin argumentos no pasan por aquí: se resuelven en su propio caso.
 */
function evaluarArgumento(
  entrada: EntradaVocabulario | null,
  instruccion: Instruccion & { tipo: 'invocacionComando' },
  contexto: ContextoEvaluacion,
): ArgumentoEvaluado | { readonly exito: false; readonly error: ErrorKiroLogo } {
  const tipo = entrada?.tiposArgumento[0];
  const primero = instruccion.argumentos[0];
  if ((tipo !== 'numero' && tipo !== 'valorEscribible') || primero === undefined) {
    return { exito: true, valor: null, palabra: null };
  }
  if (primero.tipo === 'palabraLiteral') {
    return { exito: true, valor: null, palabra: primero.valor };
  }
  const r = evaluar(primero, contexto);
  return r.exito ? { exito: true, valor: r.valor, palabra: null } : r;
}

/**
 * Describe una terna RGB para el mensaje `colorInvalido` cuando la lista no es
 * válida (p. ej. `[255 0]` o `[256 0 0]`). No es un color del catálogo, así que
 * se rinde tal cual la escribió el jugador, entre corchetes.
 */
function describirListaRGB(valores: readonly number[]): string {
  return `[${valores.join(' ')}]`;
}

/**
 * Ejecuta un comando de los mundos 0, 1 y 2 y produce su `ResultadoComando`.
 * Recibe la instrucción completa para leer el argumento sin resolver de color, y
 * el estado decorativo vigente para arrastrarlo entre operaciones.
 */
function ejecutarComando(
  nombre: string,
  instruccion: Instruccion & { tipo: 'invocacionComando' },
  evaluado: ArgumentoEvaluado,
  estadoAntes: EstadoTortuga,
  decorativo: EstadoDecorativo,
  paso: number,
  linea: number,
  profundidad: number,
): ResultadoComando {
  const base: BaseSinDespues = { paso, linea, profundidad, estadoAntes };
  const argumento = (): number | null => evaluado.valor;

  switch (nombre) {
    case 'AVANZA':
    case 'RETROCEDE': {
      const distancia = argumento() ?? 0;
      const sentido = nombre === 'AVANZA' ? 'adelante' : 'atras';
      const r = desplazar(estadoAntes, distancia, sentido);
      const estadoDespues = r.valido ? r.estado : estadoAntes;
      return opOk({
        ...base,
        tipo: 'mover',
        desde: { x: estadoAntes.posicion.x, y: estadoAntes.posicion.y },
        hasta: { x: estadoDespues.posicion.x, y: estadoDespues.posicion.y },
        lapizAbajo: estadoAntes.lapizAbajo,
        estadoDespues,
      }, decorativo);
    }
    case 'GIRADERECHA':
    case 'GIRAIZQUIERDA': {
      const grados = argumento() ?? 0;
      const sentido: SentidoGiro = nombre === 'GIRADERECHA' ? 'derecha' : 'izquierda';
      const r = girar(estadoAntes, grados, sentido);
      const estadoDespues = r.valido ? r.estado : estadoAntes;
      return opOk({ ...base, tipo: 'girar', grados, sentido, estadoDespues }, decorativo);
    }
    case 'CENTRO': {
      const estadoDespues = alCentro(estadoAntes);
      return opOk({ ...base, tipo: 'reubicar', estadoDespues }, decorativo);
    }
    case 'BORRAPANTALLA': {
      // Va al centro con rumbo 0, conservando lápiz y visibilidad; descarta la
      // estela (lo aplica el extractor de segmentos al ver la operación limpiar).
      const estadoDespues = alCentro(estadoAntes);
      return opOk({ ...base, tipo: 'limpiar', estadoDespues }, decorativo);
    }

    // --- Mundo 2: lápiz ---------------------------------------------------
    // `conLapiz` devuelve siempre un estado equivalente, sin error, aunque el
    // lápiz ya esté en ese valor: eso vuelve idempotente a SUBELAPIZ/BAJALAPIZ
    // (R3.7). El flag viaja en la operación para que, cuando llegue el `mover`
    // siguiente, `extraerSegmentos` sepa si hay trazo.
    case 'SUBELAPIZ': {
      const estadoDespues = conLapiz(estadoAntes, false);
      return opOk({ ...base, tipo: 'lapiz', lapizAbajo: false, estadoDespues }, decorativo);
    }
    case 'BAJALAPIZ': {
      const estadoDespues = conLapiz(estadoAntes, true);
      return opOk({ ...base, tipo: 'lapiz', lapizAbajo: true, estadoDespues }, decorativo);
    }

    // --- Mundo 2: visibilidad --------------------------------------------
    // Igual que el lápiz: `conVisibilidad` nunca falla y es idempotente al
    // repetir OCULTATORTUGA/MUESTRATORTUGA sobre el mismo estado (R5.4, R5.5).
    case 'OCULTATORTUGA': {
      const estadoDespues = conVisibilidad(estadoAntes, false);
      return opOk({ ...base, tipo: 'visibilidad', visible: false, estadoDespues }, decorativo);
    }
    case 'MUESTRATORTUGA': {
      const estadoDespues = conVisibilidad(estadoAntes, true);
      return opOk({ ...base, tipo: 'visibilidad', visible: true, estadoDespues }, decorativo);
    }

    // --- Mundo 2: canal decorativo ---------------------------------------
    // Ninguno mueve la tortuga: estadoDespues === estadoAntes. Y como no emiten
    // `mover`, no producen trazo, así que el validador no los ve (R4.8).
    case 'PONCOLOR':
      return ejecutarPonColor(instruccion, base, decorativo, estadoAntes);
    case 'PONGROSOR':
      return ejecutarPonGrosor(evaluado.valor, base, decorativo, estadoAntes);
    case 'RELLENA':
      return ejecutarRellena(instruccion, base, decorativo, estadoAntes);

    // --- Mundo 4: texto ---------------------------------------------------
    // Ninguno mueve la tortuga ni produce segmento. ROTULA escribe en la
    // posición actual aunque el lápiz esté arriba (R11.3).
    case 'ESCRIBE': {
      const texto = textoEscribible(evaluado);
      return opOk({ ...base, tipo: 'escribir', texto, estadoDespues: estadoAntes }, decorativo);
    }
    case 'ROTULA': {
      const texto = textoEscribible(evaluado);
      const posicion = { x: estadoAntes.posicion.x, y: estadoAntes.posicion.y };
      return opOk({ ...base, tipo: 'rotular', texto, posicion, color: decorativo.color, estadoDespues: estadoAntes }, decorativo);
    }

    default:
      return { clase: 'noEjecutable' };
  }
}

/** Texto de un valor escribible: la palabra sin comilla, o el número formateado. */
function textoEscribible(evaluado: ArgumentoEvaluado): string {
  if (evaluado.palabra !== null) return evaluado.palabra;
  return formatearNumero(evaluado.valor ?? 0);
}

/** Envuelve una operación que no cambia el estado decorativo. */
function opOk(operacion: Operacion, decorativo: EstadoDecorativo): ResultadoComando {
  return { clase: 'operacion', operacion, decorativo };
}

/**
 * PONCOLOR: resuelve el argumento de color (palabra del catálogo o terna RGB)
 * contra `colores.ts`. Si es válido, actualiza el color vigente y emite
 * `OperacionColor`; si no, detiene con `colorInvalido` y conserva el color
 * anterior (R4.1, R4.3).
 */
function ejecutarPonColor(
  instruccion: Instruccion & { tipo: 'invocacionComando' },
  base: BaseSinDespues,
  decorativo: EstadoDecorativo,
  estadoAntes: EstadoTortuga,
): ResultadoComando {
  const r = resolverArgumentoColor(instruccion, base.linea);
  if (!r.ok) return r.error;
  const operacion: OperacionColor = { ...base, tipo: 'color', color: r.color, estadoDespues: estadoAntes };
  return { clase: 'operacion', operacion, decorativo: { ...decorativo, color: r.color } };
}

/**
 * RELLENA: resuelve su propio argumento de color igual que PONCOLOR (palabra del
 * catálogo o terna RGB) y emite `OperacionRelleno` con ese color (R4.6). No cambia
 * el color vigente del trazo: el relleno lleva su color, el lápiz conserva el suyo.
 * Un color inválido detiene con `colorInvalido` sin emitir nada. Detectar el área
 * cerrada (R4.7: sin área, no cambia el lienzo) es tarea del renderizador.
 */
function ejecutarRellena(
  instruccion: Instruccion & { tipo: 'invocacionComando' },
  base: BaseSinDespues,
  decorativo: EstadoDecorativo,
  estadoAntes: EstadoTortuga,
): ResultadoComando {
  const r = resolverArgumentoColor(instruccion, base.linea);
  if (!r.ok) return r.error;
  const operacion: OperacionRelleno = { ...base, tipo: 'relleno', color: r.color, estadoDespues: estadoAntes };
  return { clase: 'operacion', operacion, decorativo };
}

/**
 * Resuelve el argumento de color sin resolver de un comando de color contra
 * `colores.ts`: un nombre del catálogo o una terna de exactamente tres enteros
 * 0..255. Ante un argumento inválido devuelve el resultado de error `colorInvalido`.
 */
function resolverArgumentoColor(
  instruccion: Instruccion & { tipo: 'invocacionComando' },
  linea: number,
): { readonly ok: true; readonly color: Color } | { readonly ok: false; readonly error: ResultadoComando } {
  const arg = instruccion.argumentoColor;
  if (arg === undefined) {
    // El parser no armó el argumento de color; se trata como color inválido.
    return { ok: false, error: errorColor('', linea) };
  }

  if (arg.clase === 'palabra') {
    const r = resolverColorPorNombre(arg.valor);
    return r.ok ? { ok: true, color: r.color } : { ok: false, error: errorColor(arg.valor, linea) };
  }

  // listaRGB: exige exactamente tres enteros 0..255 (lo valida resolverColorRGB).
  const [rojo, verde, azul] = arg.valores;
  if (arg.valores.length !== 3 || rojo === undefined || verde === undefined || azul === undefined) {
    return { ok: false, error: errorColor(describirListaRGB(arg.valores), linea) };
  }
  const r = resolverColorRGB(rojo, verde, azul);
  return r.ok ? { ok: true, color: r.color } : { ok: false, error: errorColor(describirListaRGB(arg.valores), linea) };
}

/**
 * PONGROSOR: exige un entero entre 1 y 50. Si es válido, actualiza el grosor
 * vigente y emite `OperacionGrosor`; si no, detiene con `grosorInvalido` y
 * conserva el grosor anterior (R4.4, R4.5).
 */
function ejecutarPonGrosor(
  g: number | null,
  base: BaseSinDespues,
  decorativo: EstadoDecorativo,
  estadoAntes: EstadoTortuga,
): ResultadoComando {
  if (g === null || !Number.isInteger(g) || g < 1 || g > 50) {
    return { clase: 'error', error: crearError('grosorInvalido', {}, { linea: base.linea }) };
  }
  const operacion: OperacionGrosor = { ...base, tipo: 'grosor', grosor: g, estadoDespues: estadoAntes };
  return { clase: 'operacion', operacion, decorativo: { ...decorativo, grosor: g } };
}

/** Construye el resultado de error de color con la posición de la instrucción. */
function errorColor(escrita: string, linea: number): ResultadoComando {
  // `colorInvalido` rechaza una `escrita` vacía (la trata como solicitud
  // inválida); el caso de argumento ausente nunca debería llegar por el parser,
  // pero si lo hiciera, un texto marcador evita el error de programación.
  const texto = escrita.trim() === '' ? '(sin color)' : escrita;
  return { clase: 'error', error: crearError('colorInvalido', { escrita: texto }, { linea }) };
}

