// Animador de KiroLogo: consume una secuencia de `Operacion` y la reproduce en el
// tiempo sobre una capa de estela del lienzo.
//
// El reloj entra como parámetro: con un reloj falso, las cuatro velocidades, el
// paso a paso y el fin de secuencia se prueban en Node sin `requestAnimationFrame`.
// El animador no vuelve a analizar el texto, no lee el editor y no invoca ninguna
// transformación de la tortuga: toma posición, rumbo, lápiz y visibilidad de los
// campos `estadoAntes` y `estadoDespues` de cada operación.

import type { Operacion } from '../lenguaje/interprete.js';
import type { EstadoTortuga } from './tortuga.js';
import {
  SIN_ESTILO,
  avanzarEstilo,
  tramoConEstilo,
  tramoDeMover,
  type EstiloPedido,
  type TramoDibujo,
} from './tramos-dibujo.js';
import type { CapaEstela } from './lienzo.js';

// ============================================================================
// Reloj inyectable
// ============================================================================

/**
 * Reloj de animación. En producción envuelve `requestAnimationFrame` y
 * `performance.now`; en pruebas se inyecta un reloj falso con tiempo controlado.
 */
export interface Reloj {
  /** Programa una llamada para el próximo fotograma; devuelve un identificador. */
  programar(callback: (ahora: number) => void): number;
  /** Cancela una llamada programada. */
  cancelar(id: number): void;
  /** Tiempo actual, en milisegundos. */
  ahora(): number;
}

// ============================================================================
// Velocidades
// ============================================================================

export type Velocidad = 'lenta' | 'normal' | 'rapida' | 'inmediata';

/** Duración objetivo por operación, en milisegundos, por velocidad. */
export const DURACIONES: Readonly<Record<Velocidad, number>> = {
  lenta: 1000,
  normal: 400,
  rapida: 120,
  inmediata: 0,
};

// ============================================================================
// Fin de secuencia
// ============================================================================

export interface FinDeSecuencia {
  readonly motivo: 'finDeSecuencia' | 'detenidoPorJugador' | 'guarda';
  readonly operacionesAplicadas: number;
  readonly estadoFinal: EstadoTortuga;
}

// ============================================================================
// Fotogramas: lo que se ve en un instante de la animación
// ============================================================================

/**
 * Lo que hay que pintar en un instante: la tortuga en su posición y rumbo
 * interpolados y, si la operación en curso es un `mover` con el lápiz abajo, el
 * tramo recorrido hasta ahora. El tramo es provisional: no entra en la estela del
 * lienzo hasta que la operación termina (así la geometría de la estela final sigue
 * siendo exactamente la de `extraerSegmentos`), y quien pinta lo dibuja en la capa
 * de personajes, que se borra en cada fotograma. Lleva el color y el grosor vigentes.
 */
export interface Fotograma {
  readonly estado: EstadoTortuga;
  readonly tramo: TramoDibujo | null;
}

// ============================================================================
// Interfaz mínima del lienzo que el animador gobierna
// ============================================================================

/**
 * Subconjunto del `Lienzo` que el animador necesita: crecer y limpiar la estela de
 * una capa. Es estructuralmente compatible con `Lienzo` de `lienzo.ts`, así que el
 * lienzo real se pasa tal cual; en pruebas se pasa un doble.
 */
export interface LienzoAnimador {
  crecerEstela(capa: CapaEstela, segmentos: readonly TramoDibujo[]): void;
  limpiarEstela(capa: CapaEstela): void;
}

// ============================================================================
// Animador
// ============================================================================

export interface Animador {
  /** Carga una secuencia de operaciones y la capa de destino de su estela. */
  cargar(operaciones: readonly Operacion[], destino: CapaEstela): void;
  /** Reproduce de forma continua desde la siguiente operación pendiente. */
  reproducir(): void;
  /** Detiene la reproducción continua, terminando el tramo en curso. */
  detener(): void;
  /** Aplica exactamente la siguiente operación pendiente; entra en paso a paso. */
  paso(): FinDeSecuencia | null;
  /** Cambia la velocidad; se aplica a partir de la siguiente operación pendiente. */
  ponerVelocidad(v: Velocidad): void;
  /** Detiene, sale del paso a paso, pone el contador en cero y limpia la estela. */
  reiniciar(estadoInicial: EstadoTortuga): void;
  /** Registra un escucha del fin de secuencia. */
  alTerminar(escucha: (fin: FinDeSecuencia) => void): void;
  /** Registra un escucha que recibe cada operación aplicada. */
  alAplicar(escucha: (op: Operacion) => void): void;
  /**
   * Registra un escucha que recibe cada fotograma a pintar: los intermedios de
   * una operación en curso y el final de cada operación aplicada. Sin escucha, el
   * animador solo hace crecer la estela, como antes.
   */
  alFotograma(escucha: (fotograma: Fotograma) => void): void;
}

/** Suaviza el arranque y la llegada sin salirse de [0, 1] ni dejar de crecer. */
function suavizar(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Fotograma de una operación a una fracción `t` de su duración. Solo `mover` y
 * `girar` tienen estados intermedios; el resto salta directo a su estado final.
 * Usa los campos de la propia operación, sin invocar ninguna transformación de la
 * tortuga: el giro avanza en el sentido que pidió el jugador, no por el camino
 * más corto, para que un `GIRADERECHA 270` se vea como tres cuartos de vuelta.
 */
function fotogramaIntermedio(op: Operacion, t: number, estilo: EstiloPedido): Fotograma {
  const e = suavizar(Math.min(1, Math.max(0, t)));
  switch (op.tipo) {
    case 'mover': {
      const posicion = {
        x: op.desde.x + (op.hasta.x - op.desde.x) * e,
        y: op.desde.y + (op.hasta.y - op.desde.y) * e,
      };
      const estado: EstadoTortuga = { ...op.estadoAntes, posicion };
      const largo = Math.hypot(posicion.x - op.desde.x, posicion.y - op.desde.y);
      // El tramo a medio dibujar lleva el mismo color y grosor que tendrá al terminar.
      const tramo =
        op.lapizAbajo && largo >= 0.0001 ? tramoConEstilo(op.desde, posicion, op.paso, op.linea, estilo) : null;
      return { estado, tramo };
    }
    case 'girar': {
      const signo = op.sentido === 'derecha' ? 1 : -1;
      return {
        estado: { ...op.estadoAntes, rumbo: op.estadoAntes.rumbo + signo * op.grados * e },
        tramo: null,
      };
    }
    default:
      return { estado: op.estadoAntes, tramo: null };
  }
}

/**
 * Crea un animador sobre un lienzo, un reloj inyectable y una consulta de la
 * preferencia de movimiento reducido, que se lee al empezar cada reproducción.
 *
 * @param lienzo Lienzo (o doble) cuyas estelas gobierna el animador
 * @param reloj Reloj de animación inyectable
 * @param movimientoReducido Consulta `prefers-reduced-motion`; se lee por reproducción
 */
export function crearAnimador(
  lienzo: LienzoAnimador,
  reloj: Reloj,
  movimientoReducido: () => boolean,
): Animador {
  // --- Estado del animador ---
  let operaciones: readonly Operacion[] = [];
  let destino: CapaEstela = 'jugador';
  let indice = 0;                 // próxima operación pendiente (orden de paso)
  let velocidad: Velocidad = 'normal';
  let estadoActual: EstadoTortuga | null = null;
  let estadoInicial: EstadoTortuga | null = null;
  // Color y grosor vigentes según las operaciones ya aplicadas (PONCOLOR, PONGROSOR).
  // Arranca en el del tema en cada carga y cada reinicio.
  let estilo: EstiloPedido = SIN_ESTILO;

  // Reproducción continua en curso.
  let idProgramado: number | null = null;
  let inicioOperacion = 0;        // marca de tiempo del inicio de la operación en curso

  const escuchasFin: Array<(fin: FinDeSecuencia) => void> = [];
  const escuchasAplicar: Array<(op: Operacion) => void> = [];
  const escuchasFotograma: Array<(f: Fotograma) => void> = [];

  function emitirAplicar(op: Operacion): void {
    for (const e of escuchasAplicar) e(op);
  }

  function emitirFotograma(f: Fotograma): void {
    for (const e of escuchasFotograma) e(f);
  }

  function emitirFin(fin: FinDeSecuencia): void {
    for (const e of escuchasFin) e(fin);
  }

  function operacionesAplicadas(): number {
    return indice;
  }

  function estadoFinalActual(): EstadoTortuga {
    // Estado tras la última operación aplicada, o el inicial si no hay ninguna.
    if (estadoActual) return estadoActual;
    if (estadoInicial) return estadoInicial;
    // Si nunca se cargó estado, tomamos el estadoAntes de la primera operación.
    const primera = operaciones[0];
    return primera ? primera.estadoAntes : DEFECTO_ESTADO;
  }

  /**
   * Aplica por completo el efecto de una operación sobre la estela y el estado
   * dibujado. No interpola: deja la estela y el estado en su valor final. Se usa
   * en el paso a paso, el modo inmediato y el reducido.
   */
  function aplicarCompleta(op: Operacion, pintarFotograma = true): void {
    switch (op.tipo) {
      case 'mover': {
        const tramo = tramoDeMover(op, estilo);
        if (tramo) lienzo.crecerEstela(destino, [tramo]);
        break;
      }
      case 'limpiar':
        // Borra la capa de destino: descarta la estela acumulada.
        lienzo.limpiarEstela(destino);
        break;
      case 'girar':
      case 'reubicar':
      case 'lapiz':
      case 'visibilidad':
        // No aportan estela; solo actualizan el estado dibujado.
        break;
    }
    estilo = avanzarEstilo(estilo, op);
    estadoActual = op.estadoDespues;
    if (pintarFotograma) emitirFotograma({ estado: op.estadoDespues, tramo: null });
    emitirAplicar(op);
  }

  /** Detiene la reproducción continua sin tocar el contador ni la estela. */
  function detenerContinua(): void {
    if (idProgramado !== null) {
      reloj.cancelar(idProgramado);
      idProgramado = null;
    }
  }

  /** Aplica de golpe todas las operaciones pendientes, sin posiciones intermedias. */
  function aplicarTodasPendientes(): FinDeSecuencia {
    // Sin posiciones intermedias ni un fotograma por operación: se pinta una sola
    // vez la tortuga en su estado final, que es lo único que se ve.
    const huboPendientes = indice < operaciones.length;
    while (indice < operaciones.length) {
      aplicarCompleta(operaciones[indice]!, false);
      indice += 1;
    }
    if (huboPendientes && estadoActual) emitirFotograma({ estado: estadoActual, tramo: null });
    const fin: FinDeSecuencia = {
      motivo: 'finDeSecuencia',
      operacionesAplicadas: operacionesAplicadas(),
      estadoFinal: estadoFinalActual(),
    };
    emitirFin(fin);
    return fin;
  }

  /** Programa el siguiente fotograma de la reproducción continua. */
  function programarFotograma(): void {
    detenerContinua();
    if (indice >= operaciones.length) {
      // No queda nada pendiente: fin de secuencia.
      const fin: FinDeSecuencia = {
        motivo: 'finDeSecuencia',
        operacionesAplicadas: operacionesAplicadas(),
        estadoFinal: estadoFinalActual(),
      };
      emitirFin(fin);
      return;
    }
    inicioOperacion = reloj.ahora();
    idProgramado = reloj.programar(fotograma);
  }

  /**
   * Un fotograma de la reproducción continua: si la operación en curso ha
   * consumido su duración objetivo, la aplica por completo y pasa a la siguiente;
   * si no, sigue esperando (el detalle de interpolación intermedia lo dibujaría un
   * lienzo real; sobre la estela, el segmento se aporta al completar la operación).
   */
  function fotograma(): void {
    if (indice >= operaciones.length) {
      idProgramado = null;
      const fin: FinDeSecuencia = {
        motivo: 'finDeSecuencia',
        operacionesAplicadas: operacionesAplicadas(),
        estadoFinal: estadoFinalActual(),
      };
      emitirFin(fin);
      return;
    }
    const duracion = DURACIONES[velocidad];
    const transcurrido = reloj.ahora() - inicioOperacion;
    if (transcurrido >= duracion) {
      // Termina la operación en curso: aporta su tramo de estela completo.
      aplicarCompleta(operaciones[indice]!);
      indice += 1;
      if (indice >= operaciones.length) {
        idProgramado = null;
        const fin: FinDeSecuencia = {
          motivo: 'finDeSecuencia',
          operacionesAplicadas: operacionesAplicadas(),
          estadoFinal: estadoFinalActual(),
        };
        emitirFin(fin);
        return;
      }
      inicioOperacion = reloj.ahora();
    }
    // Pinta la tortuga a medio camino de la operación en curso.
    emitirFotograma(
      fotogramaIntermedio(operaciones[indice]!, (reloj.ahora() - inicioOperacion) / Math.max(1, duracion), estilo),
    );
    // Programa el próximo fotograma (haya avanzado o no).
    idProgramado = reloj.programar(fotograma);
  }

  return {
    cargar(ops: readonly Operacion[], capa: CapaEstela): void {
      detenerContinua();
      operaciones = ops;
      destino = capa;
      indice = 0;
      estilo = SIN_ESTILO;
      estadoActual = null;
      estadoInicial = ops[0]?.estadoAntes ?? estadoInicial;
    },

    reproducir(): void {
      detenerContinua();
      // Consulta la preferencia al empezar cada reproducción, no una sola vez.
      if (movimientoReducido() || velocidad === 'inmediata') {
        // Dibuja la estela completa de las pendientes sin posiciones intermedias.
        aplicarTodasPendientes();
        return;
      }
      programarFotograma();
    },

    detener(): void {
      // Termina el tramo en curso, como promete la interfaz: parar a medias dejaría
      // una estela distinta de la que se valida y la tortuga entre dos posiciones.
      const enReproduccion = idProgramado !== null;
      detenerContinua();
      if (enReproduccion && indice < operaciones.length) {
        aplicarCompleta(operaciones[indice]!);
        indice += 1;
      }
      emitirFin({
        motivo: 'detenidoPorJugador',
        operacionesAplicadas: operacionesAplicadas(),
        estadoFinal: estadoFinalActual(),
      });
    },

    paso(): FinDeSecuencia | null {
      // Termina el dibujo de la operación en curso y sale de la continua.
      detenerContinua();
      if (indice >= operaciones.length) {
        // Sin operaciones pendientes: no dibuja nada; devuelve el fin de secuencia.
        return {
          motivo: 'finDeSecuencia',
          operacionesAplicadas: operacionesAplicadas(),
          estadoFinal: estadoFinalActual(),
        };
      }
      // Aplica por completo exactamente la siguiente operación pendiente.
      aplicarCompleta(operaciones[indice]!);
      indice += 1;
      if (indice >= operaciones.length) {
        const fin: FinDeSecuencia = {
          motivo: 'finDeSecuencia',
          operacionesAplicadas: operacionesAplicadas(),
          estadoFinal: estadoFinalActual(),
        };
        emitirFin(fin);
        return fin;
      }
      return null;
    },

    ponerVelocidad(v: Velocidad): void {
      // Se aplica a partir de la siguiente operación pendiente: conserva la estela
      // y el contador, no reinicia la secuencia. Si hay reproducción en curso, el
      // próximo fotograma ya usa la nueva duración.
      velocidad = v;
    },

    reiniciar(nuevoInicial: EstadoTortuga): void {
      detenerContinua();
      indice = 0;
      estilo = SIN_ESTILO;
      estadoInicial = nuevoInicial;
      estadoActual = nuevoInicial;
      // Borra SOLO la capa del jugador; conserva la secuencia recibida.
      lienzo.limpiarEstela('jugador');
    },

    alTerminar(escucha: (fin: FinDeSecuencia) => void): void {
      escuchasFin.push(escucha);
    },

    alAplicar(escucha: (op: Operacion) => void): void {
      escuchasAplicar.push(escucha);
    },

    alFotograma(escucha: (f: Fotograma) => void): void {
      escuchasFotograma.push(escucha);
    },
  };
}

/** Estado de reserva, solo por si se consulta el estado final sin cargar nada. */
const DEFECTO_ESTADO: EstadoTortuga = {
  posicion: { x: 0, y: 0 },
  rumbo: 0,
  lapizAbajo: true,
  visible: true,
};
