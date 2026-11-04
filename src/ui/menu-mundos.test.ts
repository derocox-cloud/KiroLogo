// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { crearMenuMundos, type MenuMundos } from './menu-mundos.js';
import { cargarProgreso, type Progreso } from '../juego/progreso.js';
import { estadoDeNivel, mundoDesbloqueado } from '../juego/desbloqueo.js';
import { CATALOGO } from '../niveles/catalogo.js';
import type { Calificacion } from '../juego/estrellas.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================================
// Ayudas
// ============================================================================

const IDS = ['0.1', '0.2', '0.3', '0.4', '0.5'] as const;
const MUNDOS_TODOS = [0, 1, 2, 3, 4, 5] as const;
let contenedor: HTMLElement;
let elegidos: string[];

function calif(p: boolean, e: boolean, a: boolean): Calificacion {
  const est = (o: boolean) => (o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } });
  return { precision: est(p), economia: est(e), abstraccion: est(a), conteoJugador: 1, presupuestoEstrella: 1, mensajeAbstraccion: null };
}

function conAprobados(...ids: string[]): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of ids) progreso.guardar(id, 1, calif(true, false, false), 1);
  return progreso;
}

function conTresEstrellas(...ids: string[]): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of ids) progreso.guardar(id, 1, calif(true, true, true), 1);
  return progreso;
}

function crear(progreso: Progreso): MenuMundos {
  return crearMenuMundos({
    contenedor,
    progreso,
    callbacks: { alElegirNivel: (id) => elegidos.push(id) },
  });
}

/** Abre el panel y despliega el mundo indicado para inspeccionar sus niveles. */
function abrirMundo(menu: MenuMundos, mundo: 0 | 1 | 2 | 3 | 4 | 5): void {
  menu.abrir();
  menu.encabezadoMundo(mundo)!.click();
}

beforeEach(() => {
  document.body.innerHTML = '<div id="aplicacion"></div>';
  contenedor = document.getElementById('aplicacion') as HTMLElement;
  elegidos = [];
});

// ============================================================================
// Presentación (migrado: selector-nivel · presentación, 4 pruebas)
// ============================================================================

describe('menu-mundos · presentación', () => {
  it('presenta los cinco niveles del mundo 0 en orden al abrirlo', () => {
    const menu = crear(cargarProgreso(null));
    abrirMundo(menu, 0);
    const botones = menu.encabezadoMundo(0)!.parentElement!.querySelectorAll('button[data-nivel]');
    expect([...botones].map((b) => b.getAttribute('data-nivel'))).toEqual([...IDS]);
  });

  it('sin progreso: 0.1 disponible, el resto bloqueado', () => {
    const menu = crear(cargarProgreso(null));
    expect(menu.estadoDe('0.1')).toBe('desbloqueado');
    for (const id of ['0.2', '0.3', '0.4', '0.5']) {
      expect(menu.estadoDe(id)).toBe('bloqueado');
    }
  });

  it('comunica el estado por texto y forma, no solo por color', () => {
    const menu = crear(conTresEstrellas('0.1'));
    const b01 = menu.botonNivel('0.1')!;
    // Nombre accesible con el estado en palabras.
    expect(b01.getAttribute('aria-label')).toMatch(/tres estrellas/i);
    // Atributo de estado y símbolo de forma en el texto visible.
    expect(b01.getAttribute('data-estado')).toBe('tresEstrellas');
    expect(b01.textContent).toContain('★★★');
    // Un bloqueado lleva su propia marca y palabra. Con solo el 0.1 hecho, el
    // 0.2 queda disponible, así que el 0.3 es el primer bloqueado.
    const b03 = menu.botonNivel('0.3')!;
    expect(b03.getAttribute('aria-label')).toMatch(/bloqueado/i);
    expect(b03.textContent).toContain('🔒');
  });

  it('refleja los cuatro estados', () => {
    // 0.1 tres estrellas, 0.2 aprobado (abre 0.3 disponible), 0.3 bloqueado...
    const progreso = cargarProgreso(null);
    progreso.guardar('0.1', 1, calif(true, true, true), 1); // tresEstrellas
    progreso.guardar('0.2', 1, calif(true, false, false), 1); // aprobado → abre 0.3
    const menu = crear(progreso);
    expect(menu.estadoDe('0.1')).toBe('tresEstrellas');
    expect(menu.estadoDe('0.2')).toBe('aprobado');
    expect(menu.estadoDe('0.3')).toBe('desbloqueado');
    expect(menu.estadoDe('0.4')).toBe('bloqueado');
  });
});

// ============================================================================
// En qué mundo estás (migrado: selector-nivel · en qué mundo estás, 4 pruebas)
// ============================================================================

describe('menu-mundos · en qué mundo estás', () => {
  it('el resumen del botón de cabecera muestra el mundo y el nivel en curso, con todas sus letras', () => {
    const menu = crear(cargarProgreso(null));
    menu.marcarActual('0.1');
    const resumen = menu.boton.querySelector('.kl-menu-mundos-resumen')!;
    expect(resumen.textContent).toBe('Mundo 0 · Primeros pasos — 0.1 Un paso al frente');
  });

  it('el encabezado de cada mundo va antes de su lista de niveles', () => {
    const menu = crear(cargarProgreso(null));
    const seccion = menu.encabezadoMundo(0)!.parentElement!;
    const hijos = [...seccion.children].map((e) => e.className.split(' ')[0]);
    expect(hijos.indexOf('kl-menu-mundo-encabezado')).toBe(0);
    expect(hijos.indexOf('kl-menu-mundo-encabezado')).toBeLessThan(hijos.indexOf('kl-menu-lista'));
  });

  it('el nombre accesible del panel y del encabezado del mundo dicen el nombre del mundo', () => {
    const menu = crear(cargarProgreso(null));
    const panel = menu.boton.nextElementSibling as HTMLElement;
    expect(panel.getAttribute('role')).toBe('region');
    expect(panel.getAttribute('aria-label')).toBe('Mundos y niveles');
    expect(menu.encabezadoMundo(0)!.getAttribute('aria-label')).toBe('Mundo 0 · Primeros pasos, disponible');
  });

  it('no cambia los botones: sus textos y nombres accesibles siguen igual', () => {
    const menu = crear(cargarProgreso(null));
    expect(menu.botonNivel('0.1')!.textContent).toBe('○ 0.1 Un paso al frente');
    expect(menu.botonNivel('0.1')!.getAttribute('aria-label')).toBe('Nivel 0.1 Un paso al frente, disponible');
  });
});

// ============================================================================
// Contenido del botón (migrado: selector-nivel · contenido del botón, 3 pruebas)
// ============================================================================

describe('menu-mundos · contenido del botón', () => {
  it('el texto visible es «símbolo id título», repartido en trozos con clase propia', () => {
    const menu = crear(cargarProgreso(null));
    const b = menu.botonNivel('0.1')!;
    expect(b.textContent).toBe('○ 0.1 Un paso al frente');
    expect(b.querySelector('.kl-menu-nivel-marca')!.textContent).toBe('○');
    expect(b.querySelector('.kl-menu-nivel-id')!.textContent).toBe('0.1');
    expect(b.querySelector('.kl-menu-nivel-titulo')!.textContent).toBe('Un paso al frente');
  });

  it('el título completo y el estado quedan también como tooltip', () => {
    const menu = crear(cargarProgreso(null));
    expect(menu.botonNivel('0.1')!.title).toBe('Nivel 0.1 Un paso al frente, disponible');
  });

  it('repintar tras refrescar no acumula trozos', () => {
    const progreso = cargarProgreso(null);
    const menu = crear(progreso);
    progreso.guardar('0.1', 1, calif(true, true, true), 1);
    menu.refrescar();
    menu.refrescar();
    const b = menu.botonNivel('0.1')!;
    expect(b.querySelectorAll('.kl-menu-nivel-id').length).toBe(1);
    expect(b.textContent).toBe('★★★ 0.1 Un paso al frente');
  });
});

// ============================================================================
// Nivel actual (migrado: selector-nivel · nivel actual, 4 pruebas)
// ============================================================================

describe('menu-mundos · nivel actual', () => {
  it('marca solo el nivel actual con aria-current="step"', () => {
    const menu = crear(conAprobados('0.1')); // abre 0.2
    menu.marcarActual('0.2');
    expect(menu.botonNivel('0.2')!.getAttribute('aria-current')).toBe('step');
    for (const id of ['0.1', '0.3', '0.4', '0.5']) {
      expect(menu.botonNivel(id)!.hasAttribute('aria-current'), id).toBe(false);
    }
  });

  it('cambiar de nivel actual mueve la marca y actualiza el resumen', () => {
    const menu = crear(conAprobados('0.1'));
    menu.marcarActual('0.1');
    menu.marcarActual('0.2');
    expect(menu.botonNivel('0.1')!.hasAttribute('aria-current')).toBe(false);
    expect(menu.botonNivel('0.2')!.getAttribute('aria-current')).toBe('step');
    const resumen = menu.boton.querySelector('.kl-menu-mundos-resumen')!;
    expect(resumen.textContent).toBe('Mundo 0 · Primeros pasos — 0.2 La primera esquina');
  });

  it('la marca sobrevive a refrescar', () => {
    const progreso = cargarProgreso(null);
    const menu = crear(progreso);
    menu.marcarActual('0.1');
    progreso.guardar('0.1', 1, calif(true, true, true), 1);
    menu.refrescar();
    expect(menu.botonNivel('0.1')!.getAttribute('aria-current')).toBe('step');
  });

  it('un id que no es de ningún nivel del catálogo deja todos sin marcar', () => {
    const menu = crear(cargarProgreso(null));
    menu.marcarActual('0.1');
    menu.marcarActual('9.9');
    for (const id of IDS) expect(menu.botonNivel(id)!.hasAttribute('aria-current')).toBe(false);
  });
});

// ============================================================================
// Navegación (migrado: selector-nivel · navegación, 2 pruebas + añadidos)
// ============================================================================

describe('menu-mundos · navegación', () => {
  it('elegir un nivel desbloqueado invoca el callback y cierra el menú', () => {
    const menu = crear(conAprobados('0.1')); // abre 0.2
    menu.abrir();
    menu.botonNivel('0.2')!.click();
    expect(elegidos).toEqual(['0.2']);
    // Añadido por el comportamiento nuevo: al elegir, el menú se cierra.
    expect(menu.abierto()).toBe(false);
  });

  it('elegir un nivel bloqueado no navega', () => {
    const menu = crear(cargarProgreso(null));
    menu.botonNivel('0.3')!.click();
    expect(elegidos).toEqual([]);
    expect(menu.botonNivel('0.3')!.disabled).toBe(true);
  });
});

// ============================================================================
// Insignia (migrado: selector-nivel · insignia, 7 pruebas)
// En el menú, la insignia vive en el encabezado del mundo (D7): insigniaVisible(0).
// ============================================================================

describe('menu-mundos · insignia', () => {
  it('oculta la insignia del mundo 0 hasta completar sus cinco niveles con tres estrellas', () => {
    const menu = crear(conTresEstrellas('0.1', '0.2', '0.3', '0.4'));
    expect(menu.insigniaVisible(0)).toBe(false);
  });

  it('muestra la insignia del mundo 0 al completarlo', () => {
    const menu = crear(conTresEstrellas(...IDS));
    expect(menu.insigniaVisible(0)).toBe(true);
    // La medalla vive en el encabezado del mundo.
    const encabezado = menu.encabezadoMundo(0)!;
    const medalla = encabezado.querySelector('.kl-menu-mundo-medalla') as HTMLElement;
    expect(medalla.hidden).toBe(false);
  });

  it('la medalla es un dibujo (forma) oculto a los lectores; el nombre del mundo se lee entero', () => {
    const menu = crear(conTresEstrellas(...IDS));
    const encabezado = menu.encabezadoMundo(0)!;
    const medalla = encabezado.querySelector('.kl-menu-mundo-medalla')!;
    // La medalla es una forma, oculta a los lectores; el nombre del mundo queda por texto.
    expect(medalla.getAttribute('aria-hidden')).toBe('true');
    expect(encabezado.querySelector('.kl-menu-mundo-nombre')!.textContent).toBe('Primeros pasos');
  });

  it('la condición para ganarla queda como ayuda al señalar la medalla', () => {
    const menu = crear(conTresEstrellas(...IDS));
    const medalla = menu.encabezadoMundo(0)!.querySelector('.kl-menu-mundo-medalla') as HTMLElement;
    expect(medalla.title).toBe('Insignia Secuencia conseguida.');
  });

  it('sin la insignia, la medalla está oculta y sin ayuda', () => {
    const menu = crear(conTresEstrellas('0.1', '0.2'));
    const medalla = menu.encabezadoMundo(0)!.querySelector('.kl-menu-mundo-medalla') as HTMLElement;
    expect(medalla.hidden).toBe(true);
    expect(medalla.hasAttribute('title')).toBe(false);
  });

  it('refrescar no reconstruye la medalla mientras la insignia siga ganada', () => {
    const menu = crear(conTresEstrellas(...IDS));
    const medalla = menu.encabezadoMundo(0)!.querySelector('.kl-menu-mundo-medalla');
    menu.refrescar();
    menu.refrescar();
    expect(menu.encabezadoMundo(0)!.querySelector('.kl-menu-mundo-medalla')).toBe(medalla);
    expect(menu.encabezadoMundo(0)!.querySelectorAll('.kl-menu-mundo-medalla').length).toBe(1);
  });

  it('muestra la insignia Descomposición al completar el mundo 2 con tres estrellas (R11.3, R11.4)', () => {
    const menu = crear(conTresEstrellas('2.1', '2.2', '2.3', '2.4', '2.5', '2.6'));
    expect(menu.insigniaVisible(2)).toBe(true);
    const medalla = menu.encabezadoMundo(2)!.querySelector('.kl-menu-mundo-medalla') as HTMLElement;
    expect(medalla.hidden).toBe(false);
    expect(medalla.title).toBe('Insignia Descomposición conseguida.');
  });

  it('no muestra la insignia del mundo 2 si falta una estrella (R11.2)', () => {
    const menu = crear(conTresEstrellas('2.1', '2.2', '2.3', '2.4', '2.5'));
    expect(menu.insigniaVisible(2)).toBe(false);
    const medalla = menu.encabezadoMundo(2)!.querySelector('.kl-menu-mundo-medalla') as HTMLElement;
    expect(medalla.hidden).toBe(true);
  });

  it('refrescar vuelve a leer el progreso', () => {
    const progreso = cargarProgreso(null);
    const menu = crear(progreso);
    expect(menu.estadoDe('0.2')).toBe('bloqueado');
    progreso.guardar('0.1', 1, calif(true, false, false), 1);
    menu.refrescar();
    expect(menu.estadoDe('0.2')).toBe('desbloqueado');
  });
});

// ============================================================================
// Comportamiento nuevo del menú (no proviene del selector)
// ============================================================================

describe('menu-mundos · seis mundos', () => {
  it('siempre presenta los seis mundos de concepto, en orden', () => {
    const menu = crear(cargarProgreso(null));
    for (const m of MUNDOS_TODOS) {
      expect(menu.encabezadoMundo(m), `mundo ${m}`).not.toBeNull();
    }
    const encabezados = [...menu.raiz.querySelectorAll('.kl-menu-mundo-encabezado')];
    expect(encabezados.length).toBe(6);
    expect(encabezados.map((e) => e.querySelector('.kl-menu-mundo-numero')!.textContent)).toEqual([
      'Mundo 0', 'Mundo 1', 'Mundo 2', 'Mundo 3', 'Mundo 4', 'Mundo 5',
    ]);
  });

  it('el estado de cada mundo refleja catálogo y desbloqueo: 0 disponible, 1 y 2 bloqueados, 3..5 próximamente', () => {
    const menu = crear(cargarProgreso(null));
    expect(menu.estadoDeMundo(0)).toBe('disponible');
    // Los mundos 1 (figuras) y 2 (composición) ya tienen niveles, así que un jugador
    // nuevo los ve bloqueados (mundo anterior sin completar), no «próximamente».
    expect(menu.estadoDeMundo(1)).toBe('bloqueado');
    expect(menu.estadoDeMundo(2)).toBe('bloqueado');
    for (const m of [3, 4, 5] as const) {
      expect(menu.estadoDeMundo(m), `mundo ${m}`).toBe('proximamente');
    }
  });

  it('un mundo sin niveles muestra «próximamente» por texto y no se puede abrir', () => {
    const menu = crear(cargarProgreso(null));
    menu.abrir();
    // El mundo 3 todavía no tiene niveles en el catálogo.
    const encabezado = menu.encabezadoMundo(3)!;
    expect(encabezado.getAttribute('data-estado-mundo')).toBe('proximamente');
    expect(encabezado.querySelector('.kl-menu-mundo-estado')!.textContent).toBe('próximamente');
    expect(encabezado.disabled).toBe(true);
    encabezado.click();
    expect(menu.mundoAbierto(3)).toBe(false);
  });
});

describe('menu-mundos · abrir y cerrar el panel', () => {
  it('arranca cerrado; el botón de cabecera lo abre y lo cierra', () => {
    const menu = crear(cargarProgreso(null));
    expect(menu.abierto()).toBe(false);
    expect((menu.boton.nextElementSibling as HTMLElement).hidden).toBe(true);
    expect(menu.boton.getAttribute('aria-expanded')).toBe('false');

    menu.boton.click();
    expect(menu.abierto()).toBe(true);
    expect((menu.boton.nextElementSibling as HTMLElement).hidden).toBe(false);
    expect(menu.boton.getAttribute('aria-expanded')).toBe('true');

    menu.boton.click();
    expect(menu.abierto()).toBe(false);
    expect(menu.boton.getAttribute('aria-expanded')).toBe('false');
  });

  it('un clic fuera del menú lo cierra', () => {
    const menu = crear(cargarProgreso(null));
    menu.abrir();
    expect(menu.abierto()).toBe(true);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.abierto()).toBe(false);
  });

  it('un clic dentro del menú no lo cierra', () => {
    const menu = crear(cargarProgreso(null));
    menu.abrir();
    menu.encabezadoMundo(0)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.abierto()).toBe(true);
  });
});

describe('menu-mundos · acordeón', () => {
  it('a lo sumo un mundo abierto a la vez', () => {
    // Solo el mundo 0 es expandible en esta spec, así que verificamos que abrir y
    // cerrar el mundo 0 es consistente y que un mundo «próximamente» no abre.
    const menu = crear(cargarProgreso(null));
    menu.abrir();
    menu.encabezadoMundo(0)!.click();
    expect(menu.mundoAbierto(0)).toBe(true);
    // Un mundo próximamente no se abre ni desplaza al abierto.
    menu.encabezadoMundo(2)!.click();
    expect(menu.mundoAbierto(2)).toBe(false);
    expect(menu.mundoAbierto(0)).toBe(true);
    // Reclicar el encabezado del mundo 0 lo cierra.
    menu.encabezadoMundo(0)!.click();
    expect(menu.mundoAbierto(0)).toBe(false);
  });

  it('abrir un mundo refleja aria-expanded en su encabezado y muestra su lista', () => {
    const menu = crear(cargarProgreso(null));
    menu.abrir();
    const encabezado = menu.encabezadoMundo(0)!;
    const lista = encabezado.parentElement!.querySelector('.kl-menu-lista') as HTMLElement;
    expect(encabezado.getAttribute('aria-expanded')).toBe('false');
    expect(lista.hidden).toBe(true);
    encabezado.click();
    expect(encabezado.getAttribute('aria-expanded')).toBe('true');
    expect(lista.hidden).toBe(false);
  });
});

describe('menu-mundos · mundo del nivel en curso', () => {
  it('al abrir el panel queda desplegado el mundo del nivel en curso', () => {
    const menu = crear(cargarProgreso(null));
    menu.marcarActual('0.1');
    menu.abrir();
    expect(menu.mundoAbierto(0)).toBe(true);
  });
});

describe('menu-mundos · patrón de divulgación', () => {
  it('el botón de cabecera gobierna el panel con aria-expanded/aria-controls', () => {
    const menu = crear(cargarProgreso(null));
    const panel = menu.boton.nextElementSibling as HTMLElement;
    expect(menu.boton.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.id).not.toBe('');
    expect(menu.boton.getAttribute('aria-expanded')).toBe('false');
  });

  it('cada encabezado de mundo gobierna su lista con aria-controls/aria-labelledby', () => {
    const menu = crear(cargarProgreso(null));
    const encabezado = menu.encabezadoMundo(0)!;
    const lista = encabezado.parentElement!.querySelector('.kl-menu-lista') as HTMLElement;
    expect(encabezado.getAttribute('aria-controls')).toBe(lista.id);
    expect(lista.getAttribute('aria-labelledby')).toBe(encabezado.id);
    expect(lista.getAttribute('role')).toBe('group');
  });
});

describe('menu-mundos · teclado y foco', () => {
  it('el botón de cabecera es una sola parada de Tab; el panel aporta una sola por roving', () => {
    const menu = crear(cargarProgreso(null));
    // El botón de cabecera es un botón nativo: una parada.
    expect(menu.boton.tabIndex).not.toBe(-1);
    menu.abrir();
    menu.encabezadoMundo(0)!.click(); // despliega el mundo 0 para tener niveles recorribles
    // El conjunto recorrible por las flechas (encabezados + niveles del mundo
    // abierto) tiene exactamente un elemento con tabIndex 0: la única parada de Tab.
    const encabezados = [...menu.raiz.querySelectorAll<HTMLButtonElement>('.kl-menu-mundo-encabezado')];
    const listaAbierta = menu.encabezadoMundo(0)!.parentElement!.querySelector('.kl-menu-lista') as HTMLElement;
    const nivelesAbiertos = [...listaAbierta.querySelectorAll<HTMLButtonElement>('.kl-menu-nivel')];
    const recorribles = [...encabezados, ...nivelesAbiertos];
    const paradas = recorribles.filter((b) => b.tabIndex === 0);
    expect(paradas.length).toBe(1);
  });

  it('las flechas recorren los elementos del panel', () => {
    const menu = crear(conAprobados('0.1')); // abre 0.2
    menu.abrir();
    menu.encabezadoMundo(0)!.click(); // despliega el mundo 0
    const encabezado = menu.encabezadoMundo(0)!;
    encabezado.focus();
    const panel = menu.boton.nextElementSibling as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // El foco pasa al primer nivel del mundo 0.
    expect(document.activeElement).toBe(menu.botonNivel('0.1'));
  });

  it('Enter y Espacio sobre un encabezado abren su mundo', () => {
    const menu = crear(cargarProgreso(null));
    menu.abrir();
    const encabezado = menu.encabezadoMundo(0)!;
    // Un botón nativo responde a Enter/Espacio con un click; lo simulamos.
    encabezado.click();
    expect(menu.mundoAbierto(0)).toBe(true);
  });

  it('Escape cierra el panel y devuelve el foco al botón de cabecera', () => {
    const menu = crear(cargarProgreso(null));
    menu.abrir();
    menu.encabezadoMundo(0)!.focus();
    const panel = menu.boton.nextElementSibling as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.abierto()).toBe(false);
    expect(document.activeElement).toBe(menu.boton);
  });
});

// ============================================================================
// Ajustes de la spec 09 (correcciones del menu): alto del panel, Escape en el
// boton de cabecera, motivo del bloqueo por texto y numero de mundo sin partir.
// ============================================================================

describe('menu-mundos - ajustes de visibilidad y accesibilidad', () => {
  // Bajo jsdom import.meta.url no es file://, asi que la hoja se lee desde la raiz
  // del proyecto (donde corre vitest), igual que en panel-comandos.test.ts.
  const CSS_PANTALLA = readFileSync(join(process.cwd(), 'src', 'estilos', 'pantalla.css'), 'utf8');

  function valorDe(selector: string, propiedad: string): string | null {
    const sinComentarios = CSS_PANTALLA.replace(/\/\*[\s\S]*?\*\//g, '');
    const bloque = /([^{}]+)\{([^{}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = bloque.exec(sinComentarios)) !== null) {
      const selectores = m[1]!.split(',').map((s) => s.trim());
      if (!selectores.includes(selector)) continue;
      const re = new RegExp(propiedad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*([^;]+);');
      const mm = re.exec(m[2]!);
      if (mm) return mm[1]!.trim();
    }
    return null;
  }

  // (1) El panel debe mostrar los seis mundos sin desplazar. El contenido colapsado
  // mide 553 px; el tope anterior (min(70vh, 32rem) = 512 px) ocultaba 'Mundo 5'.
  // El tope en rem tiene que subir por encima de 553 px (34.56 rem) para que quepa.
  it('(1) el alto maximo del panel deja ver los seis mundos sin desplazar', () => {
    const maxH = valorDe('.kl-menu-panel', 'max-height');
    expect(maxH, 'la regla .kl-menu-panel debe declarar max-height').not.toBeNull();
    const rem = /(\d+(?:\.\d+)?)rem/.exec(maxH ?? '');
    expect(rem, 'max-height debe tener un tope en rem').not.toBeNull();
    const px = parseFloat(rem![1]!) * 16;
    expect(px).toBeGreaterThanOrEqual(553);
  });

  // (2) Escape debe cerrar aunque el foco este en el boton de cabecera (que no esta
  // dentro del panel), y el foco debe quedarse ahi.
  it('(2) Escape con el foco en el boton de cabecera cierra el menu y deja el foco ahi', () => {
    const menu = crear(cargarProgreso(null));
    menu.abrir();
    menu.boton.focus();
    expect(document.activeElement).toBe(menu.boton);
    menu.boton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.abierto()).toBe(false);
    expect(document.activeElement).toBe(menu.boton);
  });

  // (3) Requisito 6.3: un nivel bloqueado dice por texto el motivo, legible con
  // teclado y lector de pantalla, no solo 'bloqueado'.
  it('(3) un nivel bloqueado dice su motivo por texto, no solo "bloqueado"', () => {
    // Hoy todos los niveles del catalogo viven en el mundo 0 (siempre abierto), asi
    // que el bloqueo real alcanzable es el del nivel cuyo anterior no esta aprobado.
    const menu = crear(cargarProgreso(null));
    const b = menu.botonNivel('0.3')!;
    expect(menu.estadoDe('0.3')).toBe('bloqueado');
    // No basta con 'bloqueado': el nombre accesible lleva ademas el motivo.
    expect(b.getAttribute('aria-label')).not.toBe('Nivel 0.3 ' + b.querySelector('.kl-menu-nivel-titulo')?.textContent + ', bloqueado');
    expect(b.querySelector('.kl-menu-nivel-motivo')).not.toBeNull();
  });

  it('(3) un nivel bloqueado dentro de un mundo abierto dice Aprueba el anterior para abrirlo', () => {
    // Mundo 0 abierto, sin aprobar nada: 0.1 disponible, 0.2 bloqueado por el anterior.
    const menu = crear(cargarProgreso(null));
    const b = menu.botonNivel('0.3')!;
    expect(menu.estadoDe('0.3')).toBe('bloqueado');
    const motivo = 'Aprueba el anterior para abrirlo';
    expect(b.querySelector('.kl-menu-nivel-motivo')?.textContent).toBe(motivo);
    expect(b.textContent).toContain(motivo);
    expect(b.getAttribute('aria-label')).toContain(motivo);
  });

  it('(3) un nivel desbloqueado no muestra ningun motivo de bloqueo', () => {
    const menu = crear(cargarProgreso(null));
    const b = menu.botonNivel('0.1')!;
    expect(menu.estadoDe('0.1')).toBe('desbloqueado');
    expect(b.querySelector('.kl-menu-nivel-motivo')).toBeNull();
  });

  // (4) 'Mundo 1' no debe partirse: el numero de mundo lleva white-space: nowrap.
  it('(4) el numero de mundo no se parte (white-space: nowrap)', () => {
    expect(valorDe('.kl-menu-mundo-numero', 'white-space')).toBe('nowrap');
  });
});

// ============================================================================
// Propiedades con fast-check (P3 y P4)
// ============================================================================

/**
 * Construye un progreso alcanzable del mundo 0. El desbloqueo es secuencial, así
 * que un progreso realista aprueba un prefijo de IDS y da tres estrellas a un
 * subprefijo de ese prefijo (`tres` ≤ `aprobados`).
 */
function progresoAlcanzable(aprobados: number, tres: number): Progreso {
  const progreso = cargarProgreso(null);
  for (let i = 0; i < aprobados; i++) {
    const id = IDS[i]!;
    const conTres = i < tres;
    progreso.guardar(id, 1, calif(true, conTres, conTres), 1);
  }
  return progreso;
}

/** Monta un menú nuevo en un contenedor fresco para no acumular DOM entre casos. */
function menuAislado(progreso: Progreso): MenuMundos {
  document.body.innerHTML = '<div id="aplicacion"></div>';
  contenedor = document.getElementById('aplicacion') as HTMLElement;
  return crear(progreso);
}

describe('menu-mundos · propiedad P3', () => {
  // Feature: 09-ajustes-de-interfaz, Property 3: El estado de un nivel en el menú coincide con desbloqueo.ts
  it('estadoDe(idNivel) coincide con estadoDeNivel(idNivel, progreso) para todo progreso alcanzable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: IDS.length }),
        fc.integer({ min: 0, max: IDS.length }),
        (aprobados, extra) => {
          const tres = Math.min(extra, aprobados);
          const progreso = progresoAlcanzable(aprobados, tres);
          const menu = menuAislado(progreso);
          for (const nivel of CATALOGO) {
            expect(menu.estadoDe(nivel.id), `nivel ${nivel.id}`).toBe(
              estadoDeNivel(nivel.id, progreso),
            );
          }
        },
      ),
      { seed: 9, numRuns: 100 },
    );
  });

  it('casos borde: sin progreso, todo aprobado y todo tres estrellas', () => {
    const casos: Progreso[] = [
      cargarProgreso(null),
      conAprobados(...IDS),
      conTresEstrellas(...IDS),
    ];
    for (const progreso of casos) {
      const menu = menuAislado(progreso);
      for (const nivel of CATALOGO) {
        expect(menu.estadoDe(nivel.id), `nivel ${nivel.id}`).toBe(
          estadoDeNivel(nivel.id, progreso),
        );
      }
    }
  });
});

describe('menu-mundos · propiedad P4', () => {
  // Feature: 09-ajustes-de-interfaz, Property 4: La presentación de un mundo coincide con mundoDesbloqueado y el catálogo
  it('estadoDeMundo(m) refleja el catálogo y mundoDesbloqueado para todo progreso alcanzable', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: IDS.length }),
        fc.integer({ min: 0, max: IDS.length }),
        (aprobados, extra) => {
          const tres = Math.min(extra, aprobados);
          const progreso = progresoAlcanzable(aprobados, tres);
          const menu = menuAislado(progreso);
          for (const m of MUNDOS_TODOS) {
            const sinNiveles = CATALOGO.filter((n) => n.mundo === m).length === 0;
            const estado = menu.estadoDeMundo(m);
            // «próximamente» sii el mundo no tiene niveles en el catálogo.
            expect(estado === 'proximamente', `proximamente mundo ${m}`).toBe(sinNiveles);
            if (!sinNiveles) {
              // Con niveles: «disponible» sii el mundo está desbloqueado.
              expect(estado === 'disponible', `disponible mundo ${m}`).toBe(
                mundoDesbloqueado(m, progreso),
              );
              if (!mundoDesbloqueado(m, progreso)) {
                expect(estado, `bloqueado mundo ${m}`).toBe('bloqueado');
              }
            }
          }
        },
      ),
      { seed: 9, numRuns: 100 },
    );
  });
});
