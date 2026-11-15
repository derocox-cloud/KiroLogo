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
import { cargarProgreso } from './juego/progreso.js';
import { insigniasTransversalesOtorgadas } from './juego/insignias.js';
import { CATALOGO } from './niveles/catalogo.js';
import { imprimir } from './lenguaje/impresor.js';

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

function crearApp(almacen: Storage | null = null): Aplicacion {
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

// ----------------------------------------------------------------------------------------
// De punta a punta (spec 04, tarea 17.1, R11.4 a R11.10): se parte de la acción del jugador
// en la interfaz, con un almacén en memoria, y se verifica sobre un `Progreso` RECARGADO con
// `cargarProgreso(almacen)`, es decir, lo que realmente quedó persistido. Las insignias se
// leen con `insigniasTransversalesOtorgadas`, la misma función que usa el mapa de insignias.
// ----------------------------------------------------------------------------------------

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

/** Escribe la referencia del reto en curso y la ejecuta: una resolución correcta. */
function resolverElRetoEnCurso(app: Aplicacion): void {
  const impreso = imprimir(app.estado().reto.referencia);
  if (!impreso.exito) throw new Error('la referencia no se puede imprimir');
  escribir(app, impreso.texto);
  app.ejecutar();
}

const idsMundo0 = CATALOGO.filter((n) => n.mundo === 0).map((n) => n.id);

/** Recorre el mundo 0 en orden, resolviendo cada nivel; `alLlegar` actúa antes de resolverlo. */
function completarMundo0(app: Aplicacion, alLlegar?: (id: string) => void): void {
  for (const id of idsMundo0) {
    app.irANivel(id);
    expect(app.nivelEnCurso()).toBe(id);
    alLlegar?.(id);
    resolverElRetoEnCurso(app);
    expect(app.estado().calificacion?.precision.otorgada).toBe(true);
  }
}

describe('main · señales persistidas de punta a punta (R11.9)', () => {
  it('abrir una pista deja pistaAbiertaEn verdadero solo para ese nivel', () => {
    const almacen = crearAlmacenMemoria();
    const app = crearApp(almacen);
    expect(cargarProgreso(almacen).pistaAbiertaEn('0.1')).toBe(false);

    app.globo.pedirPista();

    const recargado = cargarProgreso(almacen);
    expect(recargado.pistaAbiertaEn('0.1')).toBe(true);
    expect(recargado.pistaAbiertaEn('0.2')).toBe(false);
  });

  it('cada demostración lanzada suma una vista en el nivel en curso', () => {
    const almacen = crearAlmacenMemoria();
    const app = crearApp(almacen);
    // La demostración al entrar al nivel ya cuenta como una.
    expect(cargarProgreso(almacen).vistasDemostracionDe('0.1')).toBe(1);

    app.verDemostracion();
    expect(cargarProgreso(almacen).vistasDemostracionDe('0.1')).toBe(2);
    app.verDemostracion();

    const recargado = cargarProgreso(almacen);
    expect(recargado.vistasDemostracionDe('0.1')).toBe(3);
    expect(recargado.vistasDemostracionDe('0.2')).toBe(0);
  });

  it('«Ver en paralelo» persiste la bandera, y solo lo aprobado después cuenta como posterior', () => {
    const almacen = crearAlmacenMemoria();
    const app = crearApp(almacen);
    // 0.1 se aprueba ANTES de usar el paralelo: no es una aprobación posterior.
    resolverElRetoEnCurso(app);
    expect(cargarProgreso(almacen).reproduccionParalelaUsada()).toBe(false);

    botonParalelo().click();
    app.irANivel('0.2');
    resolverElRetoEnCurso(app);

    const recargado = cargarProgreso(almacen);
    expect(recargado.reproduccionParalelaUsada()).toBe(true);
    expect(recargado.aprobadoTrasReproduccionParalelaEn('0.1')).toBe(false);
    expect(recargado.aprobadoTrasReproduccionParalelaEn('0.2')).toBe(true);
  });
});

describe('main · insignias transversales de punta a punta (R11.10)', () => {
  it('Depurador: se otorga al aprobar el quinto nivel posterior al paralelo, no antes', () => {
    const almacen = crearAlmacenMemoria();
    const app = crearApp(almacen);
    // Un intento sin aprobar habilita el paralelo; se usa y recién entonces se aprueba.
    escribir(app, 'AVANZA 20');
    app.ejecutar();
    botonParalelo().click();
    expect(idsMundo0).toHaveLength(5);

    idsMundo0.forEach((id, i) => {
      app.irANivel(id);
      resolverElRetoEnCurso(app);
      const otorgadas = insigniasTransversalesOtorgadas(cargarProgreso(almacen));
      expect(otorgadas.includes('depurador'), `tras ${i + 1} aprobados`).toBe(i === 4);
    });
  });

  it('Depurador no se otorga si los 5 niveles se aprobaron sin haber usado el paralelo', () => {
    const almacen = crearAlmacenMemoria();
    completarMundo0(crearApp(almacen));
    expect(insigniasTransversalesOtorgadas(cargarProgreso(almacen))).not.toContain('depurador');
  });

  it('Sin pistas: se otorga al completar el mundo sin abrir ninguna pista', () => {
    const almacen = crearAlmacenMemoria();
    const app = crearApp(almacen);
    completarMundo0(app);
    expect(insigniasTransversalesOtorgadas(cargarProgreso(almacen))).toContain('sinPistas');
  });

  // Defecto original de la revisión: abrir una pista en CUALQUIER nivel del mundo debe
  // impedir la insignia, no solo en el primero ni en el último.
  it.each(idsMundo0)('Sin pistas NO se otorga si se abrió una pista en el nivel %s del mundo', (conPista) => {
    const almacen = crearAlmacenMemoria();
    const app = crearApp(almacen);
    completarMundo0(app, (id) => {
      if (id === conPista) app.globo.pedirPista();
    });

    const recargado = cargarProgreso(almacen);
    expect(recargado.pistaAbiertaEn(conPista)).toBe(true);
    // El mundo quedó completo con precisión en todos sus niveles: lo único que falta es la pista.
    for (const id of idsMundo0) expect(recargado.estrellasDe(id)?.precision).toBe(true);
    expect(insigniasTransversalesOtorgadas(recargado)).not.toContain('sinPistas');
  });

  it('Buen ojo: se otorga al resolver un nivel tras ver su demostración exactamente una vez', () => {
    const almacen = crearAlmacenMemoria();
    const app = crearApp(almacen);
    expect(cargarProgreso(almacen).vistasDemostracionDe('0.1')).toBe(1);
    expect(insigniasTransversalesOtorgadas(cargarProgreso(almacen))).not.toContain('buenOjo');

    resolverElRetoEnCurso(app);

    expect(insigniasTransversalesOtorgadas(cargarProgreso(almacen))).toContain('buenOjo');
  });

  it('Buen ojo no se otorga si el jugador vio la demostración más de una vez', () => {
    const almacen = crearAlmacenMemoria();
    const app = crearApp(almacen);
    app.verDemostracion();
    resolverElRetoEnCurso(app);

    const recargado = cargarProgreso(almacen);
    expect(recargado.vistasDemostracionDe('0.1')).toBe(2);
    expect(insigniasTransversalesOtorgadas(recargado)).not.toContain('buenOjo');
  });
});
