// @vitest-environment jsdom
//
// Punta a punta del mundo 5 (spec 06): con los mundos 0 a 4 aprobados, el jugador escribe una
// recursión, la ve cortar por su caso base o por la guarda con un mensaje que nombra el
// procedimiento, la recorre paso a paso viendo la profundidad de la llamada, y completar 5.1 a 5.5
// con tres estrellas otorga la insignia Recursión.
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

function relojManual(): { reloj: Reloj; avanzar: (ms: number) => void } {
  let t = 0;
  let siguiente = 1;
  const pendientes = new Map<number, (ahora: number) => void>();
  return {
    reloj: {
      programar(cb) {
        const id = siguiente++;
        pendientes.set(id, cb);
        return id;
      },
      cancelar(id) {
        pendientes.delete(id);
      },
      ahora: () => t,
    },
    avanzar(ms: number): void {
      const objetivo = t + ms;
      while (t < objetivo && pendientes.size > 0) {
        t = Math.min(t + 16, objetivo);
        const cola = [...pendientes.values()];
        pendientes.clear();
        for (const cb of cola) cb(t);
      }
    },
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
const movimientoNormal: ConsultaMovimiento = { reducido: () => false, alCambiar: () => () => {} };

const aprobada: Calificacion = {
  precision: { otorgada: true },
  economia: { otorgada: true },
  abstraccion: { otorgada: true },
  conteoJugador: 1,
  presupuestoEstrella: 1,
  mensajeAbstraccion: null,
};

function almacenConMundo5Abierto(): Storage {
  const almacen = crearAlmacenMemoria();
  const p = cargarProgreso(almacen);
  for (const n of CATALOGO.filter((x) => x.mundo < 5)) p.guardar(n.id, 0, aprobada, 1);
  return almacen;
}

function crearApp(almacen: Storage, reloj: Reloj = relojInmediato(), movimiento = movimientoReducido): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen,
    reloj,
    relojEspera: relojEsperaInerte,
    relojRebote: relojReboteInmediato,
    movimiento,
    idNivel: '5.1',
  });
}

function escribir(app: Aplicacion, texto: string): void {
  app.editor.area.value = texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
}

const anuncio = (): string => document.getElementById('anuncios')!.textContent ?? '';
const indicador = (): Element | null => document.querySelector('.kl-profundidad');
const estadoEstrella = (nombre: string): string | null =>
  document.querySelector(`.kl-estrella-${nombre} .kl-estrella-estado`)?.textContent ?? null;

const idsMundo5 = CATALOGO.filter((n) => n.mundo === 5).map((n) => n.id);

beforeEach(() => {
  montarDom();
});

describe('main · mundo 5 de punta a punta', () => {
  it('el catálogo del mundo 5 es 5.1 a 5.5', () => {
    expect(idsMundo5).toEqual(['5.1', '5.2', '5.3', '5.4', '5.5']);
  });

  it('una espiral recursiva escrita a mano en el 5.1 gana las tres estrellas', () => {
    const app = crearApp(almacenConMundo5Abierto());
    expect(app.nivelEnCurso()).toBe('5.1');
    escribir(
      app,
      ['PARA ESPIRAL :largo', '  SI :largo > 200 [ALTO]', '  AV :largo', '  GD 90', '  ESPIRAL :largo + 5', 'FIN', 'ESPIRAL 20'].join('\n'),
    );
    app.ejecutar();
    expect(['precision', 'economia', 'abstraccion'].map(estadoEstrella)).toEqual(['otorgada', 'otorgada', 'otorgada']);
  });

  it('la misma espiral sin recursión (a mano con REPITE) no gana la abstracción', () => {
    const app = crearApp(almacenConMundo5Abierto());
    escribir(app, 'AV 20 GD 90 AV 25 GD 90 AV 30 GD 90');
    app.ejecutar();
    expect(estadoEstrella('abstraccion')).not.toBe('otorgada');
  });

  it('una recursión sin caso base corta con un mensaje que nombra el procedimiento y la condición de corte', () => {
    const app = crearApp(almacenConMundo5Abierto());
    escribir(app, 'PARA ESPIRAL :largo\n  AV :largo\n  GD 90\n  ESPIRAL :largo + 5\nFIN\nESPIRAL 5');
    app.ejecutar();
    const texto = app.textoGlobo();
    expect(texto).toContain('ESPIRAL se llama a sí mismo sin parar');
    expect(texto).toContain('condición de corte');
    expect(app.estado().calificacion?.precision.otorgada).not.toBe(true);
  });

  it('completar 5.1 a 5.5 con tres estrellas otorga Recursión solo tras el último nivel', () => {
    const almacen = almacenConMundo5Abierto();
    const app = crearApp(almacen);
    idsMundo5.forEach((id, i) => {
      app.irANivel(id);
      const impreso = imprimir(app.estado().reto.referencia);
      if (!impreso.exito) throw new Error('la referencia no se puede imprimir');
      escribir(app, impreso.texto);
      app.ejecutar();
      expect(['precision', 'economia', 'abstraccion'].map(estadoEstrella), `estrellas del ${id}`).toEqual([
        'otorgada',
        'otorgada',
        'otorgada',
      ]);
      const ultimo = i === idsMundo5.length - 1;
      expect(insigniasDelMundo(5, cargarProgreso(almacen)).includes('recursion'), `progreso tras el ${id}`).toBe(ultimo);
    });
  });
});

describe('main · profundidad de la llamada en el paso a paso', () => {
  function listoParaPasos(texto: string): Aplicacion {
    const { reloj, avanzar } = relojManual();
    const app = crearApp(almacenConMundo5Abierto(), reloj, movimientoNormal);
    escribir(app, texto);
    app.ejecutar();
    avanzar(60000);
    app.reiniciar();
    return app;
  }

  const TEXTO = 'PARA P :n\n  SI :n = 0 [ALTO]\n  AV 10\n  P :n - 1\nFIN\nAV 5\nP 2\nAV 3';

  it('antes de dar un paso no hay indicador, y cada paso muestra y anuncia su profundidad', () => {
    const app = listoParaPasos(TEXTO);
    expect(indicador()).toBeNull();

    app.darPaso(); // AV 5 en el programa principal
    expect(app.indicadorProfundidad.profundidad()).toBe(0);
    expect(anuncio()).toContain('en el programa principal');

    app.darPaso(); // AV 10 dentro de P 2
    expect(app.indicadorProfundidad.profundidad()).toBe(1);
    expect(indicador()?.querySelector('.kl-profundidad-numero')?.textContent).toBe('1');
    expect(anuncio()).toContain('profundidad de llamada 1');

    app.darPaso(); // AV 10 dentro de P 1
    expect(app.indicadorProfundidad.profundidad()).toBe(2);
    expect(anuncio()).toContain('profundidad de llamada 2');
    expect(indicador()?.querySelectorAll('.kl-profundidad-casilla')).toHaveLength(2);
  });

  it('reiniciar oculta el indicador', () => {
    const app = listoParaPasos(TEXTO);
    app.darPaso();
    app.darPaso();
    expect(indicador()).not.toBeNull();
    app.reiniciar();
    expect(indicador()).toBeNull();
    expect(app.indicadorProfundidad.profundidad()).toBeNull();
  });

  it('antes del mundo 5 el paso a paso no muestra profundidad ni la nombra en el anuncio', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAplicacion({
      documento: document,
      almacen: null,
      reloj,
      relojEspera: relojEsperaInerte,
      relojRebote: relojReboteInmediato,
      movimiento: movimientoNormal,
      idNivel: '0.1',
    });
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(5000);
    app.reiniciar();
    app.darPaso();
    expect(indicador()).toBeNull();
    expect(anuncio()).not.toContain('profundidad');
  });
});

describe('main · correcciones de la auditoría', () => {
  it('ejecutar tras un paso a paso oculta el indicador y deja de anunciar profundidad', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearApp(almacenConMundo5Abierto(), reloj, movimientoNormal);
    escribir(app, 'PARA P :n\n  SI :n = 0 [ALTO]\n  AV 10\n  P :n - 1\nFIN\nP 2');
    app.ejecutar();
    avanzar(60000);
    app.reiniciar();
    app.darPaso();
    app.darPaso();
    expect(indicador()).not.toBeNull();
    app.ejecutar();
    expect(indicador()).toBeNull();
    expect(app.indicadorProfundidad.profundidad()).toBeNull();
  });

  it('un texto con miles de listas anidadas muestra un mensaje en español en lugar de fallar en silencio', () => {
    const app = crearApp(almacenConMundo5Abierto());
    escribir(app, 'SI 1 = 1 ['.repeat(5000));
    expect(() => app.ejecutar()).not.toThrow();
    expect(app.textoGlobo()).toContain('listas metidas una dentro de otra');
  });
});
