// @vitest-environment jsdom
//
// Consola de punta a punta (spec 05, R10.12 y R10.14): en un nivel del mundo 4, un `ESCRIBE`
// escrito en el editor llega a la consola como una línea, la ejecución termina con un único
// anuncio nuevo en #anuncios que resume la salida (D17), y la consola no cambia el tamaño de
// ningún lienzo ni el alto del editor (R10.8).
//
// jsdom no calcula diseño: el tamaño de un lienzo se lee de sus atributos `width`/`height`, y el
// alto del editor de lo que sí refleja el DOM (`rows`, estilo en línea y la caja que informa).
import { describe, it, expect, beforeEach } from 'vitest';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from './main.js';
import type { Reloj } from './motor/animador.js';
import type { RelojEspera } from './ui/demostracion.js';
import type { RelojRebote } from './ui/editor.js';

function crearAlmacenMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    key: (i: number) => [...datos.keys()][i] ?? null,
    removeItem: (k: string) => void datos.delete(k),
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
}

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

function crearApp(): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen: crearAlmacenMemoria(),
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte,
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    idNivel: '4.1',
  });
}

function escribirPrograma(app: Aplicacion, texto: string): void {
  app.editor.area.value = texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
}

/** Tamaño de cada lienzo y alto del editor, tal como los expone el DOM. */
function medidas(app: Aplicacion): unknown {
  const lienzos = [...document.querySelectorAll('canvas')].map((c) => ({
    id: c.id,
    width: c.width,
    height: c.height,
  }));
  const area = app.editor.area;
  return {
    lienzos,
    editor: {
      rows: area.getAttribute('rows'),
      estilo: area.style.height,
      caja: area.getBoundingClientRect().height,
    },
  };
}

const registro = (): HTMLElement => document.querySelector<HTMLElement>('[role="log"]')!;
const lineasVisibles = (): string[] =>
  [...registro().querySelectorAll('.kl-consola-linea')].map((p) => p.textContent ?? '');

beforeEach(() => {
  montarDom();
});

describe('main · consola de punta a punta (R10.12, R10.14)', () => {
  it('ESCRIBE 360 / 5 deja «72» en la consola, un único anuncio y los tamaños intactos', () => {
    const app = crearApp();
    expect(app.estado().reto.nivel.mundo).toBe(4);
    expect(registro()).not.toBeNull();
    expect(app.consola.plegada()).toBe(true);

    escribirPrograma(app, 'ESCRIBE 360 / 5');
    const antes = medidas(app);

    const anuncios = document.getElementById('anuncios')!;
    const observador = new MutationObserver(() => {});
    observador.observe(anuncios, { childList: true, characterData: true, subtree: true });

    app.ejecutar();

    // Cada asignación a #anuncios es un mensaje. El globo publica antes «Resultado: …» en la
    // misma tarea síncrona; R10.12 exige que la salida de la consola llegue en un solo mensaje,
    // nunca uno por línea, y que sea lo último que queda en la región.
    const mensajes = observador
      .takeRecords()
      .flatMap((r) => (r.type === 'characterData' ? [r.target.textContent ?? ''] : [...r.addedNodes].map((n) => n.textContent ?? '')));
    observador.disconnect();
    const mensajesDeConsola = mensajes.filter((m) => m.includes('consola'));

    expect(app.consola.lineas()).toEqual(['72']);
    expect(lineasVisibles()).toEqual(['72']);
    expect(app.consola.plegada()).toBe(false);

    expect(mensajesDeConsola).toHaveLength(1);
    expect(mensajes.some((m) => m.includes('escribiste'))).toBe(false);
    const anuncio = anuncios.textContent ?? '';
    expect(anuncio).toBe(mensajesDeConsola[0]);
    expect(anuncio).toContain('1 línea');
    expect(anuncio).toContain('«72»');

    expect(medidas(app)).toEqual(antes);
  });
});
