// Reproducción en paralelo de KiroLogo: las dos tortugas avanzan al mismo tiempo
// sobre la misma cuadrícula, la de Kiro y la del jugador, para que el jugador vea
// —no solo lea— dónde dejaron de ir por el mismo camino.
//
// Este módulo es solo la PRESENTACIÓN: la comparación operación a operación y el
// mensaje de divergencia viven en `motor/divergencia.ts` y los muestra
// `ui/comparacion.ts` bajo el lienzo. Aquí únicamente se dibujan las dos tortugas
// cuadro a cuadro.
//
// Sincronización (requisito 5, decisión cerrada): las dos corren a la MISMA
// velocidad de pasos. Si una tiene más pasos que la otra, la corta termina su
// último paso y su tortuga queda ESTÁTICA en su estado final mientras la larga
// sigue. El número de cuadros es el máximo de las dos longitudes.
//
// Distinción de las dos tortugas sin depender del color (regla de accesibilidad):
//   - La de Kiro lleva a Kiro montado y su estilo habitual.
//   - La del jugador va en un estilo diferenciado (naranja).
//   - Cada cuadro se anuncia por `aria-live` nombrando a quién pertenece cada
//     tortuga, de modo que la separación no depende de ver el color.
// El dibujo del jinete de la tortuga del jugador (ir «sin jinete») lo añade la
// spec 04; `personajes.ts` todavía iguala ese dibujo por contrato de la spec 00.
//
// `prefers-reduced-motion`: si está activo, no hay recorrido animado; se dibuja
// directamente el último cuadro (las dos tortugas en su estado final).

import type { Operacion } from '../lenguaje/interprete.js';
import type { EstadoTortuga } from '../motor/tortuga.js';
import type { Reloj } from '../motor/animador.js';
import type { ContextoDibujo } from '../motor/lienzo.js';
import {
  dibujarPersonajes,
  type EstadoPersonajes,
  type EstiloPersonajes,
} from '../motor/personajes.js';

// ============================================================================
// Duración de un cuadro, en milisegundos
// ============================================================================

/**
 * Tiempo mínimo entre cuadros de la reproducción en paralelo. Es un paso por
 * cuadro para que el jugador pueda contar los tramos; no se expone un control de
 * velocidad propio porque la lección es la cuenta, no el ritmo.
 */
export const DURACION_CUADRO_MS = 400;

// ============================================================================
// Dependencias inyectables
// ============================================================================

/**
 * Subconjunto del lienzo que la reproducción en paralelo gobierna: la capa de
 * personajes sobre la que dibuja las dos tortugas, y su borrado entre cuadros.
 * Las dos tortugas comparten una sola capa para quedar sobre la misma cuadrícula.
 */
export interface LienzoParalelo {
  capaPersonajes(): ContextoDibujo;
  limpiarPersonajes(): void;
}

export interface DependenciasReproduccionParalelo {
  readonly lienzo: LienzoParalelo;
  /** Reloj de animación inyectable (en pruebas, un reloj falso). */
  readonly reloj: Reloj;
  /** Estilo de la tortuga de Kiro (el habitual del tema). */
  readonly leerTemaKiro: () => EstiloPersonajes;
  /** Estilo de la tortuga del jugador (diferenciado, naranja). */
  readonly leerTemaJugador: () => EstiloPersonajes;
  /** Consulta `prefers-reduced-motion`; se lee al empezar cada reproducción. */
  readonly movimientoReducido: () => boolean;
  /** Publica en la región `aria-live` `polite`, sin mover el foco. */
  readonly anunciar: (texto: string) => void;
}

// ============================================================================
// Interfaz pública
// ============================================================================

export interface ReproduccionParalelo {
  /**
   * Reproduce las dos secuencias en paralelo sobre la misma cuadrícula. Las dos
   * tortugas parten del mismo estado inicial. Devuelve de inmediato; los cuadros
   * los programa el reloj.
   */
  reproducir(
    opsKiro: readonly Operacion[],
    opsJugador: readonly Operacion[],
    estadoInicial: EstadoTortuga,
  ): void;
  /** Detiene la reproducción en curso, dejando el último cuadro dibujado. */
  detener(): void;
  /** true si hay una reproducción en curso. */
  enCurso(): boolean;
  /** Índice del último cuadro dibujado (0 si no se ha dibujado ninguno). */
  cuadroActual(): number;
}

// ============================================================================
// Estado de la tortuga tras i operaciones
// ============================================================================

/**
 * Estado de la tortuga tras aplicar `i` operaciones de la secuencia. Con `i` 0
 * devuelve el estado inicial; a partir de ahí toma el `estadoDespues` de la
 * operación `i − 1`. Si `i` supera la longitud, la tortuga queda ESTÁTICA en su
 * estado final: así la secuencia corta espera a la larga sin seguir moviéndose.
 */
export function estadoTras(
  operaciones: readonly Operacion[],
  i: number,
  estadoInicial: EstadoTortuga,
): EstadoTortuga {
  if (i <= 0 || operaciones.length === 0) return estadoInicial;
  const indice = Math.min(i, operaciones.length) - 1;
  return operaciones[indice]!.estadoDespues;
}

// ============================================================================
// Creación
// ============================================================================

export function crearReproduccionParalelo(
  deps: DependenciasReproduccionParalelo,
): ReproduccionParalelo {
  const { lienzo, reloj } = deps;

  let opsKiro: readonly Operacion[] = [];
  let opsJugador: readonly Operacion[] = [];
  let inicial: EstadoTortuga | null = null;
  let totalCuadros = 0;
  let cuadro = 0;
  let idProgramado: number | null = null;
  let inicioCuadro = 0;

  function cancelarProgramado(): void {
    if (idProgramado !== null) {
      reloj.cancelar(idProgramado);
      idProgramado = null;
    }
  }

  /**
   * Dibuja las dos tortugas en el cuadro `n`: cada una en el estado que le
   * corresponde tras `n` operaciones. Las dos se dibujan sobre la misma capa, así
   * que comparten cuadrícula. La de Kiro va montada y con su estilo; la del
   * jugador, con el estilo diferenciado. No toca ninguna estela.
   */
  function dibujarCuadro(n: number): void {
    if (inicial === null) return;
    const estadoKiro = estadoTras(opsKiro, n, inicial);
    const estadoJugador = estadoTras(opsJugador, n, inicial);

    const ctx = lienzo.capaPersonajes();
    lienzo.limpiarPersonajes();

    // Tortuga del jugador primero, Kiro encima: así, si se solapan en el estado
    // inicial, el jugador ve que las dos están ahí (la de Kiro no la tapa del
    // todo) y la de Kiro —la que marca el objetivo— queda legible arriba.
    const personajesJugador: EstadoPersonajes = {
      tortuga: estadoJugador,
      kiroMontado: false,
      inclinacionKiro: 0,
      identidad: 'jugador',
      celebracion: false,
    };
    dibujarPersonajes(ctx, personajesJugador, deps.leerTemaJugador);

    const personajesKiro: EstadoPersonajes = {
      tortuga: estadoKiro,
      kiroMontado: true,
      inclinacionKiro: 0,
      identidad: 'kiro',
      celebracion: false,
    };
    dibujarPersonajes(ctx, personajesKiro, deps.leerTemaKiro);

    cuadro = n;
  }

  function programarSiguiente(): void {
    cancelarProgramado();
    if (cuadro >= totalCuadros) {
      // Llegó al final: las dos tortugas quedan en su estado final.
      deps.anunciar(
        'Fin de la reproducción en paralelo: la tortuga de Kiro y tu tortuga quedan en su posición final.',
      );
      return;
    }
    inicioCuadro = reloj.ahora();
    idProgramado = reloj.programar(fotograma);
  }

  function fotograma(): void {
    const transcurrido = reloj.ahora() - inicioCuadro;
    if (transcurrido >= DURACION_CUADRO_MS) {
      dibujarCuadro(cuadro + 1);
      if (cuadro >= totalCuadros) {
        idProgramado = null;
        deps.anunciar(
          'Fin de la reproducción en paralelo: la tortuga de Kiro y tu tortuga quedan en su posición final.',
        );
        return;
      }
      inicioCuadro = reloj.ahora();
    }
    idProgramado = reloj.programar(fotograma);
  }

  return {
    reproducir(
      ok: readonly Operacion[],
      oj: readonly Operacion[],
      estadoInicial: EstadoTortuga,
    ): void {
      cancelarProgramado();
      opsKiro = ok;
      opsJugador = oj;
      inicial = estadoInicial;
      totalCuadros = Math.max(ok.length, oj.length);
      cuadro = 0;

      // Cuadro 0: las dos tortugas en el estado inicial, sobre la misma cuadrícula.
      dibujarCuadro(0);
      deps.anunciar(
        'Reproducción en paralelo: la tortuga de Kiro y tu tortuga avanzan a la vez sobre la misma cuadrícula.',
      );

      if (totalCuadros === 0) {
        return;
      }

      // Movimiento reducido: sin recorrido animado, se salta al último cuadro.
      if (deps.movimientoReducido()) {
        dibujarCuadro(totalCuadros);
        deps.anunciar(
          'Fin de la reproducción en paralelo: la tortuga de Kiro y tu tortuga quedan en su posición final.',
        );
        return;
      }

      programarSiguiente();
    },

    detener(): void {
      cancelarProgramado();
    },

    enCurso(): boolean {
      return idProgramado !== null;
    },

    cuadroActual(): number {
      return cuadro;
    },
  };
}
