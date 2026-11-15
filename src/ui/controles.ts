// Controles de ejecución de KiroLogo: seis acciones —ejecutar, detener, dar un
// paso, reiniciar, volver a ver la demostración y ver en paralelo—, cada una
// en un único elemento interactivo, más las cuatro velocidades del animador.
//
// Los controles no conocen el intérprete: piden a `main.ts` la ejecución por un
// callback, e invocan el paso a paso, el reinicio y la repetición de la demo por
// los suyos. Reflejan el estado habilitado de forma programática y visual.

import type { Velocidad } from '../motor/animador.js';

// ============================================================================
// Callbacks hacia main.ts / animador / demostración
// ============================================================================

export interface CallbacksControles {
  /** Pide a `main.ts` ejecutar el programa del jugador. */
  readonly ejecutar: () => void;
  /** Pide detener la ejecución en curso. */
  readonly detener: () => void;
  /** Pide dar un paso (modo paso a paso del animador). */
  readonly darPaso: () => void;
  /** Pide reiniciar (reinicio del animador). */
  readonly reiniciar: () => void;
  /** Pide volver a ver la demostración (repetición). */
  readonly verDemostracion: () => void;
  /** Pide ver el recorrido del jugador y el de Kiro en paralelo. */
  readonly verEnParalelo: () => void;
  /** Notifica un cambio de velocidad seleccionada. */
  readonly cambiarVelocidad: (v: Velocidad) => void;
}

export interface DependenciasControles {
  readonly contenedor: HTMLElement;
  readonly callbacks: CallbacksControles;
}

// ============================================================================
// Nombres accesibles (español, distintos y estables)
// ============================================================================

const NOMBRE_ACCION: Readonly<Record<AccionId, string>> = {
  ejecutar: 'Ejecutar el programa',
  detener: 'Detener la ejecución',
  paso: 'Dar un paso',
  reiniciar: 'Reiniciar',
  demostracion: 'Volver a ver la demostración',
  // Contiene el texto visible «Ver en paralelo» (etiqueta contenida en el nombre).
  paralelo: 'Ver en paralelo mi recorrido y el de Kiro',
};

const NOMBRE_VELOCIDAD: Readonly<Record<Velocidad, string>> = {
  lenta: 'Velocidad lenta',
  normal: 'Velocidad normal',
  rapida: 'Velocidad rápida',
  inmediata: 'Velocidad inmediata',
};

/**
 * Texto visible de cada botón: corto, para que quepa un panel de controles
 * compacto. El nombre accesible sigue siendo el largo de arriba y SIEMPRE contiene
 * el texto visible («Ejecutar» está en «Ejecutar el programa»), de modo que quien
 * dicta «pulsar Ejecutar» activa el botón correcto.
 */
const TEXTO_ACCION: Readonly<Record<AccionId, { readonly icono: string; readonly texto: string }>> = {
  ejecutar: { icono: '▶', texto: 'Ejecutar' },
  detener: { icono: '■', texto: 'Detener' },
  paso: { icono: '⏭', texto: 'Paso' },
  reiniciar: { icono: '↺', texto: 'Reiniciar' },
  demostracion: { icono: '👁', texto: 'Ver la demostración' },
  paralelo: { icono: '⇉', texto: 'Ver en paralelo' },
};

const TEXTO_VELOCIDAD: Readonly<Record<Velocidad, string>> = {
  lenta: 'Lenta',
  normal: 'Normal',
  rapida: 'Rápida',
  inmediata: 'Inmediata',
};

/** Orden visual de las velocidades. */
const VELOCIDADES: readonly Velocidad[] = ['lenta', 'normal', 'rapida', 'inmediata'];

// ============================================================================
// Acciones
// ============================================================================

export type AccionId = 'ejecutar' | 'detener' | 'paso' | 'reiniciar' | 'demostracion' | 'paralelo';

/** Orden visual de las seis acciones de botón (la velocidad es un grupo aparte). */
const ORDEN_ACCIONES: readonly AccionId[] = ['ejecutar', 'detener', 'paso', 'reiniciar', 'demostracion', 'paralelo'];

// ============================================================================
// Interfaz pública
// ============================================================================

export interface Controles {
  readonly raiz: HTMLElement;
  /** Botón de una acción. */
  boton(accion: AccionId): HTMLButtonElement;
  /** Botón de una velocidad. */
  botonVelocidad(v: Velocidad): HTMLButtonElement;
  /** Velocidad seleccionada en curso. */
  velocidadSeleccionada(): Velocidad;
  /** true si una acción está habilitada. */
  habilitada(accion: AccionId): boolean;
  /**
   * Avisa si existe un intento ejecutado del reto en curso. «Ver en paralelo» solo se
   * habilita con un intento y sin ejecución en curso; al cambiar de reto se descarta.
   */
  marcarIntentoEjecutado(hay: boolean): void;
  /** Pone los controles en modo «ejecución en curso». */
  marcarEjecucionEnCurso(): void;
  /** Pone los controles en modo «detenido por el jugador». */
  marcarDetenido(): void;
  /** Pone los controles en modo «fin de secuencia». */
  marcarFinDeSecuencia(): void;
  /** Selecciona una velocidad de forma programática. */
  seleccionarVelocidad(v: Velocidad): void;
}

// ============================================================================
// Creación
// ============================================================================

/**
 * Crea los controles sobre un contenedor. Las seis acciones son botones nativos
 * (activables con ratón, Enter y barra espaciadora, alcanzables por Tab en orden
 * visual). El estado habilitado se refleja con `disabled` (programático) y con
 * una clase (visual). Al entrar, ejecutar/paso/reiniciar/demostración/velocidad
 * habilitados, detener deshabilitado, y la velocidad normal seleccionada.
 */
export function crearControles(deps: DependenciasControles): Controles {
  const doc = deps.contenedor.ownerDocument;
  const cb = deps.callbacks;

  const raiz = doc.createElement('div');
  raiz.className = 'kl-controles';
  raiz.setAttribute('role', 'group');
  raiz.setAttribute('aria-label', 'Controles de ejecución');

  const botones = new Map<AccionId, HTMLButtonElement>();

  function invocar(accion: AccionId): void {
    // No hace nada cuando el control está deshabilitado.
    const b = botones.get(accion)!;
    if (b.disabled) return;
    switch (accion) {
      case 'ejecutar':
        cb.ejecutar();
        break;
      case 'detener':
        cb.detener();
        break;
      case 'paso':
        cb.darPaso();
        break;
      case 'reiniciar':
        cb.reiniciar();
        break;
      case 'demostracion':
        cb.verDemostracion();
        break;
      case 'paralelo':
        cb.verEnParalelo();
        break;
    }
  }

  for (const accion of ORDEN_ACCIONES) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = `kl-control kl-control-${accion}`;
    b.setAttribute('data-accion', accion);
    const icono = doc.createElement('span');
    icono.className = 'kl-control-icono';
    icono.setAttribute('aria-hidden', 'true');
    icono.textContent = TEXTO_ACCION[accion].icono;
    b.appendChild(icono);
    b.appendChild(doc.createTextNode(TEXTO_ACCION[accion].texto));
    b.setAttribute('aria-label', NOMBRE_ACCION[accion]);
    b.addEventListener('click', () => invocar(accion));
    raiz.appendChild(b);
    botones.set(accion, b);
  }

  // Grupo de velocidades.
  const grupoVel = doc.createElement('div');
  grupoVel.className = 'kl-control-velocidades';
  grupoVel.setAttribute('role', 'group');
  grupoVel.setAttribute('aria-label', 'Cambiar la velocidad');
  // Rótulo visible del grupo; el grupo ya tiene su nombre accesible.
  const rotuloVel = doc.createElement('span');
  rotuloVel.className = 'kl-control-velocidades-rotulo';
  rotuloVel.setAttribute('aria-hidden', 'true');
  rotuloVel.textContent = 'Velocidad';
  grupoVel.appendChild(rotuloVel);
  const botonesVel = new Map<Velocidad, HTMLButtonElement>();
  let velocidad: Velocidad = 'normal';

  function pintarVelocidad(): void {
    for (const v of VELOCIDADES) {
      const b = botonesVel.get(v)!;
      const sel = v === velocidad;
      b.setAttribute('aria-pressed', sel ? 'true' : 'false');
      b.classList.toggle('kl-seleccionada', sel);
    }
  }

  for (const v of VELOCIDADES) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = `kl-velocidad kl-velocidad-${v}`;
    b.setAttribute('data-velocidad', v);
    b.textContent = TEXTO_VELOCIDAD[v];
    b.setAttribute('aria-label', NOMBRE_VELOCIDAD[v]);
    b.addEventListener('click', () => {
      if (b.disabled) return;
      velocidad = v;
      pintarVelocidad();
      cb.cambiarVelocidad(v);
    });
    grupoVel.appendChild(b);
    botonesVel.set(v, b);
  }
  raiz.appendChild(grupoVel);

  deps.contenedor.appendChild(raiz);

  // --- Habilitar / deshabilitar ---
  function fijarHabilitada(accion: AccionId, habilitada: boolean): void {
    const b = botones.get(accion)!;
    b.disabled = !habilitada;
    b.classList.toggle('kl-deshabilitada', !habilitada);
    b.setAttribute('aria-disabled', habilitada ? 'false' : 'true');
  }

  function fijarVelocidadesHabilitadas(habilitadas: boolean): void {
    for (const v of VELOCIDADES) {
      const b = botonesVel.get(v)!;
      b.disabled = !habilitadas;
      b.classList.toggle('kl-deshabilitada', !habilitadas);
    }
  }

  /** Si el foco quedó en un control recién deshabilitado, lo mueve a otro. */
  function moverFocoSiHaceFalta(desactivado: AccionId): void {
    const activo = doc.activeElement;
    const b = botones.get(desactivado)!;
    if (activo !== b) return;
    // Si se deshabilitó ejecutar, el foco va a detener; en caso contrario, a ejecutar.
    const destino = desactivado === 'ejecutar' ? 'detener' : 'ejecutar';
    const bd = botones.get(destino)!;
    if (!bd.disabled) bd.focus();
  }

  // «Ver en paralelo» necesita un intento que comparar y que nada se esté ejecutando.
  let hayIntento = false;
  let enEjecucion = false;
  function actualizarParalelo(): void {
    fijarHabilitada('paralelo', hayIntento && !enEjecucion);
  }

  // Estado inicial: al entrar al nivel.
  function estadoInicial(): void {
    fijarHabilitada('ejecutar', true);
    fijarHabilitada('detener', false);
    fijarHabilitada('paso', true);
    fijarHabilitada('reiniciar', true);
    fijarHabilitada('demostracion', true);
    actualizarParalelo();
    fijarVelocidadesHabilitadas(true);
    velocidad = 'normal';
    pintarVelocidad();
  }
  estadoInicial();

  return {
    raiz,

    boton(accion: AccionId): HTMLButtonElement {
      return botones.get(accion)!;
    },

    botonVelocidad(v: Velocidad): HTMLButtonElement {
      return botonesVel.get(v)!;
    },

    velocidadSeleccionada(): Velocidad {
      return velocidad;
    },

    habilitada(accion: AccionId): boolean {
      return !botones.get(accion)!.disabled;
    },

    marcarIntentoEjecutado(hay: boolean): void {
      hayIntento = hay;
      actualizarParalelo();
    },

    marcarEjecucionEnCurso(): void {
      enEjecucion = true;
      actualizarParalelo();
      // Deshabilita ejecutar y demostración; habilita detener/paso/velocidad/reiniciar.
      fijarHabilitada('ejecutar', false);
      fijarHabilitada('demostracion', false);
      fijarHabilitada('detener', true);
      fijarHabilitada('paso', true);
      fijarHabilitada('reiniciar', true);
      fijarVelocidadesHabilitadas(true);
      moverFocoSiHaceFalta('ejecutar');
      moverFocoSiHaceFalta('demostracion');
    },

    marcarDetenido(): void {
      enEjecucion = false;
      actualizarParalelo();
      // Detención pedida por el jugador: invierte los habilitados.
      fijarHabilitada('detener', false);
      fijarHabilitada('ejecutar', true);
      fijarHabilitada('demostracion', true);
      fijarHabilitada('paso', true);
      fijarHabilitada('reiniciar', true);
      fijarVelocidadesHabilitadas(true);
      moverFocoSiHaceFalta('detener');
    },

    marcarFinDeSecuencia(): void {
      enEjecucion = false;
      actualizarParalelo();
      // Fin de secuencia: habilita ejecutar y demostración, deshabilita detener.
      fijarHabilitada('ejecutar', true);
      fijarHabilitada('demostracion', true);
      fijarHabilitada('detener', false);
      fijarHabilitada('paso', true);
      fijarHabilitada('reiniciar', true);
      fijarVelocidadesHabilitadas(true);
      moverFocoSiHaceFalta('detener');
    },

    seleccionarVelocidad(v: Velocidad): void {
      velocidad = v;
      pintarVelocidad();
    },
  };
}
