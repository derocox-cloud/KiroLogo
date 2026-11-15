// Property 5: un error aritmético detiene la ejecución y conserva lo emitido.
//
// Cada caso arma un programa en tres partes: un prefijo válido del mundo 4, una
// instrucción cuya expresión divide entre cero (incluido -0) o se sale del rango de
// los dobles, y un sufijo que dibuja. El prefijo se ejecuta también solo, con la
// misma semilla: sus operaciones son exactamente las que la ejecución completa debe
// conservar, ni una más. Así la propiedad no depende de saber qué emite cada comando.
//
// La instrucción que falla va en una línea propia (las del prefijo y el sufijo están
// en la 1), para comprobar que el error trae la línea de esa instrucción.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Expresion, Instruccion, NumeroLiteral, Programa } from './ast.js';
import type { IdError } from './errores.js';
import { ejecutar, type Operacion, type ResultadoEjecucion } from './interprete.js';
import { buscarComando, comandosDelMundo } from './vocabulario.js';
import { fabricaAzar, SEMILLA_MAXIMA, SEMILLA_MINIMA } from '../azar/prng.js';
import { arbExpresion, arbNumero, arbPrograma } from '../pruebas/arbitrarios.js';

const PERMITIDOS = comandosDelMundo(4);
// Más de 8 letras: `arbPrograma` nunca genera un procedimiento con este nombre.
const PROCEDIMIENTO = 'PRUEBAFALLA';
const LINEA_FALLA = 7;

type ErrorAritmetico = Extract<IdError, 'divisionPorCero' | 'numeroFueraDeRango'>;

interface Falla {
  readonly expresion: Expresion;
  readonly id: ErrorAritmetico;
}

const pos = (linea: number) => ({ linea, columna: 1 });
const num = (valor: number, linea = 1): NumeroLiteral => ({ tipo: 'numeroLiteral', valor, ...pos(linea) });

// ---- Expresiones que fallan ------------------------------------------------

/** Divisores que valen 0: literal, `-0` y una resta que se anula. */
const arbDivisorCero: fc.Arbitrary<Expresion> = fc.oneof(
  fc.constant(num(0)),
  fc.constant<Expresion>({ tipo: 'menosUnario', operando: num(0), ...pos(1) }),
  fc.constant(num(-0)),
  arbNumero.map((a): Expresion => ({
    tipo: 'expresionAritmetica', operador: '-', izquierda: num(a), derecha: num(a), ...pos(1),
  })),
);

const sana = arbExpresion(1, { divisoresSeguros: true });

const arbDivisionPorCero: fc.Arbitrary<Falla> = fc
  .tuple(fc.constantFrom('/', 'COCIENTE', 'RESTO'), sana, arbDivisorCero)
  .map(([operador, dividendo, divisor]): Falla => ({
    id: 'divisionPorCero',
    expresion: operador === '/'
      ? { tipo: 'expresionAritmetica', operador: '/', izquierda: dividendo, derecha: divisor, ...pos(1) }
      : { tipo: 'comandoOperador', nombre: operador, argumentos: [dividendo, divisor], ...pos(1) },
  }));

/** Operaciones entre finitos que dan ±Infinity sin dividir entre cero. */
const arbFueraDeRango: fc.Arbitrary<Falla> = fc
  .constantFrom<Expresion>(
    { tipo: 'comandoOperador', nombre: 'PRODUCTO', argumentos: [num(1e200), num(1e200)], ...pos(1) },
    { tipo: 'expresionAritmetica', operador: '*', izquierda: num(-1e200), derecha: num(1e200), ...pos(1) },
    { tipo: 'expresionAritmetica', operador: '+', izquierda: num(1e308), derecha: num(1e308), ...pos(1) },
    { tipo: 'comandoOperador', nombre: 'RESTA', argumentos: [num(-1e308), num(1e308)], ...pos(1) },
    { tipo: 'expresionAritmetica', operador: '/', izquierda: num(1e308), derecha: num(0.5), ...pos(1) },
    { tipo: 'comandoOperador', nombre: 'COCIENTE', argumentos: [num(1e308), num(0.01)], ...pos(1) },
  )
  .map((expresion): Falla => ({ id: 'numeroFueraDeRango', expresion }));

const arbFallaSimple: fc.Arbitrary<Falla> = fc.oneof(arbDivisionPorCero, arbFueraDeRango);

const OPERADORES_BINARIOS = ['+', '-', '*', '/', 'SUMA', 'RESTA', 'PRODUCTO', 'COCIENTE', 'RESTO'] as const;

function binaria(operador: (typeof OPERADORES_BINARIOS)[number], a: Expresion, b: Expresion): Expresion {
  return operador === '+' || operador === '-' || operador === '*' || operador === '/'
    ? { tipo: 'expresionAritmetica', operador, izquierda: a, derecha: b, ...pos(1) }
    : { tipo: 'comandoOperador', nombre: operador, argumentos: [a, b], ...pos(1) };
}

/**
 * La falla sola, envuelta en un menos, al lado de un operando sano, o junto a otra
 * falla. Con dos fallas el error esperado es el de la izquierda.
 */
const arbFalla: fc.Arbitrary<Falla> = fc.oneof(
  arbFallaSimple,
  arbFallaSimple.map((f): Falla => ({ ...f, expresion: { tipo: 'menosUnario', operando: f.expresion, ...pos(1) } })),
  fc.tuple(fc.constantFrom(...OPERADORES_BINARIOS), arbFallaSimple, sana)
    .map(([op, f, s]): Falla => ({ id: f.id, expresion: binaria(op, f.expresion, s) })),
  fc.tuple(fc.constantFrom(...OPERADORES_BINARIOS), sana, arbFallaSimple)
    .map(([op, s, f]): Falla => ({ id: f.id, expresion: binaria(op, s, f.expresion) })),
  fc.tuple(fc.constantFrom(...OPERADORES_BINARIOS), arbFallaSimple, arbFallaSimple)
    .map(([op, izquierda, derecha]): Falla => ({ id: izquierda.id, expresion: binaria(op, izquierda.expresion, derecha.expresion) })),
);

// ---- Instrucciones que fallan ---------------------------------------------

interface Caso {
  /** Lo que va entre el prefijo y el sufijo. */
  readonly instrucciones: readonly Instruccion[];
  /** Definiciones que se agregan al final del programa (los PARA se indexan antes de ejecutar). */
  readonly definiciones: readonly Instruccion[];
  readonly lineaError: number;
}

const COMANDOS_CON_EXPRESION = ['AVANZA', 'RETROCEDE', 'GIRADERECHA', 'GIRAIZQUIERDA', 'ESCRIBE', 'ROTULA'] as const;

function comando(nombre: string, argumento: Expresion, linea: number): Instruccion {
  return { tipo: 'invocacionComando', nombre, argumentos: [argumento], ...pos(linea) };
}

/** Cuerpo que nunca debe ejecutarse: si se ejecutara, emitiría operaciones de más. */
const CUERPO_TESTIGO: readonly Instruccion[] = [comando('AVANZA', num(20), LINEA_FALLA)];

function arbCaso(falla: Expresion): fc.Arbitrary<Caso> {
  const parametro: Expresion = { tipo: 'referenciaParametro', nombre: 'x', ...pos(1) };
  return fc.oneof(
    // Argumento de un comando de acción.
    fc.constantFrom(...COMANDOS_CON_EXPRESION).map((nombre): Caso => ({
      instrucciones: [comando(nombre, falla, LINEA_FALLA)], definiciones: [], lineaError: LINEA_FALLA,
    })),
    // Cantidad de un REPITE: el cuerpo no se ejecuta ni una vez.
    fc.constant<Caso>({
      instrucciones: [{ tipo: 'repeticion', veces: falla, cuerpo: CUERPO_TESTIGO, ...pos(LINEA_FALLA) }],
      definiciones: [],
      lineaError: LINEA_FALLA,
    }),
    // Argumento de una llamada: no se entra al procedimiento.
    fc.constant<Caso>({
      instrucciones: [{ tipo: 'invocacionProcedimiento', nombre: PROCEDIMIENTO, argumentos: [falla], ...pos(LINEA_FALLA) }],
      definiciones: [{
        tipo: 'definicionProcedimiento', nombre: PROCEDIMIENTO, parametros: ['x'], cuerpo: CUERPO_TESTIGO, ...pos(1),
      }],
      lineaError: LINEA_FALLA,
    }),
    // Dentro del cuerpo de un procedimiento, mezclada con su parámetro: la línea es la del cuerpo.
    fc.constantFrom(...COMANDOS_CON_EXPRESION).map((nombre): Caso => ({
      instrucciones: [{ tipo: 'invocacionProcedimiento', nombre: PROCEDIMIENTO, argumentos: [num(3)], ...pos(LINEA_FALLA + 2) }],
      definiciones: [{
        tipo: 'definicionProcedimiento',
        nombre: PROCEDIMIENTO,
        parametros: ['x'],
        cuerpo: [comando(nombre, binaria('SUMA', falla, parametro), LINEA_FALLA)],
        ...pos(LINEA_FALLA - 1),
      }],
      lineaError: LINEA_FALLA,
    })),
  );
}

// ---- Ejecución -------------------------------------------------------------

function correr(programa: Programa, semilla: number): { emitidas: Operacion[]; resultado: ResultadoEjecucion } {
  const gen = ejecutar(programa, { comandosPermitidos: PERMITIDOS, semilla, fabricaAzar });
  const emitidas: Operacion[] = [];
  let paso = gen.next();
  while (!paso.done) {
    emitidas.push(paso.value);
    paso = gen.next();
  }
  return { emitidas, resultado: paso.value };
}

// El sufijo sale del mundo 1 (sin PARA, para no chocar con los nombres del prefijo)
// y termina siempre con un AVANZA, así que siempre tiene algo que no debe emitirse.
const arbSufijo: fc.Arbitrary<readonly Instruccion[]> = arbPrograma(1).map((p) => [
  ...p.instrucciones,
  comando('AVANZA', num(40), 1),
]);

const arbSemilla = fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA });

describe('Property 5: un error aritmético detiene la ejecución y conserva lo emitido', () => {
  it('el nombre del procedimiento de prueba no pisa el lenguaje', () => {
    expect(buscarComando(PROCEDIMIENTO).hallada).toBe(false);
  });

  it('termina con el error de la falla más a la izquierda, su línea y solo las operaciones del prefijo', () => {
    // **Validates: Requirements 4.2, 4.4, 4.5, 25.8**
    fc.assert(
      fc.property(
        arbPrograma(4),
        arbFalla.chain((falla) => arbCaso(falla.expresion).map((caso) => ({ falla, caso }))),
        arbSufijo,
        arbSemilla,
        (prefijo, { falla, caso }, sufijo, semilla) => {
          const soloPrefijo = correr(prefijo, semilla);
          // El prefijo puede fallar por su cuenta (p. ej. `AZAR 2.5`): ese no es este caso.
          fc.pre(soloPrefijo.resultado.error === null && soloPrefijo.resultado.guardaActivada === null);

          const programa: Programa = {
            tipo: 'programa',
            instrucciones: [...prefijo.instrucciones, ...caso.instrucciones, ...sufijo, ...caso.definiciones],
          };
          const { emitidas, resultado } = correr(programa, semilla);

          expect(resultado.error?.id).toBe(falla.id);
          expect(resultado.error?.linea).toBe(caso.lineaError);
          expect(resultado.guardaActivada).toBeNull();
          expect(resultado.operaciones).toEqual(soloPrefijo.resultado.operaciones);
          expect(emitidas).toEqual(soloPrefijo.emitidas);
        },
      ),
      { numRuns: 300 },
    );
  });

  it.each<[string, Expresion, ErrorAritmetico]>([
    ['10 / 0', binaria('/', num(10), num(0)), 'divisionPorCero'],
    ['RESTO 7 -0', binaria('RESTO', num(7), { tipo: 'menosUnario', operando: num(0), ...pos(1) }), 'divisionPorCero'],
    ['PRODUCTO 1e200 1e200', binaria('PRODUCTO', num(1e200), num(1e200)), 'numeroFueraDeRango'],
    ['(1e308 * 10) + (1 / 0)', binaria('+', binaria('*', num(1e308), num(10)), binaria('/', num(1), num(0))), 'numeroFueraDeRango'],
    ['(1 / 0) + (1e308 * 10)', binaria('+', binaria('/', num(1), num(0)), binaria('*', num(1e308), num(10))), 'divisionPorCero'],
  ])('`AVANZA %s` tras un AVANZA 50 conserva solo ese tramo', (_texto, expresion, id) => {
    const programa: Programa = {
      tipo: 'programa',
      instrucciones: [comando('AVANZA', num(50), 1), comando('AVANZA', expresion, 2), comando('AVANZA', num(30), 3)],
    };
    const { emitidas, resultado } = correr(programa, 0);
    expect(resultado.error?.id).toBe(id);
    expect(resultado.error?.linea).toBe(2);
    expect(emitidas).toHaveLength(1);
    expect(resultado.operaciones).toEqual(emitidas);
  });
});
