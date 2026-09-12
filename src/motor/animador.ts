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
import type { Segmento } from './segmentos.js';
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
// Interfaz mínima del lienzo que el animador gobierna
// ============================================================================

/**
 * Subconjunto del `Lienzo` que el animador necesita: crecer y limpiar la estela de
 * una capa. Es estructuralmente compatible con `Lienzo` de `lienzo.ts`, así que el
 * lienzo real se pasa tal cual; en pruebas se pasa un doble.
 */
export interface LienzoAnimador {
  crecerEstela(capa: CapaEstela, segmentos: readonly Segmento[]): void;
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
}

/**
 * Deriva el segmento que aporta una operación `mover` con el lápiz abajo, o null si
 * no aporta estela. Coincide con el criterio de `extraerSegmentos`: longitud ≥ 1e−4.
 */
function segmentoDeMover(op: Operacion): Segmento | null {
  if (op.tipo !== 'mover' || !op.lapizAbajo) return null;
  const dx = op.hasta.x - op.desde.x;
  const dy = op.hasta.y - op.desde.y;
  if (Math.hypot(dx, dy) < 0.0001) return null;
  return {
    desde: { x: op.desde.x, y: op.desde.y },
    hasta: { x: op.hasta.x, y: op.hasta.y },
    paso: op.paso,
    linea: op.linea,
  };
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

  // Reproducción continua en curso.
  let idProgramado: number | null = null;
  let inicioOperacion = 0;        // marca de tiempo del inicio de la operación en curso

  const escuchasFin: Array<(fin: FinDeSecuencia) => void> = [];
  const escuchasAplicar: Array<(op: Operacion) => void> = [];

  function emitirAplicar(op: Operacion): void {
    for (const e of escuchasAplicar) e(op);
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
  function aplicarCompleta(op: Operacion): void {
    switch (op.tipo) {
      case 'mover': {
        const seg = segmentoDeMover(op);
        if (seg) lienzo.crecerEstela(destino, [seg]);
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
    estadoActual = op.estadoDespues;
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
    while (indice < operaciones.length) {
      aplicarCompleta(operaciones[indice]!);
      indice += 1;
    }
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
    // Programa el próximo fotograma (haya avanzado o no).
    idProgramado = reloj.programar(fotograma);
  }

  return {
    cargar(ops: readonly Operacion[], capa: CapaEstela): void {
      detenerContinua();
      operaciones = ops;
      destino = capa;
      indice = 0;
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
      detenerContinua();
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
  };
}

/** Estado de reserva, solo por si se consulta el estado final sin cargar nada. */
const DEFECTO_ESTADO: EstadoTortuga = {
  posicion: { x: 0, y: 0 },
  rumbo: 0,
  lapizAbajo: true,
  visible: true,
};
