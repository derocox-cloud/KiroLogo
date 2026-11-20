// Evaluador de expresiones de KiroLogo (mundo 4). Módulo puro: solo importa errores y tipos del AST.
// Doble precisión y sin redondeo intermedio; de izquierda a derecha, así que gana el error de la izquierda.

import type { Expresion } from './ast.js';
import { crearError, type ErrorKiroLogo } from './errores.js';

export interface ContextoEvaluacion {
  readonly valores: ReadonlyMap<string, number>;
  readonly linea: number;
  readonly azar: (n: number) => number;
  /**
   * Ejecuta un procedimiento propio que devuelve un valor (`DEVUELVE`). El evaluador no sabe
   * ejecutar instrucciones: quien lo invoca (el intérprete) resuelve la llamada y devuelve el valor
   * o el error que cortó la ejecución. Sin esta función, una llamada con valor no se puede evaluar.
   */
  readonly llamar?: (nombre: string, argumentos: readonly number[], linea: number) => ResultadoEvaluacion;
}

export type ResultadoEvaluacion =
  | { readonly exito: true; readonly valor: number }
  | { readonly exito: false; readonly error: ErrorKiroLogo };

// Semántica de los comandos binarios con valor. AZAR se trata aparte: tiene un argumento y un efecto.
const OPERADORES: Readonly<Record<string, (a: number, b: number) => number>> = {
  SUMA: (a, b) => a + b,
  RESTA: (a, b) => a - b,
  PRODUCTO: (a, b) => a * b,
  COCIENTE: (a, b) => a / b,
  RESTO: (a, b) => a % b,
};

const INFIJOS: Readonly<Record<string, (a: number, b: number) => number>> = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
};

// Dos valores que difieren menos que esto son iguales: `0.1 + 0.2 = 0.3` tiene que ser cierto.
const TOLERANCIA_COMPARACION = 1e-9;

/** Comparaciones de las condiciones (mundo 5). Valen 1 si son ciertas y 0 si no. */
export function comparar(operador: '=' | '<' | '>', a: number, b: number): boolean {
  const iguales = Math.abs(a - b) < TOLERANCIA_COMPARACION;
  if (operador === '=') return iguales;
  return operador === '<' ? a < b && !iguales : a > b && !iguales;
}

// Divisores que exigen comprobar el cero antes de operar.
const DIVISORES = new Set(['/', 'COCIENTE', 'RESTO']);

export const NOMBRES_DE_OPERADORES: readonly string[] = Object.keys(OPERADORES);

function fallo(error: ErrorKiroLogo): ResultadoEvaluacion {
  return { exito: false, error };
}

function ok(valor: number): ResultadoEvaluacion {
  return { exito: true, valor };
}

function noImplementado(contexto: ContextoEvaluacion, columna?: number): ResultadoEvaluacion {
  return fallo(crearError('nodoNoImplementado', { linea: contexto.linea }, { linea: contexto.linea, columna }));
}

function aplicarBinario(
  clave: string,
  operacion: (a: number, b: number) => number,
  izquierda: Expresion,
  derecha: Expresion,
  contexto: ContextoEvaluacion,
  columna: number,
): ResultadoEvaluacion {
  const a = evaluar(izquierda, contexto);
  if (!a.exito) return a;
  const b = evaluar(derecha, contexto);
  if (!b.exito) return b;
  const posicion = { linea: contexto.linea, columna };
  // `=== 0` también cubre -0.
  if (DIVISORES.has(clave) && b.valor === 0) {
    return fallo(crearError('divisionPorCero', { linea: contexto.linea }, posicion));
  }
  const resultado = operacion(a.valor, b.valor);
  if (!Number.isFinite(resultado)) {
    return fallo(crearError('numeroFueraDeRango', { linea: contexto.linea }, posicion));
  }
  return ok(resultado);
}

export function evaluar(expresion: Expresion, contexto: ContextoEvaluacion): ResultadoEvaluacion {
  switch (expresion.tipo) {
    case 'numeroLiteral':
      return ok(expresion.valor);
    case 'referenciaParametro': {
      const valor = contexto.valores.get(expresion.nombre.toLowerCase());
      if (valor === undefined) {
        return fallo(
          crearError('variableNoDefinida', { nombre: ':' + expresion.nombre.replace(/^:/, '') }, {
            linea: contexto.linea,
            columna: expresion.columna,
          }),
        );
      }
      return ok(valor);
    }
    case 'menosUnario': {
      const r = evaluar(expresion.operando, contexto);
      return r.exito ? ok(-r.valor) : r;
    }
    case 'expresionAritmetica': {
      if (expresion.operador === '=' || expresion.operador === '<' || expresion.operador === '>') {
        const a = evaluar(expresion.izquierda, contexto);
        if (!a.exito) return a;
        const b = evaluar(expresion.derecha, contexto);
        if (!b.exito) return b;
        return ok(comparar(expresion.operador, a.valor, b.valor) ? 1 : 0);
      }
      const operacion = INFIJOS[expresion.operador];
      if (operacion === undefined) return noImplementado(contexto, expresion.columna);
      return aplicarBinario(expresion.operador, operacion, expresion.izquierda, expresion.derecha, contexto, expresion.columna);
    }
    case 'comandoOperador': {
      if (expresion.nombre === 'AZAR') {
        if (expresion.argumentos.length !== 1) return noImplementado(contexto, expresion.columna);
        const n = evaluar(expresion.argumentos[0]!, contexto);
        if (!n.exito) return n;
        if (!Number.isInteger(n.valor) || n.valor < 1) {
          return fallo(
            crearError('azarRangoInvalido', { linea: contexto.linea, valor: n.valor }, {
              linea: contexto.linea,
              columna: expresion.columna,
            }),
          );
        }
        return ok(contexto.azar(n.valor));
      }
      const operacion = OPERADORES[expresion.nombre];
      if (operacion === undefined || expresion.argumentos.length !== 2) {
        return noImplementado(contexto, expresion.columna);
      }
      return aplicarBinario(
        expresion.nombre,
        operacion,
        expresion.argumentos[0]!,
        expresion.argumentos[1]!,
        contexto,
        expresion.columna,
      );
    }
    case 'llamadaConValor': {
      if (contexto.llamar === undefined) return noImplementado(contexto, expresion.columna);
      const valores: number[] = [];
      for (const argumento of expresion.argumentos) {
        const r = evaluar(argumento, contexto);
        if (!r.exito) return r;
        valores.push(r.valor);
      }
      return contexto.llamar(expresion.nombre, valores, expresion.linea);
    }
    case 'palabraLiteral':
      return noImplementado(contexto, expresion.columna);
  }
}

/** Texto de un número: hasta 4 decimales, sin ceros finales y sin «-0». */
export function formatearNumero(valor: number): string {
  const texto = valor.toFixed(4);
  if (texto.includes('e')) return texto;
  const recortado = texto.replace(/\.?0+$/, '');
  return recortado === '-0' || recortado === '' ? '0' : recortado;
}

const TOLERANCIA_REPETICIONES = 1e-9;

/** Cantidad entera de un REPITE, o null si el valor no es un entero no negativo (con tolerancia). */
export function cantidadDeRepeticiones(valor: number): number | null {
  if (!Number.isFinite(valor)) return null;
  const r = Math.round(valor);
  return Math.abs(valor - r) < TOLERANCIA_REPETICIONES && r >= 0 ? (r === 0 ? 0 : r) : null;
}
