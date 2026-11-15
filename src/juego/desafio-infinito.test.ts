// Pruebas del desafío infinito (requisito 7).
//
// **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**
//
// El desafío infinito es puro y sin estado propio: una función que, dada la
// raíz y el índice, devuelve (idNivel, semilla). Estas pruebas verifican que la
// secuencia es determinista por su raíz (Property 13), que rota entre los
// niveles generados del mundo en el orden del catálogo (Property 14), y que la
// disponibilidad se deriva de que el mundo esté completo y tenga generados
// (Property 15), de forma retroactiva a los mundos 0, 1, 2 y 3.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  nivelesGeneradosDelMundo,
  desafioDisponible,
  retoDesafio,
  derivarSemilla,
} from './desafio-infinito.js';
import { cargarProgreso, type Progreso } from './progreso.js';
import type { Calificacion } from './estrellas.js';
import { CATALOGO } from '../niveles/catalogo.js';
import { SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../azar/prng.js';
import type { Mundo } from '../lenguaje/vocabulario.js';

// ============================================================================
// Ayudas
// ============================================================================

const MUNDOS: readonly Mundo[] = [0, 1, 2, 3, 4, 5];

/** Calificación con la estrella de precisión otorgada (basta para «aprobado»). */
function califPrecision(): Calificacion {
  return {
    precision: { otorgada: true },
    economia: { otorgada: false, motivo: { clave: 'sinPrecision' } },
    abstraccion: { otorgada: false, motivo: { clave: 'sinPrecision' } },
    conteoJugador: 1,
    presupuestoEstrella: 1,
    mensajeAbstraccion: null,
  };
}

/** Ids de todos los niveles de un mundo, en orden del catálogo. */
function idsDelMundo(mundo: Mundo): readonly string[] {
  return CATALOGO.filter((n) => n.mundo === mundo).map((n) => n.id);
}

/**
 * Progreso con TODOS los niveles del mundo aprobados (estrella de precisión),
 * que es lo que vuelve «completo» al mundo. Sigue el patrón de menu-mundos.test:
 * aprobar guardando una calificación de precisión por nivel.
 */
function conMundoCompleto(mundo: Mundo): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of idsDelMundo(mundo)) progreso.guardar(id, 1, califPrecision(), 1);
  return progreso;
}

// ============================================================================
// nivelesGeneradosDelMundo (R7.6)
// ============================================================================

describe('desafio-infinito · niveles generados del mundo', () => {
  it('devuelve los ids generados del mundo 3 en orden del catálogo: [3.2, 3.3]', () => {
    // 3.1 y 3.4 son autorados; 3.2 (roseton-m3) y 3.3 (flor-m3) son generados.
    expect(nivelesGeneradosDelMundo(3)).toEqual(['3.2', '3.3']);
  });

  it('coincide con el filtrado directo del catálogo por mundo y origen generado', () => {
    for (const mundo of MUNDOS) {
      const esperado = CATALOGO.filter((n) => n.mundo === mundo && n.origen.tipo === 'generado').map((n) => n.id);
      expect(nivelesGeneradosDelMundo(mundo)).toEqual(esperado);
    }
  });

  it('los mundos 4 y 5 no tienen niveles generados hoy', () => {
    expect(nivelesGeneradosDelMundo(4)).toEqual([]);
    expect(nivelesGeneradosDelMundo(5)).toEqual([]);
  });
});

// ============================================================================
// Property 13 — determinismo por la raíz (R7.3, R7.4)
// ============================================================================

describe('desafio-infinito · Property 13: determinista por su raíz', () => {
  it('misma (mundo, raíz, índice) ⇒ mismo (idNivel, semilla)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        fc.integer({ min: 0, max: 500 }),
        (raiz, indice) => {
          const a = retoDesafio(3, raiz, indice);
          const b = retoDesafio(3, raiz, indice);
          expect(a).toEqual(b);
        },
      ),
    );
  });

  it('dos corridas i=0..k con la misma raíz producen la misma secuencia', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        fc.integer({ min: 0, max: 40 }),
        (raiz, k) => {
          const corrida = (): readonly string[] => {
            const salida: string[] = [];
            for (let i = 0; i <= k; i++) {
              const r = retoDesafio(3, raiz, i);
              salida.push(`${r.idNivel}#${r.semilla}`);
            }
            return salida;
          };
          expect(corrida()).toEqual(corrida());
        },
      ),
    );
  });

  it('derivarSemilla es determinista y cae en el dominio de semillas', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        fc.integer({ min: 0, max: 500 }),
        (raiz, indice) => {
          const s1 = derivarSemilla(raiz, indice);
          const s2 = derivarSemilla(raiz, indice);
          expect(s1).toBe(s2);
          expect(Number.isInteger(s1)).toBe(true);
          expect(s1).toBeGreaterThanOrEqual(SEMILLA_MINIMA);
          expect(s1).toBeLessThanOrEqual(SEMILLA_MAXIMA);
        },
      ),
    );
  });

  it('el azar pasa por crearPrng: raíces fuera del dominio no se aceptan', () => {
    // crearPrng valida el dominio de la semilla y lanza si está fuera; esto
    // demuestra que derivarSemilla usa esa fuente y no Math.random.
    expect(() => derivarSemilla(SEMILLA_MAXIMA + 1, 0)).toThrow();
    expect(() => derivarSemilla(-1, 0)).toThrow();
  });
});

// ============================================================================
// Property 14 — rotación entre los generados del mundo (R7.6)
// ============================================================================

describe('desafio-infinito · Property 14: rota entre los generados del mundo', () => {
  it('recorrer i=0..k rota por i % cantidad en el orden del catálogo (mundo 3)', () => {
    const generados = nivelesGeneradosDelMundo(3);
    expect(generados.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        fc.integer({ min: 0, max: 60 }),
        (raiz, k) => {
          for (let i = 0; i <= k; i++) {
            const r = retoDesafio(3, raiz, i);
            expect(r.idNivel).toBe(generados[i % generados.length]);
          }
        },
      ),
    );
  });

  it('para cualquier mundo con generados, el idNivel siempre es uno de ellos', () => {
    for (const mundo of MUNDOS) {
      const generados = nivelesGeneradosDelMundo(mundo);
      if (generados.length === 0) continue;
      for (let i = 0; i < generados.length * 3 + 1; i++) {
        expect(generados).toContain(retoDesafio(mundo, 7, i).idNivel);
      }
    }
  });
});

// ============================================================================
// Property 15 — disponibilidad (R7.1, R7.2, R7.7, R7.8)
// ============================================================================

describe('desafio-infinito · Property 15: disponible sii mundo completo y con generados', () => {
  it('mundo incompleto (sin progreso) ⇒ no disponible, aunque tenga generados', () => {
    const vacio = cargarProgreso(null);
    // Mundos 0..3 tienen generados; sin progreso ninguno está completo.
    for (const mundo of [0, 1, 2, 3] as const) {
      expect(nivelesGeneradosDelMundo(mundo).length).toBeGreaterThan(0);
      expect(desafioDisponible(mundo, vacio)).toBe(false);
    }
  });

  it('mundo sin niveles generados (4 y 5) ⇒ nunca disponible, aun completo', () => {
    for (const mundo of [4, 5] as const) {
      // Completar el mundo (está vacío, así que no hay nada que aprobar) no basta:
      // sin generados no hay desafío.
      const progreso = conMundoCompleto(mundo);
      expect(desafioDisponible(mundo, progreso)).toBe(false);
    }
  });

  it('mundo completo con generados ⇒ disponible; retroactivo a 0, 1, 2 y 3', () => {
    for (const mundo of [0, 1, 2, 3] as const) {
      const completo = conMundoCompleto(mundo);
      expect(desafioDisponible(mundo, completo)).toBe(true);
    }
  });

  it('un nivel faltante en el mundo lo deja no disponible', () => {
    // Aprobar todos menos el último nivel del mundo 3.
    const ids = idsDelMundo(3);
    const progreso = cargarProgreso(null);
    for (const id of ids.slice(0, -1)) progreso.guardar(id, 1, califPrecision(), 1);
    expect(desafioDisponible(3, progreso)).toBe(false);
  });
});
