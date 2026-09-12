// Pruebas de los personajes: la tortuga, Kiro y el lápiz.
//
// Corre en Node con el doble de dibujo de `doble-dibujo.test.ts`. Los ejemplos de
// la sección 7.4.3 y la Property 14A (parte personajes) se miden sobre la secuencia
// registrada de llamadas y su rasterizado; la verificación con un Canvas real del
// navegador sigue siendo manual.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import { DobleDibujo, iou, mascarasIguales } from './doble-dibujo.test.js';
import {
  dibujarPersonajes,
  GROSOR_TRAZO,
  INCLINACION_MAXIMA,
  type EstadoPersonajes,
  type EstiloPersonajes,
  type IdentidadTortuga,
} from './personajes.js';
import { ESTADO_INICIAL, type EstadoTortuga } from './tortuga.js';

// ============================================================================
// Ayudas
// ============================================================================

/** Estilo de personajes con valores concretos (los resuelve el lector del tema). */
function estiloPersonajes(): EstiloPersonajes {
  return {
    contorno: '#212529',
    relleno: '#ffffff',
    cabeza: '#343a40',
    kiroContorno: '#0d6efd',
    kiroRelleno: 'rgba(13,110,253,0.1)',
    lapizContorno: '#dc3545',
    marcaRumbo: '#ff6b6b',
    grosor: GROSOR_TRAZO,
  };
}

/** Estado de personajes con la tortuga en el centro y los predeterminados. */
function estadoBase(sobre: Partial<EstadoTortuga> = {}): EstadoPersonajes {
  return {
    tortuga: { ...ESTADO_INICIAL, ...sobre },
    kiroMontado: true,
    inclinacionKiro: 0,
    identidad: 'jugador',
    celebracion: false,
  };
}

// ============================================================================
// Las nueve piezas trazadas (Req 13.1, 13.2)
// ============================================================================

describe('personajes · piezas trazadas', () => {
  it('dibuja con la tortuga visible y registra trazos y rellenos', () => {
    const ctx = new DobleDibujo();
    const r = dibujarPersonajes(ctx, estadoBase(), estiloPersonajes);
    expect(r.valido).toBe(true);
    const metodos = ctx.llamadas.map((l) => l.metodo);
    expect(metodos.filter((m) => m === 'stroke').length).toBeGreaterThan(0);
    expect(metodos.filter((m) => m === 'fill').length).toBeGreaterThan(0);
    expect(metodos.filter((m) => m === 'beginPath').length).toBeGreaterThanOrEqual(9);
  });

  it('el conjunto tiene las nueve piezas: al menos nueve beginPath separados', () => {
    const ctx = new DobleDibujo();
    dibujarPersonajes(ctx, estadoBase(), estiloPersonajes);
    // Cada grupo de piezas abre su propio trayecto: patas traseras, cola, patas
    // delanteras, caparazón, muesca, marca, cuello+cabeza, ojos, Kiro (domo,
    // estela, ojos) y lápiz.
    const begins = ctx.llamadas.filter((l) => l.metodo === 'beginPath').length;
    expect(begins).toBeGreaterThanOrEqual(10);
  });

  it('el módulo personajes.ts no contiene literales de color ni de grosor de dibujo', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const ruta = fileURLToPath(new URL('./personajes.ts', import.meta.url));
    const fuente = readFileSync(ruta, 'utf8');
    const codigo = fuente
      .split('\n')
      .filter((linea) => !linea.trimStart().startsWith('//') && !linea.trimStart().startsWith('*'))
      .join('\n');
    expect(codigo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(codigo).not.toMatch(/\brgba?\(/);
  });
});

// ============================================================================
// El lápiz: punta abajo ≤ 1 unidad, arriba ≥ 8 unidades (Req 13.5)
// ============================================================================

describe('personajes · lápiz', () => {
  /**
   * Recupera la posición dibujada de la punta del lápiz. El lápiz es la última
   * cápsula trazada; la punta está a distancia mínima de la posición de la tortuga.
   * Con la tortuga en el origen y rumbo 0, la distancia de la punta al origen es
   * la que fija el diseño: 0 abajo, 8.6 arriba.
   */
  function distanciaPuntaAlOrigen(lapizAbajo: boolean): number {
    const ctx = new DobleDibujo();
    dibujarPersonajes(ctx, estadoBase({ lapizAbajo }), estiloPersonajes);
    // Recorremos todas las llamadas moveTo/lineTo y tomamos el punto más cercano
    // al origen entre las del último subtrazado (el lápiz se dibuja al final).
    const puntos: Array<[number, number]> = [];
    for (const l of ctx.llamadas) {
      if (l.metodo === 'moveTo' || l.metodo === 'lineTo') {
        puntos.push([l.args[0] as number, l.args[1] as number]);
      }
    }
    // El lápiz abajo tiene su punta en el origen; buscamos el mínimo radio global.
    let minimo = Infinity;
    for (const [x, y] of puntos) {
      const r = Math.hypot(x, y);
      if (r < minimo) minimo = r;
    }
    return minimo;
  }

  it('con el lápiz abajo la punta cae a 1 unidad o menos del origen', () => {
    expect(distanciaPuntaAlOrigen(true)).toBeLessThanOrEqual(1);
  });

  it('con el lápiz arriba el punto más cercano se aleja del origen (punta a 8.6)', () => {
    // Al subir el lápiz, la punta se traslada 8.6 a lo largo de su eje, así que ya
    // ningún vértice del lápiz cae junto al origen. Comprobamos sobre el lápiz solo.
    const ctxAbajo = new DobleDibujo();
    dibujarPersonajes(ctxAbajo, estadoBase({ lapizAbajo: true }), estiloPersonajes);
    const ctxArriba = new DobleDibujo();
    dibujarPersonajes(ctxArriba, estadoBase({ lapizAbajo: false }), estiloPersonajes);

    // Extraemos el último subtrazado (el lápiz) de cada dibujo por sus vértices.
    const lapizDe = (ctx: DobleDibujo): Array<[number, number]> => {
      const grupos: Array<Array<[number, number]>> = [];
      let actual: Array<[number, number]> = [];
      for (const l of ctx.llamadas) {
        if (l.metodo === 'moveTo') {
          if (actual.length > 0) grupos.push(actual);
          actual = [[l.args[0] as number, l.args[1] as number]];
        } else if (l.metodo === 'lineTo') {
          actual.push([l.args[0] as number, l.args[1] as number]);
        }
      }
      if (actual.length > 0) grupos.push(actual);
      return grupos[grupos.length - 1]!;
    };

    const puntaMin = (grupo: Array<[number, number]>): number =>
      Math.min(...grupo.map(([x, y]) => Math.hypot(x, y)));

    expect(puntaMin(lapizDe(ctxAbajo))).toBeLessThanOrEqual(1);
    expect(puntaMin(lapizDe(ctxArriba))).toBeGreaterThanOrEqual(8);
  });
});

// ============================================================================
// Tortuga oculta: no dibuja nada (Req 13.7)
// ============================================================================

describe('personajes · tortuga oculta', () => {
  it('con visible false no traza ni rellena nada', () => {
    const ctx = new DobleDibujo();
    const r = dibujarPersonajes(ctx, estadoBase({ visible: false }), estiloPersonajes);
    expect(r.valido).toBe(true);
    expect(ctx.llamadas.length).toBe(0);
    expect(ctx.encendidos()).toBe(0);
  });
});

// ============================================================================
// Inclinación de Kiro fuera de rango se acota (Req 13.8)
// ============================================================================

describe('personajes · inclinación de Kiro', () => {
  it('una inclinación de 100 grados produce el mismo dibujo que 20', () => {
    const ctx100 = new DobleDibujo();
    dibujarPersonajes(ctx100, { ...estadoBase(), inclinacionKiro: 100 }, estiloPersonajes);
    const ctx20 = new DobleDibujo();
    dibujarPersonajes(ctx20, { ...estadoBase(), inclinacionKiro: 20 }, estiloPersonajes);
    expect(mascarasIguales(ctx100.mascara(), ctx20.mascara())).toBe(true);
  });

  it('una inclinación de −100 grados produce el mismo dibujo que −20', () => {
    const ctxNeg = new DobleDibujo();
    dibujarPersonajes(ctxNeg, { ...estadoBase(), inclinacionKiro: -100 }, estiloPersonajes);
    const ctx20 = new DobleDibujo();
    dibujarPersonajes(ctx20, { ...estadoBase(), inclinacionKiro: -20 }, estiloPersonajes);
    expect(mascarasIguales(ctxNeg.mascara(), ctx20.mascara())).toBe(true);
  });

  it('con inclinación 0 Kiro no se gira (dibujo determinista)', () => {
    const a = new DobleDibujo();
    dibujarPersonajes(a, { ...estadoBase(), inclinacionKiro: 0 }, estiloPersonajes);
    const b = new DobleDibujo();
    dibujarPersonajes(b, { ...estadoBase(), inclinacionKiro: 0 }, estiloPersonajes);
    expect(mascarasIguales(a.mascara(), b.mascara())).toBe(true);
  });
});

// ============================================================================
// Los tres campos reservados dan el mismo dibujo (Req 13.11)
// ============================================================================

describe('personajes · campos reservados', () => {
  const identidades: IdentidadTortuga[] = ['jugador', 'kiro'];

  it('kiroMontado, identidad y celebracion no cambian el dibujo', () => {
    const referencia = new DobleDibujo();
    dibujarPersonajes(referencia, estadoBase(), estiloPersonajes);
    const mReferencia = referencia.mascara();

    for (const kiroMontado of [true, false]) {
      for (const identidad of identidades) {
        for (const celebracion of [true, false]) {
          const ctx = new DobleDibujo();
          dibujarPersonajes(
            ctx,
            { ...estadoBase(), kiroMontado, identidad, celebracion },
            estiloPersonajes,
          );
          expect(mascarasIguales(ctx.mascara(), mReferencia)).toBe(true);
        }
      }
    }
  });
});

// ============================================================================
// Estado inválido (Req 13.10)
// ============================================================================

describe('personajes · estado inválido', () => {
  it('una posición no finita devuelve inválido sin dibujar ni lanzar', () => {
    for (const malo of [NaN, Infinity, -Infinity]) {
      const ctx = new DobleDibujo();
      const r = dibujarPersonajes(
        ctx,
        estadoBase({ posicion: { x: malo, y: 0 } }),
        estiloPersonajes,
      );
      expect(r.valido).toBe(false);
      if (!r.valido) {
        expect(r.campo).toBe('posicion.x');
        expect(r.valorRecibido).toBe(malo);
      }
      expect(ctx.llamadas.length).toBe(0);
    }
  });

  it('un rumbo no finito devuelve inválido nombrando el campo', () => {
    const ctx = new DobleDibujo();
    const r = dibujarPersonajes(ctx, estadoBase({ rumbo: NaN }), estiloPersonajes);
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.campo).toBe('rumbo');
    expect(ctx.llamadas.length).toBe(0);
  });

  it('una inclinación no finita devuelve inválido nombrando el campo', () => {
    const ctx = new DobleDibujo();
    const r = dibujarPersonajes(
      ctx,
      { ...estadoBase(), inclinacionKiro: Infinity },
      estiloPersonajes,
    );
    expect(r.valido).toBe(false);
    if (!r.valido) expect(r.campo).toBe('inclinacionKiro');
    expect(ctx.llamadas.length).toBe(0);
  });
});

// ============================================================================
// Property 14 (parte A, personajes): legibilidad del rumbo y círculo de 40
// Valida: Requisitos 13.3, 13.6, 13.8, 13.9
// ============================================================================

describe('Property 14A: legibilidad del rumbo e inscripción en el círculo', () => {
  /** Dibuja la silueta de la tortuga con un rumbo dado, en un doble fresco. */
  function siluetaConRumbo(
    rumbo: number,
    lapizAbajo: boolean,
    inclinacion: number,
  ): DobleDibujo {
    const ctx = new DobleDibujo();
    dibujarPersonajes(
      ctx,
      { ...estadoBase({ rumbo, lapizAbajo }), inclinacionKiro: inclinacion },
      estiloPersonajes,
    );
    return ctx;
  }

  it('el IoU de la silueta contra ella misma girada 15..345 grados es menor que 0.90', () => {
    // Medimos con el rumbo base 0. Cada múltiplo de 15 entre 15 y 345 debe dar un
    // IoU estrictamente menor que 0.90 contra el rumbo 0.
    const base = siluetaConRumbo(0, true, 0).mascara();
    let peorIoU = 0;
    for (let g = 15; g <= 345; g += 15) {
      const girada = siluetaConRumbo(g, true, 0).mascara();
      const valor = iou(base, girada);
      peorIoU = Math.max(peorIoU, valor);
      expect(valor).toBeLessThan(0.9);
    }
    // Deja constancia del peor IoU medido (debe quedar bajo 0.90).
    expect(peorIoU).toBeLessThan(0.9);
  }, 30_000);

  it('el radio máximo de todo punto trazado es ≤ 20 para todo rumbo, lápiz y extremos de inclinación', () => {
    const margen = GROSOR_TRAZO / 2; // 0.75
    for (let g = 0; g < 360; g += 15) {
      for (const lapizAbajo of [true, false]) {
        for (const inclinacion of [-INCLINACION_MAXIMA, 0, INCLINACION_MAXIMA]) {
          const ctx = siluetaConRumbo(g, lapizAbajo, inclinacion);
          const radio = ctx.radioMaximoDesdeOrigen() + margen;
          expect(radio).toBeLessThanOrEqual(20);
        }
      }
    }
  }, 30_000);

  it('Property: sobre 200 semillas el radio máximo (con mitad de trazo) es ≤ 20', () => {
    const margen = GROSOR_TRAZO / 2;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng(semilla);
        const rumbo = prng.siguiente() * 360;
        const lapizAbajo = prng.siguiente() < 0.5;
        const inclinacion = (prng.siguiente() * 2 - 1) * INCLINACION_MAXIMA;
        const ctx = siluetaConRumbo(rumbo, lapizAbajo, inclinacion);
        const radio = ctx.radioMaximoDesdeOrigen() + margen;
        expect(radio).toBeLessThanOrEqual(20);
      }),
      { seed: 141, numRuns: 200 },
    );
  }, 30_000);
});
