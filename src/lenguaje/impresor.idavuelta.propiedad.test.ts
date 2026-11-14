// Property 1 de la spec 05: ida y vuelta entre impresor y parser.
//
// Los programas se generan como AST válidos de los mundos 0 a 4 (`arbPrograma`), se
// imprimen y se vuelven a analizar. Lo que se compara es el AST sin posiciones: el
// texto puede cambiar de mayúsculas y acentos, el programa no.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { imprimir } from './impresor.js';
import { analizar } from './parser.js';
import { analizarLexico } from './lexer.js';
import type { Programa } from './ast.js';
import {
  arbEscrituraVariada, arbPrograma, sinPosiciones, type MundoGenerable,
} from '../pruebas/arbitrarios.js';

const MUNDOS: readonly MundoGenerable[] = [0, 1, 2, 3, 4];

function analizarTexto(texto: string, mundo: MundoGenerable) {
  const lexico = analizarLexico(texto);
  return { lexico: lexico.errores, ...analizar(lexico.tokens, { mundo }) };
}

function textoDe(programa: Programa): string {
  const resultado = imprimir(programa);
  if (!resultado.exito) throw new Error(`no se pudo imprimir: ${resultado.error.mensaje}`);
  return resultado.texto;
}

/** Un programa junto con su mundo, para analizarlo con el vocabulario de ese mundo. */
const arbProgramaConMundo = fc.constantFrom(...MUNDOS).chain((mundo) =>
  arbPrograma(mundo).map((programa) => ({ mundo, programa })),
);

/** La misma equivalencia que `toEqual`, que ignora claves con `undefined`, sin fallar la prueba. */
function equivalentes(a: unknown, b: unknown): boolean {
  try {
    expect(a).toEqual(b);
    return true;
  } catch {
    return false;
  }
}

/** Pares `(` `)` emparejados del texto, como índices. Los colores usan `[ ]`, no cuentan. */
function paresDeParentesis(texto: string): [number, number][] {
  const pila: number[] = [];
  const pares: [number, number][] = [];
  [...texto].forEach((c, i) => {
    if (c === '(') pila.push(i);
    else if (c === ')') pares.push([pila.pop()!, i]);
  });
  return pares;
}

describe('Property 1: ida y vuelta entre impresor y parser', () => {
  it('analizar lo impreso, escrito con mayúsculas y acentos arbitrarios, da el mismo AST', () => {
    /** **Validates: Requirements 1.1, 1.2, 3.5, 3.15, 5.4, 5.7, 14.5, 14.6** */
    fc.assert(
      fc.property(
        arbProgramaConMundo.chain(({ mundo, programa }) => {
          const texto = textoDe(programa);
          return arbEscrituraVariada(texto).map((variado) => ({ mundo, programa, texto, variado }));
        }),
        ({ mundo, programa, texto, variado }) => {
          const original = sinPosiciones(programa);

          const canonico = analizarTexto(texto, mundo);
          expect(canonico.lexico).toEqual([]);
          expect(canonico.errores).toEqual([]);
          expect(sinPosiciones(canonico.programa)).toEqual(original);

          const releido = analizarTexto(variado, mundo);
          expect(releido.lexico).toEqual([]);
          expect(releido.errores).toEqual([]);
          expect(sinPosiciones(releido.programa)).toEqual(original);

          // Imprimir el AST releído da exactamente el mismo texto: el formato es un punto fijo.
          expect(textoDe(releido.programa!)).toBe(texto);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('cada par de paréntesis impreso es necesario, salvo el del menos unario sobre otro menos unario', () => {
    /** **Validates: Requirements 14.3, 14.5** */
    fc.assert(
      fc.property(arbProgramaConMundo, ({ mundo, programa }) => {
        const texto = textoDe(programa);
        const original = sinPosiciones(programa);
        for (const [abre, cierra] of paresDeParentesis(texto)) {
          const sinPar = texto.slice(0, abre) + texto.slice(abre + 1, cierra) + texto.slice(cierra + 1);
          const resultado = analizarTexto(sinPar, mundo);
          const mismoAst = resultado.lexico.length === 0 && resultado.errores.length === 0
            && equivalentes(sinPosiciones(resultado.programa), original);
          if (!mismoAst) continue;
          // `-(-5)` es una regla escrita del diseño (D1): se conserva aunque `--5` diga lo mismo.
          const interior = texto.slice(abre + 1, cierra);
          expect({ sinPar, antes: texto[abre - 1], interior: interior[0] }).toEqual({
            sinPar, antes: '-', interior: '-',
          });
        }
      }),
      { numRuns: 300 },
    );
  });
});
