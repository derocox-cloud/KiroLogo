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
}

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