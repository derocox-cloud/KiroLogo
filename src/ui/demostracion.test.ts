// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { crearDemostracion, recuentoDeSecuencia, ESPERA_INICIAL_MS } from './demostracion.js';
import { crearAnimador, type Reloj, type Animador } from '../motor/animador.js';
import { DobleDibujo } from '../motor/doble-dibujo.test.js';
import { GROSOR_TRAZO, type EstiloPersonajes } from '../motor/personajes.js';
import { ESTADO_INICIAL, type EstadoTortuga } from '../motor/tortuga.js';
import type { Operacion } from '../lenguaje/interprete.js';
import type { Segmento } from '../motor/segmentos.js';
import { resolverReto } from '../juego/reto.js';

function estiloPersonajes(): EstiloPersonajes {
  return {
    contorno: '#212529',
    relleno: '#ffffff',
    cabeza: '#343a40',
    kiroContorno: '#0d6efd',
    kiroRelleno: 'rgba(13,110,253,0.1)',
    lapizContorno: '#dc3545',
    marcaRumbo: '#ff6b6b',
    grosor: GROSOR_TRAZO,
  };
}

/** Reloj falso del animador con tiempo controlado. */
function relojFalso(): Reloj & { avanzar(ms: number): void; correr(): void } {
  let t = 0;
  let pendiente: ((ahora: number) => void) | null = null;
  return {
    programar(cb: (ahora: number) => void): number {
      pendiente = cb;
      return 1;
    },
    cancelar(): void {
      pendiente = null;
    },
    ahora(): number {
      return t;
    },
    avanzar(ms: number): void {
      t += ms;
    },
    correr(): void {
      // Ejecuta los fotogramas pendientes hasta agotar la secuencia.
      let guarda = 0;
      while (pendiente !== null && guarda < 100000) {
        const cb = pendiente;
        pendiente = null;
        t += 1000; // asegura superar cualquier duración por fotograma
        cb(t);
        guarda += 1;
      }
    },
  };
}

/** Reloj de espera falso: guarda el callback y lo dispara con `soltar`. */
class EsperaFalsa {
  private cb: (() => void) | null = null;
  ms: number | null = null;
  programar(callback: () => void, milis: number): number {
    this.cb = callback;
    this.ms = milis;
    return 1;
  }
  cancelar(): void {
    this.cb = null;
  }
  soltar(): void {
    const c = this.cb;
    this.cb = null;
    if (c) c();
  }
}

function esperaFalsa(): EsperaFalsa {
  return new EsperaFalsa();
}

/** Lienzo doble que implementa lo que la demostración y el animador necesitan. */
class LienzoDoble {
  readonly personajes = new DobleDibujo();
  readonly estelas: Record<'jugador' | 'referencia', Segmento[]> = { jugador: [], referencia: [] };
  crecerEstela(capa: 'jugador' | 'referencia', segmentos: readonly Segmento[]): void {
    for (const s of segmentos) this.estelas[capa].push({ ...s });
  }
  limpiarEstela(capa: 'jugador' | 'referencia'): void {
    this.estelas[capa] = [];
  }
  capaPersonajes() {
    return this.personajes;
  }
  limpiarPersonajes(): void {
    this.personajes.clearRect(0, 0, 800, 800);
  }
}

function operacionesDelReto(): readonly Operacion[] {
  const r = resolverReto('0.1', 42);
  if (!r.exito) throw new Error('no se pudo resolver el reto 0.1');
  return r.reto.operaciones;
}

interface Montaje {
  readonly demo: ReturnType<typeof crearDemostracion>;
  readonly lienzo: LienzoDoble;
  readonly reloj: ReturnType<typeof relojFalso>;
  readonly espera: EsperaFalsa;
  readonly anuncios: string[];
  readonly avisosSinDemo: number[];
  readonly animador: Animador;
}

function montar(operaciones: readonly Operacion[], estadoInicial: EstadoTortuga = ESTADO_INICIAL): Montaje {
  const lienzo = new LienzoDoble();
  const reloj = relojFalso();
  const espera = esperaFalsa();
  const animador = crearAnimador(lienzo, reloj, () => false);
  const anuncios: string[] = [];
  const avisosSinDemo: number[] = [];
  const demo = crearDemostracion({
    lienzo,
    animador,
    operaciones,
    estadoInicial,
    leerTemaPersonajes: estiloPersonajes,
    relojEspera: espera,
    anunciar: (t) => anuncios.push(t),
    avisarSinDemostracion: () => avisosSinDemo.push(1),
  });
  return { demo, lienzo, reloj, espera, anuncios, avisosSinDemo, animador };
}

describe('demostracion · recuento de secuencia', () => {
  it('cuenta un tramo por mover con lápiz abajo y longitud', () => {
    const ops = operacionesDelReto();
    const rec = recuentoDeSecuencia(ops);
    expect(rec.tramos).toBe(1); // AVANZA 100
    expect(rec.giros).toBe(0);
  });
});

describe('demostracion · estado inicial y espera', () => {
  it('dibuja los personajes en el estado inicial y espera 500 ms antes de mover', () => {
    const m = montar(operacionesDelReto());
    m.demo.reproducir();
    // Dibujó los personajes.
    expect(m.lienzo.personajes.llamadas.length).toBeGreaterThan(0);
    // Programó una espera de al menos 500 ms; aún no dibujó tramos.
    expect(m.espera.ms).toBe(ESPERA_INICIAL_MS);
    expect(m.lienzo.estelas.referencia.length).toBe(0);
    expect(m.demo.enCurso()).toBe(true);
    expect(m.anuncios[0]).toContain('empieza');
  });
});

describe('demostracion · reproducción sobre la referencia', () => {
  it('dibuja la secuencia sobre la capa de referencia y no toca la del jugador', () => {
    const m = montar(operacionesDelReto());
    m.demo.reproducir();
    m.espera.soltar(); // termina la espera → reproduce
    m.reloj.correr(); // agota los fotogramas
    expect(m.lienzo.estelas.referencia.length).toBe(1);
    expect(m.lienzo.estelas.jugador.length).toBe(0);
  });

  it('al terminar devuelve la tortuga al inicio y anuncia tramos y giros', () => {
    const m = montar(operacionesDelReto());
    m.demo.reproducir();
    m.espera.soltar();
    m.reloj.correr();
    expect(m.demo.enCurso()).toBe(false);
    const ultimo = m.anuncios.at(-1)!;
    expect(ultimo).toContain('terminó');
    expect(ultimo).toContain('1 tramo');
    expect(ultimo).toContain('0 giro');
  });
});

describe('demostracion · repetición', () => {
  it('borra solo la referencia y reaplica desde el inicio, sin tocar la del jugador', () => {
    const m = montar(operacionesDelReto());
    m.demo.reproducir();
    m.espera.soltar();
    m.reloj.correr();
    expect(m.lienzo.estelas.referencia.length).toBe(1);
    // Ponemos algo en la capa del jugador para comprobar que no se borra.
    m.lienzo.estelas.jugador.push({ desde: { x: 0, y: 0 }, hasta: { x: 1, y: 1 }, paso: 0, linea: 1 });
    m.demo.repetir();
    m.espera.soltar();
    m.reloj.correr();
    expect(m.lienzo.estelas.referencia.length).toBe(1);
    expect(m.lienzo.estelas.jugador.length).toBe(1);
    // Dos reproducciones → dos anuncios de inicio.
    expect(m.anuncios.filter((a) => a.includes('empieza')).length).toBe(2);
  });
});

describe('demostracion · velocidad', () => {
  it('ofrece cambiar la velocidad y conserva la selección', () => {
    const m = montar(operacionesDelReto());
    m.demo.ponerVelocidad('rapida');
    expect(m.demo.velocidad()).toBe('rapida');
    m.demo.reproducir();
    m.espera.soltar();
    m.reloj.correr();
    m.demo.repetir();
    // Conserva la velocidad de una repetición a la siguiente.
    expect(m.demo.velocidad()).toBe('rapida');
  });
});

describe('demostracion · ceder a ejecución', () => {
  it('al ceder, dibuja los tramos pendientes en referencia y vuelve al inicio', () => {
    const m = montar(operacionesDelReto());
    m.demo.reproducir();
    m.espera.soltar(); // empezó a animar pero no corrimos los fotogramas
    m.demo.cederAEjecucion();
    // Los tramos pendientes quedaron dibujados en referencia.
    expect(m.lienzo.estelas.referencia.length).toBe(1);
    expect(m.lienzo.estelas.jugador.length).toBe(0);
    expect(m.demo.enCurso()).toBe(false);
  });
});

describe('demostracion · reto sin operaciones', () => {
  it('deja la referencia sin píxeles, dibuja el inicio, avisa al globo y no lanza', () => {
    const m = montar([]);
    expect(() => m.demo.reproducir()).not.toThrow();
    expect(m.lienzo.estelas.referencia.length).toBe(0);
    expect(m.lienzo.personajes.llamadas.length).toBeGreaterThan(0);
    expect(m.avisosSinDemo.length).toBe(1);
    expect(m.demo.enCurso()).toBe(false);
  });
});
