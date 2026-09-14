// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { crearGloboKiro, mensajeNegacion, type GloboKiro, type IdentidadReto } from './globo-kiro.js';
import type { Calificacion } from '../juego/estrellas.js';
import { crearError } from '../lenguaje/errores.js';

const PISTAS: readonly [string, string, string] = [
  'La tortuga solo camina hacia adelante.',
  'Cada cuadro mide 20 unidades.',
  'Empieza con el comando AVANZA seguido de un número.',
];

const IDENTIDAD_0_1: IdentidadReto = { idNivel: '0.1', semillaEfectiva: 42, pistas: PISTAS };

interface Montaje {
  readonly globo: GloboKiro;
  readonly anuncios: string[];
}

function montar(): Montaje {
  const cont = document.createElement('div');
  document.body.appendChild(cont);
  const anuncios: string[] = [];
  const globo = crearGloboKiro({ contenedor: cont, anunciar: (t) => anuncios.push(t) });
  globo.presentarReto(IDENTIDAD_0_1);
  return { globo, anuncios };
}

function calificacion(otorgadas: { p: boolean; e: boolean; a: boolean }): Calificacion {
  const neg = { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } };
  const ok = { otorgada: true as const };
  return {
    precision: otorgadas.p ? ok : neg,
    economia: otorgadas.e
      ? ok
      : { otorgada: false, motivo: { clave: 'presupuestoExcedido', conteo: 3, presupuesto: 1 } },
    abstraccion: otorgadas.a ? ok : neg,
    conteoJugador: 3,
    presupuestoEstrella: 1,
  };
}

describe('globo-kiro · comentario de resultado', () => {
  it('nombra las tres estrellas y su estado en 300 caracteres o menos', () => {
    const { globo, anuncios } = montar();
    globo.comentarCalificacion(calificacion({ p: true, e: false, a: false }));
    const t = globo.texto();
    expect(t).toContain('precisión');
    expect(t).toContain('economía');
    expect(t).toContain('abstracción');
    expect(t).toContain('otorgada');
    expect(t).toContain('negada');
    expect(t.length).toBeLessThanOrEqual(300);
    expect(anuncios.at(-1)).toBe(t);
  });
});

describe('globo-kiro · mensajes del catálogo', () => {
  it('muestra el texto exacto, en orden y hasta 20', () => {
    const { globo } = montar();
    const e1 = crearError('argumentoFaltante', { comando: 'AVANZA' });
    const e2 = crearError('corcheteSinCerrar', {});
    globo.mostrarMensajes([e1, e2]);
    const parrafos = globo.raiz.querySelectorAll('.kl-globo-mensaje');
    expect(parrafos.length).toBe(2);
    expect(parrafos[0]!.textContent).toBe(e1.mensaje);
    expect(parrafos[1]!.textContent).toBe(e2.mensaje);
  });

  it('no agrega nombre de excepción ni traza ni código', () => {
    const { globo } = montar();
    const e = crearError('caracterNoValido', {});
    globo.mostrarMensajes([e]);
    expect(globo.texto()).toBe(e.mensaje);
  });
});

describe('globo-kiro · escalones de pista', () => {
  let m: Montaje;
  beforeEach(() => {
    m = montar();
  });

  it('muestra los tres escalones en orden y sube el contador de 0 a 3', () => {
    expect(m.globo.escalonesAbiertos()).toBe(0);
    m.globo.pedirPista();
    expect(m.globo.escalonesAbiertos()).toBe(1);
    expect(m.globo.texto()).toContain(PISTAS[0]);
    m.globo.pedirPista();
    expect(m.globo.escalonesAbiertos()).toBe(2);
    expect(m.globo.texto()).toContain(PISTAS[1]);
    m.globo.pedirPista();
    expect(m.globo.escalonesAbiertos()).toBe(3);
    expect(m.globo.texto()).toContain(PISTAS[2]);
  });

  it('nunca muestra el programa de referencia', () => {
    m.globo.pedirPista();
    m.globo.pedirPista();
    m.globo.pedirPista();
    expect(m.globo.texto()).not.toContain('AVANZA 100');
  });

  it('la cuarta pista conserva el tercer escalón, informa que no hay más y deja el contador en 3', () => {
    m.globo.pedirPista();
    m.globo.pedirPista();
    m.globo.pedirPista();
    m.globo.pedirPista();
    expect(m.globo.escalonesAbiertos()).toBe(3);
    // Conserva el tercer escalón visible.
    expect(m.globo.texto()).toContain(PISTAS[2]);
    // Informa que no hay más, en 200 caracteres o menos.
    const aviso = m.globo.raiz.querySelector('.kl-globo-sin-mas')!;
    expect(aviso.textContent!.length).toBeLessThanOrEqual(200);
    expect(m.anuncios.at(-1)!.length).toBeLessThanOrEqual(200);
  });
});

describe('globo-kiro · reinicio del contador', () => {
  it('vuelve a 0 al cambiar de idNivel', () => {
    const { globo } = montar();
    globo.pedirPista();
    globo.pedirPista();
    expect(globo.escalonesAbiertos()).toBe(2);
    globo.presentarReto({ idNivel: '0.2', semillaEfectiva: 42, pistas: PISTAS });
    expect(globo.escalonesAbiertos()).toBe(0);
  });

  it('vuelve a 0 al cambiar la semilla efectiva', () => {
    const { globo } = montar();
    globo.pedirPista();
    globo.presentarReto({ idNivel: '0.1', semillaEfectiva: 99, pistas: PISTAS });
    expect(globo.escalonesAbiertos()).toBe(0);
  });

  it('no reinicia el contador al presentar el mismo reto (reejecución/reinicio)', () => {
    const { globo } = montar();
    globo.pedirPista();
    globo.pedirPista();
    globo.presentarReto(IDENTIDAD_0_1); // mismo id y semilla
    expect(globo.escalonesAbiertos()).toBe(2);
  });
});

describe('globo-kiro · negación de economía y abstracción', () => {
  it('nombra los enteros de economía en una oración de 200 caracteres o menos', () => {
    const texto = mensajeNegacion({ clave: 'presupuestoExcedido', conteo: 3, presupuesto: 1 });
    expect(texto).toContain('3');
    expect(texto).toContain('1');
    expect(texto.length).toBeLessThanOrEqual(200);
  });

  it('nombra la primera exigencia sin confirmar de abstracción', () => {
    const texto = mensajeNegacion({ clave: 'exigenciasSinConfirmar', claves: ['usaRepite', 'defineProcedimiento'] });
    expect(texto).toContain('usaRepite');
    expect(texto.length).toBeLessThanOrEqual(200);
  });
});

describe('globo-kiro · aria-live y botón de pista', () => {
  it('publica cada cambio y nunca usa assertive; no mueve el foco', () => {
    const { globo, anuncios } = montar();
    globo.celebrar('¡Muy bien!');
    expect(anuncios.at(-1)).toBe('¡Muy bien!');
    // El botón de pista es un único elemento interactivo con nombre accesible.
    expect(globo.botonPista.tagName).toBe('BUTTON');
    expect((globo.botonPista.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
  });

  it('el botón de pedir pista abre el siguiente escalón al hacer click', () => {
    const { globo } = montar();
    globo.botonPista.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(globo.escalonesAbiertos()).toBe(1);
    expect(globo.texto()).toContain(PISTAS[0]);
  });
});
