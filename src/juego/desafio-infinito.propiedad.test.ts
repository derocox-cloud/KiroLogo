// Prueba de propiedad del desafío infinito del mundo 4.
//
// **Validates: Requirements 24.6**
//
// Property 28: para toda raíz y todo índice `i`, el nivel del desafío del mundo 4
// es el `i mod 3` de `[4.2, 4.3, 4.4]`, y dos recorridos con la misma raíz
// producen la misma secuencia de niveles y de semillas.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { retoDesafio, type RetoDesafio } from './desafio-infinito.js';
import { SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../azar/prng.js';

const CICLO_MUNDO_4 = ['4.2', '4.3', '4.4'] as const;

// `derivarSemilla` avanza el PRNG `indice + 1` pasos: con índices de hasta unos
// cientos la prueba sigue siendo rápida y cubre muchas vueltas del ciclo.
const raiz = fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA });
const indice = fc.nat({ max: 300 });

function secuencia(raizCorrida: number, largo: number): RetoDesafio[] {
  return Array.from({ length: largo }, (_, i) => retoDesafio(4, raizCorrida, i));
}

describe('Property 28: El desafío infinito del mundo 4 es cíclico y determinista', () => {
  it('el nivel en el índice i es el i mod 3 de [4.2, 4.3, 4.4]', () => {
    fc.assert(
      fc.property(raiz, indice, (r, i) => {
        expect(retoDesafio(4, r, i).idNivel).toBe(CICLO_MUNDO_4[i % 3]);
      }),
    );
  });

  it('la misma raíz produce la misma secuencia de niveles y de semillas', () => {
    fc.assert(
      fc.property(raiz, fc.integer({ min: 1, max: 40 }), (r, largo) => {
        const primera = secuencia(r, largo);
        const segunda = secuencia(r, largo);
        expect(segunda).toEqual(primera);
        for (const reto of primera) {
          expect(Number.isInteger(reto.semilla)).toBe(true);
          expect(reto.semilla).toBeGreaterThanOrEqual(SEMILLA_MINIMA);
          expect(reto.semilla).toBeLessThanOrEqual(SEMILLA_MAXIMA);
        }
      }),
    );
  });
});
