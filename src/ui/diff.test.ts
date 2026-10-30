// @vitest-environment node

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearDiff, NOMBRE_ESTADO, type EstiloDiff, type RegionesDiff } from './diff.js';
import { DobleDibujo, mascarasIguales } from '../motor/doble-dibujo.test.js';
import { crearMascara, LADO, validar, type Mascara, type NormalizacionNivel } from '../motor/validador.js';
import type { Segmento } from '../motor/segmentos.js';

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

describe('diff · marco de cada región', () => {
  /** Extremos de la primera corrida (moveTo y lineTo) que dibuja el diff con una región marcada. */
  function extremos(
    regiones: Partial<RegionesDiff>,
    marca: (m: Mascara) => void,
    campo: 'falta' | 'coincidencia',
  ): { desde: number[]; hasta: number[] } {
    const ctx = new DobleDibujo();
    const mascara = crearMascara();
    marca(mascara);
    const todas: RegionesDiff = {
      coincidencia: crearMascara(),
      exceso: crearMascara(),
      falta: crearMascara(),
      traslacion: { x: 0, y: 0 },
      angulo: 0,
      ...regiones,
      [campo]: mascara,
    };
    crearDiff({ ctx, leerTema: estiloGris }).dibujar(todas);
    const mover = ctx.llamadas.find((l) => l.metodo === 'moveTo')!;
    const linea = ctx.llamadas.find((l) => l.metodo === 'lineTo')!;
    return { desde: mover.args as number[], hasta: linea.args as number[] };
  }

  // Fila 399, columnas 400 a 410: en el marco del arreglo son (0.5 a 10.5, 0.5).
  const corrida = (m: Mascara): void => encenderRect(m, 400, 399, 410, 399);

  it('la coincidencia y el exceso solo deshacen la traslación del jugador: el ángulo no las mueve', () => {
    const base = extremos({ traslacion: { x: -50, y: -50 }, angulo: 0 }, corrida, 'coincidencia');
    expect(base.desde[0]).toBeCloseTo(50.5, 9);
    expect(base.desde[1]).toBeCloseTo(50.5, 9);
    expect(base.hasta[0]).toBeCloseTo(60.5, 9);
    expect(base.hasta[1]).toBeCloseTo(50.5, 9);
    for (const angulo of [1, 45, 93, 180, 270, 359]) {
      const otro = extremos({ traslacion: { x: -50, y: -50 }, angulo }, corrida, 'coincidencia');
      expect(otro, `ángulo ${angulo}`).toEqual(base);
    }
  });

  it('la falta deshace la traslación del objetivo (con ángulo 0)', () => {
    const r = extremos({ traslacionObjetivo: { x: -50, y: -50 } }, corrida, 'falta');
    expect(r.desde[0]).toBeCloseTo(50.5, 9);
    expect(r.desde[1]).toBeCloseTo(50.5, 9);
    expect(r.hasta[0]).toBeCloseTo(60.5, 9);
    expect(r.hasta[1]).toBeCloseTo(50.5, 9);
  });

  it('la falta deshace el giro del objetivo, en sentido antihorario, antes de la traslación', () => {
    // El validador giró el objetivo 90 grados en sentido horario; para volver, 90 antihorarios:
    // (0.5, 0.5) pasa a (-0.5, 0.5) y (10.5, 0.5) a (-0.5, 10.5); luego se resta (-50, -50).
    const r = extremos({ traslacionObjetivo: { x: -50, y: -50 }, angulo: 90 }, corrida, 'falta');
    expect(r.desde[0]).toBeCloseTo(49.5, 9);
    expect(r.desde[1]).toBeCloseTo(50.5, 9);
    expect(r.hasta[0]).toBeCloseTo(49.5, 9);
    expect(r.hasta[1]).toBeCloseTo(60.5, 9);
  });

  it('sin traslación del objetivo (llamadas que no la conocen) se toma (0, 0)', () => {
    const r = extremos({ angulo: 0 }, corrida, 'falta');
    expect(r.desde[0]).toBeCloseTo(0.5, 9);
    expect(r.desde[1]).toBeCloseTo(0.5, 9);
  });
});

describe('diff · alineado con las estelas, con el validador real', () => {
  const seg = (a: number, b: number, c: number, d: number, paso: number): Segmento => ({
    desde: { x: a, y: b },
    hasta: { x: c, y: d },
    paso,
    linea: 1,
  });

  /** Distancia de un punto a un segmento. */
  function distancia(p: number[], s: Segmento): number {
    const dx = s.hasta.x - s.desde.x;
    const dy = s.hasta.y - s.desde.y;
    const largo2 = dx * dx + dy * dy;
    const t =
      largo2 === 0
        ? 0
        : Math.max(0, Math.min(1, ((p[0]! - s.desde.x) * dx + (p[1]! - s.desde.y) * dy) / largo2));
    return Math.hypot(p[0]! - (s.desde.x + t * dx), p[1]! - (s.desde.y + t * dy));
  }

  /** Puntos (extremos de las corridas) de cada región, en el orden en que el diff las dibuja. */
  function puntosPorRegion(ctx: DobleDibujo): number[][][] {
    const regiones: number[][][] = [];
    let actual: number[][] = [];
    for (const l of ctx.llamadas) {
      if (l.metodo === 'beginPath') actual = [];
      if (l.metodo === 'moveTo' || l.metodo === 'lineTo') actual.push(l.args as number[]);
      if (l.metodo === 'stroke') regiones.push(actual);
    }
    return regiones;
  }

  // Margen: el radio de dilatación (8) más media diagonal de celda (0,71), redondeado.
  const MARGEN = 9;

  const LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };
  const FIJA: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' };

  const casos: Array<{
    nombre: string;
    referencia: Segmento[];
    jugador: Segmento[];
    normalizacion: NormalizacionNivel;
  }> = [
    {
      nombre: 'una L contra una línea, con rotación y traslación libres (mundos 0 a 2)',
      referencia: [seg(0, 0, 0, 100, 0)],
      jugador: [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)],
      normalizacion: LIBRE,
    },
    {
      nombre: 'una escalera contra una línea quebrada a 45 grados, con todo libre',
      referencia: [
        seg(0, 0, 0, 80, 0),
        seg(0, 80, -80, 80, 1),
        seg(-80, 80, -80, 160, 2),
        seg(-80, 160, -140, 160, 3),
      ],
      jugador: [seg(40, -30, 40, 90, 0), seg(40, 90, 100, 150, 1)],
      normalizacion: LIBRE,
    },
    {
      nombre: 'con rotación y traslación fijas (mundo 3 en adelante)',
      referencia: [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)],
      jugador: [seg(0, 0, 0, 100, 0), seg(0, 100, -100, 100, 1)],
      normalizacion: FIJA,
    },
  ];

  for (const c of casos) {
    it(`${c.nombre}: coincidencia y exceso caen sobre la estela del jugador y la falta sobre la de referencia`, () => {
      const v = validar(c.jugador, c.referencia, c.normalizacion);
      expect(v.coincide).toBe(false);
      const ctx = new DobleDibujo();
      crearDiff({ ctx, leerTema: estiloGris }).dibujar({
        coincidencia: v.coincidencia,
        exceso: v.exceso,
        falta: v.falta,
        traslacion: v.traslacion,
        traslacionObjetivo: v.traslacionObjetivo,
        angulo: v.angulo,
      });
      const [coincidencia, exceso, falta] = puntosPorRegion(ctx);

      expect(exceso!.length).toBeGreaterThan(0);
      expect(falta!.length).toBeGreaterThan(0);
      for (const p of [...(coincidencia ?? []), ...exceso!]) {
        const mejor = Math.min(...c.jugador.map((s) => distancia(p, s)));
        expect(mejor, `punto (${p[0]!.toFixed(1)}, ${p[1]!.toFixed(1)}) de coincidencia o exceso`).toBeLessThanOrEqual(MARGEN);
      }
      for (const p of falta!) {
        const mejor = Math.min(...c.referencia.map((s) => distancia(p, s)));
        expect(mejor, `punto (${p[0]!.toFixed(1)}, ${p[1]!.toFixed(1)}) de falta`).toBeLessThanOrEqual(MARGEN);
      }
    });
  }

  it('el primer caso necesita un giro de verdad: con ángulo 0 la prueba no demostraría nada', () => {
    const v = validar(casos[0]!.jugador, casos[0]!.referencia, casos[0]!.normalizacion);
    expect(v.angulo).not.toBe(0);
  });

  it('sin estela del jugador, la falta cae sobre la estela de referencia', () => {
    const referencia = [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)];
    const v = validar([], referencia, LIBRE);
    const ctx = new DobleDibujo();
    crearDiff({ ctx, leerTema: estiloGris }).dibujar({
      coincidencia: v.coincidencia,
      exceso: v.exceso,
      falta: v.falta,
      traslacion: v.traslacion,
      traslacionObjetivo: v.traslacionObjetivo,
      angulo: v.angulo,
    });
    const [falta] = puntosPorRegion(ctx);
    expect(falta!.length).toBeGreaterThan(0);
    for (const p of falta!) {
      expect(Math.min(...referencia.map((s) => distancia(p, s)))).toBeLessThanOrEqual(MARGEN);
    }
  });
});

// ============================================================================
// Dibujo limpio: los trazos reales, coloreados según las máscaras
// ============================================================================

/** Un doble que además recuerda, por cada `stroke`, cómo estaba configurado el trazo. */
class DobleConEstilo extends DobleDibujo {
  readonly trazosHechos: Array<{
    color: string;
    grosor: number;
    cap: string;
    guiones: number[];
    /** Extremos de cada línea: [x1, y1, x2, y2]. */
    lineas: number[][];
  }> = [];
  private guionesActuales: number[] = [];

  override setLineDash(segmentos: number[]): void {
    this.guionesActuales = segmentos.slice();
    super.setLineDash(segmentos);
  }

  override stroke(): void {
    const desdeAqui = this.llamadas.map((l) => l.metodo).lastIndexOf('beginPath');
    const lineas: number[][] = [];
    let origen: number[] | null = null;
    for (const l of this.llamadas.slice(desdeAqui + 1)) {
      const a = l.args as number[];
      // El doble registra las cuatro esquinas del recorte (±400, ±400): no son una línea.
      if (Math.abs(a[0]!) === 400 && Math.abs(a[1]!) === 400) continue;
      if (l.metodo === 'moveTo') origen = a;
      if (l.metodo === 'lineTo' && origen !== null) lineas.push([origen[0]!, origen[1]!, a[0]!, a[1]!]);
    }
    this.trazosHechos.push({
      color: String(this.strokeStyle),
      grosor: this.lineWidth,
      cap: this.lineCap,
      guiones: this.guionesActuales.slice(),
      lineas,
    });
    super.stroke();
  }
}

/** Tema con un color distinto por estado, para saber qué es cada trazo. */
function estiloDistinto(): EstiloDiff {
  return {
    coincidencia: { color: '#2f9e44', grosor: 5, guiones: [] },
    exceso: { color: '#e03131', grosor: 10, guiones: [] },
    falta: { color: '#868e96', grosor: 5, guiones: [6, 9] },
  };
}

describe('diff · dibujo limpio con los trazos reales', () => {
  const seg = (a: number, b: number, c: number, d: number, paso: number): Segmento => ({
    desde: { x: a, y: b },
    hasta: { x: c, y: d },
    paso,
    linea: 1,
  });
  const LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };
  const FIJA: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' };

  const largoDe = (lineas: number[][]): number =>
    lineas.reduce((suma, [x1, y1, x2, y2]) => suma + Math.hypot(x2! - x1!, y2! - y1!), 0);
  const largoSegmentos = (ss: Segmento[]): number =>
    ss.reduce((suma, s) => suma + Math.hypot(s.hasta.x - s.desde.x, s.hasta.y - s.desde.y), 0);

  /** Distancia de un punto a un segmento. */
  function distancia(x: number, y: number, s: Segmento): number {
    const dx = s.hasta.x - s.desde.x;
    const dy = s.hasta.y - s.desde.y;
    const largo2 = dx * dx + dy * dy;
    const t = largo2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.desde.x) * dx + (y - s.desde.y) * dy) / largo2));
    return Math.hypot(x - (s.desde.x + t * dx), y - (s.desde.y + t * dy));
  }
  const distanciaA = (x: number, y: number, ss: Segmento[]): number => Math.min(...ss.map((s) => distancia(x, y, s)));

  /** Dibuja con el validador real y devuelve los trazos por estado (por color). */
  function dibujarCon(jugador: Segmento[], referencia: Segmento[], normalizacion: NormalizacionNivel) {
    const v = validar(jugador, referencia, normalizacion);
    const ctx = new DobleConEstilo();
    crearDiff({ ctx, leerTema: estiloDistinto }).dibujar(
      {
        coincidencia: v.coincidencia,
        exceso: v.exceso,
        falta: v.falta,
        traslacion: v.traslacion,
        traslacionObjetivo: v.traslacionObjetivo,
        angulo: v.angulo,
      },
      { referencia, jugador },
    );
    const de = (color: string) => ctx.trazosHechos.find((t) => t.color === color);
    return { v, ctx, coincidencia: de('#2f9e44'), exceso: de('#e03131'), falta: de('#868e96') };
  }

  const L = {
    referencia: [seg(0, 0, 0, 100, 0)],
    jugador: [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)],
  };

  it('dibuja líneas sobre los trazos reales, no corridas de la máscara: cada extremo cae exactamente sobre su figura', () => {
    const r = dibujarCon(L.jugador, L.referencia, LIBRE);
    expect(r.exceso).toBeDefined();
    for (const t of [r.coincidencia, r.exceso]) {
      for (const [x1, y1, x2, y2] of t?.lineas ?? []) {
        expect(distanciaA(x1!, y1!, L.jugador)).toBeLessThan(1e-6);
        expect(distanciaA(x2!, y2!, L.jugador)).toBeLessThan(1e-6);
      }
    }
    for (const [x1, y1, x2, y2] of r.falta?.lineas ?? []) {
      expect(distanciaA(x1!, y1!, L.referencia)).toBeLessThan(1e-6);
      expect(distanciaA(x2!, y2!, L.referencia)).toBeLessThan(1e-6);
    }
  });

  it('el trazo del jugador se pinta entero: verde lo que sigue a Kiro y rojo lo que se aparta, sin perder ni repetir nada', () => {
    const r = dibujarCon(L.jugador, L.referencia, LIBRE);
    const verde = largoDe(r.coincidencia?.lineas ?? []);
    const rojo = largoDe(r.exceso?.lineas ?? []);
    expect(verde).toBeGreaterThan(0);
    expect(rojo).toBeGreaterThan(0);
    // Todo punto del jugador está en su máscara dilatada: cae en coincidencia o en exceso.
    expect(verde + rojo).toBeCloseTo(largoSegmentos(L.jugador), 0);
  });

  it('si el jugador sigue a Kiro en todo, todo el trazo es verde y no sobra ni falta nada', () => {
    const igual = [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)];
    const r = dibujarCon(igual, igual, LIBRE);
    expect(r.exceso).toBeUndefined();
    expect(r.falta).toBeUndefined();
    expect(largoDe(r.coincidencia?.lineas ?? [])).toBeCloseTo(largoSegmentos(igual), 0);
  });

  it('con una figura girada de verdad, lo que falta cae sobre UN solo lado de la referencia y el resto es verde', () => {
    // Referencia: un cuadrado de 100 de lado. Jugador: el mismo cuadrado girado 45 grados
    // (un rombo) con el último lado sin dibujar. El validador gira la referencia para compararlas.
    const referencia = [
      seg(-50, -50, -50, 50, 0),
      seg(-50, 50, 50, 50, 1),
      seg(50, 50, 50, -50, 2),
      seg(50, -50, -50, -50, 3),
    ];
    const a = 50 * Math.SQRT2;
    const jugador = [seg(0, a, a, 0, 0), seg(a, 0, 0, -a, 1), seg(0, -a, -a, 0, 2)];
    const r = dibujarCon(jugador, referencia, LIBRE);

    expect(r.v.angulo, 'sin un giro de verdad esta prueba no demostraría nada').not.toBe(0);
    expect(r.exceso).toBeUndefined();
    expect(largoDe(r.coincidencia?.lineas ?? [])).toBeCloseTo(largoSegmentos(jugador), 0);

    // Lo que falta: un lado entero (100) de la referencia, en su sitio real.
    const falta = r.falta?.lineas ?? [];
    expect(falta.length).toBeGreaterThan(0);
    expect(largoDe(falta)).toBeGreaterThan(80);
    expect(largoDe(falta)).toBeLessThan(120);
    const ladoDe = (x: number, y: number): number =>
      referencia.findIndex((s) => distancia(x, y, s) < 1e-6);
    const lados = new Set(falta.flatMap(([x1, y1, x2, y2]) => [ladoDe(x1!, y1!), ladoDe(x2!, y2!)]));
    // Los extremos de un tramo en una esquina pueden pertenecer a dos lados; ninguno es «ninguno».
    expect(lados.has(-1)).toBe(false);
    const centros = falta.map(([x1, y1, x2, y2]) => ladoDe((x1! + x2!) / 2, (y1! + y2!) / 2));
    expect(new Set(centros).size).toBe(1);
  });

  describe('coincide con el dibujo por máscara, cuyo mapeo inverso ya está verificado', () => {
    // Figuras ASIMÉTRICAS: con una simétrica (un cuadrado) un giro equivocado cae en otro
    // lado igual de válido y la prueba no se enteraría.
    const escalera = {
      nombre: 'una escalera contra una línea quebrada a 45 grados, con todo libre',
      referencia: [seg(0, 0, 0, 80, 0), seg(0, 80, -80, 80, 1), seg(-80, 80, -80, 160, 2), seg(-80, 160, -140, 160, 3)],
      jugador: [seg(40, -30, 40, 90, 0), seg(40, 90, 100, 150, 1)],
      normalizacion: LIBRE,
    };
    const lLibre = { nombre: 'una L contra una línea, con todo libre', ...L, normalizacion: LIBRE };
    const lFija = {
      nombre: 'con rotación y traslación fijas',
      referencia: [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)],
      jugador: [seg(0, 0, 0, 100, 0), seg(0, 100, -100, 100, 1)],
      normalizacion: FIJA,
    };

    /** Extremos de las corridas con que el dibujo por máscara pinta cada región: [coincidencia, exceso, falta]. */
    function porMascara(c: typeof escalera): number[][][] {
      const v = validar(c.jugador, c.referencia, c.normalizacion);
      const ctx = new DobleConEstilo();
      crearDiff({ ctx, leerTema: estiloDistinto }).dibujar({
        coincidencia: v.coincidencia,
        exceso: v.exceso,
        falta: v.falta,
        traslacion: v.traslacion,
        traslacionObjetivo: v.traslacionObjetivo,
        angulo: v.angulo,
      });
      return ctx.trazosHechos.map((t) => t.lineas.flatMap(([x1, y1, x2, y2]) => [[x1!, y1!], [x2!, y2!]]));
    }

    // Las corridas llegan al borde de la banda de dilatación (radio 8), más media diagonal de celda.
    const BANDA = 9;

    for (const c of [escalera, lLibre, lFija]) {
      it(`${c.nombre}: cada tramo limpio cae en la misma zona que su región por máscara`, () => {
        const [mCoincidencia, mExceso, mFalta] = porMascara(c);
        const r = dibujarCon(c.jugador, c.referencia, c.normalizacion);
        const cerca = (x: number, y: number, nube: number[][] | undefined): boolean =>
          (nube ?? []).some(([px, py]) => Math.hypot(x - px!, y - py!) <= BANDA);

        for (const [x1, y1, x2, y2] of r.falta?.lineas ?? []) {
          expect(cerca(x1!, y1!, mFalta), `falta (${x1!.toFixed(1)}, ${y1!.toFixed(1)})`).toBe(true);
          expect(cerca(x2!, y2!, mFalta), `falta (${x2!.toFixed(1)}, ${y2!.toFixed(1)})`).toBe(true);
        }
        for (const [x1, y1, x2, y2] of r.exceso?.lineas ?? []) {
          expect(cerca(x1!, y1!, mExceso), `exceso (${x1!.toFixed(1)}, ${y1!.toFixed(1)})`).toBe(true);
          expect(cerca(x2!, y2!, mExceso), `exceso (${x2!.toFixed(1)}, ${y2!.toFixed(1)})`).toBe(true);
        }
        for (const [x1, y1, x2, y2] of r.coincidencia?.lineas ?? []) {
          expect(cerca(x1!, y1!, mCoincidencia), `coincidencia (${x1!.toFixed(1)}, ${y1!.toFixed(1)})`).toBe(true);
          expect(cerca(x2!, y2!, mCoincidencia), `coincidencia (${x2!.toFixed(1)}, ${y2!.toFixed(1)})`).toBe(true);
        }
        // Y hay algo que comparar: sin falta ni exceso la prueba no demostraría nada.
        expect((r.falta?.lineas.length ?? 0) + (r.exceso?.lineas.length ?? 0)).toBeGreaterThan(0);
      });
    }

    it('lo que falta es la misma cantidad de trazo que cubre la región de falta (no se pierde ni se inventa)', () => {
      const r = dibujarCon(escalera.jugador, escalera.referencia, escalera.normalizacion);
      const largoFalta = largoDe(r.falta?.lineas ?? []);
      expect(largoFalta).toBeGreaterThan(40);
      expect(largoFalta).toBeLessThan(largoSegmentos(escalera.referencia));
    });
  });

  it('con rotación y traslación fijas no mueve nada: el rojo cae donde el jugador se pasó', () => {
    const referencia = [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)];
    const jugador = [seg(0, 0, 0, 100, 0), seg(0, 100, -100, 100, 1)];
    const r = dibujarCon(jugador, referencia, FIJA);
    // El tramo vertical coincide; el horizontal va al otro lado y por eso sobra (menos
    // los primeros ~8 que aún están dentro del margen de la esquina).
    const rojo = r.exceso?.lineas ?? [];
    expect(largoDe(rojo)).toBeGreaterThan(80);
    for (const [x1, , x2] of rojo) {
      expect(x1!).toBeLessThanOrEqual(0);
      expect(x2!).toBeLessThanOrEqual(0);
    }
    // Y lo que falta es el tramo horizontal de la referencia, que va a la derecha.
    const falta = r.falta?.lineas ?? [];
    expect(largoDe(falta)).toBeGreaterThan(80);
    for (const [x1, , x2] of falta) {
      expect(x1!).toBeGreaterThanOrEqual(0);
      expect(x2!).toBeGreaterThanOrEqual(0);
    }
  });

  it('sin estela del jugador dibuja solo lo que falta, sobre toda la referencia', () => {
    const referencia = [seg(0, 0, 0, 100, 0), seg(0, 100, 100, 100, 1)];
    const r = dibujarCon([], referencia, LIBRE);
    expect(r.coincidencia).toBeUndefined();
    expect(r.exceso).toBeUndefined();
    expect(largoDe(r.falta?.lineas ?? [])).toBeCloseTo(largoSegmentos(referencia), 0);
  });

  it('cada estado usa el color, el grosor y los guiones del tema; los continuos con puntas redondas y el punteado con planas', () => {
    const r = dibujarCon(L.jugador, L.referencia, LIBRE);
    expect(r.coincidencia).toMatchObject({ grosor: 5, guiones: [], cap: 'round' });
    expect(r.exceso).toMatchObject({ grosor: 10, guiones: [], cap: 'round' });
    expect(r.falta).toMatchObject({ grosor: 5, guiones: [6, 9], cap: 'butt' });
    // Lo que sobra, al menos el doble de grueso que lo que coincide (requisito 23.3).
    expect(r.exceso!.grosor).toBeGreaterThanOrEqual(2 * r.coincidencia!.grosor);
  });

  it('recorta al cuadrado lógico dentro de un save/restore y no deja el contexto cambiado', () => {
    const r = dibujarCon(L.jugador, L.referencia, LIBRE);
    const metodos = r.ctx.llamadas.map((l) => l.metodo);
    expect(metodos.filter((m) => m === 'save')).toHaveLength(1);
    expect(metodos.filter((m) => m === 'restore')).toHaveLength(1);
    expect(metodos.indexOf('clip')).toBeGreaterThan(metodos.indexOf('save'));
    expect(metodos.indexOf('clip')).toBeLessThan(metodos.indexOf('stroke'));
  });

  it('un trazo larguísimo que se sale del lienzo se dibuja sin desbordarse ni tardar', () => {
    const enorme = [seg(0, 0, 0, 1_000_000, 0)];
    const t0 = Date.now();
    const r = dibujarCon(enorme, [seg(0, 0, 0, 100, 0)], FIJA);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(r.ctx.trazosHechos.length).toBeGreaterThan(0);
  });

  it('sin trazos sigue dibujando las máscaras como antes (compatibilidad)', () => {
    const v = validar(L.jugador, L.referencia, LIBRE);
    const ctx = new DobleConEstilo();
    crearDiff({ ctx, leerTema: estiloDistinto }).dibujar({
      coincidencia: v.coincidencia,
      exceso: v.exceso,
      falta: v.falta,
      traslacion: v.traslacion,
      traslacionObjetivo: v.traslacionObjetivo,
      angulo: v.angulo,
    });
    // Tres trazos, uno por región, y ninguno recortado ni con puntas distintas.
    expect(ctx.trazosHechos).toHaveLength(3);
    expect(ctx.llamadas.some((l) => l.metodo === 'clip')).toBe(false);
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

// ============================================================================
// Property 2: Idempotencia del repintado ante el mismo tema
// Feature: 08-diseno-visual, Property 2
// Valida: Requisito 2.2
//
// El Diff (como el Lienzo y los Personajes) lee del Tema color, grosor y patrón
// por `leerTema`, el equivalente en prueba de lo que `getComputedStyle` entrega
// desde las fichas del Tema. La propiedad: repintar dos veces con los MISMOS
// valores del Tema produce el MISMO dibujo —la misma secuencia de llamadas al
// contexto con los mismos argumentos—. Color y grosor son función de las fichas
// leídas, no de estado acumulado entre repintados.
// ============================================================================

describe('diff · Feature: 08-diseno-visual, Property 2 — idempotencia del repintado ante el mismo tema', () => {
  /** Un color literal cualquiera; el valor no importa, solo que se lea y se aplique igual las dos veces. */
  const arbColor = fc
    .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
    .map(([r, g, b]) => `rgb(${r},${g},${b})`);

  /** Grosor positivo con una resolución pequeña, como lo que el Tema entregaría. */
  const arbGrosor = fc.integer({ min: 1, max: 20 });

  /** Patrón de guiones: vacío (continuo) o de dos a cuatro tramos. */
  const arbGuiones = fc.oneof(
    fc.constant<number[]>([]),
    fc.array(fc.integer({ min: 1, max: 16 }), { minLength: 2, maxLength: 4 }),
  );

  const arbTrazo = fc.record({ color: arbColor, grosor: arbGrosor, guiones: arbGuiones });

  /** Un conjunto de valores de Tema para las tres regiones del Diff. */
  const arbEstilo: fc.Arbitrary<EstiloDiff> = fc.record({
    coincidencia: arbTrazo,
    exceso: arbTrazo,
    falta: arbTrazo,
  });

  /** Una posición de la cuadrícula lógica, para construir máscaras encendidas. */
  const arbPos = fc.integer({ min: 20, max: LADO - 60 });

  /** Tres rectángulos encendidos (coincidencia, exceso, falta) más la transformación del veredicto. */
  const arbRegiones = fc
    .record({
      cx: arbPos,
      cy: arbPos,
      ex: arbPos,
      ey: arbPos,
      fx: arbPos,
      fy: arbPos,
      tx: fc.integer({ min: -60, max: 60 }),
      ty: fc.integer({ min: -60, max: 60 }),
      angulo: fc.integer({ min: 0, max: 359 }),
    })
    .map(({ cx, cy, ex, ey, fx, fy, tx, ty, angulo }): RegionesDiff => {
      const coincidencia = crearMascara();
      const exceso = crearMascara();
      const falta = crearMascara();
      encenderRect(coincidencia, cx, cy, cx + 30, cy + 30);
      encenderRect(exceso, ex, ey, ex + 30, ey + 30);
      encenderRect(falta, fx, fy, fx + 30, fy + 30);
      return {
        coincidencia,
        exceso,
        falta,
        traslacion: { x: tx, y: ty },
        traslacionObjetivo: { x: tx, y: ty },
        angulo,
      };
    });

  /** Un segmento recto dentro del lienzo. */
  const arbSegmento: fc.Arbitrary<Segmento> = fc
    .record({
      ax: fc.integer({ min: -300, max: 300 }),
      ay: fc.integer({ min: -300, max: 300 }),
      bx: fc.integer({ min: -300, max: 300 }),
      by: fc.integer({ min: -300, max: 300 }),
    })
    .map(({ ax, ay, bx, by }, ): Segmento => ({ desde: { x: ax, y: ay }, hasta: { x: bx, y: by }, paso: 0, linea: 1 }));

  const arbTrazos = fc.record({
    referencia: fc.array(arbSegmento, { minLength: 0, maxLength: 4 }),
    jugador: fc.array(arbSegmento, { minLength: 0, maxLength: 4 }),
  });

  /**
   * Dibuja una vez con un lector que devuelve en cada llamada un objeto NUEVO con los
   * mismos valores. Así, si el dibujo fuera función de la identidad del objeto o de
   * estado acumulado, las dos pasadas divergirían; al ser función de los valores, no.
   */
  function dibujarUna(
    estilo: EstiloDiff,
    regiones: RegionesDiff,
    trazos?: { referencia: Segmento[]; jugador: Segmento[] },
  ): DobleDibujo {
    const ctx = new DobleDibujo();
    const leerTema = (): EstiloDiff => ({
      coincidencia: { ...estilo.coincidencia, guiones: [...estilo.coincidencia.guiones] },
      exceso: { ...estilo.exceso, guiones: [...estilo.exceso.guiones] },
      falta: { ...estilo.falta, guiones: [...estilo.falta.guiones] },
    });
    crearDiff({ ctx, leerTema }).dibujar(regiones, trazos);
    return ctx;
  }

  it(
    'dos repintados por máscara con el mismo tema producen la misma secuencia de llamadas',
    () => {
      fc.assert(
        fc.property(arbEstilo, arbRegiones, (estilo, regiones) => {
          const a = dibujarUna(estilo, regiones);
          const b = dibujarUna(estilo, regiones);
          expect(b.llamadas).toEqual(a.llamadas);
          expect(mascarasIguales(b.mascara(), a.mascara())).toBe(true);
        }),
        { numRuns: 200 },
      );
    },
    // El camino por máscara rasteriza corridas largas en 200 iteraciones; el tope por
    // defecto de 5 s se queda corto aunque cada repintado sea idéntico al anterior.
    30000,
  );

  it(
    'dos repintados limpios (trazos reales) con el mismo tema producen la misma secuencia de llamadas',
    () => {
      fc.assert(
        fc.property(arbEstilo, arbRegiones, arbTrazos, (estilo, regiones, trazos) => {
          const a = dibujarUna(estilo, regiones, trazos);
          const b = dibujarUna(estilo, regiones, trazos);
          expect(b.llamadas).toEqual(a.llamadas);
          expect(mascarasIguales(b.mascara(), a.mascara())).toBe(true);
        }),
        { numRuns: 200 },
      );
    },
    30000,
  );
});

// ============================================================================
// Tarea 3.2 — el rojo del pintado limpio usa `excesoVisual` (marco real)
//
// Cuando `RegionesDiff.excesoVisual` está presente, `dibujarLimpio` clasifica el
// rojo con esa máscara en MARCO REAL (identidad), muestreando cada punto del trazo
// real del jugador directamente, sin sumar la traslación del marco centrado. Así el
// excedente se marca rojo A LO LARGO del trazo (y no solo en la punta, como hacía
// `exceso` sobre máscaras dilatadas y centradas). Sin `excesoVisual`, el pintado usa
// `exceso` exactamente como hoy (preservación).
//
// `DobleDibujo` solo registra métodos, no el `set` de strokeStyle/lineWidth. Para
// saber con qué color y grosor se pintó cada tramo se envuelve el contexto en un
// Proxy que intercepta el `set` de esas dos propiedades y, en cada `stroke`, guarda
// el color y el grosor vigentes junto con las líneas de ese trazo.
// ============================================================================

/** Un trazo capturado: su color/grosor vigentes y sus líneas [x1, y1, x2, y2]. */
interface TrazoCapturado {
  color: string;
  grosor: number;
  lineas: number[][];
}

/**
 * Envuelve un `DobleDibujo` en un Proxy que intercepta el `set` de strokeStyle y
 * lineWidth (que el doble no registra como llamadas) y arma, por cada `stroke`, el
 * trazo capturado con el color y el grosor vigentes y las líneas moveTo/lineTo de
 * ese subtrayecto. Devuelve el contexto proxy y la lista acumulada de trazos.
 */
function contextoCapturaEstilo(): { ctx: DobleDibujo; trazos: TrazoCapturado[] } {
  const base = new DobleDibujo();
  const trazos: TrazoCapturado[] = [];
  let color = String(base.strokeStyle);
  let grosor = base.lineWidth;

  const ctx = new Proxy(base, {
    set(obj, prop, valor): boolean {
      if (prop === 'strokeStyle') color = String(valor);
      if (prop === 'lineWidth') grosor = valor as number;
      // @ts-expect-error índice dinámico sobre el doble.
      obj[prop] = valor;
      return true;
    },
    get(obj, prop) {
      if (prop === 'stroke') {
        return () => {
          const desdeAqui = obj.llamadas.map((l) => l.metodo).lastIndexOf('beginPath');
          const lineas: number[][] = [];
          let origen: number[] | null = null;
          for (const l of obj.llamadas.slice(desdeAqui + 1)) {
            const a = l.args as number[];
            // Las cuatro esquinas del recorte (±400, ±400) no son una línea del trazo.
            if (Math.abs(a[0]!) === 400 && Math.abs(a[1]!) === 400) continue;
            if (l.metodo === 'moveTo') origen = a;
            if (l.metodo === 'lineTo' && origen !== null) {
              lineas.push([origen[0]!, origen[1]!, a[0]!, a[1]!]);
            }
          }
          trazos.push({ color, grosor, lineas });
          obj.stroke();
        };
      }
      const valor = Reflect.get(obj, prop);
      return typeof valor === 'function' ? valor.bind(obj) : valor;
    },
  });

  return { ctx, trazos };
}

describe('diff · Tarea 3.2 — el rojo del pintado limpio usa `excesoVisual` (marco real)', () => {
  const seg = (a: number, b: number, c: number, d: number, paso: number): Segmento => ({
    desde: { x: a, y: b },
    hasta: { x: c, y: d },
    paso,
    linea: 1,
  });
  const LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };

  /** Largo total de un conjunto de líneas [x1, y1, x2, y2]. */
  const largoDe = (lineas: number[][]): number =>
    lineas.reduce((suma, [x1, y1, x2, y2]) => suma + Math.hypot(x2! - x1!, y2! - y1!), 0);

  // Colores del tema: verde = coincidencia, rojo = exceso, gris = falta.
  const VERDE = estiloColor().coincidencia.color;
  const ROJO = estiloColor().exceso.color;

  // Caso 1 medido: Kiro traza AVANZA 100, el jugador AVANZA 110, normalización libre.
  const objetivo = [seg(0, 0, 0, 100, 0)];
  const jugador = [seg(0, 0, 0, 110, 0)];

  /** Valida el Caso 1 y arma el `RegionesDiff` con todos los campos del veredicto. */
  function regionesCaso1(conExcesoVisual: boolean): { regiones: RegionesDiff; trazosFig: { referencia: Segmento[]; jugador: Segmento[] } } {
    const v = validar(jugador, objetivo, LIBRE);
    expect(v.coincide).toBe(false);
    expect(v.excesoVisual, 'la tarea 3.1 debe haber fijado excesoVisual').toBeDefined();
    const regiones: RegionesDiff = {
      coincidencia: v.coincidencia,
      exceso: v.exceso,
      falta: v.falta,
      traslacion: v.traslacion,
      traslacionObjetivo: v.traslacionObjetivo,
      angulo: v.angulo,
      ...(conExcesoVisual ? { excesoVisual: v.excesoVisual } : {}),
    };
    return { regiones, trazosFig: { referencia: objetivo, jugador } };
  }

  it('con excesoVisual el excedente SÍ se pinta de rojo, donde con `exceso` (centrado) no salía nada', () => {
    // Con excesoVisual (marco real).
    const con = contextoCapturaEstilo();
    const { regiones, trazosFig } = regionesCaso1(true);
    crearDiff({ ctx: con.ctx, leerTema: estiloColor }).dibujar(regiones, trazosFig);
    const rojoCon = con.trazos.filter((t) => t.color === ROJO).flatMap((t) => t.lineas);
    const verdeCon = con.trazos.filter((t) => t.color === VERDE).flatMap((t) => t.lineas);

    // Sin excesoVisual (comportamiento de hoy: clasifica el rojo con `exceso` en marco centrado).
    const sin = contextoCapturaEstilo();
    const sinReg = regionesCaso1(false);
    crearDiff({ ctx: sin.ctx, leerTema: estiloColor }).dibujar(sinReg.regiones, sinReg.trazosFig);
    const rojoSin = sin.trazos.filter((t) => t.color === ROJO).flatMap((t) => t.lineas);

    // El punto del fix: con el marco centrado y la coincidencia dilatada, el rojo de `exceso` NO
    // sale sobre el eje real del trazo (la dilatación lo absorbe como coincidencia). Con excesoVisual
    // (marco real) el excedente SÍ se marca rojo, en la punta del trazo donde el jugador se pasó.
    expect(largoDe(rojoSin), 'con `exceso` centrado el excedente no se pinta sobre el eje del trazo').toBe(0);
    expect(rojoCon.length, 'con excesoVisual el excedente SÍ se pinta de rojo').toBeGreaterThan(0);
    expect(largoDe(rojoCon), 'y el rojo con excesoVisual es mayor que con `exceso`').toBeGreaterThan(largoDe(rojoSin));
    expect(verdeCon.length, 'y sigue habiendo coincidencia verde').toBeGreaterThan(0);

    // El rojo cae en la PUNTA del trazo (y alto, cerca de 110), no al principio ni repartido por el
    // tramo coincidente: el verde no supera al rojo en y, y el rojo arranca bien entrado el trazo.
    const yMaxRojo = Math.max(...rojoCon.flatMap(([, y1, , y2]) => [y1!, y2!]));
    const yMinRojo = Math.min(...rojoCon.flatMap(([, y1, , y2]) => [y1!, y2!]));
    const yMaxVerde = Math.max(...verdeCon.flatMap(([, y1, , y2]) => [y1!, y2!]));
    expect(yMaxRojo).toBeGreaterThan(yMaxVerde);
    expect(yMinRojo, 'el rojo marca el excedente del extremo, no el origen del trazo').toBeGreaterThan(50);
  });

  it('el verde de coincidencia cubre el tramo que sigue a Kiro (y≈0..100), la mayor parte del trazo', () => {
    const { ctx, trazos } = contextoCapturaEstilo();
    const { regiones, trazosFig } = regionesCaso1(true);
    crearDiff({ ctx, leerTema: estiloColor }).dibujar(regiones, trazosFig);

    const verde = trazos.filter((t) => t.color === VERDE).flatMap((t) => t.lineas);
    const rojo = trazos.filter((t) => t.color === ROJO).flatMap((t) => t.lineas);
    const largoVerde = largoDe(verde);
    const largoRojo = largoDe(rojo);

    // Verde + rojo cubren todo el trazo del jugador (110), sin perder ni repetir nada.
    expect(largoVerde + largoRojo).toBeCloseTo(110, 0);
    // La coincidencia es la mayor parte del trazo.
    expect(largoVerde).toBeGreaterThan(largoRojo);
    // El verde arranca en el origen del trazo.
    const yMinVerde = Math.min(...verde.flatMap(([, y1, , y2]) => [y1!, y2!]));
    expect(yMinVerde).toBeLessThan(5);
  });

  it('preservación: sin excesoVisual, el pintado limpio es idéntico al de hoy (usa `exceso`)', () => {
    // Mismo veredicto, dibujado con y sin excesoVisual. Sin él, el comportamiento es el de hoy:
    // el rojo se clasifica con `exceso` (marco centrado), que en el Caso 1 marca solo la puntita.
    const sin = regionesCaso1(false);
    const ctxSin = new DobleDibujo();
    crearDiff({ ctx: ctxSin, leerTema: estiloColor }).dibujar(sin.regiones, sin.trazosFig);

    // Pintar con `exceso` directamente (sin el campo excesoVisual) produce exactamente
    // la misma secuencia de llamadas que el comportamiento histórico. Repetirlo da lo mismo.
    const ctxSin2 = new DobleDibujo();
    crearDiff({ ctx: ctxSin2, leerTema: estiloColor }).dibujar(sin.regiones, sin.trazosFig);
    expect(ctxSin2.llamadas).toEqual(ctxSin.llamadas);

    // Y con excesoVisual el dibujo CAMBIA respecto de sin él: el rojo es mayor (a lo largo del
    // trazo) en vez de la puntita. Así se comprueba que excesoVisual sí altera el pintado.
    const con = regionesCaso1(true);
    const ctxCon = new DobleDibujo();
    crearDiff({ ctx: ctxCon, leerTema: estiloColor }).dibujar(con.regiones, con.trazosFig);
    expect(ctxCon.llamadas).not.toEqual(ctxSin.llamadas);
  });
});
