// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { crearSelectorNivel, type SelectorNivel } from './selector-nivel.js';
import { cargarProgreso, type Progreso } from '../juego/progreso.js';
import type { Calificacion } from '../juego/estrellas.js';

// ============================================================================
// Ayudas
// ============================================================================

const IDS = ['0.1', '0.2', '0.3', '0.4', '0.5'] as const;
let contenedor: HTMLElement;
let elegidos: string[];

function calif(p: boolean, e: boolean, a: boolean): Calificacion {
  const est = (o: boolean) => (o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } });
  return { precision: est(p), economia: est(e), abstraccion: est(a), conteoJugador: 1, presupuestoEstrella: 1 };
}

function conAprobados(...ids: string[]): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of ids) progreso.guardar(id, 1, calif(true, false, false), 1);
  return progreso;
}

function conTresEstrellas(...ids: string[]): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of ids) progreso.guardar(id, 1, calif(true, true, true), 1);
  return progreso;
}

function crear(progreso: Progreso): SelectorNivel {
  return crearSelectorNivel({
    contenedor,
    mundo: 0,
    progreso,
    callbacks: { alElegirNivel: (id) => elegidos.push(id) },
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="aplicacion"></div>';
  contenedor = document.getElementById('aplicacion') as HTMLElement;
  elegidos = [];
});

// ============================================================================
// Presentación
// ============================================================================

describe('selector-nivel · presentación', () => {
  it('presenta los cinco niveles del mundo 0 en orden', () => {
    const sel = crear(cargarProgreso(null));
    const botones = sel.raiz.querySelectorAll('button[data-nivel]');
    expect([...botones].map((b) => b.getAttribute('data-nivel'))).toEqual([...IDS]);
  });

  it('sin progreso: 0.1 disponible, el resto bloqueado', () => {
    const sel = crear(cargarProgreso(null));
    expect(sel.estadoDe('0.1')).toBe('desbloqueado');
    for (const id of ['0.2', '0.3', '0.4', '0.5']) {
      expect(sel.estadoDe(id)).toBe('bloqueado');
    }
  });

  it('comunica el estado por texto y forma, no solo por color', () => {
    const sel = crear(conTresEstrellas('0.1'));
    const b01 = sel.boton('0.1')!;
    // Nombre accesible con el estado en palabras.
    expect(b01.getAttribute('aria-label')).toMatch(/tres estrellas/i);
    // Atributo de estado y símbolo de forma en el texto visible.
    expect(b01.getAttribute('data-estado')).toBe('tresEstrellas');
    expect(b01.textContent).toContain('★★★');
    // Un bloqueado lleva su propia marca y palabra. Con solo el 0.1 hecho, el
    // 0.2 queda disponible, así que el 0.3 es el primer bloqueado.
    const b03 = sel.boton('0.3')!;
    expect(b03.getAttribute('aria-label')).toMatch(/bloqueado/i);
    expect(b03.textContent).toContain('🔒');
  });

  it('refleja los cuatro estados', () => {
    // 0.1 tres estrellas, 0.2 aprobado (abre 0.3 disponible), 0.3 bloqueado... 
    const progreso = cargarProgreso(null);
    progreso.guardar('0.1', 1, calif(true, true, true), 1); // tresEstrellas
    progreso.guardar('0.2', 1, calif(true, false, false), 1); // aprobado → abre 0.3
    const sel = crear(progreso);
    expect(sel.estadoDe('0.1')).toBe('tresEstrellas');
    expect(sel.estadoDe('0.2')).toBe('aprobado');
    expect(sel.estadoDe('0.3')).toBe('desbloqueado');
    expect(sel.estadoDe('0.4')).toBe('bloqueado');
  });
});

// ============================================================================
// Navegación
// ============================================================================

describe('selector-nivel · navegación', () => {
  it('elegir un nivel desbloqueado invoca el callback', () => {
    const sel = crear(conAprobados('0.1')); // abre 0.2
    sel.boton('0.2')!.click();
    expect(elegidos).toEqual(['0.2']);
  });

  it('elegir un nivel bloqueado no navega', () => {
    const sel = crear(cargarProgreso(null));
    sel.boton('0.3')!.click();
    expect(elegidos).toEqual([]);
    expect(sel.boton('0.3')!.disabled).toBe(true);
  });
});

// ============================================================================
// Insignia
// ============================================================================

describe('selector-nivel · insignia', () => {
  it('oculta la insignia hasta completar los cinco niveles con tres estrellas', () => {
    const sel = crear(conTresEstrellas('0.1', '0.2', '0.3', '0.4'));
    expect(sel.insigniaVisible()).toBe(false);
  });

  it('muestra la insignia por texto al completar el mundo', () => {
    const sel = crear(conTresEstrellas(...IDS));
    expect(sel.insigniaVisible()).toBe(true);
    expect(sel.raiz.textContent).toMatch(/insignia secuencia/i);
  });

  it('refrescar vuelve a leer el progreso', () => {
    const progreso = cargarProgreso(null);
    const sel = crear(progreso);
    expect(sel.estadoDe('0.2')).toBe('bloqueado');
    progreso.guardar('0.1', 1, calif(true, false, false), 1);
    sel.refrescar();
    expect(sel.estadoDe('0.2')).toBe('desbloqueado');
  });
});
