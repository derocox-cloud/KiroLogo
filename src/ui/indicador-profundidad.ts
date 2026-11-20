// Indicador de profundidad de llamada (mundo 5).
//
// Mientras el jugador recorre una recursión paso a paso, esta ranura dice en qué nivel de llamada
// está la ejecución: 0 en el programa principal, 1 dentro del primer procedimiento, 2 dentro de la
// llamada que ese procedimiento se hace a sí mismo, y así. Sin ese número, ver ejecutar una
// recursión no enseña nada: las líneas se repiten y nada indica que cada vuelta es una llamada
// nueva con sus propios valores.
//
// La ranura no ocupa espacio antes del mundo 5 ni fuera del paso a paso. No anuncia nada por sí
// misma: el texto equivalente va en el anuncio aria-live del paso (`main.ts`). Las casillas son
// decorativas; el número y la palabra transmiten lo mismo para quien no las ve.

import type { Mundo } from '../lenguaje/vocabulario.js';

export interface DependenciasIndicadorProfundidad {
  readonly contenedor: HTMLElement;
}

export interface IndicadorProfundidad {
  /** Ranura persistente; queda vacía (sin rol ni tamaño) mientras no se muestra. */
  readonly raiz: HTMLElement;
  fijarMundo(mundo: Mundo): void;
  /** Muestra la profundidad del paso en curso. Sin efecto antes del mundo 5. */
  mostrar(profundidad: number): void;
  ocultar(): void;
  /** Profundidad mostrada, o `null` si el indicador está oculto. */
  profundidad(): number | null;
}

const MUNDO_MINIMO = 5;
/** Casillas dibujadas como máximo; más allá se resume con «+». */
const MAXIMO_CASILLAS = 12;

/** Texto de la profundidad, para el indicador y para el anuncio del paso. */
export function textoProfundidad(profundidad: number): string {
  return profundidad === 0 ? 'en el programa principal' : `profundidad de llamada ${profundidad}`;
}

export function crearIndicadorProfundidad(deps: DependenciasIndicadorProfundidad): IndicadorProfundidad {
  const doc = deps.contenedor.ownerDocument;

  const raiz = doc.createElement('div');
  raiz.className = 'kl-profundidad-ranura';
  deps.contenedor.appendChild(raiz);

  const seccion = doc.createElement('section');
  seccion.className = 'kl-profundidad';
  seccion.setAttribute('aria-label', 'Profundidad de la llamada');

  const etiqueta = doc.createElement('span');
  etiqueta.className = 'kl-profundidad-etiqueta';
  etiqueta.textContent = 'Profundidad de la llamada';

  const numero = doc.createElement('strong');
  numero.className = 'kl-profundidad-numero';

  const casillas = doc.createElement('span');
  casillas.className = 'kl-profundidad-casillas';
  casillas.setAttribute('aria-hidden', 'true');

  seccion.append(etiqueta, numero, casillas);

  let mundoActual: Mundo = 0;
  let actual: number | null = null;
  let montada = false;

  function montar(): void {
    if (!montada) {
      raiz.appendChild(seccion);
      montada = true;
    }
  }

  function desmontar(): void {
    if (montada) {
      raiz.removeChild(seccion);
      montada = false;
    }
  }

  return {
    raiz,
    fijarMundo(mundo: Mundo): void {
      mundoActual = mundo;
      if (mundo < MUNDO_MINIMO) {
        actual = null;
        desmontar();
      }
    },
    mostrar(profundidad: number): void {
      if (mundoActual < MUNDO_MINIMO) return;
      actual = profundidad;
      numero.textContent = String(profundidad);
      casillas.replaceChildren();
      const dibujadas = Math.min(profundidad, MAXIMO_CASILLAS);
      for (let i = 0; i < dibujadas; i++) {
        const casilla = doc.createElement('span');
        casilla.className = 'kl-profundidad-casilla';
        casillas.appendChild(casilla);
      }
      if (profundidad > MAXIMO_CASILLAS) casillas.append('+');
      montar();
    },
    ocultar(): void {
      actual = null;
      desmontar();
    },
    profundidad(): number | null {
      return actual;
    },
  };
}
