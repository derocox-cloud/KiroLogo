// Property 21: El editor cuenta líneas y respeta sus dos límites.
// Valida: Requisitos 21.1, 21.2, 21.3.
//
// No toca el DOM: comprueba las funciones puras de conteo y recorte del editor,
// que son el núcleo comprobable del contador de líneas y de los dos límites.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import {
  contarLineas,
  contarCaracteres,
  recortarALimites,
  MAXIMO_LINEAS,
  MAXIMO_CARACTERES,
} from './editor.js';

/** Construye un texto de líneas al azar, mezclando `\n` y `\r\n` como fin de línea. */
function textoAlAzar(semilla: number): { texto: string; lineas: number } {
  const prng = crearPrng(semilla);
  const numLineas = prng.entero(1, 260); // puede exceder el límite de líneas
  const partes: string[] = [];
  for (let i = 0; i < numLineas; i++) {
    const largo = prng.entero(0, 60);
    let linea = '';
    for (let c = 0; c < largo; c++) {
      // Solo caracteres visibles + espacios/tabs, sin fines de línea dentro.
      const clase = prng.entero(0, 2);
      if (clase === 0) linea += ' ';
      else if (clase === 1) linea += '\t';
      else linea += String.fromCharCode(prng.entero(65, 90));
    }
    partes.push(linea);
  }
  // Unir con un fin de línea al azar entre `\n` y `\r\n`.
  let texto = '';
  for (let i = 0; i < partes.length; i++) {
    texto += partes[i];
    if (i < partes.length - 1) texto += prng.entero(0, 1) === 0 ? '\n' : '\r\n';
  }
  return { texto, lineas: numLineas };
}

describe('Property 21 · el editor cuenta líneas y respeta sus dos límites', () => {
  it('cuenta una línea por fragmento delimitado por un fin de línea (\\n y \\r\\n cuentan uno)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const { texto, lineas } = textoAlAzar(semilla);
        expect(contarLineas(texto)).toBe(lineas);
      }),
      { seed: 21, numRuns: 200 },
    );
  });

  it('el recorte nunca supera ninguno de los dos límites y conserva un prefijo del texto', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const { texto } = textoAlAzar(semilla);
        const rec = recortarALimites(texto);
        // Respeta los dos límites.
        expect(contarLineas(rec.texto)).toBeLessThanOrEqual(MAXIMO_LINEAS);
        expect(contarCaracteres(rec.texto)).toBeLessThanOrEqual(MAXIMO_CARACTERES);
        // Descarta solo el excedente: el resultado es un prefijo del texto original
        // salvo un `\r` colgante que se retira al cortar por líneas.
        expect(texto.startsWith(rec.texto) || texto.startsWith(rec.texto + '\r')).toBe(true);
        // Si no recortó, es porque ya cabía en los dos límites.
        if (!rec.recortado) {
          expect(contarLineas(texto)).toBeLessThanOrEqual(MAXIMO_LINEAS);
          expect(contarCaracteres(texto)).toBeLessThanOrEqual(MAXIMO_CARACTERES);
        }
      }),
      { seed: 22, numRuns: 200 },
    );
  });

  it('un texto ya dentro de los dos límites no se recorta', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng((semilla ^ 0x5a5a5a5a) >>> 0);
        const numLineas = prng.entero(1, MAXIMO_LINEAS);
        const partes: string[] = [];
        let restante = MAXIMO_CARACTERES - (numLineas - 1); // reservar los fines de línea
        for (let i = 0; i < numLineas; i++) {
          const largo = Math.max(0, Math.min(20, prng.entero(0, 20), restante));
          partes.push('A'.repeat(largo));
          restante -= largo;
        }
        const texto = partes.join('\n');
        // Precondición: dentro de los dos límites.
        if (contarLineas(texto) > MAXIMO_LINEAS || texto.length > MAXIMO_CARACTERES) return;
        const rec = recortarALimites(texto);
        expect(rec.recortado).toBe(false);
        expect(rec.texto).toBe(texto);
      }),
      { seed: 23, numRuns: 200 },
    );
  });
});
