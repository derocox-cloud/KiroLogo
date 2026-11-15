// Auto-comprobación de los generadores compartidos y del modelo independiente.
// Si un generador produce algo inválido, las propiedades que lo usan fallarían por
// culpa del generador y no del código bajo prueba: estas pruebas lo descartan antes.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Expresion } from '../lenguaje/ast.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { imprimir } from '../lenguaje/impresor.js';
import {
  arbEscrituraVariada,
  arbExpresion,
  arbPrograma,
  modeloEvaluar,
  sinPosiciones,
  type MundoGenerable,
} from './arbitrarios.js';

const P = { linea: 1, columna: 1 } as const;
const n = (valor: number): Expresion => ({ tipo: 'numeroLiteral', valor, ...P });
const ref = (nombre: string): Expresion => ({ tipo: 'referenciaParametro', nombre, ...P });
const op = (operador: '+' | '-' | '*' | '/' | '=', izquierda: Expresion, derecha: Expresion): Expresion => ({
  tipo: 'expresionAritmetica', operador, izquierda, derecha, ...P,
});
const cmd = (nombre: string, ...argumentos: Expresion[]): Expresion => ({
  tipo: 'comandoOperador', nombre, argumentos, ...P,
});
const menos = (operando: Expresion): Expresion => ({ tipo: 'menosUnario', operando, ...P });

describe('modeloEvaluar', () => {
  it('asocia a la izquierda y respeta la precedencia', () => {
    expect(modeloEvaluar(op('-', op('-', n(10), n(3)), n(2)))).toEqual({ exito: true, valor: 5 });
    expect(modeloEvaluar(op('+', n(1), op('*', n(2), n(3))))).toEqual({ exito: true, valor: 7 });
    expect(modeloEvaluar(op('*', menos(n(2)), n(3)))).toEqual({ exito: true, valor: -6 });
    expect(modeloEvaluar(cmd('SUMA', n(1), op('*', n(2), n(3))))).toEqual({ exito: true, valor: 7 });
  });

  it('RESTO lleva el signo del dividendo y COCIENTE no trunca', () => {
    expect(modeloEvaluar(cmd('RESTO', menos(n(7)), n(3)))).toEqual({ exito: true, valor: -1 });
    expect(modeloEvaluar(cmd('COCIENTE', n(7), n(2)))).toEqual({ exito: true, valor: 3.5 });
  });

  it('lee los parámetros del entorno y reporta los que faltan', () => {
    const valores = new Map([['lados', 6]]);
    expect(modeloEvaluar(op('/', n(360), ref('lados')), valores)).toEqual({ exito: true, valor: 60 });
    expect(modeloEvaluar(ref('largo'), valores)).toEqual({ exito: false, id: 'variableNoDefinida' });
  });

  it('da el id del primer error de izquierda a derecha', () => {
    expect(modeloEvaluar(op('/', n(1), menos(n(0))))).toEqual({ exito: false, id: 'divisionPorCero' });
    expect(modeloEvaluar(op('*', n(1e308), n(10)))).toEqual({ exito: false, id: 'numeroFueraDeRango' });
    expect(modeloEvaluar(op('+', op('/', n(1), n(0)), ref('x')))).toEqual({ exito: false, id: 'divisionPorCero' });
    expect(modeloEvaluar(op('+', ref('x'), op('/', n(1), n(0))))).toEqual({ exito: false, id: 'variableNoDefinida' });
    // `=` se rechaza sin evaluar sus operandos, como en el evaluador.
    expect(modeloEvaluar(op('=', op('/', n(1), n(0)), n(1)))).toEqual({ exito: false, id: 'nodoNoImplementado' });
    expect(modeloEvaluar({ tipo: 'palabraLiteral', valor: 'hola', ...P })).toEqual({ exito: false, id: 'nodoNoImplementado' });
  });

  it('AZAR valida la cota y usa el azar recibido', () => {
    const cotas: number[] = [];
    const azar = (cota: number): number => { cotas.push(cota); return cota - 1; };
    expect(modeloEvaluar(cmd('AZAR', n(6)), new Map(), azar)).toEqual({ exito: true, valor: 5 });
    expect(cotas).toEqual([6]);
    expect(modeloEvaluar(cmd('AZAR', n(0.5)), new Map(), azar)).toEqual({ exito: false, id: 'azarRangoInvalido' });
  });
});

describe('arbExpresion', () => {
  it('con divisores seguros nunca divide entre cero y solo usa los parámetros dados', () => {
    const valores = new Map([['a', 0], ['b', 0]]);
    const muestras = fc.sample(arbExpresion(3, { parametros: ['a', 'b'], divisoresSeguros: true }), { seed: 405, numRuns: 200 });
    for (const expresion of muestras) {
      const resultado = modeloEvaluar(expresion, valores);
      expect(resultado.exito === false && resultado.id).not.toBe('divisionPorCero');
      expect(resultado.exito === false && resultado.id).not.toBe('variableNoDefinida');
    }
  });
});

describe('arbPrograma', () => {
  const MUNDOS: readonly MundoGenerable[] = [0, 1, 2, 3, 4];

  it.each(MUNDOS)('los programas del mundo %i se imprimen y el parser los acepta sin errores', (mundo) => {
    for (const programa of fc.sample(arbPrograma(mundo), { seed: 40 + mundo, numRuns: 60 })) {
      const impreso = imprimir(programa);
      expect(impreso.exito).toBe(true);
      if (!impreso.exito) continue;
      const lexico = analizarLexico(impreso.texto);
      expect(lexico.errores, impreso.texto).toEqual([]);
      const sintactico = analizar(lexico.tokens, { mundo });
      expect(sintactico.errores, impreso.texto).toEqual([]);
    }
  });

  it('en el mundo 4 aparecen procedimientos con parámetros y expresiones', () => {
    const textos = fc.sample(arbPrograma(4), { seed: 404, numRuns: 100 }).map((p) => {
      const impreso = imprimir(p);
      return impreso.exito ? impreso.texto : '';
    });
    expect(textos.some((t) => /PARA [A-Z]+ :/.test(t))).toBe(true);
    expect(textos.some((t) => / [+\-*/] /.test(t))).toBe(true);
  });
});

describe('arbEscrituraVariada', () => {
  it('cambia mayúsculas y acentos sin cambiar los tokens, salvo las palabras con comilla', () => {
    const original = 'PARA POLIGONO :lados :largo\n  ESCRIBE "Hola\n  PONCOLOR "rojo\nFIN\n';
    const tokensDe = (texto: string) => analizarLexico(texto).tokens.map((t) => ({ tipo: t.tipo, valor: t.valor }));
    for (const variante of fc.sample(arbEscrituraVariada(original), { seed: 7, numRuns: 50 })) {
      expect(tokensDe(variante)).toEqual(tokensDe(original));
      expect(variante).toContain('"Hola');
    }
  });
});

describe('sinPosiciones', () => {
  it('quita linea y columna en todos los niveles y conserva lo demás', () => {
    const conPosiciones = op('+', { tipo: 'numeroLiteral', valor: 1, linea: 3, columna: 9 }, ref('x'));
    expect(sinPosiciones(conPosiciones)).toEqual({
      tipo: 'expresionAritmetica',
      operador: '+',
      izquierda: { tipo: 'numeroLiteral', valor: 1 },
      derecha: { tipo: 'referenciaParametro', nombre: 'x' },
    });
  });
});
