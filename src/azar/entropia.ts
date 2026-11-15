// Único punto de entropía del proyecto (D12). Dentro de la ejecución y de los generadores
// el azar sigue pasando por prng.ts; aquí solo se elige la semilla de un reto nuevo.

import { SEMILLA_MAXIMA } from './prng.js';

/** Devuelve un entero en [0, SEMILLA_MAXIMA]. */
export type FuenteEntropia = () => number;

const MODULO = SEMILLA_MAXIMA + 1;
const INTENTOS_MAXIMOS = 8;

// Respaldo congruencial (Numerical Recipes). Se siembra con la semilla actual, nunca con el reloj.
let estadoRespaldo = 0;

function siguienteRespaldo(): number {
  estadoRespaldo = (Math.imul(estadoRespaldo, 1664525) + 1013904223) >>> 0;
  return estadoRespaldo;
}

export const entropiaDelNavegador: FuenteEntropia = () => {
  const cripto = (globalThis as { crypto?: Crypto }).crypto;
  if (cripto && typeof cripto.getRandomValues === 'function') {
    const valor = cripto.getRandomValues(new Uint32Array(1))[0];
    if (valor !== undefined) return valor;
  }
  return siguienteRespaldo();
};

/**
 * Pide a la fuente hasta 8 veces y devuelve la primera semilla distinta de `actual`.
 * Si se agotan los intentos, devuelve `(actual + 1) mod 2^32`: «otro reto» nunca repite la semilla.
 */
export function semillaDistinta(fuente: FuenteEntropia, actual: number): number {
  estadoRespaldo = actual >>> 0;
  for (let i = 0; i < INTENTOS_MAXIMOS; i++) {
    const candidata = fuente();
    if (Number.isInteger(candidata) && candidata >= 0 && candidata <= SEMILLA_MAXIMA && candidata !== actual) {
      return candidata;
    }
  }
  return (actual + 1) % MODULO;
}
