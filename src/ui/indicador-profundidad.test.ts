// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { crearIndicadorProfundidad, textoProfundidad, type IndicadorProfundidad } from './indicador-profundidad.js';

let contenedor: HTMLElement;
let indicador: IndicadorProfundidad;

beforeEach(() => {
  document.body.innerHTML = '<div id="c"></div>';
  contenedor = document.getElementById('c')!;
  indicador = crearIndicadorProfundidad({ contenedor });
});

describe('indicador-profundidad', () => {
  it('la ranura nace vacía y no ocupa lugar', () => {
    expect(indicador.raiz.childElementCount).toBe(0);
    expect(indicador.profundidad()).toBeNull();
  });

  it('antes del mundo 5 no muestra nada, aunque se lo pidan', () => {
    for (const mundo of [0, 1, 2, 3, 4] as const) {
      indicador.fijarMundo(mundo);
      indicador.mostrar(3);
      expect(indicador.raiz.childElementCount, `mundo ${mundo}`).toBe(0);
      expect(indicador.profundidad()).toBeNull();
    }
  });

  it('en el mundo 5 muestra el número con su etiqueta y una casilla por nivel', () => {
    indicador.fijarMundo(5);
    indicador.mostrar(3);
    expect(indicador.profundidad()).toBe(3);
    expect(indicador.raiz.querySelector('.kl-profundidad-numero')!.textContent).toBe('3');
    expect(indicador.raiz.textContent).toContain('Profundidad de la llamada');
    expect(indicador.raiz.querySelectorAll('.kl-profundidad-casilla')).toHaveLength(3);
    // Las casillas son decorativas: el número y la etiqueta dicen lo mismo.
    expect(indicador.raiz.querySelector('.kl-profundidad-casillas')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('en el programa principal (0) no hay casillas pero sí número', () => {
    indicador.fijarMundo(5);
    indicador.mostrar(0);
    expect(indicador.raiz.querySelector('.kl-profundidad-numero')!.textContent).toBe('0');
    expect(indicador.raiz.querySelectorAll('.kl-profundidad-casilla')).toHaveLength(0);
  });

  it('dibuja como mucho 12 casillas y marca el resto con «+»', () => {
    indicador.fijarMundo(5);
    indicador.mostrar(37);
    expect(indicador.raiz.querySelectorAll('.kl-profundidad-casilla')).toHaveLength(12);
    expect(indicador.raiz.querySelector('.kl-profundidad-casillas')!.textContent).toBe('+');
    expect(indicador.raiz.querySelector('.kl-profundidad-numero')!.textContent).toBe('37');
  });

  it('ocultar la quita y cambiar a un mundo anterior también', () => {
    indicador.fijarMundo(5);
    indicador.mostrar(2);
    indicador.ocultar();
    expect(indicador.raiz.childElementCount).toBe(0);
    indicador.mostrar(2);
    indicador.fijarMundo(4);
    expect(indicador.raiz.childElementCount).toBe(0);
    expect(indicador.profundidad()).toBeNull();
  });

  it('el texto para el anuncio distingue el programa principal de una llamada', () => {
    expect(textoProfundidad(0)).toBe('en el programa principal');
    expect(textoProfundidad(4)).toBe('profundidad de llamada 4');
  });
});
