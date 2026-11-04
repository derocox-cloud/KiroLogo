// Menú de mundos desplegable de KiroLogo.
//
// Reemplaza la fila de niveles de un solo mundo del Selector_Nivel por un menú
// superpuesto con los seis mundos de concepto en acordeón. Cada mundo despliega
// sus niveles y permite ir de uno a otro. El menú no guarda estado propio del
// juego: lo deriva de `desbloqueo.ts`, del `CATALOGO` y de `insignias.ts`.
//
// Patrón ARIA de **divulgación** (disclosure), no de menú: un botón de cabecera
// con `aria-expanded`/`aria-controls` abre un panel `region`; dentro, cada
// encabezado de mundo es un `button` que abre su lista de niveles en acordeón.
// Todo el contenido del panel es una sola parada de Tab gracias al «roving
// tabindex», igual que `panel-comandos.ts`, para respetar el presupuesto de 20
// paradas de 00·28.1.

import { CATALOGO } from '../niveles/catalogo.js';
import type { Nivel } from '../niveles/tipos.js';
import { MUNDOS, etiquetaDeMundo } from '../niveles/mundos.js';
import type { Mundo } from '../lenguaje/vocabulario.js';
import type { Progreso } from '../juego/progreso.js';
import { mundoDesbloqueado, nivelDesbloqueado, estadoDeNivel, type EstadoNivel } from '../juego/desbloqueo.js';
import { insigniasDelMundo } from '../juego/insignias.js';

// ============================================================================
// Callbacks y dependencias
// ============================================================================

export interface CallbacksMenuMundos {
  /** Pide a `main.ts` ir a un nivel (solo se invoca para niveles desbloqueados). */
  readonly alElegirNivel: (idNivel: string) => void;
}

export interface DependenciasMenuMundos {
  readonly contenedor: HTMLElement; // #ranura-ruta
  readonly progreso: Progreso;
  readonly callbacks: CallbacksMenuMundos;
}

// ============================================================================
// Estado de un mundo en el menú (presentación, derivado)
// ============================================================================

/** Estado de un mundo en el menú, derivado de desbloqueo + catálogo. */
export type EstadoMundo =
  | 'disponible' // desbloqueado y con niveles
  | 'bloqueado' // mundo anterior sin completar
  | 'proximamente'; // sin niveles en el catálogo todavía

// ============================================================================
// Textos por estado (texto + símbolo, nunca solo color) — trasladados del selector
// ============================================================================

/** Descripción accesible de cada estado de nivel, en español. */
const TEXTO_ESTADO: Readonly<Record<EstadoNivel, string>> = {
  bloqueado: 'bloqueado',
  desbloqueado: 'disponible',
  aprobado: 'aprobado',
  tresEstrellas: 'tres estrellas',
};

/** Símbolo de forma por estado de nivel, para distinguir sin depender del color. */
const SIMBOLO_ESTADO: Readonly<Record<EstadoNivel, string>> = {
  bloqueado: '🔒',
  desbloqueado: '○',
  aprobado: '●',
  tresEstrellas: '★★★',
};

/** Rótulo de estado de un mundo, por texto (no solo color). */
const TEXTO_ESTADO_MUNDO: Readonly<Record<EstadoMundo, string>> = {
  disponible: 'disponible',
  bloqueado: 'bloqueado',
  proximamente: 'próximamente',
};

/** Los seis mundos de concepto, por número, en orden. */
const MUNDOS_ORDENADOS: readonly Mundo[] = [0, 1, 2, 3, 4, 5];

// Contador de instancias para dar ids únicos a los paneles (aria-controls /
// aria-labelledby). No es azar del juego: es un identificador de DOM, por eso no
// pasa por el PRNG sembrado.
let proximoId = 0;

// ============================================================================
// Interfaz pública
// ============================================================================

export interface MenuMundos {
  readonly raiz: HTMLElement; // el botón de cabecera + el panel
  readonly boton: HTMLButtonElement; // abre/cierra; muestra mundo y nivel en curso
  /** ¿El panel está abierto? */
  abierto(): boolean;
  /** Abre el panel (deja abierto el mundo del nivel en curso). */
  abrir(): void;
  /** Cierra el panel. */
  cerrar(): void;
  /** Encabezado del desplegable de un mundo. */
  encabezadoMundo(mundo: Mundo): HTMLButtonElement | null;
  /** ¿Está abierto el desplegable de un mundo? */
  mundoAbierto(mundo: Mundo): boolean;
  /** Estado presentado de un mundo. */
  estadoDeMundo(mundo: Mundo): EstadoMundo;
  /** Botón de un nivel por su id (null si su mundo no tiene ese nivel o no está renderizado). */
  botonNivel(idNivel: string): HTMLButtonElement | null;
  /** Estado presentado de un nivel por su id. */
  estadoDe(idNivel: string): EstadoNivel | null;
  /** ¿Se muestra la medalla de la insignia de un mundo? */
  insigniaVisible(mundo: Mundo): boolean;
  /** Vuelve a leer progreso y repinta estados, insignias y el resumen del botón. */
  refrescar(): void;
  /** Marca el nivel en curso (aria-current="step") y actualiza el resumen del botón. */
  marcarActual(idNivel: string): void;
}

// ============================================================================
// Creación
// ============================================================================

/**
 * Crea el menú de mundos sobre un contenedor (la ranura de la cabecera). Presenta
 * los seis mundos de concepto como desplegables en acordeón. El botón de cabecera
 * resume el mundo y el nivel en curso; al abrirlo queda desplegado el mundo del
 * nivel en curso. Elegir un nivel desbloqueado cierra el menú e invoca el
 * callback; un bloqueado no hace nada y dice el motivo por texto.
 */
export function crearMenuMundos(deps: DependenciasMenuMundos): MenuMundos {
  const doc = deps.contenedor.ownerDocument;
  const win = doc.defaultView;

  // Niveles de un mundo, en el orden del catálogo.
  function nivelesDelMundo(mundo: Mundo): readonly Nivel[] {
    return CATALOGO.filter((n) => n.mundo === mundo);
  }

  function estadoDeMundo(mundo: Mundo): EstadoMundo {
    if (nivelesDelMundo(mundo).length === 0) return 'proximamente';
    if (mundoDesbloqueado(mundo, deps.progreso)) return 'disponible';
    return 'bloqueado';
  }

  // id únicos para aria-controls / aria-labelledby.
  const sufijo = proximoId++;
  const idPanel = `kl-menu-panel-${sufijo}`;

  // --- Raíz: contenedor posicionado con el botón de cabecera y el panel ---
  const raiz = doc.createElement('div');
  raiz.className = 'kl-menu-mundos';

  const boton = doc.createElement('button');
  boton.type = 'button';
  boton.className = 'kl-menu-mundos-boton';
  boton.setAttribute('aria-expanded', 'false');
  boton.setAttribute('aria-controls', idPanel);

  const resumen = doc.createElement('span');
  resumen.className = 'kl-menu-mundos-resumen';
  boton.appendChild(resumen);

  const panel = doc.createElement('div');
  panel.id = idPanel;
  panel.className = 'kl-menu-panel';
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Mundos y niveles');
  panel.hidden = true;

  raiz.append(boton, panel);
  deps.contenedor.appendChild(raiz);

  // ==========================================================================
  // Estructura de cada mundo: encabezado (acordeón) + lista de niveles
  // ==========================================================================

  interface PiezaMundo {
    readonly mundo: Mundo;
    readonly encabezado: HTMLButtonElement;
    readonly lista: HTMLElement; // contenedor de niveles (o «próximamente»)
    readonly medalla: HTMLElement; // medalla de insignia en el encabezado
    readonly tituloEstado: HTMLElement; // rótulo de estado del encabezado
  }

  const piezas = new Map<Mundo, PiezaMundo>();
  const botonesNivel = new Map<string, HTMLButtonElement>();
  const estadosNivel = new Map<string, EstadoNivel>();
  // Mundo de cada nivel, para resolver qué lista contiene un id.
  const mundoDeNivel = new Map<string, Mundo>();

  for (const mundo of MUNDOS_ORDENADOS) {
    const seccion = doc.createElement('section');
    seccion.className = 'kl-menu-mundo';

    const encabezado = doc.createElement('button');
    encabezado.type = 'button';
    encabezado.className = 'kl-menu-mundo-encabezado';
    const idLista = `kl-menu-lista-${mundo}-${sufijo}`;
    encabezado.setAttribute('aria-controls', idLista);
    encabezado.setAttribute('aria-expanded', 'false');
    const idEncabezado = `kl-menu-encabezado-${mundo}-${sufijo}`;
    encabezado.id = idEncabezado;

    const numero = doc.createElement('span');
    numero.className = 'kl-menu-mundo-numero';
    numero.textContent = `Mundo ${mundo}`;

    const nombre = doc.createElement('span');
    nombre.className = 'kl-menu-mundo-nombre';
    nombre.textContent = MUNDOS[mundo].nombre;

    const medalla = doc.createElement('span');
    medalla.className = 'kl-menu-mundo-medalla kl-insignia-medalla';
    medalla.setAttribute('aria-hidden', 'true');
    medalla.textContent = '★';
    medalla.hidden = true;

    const tituloEstado = doc.createElement('span');
    tituloEstado.className = 'kl-menu-mundo-estado';

    encabezado.append(numero, ' ', nombre, ' ', medalla, ' ', tituloEstado);

    const lista = doc.createElement('div');
    lista.id = idLista;
    lista.className = 'kl-menu-lista';
    lista.setAttribute('role', 'group');
    lista.setAttribute('aria-labelledby', idEncabezado);
    lista.hidden = true;

    seccion.append(encabezado, lista);
    panel.appendChild(seccion);

    const pieza: PiezaMundo = { mundo, encabezado, lista, medalla, tituloEstado };
    piezas.set(mundo, pieza);

    // Niveles del mundo (si los hay). Un mundo sin niveles muestra «próximamente».
    const niveles = nivelesDelMundo(mundo);
    if (niveles.length === 0) {
      const aviso = doc.createElement('p');
      aviso.className = 'kl-menu-proximamente';
      aviso.textContent = 'próximamente';
      lista.appendChild(aviso);
    } else {
      for (const nivel of niveles) {
        const b = doc.createElement('button');
        b.type = 'button';
        b.className = 'kl-menu-nivel';
        b.setAttribute('data-nivel', nivel.id);
        b.addEventListener('click', () => {
          if (b.disabled) return;
          // Solo niveles desbloqueados cargan; cerrar el menú antes de invocar.
          if (!nivelDesbloqueado(nivel.id, deps.progreso)) return;
          cerrar();
          deps.callbacks.alElegirNivel(nivel.id);
        });
        lista.appendChild(b);
        botonesNivel.set(nivel.id, b);
        mundoDeNivel.set(nivel.id, mundo);
      }
    }

    // Abrir/cerrar el acordeón de este mundo.
    encabezado.addEventListener('click', () => {
      if (encabezado.disabled) return;
      alternarMundo(mundo);
    });
  }

  // ==========================================================================
  // Roving tabindex sobre los elementos interactivos del panel
  // ==========================================================================

  /**
   * Los elementos recorribles con las flechas: cada encabezado de mundo y, si el
   * mundo está abierto, los botones de sus niveles, en orden visual. Se recalcula
   * cada vez porque abrir/cerrar un mundo cambia qué niveles son alcanzables.
   */
  function elementosRecorribles(): HTMLButtonElement[] {
    const lista: HTMLButtonElement[] = [];
    for (const mundo of MUNDOS_ORDENADOS) {
      const pieza = piezas.get(mundo)!;
      lista.push(pieza.encabezado);
      if (!pieza.lista.hidden) {
        for (const b of pieza.lista.querySelectorAll<HTMLButtonElement>('.kl-menu-nivel')) {
          lista.push(b);
        }
      }
    }
    return lista;
  }

  /** Deja un solo elemento con tabIndex 0 (el i-ésimo); el resto, -1. */
  function marcarActivo(activo: HTMLElement): void {
    for (const el of elementosRecorribles()) {
      el.tabIndex = el === activo ? 0 : -1;
    }
  }

  /** Reparte el roving: el primer recorrible es la única parada de Tab del panel. */
  function restaurarRoving(): void {
    const els = elementosRecorribles();
    els.forEach((el, k) => {
      el.tabIndex = k === 0 ? 0 : -1;
    });
  }

  function enfocar(indice: number): void {
    const els = elementosRecorribles();
    const n = els.length;
    if (n === 0) return;
    els[((indice % n) + n) % n]!.focus();
  }

  panel.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    if (t instanceof (win?.HTMLButtonElement ?? HTMLButtonElement)) marcarActivo(t);
  });

  panel.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cerrar();
      boton.focus();
      e.preventDefault();
      return;
    }
    const els = elementosRecorribles();
    const i = els.indexOf(doc.activeElement as HTMLButtonElement);
    if (i < 0) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        enfocar(i + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        enfocar(i - 1);
        break;
      case 'Home':
        enfocar(0);
        break;
      case 'End':
        enfocar(els.length - 1);
        break;
      default:
        return; // Tab, Enter y la barra espaciadora siguen su curso normal
    }
    e.preventDefault();
  });

  // ==========================================================================
  // Acordeón: a lo sumo un mundo abierto
  // ==========================================================================

  let mundoExpandido: Mundo | null = null;

  function mundoExpandible(mundo: Mundo): boolean {
    // Un mundo «próximamente» o «bloqueado» no se abre.
    return estadoDeMundo(mundo) === 'disponible';
  }

  function abrirMundo(mundo: Mundo): void {
    if (!mundoExpandible(mundo)) return;
    if (mundoExpandido !== null && mundoExpandido !== mundo) cerrarMundo(mundoExpandido);
    const pieza = piezas.get(mundo)!;
    pieza.lista.hidden = false;
    pieza.encabezado.setAttribute('aria-expanded', 'true');
    mundoExpandido = mundo;
    restaurarRoving();
  }

  function cerrarMundo(mundo: Mundo): void {
    const pieza = piezas.get(mundo)!;
    pieza.lista.hidden = true;
    pieza.encabezado.setAttribute('aria-expanded', 'false');
    if (mundoExpandido === mundo) mundoExpandido = null;
    restaurarRoving();
  }

  function alternarMundo(mundo: Mundo): void {
    if (mundoExpandido === mundo) cerrarMundo(mundo);
    else abrirMundo(mundo);
  }

  // ==========================================================================
  // Abrir / cerrar el panel
  // ==========================================================================

  let panelAbierto = false;

  /** El mundo del nivel en curso, para dejarlo abierto al abrir el panel. */
  let mundoEnCurso: Mundo | null = null;

  function alClicFuera(e: MouseEvent): void {
    if (!panelAbierto) return;
    const t = e.target as Node;
    if (!raiz.contains(t)) cerrar();
  }

  function abrir(): void {
    if (panelAbierto) return;
    panelAbierto = true;
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    // Deja abierto el mundo del nivel en curso (si es expandible).
    if (mundoEnCurso !== null && mundoExpandible(mundoEnCurso)) abrirMundo(mundoEnCurso);
    else restaurarRoving();
    // Clic fuera cierra; se escucha en todo el documento mientras está abierto.
    doc.addEventListener('mousedown', alClicFuera, true);
  }

  function cerrar(): void {
    if (!panelAbierto) return;
    panelAbierto = false;
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('mousedown', alClicFuera, true);
  }

  boton.addEventListener('click', () => {
    if (panelAbierto) cerrar();
    else abrir();
  });

  // Escape cierra el panel aunque el foco siga en el bot�n de cabecera (que no est�
  // dentro del panel y, por tanto, no recibe el keydown de arriba). El foco se queda
  // donde est�: en el propio bot�n.
  boton.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && panelAbierto) {
      cerrar();
      e.preventDefault();
    }
  });

  // ==========================================================================
  // Pintado desde el progreso
  // ==========================================================================

  function pintarNivel(nivel: Nivel): void {
    const estado = estadoDeNivel(nivel.id, deps.progreso);
    estadosNivel.set(nivel.id, estado);
    const b = botonesNivel.get(nivel.id)!;

    const texto = `${nivel.id} ${nivel.titulo}`;
    const marca = SIMBOLO_ESTADO[estado];
    const estadoTexto = TEXTO_ESTADO[estado];

    // Contenido visible en trozos con clase propia, igual que el selector:
    // «símbolo id título».
    b.textContent = '';
    const simbolo = doc.createElement('span');
    simbolo.className = 'kl-menu-nivel-marca';
    simbolo.textContent = marca;
    const id = doc.createElement('span');
    id.className = 'kl-menu-nivel-id';
    id.textContent = nivel.id;
    const titulo = doc.createElement('span');
    titulo.className = 'kl-menu-nivel-titulo';
    titulo.textContent = nivel.titulo;
    b.append(simbolo, ' ', id, ' ', titulo);

    const bloqueado = estado === 'bloqueado';

    // Un nivel bloqueado no basta con decir «bloqueado»: el jugador necesita saber
    // qué le falta (requisito 6.3). Si el mundo entero sigue cerrado, la condición es
    // terminar el mundo anterior; si el mundo está abierto pero este no es el primero
    // de la lista, es aprobar el nivel inmediatamente anterior. El motivo va por texto,
    // legible con teclado y lector de pantalla, no sólo en un color o un candado.
    let motivo: string | null = null;
    if (bloqueado) {
      motivo = mundoDesbloqueado(nivel.mundo, deps.progreso)
        ? 'Aprueba el anterior para abrirlo'
        : 'Completa el mundo anterior';
      const spanMotivo = doc.createElement('span');
      spanMotivo.className = 'kl-menu-nivel-motivo';
      spanMotivo.textContent = motivo;
      b.append(' ', spanMotivo);
    }

    const estadoCompleto = motivo === null ? estadoTexto : `${estadoTexto}: ${motivo}`;
    b.title = `Nivel ${texto}, ${estadoCompleto}`;
    b.setAttribute('aria-label', `Nivel ${texto}, ${estadoCompleto}`);
    b.setAttribute('data-estado', estado);
    b.disabled = bloqueado;
    b.classList.toggle('kl-bloqueado', bloqueado);
    b.setAttribute('aria-disabled', bloqueado ? 'true' : 'false');
  }

  /** ¿Se ha ganado la insignia de concepto de un mundo? Hoy solo la del mundo 0. */
  function insigniaOtorgada(mundo: Mundo): boolean {
    return insigniasDelMundo(mundo, deps.progreso).length > 0;
  }

  function pintarEncabezado(mundo: Mundo): void {
    const pieza = piezas.get(mundo)!;
    const estado = estadoDeMundo(mundo);
    const expandible = estado === 'disponible';

    // Nombre accesible del encabezado: identificación del mundo + estado por texto.
    const etiqueta = `${etiquetaDeMundo(mundo)}, ${TEXTO_ESTADO_MUNDO[estado]}`;
    pieza.encabezado.setAttribute('aria-label', etiqueta);
    pieza.encabezado.setAttribute('data-estado-mundo', estado);
    pieza.tituloEstado.textContent = TEXTO_ESTADO_MUNDO[estado];

    // Un mundo no expandible no se abre y queda deshabilitado para el acordeón.
    pieza.encabezado.disabled = !expandible;
    pieza.encabezado.setAttribute('aria-disabled', expandible ? 'false' : 'true');
    if (!expandible && !pieza.lista.hidden) cerrarMundo(mundo);

    // Medalla de la insignia del mundo ganado (D7). El nombre queda por texto además.
    const otorgada = insigniaOtorgada(mundo);
    pieza.medalla.hidden = !otorgada;
    if (otorgada) {
      pieza.medalla.title = `Insignia ${MUNDOS[mundo].insignia} conseguida.`;
    } else {
      pieza.medalla.removeAttribute('title');
    }
  }

  /** Resumen del botón de cabecera: mundo y nivel en curso con todas sus letras. */
  function pintarResumen(idNivel: string | null): void {
    if (idNivel === null) {
      resumen.textContent = 'Mundos y niveles';
      return;
    }
    const busqueda = CATALOGO.find((n) => n.id === idNivel);
    if (busqueda === undefined) {
      resumen.textContent = 'Mundos y niveles';
      return;
    }
    resumen.textContent = `${etiquetaDeMundo(busqueda.mundo)} — ${busqueda.id} ${busqueda.titulo}`;
  }

  function refrescar(): void {
    for (const mundo of MUNDOS_ORDENADOS) {
      for (const nivel of nivelesDelMundo(mundo)) pintarNivel(nivel);
      pintarEncabezado(mundo);
    }
    restaurarRoving();
  }

  let idActual: string | null = null;

  function marcarActual(idNivel: string): void {
    idActual = idNivel;
    for (const [id, b] of botonesNivel) {
      if (id === idNivel) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    }
    mundoEnCurso = mundoDeNivel.get(idNivel) ?? null;
    pintarResumen(idNivel);
  }

  // Pintado inicial.
  refrescar();
  pintarResumen(idActual);

  return {
    raiz,
    boton,
    abierto: () => panelAbierto,
    abrir,
    cerrar,
    encabezadoMundo: (mundo: Mundo) => piezas.get(mundo)?.encabezado ?? null,
    mundoAbierto: (mundo: Mundo) => mundoExpandido === mundo,
    estadoDeMundo,
    botonNivel: (idNivel: string) => botonesNivel.get(idNivel) ?? null,
    estadoDe: (idNivel: string) => estadosNivel.get(idNivel) ?? null,
    insigniaVisible: (mundo: Mundo) => {
      const pieza = piezas.get(mundo);
      return pieza ? !pieza.medalla.hidden : false;
    },
    refrescar,
    marcarActual,
  };
}
