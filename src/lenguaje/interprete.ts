// Intérprete de KiroLogo: AST → generador de operaciones, y las tres guardas.
// Único flujo de ejecución del proyecto. Emite una Operacion por instrucción y
// suspende hasta que el consumidor pide la siguiente. Es el único módulo que
// invoca las transformaciones de la tortuga.

import type { Programa, Instruccion } from './ast.js';
import { buscarComando, type EntradaVocabulario } from './vocabulario.js';
import { crearError, type ErrorKiroLogo } from './errores.js';
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

export type Operacion =
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
// Estado decorativo (mundo 2)
// ============================================================================

/**
 * Color, grosor y relleno vigentes durante la ejecución. Vive en el intérprete
 * y NO en `EstadoTortuga`: la tortuga pura no conoce color ni grosor (su modelo
 * es posición, rumbo y lápiz). El intérprete lo arrastra entre operaciones y lo
 * adjunta a las operaciones decorativas que emite. Arranca en negro y grosor 1.
 */
interface EstadoDecorativo {
  color: Color;
  grosor: number;
}

/** Color por omisión del trazo: negro. Se resuelve una sola vez del catálogo. */
const COLOR_NEGRO: Color = (() => {
  const r = resolverColorPorNombre('negro');
  // `negro` siempre existe en el catálogo; el fallback deja el tipo sin dudas.
  return r.ok ? r.color : { r: 0, g: 0, b: 0, nombre: 'negro' };
})();

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

  // El PRNG se crea al inicio de cada ejecución; no se usa en el mundo 0, pero
  // deja el punto de siembra listo para specs futuras (AZAR).
  // (No se instancia aún para no arrastrar dependencia innecesaria en esta spec.)

  // Estado que se pone en cero al comenzar cada ejecución, sin arrastrar nada.
  let paso = 0;
  let estado: EstadoTortuga = opciones.estadoInicial ?? ESTADO_INICIAL;
  // El estado decorativo arranca en los valores por omisión (negro, grosor 1) y
  // se actualiza al ejecutar PONCOLOR/PONGROSOR. RELLENA lee el color vigente.
  let decorativo: EstadoDecorativo = { color: COLOR_NEGRO, grosor: 1 };
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

    // --- Repeticion: ejecutar el cuerpo N veces ---
    if (instruccion.tipo === 'repeticion') {
      const vecesValor = instruccion.veces.tipo === 'numeroLiteral' ? instruccion.veces.valor : 0;
      // Apilar en orden inverso para que la pila LIFO ejecute la iteración 0 primero.
      for (let _rep = vecesValor - 1; _rep >= 0; _rep--) {
        pila.push({ instrucciones: instruccion.cuerpo, indice: 0, nombre: null, lineaInvocacion: instruccion.linea });
      }
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
    const resultado = ejecutarComando(nombreCanonico, instruccion, estado, decorativo, paso, instruccion.linea, profundidadActual());
    if (resultado.clase === 'noEjecutable') {
      // Comando permitido pero no ejecutable en esta capa (no debería ocurrir).
      const error = crearError('comandoNoPermitido', { nombre: instruccion.nombre }, { linea: instruccion.linea });
      return { operaciones, guardaActivada: null, error };
    }
    if (resultado.clase === 'error') {
      // Argumento inválido (color o grosor): se detiene conservando el estado
      // decorativo vigente, sin emitir operación por esta instrucción.
      return { operaciones, guardaActivada: null, error: resultado.error };
    }

    const operacion = resultado.operacion;
    operaciones.push(operacion);
    estado = operacion.estadoDespues;
    decorativo = resultado.decorativo;
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
 * el estado decorativo vigente para arrastrarlo y, en RELLENA, leer el color.
 */
function ejecutarComando(
  nombre: string,
  instruccion: Instruccion & { tipo: 'invocacionComando' },
  estadoAntes: EstadoTortuga,
  decorativo: EstadoDecorativo,
  paso: number,
  linea: number,
  profundidad: number,
): ResultadoComando {
  const base: BaseSinDespues = { paso, linea, profundidad, estadoAntes };

  switch (nombre) {
    case 'AVANZA':
    case 'RETROCEDE': {
      const distancia = argumento(instruccion) ?? 0;
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
      const grados = argumento(instruccion) ?? 0;
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
      return ejecutarPonGrosor(instruccion, base, decorativo, estadoAntes);
    case 'RELLENA': {
      // RELLENA no toma argumento de color (aridad 0 en el vocabulario): rellena
      // con el color vigente del estado decorativo. La detección del área cerrada
      // (R4.7: sin área, no cambia el lienzo) es tarea del renderizador; aquí solo
      // se emite la operación con el color actual.
      const operacion: OperacionRelleno = { ...base, tipo: 'relleno', color: decorativo.color, estadoDespues: estadoAntes };
      return { clase: 'operacion', operacion, decorativo };
    }

    default:
      return { clase: 'noEjecutable' };
  }
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
  const arg = instruccion.argumentoColor;
  if (arg === undefined) {
    // El parser no armó el argumento de color; se trata como color inválido.
    return errorColor('', base.linea);
  }

  if (arg.clase === 'palabra') {
    const r = resolverColorPorNombre(arg.valor);
    if (!r.ok) {
      return errorColor(arg.valor, base.linea);
    }
    const operacion: OperacionColor = { ...base, tipo: 'color', color: r.color, estadoDespues: estadoAntes };
    return { clase: 'operacion', operacion, decorativo: { ...decorativo, color: r.color } };
  }

  // listaRGB: exige exactamente tres enteros 0..255 (lo valida resolverColorRGB).
  const [rojo, verde, azul] = arg.valores;
  if (arg.valores.length !== 3 || rojo === undefined || verde === undefined || azul === undefined) {
    return errorColor(describirListaRGB(arg.valores), base.linea);
  }
  const r = resolverColorRGB(rojo, verde, azul);
  if (!r.ok) {
    return errorColor(describirListaRGB(arg.valores), base.linea);
  }
  const operacion: OperacionColor = { ...base, tipo: 'color', color: r.color, estadoDespues: estadoAntes };
  return { clase: 'operacion', operacion, decorativo: { ...decorativo, color: r.color } };
}

/**
 * PONGROSOR: exige un entero entre 1 y 50. Si es válido, actualiza el grosor
 * vigente y emite `OperacionGrosor`; si no, detiene con `grosorInvalido` y
 * conserva el grosor anterior (R4.4, R4.5).
 */
function ejecutarPonGrosor(
  instruccion: Instruccion & { tipo: 'invocacionComando' },
  base: BaseSinDespues,
  decorativo: EstadoDecorativo,
  estadoAntes: EstadoTortuga,
): ResultadoComando {
  const g = argumento(instruccion);
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
