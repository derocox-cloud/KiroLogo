// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { crearPanelComandos, textoDeEntrada, TEXTO_AYUDA_INICIAL, type PanelComandos } from './panel-comandos.js';
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
    insertarTexto: (texto) => editor.insertarEnCursor(texto),
    anunciar: (t) => anuncios.push(t),
  });
  return { panel, editor, anuncios };
}

describe('panel-comandos · texto repartido en trozos para darle forma', () => {
  it('cada botón reparte nombre, abreviatura, descripción y ejemplo en trozos con clase propia', () => {
    const { panel } = montar(0);
    const avanza = panel.entradas[0]!;
    const boton = panel.botones[0]!;
    expect(boton.querySelector('.kl-comando-nombre')!.textContent).toBe(avanza.nombre);
    expect(boton.querySelector('.kl-comando-abrev')!.textContent).toBe(` (${avanza.abreviatura})`);
    expect(boton.querySelector('.kl-comando-desc')!.textContent).toBe(avanza.descripcion);
    expect(boton.querySelector('.kl-comando-ejemplo')!.textContent).toBe(avanza.ejemplo);
  });

  it('el ejemplo va en un elemento de código', () => {
    const { panel } = montar(0);
    for (const boton of panel.botones) {
      expect(boton.querySelector('code.kl-comando-ejemplo')).not.toBeNull();
    }
  });

  it('una entrada sin abreviatura no deja un trozo vacío de abreviatura', () => {
    const { panel } = montar(0);
    panel.entradas.forEach((entrada, i) => {
      const abrev = panel.botones[i]!.querySelector('.kl-comando-abrev');
      if (entrada.abreviatura === null) expect(abrev).toBeNull();
      else expect(abrev).not.toBeNull();
    });
  });

  it('el texto del botón sigue siendo exactamente el de textoDeEntrada, separadores incluidos', () => {
    const { panel } = montar(0);
    panel.entradas.forEach((entrada, i) => {
      expect(panel.botones[i]!.textContent).toBe(textoDeEntrada(entrada));
    });
  });

  it('los separadores de lectura siguen en el texto y llevan clase para ocultarlos a la vista', () => {
    const { panel } = montar(0);
    const separadores = [...panel.botones[0]!.querySelectorAll('.kl-comando-sep')].map((s) => s.textContent);
    expect(separadores).toEqual(['. ', ' Ejemplo: ']);
  });

  it('el nombre accesible es el texto completo, no depende de los trozos', () => {
    const { panel } = montar(0);
    panel.entradas.forEach((entrada, i) => {
      expect(panel.botones[i]!.getAttribute('aria-label')).toBe(textoDeEntrada(entrada));
    });
  });
});

describe('panel-comandos · línea de ayuda', () => {
  const evento = (tipo: string): Event => new Event(tipo, { bubbles: false });

  it('empieza con una pista de uso y está dentro del panel, después de todos los botones', () => {
    const { panel } = montar(0);
    expect(panel.ayuda.textContent).toBe(TEXTO_AYUDA_INICIAL);
    expect(panel.raiz.lastElementChild).toBe(panel.ayuda);
    expect(panel.ayuda.parentElement).toBe(panel.raiz);
  });

  it('al pasar el cursor o enfocar un comando muestra lo que hace, con su ejemplo', () => {
    const { panel } = montar(0);
    panel.entradas.forEach((entrada, i) => {
      panel.botones[i]!.dispatchEvent(evento('mouseenter'));
      expect(panel.ayuda.textContent, `cursor sobre ${entrada.nombre}`).toBe(textoDeEntrada(entrada));
      panel.botones[i]!.dispatchEvent(evento('mouseleave'));
      expect(panel.ayuda.textContent).toBe(TEXTO_AYUDA_INICIAL);

      panel.botones[i]!.dispatchEvent(evento('focus'));
      expect(panel.ayuda.textContent, `foco en ${entrada.nombre}`).toBe(textoDeEntrada(entrada));
      panel.botones[i]!.dispatchEvent(evento('blur'));
      expect(panel.ayuda.textContent).toBe(TEXTO_AYUDA_INICIAL);
    });
  });

  it('pasar de un comando a otro muestra el del último', () => {
    const { panel } = montar(0);
    panel.botones[0]!.dispatchEvent(evento('mouseenter'));
    panel.botones[2]!.dispatchEvent(evento('mouseenter'));
    expect(panel.ayuda.textContent).toBe(textoDeEntrada(panel.entradas[2]!));
  });

  it('es solo para la vista: va oculta a los lectores de pantalla, que ya leen cada botón completo', () => {
    const { panel } = montar(0);
    expect(panel.ayuda.getAttribute('aria-hidden')).toBe('true');
    expect(panel.ayuda.querySelector('button, a, input')).toBeNull();
    panel.entradas.forEach((entrada, i) => {
      expect(panel.botones[i]!.getAttribute('aria-label')).toBe(textoDeEntrada(entrada));
    });
  });

  it('no cambia lo que hace pulsar un comando ni su texto', () => {
    const { panel, editor } = montar(0);
    panel.botones[0]!.dispatchEvent(evento('mouseenter'));
    panel.botones[0]!.click();
    expect(editor.texto()).toBe(panel.entradas[0]!.insercion);
    expect(panel.botones[0]!.textContent).toBe(textoDeEntrada(panel.entradas[0]!));
  });

  it('la pista inicial no nombra ningún comando de otro mundo', () => {
    expect(TEXTO_AYUDA_INICIAL).not.toContain('REPITE');
    expect(TEXTO_AYUDA_INICIAL).not.toContain('RP');
  });
});

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

describe('panel-comandos · REPITE se desbloquea en el mundo 1', () => {
  // Requisito 7.2: al entrar al mundo 1, el panel muestra REPITE con su
  // descripción y un ejemplo. Requisito 7.3: solo los comandos desbloqueados.

  it('no incluye REPITE cuando el mundo activo es 0', () => {
    const { panel } = montar(0);
    const nombres = panel.entradas.map((e) => e.nombre);
    expect(nombres).not.toContain('REPITE');
    expect(panel.raiz.textContent ?? '').not.toContain('REPITE');
  });

  it('incluye REPITE con descripción y ejemplo cuando el mundo activo es 1', () => {
    const { panel } = montar(1);
    const entradaRepite = panel.entradas.find((e) => e.nombre === 'REPITE');
    expect(entradaRepite).toBeDefined();
    expect(entradaRepite!.descripcion.length).toBeGreaterThan(0);
    expect(entradaRepite!.ejemplo.length).toBeGreaterThan(0);

    // El botón de REPITE renderiza su descripción y su ejemplo íntegros.
    const indice = panel.entradas.indexOf(entradaRepite!);
    const boton = panel.botones[indice]!;
    const texto = boton.textContent ?? '';
    expect(texto).toContain('REPITE');
    expect(texto).toContain(entradaRepite!.descripcion);
    expect(texto).toContain(entradaRepite!.ejemplo);
    // El nombre accesible también lleva el contenido completo.
    expect(boton.getAttribute('aria-label') ?? '').toContain(entradaRepite!.ejemplo);
  });

  it('mantiene REPITE visible en mundos superiores a 1', () => {
    for (const mundo of [2, 3, 4, 5] as const) {
      const { panel } = montar(mundo);
      const nombres = panel.entradas.map((e) => e.nombre);
      expect(nombres).toContain('REPITE');
    }
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
  it('inserta el texto de inserción en la posición del cursor y anuncia el comando y la línea', () => {
    const { panel, editor, anuncios } = montar(0);
    editor.area.setSelectionRange(0, 0);
    panel.botones[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.texto()).toBe('AVANZA ');
    expect(anuncios.at(-1)).toContain('AVANZA');
    expect(anuncios.at(-1)).toContain('línea 1');
  });

  it('deja el cursor tras el espacio insertado, listo para escribir el número', () => {
    const { panel, editor } = montar(0);
    editor.area.setSelectionRange(0, 0);
    panel.activar(0); // AVANZA (inserta 'AVANZA ')
    // 'AVANZA ' son 7 caracteres: el cursor queda justo detrás, no sobre el espacio.
    expect(editor.area.selectionStart).toBe('AVANZA '.length);
    expect(editor.area.selectionEnd).toBe('AVANZA '.length);
  });

  it('lo que inserta un atajo del mundo 0 no lleva ningún dígito', () => {
    const { panel } = montar(0);
    for (const entrada of panel.entradas) {
      expect(entrada.insercion, entrada.nombre).not.toMatch(/\d/);
    }
  });

  it('reemplaza la selección al insertar', () => {
    const { panel, editor } = montar(0);
    editor.ponerTexto('CENTRO');
    editor.area.setSelectionRange(0, 6);
    panel.activar(0); // AVANZA
    expect(editor.texto()).toBe('AVANZA ');
  });

  it('agrega al final cuando no hay selección previa', () => {
    const { panel, editor } = montar(0);
    editor.ponerTexto('CENTRO\n');
    editor.area.setSelectionRange(editor.texto().length, editor.texto().length);
    panel.activar(0);
    expect(editor.texto()).toBe('CENTRO\nAVANZA ');
  });

  it('entrega el texto de inserción íntegro aunque exceda el límite: el editor recorta', () => {
    const { panel, editor } = montar(0);
    editor.ponerTexto('x'.repeat(MAXIMO_CARACTERES - 3));
    editor.area.setSelectionRange(editor.texto().length, editor.texto().length);
    // 'AVANZA ' son 7 caracteres; solo caben 3.
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
    }
  });
});

describe('panel-comandos · una sola parada de Tab, con flechas dentro', () => {
  const tecla = (key: string): KeyboardEvent => new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  const tabulables = (panel: PanelComandos): number[] =>
    panel.botones.map((b, i) => (b.tabIndex === 0 ? i : -1)).filter((i) => i >= 0);
  const enfocado = (panel: PanelComandos): number => panel.botones.indexOf(document.activeElement as HTMLButtonElement);

  it('es una barra de herramientas con nombre en español', () => {
    const { panel } = montar(0);
    expect(panel.raiz.getAttribute('role')).toBe('toolbar');
    expect((panel.raiz.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
  });

  it('al inicio solo el primer botón es alcanzable con Tab; los demás, con flechas', () => {
    const { panel } = montar(0);
    expect(tabulables(panel)).toEqual([0]);
    expect(panel.botones.slice(1).every((b) => b.tabIndex === -1 && !b.disabled)).toBe(true);
  });

  it('la parada de Tab sigue al último botón con el foco, venga del ratón o del teclado', () => {
    const { panel } = montar(0);
    panel.botones[3]!.focus();
    expect(tabulables(panel)).toEqual([3]);
    panel.botones[1]!.focus();
    expect(tabulables(panel)).toEqual([1]);
  });

  it('las flechas abajo y derecha pasan al siguiente, y al llegar al último vuelven al primero', () => {
    const { panel } = montar(0);
    panel.botones[0]!.focus();
    for (const key of ['ArrowDown', 'ArrowRight']) {
      panel.botones[0]!.focus();
      const visitados = [0];
      for (let k = 1; k < panel.botones.length; k++) {
        document.activeElement!.dispatchEvent(tecla(key));
        visitados.push(enfocado(panel));
      }
      expect(visitados, key).toEqual([0, 1, 2, 3, 4, 5]);
      document.activeElement!.dispatchEvent(tecla(key));
      expect(enfocado(panel), `${key} desde el último`).toBe(0);
    }
  });

  it('las flechas arriba e izquierda pasan al anterior, y desde el primero van al último', () => {
    const { panel } = montar(0);
    for (const key of ['ArrowUp', 'ArrowLeft']) {
      panel.botones[2]!.focus();
      document.activeElement!.dispatchEvent(tecla(key));
      expect(enfocado(panel), key).toBe(1);
      panel.botones[0]!.focus();
      document.activeElement!.dispatchEvent(tecla(key));
      expect(enfocado(panel), `${key} desde el primero`).toBe(panel.botones.length - 1);
    }
  });

  it('Inicio y Fin van al primero y al último', () => {
    const { panel } = montar(0);
    panel.botones[2]!.focus();
    document.activeElement!.dispatchEvent(tecla('End'));
    expect(enfocado(panel)).toBe(panel.botones.length - 1);
    document.activeElement!.dispatchEvent(tecla('Home'));
    expect(enfocado(panel)).toBe(0);
  });

  it('las flechas no desplazan la página (se les quita su efecto), pero Tab, Enter y la barra no se tocan', () => {
    const { panel } = montar(0);
    panel.botones[0]!.focus();
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      const e = tecla(key);
      panel.botones[0]!.dispatchEvent(e);
      expect(e.defaultPrevented, key).toBe(true);
      panel.botones[0]!.focus();
    }
    for (const key of ['Tab', 'Enter', ' ', 'a']) {
      const e = tecla(key);
      panel.botones[0]!.dispatchEvent(e);
      expect(e.defaultPrevented, `${key} no debe cancelarse: Tab no atrapa el foco`).toBe(false);
    }
  });

  it('con teclado se alcanzan los seis comandos y se pueden pulsar: inserta su texto de inserción', () => {
    const { panel, editor } = montar(0);
    panel.botones[0]!.focus();
    for (let k = 0; k < panel.botones.length; k++) {
      (document.activeElement as HTMLButtonElement).click();
      document.activeElement!.dispatchEvent(tecla('ArrowDown'));
    }
    expect(editor.texto()).toBe(panel.entradas.map((e) => e.insercion).join(''));
  });

  it('la ayuda se activa con el cursor o el foco, a la altura del botón, y se apaga al salir', () => {
    const { panel } = montar(0);
    expect(panel.ayuda.classList.contains('kl-activa')).toBe(false);
    for (const [entra, sale] of [['mouseenter', 'mouseleave'], ['focus', 'blur']] as const) {
      panel.botones[2]!.dispatchEvent(new Event(entra));
      expect(panel.ayuda.classList.contains('kl-activa'), entra).toBe(true);
      // Alineada con el botón señalado (en jsdom no hay maquetación: offsetTop vale 0).
      expect(panel.ayuda.style.top).toBe(`${panel.botones[2]!.offsetTop}px`);
      panel.botones[2]!.dispatchEvent(new Event(sale));
      expect(panel.ayuda.classList.contains('kl-activa'), sale).toBe(false);
    }
  });
});

// ============================================================================
// Tarea 5.1 (spec 08) · cierre del hueco de los requisitos 5.1–5.5
//
// Lo de arriba ya cubre el grueso: la barra de herramientas con nombre, el roving
// tabindex que empieza en el primer botón, el recorrido con las flechas y con
// Inicio/Fin, que Tab/Enter/barra no se cancelan, y que el nombre accesible lleva
// los cuatro textos carácter por carácter. Aquí se confirma, sin reescribir nada,
// solo lo que faltaba afirmar de forma explícita contra los criterios 5.1 a 5.5:
//   · 5.1  exactamente UN botón en el orden de tabulación en TODO momento (el
//          invariante del roving tabindex, no solo al inicio), de modo que una sola
//          pulsación de Tab desde el botón enfocado deja el panel.
//   · 5.3/5.4  el único texto visible permanente es el ejemplo; nombre largo,
//          abreviatura y descripción viven en trozos que la hoja de estilos oculta
//          a la vista y que la ayuda revela al pasar el cursor o enfocar.
//   · 5.5  el nombre accesible incluye los cuatro, completos y uno por uno.
// ============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('panel-comandos · 5.1 exactamente una parada de Tab en todo momento', () => {
  const tecla = (key: string): KeyboardEvent =>
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  const conTab = (panel: PanelComandos): number[] =>
    panel.botones.map((b, i) => (b.tabIndex === 0 ? i : -1)).filter((i) => i >= 0);

  it('al inicio hay un único botón alcanzable con Tab, y es el primero', () => {
    const { panel } = montar(0);
    expect(conTab(panel)).toEqual([0]);
  });

  it('tras recorrer con las flechas sigue habiendo exactamente un botón en el orden de tabulación', () => {
    const { panel } = montar(0);
    panel.botones[0]!.focus();
    // Recorre todos los botones (y da la vuelta) comprobando el invariante en cada paso.
    for (let paso = 0; paso <= panel.botones.length; paso++) {
      const conFoco = panel.botones.indexOf(document.activeElement as HTMLButtonElement);
      expect(conTab(panel), `paso ${paso}`).toEqual([conFoco]);
      document.activeElement!.dispatchEvent(tecla('ArrowDown'));
    }
  });

  it('el único botón con Tab coincide siempre con el que tiene el foco, venga de donde venga', () => {
    const { panel } = montar(0);
    for (const i of [4, 0, 2, 5]) {
      panel.botones[i]!.focus();
      expect(conTab(panel), `foco en ${i}`).toEqual([i]);
    }
  });

  it('una sola pulsación de Tab desde el botón enfocado no se cancela: el foco sale del panel', () => {
    const { panel } = montar(0);
    panel.botones[3]!.focus();
    const e = tecla('Tab');
    // El panel no intercepta Tab: lo deja seguir su curso, así una sola pulsación basta
    // para abandonar la barra en lugar de recorrer seis botones.
    panel.botones[3]!.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});

describe('panel-comandos · 5.3/5.4 único texto visible permanente y revelación al señalar', () => {
  // Bajo jsdom `import.meta.url` no es un file://, así que se resuelve desde la raíz
  // del proyecto (donde vitest corre) en lugar de relativo a este archivo.
  const CSS_PANTALLA = readFileSync(
    join(process.cwd(), 'src', 'estilos', 'pantalla.css'),
    'utf8',
  );

  // Clases que la hoja de estilos saca de la vista con la técnica de recorte accesible
  // (position:absolute + clip de 1×1). Un trozo con una de estas clases está en el texto
  // pero no se ve; cualquier otro, sí.
  function clasesOcultasALaVista(css: string): Set<string> {
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const ocultas = new Set<string>();
    const bloque = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = bloque.exec(sinComentarios)) !== null) {
      const cuerpo = m[2]!;
      const recorta = /position\s*:\s*absolute/.test(cuerpo) && /clip\s*:\s*rect\(/.test(cuerpo);
      if (!recorta) continue;
      for (const sel of m[1]!.split(',')) {
        const clase = /\.(kl-comando-[a-z]+)\b/.exec(sel.trim());
        if (clase) ocultas.add(clase[1]!);
      }
    }
    return ocultas;
  }

  // Lee la regla de ::before del botón de comando: localiza el bloque cuyo selector es
  // `.kl-comando::before` y comprueba que pinta `attr(data-insercion)`. Es el nuevo
  // contrato de «texto visible»: la inserción, no el ejemplo.
  function anteBotonPintaInsercion(css: string): boolean {
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const bloque = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = bloque.exec(sinComentarios)) !== null) {
      const selectores = m[1]!.split(',').map((s) => s.trim());
      if (!selectores.includes('.kl-comando::before')) continue;
      return /content\s*:\s*attr\(\s*data-insercion\s*\)/.test(m[2]!);
    }
    return false;
  }

  it('la hoja de estilos oculta a la vista el título, la descripción, el ejemplo y los separadores', () => {
    const ocultas = clasesOcultasALaVista(CSS_PANTALLA);
    for (const clase of ['kl-comando-titulo', 'kl-comando-desc', 'kl-comando-ejemplo', 'kl-comando-sep']) {
      expect(ocultas.has(clase), `${clase} debe ir oculta a la vista`).toBe(true);
    }
  });

  it('el único texto visible permanente es la inserción, que ::before pinta desde data-insercion', () => {
    const { panel } = montar(0);
    const ocultas = clasesOcultasALaVista(CSS_PANTALLA);

    // Ningún trozo de texto del botón queda a la vista: todos cuelgan de clases ocultas.
    panel.entradas.forEach((entrada, i) => {
      const visibles = [...panel.botones[i]!.querySelectorAll('[class^="kl-comando-"]')]
        .filter((el) => {
          // Un trozo se ve si su propia clase no está oculta y ninguno de sus ancestros
          // dentro del botón lo está (el nombre y la abreviatura cuelgan del título oculto).
          for (let n: Element | null = el; n && n !== panel.botones[i]; n = n.parentElement) {
            const clase = [...n.classList].find((c) => c.startsWith('kl-comando-'));
            if (clase && ocultas.has(clase)) return false;
          }
          return true;
        });
      expect(visibles.map((el) => el.className), entrada.nombre).toEqual([]);
    });

    // Lo que se ve lo pinta el pseudo-elemento ::before desde data-insercion, y el
    // atributo de cada botón es exactamente el texto de inserción del comando.
    expect(anteBotonPintaInsercion(CSS_PANTALLA)).toBe(true);
    panel.entradas.forEach((entrada, i) => {
      expect(panel.botones[i]!.getAttribute('data-insercion'), entrada.nombre).toBe(entrada.insercion);
    });
  });

  it('al pasar el cursor o enfocar revela el nombre largo, la abreviatura y la descripción del comando', () => {
    const { panel } = montar(0);
    panel.entradas.forEach((entrada, i) => {
      for (const señalar of ['mouseenter', 'focus']) {
        panel.ayuda.textContent = ''; // parte de vacío para comprobar que la señal la rellena
        panel.botones[i]!.dispatchEvent(new Event(señalar));
        const revelado = panel.ayuda.textContent ?? '';
        expect(revelado, `${señalar} sobre ${entrada.nombre}: nombre largo`).toContain(entrada.nombre);
        if (entrada.abreviatura !== null) {
          expect(revelado, `${señalar} sobre ${entrada.nombre}: abreviatura`).toContain(entrada.abreviatura);
        }
        expect(revelado, `${señalar} sobre ${entrada.nombre}: descripción`).toContain(entrada.descripcion);
      }
    });
  });
});

describe('panel-comandos · 5.5 el nombre accesible lleva los cuatro, completos', () => {
  it('cada botón nombra, carácter por carácter, nombre largo, abreviatura, descripción y ejemplo', () => {
    const { panel } = montar(0);
    panel.entradas.forEach((entrada, i) => {
      const nombreAccesible = panel.botones[i]!.getAttribute('aria-label') ?? '';
      expect(nombreAccesible, `${entrada.nombre}: es textoDeEntrada íntegro`).toBe(textoDeEntrada(entrada));
      expect(nombreAccesible).toContain(entrada.nombre);
      if (entrada.abreviatura !== null) expect(nombreAccesible).toContain(entrada.abreviatura);
      expect(nombreAccesible).toContain(entrada.descripcion);
      expect(nombreAccesible).toContain(entrada.ejemplo);
    });
  });
});

// ============================================================================
// Tarea 5.2 (spec 08) · cierre del hueco de los requisitos 5.6 y 5.7
//
// Lo de arriba ya cubre el grueso de la inserción: el grupo «panel-comandos ·
// inserción» prueba que al activar un botón el Editor inserta el ejemplo en la
// posición del cursor (reemplazando la selección o al final) y que anuncia el
// comando y la línea, y el grupo «una sola parada de Tab» prueba que con el
// teclado se alcanzan y se pulsan los seis comandos insertando su ejemplo. Lo
// que faltaba afirmar de forma explícita contra 5.6 y 5.7 es:
//   · 5.6  con el vocabulario desbloqueado VACÍO el panel se presenta sin ningún
//          botón y sin lanzar excepción. Ningún Mundo real queda vacío (hasta el
//          0 trae seis comandos), así que se simula `comandosDelMundo` devolviendo
//          una lista vacía: es la única forma de ejercitar la rama sin tocar el
//          módulo. Nada más de este archivo usa el doble (está acotado al grupo).
//   · 5.7  al activar un botón con el ratón, con Enter o con la barra espaciadora,
//          el Editor inserta el ejemplo en el cursor Y el Panel conserva el foco en
//          el botón activado (no lo pierde ni lo pasa al Editor).
// ============================================================================

import { vi } from 'vitest';

describe('panel-comandos · 5.6 vocabulario desbloqueado vacío', () => {
  // `comandosDelMundo` es la única fuente de las entradas del panel; ningún Mundo
  // real devuelve una lista vacía, así que se simula para ejercitar esa rama.
  it('con vocabulario vacío se presenta sin botones y sin lanzar excepción', async () => {
    vi.resetModules();
    vi.doMock('../lenguaje/vocabulario.js', async (importOriginal) => {
      const real = await importOriginal<typeof import('../lenguaje/vocabulario.js')>();
      return { ...real, comandosDelMundo: () => [] };
    });
    const { crearPanelComandos: crearConVacio } = await import('./panel-comandos.js');

    const cont = document.createElement('div');
    document.body.appendChild(cont);
    let panelVacio: PanelComandos;
    expect(() => {
      panelVacio = crearConVacio({
        contenedor: cont,
        mundo: 0,
        insertarTexto: () => 1,
        anunciar: () => {},
      });
    }).not.toThrow();

    expect(panelVacio!.botones.length).toBe(0);
    expect(panelVacio!.entradas.length).toBe(0);
    // La raíz sigue siendo una barra de herramientas montada, solo que sin botones:
    // la línea de ayuda es su único hijo y el panel está colgado del contenedor.
    expect(panelVacio!.raiz.querySelectorAll('button').length).toBe(0);
    expect(panelVacio!.raiz.lastElementChild).toBe(panelVacio!.ayuda);
    expect(cont.contains(panelVacio!.raiz)).toBe(true);
    // `activar` sobre un índice inexistente tampoco lanza (no hay entrada que activar).
    expect(() => panelVacio!.activar(0)).not.toThrow();

    vi.doUnmock('../lenguaje/vocabulario.js');
    vi.resetModules();
  });
});

describe('panel-comandos · 5.7 activar inserta en el cursor y conserva el foco en el botón', () => {
  const tecla = (key: string): KeyboardEvent =>
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  it('con el ratón: inserta el ejemplo en el cursor y el foco queda en el botón pulsado', () => {
    const { panel, editor } = montar(0);
    const boton = panel.botones[0]!; // AVANZA
    boton.focus(); // el puntero enfoca el botón nativo al pulsarlo
    editor.area.setSelectionRange(0, 0);
    boton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.texto()).toBe(panel.entradas[0]!.insercion);
    // El Panel no mueve el foco al Editor ni lo suelta: sigue en el botón activado.
    expect(document.activeElement).toBe(boton);
  });

  it('con Enter y con la barra espaciadora: un botón nativo se activa y conserva el foco', () => {
    // En un botón nativo, Enter y la barra espaciadora disparan un `click` sin mover el
    // foco; jsdom no sintetiza ese `click` a partir del `keydown`, así que se emula el
    // mismo par (keydown de activación seguido del click que el navegador genera) y se
    // comprueba las dos cosas que pide 5.7: inserta el ejemplo y el foco no se va.
    for (const key of ['Enter', ' ']) {
      const { panel, editor } = montar(0);
      const boton = panel.botones[2]!; // GIRADERECHA
      boton.focus();
      editor.area.setSelectionRange(0, 0);
      const e = tecla(key);
      boton.dispatchEvent(e);
      // El panel no cancela Enter ni la barra: deja que activen el botón nativo (5.1).
      expect(e.defaultPrevented, `${key} no debe cancelarse`).toBe(false);
      boton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(editor.texto(), key).toBe(panel.entradas[2]!.insercion);
      expect(document.activeElement, `foco tras ${key}`).toBe(boton);
    }
  });

  it('inserta en la posición exacta del cursor, no al final, y mantiene el foco', () => {
    const { panel, editor } = montar(0);
    editor.ponerTexto('CENTRO\nBORRAPANTALLA');
    // Cursor tras «CENTRO\n», antes de «BORRAPANTALLA» (posición 7).
    editor.area.setSelectionRange(7, 7);
    const boton = panel.botones[0]!; // AVANZA (inserta 'AVANZA ')
    boton.focus();
    boton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.texto()).toBe('CENTRO\nAVANZA BORRAPANTALLA');
    expect(document.activeElement).toBe(boton);
  });
});

// Feature: 09-ajustes-de-interfaz, Property 2: Ningún botón del mundo 0 muestra un dígito
//
// El mundo 0 presenta seis comandos (AVANZA, RETROCEDE, GIRADERECHA, GIRAIZQUIERDA,
// CENTRO y BORRAPANTALLA) y ninguno debe mostrar un número en su atajo. Lo que se ve
// del botón lo pinta el pseudo-elemento `.kl-comando::before` con `content:
// attr(data-insercion)`, así que basta con exigir que (a) ese atributo no lleve
// dígitos, (b) la hoja de estilos siga pintando la inserción por el ::before, y
// (c) como refuerzo, el texto que el ::before muestra tampoco lleve dígitos.
describe('panel-comandos · P2 ningún botón del mundo 0 muestra un dígito', () => {
  const CSS_PANTALLA_P2 = readFileSync(
    join(process.cwd(), 'src', 'estilos', 'pantalla.css'),
    'utf8',
  );

  // Localiza el bloque `.kl-comando::before` y confirma que pinta `attr(data-insercion)`:
  // es la vía por la que el atajo del botón se vuelve el único texto visible.
  function antePintaInsercion(css: string): boolean {
    const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const bloque = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = bloque.exec(sinComentarios)) !== null) {
      const selectores = m[1]!.split(',').map((s) => s.trim());
      if (!selectores.includes('.kl-comando::before')) continue;
      return /content\s*:\s*attr\(\s*data-insercion\s*\)/.test(m[2]!);
    }
    return false;
  }

  it('el data-insercion de los seis botones del mundo 0 no contiene ningún dígito', () => {
    const { panel } = montar(0);
    expect(panel.botones.length).toBe(6);
    panel.botones.forEach((boton, i) => {
      const insercion = boton.getAttribute('data-insercion') ?? '';
      expect(insercion, panel.entradas[i]!.nombre).not.toMatch(/\d/);
    });
  });

  it('la hoja de estilos pinta la inserción con .kl-comando::before { content: attr(data-insercion); }', () => {
    expect(antePintaInsercion(CSS_PANTALLA_P2)).toBe(true);
  });

  it('el texto que el ::before muestra (data-insercion) tampoco lleva dígitos en ningún botón', () => {
    const { panel } = montar(0);
    // El ::before pinta exactamente el valor de data-insercion; refuerza (a) comprobando
    // que ese mismo texto visible, carácter por carácter, está libre de dígitos.
    for (const boton of panel.botones) {
      const visible = boton.getAttribute('data-insercion') ?? '';
      for (const caracter of visible) {
        expect(caracter >= '0' && caracter <= '9', `dígito "${caracter}" en ${visible}`).toBe(false);
      }
    }
  });
});

// ============================================================================
// Tarea 2 (spec repite-desbloqueo-mundo-1) · Property 2: Preservación
//
// Observación primero (¬C): el panel se crea DIRECTAMENTE en el mundo del nivel,
// de modo que `mundoDelPanel = mundoDelNivelEnCurso`. Para toda entrada así, el
// panel debe seguir listando exactamente `comandosDelMundo(m)` en orden, tal como
// la Property 23 ya fija para el mundo 0. Aquí se extiende a los seis mundos. El
// azar que ordena el recorrido pasa por `azar/prng.ts`, nunca `Math.random`: el
// resultado no depende del orden, pero la semilla fija lo deja reproducible.
// ============================================================================

import { crearPrng } from '../azar/prng.js';

describe('panel-comandos · preservación (mundo del panel = mundo del nivel, ¬C)', () => {
  const TODOS_LOS_MUNDOS: readonly Mundo[] = [0, 1, 2, 3, 4, 5];

  it('para todo mundo m, el panel creado en m lista exactamente comandosDelMundo(m) en orden', () => {
    const prng = crearPrng(19700101);
    const orden = [...TODOS_LOS_MUNDOS];
    for (let i = orden.length - 1; i > 0; i--) {
      const j = prng.entero(0, i);
      [orden[i], orden[j]] = [orden[j]!, orden[i]!];
    }

    for (const mundo of orden) {
      const { panel } = montar(mundo);
      const esperadas = comandosDelMundo(mundo);
      // Mismas entradas, en el mismo orden.
      expect(panel.entradas, `mundo ${mundo}: entradas`).toEqual(esperadas);
      // Un botón por entrada, con el nombre del comando en su mismo orden.
      expect(panel.botones.length, `mundo ${mundo}: número de botones`).toBe(esperadas.length);
      const nombresBotones = panel.botones.map((b) => b.getAttribute('data-comando'));
      expect(nombresBotones, `mundo ${mundo}: orden de botones`).toEqual(esperadas.map((e) => e.nombre));
    }
  });
});

// ============================================================================
// Tarea 3.4 (spec repite-desbloqueo-mundo-1) · Property 1: comportamiento esperado
//
// El arreglo: `fijarMundo` reconstruye los botones con `comandosDelMundo` del
// mundo nuevo sin recrear el panel, y es no-op si el mundo no cambió. Tras la
// reconstrucción, el roving tabindex y las escuchas (flechas para mover el foco,
// activar para insertar el texto) siguen funcionando.
//
// isBugCondition(X) = mundoDelPanel <> mundoDelNivelEnCurso. Aquí se cubre C: el
// panel nace en un mundo y se le fija otro, como hace montarReto al navegar.
// ============================================================================

describe('panel-comandos · fijarMundo reconstruye el vocabulario vigente (Property 1)', () => {
  const tecla = (key: string): KeyboardEvent =>
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  it('fijarMundo(destino) reconstruye los botones con comandosDelMundo(destino)', () => {
    // Nace en el mundo 0 (seis comandos, sin REPITE).
    const { panel } = montar(0);
    expect(panel.entradas).toEqual(comandosDelMundo(0));
    expect(panel.botones.map((b) => b.getAttribute('data-comando'))).not.toContain('REPITE');

    // Fijar el mundo 1: aparece REPITE y la lista es exactamente comandosDelMundo(1).
    panel.fijarMundo(1);
    expect(panel.entradas).toEqual(comandosDelMundo(1));
    const nombres = panel.botones.map((b) => b.getAttribute('data-comando'));
    expect(nombres).toEqual(comandosDelMundo(1).map((e) => e.nombre));
    expect(nombres).toContain('REPITE');

    // Volver al mundo 0: REPITE desaparece de nuevo.
    panel.fijarMundo(0);
    expect(panel.entradas).toEqual(comandosDelMundo(0));
    expect(panel.botones.map((b) => b.getAttribute('data-comando'))).not.toContain('REPITE');
  });

  it('fijarMundo con el mismo mundo es no-op: no rompe el DOM ni los botones', () => {
    const { panel } = montar(1);
    const botonesAntes = panel.botones;
    const entradasAntes = panel.entradas;
    const hijosAntes = panel.raiz.childElementCount;

    panel.fijarMundo(1); // mismo mundo

    // No reconstruye: conserva las mismas referencias de botones y entradas.
    expect(panel.botones).toBe(botonesAntes);
    expect(panel.entradas).toBe(entradasAntes);
    expect(panel.raiz.childElementCount).toBe(hijosAntes);
    // La ayuda sigue siendo el último hijo y el panel sigue montado.
    expect(panel.raiz.lastElementChild).toBe(panel.ayuda);
  });

  it('tras reconstruir, el roving tabindex sigue vivo: las flechas mueven el foco', () => {
    const { panel } = montar(0);
    panel.fijarMundo(1); // reconstruye con el vocabulario del mundo 1

    // Una sola parada de Tab, en el primer botón del nuevo vocabulario.
    const conTab = panel.botones.map((b, i) => (b.tabIndex === 0 ? i : -1)).filter((i) => i >= 0);
    expect(conTab).toEqual([0]);

    // Las flechas recorren los botones recién creados.
    panel.botones[0]!.focus();
    document.activeElement!.dispatchEvent(tecla('ArrowDown'));
    expect(panel.botones.indexOf(document.activeElement as HTMLButtonElement)).toBe(1);
    document.activeElement!.dispatchEvent(tecla('End'));
    expect(panel.botones.indexOf(document.activeElement as HTMLButtonElement)).toBe(
      panel.botones.length - 1,
    );
  });

  it('tras reconstruir, activar un botón nuevo inserta su texto en el editor', () => {
    const { panel, editor } = montar(0);
    panel.fijarMundo(1);

    // El botón de REPITE, que solo existe tras reconstruir con el mundo 1, inserta su texto.
    const indiceRepite = panel.entradas.findIndex((e) => e.nombre === 'REPITE');
    expect(indiceRepite).toBeGreaterThanOrEqual(0);
    editor.area.setSelectionRange(0, 0);
    panel.botones[indiceRepite]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.texto()).toBe(panel.entradas[indiceRepite]!.insercion);
  });

  it('PBT: para todo par (inicial, destino) en 0..5, tras fijarMundo(destino) el panel lista comandosDelMundo(destino)', () => {
    const pares: Array<{ inicial: Mundo; destino: Mundo }> = [];
    const mundos: readonly Mundo[] = [0, 1, 2, 3, 4, 5];
    for (const inicial of mundos) {
      for (const destino of mundos) {
        if (inicial !== destino) pares.push({ inicial, destino });
      }
    }
    // El PRNG decide solo el orden del recorrido; el veredicto es determinista.
    const prng = crearPrng(20240908);
    for (let i = pares.length - 1; i > 0; i--) {
      const j = prng.entero(0, i);
      [pares[i], pares[j]] = [pares[j]!, pares[i]!];
    }

    for (const { inicial, destino } of pares) {
      const { panel } = montar(inicial);
      panel.fijarMundo(destino);
      const esperadas = comandosDelMundo(destino);
      expect(panel.entradas, `(${inicial} → ${destino}) entradas`).toEqual(esperadas);
      expect(
        panel.botones.map((b) => b.getAttribute('data-comando')),
        `(${inicial} → ${destino}) orden de botones`,
      ).toEqual(esperadas.map((e) => e.nombre));
    }
  });
});

// ============================================================================
// Tarea 13 (spec 03-mundo-2-composicion) · Procedimientos del jugador en el panel
//
// R7: el panel muestra los procedimientos definidos DESPUÉS de los comandos del
// lenguaje, en orden de definición, por su nombre tal como se escribió y sin
// abreviatura (R7.1, R7.2); cambiar la lista refleja altas, bajas y renombres
// (R7.4); una definición no registrada no aparece (R7.5, que satisface quien
// llama filtrando). Activar un procedimiento inserta su nombre como un comando.
// R12.3/R12.4: en el mundo 0/1 no hay comandos del mundo 2; en el mundo 2 sí,
// con descripción y ejemplo.
// ============================================================================

describe('panel-comandos · procedimientos del jugador (R7)', () => {
  const tecla = (key: string): KeyboardEvent =>
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  // Nombres de los botones de procedimiento (los que llevan la clase kl-procedimiento),
  // en orden del DOM.
  const nombresProcedimientos = (panel: PanelComandos): string[] =>
    panel.botones
      .filter((b) => b.classList.contains('kl-procedimiento'))
      .map((b) => b.getAttribute('data-procedimiento') ?? '');

  it('añade los procedimientos tras los comandos del mundo, por su nombre y sin abreviatura (R7.1, R7.2)', () => {
    const { panel } = montar(2);
    const comandosMundo2 = comandosDelMundo(2).length;
    expect(panel.botones.length).toBe(comandosMundo2); // sin procedimientos todavía

    panel.fijarProcedimientos(['CUADRADO', 'FLOR']);

    // Dos botones extra, DESPUÉS de todos los comandos del lenguaje.
    expect(panel.botones.length).toBe(comandosMundo2 + 2);
    expect(nombresProcedimientos(panel)).toEqual(['CUADRADO', 'FLOR']);
    // Van al final: los índices de los procedimientos son los últimos.
    const indicesProc = panel.botones
      .map((b, i) => (b.classList.contains('kl-procedimiento') ? i : -1))
      .filter((i) => i >= 0);
    expect(indicesProc).toEqual([comandosMundo2, comandosMundo2 + 1]);

    // Nombre tal como se escribió, sin abreviatura: no hay trozo de abreviatura.
    const botonCuadrado = panel.botones[comandosMundo2]!;
    expect(botonCuadrado.querySelector('.kl-comando-nombre')!.textContent).toBe('CUADRADO');
    expect(botonCuadrado.querySelector('.kl-comando-abrev')).toBeNull();
    expect(botonCuadrado.textContent).toBe('CUADRADO');
  });

  it('conserva el orden de definición dado, no lo reordena', () => {
    const { panel } = montar(2);
    panel.fijarProcedimientos(['ZETA', 'ALFA', 'MEDIA']);
    expect(nombresProcedimientos(panel)).toEqual(['ZETA', 'ALFA', 'MEDIA']);
  });

  it('cambiar la lista refleja una baja: quita FLOR y conserva CUADRADO (R7.4)', () => {
    const { panel } = montar(2);
    panel.fijarProcedimientos(['CUADRADO', 'FLOR']);
    expect(nombresProcedimientos(panel)).toEqual(['CUADRADO', 'FLOR']);

    panel.fijarProcedimientos(['CUADRADO']);
    expect(nombresProcedimientos(panel)).toEqual(['CUADRADO']);
  });

  it('cambiar la lista refleja un renombre: CUADRADO pasa a TRIANGULO (R7.4)', () => {
    const { panel } = montar(2);
    panel.fijarProcedimientos(['CUADRADO']);
    expect(nombresProcedimientos(panel)).toEqual(['CUADRADO']);

    panel.fijarProcedimientos(['TRIANGULO']);
    expect(nombresProcedimientos(panel)).toEqual(['TRIANGULO']);
  });

  it('cambiar la lista refleja un alta: añade un segundo procedimiento (R7.4)', () => {
    const { panel } = montar(2);
    panel.fijarProcedimientos(['CUADRADO']);
    panel.fijarProcedimientos(['CUADRADO', 'FLOR']);
    expect(nombresProcedimientos(panel)).toEqual(['CUADRADO', 'FLOR']);
  });

  it('una lista vacía no deja ningún botón de procedimiento, sin tocar los comandos (R7.5)', () => {
    const { panel } = montar(2);
    const comandosMundo2 = comandosDelMundo(2).length;
    panel.fijarProcedimientos(['CUADRADO', 'FLOR']);
    panel.fijarProcedimientos([]);
    expect(nombresProcedimientos(panel)).toEqual([]);
    expect(panel.botones.length).toBe(comandosMundo2);
    // Los comandos del lenguaje siguen intactos y primeros.
    expect(panel.botones.map((b) => b.getAttribute('data-comando'))).toEqual(
      comandosDelMundo(2).map((e) => e.nombre),
    );
  });

  it('no altera los botones de comando del lenguaje: siguen intactos y primeros', () => {
    const { panel } = montar(2);
    const comandosAntes = panel.botones.map((b) => b.getAttribute('data-comando'));
    panel.fijarProcedimientos(['CUADRADO']);
    const comandosDespues = panel.botones
      .filter((b) => !b.classList.contains('kl-procedimiento'))
      .map((b) => b.getAttribute('data-comando'));
    expect(comandosDespues).toEqual(comandosAntes);
  });

  it('activar un procedimiento inserta su nombre en el editor como un comando', () => {
    const { panel, editor, anuncios } = montar(2);
    const comandosMundo2 = comandosDelMundo(2).length;
    panel.fijarProcedimientos(['CUADRADO']);
    editor.area.setSelectionRange(0, 0);
    panel.botones[comandosMundo2]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.texto()).toBe('CUADRADO ');
    expect(anuncios.at(-1)).toContain('CUADRADO');
    expect(anuncios.at(-1)).toContain('línea 1');
  });

  it('el roving tabindex cubre comandos y procedimientos, con una sola parada de Tab', () => {
    const { panel } = montar(2);
    panel.fijarProcedimientos(['CUADRADO', 'FLOR']);

    // Una sola parada de Tab en todo el conjunto combinado, en el primer botón.
    const conTab = panel.botones.map((b, i) => (b.tabIndex === 0 ? i : -1)).filter((i) => i >= 0);
    expect(conTab).toEqual([0]);

    // Las flechas recorren hasta el último procedimiento y vuelven al primer comando.
    const ultimo = panel.botones.length - 1;
    panel.botones[ultimo]!.focus();
    expect(panel.botones[ultimo]!.classList.contains('kl-procedimiento')).toBe(true);
    expect(panel.botones.map((b, i) => (b.tabIndex === 0 ? i : -1)).filter((i) => i >= 0)).toEqual([
      ultimo,
    ]);
    // Desde el último, la flecha abajo da la vuelta al primero (un comando).
    panel.botones[ultimo]!.dispatchEvent(tecla('ArrowDown'));
    expect(panel.botones.indexOf(document.activeElement as HTMLButtonElement)).toBe(0);
  });

  it('un cambio de mundo no borra los procedimientos ya fijados', () => {
    const { panel } = montar(2);
    panel.fijarProcedimientos(['CUADRADO']);
    panel.fijarMundo(3); // reconstruye con el vocabulario del mundo 3
    expect(nombresProcedimientos(panel)).toEqual(['CUADRADO']);
  });
});

describe('panel-comandos · comandos del mundo 2 según el mundo (R12.3, R12.4)', () => {
  const COMANDOS_M2 = [
    'PARA',
    'FIN',
    'SUBELAPIZ',
    'BAJALAPIZ',
    'PONCOLOR',
    'PONGROSOR',
    'RELLENA',
    'OCULTATORTUGA',
    'MUESTRATORTUGA',
  ];

  it('en el mundo 0 y en el mundo 1 el panel no muestra ningún comando del mundo 2 (R12.4)', () => {
    for (const mundo of [0, 1] as const) {
      const { panel } = montar(mundo);
      const nombres = panel.entradas.map((e) => e.nombre);
      for (const comando of COMANDOS_M2) {
        expect(nombres, `mundo ${mundo}: ${comando}`).not.toContain(comando);
      }
    }
  });

  it('en el mundo 2 el panel muestra cada comando del mundo 2 con descripción y ejemplo (R12.3)', () => {
    const { panel } = montar(2);
    for (const comando of COMANDOS_M2) {
      const entrada = panel.entradas.find((e) => e.nombre === comando);
      expect(entrada, comando).toBeDefined();
      expect(entrada!.descripcion.length, `${comando}: descripción`).toBeGreaterThan(0);
      expect(entrada!.ejemplo.length, `${comando}: ejemplo`).toBeGreaterThan(0);

      // El botón renderiza su descripción y su ejemplo íntegros.
      const indice = panel.entradas.indexOf(entrada!);
      const boton = panel.botones[indice]!;
      const texto = boton.textContent ?? '';
      expect(texto, `${comando}: botón`).toContain(entrada!.descripcion);
      expect(texto, `${comando}: botón`).toContain(entrada!.ejemplo);
    }
  });
});
