// Comparación de KiroLogo: tu figura contra la de Kiro, en un solo lienzo.
//
// La vista «lado a lado» es la propia pantalla: la figura de Kiro y la tuya, cada una en su
// lienzo y con su rótulo. Este módulo añade la otra vista, la superposición, con un botón
// conmutador de dos estados y una leyenda de lo que significa cada trazo. Cuando las
// estrellas niegan la precisión, pasa solo a la superposición y pinta el diff, sin que el
// jugador active ningún control. Publica en la región `aria-live` el IoU y el exceso
// redondeados. No ejecuta ningún programa.
//
// No crea ningún lienzo ni decide dónde va cada pieza: el botón y la leyenda se cuelgan de
// los contenedores que reciba (`main.ts` los coloca donde la pantalla los quiere).

import type { Veredicto } from '../motor/validador.js';
import type { Segmento } from '../motor/segmentos.js';
import { NOMBRE_ESTADO, type Diff, type EstadoDiff } from './diff.js';
import { mensajeDeDivergencia, type ResultadoParalelo } from '../motor/divergencia.js';

// ============================================================================
// Vista
// ============================================================================

export type Vista = 'ladoALado' | 'superposicion';

/** Texto del conmutador. Es siempre el mismo: el estado lo dice `aria-pressed`. */
export const TEXTO_CONMUTADOR = 'Comparar con Kiro';

// ============================================================================
// Dependencias inyectables
// ============================================================================

export interface DependenciasComparacion {
  /** Donde se cuelga el botón conmutador. */
  readonly contenedor: HTMLElement;
  /** Donde se cuelga la leyenda; por omisión, el mismo contenedor del botón. */
  readonly contenedorLeyenda?: HTMLElement;
  /** Diff que dibuja las tres regiones sobre la superposición. */
  readonly diff: Diff;
  /**
   * Dibuja las dos estelas alineadas en un solo lienzo (la superposición), con
   * estilo de línea distinto además del color. Lo provee `main.ts`/el lienzo.
   */
  readonly dibujarSuperposicion: (referencia: readonly Segmento[], jugador: readonly Segmento[]) => void;
  /** Publica en la región `aria-live` `polite` del juego, sin mover el foco. */
  readonly anunciar: (texto: string) => void;
  /**
   * Avisa cada vez que se pinta una vista, para que quien tiene el lienzo de la
   * superposición lo muestre u oculte. Opcional: sin él, la vista solo cambia el
   * estado del conmutador y de la leyenda.
   */
  readonly alCambiarVista?: (vista: Vista) => void;
}

// ============================================================================
// Datos de una comparación
// ============================================================================

export interface DatosComparacion {
  readonly segmentosReferencia: readonly Segmento[];
  readonly segmentosJugador: readonly Segmento[];
  /** Veredicto del validador; null si el jugador no ha ejecutado nada. */
  readonly veredicto: Veredicto | null;
  /**
   * Resultado de la reproducción en paralelo. Solo se usa cuando la precisión se
   * niega: señala el primer paso donde los dos recorridos se separaron. Null
   * cuando no hay comparación en el tiempo que mostrar.
   */
  readonly divergencia?: ResultadoParalelo | null;
}

// ============================================================================
// Texto del anuncio (requisitos 23.7, 23.8)
// ============================================================================

/** Compone el anuncio del diff con el IoU y el exceso redondeados. */
export function textoAnuncio(veredicto: Veredicto | null): string {
  if (veredicto === null || veredicto.motivo === 'sinEstelaDelJugador') {
    return 'Todavía no hay estela tuya que comparar. Ejecuta tu programa para ver la comparación.';
  }
  const iou = veredicto.iou.toFixed(2);
  const exceso = veredicto.excesoPorcentaje.toFixed(1);
  const haySobrante = tieneAlgo(veredicto.exceso);
  const hayFaltante = tieneAlgo(veredicto.falta);
  const sobrante = haySobrante ? 'hay trazo que sobra' : 'no hay trazo que sobra';
  const faltante = hayFaltante ? 'hay trazo que falta' : 'no hay trazo que falta';
  return `Coincidencia (IoU) de ${iou}; exceso de trazo del ${exceso} %. Además, ${sobrante} y ${faltante}.`;
}

function tieneAlgo(m: Uint8Array): boolean {
  for (let i = 0; i < m.length; i++) if (m[i] === 1) return true;
  return false;
}

// ============================================================================
// Interfaz pública
// ============================================================================

export interface Comparacion {
  /** Contiene el botón conmutador. */
  readonly raiz: HTMLElement;
  /** Botón conmutador de dos estados. */
  readonly conmutador: HTMLButtonElement;
  /** Leyenda de las tres regiones del diff; solo se ve en la superposición. */
  readonly leyenda: HTMLElement;
  /** Texto visible del mensaje de divergencia bajo el lienzo (vacío si no hay). */
  textoDivergencia(): string;
  /** Vista en curso. */
  vista(): Vista;
  /** Cambia de vista (lado a lado ↔ superposición). */
  alternarVista(): void;
  /**
   * Presenta una comparación: guarda las dos estelas y, si las estrellas niegan
   * la precisión, pasa a superposición y dibuja el diff sin que el jugador actúe.
   */
  mostrar(datos: DatosComparacion): void;
  /** Vuelve a lado a lado y olvida la comparación anterior (intento nuevo o nivel nuevo). */
  restablecer(): void;
  /** Vuelve a pintar la vista actual, p. ej. tras cambiar el tamaño del lienzo. */
  redibujar(): void;
}

/** Orden de la leyenda: primero lo que está bien, luego lo que hay que corregir. */
const ESTADOS_LEYENDA: readonly EstadoDiff[] = ['coincidencia', 'exceso', 'falta'];

// ============================================================================
// Creación
// ============================================================================

export function crearComparacion(deps: DependenciasComparacion): Comparacion {
  const doc = deps.contenedor.ownerDocument;

  const raiz = doc.createElement('div');
  raiz.className = 'kl-comparacion';

  // Mensaje de la reproducción en paralelo, bajo el lienzo: señala el paso donde
  // los dos recorridos se separaron. Vacío mientras no haya divergencia. El resto
  // del layout (lado a lado, superposición) lo coloca la pantalla vía ranuras.
  const mensajeDivergencia = doc.createElement('p');
  mensajeDivergencia.className = 'kl-comparacion-divergencia';
  mensajeDivergencia.hidden = true;

  const conmutador = doc.createElement('button');
  conmutador.type = 'button';
  conmutador.className = 'kl-comparacion-conmutador';
  conmutador.setAttribute('aria-pressed', 'false');
  conmutador.title = 'Pone tu figura y la de Kiro en un solo lienzo y marca lo que coincide, lo que sobra y lo que falta';
  conmutador.textContent = TEXTO_CONMUTADOR;
  raiz.appendChild(conmutador);
  raiz.appendChild(mensajeDivergencia);
  deps.contenedor.appendChild(raiz);

  // Leyenda de las tres regiones del diff. Cada una se nombra por lo que significa
  // y la muestra lleva su patrón de trazo (continuo, grueso, punteado) además del
  // color, igual que el diff del lienzo.
  const leyenda = doc.createElement('ul');
  leyenda.className = 'kl-leyenda';
  leyenda.setAttribute('aria-label', 'Qué significa cada trazo');
  leyenda.hidden = true;
  for (const estado of ESTADOS_LEYENDA) {
    const item = doc.createElement('li');
    item.className = `kl-leyenda-item kl-leyenda-${estado}`;
    const muestra = doc.createElement('span');
    muestra.className = 'kl-leyenda-muestra';
    muestra.setAttribute('aria-hidden', 'true');
    item.appendChild(muestra);
    item.appendChild(doc.createTextNode(NOMBRE_ESTADO[estado]));
    leyenda.appendChild(item);
  }
  (deps.contenedorLeyenda ?? deps.contenedor).appendChild(leyenda);

  let vista: Vista = 'ladoALado';
  let ultimos: DatosComparacion = { segmentosReferencia: [], segmentosJugador: [], veredicto: null };

  /** Pinta el diff de la comparación guardada sobre la superposición, sin anunciar. */
  function pintarDiff(v: Veredicto): void {
    deps.diff.dibujar(
      {
        coincidencia: v.coincidencia,
        exceso: v.exceso,
        falta: v.falta,
        excesoVisual: v.excesoVisual,
        traslacion: v.traslacion,
        traslacionObjetivo: v.traslacionObjetivo,
        angulo: v.angulo,
      },
      { referencia: ultimos.segmentosReferencia, jugador: ultimos.segmentosJugador },
    );
  }

  /**
   * Pinta la vista en curso. En la superposición dibuja las dos estelas y, si la última
   * ejecución no ganó la precisión, el diff encima: así sigue en pantalla aunque el
   * jugador cambie de vista y vuelva (requisito 23.10).
   */
  function pintarVista(): void {
    const superpuesta = vista === 'superposicion';
    leyenda.hidden = !superpuesta;
    conmutador.setAttribute('aria-pressed', superpuesta ? 'true' : 'false');
    if (superpuesta) {
      // Dibuja las dos estelas alineadas en un solo lienzo, sin re-ejecutar.
      deps.dibujarSuperposicion(ultimos.segmentosReferencia, ultimos.segmentosJugador);
      const v = ultimos.veredicto;
      if (v !== null && !v.coincide) pintarDiff(v);
    }
    deps.alCambiarVista?.(vista);
  }

  /**
   * Muestra, bajo el lienzo, el mensaje de la reproducción en paralelo: dónde se
   * separaron los dos recorridos. Lo oculta si no hay divergencia que señalar.
   * El texto sale del catálogo central de errores vía `mensajeDeDivergencia`.
   */
  function mostrarDivergencia(): void {
    const resultado = ultimos.divergencia ?? null;
    const mensaje = resultado === null ? null : mensajeDeDivergencia(resultado);
    if (mensaje === null) {
      mensajeDivergencia.hidden = true;
      mensajeDivergencia.textContent = '';
      return;
    }
    mensajeDivergencia.textContent = mensaje.mensaje;
    mensajeDivergencia.hidden = false;
  }

  conmutador.addEventListener('click', () => alternarVista());

  function alternarVista(): void {
    vista = vista === 'ladoALado' ? 'superposicion' : 'ladoALado';
    pintarVista();
  }

  pintarVista();

  return {
    raiz,
    conmutador,
    leyenda,

    textoDivergencia(): string {
      return mensajeDivergencia.hidden ? '' : (mensajeDivergencia.textContent ?? '');
    },

    vista(): Vista {
      return vista;
    },

    alternarVista,

    restablecer(): void {
      ultimos = { segmentosReferencia: [], segmentosJugador: [], veredicto: null };
      vista = 'ladoALado';
      pintarVista();
    },

    redibujar(): void {
      pintarVista();
    },

    mostrar(datos: DatosComparacion): void {
      ultimos = datos;
      const v = datos.veredicto;

      // La divergencia se muestra solo cuando la precisión se niega; en los demás
      // casos se oculta (coincide, sin estela, o no se pasó resultado paralelo).
      if (v === null || v.coincide) {
        mostrarDivergencia();
      }

      if (v === null || v.motivo === 'sinEstelaDelJugador') {
        // Sin estela del jugador: lienzo del jugador con cuadrícula y sin estela.
        // El conmutador sigue operable. Anuncia que no hay estela que comparar.
        // Si ya estamos en superposición, el diff dibuja únicamente la falta.
        deps.anunciar(textoAnuncio(v));
        if (v !== null && vista === 'superposicion') pintarVista();
        return;
      }

      if (!v.coincide) {
        // Estrella de precisión negada: pasa a superposición, dibuja el diff y
        // muestra, bajo el lienzo, dónde se separaron los dos recorridos.
        vista = 'superposicion';
        pintarVista();
        mostrarDivergencia();
        deps.anunciar(textoAnuncio(v));
      } else if (vista === 'superposicion') {
        // Precisión otorgada con la superposición abierta: que no se quede con lo anterior.
        pintarVista();
      }
    },
  };
}
