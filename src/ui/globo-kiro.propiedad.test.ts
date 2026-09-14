// @vitest-environment jsdom

// Property 24: Fidelidad del texto de Kiro y contador de pistas.
// Valida: Requisitos 25.4, 25.6.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import { crearGloboKiro, type IdentidadReto } from './globo-kiro.js';
import { crearError, type ErrorKiroLogo, type IdError } from '../lenguaje/errores.js';

/** Un puñado de errores sin parámetros de texto, para generar mensajes al azar. */
const IDS_SIMPLES: readonly IdError[] = [
  'caracterNoValido',
  'numeroMalFormado',
  'comillaSinPalabra',
  'corcheteSinCerrar',
  'corcheteDeMas',
  'corcheteInesperado',
  'guardaPasos',
  'guardaTiempo',
  'limiteLineasEditor',
  'limiteCaracteresEditor',
];

function erroresAlAzar(semilla: number): ErrorKiroLogo[] {
  const prng = crearPrng(semilla);
  const cantidad = prng.entero(1, 25); // puede exceder el máximo de 20
  const errores: ErrorKiroLogo[] = [];
  for (let i = 0; i < cantidad; i++) {
    const id = IDS_SIMPLES[prng.entero(0, IDS_SIMPLES.length - 1)]!;
    errores.push(crearError(id, {}));
  }
  return errores;
}

const PISTAS: readonly [string, string, string] = ['Uno.', 'Dos.', 'Tres.'];

describe('Property 24 · fidelidad del texto de Kiro y contador de pistas', () => {
  it('muestra los mensajes del catálogo con su texto exacto, en orden y hasta 20', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const errores = erroresAlAzar(semilla);
        const cont = document.createElement('div');
        const globo = crearGloboKiro({ contenedor: cont, anunciar: () => {} });
        globo.presentarReto({ idNivel: '0.1', semillaEfectiva: 1, pistas: PISTAS });

        globo.mostrarMensajes(errores);
        const parrafos = [...cont.querySelectorAll('.kl-globo-mensaje')];
        const mostrados = Math.min(errores.length, 20);
        expect(parrafos.length).toBe(mostrados);
        for (let i = 0; i < mostrados; i++) {
          // Texto exacto, carácter por carácter, sin reescribir ni añadir.
          expect(parrafos[i]!.textContent).toBe(errores[i]!.mensaje);
        }
      }),
      { seed: 241, numRuns: 200 },
    );
  });

  it('el contador de pistas nunca pasa de 3 y sube en 1 por escalón nuevo', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng((semilla ^ 0x24242424) >>> 0);
        const peticiones = prng.entero(0, 8);

        const cont = document.createElement('div');
        const globo = crearGloboKiro({ contenedor: cont, anunciar: () => {} });
        const identidad: IdentidadReto = { idNivel: '0.1', semillaEfectiva: 7, pistas: PISTAS };
        globo.presentarReto(identidad);

        for (let i = 0; i < peticiones; i++) {
          const antes = globo.escalonesAbiertos();
          globo.pedirPista();
          const despues = globo.escalonesAbiertos();
          // Sube en 1 mientras haya escalón nuevo; se queda en 3 después.
          if (antes < 3) expect(despues).toBe(antes + 1);
          else expect(despues).toBe(3);
        }
        expect(globo.escalonesAbiertos()).toBe(Math.min(peticiones, 3));

        // Repetir el mismo reto no reinicia; cambiar de reto sí.
        globo.presentarReto(identidad);
        expect(globo.escalonesAbiertos()).toBe(Math.min(peticiones, 3));
        globo.presentarReto({ ...identidad, semillaEfectiva: 8 });
        expect(globo.escalonesAbiertos()).toBe(0);
      }),
      { seed: 242, numRuns: 200 },
    );
  });
});
