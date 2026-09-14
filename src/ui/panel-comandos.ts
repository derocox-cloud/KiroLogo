// Panel de comandos desbloqueados de KiroLogo. Lista los comandos que
// `comandosDelMundo` devuelve para el mundo del nivel, en su orden, sin lista
// propia. Al activar uno, pide al editor insertar su ejemplo en el cursor.
//
// No trunca el ejemplo: lo entrega íntegro y deja que el editor aplique su regla
// de límites y que el editor pida el mensaje al globo. Las dependencias del DOM,
// el insertador del editor y el anunciador de la región aria-live entran por
// parámetro, para poder probar en jsdom.

import { comandosDelMundo, type EntradaVocabulario, type Mundo } from '../lenguaje/vocabulario.js';

// ============================================================================
// Dependencias inyectables
// ============================================================================

export interface DependenciasPanel {
  /** Contenedor del DOM donde el panel crea sus elementos. */
  readonly contenedor: HTMLElement;
  /** Mundo del nivel en curso; determina qué comandos se presentan. */
  readonly mundo: Mundo;
  /**
   * Pide al editor insertar el ejemplo íntegro en la posición del cursor y
   * devuelve la línea (desde 1) donde quedó el cursor. El editor aplica límites.
   */
  readonly insertarEjemplo: (ejemplo: string) => number;
  /**
   * Publica un texto en la región `aria-live` `polite` del juego, sin mover el
   * foco. El panel no tiene región propia: usa la única del juego.
   */
  readonly anunciar: (texto: string) => void;
}

// ============================================================================
// Nombre accesible y texto visible de una entrada
// ============================================================================

/**
 * Compone el texto de una entrada: nombre largo, abreviatura, descripción y
 * ejemplo, carácter por carácter tal como el vocabulario los declara.
 */
export function textoDeEntrada(entrada: EntradaVocabulario): string {
  const abrev = entrada.abreviatura === null ? '' : ` (${entrada.abreviatura})`;
  return `${entrada.nombre}${abrev}. ${entrada.descripcion} Ejemplo: ${entrada.ejemplo}`;
}

// ============================================================================
// Interfaz pública
// ============================================================================

export interface PanelComandos {
  /** Elemento raíz del panel. */
  readonly raiz: HTMLElement;
  /** Botones de comando, en el orden en que el vocabulario los devuelve. */
  readonly botones: readonly HTMLButtonElement[];
  /** Entradas presentadas, en orden. */
  readonly entradas: readonly EntradaVocabulario[];
  /** Activa el comando de un índice como si el jugador lo hubiese pulsado. */
  activar(indice: number): void;
}

// ============================================================================
// Creación
// ============================================================================

/**
 * Crea el panel de comandos sobre un contenedor. Un botón por entrada del
 * vocabulario del mundo, en su orden, con el texto visible y el nombre accesible
 * completos. Al activar (ratón, Enter o barra espaciadora, que el botón nativo ya
 * maneja) inserta el ejemplo íntegro por el insertador del editor y anuncia el
 * comando insertado y la línea del cursor.
 */
export function crearPanelComandos(deps: DependenciasPanel): PanelComandos {
  const doc = deps.contenedor.ownerDocument;
  const entradas = comandosDelMundo(deps.mundo);

  const raiz = doc.createElement('div');
  raiz.className = 'kl-panel-comandos';
  raiz.setAttribute('role', 'group');
  raiz.setAttribute('aria-label', 'Comandos disponibles');

  const botones: HTMLButtonElement[] = [];

  function activarEntrada(entrada: EntradaVocabulario): void {
    // Entrega el ejemplo íntegro; el editor aplica límites y pide el mensaje.
    const linea = deps.insertarEjemplo(entrada.ejemplo);
    deps.anunciar(`Inserté ${entrada.nombre} en la línea ${linea}.`);
  }

  for (const entrada of entradas) {
    const boton = doc.createElement('button');
    boton.type = 'button';
    boton.className = 'kl-comando';
    boton.setAttribute('data-comando', entrada.nombre);
    // Texto visible: nombre, abreviatura, descripción y ejemplo.
    const texto = textoDeEntrada(entrada);
    boton.textContent = texto;
    // Nombre accesible en español con el mismo contenido.
    boton.setAttribute('aria-label', texto);
    // Un botón nativo se activa con ratón, Enter y barra espaciadora, y conserva
    // el foco al activarse; no captura el foco (Tab lo mueve al siguiente).
    boton.addEventListener('click', () => activarEntrada(entrada));
    raiz.appendChild(boton);
    botones.push(boton);
  }

  deps.contenedor.appendChild(raiz);

  return {
    raiz,
    botones,
    entradas,
    activar(indice: number): void {
      const entrada = entradas[indice];
      if (entrada === undefined) return;
      activarEntrada(entrada);
    },
  };
}
