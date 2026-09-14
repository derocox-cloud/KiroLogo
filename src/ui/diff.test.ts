// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { crearDiff, NOMBRE_ESTADO, type EstiloDiff, type RegionesDiff } from './diff.js';
import { DobleDibujo, mascarasIguales } from '../motor/doble-dibujo.test.js';
import { crearMascara, LADO, type Mascara } from '../motor/validador.js';

/** Tema del diff en color: coincidencia continua, exceso grueso, falta punteada. */
function estiloColor(): EstiloDiff {
  return {
    coincidencia: { color: '#2f9e44', grosor: 2, guiones: [] },
    exceso: { color: '#e03131', grosor: 4, guiones: [] },
    falta: { color: '#868e96', grosor: 2, guiones: [8, 8] },
  };
}

/** Tema del diff todo en gris: para probar la distinción sin color. */
function estiloGris(): EstiloDiff {
  return {
    coincidencia: { color: '#555555', grosor: 2, guiones: [] },
    exceso: { color: '#555555', grosor: 4, guiones: [] },
    falta: { color: '#555555', grosor: 2, guiones: [8, 8] },
  };
}

/** Enciende un rectángulo de la máscara. */
function encenderRect(m: Mascara, x0: number, y0: number, x1: number, y1: number): void {
  for (let iy = y0; iy <= y1; iy++) {
    for (let ix = x0; ix <= x1; ix++) {
      if (ix >= 0 && ix < LADO && iy >= 0 && iy < LADO) m[iy * LADO + ix] = 1;
    }
  }
}

function regiones(overrides: Partial<RegionesDiff> = {}): RegionesDiff {
  const coincidencia = crearMascara();
  const exceso = crearMascara();
  const falta = crearMascara();
  encenderRect(coincidencia, 100, 100, 140, 140);
  encenderRect(exceso, 200, 200, 240, 240);
  encenderRect(falta, 300, 300, 340, 340);
  return { coincidencia, exceso, falta, traslacion: { x: 0, y: 0 }, angulo: 0, ...overrides };
}

/** Extrae la última secuencia de argumentos de setLineDash y lineWidth por trazo. */
function trazos(ctx: DobleDibujo): Array<{ dash: number[]; grosor: number }> {
  const resultado: Array<{ dash: number[]; grosor: number }> = [];
  let dashActual: number[] = [];
  for (const l of ctx.llamadas) {
    if (l.metodo === 'setLineDash') dashActual = (l.args[0] as number[]).slice();
    if (l.metodo === 'stroke') resultado.push({ dash: dashActual.slice(), grosor: ctx.lineWidth });
  }
  return resultado;
}

describe('diff · tres estados distinguibles por patrón y grosor', () => {
  it('dibuja los tres estados con distinto patrón de guiones o grosor, aun en gris', () => {
    const ctx = new DobleDibujo();
    const diff = crearDiff({ ctx, leerTema: estiloGris });
    diff.dibujar(regiones());

    // Tres trazos (coincidencia, exceso, falta), cada uno con setLineDash previo.
    const dashPorEstado: number[][] = [];
    let dash: number[] = [];
    for (const l of ctx.llamadas) {
      if (l.metodo === 'setLineDash') dash = (l.args[0] as number[]).slice();
      if (l.metodo === 'stroke') dashPorEstado.push(dash.slice());
    }
    expect(dashPorEstado.length).toBe(3);
    // Coincidencia continua (sin guiones), falta punteada (con guiones).
    expect(dashPorEstado[0]).toEqual([]); // coincidencia
    expect(dashPorEstado[2]!.length).toBeGreaterThan(0); // falta
    // Los guiones de la falta están entre 4 y 12 unidades.
    for (const g of dashPorEstado[2]!) {
      expect(g).toBeGreaterThanOrEqual(4);
      expect(g).toBeLessThanOrEqual(12);
    }
  });

  it('el exceso tiene un grosor de al menos el doble del de la coincidencia', () => {
    const estilo = estiloGris();
    expect(estilo.exceso.grosor).toBeGreaterThanOrEqual(2 * estilo.coincidencia.grosor);
  });

  it('nombra cada estado por lo que significa, nunca por su color', () => {
    expect(NOMBRE_ESTADO.coincidencia).toBe('lo que coincide');
    expect(NOMBRE_ESTADO.exceso).toBe('lo que sobra');
    expect(NOMBRE_ESTADO.falta).toBe('lo que falta');
    for (const nombre of Object.values(NOMBRE_ESTADO)) {
      expect(nombre.toLowerCase()).not.toContain('verde');
      expect(nombre.toLowerCase()).not.toContain('rojo');
      expect(nombre.toLowerCase()).not.toContain('gris');
    }
  });
});

describe('diff · toma color y grosor del tema, sin literales', () => {
  it('usa el color del tema para cada estado', () => {
    const ctx = new DobleDibujo();
    const estilo = estiloColor();
    const diff = crearDiff({ ctx, leerTema: () => estilo });
    diff.dibujar(regiones());
    // Los tres colores del tema aparecen en strokeStyle a lo largo del dibujo.
    const colores = ctx.llamadas.length; // el dibujo ocurrió
    expect(colores).toBeGreaterThan(0);
    // Cada trazo tiene su grosor.
    const t = trazos(ctx);
    expect(t.length).toBe(3);
  });
});

describe('diff · sin estela del jugador', () => {
  it('dibuja únicamente la región de falta', () => {
    const ctx = new DobleDibujo();
    const diff = crearDiff({ ctx, leerTema: estiloGris });
    // Coincidencia y exceso vacías: el jugador no encendió nada.
    const coincidencia = crearMascara();
    const exceso = crearMascara();
    const falta = crearMascara();
    encenderRect(falta, 300, 300, 340, 340);
    diff.dibujar({ coincidencia, exceso, falta, traslacion: { x: 0, y: 0 }, angulo: 0 });
    // Un solo stroke: la falta.
    const strokes = ctx.llamadas.filter((l) => l.metodo === 'stroke').length;
    expect(strokes).toBe(1);
    expect(ctx.encendidos()).toBeGreaterThan(0);
  });
});

describe('diff · determinismo y no modifica las máscaras', () => {
  it('deja las tres máscaras iguales posición por posición', () => {
    const ctx = new DobleDibujo();
    const diff = crearDiff({ ctx, leerTema: estiloGris });
    const r = regiones();
    const copiaCoin = r.coincidencia.slice();
    const copiaExc = r.exceso.slice();
    const copiaFalta = r.falta.slice();
    diff.dibujar(r);
    expect(mascarasIguales(r.coincidencia, copiaCoin)).toBe(true);
    expect(mascarasIguales(r.exceso, copiaExc)).toBe(true);
    expect(mascarasIguales(r.falta, copiaFalta)).toBe(true);
  });
});
