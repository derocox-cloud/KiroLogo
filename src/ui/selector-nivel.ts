// Selector de nivel de KiroLogo.
//
// Presenta los niveles de un mundo en orden, cada uno con su estado —bloqueado,
// desbloqueado, aprobado o con las tres estrellas— comunicado por texto y forma
// además de por color. Al elegir un nivel desbloqueado invoca el callback de
// `main.ts`; un bloqueado no navega. Refleja la insignia del mundo por texto.
//
// El selector consulta el desbloqueo y las insignias (que derivan del progreso);
// no mantiene estado propio. Son botones nativos, en el orden de foco visual.

import { CATALOGO } from '../niveles/catalogo.js';
import type { Nivel } from '../niveles/tipos.js';
import type { Progreso } from '../juego/progreso.js';
import { estadoDeNivel, type EstadoNivel } from '../juego/desbloqueo.js';
import { insigniaSecuenciaOtorgada } from '../juego/insignias.js';

// ============================================================================
// Callbacks y dependencias
// ============================================================================

export interface CallbacksSelectorNivel {
  /** Pide a `main.ts` ir a un nivel (solo se invoca para niveles desbloqueados). */
  readonly alElegirNivel: (idNivel: string) => void;
}

export interface DependenciasSelectorNivel {
  readonly contenedor: HTMLElement;
  /** Mundo cuyos niveles se presentan (en esta spec, 0). */
  readonly mundo: number;
  readonly progreso: Progreso;
  readonly callbacks: CallbacksSelectorNivel;
}

// ============================================================================
// Textos por estado (texto + símbolo, nunca solo color)
// ============================================================================

/** Descripción accesible de cada estado, en español. */
const TEXTO_ESTADO: Readonly<Record<EstadoNivel, string>> = {
  bloqueado: 'bloqueado',
  desbloqueado: 'disponible',
  aprobado: 'aprobado',
  tresEstrellas: 'tres estrellas',
};

/** Símbolo de forma por estado, para distinguir sin depender del color. */
const SIMBOLO_ESTADO: Readonly<Record<EstadoNivel, string>> = {
  bloqueado: '🔒',
  desbloqueado: '○',
  aprobado: '●',
  tresEstrellas: '★★★',
};

// ============================================================================
// Interfaz pública
// ============================================================================

export interface SelectorNivel {
  readonly raiz: HTMLElement;
  /** Botón de un nivel por su id. */
  boton(idNivel: string): HTMLButtonElement | null;
  /** Estado presentado de un nivel por su id. */
  estadoDe(idNivel: string): EstadoNivel | null;
  /** ¿Se está mostrando la insignia del mundo? */
  insigniaVisible(): boolean;
  /** Vuelve a leer el progreso y repinta estados e insignia. */
  refrescar(): void;
}

// ============================================================================
// Creación
// ============================================================================

/**
 * Crea el selector de nivel sobre un contenedor. Un botón por nivel del mundo,
 * en el orden del catálogo, con nombre accesible que incluye el identificador y
 * el estado. Elegir un bloqueado no hace nada; elegir uno disponible invoca el
 * callback. Una línea aparte anuncia la insignia del mundo cuando se otorga.
 */
export function crearSelectorNivel(deps: DependenciasSelectorNivel): SelectorNivel {
  const doc = deps.contenedor.ownerDocument;
  const niveles: readonly Nivel[] = CATALOGO.filter((n) => n.mundo === deps.mundo);

  const raiz = doc.createElement('nav');
  raiz.className = 'kl-selector-nivel';
  raiz.setAttribute('aria-label', `Niveles del mundo ${deps.mundo}`);

  const lista = doc.createElement('ul');
  lista.className = 'kl-selector-lista';
  raiz.appendChild(lista);

  const botones = new Map<string, HTMLButtonElement>();
  const estados = new Map<string, EstadoNivel>();

  for (const nivel of niveles) {
    const item = doc.createElement('li');
    item.className = 'kl-selector-item';

    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'kl-selector-boton';
    b.setAttribute('data-nivel', nivel.id);
    b.addEventListener('click', () => {
      if (b.disabled) return;
      deps.callbacks.alElegirNivel(nivel.id);
    });

    item.appendChild(b);
    lista.appendChild(item);
    botones.set(nivel.id, b);
  }

  // Línea de la insignia del mundo (texto, además de cualquier color).
  const insignia = doc.createElement('p');
  insignia.className = 'kl-selector-insignia';
  insignia.hidden = true;
  raiz.appendChild(insignia);

  deps.contenedor.appendChild(raiz);

  // --- Pintado desde el progreso ---
  function pintarNivel(nivel: Nivel): void {
    const estado = estadoDeNivel(nivel.id, deps.progreso);
    estados.set(nivel.id, estado);
    const b = botones.get(nivel.id)!;

    const texto = `${nivel.id} ${nivel.titulo}`;
    const marca = SIMBOLO_ESTADO[estado];
    const estadoTexto = TEXTO_ESTADO[estado];

    // Contenido visible: id, título y símbolo de forma.
    b.textContent = `${marca} ${texto}`;
    // Nombre accesible: id, título y estado en palabras.
    b.setAttribute('aria-label', `Nivel ${texto}, ${estadoTexto}`);
    b.setAttribute('data-estado', estado);

    const bloqueado = estado === 'bloqueado';
    b.disabled = bloqueado;
    b.classList.toggle('kl-bloqueado', bloqueado);
    b.setAttribute('aria-disabled', bloqueado ? 'true' : 'false');
  }

  function pintarInsignia(): void {
    // En esta spec, solo el mundo 0 tiene insignia (Secuencia).
    const otorgada = deps.mundo === 0 && insigniaSecuenciaOtorgada(deps.progreso);
    insignia.hidden = !otorgada;
    insignia.textContent = otorgada ? 'Insignia Secuencia conseguida: completaste el mundo 0 con las tres estrellas.' : '';
  }

  function refrescar(): void {
    for (const nivel of niveles) pintarNivel(nivel);
    pintarInsignia();
  }

  refrescar();

  return {
    raiz,
    boton: (idNivel: string) => botones.get(idNivel) ?? null,
    estadoDe: (idNivel: string) => estados.get(idNivel) ?? null,
    insigniaVisible: () => !insignia.hidden,
    refrescar,
  };
}
