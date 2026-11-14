// @vitest-environment jsdom
//
// Errores a mitad de camino en el mundo 4 (R10.6, R25.8): cuando una ejecución se detiene con un
// error de ejecución después de haber escrito en la consola y dibujado, la consola conserva sus
// líneas, el globo muestra el mensaje del catálogo, el lienzo conserva lo dibujado antes del
// error (y nada posterior) y el editor conserva el programa tal como estaba.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from './main.js';
import type { Reloj } from './motor/animador.js';
import type { RelojEspera } from './ui/demostracion.js';
import type { RelojRebote } from './ui/editor.js';
import { DobleDibujo } from './motor/doble-dibujo.test.js';
import { crearError } from './lenguaje/errores.js';

function montarDom(): void {
  document.documentElement.lang = 'es';
  document.body.innerHTML = `
    <div id="aplicacion" role="application" aria-label="KiroLogo">
      <div id="anuncios" aria-live="polite" aria-atomic="true"></div>
      <canvas id="lienzo-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-jugador" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-jugador" width="800" height="800"></canvas>
    </div>
  `;
}

function relojInmediato(): Reloj {
  let t = 0;
  return {
    programar(cb: (ahora: number) => void): number {
      t += 100000;
      cb(t);
      return 1;
    },
    cancelar(): void {},
    ahora: () => t,
  };
}

const relojEsperaInerte: RelojEspera = { programar: () => 1, cancelar: () => {} };
const relojReboteInmediato: RelojRebote = {
  programar(cb: () => void): number {
    cb();
    return 1;
  },
  cancelar(): void {},
};
const movimientoReducido: ConsultaMovimiento = { reducido: () => true, alCambiar: () => () => {} };

const contextos = new Map<string, DobleDibujo>();

beforeEach(() => {
  montarDom();
  contextos.clear();
  // jsdom no trae Canvas: cada canvas recibe un doble que registra lo que se dibuja.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    let ctx = contextos.get(this.id);
    if (!ctx) {
      ctx = new DobleDibujo();
      contextos.set(this.id, ctx);
    }
    return ctx as unknown as CanvasRenderingContext2D;
  } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function crearApp(): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen: null,
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte,
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    idNivel: '4.1',
  });
}

function escribirYEjecutar(app: Aplicacion, texto: string): void {
  app.editor.area.value = texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
  app.ejecutar();
}

/**
 * Puntos del último dibujo de la capa de estela del jugador (tras su último borrado). Las
 * esquinas del rectángulo de recorte (±400, ±400) no son parte de lo dibujado y se descartan.
 */
function puntosEstelaJugador(): Array<{ x: number; y: number }> {
  const llamadas = contextos.get('lienzo-jugador')!.llamadas;
  const ultimoBorrado = llamadas.map((l) => l.metodo).lastIndexOf('clearRect');
  const puntos: Array<{ x: number; y: number }> = [];
  for (const l of llamadas.slice(ultimoBorrado + 1)) {
    if (!['moveTo', 'lineTo'].includes(l.metodo)) continue;
    const a = l.args as number[];
    const esEsquinaDeRecorte = Math.abs(a[0]!) === 400 && Math.abs(a[1]!) === 400;
    if (!esEsquinaDeRecorte) puntos.push({ x: a[0]!, y: a[1]! });
  }
  return puntos;
}

describe('main · errores a mitad de camino en el mundo 4 (R10.6, R25.8)', () => {
  it('ESCRIBE 1 seguido de AVANZA 1 / 0: la línea queda en la consola, el error en el globo y el editor intacto', () => {
    const app = crearApp();
    const programa = 'ESCRIBE 1\nAVANZA 1 / 0';
    escribirYEjecutar(app, programa);

    expect(app.consola.lineas()).toEqual(['1']);
    expect(app.consola.plegada()).toBe(false);
    expect(app.textoGlobo()).toContain(crearError('divisionPorCero', { linea: 2 }).mensaje);
    expect(app.editor.texto()).toBe(programa);
    // Solo la escritura llegó a emitirse: ningún movimiento, así que la estela sigue vacía.
    expect(app.estado().operacionesJugador.map((op) => op.tipo)).toEqual(['escribir']);
    expect(puntosEstelaJugador()).toEqual([]);
    // Sin veredicto ni estrellas: un error de ejecución no se califica.
    expect(app.estado().calificacion).toBeNull();
  });

  it('lo dibujado antes del error se conserva y nada posterior se dibuja', () => {
    const app = crearApp();
    const programa = 'ESCRIBE 1\nAVANZA 100\nAVANZA 1 / 0\nAVANZA 50';
    escribirYEjecutar(app, programa);

    expect(app.consola.lineas()).toEqual(['1']);
    expect(app.textoGlobo()).toContain(crearError('divisionPorCero', { linea: 3 }).mensaje);
    expect(app.editor.texto()).toBe(programa);

    const ys = puntosEstelaJugador().map((p) => p.y);
    expect(ys.length).toBeGreaterThan(0);
    // El tramo de 100 está; el AVANZA 50 posterior al error no llegó a dibujarse.
    expect(Math.max(...ys)).toBeCloseTo(100, 6);
    expect(app.estado().operacionesJugador.filter((op) => op.tipo === 'mover')).toHaveLength(1);
  });
});
