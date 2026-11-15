// Pruebas de ejemplo de los niveles del mundo 4 (parámetros).
//
// Fijan los números que el jugador ve: el conteo de la referencia del 4.1 (4)
// y su límite duro (7), el presupuesto y el límite del 4.2 (6 y 12, por su
// margen de 6), y que el 4.3 y el 4.4 derivan ambos del Conteo con el margen
// por omisión. Además cierran el lazo con el intérprete, el validador y la
// calificación reales: el hexágono sin procedimiento gana precisión y economía
// en el 4.1 pero no abstracción, porque el nivel enseña parámetros.

import { describe, it, expect } from 'vitest';
import { REFERENCIA_4_1, NIVEL_4_1, NIVEL_4_2, NIVEL_4_3, NIVEL_4_4, MUNDO_4 } from './mundo-4-parametros.js';
import type { Programa } from '../lenguaje/ast.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { imprimir } from '../lenguaje/impresor.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { validar } from '../motor/validador.js';
import { resolverReto, type Reto } from '../juego/reto.js';
import { calificar } from '../juego/estrellas.js';
import { rellenarPistas } from '../juego/pistas.js';

// ============================================================================
// Ayudas
// ============================================================================

const SEMILLAS = [1, 2, 3, 42, 401, 9999] as const;

function parsearMundo4(texto: string): Programa {
  const lexico = analizarLexico(texto);
  expect(lexico.errores).toEqual([]);
  const { programa, errores } = analizar(lexico.tokens, { mundo: 4 });
  expect(errores).toEqual([]);
  expect(programa).not.toBeNull();
  return programa!;
}

function conteoDe(programa: Programa): number {
  const c = contarInstrucciones(programa);
  expect(c.exito).toBe(true);
  return c.exito ? c.instrucciones : Number.NaN;
}

function retoDe(idNivel: string, semilla: number): Reto {
  const r = resolverReto(idNivel, semilla);
  expect(r.exito).toBe(true);
  if (!r.exito) throw new Error(`no se pudo resolver ${idNivel}: ${r.error.id}`);
  return r.reto;
}

/** Ejecuta el texto del jugador en el reto y lo califica, como lo hace el juego. */
function jugar(reto: Reto, texto: string) {
  const programa = parsearMundo4(texto);
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(4),
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  expect(paso.value.error).toBeNull();
  expect(paso.value.guardaActivada).toBeNull();
  const segmentos = extraerSegmentos(paso.value.operaciones);
  const veredicto = validar(segmentos, reto.segmentos, reto.nivel.normalizacion);
  return calificar(programa, veredicto, reto);
}

// ============================================================================
// 4.1 · conteo 4 y límite duro 7 (R16.2, R16.5, R20.11)
// ============================================================================

describe('mundo 4 · nivel 4.1', () => {
  it('su referencia es el AST de POLIGONO 6 80 y cuenta 4 instrucciones', () => {
    // El PARA cuenta 3 con su cuerpo (REPITE, AVANZA, GIRADERECHA) y la llamada
    // POLIGONO 6 80 suma 1.
    const texto =
      'PARA POLIGONO :lados :largo REPITE :lados [AVANZA :largo GIRADERECHA 360 / :lados] FIN POLIGONO 6 80';
    expect(conteoDe(parsearMundo4(texto))).toBe(4);
    expect(conteoDe(REFERENCIA_4_1)).toBe(4);
  });

  it('el reto deriva presupuesto 4 y límite duro activo 7', () => {
    const reto = retoDe('4.1', 0);
    expect(reto.presupuestoEstrella).toBe(4);
    expect(reto.limiteDuro).toBe(7);
    expect(reto.limiteDuroActivo).toBe(true);
    expect('presupuestoEstrella' in NIVEL_4_1).toBe(false);
    expect('limiteDuro' in NIVEL_4_1).toBe(false);
  });

  it('la referencia gana las tres estrellas en su propio nivel', () => {
    const reto = retoDe('4.1', 0);
    const texto = imprimir(REFERENCIA_4_1);
    expect(texto.exito).toBe(true);
    if (!texto.exito) return;
    const cal = jugar(reto, texto.texto);
    expect(cal.precision.otorgada).toBe(true);
    expect(cal.economia.otorgada).toBe(true);
    expect(cal.abstraccion.otorgada).toBe(true);
  });

  it('REPITE 6 [AVANZA 80 GIRADERECHA 60] gana precisión y economía, no abstracción (R16.7)', () => {
    const reto = retoDe('4.1', 0);
    const cal = jugar(reto, 'REPITE 6 [AVANZA 80 GIRADERECHA 60]');
    // REPITE (1) + AVANZA (1) + GIRADERECHA (1) = 3, dentro del presupuesto de 4.
    // R16.7 dice «conteo 2», pero conteo.ts cuenta también el propio REPITE.
    expect(cal.conteoJugador).toBe(3);
    expect(cal.conteoJugador).toBeLessThanOrEqual(reto.presupuestoEstrella);
    expect(cal.precision.otorgada).toBe(true);
    expect(cal.economia.otorgada).toBe(true);
    expect(cal.abstraccion.otorgada).toBe(false);
    expect(cal.mensajeAbstraccion).not.toBeNull();
  });

  it('declara tres pistas y el esqueleto no es la referencia impresa (R16.8)', () => {
    expect(NIVEL_4_1.pistas).toHaveLength(3);
    const pistas = rellenarPistas(NIVEL_4_1, retoDe('4.1', 0));
    expect(pistas).toEqual(NIVEL_4_1.pistas);
    const impresa = imprimir(REFERENCIA_4_1);
    expect(impresa.exito).toBe(true);
    if (!impresa.exito) return;
    const normalizar = (s: string) => s.replace(/\s+/g, ' ').trim();
    expect(normalizar(pistas[2])).not.toBe(normalizar(impresa.texto));
    // Esqueleto con huecos en los números: los conserva como ___.
    expect(pistas[2]).toContain('___');
  });
});

// ============================================================================
// 4.2 · conteo 6 y límite 12 por su margen de 6 (R20.11, R20.12)
// ============================================================================

describe('mundo 4 · nivel 4.2', () => {
  it('declara solo margenLimiteDuro 6, sin presupuesto ni límite escritos', () => {
    expect(NIVEL_4_2.margenLimiteDuro).toBe(6);
    expect('presupuestoEstrella' in NIVEL_4_2).toBe(false);
    expect('limiteDuro' in NIVEL_4_2).toBe(false);
  });

  it.each(SEMILLAS)('con semilla %i el reto cuenta 6 y su límite duro es 12', (semilla) => {
    const reto = retoDe('4.2', semilla);
    expect(conteoDe(reto.referencia)).toBe(6);
    expect(reto.presupuestoEstrella).toBe(6);
    expect(reto.limiteDuro).toBe(12);
    expect(reto.limiteDuroActivo).toBe(true);
  });
});

// ============================================================================
// 4.3 y 4.4 · presupuesto y límite derivados del Conteo (R20.11)
// ============================================================================

describe('mundo 4 · niveles 4.3 y 4.4', () => {
  it('no declaran margen: rige el margen por omisión', () => {
    expect(NIVEL_4_3.margenLimiteDuro).toBeUndefined();
    expect(NIVEL_4_4.margenLimiteDuro).toBeUndefined();
  });

  for (const id of ['4.3', '4.4'] as const) {
    it.each(SEMILLAS)(`${id} con semilla %i: presupuesto = Conteo y límite = presupuesto + 3`, (semilla) => {
      const reto = retoDe(id, semilla);
      const conteo = conteoDe(reto.referencia);
      expect(reto.presupuestoEstrella).toBe(conteo);
      expect(reto.limiteDuro).toBe(conteo + 3);
      expect(reto.limiteDuroActivo).toBe(true);
    });
  }

  it('el 4.3 cuenta 3 del PARA más una llamada por polígono (de 3 a 5)', () => {
    for (const semilla of SEMILLAS) {
      const conteo = retoDe('4.3', semilla).presupuestoEstrella;
      expect(conteo).toBeGreaterThanOrEqual(6);
      expect(conteo).toBeLessThanOrEqual(8);
    }
  });
});

// ============================================================================
// Todos · datos del mundo 4 (R20.10, R20.14)
// ============================================================================

describe('mundo 4 · datos comunes', () => {
  it('MUNDO_4 son 4.1..4.4 en orden, con normalización fija', () => {
    expect(MUNDO_4.map((n) => n.id)).toEqual(['4.1', '4.2', '4.3', '4.4']);
    for (const nivel of MUNDO_4) {
      expect(nivel.mundo).toBe(4);
      expect(nivel.concepto).toBe('generalizacion');
      expect(nivel.normalizacion).toEqual({ traslacion: 'fija', rotacion: 'fija', escala: 'exacta' });
    }
  });
});
