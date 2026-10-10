// Pruebas de las utilidades compartidas por los generadores.
import { describe, it, expect } from 'vitest';
import type { Programa } from '../../lenguaje/ast.js';
import { crearPrng, type Prng } from '../../azar/prng.js';
import { ejecutar } from '../../lenguaje/interprete.js';
import { comandosDelMundo } from '../../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../../motor/tortuga.js';
import { extraerSegmentos } from '../../motor/segmentos.js';
import { calcularEncuadre } from '../../motor/encuadre.js';
import type { Segmento } from '../../motor/segmentos.js';
import {
  avanza,
  giro,
  cajaDeReferencia,
  esAceptable,
  generarConReintento,
  siguienteSemilla,
  LIMITE_LIENZO,
  DIMENSION_MINIMA,
} from './comun.js';

// ============================================================================
// Ayudas
// ============================================================================

/** Construye un programa del mundo 0 a partir de una lista de nodos. */
function programa(...instr: Programa['instrucciones'][number][]): Programa {
  return { tipo: 'programa', instrucciones: instr };
}

/** Un cuadrado de lado `l`: AV l GD 90, cuatro veces (sin giro final). */
function cuadrado(l: number): Programa {
  return programa(
    avanza(l, 1),
    giro('GIRADERECHA', 90, 2),
    avanza(l, 3),
    giro('GIRADERECHA', 90, 4),
    avanza(l, 5),
    giro('GIRADERECHA', 90, 6),
    avanza(l, 7),
  );
}

// ============================================================================
// Constructores de nodos
// ============================================================================

describe('comun · constructores de nodos', () => {
  it('avanza produce un AVANZA con literal numérico y posiciones coherentes', () => {
    const nodo = avanza(100, 3);
    expect(nodo.tipo).toBe('invocacionComando');
    expect(nodo.nombre).toBe('AVANZA');
    expect(nodo.linea).toBe(3);
    expect(nodo.columna).toBe(1);
    expect(nodo.argumentos).toHaveLength(1);
    const arg = nodo.argumentos[0]!;
    expect(arg.tipo).toBe('numeroLiteral');
    if (arg.tipo === 'numeroLiteral') {
      expect(arg.valor).toBe(100);
      expect(arg.linea).toBe(3);
      expect(arg.columna).toBe('AVANZA'.length + 2);
    }
  });

  it('giro produce el comando de giro pedido', () => {
    expect(giro('GIRADERECHA', 90, 2).nombre).toBe('GIRADERECHA');
    expect(giro('GIRAIZQUIERDA', 45, 4).nombre).toBe('GIRAIZQUIERDA');
  });

  it('los nodos construidos son ejecutables por el intérprete real', () => {
    // El cuadrado a mano se ejecuta sin error ni guarda.
    const gen = ejecutar(cuadrado(200), {
      estadoInicial: ESTADO_INICIAL,
      comandosPermitidos: comandosDelMundo(0),
      semilla: 1,
    });
    let paso = gen.next();
    while (!paso.done) paso = gen.next();
    expect(paso.value.error).toBeNull();
    expect(paso.value.guardaActivada).toBeNull();
  });
});

// ============================================================================
// cajaDeReferencia: coincide con la geometría real de la tortuga
// ============================================================================

describe('comun · cajaDeReferencia', () => {
  it('null cuando no hay ningún tramo', () => {
    expect(cajaDeReferencia(programa())).toBeNull();
    // Solo un giro, sin avanzar: tampoco dibuja.
    expect(cajaDeReferencia(programa(giro('GIRADERECHA', 90, 1)))).toBeNull();
  });

  it('una línea recta hacia arriba da una caja de ancho 0 y alto = largo', () => {
    const caja = cajaDeReferencia(programa(avanza(100, 1)));
    expect(caja).not.toBeNull();
    if (caja) {
      expect(caja.izquierda).toBeCloseTo(0, 6);
      expect(caja.derecha).toBeCloseTo(0, 6);
      expect(caja.abajo).toBeCloseTo(0, 6);
      expect(caja.arriba).toBeCloseTo(100, 6);
    }
  });

  it('un cuadrado de lado 200 da una caja de 200 × 200', () => {
    const caja = cajaDeReferencia(cuadrado(200));
    expect(caja).not.toBeNull();
    if (caja) {
      expect(caja.derecha - caja.izquierda).toBeCloseTo(200, 6);
      expect(caja.arriba - caja.abajo).toBeCloseTo(200, 6);
    }
  });

  it('la caja coincide con la del encuadre real sobre los segmentos ejecutados', () => {
    // Fuente de verdad: ejecutar con el intérprete y encuadrar los segmentos.
    const prog = cuadrado(160);
    const gen = ejecutar(prog, {
      estadoInicial: ESTADO_INICIAL,
      comandosPermitidos: comandosDelMundo(0),
      semilla: 1,
    });
    let paso = gen.next();
    while (!paso.done) paso = gen.next();
    const segmentos = extraerSegmentos(paso.value.operaciones);
    const real = calcularEncuadre(segmentos);
    const caja = cajaDeReferencia(prog);
    expect(real.hayCaja).toBe(true);
    expect(caja).not.toBeNull();
    if (real.hayCaja && caja) {
      expect(caja.izquierda).toBeCloseTo(real.caja.izquierda, 4);
      expect(caja.derecha).toBeCloseTo(real.caja.derecha, 4);
      expect(caja.abajo).toBeCloseTo(real.caja.abajo, 4);
      expect(caja.arriba).toBeCloseTo(real.caja.arriba, 4);
    }
  });
});

// ============================================================================
// esAceptable: encuadrado y no degenerado
// ============================================================================

describe('comun · esAceptable', () => {
  it('rechaza una figura sin tramos', () => {
    expect(esAceptable(programa())).toBe(false);
  });

  it('rechaza una línea recta (degenerada: un eje mide 0)', () => {
    expect(esAceptable(programa(avanza(200, 1)))).toBe(false);
  });

  it('acepta un cuadrado de lado 200 (ambos ejes exactamente 200)', () => {
    expect(esAceptable(cuadrado(200))).toBe(true);
  });

  it('rechaza un cuadrado de lado 180 (degenerado: eje < 200)', () => {
    expect(esAceptable(cuadrado(180))).toBe(false);
  });

  it('rechaza una figura que no cabe en el lienzo', () => {
    // Un cuadrado de lado 900 desborda [−400, 400].
    expect(esAceptable(cuadrado(900))).toBe(false);
  });

  it('rechaza un zigzag de 45° que, dibujado, es un trazo fino en diagonal', () => {
    // Giros de 45° alternados: la figura sube en diagonal y su caja alineada a
    // los ejes es estrecha en un eje. Es un garabato, no un reto: se rechaza.
    const zig = programa(
      avanza(120, 1),
      giro('GIRADERECHA', 45, 2),
      avanza(120, 3),
      giro('GIRAIZQUIERDA', 45, 4),
      avanza(120, 5),
      giro('GIRADERECHA', 45, 6),
      avanza(120, 7),
      giro('GIRAIZQUIERDA', 45, 8),
      avanza(120, 9),
    );
    const caja = cajaDeReferencia(zig)!;
    expect(caja).not.toBeNull();
    expect(caja.derecha - caja.izquierda).toBeLessThan(DIMENSION_MINIMA);
    expect(esAceptable(zig)).toBe(false);
  });

  // La aceptación de comun coincide con la decisión de motor/encuadre.ts sobre
  // los segmentos realmente ejecutados: encuadrado y no degenerado.
  it('coincide con calcularEncuadre sobre segmentos ejecutados, en varios lados', () => {
    for (const lado of [180, 200, 220, 260, 380]) {
      const prog = cuadrado(lado);
      const gen = ejecutar(prog, {
        estadoInicial: ESTADO_INICIAL,
        comandosPermitidos: comandosDelMundo(0),
        semilla: 1,
      });
      let paso = gen.next();
      while (!paso.done) paso = gen.next();
      const segmentos: readonly Segmento[] = extraerSegmentos(paso.value.operaciones);
      const real = calcularEncuadre(segmentos);
      const encuadradoYNoDegenerado =
        real.hayCaja && real.noEncuadrada.length === 0 && !real.degenerada;
      expect(esAceptable(prog)).toBe(encuadradoYNoDegenerado);
    }
  });
});

// ============================================================================
// Anclaje de las constantes contra el comportamiento de motor/encuadre.ts
// ============================================================================

describe('comun · constantes ancladas a motor/encuadre.ts', () => {
  // Un cuadrado justo en el umbral de dimensión mínima: 200 no es degenerado,
  // 199.99 sí. Confirma que DIMENSION_MINIMA vale lo mismo que en el motor.
  it('DIMENSION_MINIMA coincide con el umbral de degeneración del motor', () => {
    const justo = calcularEncuadre(segmentosCuadrado(DIMENSION_MINIMA));
    const menos = calcularEncuadre(segmentosCuadrado(DIMENSION_MINIMA - 0.02));
    expect(justo.hayCaja).toBe(true);
    if (justo.hayCaja) expect(justo.degenerada).toBe(false);
    expect(menos.hayCaja).toBe(true);
    if (menos.hayCaja) expect(menos.degenerada).toBe(true);
  });

  // Un cuadrado centrado de semilado LIMITE_LIENZO llega justo a ±400 y encuadra;
  // uno un poco mayor desborda. Confirma que LIMITE_LIENZO vale lo mismo.
  it('LIMITE_LIENZO coincide con el borde del lienzo del motor', () => {
    const justo = calcularEncuadre(segmentosCuadradoCentrado(LIMITE_LIENZO));
    const mas = calcularEncuadre(segmentosCuadradoCentrado(LIMITE_LIENZO + 1));
    expect(justo.hayCaja).toBe(true);
    expect(mas.hayCaja).toBe(true);
    if (justo.hayCaja) expect(justo.noEncuadrada.length).toBe(0);
    if (mas.hayCaja) expect(mas.noEncuadrada.length).toBeGreaterThan(0);
  });
});

/** Segmentos de un cuadrado de lado `l` con esquina en el origen. */
function segmentosCuadrado(l: number): Segmento[] {
  return [
    { desde: { x: 0, y: 0 }, hasta: { x: l, y: 0 }, paso: 0, linea: 1 },
    { desde: { x: l, y: 0 }, hasta: { x: l, y: l }, paso: 1, linea: 2 },
    { desde: { x: l, y: l }, hasta: { x: 0, y: l }, paso: 2, linea: 3 },
    { desde: { x: 0, y: l }, hasta: { x: 0, y: 0 }, paso: 3, linea: 4 },
  ];
}

/** Segmentos de un cuadrado de semilado `s` centrado en el origen ([−s, s]). */
function segmentosCuadradoCentrado(s: number): Segmento[] {
  return [
    { desde: { x: -s, y: -s }, hasta: { x: s, y: -s }, paso: 0, linea: 1 },
    { desde: { x: s, y: -s }, hasta: { x: s, y: s }, paso: 1, linea: 2 },
    { desde: { x: s, y: s }, hasta: { x: -s, y: s }, paso: 2, linea: 3 },
    { desde: { x: -s, y: s }, hasta: { x: -s, y: -s }, paso: 3, linea: 4 },
  ];
}

// ============================================================================
// siguienteSemilla
// ============================================================================

describe('comun · siguienteSemilla', () => {
  it('incrementa en uno dentro del dominio', () => {
    expect(siguienteSemilla(0)).toBe(1);
    expect(siguienteSemilla(41)).toBe(42);
  });

  it('envuelve al inicio del dominio tras el máximo', () => {
    expect(siguienteSemilla(4_294_967_295)).toBe(0);
  });
});

// ============================================================================
// generarConReintento
// ============================================================================

describe('comun · generarConReintento', () => {
  it('devuelve éxito y semilla efectiva cuando el primer candidato es aceptable', () => {
    // Candidato constante aceptable: no depende del PRNG.
    const r = generarConReintento(
      { semilla: 7, parametros: {}, intentosMaximos: 10 },
      () => cuadrado(200),
    );
    expect(r.exito).toBe(true);
    if (r.exito) {
      expect(r.semillaEfectiva).toBe(7);
      expect(r.descartes).toBe(0);
    }
  });

  it('reintenta con la semilla siguiente hasta encontrar uno aceptable', () => {
    // Candidato que degenera para las primeras semillas y solo acepta cuando el
    // PRNG produce un primer valor por encima de un umbral. Como la semilla
    // cambia entre intentos, el candidato cambia y en algún momento acepta.
    const candidatoDe = (prng: Prng): Programa => {
      const bueno = prng.siguiente() > 0.5;
      return bueno ? cuadrado(200) : programa(avanza(200, 1)); // recta = degenerada
    };
    const r = generarConReintento({ semilla: 0, parametros: {}, intentosMaximos: 200 }, candidatoDe);
    expect(r.exito).toBe(true);
    if (r.exito) {
      // La semilla efectiva puede diferir de la pedida si hubo descartes.
      expect(r.descartes).toBeGreaterThanOrEqual(0);
      expect(r.semillaEfectiva).toBe(0 + r.descartes);
      // El candidato de la semilla efectiva es, en efecto, aceptable.
      const prng = crearPrng(r.semillaEfectiva);
      expect(esAceptable(candidatoDe(prng))).toBe(true);
    }
  });

  it('devuelve fallo de programación cuando agota los intentos', () => {
    const r = generarConReintento(
      { semilla: 3, parametros: {}, intentosMaximos: 5 },
      () => programa(avanza(200, 1)), // siempre degenerada
    );
    expect(r.exito).toBe(false);
    if (!r.exito) {
      expect(r.error.id).toBe('generadorSinCandidato');
      expect(r.error.severidad).toBe('programacion');
      expect(r.intentos).toBe(5);
    }
  });

  it('es determinista: misma entrada produce el mismo resultado', () => {
    const candidatoDe = (prng: Prng): Programa =>
      prng.siguiente() > 0.5 ? cuadrado(200) : programa(avanza(200, 1));
    const entrada = { semilla: 123, parametros: {}, intentosMaximos: 200 };
    const a = generarConReintento(entrada, candidatoDe);
    const b = generarConReintento(entrada, candidatoDe);
    expect(a.exito).toBe(b.exito);
    if (a.exito && b.exito) {
      expect(a.semillaEfectiva).toBe(b.semillaEfectiva);
      expect(a.descartes).toBe(b.descartes);
    }
  });
});
