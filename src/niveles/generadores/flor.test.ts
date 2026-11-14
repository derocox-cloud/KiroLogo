// Pruebas de propiedad del generador `flor-m3` (nivel 3.3).
//
// La flor es como el rosetón, pero cada pétalo gira ANTES de avanzar: la forma
// exacta es REPITE c [REPITE n [GD a AV L] GD 360/c]. También es REPITE anidado.
// Estas pruebas verifican todo lo que NO depende del catálogo del mundo 3 (tarea
// 6). La Property 7 queda documentada como pendiente más abajo.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Instruccion, Repeticion, InvocacionComando, Programa } from '../../lenguaje/ast.js';
import { analizar } from '../../juego/abstraccion.js';
import { cajaDeReferencia, LIMITE_LIENZO, DIMENSION_MINIMA } from './comun.js';
import { generarFlor } from './flor.js';
import { ejecutar } from '../../lenguaje/interprete.js';
import { comandosDelMundo } from '../../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../../motor/tortuga.js';
import { extraerSegmentos } from '../../motor/segmentos.js';
import { validar } from '../../motor/validador.js';
import { contarInstrucciones } from '../../lenguaje/conteo.js';
import { calificar } from '../../juego/estrellas.js';
import type { Reto } from '../../juego/reto.js';
import { NIVEL_3_3 } from '../mundo-3-rosetones.js';

// ============================================================================
// Ayudas de recorrido del AST
// ============================================================================

function argumentoNumerico(nodo: InvocacionComando): number | null {
  const arg = nodo.argumentos[0];
  return arg && arg.tipo === 'numeroLiteral' ? arg.valor : null;
}

function vecesDe(nodo: Repeticion): number | null {
  return nodo.veces.tipo === 'numeroLiteral' ? nodo.veces.valor : null;
}

/**
 * ¿El ángulo es derivable por el jugador? Múltiplo de 15, o 360 entre un entero
 * que el jugador puede contar (segmentos del pétalo o pétalos). El rango 360/k
 * con k de 3 a 36 cubre tanto el ángulo previo al avance como el giro entre
 * pétalos (60,45,40,30).
 */
function esAnguloDerivable(angulo: number): boolean {
  if (angulo % 15 === 0) return true;
  for (let k = 3; k <= 36; k++) {
    if (Math.abs(angulo - 360 / k) < 1e-9) return true;
  }
  return false;
}

function recogerArgumentos(instrucciones: readonly Instruccion[], acc: { longitudes: number[]; angulos: number[] }): void {
  for (const nodo of instrucciones) {
    if (nodo.tipo === 'invocacionComando') {
      const valor = argumentoNumerico(nodo);
      if (valor !== null) {
        if (nodo.nombre === 'AVANZA' || nodo.nombre === 'RETROCEDE') acc.longitudes.push(valor);
        if (nodo.nombre === 'GIRADERECHA' || nodo.nombre === 'GIRAIZQUIERDA') acc.angulos.push(valor);
      }
    } else if (nodo.tipo === 'repeticion') {
      recogerArgumentos(nodo.cuerpo, acc);
    }
  }
}

// ============================================================================
// Property 8 · encuadra y no degenera, sobre 200 semillas
// ============================================================================

describe('flor-m3 · Property 8: encuadra y no degenera (200 semillas)', () => {
  // Validates: Requirements 5.6, 5.7
  it('las 200 semillas consecutivas producen éxito, encuadrado y no degenerado', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const r = generarFlor({ semilla, parametros: {}, intentosMaximos: 200 });
      expect(r.exito, `semilla ${semilla} debería tener éxito`).toBe(true);
      if (r.exito) {
        const caja = cajaDeReferencia(r.referencia);
        expect(caja, `semilla ${semilla} debería dibujar tramos`).not.toBeNull();
        if (caja) {
          expect(caja.izquierda).toBeGreaterThanOrEqual(-LIMITE_LIENZO);
          expect(caja.derecha).toBeLessThanOrEqual(LIMITE_LIENZO);
          expect(caja.abajo).toBeGreaterThanOrEqual(-LIMITE_LIENZO);
          expect(caja.arriba).toBeLessThanOrEqual(LIMITE_LIENZO);
          expect(caja.derecha - caja.izquierda).toBeGreaterThanOrEqual(DIMENSION_MINIMA);
          expect(caja.arriba - caja.abajo).toBeGreaterThanOrEqual(DIMENSION_MINIMA);
        }
      }
    }
  });

  it('el lazo no malgasta intentos: el promedio de descartes por semilla es bajo', () => {
    // La flor tiene más combinaciones que degeneran o desbordan que el rosetón
    // (el giro previo al avance abre o cierra el pétalo según a y L), así que su
    // promedio de descartes es algo mayor. El límite ancla que el lazo sigue
    // sano: si un cambio futuro lo disparara, esta prueba lo avisa.
    let descartesTotales = 0;
    for (let semilla = 0; semilla < 200; semilla++) {
      const r = generarFlor({ semilla, parametros: {}, intentosMaximos: 200 });
      if (r.exito) descartesTotales += r.descartes;
    }
    expect(descartesTotales / 200).toBeLessThan(4);
  });
});

// ============================================================================
// Property 9 · números adivinables
// ============================================================================

describe('flor-m3 · Property 9: solo números adivinables', () => {
  // Validates: Requirements 5.4
  it('toda longitud es múltiplo de 20 y todo ángulo es derivable', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const r = generarFlor({ semilla, parametros: {}, intentosMaximos: 200 });
        if (!r.exito) return true;
        const acc = { longitudes: [] as number[], angulos: [] as number[] };
        recogerArgumentos(r.referencia.instrucciones, acc);
        return (
          acc.longitudes.every((l) => l % 20 === 0) &&
          acc.angulos.every((a) => esAnguloDerivable(a))
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ============================================================================
// Property 11 · forma de la flor
// ============================================================================

describe('flor-m3 · Property 11: forma REPITE c [REPITE n [GD a AV L] GD 360/c]', () => {
  // Validates: Requirements 5.3, 5.8
  it('giro previo al avance en cada pétalo, con giro entre pétalos de 360/c', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const r = generarFlor({ semilla, parametros: {}, intentosMaximos: 200 });
      expect(r.exito).toBe(true);
      if (!r.exito) continue;

      const instr = r.referencia.instrucciones;
      expect(instr).toHaveLength(1);
      const externo = instr[0]!;
      expect(externo.tipo).toBe('repeticion');
      if (externo.tipo !== 'repeticion') continue;

      const c = vecesDe(externo);
      expect(c).not.toBeNull();
      // 360/c entero (ángulo derivable entre pétalos).
      if (c !== null) expect(Number.isInteger(360 / c)).toBe(true);

      // Cuerpo del externo: [ REPITE n [...], GD 360/c ].
      expect(externo.cuerpo).toHaveLength(2);
      const interno = externo.cuerpo[0]!;
      const giroPetalo = externo.cuerpo[1]!;
      expect(interno.tipo).toBe('repeticion');
      expect(giroPetalo.tipo).toBe('invocacionComando');
      if (interno.tipo !== 'repeticion' || giroPetalo.tipo !== 'invocacionComando') continue;
      expect(giroPetalo.nombre).toBe('GIRADERECHA');
      expect(argumentoNumerico(giroPetalo)).toBeCloseTo(360 / (c ?? 1), 9);

      // Cuerpo del interno: [ GD a, AV L ] — giro ANTES del avance.
      expect(interno.cuerpo).toHaveLength(2);
      const giroPrevio = interno.cuerpo[0]!;
      const avance = interno.cuerpo[1]!;
      expect(giroPrevio.tipo).toBe('invocacionComando');
      expect(avance.tipo).toBe('invocacionComando');
      if (giroPrevio.tipo !== 'invocacionComando' || avance.tipo !== 'invocacionComando') continue;
      expect(giroPrevio.nombre).toBe('GIRADERECHA');
      expect(avance.nombre).toBe('AVANZA');
    }
  });

  it('la referencia cumple usaRepiteAnidado (analizando el AST)', () => {
    const r = generarFlor({ semilla: 0, parametros: {}, intentosMaximos: 200 });
    expect(r.exito).toBe(true);
    if (r.exito) {
      const res = analizar(r.referencia, [{ clave: 'usaRepiteAnidado' }]);
      expect(res.confirmadas).toContain('usaRepiteAnidado');
    }
  });
});

// ============================================================================
// Property 7 · tres estrellas contra el nivel 3.3
// ============================================================================
//
// El nivel 3.3 ya existe en `mundo-3-rosetones.ts` (tarea 6), así que la
// Property 7 se verifica SIN el catálogo del mundo 3 (tarea 7): se ejecuta la
// referencia con el mismo intérprete que `resolverReto`, se extraen sus
// segmentos y se valida contra sí misma con la normalización FIJA del nivel.
// La referencia del jugador ES la de la demostración, así que debe ganar las
// tres estrellas. La regresión sobre las 200 semillas queda para la tarea 12.2.

/** Ejecuta una referencia del mundo 3 y devuelve sus segmentos dibujados. */
function segmentosDe(referencia: Programa): ReturnType<typeof extraerSegmentos> {
  const gen = ejecutar(referencia, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(3),
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return extraerSegmentos(paso.value.operaciones);
}

/** Arma un Reto mínimo para calificar la referencia contra su propio nivel. */
function retoDeReferencia(referencia: Programa, nivel: typeof NIVEL_3_3): Reto {
  const conteo = contarInstrucciones(referencia);
  const presupuesto = conteo.exito ? conteo.instrucciones : 0;
  return {
    nivel,
    semillaEfectiva: 0,
    codigoSemilla: '',
    referencia,
    operaciones: [],
    segmentos: [],
    presupuestoEstrella: presupuesto,
    limiteDuro: presupuesto + 3,
    limiteDuroActivo: true,
  };
}

describe('flor-m3 · Property 7: la referencia gana las tres estrellas contra el nivel 3.3', () => {
  // Validates: Requirements 5.9, 4.7
  it('la referencia de varias semillas gana precisión, economía y abstracción contra el nivel 3.3', () => {
    for (const semilla of [0, 1, 7, 42, 199]) {
      const r = generarFlor({ semilla, parametros: {}, intentosMaximos: 200 });
      expect(r.exito, `semilla ${semilla}`).toBe(true);
      if (!r.exito) continue;

      const segmentos = segmentosDe(r.referencia);
      const veredicto = validar(segmentos, segmentos, NIVEL_3_3.normalizacion);
      const reto = retoDeReferencia(r.referencia, NIVEL_3_3);
      const calificacion = calificar(r.referencia, veredicto, reto);

      expect(calificacion.precision.otorgada, `precisión semilla ${semilla}`).toBe(true);
      expect(calificacion.economia.otorgada, `economía semilla ${semilla}`).toBe(true);
      expect(calificacion.abstraccion.otorgada, `abstracción semilla ${semilla}`).toBe(true);
    }
  });
});
