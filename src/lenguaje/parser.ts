// Parser de KiroLogo: tokens → AST
// Descenso recursivo de una pasada, con recuperación por sincronización.
// En el mundo 0 solo produce nodos InvocacionComando con argumento numérico literal.

import type { Token } from './lexer.js';
import type { Programa, Instruccion, InvocacionComando, NumeroLiteral, Expresion } from './ast.js';
import { buscarComando, type Mundo, type EntradaVocabulario } from './vocabulario.js';
import { crearError, resolverPalabraNoEjecutable, type ErrorKiroLogo } from './errores.js';

// ============================================================================
// Tipos públicos
// ============================================================================

export interface OpcionesAnalisis {
  readonly mundo: Mundo;                     // el del Nivel en curso
}

export interface ResultadoSintactico {
  readonly programa: Programa | null;         // null si hubo al menos un error
  readonly errores: readonly ErrorKiroLogo[]; // ≤ 20, ordenados por línea y columna
}

/** Máximo de errores que se devuelven; los de línea mayor se descartan. */
const MAXIMO_ERRORES = 20;

// ============================================================================
// Estado del análisis
// ============================================================================

interface Estado {
  readonly tokens: readonly Token[];
  indice: number;
  readonly mundo: Mundo;
  readonly errores: ErrorKiroLogo[];
}

/**
 * Analiza una lista de tokens produciendo un `Programa` o, si hay errores, la
 * lista de errores acumulados (hasta 20) sin árbol.
 *
 * @param tokens Tokens producidos por el lexer
 * @param opciones Opciones de análisis, incluido el mundo del nivel en curso
 * @returns Resultado con el programa (o null) y los errores
 */
export function analizar(
  tokens: readonly Token[],
  opciones: OpcionesAnalisis,
): ResultadoSintactico {
  const estado: Estado = {
    tokens,
    indice: 0,
    mundo: opciones.mundo,
    errores: [],
  };

  const instrucciones: Instruccion[] = [];

  while (!finalizado(estado)) {
    const antes = estado.indice;
    const instruccion = analizarInstruccion(estado);
    if (instruccion !== null) {
      instrucciones.push(instruccion);
    } else {
      // Hubo un error: recuperar por sincronización.
      sincronizar(estado);
    }
    // Salvaguarda contra bucles: si no avanzamos ni sincronizamos, forzar avance.
    if (estado.indice === antes) {
      estado.indice += 1;
    }
  }

  const erroresFinales = ordenarYAcotar(estado.errores);

  if (erroresFinales.length > 0) {
    return { programa: null, errores: erroresFinales };
  }

  return {
    programa: { tipo: 'programa', instrucciones },
    errores: [],
  };
}

// ============================================================================
// Análisis de una instrucción
// ============================================================================

/**
 * Analiza una instrucción a partir del token actual. Devuelve el nodo o `null`
 * si reportó un error (dejando el cursor donde ocurrió, para que el llamador
 * decida la sincronización).
 */
function analizarInstruccion(estado: Estado): Instruccion | null {
  const token = actual(estado)!;

  // Donde se espera un comando, un corchete/parámetro/palabra/número sueltos
  // son errores «inesperado» (requisitos 5.10, 5.11).
  switch (token.tipo) {
    case 'corchete_abre':
      reportar(estado, crearError('corcheteInesperado', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'corchete_cierra':
      reportar(estado, crearError('corcheteDeMas', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'parametro':
      reportar(estado, crearError('parametroInesperado', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'palabra':
      reportar(estado, crearError('palabraInesperada', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'numero':
      reportar(estado, crearError('numeroInesperado', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'identificador':
      // Palabra que no es comando: el catálogo elige el mensaje (sugerencia,
      // inglés, bloqueado cercano o mensaje seco).
      reportar(
        estado,
        resolverPalabraNoEjecutable(token.textoOriginal, estado.mundo, posicion(token)),
      );
      estado.indice += 1;
      return null;
    case 'comando':
      return analizarComando(estado, token);
  }
}

/**
 * Analiza un token de tipo `comando`: comprueba que esté desbloqueado y consume
 * su argumento según la aridad.
 */
function analizarComando(estado: Estado, token: Token): Instruccion | null {
  const busqueda = buscarComando(token.valor as string);
  // El lexer solo marca `comando` cuando `buscarComando` halla la entrada, así
  // que aquí siempre existe; el guard mantiene el tipo estricto.
  if (!busqueda.hallada) {
    reportar(
      estado,
      resolverPalabraNoEjecutable(token.textoOriginal, estado.mundo, posicion(token)),
    );
    estado.indice += 1;
    return null;
  }

  const entrada = busqueda.entrada;

  // Comando de un mundo posterior: bloqueado.
  if (entrada.mundo > estado.mundo) {
    reportar(
      estado,
      crearError(
        'comandoBloqueado',
        { nombre: entrada.nombre, mundo: entrada.mundo },
        posicion(token),
      ),
    );
    estado.indice += 1;
    return null;
  }

  // Consumir el comando.
  const lineaComando = token.linea;
  const columnaComando = token.columna;
  estado.indice += 1;

  // En el mundo 0 los comandos son de aridad 0 o 1 con argumento numérico.
  if (entrada.aridad === 1) {
    return analizarComandoConArgumento(estado, entrada, lineaComando, columnaComando);
  }

  // Aridad 0: sin argumento.
  const nodo: InvocacionComando = {
    tipo: 'invocacionComando',
    nombre: entrada.nombre,
    argumentos: [],
    linea: lineaComando,
    columna: columnaComando,
  };
  return nodo;
}

/**
 * Analiza un comando de aridad 1: espera un token `numero` a continuación.
 * Reporta `argumentoFaltante` o `argumentoDeTipoEquivocado` según el caso.
 */
function analizarComandoConArgumento(
  estado: Estado,
  entrada: EntradaVocabulario,
  lineaComando: number,
  columnaComando: number,
): Instruccion | null {
  const siguiente = actual(estado);

  // Falta el argumento: fin de tokens o el siguiente es otro comando.
  if (siguiente === undefined || siguiente.tipo === 'comando') {
    reportar(
      estado,
      crearError('argumentoFaltante', { comando: entrada.nombre }, { linea: lineaComando, columna: columnaComando }),
    );
    return null;
  }

  // El argumento debe ser un número.
  if (siguiente.tipo !== 'numero') {
    reportar(
      estado,
      crearError(
        'argumentoDeTipoEquivocado',
        { comando: entrada.nombre, recibido: siguiente.textoOriginal },
        posicion(siguiente),
      ),
    );
    // No consumir el token equivocado; la sincronización descartará el resto
    // de la instrucción y reanudará en el siguiente comando.
    return null;
  }

  // Consumir el número.
  const argumento: NumeroLiteral = {
    tipo: 'numeroLiteral',
    valor: siguiente.valor as number,
    linea: siguiente.linea,
    columna: siguiente.columna,
  };
  estado.indice += 1;

  const nodo: InvocacionComando = {
    tipo: 'invocacionComando',
    nombre: entrada.nombre,
    argumentos: [argumento as Expresion],
    linea: lineaComando,
    columna: columnaComando,
  };
  return nodo;
}

// ============================================================================
// Recuperación por sincronización
// ============================================================================

/**
 * Descarta los tokens restantes de la instrucción actual y reanuda en el
 * siguiente token de tipo `comando`. Determinista: no depende de heurísticas
 * ni de cuántos errores se acumularon.
 */
function sincronizar(estado: Estado): void {
  while (!finalizado(estado)) {
    const token = actual(estado)!;
    if (token.tipo === 'comando') {
      return;
    }
    estado.indice += 1;
  }
}

// ============================================================================
// Errores acumulados
// ============================================================================

/** Añade un error a la lista acumulada. */
function reportar(estado: Estado, error: ErrorKiroLogo): void {
  estado.errores.push(error);
}

/**
 * Ordena los errores por línea y luego por columna, y devuelve a lo sumo 20,
 * descartando los de línea mayor.
 */
function ordenarYAcotar(errores: readonly ErrorKiroLogo[]): readonly ErrorKiroLogo[] {
  const ordenados = [...errores].sort((a, b) => {
    const la = a.linea ?? 0;
    const lb = b.linea ?? 0;
    if (la !== lb) return la - lb;
    return (a.columna ?? 0) - (b.columna ?? 0);
  });
  return ordenados.slice(0, MAXIMO_ERRORES);
}

// ============================================================================
// Utilidades sobre el cursor
// ============================================================================

function actual(estado: Estado): Token | undefined {
  return estado.tokens[estado.indice];
}

function finalizado(estado: Estado): boolean {
  return estado.indice >= estado.tokens.length;
}

function posicion(token: Token): { readonly linea: number; readonly columna: number } {
  return { linea: token.linea, columna: token.columna };
}
