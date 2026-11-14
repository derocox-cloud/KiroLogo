// @vitest-environment jsdom
//
// Punta a punta del mundo 4 (spec 05, tarea 15.2, R27.9 y R24.2): con los mundos 0 a 3
// aprobados en un almacén en memoria, el jugador escribe en el editor un programa que
// define y llama a POLIGONO con parámetros, lo ejecuta y ve las tres estrellas del
// intento. Después completa 4.1 a 4.4 con tres estrellas cada uno, y la medalla de la
// insignia Generalización del menú de mundos aparece solo tras aprobar el último.
import { describe, it, expect, beforeEach } from 'vitest';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from './main.js';
import type { Reloj } from './motor/animador.js';
import type { RelojEspera } from './ui/demostracion.js';
import type { RelojRebote } from './ui/editor.js';
import { cargarProgreso } from './juego/progreso.js';
import type { Calificacion } from './juego/estrellas.js';
import { insigniasDelMundo } from './juego/insignias.js';
import { CATALOGO } from './niveles/catalogo.js';
import { imprimir } from './lenguaje/impresor.js';

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

const aprobada: Calificacion = {
  precision: { otorgada: true },
  economia: { otorgada: true },
  abstraccion: { otorgada: true },
  conteoJugador: 1,
  presupuestoEstrella: 1,
  mensajeAbstraccion: null,
};

/** Almacén con los mundos 0 a 3 aprobados: el mundo 4 queda desbloqueado (R24.4). */
function almacenConMundo4Abierto(): Storage {
  const almacen = crearAlmacenMemoria();
  const p = cargarProgreso(almacen);
  for (const n of CATALOGO.filter((x) => x.mundo < 4)) p.guardar(n.id, 0, aprobada, 1);
  return almacen;
}

function crearApp(almacen: Storage): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen,
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte,
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    idNivel: '4.1',
  });
}

function escribir(app: Aplicacion, texto: string): void {
  app.editor.area.value = texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
}

/** Estado de cada estrella tal como lo pinta el marcador (por texto, no por color). */
function estrellasMostradas(): Record<string, string | null> {
  const estado = (nombre: string): string | null =>
    document.querySelector(`.kl-estrella-${nombre} .kl-estrella-estado`)?.textContent ?? null;
  return { precision: estado('precision'), economia: estado('economia'), abstraccion: estado('abstraccion') };
}

const TRES_OTORGADAS = { precision: 'otorgada', economia: 'otorgada', abstraccion: 'otorgada' };

/** Escribe la referencia del reto en curso y la ejecuta: una resolución correcta. */
function resolverElRetoEnCurso(app: Aplicacion): void {
  const impreso = imprimir(app.estado().reto.referencia);
  if (!impreso.exito) throw new Error('la referencia no se puede imprimir');
  escribir(app, impreso.texto);
  app.ejecutar();
}

const idsMundo4 = CATALOGO.filter((n) => n.mundo === 4).map((n) => n.id);

beforeEach(() => {
  montarDom();
});

describe('main · mundo 4 de punta a punta (R27.9, R24.2)', () => {
  it('el catálogo del mundo 4 es 4.1 a 4.4', () => {
    expect(idsMundo4).toEqual(['4.1', '4.2', '4.3', '4.4']);
  });

  it('un POLIGONO con parámetros escrito a mano en el 4.1 gana las tres estrellas', () => {
    const app = crearApp(almacenConMundo4Abierto());
    expect(app.nivelEnCurso()).toBe('4.1');

    escribir(
      app,
      ['PARA POLIGONO :lados :largo', '  REPITE :lados [AVANZA :largo GIRADERECHA 360 / :lados]', 'FIN', 'POLIGONO 6 80'].join(
        '\n',
      ),
    );
    app.ejecutar();

    const cal = app.estado().calificacion;
    expect(cal?.precision.otorgada).toBe(true);
    expect(cal?.economia.otorgada).toBe(true);
    expect(cal?.abstraccion.otorgada).toBe(true);
    expect(estrellasMostradas()).toEqual(TRES_OTORGADAS);
  });

  it('completar 4.1 a 4.4 con tres estrellas otorga Generalización solo tras el último nivel', () => {
    const almacen = almacenConMundo4Abierto();
    const app = crearApp(almacen);
    expect(app.menuMundos.insigniaVisible(4)).toBe(false);

    idsMundo4.forEach((id, i) => {
      app.irANivel(id);
      expect(app.nivelEnCurso()).toBe(id);
      resolverElRetoEnCurso(app);

      expect(estrellasMostradas(), `estrellas del ${id}`).toEqual(TRES_OTORGADAS);
      const ultimo = i === idsMundo4.length - 1;
      expect(app.menuMundos.insigniaVisible(4), `medalla tras el ${id}`).toBe(ultimo);
      expect(insigniasDelMundo(4, cargarProgreso(almacen)).includes('generalizacion'), `progreso tras el ${id}`).toBe(
        ultimo,
      );
    });

    // Resolver de nuevo un nivel no la duplica (R24.2).
    app.irANivel('4.2');
    resolverElRetoEnCurso(app);
    expect(insigniasDelMundo(4, cargarProgreso(almacen)).filter((x) => x === 'generalizacion')).toHaveLength(1);
    expect(app.menuMundos.insigniaVisible(4)).toBe(true);
  });
});
