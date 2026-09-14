// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { crearPanelComandos, textoDeEntrada, type PanelComandos } from './panel-comandos.js';
import { crearEditor, type Editor, MAXIMO_CARACTERES } from './editor.js';
import { comandosDelMundo, type Mundo } from '../lenguaje/vocabulario.js';

const RELOJ_INMEDIATO = {
  programar(cb: () => void): number {
    cb();
    return 1;
  },
  cancelar(): void {},
};

interface Montaje {
  readonly panel: PanelComandos;
  readonly editor: Editor;
  readonly anuncios: string[];
}

function montar(mundo: Mundo = 0): Montaje {
  const cont = document.createElement('div');
  document.body.appendChild(cont);
  const editor = crearEditor({
    contenedor: cont,
    mundo,
    presupuestoEstrella: 1,
    pedirMensajeLimite: () => {},
    reloj: RELOJ_INMEDIATO,
  });
  const anuncios: string[] = [];
  const panel = crearPanelComandos({
    contenedor: cont,
    mundo,
    insertarEjemplo: (ejemplo) => editor.insertarEnCursor(ejemplo),
    anunciar: (t) => anuncios.push(t),
  });
  return { panel, editor, anuncios };
}

describe('panel-comandos · filtro por mundo', () => {
  it('presenta exactamente las seis entradas del mundo 0, en orden', () => {
    const { panel } = montar(0);
    expect(panel.botones.length).toBe(6);
    const nombres = panel.entradas.map((e) => e.nombre);
    expect(nombres).toEqual(['AVANZA', 'RETROCEDE', 'GIRADERECHA', 'GIRAIZQUIERDA', 'CENTRO', 'BORRAPANTALLA']);
  });

  it('no muestra ningún comando de un mundo posterior (ni REPITE ni RP)', () => {
    const { panel } = montar(0);
    const textoTotal = panel.raiz.textContent ?? '';
    expect(textoTotal).not.toContain('REPITE');
    expect(textoTotal).not.toContain('RP');
    for (const boton of panel.botones) {
      const nombre = boton.getAttribute('aria-label') ?? '';
      expect(nombre).not.toContain('REPITE');
    }
  });

  it('en el mundo 0 usa comandosDelMundo sin lista propia', () => {
    const { panel } = montar(0);
    expect(panel.entradas).toEqual(comandosDelMundo(0));
  });
});

describe('panel-comandos · fidelidad de textos', () => {
  it('muestra nombre, abreviatura, descripción y ejemplo carácter por carácter', () => {
    const { panel } = montar(0);
    const avanza = comandosDelMundo(0)[0]!;
    const boton = panel.botones[0]!;
    const esperado = textoDeEntrada(avanza);
    expect(boton.textContent).toBe(esperado);
    expect(boton.getAttribute('aria-label')).toBe(esperado);
    expect(boton.textContent).toContain(avanza.nombre);
    expect(boton.textContent).toContain(avanza.abreviatura!);
    expect(boton.textContent).toContain(avanza.descripcion);
    expect(boton.textContent).toContain(avanza.ejemplo);
  });
});

describe('panel-comandos · inserción', () => {
  it('inserta el ejemplo en la posición del cursor y anuncia el comando y la línea', () => {
    const { panel, editor, anuncios } = montar(0);
    editor.area.setSelectionRange(0, 0);
    panel.botones[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.texto()).toBe('AVANZA 100');
    expect(anuncios.at(-1)).toContain('AVANZA');
    expect(anuncios.at(-1)).toContain('línea 1');
  });

  it('reemplaza la selección al insertar', () => {
    const { panel, editor } = montar(0);
    editor.ponerTexto('CENTRO');
    editor.area.setSelectionRange(0, 6);
    panel.activar(0); // AVANZA
    expect(editor.texto()).toBe('AVANZA 100');
  });

  it('agrega al final cuando no hay selección previa', () => {
    const { panel, editor } = montar(0);
    editor.ponerTexto('CENTRO\n');
    editor.area.setSelectionRange(editor.texto().length, editor.texto().length);
    panel.activar(0);
    expect(editor.texto()).toBe('CENTRO\nAVANZA 100');
  });

  it('entrega el ejemplo íntegro aunque exceda el límite: el editor recorta', () => {
    const { panel, editor } = montar(0);
    editor.ponerTexto('x'.repeat(MAXIMO_CARACTERES - 3));
    editor.area.setSelectionRange(editor.texto().length, editor.texto().length);
    // AVANZA 100 son 10 caracteres; solo caben 3.
    expect(() => panel.activar(0)).not.toThrow();
    expect(editor.texto().length).toBe(MAXIMO_CARACTERES);
    // La lista de comandos no cambió.
    expect(panel.botones.length).toBe(6);
  });
});

describe('panel-comandos · accesibilidad', () => {
  it('cada botón es interactivo (button nativo) con nombre accesible no vacío', () => {
    const { panel } = montar(0);
    for (const boton of panel.botones) {
      expect(boton.tagName).toBe('BUTTON');
      expect((boton.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
      // Un botón nativo es alcanzable por Tab sin tabindex negativo.
      expect(boton.getAttribute('tabindex')).not.toBe('-1');
    }
  });
});
