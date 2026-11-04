// Tipos del árbol sintáctico de KiroLogo
// Dos nodos vivos en esta spec (mundo 0) y nueve reservados para specs futuras.

export interface NodoBase {
  readonly linea: number;     // desde 1
  readonly columna: number;   // desde 1
}

// ============================================================================
// Nodos vivos en esta spec (mundo 0)
// ============================================================================

export interface NumeroLiteral extends NodoBase {
  readonly tipo: 'numeroLiteral';
  readonly valor: number;
}

export interface InvocacionComando extends NodoBase {
  readonly tipo: 'invocacionComando';
  readonly nombre: string;                        // nombre largo del Vocabulario
  readonly argumentos: readonly Expresion[];
  // Argumento SIN RESOLVER de PONCOLOR (mundo 2). Es opcional y vive aparte de
  // `argumentos` a propósito: el argumento de color no es una `Expresion`
  // numérica (es una palabra de color o una terna RGB), y meterlo en el union
  // `Expresion` obligaría a tocar cada switch exhaustivo que recorre expresiones
  // (conteo.ts, abstraccion.ts, interprete.ts). Al colgarlo de un campo propio y
  // opcional, el parser lo transporta al intérprete para que lo resuelva contra
  // `colores.ts` (R4.2, R4.3) sin alterar el conteo (PONCOLOR sigue contando 1
  // como cualquier invocacionComando) ni el análisis de abstracción.
  readonly argumentoColor?: ArgumentoColor;
}

/**
 * Argumento de color de `PONCOLOR` tal como lo leyó el parser, sin resolver. El
 * intérprete (mundo 2) lo resuelve contra el catálogo de colores: una `palabra`
 * por nombre (`naranja`, `"naranja`) o una `listaRGB` de tres enteros
 * (`[255 0 0]`). Vive en el AST porque el parseo ya distinguió la forma; la
 * validación del rango y del nombre es responsabilidad del intérprete.
 */
export type ArgumentoColor =
  | { readonly clase: 'palabra'; readonly valor: string }
  | { readonly clase: 'listaRGB'; readonly valores: readonly number[] };

// ============================================================================
// Nodos reservados para specs futuras
// ============================================================================

/** Iteración. `REPITE n [ … ]`. Implementa: spec 02 · mundo 1 · figuras. */
export interface Repeticion extends NodoBase {
  readonly tipo: 'repeticion';
  readonly veces: Expresion;
  readonly cuerpo: readonly Instruccion[];
}

/** Descomposición. `PARA NOMBRE :p … FIN`. Implementa: spec 03 · mundo 2 · composición. */
export interface DefinicionProcedimiento extends NodoBase {
  readonly tipo: 'definicionProcedimiento';
  readonly nombre: string;
  readonly parametros: readonly string[];
  readonly cuerpo: readonly Instruccion[];
}

/** Descomposición. Uso de un comando propio. Implementa: spec 03 · mundo 2 · composición. */
export interface InvocacionProcedimiento extends NodoBase {
  readonly tipo: 'invocacionProcedimiento';
  readonly nombre: string;
  readonly argumentos: readonly Expresion[];
}

/** Generalización. `:largo`. Implementa: spec 05 · mundo 4 · parámetros. */
export interface ReferenciaParametro extends NodoBase {
  readonly tipo: 'referenciaParametro';
  readonly nombre: string;
}

/** Generalización. `360 / :lados`, y también `:n = 0`. Implementa: spec 05 · mundo 4 · parámetros. */
export interface ExpresionAritmetica extends NodoBase {
  readonly tipo: 'expresionAritmetica';
  readonly operador: '+' | '-' | '*' | '/' | '=' | '<' | '>';
  readonly izquierda: Expresion;
  readonly derecha: Expresion;
}

/** Recursión. `SI cond [ … ]`. Implementa: spec 06 · mundo 5 · fractales. */
export interface CondicionalUnaRama extends NodoBase {
  readonly tipo: 'condicionalUnaRama';
  readonly condicion: Expresion;
  readonly entonces: readonly Instruccion[];
}

/** Recursión. `SINO cond [ … ] [ … ]`. Implementa: spec 06 · mundo 5 · fractales. */
export interface CondicionalDosRamas extends NodoBase {
  readonly tipo: 'condicionalDosRamas';
  readonly condicion: Expresion;
  readonly entonces: readonly Instruccion[];
  readonly siNo: readonly Instruccion[];
}

/** Recursión. `ALTO`. Implementa: spec 06 · mundo 5 · fractales. */
export interface Interrupcion extends NodoBase { readonly tipo: 'interrupcion' }

/** Recursión. `DEVUELVE :n * 2`. Implementa: spec 06 · mundo 5 · fractales. */
export interface DevolucionValor extends NodoBase {
  readonly tipo: 'devolucionValor';
  readonly valor: Expresion;
}

// ============================================================================
// Tipos unión
// ============================================================================

export type Expresion = NumeroLiteral | ReferenciaParametro | ExpresionAritmetica;
export type Instruccion =
  | InvocacionComando | Repeticion | DefinicionProcedimiento | InvocacionProcedimiento
  | CondicionalUnaRama | CondicionalDosRamas | Interrupcion | DevolucionValor;
export type Nodo = Instruccion | Expresion;

export interface Programa {
  readonly tipo: 'programa';
  readonly instrucciones: readonly Instruccion[];
}