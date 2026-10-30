// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { crearPanelSemilla, type PanelSemilla, type CallbacksPanelSemilla } from './panel-semilla.js';

// ============================================================================
// Montaje
// ============================================================================

let contenedor: HTMLElement;
let otrosRetos: number;
let codigosReproducidos: string[];

function callbacks(): CallbacksPanelSemilla {
  return {
    pedirOtroReto: () => {
      otrosRetos += 1;
    },
    reproducirCodigo: (codigo: string) => {
      codigosReproducidos.push(codigo);
    },
  };
}

function crear(): PanelSemilla {
  return crearPanelSemilla({ contenedor, callbacks: callbacks() });
}

beforeEach(() => {
  document.body.innerHTML = '<div id="aplicacion"></div>';
  contenedor = document.getElementById('aplicacion') as HTMLElement;
  otrosRetos = 0;
  codigosReproducidos = [];
});

// ============================================================================
// Presentación del código
// ============================================================================

describe('panel-semilla · código', () => {
  it('asocia el estado del reto con el código para lectores de pantalla', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ABC2345', generado: true });
    const idNota = panel.salidaCodigo.getAttribute('aria-describedby');
    expect(idNota).toBeTruthy();
    expect(panel.raiz.querySelector(`#${idNota}`)?.textContent).toMatch(/otro reto|reproducir/i);
  });

  it('muestra el código del reto en un elemento de solo lectura con nombre accesible', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ABC2345', generado: true });
    expect(panel.codigoMostrado()).toBe('ABC2345');
    // El código tiene un nombre accesible en español (por aria-labelledby).
    expect(panel.salidaCodigo.getAttribute('aria-labelledby')).toBeTruthy();
  });

  it('declara nombres accesibles en español para las acciones', () => {
    const panel = crear();
    expect(panel.botonOtroReto.getAttribute('aria-label')).toMatch(/reto/i);
    expect(panel.botonReproducir.getAttribute('aria-label')).toMatch(/reproducir/i);
    expect(panel.campoCodigo.getAttribute('aria-label')).toMatch(/código/i);
  });
});

// ============================================================================
// Niveles generados vs autorados
// ============================================================================

describe('panel-semilla · generado vs autorado', () => {
  it('en un nivel generado, «otro reto» está disponible', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ABC2345', generado: true });
    expect(panel.otroRetoDisponible()).toBe(true);
    expect(panel.botonOtroReto.disabled).toBe(false);
    expect(panel.campoCodigo.disabled).toBe(false);
  });

  it('en un nivel autorado, «otro reto» no está disponible y se dice por texto', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ZZZ2345', generado: false });
    expect(panel.otroRetoDisponible()).toBe(false);
    expect(panel.botonOtroReto.disabled).toBe(true);
    expect(panel.botonOtroReto.getAttribute('aria-disabled')).toBe('true');
    // El estado no disponible se comunica con texto, no solo con color.
    expect(panel.raiz.textContent).toMatch(/fijo|no rejugable|siempre es el mismo/i);
  });

  it('cambiar de autorado a generado rehabilita las acciones', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ZZZ2345', generado: false });
    expect(panel.otroRetoDisponible()).toBe(false);
    panel.presentarReto({ codigoSemilla: 'ABC2345', generado: true });
    expect(panel.otroRetoDisponible()).toBe(true);
  });
});

// ============================================================================
// Acciones
// ============================================================================

describe('panel-semilla · acciones', () => {
  it('«otro reto» invoca el callback solo cuando está disponible', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ABC2345', generado: true });
    panel.botonOtroReto.click();
    expect(otrosRetos).toBe(1);

    // En autorado no invoca aunque se pulse (está deshabilitado).
    panel.presentarReto({ codigoSemilla: 'ZZZ2345', generado: false });
    panel.botonOtroReto.click();
    expect(otrosRetos).toBe(1);
  });

  it('«reproducir código» entrega a main.ts el texto introducido, sin validarlo', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ABC2345', generado: true });
    panel.campoCodigo.value = 'xyz 123';
    panel.botonReproducir.click();
    // El panel entrega el texto tal cual; main.ts decide si es válido.
    expect(codigosReproducidos).toEqual(['xyz 123']);
  });
});

// ============================================================================
// 7.5 · el código vive en un <output> seleccionable por teclado
//
// El requisito 7.5 pide explícitamente un elemento <output> y que sea
// seleccionable por teclado. Los casos existentes confirman el nombre
// accesible y que es de solo lectura, pero no el tipo de elemento ni el foco.
// ============================================================================

describe('panel-semilla · 7.5 elemento del código', () => {
  it('el código vive en un elemento <output>', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ABC2345', generado: true });
    expect(panel.salidaCodigo.tagName).toBe('OUTPUT');
  });

  it('el código es seleccionable con el teclado (entra en el orden de foco)', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ABC2345', generado: true });
    expect(panel.salidaCodigo.tabIndex).toBe(0);
    panel.salidaCodigo.focus();
    expect(panel.salidaCodigo.ownerDocument.activeElement).toBe(panel.salidaCodigo);
  });
});

// ============================================================================
// 7.6 · el nivel autorado deshabilita AMBAS acciones
//
// El requisito 7.6 pide deshabilitar las dos acciones: pedir otro reto y
// reproducir un código. El caso existente verifica «otro reto» y el campo;
// este cierra el hueco del botón de reproducir.
// ============================================================================

describe('panel-semilla · 7.6 ambas acciones deshabilitadas en autorado', () => {
  it('en autorado también deshabilita «reproducir código», no solo «otro reto»', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ZZZ2345', generado: false });
    expect(panel.botonReproducir.disabled).toBe(true);
    expect(panel.botonReproducir.getAttribute('aria-disabled')).toBe('true');
  });

  it('en autorado, pulsar «reproducir código» no invoca el callback', () => {
    const panel = crear();
    panel.presentarReto({ codigoSemilla: 'ZZZ2345', generado: false });
    panel.campoCodigo.value = 'abc 123';
    panel.botonReproducir.click();
    expect(codigosReproducidos).toEqual([]);
  });
});
