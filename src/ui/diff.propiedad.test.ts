// @vitest-environment node

// Property 14 (parte C, diff): determinismo del dibujo.
// Valida: Requisitos 23.9.
//
// Dibujar dos veces las mismas tres regiones con la misma traslación, el mismo
// ángulo y el mismo tamaño produce el mismo dibujo píxel por píxel, y deja las
// tres regiones recibidas iguales posición por posición.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import { crearDiff, type EstiloDiff, type RegionesDiff } from './diff.js';
import { DobleDibujo, mascarasIguales } from '../motor/doble-dibujo.test.js';
import { crearMascara, LADO, type Mascara } from '../motor/validador.js';

function estilo(): EstiloDiff {
  return {
    coincidencia: { color: '#2f9e44', grosor: 2, guiones: [] },
    exceso: { color: '#e03131', grosor: 4, guiones: [] },
    falta: { color: '#868e96', grosor: 2, guiones: [8, 8] },
  };
}

/** Enciende posiciones al azar en una máscara, dentro de una banda central. */
function mascaraAlAzar(prng: ReturnType<typeof crearPrng>, cantidad: number): Mascara {
  const m = crearMascara();
  for (let k = 0; k < cantidad; k++) {
    const ix = prng.entero(100, 700);
    const iy = prng.entero(100, 700);
    m[iy * LADO + ix] = 1;
  }
  return m;
}

function regionesAlAzar(semilla: number): RegionesDiff {
  const prng = crearPrng(semilla);
  const coincidencia = mascaraAlAzar(prng, prng.entero(1, 40));
  const exceso = mascaraAlAzar(prng, prng.entero(0, 40));
  const falta = mascaraAlAzar(prng, prng.entero(1, 40));
  const tx = prng.entero(-30, 30);
  const ty = prng.entero(-30, 30);
  const angulo = prng.entero(0, 359);
  return { coincidencia, exceso, falta, traslacion: { x: tx, y: ty }, angulo };
}

describe('Property 14C · determinismo del dibujo del diff', () => {
  it('dos dibujos de las mismas regiones producen la misma máscara', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const r = regionesAlAzar(semilla);

        const ctx1 = new DobleDibujo();
        crearDiff({ ctx: ctx1, leerTema: estilo }).dibujar(r);
        const m1 = ctx1.mascara();

        const ctx2 = new DobleDibujo();
        crearDiff({ ctx: ctx2, leerTema: estilo }).dibujar(r);
        const m2 = ctx2.mascara();

        expect(mascarasIguales(m1, m2)).toBe(true);
      }),
      { seed: 14, numRuns: 200 },
    );
  }, 30000);

  it('no modifica ninguna de las tres regiones recibidas', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const r = regionesAlAzar((semilla ^ 0x14141414) >>> 0);
        const c = r.coincidencia.slice();
        const e = r.exceso.slice();
        const f = r.falta.slice();
        const ctx = new DobleDibujo();
        crearDiff({ ctx, leerTema: estilo }).dibujar(r);
        expect(mascarasIguales(r.coincidencia, c)).toBe(true);
        expect(mascarasIguales(r.exceso, e)).toBe(true);
        expect(mascarasIguales(r.falta, f)).toBe(true);
      }),
      { seed: 141, numRuns: 200 },
    );
  }, 30000);
});
