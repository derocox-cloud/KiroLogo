// Control mínimo del desafío infinito de KiroLogo (spec 04, requisito 12).
//
// Un único botón nativo que, según el estado, inicia el desafío del mundo del nivel en
// curso o ofrece el siguiente reto. Muestra la semilla raíz en formato compartible
// mientras el desafío está en curso. No ofrece ningún control de retroceso: la interfaz
// solo tiene `iniciar` y `siguiente` (R12.5). No guarda puntuación, tabla ni historial.
//
// Como `panel-semilla.ts`, no conoce el reto ni el progreso: pide a `main.ts` por
// callbacks y presenta el estado que `main.ts` le da.

export interface CallbacksControlDesafio {
  /** Pide a `main.ts` iniciar el desafío infinito del mundo en curso. */
  readonly iniciar: () => void;
  /** Pide a `main.ts` cargar el siguiente reto de la secuencia. */
  readonly siguiente: () => void;
}

export interface DependenciasControlDesafio {
  readonly contenedor: HTMLElement;
  readonly callbacks: CallbacksControlDesafio;
}

export type EstadoControlDesafio =
  | { readonly fase: 'oculto' }
  | { readonly fase: 'disponible'; readonly mundo: number }
  | {
      readonly fase: 'enCurso';
      readonly mundo: number;
      /** Código compartible de la raíz, o null si `codificar` falló (se omite). */
      readonly codigoRaiz: string | null;
      /** true cuando el reto en curso está aprobado y se puede pasar al siguiente. */
      readonly puedeAvanzar: boolean;
    };

export interface ControlDesafio {
  readonly raiz: HTMLElement;
  readonly boton: HTMLButtonElement;
  /** Oculta el control o lo muestra como «Desafío infinito» / «Siguiente reto». */
  presentar(estado: EstadoControlDesafio): void;
}

const TEXTO_INICIAR = 'Desafío infinito';
const TEXTO_SIGUIENTE = 'Siguiente reto';
const ETIQUETA_INICIAR_GENERICA = 'Iniciar el desafío infinito';
const ETIQUETA_SIGUIENTE = 'Ir al siguiente reto del desafío infinito';
const ETIQUETA_GRUPO = 'Desafío infinito';
const ETIQUETA_CODIGO = 'Código del desafío';
const NOTA_APROBAR = 'Aprueba este reto para abrir el siguiente.';

/**
 * Crea el control sobre un contenedor. Es un `<button>` nativo (Enter y Espacio lo
 * activan, `Tab` lo alcanza); el estado deshabilitado se comunica con `disabled`,
 * `aria-disabled` y una nota de texto, nunca solo con color.
 */
export function crearControlDesafio(deps: DependenciasControlDesafio): ControlDesafio {
  const doc = deps.contenedor.ownerDocument;
  const cb = deps.callbacks;

  const raiz = doc.createElement('div');
  raiz.className = 'kl-control-desafio';
  raiz.setAttribute('role', 'group');
  raiz.setAttribute('aria-label', ETIQUETA_GRUPO);
  raiz.hidden = true;

  const boton = doc.createElement('button');
  boton.type = 'button';
  boton.className = 'kl-control-desafio-boton';
  // Aun oculto, el botón nunca queda sin nombre: nace con el texto de «iniciar».
  boton.textContent = TEXTO_INICIAR;
  boton.setAttribute('aria-label', ETIQUETA_INICIAR_GENERICA);
  raiz.appendChild(boton);

  const fila = doc.createElement('p');
  fila.className = 'kl-control-desafio-codigo';
  raiz.appendChild(fila);

  const nota = doc.createElement('p');
  nota.className = 'kl-control-desafio-nota';
  raiz.appendChild(nota);

  let fase: EstadoControlDesafio['fase'] = 'oculto';

  boton.addEventListener('click', () => {
    if (boton.disabled) return;
    if (fase === 'disponible') cb.iniciar();
    else if (fase === 'enCurso') cb.siguiente();
  });

  deps.contenedor.appendChild(raiz);

  function fijarHabilitado(habilitado: boolean): void {
    boton.disabled = !habilitado;
    boton.classList.toggle('kl-deshabilitada', !habilitado);
    boton.setAttribute('aria-disabled', habilitado ? 'false' : 'true');
  }

  function presentar(estado: EstadoControlDesafio): void {
    fase = estado.fase;
    fila.replaceChildren();
    nota.textContent = '';

    if (estado.fase === 'oculto') {
      raiz.hidden = true;
      boton.textContent = TEXTO_INICIAR;
      boton.setAttribute('aria-label', ETIQUETA_INICIAR_GENERICA);
      return;
    }
    raiz.hidden = false;

    if (estado.fase === 'disponible') {
      boton.textContent = TEXTO_INICIAR;
      boton.setAttribute('aria-label', `Iniciar el desafío infinito del mundo ${estado.mundo}`);
      fijarHabilitado(true);
      return;
    }

    boton.textContent = TEXTO_SIGUIENTE;
    boton.setAttribute('aria-label', ETIQUETA_SIGUIENTE);
    fijarHabilitado(estado.puedeAvanzar);
    if (estado.codigoRaiz !== null) {
      const etiqueta = doc.createElement('span');
      etiqueta.className = 'kl-control-desafio-etiqueta';
      etiqueta.textContent = `${ETIQUETA_CODIGO}: `;
      const salida = doc.createElement('output');
      salida.className = 'kl-control-desafio-valor';
      salida.textContent = estado.codigoRaiz;
      // Seleccionable con teclado para copiarlo y compartirlo.
      salida.tabIndex = 0;
      fila.append(etiqueta, salida);
    }
    if (!estado.puedeAvanzar) nota.textContent = NOTA_APROBAR;
  }

  return { raiz, boton, presentar };
}
