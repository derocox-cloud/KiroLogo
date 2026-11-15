// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearConsola, type Consola } from './consola.js';

const RAIZ_ESTILOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'estilos');

let contenedor: HTMLElement;
let consola: Consola;

function boton(): HTMLButtonElement {
  const b = consola.raiz.querySelector('button');
  if (!b) throw new Error('La consola no tiene botón de plegado');
  return b;
}

function registro(): HTMLElement {
  const r = consola.raiz.querySelector<HTMLElement>('[role="log"]');
  if (!r) throw new Error('La consola no tiene registro');
  return r;
}

beforeEach(() => {
  document.body.replaceChildren();
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  consola = crearConsola({ contenedor });
});

describe('consola: presencia según el mundo (R10.1, R10.2)', () => {
  it('antes del mundo 4 la ranura queda vacía: sin rol log ni botón en el DOM', () => {
    for (const mundo of [0, 1, 2, 3] as const) {
      consola.fijarMundo(mundo);
      expect(consola.raiz.childElementCount).toBe(0);
      expect(document.querySelector('[role="log"]')).toBeNull();
      expect(document.getElementById('kl-consola-titulo')).toBeNull();
    }
  });

  it('desde el mundo 4 aparece y al volver a un mundo menor desaparece', () => {
    consola.fijarMundo(4);
    expect(document.querySelectorAll('[role="log"]')).toHaveLength(1);
    consola.fijarMundo(5);
    expect(document.querySelectorAll('[role="log"]')).toHaveLength(1);
    consola.fijarMundo(3);
    expect(consola.raiz.childElementCount).toBe(0);
    expect(document.querySelector('[role="log"]')).toBeNull();
  });
});

describe('consola: registro accesible (R10.1, D13)', () => {
  it('es un único role="log" con nombre «Consola» y aria-live="off"', () => {
    consola.fijarMundo(4);
    const r = registro();
    expect(r.getAttribute('aria-label')).toBe('Consola');
    expect(r.getAttribute('aria-live')).toBe('off');
  });
});

describe('consola: plegado (R10.3, R10.9)', () => {
  beforeEach(() => consola.fijarMundo(4));

  it('empieza plegada, sin líneas, con el título y el botón visibles', () => {
    expect(consola.plegada()).toBe(true);
    expect(consola.lineas()).toEqual([]);
    expect(registro().hidden).toBe(true);
    expect(registro().childElementCount).toBe(0);
    expect(document.getElementById('kl-consola-titulo')?.textContent).toBe('Consola');
    expect(boton().hidden).toBe(false);
  });

  it('el botón expone aria-expanded y un nombre en español que cambia con el estado', () => {
    const b = boton();
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.textContent).toBe('Mostrar la consola');
    expect(b.getAttribute('aria-controls')).toBe(registro().id);

    b.click();
    expect(consola.plegada()).toBe(false);
    expect(b.getAttribute('aria-expanded')).toBe('true');
    expect(b.textContent).toBe('Ocultar la consola');
    expect(registro().hidden).toBe(false);

    b.click();
    expect(consola.plegada()).toBe(true);
    expect(b.getAttribute('aria-expanded')).toBe('false');
  });

  it('se activa con Enter y Espacio porque es un <button type="button"> nativo', () => {
    // jsdom no sintetiza el click de un botón al pulsar Enter o Espacio; el navegador sí lo hace en
    // todo <button> nativo. Lo que se asegura aquí es que no sea un div con rol, que exigiría
    // manejar las teclas a mano.
    const b = boton();
    expect(b.tagName).toBe('BUTTON');
    expect(b.type).toBe('button');
    expect(b.disabled).toBe(false);
    expect(b.tabIndex).toBe(0);
  });

  it('vaciar borra las líneas y vuelve a plegarla', () => {
    consola.agregar('10');
    consola.agregar('20');
    expect(consola.plegada()).toBe(false);

    consola.vaciar();
    expect(consola.lineas()).toEqual([]);
    expect(registro().childElementCount).toBe(0);
    expect(consola.plegada()).toBe(true);
    expect(registro().hidden).toBe(true);
    expect(boton().getAttribute('aria-expanded')).toBe('false');
    expect(consola.resumen()).toEqual({ cantidad: 0, ultima: null });
  });
});

describe('consola: líneas y foco (R10.4, R10.10, R10.11)', () => {
  beforeEach(() => consola.fijarMundo(4));

  it('agregar despliega y añade la línea al final', () => {
    consola.agregar('hola');
    consola.agregar('3.5');
    expect(consola.plegada()).toBe(false);
    expect(consola.lineas()).toEqual(['hola', '3.5']);
    expect([...registro().children].map((p) => p.textContent)).toEqual(['hola', '3.5']);
    expect(consola.resumen()).toEqual({ cantidad: 2, ultima: '3.5' });
  });

  it('agregar una línea no roba el foco', () => {
    const editor = document.createElement('textarea');
    document.body.appendChild(editor);
    editor.focus();
    expect(document.activeElement).toBe(editor);

    consola.agregar('1');
    consola.agregar('2');
    expect(document.activeElement).toBe(editor);
  });

  it('el registro desplegado es alcanzable con Tab', () => {
    consola.agregar('1');
    expect(registro().tabIndex).toBe(0);
    expect(registro().hidden).toBe(false);
  });
});

describe('consola: máximo de 6 líneas visibles leído de la ficha (R10.7)', () => {
  it('tema.css fija 6 líneas y pantalla.css limita el alto del registro con esa ficha', () => {
    const tema = readFileSync(join(RAIZ_ESTILOS, 'tema.css'), 'utf8');
    const pantalla = readFileSync(join(RAIZ_ESTILOS, 'pantalla.css'), 'utf8');

    expect(tema).toMatch(/--lineas-visibles-consola:\s*6\s*;/);

    const regla = /\.kl-consola-registro\s*\{([^}]*)\}/.exec(pantalla);
    expect(regla).not.toBeNull();
    const cuerpo = regla![1]!;
    expect(cuerpo).toMatch(
      /max-height:\s*calc\(\s*var\(--lineas-visibles-consola\)\s*\*\s*var\(--alto-linea-consola\)\s*\)/,
    );
    expect(cuerpo).toMatch(/overflow-y:\s*auto/);

    // Cada línea ocupa exactamente el alto de línea de la ficha, o el cálculo de 6 no se cumple.
    const linea = /\.kl-consola-linea\s*\{([^}]*)\}/.exec(pantalla);
    expect(linea![1]).toMatch(/line-height:\s*var\(--alto-linea-consola\)/);
  });
});
