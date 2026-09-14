// Demostración en vivo de Kiro: dibuja los personajes en el estado inicial,
// espera, y entrega al animador la secuencia que YA trae el reto, sobre la capa
// de referencia. Repetición ilimitada y control de velocidad.
//
// No invoca el intérprete, no vuelve a resolver el reto y no toca la capa del
// jugador. Todas las dependencias entran por parámetro (lienzo, animador, reloj
// de espera, lector de tema de personajes, anunciador y aviso al globo).

import type { Operacion } from '../lenguaje/interprete.js';
import type { EstadoTortuga } from '../motor/tortuga.js';
import type { Animador, Velocidad, FinDeSecuencia } from '../motor/animador.js';
import type { ContextoDibujo } from '../motor/lienzo.js';
import {
  dibujarPersonajes,
  type EstadoPersonajes,
  type LectorTemaPersonajes,
} from '../motor/personajes.js';

// ============================================================================
// Espera inicial (requisito 22.1)
// ============================================================================

/** Los personajes quedan quietos al menos este tiempo antes del primer movimiento. */
export const ESPERA_INICIAL_MS = 500;

// ============================================================================
// Reloj de espera inyectable
// ============================================================================

/** Reloj de espera para la pausa antes del primer movimiento (setTimeout en producción). */
export interface RelojEspera {
  programar(callback: () => void, ms: number): number;
  cancelar(id: number): void;
}

// ============================================================================
// Interfaz mínima del lienzo que la demostración gobierna
// ============================================================================

/**
 * Subconjunto del `Lienzo` que la demostración necesita: la capa de personajes
 * para dibujar la tortuga y Kiro, y el borrado de la capa de referencia.
 */
export interface LienzoDemostracion {
  capaPersonajes(): ContextoDibujo;
  limpiarPersonajes(): void;
  limpiarEstela(capa: 'jugador' | 'referencia'): void;
}

// ============================================================================
// Recuento de tramos y giros de una secuencia
// ============================================================================

export interface RecuentoSecuencia {
  readonly tramos: number;
  readonly giros: number;
}

/** Cuenta los tramos (mover con lápiz abajo y longitud) y los giros de una secuencia. */
export function recuentoDeSecuencia(operaciones: readonly Operacion[]): RecuentoSecuencia {
  let tramos = 0;
  let giros = 0;
  for (const op of operaciones) {
    if (op.tipo === 'mover' && op.lapizAbajo) {
      const dx = op.hasta.x - op.desde.x;
      const dy = op.hasta.y - op.desde.y;
      if (Math.hypot(dx, dy) >= 0.0001) tramos += 1;
    } else if (op.tipo === 'girar') {
      giros += 1;
    }
  }
  return { tramos, giros };
}

// ============================================================================
// Dependencias
// ============================================================================

export interface DependenciasDemostracion {
  readonly lienzo: LienzoDemostracion;
  readonly animador: Animador;
  /** Secuencia de operaciones que ya trae el reto. */
  readonly operaciones: readonly Operacion[];
  /** Estado inicial del nivel. */
  readonly estadoInicial: EstadoTortuga;
  /** Lector del tema de personajes para dibujar la tortuga y Kiro. */
  readonly leerTemaPersonajes: LectorTemaPersonajes;
  /** Reloj de la espera inicial. */
  readonly relojEspera: RelojEspera;
  /** Publica en la región `aria-live` `polite`, sin mover el foco. */
  readonly anunciar: (texto: string) => void;
  /** Informa al globo que el nivel no tiene demostración que reproducir. */
  readonly avisarSinDemostracion: () => void;
}

// ============================================================================
// Interfaz pública
// ============================================================================

export interface Demostracion {
  /** Inicia una reproducción: dibuja el estado inicial, espera y reproduce. */
  reproducir(): void;
  /** Vuelve a reproducir: detiene, borra solo la referencia y reaplica. */
  repetir(): void;
  /** Cambia la velocidad de la demostración (y del animador). */
  ponerVelocidad(v: Velocidad): void;
  /** Velocidad seleccionada. */
  velocidad(): Velocidad;
  /** Cede el animador ante «ejecutar»: dibuja lo pendiente y vuelve al inicio. */
  cederAEjecucion(): void;
  /** true si hay una reproducción en curso (esperando o animando). */
  enCurso(): boolean;
}

// ============================================================================
// Creación
// ============================================================================

export function crearDemostracion(deps: DependenciasDemostracion): Demostracion {
  const { lienzo, animador } = deps;
  let velocidad: Velocidad = 'normal';
  let idEspera: number | null = null;
  let esperando = false;
  let animando = false;
  const recuento = recuentoDeSecuencia(deps.operaciones);

  /** Dibuja los personajes en un estado de la tortuga, sin tocar las estelas. */
  function dibujarEnEstado(estado: EstadoTortuga): void {
    lienzo.limpiarPersonajes();
    const personajes: EstadoPersonajes = {
      tortuga: estado,
      kiroMontado: true,
      inclinacionKiro: 0,
      identidad: 'kiro',
      celebracion: false,
    };
    dibujarPersonajes(lienzo.capaPersonajes(), personajes, deps.leerTemaPersonajes);
  }

  function cancelarEspera(): void {
    if (idEspera !== null) {
      deps.relojEspera.cancelar(idEspera);
      idEspera = null;
    }
    esperando = false;
  }

  function alTerminar(fin: FinDeSecuencia): void {
    if (fin.motivo !== 'finDeSecuencia') return;
    if (!animando) return;
    animando = false;
    // Conserva los tramos en referencia; devuelve la tortuga al inicio sin dibujar.
    dibujarEnEstado(deps.estadoInicial);
    deps.anunciar(
      `Kiro terminó de dibujar: ${recuento.tramos} tramo(s) y ${recuento.giros} giro(s).`,
    );
  }
  animador.alTerminar(alTerminar);

  function arrancarReproduccion(): void {
    if (deps.operaciones.length === 0) {
      // Reto sin operaciones: referencia sin píxeles, personajes en inicio, aviso.
      lienzo.limpiarEstela('referencia');
      dibujarEnEstado(deps.estadoInicial);
      deps.avisarSinDemostracion();
      return;
    }
    // Dibuja el estado inicial y espera ≥ 500 ms antes del primer movimiento.
    dibujarEnEstado(deps.estadoInicial);
    deps.anunciar('Kiro empieza a dibujar.');
    animador.cargar(deps.operaciones, 'referencia');
    animador.ponerVelocidad(velocidad);
    esperando = true;
    idEspera = deps.relojEspera.programar(() => {
      idEspera = null;
      esperando = false;
      animando = true;
      animador.reproducir();
    }, ESPERA_INICIAL_MS);
  }

  return {
    reproducir(): void {
      cancelarEspera();
      arrancarReproduccion();
    },

    repetir(): void {
      // Detiene en curso, borra solo la referencia y reaplica desde el inicio.
      cancelarEspera();
      animando = false;
      animador.detener();
      lienzo.limpiarEstela('referencia');
      arrancarReproduccion();
    },

    ponerVelocidad(v: Velocidad): void {
      velocidad = v;
      animador.ponerVelocidad(v);
    },

    velocidad(): Velocidad {
      return velocidad;
    },

    cederAEjecucion(): void {
      // Detiene, dibuja de inmediato los tramos pendientes en referencia (con
      // `paso`, sin posiciones intermedias) y vuelve al inicio, cediendo el
      // animador sin volver a resolver el reto.
      cancelarEspera();
      animador.detener();
      // Agota las operaciones pendientes de golpe: cada `paso` aplica una entera.
      let fin = animador.paso();
      while (fin === null) {
        fin = animador.paso();
      }
      animando = false;
      dibujarEnEstado(deps.estadoInicial);
    },

    enCurso(): boolean {
      return esperando || animando;
    },
  };
}
