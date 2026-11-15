// Property 6: la cantidad de un REPITE se evalúa con tolerancia (Req 4.6, 4.7).
//
// Un valor a menos de 1e-9 de un entero no negativo cuenta como ese entero: así
// `REPITE 360 / 120 [ … ]` repite 3 veces aunque la división flotante no dé 3 exacto.
// Cualquier otro valor finito (fraccionario o negativo) detiene la ejecución con
// `vecesInvalidas` antes de ejecutar el cuerpo una sola vez.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ejecutar, type ResultadoEjecucion } from './interprete.js';
import type {
  DefinicionProcedimiento,
  Expresion,
  Instruccion,
  InvocacionComando,
  InvocacionProcedimiento,
  NumeroLiteral,
  Programa,
  ReferenciaParametro,
  Repeticion,
} from './ast.js';
import { comandosDelMundo } from './vocabulario.js';
import { fabricaAzar } from '../azar/prng.js';
import { arbExpresion, modeloEvaluar } from '../pruebas/arbitrarios.js';

const TOLERANCIA = 1e-9;
const PERMITIDOS = comandosDelMundo(4);
// Tope de repeticiones válidas que se prueban: mantiene cada ejecución por debajo de la
// guarda de pasos sin cambiar lo que la propiedad afirma.
const MAXIMO_VECES = 300;

const LINEA_REPITE = 2;
const LINEA_CUERPO = 3;

/** La definición de la propiedad, escrita aparte del evaluador para no probarlo contra sí mismo. */
function esCantidadValida(v: number): boolean {
  const r = Math.round(v);
  return Number.isFinite(v) && Math.abs(v - r) < TOLERANCIA && r >= 0;
}

function numero(valor: number, linea: number): NumeroLiteral {
  return { tipo: 'numeroLiteral', valor, linea, columna: 1 };
}

function avanzaUno(): InvocacionComando {
  return { tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [numero(1, LINEA_CUERPO)], linea: LINEA_CUERPO, columna: 3 };
}

function repite(veces: Expresion): Repeticion {
  return { tipo: 'repeticion', veces, cuerpo: [avanzaUno()], linea: LINEA_REPITE, columna: 1 };
}

/** `REPITE <v> [AVANZA 1]` en la línea 2. */
function programaDirecto(veces: Expresion): Programa {
  return { tipo: 'programa', instrucciones: [repite(veces)] };
}

/** `PARA VECES :n  REPITE :n [AVANZA 1]  FIN` y la llamada `VECES <v>`: la cantidad llega por parámetro. */
function programaPorParametro(v: number): Programa {
  const referencia: ReferenciaParametro = { tipo: 'referenciaParametro', nombre: 'n', linea: LINEA_REPITE, columna: 8 };
  const definicion: DefinicionProcedimiento = {
    tipo: 'definicionProcedimiento', nombre: 'VECES', parametros: ['n'], cuerpo: [repite(referencia)], linea: 1, columna: 1,
  };
  const llamada: InvocacionProcedimiento = {
    tipo: 'invocacionProcedimiento', nombre: 'VECES', argumentos: [numero(v, 5)], linea: 5, columna: 1,
  };
  const instrucciones: readonly Instruccion[] = [definicion, llamada];
  return { tipo: 'programa', instrucciones };
}

function correr(programa: Programa, semilla = 0): ResultadoEjecucion {
  const gen = ejecutar(programa, { comandosPermitidos: PERMITIDOS, semilla, fabricaAzar });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

function vecesEjecutado(resultado: ResultadoEjecucion): number {
  return resultado.operaciones.filter((op) => op.tipo === 'mover' && op.linea === LINEA_CUERPO).length;
}

function afirmarValida(resultado: ResultadoEjecucion, v: number): void {
  expect(resultado.error).toBeNull();
  expect(resultado.guardaActivada).toBeNull();
  // `+ 0` convierte el -0 de `Math.round(-1e-10)` en 0: un conteo nunca es -0.
  expect(vecesEjecutado(resultado)).toBe(Math.round(v) + 0);
}

function afirmarInvalida(resultado: ResultadoEjecucion, v: number): void {
  expect(resultado.error?.id).toBe('vecesInvalidas');
  expect(resultado.error?.linea).toBe(LINEA_REPITE);
  expect(resultado.error?.mensaje).toContain(String(v));
  expect(vecesEjecutado(resultado)).toBe(0);
}

// Enteros de 0 a MAXIMO_VECES corridos menos de 1e-9, más el -0 literal.
const arbValida: fc.Arbitrary<number> = fc.oneof(
  fc.constant(-0),
  fc.tuple(
    fc.integer({ min: 0, max: MAXIMO_VECES }),
    fc.double({ min: -0.99e-9, max: 0.99e-9, noNaN: true }),
  ).map(([n, delta]) => n + delta),
).filter(esCantidadValida);

// Fraccionarios (a 1e-9 o más del entero más cercano, incluida la frontera) y negativos.
const arbInvalida: fc.Arbitrary<number> = fc.oneof(
  fc.tuple(
    fc.integer({ min: -MAXIMO_VECES, max: MAXIMO_VECES }),
    fc.double({ min: 1e-9, max: 0.5, noNaN: true }),
    fc.boolean(),
  ).map(([n, delta, abajo]) => (abajo ? n - delta : n + delta)),
  fc.integer({ min: -100_000, max: -1 }),
  fc.double({ min: -1e12, max: -0.5, noNaN: true }),
).filter((v) => Number.isFinite(v) && !esCantidadValida(v));

describe('interprete · Property 6: la cantidad de un REPITE se evalúa con tolerancia', () => {
  /** **Validates: Requirements 4.6, 4.7** */
  it('un valor a menos de 1e-9 de un entero n ≥ 0 repite el cuerpo exactamente n veces', () => {
    fc.assert(
      fc.property(arbValida, (v) => {
        afirmarValida(correr(programaDirecto(numero(v, LINEA_REPITE))), v);
        afirmarValida(correr(programaPorParametro(v)), v);
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 4.6, 4.7** */
  it('un valor fraccionario o negativo termina con vecesInvalidas, su valor y la línea, sin ejecutar el cuerpo', () => {
    fc.assert(
      fc.property(arbInvalida, (v) => {
        afirmarInvalida(correr(programaDirecto(numero(v, LINEA_REPITE))), v);
        afirmarInvalida(correr(programaPorParametro(v)), v);
      }),
      { numRuns: 200 },
    );
  });

  /** **Validates: Requirements 4.6, 4.7** */
  it('una cantidad calculada con una expresión (incluido AZAR) sigue la misma regla según su valor', () => {
    const arbCaso = fc.record({
      expresion: arbExpresion(3, { divisoresSeguros: true, incluirAzar: true }),
      semilla: fc.integer({ min: 0, max: 0xffff_ffff }),
    });
    fc.assert(
      fc.property(arbCaso, ({ expresion, semilla }) => {
        const modelo = modeloEvaluar(expresion, new Map(), fabricaAzar(semilla));
        fc.pre(modelo.exito);
        if (!modelo.exito) return;
        const v = modelo.valor;
        fc.pre(Number.isFinite(v));
        const resultado = correr(programaDirecto(expresion), semilla);
        if (esCantidadValida(v)) {
          fc.pre(Math.round(v) <= MAXIMO_VECES);
          afirmarValida(resultado, v);
        } else {
          afirmarInvalida(resultado, v);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('casos de la frontera', () => {
    afirmarValida(correr(programaDirecto(numero(360 / 120, LINEA_REPITE))), 3);
    afirmarValida(correr(programaDirecto(numero(3 - 5e-10, LINEA_REPITE))), 3);
    afirmarValida(correr(programaDirecto(numero(-1e-10, LINEA_REPITE))), 0);
    afirmarInvalida(correr(programaDirecto(numero(3 + 1e-9, LINEA_REPITE))), 3 + 1e-9);
    afirmarInvalida(correr(programaDirecto(numero(2.5, LINEA_REPITE))), 2.5);
    afirmarInvalida(correr(programaDirecto(numero(-1, LINEA_REPITE))), -1);
  });
});
