// Pruebas del desafío infinito (requisito 7).
//
// **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**
//
// El desafío infinito es puro y sin estado propio: una función que, dada la
// raíz y el índice, devuelve (idNivel, semilla). Estas pruebas verifican que la
// secuencia es determinista por su raíz (Property 13), que rota entre los
// niveles generados del mundo en el orden del catálogo (Property 14), y que la
// disponibilidad se deriva de que el mundo esté completo y tenga generados
// (Property 15), de forma retroactiva a los mundos 0, 1, 2 y 3. El mundo 4 cicla 4.2, 4.3, 4.4 y
// solo se habilita con tres estrellas (R24.5, R24.6).

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

/** Calificación con las tres estrellas otorgadas. */
function califTresEstrellas(): Calificacion {
  return {
    precision: { otorgada: true },
    economia: { otorgada: true },
    abstraccion: { otorgada: true },
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
function conMundoCompleto(mundo: Mundo, calif: () => Calificacion = califPrecision): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of idsDelMundo(mundo)) progreso.guardar(id, 1, calif(), 1);
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

  it('el mundo 4 tiene generados 4.2, 4.3 y 4.4 en orden del catálogo (R24.6)', () => {
    // 4.1 es autorado; el desafío cicla por los otros tres.
    expect(nivelesGeneradosDelMundo(4)).toEqual(['4.2', '4.3', '4.4']);
    for (let i = 0; i < 7; i++) {
      expect(retoDesafio(4, 7, i).idNivel).toBe(['4.2', '4.3', '4.4'][i % 3]);
    }
  });

  it('el mundo 5 no tiene niveles generados hoy', () => {
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

  it('mundo sin niveles generados (5) ⇒ nunca disponible, aun completo', () => {
    // Sin generados no hay desafío, sin importar el progreso.
    expect(desafioDisponible(5, conMundoCompleto(5))).toBe(false);
    expect(desafioDisponible(5, conMundoCompleto(5, califTresEstrellas))).toBe(false);
  });

  it('mundo completo con generados ⇒ disponible; retroactivo a 0, 1, 2 y 3', () => {
    for (const mundo of [0, 1, 2, 3] as const) {
      const completo = conMundoCompleto(mundo);
      expect(desafioDisponible(mundo, completo)).toBe(true);
    }
  });

  it('mundo 4: solo precisión no basta; con tres estrellas en todos sus niveles ⇒ disponible (R24.5)', () => {
    expect(desafioDisponible(4, cargarProgreso(null))).toBe(false);
    expect(desafioDisponible(4, conMundoCompleto(4))).toBe(false);
    expect(desafioDisponible(4, conMundoCompleto(4, califTresEstrellas))).toBe(true);
  });

  it('mundo 4: un nivel sin las tres estrellas lo deja no disponible', () => {
    const ids = idsDelMundo(4);
    const progreso = cargarProgreso(null);
    for (const id of ids.slice(0, -1)) progreso.guardar(id, 1, califTresEstrellas(), 1);
    progreso.guardar(ids[ids.length - 1]!, 1, califPrecision(), 1);
    expect(desafioDisponible(4, progreso)).toBe(false);
  });

  it('un nivel faltante en el mundo lo deja no disponible', () => {
    // Aprobar todos menos el último nivel del mundo 3.
    const ids = idsDelMundo(3);
    const progreso = cargarProgreso(null);
    for (const id of ids.slice(0, -1)) progreso.guardar(id, 1, califPrecision(), 1);
    expect(desafioDisponible(3, progreso)).toBe(false);
  });
});
