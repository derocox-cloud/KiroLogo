// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { crearControlDesafio, type ControlDesafio } from './control-desafio.js';
import { codificar, decodificar } from '../azar/codigo-semilla.js';
import { crearPrng, SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../azar/prng.js';

let contenedor: HTMLElement;
let iniciados: number;
let siguientes: number;

function crear(): ControlDesafio {
  return crearControlDesafio({
    contenedor,
    callbacks: {
      iniciar: () => {
        iniciados += 1;
      },
      siguiente: () => {
        siguientes += 1;
      },
    },
  });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="aplicacion"></div>';
  contenedor = document.getElementById('aplicacion') as HTMLElement;
  iniciados = 0;
  siguientes = 0;
});

describe('control-desafio · visibilidad (R12.1, R12.2)', () => {
  it('nace oculto', () => {
    const control = crear();
    expect(control.raiz.hidden).toBe(true);
  });

  it('aun oculto, su botón nunca queda sin texto ni nombre accesible en español', () => {
    const control = crear();
    expect(control.boton.textContent).toBe('Desafío infinito');
    expect(control.boton.getAttribute('aria-label')).toMatch(/desafío infinito/i);
    control.presentar({ fase: 'oculto' });
    expect(control.boton.textContent).not.toBe('');
    expect(control.boton.getAttribute('aria-label')).toMatch(/desafío infinito/i);
  });

  it('oculto: no se muestra aunque antes estuviera disponible', () => {
    const control = crear();
    control.presentar({ fase: 'disponible', mundo: 0 });
    expect(control.raiz.hidden).toBe(false);
    control.presentar({ fase: 'oculto' });
    expect(control.raiz.hidden).toBe(true);
  });

  it('disponible: se muestra con el texto «Desafío infinito» y el nombre accesible del mundo', () => {
    const control = crear();
    control.presentar({ fase: 'disponible', mundo: 2 });
    expect(control.raiz.hidden).toBe(false);
    expect(control.boton.textContent).toBe('Desafío infinito');
    expect(control.boton.getAttribute('aria-label')).toBe('Iniciar el desafío infinito del mundo 2');
    expect(control.boton.disabled).toBe(false);
  });
});

describe('control-desafio · en curso (R12.4, R12.5, R12.6)', () => {
  it('muestra «Siguiente reto» con su nombre accesible y el código de la raíz', () => {
    const control = crear();
    control.presentar({ fase: 'enCurso', mundo: 1, codigoRaiz: 'ABC2345', puedeAvanzar: true });
    expect(control.boton.textContent).toBe('Siguiente reto');
    expect(control.boton.getAttribute('aria-label')).toBe('Ir al siguiente reto del desafío infinito');
    expect(control.raiz.textContent).toContain('ABC2345');
  });

  it('«Siguiente reto» queda deshabilitado, por atributo y por texto, hasta aprobar el reto', () => {
    const control = crear();
    control.presentar({ fase: 'enCurso', mundo: 1, codigoRaiz: 'ABC2345', puedeAvanzar: false });
    expect(control.boton.disabled).toBe(true);
    expect(control.boton.getAttribute('aria-disabled')).toBe('true');
    expect(control.raiz.textContent).toMatch(/aprueba/i);
    control.boton.click();
    expect(siguientes).toBe(0);

    control.presentar({ fase: 'enCurso', mundo: 1, codigoRaiz: 'ABC2345', puedeAvanzar: true });
    expect(control.boton.disabled).toBe(false);
    expect(control.boton.getAttribute('aria-disabled')).toBe('false');
  });

  it('sin código de raíz (codificar falló) no muestra código', () => {
    const control = crear();
    control.presentar({ fase: 'enCurso', mundo: 1, codigoRaiz: null, puedeAvanzar: true });
    expect(control.raiz.querySelector('output')).toBeNull();
  });

  it('no ofrece ningún control de retroceso: un solo botón y ningún nombre de retroceso', () => {
    const control = crear();
    for (const estado of [
      { fase: 'disponible', mundo: 0 },
      { fase: 'enCurso', mundo: 0, codigoRaiz: 'ABC2345', puedeAvanzar: true },
    ] as const) {
      control.presentar(estado);
      const controles = control.raiz.querySelectorAll('button, input, select, a, [role="button"]');
      expect(controles).toHaveLength(1);
      const nombre = `${control.boton.textContent} ${control.boton.getAttribute('aria-label')}`;
      expect(nombre).not.toMatch(/anterior|atrás|atras|retroced|volver/i);
    }
  });
});

describe('control-desafio · callbacks y teclado (R12.7)', () => {
  it('es un <button> nativo de tipo button, alcanzable con Tab (sin tabindex negativo)', () => {
    const control = crear();
    control.presentar({ fase: 'disponible', mundo: 0 });
    expect(control.boton.tagName).toBe('BUTTON');
    expect(control.boton.type).toBe('button');
    expect(control.boton.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('disponible: activarlo llama a iniciar, no a siguiente', () => {
    const control = crear();
    control.presentar({ fase: 'disponible', mundo: 0 });
    control.boton.click();
    expect(iniciados).toBe(1);
    expect(siguientes).toBe(0);
  });

  it('en curso y habilitado: activarlo llama a siguiente, no a iniciar', () => {
    const control = crear();
    control.presentar({ fase: 'enCurso', mundo: 0, codigoRaiz: 'ABC2345', puedeAvanzar: true });
    control.boton.click();
    expect(siguientes).toBe(1);
    expect(iniciados).toBe(0);
  });

  it('puede recibir el foco', () => {
    const control = crear();
    control.presentar({ fase: 'disponible', mundo: 0 });
    control.boton.focus();
    expect(document.activeElement).toBe(control.boton);
  });
});

describe('control-desafio · la raíz se comparte sin pérdida (R12.6, Property 21)', () => {
  it('decodificar(codificar(raiz)) devuelve la misma raíz y es lo que el control muestra', () => {
    const prng = crearPrng(2024);
    const extremos = [SEMILLA_MINIMA, SEMILLA_MAXIMA];
    const raices = [
      ...extremos,
      ...Array.from({ length: 50 }, () => Math.floor(prng.siguiente() * (SEMILLA_MAXIMA - SEMILLA_MINIMA + 1)) + SEMILLA_MINIMA),
    ];
    for (const raiz of raices) {
      const c = codificar(raiz);
      expect(c.exito).toBe(true);
      if (!c.exito) continue;
      const d = decodificar(c.codigo);
      expect(d.exito && d.semilla).toBe(raiz);

      const control = crear();
      control.presentar({ fase: 'enCurso', mundo: 0, codigoRaiz: c.codigo, puedeAvanzar: false });
      expect(control.raiz.querySelector('output')?.textContent).toBe(c.codigo);
      control.raiz.remove();
    }
  });
});
