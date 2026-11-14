// @vitest-environment jsdom
//
// Desafío infinito en la interfaz (spec 04, R12): el control solo aparece cuando el desafío
// del mundo del nivel en curso está disponible, al activarlo carga el primer reto generado
// de la secuencia y muestra la raíz como código compartible, «Siguiente reto» solo se abre
// tras aprobar, y el desafío se descarta si el jugador cambia de nivel por otro camino.
//
// Se usa el mundo 0 (retroactivo, R7.7): completarlo es sembrar su precisión en un almacén
// en memoria que la aplicación lee al arrancar.
import { describe, it, expect, beforeEach } from 'vitest';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from './main.js';
import type { Reloj } from './motor/animador.js';
import type { RelojEspera } from './ui/demostracion.js';
import type { RelojRebote } from './ui/editor.js';
import { cargarProgreso } from './juego/progreso.js';
import type { Calificacion } from './juego/estrellas.js';
import { CATALOGO } from './niveles/catalogo.js';
import { imprimir } from './lenguaje/impresor.js';
import { decodificar } from './azar/codigo-semilla.js';
import { nivelesGeneradosDelMundo, retoDesafio } from './juego/desafio-infinito.js';
import { resolverReto } from './juego/reto.js';

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

/** Almacén con todo el mundo indicado aprobado (precisión), o vacío si no se pide. */
function almacenConMundoCompleto(mundo: number | null): Storage {
  const almacen = crearAlmacenMemoria();
  if (mundo !== null) {
    const p = cargarProgreso(almacen);
    for (const n of CATALOGO.filter((x) => x.mundo === mundo)) p.guardar(n.id, 0, aprobada, 1);
  }
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
    idNivel: '0.1',
  });
}

const raizControl = (): HTMLElement => document.querySelector<HTMLElement>('.kl-control-desafio')!;
const botonControl = (): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>('.kl-control-desafio-boton')!;
const codigoMostrado = (): string =>
  document.querySelector('.kl-control-desafio output')?.textContent ?? '';

/** Escribe y ejecuta la referencia del reto en curso: es una resolución correcta. */
function resolverElRetoEnCurso(app: Aplicacion): void {
  const impreso = imprimir(app.estado().reto.referencia);
  if (!impreso.exito) throw new Error('la referencia no se puede imprimir');
  app.editor.area.value = impreso.texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
  app.ejecutar();
}

beforeEach(() => {
  montarDom();
});

describe('main · desafío infinito (R12.1, R12.2)', () => {
  it('con el mundo incompleto el control no se muestra', () => {
    crearApp(almacenConMundoCompleto(null));
    expect(raizControl().hidden).toBe(true);
  });

  it('con el mundo del nivel en curso completo el control se muestra como «Desafío infinito»', () => {
    crearApp(almacenConMundoCompleto(0));
    expect(raizControl().hidden).toBe(false);
    expect(botonControl().textContent).toBe('Desafío infinito');
    expect(botonControl().getAttribute('aria-label')).toBe('Iniciar el desafío infinito del mundo 0');
  });

  it('al aprobar el último nivel del mundo el control aparece sin recargar', () => {
    const almacen = almacenConMundoCompleto(null);
    const p = cargarProgreso(almacen);
    const niveles = CATALOGO.filter((n) => n.mundo === 0);
    for (const n of niveles.slice(0, -1)) p.guardar(n.id, 0, aprobada, 1);
    const app = crearAplicacion({
      documento: document,
      almacen,
      reloj: relojInmediato(),
      relojEspera: relojEsperaInerte,
      relojRebote: relojReboteInmediato,
      movimiento: movimientoReducido,
      idNivel: niveles[niveles.length - 1]!.id,
    });
    expect(raizControl().hidden).toBe(true);
    resolverElRetoEnCurso(app);
    expect(app.estado().calificacion?.precision.otorgada).toBe(true);
    expect(raizControl().hidden).toBe(false);
  });
});

describe('main · iniciar el desafío (R12.3, R12.6, R12.8)', () => {
  it('carga un reto generado del mundo y muestra la raíz como código compartible', () => {
    const app = crearApp(almacenConMundoCompleto(0));
    botonControl().click();

    const generados = nivelesGeneradosDelMundo(0);
    expect(generados).toContain(app.nivelEnCurso());
    expect(app.estado().reto.nivel.origen.tipo).toBe('generado');

    const raiz = decodificar(codigoMostrado());
    expect(raiz.exito).toBe(true);
    if (!raiz.exito) return;
    // El primer reto es exactamente el índice 0 de la secuencia de esa raíz.
    const esperado = retoDesafio(0, raiz.semilla, 0);
    expect(app.nivelEnCurso()).toBe(esperado.idNivel);
    const r = resolverReto(esperado.idNivel, esperado.semilla);
    expect(r.exito && r.reto.semillaEfectiva).toBe(app.estado().reto.semillaEfectiva);
  });

  it('en curso, el botón pasa a «Siguiente reto» y queda deshabilitado hasta aprobar', () => {
    crearApp(almacenConMundoCompleto(0));
    botonControl().click();
    expect(botonControl().textContent).toBe('Siguiente reto');
    expect(botonControl().getAttribute('aria-label')).toBe('Ir al siguiente reto del desafío infinito');
    expect(botonControl().disabled).toBe(true);
    botonControl().click();
    expect(codigoMostrado()).not.toBe('');
  });

  it('no existe ningún control de retroceso mientras el desafío está en curso (R12.5)', () => {
    crearApp(almacenConMundoCompleto(0));
    botonControl().click();
    expect(raizControl().querySelectorAll('button, input, select, a')).toHaveLength(1);
  });
});

describe('main · siguiente reto (R12.4)', () => {
  it('tras aprobar el reto en curso se habilita y avanza al índice 1 con la misma raíz', () => {
    const app = crearApp(almacenConMundoCompleto(0));
    botonControl().click();
    const codigo = codigoMostrado();
    const raiz = decodificar(codigo);
    if (!raiz.exito) throw new Error('raíz no decodificable');

    resolverElRetoEnCurso(app);
    expect(app.estado().calificacion?.precision.otorgada).toBe(true);
    expect(botonControl().disabled).toBe(false);

    botonControl().click();
    const esperado = retoDesafio(0, raiz.semilla, 1);
    expect(app.nivelEnCurso()).toBe(esperado.idNivel);
    const r = resolverReto(esperado.idNivel, esperado.semilla);
    expect(r.exito && r.reto.semillaEfectiva).toBe(app.estado().reto.semillaEfectiva);
    // La raíz no cambia entre retos y el nuevo reto vuelve a pedir aprobación.
    expect(codigoMostrado()).toBe(codigo);
    expect(botonControl().disabled).toBe(true);
  });
});

describe('main · el desafío se descarta al cambiar de nivel por otro camino', () => {
  it('irANivel (menú) vuelve el control a «Desafío infinito»', () => {
    const app = crearApp(almacenConMundoCompleto(0));
    botonControl().click();
    app.irANivel('0.1');
    expect(botonControl().textContent).toBe('Desafío infinito');
    expect(codigoMostrado()).toBe('');
  });

  it('«Otro reto» descarta el desafío', () => {
    const app = crearApp(almacenConMundoCompleto(0));
    botonControl().click();
    app.panelSemilla.botonOtroReto.click();
    expect(botonControl().textContent).toBe('Desafío infinito');
    expect(codigoMostrado()).toBe('');
  });

  it('reproducir un código descarta el desafío', () => {
    const app = crearApp(almacenConMundoCompleto(0));
    botonControl().click();
    app.panelSemilla.campoCodigo.value = codigoMostrado();
    app.panelSemilla.botonReproducir.click();
    expect(botonControl().textContent).toBe('Desafío infinito');
  });
});
