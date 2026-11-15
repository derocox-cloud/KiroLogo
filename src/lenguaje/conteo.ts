// Conteo de instrucciones de KiroLogo
// Única fuente del presupuesto del proyecto: el editor, el reto y las estrellas
// obtienen su número de aquí, sin recorrer el AST por su cuenta.

import type { Programa, Instruccion, Expresion, Nodo } from './ast.js';
import { crearError, type ErrorKiroLogo } from './errores.js';

// ============================================================================
// Tipo público
// ============================================================================

export type ResultadoConteo =
  | { readonly exito: true; readonly instrucciones: number }
  | { readonly exito: false; readonly error: ErrorKiroLogo };

// ============================================================================
// Función principal
// ============================================================================

/**
 * Cuenta las instrucciones escritas de un programa, siguiendo la tabla del
 * diseño 3.7. No modifica el programa recibido y es determinista.
 *
 * @param programa Programa a contar
 * @returns Conteo o un error de programación si aparece un discriminante desconocido
 */
export function contarInstrucciones(programa: Programa): ResultadoConteo {
  try {
    const total = contarLista(programa.instrucciones);
    return { exito: true, instrucciones: total };
  } catch (error) {
    if (esNodoDesconocido(error)) {
      return { exito: false, error: error.error };
    }
    throw error;
  }
}

// ============================================================================
// Recorrido en profundidad
// ============================================================================

/** Cuenta las instrucciones de una lista, sumando el conteo de cada nodo. */
function contarLista(instrucciones: readonly Instruccion[]): number {
  let total = 0;
  for (const instruccion of instrucciones) {
    total += contarNodo(instruccion);
  }
  return total;
}

/**
 * Cuenta un solo nodo según la tabla del diseño 3.7.
 *
 * | Nodo | Cuenta |
 * |---|---|
 * | invocacionComando | 1 |
 * | invocacionProcedimiento | 1 |
 * | repeticion | 1 + cuerpo escrito (sin multiplicar por iteraciones, 0 por `veces`) |
 * | condicionalUnaRama | 1 + lista (0 por la condición) |
 * | condicionalDosRamas | 1 + dos listas (0 por la condición) |
 * | definicionProcedimiento | 0 por la cabecera + cuerpo contado una sola vez |
 * | interrupcion, devolucionValor | 1 |
 * | numeroLiteral, referenciaParametro, expresionAritmetica | 0 |
 * | menosUnario, palabraLiteral, comandoOperador (mundo 4) | 0 |
 *
 * Las expresiones cuestan 0 a cualquier profundidad: `AVANZA 100`,
 * `AVANZA 50 + 50` y `AVANZA SUMA 50 50` cuentan 1 cada uno.
 */
function contarNodo(nodo: Instruccion): number {
  switch (nodo.tipo) {
    case 'invocacionComando':
      // ESCRIBE y ROTULA también cuentan 1, sin importar sus argumentos.
      return 1 + contarExpresiones(nodo.argumentos);
    case 'invocacionProcedimiento':
      return 1 + contarExpresiones(nodo.argumentos);
    case 'repeticion':
      // 1 por la repetición + el cuerpo escrito una sola vez; 0 por `veces`.
      return 1 + contarExpresion(nodo.veces) + contarLista(nodo.cuerpo);
    case 'condicionalUnaRama':
      // 1 por el condicional + su única lista; 0 por la condición.
      return 1 + contarExpresion(nodo.condicion) + contarLista(nodo.entonces);
    case 'condicionalDosRamas':
      // 1 por el condicional + sus dos listas; 0 por la condición.
      return (
        1 + contarExpresion(nodo.condicion) + contarLista(nodo.entonces) + contarLista(nodo.siNo)
      );
    case 'definicionProcedimiento':
      // 0 por la cabecera (nombre y parámetros) + el cuerpo contado una vez.
      return contarLista(nodo.cuerpo);
    case 'interrupcion':
      return 1;
    case 'devolucionValor':
      // 1 por la devolución; 0 por la expresión del valor.
      return 1 + contarExpresion(nodo.valor);
    default:
      // Discriminante fuera de la unión declarada por el AST.
      lanzarNodoDesconocido(nodo);
  }
}

function contarExpresiones(expresiones: readonly Expresion[]): number {
  let total = 0;
  for (const expresion of expresiones) {
    total += contarExpresion(expresion);
  }
  return total;
}

/**
 * Recorre una expresión a cualquier profundidad. Todo nodo de expresión cuesta
 * 0; el recorrido existe para que un nodo desconocido anidado se detecte y
 * produzca `nodoDesconocidoEnConteo` en lugar de un conteo parcial.
 */
function contarExpresion(nodo: Expresion): number {
  switch (nodo.tipo) {
    case 'numeroLiteral':
    case 'referenciaParametro':
    case 'palabraLiteral':
      return 0;
    case 'expresionAritmetica':
      return contarExpresion(nodo.izquierda) + contarExpresion(nodo.derecha);
    case 'menosUnario':
      return contarExpresion(nodo.operando);
    case 'comandoOperador':
      return contarExpresiones(nodo.argumentos);
    default:
      lanzarNodoDesconocido(nodo);
  }
}

// ============================================================================
// Nodo desconocido
// ============================================================================

interface NodoDesconocido {
  readonly esNodoDesconocido: true;
  readonly error: ErrorKiroLogo;
}

/**
 * Señala, mediante una excepción interna, que apareció un discriminante que no
 * pertenece a la unión de nodos del AST. Se captura en `contarInstrucciones`
 * para no devolver un conteo parcial. Nunca escapa del módulo.
 */
function lanzarNodoDesconocido(nodo: never): never {
  const discriminante = (nodo as Nodo | { readonly tipo?: unknown }).tipo;
  const señal: NodoDesconocido = {
    esNodoDesconocido: true,
    // El mensaje del catálogo es de severidad `programacion`; nombra el
    // discriminante en la consola a través del propio catálogo.
    error: crearError('nodoDesconocidoEnConteo', {}),
  };
  // Deja rastro del discriminante recibido para la depuración.
  console.error(`conteo: discriminante desconocido «${String(discriminante)}»`);
  throw señal;
}

function esNodoDesconocido(valor: unknown): valor is NodoDesconocido {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    (valor as { esNodoDesconocido?: unknown }).esNodoDesconocido === true
  );
}
