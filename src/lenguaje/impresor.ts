// Impresor de KiroLogo: AST → texto
// Convierte un programa de vuelta a texto de KiroLogo, con formato canónico que
// hace exacta la ida y vuelta con el lexer y el parser, e idempotente el formato.

import type { Programa, Instruccion, Expresion } from './ast.js';
import { buscarComando } from './vocabulario.js';
import { crearError, type ErrorKiroLogo } from './errores.js';

// ============================================================================
// Tipo público
// ============================================================================

export type ResultadoImpresion =
  | { readonly exito: true; readonly texto: string }
  | { readonly exito: false; readonly error: ErrorKiroLogo };

// ============================================================================
// Función principal
// ============================================================================

/**
 * Imprime un programa como texto de KiroLogo, con el nombre largo en mayúsculas
 * del vocabulario, una instrucción por línea y sangría de dos espacios por nivel.
 *
 * @param programa Programa a imprimir
 * @returns El texto o un error del catálogo si un nodo no es imprimible
 */
export function imprimir(programa: Programa): ResultadoImpresion {
  const lineas: string[] = [];
  try {
    imprimirLista(programa.instrucciones, 0, lineas);
  } catch (error) {
    if (esNoImprimible(error)) {
      return { exito: false, error: error.error };
    }
    throw error;
  }
  // Cada línea termina en un único `\n`, sin espacios finales.
  const texto = lineas.length === 0 ? '' : lineas.join('\n') + '\n';
  return { exito: true, texto };
}

// ============================================================================
// Recorrido
// ============================================================================

/** Imprime una lista de instrucciones al nivel de sangría dado. */
function imprimirLista(instrucciones: readonly Instruccion[], nivel: number, salida: string[]): void {
  for (const instruccion of instrucciones) {
    imprimirInstruccion(instruccion, nivel, salida);
  }
}

/**
 * Imprime una instrucción. En el mundo 0 solo `invocacionComando` es imprimible;
 * cualquier otro nodo (reservado) produce `nodoNoImprimible`.
 */
function imprimirInstruccion(instruccion: Instruccion, nivel: number, salida: string[]): void {
  if (instruccion.tipo !== 'invocacionComando') {
    // Nodo reservado para una spec posterior: no imprimible en esta spec.
    lanzarNoImprimible();
  }

  // Verificar que el comando existe en el vocabulario y obtener su nombre largo.
  const busqueda = buscarComando(instruccion.nombre);
  if (!busqueda.hallada) {
    // Comando que el vocabulario no declara.
    lanzarNoImprimible();
  }
  const nombreLargo = busqueda.entrada.nombre;

  const sangria = '  '.repeat(nivel);
  const argumentos = instruccion.argumentos.map(imprimirExpresion);
  const partes = [nombreLargo, ...argumentos];
  salida.push(sangria + partes.join(' '));
}

/**
 * Imprime una expresión. En el mundo 0 solo aparece `numeroLiteral`; los demás
 * tipos de expresión son reservados y hacen fallar la impresión.
 */
function imprimirExpresion(expresion: Expresion): string {
  if (expresion.tipo !== 'numeroLiteral') {
    lanzarNoImprimible();
  }
  // `String` de JavaScript da la representación más corta que redondea al mismo
  // doble: punto decimal, sin `+`, sin ceros finales. Justo lo que se necesita.
  return String(expresion.valor);
}

// ============================================================================
// Nodo no imprimible
// ============================================================================

interface NoImprimible {
  readonly esNoImprimible: true;
  readonly error: ErrorKiroLogo;
}

/**
 * Señala, mediante una excepción interna capturada en `imprimir`, que apareció un
 * nodo no imprimible en esta spec, sin devolver texto parcial. Nunca escapa.
 */
function lanzarNoImprimible(): never {
  const señal: NoImprimible = {
    esNoImprimible: true,
    error: crearError('nodoNoImprimible', {}),
  };
  throw señal;
}

function esNoImprimible(valor: unknown): valor is NoImprimible {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    (valor as { esNoImprimible?: unknown }).esNoImprimible === true
  );
}
