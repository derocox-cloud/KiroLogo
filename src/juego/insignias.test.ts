<<<<<<< HEAD
// Pruebas de la insignia Secuencia (requisito 8).
import { describe, it, expect } from 'vitest';
import { cargarProgreso, type Progreso } from './progreso.js';
import type { Calificacion } from './estrellas.js';
import { insigniaSecuenciaOtorgada, insigniasDelMundo } from './insignias.js';

// ============================================================================
// Ayudas
// ============================================================================

const IDS = ['0.1', '0.2', '0.3', '0.4', '0.5'] as const;

function calif(p: boolean, e: boolean, a: boolean): Calificacion {
  const est = (o: boolean) => (o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } });
  return { precision: est(p), economia: est(e), abstraccion: est(a), conteoJugador: 1, presupuestoEstrella: 1 };
}

/** Progreso con cada nivel dado completado con las tres estrellas. */
function conTresEstrellas(...ids: string[]): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of ids) progreso.guardar(id, 1, calif(true, true, true), 1);
  return progreso;
}

// ============================================================================
// Otorgamiento
// ============================================================================

describe('insignia Secuencia', () => {
  it('se otorga con las tres estrellas en los cinco niveles del mundo 0', () => {
    const progreso = conTresEstrellas(...IDS);
    expect(insigniaSecuenciaOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(0, progreso)).toEqual(['secuencia']);
  });

  it('no se otorga si falta algún nivel por completo', () => {
    const progreso = conTresEstrellas('0.1', '0.2', '0.3', '0.4'); // falta el 0.5
    expect(insigniaSecuenciaOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(0, progreso)).toEqual([]);
  });

  it('no se otorga si a un nivel le falta una sola estrella', () => {
    // Cuatro niveles completos y el 0.3 con solo dos estrellas (falta abstracción).
    const parcial = cargarProgreso(null);
    for (const id of ['0.1', '0.2', '0.4', '0.5']) parcial.guardar(id, 1, calif(true, true, true), 1);
    parcial.guardar('0.3', 1, calif(true, true, false), 1);
    expect(insigniaSecuenciaOtorgada(parcial)).toBe(false);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaSecuenciaOtorgada(cargarProgreso(null))).toBe(false);
  });

  it('aprobar los cinco niveles solo con precisión no basta: exige las tres', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS) progreso.guardar(id, 1, calif(true, false, false), 1);
    expect(insigniaSecuenciaOtorgada(progreso)).toBe(false);
=======
// Pruebas de las insignias de concepto (tarea 5.2).
// La insignia 'iteracion' se gana con las tres estrellas en todos los niveles
// del mundo 1. Los niveles se derivan del catálogo, así que el test también los
// cruza contra el catálogo para no fijar una lista a mano que pueda desalinearse.

import { describe, it, expect } from 'vitest';
import { INSIGNIAS, evaluarInsignia } from './insignias.js';
import type { EstadoInsignias } from './insignias.js';
import type { EstrellasGuardadas } from './progreso.js';
import { CATALOGO } from '../niveles/catalogo.js';

// ============================================================================
// Utilidades de simulación
// ============================================================================

const TRES_ESTRELLAS: EstrellasGuardadas = { precision: true, economia: true, abstraccion: true };
const DOS_ESTRELLAS: EstrellasGuardadas = { precision: true, economia: true, abstraccion: false };

/** Ids de los niveles del mundo 1, derivados del catálogo (no hardcodeados). */
const NIVELES_MUNDO_1 = CATALOGO.filter((n) => n.mundo === 1).map((n) => n.id);

/**
 * Estado de juego simulado a partir de un mapa id → estrellas. Un nivel ausente
 * del mapa se comporta como un nivel sin jugar (null), igual que el progreso real.
 */
function estadoSimulado(estrellasPorNivel: Record<string, EstrellasGuardadas>): EstadoInsignias {
  return {
    estrellasDe(idNivel: string): EstrellasGuardadas | null {
      return estrellasPorNivel[idNivel] ?? null;
    },
  };
}

/** Estado con las tres estrellas en todos los niveles del mundo 1. */
function mundo1Completo(): Record<string, EstrellasGuardadas> {
  const mapa: Record<string, EstrellasGuardadas> = {};
  for (const id of NIVELES_MUNDO_1) mapa[id] = TRES_ESTRELLAS;
  return mapa;
}

// ============================================================================
// Registro de la insignia (5.1)
// ============================================================================

describe('registro de insignias', () => {
  it('la insignia iteracion está registrada con nombre y mundo', () => {
    const iteracion = INSIGNIAS.find((i) => i.id === 'iteracion');
    expect(iteracion).toBeDefined();
    expect(iteracion?.nombre).toBe('Iteración');
    expect(iteracion?.mundo).toBe(1);
  });

  it('el catálogo tiene cinco niveles en el mundo 1', () => {
    // Garantiza que la derivación del estado completo recorre los cinco niveles.
    expect(NIVELES_MUNDO_1).toHaveLength(5);
>>>>>>> 5e8e690 (spec-02-mundo-1: figuras geometricas, REPITE, reproduccion en paralelo e insignia Iteracion)
  });
});

// ============================================================================
<<<<<<< HEAD
// Derivado del progreso y alcance
// ============================================================================

describe('insignias · derivado del progreso y alcance', () => {
  it('reconstruir el progreso desde las mismas estrellas da el mismo otorgamiento', () => {
    const a = conTresEstrellas(...IDS);
    const b = conTresEstrellas(...[...IDS].reverse()); // otro orden de guardado
    expect(insigniaSecuenciaOtorgada(a)).toBe(insigniaSecuenciaOtorgada(b));
  });

  it('ningún otro mundo otorga insignia en esta spec', () => {
    const progreso = conTresEstrellas(...IDS);
    for (const mundo of [1, 2, 3, 4, 5]) {
      expect(insigniasDelMundo(mundo, progreso)).toEqual([]);
    }
=======
// Evaluación de la insignia iteracion (5.2)
// ============================================================================

describe('evaluarInsignia · iteracion', () => {
  it('se otorga con las tres estrellas en 1.1–1.5', () => {
    const estado = estadoSimulado(mundo1Completo());
    expect(evaluarInsignia('iteracion', estado)).toBe(true);
  });

  it('no se otorga si a un nivel le falta la estrella de abstracción', () => {
    const mapa = mundo1Completo();
    // Un solo nivel con dos estrellas basta para negar la insignia.
    mapa[NIVELES_MUNDO_1[1]!] = DOS_ESTRELLAS;
    const estado = estadoSimulado(mapa);
    expect(evaluarInsignia('iteracion', estado)).toBe(false);
  });

  it('no se otorga si un nivel del mundo está sin jugar', () => {
    const mapa = mundo1Completo();
    delete mapa[NIVELES_MUNDO_1[0]!];
    const estado = estadoSimulado(mapa);
    expect(evaluarInsignia('iteracion', estado)).toBe(false);
  });

  it('no se otorga para un identificador de insignia desconocido', () => {
    const estado = estadoSimulado(mundo1Completo());
    expect(evaluarInsignia('inexistente', estado)).toBe(false);
>>>>>>> 5e8e690 (spec-02-mundo-1: figuras geometricas, REPITE, reproduccion en paralelo e insignia Iteracion)
  });
});
