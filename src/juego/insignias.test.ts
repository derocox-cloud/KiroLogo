// Pruebas de las insignias Secuencia (mundo 0), Iteración (mundo 1) y
// Descomposición (mundo 2), requisito 8 (specs 00-01) y requisito 11 (spec 03).
import { describe, it, expect } from 'vitest';
import { cargarProgreso, type Progreso } from './progreso.js';
import type { Calificacion } from './estrellas.js';
import {
  insigniaSecuenciaOtorgada,
  insigniaIteracionOtorgada,
  insigniaDescomposicionOtorgada,
  insigniasDelMundo,
} from './insignias.js';
import { CATALOGO } from '../niveles/catalogo.js';

// ============================================================================
// Ayudas
// ============================================================================

const IDS = ['0.1', '0.2', '0.3', '0.4', '0.5'] as const;

/** Ids de los niveles del mundo 1, derivados del catálogo (no hardcodeados). */
const IDS_MUNDO_1 = CATALOGO.filter((n) => n.mundo === 1).map((n) => n.id);

/** Ids de los niveles del mundo 2, derivados del catálogo (no hardcodeados). */
const IDS_MUNDO_2 = CATALOGO.filter((n) => n.mundo === 2).map((n) => n.id);

function calif(p: boolean, e: boolean, a: boolean): Calificacion {
  const est = (o: boolean) => (o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } });
  return { precision: est(p), economia: est(e), abstraccion: est(a), conteoJugador: 1, presupuestoEstrella: 1, mensajeAbstraccion: null };
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
  });
});

// ============================================================================
// Insignia Iteración (mundo 1)
// ============================================================================

describe('insignia Iteración', () => {
  it('el catálogo tiene cinco niveles en el mundo 1', () => {
    expect(IDS_MUNDO_1).toHaveLength(5);
  });

  it('se otorga con las tres estrellas en todos los niveles del mundo 1', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_1);
    expect(insigniaIteracionOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(1, progreso)).toEqual(['iteracion']);
  });

  it('no se otorga si a un nivel le falta la estrella de abstracción', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS_MUNDO_1.slice(1)) progreso.guardar(id, 1, calif(true, true, true), 1);
    progreso.guardar(IDS_MUNDO_1[0]!, 1, calif(true, true, false), 1);
    expect(insigniaIteracionOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(1, progreso)).toEqual([]);
  });

  it('no se otorga si un nivel del mundo está sin jugar', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_1.slice(1)); // falta el primero
    expect(insigniaIteracionOtorgada(progreso)).toBe(false);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaIteracionOtorgada(cargarProgreso(null))).toBe(false);
  });
});

// ============================================================================
// Insignia Descomposición (mundo 2), requisito 11
// ============================================================================

describe('insignia Descomposición', () => {
  it('el catálogo tiene seis niveles en el mundo 2', () => {
    expect(IDS_MUNDO_2).toEqual(['2.1', '2.2', '2.3', '2.4', '2.5', '2.6']);
  });

  it('se otorga con las tres estrellas en todos los niveles del mundo 2 (R11.1)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_2);
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(2, progreso)).toEqual(['descomposicion']);
  });

  it('no se otorga si a un nivel le falta una sola estrella (R11.2)', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS_MUNDO_2.slice(1)) progreso.guardar(id, 1, calif(true, true, true), 1);
    // El 2.1 queda con precisión y economía pero sin abstracción.
    progreso.guardar(IDS_MUNDO_2[0]!, 1, calif(true, true, false), 1);
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(2, progreso)).toEqual([]);
  });

  it('no se otorga si un nivel del mundo está sin jugar (R11.2)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_2.slice(1)); // falta el primero
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(2, progreso)).toEqual([]);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaDescomposicionOtorgada(cargarProgreso(null))).toBe(false);
  });

  it('se mantiene otorgada exactamente una vez al recompletar el mundo (R11.5)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_2);
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(true);
    // "Recompletar" un nivel ya completo no crea una segunda instancia: la
    // insignia se deriva del progreso, así que sigue otorgada y sin duplicar.
    progreso.guardar(IDS_MUNDO_2[0]!, 1, calif(true, true, true), 1);
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(2, progreso)).toEqual(['descomposicion']);
  });
});

// ============================================================================
describe('insignias · derivado del progreso y alcance', () => {
  it('reconstruir el progreso desde las mismas estrellas da el mismo otorgamiento', () => {
    const a = conTresEstrellas(...IDS);
    const b = conTresEstrellas(...[...IDS].reverse()); // otro orden de guardado
    expect(insigniaSecuenciaOtorgada(a)).toBe(insigniaSecuenciaOtorgada(b));
  });

  it('ningún mundo sin insignia declarada la otorga en esta spec', () => {
    // Mundos 3 a 5 no tienen insignia declarada todavía; aunque se completaran
    // sus niveles, insigniasDelMundo no devolvería nada para ellos.
    const progreso = conTresEstrellas(...IDS, ...IDS_MUNDO_1, ...IDS_MUNDO_2);
    for (const mundo of [3, 4, 5]) {
      expect(insigniasDelMundo(mundo, progreso)).toEqual([]);
    }
  });
});
