// Modelo puro de la tortuga de KiroLogo
// Sin Canvas, sin DOM, sin importaciones del lienzo, los personajes ni el animador.
// El intérprete es el único módulo que invoca estas transformaciones; el
// renderizador consume operaciones y toma el estado de cada una.

// ============================================================================
// Tipos
// ============================================================================

export interface Punto {
  readonly x: number;
  readonly y: number;
}

export interface EstadoTortuga {
  readonly posicion: Punto;
  readonly rumbo: number;        // grados, en [0, 360)
  readonly lapizAbajo: boolean;
  readonly visible: boolean;
}

export type SentidoDesplazamiento = 'adelante' | 'atras';
export type SentidoGiro = 'derecha' | 'izquierda';

/**
 * Resultado de una transformación con argumento numérico. Cuando el argumento no
 * es finito, `valido` es false y se identifica la transformación y el valor.
 */
export type ResultadoTortuga =
  | { readonly valido: true; readonly estado: EstadoTortuga }
  | { readonly valido: false; readonly transformacion: string; readonly valorRecibido: number };

// ============================================================================
// Estado inicial
// ============================================================================

/** Estado inicial: centro del lienzo, rumbo 0 (arriba), lápiz abajo, visible. */
export const ESTADO_INICIAL: EstadoTortuga = {
  posicion: { x: 0, y: 0 },
  rumbo: 0,
  lapizAbajo: true,
  visible: true,
};

// ============================================================================
// Constantes internas
// ============================================================================

/** Tolerancia para reducir el rumbo a [0, 360). */
const TOLERANCIA_RUMBO = 1e-6;

/** Grados de una vuelta completa. */
const VUELTA = 360;

/** Conversión de grados a radianes, confinada dentro de este módulo. */
function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

// ============================================================================
// Normalización del rumbo
// ============================================================================

/**
 * Reduce un rumbo en grados al intervalo [0, 360) con tolerancia de 1e−6, de
 * modo que 360 y sus múltiplos den 0 y un rumbo negativo dé su equivalente.
 *
 * @param grados Rumbo en grados, cualquiera sea su magnitud o signo
 * @returns Rumbo equivalente en [0, 360)
 */
export function normalizarRumbo(grados: number): number {
  // Reducir al rango con el módulo, corrigiendo el signo negativo de `%`.
  let reducido = grados % VUELTA;
  if (reducido < 0) {
    reducido += VUELTA;
  }
  // Un valor a menos de la tolerancia de 360 (o de 0) se registra como 0.
  if (reducido >= VUELTA - TOLERANCIA_RUMBO || reducido < TOLERANCIA_RUMBO) {
    return 0;
  }
  return reducido;
}

// ============================================================================
// Transformaciones con argumento numérico
// ============================================================================

/**
 * Desplaza la tortuga `distancia` unidades en la dirección de su rumbo (o en la
 * opuesta si el sentido es 'atras'). No recorta al lienzo ni reporta error por
 * salir de él. Devuelve un estado nuevo y deja el recibido intacto.
 *
 * Geometría: Δx = sen(rad)·d, Δy = cos(rad)·d, con rumbo 0 hacia +y.
 */
export function desplazar(
  estado: EstadoTortuga,
  distancia: number,
  sentido: SentidoDesplazamiento,
): ResultadoTortuga {
  if (!Number.isFinite(distancia)) {
    return { valido: false, transformacion: 'desplazar', valorRecibido: distancia };
  }

  const signo = sentido === 'adelante' ? 1 : -1;
  const rad = aRadianes(estado.rumbo);
  const d = distancia * signo;

  const nuevaPosicion: Punto = {
    x: estado.posicion.x + Math.sin(rad) * d,
    y: estado.posicion.y + Math.cos(rad) * d,
  };

  return {
    valido: true,
    estado: {
      posicion: nuevaPosicion,
      rumbo: estado.rumbo,
      lapizAbajo: estado.lapizAbajo,
      visible: estado.visible,
    },
  };
}

/**
 * Gira la tortuga `grados` grados a la derecha o a la izquierda, reduciendo el
 * rumbo resultante a [0, 360). Conserva posición, lápiz y visibilidad.
 *
 * @param estado Estado de partida
 * @param grados Ángulo del giro (magnitud)
 * @param sentido 'derecha' suma al rumbo, 'izquierda' resta
 */
export function girar(
  estado: EstadoTortuga,
  grados: number,
  sentido: SentidoGiro,
): ResultadoTortuga {
  if (!Number.isFinite(grados)) {
    return { valido: false, transformacion: 'girar', valorRecibido: grados };
  }

  const delta = sentido === 'derecha' ? grados : -grados;
  const nuevoRumbo = normalizarRumbo(estado.rumbo + delta);

  return {
    valido: true,
    estado: {
      posicion: { x: estado.posicion.x, y: estado.posicion.y },
      rumbo: nuevoRumbo,
      lapizAbajo: estado.lapizAbajo,
      visible: estado.visible,
    },
  };
}

// ============================================================================
// Transformaciones sin argumento numérico
// ============================================================================

/**
 * Devuelve la tortuga al centro con rumbo 0, conservando el lápiz y la
 * visibilidad recibidos. Devuelve un estado nuevo y deja el recibido intacto.
 */
export function alCentro(estado: EstadoTortuga): EstadoTortuga {
  return {
    posicion: { x: 0, y: 0 },
    rumbo: 0,
    lapizAbajo: estado.lapizAbajo,
    visible: estado.visible,
  };
}

/**
 * Cambia el estado del lápiz. Devuelve un estado nuevo y deja el recibido
 * intacto, incluso cuando el valor coincide con el actual.
 */
export function conLapiz(estado: EstadoTortuga, abajo: boolean): EstadoTortuga {
  return {
    posicion: { x: estado.posicion.x, y: estado.posicion.y },
    rumbo: estado.rumbo,
    lapizAbajo: abajo,
    visible: estado.visible,
  };
}

/**
 * Cambia la visibilidad. Devuelve un estado nuevo y deja el recibido intacto,
 * incluso cuando el valor coincide con el actual.
 */
export function conVisibilidad(estado: EstadoTortuga, visible: boolean): EstadoTortuga {
  return {
    posicion: { x: estado.posicion.x, y: estado.posicion.y },
    rumbo: estado.rumbo,
    lapizAbajo: estado.lapizAbajo,
    visible,
  };
}
