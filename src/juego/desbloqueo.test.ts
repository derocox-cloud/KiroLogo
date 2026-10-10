// Pruebas del desbloqueo de niveles y mundos (requisito 7).
import { describe, it, expect } from 'vitest';
import { cargarProgreso, type Progreso } from './progreso.js';
import type { Calificacion } from './estrellas.js';
import { estadoDeNivel, nivelDesbloqueado, mundoDesbloqueado } from './desbloqueo.js';

// ============================================================================
// Ayudas
// ============================================================================

const IDS = ['0.1', '0.2', '0.3', '0.4', '0.5'] as const;

/** Calificación con las estrellas pedidas. */
function calif(p: boolean, e: boolean, a: boolean): Calificacion {
  const est = (o: boolean) => (o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } });
  return { precision: est(p), economia: est(e), abstraccion: est(a), conteoJugador: 1, presupuestoEstrella: 1 };
}

/** Progreso en memoria con un conjunto de niveles aprobados (solo precisión). */
function conAprobados(...idsAprobados: string[]): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of idsAprobados) progreso.guardar(id, 1, calif(true, false, false), 1);
  return progreso;
}

/** Progreso con un conjunto de niveles completados con las tres estrellas. */
function conTresEstrellas(...idsTres: string[]): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of idsTres) progreso.guardar(id, 1, calif(true, true, true), 1);
  return progreso;
}

// ============================================================================
// Nivel de inicio
// ============================================================================

describe('desbloqueo · nivel de inicio', () => {
  it('el 0.1 está siempre desbloqueado, incluso sin progreso', () => {
    const vacio = cargarProgreso(null);
    expect(nivelDesbloqueado('0.1', vacio)).toBe(true);
    expect(estadoDeNivel('0.1', vacio)).toBe('desbloqueado');
  });

  it('sin progreso, los demás niveles del mundo 0 están bloqueados', () => {
    const vacio = cargarProgreso(null);
    for (const id of ['0.2', '0.3', '0.4', '0.5']) {
      expect(nivelDesbloqueado(id, vacio)).toBe(false);
      expect(estadoDeNivel(id, vacio)).toBe('bloqueado');
    }
  });
});

// ============================================================================
// Cadena de desbloqueo dentro del mundo
// ============================================================================

describe('desbloqueo · cadena dentro del mundo', () => {
  it('aprobar un nivel desbloquea el siguiente, no los posteriores', () => {
    const progreso = conAprobados('0.1');
    expect(nivelDesbloqueado('0.2', progreso)).toBe(true);
    expect(nivelDesbloqueado('0.3', progreso)).toBe(false);
  });

  it('la cadena avanza 0.1 → 0.2 → 0.3 → 0.4 → 0.5 al aprobar en orden', () => {
    // Aprobando acumulativamente, cada aprobado abre el siguiente.
    for (let i = 1; i < IDS.length; i++) {
      const previos = IDS.slice(0, i); // 0.1..0.{i}
      const progreso = conAprobados(...previos);
      expect(nivelDesbloqueado(IDS[i]!, progreso)).toBe(true);
      // El de dos pasos más allá sigue bloqueado.
      if (i + 1 < IDS.length) {
        expect(nivelDesbloqueado(IDS[i + 1]!, progreso)).toBe(false);
      }
    }
  });

  it('un nivel aprobado sin tres estrellas tiene estado «aprobado»', () => {
    const progreso = conAprobados('0.1');
    expect(estadoDeNivel('0.1', progreso)).toBe('aprobado');
  });

  it('un nivel con las tres estrellas tiene estado «tresEstrellas»', () => {
    const progreso = conTresEstrellas('0.1');
    expect(estadoDeNivel('0.1', progreso)).toBe('tresEstrellas');
  });
});

// ============================================================================
// Desbloqueo de mundos
// ============================================================================

describe('desbloqueo · mundos', () => {
  it('el mundo 0 está desbloqueado desde el inicio', () => {
    expect(mundoDesbloqueado(0, cargarProgreso(null))).toBe(true);
  });

  it('el mundo 1 se abre solo cuando los cinco niveles del mundo 0 están aprobados', () => {
    // Faltando uno, el mundo 1 sigue cerrado.
    const casi = conAprobados('0.1', '0.2', '0.3', '0.4');
    expect(mundoDesbloqueado(1, casi)).toBe(false);
    // Con los cinco aprobados, se abre.
    const todos = conAprobados(...IDS);
    expect(mundoDesbloqueado(1, todos)).toBe(true);
  });

  it('aprobar basta para abrir el mundo siguiente: no exige las tres estrellas', () => {
    const todosAprobados = conAprobados(...IDS); // solo precisión
    expect(mundoDesbloqueado(1, todosAprobados)).toBe(true);
  });
});

// ============================================================================
// Derivado solo del progreso (reproducible)
// ============================================================================

describe('desbloqueo · derivado del progreso', () => {
  it('reconstruir el progreso desde las mismas estrellas da el mismo desbloqueo', () => {
    const a = conAprobados('0.1', '0.2');
    const b = conAprobados('0.2', '0.1'); // mismo conjunto, otro orden de guardado
    for (const id of IDS) {
      expect(nivelDesbloqueado(id, a)).toBe(nivelDesbloqueado(id, b));
      expect(estadoDeNivel(id, a)).toBe(estadoDeNivel(id, b));
    }
  });

  it('un identificador desconocido no está desbloqueado y su estado es bloqueado', () => {
    const progreso = conAprobados('0.1');
    expect(nivelDesbloqueado('9.9', progreso)).toBe(false);
    expect(estadoDeNivel('9.9', progreso)).toBe('bloqueado');
  });
});
