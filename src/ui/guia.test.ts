// Pruebas de la guía de primeros pasos (requisito 10).
import { describe, it, expect, beforeEach } from 'vitest';
import { crearGuia, PASOS_GUIA, type Guia, type GloboParaGuia } from './guia.js';

// ============================================================================
// Doble del globo que registra lo publicado
// ============================================================================

let publicado: string[];
let completadas: number;

function globoDoble(): GloboParaGuia {
  return { celebrar: (t: string) => publicado.push(t) };
}

function crear(): Guia {
  return crearGuia({ globo: globoDoble(), alCompletar: () => (completadas += 1) });
}

beforeEach(() => {
  publicado = [];
  completadas = 0;
});

// ============================================================================
// Secuencia de pasos
// ============================================================================

describe('guia · secuencia de pasos', () => {
  it('iniciar publica el primer paso', () => {
    const guia = crear();
    expect(guia.pasoActual).toBe(-1);
    guia.iniciar();
    expect(guia.activa).toBe(true);
    expect(guia.pasoActual).toBe(0);
    expect(publicado).toEqual([PASOS_GUIA[0]]);
  });

  it('avanza por acción, un paso cada vez, hasta el último', () => {
    const guia = crear();
    guia.iniciar();
    guia.avanzar();
    expect(guia.pasoActual).toBe(1);
    guia.avanzar();
    expect(guia.pasoActual).toBe(2);
    // En el último paso no avanza más (espera el acierto).
    guia.avanzar();
    expect(guia.pasoActual).toBe(PASOS_GUIA.length - 1);
    expect(publicado).toEqual([...PASOS_GUIA]);
  });

  it('el último paso enseña el primer comando con un ejemplo accionable', () => {
    expect(PASOS_GUIA[PASOS_GUIA.length - 1]).toContain('AVANZA 100');
  });

  it('ningún paso está vacío', () => {
    for (const paso of PASOS_GUIA) expect(paso.trim().length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Primer acierto y completado
// ============================================================================

describe('guia · primer acierto', () => {
  it('al primer acierto cede a la celebración, se desactiva y marca completada', () => {
    const guia = crear();
    guia.iniciar();
    guia.alPrimerAcierto();
    expect(guia.activa).toBe(false);
    expect(completadas).toBe(1);
  });

  it('no vuelve a iniciarse tras completarse', () => {
    const guia = crear();
    guia.iniciar();
    guia.alPrimerAcierto();
    publicado = [];
    guia.iniciar(); // no debe reactivarse
    expect(guia.activa).toBe(false);
    expect(publicado).toEqual([]);
  });

  it('marca completada una sola vez aunque se acierte de nuevo', () => {
    const guia = crear();
    guia.iniciar();
    guia.alPrimerAcierto();
    guia.alPrimerAcierto();
    expect(completadas).toBe(1);
  });

  it('avanzar tras completarse no hace nada', () => {
    const guia = crear();
    guia.iniciar();
    guia.alPrimerAcierto();
    publicado = [];
    guia.avanzar();
    expect(publicado).toEqual([]);
  });
});
