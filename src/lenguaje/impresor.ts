// Impresor de KiroLogo: AST → texto
// Convierte un programa de vuelta a texto de KiroLogo, con formato canónico que
// hace exacta la ida y vuelta con el lexer y el parser, e idempotente el formato.

import type {
  Programa, Instruccion, Expresion, InvocacionComando, ArgumentoColor,
} from './ast.js';
import { buscarComando } from './vocabulario.js';
import { crearError, type ErrorKiroLogo } from './errores.js';

// ============================================================================
// Tipos públicos
// ============================================================================

export type ResultadoImpresion =
  | { readonly exito: true; readonly texto: string }
  | { readonly exito: false; readonly error: ErrorKiroLogo };

export interface OpcionesImpresion {
  /** Si se da, reemplaza cada `numeroLiteral` por este texto (esqueletos de pista). */
  readonly hueco?: string;
}

// ============================================================================
// Función principal
// ============================================================================

/**
 * Imprime un programa como texto de KiroLogo, con el nombre largo en mayúsculas
 * del vocabulario, una instrucción por línea y sangría de dos espacios por nivel.
 *
 * @param programa Programa a imprimir
 * @param opciones `hueco` opcional que sustituye cada número literal
 * @returns El texto o un error del catálogo si un nodo no es imprimible
 */
export function imprimir(programa: Programa, opciones: OpcionesImpresion = {}): ResultadoImpresion {
  const lineas: string[] = [];
  try {
    imprimirLista(programa.instrucciones, 0, lineas, opciones);
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
// Instrucciones
// ============================================================================

function imprimirLista(
  instrucciones: readonly Instruccion[], nivel: number, salida: string[], opciones: OpcionesImpresion,
): void {
  for (const instruccion of instrucciones) {
    imprimirInstruccion(instruccion, nivel, salida, opciones);
  }
}

function imprimirInstruccion(
  instruccion: Instruccion, nivel: number, salida: string[], opciones: OpcionesImpresion,
): void {
  const sangria = '  '.repeat(nivel);
  switch (instruccion.tipo) {
    case 'invocacionComando':
      salida.push(sangria + imprimirComando(instruccion, opciones));
      return;
    case 'invocacionProcedimiento':
      salida.push(sangria + [instruccion.nombre, ...argumentosDeInstruccion(instruccion.argumentos, opciones)].join(' '));
      return;
    case 'repeticion': {
      const veces = imprimirExpresion(instruccion.veces, opciones);
      if (instruccion.cuerpo.length === 0) {
        salida.push(`${sangria}REPITE ${veces} []`);
        return;
      }
      salida.push(`${sangria}REPITE ${veces} [`);
      imprimirLista(instruccion.cuerpo, nivel + 1, salida, opciones);
      salida.push(`${sangria}]`);
      return;
    }
    case 'definicionProcedimiento': {
      const cabecera = ['PARA', instruccion.nombre, ...instruccion.parametros.map((p) => ':' + p)];
      salida.push(sangria + cabecera.join(' '));
      imprimirLista(instruccion.cuerpo, nivel + 1, salida, opciones);
      salida.push(`${sangria}FIN`);
      return;
    }
    // Nodos reservados para el mundo 5: no imprimibles todavía.
    case 'condicionalUnaRama':
    case 'condicionalDosRamas':
    case 'interrupcion':
    case 'devolucionValor':
      lanzarNoImprimible();
  }
}

function imprimirComando(instruccion: InvocacionComando, opciones: OpcionesImpresion): string {
  const busqueda = buscarComando(instruccion.nombre);
  if (!busqueda.hallada) {
    lanzarNoImprimible();
  }
  const partes = [busqueda.entrada.nombre];
  if (instruccion.argumentoColor !== undefined) {
    partes.push(imprimirColor(instruccion.argumentoColor));
  }
  partes.push(...argumentosDeInstruccion(instruccion.argumentos, opciones));
  return partes.join(' ');
}

function imprimirColor(color: ArgumentoColor): string {
  return color.clase === 'palabra'
    ? '"' + color.valor
    : '[' + color.valores.map((v) => String(v)).join(' ') + ']';
}

/**
 * Imprime los argumentos de una instrucción. Un argumento que empieza con menos
 * unario y no es el primero va entre paréntesis: sin ellos `POLIGONO 6 -80`
 * se leería como `6 - 80`.
 */
function argumentosDeInstruccion(argumentos: readonly Expresion[], opciones: OpcionesImpresion): string[] {
  return argumentos.map((argumento, indice) => {
    const texto = imprimirExpresion(argumento, opciones);
    return indice > 0 && texto.startsWith('-') ? `(${texto})` : texto;
  });
}

// ============================================================================
// Expresiones
// ============================================================================

/** Precedencias: suma/resta 1, producto/cociente 2, menos unario 3, el resto es atómico. */
function precedencia(expresion: Expresion): number {
  switch (expresion.tipo) {
    case 'expresionAritmetica':
      return expresion.operador === '+' || expresion.operador === '-' ? 1 : 2;
    case 'menosUnario':
      return 3;
    default:
      return 4;
  }
}

/**
 * ¿La expresión termina en un comando de operador al que un operador infijo
 * posterior se le pegaría como parte de su último argumento? Recorre la columna
 * derecha: `(2 * SUMA 1 2) + 3` sin paréntesis se leería `2 * SUMA 1 (2 + 3)`.
 */
function terminaEnComandoAbierto(expresion: Expresion): boolean {
  switch (expresion.tipo) {
    case 'comandoOperador':
      return true;
    case 'expresionAritmetica':
      return terminaEnComandoAbierto(expresion.derecha);
    case 'menosUnario':
      return terminaEnComandoAbierto(expresion.operando);
    default:
      return false;
  }
}

function entreParentesis(texto: string): string {
  return `(${texto})`;
}

function imprimirExpresion(expresion: Expresion, opciones: OpcionesImpresion): string {
  switch (expresion.tipo) {
    case 'numeroLiteral':
      if (!Number.isFinite(expresion.valor) || expresion.valor < 0 || Object.is(expresion.valor, -0)) {
        lanzarNoImprimible();
      }
      // `String` da la representación más corta que redondea al mismo doble:
      // punto decimal, sin `+`, sin ceros finales.
      return opciones.hueco !== undefined ? opciones.hueco : String(expresion.valor);
    case 'palabraLiteral':
      return '"' + expresion.valor;
    case 'referenciaParametro':
      return ':' + expresion.nombre;
    case 'menosUnario': {
      const operando = imprimirExpresion(expresion.operando, opciones);
      // Un operando binario o también unario necesita paréntesis: `-(1 + 2)`, `-(-5)`.
      return precedencia(expresion.operando) <= 3 ? '-' + entreParentesis(operando) : '-' + operando;
    }
    case 'comandoOperador': {
      const busqueda = buscarComando(expresion.nombre);
      if (!busqueda.hallada) {
        lanzarNoImprimible();
      }
      return [busqueda.entrada.nombre, ...argumentosDeInstruccion(expresion.argumentos, opciones)].join(' ');
    }
    case 'expresionAritmetica': {
      if (expresion.operador !== '+' && expresion.operador !== '-' && expresion.operador !== '*' && expresion.operador !== '/') {
        lanzarNoImprimible();
      }
      const propia = precedencia(expresion);
      let izquierda = imprimirExpresion(expresion.izquierda, opciones);
      if (precedencia(expresion.izquierda) < propia || terminaEnComandoAbierto(expresion.izquierda)) {
        izquierda = entreParentesis(izquierda);
      }
      let derecha = imprimirExpresion(expresion.derecha, opciones);
      // Operando derecho de igual precedencia: la asociatividad es izquierda.
      if (precedencia(expresion.derecha) <= propia) {
        derecha = entreParentesis(derecha);
      }
      return `${izquierda} ${expresion.operador} ${derecha}`;
    }
  }
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
 * nodo no imprimible, sin devolver texto parcial. Nunca escapa.
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
