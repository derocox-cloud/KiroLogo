// Property 17: usaParametros y maximoProcedimientos (spec 05, D19).
//
// Cada programa se arma desde una plantilla cuya verdad se conoce de antemano: por cada
// `PARA` se elige si declara parámetros, si usa uno propio (y a qué profundidad de
// expresión), si referencia el parámetro de otro `PARA`, si se invoca desde fuera de su
// cuerpo (programa principal, dentro de un `REPITE` o desde otro `PARA`) y si se llama a
// sí mismo. El oráculo se calcula sobre la plantilla, nunca sobre el AST, así que la
// prueba no repite la lógica de `abstraccion.ts`.
//
// **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.7**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analizar, contarProcedimientos } from './abstraccion.js';
import type {
  DefinicionProcedimiento,
  Expresion,
  Instruccion,
  InvocacionComando,
  InvocacionProcedimiento,
  NumeroLiteral,
  Programa,
} from '../lenguaje/ast.js';
import type { ExigenciaAbstraccion } from '../niveles/tipos.js';
import { arbExpresion, arbNumeroLiteral, arbPrograma } from '../pruebas/arbitrarios.js';

const P = { linea: 1, columna: 1 } as const;
const num = (valor: number): NumeroLiteral => ({ tipo: 'numeroLiteral', valor, ...P });

// Nombres de procedimiento y parámetro fijos por índice: únicos entre sí, de modo que el
// parámetro de un `PARA` nunca coincide por casualidad con el de otro.
const NOMBRES = ['ALFA', 'BETA', 'GAMA', 'DELTA'] as const;
const parametroDe = (i: number, j: number): string => `p${'abcd'[i]!}${'xyz'[j]!}`;

type DondeInvoca = 'principal' | 'repite' | 'otroPara';

interface PlantillaPara {
  readonly numParametros: number; // 0 a 3
  readonly usaPropio: boolean;
  readonly profundidad: number; // capas de expresión alrededor de la referencia
  readonly usaAjeno: boolean; // referencia el parámetro de otro PARA (no cuenta)
  readonly invocaciones: readonly DondeInvoca[];
  readonly seLlamaASiMismo: boolean;
}

const arbPlantillaPara: fc.Arbitrary<PlantillaPara> = fc.record({
  numParametros: fc.integer({ min: 0, max: 3 }),
  usaPropio: fc.boolean(),
  profundidad: fc.integer({ min: 0, max: 4 }),
  usaAjeno: fc.boolean(),
  invocaciones: fc.array(fc.constantFrom<DondeInvoca>('principal', 'repite', 'otroPara'), { maxLength: 3 }),
  seLlamaASiMismo: fc.boolean(),
});

/** Envuelve una expresión en `capas` niveles de menos unario, infija o comando de operador. */
function arbEnvolver(nucleo: Expresion, capas: number): fc.Arbitrary<Expresion> {
  if (capas === 0) return fc.constant(nucleo);
  return arbEnvolver(nucleo, capas - 1).chain((interior) =>
    fc.oneof(
      fc.constant<Expresion>({ tipo: 'menosUnario', operando: interior, ...P }),
      fc.tuple(fc.constantFrom<'+' | '-' | '*' | '/'>('+', '-', '*', '/'), arbNumeroLiteral, fc.boolean()).map(
        ([operador, otro, aLaIzquierda]): Expresion => ({
          tipo: 'expresionAritmetica',
          operador,
          izquierda: aLaIzquierda ? interior : otro,
          derecha: aLaIzquierda ? otro : interior,
          ...P,
        }),
      ),
      fc.tuple(fc.constantFrom('SUMA', 'RESTA', 'PRODUCTO'), arbNumeroLiteral, fc.boolean()).map(
        ([nombre, otro, primero]): Expresion => ({
          tipo: 'comandoOperador',
          nombre,
          argumentos: primero ? [interior, otro] : [otro, interior],
          ...P,
        }),
      ),
    ),
  );
}

/** Coloca una expresión como argumento de un avance, de un `REPITE` o de un `ESCRIBE`. */
function arbInstruccionCon(expresion: Expresion): fc.Arbitrary<Instruccion> {
  return fc.oneof(
    fc.constant<Instruccion>({ tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [expresion], ...P }),
    fc.constant<Instruccion>({ tipo: 'invocacionComando', nombre: 'ESCRIBE', argumentos: [expresion], ...P }),
    fc.constant<Instruccion>({ tipo: 'repeticion', veces: expresion, cuerpo: [], ...P }),
  );
}

// Instrucciones sin ningún parámetro: expresiones de solo literales, palabras y relleno
// del mundo 1 (sin PARA, sin parámetros).
const arbRelleno: fc.Arbitrary<readonly Instruccion[]> = fc.oneof(
  arbPrograma(1).map((p) => p.instrucciones),
  arbExpresion(2, { divisoresSeguros: true }).chain(arbInstruccionCon).map((i) => [i]),
  fc.constant<readonly Instruccion[]>([{
    tipo: 'invocacionComando',
    nombre: 'ESCRIBE',
    argumentos: [{ tipo: 'palabraLiteral', valor: 'hola', ...P }],
    ...P,
  } satisfies InvocacionComando]),
);

function llamada(i: number, plantillas: readonly PlantillaPara[]): InvocacionProcedimiento {
  return {
    tipo: 'invocacionProcedimiento',
    nombre: NOMBRES[i]!,
    argumentos: Array.from({ length: plantillas[i]!.numParametros }, () => num(10)),
    ...P,
  };
}

interface Caso {
  readonly programa: Programa;
  readonly plantillas: readonly PlantillaPara[];
  /** Por cada PARA, si alguna invocación quedó fuera de su propio cuerpo. */
  readonly invocadoFuera: readonly boolean[];
}

const arbCaso: fc.Arbitrary<Caso> = fc
  .array(arbPlantillaPara, { maxLength: NOMBRES.length })
  .chain((plantillas) => {
    const n = plantillas.length;
    // Para cada invocación desde «otro PARA» se elige cuál, distinto del invocado. Con un
    // solo PARA no hay otro: esa invocación se descarta.
    const anfitriones = plantillas.map((pl, i) =>
      fc.tuple(...pl.invocaciones.map((donde) =>
        donde === 'otroPara' && n > 1
          ? fc.integer({ min: 0, max: n - 2 }).map((k) => (k >= i ? k + 1 : k))
          : fc.constant(-1),
      )),
    );
    const cuerposBase = plantillas.map((pl, i) => {
      const propios: fc.Arbitrary<readonly Instruccion[]> =
        pl.numParametros > 0 && pl.usaPropio
          ? fc.integer({ min: 0, max: pl.numParametros - 1 }).chain((j) =>
              arbEnvolver({ tipo: 'referenciaParametro', nombre: parametroDe(i, j), ...P }, pl.profundidad)
                .chain(arbInstruccionCon)
                // A veces la referencia queda dentro de un REPITE del cuerpo.
                .chain((ins) => fc.constantFrom<readonly Instruccion[]>([ins], [{ tipo: 'repeticion', veces: num(2), cuerpo: [ins], ...P }])),
            )
          : fc.constant([]);
      const otros = plantillas
        .map((o, k) => ({ o, k }))
        .filter(({ o, k }) => k !== i && o.numParametros > 0);
      const ajeno: fc.Arbitrary<readonly Instruccion[]> =
        pl.usaAjeno && otros.length > 0
          ? fc.constantFrom(...otros).chain(({ k }) =>
              arbInstruccionCon({ tipo: 'referenciaParametro', nombre: parametroDe(k, 0), ...P }).map((x) => [x]),
            )
          : fc.constant([]);
      return fc.tuple(propios, ajeno, arbRelleno);
    });
    return fc.tuple(
      fc.constant(plantillas),
      fc.tuple(...anfitriones),
      fc.tuple(...cuerposBase),
      arbRelleno,
      fc.nat(),
    );
  })
  .map(([plantillas, anfitriones, cuerposBase, relleno, giro]) => {
    const n = plantillas.length;
    const cuerpos: Instruccion[][] = cuerposBase.map(([propios, ajeno, r], i) => {
      const cuerpo = [...r, ...propios, ...ajeno];
      if (plantillas[i]!.seLlamaASiMismo) cuerpo.push(llamada(i, plantillas));
      return cuerpo;
    });
    const principal: Instruccion[] = [...relleno];
    const invocadoFuera = plantillas.map(() => false);
    plantillas.forEach((pl, i) => {
      pl.invocaciones.forEach((donde, m) => {
        if (donde === 'principal') principal.push(llamada(i, plantillas));
        else if (donde === 'repite') principal.push({ tipo: 'repeticion', veces: num(2), cuerpo: [llamada(i, plantillas)], ...P });
        else {
          const anfitrion = anfitriones[i]![m]!;
          if (anfitrion < 0) return;
          cuerpos[anfitrion]!.push(llamada(i, plantillas));
        }
        invocadoFuera[i] = true;
      });
    });
    const definiciones: DefinicionProcedimiento[] = plantillas.map((pl, i) => ({
      tipo: 'definicionProcedimiento',
      nombre: NOMBRES[i]!,
      parametros: Array.from({ length: pl.numParametros }, (_, j) => parametroDe(i, j)),
      cuerpo: cuerpos[i]!,
      ...P,
    }));
    // Las definiciones van antes o después del programa principal, rotadas.
    const todas: Instruccion[] = [...definiciones, ...principal];
    const corte = n === 0 ? 0 : giro % (todas.length + 1);
    const instrucciones = [...todas.slice(corte), ...todas.slice(0, corte)];
    return { programa: { tipo: 'programa', instrucciones }, plantillas, invocadoFuera };
  });

function esperadoUsaParametros(caso: Caso): boolean {
  return caso.plantillas.some((pl, i) => pl.numParametros > 0 && pl.usaPropio && caso.invocadoFuera[i]!);
}

const confirma = (programa: Programa, exigencia: ExigenciaAbstraccion): boolean =>
  analizar(programa, [exigencia]).confirmadas.includes(exigencia.clave);

describe('Property 17: usaParametros y maximoProcedimientos', () => {
  it('usaParametros se confirma si y solo si un PARA declara, usa un parámetro propio y se invoca fuera de su cuerpo', () => {
    fc.assert(
      fc.property(arbCaso, (caso) => {
        expect(confirma(caso.programa, { clave: 'usaParametros' })).toBe(esperadoUsaParametros(caso));
      }),
      { numRuns: 300 },
    );
  });

  it('maximoProcedimientos cuenta todas las definiciones y es una cota superior', () => {
    fc.assert(
      fc.property(arbCaso, fc.integer({ min: 0, max: 5 }), (caso, maximo) => {
        const definidas = caso.plantillas.length;
        expect(contarProcedimientos(caso.programa)).toBe(definidas);
        expect(confirma(caso.programa, { clave: 'maximoProcedimientos', maximo })).toBe(definidas <= maximo);
      }),
      { numRuns: 300 },
    );
  });

  it('cada exigencia se evalúa por separado, en el orden del nivel', () => {
    fc.assert(
      fc.property(arbCaso, fc.integer({ min: 0, max: 5 }), fc.boolean(), (caso, maximo, invertir) => {
        const usa: ExigenciaAbstraccion = { clave: 'usaParametros' };
        const max: ExigenciaAbstraccion = { clave: 'maximoProcedimientos', maximo };
        const exigencias = invertir ? [max, usa] : [usa, max];
        const r = analizar(caso.programa, exigencias);
        const esperadas = new Map<string, boolean>([
          ['usaParametros', esperadoUsaParametros(caso)],
          ['maximoProcedimientos', caso.plantillas.length <= maximo],
        ]);
        expect(r.confirmadas).toEqual(exigencias.filter((e) => esperadas.get(e.clave)).map((e) => e.clave));
        expect(r.sinConfirmar).toEqual(exigencias.filter((e) => !esperadas.get(e.clave)).map((e) => e.clave));
      }),
      { numRuns: 300 },
    );
  });

  it('un programa sin PARA confirma maximoProcedimientos y no usaParametros', () => {
    fc.assert(
      fc.property(arbRelleno, fc.integer({ min: 0, max: 5 }), (instrucciones, maximo) => {
        const programa: Programa = { tipo: 'programa', instrucciones };
        const r = analizar(programa, [{ clave: 'usaParametros' }, { clave: 'maximoProcedimientos', maximo }]);
        expect(r.confirmadas).toEqual(['maximoProcedimientos']);
        expect(r.sinConfirmar).toEqual(['usaParametros']);
      }),
      { numRuns: 200 },
    );
  });
});
