// Comparación de KiroLogo: la estela de referencia y la del jugador lado a lado,
// más una vista de superposición con un conmutador de dos estados. Cuando las
// estrellas niegan la precisión, invoca el diff sobre la superposición sin que el
// jugador active ningún control. Publica en la región `aria-live` el IoU y el
// exceso redondeados. No ejecuta ningún programa.

import type { Veredicto } from '../motor/validador.js';
import type { Segmento } from '../motor/segmentos.js';
import { mensajeDeDivergencia, type ResultadoParalelo } from '../motor/divergencia.js';
import type { Diff, RegionesDiff } from './diff.js';

// ============================================================================
// Vista
// ============================================================================

export type Vista = 'ladoALado' | 'superposicion';

// ============================================================================
// Dependencias inyectables
// ============================================================================

export interface DependenciasComparacion {
  readonly contenedor: HTMLElement;
  /** Diff que dibuja las tres regiones sobre la superposición. */
  readonly diff: Diff;
  /**
   * Dibuja las dos estelas alineadas en un solo lienzo (la superposición), con
   * estilo de línea distinto además del color. Lo provee `main.ts`/el lienzo.
   */
  readonly dibujarSuperposicion: (referencia: readonly Segmento[], jugador: readonly Segmento[]) => void;
  /** Publica en la región `aria-live` `polite` del juego, sin mover el foco. */
  readonly anunciar: (texto: string) => void;
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
  readonly raiz: HTMLElement;
  /** Botón conmutador de dos estados. */
  readonly conmutador: HTMLButtonElement;
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
}

// ============================================================================
// Creación
// ============================================================================

export function crearComparacion(deps: DependenciasComparacion): Comparacion {
  const doc = deps.contenedor.ownerDocument;

  const raiz = doc.createElement('div');
  raiz.className = 'kl-comparacion';

  // Rótulos en español que identifican de quién es cada figura.
  const rotuloRef = doc.createElement('p');
  rotuloRef.className = 'kl-comparacion-rotulo kl-rotulo-referencia';
  rotuloRef.textContent = 'Figura de Kiro';
  const rotuloJug = doc.createElement('p');
  rotuloJug.className = 'kl-comparacion-rotulo kl-rotulo-jugador';
  rotuloJug.textContent = 'Tu figura';

  const zonaLado = doc.createElement('div');
  zonaLado.className = 'kl-comparacion-lado';
  zonaLado.setAttribute('aria-label', 'Figuras lado a lado');
  const cajaRef = doc.createElement('div');
  cajaRef.className = 'kl-comparacion-caja';
  cajaRef.setAttribute('aria-label', 'Figura de Kiro');
  cajaRef.appendChild(rotuloRef);
  const cajaJug = doc.createElement('div');
  cajaJug.className = 'kl-comparacion-caja';
  cajaJug.setAttribute('aria-label', 'Tu figura');
  cajaJug.appendChild(rotuloJug);
  zonaLado.appendChild(cajaRef);
  zonaLado.appendChild(cajaJug);

  const zonaSuper = doc.createElement('div');
  zonaSuper.className = 'kl-comparacion-superposicion';
  zonaSuper.setAttribute('aria-label', 'Figuras superpuestas');
  zonaSuper.hidden = true;

  // Mensaje de la reproducción en paralelo, bajo el lienzo: señala el paso donde
  // los dos recorridos se separaron. Vacío mientras no haya divergencia.
  const mensajeDivergencia = doc.createElement('p');
  mensajeDivergencia.className = 'kl-comparacion-divergencia';
  mensajeDivergencia.hidden = true;

  const conmutador = doc.createElement('button');
  conmutador.type = 'button';
  conmutador.className = 'kl-comparacion-conmutador';
  conmutador.setAttribute('aria-label', 'Cambiar entre lado a lado y superposición');
  conmutador.setAttribute('aria-pressed', 'false');
  conmutador.textContent = 'Ver superpuestas';

  raiz.appendChild(conmutador);
  raiz.appendChild(zonaLado);
  raiz.appendChild(zonaSuper);
  raiz.appendChild(mensajeDivergencia);
  deps.contenedor.appendChild(raiz);

  let vista: Vista = 'ladoALado';
  let ultimos: DatosComparacion = { segmentosReferencia: [], segmentosJugador: [], veredicto: null };

  function pintarVista(): void {
    const superpuesta = vista === 'superposicion';
    zonaLado.hidden = superpuesta;
    zonaSuper.hidden = !superpuesta;
    conmutador.setAttribute('aria-pressed', superpuesta ? 'true' : 'false');
    conmutador.textContent = superpuesta ? 'Ver lado a lado' : 'Ver superpuestas';
    if (superpuesta) {
      // Dibuja las dos estelas alineadas en un solo lienzo, sin re-ejecutar.
      deps.dibujarSuperposicion(ultimos.segmentosReferencia, ultimos.segmentosJugador);
    }
  }

  function dibujarDiffSiNiega(): void {
    const v = ultimos.veredicto;
    if (v === null || v.coincide) return;
    const regiones: RegionesDiff = {
      coincidencia: v.coincidencia,
      exceso: v.exceso,
      falta: v.falta,
      traslacion: v.traslacion,
      angulo: v.angulo,
    };
    deps.diff.dibujar(regiones);
    deps.anunciar(textoAnuncio(v));
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

    textoDivergencia(): string {
      return mensajeDivergencia.hidden ? '' : (mensajeDivergencia.textContent ?? '');
    },

    vista(): Vista {
      return vista;
    },

    alternarVista,

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
        // El diff dibuja únicamente la falta si estamos en superposición.
        deps.anunciar(textoAnuncio(v));
        if (v !== null && vista === 'superposicion') {
          const regiones: RegionesDiff = {
            coincidencia: v.coincidencia,
            exceso: v.exceso,
            falta: v.falta,
            traslacion: v.traslacion,
            angulo: v.angulo,
          };
          deps.diff.dibujar(regiones);
        }
        return;
      }

      if (!v.coincide) {
        // Estrella de precisión negada: pasa a superposición, dibuja el diff y
        // muestra, bajo el lienzo, dónde se separaron los dos recorridos.
        vista = 'superposicion';
        pintarVista();
        dibujarDiffSiNiega();
        mostrarDivergencia();
      }
    },
  };
}
