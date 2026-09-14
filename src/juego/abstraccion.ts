// Análisis de abstracción de KiroLogo
// Recorre el AST completo del jugador (incluidos los nueve nodos reservados) y
// confirma las exigencias de abstracción del nivel. No lee el texto, no invoca
// el impresor y no compara contra el programa de referencia.

import type { Programa, Instruccion, Expresion } from '../lenguaje/ast.js';
import type { ExigenciaAbstraccion } from '../niveles/tipos.js';

type ClaveAbstraccion = ExigenciaAbstraccion['clave'];

export interface ResultadoAbstraccion {
  readonly confirmadas: readonly ClaveAbstraccion[];
  readonly sinConfirmar: readonly ClaveAbstraccion[]; // en el orden del nivel
}

// ============================================================================
// Función principal
// ============================================================================

/**
 * Analiza el AST del jugador contra las exigencias declaradas por el nivel.
 * Devuelve las confirmadas y las que faltan, en el orden en que el nivel las
 * declara.
 *
 * @param programa AST del jugador
 * @param exigencias Exigencias de abstracción del nivel
 */
export function analizar(
  programa: Programa,
  exigencias: readonly ExigenciaAbstraccion[],
): ResultadoAbstraccion {
  const confirmadas: ClaveAbstraccion[] = [];
  const sinConfirmar: ClaveAbstraccion[] = [];

  for (const exigencia of exigencias) {
    if (cumple(programa, exigencia)) {
      confirmadas.push(exigencia.clave);
    } else {
      sinConfirmar.push(exigencia.clave);
    }
  }

  return { confirmadas, sinConfirmar };
}

// ============================================================================
// Condición de cada clave (tabla del diseño 11.4)
// ============================================================================

function cumple(programa: Programa, exigencia: ExigenciaAbstraccion): boolean {
  switch (exigencia.clave) {
    case 'usaRepite':
      return hayAlgunNodo(programa.instrucciones, (n) => n.tipo === 'repeticion');
    case 'usaRepiteAnidado':
      return hayRepeticionAnidada(programa.instrucciones);
    case 'defineProcedimiento':
      return hayAlgunNodo(programa.instrucciones, (n) => n.tipo === 'definicionProcedimiento');
    case 'usaParametros':
      return hayParametroDeclaradoYUsado(programa.instrucciones);
    case 'usaRecursion':
      return hayRecursion(programa.instrucciones);
    case 'maximoProcedimientos':
      return contarDefiniciones(programa.instrucciones) <= exigencia.maximo;
  }
}

// ============================================================================
// Recorrido del AST
// ============================================================================

/** ¿Algún nodo de las instrucciones (recursivamente) cumple el predicado? */
function hayAlgunNodo(
  instrucciones: readonly Instruccion[],
  predicado: (n: Instruccion) => boolean,
): boolean {
  for (const nodo of instrucciones) {
    if (predicado(nodo)) return true;
    if (hayAlgunNodo(hijos(nodo), predicado)) return true;
  }
  return false;
}

/** Devuelve las listas de instrucciones hijas de un nodo. */
function hijos(nodo: Instruccion): readonly Instruccion[] {
  switch (nodo.tipo) {
    case 'repeticion':
      return nodo.cuerpo;
    case 'definicionProcedimiento':
      return nodo.cuerpo;
    case 'condicionalUnaRama':
      return nodo.entonces;
    case 'condicionalDosRamas':
      return [...nodo.entonces, ...nodo.siNo];
    default:
      return [];
  }
}

/** ¿Hay una repetición con otra repetición entre sus descendientes? */
function hayRepeticionAnidada(instrucciones: readonly Instruccion[]): boolean {
  for (const nodo of instrucciones) {
    if (nodo.tipo === 'repeticion') {
      if (hayAlgunNodo(nodo.cuerpo, (n) => n.tipo === 'repeticion')) return true;
    }
    if (hayRepeticionAnidada(hijos(nodo))) return true;
  }
  return false;
}

/** Cuenta los nodos de definición de procedimiento en todo el AST. */
function contarDefiniciones(instrucciones: readonly Instruccion[]): number {
  let total = 0;
  for (const nodo of instrucciones) {
    if (nodo.tipo === 'definicionProcedimiento') total += 1;
    total += contarDefiniciones(hijos(nodo));
  }
  return total;
}

/**
 * ¿Alguna definición declara uno o más parámetros Y su cuerpo referencia a un
 * parámetro que ella misma declara?
 */
function hayParametroDeclaradoYUsado(instrucciones: readonly Instruccion[]): boolean {
  for (const nodo of instrucciones) {
    if (nodo.tipo === 'definicionProcedimiento') {
      if (nodo.parametros.length > 0 && cuerpoUsaAlguno(nodo.cuerpo, nodo.parametros)) {
        return true;
      }
    }
    // Recurrir a los hijos por si hay definiciones anidadas (specs futuras).
    if (hayParametroDeclaradoYUsado(hijos(nodo))) return true;
  }
  return false;
}

/** ¿El cuerpo referencia a alguno de los nombres de parámetro dados? */
function cuerpoUsaAlguno(instrucciones: readonly Instruccion[], parametros: readonly string[]): boolean {
  const conjunto = new Set(parametros);
  for (const nodo of instrucciones) {
    if (nodoReferenciaParametro(nodo, conjunto)) return true;
    if (cuerpoUsaAlguno(hijos(nodo), parametros)) return true;
  }
  return false;
}

/** ¿El nodo (o sus expresiones) referencia a un parámetro del conjunto? */
function nodoReferenciaParametro(nodo: Instruccion, parametros: ReadonlySet<string>): boolean {
  switch (nodo.tipo) {
    case 'invocacionComando':
    case 'invocacionProcedimiento':
      return nodo.argumentos.some((e) => expresionReferenciaParametro(e, parametros));
    case 'repeticion':
      return expresionReferenciaParametro(nodo.veces, parametros);
    case 'condicionalUnaRama':
    case 'condicionalDosRamas':
      return expresionReferenciaParametro(nodo.condicion, parametros);
    case 'devolucionValor':
      return expresionReferenciaParametro(nodo.valor, parametros);
    default:
      return false;
  }
}

/** ¿La expresión (recursivamente) referencia a un parámetro del conjunto? */
function expresionReferenciaParametro(expresion: Expresion, parametros: ReadonlySet<string>): boolean {
  switch (expresion.tipo) {
    case 'referenciaParametro':
      return parametros.has(expresion.nombre);
    case 'expresionAritmetica':
      return (
        expresionReferenciaParametro(expresion.izquierda, parametros) ||
        expresionReferenciaParametro(expresion.derecha, parametros)
      );
    case 'numeroLiteral':
      return false;
  }
}

/**
 * ¿El cuerpo de alguna definición contiene una invocación de su propio nombre?
 */
function hayRecursion(instrucciones: readonly Instruccion[]): boolean {
  for (const nodo of instrucciones) {
    if (nodo.tipo === 'definicionProcedimiento') {
      if (invocaNombre(nodo.cuerpo, nodo.nombre)) return true;
    }
    if (hayRecursion(hijos(nodo))) return true;
  }
  return false;
}

/** ¿Las instrucciones (recursivamente) invocan un procedimiento con ese nombre? */
function invocaNombre(instrucciones: readonly Instruccion[], nombre: string): boolean {
  for (const nodo of instrucciones) {
    if (nodo.tipo === 'invocacionProcedimiento' && nodo.nombre === nombre) return true;
    if (invocaNombre(hijos(nodo), nombre)) return true;
  }
  return false;
}
