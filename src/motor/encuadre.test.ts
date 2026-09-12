// Pruebas del encuadre
// Ejemplos del requisito 15 (4–8) y la Property 16 parte B.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calcularEncuadre } from './encuadre.js';
import type { Segmento } from './segmentos.js';
import { crearPrng } from '../azar/prng.js';

// ============================================================================
// Ayuda
// ============================================================================

function seg(dx: number, dy: number, hx: number, hy: number, paso = 0, linea = 1): Segmento {
  return { desde: { x: dx, y: dy }, hasta: { x: hx, y: hy }, paso, linea };
}

// ============================================================================
// Ejemplos
// ============================================================================

describe('encuadre', () => {
  describe('caja envolvente de una figura conocida', () => {
    it('calcula los cuatro límites, ancho, alto y centro', () => {
      // Un cuadrado de lado 200 centrado en el origen.
      const segmentos = [
        seg(-100, -100, 100, -100),
        seg(100, -100, 100, 100),
        seg(100, 100, -100, 100),
        seg(-100, 100, -100, -100),
      ];
      const r = calcularEncuadre(segmentos);
      expect(r.hayCaja).toBe(true);
      if (r.hayCaja) {
        expect(r.caja.izquierda).toBe(-100);
        expect(r.caja.derecha).toBe(100);
        expect(r.caja.abajo).toBe(-100);
        expect(r.caja.arriba).toBe(100);
        expect(r.caja.ancho).toBe(200);
        expect(r.caja.alto).toBe(200);
        expect(r.caja.centro).toEqual({ x: 0, y: 0 });
        // ancho y alto exactamente 200: no degenerada.
        expect(r.degenerada).toBe(false);
        expect(r.noEncuadrada).toEqual([]);
      }
    });
  });

  // ==========================================================================
  // Figura no encuadrada (Req 15.5) — el borde exacto no cuenta
  // ==========================================================================

  describe('figura no encuadrada', () => {
    it('exactamente -400 y 400 no disparan la bandera', () => {
      const segmentos = [seg(-400, -400, 400, 400)];
      const r = calcularEncuadre(segmentos);
      if (r.hayCaja) {
        expect(r.noEncuadrada).toEqual([]);
      }
    });

    it('nombra cada límite que se sale', () => {
      const segmentos = [seg(-401, -500, 500, 401)];
      const r = calcularEncuadre(segmentos);
      if (r.hayCaja) {
        expect(r.noEncuadrada).toContain('izquierda');
        expect(r.noEncuadrada).toContain('derecha');
        expect(r.noEncuadrada).toContain('abajo');
        expect(r.noEncuadrada).toContain('arriba');
      }
    });

    it('nombra solo el borde que se sale', () => {
      const segmentos = [seg(0, 0, 500, 100)]; // solo derecha se pasa
      const r = calcularEncuadre(segmentos);
      if (r.hayCaja) {
        expect(r.noEncuadrada).toEqual(['derecha']);
      }
    });
  });

  // ==========================================================================
  // Figura degenerada (Req 15.6) — 200 exacto no cuenta
  // ==========================================================================

  describe('figura degenerada', () => {
    it('ancho o alto menor que 200 dispara la bandera', () => {
      const segmentos = [seg(0, 0, 199, 0)]; // ancho 199, alto 0
      const r = calcularEncuadre(segmentos);
      if (r.hayCaja) {
        expect(r.degenerada).toBe(true);
      }
    });

    it('exactamente 200 no dispara la bandera', () => {
      const segmentos = [seg(0, 0, 200, 200)];
      const r = calcularEncuadre(segmentos);
      if (r.hayCaja) {
        expect(r.degenerada).toBe(false);
      }
    });

    it('los dos indicadores pueden ser verdaderos a la vez', () => {
      // Ancho enorme (no encuadrada por la derecha) pero alto pequeño (degenerada).
      const segmentos = [seg(0, 0, 500, 10)];
      const r = calcularEncuadre(segmentos);
      if (r.hayCaja) {
        expect(r.noEncuadrada).toContain('derecha');
        expect(r.degenerada).toBe(true);
      }
    });
  });

  // ==========================================================================
  // Lista vacía (Req 15.7)
  // ==========================================================================

  describe('lista vacía', () => {
    it('devuelve hayCaja: false con degenerada: true, sin límites en 0 ni no finitos', () => {
      const r = calcularEncuadre([]);
      expect(r.hayCaja).toBe(false);
      expect(r.degenerada).toBe(true);
      // No hay ninguna propiedad `caja` con límites en 0.
      expect('caja' in r).toBe(false);
    });
  });

  // ==========================================================================
  // Inmutabilidad y determinismo (Req 15.8)
  // ==========================================================================

  describe('inmutabilidad y determinismo', () => {
    it('no modifica la lista recibida y devuelve el mismo resultado dos veces', () => {
      const segmentos = [seg(-100, -100, 100, 100), seg(100, 100, -50, 30)];
      const antes = JSON.stringify(segmentos);
      const r1 = calcularEncuadre(segmentos);
      const r2 = calcularEncuadre(segmentos);
      expect(JSON.stringify(segmentos)).toBe(antes);
      expect(r1).toEqual(r2);
    });
  });

  // ==========================================================================
  // Property 16 parte B: encuadre
  // Valida: Requisitos 15.4, 15.5, 15.6, 15.8
  // ==========================================================================

  describe('Property 16B: encuadre', () => {
    /** Genera una lista de 1 a 20 segmentos con coordenadas en [-600, 600]. */
    function segmentosDe(semilla: number): Segmento[] {
      const prng = crearPrng(semilla);
      const n = prng.entero(1, 20);
      const lista: Segmento[] = [];
      for (let i = 0; i < n; i++) {
        lista.push(seg(
          prng.entero(-600, 600),
          prng.entero(-600, 600),
          prng.entero(-600, 600),
          prng.entero(-600, 600),
          i,
          i + 1,
        ));
      }
      return lista;
    }

    it('los límites son el min/max real, ancho y alto ≥ 0, y los indicadores son coherentes', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const segmentos = segmentosDe(semilla);
          const r = calcularEncuadre(segmentos);
          expect(r.hayCaja).toBe(true);
          if (!r.hayCaja) return;

          // Calcular min/max a mano.
          let izq = Infinity, der = -Infinity, ab = Infinity, arr = -Infinity;
          for (const s of segmentos) {
            for (const p of [s.desde, s.hasta]) {
              izq = Math.min(izq, p.x);
              der = Math.max(der, p.x);
              ab = Math.min(ab, p.y);
              arr = Math.max(arr, p.y);
            }
          }
          expect(r.caja.izquierda).toBe(izq);
          expect(r.caja.derecha).toBe(der);
          expect(r.caja.abajo).toBe(ab);
          expect(r.caja.arriba).toBe(arr);
          expect(r.caja.ancho).toBeGreaterThanOrEqual(0);
          expect(r.caja.alto).toBeGreaterThanOrEqual(0);

          // noEncuadrada coincide con los límites fuera de [-400, 400].
          expect(r.noEncuadrada.includes('izquierda')).toBe(izq < -400);
          expect(r.noEncuadrada.includes('derecha')).toBe(der > 400);
          expect(r.noEncuadrada.includes('abajo')).toBe(ab < -400);
          expect(r.noEncuadrada.includes('arriba')).toBe(arr > 400);

          // degenerada coincide con ancho o alto < 200.
          expect(r.degenerada).toBe(r.caja.ancho < 200 || r.caja.alto < 200);

          // Todos los valores finitos.
          expect(Number.isFinite(r.caja.ancho)).toBe(true);
          expect(Number.isFinite(r.caja.alto)).toBe(true);
        }),
        { seed: 18, numRuns: 200 },
      );
    });

    it('no modifica la lista recibida, sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const segmentos = segmentosDe(semilla);
          const antes = JSON.stringify(segmentos);
          calcularEncuadre(segmentos);
          expect(JSON.stringify(segmentos)).toBe(antes);
        }),
        { seed: 19, numRuns: 200 },
      );
    });
  });
});
