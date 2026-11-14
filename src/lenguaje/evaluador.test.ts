import { describe, expect, it } from 'vitest';
import type { Expresion } from './ast.js';
import { evaluar, formatearNumero, NOMBRES_DE_OPERADORES, type ContextoEvaluacion } from './evaluador.js';
import { VOCABULARIO } from './vocabulario.js';

const contexto: ContextoEvaluacion = { valores: new Map(), linea: 3, azar: () => 1 };

const num = (valor: number): Expresion => ({ tipo: 'numeroLiteral', valor, linea: 3, columna: 1 });
const infijo = (operador: '+' | '-' | '*' | '/', izquierda: Expresion, derecha: Expresion): Expresion => ({
  tipo: 'expresionAritmetica', operador, izquierda, derecha, linea: 3, columna: 1,
});
const operador = (nombre: string, ...argumentos: Expresion[]): Expresion => ({
  tipo: 'comandoOperador', nombre, argumentos, linea: 3, columna: 1,
});

function valorDe(expresion: Expresion): number {
  const r = evaluar(expresion, contexto);
  if (!r.exito) throw new Error(`se esperaba un valor y hubo ${r.error.id}`);
  return r.valor;
}

function errorDe(expresion: Expresion): string {
  const r = evaluar(expresion, contexto);
  if (r.exito) throw new Error(`se esperaba un error y hubo ${r.valor}`);
  return r.error.id;
}

describe('evaluador · ejemplos', () => {
  it('-0 como divisor es división por cero en /, COCIENTE y RESTO (R4.4)', () => {
    expect(errorDe(infijo('/', num(5), num(-0)))).toBe('divisionPorCero');
    expect(errorDe(operador('COCIENTE', num(5), num(-0)))).toBe('divisionPorCero');
    expect(errorDe(operador('RESTO', num(5), num(-0)))).toBe('divisionPorCero');
  });

  it('7 / 2 y COCIENTE 7 2 dan 3.5, sin truncar (R4.9)', () => {
    expect(valorDe(infijo('/', num(7), num(2)))).toBe(3.5);
    expect(valorDe(operador('COCIENTE', num(7), num(2)))).toBe(3.5);
  });

  it('RESTO lleva el signo del dividendo (R4.8)', () => {
    expect(valorDe(operador('RESTO', num(-7), num(3)))).toBe(-1);
    expect(valorDe(operador('RESTO', num(7), num(-3)))).toBe(1);
  });

  it('1e308 * 10 es número fuera de rango (R4.5)', () => {
    expect(errorDe(infijo('*', num(1e308), num(10)))).toBe('numeroFueraDeRango');
  });

  it('10 / 3 se muestra como 3.3333 (R9.2)', () => {
    expect(formatearNumero(valorDe(infijo('/', num(10), num(3))))).toBe('3.3333');
  });

  it('las claves de OPERADORES más AZAR son las entradas con produceValor (R5.2)', () => {
    const conValor = VOCABULARIO.filter((e) => e.produceValor).map((e) => e.nombre);
    expect([...NOMBRES_DE_OPERADORES, 'AZAR'].sort()).toEqual([...conValor].sort());
  });
});
