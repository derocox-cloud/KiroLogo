import type { Mundo } from '../lenguaje/vocabulario.js';

export interface DependenciasConsola {
  readonly contenedor: HTMLElement;
}

export interface Consola {
  /** Ranura persistente; queda vacía (sin rol ni tamaño) antes del mundo 4. */
  readonly raiz: HTMLElement;
  fijarMundo(mundo: Mundo): void;
  agregar(texto: string): void;
  vaciar(): void;
  lineas(): readonly string[];
  plegada(): boolean;
  resumen(): { readonly cantidad: number; readonly ultima: string | null };
}

const MUNDO_MINIMO = 4;
// Tope para que un REPITE con ESCRIBE no llene el DOM; se descartan las más viejas.
const MAXIMO_LINEAS = 500;

const ETIQUETA_MOSTRAR = 'Mostrar la consola';
const ETIQUETA_OCULTAR = 'Ocultar la consola';

export function crearConsola(deps: DependenciasConsola): Consola {
  const doc = deps.contenedor.ownerDocument;

  const raiz = doc.createElement('div');
  raiz.className = 'kl-consola-ranura';
  deps.contenedor.appendChild(raiz);

  const seccion = doc.createElement('section');
  seccion.className = 'kl-consola';
  seccion.setAttribute('aria-labelledby', 'kl-consola-titulo');

  const cabecera = doc.createElement('div');
  cabecera.className = 'kl-consola-cabecera';

  const titulo = doc.createElement('h3');
  titulo.id = 'kl-consola-titulo';
  titulo.textContent = 'Consola';

  const boton = doc.createElement('button');
  boton.type = 'button';
  boton.setAttribute('aria-controls', 'kl-consola-registro');

  cabecera.append(titulo, boton);

  const registro = doc.createElement('div');
  registro.id = 'kl-consola-registro';
  registro.className = 'kl-consola-registro';
  registro.setAttribute('role', 'log');
  registro.setAttribute('aria-label', 'Consola');
  // role="log" implica polite; el resumen único va por #anuncios.
  registro.setAttribute('aria-live', 'off');
  registro.tabIndex = 0;

  seccion.append(cabecera, registro);

  const textos: string[] = [];
  let estaPlegada = true;
  let montada = false;

  function pintarPliegue(): void {
    registro.hidden = estaPlegada;
    boton.setAttribute('aria-expanded', estaPlegada ? 'false' : 'true');
    boton.textContent = estaPlegada ? ETIQUETA_MOSTRAR : ETIQUETA_OCULTAR;
  }

  function nuevaLinea(texto: string): HTMLParagraphElement {
    const p = doc.createElement('p');
    p.className = 'kl-consola-linea';
    p.textContent = texto;
    return p;
  }

  boton.addEventListener('click', () => {
    estaPlegada = !estaPlegada;
    pintarPliegue();
    if (!estaPlegada) registro.scrollTop = registro.scrollHeight;
  });

  pintarPliegue();

  return {
    raiz,
    fijarMundo(mundo: Mundo): void {
      const debeMontarse = mundo >= MUNDO_MINIMO;
      if (debeMontarse && !montada) {
        raiz.appendChild(seccion);
        montada = true;
      } else if (!debeMontarse && montada) {
        raiz.removeChild(seccion);
        montada = false;
      }
    },
    agregar(texto: string): void {
      textos.push(texto);
      registro.appendChild(nuevaLinea(texto));
      while (textos.length > MAXIMO_LINEAS) {
        textos.shift();
        registro.firstElementChild?.remove();
      }
      estaPlegada = false;
      pintarPliegue();
      registro.scrollTop = registro.scrollHeight;
    },
    vaciar(): void {
      textos.length = 0;
      registro.replaceChildren();
      estaPlegada = true;
      pintarPliegue();
    },
    lineas(): readonly string[] {
      return [...textos];
    },
    plegada(): boolean {
      return estaPlegada;
    },
    resumen() {
      return {
        cantidad: textos.length,
        ultima: textos.length > 0 ? textos[textos.length - 1]! : null,
      };
    },
  };
}
