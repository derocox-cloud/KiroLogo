// Property 25: los retos del mundo 4 son reproducibles por semilla (spec 05, D12).
//
// Un reto se identifica por (nivel, semilla). Resolverlo dos veces, o reproducirlo desde el
// código corto que ve el jugador, tiene que dar exactamente el mismo reto: si no, el código
// compartido para pedir ayuda o reportar un error describiría otra figura. «Otro reto», a su
// vez, nunca puede devolver la semilla actual, sea cual sea la fuente de entropía.
//
// **Validates: Requirements 20.9, 25.2, 25.3, 25.5, 27.8**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { resolverReto, type Reto } from './reto.js';
import { codificar, decodificar, LARGO_CODIGO } from '../azar/codigo-semilla.js';
import { semillaDistinta, type FuenteEntropia } from '../azar/entropia.js';
import { SEMILLA_MAXIMA, SEMILLA_MINIMA } from '../azar/prng.js';

const NIVELES_GENERADOS_M4 = ['4.2', '4.3', '4.4'] as const;

const arbSemilla = fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA });

function retoDe(idNivel: string, semilla: number): Reto {
  const resultado = resolverReto(idNivel, semilla);
  if (!resultado.exito) {
    throw new Error(`El reto ${idNivel} con semilla ${semilla} no se resolvió: ${resultado.error.id}`);
  }
  return resultado.reto;
}

function esperarMismoReto(a: Reto, b: Reto): void {
  expect(b.semillaEfectiva).toBe(a.semillaEfectiva);
  expect(b.codigoSemilla).toBe(a.codigoSemilla);
  expect(b.referencia).toStrictEqual(a.referencia);
  expect(b.presupuestoEstrella).toBe(a.presupuestoEstrella);
  expect(b.limiteDuro).toBe(a.limiteDuro);
  expect(b.limiteDuroActivo).toBe(a.limiteDuroActivo);
}

describe('Property 25: los retos del mundo 4 son reproducibles por semilla', () => {
  for (const idNivel of NIVELES_GENERADOS_M4) {
    describe(`nivel ${idNivel}`, () => {
      it('resolver dos veces la misma semilla da el mismo reto', () => {
        fc.assert(
          fc.property(arbSemilla, (semilla) => {
            esperarMismoReto(retoDe(idNivel, semilla), retoDe(idNivel, semilla));
          }),
          { numRuns: 100 },
        );
      });

      it('el código mostrado es el de codificar y reproduce el mismo reto', () => {
        fc.assert(
          fc.property(arbSemilla, (semilla) => {
            const original = retoDe(idNivel, semilla);

            const codificado = codificar(original.semillaEfectiva);
            expect(codificado.exito).toBe(true);
            if (!codificado.exito) return;
            expect(original.codigoSemilla).toBe(codificado.codigo);
            expect(original.codigoSemilla).toHaveLength(LARGO_CODIGO);

            const decodificado = decodificar(original.codigoSemilla);
            expect(decodificado.exito).toBe(true);
            if (!decodificado.exito) return;
            expect(decodificado.semilla).toBe(original.semillaEfectiva);

            esperarMismoReto(original, retoDe(idNivel, decodificado.semilla));
          }),
          { numRuns: 100 },
        );
      });

      it('semillas distintas producen al menos dos referencias distintas', () => {
        fc.assert(
          fc.property(
            fc.uniqueArray(arbSemilla, { minLength: 8, maxLength: 8 }),
            (semillas) => {
              const referencias = semillas.map((s) => JSON.stringify(retoDe(idNivel, s).referencia));
              expect(new Set(referencias).size).toBeGreaterThanOrEqual(2);
            },
          ),
          { numRuns: 25 },
        );
      });
    });
  }

  it('«otro reto» elige una semilla distinta de la actual y dentro del dominio', () => {
    // La fuente entrega una secuencia arbitraria: valores válidos, la semilla actual repetida,
    // y basura (negativos, fuera de rango, no enteros, NaN). Agotada la secuencia, repite la
    // actual, que es el peor caso para el reintento.
    const arbValorFuente = (actual: number) =>
      fc.oneof(
        arbSemilla,
        fc.constant(actual),
        fc.integer({ min: -1000, max: -1 }),
        fc.constant(SEMILLA_MAXIMA + 1),
        fc.double(),
        fc.constant(Number.NaN),
      );

    fc.assert(
      fc.property(
        arbSemilla.chain((actual) =>
          fc.tuple(fc.constant(actual), fc.array(arbValorFuente(actual), { maxLength: 12 })),
        ),
        ([actual, valores]) => {
          let i = 0;
          const fuente: FuenteEntropia = () => (i < valores.length ? valores[i++]! : actual);
          const nueva = semillaDistinta(fuente, actual);
          expect(nueva).not.toBe(actual);
          expect(Number.isInteger(nueva)).toBe(true);
          expect(nueva).toBeGreaterThanOrEqual(SEMILLA_MINIMA);
          expect(nueva).toBeLessThanOrEqual(SEMILLA_MAXIMA);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('una fuente que siempre repite la semilla máxima no la devuelve', () => {
    expect(semillaDistinta(() => SEMILLA_MAXIMA, SEMILLA_MAXIMA)).toBe(SEMILLA_MINIMA);
  });
});
