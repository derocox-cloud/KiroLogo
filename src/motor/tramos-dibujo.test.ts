// Pruebas del extractor de tramos para dibujar (reseña del PR #24, punto 5).
//
// El extractor es SOLO para pintar: el validador sigue usando `extraerSegmentos`,
// así que R4.8 (el color y el grosor no cuentan para la precisión) se cumple por
// construcción. Aquí se fija que la geometría coincide siempre con la de
// `extraerSegmentos` y que el estilo solo aparece cuando el jugador lo pidió.

import { describe, it, expect } from 'vitest';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { ejecutar, type Operacion } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { crearPrng } from '../azar/prng.js';
import { generarPrograma } from '../azar/generadores-prueba.test.js';
import { ESTADO_INICIAL } from './tortuga.js';
import { extraerSegmentos } from './segmentos.js';
import { extraerTramosDibujo, cssDeColor, trazoDeTramo, type TramoDibujo } from './tramos-dibujo.js';
import type { TrazoTema } from './lienzo.js';

/** Operaciones de un texto KiroLogo del mundo 2. */
function operacionesDe(texto: string): readonly Operacion[] {
  const { programa, errores } = analizar(analizarLexico(texto).tokens, { mundo: 2 });
  expect(errores).toEqual([]);
  const g = ejecutar(programa!, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(2), semilla: 0 });
  let p = g.next();
  while (!p.done) p = g.next();
  expect(p.value.error).toBeNull();
  return p.value.operaciones;
}

/** Solo la geometría de un tramo (lo que también tiene un Segmento). */
const geometria = (t: TramoDibujo) => ({ desde: t.desde, hasta: t.hasta, paso: t.paso, linea: t.linea });

const TEMA: TrazoTema = { color: 'var-tema', grosor: 3, guiones: [] };

describe('tramos-dibujo · geometría idéntica a extraerSegmentos', () => {
  it('sin decoración, cada tramo es exactamente el segmento de siempre (ni color ni grosor)', () => {
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90] SUBELAPIZ AV 50 BAJALAPIZ AV 30 BORRAPANTALLA AV 20');
    expect(extraerTramosDibujo(ops)).toEqual(extraerSegmentos(ops));
    for (const t of extraerTramosDibujo(ops)) {
      expect('color' in t).toBe(false);
      expect('grosor' in t).toBe(false);
    }
  });

  it('200 programas al azar del mundo 0: misma geometría que extraerSegmentos', () => {
    const prng = crearPrng(5_005);
    for (let i = 0; i < 200; i++) {
      const g = ejecutar(generarPrograma(prng, 12), {
        estadoInicial: ESTADO_INICIAL,
        comandosPermitidos: comandosDelMundo(0),
        semilla: 0,
      });
      let p = g.next();
      while (!p.done) p = g.next();
      const ops = p.value.operaciones;
      expect(extraerTramosDibujo(ops)).toEqual(extraerSegmentos(ops));
    }
  });

  it('con decoración, la geometría sigue siendo la de extraerSegmentos', () => {
    const ops = operacionesDe('PONCOLOR rojo PG 5 REPITE 3 [AV 100 GD 120] RELLENA "azul AV 40');
    expect(extraerTramosDibujo(ops).map(geometria)).toEqual(extraerSegmentos(ops));
  });
});

describe('tramos-dibujo · estilo pedido por el jugador', () => {
  it('PONCOLOR y PONGROSOR se aplican a los tramos siguientes, no a los anteriores', () => {
    const tramos = extraerTramosDibujo(operacionesDe('AV 10 PONCOLOR rojo AV 20 PONGROSOR 5 AV 30'));
    expect(tramos).toHaveLength(3);
    expect(tramos[0]!.color).toBeUndefined();
    expect(tramos[0]!.grosor).toBeUndefined();
    expect(tramos[1]!.color?.nombre).toBe('rojo');
    expect(tramos[1]!.grosor).toBeUndefined();
    expect(tramos[2]!.color?.nombre).toBe('rojo');
    expect(tramos[2]!.grosor).toBe(5);
  });

  it('un grosor sin color deja el color del tema', () => {
    const [t] = extraerTramosDibujo(operacionesDe('PG 7 AV 10'));
    expect(t!.color).toBeUndefined();
    expect(t!.grosor).toBe(7);
  });

  it('RELLENA no cambia el color del lápiz', () => {
    const tramos = extraerTramosDibujo(operacionesDe('PONCOLOR rojo RELLENA "azul AV 100'));
    expect(tramos[0]!.color?.nombre).toBe('rojo');
  });

  it('BORRAPANTALLA descarta los tramos pero conserva el color y el grosor vigentes', () => {
    const tramos = extraerTramosDibujo(operacionesDe('PONCOLOR verde PG 4 AV 10 BORRAPANTALLA AV 20'));
    expect(tramos).toHaveLength(1);
    expect(tramos[0]!.color?.nombre).toBe('verde');
    expect(tramos[0]!.grosor).toBe(4);
  });

  it('con el lápiz arriba no hay tramo, y el color sigue vigente al bajarlo', () => {
    const tramos = extraerTramosDibujo(operacionesDe('PONCOLOR azul SL AV 10 BL AV 20'));
    expect(tramos).toHaveLength(1);
    expect(tramos[0]!.color?.nombre).toBe('azul');
  });
});

describe('tramos-dibujo · del tramo al trazo del lienzo', () => {
  it('cssDeColor arma el hexadecimal del color pedido', () => {
    expect(cssDeColor({ r: 255, g: 0, b: 0, nombre: 'rojo' })).toBe('#ff0000');
    expect(cssDeColor({ r: 0, g: 128, b: 255, nombre: null })).toBe('#0080ff');
    expect(cssDeColor({ r: 1, g: 2, b: 3, nombre: null })).toBe('#010203');
  });

  it('sin estilo pedido, el trazo es exactamente el del tema', () => {
    const [t] = extraerTramosDibujo(operacionesDe('AV 10'));
    expect(trazoDeTramo(t!, TEMA)).toBe(TEMA);
  });

  it('con estilo, color y grosor salen del jugador y los guiones del tema', () => {
    const [t] = extraerTramosDibujo(operacionesDe('PONCOLOR rojo PG 6 AV 10'));
    expect(trazoDeTramo(t!, { ...TEMA, guiones: [4, 2] })).toEqual({ color: '#ff0000', grosor: 6, guiones: [4, 2] });
  });
});
