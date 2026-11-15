// Property 3 de la spec 05: los comandos de operador equivalen a los infijos.
//
// `SUMA a b` tiene que ser `a + b` bit a bit, no «casi»: el jugador puede escribir
// cualquiera de las dos formas y la tortuga tiene que dibujar lo mismo. Se compara con
// `Object.is` para que tampoco se cuele una diferencia entre 0 y -0.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { ComandoOperador, Expresion, ExpresionAritmetica } from './ast.js';
import { evaluar, type ContextoEvaluacion, type ResultadoEvaluacion } from './evaluador.js';
import { arbExpresion } from '../pruebas/arbitrarios.js';

const POSICION = { linea: 1, columna: 1 } as const;

const PAREJAS = [
  ['SUMA', '+'],
  ['RESTA', '-'],
  ['PRODUCTO', '*'],
  ['COCIENTE', '/'],
] as const;

const arbPareja = fc.constantFrom(...PAREJAS);

function comando(nombre: string, a: Expresion, b: Expresion): ComandoOperador {
  return { tipo: 'comandoOperador', nombre, argumentos: [a, b], ...POSICION };
}

function infijo(operador: '+' | '-' | '*' | '/', a: Expresion, b: Expresion): ExpresionAritmetica {
  return { tipo: 'expresionAritmetica', operador, izquierda: a, derecha: b, ...POSICION };
}

function literal(valor: number): Expresion {
  return { tipo: 'numeroLiteral', valor, ...POSICION };
}

// AZAR determinista y puro: las dos formas evalúan los argumentos en el mismo orden,
// así que con la misma función reciben los mismos valores.
const contextoCon = (valores: ReadonlyMap<string, number>): ContextoEvaluacion => ({
  valores,
  linea: 1,
  azar: (n) => Math.ceil(n / 2),
});

/** Resultado comparable: el valor exacto o solo el id del error. */
function resumen(r: ResultadoEvaluacion): { exito: true; valor: number } | { exito: false; id: string } {
  return r.exito ? { exito: true, valor: r.valor } : { exito: false, id: r.error.id };
}

function mismosResultados(comandoR: ResultadoEvaluacion, infijoR: ResultadoEvaluacion): void {
  const c = resumen(comandoR);
  const i = resumen(infijoR);
  expect(c).toEqual(i);
  if (c.exito && i.exito) expect(Object.is(c.valor, i.valor)).toBe(true);
}

const arbFinito = fc.double({ noNaN: true, noDefaultInfinity: true });

const PARAMETROS = ['lado', 'n', 'x'] as const;
const arbValores = fc
  .tuple(...PARAMETROS.map(() => fc.oneof(fc.integer({ min: -50, max: 50 }), arbFinito)))
  .map((vs) => new Map(PARAMETROS.map((p, i) => [p, vs[i]!])));

describe('Property 3: los comandos de operador equivalen a los infijos', () => {
  it('con dos números finitos, el comando y el infijo dan exactamente el mismo valor', () => {
    /** **Validates: Requirements 5.2** */
    fc.assert(
      fc.property(arbPareja, arbFinito, arbFinito, ([nombre, operador], a, b) => {
        fc.pre(!(operador === '/' && b === 0));
        const contexto = contextoCon(new Map());
        const r = evaluar(comando(nombre, literal(a), literal(b)), contexto);
        // El resultado esperado es la operación de JavaScript misma; si desborda,
        // las dos formas deben fallar igual, y eso lo cubre la siguiente comparación.
        const esperado = { '+': a + b, '-': a - b, '*': a * b, '/': a / b }[operador];
        if (Number.isFinite(esperado)) {
          expect(r.exito).toBe(true);
          if (r.exito) expect(Object.is(r.valor, esperado)).toBe(true);
        }
        mismosResultados(r, evaluar(infijo(operador, literal(a), literal(b)), contexto));
      }),
      { numRuns: 500 },
    );
  });

  it('COCIENTE entre cero falla igual que la división infija, también con -0', () => {
    /** **Validates: Requirements 5.2** */
    fc.assert(
      fc.property(arbFinito, fc.constantFrom(0, -0), (a, cero) => {
        const contexto = contextoCon(new Map());
        const r = evaluar(comando('COCIENTE', literal(a), literal(cero)), contexto);
        expect(r.exito).toBe(false);
        if (!r.exito) expect(r.error.id).toBe('divisionPorCero');
        mismosResultados(r, evaluar(infijo('/', literal(a), literal(cero)), contexto));
      }),
      { numRuns: 100 },
    );
  });

  it('con cualquier expresión como argumento, incluidos otros comandos, coinciden valor y error', () => {
    /** **Validates: Requirements 5.2, 5.3** */
    const opciones = { parametros: PARAMETROS, incluirAzar: true };
    fc.assert(
      fc.property(
        arbPareja,
        arbExpresion(3, opciones),
        arbExpresion(3, opciones),
        arbValores,
        ([nombre, operador], a, b, valores) => {
          const contexto = contextoCon(valores);
          mismosResultados(
            evaluar(comando(nombre, a, b), contexto),
            evaluar(infijo(operador, a, b), contexto),
          );
        },
      ),
      { numRuns: 500 },
    );
  });

  it('reemplazar cada infijo por su comando dentro de una expresión no cambia el resultado', () => {
    /** **Validates: Requirements 5.3** */
    const COMANDO_DE: Readonly<Record<string, string>> = { '+': 'SUMA', '-': 'RESTA', '*': 'PRODUCTO', '/': 'COCIENTE' };
    const aComandos = (e: Expresion): Expresion => {
      switch (e.tipo) {
        case 'expresionAritmetica': {
          const nombre = COMANDO_DE[e.operador];
          const izquierda = aComandos(e.izquierda);
          const derecha = aComandos(e.derecha);
          return nombre === undefined
            ? { ...e, izquierda, derecha }
            : comando(nombre, izquierda, derecha);
        }
        case 'menosUnario':
          return { ...e, operando: aComandos(e.operando) };
        case 'comandoOperador':
          return { ...e, argumentos: e.argumentos.map(aComandos) };
        default:
          return e;
      }
    };
    fc.assert(
      fc.property(
        arbExpresion(4, { parametros: PARAMETROS, incluirAzar: true }),
        arbValores,
        (expresion, valores) => {
          const contexto = contextoCon(valores);
          mismosResultados(evaluar(aComandos(expresion), contexto), evaluar(expresion, contexto));
        },
      ),
      { numRuns: 300 },
    );
  });
});
