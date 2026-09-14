// Pruebas de las tres estrellas
// Ejemplos (16.4), Property 17 (16.5) y Property 26 (16.6).

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calificar } from './estrellas.js';
import { resolverReto, type Reto } from './reto.js';
import { validar, type Veredicto, crearMascara } from '../motor/validador.js';
import type { Programa, InvocacionComando, NumeroLiteral } from '../lenguaje/ast.js';
import type { Segmento } from '../motor/segmentos.js';
import { crearPrng } from '../azar/prng.js';

// ============================================================================
// Ayudas
// ============================================================================

/** Reto base del nivel 0.1 (presupuestoEstrella 1). */
function retoBase(): Reto {
  const r = resolverReto('0.1', 0);
  if (!r.exito) throw new Error('no se pudo resolver 0.1');
  return r.reto;
}

/** Un veredicto sintético con los campos mínimos que usan las estrellas. */
function veredicto(coincide: boolean, motivo: Veredicto['motivo'], iou: number, exceso: number): Veredicto {
  const vacia = crearMascara();
  return {
    coincide,
    iou,
    excesoPorcentaje: exceso,
    motivo,
    traslacion: { x: 0, y: 0 },
    angulo: 0,
    mascaraObjetivo: vacia,
    mascaraJugador: vacia,
    coincidencia: vacia,
    exceso: vacia,
    falta: vacia,
  };
}

const P = { linea: 1, columna: 1 };
const num = (v: number): NumeroLiteral => ({ tipo: 'numeroLiteral', valor: v, ...P });
const av = (v: number): InvocacionComando => ({ tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [num(v)], ...P });
const prog = (n: number): Programa => ({ tipo: 'programa', instrucciones: Array.from({ length: n }, () => av(100)) });

// ============================================================================
// Ejemplos (16.4)
// ============================================================================

describe('estrellas · ejemplos', () => {
  it('coincidencia geométrica otorga precisión y, sin exigencias, también abstracción', () => {
    const cal = calificar(prog(1), veredicto(true, 'coincide', 1, 0), retoBase());
    expect(cal.precision.otorgada).toBe(true);
    expect(cal.abstraccion.otorgada).toBe(true); // nivel 0.1 sin exigencias → sigue a precisión
  });

  it('sin coincidencia geométrica niega precisión con el IoU y el exceso recibidos', () => {
    const cal = calificar(prog(1), veredicto(false, 'iouInsuficiente', 0.5, 2), retoBase());
    expect(cal.precision.otorgada).toBe(false);
    if (!cal.precision.otorgada) {
      expect(cal.precision.motivo.clave).toBe('sinCoincidenciaGeometrica');
      if (cal.precision.motivo.clave === 'sinCoincidenciaGeometrica') {
        expect(cal.precision.motivo.iou).toBe(0.5);
        expect(cal.precision.motivo.exceso).toBe(2);
      }
    }
  });

  it('exceso de trazo da el motivo excesoDeTrazo en precisión', () => {
    const cal = calificar(prog(1), veredicto(false, 'excesoDeTrazo', 0.95, 12), retoBase());
    if (!cal.precision.otorgada) expect(cal.precision.motivo.clave).toBe('excesoDeTrazo');
  });

  it('economía: conteo 3 contra presupuesto 1 la niega con presupuestoExcedido', () => {
    const cal = calificar(prog(3), veredicto(true, 'coincide', 1, 0), retoBase());
    expect(cal.economia.otorgada).toBe(false);
    if (!cal.economia.otorgada && cal.economia.motivo.clave === 'presupuestoExcedido') {
      expect(cal.economia.motivo.conteo).toBe(3);
      expect(cal.economia.motivo.presupuesto).toBe(1);
    }
  });

  it('economía sin margen: conteo igual al presupuesto la otorga', () => {
    const cal = calificar(prog(1), veredicto(true, 'coincide', 1, 0), retoBase());
    expect(cal.economia.otorgada).toBe(true);
  });

  it('la economía es independiente del veredicto de precisión', () => {
    // Dibujó otra cosa (precisión negada) pero con economía.
    const cal = calificar(prog(1), veredicto(false, 'iouInsuficiente', 0.2, 0), retoBase());
    expect(cal.precision.otorgada).toBe(false);
    expect(cal.economia.otorgada).toBe(true);
  });

  it('sin veredicto por errores de análisis niega las tres', () => {
    const cal = calificar(null, null, retoBase(), 'erroresDeAnalisis');
    expect(cal.precision.otorgada).toBe(false);
    expect(cal.economia.otorgada).toBe(false);
    expect(cal.abstraccion.otorgada).toBe(false);
    if (!cal.precision.otorgada && cal.precision.motivo.clave === 'sinVeredicto') {
      expect(cal.precision.motivo.causa).toBe('erroresDeAnalisis');
    }
  });

  it('sin veredicto por guarda niega las tres con esa causa', () => {
    const cal = calificar(null, null, retoBase(), 'guarda');
    if (!cal.abstraccion.otorgada && cal.abstraccion.motivo.clave === 'sinVeredicto') {
      expect(cal.abstraccion.motivo.causa).toBe('guarda');
    }
  });
});

// ============================================================================
// Property 17: las tres estrellas son bicondicionales independientes (16.5)
// Valida: Requisitos 19.1, 19.2, 19.3, 19.5, 19.11, 27.11
// ============================================================================

describe('Property 17: bicondicionales independientes', () => {
  it('precisión ⟺ coincide; economía ⟺ conteo ≤ presupuesto; deterministas, sobre 200 semillas', () => {
    const reto = retoBase();
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng(semilla);
        const coincide = prng.siguiente() < 0.5;
        const conteo = prng.entero(0, 5);
        const iou = coincide ? 0.95 : prng.siguiente() * 0.89;
        const exceso = coincide ? prng.siguiente() * 5 : prng.siguiente() * 20;
        const motivo: Veredicto['motivo'] = coincide ? 'coincide' : 'iouInsuficiente';

        const ast = prog(Math.max(1, conteo));
        const conteoReal = Math.max(1, conteo);
        const cal = calificar(ast, veredicto(coincide, motivo, iou, exceso), reto);

        // Precisión bicondicional con `coincide`.
        expect(cal.precision.otorgada).toBe(coincide);
        // Economía bicondicional con conteo ≤ presupuesto (1).
        expect(cal.economia.otorgada).toBe(conteoReal <= reto.presupuestoEstrella);
        // Abstracción (nivel sin exigencias) ⟺ precisión.
        expect(cal.abstraccion.otorgada).toBe(coincide);

        // Determinismo.
        const cal2 = calificar(ast, veredicto(coincide, motivo, iou, exceso), reto);
        expect(JSON.stringify(cal)).toBe(JSON.stringify(cal2));
      }),
      { seed: 17, numRuns: 200 },
    );
  });
});

// ============================================================================
// Property 26: equivalencia geométrica de programas escritos de otra forma (16.6)
// Valida: Requisitos 27.4, 16.7, 16.8
// ============================================================================

describe('Property 26: equivalencia geométrica en el nivel 0.1', () => {
  it('un programa que dibuja la misma figura con otro texto gana precisión', () => {
    const reto = retoBase();
    // El jugador escribe RETROCEDE 100 en vez de AVANZA 100: con traslación y
    // rotación libres, dibuja un segmento recto de 100 unidades, geométricamente
    // equivalente al objetivo del nivel 0.1.
    const segmentosJugador: Segmento[] = [
      { desde: { x: 0, y: 0 }, hasta: { x: 0, y: -100 }, paso: 0, linea: 1 },
    ];
    const v = validar(segmentosJugador, reto.segmentos, reto.nivel.normalizacion);
    const astJugador: Programa = {
      tipo: 'programa',
      instrucciones: [{ tipo: 'invocacionComando', nombre: 'RETROCEDE', argumentos: [num(100)], ...P }],
    };
    const cal = calificar(astJugador, v, reto);
    expect(cal.precision.otorgada).toBe(true);
    expect(cal.economia.otorgada).toBe(true); // 1 instrucción ≤ presupuesto 1
    expect(cal.abstraccion.otorgada).toBe(true);
  });
});
