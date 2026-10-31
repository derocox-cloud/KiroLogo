// @vitest-environment jsdom
//
// Pruebas del arranque y el flujo de intento de KiroLogo (grupo 19), sobre el
// nivel 0.1. Monta el DOM con los identificadores que `main.ts` espera y usa
// dependencias inyectadas (relojes controlados, almacén en memoria, movimiento
// no reducido) para que el intérprete, el animador y las estrellas corran en
// jsdom sin `requestAnimationFrame` ni Canvas real.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from './main.js';
import type { Reloj } from './motor/animador.js';
import { DobleDibujo } from './motor/doble-dibujo.test.js';
import type { RelojEspera } from './ui/demostracion.js';
import type { RelojRebote } from './ui/editor.js';
import { comandosDelMundo, type Mundo } from './lenguaje/vocabulario.js';
import { crearPrng } from './azar/prng.js';

// Con `guarda` encendido, `ejecutar` corre el programa de verdad pero informa que una
// guarda lo cortó, como haría un `REPITE` sin fin: en el mundo 0 no hay forma de
// llegar a una guarda, y el camino de la guarda tiene que probarse.
const forzar = vi.hoisted(() => ({ guarda: false }));

vi.mock('./lenguaje/interprete.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./lenguaje/interprete.js')>();
  const { crearError } = await import('./lenguaje/errores.js');
  return {
    ...real,
    ejecutar: function* (...args: Parameters<typeof real.ejecutar>) {
      const resultado = yield* real.ejecutar(...args);
      return forzar.guarda
        ? { ...resultado, guardaActivada: 'pasos' as const, error: crearError('guardaPasos', {}) }
        : resultado;
    },
  };
});

// ============================================================================
// Montaje del DOM
// ============================================================================

/** Crea todos los elementos por id que `main.ts` consulta. */
function montarDom(): void {
  document.documentElement.lang = 'es';
  document.body.innerHTML = `
    <div id="aplicacion" role="application" aria-label="KiroLogo">
      <div id="anuncios" aria-live="polite" aria-atomic="true"></div>
      <div id="contenido-globo"></div>
      <canvas id="lienzo-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-jugador" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-jugador" width="800" height="800"></canvas>
      <select id="velocidad"><option value="1" selected>Normal</option></select>
    </div>
  `;
}

// ============================================================================
// Relojes y consultas controlados
// ============================================================================

/** Reloj de animación que dispara cada fotograma de inmediato al programarlo. */
function relojInmediato(): Reloj {
  let t = 0;
  return {
    programar(cb: (ahora: number) => void): number {
      // Avanza el tiempo por delante de cualquier duración de operación, para que
      // el fotograma aplique la operación en curso y siga hasta el fin.
      t += 100000;
      cb(t);
      return 1;
    },
    cancelar(): void {},
    ahora(): number {
      return t;
    },
  };
}

/** Reloj de espera que NO dispara solo (la demostración no arranca en las pruebas). */
function relojEsperaInerte(): RelojEspera {
  return {
    programar(): number {
      return 1;
    },
    cancelar(): void {},
  };
}

/** Reloj de rebote del editor que analiza de inmediato. */
const relojReboteInmediato: RelojRebote = {
  programar(cb: () => void): number {
    cb();
    return 1;
  },
  cancelar(): void {},
};

/** Movimiento reducido: siempre reducido, para que el animador dibuje de golpe. */
const movimientoReducido: ConsultaMovimiento = {
  reducido: () => true,
  alCambiar: () => () => {},
};

function crearApp(): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen: null, // memoria pura
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte(),
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    idNivel: '0.1',
  });
}

/** Escribe un texto en el editor simulando la escritura del jugador. */
function escribir(app: Aplicacion, texto: string): void {
  app.editor.area.value = texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
}

// ============================================================================
// Presentación inicial (19.1)
// ============================================================================

describe('main · presentación inicial del nivel 0.1', () => {
  beforeEach(() => {
    montarDom();
  });

  it('no arranca por el solo hecho de importar el módulo (guarda de document)', () => {
    // Si importar arrancara algo, este test ya habría fallado montando dos apps.
    // Aquí basta con que crear la app explícitamente funcione.
    expect(() => crearApp()).not.toThrow();
  });

  it('presenta editor vacío, contador 0 sin provisional y presupuesto 1', () => {
    const app = crearApp();
    expect(app.editor.texto()).toBe('');
    const contador = app.editor.estadoContador();
    expect(contador.conteo).toBe(0);
    expect(contador.provisional).toBe(false);
    // El presupuesto del nivel 0.1 es 1 (una sola instrucción de referencia).
    expect(app.estado().reto.presupuestoEstrella).toBe(1);
  });

  it('muestra en el globo un texto en español no vacío', () => {
    const app = crearApp();
    expect(app.textoGlobo().trim().length).toBeGreaterThan(0);
  });

  it('presenta los 6 comandos del mundo 0 en el panel', () => {
    crearApp();
    const botones = document.querySelectorAll('.kl-comando');
    expect(botones.length).toBe(6);
  });
});

// ============================================================================
// Flujo de intento (19.2)
// ============================================================================

describe('main · flujo de intento del nivel 0.1', () => {
  beforeEach(() => {
    montarDom();
  });

  it('(a) AVANZA 100 concede las tres estrellas', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();

    const cal = app.estado().calificacion;
    expect(cal).not.toBeNull();
    expect(cal!.precision.otorgada).toBe(true);
    expect(cal!.economia.otorgada).toBe(true);
    expect(cal!.abstraccion.otorgada).toBe(true);
  });

  it('(b) AVANZA 100 GIRADERECHA 90 AVANZA 100 niega precisión por exceso y economía nombrando 3 y 1', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100 GIRADERECHA 90 AVANZA 100');
    app.ejecutar();

    const cal = app.estado().calificacion;
    expect(cal).not.toBeNull();
    // La precisión se niega (el trazo sobra respecto de la referencia recta).
    expect(cal!.precision.otorgada).toBe(false);
    // La economía se niega: 3 instrucciones frente al presupuesto de 1.
    expect(cal!.economia.otorgada).toBe(false);
    expect(cal!.conteoJugador).toBe(3);
    expect(cal!.presupuestoEstrella).toBe(1);
    if (!cal!.economia.otorgada && cal!.economia.motivo.clave === 'presupuestoExcedido') {
      expect(cal!.economia.motivo.conteo).toBe(3);
      expect(cal!.economia.motivo.presupuesto).toBe(1);
    } else {
      throw new Error('Se esperaba el motivo presupuestoExcedido con 3 y 1');
    }
  });

  it('(c) AVANSA 100 muestra el mensaje exacto en el globo y no produce ninguna operación', () => {
    const app = crearApp();
    escribir(app, 'AVANSA 100');
    app.ejecutar();

    expect(app.textoGlobo()).toContain(
      'No sé cómo hacer AVANSA. ¿Querías decir AVANZA?',
    );
    // No hubo intérprete: ninguna operación aplicada y estado sin veredicto.
    expect(app.estado().operacionesJugador.length).toBe(0);
    expect(app.estado().veredicto).toBeNull();
    expect(app.estado().calificacion).toBeNull();
  });

  it('el anuncio aria-live final nombra las operaciones aplicadas', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    const anuncios = document.getElementById('anuncios')!;
    expect(anuncios.textContent).toMatch(/operación/i);
  });
});

// ============================================================================
// Flujo de intento con el atajo del panel (spec 09, tarea 1.7, requisitos 2.1 y 2.3)
//
// El panel inserta `insercion` (el nombre más un espacio para AVANZA), no el
// ejemplo con su número: el jugador completa el número a mano. Estas pruebas
// cierran ese flujo de punta a punta sobre el nivel 0.1: pulsar AVANZA y escribir
// el número da el mismo resultado que teclear `AVANZA 100`, y pulsar AVANZA sin
// completar el número cae en el error del catálogo, sin producir movimiento.
// ============================================================================

/**
 * Pulsa un atajo del panel como el jugador (clic en su botón `.kl-comando`), lo
 * que inserta su `insercion` en el cursor del editor. Devuelve el texto que quedó
 * en el área tras la inserción.
 */
function pulsarComando(app: Aplicacion, indice: number): string {
  const botones = document.querySelectorAll<HTMLButtonElement>('.kl-comando');
  botones[indice]!.click();
  return app.editor.area.value;
}

/** Completa el número tras el espacio que dejó el atajo, como teclearlo el jugador. */
function escribirTrasAtajo(app: Aplicacion, numero: string): void {
  app.editor.area.value += numero;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
}

describe('main · flujo de intento con el atajo del panel (tarea 1.7, requisitos 2.1 y 2.3)', () => {
  beforeEach(() => {
    montarDom();
  });

  it('pulsar AVANZA, escribir 100 tras el espacio y ejecutar da las tres estrellas, igual que AVANZA 100', () => {
    const app = crearApp();
    // El primer atajo del mundo 0 es AVANZA: al pulsarlo inserta «AVANZA » con el
    // cursor tras el espacio, sin ningún dígito (ese es el cambio de la spec 09).
    const insertado = pulsarComando(app, 0);
    expect(insertado).toBe('AVANZA ');
    escribirTrasAtajo(app, '100');
    expect(app.editor.texto()).toBe('AVANZA 100');

    app.ejecutar();

    const cal = app.estado().calificacion;
    expect(cal).not.toBeNull();
    expect(cal!.precision.otorgada).toBe(true);
    expect(cal!.economia.otorgada).toBe(true);
    expect(cal!.abstraccion.otorgada).toBe(true);
  });

  it('pulsar AVANZA y ejecutar sin número muestra el mensaje del catálogo y no produce ninguna operación', () => {
    const app = crearApp();
    pulsarComando(app, 0); // deja «AVANZA » sin número
    // Dispara el análisis del texto insertado, como haría el jugador al escribir.
    app.editor.area.dispatchEvent(new Event('input'));
    app.editor.analizarAhora();

    app.ejecutar();

    // El mensaje es exactamente el del Catalogo_Errores para el argumento faltante.
    expect(app.textoGlobo()).toContain(
      'AVANZA necesita un número. Por ejemplo: AVANZA 100',
    );
    // No hubo movimiento: ni operación aplicada ni veredicto ni calificación.
    expect(app.estado().operacionesJugador.length).toBe(0);
    expect(app.estado().veredicto).toBeNull();
    expect(app.estado().calificacion).toBeNull();
  });
});

// ============================================================================
// La animación del intento: la tortuga camina y el resultado espera a que termine
// ============================================================================

/** Reloj de animación con tiempo manual: los fotogramas solo ocurren cuando el test avanza. */
function relojManual(): { reloj: Reloj; avanzar: (ms: number) => void } {
  let t = 0;
  let siguiente = 1;
  const pendientes = new Map<number, (ahora: number) => void>();
  return {
    reloj: {
      programar(cb: (ahora: number) => void): number {
        const id = siguiente++;
        pendientes.set(id, cb);
        return id;
      },
      cancelar(id: number): void {
        pendientes.delete(id);
      },
      ahora(): number {
        return t;
      },
    },
    avanzar(ms: number): void {
      const objetivo = t + ms;
      while (t < objetivo && pendientes.size > 0) {
        t = Math.min(t + 16, objetivo);
        const cola = [...pendientes.values()];
        pendientes.clear();
        for (const cb of cola) cb(t);
      }
      t = objetivo;
    },
  };
}

/** Movimiento sin reducir: el animador SÍ reproduce en el tiempo. */
const movimientoNormal: ConsultaMovimiento = {
  reducido: () => false,
  alCambiar: () => () => {},
};

function crearAppAnimada(reloj: Reloj, almacen: Storage | null = null): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen,
    reloj,
    relojEspera: relojEsperaInerte(),
    relojRebote: relojReboteInmediato,
    movimiento: movimientoNormal,
    idNivel: '0.1',
  });
}

const boton = (accion: string): HTMLButtonElement =>
  document.querySelector<HTMLButtonElement>(`.kl-control-${accion}`)!;

const estrellas = (): Array<string | null> =>
  [...document.querySelectorAll('.kl-estrella')].map((e) => e.getAttribute('data-estado'));

/** Desbloquea el 0.2: termina de dibujar un intento correcto del 0.1. */
function aprobarElNivelUno(app: Aplicacion, avanzar: (ms: number) => void): void {
  escribir(app, 'AVANZA 100');
  app.ejecutar();
  avanzar(2000);
}

describe('main · el intento se evalúa al terminar de dibujar (diseño 12.5, requisitos 24.7 a 24.9)', () => {
  beforeEach(() => {
    montarDom();
  });

  afterEach(() => {
    forzar.guarda = false;
  });

  it('mientras la tortuga camina, ejecutar queda apagado, detener disponible y el resultado sin revelar', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(100);

    expect(boton('ejecutar').disabled).toBe(true);
    expect(boton('detener').disabled).toBe(false);
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
    expect(app.textoGlobo()).not.toContain('Resultado');
  });

  it('no se califica ni se guarda nada hasta que termina de dibujar', () => {
    const { reloj, avanzar } = relojManual();
    const almacen = crearAlmacenMemoria();
    const app = crearAppAnimada(reloj, almacen);
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(100);

    // Lo que ya se sabe del intento está en el estado; el veredicto y las estrellas, no.
    expect(app.estado().operacionesJugador.length).toBe(1);
    expect(app.estado().veredicto).toBeNull();
    expect(app.estado().calificacion).toBeNull();
    montarDom();
    expect(crearAppAnimada(relojManual().reloj, almacen).menuMundos.estadoDe('0.2')).toBe('bloqueado');

    // Al terminar sí.
    montarDom();
    const { reloj: reloj2, avanzar: avanzar2 } = relojManual();
    const app2 = crearAppAnimada(reloj2, almacen);
    escribir(app2, 'AVANZA 100');
    app2.ejecutar();
    avanzar2(2000);
    expect(app2.estado().calificacion!.precision.otorgada).toBe(true);
    montarDom();
    expect(crearAppAnimada(relojManual().reloj, almacen).menuMundos.estadoDe('0.2')).toBe('desbloqueado');
  });

  it('al terminar de dibujar revela el resultado: estrellas, comentario de Kiro y controles', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(2000);

    expect(estrellas()).toEqual(['otorgada', 'otorgada', 'otorgada']);
    expect(app.textoGlobo()).toContain('Resultado');
    expect(boton('ejecutar').disabled).toBe(false);
    expect(boton('detener').disabled).toBe(true);
    expect(document.getElementById('anuncios')!.textContent).toMatch(/Terminó tu programa: 1 operación/);
  });

  it('Detener no otorga ninguna estrella ni muestra resultado, no guarda nada y lo anuncia (24.7, 28.9)', () => {
    const { reloj, avanzar } = relojManual();
    const almacen = crearAlmacenMemoria();
    const app = crearAppAnimada(reloj, almacen);
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(100);

    boton('detener').click();

    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
    expect(app.estado().calificacion).toBeNull();
    expect(app.textoGlobo()).not.toContain('Resultado');
    expect(boton('ejecutar').disabled).toBe(false);
    expect(boton('detener').disabled).toBe(true);
    expect(document.getElementById('anuncios')!.textContent).toMatch(/Detuviste tu programa: 1 operación/);

    // El intento no cuenta: ni aunque pase el tiempo se evalúa después.
    avanzar(5000);
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
    montarDom();
    expect(crearAppAnimada(relojManual().reloj, almacen).menuMundos.estadoDe('0.2')).toBe('bloqueado');
  });

  it('Detener termina el tramo en curso: la estela no queda a medias (14.3)', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(100);
    boton('detener').click();
    // La única operación se aplicó entera: el anuncio nombra la posición final, no una intermedia.
    expect(document.getElementById('anuncios')!.textContent).toContain('posición (0, 100)');
  });

  it('Reiniciar a media animación no otorga nada; recorrer el intento paso a paso hasta el final sí lo evalúa (14.5, 24.8)', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(100);

    app.reiniciar();
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
    expect(boton('ejecutar').disabled).toBe(false);
    avanzar(5000);
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);

    // La secuencia se conserva: un paso aplica su única operación y llega al final.
    app.darPaso();
    expect(estrellas()).toEqual(['otorgada', 'otorgada', 'otorgada']);
  });

  it('cambiar de nivel a media animación descarta el intento: no se evalúa ni se revela en el nivel nuevo', () => {
    const { reloj, avanzar } = relojManual();
    const almacen = crearAlmacenMemoria();
    const app = crearAppAnimada(reloj, almacen);
    aprobarElNivelUno(app, avanzar); // abre el 0.2
    app.ejecutar(); // un segundo intento
    avanzar(100);

    app.irANivel('0.2');
    avanzar(5000);

    expect(app.nivelEnCurso()).toBe('0.2');
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
    expect(app.textoGlobo()).not.toContain('Resultado');
    expect(app.estado().calificacion).toBeNull();
    expect(boton('ejecutar').disabled).toBe(false);
    // Ni se anuncia que se detuvo un programa: cambiar de nivel no es pulsar Detener.
    expect(document.getElementById('anuncios')!.textContent).not.toMatch(/Detuviste/);
  });

  it('un intento nuevo vuelve las estrellas a pendiente mientras se dibuja', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    aprobarElNivelUno(app, avanzar);
    expect(estrellas()).toEqual(['otorgada', 'otorgada', 'otorgada']);

    app.ejecutar();
    avanzar(50);

    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
  });

  it('una guarda muestra el mensaje de su catálogo, sin estrellas y sin guardar nada (24.9)', () => {
    const { reloj, avanzar } = relojManual();
    const almacen = crearAlmacenMemoria();
    const app = crearAppAnimada(reloj, almacen);
    forzar.guarda = true;
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(2000);

    expect(app.textoGlobo()).toContain('Detuve la ejecución: la tortuga llevaba demasiados pasos');
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
    expect(app.estado().calificacion).toBeNull();
    expect(app.estado().veredicto).toBeNull();
    expect(document.getElementById('anuncios')!.textContent).toMatch(/Detuve tu programa por seguridad/);
    expect(boton('ejecutar').disabled).toBe(false);
    // El programa no se toca (el editor sigue igual).
    expect(app.editor.texto()).toBe('AVANZA 100');
    // El reto de referencia también corre por el intérprete: la guarda forzada se apaga
    // antes de recrear la aplicación.
    forzar.guarda = false;
    montarDom();
    expect(crearAppAnimada(relojManual().reloj, almacen).menuMundos.estadoDe('0.2')).toBe('bloqueado');
  });

  it('el selector marca el nivel en curso con aria-current', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj, crearAlmacenMemoria());
    expect(app.menuMundos.botonNivel('0.1')!.getAttribute('aria-current')).toBe('step');

    aprobarElNivelUno(app, avanzar);
    app.irANivel('0.2');

    expect(app.menuMundos.botonNivel('0.2')!.getAttribute('aria-current')).toBe('step');
    expect(app.menuMundos.botonNivel('0.1')!.hasAttribute('aria-current')).toBe(false);
  });
});

// ============================================================================
// Tarea 3.3 · La calificación se entrega al dibujar la última operación, no al
// activar «ejecutar»; y al terminar o detener la tortuga vuelve al Estado inicial
// sin borrar la estela (requisitos 3.5, 3.6, 3.7).
//
// Las pruebas del grupo anterior ya confirman que a media animación no hay
// calificación y que al terminar sí, y que la tortuga vuelve al inicio con el
// trazo a la vista. Aquí se cierran los huecos exactos de la tarea 3.3: (a) que
// activar «ejecutar» NO entrega la calificación de forma síncrona (cero
// fotogramas aún), (b) que en un programa de varias operaciones la calificación
// se retiene hasta aplicar la ÚLTIMA, no una intermedia, y que la secuencia
// entregada a las Estrellas es la completa, y (c) que la entrega de la
// calificación y la vuelta al Estado inicial coinciden en ese último fotograma,
// conservando la estela ya dibujada.
// ============================================================================

describe('main · tarea 3.3 · evaluación al terminar de dibujar y vuelta al inicio (3.5, 3.6, 3.7)', () => {
  beforeEach(() => {
    montarDom();
  });

  it('activar «ejecutar» no califica de forma síncrona: sin avanzar un solo fotograma, veredicto y estrellas siguen pendientes (3.6)', () => {
    const { reloj } = relojManual();
    const almacen = crearAlmacenMemoria();
    const app = crearAppAnimada(reloj, almacen);
    escribir(app, 'AVANZA 100');

    app.ejecutar();
    // No se avanza el reloj: ningún fotograma corrió todavía. La calificación no
    // puede haberse entregado por el solo hecho de activar «ejecutar».
    expect(app.estado().veredicto).toBeNull();
    expect(app.estado().calificacion).toBeNull();
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
    // Y nada se guardó: el 0.2 sigue bloqueado hasta que el intento termine de dibujarse.
    montarDom();
    expect(crearAppAnimada(relojManual().reloj, almacen).menuMundos.estadoDe('0.2')).toBe('bloqueado');
  });

  it('en un programa de varias operaciones la calificación se retiene hasta aplicar la última (3.6)', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    // Tres operaciones: avanzar, girar y avanzar. A velocidad normal cada una tarda
    // 400 ms, así que a los 500 ms ya se aplicó la primera pero faltan las otras.
    escribir(app, 'AVANZA 100\nGIRADERECHA 90\nAVANZA 100');

    app.ejecutar();
    avanzar(500);
    // Ya se dibuja, pero aún no es la última operación: sin calificación todavía.
    expect(app.estado().operacionesJugador.length).toBe(3);
    expect(app.estado().calificacion).toBeNull();
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);

    // Al terminar de dibujar la última, la calificación se entrega.
    avanzar(5000);
    expect(app.estado().calificacion).not.toBeNull();
  });

  it('la secuencia entregada a las Estrellas es la completa: el conteo califica las tres operaciones (3.6)', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    escribir(app, 'AVANZA 100\nGIRADERECHA 90\nAVANZA 100');
    app.ejecutar();
    avanzar(5000);

    const cal = app.estado().calificacion;
    expect(cal).not.toBeNull();
    // Se califica la secuencia entera (tres instrucciones), no un prefijo de ella.
    expect(cal!.conteoJugador).toBe(3);
  });

  it('al entregar la calificación la tortuga ya está de vuelta en el Estado inicial, con la estela intacta (3.6, 3.7)', () => {
    const { reloj, avanzar } = relojManual();
    const almacen = crearAlmacenMemoria();
    const app = crearAppAnimada(reloj, almacen);
    escribir(app, 'AVANZA 100');

    app.ejecutar();
    avanzar(5000);

    // La calificación se entregó al aprobar el intento.
    expect(app.estado().calificacion).not.toBeNull();
    expect(app.estado().calificacion!.precision.otorgada).toBe(true);
    // La estela del intento no se borró al volver la tortuga: el 0.2 quedó
    // desbloqueado tras aprobar, prueba de que el intento dibujado se evaluó entero.
    montarDom();
    expect(crearAppAnimada(relojManual().reloj, almacen).menuMundos.estadoDe('0.2')).toBe('desbloqueado');
  });

  it('detener en mitad de un programa de varias operaciones no entrega calificación y deja la tortuga en el inicio (3.7)', () => {
    const { reloj, avanzar } = relojManual();
    const almacen = crearAlmacenMemoria();
    const app = crearAppAnimada(reloj, almacen);
    escribir(app, 'AVANZA 100\nGIRADERECHA 90\nAVANZA 100');

    app.ejecutar();
    avanzar(500); // se aplicó la primera operación, faltan las demás
    boton('detener').click();

    // Detener no entrega ninguna calificación del intento inconcluso.
    expect(app.estado().calificacion).toBeNull();
    expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
    // El anuncio de detención dice que se detuvo y dónde quedó el trazo, sin mostrar
    // resultado; la silueta de la tortuga sí vuelve al Estado inicial.
    expect(document.getElementById('anuncios')!.textContent).toMatch(/Detuviste tu programa/);
    expect(app.textoGlobo()).not.toContain('Resultado');
    // La tortuga volvió al Estado inicial: recorrido paso a paso parte del inicio.
    app.reiniciar();
    app.darPaso();
    expect(document.getElementById('anuncios')!.textContent).toBe(
      'Línea 1: posición (0, 100), rumbo 0°, lápiz abajo.',
    );
    // Nada se guardó: el 0.2 sigue bloqueado.
    montarDom();
    expect(crearAppAnimada(relojManual().reloj, almacen).menuMundos.estadoDe('0.2')).toBe('bloqueado');
  });
});

describe('main · el paso a paso anuncia cada operación (requisito 28.2)', () => {
  beforeEach(() => {
    montarDom();
  });

  const anuncio = (): string => document.getElementById('anuncios')!.textContent ?? '';

  /** Ejecuta un programa de principio a fin y lo reinicia, listo para recorrerlo paso a paso. */
  function listoParaPasos(texto: string): Aplicacion {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    escribir(app, texto);
    app.ejecutar();
    avanzar(5000);
    app.reiniciar();
    return app;
  }

  it('cada paso publica el número de línea, la posición, el rumbo y el lápiz, sin omitir ninguno', () => {
    const app = listoParaPasos('AVANZA 100\nGIRADERECHA 90\nAVANZA 60');

    app.darPaso();
    expect(anuncio()).toBe('Línea 1: posición (0, 100), rumbo 0°, lápiz abajo.');
    app.darPaso();
    expect(anuncio()).toBe('Línea 2: posición (0, 100), rumbo 90°, lápiz abajo.');
    app.darPaso();
    expect(anuncio()).toMatch(/^Terminó tu programa: 3 operación/);
    expect(anuncio()).toContain('posición (60, 100)');
  });

  it('el rumbo se anuncia entre 0 y 359, nunca 360', () => {
    // Girar 0,4 a la izquierda da 359,6 grados: redondeado sería 360, que no existe.
    const app = listoParaPasos('GIRAIZQUIERDA 0.4\nAVANZA 20');
    app.darPaso();
    expect(anuncio()).toBe('Línea 1: posición (0, 0), rumbo 0°, lápiz abajo.');
  });

  it('una reproducción continua no anuncia cada paso intermedio, solo su final (28.9)', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    const vistos = new Set<string>();
    new MutationObserver(() => vistos.add(anuncio())).observe(document.getElementById('anuncios')!, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    escribir(app, 'AVANZA 100\nGIRADERECHA 90\nAVANZA 60');
    app.ejecutar();
    avanzar(5000);

    expect(anuncio()).toMatch(/^Terminó tu programa: 3 operación/);
    expect([...vistos].some((t) => t.startsWith('Línea '))).toBe(false);
  });
});

// ============================================================================
// El index.html real: ranuras y orden de foco (requisitos 24.5 y 28.1)
// ============================================================================

describe('main · con el index.html real', () => {
  /** Monta el cuerpo de index.html (sin su script) tal como lo ve el navegador. */
  function montarIndexReal(): void {
    const html = readFileSync(join(DIR_ESTE_ARCHIVO, '..', 'index.html'), 'utf8');
    const cuerpo = /<body>([\s\S]*)<\/body>/.exec(html)![1]!.replace(/<script[\s\S]*?<\/script>/g, '');
    document.documentElement.lang = 'es';
    document.body.innerHTML = cuerpo;
  }

  const FOCALIZABLE =
    'a[href], button:not([disabled]):not([tabindex="-1"]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])';
  const enfocables = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(FOCALIZABLE));

  beforeEach(() => {
    montarIndexReal();
  });

  it('cada pieza de la interfaz cae en su ranura de index.html', () => {
    crearAplicacion({
      documento: document,
      almacen: null,
      reloj: relojManual().reloj,
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoNormal,
      idNivel: '0.1',
    });
    const dentroDe = (ranura: string, selector: string): boolean =>
      document.querySelector(`#${ranura} ${selector}`) !== null;

    expect(dentroDe('ranura-ruta', '.kl-menu-mundos')).toBe(true);
    // La ranura de la paleta sigue en la cabecera (la spec 08 la deja) pero vacía: el
    // selector de colores se retiró y nada cuelga de ella.
    const ranuraPaleta = document.getElementById('ranura-paleta');
    expect(ranuraPaleta).not.toBeNull();
    expect(ranuraPaleta!.childElementCount).toBe(0);
    // El jugador ve en qué mundo está, en la cabecera y con todas sus letras: el
    // resumen del botón del menú nombra el mundo y el nivel en curso.
    expect(
      document.querySelector('#ranura-ruta .kl-menu-mundos-resumen')!.textContent,
    ).toMatch(/^Mundo 0 · Primeros pasos — 0\.1 /);
    expect(dentroDe('ranura-reto', '.kl-panel-semilla')).toBe(true);
    expect(dentroDe('ranura-marcador', '.kl-marcador')).toBe(true);
    for (const clase of ['.kl-globo', '.kl-editor', '.kl-controles', '.kl-panel-comandos']) {
      expect(dentroDe('programa', clase), clase).toBe(true);
    }
    // Y las capas de dibujo que main.ts busca por id están todas.
    for (const id of [
      'lienzo-fondo-referencia', 'lienzo-referencia', 'lienzo-personajes-referencia',
      'lienzo-fondo-jugador', 'lienzo-jugador', 'lienzo-personajes-jugador',
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
  });

  it('el logo es una imagen, pero el nombre del producto sigue siendo texto accesible: KiroLogo', () => {
    const titulo = document.querySelector('h1')!;
    const logo = titulo.querySelector('img');
    expect(logo).not.toBeNull();
    // Sin texto visible en el h1, el nombre accesible sale del alt, y es el del producto.
    expect(logo!.getAttribute('alt')).toBe('KiroLogo');
    expect(titulo.textContent!.trim()).toBe('');
    expect(logo!.getAttribute('src')).toMatch(/^\/marca\//);
  });

  function arrancar0_1(idNivel = '0.1') {
    const { reloj, avanzar } = relojManual();
    const app = crearAplicacion({
      documento: document,
      almacen: null,
      reloj,
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoNormal,
      idNivel,
    });
    return { app, avanzar };
  }
  const conmutador = (): HTMLButtonElement =>
    document.querySelector<HTMLButtonElement>('#ranura-comparacion .kl-comparacion-conmutador')!;
  const superposicion = (): HTMLCanvasElement => document.getElementById('lienzo-superposicion') as HTMLCanvasElement;
  const leyenda = (): HTMLElement => document.querySelector<HTMLElement>('#ranura-leyenda .kl-leyenda')!;

  it('cada figura lleva su rótulo, y la del jugador ofrece comparar con Kiro sin mostrarlo todavía (23.1)', () => {
    arrancar0_1();
    // Cada lienzo rotulado con un texto y un nombre accesible que dicen de quién es.
    expect(document.getElementById('titulo-referencia')!.textContent).toBe('Figura de Kiro');
    expect(document.getElementById('titulo-jugador')!.textContent).toBe('Tu figura');
    expect(document.getElementById('lienzo-referencia')!.getAttribute('aria-label')).toBe('Figura de Kiro');
    expect(document.getElementById('lienzo-jugador')!.getAttribute('aria-label')).toBe('Tu figura');
    // El botón, junto al título de tu figura; la superposición y la leyenda, ocultas al empezar.
    expect(conmutador().textContent).toBe('Comparar con Kiro');
    expect(conmutador().getAttribute('aria-pressed')).toBe('false');
    expect(superposicion().hidden).toBe(true);
    expect(leyenda().hidden).toBe(true);
    // La superposición va dentro del cuadro de tu figura, encima de sus tres capas.
    const capas = [...document.querySelectorAll('.kl-lienzo-jugador .kl-lienzo-cuadro canvas')].map((c) => c.id);
    expect(capas).toEqual([
      'lienzo-fondo-jugador',
      'lienzo-jugador',
      'lienzo-personajes-jugador',
      'lienzo-superposicion',
    ]);
    // Y la leyenda vive dentro de ese cuadro, para no sumar altura a la página.
    expect(document.querySelector('.kl-lienzo-jugador .kl-lienzo-cuadro #ranura-leyenda')).not.toBeNull();
  });

  it('el botón de comparar es alcanzable con Tab y viene después de los controles (orden visual)', () => {
    arrancar0_1();
    const orden = enfocables();
    expect(orden).toContain(conmutador());
    expect(orden.indexOf(conmutador())).toBeGreaterThan(
      orden.indexOf(document.querySelector<HTMLElement>('.kl-control-ejecutar')!),
    );
  });

  describe('comparación con Kiro (requisitos 23 y 27.5)', () => {
    /** Un doble que recuerda con qué color y grosor se hizo cada trazo. */
    class DobleConTrazos extends DobleDibujo {
      readonly trazos: Array<{ color: string; grosor: number; guiones: number[]; lineas: number[][] }> = [];
      private guionesActuales: number[] = [];
      override setLineDash(segmentos: number[]): void {
        this.guionesActuales = segmentos.slice();
        super.setLineDash(segmentos);
      }
      override stroke(): void {
        const desde = this.llamadas.map((l) => l.metodo).lastIndexOf('beginPath');
        const lineas: number[][] = [];
        let origen: number[] | null = null;
        for (const l of this.llamadas.slice(desde + 1)) {
          const a = l.args as number[];
          // El doble registra las esquinas del recorte (±400, ±400): no son una línea.
          if (Math.abs(a[0]!) === 400 && Math.abs(a[1]!) === 400) continue;
          if (l.metodo === 'moveTo') origen = a;
          if (l.metodo === 'lineTo' && origen !== null) lineas.push([origen[0]!, origen[1]!, a[0]!, a[1]!]);
        }
        this.trazos.push({
          color: String(this.strokeStyle),
          grosor: this.lineWidth,
          guiones: this.guionesActuales.slice(),
          lineas,
        });
        super.stroke();
      }
    }
    const dobles = new Map<string, DobleConTrazos>();

    beforeEach(() => {
      dobles.clear();
      // jsdom no trae Canvas: cada canvas recibe un doble que registra lo que se dibuja.
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
        this: HTMLCanvasElement,
      ) {
        let ctx = dobles.get(this.id);
        if (!ctx) {
          ctx = new DobleConTrazos();
          dobles.set(this.id, ctx);
        }
        return ctx as unknown as CanvasRenderingContext2D;
      } as never);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const FALLA = 'AVANZA 100 GIRADERECHA 90 AVANZA 100';

    it('un intento que falla la precisión pasa solo a la superposición, pinta el diff y lo anuncia', () => {
      const { app, avanzar } = arrancar0_1();
      escribir(app, FALLA);
      app.ejecutar();
      avanzar(5000);

      expect(estrellas()[0]).toBe('negada');
      // Nadie pulsó nada: la superposición, la leyenda y el botón ya lo reflejan.
      expect(superposicion().hidden).toBe(false);
      expect(leyenda().hidden).toBe(false);
      expect(conmutador().getAttribute('aria-pressed')).toBe('true');

      // El diff está pintado: lo que sobra, al menos el doble de grueso que lo que coincide.
      const grosores = dobles.get('lienzo-superposicion')!.trazos.map((t) => t.grosor);
      const sobra = Math.max(...grosores);
      expect(sobra).toBeGreaterThanOrEqual(10);
      expect(grosores).toContain(sobra / 2);
    });

    it('lo que sigue a Kiro en su sitio sale como coincidencia y solo lo que se pasa sale como sobrante', () => {
      const { app, avanzar } = arrancar0_1();
      // Kiro dibuja una línea de 100 hacia arriba. La L la sigue en la pierna vertical y se pasa
      // con la horizontal. En pantalla la pierna vertical está exactamente sobre la de Kiro.
      escribir(app, FALLA);
      app.ejecutar();
      avanzar(5000);

      const trazos = dobles.get('lienzo-superposicion')!.trazos;
      const rojo = trazos.filter((t) => t.grosor === 10).flatMap((t) => t.lineas);
      const verde = trazos.filter((t) => t.grosor === 5 && t.guiones.length === 0).flatMap((t) => t.lineas);
      const gris = trazos.filter((t) => t.grosor === 5 && t.guiones.length > 0).flatMap((t) => t.lineas);
      const largo = (ls: number[][]): number => ls.reduce((s, [x1, y1, x2, y2]) => s + Math.hypot(x2! - x1!, y2! - y1!), 0);

      // Lo que sobra es la pierna horizontal (y = 100): nada del rojo está sobre la vertical.
      expect(rojo.length).toBeGreaterThan(0);
      for (const [, y1, , y2] of rojo) {
        expect(y1!).toBeGreaterThan(95);
        expect(y2!).toBeGreaterThan(95);
      }
      // Lo que coincide es la pierna vertical entera (de y = 0 a y = 100), sobre la línea de Kiro.
      expect(verde.length).toBeGreaterThan(0);
      expect(Math.min(...verde.flatMap(([, y1, , y2]) => [y1!, y2!]))).toBeLessThan(2);
      expect(largo(verde.filter(([x1, , x2]) => Math.abs(x1!) < 1e-6 && Math.abs(x2!) < 1e-6))).toBeGreaterThan(90);
      // Y a Kiro no le falta nada: su línea está cubierta.
      expect(largo(gris)).toBeLessThan(10);
    });

    it('un dibujo incompleto, sobre los primeros tramos de Kiro, no marca como sobrante lo que está bien', () => {
      // El caso de «voy bien y lo pone rojo»: el zigzag del 0.5 con solo sus dos primeros tramos,
      // trazados exactamente donde Kiro los dibuja. No hay nada que sobre; faltan los demás. Con
      // dos tramos de cuatro, la caja envolvente del jugador tiene otro centro que la de Kiro, y el
      // validador desplaza el dibujo: en esa alineación los dos tramos «sobran».
      const { app, avanzar } = arrancar0_1('0.5');
      const [s1, s2] = app.estado().reto.segmentos;
      const largo = (s: { desde: { x: number; y: number }; hasta: { x: number; y: number } }): number =>
        Math.round(Math.hypot(s.hasta.x - s.desde.x, s.hasta.y - s.desde.y));
      // El giro entre los dos primeros tramos: producto cruzado (y hacia arriba), negativo = derecha.
      const cruz =
        (s1!.hasta.x - s1!.desde.x) * (s2!.hasta.y - s2!.desde.y) -
        (s1!.hasta.y - s1!.desde.y) * (s2!.hasta.x - s2!.desde.x);
      const giro = cruz < 0 ? 'GIRADERECHA' : 'GIRAIZQUIERDA';
      escribir(app, `AVANZA ${largo(s1!)} ${giro} 90 AVANZA ${largo(s2!)}`);
      app.ejecutar();
      avanzar(8000);

      expect(estrellas()[0]).toBe('negada'); // está incompleto: la precisión se niega
      const trazos = dobles.get('lienzo-superposicion')!.trazos;
      expect(trazos.filter((t) => t.grosor === 10).flatMap((t) => t.lineas)).toHaveLength(0);
      expect(trazos.filter((t) => t.grosor === 5 && t.guiones.length === 0).flatMap((t) => t.lineas).length).toBeGreaterThan(0);
      expect(trazos.filter((t) => t.grosor === 5 && t.guiones.length > 0).flatMap((t) => t.lineas).length).toBeGreaterThan(0);
    });

    it('anuncia el fin del programa y la comparación en un solo texto, sin que uno borre al otro', () => {
      const { app, avanzar } = arrancar0_1();
      escribir(app, FALLA);
      app.ejecutar();
      avanzar(5000);
      const anuncio = document.getElementById('anuncios')!.textContent ?? '';
      expect(anuncio).toMatch(/^Terminó tu programa: 3 operación/);
      expect(anuncio).toContain('Coincidencia (IoU) de');
      expect(anuncio).toMatch(/exceso de trazo del \d+\.\d %/);
    });

    it('un intento que acierta se queda en la vista normal y no anuncia comparación', () => {
      const { app, avanzar } = arrancar0_1();
      escribir(app, 'AVANZA 100');
      app.ejecutar();
      avanzar(5000);
      expect(estrellas()).toEqual(['otorgada', 'otorgada', 'otorgada']);
      expect(superposicion().hidden).toBe(true);
      expect(leyenda().hidden).toBe(true);
      expect(document.getElementById('anuncios')!.textContent).not.toContain('IoU');
    });

    it('al empezar un intento nuevo vuelve a la vista normal, para ver caminar a la tortuga', () => {
      const { app, avanzar } = arrancar0_1();
      escribir(app, FALLA);
      app.ejecutar();
      avanzar(5000);
      expect(superposicion().hidden).toBe(false);

      escribir(app, 'AVANZA 100');
      app.ejecutar();

      expect(superposicion().hidden).toBe(true);
      expect(conmutador().getAttribute('aria-pressed')).toBe('false');
    });

    it('el botón alterna la vista y el diff sigue en pantalla al volver (23.10)', () => {
      const { app, avanzar } = arrancar0_1();
      escribir(app, FALLA);
      app.ejecutar();
      avanzar(5000);
      const trazosAntes = dobles.get('lienzo-superposicion')!.trazos.length;

      conmutador().click(); // vuelve a lado a lado
      expect(superposicion().hidden).toBe(true);
      expect(leyenda().hidden).toBe(true);
      expect(conmutador().getAttribute('aria-pressed')).toBe('false');

      conmutador().click(); // otra vez la superposición
      expect(superposicion().hidden).toBe(false);
      expect(dobles.get('lienzo-superposicion')!.trazos.length).toBeGreaterThan(trazosAntes);
    });

    it('abierta a mano sin haber ejecutado nada, la superposición muestra la figura de Kiro y ningún diff', () => {
      arrancar0_1();
      conmutador().click();
      expect(superposicion().hidden).toBe(false);
      const grosores = dobles.get('lienzo-superposicion')!.trazos.map((t) => t.grosor);
      // Ni lo que sobra (10) ni lo que coincide o falta (5): solo la cuadrícula y las estelas de guía.
      expect(grosores).not.toContain(10);
      expect(grosores).not.toContain(5);
    });
  });

  it('el orden de Tab en el programa es el visual: globo, editor, atajos (a su lado) y controles (debajo)', () => {
    const app = crearAplicacion({
      documento: document,
      almacen: null,
      reloj: relojManual().reloj,
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoNormal,
      idNivel: '0.1',
    });
    const orden = enfocables();
    const indice = (el: Element | null): number => orden.indexOf(el as HTMLElement);
    const editor = indice(app.editor.area);
    const ejecutar = indice(document.querySelector('.kl-control-ejecutar'));
    const primerComando = indice(document.querySelector('.kl-comando'));

    expect(editor).toBeGreaterThanOrEqual(0);
    // Los atajos están a la derecha del editor: se llega a ellos justo después de él, y
    // a los controles, que van debajo, después de los atajos.
    expect(primerComando).toBe(editor + 1);
    expect(ejecutar).toBe(primerComando + 1);
    // Y visualmente (el CSS no reordena nada) el DOM es ese mismo.
    const hijos = [...document.querySelectorAll('#programa > *')].map((e) => e.className.split(' ')[0]);
    expect(hijos).toEqual(['kl-globo', 'kl-editor', 'kl-panel-comandos', 'kl-controles']);
  });

  it('los seis atajos son una sola parada de Tab: no suman seis Tabs antes de Ejecutar', () => {
    crearAplicacion({
      documento: document,
      almacen: null,
      reloj: relojManual().reloj,
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoNormal,
      idNivel: '0.1',
    });
    const botones = [...document.querySelectorAll<HTMLElement>('.kl-comando')];
    expect(botones.length).toBe(6);
    expect(enfocables().filter((e) => botones.includes(e)).length).toBe(1);
    // Y los otros cinco siguen alcanzables con las flechas (tabindex -1, no disabled).
    expect(botones.filter((b) => b.getAttribute('tabindex') === '-1').length).toBe(5);
    expect(botones.every((b) => !(b as HTMLButtonElement).disabled)).toBe(true);
  });

  it('desde el editor, cada acción de los controles está a 10 Tab o menos, también durante una ejecución', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAplicacion({
      documento: document,
      almacen: null,
      reloj,
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoNormal,
      idNivel: '0.1',
    });
    const acciones = ['.kl-control-ejecutar', '.kl-control-paso', '.kl-control-reiniciar', '.kl-control-demostracion', '.kl-velocidad-inmediata'];
    const tabsHasta = (selector: string): number => {
      const orden = enfocables();
      return orden.indexOf(document.querySelector<HTMLElement>(selector)!) - orden.indexOf(app.editor.area);
    };

    for (const a of acciones) expect(tabsHasta(a), `en reposo: ${a}`).toBeLessThanOrEqual(10);

    // Durante la ejecución «Detener» se habilita y suma una parada; el límite sigue en pie.
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(100);
    expect(tabsHasta('.kl-control-detener')).toBeLessThanOrEqual(10);
    for (const a of acciones.filter((x) => x !== '.kl-control-ejecutar')) {
      expect(tabsHasta(a), `en ejecución: ${a}`).toBeLessThanOrEqual(10);
    }
  });

  it('desde cualquier elemento interactivo del nivel 0.1, 20 Tab o menos devuelven el foco al editor (28.1)', () => {
    const app = crearAplicacion({
      documento: document,
      almacen: null,
      reloj: relojManual().reloj,
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoNormal,
      idNivel: '0.1',
    });
    const orden = enfocables();
    const n = orden.length;
    const editor = orden.indexOf(app.editor.area);
    const peor = Math.max(...orden.map((_, i) => (editor - i + n) % n));
    expect(peor).toBeLessThanOrEqual(20);
  });
});

// ============================================================================
// La tortuga se mueve por el lienzo (se observa lo que se dibuja)
// ============================================================================

describe('main · la tortuga se mueve por el lienzo', () => {
  const contextos = new Map<string, DobleDibujo>();

  beforeEach(() => {
    montarDom();
    contextos.clear();
    // jsdom no trae Canvas: cada canvas recibe un doble que registra lo que se dibuja.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
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

  /**
   * Puntos que el último dibujo de una capa (tras su último clearRect) puso en
   * pantalla. El doble registra también como moveTo/lineTo las cuatro esquinas del
   * rectángulo de recorte (±400, ±400); no son parte de lo dibujado y se descartan.
   */
  function puntosDelUltimoDibujo(id: string): Array<{ x: number; y: number }> {
    const llamadas = contextos.get(id)!.llamadas;
    const ultimoBorrado = llamadas.map((l) => l.metodo).lastIndexOf('clearRect');
    const puntos: Array<{ x: number; y: number }> = [];
    for (const l of llamadas.slice(ultimoBorrado + 1)) {
      if (!['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo'].includes(l.metodo)) continue;
      const a = l.args as number[];
      for (let i = 0; i + 1 < a.length; i += 2) {
        const esEsquinaDeRecorte = Math.abs(a[i]!) === 400 && Math.abs(a[i + 1]!) === 400;
        if (!esEsquinaDeRecorte) puntos.push({ x: a[i]!, y: a[i + 1]! });
      }
    }
    return puntos;
  }

  /** La cabeza de la tortuga es lo más alto que se dibuja: sube exactamente con ella. */
  function alturaDeLaTortuga(): number {
    return Math.max(...puntosDelUltimoDibujo('lienzo-personajes-jugador').map((p) => p.y));
  }

  it('avanza fotograma a fotograma mientras corre el programa', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    const alInicio = alturaDeLaTortuga();
    escribir(app, 'AVANZA 100');
    app.ejecutar();

    avanzar(200);
    const aMitad = alturaDeLaTortuga();
    expect(aMitad).toBeGreaterThan(alInicio + 1);
    expect(aMitad).toBeLessThan(alInicio + 99);

    avanzar(100);
    const mas = alturaDeLaTortuga();
    expect(mas).toBeGreaterThan(aMitad);
  });

  it('al terminar vuelve al punto inicial y el trazo entero queda a la vista, sin la tortuga encima', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    const alInicio = alturaDeLaTortuga();
    escribir(app, 'AVANZA 100');
    app.ejecutar();

    avanzar(2000);

    expect(alturaDeLaTortuga()).toBeCloseTo(alInicio, 6);
    // El trazo completo (hasta y = 100) está en la capa de la estela.
    const ys = puntosDelUltimoDibujo('lienzo-jugador').map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(100, 6);
  });

  it('un giro cambia hacia dónde mira la tortuga sin moverla de sitio, y al terminar vuelve a mirar al frente', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    escribir(app, 'GIRADERECHA 180');
    app.ejecutar();
    const alInicio = puntosDelUltimoDibujo('lienzo-personajes-jugador');

    // A mitad de un giro de 180 grados mira a la derecha: lo que era lo más alto (la
    // cabeza) ahora es lo más a la derecha.
    avanzar(200);
    const aMitad = puntosDelUltimoDibujo('lienzo-personajes-jugador');
    const maxY = (ps: Array<{ y: number }>) => Math.max(...ps.map((p) => p.y));
    const maxX = (ps: Array<{ x: number }>) => Math.max(...ps.map((p) => p.x));
    expect(maxY(alInicio)).toBeGreaterThan(maxX(alInicio) + 1);
    expect(maxX(aMitad)).toBeGreaterThan(maxY(aMitad) + 1);

    avanzar(2000);
    expect(puntosDelUltimoDibujo('lienzo-personajes-jugador')).toEqual(alInicio);
  });

  it('Detener también deja a la tortuga en el punto inicial, con el trazo hecho hasta ahí', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    const alInicio = alturaDeLaTortuga();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    avanzar(100);
    expect(alturaDeLaTortuga()).toBeGreaterThan(alInicio + 1);

    boton('detener').click();

    expect(alturaDeLaTortuga()).toBeCloseTo(alInicio, 6);
    const ys = puntosDelUltimoDibujo('lienzo-jugador').map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(100, 6);
  });

  it('en el paso a paso se queda donde va mientras avanza y vuelve al inicio al llegar al final', () => {
    const { reloj, avanzar } = relojManual();
    const app = crearAppAnimada(reloj);
    const alInicio = alturaDeLaTortuga();
    escribir(app, 'AVANZA 100\nAVANZA 100');
    app.ejecutar();
    avanzar(5000);
    app.reiniciar();

    app.darPaso();
    expect(alturaDeLaTortuga()).toBeCloseTo(alInicio + 100, 6); // a la vista, para seguir el paso
    app.darPaso();
    expect(alturaDeLaTortuga()).toBeCloseTo(alInicio, 6); // terminó: vuelve al inicio
  });

  it('con movimiento reducido (sin recorrido animado) también termina en el punto inicial', () => {
    const app = crearApp();
    const alInicio = alturaDeLaTortuga();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    expect(alturaDeLaTortuga()).toBeCloseTo(alInicio, 6);
    const ys = puntosDelUltimoDibujo('lienzo-jugador').map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(100, 6);
  });

  it('la tortuga pintada es más grande que la geometría de diseño (se lee como personaje)', () => {
    const { reloj } = relojManual();
    crearAppAnimada(reloj);
    const ps = puntosDelUltimoDibujo('lienzo-personajes-jugador');
    const alto = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
    // Con escala 1 la figura medía unas 30 unidades de alto; agrandada pasa de 50.
    expect(alto).toBeGreaterThan(50);
  });

  it('el tema puede quitar la flecha de rumbo y el lápiz mientras escribe, y main lo lee', () => {
    /** Trazos del último dibujo de la tortuga del jugador. */
    const trazos = (): number => {
      const llamadas = contextos.get('lienzo-personajes-jugador')!.llamadas;
      const ultimoBorrado = llamadas.map((l) => l.metodo).lastIndexOf('clearRect');
      return llamadas.slice(ultimoBorrado + 1).filter((l) => l.metodo === 'stroke').length;
    };
    crearAppAnimada(relojManual().reloj);
    const conTodo = trazos();

    const raiz = document.documentElement.style;
    raiz.setProperty('--marca-rumbo-mostrar', 'no');
    raiz.setProperty('--lapiz-mostrar', 'arriba');
    try {
      montarDom();
      contextos.clear();
      crearAppAnimada(relojManual().reloj);
      // Sin la flecha y sin el lápiz (que está abajo): dos trazos menos.
      expect(trazos()).toBe(conTodo - 2);
    } finally {
      raiz.removeProperty('--marca-rumbo-mostrar');
      raiz.removeProperty('--lapiz-mostrar');
    }
  });

  it('la figura de Kiro empieza vacía: la demostración la dibuja en vivo, no se pone de antemano', () => {
    const { reloj } = relojManual();
    crearAppAnimada(reloj);
    // La capa de estela de Kiro, tras su último borrado, no tiene ningún trazo.
    expect(puntosDelUltimoDibujo('lienzo-referencia')).toEqual([]);
  });

  it('Kiro y su tortuga están dibujados en el inicio desde el principio', () => {
    const { reloj } = relojManual();
    crearAppAnimada(reloj);
    expect(puntosDelUltimoDibujo('lienzo-personajes-referencia').length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Tarea 3.4 · prefers-reduced-motion: reduce (requisito 3.8)
//
// El hueco frente a lo ya cubierto: el animador.test.ts prueba el movimiento
// reducido en aislamiento, y «con movimiento reducido … también termina en el
// punto inicial» lo prueba en main pero con `relojInmediato`, que SÍ dispara
// fotogramas. Aquí se prueba en jsdom con un reloj que NO dispara ningún
// fotograma —el equivalente a no tener `requestAnimationFrame`— que, cuando
// main recibe la consulta de movimiento reducido por parámetro, el animador
// dibuja la estela completa de golpe, deja la tortuga en el Estado inicial y
// mantiene el paso a paso aplicando exactamente una Operacion por paso.
// ============================================================================

/**
 * Reloj de animación que NUNCA dispara un fotograma: `programar` registra el
 * callback y no lo llama jamás. Si la estela se dibujara por fotogramas, con este
 * reloj no se dibujaría nada. Equivale a correr sin `requestAnimationFrame`.
 */
function relojNuncaDispara(): { reloj: Reloj; fotogramasProgramados: () => number } {
  let programados = 0;
  const reloj: Reloj = {
    programar(): number {
      programados += 1;
      return programados;
    },
    cancelar(): void {},
    ahora(): number {
      return 0;
    },
  };
  return { reloj, fotogramasProgramados: () => programados };
}

describe('main · tarea 3.4 · prefers-reduced-motion dibuja de golpe (requisito 3.8)', () => {
  const contextos = new Map<string, DobleDibujo>();

  beforeEach(() => {
    montarDom();
    contextos.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
    ) {
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

  /** Puntos del último dibujo de una capa, descartando las esquinas del recorte. */
  function puntosDelUltimoDibujo(id: string): Array<{ x: number; y: number }> {
    const llamadas = contextos.get(id)!.llamadas;
    const ultimoBorrado = llamadas.map((l) => l.metodo).lastIndexOf('clearRect');
    const puntos: Array<{ x: number; y: number }> = [];
    for (const l of llamadas.slice(ultimoBorrado + 1)) {
      if (!['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo'].includes(l.metodo)) continue;
      const a = l.args as number[];
      for (let i = 0; i + 1 < a.length; i += 2) {
        const esEsquinaDeRecorte = Math.abs(a[i]!) === 400 && Math.abs(a[i + 1]!) === 400;
        if (!esEsquinaDeRecorte) puntos.push({ x: a[i]!, y: a[i + 1]! });
      }
    }
    return puntos;
  }

  /** La tortuga es lo más alto que se dibuja en su capa de personajes. */
  function alturaDeLaTortuga(): number {
    return Math.max(...puntosDelUltimoDibujo('lienzo-personajes-jugador').map((p) => p.y));
  }

  /**
   * Hasta dónde llega la estela del jugador en el eje y, en su último dibujo. La
   * estela se pinta como una sola polilínea, así que su alcance —no el número de
   * llamadas a `stroke`— es lo que revela cuántas operaciones de avance se
   * aplicaron. Sin estela, devuelve 0.
   */
  function alcanceDeLaEstela(): number {
    const ys = puntosDelUltimoDibujo('lienzo-jugador').map((p) => p.y);
    return ys.length > 0 ? Math.max(...ys) : 0;
  }

  /** App con movimiento reducido y un reloj que nunca dispara fotogramas. */
  function crearAppReducida(reloj: Reloj): Aplicacion {
    return crearAplicacion({
      documento: document,
      almacen: null,
      reloj,
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoReducido,
      idNivel: '0.1',
    });
  }

  it('sin ningún fotograma (sin requestAnimationFrame) la estela completa se dibuja de golpe', () => {
    const { reloj, fotogramasProgramados } = relojNuncaDispara();
    const app = crearAppReducida(reloj);
    const alInicio = alturaDeLaTortuga();

    escribir(app, 'AVANZA 100');
    app.ejecutar();

    // La estela entera (hasta y = 100) ya está dibujada aunque ningún fotograma
    // de animación se haya disparado: el animador no programó ninguno.
    const ys = puntosDelUltimoDibujo('lienzo-jugador').map((p) => p.y);
    expect(Math.max(...ys)).toBeCloseTo(100, 6);
    expect(fotogramasProgramados()).toBe(0);
    // Y la tortuga quedó en el Estado inicial, con la estela intacta.
    expect(alturaDeLaTortuga()).toBeCloseTo(alInicio, 6);
  });

  it('el paso a paso sigue disponible y aplica exactamente una Operacion por paso', () => {
    const { reloj, fotogramasProgramados } = relojNuncaDispara();
    const app = crearAppReducida(reloj);

    // Dos avances de 50: cada paso debe aportar exactamente uno (la estela crece
    // de 50 en 50), nunca los dos de golpe ni ninguno.
    escribir(app, 'AVANZA 50\nAVANZA 50');
    app.ejecutar();
    // La ejecución (de golpe) dejó la secuencia dibujada; se reinicia para recorrer
    // paso a paso desde el principio.
    app.reiniciar();
    expect(alcanceDeLaEstela()).toBe(0);

    app.darPaso();
    expect(alcanceDeLaEstela()).toBeCloseTo(50, 6); // una sola operación aplicada

    app.darPaso();
    expect(alcanceDeLaEstela()).toBeCloseTo(100, 6); // la segunda, y ni una más

    // El paso a paso nunca necesitó un fotograma de animación.
    expect(fotogramasProgramados()).toBe(0);
  });
});

// ============================================================================
// Navegación entre niveles (spec 01, tarea 15)
// ============================================================================

/** Doble de Storage en memoria, para compartir progreso entre apps. */
function crearAlmacenMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    key: (i: number) => [...datos.keys()][i] ?? null,
    removeItem: (k: string) => datos.delete(k),
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
}

/** Crea la app con opciones (almacén compartido, idNivel opcional). */
function crearAppCon(opts: { almacen: Storage | null; idNivel?: string }): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen: opts.almacen,
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte(),
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    ...(opts.idNivel !== undefined ? { idNivel: opts.idNivel } : {}),
  });
}

describe('main · navegación entre niveles', () => {
  beforeEach(() => {
    montarDom();
  });

  it('arranca en el 0.1 y el menú muestra los cinco niveles', () => {
    const app = crearApp();
    expect(app.nivelEnCurso()).toBe('0.1');
    // Los niveles solo están desplegados cuando el acordeón de su mundo está abierto:
    // se abre el menú (deja abierto el mundo del nivel en curso, el 0) y se cuentan.
    app.menuMundos.abrir();
    const botones = app.menuMundos.encabezadoMundo(0)!
      .closest('.kl-menu-mundo')!
      .querySelectorAll('.kl-menu-nivel');
    expect(botones.length).toBe(5);
  });

  it('no deja entrar a un nivel bloqueado y lo avisa por el globo', () => {
    const app = crearApp();
    app.irANivel('0.3'); // bloqueado sin progreso
    expect(app.nivelEnCurso()).toBe('0.1');
    expect(app.textoGlobo()).toMatch(/bloquead/i);
  });

  it('aprobar el 0.1 desbloquea y permite entrar al 0.2', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    expect(app.estado().calificacion!.precision.otorgada).toBe(true);
    // El 0.2 queda desbloqueado; ahora sí se puede entrar.
    app.irANivel('0.2');
    expect(app.nivelEnCurso()).toBe('0.2');
  });

  it('reanuda el último reto desbloqueado al recrear la app con el mismo almacén', () => {
    const almacen = crearAlmacenMemoria();
    // Primera sesión: aprueba el 0.1 y entra al 0.2 (que queda como último reto).
    const app1 = crearAppCon({ almacen, idNivel: '0.1' });
    escribir(app1, 'AVANZA 100');
    app1.ejecutar();
    app1.irANivel('0.2');
    app1.destruir();
    document.body.innerHTML = '';
    montarDom();
    // Segunda sesión sin idNivel forzado: reanuda el 0.2.
    const app2 = crearAppCon({ almacen });
    expect(app2.nivelEnCurso()).toBe('0.2');
  });

  it('el panel de semilla ofrece otro reto en un nivel generado y no en uno autorado', () => {
    const app = crearApp(); // 0.1 autorado
    expect(app.panelSemilla.otroRetoDisponible()).toBe(false);
    // Aprueba 0.1 y 0.2 para abrir el 0.3 (generado).
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    app.irANivel('0.2');
    escribir(app, 'AVANZA 100 GIRADERECHA 90 AVANZA 100');
    app.ejecutar();
    app.irANivel('0.3');
    expect(app.nivelEnCurso()).toBe('0.3');
    expect(app.panelSemilla.otroRetoDisponible()).toBe(true);
  });

  it('un código de semilla inválido avisa por el globo sin cambiar el reto', () => {
    const app = crearApp();
    const nivelAntes = app.nivelEnCurso();
    app.panelSemilla.campoCodigo.value = 'xx'; // longitud inválida
    app.panelSemilla.botonReproducir.click();
    // El panel está deshabilitado en 0.1 (autorado), así que el reto no cambia.
    expect(app.nivelEnCurso()).toBe(nivelAntes);
  });

  it('la guía de primeros pasos solo aparece en el 0.1 y la primera vez', () => {
    const almacen = crearAlmacenMemoria();
    const app1 = crearAppCon({ almacen, idNivel: '0.1' });
    // Con la guía activa, el globo muestra el primer paso (menciona la tortuga).
    expect(app1.textoGlobo()).toMatch(/tortuga/i);
    // Al acertar, la guía se completa y se marca en el progreso.
    escribir(app1, 'AVANZA 100');
    app1.ejecutar();
    app1.destruir();
    document.body.innerHTML = '';
    montarDom();
    // Nueva sesión en el 0.1: la guía ya no se muestra (saludo normal del reto).
    const app2 = crearAppCon({ almacen, idNivel: '0.1' });
    expect(app2.textoGlobo()).not.toMatch(/soy Kiro/i);
  });

  it('completar los cinco niveles con tres estrellas anuncia la insignia Secuencia', () => {
    const app = crearApp();
    // Resuelve cada nivel con un programa que copia su propia referencia.
    const programas: Record<string, string> = {
      '0.1': 'AVANZA 100',
      '0.2': 'AVANZA 100 GIRADERECHA 90 AVANZA 100',
      '0.4': 'AVANZA 100 GIRADERECHA 90 AVANZA 100 GIRADERECHA 90 AVANZA 100 GIRADERECHA 90 AVANZA 100 GIRADERECHA 90',
    };
    // 0.1, 0.2 autorados; 0.3 generado; 0.4 autorado; 0.5 generado.
    const orden = ['0.1', '0.2', '0.3', '0.4', '0.5'];
    for (const id of orden) {
      app.irANivel(id);
      expect(app.nivelEnCurso()).toBe(id);
      const prog = programas[id] ?? textoDeReferencia(app);
      escribir(app, prog);
      app.ejecutar();
      expect(app.estado().calificacion!.precision.otorgada, `precisión en ${id}`).toBe(true);
    }
    // La insignia Secuencia quedó anunciada por el globo o el menú la refleja.
    expect(app.menuMundos.insigniaVisible(0)).toBe(true);
  }, 120_000);
});

/** Imprime la referencia del reto en curso como texto, para «copiarla». */
function textoDeReferencia(app: Aplicacion): string {
  // Para los niveles generados, el programa de referencia copiado al pie de la
  // letra reproduce la figura exacta: lo obtenemos del reto en curso.
  const reto = app.estado().reto;
  const partes: string[] = [];
  for (const n of reto.referencia.instrucciones) {
    if (n.tipo === 'invocacionComando') {
      const arg = n.argumentos[0];
      partes.push(arg && arg.tipo === 'numeroLiteral' ? `${n.nombre} ${arg.valor}` : n.nombre);
    }
  }
  return partes.join(' ');
}


// ============================================================================
// Pruebas transversales del proyecto (grupo 21).
//
// Se alojan en main.test.ts (no en archivos hermanos sin módulo) para que la
// propia regla 21.3 —solo `generadores-prueba.test.ts` es un test sin módulo
// homónimo— siga cumpliéndose.
// ============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_ESTE_ARCHIVO = dirname(fileURLToPath(import.meta.url));
const RAIZ_SRC = DIR_ESTE_ARCHIVO; // este archivo vive en src/
const NOMBRE_ESTE_ARCHIVO = basename(fileURLToPath(import.meta.url));

/** Recorre un directorio en profundidad y devuelve las rutas absolutas de sus archivos. */
function listarArchivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const info = statSync(ruta);
    if (info.isDirectory()) salida.push(...listarArchivos(ruta));
    else salida.push(ruta);
  }
  return salida;
}

/** Lista los subdirectorios directos de un directorio. */
function listarSubdirectorios(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(ruta);
  }
  return salida;
}

/** Ruta relativa a `src/`, con barras normales para los mensajes. */
function rel(ruta: string): string {
  return relative(RAIZ_SRC, ruta).split(sep).join('/');
}

const ARCHIVOS_SRC = listarArchivos(RAIZ_SRC);
const ARCHIVOS_TS = ARCHIVOS_SRC.filter((r) => r.endsWith('.ts'));

/**
 * Sustituye los comentarios (de línea y de bloque) y el contenido de las cadenas
 * por espacios equivalentes, conservando los saltos de línea, para que 21.1
 * detecte el USO real de un patrón y no su mención en un comentario o una cadena.
 */
function despojarComentariosYCadenas(fuente: string): string {
  let salida = '';
  let i = 0;
  type Modo = 'codigo' | 'linea' | 'bloque' | 'comilla' | 'doble' | 'plantilla';
  let modo: Modo = 'codigo';
  while (i < fuente.length) {
    const c = fuente[i]!;
    const d = i + 1 < fuente.length ? fuente[i + 1]! : '';
    if (modo === 'codigo') {
      if (c === '/' && d === '/') { modo = 'linea'; salida += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { modo = 'bloque'; salida += '  '; i += 2; continue; }
      if (c === "'") { modo = 'comilla'; salida += ' '; i += 1; continue; }
      if (c === '"') { modo = 'doble'; salida += ' '; i += 1; continue; }
      if (c === '`') { modo = 'plantilla'; salida += ' '; i += 1; continue; }
      salida += c; i += 1; continue;
    }
    if (modo === 'linea') {
      if (c === '\n') { modo = 'codigo'; salida += '\n'; } else salida += ' ';
      i += 1; continue;
    }
    if (modo === 'bloque') {
      if (c === '*' && d === '/') { modo = 'codigo'; salida += '  '; i += 2; continue; }
      salida += c === '\n' ? '\n' : ' '; i += 1; continue;
    }
    // Dentro de una cadena: respeta el escape y conserva los saltos de línea.
    if (c === '\\') { salida += '  '; i += 2; continue; }
    if (
      (modo === 'comilla' && c === "'") ||
      (modo === 'doble' && c === '"') ||
      (modo === 'plantilla' && c === '`')
    ) {
      modo = 'codigo'; salida += ' '; i += 1; continue;
    }
    salida += c === '\n' ? '\n' : ' '; i += 1; continue;
  }
  return salida;
}

// ============================================================================
// 21.1 · Ausencia de azar prohibido y de imágenes
// ============================================================================

describe('21.1 · sin fuentes de azar prohibidas ni imágenes', () => {
  const PATRONES: ReadonlyArray<{ nombre: string; regex: RegExp }> = [
    { nombre: 'Math.random', regex: /\bMath\s*\.\s*random\b/ },
    { nombre: 'eval(', regex: /\beval\s*\(/ },
    { nombre: 'new Function', regex: /\bnew\s+Function\b/ },
    { nombre: 'constructor Function(', regex: /\bFunction\s*\(/ },
  ];

  it('ningún .ts de src/ usa Math.random, eval, new Function ni el constructor Function', () => {
    const infracciones: string[] = [];
    for (const ruta of ARCHIVOS_TS) {
      if (basename(ruta) === NOMBRE_ESTE_ARCHIVO) continue; // este archivo los nombra como texto
      // Despoja comentarios y cadenas: 21.1 mide el uso real, no las menciones.
      const lineas = despojarComentariosYCadenas(readFileSync(ruta, 'utf8')).split('\n');
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i]!;
        for (const patron of PATRONES) {
          if (patron.regex.test(linea)) {
            infracciones.push(`${rel(ruta)}:${i + 1} usa ${patron.nombre}`);
          }
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('src/ no empaqueta imágenes (.png/.jpg/.jpeg/.gif/.svg/.webp/.ico)', () => {
    const EXT = /\.(png|jpe?g|gif|svg|webp|ico)$/i;
    const imagenes = ARCHIVOS_SRC.filter((r) => EXT.test(r)).map(rel);
    expect(imagenes, imagenes.join('\n')).toEqual([]);
  });
});

// ============================================================================
// 21.2 · Aristas prohibidas entre carpetas (diseño 2.3)
// ============================================================================

/** Extrae los especificadores de import/export de un archivo TypeScript. */
function importsDe(ruta: string): string[] {
  const texto = readFileSync(ruta, 'utf8');
  const especificadores: string[] = [];
  let m: RegExpExecArray | null;
  const regex = /(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]/g;
  while ((m = regex.exec(texto)) !== null) especificadores.push(m[1]!);
  const regexEfecto = /import\s*['"]([^'"]+)['"]/g;
  while ((m = regexEfecto.exec(texto)) !== null) especificadores.push(m[1]!);
  return especificadores;
}

/** Carpeta de primer nivel de un especificador relativo, resuelta desde `ruta`. */
function carpetaDestino(ruta: string, especificador: string): string | null {
  if (!especificador.startsWith('.')) return null; // paquete externo
  const resuelto = join(dirname(ruta), especificador);
  const relativo = relative(RAIZ_SRC, resuelto).split(sep).join('/');
  return relativo.split('/')[0]!;
}

/** Módulo destino sin extensión, relativo a `src/`. */
function moduloDestino(ruta: string, especificador: string): string {
  const resuelto = join(dirname(ruta), especificador);
  return relative(RAIZ_SRC, resuelto).split(sep).join('/').replace(/\.js$/, '');
}

describe('21.2 · aristas de dependencia entre carpetas', () => {
  const MODULOS = ARCHIVOS_TS.filter((r) => !r.endsWith('.test.ts'));
  const carpetaOrigen = (ruta: string): string => rel(ruta).split('/')[0]!;

  it('lenguaje/ no importa de ninguna otra carpeta de src/', () => {
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'lenguaje') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === null || destino === 'lenguaje') continue;
        const mod = moduloDestino(ruta, esp);
        // Excepción admitida: lenguaje/interprete → motor/tortuga.
        if (rel(ruta).startsWith('lenguaje/interprete') && mod === 'motor/tortuga') continue;
        infracciones.push(`${rel(ruta)} → ${esp} (regla: lenguaje/ solo importa de sí misma)`);
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('azar/ solo importa de sí misma y de lenguaje/errores', () => {
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'azar') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === null || destino === 'azar') continue;
        const mod = moduloDestino(ruta, esp);
        if (mod === 'lenguaje/errores') continue; // excepción admitida
        infracciones.push(`${rel(ruta)} → ${esp} (regla: azar/ solo importa de azar y lenguaje/errores)`);
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('niveles/ solo importa de lenguaje/, azar/ y de sí misma', () => {
    const permitidas = new Set(['niveles', 'lenguaje', 'azar']);
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'niveles') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === null) continue;
        if (!permitidas.has(destino)) {
          infracciones.push(`${rel(ruta)} → ${esp} (regla: niveles/ solo importa de lenguaje, azar y niveles)`);
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('motor/ no importa de ui/ ni de juego/', () => {
    const prohibidas = new Set(['ui', 'juego']);
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'motor') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === null) continue;
        if (prohibidas.has(destino)) {
          infracciones.push(`${rel(ruta)} → ${esp} (regla: motor/ no importa de ui/ ni juego/)`);
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('juego/ no importa de ui/ (la interfaz consume el juego, no al revés)', () => {
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'juego') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === 'ui') {
          infracciones.push(`${rel(ruta)} → ${esp} (regla: juego/ no importa de ui/)`);
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });
});

// ============================================================================
// 21.3 · Estructura de archivos
// ============================================================================

describe('21.3 · estructura de archivos', () => {
  // Archivos de prueba que son ayudas compartidas (dobles/generadores) y por eso
  // no acompañan a un módulo homónimo: el generador de valores para fast-check y
  // el doble de dibujo del motor, ambos con su propia auto-comprobación.
  const AYUDAS_ADMITIDAS = new Set<string>([
    'azar/generadores-prueba.test.ts',
    'motor/doble-dibujo.test.ts',
  ]);

  it('todo nombre de archivo y carpeta de src/ es kebab-case en minúsculas', () => {
    const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const infracciones: string[] = [];
    for (const ruta of ARCHIVOS_SRC) {
      const nombre = basename(ruta);
      const radical = nombre
        .replace(/\.test\.ts$/, '')
        .replace(/\.propiedad$/, '')
        .replace(/\.ts$/, '')
        .replace(/\.css$/, '');
      for (const parte of radical.split('.')) {
        if (!KEBAB.test(parte)) infracciones.push(`${rel(ruta)} (radical no kebab-case: «${parte}»)`);
      }
    }
    (function revisarCarpetas(dir: string): void {
      for (const sub of listarSubdirectorios(dir)) {
        if (!KEBAB.test(basename(sub))) infracciones.push(`${rel(sub)}/ (carpeta no kebab-case)`);
        revisarCarpetas(sub);
      }
    })(RAIZ_SRC);
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('no hay directorios vacíos dentro de src/', () => {
    const vacios: string[] = [];
    (function revisar(dir: string): void {
      if (readdirSync(dir).length === 0) vacios.push(rel(dir) + '/');
      for (const sub of listarSubdirectorios(dir)) revisar(sub);
    })(RAIZ_SRC);
    expect(vacios, vacios.join('\n')).toEqual([]);
  });

  it('cada .test.ts acompaña a su módulo homónimo (solo la ayuda admitida es la excepción)', () => {
    const infracciones: string[] = [];
    for (const ruta of ARCHIVOS_TS) {
      if (!ruta.endsWith('.test.ts')) continue;
      const relativo = rel(ruta);
      if (AYUDAS_ADMITIDAS.has(relativo)) continue;
      const radical = relativo.replace(/\.test\.ts$/, '').replace(/\.propiedad$/, '');
      const moduloEsperado = join(RAIZ_SRC, radical + '.ts');
      if (!ARCHIVOS_TS.includes(moduloEsperado)) {
        infracciones.push(`${relativo} no acompaña a ${radical}.ts`);
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('cada carpeta esperada del proyecto está presente', () => {
    const esperadas = ['azar', 'estilos', 'juego', 'lenguaje', 'motor', 'niveles', 'ui'];
    const presentes = new Set(listarSubdirectorios(RAIZ_SRC).map((d) => basename(d)));
    const faltantes = esperadas.filter((c) => !presentes.has(c));
    expect(faltantes, faltantes.join(', ')).toEqual([]);
  });
});

// ============================================================================
// 21.4 · Accesibilidad (WCAG 2.1) sobre el tema y el nivel 0.1
// ============================================================================

/** Convierte un color CSS (#rgb, #rrggbb, rgb()/rgba()) a componentes 0–255. */
function aRgb(color: string): { r: number; g: number; b: number } | null {
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) {
    const h = m[1]!;
    return {
      r: parseInt(h[0]! + h[0]!, 16),
      g: parseInt(h[1]! + h[1]!, 16),
      b: parseInt(h[2]! + h[2]!, 16),
    };
  }
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const h = m[1]!;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) {
    const partes = m[1]!.split(',').map((s) => parseFloat(s.trim()));
    if (partes.length >= 3) return { r: partes[0]!, g: partes[1]!, b: partes[2]! };
  }
  return null;
}

/** Luminancia relativa WCAG de un color. */
function luminancia({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Razón de contraste WCAG entre dos colores CSS (1 a 21). */
function contraste(colorA: string, colorB: string): number {
  const a = aRgb(colorA);
  const b = aRgb(colorB);
  if (a === null || b === null) return 0;
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

/**
 * Lee el valor de una variable CSS de tema.css (con reserva). Las variables derivan de
 * las fichas de la paleta (`var(--tinta-950)`), así que se sigue la referencia hasta el
 * color. Los pares de colores con mezclas (`color-mix`) los comprueba el bloque «contraste
 * de cada par» de más abajo.
 */
function leerVariableTema(css: string, nombre: string): string | null {
  // Prefiere la variable de reserva cuando exista, que es la que garantiza el
  // contraste; si no, la principal.
  const buscar = (v: string): string | null => {
    const re = new RegExp(`${v}\\s*:\\s*([^;]+);`);
    const m = re.exec(css.replace(/\/\*[\s\S]*?\*\//g, ''));
    return m ? m[1]!.trim() : null;
  };
  const seguir = (valor: string | null, saltos = 0): string | null => {
    const ref = valor === null ? null : /^var\((--[a-z0-9-]+)\)$/.exec(valor);
    return ref && saltos < 10 ? seguir(buscar(ref[1]!), saltos + 1) : valor;
  };
  return seguir(buscar(nombre + '-reserva') ?? buscar(nombre));
}

describe('21.4 · accesibilidad WCAG del tema', () => {
  const CSS_TEMA = readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8');
  const FONDO = leerVariableTema(CSS_TEMA, '--color-fondo-lienzo') ?? '#ffffff';
  const FONDO_UI = leerVariableTema(CSS_TEMA, '--color-fondo-primario') ?? '#ffffff';

  it('el texto principal contra el fondo cumple ≥ 4.5:1', () => {
    const texto = leerVariableTema(CSS_TEMA, '--color-texto-primario') ?? '#212529';
    expect(contraste(texto, FONDO_UI)).toBeGreaterThanOrEqual(4.5);
  });

  it('el texto secundario contra el fondo cumple ≥ 4.5:1', () => {
    const texto = leerVariableTema(CSS_TEMA, '--color-texto-secundario') ?? '#495057';
    expect(contraste(texto, FONDO_UI)).toBeGreaterThanOrEqual(4.5);
  });

  it('las dos estelas contra el fondo del lienzo cumplen ≥ 3:1', () => {
    const jugador = leerVariableTema(CSS_TEMA, '--color-estela-jugador')!;
    const referencia = leerVariableTema(CSS_TEMA, '--color-estela-referencia')!;
    expect(contraste(jugador, FONDO)).toBeGreaterThanOrEqual(3);
    expect(contraste(referencia, FONDO)).toBeGreaterThanOrEqual(3);
  });

  it('las tres regiones del diff contra el fondo cumplen ≥ 3:1', () => {
    for (const v of ['--color-diff-coincidencia', '--color-diff-exceso', '--color-diff-falta']) {
      const color = leerVariableTema(CSS_TEMA, v)!;
      expect(contraste(color, FONDO), `${v} = ${color}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('el contorno de la tortuga contra el fondo cumple ≥ 3:1', () => {
    const contorno = leerVariableTema(CSS_TEMA, '--color-tortuga-contorno')!;
    expect(contraste(contorno, FONDO)).toBeGreaterThanOrEqual(3);
  });

  it('el indicador de foco contra el fondo de interfaz cumple ≥ 3:1', () => {
    const foco = leerVariableTema(CSS_TEMA, '--color-indicador-foco')!;
    expect(contraste(foco, FONDO_UI)).toBeGreaterThanOrEqual(3);
  });
});

// --- Contraste de cada par texto/fondo y trazo/lienzo de la paleta Kiro ---
// Estas comprobaciones vivían en ui/selector-paleta.test.ts, junto a las de la paleta Océano.
// Al retirar el selector y Océano se pasan aquí: la paleta Kiro sigue cumpliendo lo mismo.

/** Declaraciones `--nombre: valor;` de tema.css; la primera de cada nombre manda. */
function declaracionesDeTema(css: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!mapa.has(m[1]!)) mapa.set(m[1]!, m[2]!.trim());
  }
  return mapa;
}

/**
 * Color final (#rrggbb) de un valor de tema.css: sigue los `var()` y resuelve los
 * `color-mix(in srgb, X p%, #000|#fff)` que usa el tema. Devuelve null si no puede.
 */
function resolverColor(variables: Map<string, string>, valor: string | null, saltos = 0): string | null {
  if (valor === null || saltos > 10) return null;
  const v = valor.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  if (ref) return resolverColor(variables, variables.get(ref[1]!) ?? null, saltos + 1);
  const mezcla = /^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(#000|#fff)\)$/.exec(v);
  if (mezcla) {
    const base = resolverColor(variables, mezcla[1]!, saltos + 1);
    const rgb = base === null ? null : aRgb(base);
    if (rgb === null) return null;
    const otro = mezcla[3] === '#000' ? 0 : 255;
    const peso = Number(mezcla[2]) / 100;
    const canal = (c: number): string => Math.round(c * peso + otro * (1 - peso)).toString(16).padStart(2, '0');
    return '#' + canal(rgb.r) + canal(rgb.g) + canal(rgb.b);
  }
  return null;
}

/** [texto o trazo, fondo, mínimo]: WCAG 2.1 AA, 4.5:1 el texto y 3:1 los trazos y el foco. */
const PARES_DE_CONTRASTE: ReadonlyArray<readonly [string, string, number]> = [
  ['--color-texto-primario', '--color-fondo-primario', 4.5],
  ['--color-texto-primario', '--color-fondo-panel', 4.5],
  ['--color-texto-primario', '--color-item-comando-fondo', 4.5],
  ['--color-texto-primario', '--color-globo-fondo', 4.5],
  ['--color-boton-secundario-texto', '--color-boton-secundario-fondo', 4.5],
  ['--color-boton-secundario-texto', '--color-boton-secundario-fondo-hover', 4.5],
  ['--color-texto-secundario', '--color-fondo-primario', 4.5],
  ['--color-texto-secundario', '--color-fondo-panel', 4.5],
  ['--color-texto-secundario', '--color-item-comando-fondo', 4.5],
  ['--color-texto-error', '--color-fondo-primario', 4.5],
  ['--color-texto-error', '--color-fondo-panel', 4.5],
  ['--color-texto-exito', '--color-fondo-primario', 4.5],
  ['--color-texto-enlace', '--color-fondo-primario', 4.5],
  ['--color-boton-texto', '--color-boton-fondo', 4.5],
  ['--color-boton-texto', '--color-boton-fondo-hover', 4.5],
  ['--color-boton-texto', '--color-boton-fondo-active', 4.5],
  ['--color-boton-peligro-texto', '--color-boton-peligro-fondo', 4.5],
  ['--color-boton-vista-activa-texto', '--color-boton-vista-activa-fondo', 4.5],
  ['--color-numeros-linea', '--tinta-canaleta', 4.5],
  ['--color-numeros-linea-activa', '--color-linea-activa-fondo', 4.5],
  ['--color-texto-primario', '--color-fondo-editor', 4.5],
  ['--color-estela-jugador', '--color-fondo-lienzo', 3],
  ['--color-estela-referencia', '--color-fondo-lienzo', 3],
  ['--color-diff-coincidencia', '--color-fondo-lienzo', 3],
  ['--color-diff-exceso', '--color-fondo-lienzo', 3],
  ['--color-diff-falta', '--color-fondo-lienzo', 3],
  ['--color-tortuga-contorno', '--color-fondo-lienzo', 3],
  ['--color-tortuga-relleno', '--color-fondo-lienzo', 3],
  ['--color-tortuga-caparazon', '--color-fondo-lienzo', 3],
  ['--color-kiro-contorno', '--color-fondo-lienzo', 3],
  ['--color-indicador-foco', '--color-fondo-primario', 3],
  ['--color-indicador-foco', '--color-fondo-panel', 3],
  ['--color-estrella-otorgada', '--color-fondo-primario', 3],
];

describe('21.4 · contraste de cada par de colores de la paleta Kiro', () => {
  const VARIABLES = declaracionesDeTema(readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8'));
  const color = (nombre: string): string | null => resolverColor(VARIABLES, VARIABLES.get(nombre) ?? null);

  it('cada par texto/fondo y trazo/lienzo cumple WCAG 2.1 AA (4.5:1 el texto, 3:1 los trazos y el foco)', () => {
    const fallos: string[] = [];
    for (const [a, b, minimo] of PARES_DE_CONTRASTE) {
      const ca = color(a);
      const cb = color(b);
      if (ca === null || cb === null) {
        fallos.push(`${a} / ${b}: no se pudo resolver (${ca}, ${cb})`);
        continue;
      }
      const razon = contraste(ca, cb);
      if (razon < minimo) fallos.push(`${a} ${ca} sobre ${b} ${cb}: ${razon.toFixed(2)}:1 < ${minimo}:1`);
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  it('la estela de Kiro y la del jugador son de colores distintos', () => {
    expect(color('--color-estela-referencia')).not.toBeNull();
    expect(color('--color-estela-referencia')).not.toBe(color('--color-estela-jugador'));
  });

  it('los valores de reserva de tema.css son los que resuelve la paleta', () => {
    const pares: ReadonlyArray<readonly [string, string]> = [
      ['--color-fondo-lienzo-reserva', '--color-fondo-lienzo'],
      ['--color-fondo-editor-reserva', '--color-fondo-editor'],
      ['--color-cuadricula-20-reserva', '--color-cuadricula-20'],
      ['--color-cuadricula-100-reserva', '--color-cuadricula-100'],
      ['--color-estela-referencia-reserva', '--color-estela-referencia'],
      ['--color-estela-jugador-reserva', '--color-estela-jugador'],
      ['--color-diff-coincidencia-reserva', '--color-diff-coincidencia'],
      ['--color-diff-exceso-reserva', '--color-diff-exceso'],
      ['--color-diff-falta-reserva', '--color-diff-falta'],
      ['--color-tortuga-contorno-reserva', '--color-tortuga-contorno'],
      ['--color-tortuga-relleno-reserva', '--color-tortuga-relleno'],
      ['--color-kiro-contorno-reserva', '--color-kiro-contorno'],
      ['--color-lapiz-contorno-reserva', '--color-lapiz-contorno'],
      ['--color-indicador-foco-reserva', '--color-indicador-foco'],
    ];
    for (const [reserva, principal] of pares) {
      expect(color(reserva), reserva).not.toBeNull();
      expect(color(reserva), `${reserva} debe igualar a ${principal}`).toBe(color(principal));
    }
  });

  it('el color de la barra del navegador (theme-color de index.html) es el fondo de la página', () => {
    const html = readFileSync(join(RAIZ_SRC, '..', 'index.html'), 'utf8');
    const meta = /<meta name="theme-color" content="(#[0-9a-f]{6})">/i.exec(html)![1]!;
    expect(meta.toLowerCase()).toBe(color('--color-fondo-primario'));
  });

  it('el selector de colores y la paleta Océano están retirados: ni script, ni hoja de estilos, ni archivo', () => {
    const html = readFileSync(join(RAIZ_SRC, '..', 'index.html'), 'utf8');
    expect(html).not.toContain('paletas.css');
    expect(html).not.toContain('kirologo.paleta');
    expect(readdirSync(join(RAIZ_SRC, 'estilos'))).not.toContain('paletas.css');
    expect(readdirSync(join(RAIZ_SRC, 'ui'))).not.toContain('selector-paleta.ts');
  });
});

// --- Cada ficha de reserva del :root resuelve al mismo color que la paleta (tarea 1.3, requisito 2.1) ---
//
// Las variables `--color-*-reserva` del bloque `:root` son el valor usable si falta la
// variable principal. Para que la reserva y la paleta no se desincronicen sin que nadie
// se entere, cada `*-reserva` de COLOR tiene que resolver al mismo color que su variable
// principal (la que deriva de una ficha de la paleta Kiro). La prueba descubre las
// reservas por sí sola recorriendo las declaraciones del tema, de modo que una reserva
// de color nueva no puede escaparse de la comprobación. Las reservas que no son colores
// (grosor y estilo del indicador de foco, de la cuadrícula, de las estelas, del diff y
// de los contornos) se dejan fuera a propósito: muchas difieren de su principal (una
// reserva más gruesa garantiza visibilidad si falta la variable), así que no se comparan
// como colores. Se reconocen porque su principal no resuelve a un color.
describe('2.1 · las fichas de reserva coinciden con la paleta Kiro (tarea 1.3)', () => {
  const VARIABLES = declaracionesDeTema(readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8'));
  const color = (nombre: string): string | null => resolverColor(VARIABLES, VARIABLES.get(nombre) ?? null);

  // La principal de una reserva es su nombre sin el sufijo `-reserva`.
  const principalDe = (reserva: string): string => reserva.replace(/-reserva$/, '');

  // Reservas de color: las que terminan en `-reserva` cuya variable principal resuelve a
  // un color de la paleta. Las de grosor/estilo quedan fuera porque su principal no es
  // un color (p. ej. `--grosor-cuadricula-20: 0.5px`).
  const reservasDeColor = [...VARIABLES.keys()].filter(
    (nombre) => nombre.endsWith('-reserva') && color(principalDe(nombre)) !== null,
  );

  it('hay al menos una ficha de reserva de color que verificar', () => {
    expect(reservasDeColor.length).toBeGreaterThan(0);
  });

  it('cada valor *-reserva de color resuelve al mismo color que su ficha de la paleta', () => {
    const fallos: string[] = [];
    for (const reserva of reservasDeColor) {
      const principal = principalDe(reserva);
      const valorReserva = color(reserva);
      const valorPrincipal = color(principal);
      if (valorReserva === null) {
        fallos.push(`${reserva}: no se pudo resolver su color`);
        continue;
      }
      if (valorReserva !== valorPrincipal) {
        fallos.push(`${reserva} = ${valorReserva} no iguala a ${principal} = ${valorPrincipal}`);
      }
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  it('ninguna reserva de color apunta a una ficha que ya no existe en la paleta', () => {
    const huerfanas = reservasDeColor.filter((reserva) => color(principalDe(reserva)) === null);
    expect(huerfanas, huerfanas.join(', ')).toEqual([]);
  });
});

// --- Las 19 fichas y «ninguna derivada con color literal» (requisito 2.1) ---
//
// El Tema declara las fichas de la paleta Kiro en su primer bloque y deriva de
// ellas el resto. La regla dura: ninguna variable de color derivada puede llevar un
// color literal (hex, rgb/rgba, hsl/hsla o un nombre CSS); solo `var()` a una ficha o
// una mezcla `color-mix` de fichas. Hay dos conjuntos de excepciones deliberadas que
// la prueba conoce y no marca: las variables `*-reserva` (valor usable si falta una
// ficha) y las ocho de la mascota y el lápiz, que son literales a propósito porque la
// tortuga y el lápiz conservan su color en toda paleta y no se derivan de las fichas.

/** El cuerpo `{...}` del primer bloque de tema.css: `:root, [data-paleta="kiro"]`, sin comentarios. */
function primerBloqueFichas(css: string): string {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // El primer bloque es el selector de la paleta Kiro; su llave abre las fichas.
  const inicio = sinComentarios.indexOf('[data-paleta="kiro"]');
  const abre = sinComentarios.indexOf('{', inicio);
  const cierra = sinComentarios.indexOf('}', abre);
  return sinComentarios.slice(abre + 1, cierra);
}

/** Nombres `--var` declarados dentro de un cuerpo de bloque CSS, en orden. */
function fichasDeBloque(cuerpo: string): string[] {
  return [...cuerpo.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!);
}

// Las ocho variables de mascota y lápiz: literales a propósito, fuera del chequeo.
const FICHAS_MASCOTA_Y_LAPIZ: ReadonlySet<string> = new Set([
  '--color-tortuga-contorno',
  '--color-tortuga-relleno',
  '--color-tortuga-caparazon',
  '--color-tortuga-detalle',
  '--color-tortuga-cabeza',
  '--color-kiro-relleno',
  '--color-kiro-ojos',
  '--color-lapiz-relleno',
]);

// Nombres CSS de color que una derivada no debería traer como literal. No hace falta la
// lista entera de CSS: basta con los que podrían colarse por descuido en este tema.
const NOMBRES_CSS_COLOR: ReadonlyArray<string> = [
  'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'violet',
  'pink', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'teal', 'navy', 'maroon', 'olive',
  'silver', 'gold', 'indigo', 'crimson', 'salmon', 'coral', 'turquoise', 'lavender',
  'transparent', 'currentcolor',
];

/**
 * Busca en el valor de una variable derivada un color literal prohibido. Devuelve el
 * literal detectado, o null si el valor solo usa `var()` y `color-mix` de fichas.
 *
 * Se quitan primero las referencias `var(--x)` y la estructura de `color-mix(in srgb,
 * …, #000|#fff|transparent)`: el extremo de la mezcla es parte del mecanismo de
 * derivación admitido —una ficha aclarada (`#fff`), oscurecida (`#000`) o atenuada
 * (`transparent`)—, no un color suelto que compita con las fichas.
 */
function literalProhibidoEn(valor: string): string | null {
  let v = valor.toLowerCase();
  // Las referencias a fichas y el extremo de mezcla admitido no son infracciones.
  v = v.replace(/var\(\s*--[a-z0-9-]+\s*\)/g, ' ');
  v = v.replace(/color-mix\(in srgb,\s*([\s\S]*?)\s+\d+%\s*,\s*(?:#000|#fff|transparent)\s*\)/g, ' $1 ');
  // Tras quitar lo admitido, cualquier var() anidada de la mezcla se quita también.
  v = v.replace(/var\(\s*--[a-z0-9-]+\s*\)/g, ' ');

  const hex = /#[0-9a-f]{3,8}\b/.exec(v);
  if (hex) return hex[0];
  const rgb = /\brgba?\(/.exec(v);
  if (rgb) return 'rgb(…)';
  const hsl = /\bhsla?\(/.exec(v);
  if (hsl) return 'hsl(…)';
  for (const nombre of NOMBRES_CSS_COLOR) {
    if (new RegExp(`\\b${nombre}\\b`).test(v)) return nombre;
  }
  return null;
}

describe('2.1 · fichas y derivadas del tema (requisito 2.1)', () => {
  const CSS_TEMA = readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8');

  it('el primer bloque declara exactamente 19 fichas de la paleta Kiro', () => {
    const fichas = fichasDeBloque(primerBloqueFichas(CSS_TEMA));
    expect(fichas.length, `fichas encontradas: ${fichas.join(', ')}`).toBe(19);
    // No se repite ningún nombre: 19 fichas distintas.
    expect(new Set(fichas).size).toBe(19);
  });

  it('ninguna variable de color derivada trae un color literal (solo var() o color-mix de fichas)', () => {
    const fichas = new Set(fichasDeBloque(primerBloqueFichas(CSS_TEMA)));
    const todas = declaracionesDeTema(CSS_TEMA);

    const fallos: string[] = [];
    for (const [nombre, valor] of todas) {
      // Fuera del chequeo: las propias fichas, las reservas y las de mascota/lápiz.
      if (fichas.has(nombre)) continue;
      if (nombre.endsWith('-reserva')) continue;
      if (FICHAS_MASCOTA_Y_LAPIZ.has(nombre)) continue;
      // Solo las variables de color derivadas: `--color-*` y las dos variantes de ficha.
      const esColor =
        nombre.startsWith('--color-') ||
        nombre === '--acento-sombra' ||
        nombre === '--secundario-intenso';
      if (!esColor) continue;

      const literal = literalProhibidoEn(valor);
      if (literal !== null) {
        fallos.push(`${nombre}: ${valor}  → color literal detectado: ${literal}`);
      }
    }

    expect(fallos, `derivadas con color literal:\n${fallos.join('\n')}`).toEqual([]);
  });
});

describe('tema · presentación de la tortuga', () => {
  const CSS_TEMA = readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8');
  const valor = (nombre: string): string | null => {
    const m = new RegExp(`${nombre}\\s*:\\s*([^;]+);`).exec(CSS_TEMA);
    return m ? m[1]!.trim() : null;
  };

  it('el lápiz solo se ve levantado y la flecha de rumbo no se dibuja', () => {
    expect(valor('--lapiz-mostrar')).toBe('arriba');
    expect(valor('--marca-rumbo-mostrar')).toBe('no');
  });

  it('la concha, los escudos y los ojos de Kiro tienen color propio, y el contorno sigue legible sobre el lienzo', () => {
    for (const v of ['--color-tortuga-relleno', '--color-tortuga-caparazon', '--color-tortuga-detalle', '--color-kiro-ojos']) {
      expect(valor(v), v).not.toBeNull();
    }
    // La piel y la concha se distinguen entre sí y de los escudos (no es una mancha de un solo verde).
    expect(valor('--color-tortuga-relleno')).not.toBe(valor('--color-tortuga-caparazon'));
    expect(valor('--color-tortuga-caparazon')).not.toBe(valor('--color-tortuga-detalle'));
    // Los ojos de Kiro se leen sobre su sábana clara.
    const claro = '#f8f4ff';
    expect(contraste(valor('--color-kiro-ojos')!, claro)).toBeGreaterThanOrEqual(4.5);
    // La piel y la concha contra el fondo del lienzo, como las estelas: al menos 3:1.
    const fondo = leerVariableTema(CSS_TEMA, '--color-fondo-lienzo') ?? '#140a2a';
    expect(contraste(valor('--color-tortuga-relleno')!, fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(valor('--color-tortuga-caparazon')!, fondo)).toBeGreaterThanOrEqual(3);
  });
});

// --- Requisito 8.4: los elementos del lienzo, evaluados por separado, ≥ 3:1 ---
//
// El requisito 8.4 pide que, frente al fondo del Lienzo y evaluado POR SEPARADO,
// cada uno de estos alcance 3:1: la estela del jugador, la de referencia, cada una
// de las tres regiones del Diff y el CONJUNTO de la tortuga con Kiro. Las estelas
// ya las cubre «21.4 · accesibilidad WCAG del tema». Aquí se cierra el hueco de
// 8.3/8.4 que faltaba:
//   1. Se CONFIRMAN las tres regiones del Diff bajo el encuadre del 8.4 (misma razón
//      WCAG `contraste`, sin recálculo nuevo).
//   2. Se añade el conjunto tortuga+Kiro, incluida la sábana de Kiro
//      (`--color-kiro-relleno`), que ningún par existente verificaba contra el
//      fondo del Lienzo: es la parte más grande del fantasma y la que hace legible
//      al conjunto como un todo.
describe('8.4 · elementos del lienzo frente al fondo, por separado, ≥ 3:1', () => {
  const CSS_TEMA = readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8');
  const FONDO = leerVariableTema(CSS_TEMA, '--color-fondo-lienzo') ?? '#14111d';

  it('las tres regiones del Diff cumplen ≥ 3:1 (confirmación para 8.4)', () => {
    // Confirmación bajo el encuadre del 8.4; reusa la razón WCAG ya presente.
    for (const v of ['--color-diff-coincidencia', '--color-diff-exceso', '--color-diff-falta']) {
      const color = leerVariableTema(CSS_TEMA, v)!;
      expect(contraste(color, FONDO), `${v} = ${color}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('el conjunto tortuga + Kiro se lee sobre el lienzo: contorno y rellenos ≥ 3:1', () => {
    // El conjunto que se dibuja encima de la tortuga es un todo; para que se lea
    // como figura, cada color que lo define debe despegar del fondo. El contorno de
    // la tortuga, su piel y su concha ya los cubren otras pruebas; el hueco era la
    // sábana de Kiro (`--color-kiro-relleno`), que no aparecía en ningún par.
    const partesDelConjunto: ReadonlyArray<readonly [string, string]> = [
      ['contorno de la tortuga', '--color-tortuga-contorno'],
      ['piel de la tortuga', '--color-tortuga-relleno'],
      ['concha de la tortuga', '--color-tortuga-caparazon'],
      ['sábana de Kiro', '--color-kiro-relleno'],
    ];
    const fallos: string[] = [];
    for (const [nombre, v] of partesDelConjunto) {
      const color = leerVariableTema(CSS_TEMA, v);
      expect(color, `${nombre} (${v}) no se pudo leer`).not.toBeNull();
      const razon = contraste(color!, FONDO);
      if (razon < 3) fallos.push(`${nombre} ${color} sobre el lienzo ${FONDO}: ${razon.toFixed(2)}:1 < 3:1`);
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });
});

describe('21.4 · accesibilidad del DOM y recorrido por teclado', () => {
  beforeEach(() => {
    montarDom();
  });

  it('el documento declara lang="es"', () => {
    expect(document.documentElement.lang).toBe('es');
  });

  it('hay exactamente UNA región aria-live, polite, sin assertive y sin foco', () => {
    crearApp();
    const vivos = Array.from(document.querySelectorAll('[aria-live]'));
    expect(vivos.length).toBe(1);
    const region = vivos[0] as HTMLElement;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(document.querySelector('[aria-live="assertive"]')).toBeNull();
    // No es enfocable.
    expect(region.getAttribute('tabindex')).toBeNull();
  });

  it('cada control interactivo tiene un nombre accesible en español', () => {
    crearApp();
    const interactivos = Array.from(
      document.querySelectorAll('button, select, textarea, [role="button"]'),
    ) as HTMLElement[];
    expect(interactivos.length).toBeGreaterThan(0);
    const sinNombre: string[] = [];
    for (const el of interactivos) {
      const etiqueta = el.getAttribute('aria-label') ?? '';
      const texto = (el.textContent ?? '').trim();
      const nombre = etiqueta.trim().length > 0 ? etiqueta : texto;
      if (nombre.length === 0) sinNombre.push(el.outerHTML.slice(0, 60));
    }
    expect(sinNombre, sinNombre.join('\n')).toEqual([]);
  });

  it('el nivel 0.1 se recorre solo con teclado y el editor está a ≤ 20 Tabs', () => {
    const app = crearApp();
    // Reúne los elementos enfocables en orden del DOM (orden visual del layout).
    const enfocables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, select, input, [tabindex]:not([tabindex="-1"])',
      ),
    );
    const indiceEditor = enfocables.indexOf(app.editor.area);
    expect(indiceEditor).toBeGreaterThanOrEqual(0);
    expect(indiceEditor).toBeLessThanOrEqual(20);

    // El botón de ejecutar responde a Enter y a Espacio (activación por teclado).
    let ejecutado = 0;
    const botonEjecutar = document.querySelector<HTMLButtonElement>('.kl-control-ejecutar');
    expect(botonEjecutar).not.toBeNull();
    app.editor.area.value = 'AVANZA 100';
    app.editor.area.dispatchEvent(new Event('input'));
    app.editor.analizarAhora();
    botonEjecutar!.addEventListener('click', () => (ejecutado += 1));
    // Un botón nativo traduce Enter/Espacio a click; simulamos el click resultante.
    botonEjecutar!.click();
    expect(ejecutado).toBe(1);
  });
});
// ============================================================================
// 6.4 · Documento servido sin solicitudes a otro origen de fuentes (requisito 6.4)
// ============================================================================
//
// El requisito 6.4 cierra el desvío 00·27.8: si el documento servido declara
// enlaces o preconexiones a un origen de fuentes distinto del propio, una revisión
// del documento DEBE fallar. Estas pruebas leen el index.html real y lo revisan.
//
// NOTA (tarea 8.1): con el estado actual estas pruebas FALLAN a propósito, porque
// index.html todavía trae dos `preconnect` y un `stylesheet` a Google Fonts
// (fonts.googleapis.com y fonts.gstatic.com). El fallo confirma que la verificación
// detecta el incumplimiento de 00·27.8. El reemplazo por fuentes autoalojadas es la
// tarea 8.3 y requiere aprobación del usuario; esta tarea solo escribe la prueba.

/**
 * Orígenes de fuentes externos que el documento servido no debe tocar. La lista
 * nombra los habituales (Google Fonts) pero la revisión real no se limita a ellos:
 * cualquier enlace o preconexión a un host que no sea el propio origen es un fallo.
 */
const HOSTS_FUENTES_EXTERNOS: ReadonlyArray<string> = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

/** Extrae cada etiqueta <link ...> del HTML, en orden de aparición. */
function etiquetasLink(html: string): string[] {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
}

/** Lee el valor de un atributo de una etiqueta (rel, href, …); null si falta. */
function atributoDe(etiqueta: string, nombre: string): string | null {
  const m = new RegExp(`\\b${nombre}\\s*=\\s*"([^"]*)"`, 'i').exec(etiqueta);
  return m ? m[1]! : null;
}

/**
 * El host de una URL de recurso. Una URL absoluta (http(s)://host/…, //host/…) sí
 * tiene host; una relativa al propio origen (./…, /…, sin esquema) no, y devuelve null.
 */
function hostDeRecurso(url: string): string | null {
  const u = url.trim();
  const m = /^(?:https?:)?\/\/([^/]+)/i.exec(u);
  return m ? m[1]!.toLowerCase() : null;
}

describe('6.4 · el documento servido no pide fuentes a otro origen', () => {
  const HTML = readFileSync(join(RAIZ_SRC, '..', 'index.html'), 'utf8');
  const LINKS = etiquetasLink(HTML);

  it('ningún <link> declara una preconexión a un origen externo', () => {
    const externos: string[] = [];
    for (const link of LINKS) {
      const rel = (atributoDe(link, 'rel') ?? '').toLowerCase();
      if (!/\b(?:preconnect|dns-prefetch)\b/.test(rel)) continue;
      const host = hostDeRecurso(atributoDe(link, 'href') ?? '');
      if (host !== null) externos.push(`${host}  ←  ${link}`);
    }
    expect(
      externos,
      `preconexiones a un origen externo (deben eliminarse para cumplir 6.4):\n${externos.join('\n')}`,
    ).toEqual([]);
  });

  it('ningún <link rel="stylesheet"> apunta a un origen externo', () => {
    const externos: string[] = [];
    for (const link of LINKS) {
      const rel = (atributoDe(link, 'rel') ?? '').toLowerCase();
      if (!/\bstylesheet\b/.test(rel)) continue;
      const host = hostDeRecurso(atributoDe(link, 'href') ?? '');
      if (host !== null) externos.push(`${host}  ←  ${link}`);
    }
    expect(
      externos,
      `hojas de estilo servidas desde otro origen (deben autoalojarse para cumplir 6.4):\n${externos.join('\n')}`,
    ).toEqual([]);
  });

  it('el documento no menciona ningún host conocido de fuentes externas', () => {
    const encontrados = HOSTS_FUENTES_EXTERNOS.filter((host) => HTML.includes(host));
    expect(
      encontrados,
      `referencias a servicios de fuentes externos en index.html:\n${encontrados.join('\n')}`,
    ).toEqual([]);
  });
});

// ============================================================================
// 6.1 / 6.2 · La tipografía autoalojada se aplica de verdad (no cae a la reserva)
// ============================================================================
//
// Tras el reemplazo de la tarea 8.3, las fuentes se autoalojan con los paquetes
// @fontsource-variable (OFL), importados desde main.ts para que Vite los empaquete
// como activos del propio origen. El @font-face de esos paquetes declara las familias
// con el sufijo «Variable» (`Bricolage Grotesque Variable`, `JetBrains Mono Variable`).
// Para que la fuente autoalojada se use de verdad y NO se caiga a la pila del sistema,
// esa familia tiene que ir AL FRENTE de cada pila de `tema.css`, y main.ts tiene que
// importar su CSS (sin el import, Vite no empaqueta nada y el @font-face no existe).
//
// jsdom no hace layout ni carga woff2, así que «la familia computada» se comprueba
// sobre la cascada de variables de `tema.css`: la primera familia de cada pila es la
// autoalojada, no una de reserva del sistema.
describe('6.1 / 6.2 · la fuente autoalojada se aplica y no cae a la reserva', () => {
  const CSS_TEMA = readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8');
  const MAIN_TS = readFileSync(join(RAIZ_SRC, 'main.ts'), 'utf8');

  /** La pila de una variable de fuente de `tema.css`, como lista de familias ya sin comillas. */
  function pilaFuente(nombre: string): string[] {
    const m = new RegExp(`${nombre}\\s*:\\s*([^;]+);`).exec(CSS_TEMA);
    if (m === null) return [];
    return m[1]!
      .split(',')
      .map((f) => f.trim().replace(/^["']|["']$/g, ''))
      .filter((f) => f.length > 0);
  }

  it('la familia de título, interfaz y código empieza por la autoalojada «…Variable»', () => {
    expect(pilaFuente('--fuente-titulo')[0]).toBe('Bricolage Grotesque Variable');
    expect(pilaFuente('--fuente-ui')[0]).toBe('Bricolage Grotesque Variable');
    expect(pilaFuente('--fuente-codigo')[0]).toBe('JetBrains Mono Variable');
  });

  it('cada pila conserva una reserva del sistema detrás de la autoalojada', () => {
    // La reserva legible es el resto de la pila: si solo hubiera la autoalojada, un
    // fallo de carga dejaría al jugador sin fuente usable.
    expect(pilaFuente('--fuente-titulo').length).toBeGreaterThan(1);
    expect(pilaFuente('--fuente-ui').length).toBeGreaterThan(1);
    expect(pilaFuente('--fuente-codigo').length).toBeGreaterThan(1);
    expect(pilaFuente('--fuente-titulo')).toContain('sans-serif');
    expect(pilaFuente('--fuente-ui')).toContain('sans-serif');
    expect(pilaFuente('--fuente-codigo')).toContain('monospace');
  });

  it('la reserva del sistema (tarea 8.4) nombra familias reales antes del genérico', () => {
    // Requisito 6.3: si la fuente autoalojada no está disponible, el texto queda
    // legible y la interfaz operable SIN pedir nada a otro origen. Para eso la pila
    // necesita, entre la autoalojada y el genérico final, al menos una familia del
    // SISTEMA con nombre propio (Segoe UI, Consolas, system-ui…): el genérico suelto
    // garantiza una fuente pero no una elección legible previsible.
    const reservaDelSistema = (nombre: string, generico: string): string[] => {
      const pila = pilaFuente(nombre);
      // Todo lo que va detrás de la familia autoalojada (índice 0) y antes del
      // genérico final es la reserva del sistema con nombre propio.
      const finGenerico = pila.lastIndexOf(generico);
      return pila.slice(1, finGenerico === -1 ? pila.length : finGenerico);
    };

    for (const [nombre, generico] of [
      ['--fuente-titulo', 'sans-serif'],
      ['--fuente-ui', 'sans-serif'],
      ['--fuente-codigo', 'monospace'],
    ] as const) {
      const sistema = reservaDelSistema(nombre, generico);
      expect(
        sistema.length,
        `${nombre} debe nombrar al menos una familia del sistema antes de ${generico}`,
      ).toBeGreaterThan(0);
      // El genérico cierra la pila: es la última red de seguridad, nunca lo primero.
      expect(pilaFuente(nombre).at(-1), `${nombre} debe terminar en ${generico}`).toBe(generico);
    }
  });

  it('main.ts importa el CSS de los paquetes autoalojados para que Vite los empaquete', () => {
    // Sin estos imports, Vite no empaqueta el @font-face y la familia «…Variable» no
    // existe, de modo que el navegador caería a la pila del sistema.
    expect(MAIN_TS).toContain("@fontsource-variable/bricolage-grotesque/index.css");
    expect(MAIN_TS).toContain("@fontsource-variable/bricolage-grotesque/opsz.css");
    expect(MAIN_TS).toContain("@fontsource-variable/jetbrains-mono/index.css");
  });
});

// ============================================================================
// 7.7 / 7.8 · La marca: logo como <img> accesible y mascota como fondo CSS
// ============================================================================
//
// Dato real del código (confirmado al escribir esta prueba):
//   - El LOGO es un <img ... alt="KiroLogo"> dentro del <h1> de index.html, con
//     src en /marca/ (public/marca/). Su nombre accesible sale del `alt`, que es
//     texto: queda disponible aunque la imagen no cargue (sin red, bloqueada o con
//     la carpeta `public/marca/` ausente del repositorio).
//   - La MASCOTA NO es un <img>: es una imagen de FONDO declarada en CSS, en la
//     regla `.kl-globo::before` de pantalla.css (`background: url("/marca/mascota.png")`).
//     Por eso aquí NO se exige que la mascota sea un <img>; se verifica su declaración
//     como fondo. Si el fondo falta, el globo queda sin mascota pero sigue operando,
//     que es justo lo que la hace una decoración y no contenido.
//
// El registro de la excepción temporal al steering `tecnologia` por estos dos
// activos de public/marca/ se hace en la tarea 11 (bitácora), no aquí.

describe('7.7 / 7.8 · marca: logo <img> accesible y mascota de fondo CSS', () => {
  const HTML = readFileSync(join(RAIZ_SRC, '..', 'index.html'), 'utf8');
  const CSS_PANTALLA = readFileSync(join(RAIZ_SRC, 'estilos', 'pantalla.css'), 'utf8');

  describe('el logo es un <img> de /marca/ con nombre accesible «KiroLogo»', () => {
    // Se monta solo el <body> del index.html real (sin su <script> de módulo) para
    // inspeccionar el logo tal como lo ve el navegador, sin arrancar la aplicación.
    beforeEach(() => {
      const cuerpo = /<body>([\s\S]*)<\/body>/.exec(HTML)![1]!.replace(/<script[\s\S]*?<\/script>/g, '');
      document.documentElement.lang = 'es';
      document.body.innerHTML = cuerpo;
    });

    it('el logo es un elemento <img> cuyo src vive en /marca/ (public/marca/)', () => {
      const logo = document.querySelector('h1 img');
      expect(logo).not.toBeNull();
      expect(logo!.tagName).toBe('IMG');
      // El src apunta a la carpeta de marca servida desde la raíz (base '/').
      expect(logo!.getAttribute('src')).toMatch(/^\/marca\//);
    });

    it('su nombre accesible es «KiroLogo» y sale del atributo alt (texto, no de la imagen)', () => {
      const logo = document.querySelector<HTMLImageElement>('h1 img')!;
      // El nombre accesible de una imagen con alt es su alt; el h1 no aporta texto
      // visible aparte, así que el nombre del encabezado es el del producto.
      expect(logo.getAttribute('alt')).toBe('KiroLogo');
      expect(document.querySelector('h1')!.textContent!.trim()).toBe('');
    });

    it('el nombre «KiroLogo» queda disponible aunque la imagen no cargue', () => {
      // El `alt` es un atributo del documento: existe y se puede leer con
      // independencia de que el recurso de /marca/ llegue a descargarse. Se simula
      // un fallo de carga disparando el evento `error` sobre el <img>; el nombre
      // accesible (el alt) no cambia.
      const logo = document.querySelector<HTMLImageElement>('h1 img')!;
      const altAntes = logo.getAttribute('alt');
      logo.dispatchEvent(new Event('error'));
      expect(logo.getAttribute('alt')).toBe(altAntes);
      expect(logo.getAttribute('alt')).toBe('KiroLogo');
    });
  });

  describe('la mascota es una imagen de fondo CSS, no un <img>', () => {
    /** El cuerpo `{...}` de una regla CSS cuyo selector contiene `selector`. */
    function cuerpoDeRegla(css: string, selector: string): string | null {
      const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
      const inicio = sinComentarios.indexOf(selector);
      if (inicio === -1) return null;
      const abre = sinComentarios.indexOf('{', inicio);
      if (abre === -1) return null;
      const cierra = sinComentarios.indexOf('}', abre);
      if (cierra === -1) return null;
      return sinComentarios.slice(abre + 1, cierra);
    }

    it('pantalla.css declara la mascota como background de .kl-globo::before hacia /marca/mascota.png', () => {
      const regla = cuerpoDeRegla(CSS_PANTALLA, '.kl-globo::before');
      expect(regla, 'no se encontró la regla .kl-globo::before en pantalla.css').not.toBeNull();
      // Alguna declaración `background`/`background-image` de esa regla trae la url de la mascota.
      const fondo = /background(?:-image)?\s*:\s*([^;]+);/i.exec(regla!);
      expect(fondo, 'la regla .kl-globo::before no declara background').not.toBeNull();
      expect(fondo![1]!).toMatch(/url\(\s*["']?\/marca\/mascota\.png["']?\s*\)/i);
    });

    it('no se exige que la mascota sea un <img>: el index.html real no la monta como imagen', () => {
      // Confirmación del dato real: el único <img> del documento es el logo; la
      // mascota no aparece como elemento <img> en ninguna parte del cuerpo servido.
      const cuerpo = /<body>([\s\S]*)<\/body>/.exec(HTML)![1]!;
      const fuentesImg = [...cuerpo.matchAll(/<img\b[^>]*\bsrc\s*=\s*"([^"]*)"/gi)].map((m) => m[1]!);
      expect(fuentesImg.some((s) => /mascota/i.test(s))).toBe(false);
    });
  });
});

// ============================================================================
// 3.2 · Escala del conjunto de personajes y no solapamiento en el Nivel 0.1
//
// Ya cubierto por `src/motor/personajes.test.ts`: la escala en sí (a escala k los
// trazos quedan k veces más lejos de la posición de la tortuga; una escala inválida
// equivale a sin escala). Aquí se cierra el hueco de la tarea 3.2:
//   1. que `ESCALA_PERSONAJES = 2.4` vive en `src/main.ts` como DECISIÓN DE
//      PRESENTACIÓN (no en `personajes.ts`, que es puro y no conoce la escala);
//   2. que en el Nivel 0.1 —un tramo abierto que termina lejos del inicio— la
//      silueta de la tortuga EN REPOSO, dibujada en el Estado inicial con esa
//      escala, NO se solapa con el extremo final del trazo (enmienda de 00·13.6).
//
// La garantía se limita al 0.1: en las figuras cerradas (p. ej. el cuadrado del
// 0.4) el trazo termina en el punto de partida, donde la tortuga descansa.
// Valida: Requisitos 3.2
// ============================================================================

import { dibujarPersonajes, type EstadoPersonajes } from './motor/personajes.js';
import { ESTADO_INICIAL } from './motor/tortuga.js';
import { resolverReto } from './juego/reto.js';

describe('3.2 · ESCALA_PERSONAJES vive en main.ts como decisión de presentación', () => {
  const MAIN_TS = readFileSync(join(RAIZ_SRC, 'main.ts'), 'utf8');

  it('main.ts declara la constante ESCALA_PERSONAJES con el valor 2.4', () => {
    // El valor exacto es el que fija la enmienda de 00·13.6: escala 2,4 respecto
    // del círculo de 40 unidades. Se lee del texto porque es un `const` privado
    // del cableador, no una exportación.
    const m = /\bconst\s+ESCALA_PERSONAJES\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/.exec(MAIN_TS);
    expect(m, 'no se halló `const ESCALA_PERSONAJES = …;` en main.ts').not.toBeNull();
    expect(Number.parseFloat(m![1]!)).toBeCloseTo(2.4, 9);
  });

  it('la escala es una decisión de presentación de main.ts, no de personajes.ts', () => {
    // El módulo puro de los personajes no conoce ninguna escala fija: solo recibe
    // `escala` por el estado. Que la constante no exista allí es parte de la regla.
    const PERSONAJES_TS = readFileSync(join(RAIZ_SRC, 'motor', 'personajes.ts'), 'utf8');
    expect(PERSONAJES_TS).not.toContain('ESCALA_PERSONAJES');
  });

  it('main.ts entrega esa misma constante al dibujo de personajes (no un valor suelto)', () => {
    // El agrandado del conjunto sale de la constante, no de un número escrito a mano
    // en el punto de dibujo: así presentación y validación comparten la decisión.
    expect(MAIN_TS).toMatch(/escala:\s*ESCALA_PERSONAJES/);
  });
});

describe('3.2 · la tortuga en reposo del Nivel 0.1 no tapa el extremo final del trazo', () => {
  /** La escala de presentación, leída de main.ts para no fijar aquí un duplicado. */
  const ESCALA = (() => {
    const texto = readFileSync(join(RAIZ_SRC, 'main.ts'), 'utf8');
    const m = /\bconst\s+ESCALA_PERSONAJES\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*;/.exec(texto);
    return Number.parseFloat(m![1]!);
  })();

  /** Estilo concreto de personajes; los colores reales los resuelve el tema en producción. */
  function estiloPersonajes(): import('./motor/personajes.js').EstiloPersonajes {
    return {
      contorno: '#212529',
      relleno: '#ffffff',
      cabeza: '#343a40',
      kiroContorno: '#0d6efd',
      kiroRelleno: 'rgba(13,110,253,0.1)',
      lapizContorno: '#dc3545',
      marcaRumbo: '#ff6b6b',
      grosor: 1.5,
    };
  }

  /**
   * Radio de la silueta de la tortuga en reposo en el Estado inicial del 0.1
   * (centro, rumbo 0), dibujada con la escala de presentación: el punto trazado
   * más lejano desde la posición de la tortuga. `radioMaximoDesdeOrigen` mide
   * desde (0,0), que es justamente la posición del Estado inicial del 0.1.
   */
  function radioSiluetaEnReposo(): number {
    const ctx = new DobleDibujo();
    const estado: EstadoPersonajes = {
      tortuga: ESTADO_INICIAL, // centro (0,0), rumbo 0, lápiz abajo
      kiroMontado: true,
      inclinacionKiro: 0,
      identidad: 'kiro',
      celebracion: false,
      escala: ESCALA,
    };
    const r = dibujarPersonajes(ctx, estado, estiloPersonajes);
    expect(r.valido).toBe(true);
    return ctx.radioMaximoDesdeOrigen();
  }

  it('el reto del 0.1 es un tramo abierto cuyo extremo final queda lejos del inicio', () => {
    const resultado = resolverReto('0.1', 0);
    expect(resultado.exito).toBe(true);
    if (!resultado.exito) return;
    const segmentos = resultado.reto.segmentos;
    // Un solo tramo (AVANZA 100): abierto, no vuelve al inicio.
    expect(segmentos.length).toBe(1);
    const inicio = ESTADO_INICIAL.posicion;
    const fin = segmentos[segmentos.length - 1]!.hasta;
    const distanciaFin = Math.hypot(fin.x - inicio.x, fin.y - inicio.y);
    expect(distanciaFin).toBeGreaterThan(0);
    // El extremo final está donde dice el reto: a 100 unidades del arranque.
    expect(distanciaFin).toBeCloseTo(100, 6);
  });

  it('la silueta en reposo no alcanza el extremo final del trazo', () => {
    const resultado = resolverReto('0.1', 0);
    expect(resultado.exito).toBe(true);
    if (!resultado.exito) return;
    const inicio = ESTADO_INICIAL.posicion;
    const fin = resultado.reto.segmentos[resultado.reto.segmentos.length - 1]!.hasta;
    const distanciaFin = Math.hypot(fin.x - inicio.x, fin.y - inicio.y);

    // Radio de la silueta (con media mitad de trazo de margen, como en el círculo
    // de 40 de personajes.test.ts) más un margen de holgura visible: todo eso cabe
    // con sobra antes de llegar a la punta del trazo.
    const margenTrazo = 1.5 / 2; // media del grosor de contorno
    const alcanceSilueta = radioSiluetaEnReposo() + margenTrazo;

    // No solapamiento: la silueta no llega al extremo final.
    expect(alcanceSilueta).toBeLessThan(distanciaFin);
    // Y además con holgura clara (la punta está más allá del borde de la tortuga).
    expect(distanciaFin - alcanceSilueta).toBeGreaterThan(10);
  });
});

// ============================================================================
// 1.1–1.4, 1.8 · Estructura de la Pantalla (tarea 9.1)
// ============================================================================
//
// El grupo «21.3 · estructura de archivos» y la prueba «cada pieza de la interfaz
// cae en su ranura de index.html» (más la de «hay exactamente UNA región aria-live»)
// ya confirman la región aria-live única, las ranuras y los id de los lienzos. Esta
// tarea NO duplica eso: añade solo el hueco que faltaba de los requisitos 1.1–1.4 y 1.8:
//
//   (a) que pantalla.css declara la regla de las TRES COLUMNAS de la escena, y
//   (b) que una @media de ancho reducido APILA a una sola columna con el orden
//       exigido (figura de Kiro, programa, figura del jugador); y
//   (c) que, al no encontrar su ranura, una pieza se cuelga del contenedor raíz
//       #aplicacion sin omitirse ni interrumpir el montaje de las demás (1.2).
// ============================================================================

describe('1.1–1.4 · pantalla.css define las tres columnas y el apilado responsivo', () => {
  const CSS_PANTALLA = readFileSync(join(RAIZ_SRC, 'estilos', 'pantalla.css'), 'utf8');
  const SIN_COMENTARIOS = CSS_PANTALLA.replace(/\/\*[\s\S]*?\*\//g, '');

  /** Cuerpo de la primera regla cuyo selector es exactamente `selector`, fuera de @media. */
  function cuerpoDeReglaBase(selector: string): string | null {
    // Recorre bloques equilibrados { } para no cruzar la frontera de un @media.
    const re = new RegExp(`(^|[}])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g');
    const m = re.exec(SIN_COMENTARIOS);
    if (m === null) return null;
    const inicio = re.lastIndex;
    let prof = 1;
    for (let i = inicio; i < SIN_COMENTARIOS.length; i++) {
      const c = SIN_COMENTARIOS[i]!;
      if (c === '{') prof++;
      else if (c === '}') {
        prof--;
        if (prof === 0) return SIN_COMENTARIOS.slice(inicio, i);
      }
    }
    return null;
  }

  /** Cuerpo completo de la primera @media cuya condición contiene `condicion`. */
  function cuerpoDeMedia(condicion: string): string | null {
    const marca = `@media (${condicion})`;
    const pos = SIN_COMENTARIOS.indexOf(marca);
    if (pos === -1) return null;
    const inicio = SIN_COMENTARIOS.indexOf('{', pos) + 1;
    let prof = 1;
    for (let i = inicio; i < SIN_COMENTARIOS.length; i++) {
      const c = SIN_COMENTARIOS[i]!;
      if (c === '{') prof++;
      else if (c === '}') {
        prof--;
        if (prof === 0) return SIN_COMENTARIOS.slice(inicio, i);
      }
    }
    return null;
  }

  /** Cuenta las columnas (tracks) de un valor de `grid-template-columns`. */
  function contarColumnas(valor: string): number {
    // Colapsa los paréntesis (minmax(...), repeat(...)) a un solo token para que
    // sus comas internas no se cuenten como separadores de columnas.
    let plano = valor.trim();
    let previo: string;
    do {
      previo = plano;
      plano = plano.replace(/\([^()]*\)/g, 'X');
    } while (plano !== previo);
    return plano.split(/\s+/).filter((t) => t.length > 0).length;
  }

  it('1.1 · la escena (.kl-escena) es una cuadrícula de exactamente tres columnas', () => {
    const cuerpo = cuerpoDeReglaBase('.kl-escena');
    expect(cuerpo, 'no se encontró la regla base .kl-escena en pantalla.css').not.toBeNull();
    expect(cuerpo!).toMatch(/display\s*:\s*grid/);
    const m = /grid-template-columns\s*:\s*([^;]+);/.exec(cuerpo!);
    expect(m, 'la escena no declara grid-template-columns').not.toBeNull();
    expect(contarColumnas(m![1]!), `grid-template-columns = ${m![1]!.trim()}`).toBe(3);
  });

  it('1.5–1.7 · una @media de ancho reducido apila la escena en una sola columna', () => {
    const cuerpo = cuerpoDeMedia('max-width: 720px');
    expect(cuerpo, 'no se encontró la @media (max-width: 720px) en pantalla.css').not.toBeNull();
    // Dentro de esa consulta, .kl-escena pasa a una sola columna.
    const reEscena = /\.kl-escena\s*\{([^}]*)\}/.exec(cuerpo!);
    expect(reEscena, 'la @media no redefine .kl-escena').not.toBeNull();
    const cols = /grid-template-columns\s*:\s*([^;]+);/.exec(reEscena![1]!);
    expect(cols, 'la @media no fija grid-template-columns en la escena').not.toBeNull();
    expect(contarColumnas(cols![1]!), `apilado = ${cols![1]!.trim()}`).toBe(1);
  });

  it('1.7 · el apilado ordena figura de Kiro, programa y figura del jugador', () => {
    const cuerpo = cuerpoDeMedia('max-width: 720px')!;
    // Cada pieza fija su `order`; el orden exigido es referencia (1), programa (2), jugador (3).
    const orden = (selector: string): number => {
      const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
      const bloque = re.exec(cuerpo);
      expect(bloque, `la @media no define ${selector}`).not.toBeNull();
      const m = /order\s*:\s*(-?\d+)/.exec(bloque![1]!);
      expect(m, `${selector} no declara order`).not.toBeNull();
      return Number(m![1]!);
    };
    const kiro = orden('.kl-lienzo-referencia');
    const programa = orden('.kl-programa');
    const jugador = orden('.kl-lienzo-jugador');
    // El orden es estrictamente creciente: Kiro arriba, programa en medio, jugador al final.
    expect(kiro).toBeLessThan(programa);
    expect(programa).toBeLessThan(jugador);
  });
});

// ============================================================================
// 1.2 · Si una pieza no encuentra su ranura, cuelga del contenedor raíz
// ============================================================================
//
// Requisito 1.2: SI una pieza de interfaz no encuentra su Ranura en index.html,
// ENTONCES la Pantalla DEBERÁ colgarla del contenedor raíz #aplicacion, sin
// omitirla ni interrumpir el montaje de las demás. En main.ts esto se resuelve con
// `ranura(id) = getElementById(id) ?? contenedor`: una pieza sin ranura cae en
// #aplicacion, y el resto de las piezas se montan igual.

describe('1.2 · una pieza sin ranura cuelga de #aplicacion sin romper el montaje', () => {
  /** Monta el cuerpo del index.html real (sin su <script>). */
  function montarIndexReal(): void {
    const html = readFileSync(join(RAIZ_SRC, '..', 'index.html'), 'utf8');
    const cuerpo = /<body>([\s\S]*)<\/body>/.exec(html)![1]!.replace(/<script[\s\S]*?<\/script>/g, '');
    document.documentElement.lang = 'es';
    document.body.innerHTML = cuerpo;
  }

  function relojManualSimple(): Reloj {
    let t = 0;
    let n = 1;
    const p = new Map<number, (ahora: number) => void>();
    return {
      programar(cb) { const id = n++; p.set(id, cb); return id; },
      cancelar(id) { p.delete(id); },
      ahora() { return t; },
    };
  }

  function arrancar(): void {
    crearAplicacion({
      documento: document,
      almacen: null,
      reloj: relojManualSimple(),
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoNormal,
      idNivel: '0.1',
    });
  }

  it('quita dos ranuras y sus piezas aparecen bajo #aplicacion, con las demás intactas', () => {
    montarIndexReal();
    // Borramos del DOM dos ranuras: el panel de semilla y el marcador de estrellas.
    for (const id of ['ranura-reto', 'ranura-marcador']) {
      document.getElementById(id)!.remove();
    }
    expect(document.getElementById('ranura-reto')).toBeNull();
    expect(document.getElementById('ranura-marcador')).toBeNull();

    // El montaje completo no lanza ninguna excepción pese a faltar dos ranuras.
    expect(() => arrancar()).not.toThrow();

    const aplicacion = document.getElementById('aplicacion')!;
    // Las dos piezas huérfanas existen y cuelgan (directa o indirectamente) de #aplicacion,
    // no se omitieron.
    const panelSemilla = document.querySelector('.kl-panel-semilla');
    const marcador = document.querySelector('.kl-marcador');
    expect(panelSemilla, 'el panel de semilla no se montó').not.toBeNull();
    expect(marcador, 'el marcador de estrellas no se montó').not.toBeNull();
    expect(aplicacion.contains(panelSemilla!)).toBe(true);
    expect(aplicacion.contains(marcador!)).toBe(true);
    // Y como su ranura ya no existe, cuelgan del propio contenedor raíz, no de una ranura.
    expect(panelSemilla!.closest('[id^="ranura-"]')).toBeNull();
    expect(marcador!.closest('[id^="ranura-"]')).toBeNull();

    // Las piezas cuyas ranuras SÍ existen se montaron en su sitio, sin interrupción.
    expect(document.querySelector('#ranura-ruta .kl-menu-mundos')).not.toBeNull();
    for (const clase of ['.kl-globo', '.kl-editor', '.kl-controles', '.kl-panel-comandos']) {
      expect(document.querySelector(`#programa ${clase}`), clase).not.toBeNull();
    }
  });
});

// ============================================================================
// 21.5 · Prueba_Color_Plano: los estilos no reintroducen efectos prohibidos
//
// Feature: 09-ajustes-de-interfaz, Property 5: Los estilos no reintroducen efectos prohibidos
//
// Lee el texto real de pantalla.css y tema.css y falla si reaparece un Degradado
// (linear/radial/conic-gradient) o un Resplandor_Difuminado (drop-shadow/text-shadow,
// o box-shadow con radio de desenfoque > 0) de la lista cerrada de la spec 09. La
// Sombra_Dura (box-shadow con blur 0, incluido el anillo `0 0 0 3px` de spread) se
// permite, y el drop-shadow/text-shadow solo se admite en tres selectores de
// excepción, anclados por selector + propiedad.
// Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4
// ============================================================================

interface ReglaCss {
  readonly selector: string;
  readonly cuerpo: string;
}

/**
 * Parte un CSS en reglas de primer nivel [{selector, cuerpo}] por bloques `{…}`
 * equilibrados, tras quitar los comentarios. Las reglas anidadas dentro de un
 * `@media`/`@supports` se recogen también, aplanadas, para que una sombra o un
 * degradado escondido en una media query tampoco se escape.
 */
function parsearBloques(css: string): ReglaCss[] {
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const reglas: ReglaCss[] = [];

  const recorrer = (texto: string): void => {
    let i = 0;
    let encabezado = '';
    while (i < texto.length) {
      const c = texto[i]!;
      if (c === '{') {
        // Equilibra el bloque que abre aquí.
        let prof = 1;
        let j = i + 1;
        for (; j < texto.length && prof > 0; j++) {
          if (texto[j] === '{') prof++;
          else if (texto[j] === '}') prof--;
        }
        const cuerpo = texto.slice(i + 1, j - 1);
        const selector = encabezado.trim();
        if (/^@(media|supports)/i.test(selector)) {
          // At-rule contenedora: sus reglas internas se aplanan al mismo nivel.
          recorrer(cuerpo);
        } else if (selector.length > 0 && !selector.startsWith('@')) {
          reglas.push({ selector, cuerpo });
        }
        encabezado = '';
        i = j;
      } else {
        encabezado += c;
        i++;
      }
    }
  };

  recorrer(sinComentarios);
  return reglas;
}

/** Cuerpo de la primera regla cuyo selector coincide exactamente con `selector`. */
function cuerpoDe(reglas: readonly ReglaCss[], selector: string): string | null {
  const regla = reglas.find((r) => r.selector === selector);
  return regla ? regla.cuerpo : null;
}

/** Valor completo (sin `;`) de la primera declaración `propiedad: …` de un cuerpo. */
function valorDeclaracion(cuerpo: string, propiedad: string): string | null {
  const re = new RegExp(`(?:^|[;{\\s])${propiedad}\\s*:\\s*([^;]+)`, 'i');
  const m = re.exec(cuerpo);
  return m ? m[1]!.trim() : null;
}

/** Todas las declaraciones `propiedad: valor` de un cuerpo (una propiedad puede repetirse). */
function valoresDeclaracion(cuerpo: string, propiedad: string): string[] {
  const re = new RegExp(`(?:^|[;{\\s])${propiedad}\\s*:\\s*([^;]+)`, 'gi');
  const valores: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cuerpo)) !== null) valores.push(m[1]!.trim());
  return valores;
}

/**
 * Parte un valor por comas de primer nivel, ignorando las comas dentro de
 * paréntesis (color-mix(…), rgba(…), etc.). Sirve para separar las sombras
 * individuales de un `box-shadow` con varias sombras.
 */
function partirPorComasDeNivel(valor: string): string[] {
  const partes: string[] = [];
  let prof = 0;
  let actual = '';
  for (const c of valor) {
    if (c === '(') prof++;
    else if (c === ')') prof--;
    if (c === ',' && prof === 0) {
      partes.push(actual.trim());
      actual = '';
    } else {
      actual += c;
    }
  }
  if (actual.trim().length > 0) partes.push(actual.trim());
  return partes;
}

/**
 * Radio de desenfoque (blur) de una sola sombra de `box-shadow`. El blur es el
 * TERCER largo de la sombra (offset-x, offset-y, blur, spread). Si no hay tercer
 * largo, el blur es 0. Devuelve el número en px (el tema solo usa px/0 aquí).
 */
function blurDeSombra(sombra: string): number {
  // Quita `inset` y colapsa las funciones a un token para no confundir sus números.
  const limpia = sombra
    .replace(/\binset\b/gi, ' ')
    .replace(/\([^()]*\)/g, ' COLOR ');
  const largos: number[] = [];
  for (const token of limpia.split(/\s+/)) {
    const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(token.trim());
    if (m) largos.push(Number(m[1]!));
  }
  // largos = [offsetX, offsetY, blur?, spread?]; el blur es el índice 2.
  return largos.length >= 3 ? largos[2]! : 0;
}

describe('21.5 · Prueba_Color_Plano (requisitos 3.1–3.8, 4.1–4.4)', () => {
  const PANTALLA = readFileSync(join(RAIZ_SRC, 'estilos', 'pantalla.css'), 'utf8');
  const TEMA = readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8');
  const reglasPantalla = parsearBloques(PANTALLA);
  const reglasTema = parsearBloques(TEMA);
  const todasLasReglas = [...reglasPantalla, ...reglasTema];

  // Lista cerrada de (selector → propiedades) donde se admite un resplandor
  // difuminado como excepción documentada de color plano (requisito 4.4).
  const EXCEPCIONES_RESPLANDOR = new Map<string, Set<string>>([
    ['.kl-capa-estela-referencia', new Set(['filter'])],
    ['.kl-capa-estela-jugador', new Set(['filter'])],
    ['.kl-estrella[data-estado="otorgada"] .kl-estrella-icono', new Set(['text-shadow'])],
  ]);

  const GRADIENTES = /(linear|radial|conic)-gradient\(/i;

  it('ningún archivo de estilos reintroduce un degradado prohibido (body, medalla, pluma)', () => {
    // Los degradados prohibidos de esta spec vivían en body, .kl-insignia-medalla
    // y .kl-pluma. El body y la medalla no deben contenerlos; .kl-pluma no existe.
    const body = cuerpoDe(reglasPantalla, 'body');
    expect(body, 'no se encontró la regla body en pantalla.css').not.toBeNull();
    expect(GRADIENTES.test(body!), 'body reintrodujo un gradient()').toBe(false);

    const medalla = cuerpoDe(reglasPantalla, '.kl-insignia-medalla');
    expect(medalla, 'no se encontró .kl-insignia-medalla en pantalla.css').not.toBeNull();
    expect(GRADIENTES.test(medalla!), '.kl-insignia-medalla reintrodujo un gradient()').toBe(false);

    // .kl-pluma no debe existir, así que tampoco puede traer un gradient.
    expect(reglasPantalla.some((r) => r.selector.includes('kl-pluma'))).toBe(false);
  });

  it('no existe .kl-pluma (CSS sin uso retirado)', () => {
    const conPluma = todasLasReglas.filter((r) => r.selector.includes('kl-pluma'));
    expect(conPluma.map((r) => r.selector), 'reaparecieron reglas .kl-pluma').toEqual([]);
  });

  it('no queda CSS muerto de .kl-selector-* tras retirar el módulo', () => {
    const conSelector = todasLasReglas.filter((r) => r.selector.includes('kl-selector'));
    expect(conSelector.map((r) => r.selector), 'reaparecieron reglas .kl-selector-*').toEqual([]);
  });

  it('box-shadow con blur>0 en ninguna regla (tampoco en .kl-menu-mundos ni en el elemento en curso)', () => {
    const fallos: string[] = [];
    for (const regla of todasLasReglas) {
      for (const valor of valoresDeclaracion(regla.cuerpo, 'box-shadow')) {
        for (const sombra of partirPorComasDeNivel(valor)) {
          const blur = blurDeSombra(sombra);
          if (blur > 0) {
            fallos.push(`${regla.selector}: box-shadow con blur ${blur} ("${sombra}")`);
          }
        }
      }
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  it('drop-shadow/text-shadow solo en los tres selectores de excepción', () => {
    const fallos: string[] = [];
    for (const regla of todasLasReglas) {
      const admitidas = EXCEPCIONES_RESPLANDOR.get(regla.selector) ?? new Set<string>();

      // text-shadow: cualquier aparición fuera de un selector+propiedad admitido falla.
      if (/text-shadow\s*:/i.test(regla.cuerpo) && !admitidas.has('text-shadow')) {
        fallos.push(`${regla.selector}: text-shadow no permitido`);
      }
      // filter: drop-shadow(): igual, solo en los selectores que lo admiten.
      for (const valor of valoresDeclaracion(regla.cuerpo, 'filter')) {
        if (/drop-shadow\(/i.test(valor) && !admitidas.has('filter')) {
          fallos.push(`${regla.selector}: filter drop-shadow() no permitido`);
        }
      }
      // drop-shadow() nunca debe aparecer en otra propiedad fuera de las excepciones.
      if (/drop-shadow\(/i.test(regla.cuerpo)) {
        const permitidoPorFilter = admitidas.has('filter');
        const soloEnFilter = valoresDeclaracion(regla.cuerpo, 'filter').some((v) => /drop-shadow\(/i.test(v));
        if (!(permitidoPorFilter && soloEnFilter)) {
          fallos.push(`${regla.selector}: drop-shadow() fuera de un filter permitido`);
        }
      }
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  it('admite el drop-shadow de las dos estelas y el text-shadow de la estrella otorgada', () => {
    // Las excepciones documentadas siguen en su sitio: no se borraron al retirar el resto.
    const ref = cuerpoDe(reglasPantalla, '.kl-capa-estela-referencia');
    const jug = cuerpoDe(reglasPantalla, '.kl-capa-estela-jugador');
    const estrella = cuerpoDe(reglasPantalla, '.kl-estrella[data-estado="otorgada"] .kl-estrella-icono');
    expect(ref, 'falta .kl-capa-estela-referencia').not.toBeNull();
    expect(jug, 'falta .kl-capa-estela-jugador').not.toBeNull();
    expect(estrella, 'falta la estrella otorgada').not.toBeNull();
    expect(/drop-shadow\(/i.test(valorDeclaracion(ref!, 'filter') ?? '')).toBe(true);
    expect(/drop-shadow\(/i.test(valorDeclaracion(jug!, 'filter') ?? '')).toBe(true);
    expect(/text-shadow\s*:/i.test(estrella!)).toBe(true);
  });

  it('la Sombra_Dura (blur 0) no hace fallar la prueba', () => {
    // Una sombra dura típica del tema y el anillo de spread sin blur: ambos blur 0.
    expect(blurDeSombra('0 4px 0 #8a5a12')).toBe(0);
    expect(blurDeSombra('0 0 0 3px color-mix(in srgb, var(--aviso) 28%, transparent)')).toBe(0);
    expect(blurDeSombra('0.4rem 0.4rem 0 var(--secundario-intenso)')).toBe(0);
    // Y una con blur > 0 sí se detecta.
    expect(blurDeSombra('0 0 18px #fff')).toBeGreaterThan(0);
    // Al menos una Sombra_Dura real existe en pantalla.css y no dispara ningún fallo.
    const duras = reglasPantalla.flatMap((r) =>
      valoresDeclaracion(r.cuerpo, 'box-shadow')
        .flatMap(partirPorComasDeNivel)
        .filter((s) => blurDeSombra(s) === 0),
    );
    expect(duras.length).toBeGreaterThan(0);
  });

  it('ningún degradado en pantalla.css, en ninguna regla (ni linear/radial/conic)', () => {
    // La primera prueba de este grupo solo mira la primera regla de body y la medalla: un
    // degradado nuevo en otro selector, o en una segunda regla de body, se le escaparía.
    // Hoy pantalla.css no tiene ninguno (ni en comentarios), así que cualquiera que aparezca
    // es un regreso, esté donde esté. Igual que la de tema.css de abajo, pero sin comentarios.
    const sinComentarios = PANTALLA.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(GRADIENTES.test(sinComentarios), 'pantalla.css reintrodujo un gradient()').toBe(false);
  });

  it('ningún degradado prohibido en tema.css (ni linear/radial/conic)', () => {
    expect(GRADIENTES.test(TEMA), 'tema.css reintrodujo un gradient()').toBe(false);
  });
});

// ============================================================================
// repite-desbloqueo-mundo-1 · Prueba de exploración de la condición del bug
//
// Property 1 (Bug Condition): el editor y el panel reflejan el mundo del nivel
// en curso. Tras navegar de un nivel de un mundo a otro, el editor debe analizar
// con el mundo del nivel en curso y el panel debe listar el vocabulario de ese
// mundo. isBugCondition(X) = mundoDelEditor <> mundoDelNivelEnCurso.
//
// ESTA PRUEBA DEBE FALLAR sobre el código SIN arreglar: su fallo confirma el bug.
// Codifica el comportamiento esperado del diseño, así que validará el arreglo
// cuando pase tras implementarlo (tarea 3.4). El azar de ordenar los pares de
// mundos pasa por azar/prng.ts, nunca Math.random.
// ============================================================================

describe('repite-desbloqueo-mundo-1 · condición del bug (exploración, Property 1)', () => {
  beforeEach(() => {
    montarDom();
  });

  /** Niveles `.1` que existen hoy en el catálogo, uno por mundo disponible. */
  const NIVEL_INICIAL_DE_MUNDO: Readonly<Record<number, string>> = { 0: '0.1', 1: '1.1' };

  /**
   * Fabrica un almacén en memoria con todos los mundos disponibles APROBADOS
   * (estrella de precisión en cada nivel de 0 y 1), de modo que `irANivel` deje
   * navegar entre cualquier par de mundos reachables sin tener que resolver cada
   * reto a mano. Escribe directamente el JSON v2 que `cargarProgreso` interpreta.
   */
  function sembrarTodoAprobado(): Storage {
    const almacen = crearAlmacenMemoria();
    const estrellas = { precision: true, economia: true, abstraccion: true };
    const niveles: Record<string, unknown> = {};
    // Los cinco niveles del mundo 0 y los cinco del mundo 1 (ids x.1..x.5).
    for (const mundo of [0, 1]) {
      for (let n = 1; n <= 5; n++) {
        niveles[`${mundo}.${n}`] = { estrellas, mejorConteo: 1, ultimaSemilla: 0 };
      }
    }
    almacen.setItem('kirologo.progreso.v2', JSON.stringify({ version: 2, niveles, guiaVista: true }));
    return almacen;
  }

  /** Crea la app arrancando en `idNivel`, con el progreso que abre todos los mundos. */
  function crearAppEn(idNivel: string): Aplicacion {
    return crearAplicacion({
      documento: document,
      almacen: sembrarTodoAprobado(),
      reloj: relojInmediato(),
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoReducido,
      idNivel,
    });
  }

  /** Nombres de comando que el panel presenta ahora en el DOM (atributo data-comando). */
  function comandosDelPanel(): string[] {
    return [...document.querySelectorAll<HTMLElement>('.kl-comando')].map(
      (b) => b.getAttribute('data-comando') ?? '',
    );
  }

  /** ¿`estadoContador().errores` contiene un `comandoBloqueado` para `nombre`? */
  function hayComandoBloqueado(app: Aplicacion, nombre: string): boolean {
    return app.editor.estadoContador().errores.some(
      (e) => e.id === 'comandoBloqueado' && e.mensaje.includes(nombre),
    );
  }

  // --- Caso concreto del contraejemplo observado: 0 → 1 con REPITE ---
  it('contraejemplo 0 → 1: tras irANivel(1.1), REPITE no debe reportar comandoBloqueado', () => {
    const app = crearAppEn('0.1');
    app.irANivel('1.1');
    expect(app.nivelEnCurso()).toBe('1.1');

    escribir(app, 'REPITE 6 [ AVANZA 120 GIRADERECHA 15 ]');

    // Comportamiento esperado del diseño: en un nivel del mundo 1, REPITE (mundo 1)
    // está disponible y NO se reporta comandoBloqueado para él. Sobre el código sin
    // arreglar el editor sigue analizando con el mundo 0 y esta aserción FALLA.
    expect(
      hayComandoBloqueado(app, 'REPITE'),
      'el editor reportó comandoBloqueado para REPITE tras navegar al mundo 1',
    ).toBe(false);
  });

  it('contraejemplo 0 → 1: tras irANivel(1.1), el panel debe listar REPITE', () => {
    const app = crearAppEn('0.1');
    app.irANivel('1.1');
    expect(app.nivelEnCurso()).toBe('1.1');

    // Comportamiento esperado: el panel presenta el vocabulario del mundo 1, que
    // incluye REPITE. Sobre el código sin arreglar el panel conserva el vocabulario
    // del mundo 0 y esta aserción FALLA.
    expect(
      comandosDelPanel(),
      'el panel no incluye REPITE en sus entradas tras navegar al mundo 1',
    ).toContain('REPITE');
  });

  // --- Caso límite 1 → 0: REPITE debe volver a bloquearse nombrando el mundo 1 ---
  it('caso límite 1 → 0: tras irANivel(0.1) desde el mundo 1, REPITE SÍ debe reportar comandoBloqueado nombrando el mundo 1', () => {
    const app = crearAppEn('1.1');
    app.irANivel('0.1');
    expect(app.nivelEnCurso()).toBe('0.1');

    escribir(app, 'REPITE 6 [ AVANZA 120 GIRADERECHA 15 ]');

    const errorRepite = app.editor
      .estadoContador()
      .errores.find((e) => e.id === 'comandoBloqueado' && e.mensaje.includes('REPITE'));
    // En el mundo 0 REPITE está bloqueado y el mensaje nombra el mundo 1 donde se
    // desbloquea. Sobre el código sin arreglar el editor sigue analizando con el
    // mundo 1 (el del arranque), así que no bloquea REPITE y esta aserción FALLA.
    expect(
      errorRepite,
      'el editor no reportó comandoBloqueado para REPITE en el mundo 0',
    ).toBeDefined();
    expect(errorRepite!.mensaje).toContain('mundo 1');
  });

  // --- PBT acotado a pares (inicial, destino) reachables, con inicial != destino ---
  //
  // El dominio práctico de mundos reachables hoy es {0, 1} (el catálogo solo
  // declara esos mundos). Para todo par (inicial, destino) con inicial != destino,
  // tras navegar a `destino` el editor no debe reportar comandoBloqueado para
  // ningún comando con mundo <= destino, y el panel debe listar exactamente
  // comandosDelMundo(destino). El PRNG solo decide el ORDEN en que se recorren los
  // pares: el bug es determinista, así que el recorrido no cambia el veredicto.
  //
  // **Validates: Requirements 2.1, 2.2, 2.3**
  it('PBT: para todo par (inicial, destino) de mundos, tras navegar el editor y el panel reflejan el mundo destino', () => {
    const mundosDisponibles: Mundo[] = [0, 1];
    const pares: Array<{ inicial: Mundo; destino: Mundo }> = [];
    for (const inicial of mundosDisponibles) {
      for (const destino of mundosDisponibles) {
        if (inicial !== destino) pares.push({ inicial, destino });
      }
    }

    // Baraja el orden de los pares con el PRNG determinista (semilla fija): mismo
    // orden en cada corrida, reproducible y sin Math.random.
    const prng = crearPrng(20240607);
    for (let i = pares.length - 1; i > 0; i--) {
      const j = prng.entero(0, i);
      [pares[i], pares[j]] = [pares[j]!, pares[i]!];
    }

    for (const { inicial, destino } of pares) {
      montarDom();
      const app = crearAppEn(NIVEL_INICIAL_DE_MUNDO[inicial]!);
      app.irANivel(NIVEL_INICIAL_DE_MUNDO[destino]!);
      expect(app.nivelEnCurso()).toBe(NIVEL_INICIAL_DE_MUNDO[destino]);

      // Un programa con un comando representativo de cada mundo <= destino, para
      // provocar el bloqueo si el editor quedó en el mundo de arranque. REPITE es
      // el comando del mundo 1; AVANZA, del mundo 0.
      const programa = destino >= 1 ? 'REPITE 6 [ AVANZA 120 GIRADERECHA 15 ]' : 'AVANZA 120';
      escribir(app, programa);

      // Ningún comando con mundo <= destino debe quedar bloqueado.
      for (const entrada of comandosDelMundo(destino)) {
        expect(
          hayComandoBloqueado(app, entrada.nombre),
          `(${inicial} → ${destino}) el editor bloqueó ${entrada.nombre} (mundo ${entrada.mundo} <= ${destino})`,
        ).toBe(false);
      }

      // El panel debe presentar exactamente el vocabulario del mundo destino.
      const esperados = comandosDelMundo(destino).map((e) => e.nombre);
      expect(
        comandosDelPanel(),
        `(${inicial} → ${destino}) el panel no refleja el vocabulario del mundo ${destino}`,
      ).toEqual(esperados);
    }
  });
});

// ============================================================================
// Tarea 2 (spec repite-desbloqueo-mundo-1) · Property 2: Preservación
//
// Observación primero (¬C): se arranca DIRECTAMENTE en un nivel, sin navegar
// entre mundos, de modo que `mundoDelEditor = mundoDelNivelEnCurso`. En ese caso
// la ejecución del programa de referencia sigue usando `comandosDelMundo(
// nivel.mundo)` y el reto aprueba con las tres estrellas; y el editor analiza el
// texto del jugador con el mundo del nivel. Estas pruebas PASAN sobre el código
// sin arreglar y fijan la base que el arreglo debe preservar (la regresión del
// catálogo con tres estrellas ya vive en reto.test.ts, Property 25; aquí se
// observa el mismo invariante de punta a punta a través de la app).
// ============================================================================

describe('main · preservación: arrancar directo en un nivel (mundo del editor = mundo del nivel, ¬C)', () => {
  beforeEach(() => {
    montarDom();
  });

  /** Crea la app arrancando directamente en `idNivel`, con animación de golpe. */
  function crearAppEnNivel(idNivel: string): Aplicacion {
    return crearAplicacion({
      documento: document,
      almacen: null,
      reloj: relojInmediato(),
      relojEspera: relojEsperaInerte(),
      relojRebote: relojReboteInmediato,
      movimiento: movimientoReducido,
      idNivel,
    });
  }

  it('la referencia del 1.1 se ejecutó con los comandos del mundo 1 (REPITE) y dejó segmentos no vacíos', () => {
    const app = crearAppEnNivel('1.1');
    const reto = app.estado().reto;
    // El nivel 1.1 es del mundo 1 y su referencia usa REPITE (comando del mundo 1):
    // si la ejecución NO hubiera usado comandosDelMundo(1), REPITE no se ejecutaría
    // y no quedarían ni operaciones ni segmentos que dibujar. Que los haya confirma
    // que la ejecución de la referencia sigue usando comandosDelMundo(nivel.mundo).
    expect(reto.nivel.mundo).toBe(1);
    expect(reto.operaciones.length).toBeGreaterThan(0);
    expect(reto.segmentos.length).toBeGreaterThan(0);
    // El presupuesto de estrella deriva del conteo de la referencia, que incluye el
    // nodo REPITE: para el 1.1 autorado es 3 (REPITE + AVANZA + GIRADERECHA).
    expect(reto.presupuestoEstrella).toBe(3);
  });

  it('al arrancar directo en el 1.1, el editor analiza con el mundo 1 y no bloquea REPITE', () => {
    const app = crearAppEnNivel('1.1');
    expect(app.estado().reto.nivel.mundo).toBe(1);
    // El jugador escribe un programa con REPITE (comando del mundo 1).
    escribir(app, 'REPITE 4 [AVANZA 100 GIRADERECHA 90]');
    // El editor analiza con el mundo del nivel (1): REPITE no se reporta bloqueado.
    const bloqueoRepite = app.editor
      .estadoContador()
      .errores.find((e) => e.id === 'comandoBloqueado' && e.mensaje.includes('REPITE'));
    expect(bloqueoRepite, 'no debe bloquear REPITE en un nivel del mundo 1').toBeUndefined();
    // En cambio, un comando de un mundo posterior (SUBELAPIZ, mundo 2) sí se bloquea.
    escribir(app, 'SUBELAPIZ');
    const bloqueoSubelapiz = app.editor
      .estadoContador()
      .errores.find((e) => e.id === 'comandoBloqueado' && e.mensaje.includes('SUBELAPIZ'));
    expect(bloqueoSubelapiz, 'SUBELAPIZ (mundo 2) sigue bloqueado en el mundo 1').toBeDefined();
    expect(bloqueoSubelapiz!.mensaje).toContain('mundo 2');
  });

  it('arrancar directo en el 0.1 (mundo 0) sigue concediendo las tres estrellas a AVANZA 100', () => {
    // El caso ¬C del mundo 0: la referencia y el análisis usan el mundo 0, igual
    // que antes. Es la base que el arreglo no debe tocar.
    const app = crearAppEnNivel('0.1');
    expect(app.estado().reto.nivel.mundo).toBe(0);
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    const cal = app.estado().calificacion;
    expect(cal).not.toBeNull();
    expect(cal!.precision.otorgada).toBe(true);
    expect(cal!.economia.otorgada).toBe(true);
    expect(cal!.abstraccion.otorgada).toBe(true);
  });
});

// ============================================================================
// Errores de ejecución en el mundo 2 (reseña del PR #24, punto 4)
//
// Un error que detiene el programa a medias (color o grosor inválido, por
// ejemplo) se explica en el globo de Kiro y el intento NO se califica: sin
// estrellas, sin guardar progreso y sin comparación, igual que con las guardas.
// Antes solo se mostraba si había una guarda activada; cualquier otro error se
// descartaba en silencio y lo dibujado hasta ahí se calificaba.
// ============================================================================

describe('main · un error de ejecución se explica en el globo y no se califica (punto 4)', () => {
  beforeEach(() => {
    montarDom();
  });

  const CLAVE_PROGRESO = 'kirologo.progreso.v2';

  const CASOS: ReadonlyArray<{ programa: string; mensaje: string }> = [
    { programa: 'PONCOLOR "red AV 100', mensaje: 'No conozco el color RED.' },
    { programa: 'PG 0 AV 100', mensaje: 'El grosor debe ser un número entero entre 1 y 50.' },
  ];

  for (const { programa, mensaje } of CASOS) {
    it(`«${programa}»: muestra el error en el globo, sin estrellas, sin veredicto y sin guardar nada`, () => {
      const almacen = crearAlmacenMemoria();
      const app = crearAppCon({ almacen, idNivel: '2.1' });
      escribir(app, programa);
      expect(app.editor.estadoContador().errores).toEqual([]); // es válido al analizar: falla al ejecutar

      app.ejecutar();

      // El error se explica en el globo, no se descarta.
      expect(app.textoGlobo()).toContain(mensaje);
      // Sin calificación, sin veredicto, sin estrellas reveladas.
      expect(app.estado().calificacion).toBeNull();
      expect(app.estado().veredicto).toBeNull();
      expect(estrellas()).toEqual(['pendiente', 'pendiente', 'pendiente']);
      expect(app.textoGlobo()).not.toContain('Resultado');
      // No se guarda progreso del nivel.
      const guardado = JSON.parse(almacen.getItem(CLAVE_PROGRESO) ?? '{"niveles":{}}') as {
        niveles?: Record<string, unknown>;
      };
      expect(guardado.niveles?.['2.1']).toBeUndefined();
      // El anuncio habla de un error, no de que terminó bien ni de «seguridad».
      const anuncio = document.getElementById('anuncios')!.textContent ?? '';
      expect(anuncio).toMatch(/error/i);
      expect(anuncio).not.toMatch(/Terminó tu programa/);
      expect(anuncio).not.toMatch(/por seguridad/);
      // El programa del jugador no se toca y se puede volver a ejecutar.
      expect(app.editor.texto()).toBe(programa);
      expect(boton('ejecutar').disabled).toBe(false);
    });
  }

  it('un programa correcto en el mismo nivel sigue calificándose (el error no apaga la calificación)', () => {
    const app = crearAppCon({ almacen: crearAlmacenMemoria(), idNivel: '2.1' });
    escribir(app, 'PONCOLOR rojo REPITE 4 [AV 100 GD 90] AV 100 GD 30 REPITE 3 [AV 100 GD 120]');
    app.ejecutar();
    expect(app.estado().calificacion).not.toBeNull();
    expect(app.textoGlobo()).toContain('Resultado');
  });
});