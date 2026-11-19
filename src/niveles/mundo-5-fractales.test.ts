// Mundo 5 · Fractales: regresión de tres estrellas, generadores sobre 200 semillas, profundidad de
// recursión y rodeos conocidos (el árbol sin trazo repetido, la espiral con otro incremento).

import { describe, it, expect } from 'vitest';
import type { Programa } from '../lenguaje/ast.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { imprimir } from '../lenguaje/impresor.js';
import { ejecutar, type Operacion } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { calcularEncuadre } from '../motor/encuadre.js';
import { validar } from '../motor/validador.js';
import { resolverReto, type Reto } from '../juego/reto.js';
import { calificar } from '../juego/estrellas.js';
import { rellenarPistas } from '../juego/pistas.js';
import { TIMEOUT_TRES_ESTRELLAS } from '../pruebas/tiempos.js';
import { MUNDO_5 } from './mundo-5-fractales.js';

const SEMILLAS = 200;
const MAXIMA_PROFUNDIDAD_ESPERADA = 60;

function retoDe(id: string, semilla: number): Reto {
  const r = resolverReto(id, semilla);
  if (!r.exito) throw new Error(`${id} (semilla ${semilla}): ${r.error.id}`);
  return r.reto;
}

function leer(texto: string): Programa {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo: 5 });
  if (programa === null) throw new Error(errores.map((e) => e.mensaje).join('; '));
  return programa;
}

function correr(programa: Programa): readonly Operacion[] {
  const gen = ejecutar(programa, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(5), semilla: 0 });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  expect(paso.value.error).toBeNull();
  return paso.value.operaciones;
}

function calificarTexto(texto: string, reto: Reto) {
  const programa = leer(texto);
  const veredicto = validar(extraerSegmentos(correr(programa)), reto.segmentos, reto.nivel.normalizacion);
  return { veredicto, cal: calificar(programa, veredicto, reto) };
}

function encuadrada(reto: Reto): boolean {
  const e = calcularEncuadre(reto.segmentos);
  return e.hayCaja && e.noEncuadrada.length === 0;
}

function profundidadMaxima(reto: Reto): number {
  return Math.max(0, ...reto.operaciones.map((o) => o.profundidad));
}

describe('mundo 5 · catálogo', () => {
  it('tiene cinco niveles, tres autorados y dos generados, todos de recursión', () => {
    expect(MUNDO_5.map((n) => n.id)).toEqual(['5.1', '5.2', '5.3', '5.4', '5.5']);
    expect(MUNDO_5.map((n) => n.origen.tipo)).toEqual(['autorado', 'generado', 'autorado', 'autorado', 'generado']);
    for (const n of MUNDO_5) {
      expect(n.concepto).toBe('recursion');
      expect(n.abstraccion).toEqual([{ clave: 'usaRecursion' }]);
      expect(n.normalizacion).toEqual({ traslacion: 'fija', rotacion: 'fija', escala: 'exacta' });
      for (const pista of n.pistas) expect(pista.length).toBeLessThanOrEqual(200);
    }
  });

  it('los presupuestos salen del conteo de la referencia', () => {
    const esperados: Record<string, number> = { '5.1': 6, '5.3': 10, '5.4': 12 };
    for (const [id, conteo] of Object.entries(esperados)) {
      const reto = retoDe(id, 0);
      expect(reto.presupuestoEstrella, id).toBe(conteo);
      expect(reto.limiteDuro).toBe(conteo + 3);
      expect(reto.limiteDuroActivo).toBe(true);
    }
  });
});

describe('mundo 5 · niveles autorados', () => {
  it('5.1 dibuja la espiral y se detiene por su caso base, lejos de la guarda de 100', () => {
    const reto = retoDe('5.1', 0);
    // Lados de 20 a 200 de 5 en 5: 37 llamadas, cada una con un avance y un giro.
    expect(reto.operaciones.length).toBe(74);
    expect(profundidadMaxima(reto)).toBe(37);
  });

  it('5.3 y 5.4 usan las cuatro llamadas recursivas y no pasan de profundidad 4', () => {
    const lado = retoDe('5.3', 0);
    expect(profundidadMaxima(lado)).toBe(4);
    // 4^3 avances de 300/27 más 3 giros por cada nodo interno (1 + 4 + 16).
    expect(lado.operaciones.filter((o) => o.tipo === 'mover').length).toBe(64);
    expect(lado.operaciones.filter((o) => o.tipo === 'girar').length).toBe(63);
    const copo = retoDe('5.4', 0);
    expect(copo.operaciones.filter((o) => o.tipo === 'mover').length).toBe(192);
    expect(profundidadMaxima(copo)).toBe(4);
    expect(encuadrada(copo)).toBe(true);
  });

  it.each(['5.1', '5.3', '5.4'])('%s aprueba su propio nivel con tres estrellas', (id) => {
    const reto = retoDe(id, 0);
    const programa = reto.referencia;
    const veredicto = validar(extraerSegmentos(reto.operaciones), reto.segmentos, reto.nivel.normalizacion);
    const cal = calificar(programa, veredicto, reto);
    expect([cal.precision.otorgada, cal.economia.otorgada, cal.abstraccion.otorgada]).toEqual([true, true, true]);
  });

  it('el Koch nivel 3 con 100 niveles de margen: un nivel 90 corta por la guarda, no cuelga', () => {
    const programa = leer(
      'PARA KOCH :largo :nivel SINO :nivel = 0 [AVANZA :largo] [KOCH :largo :nivel + 1] FIN KOCH 10 1',
    );
    const gen = ejecutar(programa, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(5), semilla: 0 });
    let paso = gen.next();
    while (!paso.done) paso = gen.next();
    expect(paso.value.guardaActivada).toBe('recursion');
    expect(paso.value.error?.mensaje).toContain('KOCH');
    expect(paso.value.error?.mensaje).toContain('condición de corte');
  });
});

describe('mundo 5 · rodeos conocidos', () => {
  function textoDe(reto: Reto): string {
    const impreso = imprimir(reto.referencia);
    if (!impreso.exito) throw new Error('no imprimible');
    return impreso.texto;
  }

  it('el árbol de la referencia, que vuelve sobre cada rama con RETROCEDE, aprueba la precisión', () => {
    for (const semilla of [1, 2, 3]) {
      const reto = retoDe('5.5', semilla);
      const { veredicto } = calificarTexto(textoDe(reto), reto);
      expect(veredicto.coincide, `semilla ${semilla}`).toBe(true);
    }
  });

  it('un trazo repetido sobre la misma línea no suma píxeles: ir, volver e ir otra vez sigue aprobando', () => {
    for (const semilla of [1, 2, 3]) {
      const reto = retoDe('5.5', semilla);
      const repetido = textoDe(reto).replace('AVANZA :largo', 'AVANZA :largo\n  RETROCEDE :largo\n  AVANZA :largo');
      const { veredicto, cal } = calificarTexto(repetido, reto);
      expect(veredicto.excesoPorcentaje, `semilla ${semilla}`).toBeLessThanOrEqual(5);
      expect(veredicto.coincide, `semilla ${semilla}`).toBe(true);
      // Aprueba la figura pero gasta dos instrucciones más: la economía se pierde.
      expect(cal.precision.otorgada).toBe(true);
      expect(cal.economia.otorgada).toBe(false);
    }
  });

  it('un árbol con las ramas abiertas 15 grados de más no aprueba', () => {
    const reto = retoDe('5.5', 1);
    const texto = textoDe(reto).replace(/GIRAIZQUIERDA (\d+)/g, (_m, g: string) => `GIRAIZQUIERDA ${Number(g) + 15}`);
    expect(calificarTexto(texto, reto).veredicto.coincide).toBe(false);
  });

  it('un árbol sin RETROCEDE no vuelve al punto de partida y no aprueba', () => {
    const reto = retoDe('5.5', 1);
    const texto = textoDe(reto).replace('RETROCEDE :largo', '');
    expect(calificarTexto(texto, reto).veredicto.coincide).toBe(false);
  });

  it('una espiral con incremento 10 o 20 en lugar de 5 no aprueba el 5.1; con 2 el margen de 8 px la deja pasar', () => {
    const reto = retoDe('5.1', 0);
    const con = (incremento: number) =>
      calificarTexto(`PARA E :l SI :l > 200 [ALTO] AV :l GD 90 E :l + ${incremento} FIN E 20`, reto).veredicto;
    expect(con(5).coincide).toBe(true);
    expect(con(10).coincide).toBe(false);
    expect(con(20).coincide).toBe(false);
  });
});

describe('mundo 5 · generadores sobre 200 semillas', () => {
  for (const id of ['5.2', '5.5']) {
    it(
      `${id}: cada semilla produce un reto encuadrado, no degenerado, con tres estrellas`,
      () => {
        for (let semilla = 0; semilla < SEMILLAS; semilla++) {
          const reto = retoDe(id, semilla);
          const encuadre = calcularEncuadre(reto.segmentos);
          expect(encuadre.hayCaja && !encuadre.degenerada, `${id} semilla ${semilla}`).toBe(true);
          expect(encuadrada(reto), `${id} semilla ${semilla}`).toBe(true);
          expect(profundidadMaxima(reto), `${id} semilla ${semilla}`).toBeLessThanOrEqual(MAXIMA_PROFUNDIDAD_ESPERADA);

          const veredicto = validar(extraerSegmentos(reto.operaciones), reto.segmentos, reto.nivel.normalizacion);
          const cal = calificar(reto.referencia, veredicto, reto);
          expect(
            [cal.precision.otorgada, cal.economia.otorgada, cal.abstraccion.otorgada],
            `${id} semilla ${semilla}`,
          ).toEqual([true, true, true]);

          const conteo = contarInstrucciones(reto.referencia);
          expect(conteo.exito && conteo.instrucciones).toBe(reto.presupuestoEstrella);

          for (const pista of rellenarPistas(reto.nivel, reto)) {
            expect(pista, `${id} semilla ${semilla}`).not.toMatch(/\{\w+\}/);
          }
        }
      },
      TIMEOUT_TRES_ESTRELLAS,
    );

    it(`${id}: la misma semilla produce siempre el mismo reto`, () => {
      for (const semilla of [0, 7, 123456]) {
        expect(retoDe(id, semilla).segmentos).toEqual(retoDe(id, semilla).segmentos);
        expect(retoDe(id, semilla).codigoSemilla).toBe(retoDe(id, semilla).codigoSemilla);
      }
    });
  }

  it('5.2: el ángulo es 360/n con n de 3 a 6 y el incremento de 5 a 20', () => {
    const lados = new Set<number>();
    const incrementos = new Set<number>();
    for (let semilla = 0; semilla < SEMILLAS; semilla++) {
      const reto = retoDe('5.2', semilla);
      const giros = reto.operaciones.filter((o) => o.tipo === 'girar');
      const grados = giros[0]!.tipo === 'girar' ? giros[0]!.grados : 0;
      lados.add(360 / grados);
      const largos = reto.operaciones.filter((o) => o.tipo === 'mover').map((o) => (o.tipo === 'mover' ? Math.hypot(o.hasta.x - o.desde.x, o.hasta.y - o.desde.y) : 0));
      incrementos.add(Math.round(largos[1]! - largos[0]!));
    }
    expect([...lados].sort()).toEqual([3, 4, 5, 6]);
    expect([...incrementos].sort((a, b) => a - b)).toEqual([5, 10, 15, 20]);
  });

  it('5.5: la referencia usa RETROCEDE y vuelve a su punto de partida', () => {
    const reto = retoDe('5.5', 3);
    const ultima = reto.operaciones[reto.operaciones.length - 1]!;
    expect(ultima.estadoDespues.posicion.x).toBeCloseTo(0, 6);
    expect(ultima.estadoDespues.posicion.y).toBeCloseTo(0, 6);
    expect(reto.operaciones.some((o) => o.tipo === 'mover' && o.hasta.y < o.desde.y)).toBe(true);
  });
});
