// Property 8: llamar a un procedimiento equivale a sustituir sus parámetros.
//
// El oráculo es un modelo de sustitución escrito aquí: recorre el programa en orden de
// ejecución, desenrolla cada REPITE (sus cantidades son literales) y reemplaza cada
// llamada por el cuerpo del procedimiento con sus parámetros ya convertidos en números.
// Para que el azar coincida, el modelo evalúa TODA expresión con `modeloEvaluar` en ese
// mismo orden y con su propia instancia de `fabricaAzar` sembrada igual. Lo que queda es
// una lista plana de comandos con argumentos literales, sin PARA, sin REPITE y sin AZAR:
// ejecutarla debe dar las mismas operaciones, en el mismo orden, que el programa original.
//
// Se ignoran `linea`, `profundidad` y `lineaLlamada`, que dependen de dónde se escribió la
// instrucción y no de qué dibuja.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ejecutar, type Operacion, type ResultadoEjecucion, type OpcionesEjecucion } from './interprete.js';
import { analizarLexico } from './lexer.js';
import { analizar } from './parser.js';
import { comandosDelMundo } from './vocabulario.js';
import type { IdError } from './errores.js';
import type {
  DefinicionProcedimiento,
  Expresion,
  Instruccion,
  InvocacionComando,
  NumeroLiteral,
  Programa,
} from './ast.js';
import { fabricaAzar } from '../azar/prng.js';
import { arbPrograma, arbExpresion, modeloEvaluar } from '../pruebas/arbitrarios.js';

const MUNDO = 4;
const POSICION = { linea: 1, columna: 1 } as const;
// Tope del modelo desenrollado: más allá, el caso se descarta para que la prueba sea rápida.
const MAXIMAS_INSTRUCCIONES_PLANAS = 5_000;

function opciones(semilla: number): OpcionesEjecucion {
  return { comandosPermitidos: comandosDelMundo(MUNDO), semilla, fabricaAzar };
}

function correr(programa: Programa, semilla: number): ResultadoEjecucion {
  const generador = ejecutar(programa, opciones(semilla));
  let paso = generador.next();
  while (paso.done !== true) paso = generador.next();
  return paso.value;
}

/** La operación sin los campos que dependen de dónde se escribió la instrucción. */
function geometria(op: Operacion): Record<string, unknown> {
  const { linea: _l, profundidad: _p, lineaLlamada: _ll, ...resto } = op;
  return resto;
}

const literal = (valor: number): NumeroLiteral => ({ tipo: 'numeroLiteral', valor, ...POSICION });

// ============================================================================
// Modelo de sustitución
// ============================================================================

class Desbordado extends Error {}

interface Expansion {
  readonly instrucciones: InvocacionComando[];
  /** Primer error de evaluación del modelo; corta la expansión en ese punto. */
  readonly error: IdError | null;
}

function expandir(programa: Programa, semilla: number): Expansion {
  const definiciones = new Map<string, DefinicionProcedimiento>();
  for (const i of programa.instrucciones) if (i.tipo === 'definicionProcedimiento') definiciones.set(i.nombre, i);

  const azar = fabricaAzar(semilla);
  const salida: InvocacionComando[] = [];

  /** Evalúa en el marco dado; si falla, lanza el id para cortar toda la expansión. */
  const valor = (e: Expresion, marco: ReadonlyMap<string, number>): number => {
    const r = modeloEvaluar(e, marco, azar);
    if (!r.exito) throw r.id;
    return r.valor;
  };

  const recorrer = (instrucciones: readonly Instruccion[], marco: ReadonlyMap<string, number>): void => {
    for (const i of instrucciones) {
      switch (i.tipo) {
        case 'definicionProcedimiento':
          break;
        case 'repeticion': {
          const veces = valor(i.veces, marco);
          for (let k = 0; k < veces; k++) recorrer(i.cuerpo, marco);
          break;
        }
        case 'invocacionProcedimiento': {
          const definicion = definiciones.get(i.nombre)!;
          // Cada llamada recibe una copia nueva: el marco de quien llama no se toca.
          const propio = new Map<string, number>();
          definicion.parametros.forEach((p, k) => propio.set(p, valor(i.argumentos[k]!, marco)));
          recorrer(definicion.cuerpo, propio);
          break;
        }
        case 'invocacionComando': {
          const argumentos = i.argumentos.map((a) => (a.tipo === 'palabraLiteral' ? a : literal(valor(a, marco))));
          salida.push({ ...i, argumentos });
          if (salida.length > MAXIMAS_INSTRUCCIONES_PLANAS) throw new Desbordado();
          break;
        }
        default:
          throw new Error(`nodo inesperado en el generador: ${i.tipo}`);
      }
    }
  };

  try {
    recorrer(programa.instrucciones, new Map());
    return { instrucciones: salida, error: null };
  } catch (e) {
    if (e instanceof Error) throw e;
    return { instrucciones: salida, error: e as IdError };
  }
}

/** Compara el programa con su sustitución. Devuelve false si el caso se descarta. */
function comprobarSustitucion(programa: Programa, semilla: number): boolean {
  let expansion: Expansion;
  try {
    expansion = expandir(programa, semilla);
  } catch (e) {
    if (e instanceof Desbordado) return false;
    throw e;
  }

  const original = correr(programa, semilla);
  const plano = correr({ tipo: 'programa', instrucciones: expansion.instrucciones }, semilla);

  expect(original.operaciones.map(geometria)).toEqual(plano.operaciones.map(geometria));
  if (plano.error !== null || plano.guardaActivada !== null) {
    // Un comando del modelo falló antes del primer error de evaluación: el original
    // tiene que fallar en el mismo comando.
    expect(original.guardaActivada).toBe(plano.guardaActivada);
    expect(original.error?.id).toBe(plano.error?.id);
  } else {
    expect(original.guardaActivada).toBeNull();
    expect(original.error?.id ?? null).toBe(expansion.error);
  }
  return true;
}

const arbSemilla = fc.integer({ min: 0, max: 0xffff_ffff });

// ============================================================================
// Pruebas
// ============================================================================

describe('Property 8: llamar a un procedimiento equivale a sustituir sus parámetros', () => {
  it('las operaciones de cualquier programa del mundo 4 coinciden con las de su sustitución', () => {
    // **Validates: Requirements 1.3, 2.1, 2.5, 2.6, 4.3, 7.1, 7.2, 7.4**
    fc.assert(
      fc.property(arbPrograma(MUNDO), arbSemilla, (programa, semilla) => {
        fc.pre(comprobarSustitucion(programa, semilla));
      }),
      { numRuns: 300 },
    );
  });

  it('un procedimiento llamado desde otro con el mismo nombre de parámetro no altera el valor de quien llama', () => {
    // **Validates: Requirements 2.5, 2.6, 7.1, 7.2**
    // DENTRO(:x) recibe una expresión de :x de FUERA; FUERA vuelve a usar su :x después.
    const arbCaso = fc.record({
      argumentoInterior: arbExpresion(2, { parametros: ['x'], divisoresSeguros: true, incluirAzar: true }),
      argumentoExterior: arbExpresion(2, { divisoresSeguros: true, incluirAzar: true }),
      semilla: arbSemilla,
    });
    fc.assert(
      fc.property(arbCaso, ({ argumentoInterior, argumentoExterior, semilla }) => {
        const x = { tipo: 'referenciaParametro', nombre: 'x', ...POSICION } as const;
        const comando = (nombre: string, a: Expresion): Instruccion =>
          ({ tipo: 'invocacionComando', nombre, argumentos: [a], ...POSICION });
        const llamada = (nombre: string, a: Expresion): Instruccion =>
          ({ tipo: 'invocacionProcedimiento', nombre, argumentos: [a], ...POSICION });
        const definicion = (nombre: string, cuerpo: Instruccion[]): Instruccion =>
          ({ tipo: 'definicionProcedimiento', nombre, parametros: ['x'], cuerpo, ...POSICION });

        const programa: Programa = {
          tipo: 'programa',
          instrucciones: [
            definicion('DENTRO', [comando('AVANZA', x), comando('ESCRIBE', x)]),
            definicion('FUERA', [comando('ESCRIBE', x), llamada('DENTRO', argumentoInterior), comando('ESCRIBE', x)]),
            llamada('FUERA', argumentoExterior),
          ],
        };
        expect(comprobarSustitucion(programa, semilla)).toBe(true);

        // Si todo se evaluó, FUERA escribe dos veces el mismo valor alrededor de la llamada.
        const resultado = correr(programa, semilla);
        if (resultado.error === null) {
          const escritos = resultado.operaciones.flatMap((op) => (op.tipo === 'escribir' ? [op.texto] : []));
          expect(escritos).toHaveLength(3);
          expect(escritos[2]).toBe(escritos[0]);
        }
      }),
      { numRuns: 300 },
    );
  });

  it('si un argumento falla, la llamada no emite ninguna operación y el error es el del primero que falla', () => {
    // **Validates: Requirements 7.4**
    const PROGRAMA = (args: string): string =>
      ['PARA FIG :a :b', '  AVANZA :a', '  GIRADERECHA :b', 'FIN', 'AVANZA 20', `FIG ${args}`].join('\n');
    const FALLAS: ReadonlyArray<readonly [string, IdError]> = [
      ['(10 / 0)', 'divisionPorCero'],
      ['(AZAR 0)', 'azarRangoInvalido'],
      ['(RESTO 7 0)', 'divisionPorCero'],
    ];
    const arbCaso = fc.record({
      primera: fc.option(fc.constantFrom(...FALLAS), { nil: null }),
      segunda: fc.option(fc.constantFrom(...FALLAS), { nil: null }),
      semilla: arbSemilla,
    });
    fc.assert(
      fc.property(arbCaso, ({ primera, segunda, semilla }) => {
        const texto = PROGRAMA(`${primera?.[0] ?? '30'} ${segunda?.[0] ?? '90'}`);
        const { tokens, errores: lexicos } = analizarLexico(texto);
        expect(lexicos).toEqual([]);
        const { programa, errores } = analizar(tokens, { mundo: MUNDO });
        expect(errores).toEqual([]);
        const resultado = correr(programa!, semilla);

        const esperado = primera?.[1] ?? segunda?.[1] ?? null;
        expect(resultado.error?.id ?? null).toBe(esperado);
        expect(resultado.operaciones.map((op) => op.tipo)).toEqual(
          esperado === null ? ['mover', 'mover', 'girar'] : ['mover'],
        );
      }),
      { numRuns: 100 },
    );
  });

  it('POLIGONO n L emite n avances de L con giros de 360 / n', () => {
    // **Validates: Requirements 1.3, 4.3, 7.1**
    const arbCaso = fc.record({
      lados: fc.constantFrom(3, 5, 6, 8),
      largo: fc.integer({ min: 1, max: 15 }).map((k) => k * 20),
    });
    fc.assert(
      fc.property(arbCaso, ({ lados, largo }) => {
        const texto = [
          'PARA POLIGONO :n :largo',
          '  REPITE :n [AVANZA :largo GIRADERECHA 360 / :n]',
          'FIN',
          `POLIGONO ${lados} ${largo}`,
        ].join('\n');
        const { tokens, errores: lexicos } = analizarLexico(texto);
        expect(lexicos).toEqual([]);
        const { programa, errores } = analizar(tokens, { mundo: MUNDO });
        expect(errores).toEqual([]);
        const resultado = correr(programa!, 1);

        expect(resultado.error).toBeNull();
        expect(resultado.operaciones).toHaveLength(2 * lados);
        resultado.operaciones.forEach((op, i) => {
          if (i % 2 === 0) {
            expect(op.tipo).toBe('mover');
            if (op.tipo !== 'mover') return;
            expect(Math.hypot(op.hasta.x - op.desde.x, op.hasta.y - op.desde.y)).toBeCloseTo(largo, 9);
          } else {
            expect(op.tipo).toBe('girar');
            if (op.tipo !== 'girar') return;
            expect(op.grados).toBeCloseTo(360 / lados, 12);
            expect(op.sentido).toBe('derecha');
          }
        });
        // Una vuelta completa: la tortuga vuelve a donde empezó.
        const ultima = resultado.operaciones.at(-1)!;
        const primera = resultado.operaciones[0]!;
        expect(ultima.estadoDespues.posicion.x).toBeCloseTo(primera.estadoAntes.posicion.x, 6);
        expect(ultima.estadoDespues.posicion.y).toBeCloseTo(primera.estadoAntes.posicion.y, 6);
      }),
      { numRuns: 100 },
    );
  });
});
