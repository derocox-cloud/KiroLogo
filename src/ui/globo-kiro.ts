// Globo de diálogo de Kiro: el ÚNICO elemento del juego que presenta texto
// dirigido al jugador —comentario de resultado, escalones de pista, mensajes del
// catálogo y celebración—, atribuido a Kiro. Publica cada cambio en la región
// `aria-live` `polite`, reemplazándola por completo, sin `assertive` ni foco.
//
// El contador de escalones de pista vive en memoria (0 a 3), nunca en
// localStorage. Las pistas vienen del nivel; el globo jamás muestra el programa
// de referencia. Las dependencias del DOM y el anunciador entran por parámetro.

import type { Calificacion, EstadoEstrella, MotivoNegada } from '../juego/estrellas.js';
import type { ErrorKiroLogo } from '../lenguaje/errores.js';

// ============================================================================
// Constantes de longitud (requisitos 25.2, 25.6, 25.8)
// ============================================================================

const MAXIMO_RESULTADO = 300;
const MAXIMO_SIN_MAS_ESCALONES = 200;
const MAXIMO_NEGACION = 200;
const MAXIMO_MENSAJES = 20;
const MAXIMO_ESCALONES = 3;

// ============================================================================
// Identidad del reto (para reiniciar el contador de pistas)
// ============================================================================

export interface IdentidadReto {
  readonly idNivel: string;
  readonly semillaEfectiva: number;
  /** Las tres pistas del nivel, en orden fijo: conceptual, matemática, esqueleto. */
  readonly pistas: readonly [string, string, string];
}

// ============================================================================
// Dependencias inyectables
// ============================================================================

export interface DependenciasGlobo {
  /** Contenedor del DOM donde el globo crea sus elementos. */
  readonly contenedor: HTMLElement;
  /** Publica el texto en la región `aria-live` `polite`, sin mover el foco. */
  readonly anunciar: (texto: string) => void;
}

// ============================================================================
// Nombres de las tres estrellas
// ============================================================================

const NOMBRES_ESCALON: readonly string[] = ['conceptual', 'matemática', 'esqueleto'];

/** Nombra el estado de una estrella con texto, no con color ni icono. */
function estadoTexto(e: EstadoEstrella): string {
  return e.otorgada ? 'otorgada' : 'negada';
}

/** Compone el mensaje de negación de economía o abstracción con sus enteros. */
export function mensajeNegacion(motivo: MotivoNegada): string {
  switch (motivo.clave) {
    case 'presupuestoExcedido':
      return `Usaste ${motivo.conteo} instrucciones y el presupuesto es ${motivo.presupuesto}: recorta para ganar la economía.`;
    case 'exigenciasSinConfirmar': {
      const primera = motivo.claves[0] ?? '';
      return `Todavía falta cumplir ${motivo.claves.length} exigencia(s); empieza por ${primera}.`;
    }
    case 'excesoDeTrazo':
      return `Tu trazo sobra ${motivo.exceso.toFixed(1)} % (IoU ${motivo.iou.toFixed(2)}): quita lo que sobra.`;
    case 'sinCoincidenciaGeometrica':
      return `Tu figura no coincide todavía (IoU ${motivo.iou.toFixed(2)}).`;
    case 'sinPrecision':
      return 'La abstracción llega cuando la precisión esté lograda.';
    case 'sinVeredicto':
      return motivo.causa === 'guarda'
        ? 'No pude terminar de dibujar: revisa tu programa.'
        : 'No pude ejecutar tu programa: revisa los errores.';
  }
}

/** Recorta un texto a un máximo de caracteres sin cortar en medio de un carácter. */
function acotar(texto: string, maximo: number): string {
  return texto.length <= maximo ? texto : texto.slice(0, maximo);
}

// ============================================================================
// Interfaz pública
// ============================================================================

export interface GloboKiro {
  /** Elemento raíz del globo. */
  readonly raiz: HTMLElement;
  /** Botón único para pedir una pista. */
  readonly botonPista: HTMLButtonElement;
  /** Texto visible actual del globo. */
  texto(): string;
  /** Número de escalones de pista abiertos (0 a 3), para consulta. */
  escalonesAbiertos(): number;
  /** Comenta la calificación nombrando las tres estrellas y su estado. */
  comentarCalificacion(cal: Calificacion): void;
  /** Muestra los mensajes del catálogo con su texto exacto, hasta 20, en orden. */
  mostrarMensajes(errores: readonly ErrorKiroLogo[]): void;
  /** Muestra un texto de celebración atribuido a Kiro. */
  celebrar(texto: string): void;
  /** Pide una pista: muestra el siguiente escalón o informa que no hay más. */
  pedirPista(): void;
  /** Presenta un reto: reinicia el contador si cambió idNivel o semilla. */
  presentarReto(identidad: IdentidadReto): void;
}

// ============================================================================
// Creación
// ============================================================================

export function crearGloboKiro(deps: DependenciasGlobo): GloboKiro {
  const doc = deps.contenedor.ownerDocument;

  const raiz = doc.createElement('div');
  raiz.className = 'kl-globo';

  const emisor = doc.createElement('p');
  emisor.className = 'kl-globo-emisor';
  emisor.textContent = 'Kiro dice:';

  const cuerpo = doc.createElement('div');
  cuerpo.className = 'kl-globo-cuerpo';

  const botonPista = doc.createElement('button');
  botonPista.type = 'button';
  botonPista.className = 'kl-globo-pista';
  botonPista.textContent = 'Pedir pista';
  botonPista.setAttribute('aria-label', 'Pedir una pista a Kiro');

  raiz.appendChild(emisor);
  raiz.appendChild(cuerpo);
  raiz.appendChild(botonPista);
  deps.contenedor.appendChild(raiz);

  // --- Estado en memoria ---
  let identidad: IdentidadReto | null = null;
  let escalones = 0; // 0 a 3, escalones de pista abiertos del reto en curso

  /** Fija el contenido del globo por completo y lo publica en aria-live. */
  function fijarContenido(texto: string): void {
    cuerpo.textContent = texto;
    deps.anunciar(texto); // reemplaza por completo la región; nunca assertive
  }

  /** Fija el contenido como varias líneas (mensajes) y lo publica en aria-live. */
  function fijarLineas(lineas: readonly string[]): void {
    cuerpo.textContent = '';
    for (const linea of lineas) {
      const p = doc.createElement('p');
      p.className = 'kl-globo-mensaje';
      p.textContent = linea; // texto exacto, carácter por carácter
      cuerpo.appendChild(p);
    }
    deps.anunciar(lineas.join('\n'));
  }

  botonPista.addEventListener('click', () => pedirPista());

  function pedirPista(): void {
    if (identidad === null) return;
    if (escalones >= MAXIMO_ESCALONES) {
      // Con los tres abiertos: conserva el tercero visible, informa que no hay más.
      const aviso = acotar('Ya te di todas las pistas de este reto.', MAXIMO_SIN_MAS_ESCALONES);
      // No reemplaza el tercer escalón en el cuerpo; añade el aviso como anuncio.
      const avisoEl = doc.createElement('p');
      avisoEl.className = 'kl-globo-sin-mas';
      avisoEl.textContent = aviso;
      // Conserva el escalón visible: solo mantiene el aviso al final una sola vez.
      const previo = cuerpo.querySelector('.kl-globo-sin-mas');
      if (previo) previo.remove();
      cuerpo.appendChild(avisoEl);
      deps.anunciar(aviso);
      return;
    }
    // Muestra el escalón que sigue al último abierto.
    const indice = escalones; // 0,1,2
    const pista = identidad.pistas[indice] ?? '';
    escalones += 1; // aumenta en 1 solo al mostrar un escalón por primera vez
    fijarContenido(`Pista ${NOMBRES_ESCALON[indice]}: ${pista}`);
  }

  function pedirPistaPublica(): void {
    pedirPista();
  }

  return {
    raiz,
    botonPista,

    texto(): string {
      return cuerpo.textContent ?? '';
    },

    escalonesAbiertos(): number {
      return escalones;
    },

    comentarCalificacion(cal: Calificacion): void {
      const p = `precisión ${estadoTexto(cal.precision)}`;
      const e = `economía ${estadoTexto(cal.economia)}`;
      const a = `abstracción ${estadoTexto(cal.abstraccion)}`;
      let texto = `Resultado: ${p}, ${e}, ${a}.`;
      // Añade el motivo de la primera negación, sin superar 300 caracteres.
      const negada =
        !cal.economia.otorgada
          ? cal.economia.motivo
          : !cal.abstraccion.otorgada
            ? cal.abstraccion.motivo
            : !cal.precision.otorgada
              ? cal.precision.motivo
              : null;
      if (negada !== null) {
        const detalle = ' ' + acotar(mensajeNegacion(negada), MAXIMO_NEGACION);
        if (texto.length + detalle.length <= MAXIMO_RESULTADO) texto += detalle;
      }
      fijarContenido(acotar(texto, MAXIMO_RESULTADO));
    },

    mostrarMensajes(errores: readonly ErrorKiroLogo[]): void {
      const lineas = errores.slice(0, MAXIMO_MENSAJES).map((e) => e.mensaje);
      fijarLineas(lineas);
    },

    celebrar(texto: string): void {
      fijarContenido(texto);
    },

    pedirPista: pedirPistaPublica,

    presentarReto(nueva: IdentidadReto): void {
      const cambio =
        identidad === null ||
        identidad.idNivel !== nueva.idNivel ||
        identidad.semillaEfectiva !== nueva.semillaEfectiva;
      identidad = nueva;
      if (cambio) {
        // Vuelve el contador a 0, deja el conceptual como el siguiente, vacía pista.
        escalones = 0;
        cuerpo.textContent = '';
      }
    },
  };
}
