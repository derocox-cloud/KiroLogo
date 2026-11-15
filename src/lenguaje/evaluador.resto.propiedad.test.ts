// Property 4 de la spec 05: RESTO y COCIENTE.
//
// RESTO sigue el signo del dividendo (como `%` de JavaScript) y COCIENTE es la división
// real, sin truncar. Los enteros se acotan a 32 bits: así `trunc(a / b) * b` es exacto en
// doble precisión y la identidad de la división se puede comprobar sin tolerancia.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { evaluar, type ContextoEvaluacion } from './evaluador.js';
import type { ComandoOperador, Expresion, NumeroLiteral } from './ast.js';
import { arbExpresion } from '../pruebas/arbitrarios.js';

const CONTEXTO: ContextoEvaluacion = { valores: new Map(), linea: 1, azar: () => 0 };

const literal = (valor: number): NumeroLiteral => ({ tipo: 'numeroLiteral', valor, linea: 1, columna: 1 });

const comando = (nombre: string, a: Expresion, b: Expresion): ComandoOperador => ({
  tipo: 'comandoOperador', nombre, argumentos: [a, b], linea: 1, columna: 1,
});

function valorDe(expresion: Expresion): number {
  const r = evaluar(expresion, CONTEXTO);
  if (!r.exito) throw new Error(`Se esperaba un valor y hubo el error ${r.error.id}`);
  return r.valor;
}

const arbEntero = fc.integer({ min: -(2 ** 31), max: 2 ** 31 - 1 });
const arbDivisor = arbEntero.filter((b) => b !== 0);

describe('Property 4: RESTO y COCIENTE', () => {
  /** **Validates: Requirements 4.8, 4.9, 5.2** */
  it('RESTO a b es 0 o tiene el signo de a, |RESTO a b| < |b| y a = trunc(a / b) * b + RESTO a b', () => {
    fc.assert(
      fc.property(arbEntero, arbDivisor, (a, b) => {
        const resto = valorDe(comando('RESTO', literal(a), literal(b)));
        expect(resto === 0 || Math.sign(resto) === Math.sign(a)).toBe(true);
        expect(Math.abs(resto)).toBeLessThan(Math.abs(b));
        expect(Math.trunc(a / b) * b + resto).toBe(a);
      }),
    );
  });

  /** **Validates: Requirements 4.9, 5.2** */
  it('COCIENTE a b es la división real sin truncar', () => {
    fc.assert(
      fc.property(arbEntero, arbDivisor, (a, b) => {
        expect(valorDe(comando('COCIENTE', literal(a), literal(b)))).toBe(a / b);
      }),
    );
    expect(valorDe(comando('COCIENTE', literal(7), literal(2)))).toBe(3.5);
  });

  /** **Validates: Requirements 4.9, 5.2** */
  it('COCIENTE con expresiones como argumentos divide sus valores sin truncar', () => {
    const arb = arbExpresion(2, { divisoresSeguros: true });
    fc.assert(
      fc.property(arb, arb, (a, b) => {
        const va = valorDe(a);
        const vb = valorDe(b);
        fc.pre(vb !== 0 && Number.isFinite(va / vb));
        expect(valorDe(comando('COCIENTE', a, b))).toBe(va / vb);
      }),
    );
  });
});
