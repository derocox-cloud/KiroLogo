// Pruebas de ejemplo de la entropía de semillas (D12, R25.2): «otro reto» nunca repite la semilla.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEMILLA_MAXIMA } from './prng.js';
import { entropiaDelNavegador, semillaDistinta, type FuenteEntropia } from './entropia.js';

/** Fuente fija que cuenta cuántas veces se le pidió un valor. */
function fuenteFija(valor: number): FuenteEntropia & { llamadas: number } {
  const fuente = Object.assign(() => {
    fuente.llamadas++;
    return valor;
  }, { llamadas: 0 });
  return fuente;
}

/** Fuente que entrega los valores en orden y repite el último. */
function fuenteSecuencia(valores: number[]): FuenteEntropia {
  let i = 0;
  return () => valores[Math.min(i++, valores.length - 1)]!;
}

describe('semillaDistinta', () => {
  it('con una fuente que siempre devuelve la semilla actual termina en 8 intentos y no la repite', () => {
    const fuente = fuenteFija(1234);
    expect(semillaDistinta(fuente, 1234)).toBe(1235);
    expect(fuente.llamadas).toBe(8);
  });

  it('al agotar los intentos en la semilla máxima da la vuelta a 0', () => {
    expect(semillaDistinta(fuenteFija(SEMILLA_MAXIMA), SEMILLA_MAXIMA)).toBe(0);
  });

  it('devuelve el primer valor de la fuente si ya es distinto, con un solo pedido', () => {
    const fuente = fuenteFija(99);
    expect(semillaDistinta(fuente, 1234)).toBe(99);
    expect(fuente.llamadas).toBe(1);
  });

  it('reintenta mientras la fuente repite la semilla actual', () => {
    expect(semillaDistinta(fuenteSecuencia([7, 7, 7, 42]), 7)).toBe(42);
  });

  it('descarta valores fuera del dominio de semillas', () => {
    const invalidos = [-1, SEMILLA_MAXIMA + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY];
    expect(semillaDistinta(fuenteSecuencia([...invalidos, 500]), 10)).toBe(500);
    expect(semillaDistinta(fuenteFija(-1), 10)).toBe(11);
  });
});

describe('entropiaDelNavegador', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve un entero dentro del dominio de semillas', () => {
    const valor = entropiaDelNavegador();
    expect(Number.isInteger(valor)).toBe(true);
    expect(valor).toBeGreaterThanOrEqual(0);
    expect(valor).toBeLessThanOrEqual(SEMILLA_MAXIMA);
  });

  it('sin crypto usa un respaldo determinista sembrado con la semilla actual y no la repite', () => {
    vi.stubGlobal('crypto', undefined);
    const primera = semillaDistinta(entropiaDelNavegador, 2024);
    const segunda = semillaDistinta(entropiaDelNavegador, 2024);
    expect(primera).not.toBe(2024);
    expect(segunda).toBe(primera);
    expect(primera).toBeGreaterThanOrEqual(0);
    expect(primera).toBeLessThanOrEqual(SEMILLA_MAXIMA);
  });
});
