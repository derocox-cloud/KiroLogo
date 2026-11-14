// Property 13 de la spec 05: el conteo no depende de las expresiones.
//
// La sustitución se hace sobre el AST: cada argumento de una instrucción (y la cantidad de
// cada REPITE) se cambia por una expresión generada, y el programa «original» lleva en ese
// lugar el número literal que esa expresión vale según el modelo de pila. Así los dos
// programas son el mismo salvo por cómo está escrito cada número, que es justo lo que el
// conteo no debe mirar.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { contarInstrucciones } from './conteo.js';
import { imprimir } from './impresor.js';
import { analizar } from './parser.js';
import { analizarLexico } from './lexer.js';
import type { Expresion, Instruccion, InvocacionComando, Programa } from './ast.js';
import { VOCABULARIO } from './vocabulario.js';
import { arbExpresion, arbPrograma, modeloEvaluar, type MundoGenerable } from '../pruebas/arbitrarios.js';

const POSICION = { linea: 1, columna: 1 } as const;

// Las expresiones pueden nombrar estos parámetros; su valor se fija para que «igual valor»
// tenga sentido. Al conteo no le importa si el parámetro está en ámbito: solo mira el AST.
const PARAMETROS = ['lado', 'n'] as const;
const VALORES = new Map<string, number>([['lado', 40], ['n', 6]]);
// AZAR se evalúa con una tirada fija: la equivalencia es para esa tirada.
const azarFijo = (cota: number): number => cota - 1;

const arbSustituta = arbExpresion(3, { parametros: PARAMETROS, divisoresSeguros: true, incluirAzar: true });

const ESCRIBIBLES = VOCABULARIO.filter((e) => e.tiposArgumento[0] === 'valorEscribible').map((e) => e.nombre);

function contar(programa: Programa): number {
  const resultado = contarInstrucciones(programa);
  if (!resultado.exito) throw new Error(`conteo fallido: ${resultado.error.id}`);
  return resultado.instrucciones;
}

const numero = (valor: number): Expresion => ({ tipo: 'numeroLiteral', valor, ...POSICION });

/**
 * Recorre el programa y, en cada argumento, toma la siguiente expresión de la reserva
 * (en ciclo). Devuelve el programa con las expresiones y el mismo programa con el
 * número literal que vale cada una. Si una expresión no da número (AZAR con cota no
 * entera, por ejemplo), ese argumento queda como estaba en los dos.
 */
function sustituir(programa: Programa, reserva: readonly Expresion[]): { conExpresiones: Programa; conNumeros: Programa } {
  let siguiente = 0;
  const par = (actual: Expresion): [Expresion, Expresion] => {
    const expresion = reserva[siguiente++ % reserva.length]!;
    const valor = modeloEvaluar(expresion, VALORES, azarFijo);
    return valor.exito ? [expresion, numero(valor.valor)] : [actual, actual];
  };
  const argumentos = (lista: readonly Expresion[]): [Expresion[], Expresion[]] => {
    const a: Expresion[] = [];
    const b: Expresion[] = [];
    for (const actual of lista) {
      const [x, y] = par(actual);
      a.push(x);
      b.push(y);
    }
    return [a, b];
  };
  const lista = (instrucciones: readonly Instruccion[]): [Instruccion[], Instruccion[]] => {
    const a: Instruccion[] = [];
    const b: Instruccion[] = [];
    for (const instruccion of instrucciones) {
      const [x, y] = nodo(instruccion);
      a.push(x);
      b.push(y);
    }
    return [a, b];
  };
  const nodo = (instruccion: Instruccion): [Instruccion, Instruccion] => {
    switch (instruccion.tipo) {
      case 'invocacionComando':
      case 'invocacionProcedimiento': {
        const [a, b] = argumentos(instruccion.argumentos);
        return [{ ...instruccion, argumentos: a }, { ...instruccion, argumentos: b }];
      }
      case 'repeticion': {
        const [vecesA, vecesB] = par(instruccion.veces);
        const [a, b] = lista(instruccion.cuerpo);
        return [{ ...instruccion, veces: vecesA, cuerpo: a }, { ...instruccion, veces: vecesB, cuerpo: b }];
      }
      case 'definicionProcedimiento': {
        const [a, b] = lista(instruccion.cuerpo);
        return [{ ...instruccion, cuerpo: a }, { ...instruccion, cuerpo: b }];
      }
      default:
        return [instruccion, instruccion];
    }
  };
  const [a, b] = lista(programa.instrucciones);
  return { conExpresiones: { ...programa, instrucciones: a }, conNumeros: { ...programa, instrucciones: b } };
}

const arbMundo = fc.constantFrom<MundoGenerable>(0, 1, 2, 3, 4);

describe('Property 13: el conteo no depende de las expresiones', () => {
  it('cambiar cada argumento numérico por una expresión de igual valor no cambia el conteo', () => {
    /** **Validates: Requirements 13.1, 13.4** */
    fc.assert(
      fc.property(
        arbMundo.chain((mundo) => arbPrograma(mundo)),
        fc.array(arbSustituta, { minLength: 1, maxLength: 20 }),
        (programa, reserva) => {
          const { conExpresiones, conNumeros } = sustituir(programa, reserva);
          const base = contar(programa);
          expect(contar(conNumeros)).toBe(base);
          expect(contar(conExpresiones)).toBe(base);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('cada ESCRIBE y cada ROTULA suman exactamente 1, sea cual sea su argumento', () => {
    /** **Validates: Requirements 13.2** */
    const arbValor: fc.Arbitrary<Expresion> = fc.oneof(
      arbExpresion(5, { parametros: PARAMETROS, incluirAzar: true }),
      fc.string({ minLength: 1, maxLength: 40 }).map((valor): Expresion => ({ tipo: 'palabraLiteral', valor, ...POSICION })),
    );
    const arbTexto = fc.tuple(fc.constantFrom(...ESCRIBIBLES), arbValor).map(
      ([nombre, valor]): InvocacionComando => ({ tipo: 'invocacionComando', nombre, argumentos: [valor], ...POSICION }),
    );
    fc.assert(
      fc.property(
        arbPrograma(4),
        fc.array(fc.tuple(arbTexto, fc.nat()), { maxLength: 8 }),
        (programa, insertos) => {
          const instrucciones: Instruccion[] = [...programa.instrucciones];
          for (const [texto, lugar] of insertos) {
            instrucciones.splice(lugar % (instrucciones.length + 1), 0, texto);
          }
          expect(contar({ ...programa, instrucciones })).toBe(contar(programa) + insertos.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('AVANZA con una expresión escrita como texto cuenta 1, lo mismo que AVANZA 100', () => {
    /** **Validates: Requirements 13.1, 13.4** */
    const arbSinParametros = arbExpresion(3, { divisoresSeguros: true });
    const contarTexto = (texto: string): number => {
      const { programa, errores } = analizar(analizarLexico(texto).tokens, { mundo: 4 });
      expect(errores).toEqual([]);
      return contar(programa!);
    };
    fc.assert(
      fc.property(arbSinParametros, (expresion) => {
        const impreso = imprimir({
          tipo: 'programa',
          instrucciones: [{ tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [expresion], ...POSICION }],
        });
        expect(impreso.exito).toBe(true);
        if (!impreso.exito) return;
        expect(contarTexto(impreso.texto)).toBe(1);
      }),
      { numRuns: 200 },
    );
    expect(contarTexto('AVANZA 100')).toBe(1);
    expect(contarTexto('AVANZA 50 + 50')).toBe(1);
    expect(contarTexto('AVANZA SUMA 50 50')).toBe(1);
  });
});
