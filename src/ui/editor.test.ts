// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import {
  crearEditor,
  contarLineas,
  contarCaracteres,
  recortarALimites,
  MAXIMO_LINEAS,
  MAXIMO_CARACTERES,
  type Editor,
  type LimiteAlcanzado,
} from './editor.js';

// Reloj de rebote que dispara de inmediato: en las pruebas el análisis es síncrono.
const RELOJ_INMEDIATO = {
  programar(cb: () => void): number {
    cb();
    return 1;
  },
  cancelar(): void {},
};

interface Montaje {
  readonly editor: Editor;
  readonly limites: Array<{ limite: LimiteAlcanzado; valor: number }>;
}

function montar(mundo: 0 | 1 | 2 | 3 | 4 | 5 = 0, presupuesto = 1): Montaje {
  const contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  const limites: Array<{ limite: LimiteAlcanzado; valor: number }> = [];
  const editor = crearEditor({
    contenedor,
    mundo,
    presupuestoEstrella: presupuesto,
    pedirMensajeLimite: (limite, valor) => limites.push({ limite, valor }),
    reloj: RELOJ_INMEDIATO,
  });
  return { editor, limites };
}

/** Escribe en el área simulando un `input` del usuario. */
function escribir(editor: Editor, texto: string): void {
  editor.area.value = texto;
  editor.area.dispatchEvent(new Event('input'));
}

describe('editor · conteo de líneas y caracteres', () => {
  it('cuenta la última línea aunque no termine en fin de línea', () => {
    expect(contarLineas('a')).toBe(1);
    expect(contarLineas('a\nb')).toBe(2);
    expect(contarLineas('a\nb\n')).toBe(3);
    expect(contarLineas('')).toBe(1);
  });

  it('reconoce \\r\\n como un solo fin de línea', () => {
    expect(contarLineas('a\r\nb')).toBe(2);
    expect(contarLineas('a\r\nb\r\nc')).toBe(3);
  });

  it('cuenta espacios, tabuladores y fines de línea dentro de los caracteres', () => {
    expect(contarCaracteres(' \t\n')).toBe(3);
    expect(contarCaracteres('a\r\nb')).toBe(4);
  });
});

describe('editor · límites exactos', () => {
  it('admite exactamente 200 líneas y descarta la 201', () => {
    const exactas = Array.from({ length: MAXIMO_LINEAS }, (_, i) => `L${i}`).join('\n');
    const rec = recortarALimites(exactas);
    expect(rec.recortado).toBe(false);
    expect(contarLineas(rec.texto)).toBe(MAXIMO_LINEAS);

    const unaMas = exactas + '\nL200';
    const rec2 = recortarALimites(unaMas);
    expect(rec2.recortado).toBe(true);
    expect(rec2.limite).toBe('lineas');
    expect(contarLineas(rec2.texto)).toBe(MAXIMO_LINEAS);
  });

  it('admite exactamente 10 000 caracteres y descarta el 10 001', () => {
    const exactos = 'x'.repeat(MAXIMO_CARACTERES);
    const rec = recortarALimites(exactos);
    expect(rec.recortado).toBe(false);
    expect(rec.texto.length).toBe(MAXIMO_CARACTERES);

    const unoMas = 'x'.repeat(MAXIMO_CARACTERES + 1);
    const rec2 = recortarALimites(unoMas);
    expect(rec2.recortado).toBe(true);
    expect(rec2.limite).toBe('caracteres');
    expect(rec2.texto.length).toBe(MAXIMO_CARACTERES);
  });

  it('reconoce \\r\\n al recortar la línea sobrante', () => {
    const exactas = Array.from({ length: MAXIMO_LINEAS }, (_, i) => `L${i}`).join('\r\n');
    const unaMas = exactas + '\r\nL200';
    const rec = recortarALimites(unaMas);
    expect(rec.limite).toBe('lineas');
    expect(contarLineas(rec.texto)).toBe(MAXIMO_LINEAS);
    // No queda un `\r` colgando al final.
    expect(rec.texto.endsWith('\r')).toBe(false);
  });

  it('al exceder pide al globo el mensaje del límite, conserva lo admitido y deja el cursor al final', () => {
    const { editor, limites } = montar();
    escribir(editor, 'x'.repeat(MAXIMO_CARACTERES + 5));
    expect(editor.texto().length).toBe(MAXIMO_CARACTERES);
    expect(limites.at(-1)).toEqual({ limite: 'caracteres', valor: MAXIMO_CARACTERES });
    expect(editor.area.selectionStart).toBe(MAXIMO_CARACTERES);
    expect(editor.area.disabled).toBe(false);
  });
});

describe('editor · contador de instrucciones', () => {
  let m: Montaje;
  beforeEach(() => {
    m = montar();
  });

  it('muestra 0 con texto vacío o de solo comentarios', () => {
    escribir(m.editor, '');
    expect(m.editor.estadoContador().conteo).toBe(0);
    expect(m.editor.estadoContador().provisional).toBe(false);
  });

  it('muestra el conteo de conteo.ts para un programa válido', () => {
    escribir(m.editor, 'AVANZA 100\nGIRADERECHA 90');
    const e = m.editor.estadoContador();
    expect(e.conteo).toBe(2);
    expect(e.provisional).toBe(false);
    expect(e.errores.length).toBe(0);
  });

  it('ante errores muestra el último conteo bueno con marca provisional', () => {
    escribir(m.editor, 'AVANZA 100');
    expect(m.editor.estadoContador().conteo).toBe(1);
    // Ahora un texto con error: conserva el 1 y lo marca provisional.
    escribir(m.editor, 'AVANZA 100\n&&&');
    const e = m.editor.estadoContador();
    expect(e.conteo).toBe(1);
    expect(e.provisional).toBe(true);
    expect(e.errores.length).toBeGreaterThan(0);
    // La marca provisional es legible como texto, no solo color.
    expect(m.editor.raiz.textContent).toContain('provisional');
  });

  it('muestra 0 provisional si nunca obtuvo un conteo bueno', () => {
    escribir(m.editor, '&&&');
    const e = m.editor.estadoContador();
    expect(e.conteo).toBe(0);
    expect(e.provisional).toBe(true);
  });
});

describe('editor · canaleta y marcas de error', () => {
  it('numera desde 1 y marca la línea de cada error con forma y mensaje', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100\n&&&\nGIRADERECHA 90');
    // La canaleta tiene un span por línea.
    const spans = editor.raiz.querySelectorAll('.kl-canaleta-linea');
    expect(spans.length).toBe(3);
    // Hay al menos una marca en la lista, con número de línea y mensaje.
    const items = editor.raiz.querySelectorAll('.kl-editor-marca');
    expect(items.length).toBeGreaterThan(0);
    const primera = items[0]!;
    expect(primera.textContent).toContain('Línea');
    // La forma ▲ distingue la marca además del color.
    expect(primera.textContent).toContain('▲');
  });

  it('retira la marca de una línea que ya no existe', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100\n&&&');
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBeGreaterThan(0);
    escribir(editor, 'AVANZA 100');
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBe(0);
  });
});

describe('editor · presupuesto al lado', () => {
  it('muestra el presupuesto con nombre accesible que nombra los dos números', () => {
    const { editor } = montar(0, 1);
    escribir(editor, 'AVANZA 100');
    const contador = editor.raiz.querySelector('.kl-editor-contador')!;
    const nombre = contador.getAttribute('aria-label')!;
    expect(nombre).toContain('nstrucciones 1');
    expect(nombre).toContain('presupuesto de estrella 1');
  });

  it('señala el exceso con texto en español y mantiene el área habilitada', () => {
    const { editor } = montar(0, 1);
    escribir(editor, 'AVANZA 100\nGIRADERECHA 90');
    expect(editor.estadoContador().conteo).toBe(2);
    expect(editor.raiz.textContent).toContain('Te pasaste del presupuesto');
    expect(editor.area.disabled).toBe(false);
  });
});

describe('editor · Tab no se captura', () => {
  it('no llama preventDefault en una pulsación de Tab y no inserta ningún carácter', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100');
    const antes = editor.texto();
    const evento = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    editor.area.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(false);
    expect(editor.texto()).toBe(antes);
  });
});

describe('editor · presentarReto', () => {
  it('deja el área vacía, el contador en 0 sin provisional y sin marcas', () => {
    const { editor } = montar(0, 1);
    escribir(editor, 'AVANZA 100\n&&&');
    editor.presentarReto(1);
    expect(editor.texto()).toBe('');
    const e = editor.estadoContador();
    expect(e.conteo).toBe(0);
    expect(e.provisional).toBe(false);
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBe(0);
  });
});

describe('editor · resaltar línea del paso a paso', () => {
  it('resalta exactamente una línea y la retira cuando el número no existe', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100\nGIRADERECHA 90');
    editor.resaltarLinea(2);
    expect(editor.raiz.querySelectorAll('.kl-canaleta-actual').length).toBe(1);
    // Un número de línea inexistente retira el resalte.
    editor.resaltarLinea(9);
    expect(editor.raiz.querySelectorAll('.kl-canaleta-actual').length).toBe(0);
  });
});

describe('editor · insertar en cursor', () => {
  it('inserta en la posición del cursor y devuelve la línea del cursor', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100\n');
    editor.area.setSelectionRange(editor.texto().length, editor.texto().length);
    const linea = editor.insertarEnCursor('GIRADERECHA 90');
    expect(editor.texto()).toBe('AVANZA 100\nGIRADERECHA 90');
    expect(linea).toBe(2);
  });

  it('reemplaza la selección al insertar', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100');
    editor.area.setSelectionRange(0, 10); // toda la línea
    editor.insertarEnCursor('CENTRO');
    expect(editor.texto()).toBe('CENTRO');
  });
});
