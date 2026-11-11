// @vitest-environment jsdom
//
// Cableado de las señales transversales de progreso (spec 04, R11): abrir una pista,
// lanzar la demostración y usar «Ver en paralelo» deben escribir su señal en `Progreso`,
// y un fallo al persistirla no debe interrumpir la acción del jugador (R11.11).
//
// `cargarProgreso` se envuelve para poder observar las tres escrituras de señal y, cuando
// el test lo pide, hacer que lancen. El resto del Progreso es el real.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from './main.js';
import type { Reloj } from './motor/animador.js';
import type { RelojEspera } from './ui/demostracion.js';
import type { RelojRebote } from './ui/editor.js';

const senales = vi.hoisted(() => ({
  fallar: false,
  pistas: [] as string[],
  vistas: [] as string[],
  paralelo: 0,
  /** Lo que decía la región aria-live en el instante de marcar el paralelo. */
  anuncioAlMarcarParalelo: null as string | null,
}));

vi.mock('./juego/progreso.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./juego/progreso.js')>();
  return {
    ...real,
    cargarProgreso: (...args: Parameters<typeof real.cargarProgreso>) => {
      const p = real.cargarProgreso(...args);
      return {
        ...p,
        marcarPistaAbierta: (idNivel: string) => {
          senales.pistas.push(idNivel);
          if (senales.fallar) throw new Error('fallo simulado al persistir la pista');
          p.marcarPistaAbierta(idNivel);
        },
        registrarVistaDemostracion: (idNivel: string) => {
          senales.vistas.push(idNivel);
          if (senales.fallar) throw new Error('fallo simulado al persistir la vista');
          p.registrarVistaDemostracion(idNivel);
        },
        marcarReproduccionParalelaUsada: () => {
          senales.paralelo += 1;
          senales.anuncioAlMarcarParalelo = document.getElementById('anuncios')?.textContent ?? null;
          if (senales.fallar) throw new Error('fallo simulado al persistir el paralelo');
          p.marcarReproduccionParalelaUsada();
        },
      };
    },
  };
});

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
    almacen: null,
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte,
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    idNivel: '0.1',
  });
}

function escribir(app: Aplicacion, texto: string): void {
  app.editor.area.value = texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
}

const anuncios = (): string => document.getElementById('anuncios')!.textContent ?? '';
const botonParalelo = (): HTMLButtonElement => document.querySelector<HTMLButtonElement>('.kl-control-paralelo')!;

beforeEach(() => {
  montarDom();
  senales.fallar = false;
  senales.pistas = [];
  senales.vistas = [];
  senales.paralelo = 0;
  senales.anuncioAlMarcarParalelo = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('main · señales transversales cableadas (R11.1 a R11.3)', () => {
  it('pedir una pista marca la pista abierta del nivel en curso, una vez por escalón mostrado', () => {
    const app = crearApp();
    app.globo.pedirPista();
    expect(senales.pistas).toEqual(['0.1']);
    app.globo.pedirPista();
    app.globo.pedirPista();
    expect(senales.pistas).toEqual(['0.1', '0.1', '0.1']);
    // El aviso «Ya te di todas las pistas» no cuenta como abrir una pista.
    app.globo.pedirPista();
    expect(app.textoGlobo()).toContain('Ya te di todas las pistas');
    expect(senales.pistas).toHaveLength(3);
  });

  it('la demostración que Kiro lanza al entrar al nivel cuenta como una vista', () => {
    crearApp();
    expect(senales.vistas).toEqual(['0.1']);
  });

  it('«Volver a ver la demostración» registra otra vista, una por demostración lanzada', () => {
    const app = crearApp();
    app.verDemostracion();
    expect(senales.vistas).toEqual(['0.1', '0.1']);
    app.verDemostracion();
    expect(senales.vistas).toHaveLength(3);
  });

  it('«Ver en paralelo» nace deshabilitada y sin intento activarla no marca nada', () => {
    crearApp();
    expect(botonParalelo().disabled).toBe(true);
    botonParalelo().click();
    expect(senales.paralelo).toBe(0);
  });

  it('con un intento ejecutado se habilita y, al activarla, marca la señal ANTES de reproducir', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    expect(botonParalelo().disabled).toBe(false);

    botonParalelo().click();

    expect(senales.paralelo).toBe(1);
    // Al marcar la señal todavía no se había anunciado la reproducción...
    expect(senales.anuncioAlMarcarParalelo ?? '').not.toContain('paralelo');
    // ...y después sí: el jugador ve el efecto.
    expect(anuncios()).toContain('paralelo');
  });

  it('un nivel nuevo descarta el intento: «Ver en paralelo» vuelve a quedar deshabilitada', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    expect(botonParalelo().disabled).toBe(false);
    app.irANivel('0.1', 7);
    expect(botonParalelo().disabled).toBe(true);
  });
});

describe('main · un fallo al persistir una señal no interrumpe al jugador (R11.11, Property 19)', () => {
  /** Valida el fallo simulado, el rastro en consola, y devuelve el espía. */
  function espiarConsola(): ReturnType<typeof vi.spyOn> {
    return vi.spyOn(console, 'error').mockImplementation(() => {});
  }

  beforeEach(() => {
    senales.fallar = true;
  });

  it('el arranque con la demostración inicial fallando no impide montar el nivel', () => {
    const consola = espiarConsola();
    let app!: Aplicacion;
    expect(() => (app = crearApp())).not.toThrow();
    // La guía del 0.1 pisa el anuncio inicial, así que lo observable es el nivel montado
    // con su saludo y el rastro del fallo.
    expect(app.nivelEnCurso()).toBe('0.1');
    expect(app.textoGlobo().trim().length).toBeGreaterThan(0);
    expect(senales.vistas).toEqual(['0.1']);
    expect(consola).toHaveBeenCalledWith('No se pudo registrar la señal de progreso.', expect.any(Error));
  });

  it('pedir una pista muestra el escalón aunque la señal falle', () => {
    const consola = espiarConsola();
    const app = crearApp();
    expect(() => app.globo.pedirPista()).not.toThrow();
    expect(app.textoGlobo()).toContain('Pista conceptual');
    expect(app.globo.escalonesAbiertos()).toBe(1);
    expect(senales.pistas).toEqual(['0.1']);
    expect(consola).toHaveBeenCalledWith('No se pudo registrar la señal de progreso.', expect.any(Error));
  });

  it('volver a ver la demostración la lanza aunque la señal falle', () => {
    const consola = espiarConsola();
    const app = crearApp();
    document.getElementById('anuncios')!.textContent = '';
    expect(() => app.verDemostracion()).not.toThrow();
    expect(anuncios()).toContain('Kiro empieza a dibujar.');
    expect(senales.vistas).toHaveLength(2);
    expect(consola).toHaveBeenCalledTimes(2);
  });

  it('pulsar «Ver en paralelo» reproduce aunque la señal falle', () => {
    const consola = espiarConsola();
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    document.getElementById('anuncios')!.textContent = '';
    expect(() => botonParalelo().click()).not.toThrow();
    expect(senales.paralelo).toBe(1);
    expect(anuncios()).toContain('paralelo');
    expect(consola).toHaveBeenCalledWith('No se pudo registrar la señal de progreso.', expect.any(Error));
  });
});
