// @vitest-environment jsdom

// Property 23: El filtro por mundo del panel y la fidelidad de sus textos.
// Valida: Requisitos 3.8, 26.1, 26.2, 26.3.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import { crearPanelComandos, textoDeEntrada } from './panel-comandos.js';
import { comandosDelMundo, VOCABULARIO, type Mundo } from '../lenguaje/vocabulario.js';

const MUNDOS: readonly Mundo[] = [0, 1, 2, 3, 4, 5];

describe('Property 23 · filtro por mundo del panel y fidelidad de sus textos', () => {
  it('presenta exactamente las entradas de comandosDelMundo, en orden, y ninguna posterior', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng(semilla);
        const mundo = MUNDOS[prng.entero(0, MUNDOS.length - 1)]!;

        const cont = document.createElement('div');
        const panel = crearPanelComandos({
          contenedor: cont,
          mundo,
          insertarEjemplo: () => 1,
          anunciar: () => {},
        });

        const esperadas = comandosDelMundo(mundo);
        // Mismo número, mismo orden, misma identidad.
        expect(panel.entradas).toEqual(esperadas);
        expect(panel.botones.length).toBe(esperadas.length);
        // Ninguna entrada de un mundo posterior está presente.
        for (const entrada of panel.entradas) {
          expect(entrada.mundo).toBeLessThanOrEqual(mundo);
        }
        // Ningún comando de mundo mayor aparece en ningún texto visible ni nombre.
        const posteriores = VOCABULARIO.filter((e) => e.mundo > mundo);
        const textoTotal = panel.raiz.textContent ?? '';
        for (const p of posteriores) {
          // El nombre completo de un comando posterior no debe aparecer.
          expect(textoTotal.includes(` ${p.nombre}.`)).toBe(false);
        }
      }),
      { seed: 231, numRuns: 200 },
    );
  });

  it('cada botón reproduce nombre, abreviatura, descripción y ejemplo carácter por carácter', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng((semilla ^ 0x23232323) >>> 0);
        const mundo = MUNDOS[prng.entero(0, MUNDOS.length - 1)]!;

        const cont = document.createElement('div');
        const panel = crearPanelComandos({
          contenedor: cont,
          mundo,
          insertarEjemplo: () => 1,
          anunciar: () => {},
        });

        panel.entradas.forEach((entrada, i) => {
          const boton = panel.botones[i]!;
          const esperado = textoDeEntrada(entrada);
          expect(boton.textContent).toBe(esperado);
          expect(boton.getAttribute('aria-label')).toBe(esperado);
          expect(boton.textContent).toContain(entrada.nombre);
          expect(boton.textContent).toContain(entrada.descripcion);
          expect(boton.textContent).toContain(entrada.ejemplo);
          if (entrada.abreviatura !== null) {
            expect(boton.textContent).toContain(entrada.abreviatura);
          }
        });
      }),
      { seed: 232, numRuns: 200 },
    );
  });
});
