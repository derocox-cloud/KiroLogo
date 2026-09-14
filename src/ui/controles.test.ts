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
  velocidad: Velocidad[];
}

interface Montaje {
  readonly controles: Controles;
  readonly reg: Registro;
}

function montar(): Montaje {
  const cont = document.createElement('div');
  document.body.appendChild(cont);
  const reg: Registro = { ejecutar: 0, detener: 0, paso: 0, reiniciar: 0, demostracion: 0, velocidad: [] };
  const controles = crearControles({
    contenedor: cont,
    callbacks: {
      ejecutar: () => (reg.ejecutar += 1),
      detener: () => (reg.detener += 1),
      darPaso: () => (reg.paso += 1),
      reiniciar: () => (reg.reiniciar += 1),
      verDemostracion: () => (reg.demostracion += 1),
      cambiarVelocidad: (v) => reg.velocidad.push(v),
    },
  });
  return { controles, reg };
}

function click(b: HTMLElement): void {
  b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('controles · seis acciones y cuatro velocidades', () => {
  it('presenta exactamente seis acciones, cada una un elemento interactivo', () => {
    const { controles } = montar();
    const acciones: AccionId[] = ['ejecutar', 'detener', 'paso', 'reiniciar', 'demostracion'];
    for (const a of acciones) {
      expect(controles.boton(a).tagName).toBe('BUTTON');
    }
    const velocidades: Velocidad[] = ['lenta', 'normal', 'rapida', 'inmediata'];
    for (const v of velocidades) {
      expect(controles.botonVelocidad(v).tagName).toBe('BUTTON');
    }
    // Seis acciones = cinco botones + el grupo de velocidad.
    expect(controles.raiz.querySelectorAll('.kl-control').length).toBe(5);
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
    for (const a of ['ejecutar', 'detener', 'paso', 'reiniciar', 'demostracion'] as AccionId[]) {
      const nombre = controles.boton(a).getAttribute('aria-label')!;
      expect(nombre.length).toBeGreaterThan(0);
      nombres.add(nombre);
    }
    for (const v of ['lenta', 'normal', 'rapida', 'inmediata'] as Velocidad[]) {
      const nombre = controles.botonVelocidad(v).getAttribute('aria-label')!;
      expect(nombre.length).toBeGreaterThan(0);
      nombres.add(nombre);
    }
    // Nueve nombres distintos.
    expect(nombres.size).toBe(9);
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
