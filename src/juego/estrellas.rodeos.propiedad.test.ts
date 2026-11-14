// Property 23: Los rodeos corren, aprueban la precisión y no ganan lo demás.
//
// Un rodeo es un programa que dibuja la figura de Kiro sin la herramienta que el
// nivel enseña. Se construye a partir de la referencia de cada semilla, pasa por
// la misma puerta del límite duro que `main.ts` (conteo > limiteDuro no se
// ejecuta), corre con el intérprete real, se valida contra el reto y se califica
// con `calificar`. Lo que se fija es qué estrellas gana cada rodeo:
//
//  - 4.2, tres PARA sin parámetros (conteo 12 = límite): solo precisión, y la
//    explicación nombra `usaParametros` y `maximoProcedimientos`;
//  - 4.2, tres REPITE sin PARA (conteo 9): solo precisión;
//  - 4.3, un REPITE a mano por polígono: solo precisión si cabe en el límite,
//    y si no cabe, la puerta lo detiene antes de ejecutar;
//  - 4.4, `REPITE p [AVANZA L GIRADERECHA 720 / p]`: precisión y economía, sin
//    abstracción.
//
// Las primeras 200 semillas de cada nivel, más semillas al azar con fast-check.
//
// **Validates: Requirements 17.5, 17.6, 17.8, 18.6, 19.6**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Expresion, InvocacionProcedimiento, Programa } from '../lenguaje/ast.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { validar } from '../motor/validador.js';
import { TIMEOUT_TRES_ESTRELLAS } from '../pruebas/tiempos.js';
import { resolverReto, type Reto } from './reto.js';
import { calificar, type Calificacion, type EstadoEstrella } from './estrellas.js';

const SEMILLAS_FIJAS = 200;
const CORRIDAS_AZAR = 30;
// Lejos del máximo para que la semilla más los descartes del generador no envuelva.
const SEMILLA_AZAR_MAXIMA = 4_294_967_295 - 10_000;

// ============================================================================
// Ayudas
// ============================================================================

function retoDe(idNivel: string, semilla: number): Reto {
  const r = resolverReto(idNivel, semilla);
  if (!r.exito) throw new Error(`no se pudo resolver ${idNivel} con semilla ${semilla}: ${r.error.id}`);
  return r.reto;
}

function parsear(texto: string): Programa {
  const lexico = analizarLexico(texto);
  expect(lexico.errores, texto).toEqual([]);
  const { programa, errores } = analizar(lexico.tokens, { mundo: 4 });
  expect(errores, texto).toEqual([]);
  expect(programa).not.toBeNull();
  return programa!;
}

function conteoDe(programa: Programa): number {
  const c = contarInstrucciones(programa);
  expect(c.exito).toBe(true);
  return c.exito ? c.instrucciones : Number.NaN;
}

function literal(e: Expresion | undefined): number {
  if (e === undefined || e.tipo !== 'numeroLiteral') throw new Error('se esperaba un literal numérico');
  return e.valor;
}

/** Los argumentos literales de cada llamada de la referencia, en orden. */
function llamadasDe(reto: Reto): { a: number; b: number }[] {
  return reto.referencia.instrucciones
    .filter((i): i is InvocacionProcedimiento => i.tipo === 'invocacionProcedimiento')
    .map((l) => ({ a: literal(l.argumentos[0]), b: literal(l.argumentos[1]) }));
}

/** Una repetición a mano del polígono de `lados` y `largo`, con el giro como expresión. */
function repeticion(lados: number, largo: number): string {
  return `REPITE ${lados} [AVANZA ${largo} GIRADERECHA 360 / ${lados}]`;
}

type Intento =
  | { readonly ejecutado: false; readonly conteo: number }
  | { readonly ejecutado: true; readonly conteo: number; readonly calificacion: Calificacion };

/**
 * Juega el texto en el reto como lo hace `main.ts`: si el límite duro está
 * activo y el conteo lo excede, no se ejecuta; si no, intérprete real,
 * extractor, validador y calificación.
 */
function jugar(reto: Reto, texto: string): Intento {
  const programa = parsear(texto);
  const conteo = conteoDe(programa);
  if (reto.limiteDuroActivo && conteo > reto.limiteDuro) return { ejecutado: false, conteo };

  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(4),
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  expect(paso.value.error, texto).toBeNull();
  expect(paso.value.guardaActivada, texto).toBeNull();
  const segmentos = extraerSegmentos(paso.value.operaciones);
  const veredicto = validar(segmentos, reto.segmentos, reto.nivel.normalizacion);
  return { ejecutado: true, conteo, calificacion: calificar(programa, veredicto, reto) };
}

function ejecutado(intento: Intento, contexto: string): Calificacion {
  expect(intento.ejecutado, `${contexto}: el límite duro no debió bloquearlo`).toBe(true);
  if (!intento.ejecutado) throw new Error(contexto);
  return intento.calificacion;
}

function clavesNegadas(estrella: EstadoEstrella): readonly string[] {
  if (estrella.otorgada || estrella.motivo.clave !== 'exigenciasSinConfirmar') return [];
  return estrella.motivo.claves;
}

// ============================================================================
// Comprobaciones por nivel
// ============================================================================

const NOMBRES_RODEO = ['FIGURAUNO', 'FIGURADOS', 'FIGURATRES'] as const;

function comprobar42(semilla: number): void {
  const reto = retoDe('4.2', semilla);
  const llamadas = llamadasDe(reto);
  expect(llamadas).toHaveLength(3);
  const ctx = `4.2 semilla ${semilla}`;

  // Rodeo de tres procedimientos: uno por polígono, sin parámetros (R17.5, R17.8).
  const rodeo = [
    ...llamadas.map(({ a, b }, k) => `PARA ${NOMBRES_RODEO[k]}\n  ${repeticion(a, b)}\nFIN`),
    ...NOMBRES_RODEO,
  ].join('\n');
  const intentoRodeo = jugar(reto, rodeo);
  expect(intentoRodeo.conteo, ctx).toBe(12);
  expect(intentoRodeo.conteo, ctx).toBeLessThanOrEqual(reto.limiteDuro);
  const calRodeo = ejecutado(intentoRodeo, `${ctx} rodeo`);
  expect(calRodeo.precision.otorgada, `${ctx} rodeo`).toBe(true);
  expect(calRodeo.economia.otorgada, `${ctx} rodeo`).toBe(false);
  expect(calRodeo.abstraccion.otorgada, `${ctx} rodeo`).toBe(false);
  const claves = clavesNegadas(calRodeo.abstraccion);
  expect(claves).toContain('usaParametros');
  expect(claves).toContain('maximoProcedimientos');
  expect(calRodeo.mensajeAbstraccion?.split('\n')).toHaveLength(2);

  // Tres REPITE sin PARA (R17.6): cumple el máximo de procedimientos (0 ≤ 1),
  // así que la abstracción se niega solo por no usar parámetros.
  const repites = llamadas.map(({ a, b }) => repeticion(a, b)).join('\n');
  const intentoRepites = jugar(reto, repites);
  expect(intentoRepites.conteo, ctx).toBe(9);
  const calRepites = ejecutado(intentoRepites, `${ctx} tres REPITE`);
  expect(calRepites.precision.otorgada, `${ctx} tres REPITE`).toBe(true);
  expect(calRepites.economia.otorgada, `${ctx} tres REPITE`).toBe(false);
  expect(calRepites.abstraccion.otorgada, `${ctx} tres REPITE`).toBe(false);
  expect(clavesNegadas(calRepites.abstraccion)).toEqual(['usaParametros']);
}

/** Devuelve si el rodeo cupo en el límite, para asegurar que el caso se ejercita. */
function comprobar43(semilla: number): boolean {
  const reto = retoDe('4.3', semilla);
  const llamadas = llamadasDe(reto);
  const ctx = `4.3 semilla ${semilla}`;
  const texto = llamadas.map(({ a, b }) => repeticion(a, b)).join('\n');
  const intento = jugar(reto, texto);
  expect(intento.conteo, ctx).toBe(3 * llamadas.length);

  if (intento.conteo > reto.limiteDuro) {
    // R18.7: fuera del límite, la puerta lo detiene antes de ejecutar.
    expect(intento.ejecutado, ctx).toBe(false);
    return false;
  }
  const cal = ejecutado(intento, ctx);
  expect(cal.precision.otorgada, ctx).toBe(true);
  expect(cal.economia.otorgada, ctx).toBe(false);
  expect(cal.abstraccion.otorgada, ctx).toBe(false);
  expect(clavesNegadas(cal.abstraccion)).toEqual(['usaParametros']);
  return true;
}

function comprobar44(semilla: number): void {
  const reto = retoDe('4.4', semilla);
  const llamadas = llamadasDe(reto);
  expect(llamadas).toHaveLength(1);
  const { a: puntas, b: largo } = llamadas[0]!;
  const ctx = `4.4 semilla ${semilla}`;
  const intento = jugar(reto, `REPITE ${puntas} [AVANZA ${largo} GIRADERECHA 720 / ${puntas}]`);
  const cal = ejecutado(intento, ctx);
  expect(cal.precision.otorgada, ctx).toBe(true);
  expect(cal.economia.otorgada, ctx).toBe(true);
  expect(cal.abstraccion.otorgada, ctx).toBe(false);
  expect(clavesNegadas(cal.abstraccion)).toEqual(['usaParametros']);
}

const semillaAzar = fc.integer({ min: 0, max: SEMILLA_AZAR_MAXIMA });

// ============================================================================
// Propiedad
// ============================================================================

describe('Property 23 · los rodeos corren, aprueban la precisión y no ganan lo demás', () => {
  it(`4.2: los dos rodeos en las primeras ${SEMILLAS_FIJAS} semillas`, () => {
    for (let s = 0; s < SEMILLAS_FIJAS; s++) comprobar42(s);
  }, TIMEOUT_TRES_ESTRELLAS);

  it('4.2: también con semillas al azar', () => {
    fc.assert(fc.property(semillaAzar, (s) => comprobar42(s)), { seed: 23, numRuns: CORRIDAS_AZAR });
  }, TIMEOUT_TRES_ESTRELLAS);

  it(`4.3: la repetición a mano en las primeras ${SEMILLAS_FIJAS} semillas`, () => {
    let cupieron = 0;
    for (let s = 0; s < SEMILLAS_FIJAS; s++) if (comprobar43(s)) cupieron++;
    // Con tres copias el rodeo cuenta 9 y el límite es 9: el caso que se ejecuta existe.
    expect(cupieron).toBeGreaterThan(0);
  }, TIMEOUT_TRES_ESTRELLAS);

  it('4.3: también con semillas al azar', () => {
    fc.assert(fc.property(semillaAzar, (s) => void comprobar43(s)), { seed: 231, numRuns: CORRIDAS_AZAR });
  }, TIMEOUT_TRES_ESTRELLAS);

  it(`4.4: la estrella sin PARA en las primeras ${SEMILLAS_FIJAS} semillas`, () => {
    for (let s = 0; s < SEMILLAS_FIJAS; s++) comprobar44(s);
  }, TIMEOUT_TRES_ESTRELLAS);

  it('4.4: también con semillas al azar', () => {
    fc.assert(fc.property(semillaAzar, (s) => comprobar44(s)), { seed: 232, numRuns: CORRIDAS_AZAR });
  }, TIMEOUT_TRES_ESTRELLAS);
});
