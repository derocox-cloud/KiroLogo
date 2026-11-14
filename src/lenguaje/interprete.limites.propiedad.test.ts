// Property 15 (spec 05): los pasos y las escrituras tienen tope.
//
// Se generan programas con escrituras (`ESCRIBE`, `ROTULA`) y operaciones de tortuga
// intercaladas, sueltas o dentro de `REPITE`. Un modelo aplanado predice, operación por
// operación, cuál guarda corta primero: la de pasos se comprueba antes que la de
// escrituras, igual que en el intérprete. El tope de escrituras es el real (500); el de
// pasos se inyecta más chico para que cada corrida sea rápida, y una propiedad aparte lo
// prueba con el tope real de 200 000 en pocas corridas.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ejecutar, LIMITES_PREDETERMINADOS, type LimitesEjecucion, type ResultadoEjecucion } from './interprete.js';
import { comandosDelMundo } from './vocabulario.js';
import type { Expresion, Instruccion, Programa } from './ast.js';
import { arbNumeroLiteral } from '../pruebas/arbitrarios.js';

const PERMITIDOS_MUNDO_4 = comandosDelMundo(4);
const POSICION = { linea: 1, columna: 1 } as const;
const MAXIMO_ESCRITURAS = 500;
const MAXIMO_PASOS = LIMITES_PREDETERMINADOS.maximoPasos;

const numero = (valor: number): Expresion => ({ tipo: 'numeroLiteral', valor, ...POSICION });
const comando = (nombre: string, argumentos: readonly Expresion[]): Instruccion => ({
  tipo: 'invocacionComando', nombre, argumentos, ...POSICION,
});
const repite = (veces: Expresion, cuerpo: readonly Instruccion[]): Instruccion => ({
  tipo: 'repeticion', veces, cuerpo, ...POSICION,
});
const programa = (instrucciones: readonly Instruccion[]): Programa => ({ tipo: 'programa', instrucciones });

function correr(p: Programa, limites: LimitesEjecucion, ahora?: () => number): ResultadoEjecucion {
  const gen = ejecutar(p, { comandosPermitidos: PERMITIDOS_MUNDO_4, semilla: 0, limites, ...(ahora ? { ahora } : {}) });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

// ----------------------------------------------------------------------------
// Programas de escrituras y tortuga
// ----------------------------------------------------------------------------

type Clase = 'texto' | 'tortuga';

interface Hoja {
  readonly instruccion: Instruccion;
  readonly clase: Clase;
}

/** Bloque del programa con su secuencia aplanada de clases, que es lo que mira el modelo. */
interface Bloque {
  readonly instruccion: Instruccion;
  readonly clases: readonly Clase[];
}

const arbPalabra: fc.Arbitrary<Expresion> = fc
  .stringMatching(/^[a-zA-Z]{1,6}$/)
  .map((valor): Expresion => ({ tipo: 'palabraLiteral', valor, ...POSICION }));

const arbHoja: fc.Arbitrary<Hoja> = fc.oneof(
  fc.tuple(fc.constantFrom('ESCRIBE', 'ROTULA'), fc.oneof(arbPalabra, arbNumeroLiteral)).map(
    ([nombre, valor]): Hoja => ({ instruccion: comando(nombre, [valor]), clase: 'texto' }),
  ),
  fc.tuple(fc.constantFrom('AVANZA', 'RETROCEDE', 'GIRADERECHA', 'GIRAIZQUIERDA'), fc.integer({ min: 0, max: 5 })).map(
    ([nombre, valor]): Hoja => ({ instruccion: comando(nombre, [numero(valor)]), clase: 'tortuga' }),
  ),
  fc.constantFrom('SUBELAPIZ', 'BAJALAPIZ').map((nombre): Hoja => ({ instruccion: comando(nombre, []), clase: 'tortuga' })),
);

const arbBloque: fc.Arbitrary<Bloque> = fc.oneof(
  arbHoja.map((h): Bloque => ({ instruccion: h.instruccion, clases: [h.clase] })),
  fc.tuple(fc.integer({ min: 1, max: 300 }), fc.array(arbHoja, { minLength: 1, maxLength: 4 })).map(
    ([veces, cuerpo]): Bloque => ({
      instruccion: repite(numero(veces), cuerpo.map((h) => h.instruccion)),
      clases: Array.from({ length: veces }, () => cuerpo.map((h) => h.clase)).flat(),
    }),
  ),
);

interface Esperado {
  readonly emitidas: readonly Clase[];
  readonly guarda: 'pasos' | 'escrituras' | null;
}

/** Recorre la secuencia aplanada con los dos contadores, en el orden de guardas del intérprete. */
function modelo(clases: readonly Clase[], maximoPasos: number): Esperado {
  let escrituras = 0;
  for (let i = 0; i < clases.length; i++) {
    if (i >= maximoPasos) return { emitidas: clases.slice(0, i), guarda: 'pasos' };
    if (clases[i] === 'texto') {
      if (escrituras >= MAXIMO_ESCRITURAS) return { emitidas: clases.slice(0, i), guarda: 'escrituras' };
      escrituras += 1;
    }
  }
  return { emitidas: clases, guarda: null };
}

const ID_ERROR = { pasos: 'guardaPasos', escrituras: 'guardaEscrituras' } as const;

function comprobar(r: ResultadoEjecucion, esperado: Esperado): void {
  expect(r.guardaActivada).toBe(esperado.guarda);
  expect(r.error?.id ?? null).toBe(esperado.guarda === null ? null : ID_ERROR[esperado.guarda]);
  const clases = r.operaciones.map((o): Clase => (o.tipo === 'escribir' || o.tipo === 'rotular' ? 'texto' : 'tortuga'));
  expect(clases).toEqual(esperado.emitidas);
  // Cada operación, de texto o de tortuga, ocupa un paso: el contador avanza de uno en uno.
  r.operaciones.forEach((o, i) => expect(o.paso).toBe(i));
}

describe('Property 15: los pasos y las escrituras tienen tope', () => {
  it('cada escritura suma un paso; la 501 se corta con guardaEscrituras y el exceso de pasos con guardaPasos', () => {
    // **Validates: Requirements 9.9, 9.10**
    fc.assert(
      fc.property(
        fc.array(arbBloque, { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 3_000 }),
        (bloques, maximoPasos) => {
          const clases = bloques.flatMap((b) => b.clases);
          const r = correr(programa(bloques.map((b) => b.instruccion)), { ...LIMITES_PREDETERMINADOS, maximoPasos });
          comprobar(r, modelo(clases, maximoPasos));
        },
      ),
      { numRuns: 200 },
    );
  });

  it('con el tope real de 200 000 pasos, las escrituras cuentan como pasos', () => {
    // **Validates: Requirements 9.9**
    // Cada corrida emite cerca de 200 000 operaciones: pocas corridas bastan para el borde.
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAXIMO_ESCRITURAS }),
        fc.integer({ min: -3, max: 3 }),
        (e, desvio) => {
          const t = MAXIMO_PASOS - e + desvio;
          const p = programa([
            repite(numero(e), [comando('ESCRIBE', [numero(1)])]),
            repite(numero(t), [comando('GIRADERECHA', [numero(1)])]),
          ]);
          const clases: Clase[] = [...Array<Clase>(e).fill('texto'), ...Array<Clase>(t).fill('tortuga')];
          const r = correr(p, LIMITES_PREDETERMINADOS);
          const esperado = modelo(clases, MAXIMO_PASOS);
          expect(esperado.guarda).toBe(e + t > MAXIMO_PASOS ? 'pasos' : null);
          expect(r.guardaActivada).toBe(esperado.guarda);
          expect(r.operaciones).toHaveLength(esperado.emitidas.length);
          expect(r.operaciones.filter((o) => o.tipo === 'escribir')).toHaveLength(e);
        },
      ),
      { numRuns: 5 },
    );
  });

  // Cantidades que dan un producto entero finito, de hasta 10^12 vueltas.
  const arbFactores = fc.tuple(fc.integer({ min: 1, max: 1_000_000 }), fc.integer({ min: 1, max: 1_000_000 }));
  const producto = (a: number, b: number): Expresion => ({
    tipo: 'expresionAritmetica', operador: '*', izquierda: numero(a), derecha: numero(b), ...POSICION,
  });

  it('un REPITE vacío de cantidad calculada enorme termina con guardaPasos en ciclos acotados', () => {
    // **Validates: Requirements 9.9**
    fc.assert(
      fc.property(
        arbFactores,
        fc.integer({ min: 10, max: 5_000 }),
        fc.boolean(),
        ([a, b], maximoCiclos, anidado) => {
          fc.pre(a * b > maximoCiclos);
          const p = programa([anidado ? repite(numero(a), [repite(numero(b), [])]) : repite(producto(a, b), [])]);
          // Con una medición por ciclo, las llamadas a `ahora` cuentan los ciclos que corrió.
          let llamadas = 0;
          const r = correr(p, { ...LIMITES_PREDETERMINADOS, maximoCiclos, pasosEntreMediciones: 1 }, () => {
            llamadas += 1;
            return 0;
          });
          expect(r.guardaActivada).toBe('pasos');
          expect(r.error?.id).toBe('guardaPasos');
          expect(r.operaciones).toHaveLength(0);
          // La medición inicial más una por ciclo, hasta el que excede el tope.
          expect(llamadas).toBeLessThanOrEqual(maximoCiclos + 2);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('con el tope real de ciclos, el REPITE vacío enorme también se corta', () => {
    // **Validates: Requirements 9.9**
    fc.assert(
      fc.property(arbFactores, ([a, b]) => {
        fc.pre(a * b > 2_000_000);
        const r = correr(programa([repite(producto(a, b), [])]), LIMITES_PREDETERMINADOS);
        expect(r.guardaActivada).toBe('pasos');
        expect(r.error?.id).toBe('guardaPasos');
        expect(r.operaciones).toHaveLength(0);
      }),
      { numRuns: 3 },
    );
  });
});
