// Pruebas del modelo puro de la tortuga
// Ejemplos del requisito 11 y la Property 13.
// Corre en Node sin ningún doble del DOM.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ESTADO_INICIAL,
  desplazar,
  girar,
  alCentro,
  conLapiz,
  conVisibilidad,
  normalizarRumbo,
  type EstadoTortuga,
} from './tortuga.js';
import { crearPrng } from '../azar/prng.js';

// ============================================================================
// Estado inicial (Req 11.7)
// ============================================================================

describe('tortuga', () => {
  describe('estado inicial', () => {
    it('está en el centro, rumbo 0, lápiz abajo y visible', () => {
      expect(ESTADO_INICIAL.posicion).toEqual({ x: 0, y: 0 });
      expect(ESTADO_INICIAL.rumbo).toBe(0);
      expect(ESTADO_INICIAL.lapizAbajo).toBe(true);
      expect(ESTADO_INICIAL.visible).toBe(true);
    });
  });

  // ==========================================================================
  // Desplazamiento y geometría (Req 11.4)
  // ==========================================================================

  describe('desplazar', () => {
    it('rumbo 0 aumenta y (adelante)', () => {
      const r = desplazar(ESTADO_INICIAL, 100, 'adelante');
      expect(r.valido).toBe(true);
      if (r.valido) {
        expect(r.estado.posicion.x).toBeCloseTo(0, 10);
        expect(r.estado.posicion.y).toBeCloseTo(100, 10);
      }
    });

    it('rumbo 90 aumenta x', () => {
      const e90 = { ...ESTADO_INICIAL, rumbo: 90 };
      const r = desplazar(e90, 100, 'adelante');
      if (r.valido) {
        expect(r.estado.posicion.x).toBeCloseTo(100, 10);
        expect(r.estado.posicion.y).toBeCloseTo(0, 10);
      }
    });

    it('rumbo 180 disminuye y', () => {
      const e180 = { ...ESTADO_INICIAL, rumbo: 180 };
      const r = desplazar(e180, 100, 'adelante');
      if (r.valido) {
        expect(r.estado.posicion.x).toBeCloseTo(0, 10);
        expect(r.estado.posicion.y).toBeCloseTo(-100, 10);
      }
    });

    it('rumbo 270 disminuye x', () => {
      const e270 = { ...ESTADO_INICIAL, rumbo: 270 };
      const r = desplazar(e270, 100, 'adelante');
      if (r.valido) {
        expect(r.estado.posicion.x).toBeCloseTo(-100, 10);
        expect(r.estado.posicion.y).toBeCloseTo(0, 10);
      }
    });

    it('atrás invierte el sentido', () => {
      const r = desplazar(ESTADO_INICIAL, 100, 'atras');
      if (r.valido) {
        expect(r.estado.posicion.y).toBeCloseTo(-100, 10);
      }
    });

    it('conserva rumbo, lápiz y visibilidad', () => {
      const base: EstadoTortuga = { posicion: { x: 0, y: 0 }, rumbo: 45, lapizAbajo: false, visible: false };
      const r = desplazar(base, 50, 'adelante');
      if (r.valido) {
        expect(r.estado.rumbo).toBe(45);
        expect(r.estado.lapizAbajo).toBe(false);
        expect(r.estado.visible).toBe(false);
      }
    });

    it('no recorta posiciones fuera de [-400, 400]', () => {
      const r = desplazar(ESTADO_INICIAL, 999_999, 'adelante');
      expect(r.valido).toBe(true);
      if (r.valido) {
        expect(r.estado.posicion.y).toBeCloseTo(999_999, 4);
        expect(Math.abs(r.estado.posicion.y)).toBeGreaterThan(400);
      }
    });

    it('distancia 0 devuelve un estado nuevo con la misma posición', () => {
      const r = desplazar(ESTADO_INICIAL, 0, 'adelante');
      if (r.valido) {
        expect(r.estado.posicion).toEqual({ x: 0, y: 0 });
        expect(r.estado).not.toBe(ESTADO_INICIAL); // objeto nuevo
      }
    });

    it('distancia no finita devuelve resultado inválido sin lanzar', () => {
      for (const malo of [NaN, Infinity, -Infinity]) {
        const r = desplazar(ESTADO_INICIAL, malo, 'adelante');
        expect(r.valido).toBe(false);
        if (!r.valido) {
          expect(r.transformacion).toBe('desplazar');
          expect(r.valorRecibido).toBe(malo);
        }
      }
    });
  });

  // ==========================================================================
  // Giro (Req 11.6)
  // ==========================================================================

  describe('girar', () => {
    it('90 a la izquierda desde 0 devuelve 270', () => {
      const r = girar(ESTADO_INICIAL, 90, 'izquierda');
      if (r.valido) expect(r.estado.rumbo).toBe(270);
    });

    it('450 a la derecha desde 0 devuelve 90', () => {
      const r = girar(ESTADO_INICIAL, 450, 'derecha');
      if (r.valido) expect(r.estado.rumbo).toBe(90);
    });

    it('rumbos 0, 90, 180, 270, 360 se normalizan a [0, 360)', () => {
      expect((girar(ESTADO_INICIAL, 0, 'derecha') as { estado: EstadoTortuga }).estado.rumbo).toBe(0);
      expect((girar(ESTADO_INICIAL, 90, 'derecha') as { estado: EstadoTortuga }).estado.rumbo).toBe(90);
      expect((girar(ESTADO_INICIAL, 180, 'derecha') as { estado: EstadoTortuga }).estado.rumbo).toBe(180);
      expect((girar(ESTADO_INICIAL, 270, 'derecha') as { estado: EstadoTortuga }).estado.rumbo).toBe(270);
      expect((girar(ESTADO_INICIAL, 360, 'derecha') as { estado: EstadoTortuga }).estado.rumbo).toBe(0);
    });

    it('conserva posición, lápiz y visibilidad', () => {
      const base: EstadoTortuga = { posicion: { x: 10, y: 20 }, rumbo: 0, lapizAbajo: false, visible: false };
      const r = girar(base, 45, 'derecha');
      if (r.valido) {
        expect(r.estado.posicion).toEqual({ x: 10, y: 20 });
        expect(r.estado.lapizAbajo).toBe(false);
        expect(r.estado.visible).toBe(false);
      }
    });

    it('ángulo no finito devuelve resultado inválido sin lanzar', () => {
      for (const malo of [NaN, Infinity, -Infinity]) {
        const r = girar(ESTADO_INICIAL, malo, 'derecha');
        expect(r.valido).toBe(false);
        if (!r.valido) {
          expect(r.transformacion).toBe('girar');
          expect(r.valorRecibido).toBe(malo);
        }
      }
    });
  });

  // ==========================================================================
  // normalizarRumbo
  // ==========================================================================

  describe('normalizarRumbo', () => {
    it('360 y sus múltiplos dan 0', () => {
      expect(normalizarRumbo(360)).toBe(0);
      expect(normalizarRumbo(720)).toBe(0);
      expect(normalizarRumbo(0)).toBe(0);
    });

    it('un rumbo negativo da su equivalente', () => {
      expect(normalizarRumbo(-90)).toBe(270);
      expect(normalizarRumbo(-360)).toBe(0);
    });

    it('aplica la tolerancia de 1e-6', () => {
      expect(normalizarRumbo(360 - 1e-9)).toBe(0);
      expect(normalizarRumbo(1e-9)).toBe(0);
    });
  });

  // ==========================================================================
  // alCentro, conLapiz, conVisibilidad (Req 11.2, 11.7)
  // ==========================================================================

  describe('alCentro', () => {
    it('vuelve al centro con rumbo 0 conservando lápiz y visibilidad', () => {
      const base: EstadoTortuga = { posicion: { x: 50, y: -30 }, rumbo: 123, lapizAbajo: false, visible: false };
      const nuevo = alCentro(base);
      expect(nuevo.posicion).toEqual({ x: 0, y: 0 });
      expect(nuevo.rumbo).toBe(0);
      expect(nuevo.lapizAbajo).toBe(false);
      expect(nuevo.visible).toBe(false);
      expect(nuevo).not.toBe(base);
    });
  });

  describe('conLapiz y conVisibilidad', () => {
    it('cambian solo su indicador y devuelven objeto nuevo', () => {
      const sinLapiz = conLapiz(ESTADO_INICIAL, false);
      expect(sinLapiz.lapizAbajo).toBe(false);
      expect(sinLapiz.posicion).toEqual({ x: 0, y: 0 });
      expect(sinLapiz).not.toBe(ESTADO_INICIAL);

      const oculta = conVisibilidad(ESTADO_INICIAL, false);
      expect(oculta.visible).toBe(false);
      expect(oculta).not.toBe(ESTADO_INICIAL);
    });

    it('devuelven objeto nuevo aunque el valor coincida con el actual', () => {
      const igualLapiz = conLapiz(ESTADO_INICIAL, true);   // ya estaba abajo
      expect(igualLapiz).not.toBe(ESTADO_INICIAL);
      expect(igualLapiz.lapizAbajo).toBe(true);

      const igualVis = conVisibilidad(ESTADO_INICIAL, true); // ya visible
      expect(igualVis).not.toBe(ESTADO_INICIAL);
    });
  });

  // ==========================================================================
  // Inmutabilidad: el estado recibido nunca cambia (Req 11.2)
  // ==========================================================================

  describe('inmutabilidad del estado recibido', () => {
    it('ninguna transformación modifica el estado de entrada', () => {
      const base: EstadoTortuga = { posicion: { x: 7, y: 9 }, rumbo: 33, lapizAbajo: true, visible: true };
      const copia: EstadoTortuga = { posicion: { x: 7, y: 9 }, rumbo: 33, lapizAbajo: true, visible: true };

      desplazar(base, 100, 'adelante');
      girar(base, 90, 'derecha');
      alCentro(base);
      conLapiz(base, false);
      conVisibilidad(base, false);

      expect(base).toEqual(copia);
    });
  });

  // ==========================================================================
  // Ausencia de referencias al DOM y a Canvas (Req 11.3)
  // ==========================================================================

  describe('pureza del módulo', () => {
    it('el código fuente no referencia document, window ni APIs de Canvas', () => {
      const rutaFuente = fileURLToPath(new URL('./tortuga.ts', import.meta.url));
      const fuente = readFileSync(rutaFuente, 'utf8');
      // Eliminar comentarios de línea para no penalizar menciones en la documentación.
      const codigo = fuente
        .split('\n')
        .filter((linea) => !linea.trimStart().startsWith('//'))
        .join('\n');

      expect(codigo).not.toContain('document');
      expect(codigo).not.toContain('window');
      expect(codigo).not.toContain('CanvasRenderingContext2D');
      expect(codigo).not.toContain('getContext');
      expect(codigo).not.toMatch(/from ['"].*lienzo/);
      expect(codigo).not.toMatch(/from ['"].*personajes/);
      expect(codigo).not.toMatch(/from ['"].*animador/);
    });
  });

  // ==========================================================================
  // Property 13: La tortuga es pura y su geometría es exacta
  // Valida: Requisitos 11.2, 11.4, 11.6
  // ==========================================================================

  describe('Property 13: pureza y geometría exacta', () => {
    /** Genera un estado de tortuga a partir de una semilla. */
    function estadoDe(semilla: number): EstadoTortuga {
      const prng = crearPrng(semilla);
      return {
        posicion: { x: prng.entero(-600, 600), y: prng.entero(-600, 600) },
        rumbo: prng.siguiente() * 360,
        lapizAbajo: prng.siguiente() < 0.5,
        visible: prng.siguiente() < 0.5,
      };
    }

    it('desplazar es exacto a 1e-6 y no toca el estado de entrada, sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const estado = estadoDe(semilla);
          const distancia = prng.entero(0, 999_999);
          const sentido = prng.siguiente() < 0.5 ? 'adelante' : 'atras';
          const antes = JSON.parse(JSON.stringify(estado));

          const r = desplazar(estado, distancia, sentido as 'adelante' | 'atras');
          expect(r.valido).toBe(true);
          if (!r.valido) return;

          // Posición esperada: Δx = sen(rad)·d, Δy = cos(rad)·d.
          const signo = sentido === 'adelante' ? 1 : -1;
          const rad = (estado.rumbo * Math.PI) / 180;
          const esperadoX = estado.posicion.x + Math.sin(rad) * distancia * signo;
          const esperadoY = estado.posicion.y + Math.cos(rad) * distancia * signo;
          expect(Math.abs(r.estado.posicion.x - esperadoX)).toBeLessThanOrEqual(1e-6);
          expect(Math.abs(r.estado.posicion.y - esperadoY)).toBeLessThanOrEqual(1e-6);

          // Rumbo, lápiz y visibilidad intactos.
          expect(r.estado.rumbo).toBe(estado.rumbo);
          expect(r.estado.lapizAbajo).toBe(estado.lapizAbajo);
          expect(r.estado.visible).toBe(estado.visible);

          // El estado de entrada no cambió.
          expect(estado).toEqual(antes);
          // Coordenadas siempre finitas.
          expect(Number.isFinite(r.estado.posicion.x)).toBe(true);
          expect(Number.isFinite(r.estado.posicion.y)).toBe(true);
        }),
        { seed: 13, numRuns: 200 },
      );
    });

    it('girar reduce el rumbo a [0, 360) y no toca el resto, sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const estado = estadoDe(semilla);
          const grados = prng.entero(0, 999_999);
          const sentido = prng.siguiente() < 0.5 ? 'derecha' : 'izquierda';

          const r = girar(estado, grados, sentido as 'derecha' | 'izquierda');
          expect(r.valido).toBe(true);
          if (!r.valido) return;

          // Rumbo dentro de [0, 360) y finito.
          expect(r.estado.rumbo).toBeGreaterThanOrEqual(0);
          expect(r.estado.rumbo).toBeLessThan(360);
          expect(Number.isFinite(r.estado.rumbo)).toBe(true);

          // Coincide con la normalización del rumbo esperado.
          const delta = sentido === 'derecha' ? grados : -grados;
          expect(r.estado.rumbo).toBe(normalizarRumbo(estado.rumbo + delta));

          // Posición, lápiz y visibilidad intactos.
          expect(r.estado.posicion).toEqual(estado.posicion);
          expect(r.estado.lapizAbajo).toBe(estado.lapizAbajo);
          expect(r.estado.visible).toBe(estado.visible);
        }),
        { seed: 14, numRuns: 200 },
      );
    });

    it('normalizarRumbo siempre devuelve un valor finito en [0, 360), sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const grados = (prng.siguiente() - 0.5) * 4_000_000;
          const r = normalizarRumbo(grados);
          expect(Number.isFinite(r)).toBe(true);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThan(360);
        }),
        { seed: 15, numRuns: 200 },
      );
    });
  });
});
