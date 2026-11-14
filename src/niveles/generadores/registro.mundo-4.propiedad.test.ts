// Property 20: Los generadores del mundo 4 producen retos con la forma pedida.
//
// Recorre los tres generadores del mundo 4 tal como los resuelve `registro.ts`
// (`tres-poligonos-m4`, `poligonos-encajados-m4`, `estrella-parametrica-m4`):
// las primeras 200 semillas de cada uno, más 200 semillas al azar del dominio con
// fast-check. La caja que mide el generador se compara con la de los segmentos
// de la ejecución real (intérprete + extractor), con tolerancia 1e-6.
//
// **Validates: Requirements 17.2, 18.2, 18.3, 18.4, 19.2, 19.3, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type {
  DefinicionProcedimiento,
  Expresion,
  Instruccion,
  InvocacionProcedimiento,
  Programa,
} from '../../lenguaje/ast.js';
import { ejecutar } from '../../lenguaje/interprete.js';
import { buscarComando, comandosDelMundo } from '../../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../../motor/tortuga.js';
import { extraerSegmentos } from '../../motor/segmentos.js';
import { calcularEncuadre } from '../../motor/encuadre.js';
import type { Generador } from '../tipos.js';
import { cajaDeReferencia, DIMENSION_MINIMA, LIMITE_LIENZO } from './comun.js';
import { buscarGenerador } from './registro.js';

const SEMILLAS_FIJAS = 200;
const INTENTOS = 200;
const TOLERANCIA = 1e-6;
// Las semillas al azar quedan lejos del máximo para que «semilla + descartes» no envuelva.
const SEMILLA_AZAR_MAXIMA = 4_294_967_295 - 10_000;

type IdM4 = 'tres-poligonos-m4' | 'poligonos-encajados-m4' | 'estrella-parametrica-m4';
const IDS: readonly IdM4[] = ['tres-poligonos-m4', 'poligonos-encajados-m4', 'estrella-parametrica-m4'];

function generador(id: IdM4): Generador {
  const g = buscarGenerador(id);
  if (g === null) throw new Error(`generador no registrado: ${id}`);
  return g;
}

// ============================================================================
// Forma de expresiones y cuerpos, sin posiciones
// ============================================================================

/** Texto canónico de una expresión, con paréntesis explícitos; falla ante nodos no esperados. */
function forma(e: Expresion): string {
  switch (e.tipo) {
    case 'numeroLiteral':
      return String(e.valor);
    case 'referenciaParametro':
      return `:${e.nombre}`;
    case 'expresionAritmetica':
      return `(${forma(e.izquierda)} ${e.operador} ${forma(e.derecha)})`;
    default:
      return `<${e.tipo}>`;
  }
}

function literal(e: Expresion | undefined): number {
  if (e === undefined || e.tipo !== 'numeroLiteral') throw new Error('se esperaba un literal numérico');
  return e.valor;
}

/** Cuerpo `REPITE :veces [AVANZA :largo GIRADERECHA giro]` como texto canónico. */
function formaCuerpo(def: DefinicionProcedimiento): string {
  return def.cuerpo
    .map((i) => {
      if (i.tipo !== 'repeticion') return `<${i.tipo}>`;
      const internas = i.cuerpo.map((c) =>
        c.tipo === 'invocacionComando' ? `${c.nombre} ${c.argumentos.map(forma).join(' ')}` : `<${c.tipo}>`,
      );
      return `REPITE ${forma(i.veces)} [${internas.join(' ')}]`;
    })
    .join(' ');
}

const CUERPO_POLIGONO = 'REPITE :lados [AVANZA :largo GIRADERECHA (360 / :lados)]';
const CUERPO_ESTRELLA = 'REPITE :puntas [AVANZA :largo GIRADERECHA ((360 * 2) / :puntas)]';

// ============================================================================
// Vocabulario, recursión y azar
// ============================================================================

function recorrerExpresiones(e: Expresion, visitar: (e: Expresion) => void): void {
  visitar(e);
  if (e.tipo === 'expresionAritmetica') {
    recorrerExpresiones(e.izquierda, visitar);
    recorrerExpresiones(e.derecha, visitar);
  } else if (e.tipo === 'menosUnario') {
    recorrerExpresiones(e.operando, visitar);
  } else if (e.tipo === 'comandoOperador') {
    for (const a of e.argumentos) recorrerExpresiones(a, visitar);
  }
}

interface Inventario {
  comandos: string[];
  tiposExpresion: string[];
  operadores: string[];
  llamadasEnDefiniciones: string[];
  tiposInstruccion: string[];
}

function inventariar(programa: Programa): Inventario {
  const inv: Inventario = { comandos: [], tiposExpresion: [], operadores: [], llamadasEnDefiniciones: [], tiposInstruccion: [] };
  const anotar = (e: Expresion): void =>
    recorrerExpresiones(e, (x) => {
      inv.tiposExpresion.push(x.tipo);
      if (x.tipo === 'expresionAritmetica') inv.operadores.push(x.operador);
      if (x.tipo === 'comandoOperador') inv.comandos.push(x.nombre);
    });
  const visitar = (lista: readonly Instruccion[], dentroDeDefinicion: boolean): void => {
    for (const i of lista) {
      inv.tiposInstruccion.push(i.tipo);
      if (i.tipo === 'invocacionComando') {
        inv.comandos.push(i.nombre);
        i.argumentos.forEach(anotar);
      } else if (i.tipo === 'repeticion') {
        inv.comandos.push('REPITE');
        anotar(i.veces);
        visitar(i.cuerpo, dentroDeDefinicion);
      } else if (i.tipo === 'definicionProcedimiento') {
        inv.comandos.push('PARA');
        visitar(i.cuerpo, true);
      } else if (i.tipo === 'invocacionProcedimiento') {
        if (dentroDeDefinicion) inv.llamadasEnDefiniciones.push(i.nombre);
        i.argumentos.forEach(anotar);
      }
    }
  };
  visitar(programa.instrucciones, false);
  return inv;
}

// ============================================================================
// Forma específica de cada nivel
// ============================================================================

function partir(programa: Programa): { def: DefinicionProcedimiento; llamadas: InvocacionProcedimiento[] } {
  const [def, ...resto] = programa.instrucciones;
  expect(def?.tipo).toBe('definicionProcedimiento');
  for (const l of resto) expect(l.tipo).toBe('invocacionProcedimiento');
  return { def: def as DefinicionProcedimiento, llamadas: resto as InvocacionProcedimiento[] };
}

function esLargoValido(l: number): boolean {
  return Number.isInteger(l) && l % 20 === 0 && l >= 40 && l <= 200;
}

/** Comprueba la forma de la referencia según el nivel del generador. */
function comprobarForma(id: IdM4, programa: Programa): void {
  const { def, llamadas } = partir(programa);
  for (const l of llamadas) {
    expect(l.nombre).toBe(def.nombre);
    expect(l.argumentos).toHaveLength(def.parametros.length);
  }

  if (id === 'estrella-parametrica-m4') {
    expect(def.nombre).toBe('ESTRELLA');
    expect(def.parametros).toEqual(['puntas', 'largo']);
    expect(formaCuerpo(def)).toBe(CUERPO_ESTRELLA);
    expect(llamadas).toHaveLength(1);
    expect([5, 7, 9, 11]).toContain(literal(llamadas[0]!.argumentos[0]));
    expect(esLargoValido(literal(llamadas[0]!.argumentos[1]))).toBe(true);
    return;
  }

  expect(def.nombre).toBe('POLIGONO');
  expect(def.parametros).toEqual(['lados', 'largo']);
  expect(formaCuerpo(def)).toBe(CUERPO_POLIGONO);
  const lados = llamadas.map((l) => literal(l.argumentos[0]));
  const largos = llamadas.map((l) => literal(l.argumentos[1]));
  // El giro es 360 / :lados, así que n = lados; el rango 3..8 queda dentro de 3..12.
  for (const n of lados) {
    expect(Number.isInteger(n) && n >= 3 && n <= 8).toBe(true);
  }
  for (const l of largos) expect(esLargoValido(l)).toBe(true);

  if (id === 'tres-poligonos-m4') {
    expect(llamadas).toHaveLength(3);
    expect(new Set(lados).size).toBe(3);
    expect(new Set(largos).size).toBe(1);
  } else {
    expect(llamadas.length).toBeGreaterThanOrEqual(3);
    expect(llamadas.length).toBeLessThanOrEqual(5);
    expect(new Set(lados).size).toBe(1);
    for (let k = 1; k < largos.length; k++) expect(largos[k]! - largos[k - 1]!).toBe(20);
  }
}

function comprobarVocabulario(programa: Programa): void {
  const inv = inventariar(programa);
  for (const nombre of inv.comandos) {
    const b = buscarComando(nombre);
    expect(b.hallada, `comando desconocido: ${nombre}`).toBe(true);
    if (b.hallada) expect(b.entrada.mundo).toBeLessThanOrEqual(4);
  }
  expect(inv.comandos).not.toContain('AZAR');
  expect(inv.llamadasEnDefiniciones).toEqual([]);
  // Expresiones solo con literales, parámetros y las cuatro operaciones.
  for (const t of inv.tiposExpresion) expect(['numeroLiteral', 'referenciaParametro', 'expresionAritmetica']).toContain(t);
  for (const op of inv.operadores) expect(['/', '*']).toContain(op);
  for (const t of inv.tiposInstruccion) {
    expect(['definicionProcedimiento', 'invocacionProcedimiento', 'repeticion', 'invocacionComando']).toContain(t);
  }
}

/** Ejecuta con el intérprete real y compara la caja del generador con la de los segmentos. */
function comprobarCaja(programa: Programa): void {
  const gen = ejecutar(programa, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(4), semilla: 1 });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  expect(paso.value.error).toBeNull();
  expect(paso.value.guardaActivada).toBeNull();

  const real = calcularEncuadre(extraerSegmentos(paso.value.operaciones));
  const caja = cajaDeReferencia(programa);
  expect(real.hayCaja).toBe(true);
  expect(caja).not.toBeNull();
  if (!real.hayCaja || caja === null) return;

  expect(Math.abs(caja.izquierda - real.caja.izquierda)).toBeLessThanOrEqual(TOLERANCIA);
  expect(Math.abs(caja.derecha - real.caja.derecha)).toBeLessThanOrEqual(TOLERANCIA);
  expect(Math.abs(caja.abajo - real.caja.abajo)).toBeLessThanOrEqual(TOLERANCIA);
  expect(Math.abs(caja.arriba - real.caja.arriba)).toBeLessThanOrEqual(TOLERANCIA);

  // Encuadrada en [−400, 400] y de al menos 200 × 200, medida sobre la ejecución real.
  expect(real.caja.izquierda).toBeGreaterThanOrEqual(-LIMITE_LIENZO);
  expect(real.caja.derecha).toBeLessThanOrEqual(LIMITE_LIENZO);
  expect(real.caja.abajo).toBeGreaterThanOrEqual(-LIMITE_LIENZO);
  expect(real.caja.arriba).toBeLessThanOrEqual(LIMITE_LIENZO);
  expect(real.caja.derecha - real.caja.izquierda).toBeGreaterThanOrEqual(DIMENSION_MINIMA - TOLERANCIA);
  expect(real.caja.arriba - real.caja.abajo).toBeGreaterThanOrEqual(DIMENSION_MINIMA - TOLERANCIA);
  expect(real.noEncuadrada).toEqual([]);
  expect(real.degenerada).toBe(false);
}

/** El lazo de reintento: cada descarte fue un candidato inaceptable y se pasó a la semilla siguiente. */
function comprobarReintento(g: Generador, semilla: number, semillaEfectiva: number, descartes: number): void {
  expect(semillaEfectiva).toBe(semilla + descartes);
  for (let k = 0; k < descartes; k++) {
    const soloUno = g({ semilla: semilla + k, parametros: {}, intentosMaximos: 1 });
    expect(soloUno.exito).toBe(false);
  }
  if (descartes > 0) {
    const corto = g({ semilla, parametros: {}, intentosMaximos: descartes });
    expect(corto.exito).toBe(false);
    if (!corto.exito) expect(corto.error.id).toBe('generadorSinCandidato');
  }
}

function verificar(id: IdM4, semilla: number): void {
  const g = generador(id);
  const r = g({ semilla, parametros: {}, intentosMaximos: INTENTOS });
  expect(r.exito, `${id} semilla ${semilla}`).toBe(true);
  if (!r.exito) return;
  comprobarForma(id, r.referencia);
  comprobarVocabulario(r.referencia);
  comprobarCaja(r.referencia);
  comprobarReintento(g, semilla, r.semillaEfectiva, r.descartes);
}

// ============================================================================
// Propiedad
// ============================================================================

describe('Property 20 · generadores del mundo 4', () => {
  for (const id of IDS) {
    it(`${id}: las primeras ${SEMILLAS_FIJAS} semillas dan retos con la forma pedida`, () => {
      for (let semilla = 0; semilla < SEMILLAS_FIJAS; semilla++) verificar(id, semilla);
    });

    it(`${id}: también para semillas al azar del dominio`, () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: SEMILLA_AZAR_MAXIMA }), (semilla) => {
          verificar(id, semilla);
        }),
        { seed: 20, numRuns: 200 },
      );
    });

    it(`${id}: sin intentos devuelve generadorSinCandidato sin lanzar`, () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: SEMILLA_AZAR_MAXIMA }), (semilla) => {
          const r = generador(id)({ semilla, parametros: {}, intentosMaximos: 0 });
          expect(r.exito).toBe(false);
          if (!r.exito) expect(r.error.id).toBe('generadorSinCandidato');
        }),
        { seed: 21, numRuns: 50 },
      );
    });
  }
});
