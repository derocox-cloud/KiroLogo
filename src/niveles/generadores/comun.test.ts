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
import { CATALOGO } from '../catalogo.js';
import { buscarGenerador } from './registro.js';
import { definicionPoligono, llamadaPoligono } from './poligono-comun.js';
import {
  avanza,
  giro,
  repite,
  numero,
  parametro,
  operacion,
  definicion,
  llamada,
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

// ============================================================================
// cajaDeReferencia con procedimientos y expresiones (mundo 4, D3)
// ============================================================================

/** Caja del encuadre real: ejecuta con el intérprete y encuadra los segmentos. */
function cajaReal(prog: Programa, mundo: 0 | 1 | 2 | 3 | 4) {
  const gen = ejecutar(prog, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(mundo),
    semilla: 1,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  expect(paso.value.error).toBeNull();
  expect(paso.value.guardaActivada).toBeNull();
  const real = calcularEncuadre(extraerSegmentos(paso.value.operaciones));
  if (!real.hayCaja) throw new Error('la ejecución real no dibujó ningún tramo');
  return real.caja;
}

/** Afirma que la caja de comun coincide con la del motor con tolerancia 1e-6. */
function esperarMismaCaja(prog: Programa, mundo: 0 | 1 | 2 | 3 | 4): void {
  const caja = cajaDeReferencia(prog);
  expect(caja).not.toBeNull();
  const real = cajaReal(prog, mundo);
  expect(Math.abs(caja!.izquierda - real.izquierda)).toBeLessThan(1e-6);
  expect(Math.abs(caja!.derecha - real.derecha)).toBeLessThan(1e-6);
  expect(Math.abs(caja!.abajo - real.abajo)).toBeLessThan(1e-6);
  expect(Math.abs(caja!.arriba - real.arriba)).toBeLessThan(1e-6);
}

describe('comun · cajaDeReferencia con PARA y expresiones', () => {
  it('una llamada a POLIGONO 4 100 da la caja de un cuadrado de lado 100', () => {
    const prog = programa(definicionPoligono(), llamadaPoligono(4, 100, 5));
    const caja = cajaDeReferencia(prog);
    expect(caja).not.toBeNull();
    expect(caja!.izquierda).toBeCloseTo(0, 6);
    expect(caja!.derecha).toBeCloseTo(100, 6);
    expect(caja!.abajo).toBeCloseTo(0, 6);
    expect(caja!.arriba).toBeCloseTo(100, 6);
    esperarMismaCaja(prog, 4);
  });

  it('POLIGONO con otros lados coincide con el motor', () => {
    for (const lados of [3, 5, 6, 8]) {
      esperarMismaCaja(programa(definicionPoligono(), llamadaPoligono(lados, 120, 5)), 4);
    }
  });

  it('la definición sola no dibuja: sin llamada la caja es null', () => {
    expect(cajaDeReferencia(programa(definicionPoligono()))).toBeNull();
  });

  it('un REPITE con cantidad calculada (2 + 2) da un cuadrado', () => {
    const prog = programa(
      repite(operacion('+', numero(2, 1), numero(2, 1), 1), [avanza(100, 2), giro('GIRADERECHA', 90, 3)], 1),
    );
    const caja = cajaDeReferencia(prog);
    expect(caja).not.toBeNull();
    expect(caja!.derecha - caja!.izquierda).toBeCloseTo(100, 6);
    expect(caja!.arriba - caja!.abajo).toBeCloseTo(100, 6);
    esperarMismaCaja(prog, 4);
  });

  it('argumentos calculados y REPITE :n dentro de un procedimiento coinciden con el motor', () => {
    // PARA FIGURA :n :l  REPITE :n [AVANZA :l * 2  GIRADERECHA 360 / :n]  FIN
    // FIGURA 2 * 3 40   → hexágono de lado 80
    const cuerpo = [
      repite(
        parametro('n', 2),
        [
          avanza(operacion('*', parametro('l', 3), numero(2, 3), 3), 3),
          giro('GIRADERECHA', operacion('/', numero(360, 4), parametro('n', 4), 4), 4),
        ],
        2,
      ),
    ];
    const prog = programa(
      definicion('FIGURA', ['n', 'l'], cuerpo, 1),
      llamada('FIGURA', [operacion('*', numero(2, 6), numero(3, 6), 6), numero(40, 6)], 6),
    );
    esperarMismaCaja(prog, 4);
  });

  it('una llamada sin distinguir mayúsculas encuentra la definición', () => {
    const prog = programa(definicionPoligono(), llamada('poligono', [numero(4, 5), numero(100, 5)], 5));
    expect(cajaDeReferencia(prog)).not.toBeNull();
  });
});

describe('comun · cajaDeReferencia devuelve null ante error', () => {
  it('división entre cero en un argumento', () => {
    const prog = programa(avanza(operacion('/', numero(100, 1), numero(0, 1), 1), 1));
    expect(cajaDeReferencia(prog)).toBeNull();
  });

  it('división entre cero en la cantidad de un REPITE', () => {
    const prog = programa(
      repite(operacion('/', numero(4, 1), numero(0, 1), 1), [avanza(100, 2)], 1),
    );
    expect(cajaDeReferencia(prog)).toBeNull();
  });

  it('cantidad de REPITE no entera o negativa', () => {
    expect(cajaDeReferencia(programa(repite(2.5, [avanza(100, 2)], 1)))).toBeNull();
    expect(cajaDeReferencia(programa(repite(-3, [avanza(100, 2)], 1)))).toBeNull();
  });

  it('un parámetro sin valor en el entorno', () => {
    expect(cajaDeReferencia(programa(avanza(parametro('largo', 1), 1)))).toBeNull();
  });

  it('un procedimiento inexistente, aunque antes se haya dibujado', () => {
    const prog = programa(avanza(100, 1), llamada('NOEXISTE', [], 2));
    expect(cajaDeReferencia(prog)).toBeNull();
  });

  it('una llamada con número de argumentos distinto al de la definición', () => {
    const prog = programa(definicionPoligono(), llamada('POLIGONO', [numero(4, 5)], 5));
    expect(cajaDeReferencia(prog)).toBeNull();
  });

  it('más de 50 000 pasos simulados', () => {
    expect(cajaDeReferencia(programa(repite(60_000, [avanza(1, 2)], 1)))).toBeNull();
  });

  it('recursión sin caso base', () => {
    const prog = programa(
      definicion('ESPIRAL', [], [avanza(10, 2), giro('GIRADERECHA', 10, 3), llamada('ESPIRAL', [], 4)], 1),
      llamada('ESPIRAL', [], 6),
    );
    expect(cajaDeReferencia(prog)).toBeNull();
  });
});

// ============================================================================
// Regresión: los generadores de los mundos 0 a 3 conservan su caja
// ============================================================================

describe('comun · regresión de cajaDeReferencia en los mundos 0 a 3', () => {
  // Programa del mundo 1 con literal, tal como se construía antes de D3: la caja
  // debe ser exactamente la misma, número por número.
  it('REPITE 4 [AVANZA 100 GIRADERECHA 90] da la misma caja que antes', () => {
    const caja = cajaDeReferencia(
      programa(repite(4, [avanza(100, 2), giro('GIRADERECHA', 90, 3)], 1)),
    );
    expect(caja).not.toBeNull();
    // La trigonometría deja residuos del orden de 1e-14 en los bordes; la caja
    // anterior era la misma, así que basta comparar a 12 decimales.
    expect(caja!.derecha).toBeCloseTo(100, 12);
    expect(caja!.arriba).toBeCloseTo(100, 12);
    expect(caja!.izquierda).toBeCloseTo(0, 12);
    expect(caja!.abajo).toBeCloseTo(0, 12);
  });

  // Solo los generadores de `registro.ts` filtran con `cajaDeReferencia`; los de
  // los mundos 1 y 2 viven en `juego/` y encuadran con el motor directamente.
  const generados = CATALOGO.filter(
    (n) =>
      n.mundo <= 3 && n.origen.tipo === 'generado' && buscarGenerador(n.origen.idGenerador) !== null,
  );

  it('el catálogo tiene niveles generados con registro en los mundos 0 a 3', () => {
    expect(generados.length).toBeGreaterThan(0);
  });

  for (const nivel of generados) {
    if (nivel.origen.tipo !== 'generado') continue;
    const { idGenerador, parametros } = nivel.origen;
    it(`${nivel.id} (${idGenerador}): la caja coincide con el motor en 30 semillas`, () => {
      const generador = buscarGenerador(idGenerador);
      expect(generador).not.toBeNull();
      for (let semilla = 0; semilla < 30; semilla++) {
        const r = generador!({ semilla, parametros, intentosMaximos: 200 });
        expect(r.exito).toBe(true);
        if (!r.exito) continue;
        esperarMismaCaja(r.referencia, nivel.mundo as 0 | 1 | 2 | 3);
      }
    });
  }
});
