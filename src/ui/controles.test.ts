// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { crearControles, type Controles, type AccionId } from './controles.js';
import type { Velocidad } from '../motor/animador.js';

interface Registro {
  ejecutar: number;
  detener: number;
  paso: number;
  reiniciar: number;
  demostracion: number;
  paralelo: number;
  velocidad: Velocidad[];
}

interface Montaje {
  readonly controles: Controles;
  readonly reg: Registro;
}

function montar(): Montaje {
  const cont = document.createElement('div');
  document.body.appendChild(cont);
  const reg: Registro = { ejecutar: 0, detener: 0, paso: 0, reiniciar: 0, demostracion: 0, paralelo: 0, velocidad: [] };
  const controles = crearControles({
    contenedor: cont,
    callbacks: {
      ejecutar: () => (reg.ejecutar += 1),
      detener: () => (reg.detener += 1),
      darPaso: () => (reg.paso += 1),
      reiniciar: () => (reg.reiniciar += 1),
      verDemostracion: () => (reg.demostracion += 1),
      verEnParalelo: () => (reg.paralelo += 1),
      cambiarVelocidad: (v) => reg.velocidad.push(v),
    },
  });
  return { controles, reg };
}

function click(b: HTMLElement): void {
  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('controles · seis acciones y cuatro velocidades', () => {
  it('presenta exactamente seis botones de acción, cada una un elemento interactivo', () => {
    const { controles } = montar();
    const acciones: AccionId[] = ['ejecutar', 'detener', 'paso', 'reiniciar', 'demostracion', 'paralelo'];
    for (const a of acciones) {
      expect(controles.boton(a).tagName).toBe('BUTTON');
    }
    const velocidades: Velocidad[] = ['lenta', 'normal', 'rapida', 'inmediata'];
    for (const v of velocidades) {
      expect(controles.botonVelocidad(v).tagName).toBe('BUTTON');
    }
    expect(controles.raiz.querySelectorAll('.kl-control').length).toBe(6);
    expect(controles.raiz.querySelectorAll('.kl-velocidad').length).toBe(4);
  });

  it('la velocidad normal está seleccionada al entrar', () => {
    const { controles } = montar();
    expect(controles.velocidadSeleccionada()).toBe('normal');
    expect(controles.botonVelocidad('normal').getAttribute('aria-pressed')).toBe('true');
  });

  it('cada acción y cada velocidad expone un nombre accesible en español distinto', () => {
    const { controles } = montar();
    const nombres = new Set<string>();
    for (const a of ['ejecutar', 'detener', 'paso', 'reiniciar', 'demostracion', 'paralelo'] as AccionId[]) {
      const nombre = controles.boton(a).getAttribute('aria-label')!;
      expect(nombre.length).toBeGreaterThan(0);
      nombres.add(nombre);
    }
    for (const v of ['lenta', 'normal', 'rapida', 'inmediata'] as Velocidad[]) {
      const nombre = controles.botonVelocidad(v).getAttribute('aria-label')!;
      expect(nombre.length).toBeGreaterThan(0);
      nombres.add(nombre);
    }
    // Diez nombres distintos.
    expect(nombres.size).toBe(10);
  });
});

describe('controles · texto visible y nombre accesible', () => {
  /** Texto visible sin el ícono decorativo (que va aria-hidden). */
  function textoVisible(b: HTMLElement): string {
    const copia = b.cloneNode(true) as HTMLElement;
    copia.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
    return (copia.textContent ?? '').trim();
  }

  it('el nombre accesible de cada botón contiene su texto visible (quien dicta «Ejecutar» lo activa)', () => {
    const { controles } = montar();
    for (const a of ['ejecutar', 'detener', 'paso', 'reiniciar', 'demostracion', 'paralelo'] as AccionId[]) {
      const b = controles.boton(a);
      const visible = textoVisible(b).toLowerCase();
      expect(visible.length, a).toBeGreaterThan(0);
      expect(b.getAttribute('aria-label')!.toLowerCase(), a).toContain(visible);
    }
    for (const v of ['lenta', 'normal', 'rapida', 'inmediata'] as Velocidad[]) {
      const b = controles.botonVelocidad(v);
      const visible = textoVisible(b).toLowerCase();
      expect(b.getAttribute('aria-label')!.toLowerCase(), v).toContain(visible);
    }
  });

  it('los textos visibles son cortos y en español', () => {
    const { controles } = montar();
    expect(textoVisible(controles.boton('ejecutar'))).toBe('Ejecutar');
    expect(textoVisible(controles.boton('detener'))).toBe('Detener');
    expect(textoVisible(controles.boton('paso'))).toBe('Paso');
    expect(textoVisible(controles.boton('reiniciar'))).toBe('Reiniciar');
    expect(textoVisible(controles.boton('demostracion'))).toBe('Ver la demostración');
    expect(controles.botonVelocidad('rapida').textContent).toBe('Rápida');
  });

  it('el ícono de cada acción es decorativo: va oculto a los lectores de pantalla', () => {
    const { controles } = montar();
    for (const a of ['ejecutar', 'detener', 'paso', 'reiniciar', 'demostracion', 'paralelo'] as AccionId[]) {
      const icono = controles.boton(a).querySelector('.kl-control-icono')!;
      expect(icono.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('el rótulo visible «Velocidad» está oculto a los lectores: el grupo ya tiene nombre', () => {
    const { controles } = montar();
    const grupo = controles.raiz.querySelector('.kl-control-velocidades')!;
    expect(grupo.getAttribute('aria-label')).toBe('Cambiar la velocidad');
    const rotulo = grupo.querySelector('.kl-control-velocidades-rotulo')!;
    expect(rotulo.textContent).toBe('Velocidad');
    expect(rotulo.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('controles · pide la ejecución por callback', () => {
  it('activar ejecutar llama al callback, no al intérprete', () => {
    const { controles, reg } = montar();
    click(controles.boton('ejecutar'));
    expect(reg.ejecutar).toBe(1);
  });

  it('cambiar la velocidad notifica y actualiza la selección', () => {
    const { controles, reg } = montar();
    click(controles.botonVelocidad('rapida'));
    expect(reg.velocidad).toEqual(['rapida']);
    expect(controles.velocidadSeleccionada()).toBe('rapida');
  });
});

describe('controles · estados durante y después de una ejecución', () => {
  it('durante una ejecución deshabilita ejecutar y demostración, habilita el resto', () => {
    const { controles } = montar();
    controles.marcarEjecucionEnCurso();
    expect(controles.habilitada('ejecutar')).toBe(false);
    expect(controles.habilitada('demostracion')).toBe(false);
    expect(controles.habilitada('detener')).toBe(true);
    expect(controles.habilitada('paso')).toBe(true);
    expect(controles.habilitada('reiniciar')).toBe(true);
    // El estado deshabilitado se expone de forma programática.
    expect(controles.boton('ejecutar').getAttribute('aria-disabled')).toBe('true');
  });

  it('al fin de secuencia habilita ejecutar y demostración y deshabilita detener', () => {
    const { controles } = montar();
    controles.marcarEjecucionEnCurso();
    controles.marcarFinDeSecuencia();
    expect(controles.habilitada('ejecutar')).toBe(true);
    expect(controles.habilitada('demostracion')).toBe(true);
    expect(controles.habilitada('detener')).toBe(false);
  });

  it('al detener por el jugador invierte los habilitados', () => {
    const { controles } = montar();
    controles.marcarEjecucionEnCurso();
    controles.marcarDetenido();
    expect(controles.habilitada('detener')).toBe(false);
    expect(controles.habilitada('ejecutar')).toBe(true);
    expect(controles.habilitada('demostracion')).toBe(true);
  });
});

describe('controles · un control deshabilitado no hace nada', () => {
  it('activar detener deshabilitado no llama al callback', () => {
    const { controles, reg } = montar();
    // Al entrar, detener está deshabilitado.
    expect(controles.habilitada('detener')).toBe(false);
    click(controles.boton('detener'));
    expect(reg.detener).toBe(0);
  });
});

describe('controles · el foco se mueve al deshabilitarse', () => {
  it('mueve el foco de ejecutar a detener cuando ejecutar se deshabilita', () => {
    const { controles } = montar();
    controles.boton('ejecutar').focus();
    expect(document.activeElement).toBe(controles.boton('ejecutar'));
    controles.marcarEjecucionEnCurso();
    expect(document.activeElement).toBe(controles.boton('detener'));
  });

  it('mueve el foco de detener a ejecutar cuando detener se deshabilita', () => {
    const { controles } = montar();
    controles.marcarEjecucionEnCurso();
    controles.boton('detener').focus();
    controles.marcarFinDeSecuencia();
    expect(document.activeElement).toBe(controles.boton('ejecutar'));
  });
});

// ===========================================================================
// Huecos de la tarea 6.1 (spec 08): confirmar 7.1, 7.2 y 7.3.
//
// Lo heredado ya cubre: las seis acciones como botones interactivos, la
// velocidad normal seleccionada al entrar (por aria-pressed), nombres
// accesibles distintos, el texto visible corto contenido en el nombre
// accesible, íconos decorativos y los estados durante/después de ejecutar.
//
// Faltaban tres cosas que los requisitos piden de forma explícita:
//  - 7.2: el grupo de velocidad marca a UNO SOLO como seleccionado a la vez,
//    y lo marca por estado presionado Y por clase, nunca solo por color.
//  - 7.3: al entrar, la normal es la ÚNICA seleccionada (las otras tres, no).
//  - 7.1: cada acción es alcanzable por teclado en el orden visual.
// ===========================================================================

describe('controles · 7.2/7.3 · exactamente una velocidad seleccionada por estado y por clase', () => {
  const VELOCIDADES: Velocidad[] = ['lenta', 'normal', 'rapida', 'inmediata'];

  /** Velocidades marcadas por aria-pressed="true". */
  function presionadas(controles: Controles): Velocidad[] {
    return VELOCIDADES.filter((v) => controles.botonVelocidad(v).getAttribute('aria-pressed') === 'true');
  }

  /** Velocidades marcadas por la clase de selección. */
  function conClase(controles: Controles): Velocidad[] {
    return VELOCIDADES.filter((v) => controles.botonVelocidad(v).classList.contains('kl-seleccionada'));
  }

  it('al entrar, la normal es la única seleccionada por estado presionado y por clase', () => {
    const { controles } = montar();
    // Exactamente una por cada canal, y es la misma: la normal.
    expect(presionadas(controles)).toEqual(['normal']);
    expect(conClase(controles)).toEqual(['normal']);
    // Las otras tres no están presionadas y no tienen la clase.
    for (const v of ['lenta', 'rapida', 'inmediata'] as Velocidad[]) {
      expect(controles.botonVelocidad(v).getAttribute('aria-pressed'), v).toBe('false');
      expect(controles.botonVelocidad(v).classList.contains('kl-seleccionada'), v).toBe(false);
    }
  });

  it('al cambiar de velocidad sigue habiendo exactamente una seleccionada, por ambos canales', () => {
    const { controles } = montar();
    for (const destino of ['lenta', 'rapida', 'inmediata', 'normal'] as Velocidad[]) {
      click(controles.botonVelocidad(destino));
      // Un solo botón presionado y una sola clase, y coinciden en el mismo botón.
      expect(presionadas(controles)).toEqual([destino]);
      expect(conClase(controles)).toEqual([destino]);
      expect(controles.velocidadSeleccionada()).toBe(destino);
    }
  });

  it('seleccionar por programa también deja exactamente una marcada por estado y por clase', () => {
    const { controles } = montar();
    controles.seleccionarVelocidad('inmediata');
    expect(presionadas(controles)).toEqual(['inmediata']);
    expect(conClase(controles)).toEqual(['inmediata']);
  });

  it('la selección no depende solo del color: todo botón declara su estado presionado explícito', () => {
    const { controles } = montar();
    // Todo botón de velocidad, seleccionado o no, expone aria-pressed (true/false),
    // de modo que un lector de pantalla conoce el estado sin ver el color.
    for (const v of VELOCIDADES) {
      const pressed = controles.botonVelocidad(v).getAttribute('aria-pressed');
      expect(pressed === 'true' || pressed === 'false', v).toBe(true);
    }
  });
});

describe('controles · 7.1 · acciones alcanzables por teclado en orden visual', () => {
  it('las seis acciones y las cuatro velocidades son botones nativos en el orden de tabulación', () => {
    const { controles } = montar();
    // Un botón nativo sin tabindex negativo participa del orden de tabulación.
    const todos = Array.from(controles.raiz.querySelectorAll('button')) as HTMLButtonElement[];
    expect(todos.length).toBe(10);
    for (const b of todos) {
      expect(b.tagName).toBe('BUTTON');
      // Ningún control se saca del recorrido por teclado con tabindex="-1".
      expect(b.getAttribute('tabindex')).not.toBe('-1');
    }
  });

  it('el orden en el DOM de las acciones es el orden visual esperado', () => {
    const { controles } = montar();
    const accionesEnDom = Array.from(controles.raiz.querySelectorAll<HTMLButtonElement>('.kl-control')).map((b) =>
      b.getAttribute('data-accion'),
    );
    expect(accionesEnDom).toEqual(['ejecutar', 'detener', 'paso', 'reiniciar', 'demostracion', 'paralelo']);
    const velEnDom = Array.from(controles.raiz.querySelectorAll<HTMLButtonElement>('.kl-velocidad')).map((b) =>
      b.getAttribute('data-velocidad'),
    );
    expect(velEnDom).toEqual(['lenta', 'normal', 'rapida', 'inmediata']);
    // El grupo de velocidad va después de las seis acciones en el orden del DOM.
    const hijosBoton = Array.from(controles.raiz.querySelectorAll('button')) as HTMLButtonElement[];
    const idxUltimaAccion = hijosBoton.findIndex((b) => b.getAttribute('data-accion') === 'paralelo');
    const idxPrimeraVel = hijosBoton.findIndex((b) => b.getAttribute('data-velocidad') === 'lenta');
    expect(idxUltimaAccion).toBeLessThan(idxPrimeraVel);
  });
});

// ===========================================================================
// Acción «Ver en paralelo» (spec 04, tarea 14.3, R11.3)
// ===========================================================================
describe('controles · acción «Ver en paralelo»', () => {
  it('tiene el texto visible y el nombre accesible acordados, y este contiene a aquel', () => {
    const { controles } = montar();
    const b = controles.boton('paralelo');
    expect((b.textContent ?? '').trim()).toContain('Ver en paralelo');
    expect(b.getAttribute('aria-label')).toBe('Ver en paralelo mi recorrido y el de Kiro');
    expect(b.querySelector('.kl-control-icono')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('nace deshabilitada, por estado programático y visual, y activarla no hace nada', () => {
    const { controles, reg } = montar();
    expect(controles.habilitada('paralelo')).toBe(false);
    expect(controles.boton('paralelo').getAttribute('aria-disabled')).toBe('true');
    click(controles.boton('paralelo'));
    expect(reg.paralelo).toBe(0);
  });

  it('se habilita cuando existe un intento ejecutado y activarla invoca verEnParalelo', () => {
    const { controles, reg } = montar();
    controles.marcarIntentoEjecutado(true);
    expect(controles.habilitada('paralelo')).toBe(true);
    expect(controles.boton('paralelo').getAttribute('aria-disabled')).toBe('false');
    click(controles.boton('paralelo'));
    expect(reg.paralelo).toBe(1);
  });

  it('se deshabilita mientras hay una ejecución en curso y vuelve al terminar', () => {
    const { controles } = montar();
    controles.marcarIntentoEjecutado(true);
    controles.marcarEjecucionEnCurso();
    expect(controles.habilitada('paralelo')).toBe(false);
    controles.marcarFinDeSecuencia();
    expect(controles.habilitada('paralelo')).toBe(true);
  });

  it('un intento marcado durante la ejecución espera al fin para habilitarse', () => {
    const { controles } = montar();
    controles.marcarEjecucionEnCurso();
    controles.marcarIntentoEjecutado(true);
    expect(controles.habilitada('paralelo')).toBe(false);
    controles.marcarFinDeSecuencia();
    expect(controles.habilitada('paralelo')).toBe(true);
  });

  it('tras detener por el jugador, el intento sigue disponible para comparar', () => {
    const { controles } = montar();
    controles.marcarIntentoEjecutado(true);
    controles.marcarEjecucionEnCurso();
    controles.marcarDetenido();
    expect(controles.habilitada('paralelo')).toBe(true);
  });

  it('sin intento, terminar o detener no la habilita', () => {
    const { controles } = montar();
    controles.marcarFinDeSecuencia();
    expect(controles.habilitada('paralelo')).toBe(false);
    controles.marcarDetenido();
    expect(controles.habilitada('paralelo')).toBe(false);
  });

  it('descartar el intento (nivel nuevo) la vuelve a deshabilitar', () => {
    const { controles } = montar();
    controles.marcarIntentoEjecutado(true);
    controles.marcarIntentoEjecutado(false);
    expect(controles.habilitada('paralelo')).toBe(false);
  });
});
