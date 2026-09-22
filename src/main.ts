// Arranque y cableado de KiroLogo (grupo 19).
//
// `main.ts` es el único módulo que conoce a todos los demás: resuelve el reto,
// crea el lienzo, el animador y los siete módulos de `ui/`, cablea los callbacks
// y lanza la demostración. Todo el estado del intento vive aquí; los módulos de
// `ui/` no se hablan entre sí, solo con `main.ts`.
//
// Las dependencias del entorno (documento, almacenamiento, relojes, consulta de
// movimiento reducido) entran por parámetro en `crearAplicacion`, así que la
// aplicación entera se prueba en jsdom sin `requestAnimationFrame`, sin
// `localStorage` real y sin Canvas real. El arranque de producción va tras la
// guarda `typeof document !== 'undefined'`, de modo que importar este módulo en
// Node no arranca nada.

import type { Programa } from './lenguaje/ast.js';
import { analizarLexico } from './lenguaje/lexer.js';
import { analizar } from './lenguaje/parser.js';
import { esErrorParaJugador, crearError, type ErrorKiroLogo } from './lenguaje/errores.js';
import { comandosDelMundo } from './lenguaje/vocabulario.js';
import { ejecutar, type Operacion } from './lenguaje/interprete.js';

import { ESTADO_INICIAL } from './motor/tortuga.js';
import { extraerSegmentos, type Segmento } from './motor/segmentos.js';
import { validar, type Veredicto } from './motor/validador.js';
import {
  crearLienzo,
  calcularEscalado,
  type ContextoDibujo,
  type CapasLienzo,
  type EstiloLienzo,
  type LectorTema,
  type TamanoLienzo,
  type TrazoTema,
  type Lienzo,
  type Escalado,
} from './motor/lienzo.js';
import { crearAnimador, type Reloj, type Velocidad, type FinDeSecuencia } from './motor/animador.js';
import {
  dibujarPersonajes,
  type EstadoPersonajes,
  type EstiloPersonajes,
  type LectorTemaPersonajes,
} from './motor/personajes.js';

import { resolverReto, type Reto } from './juego/reto.js';
import { calificar, type Calificacion } from './juego/estrellas.js';
import { cargarProgreso, type Progreso } from './juego/progreso.js';

import { crearEditor, type Editor, type LimiteAlcanzado, type RelojRebote } from './ui/editor.js';
import { crearPanelComandos } from './ui/panel-comandos.js';
import { crearGloboKiro, type GloboKiro } from './ui/globo-kiro.js';
import { crearControles, type Controles } from './ui/controles.js';
import { crearDemostracion, type Demostracion, type RelojEspera } from './ui/demostracion.js';
import { crearDiff, type EstiloDiff, type LectorTemaDiff } from './ui/diff.js';
import { crearComparacion, type Comparacion } from './ui/comparacion.js';

// ============================================================================
// Estado de la aplicación
// ============================================================================

/**
 * Estado del intento en curso. Nace del reto resuelto y se rehace en cada
 * ejecución; nunca se recalcula el veredicto ni las estrellas fuera de aquí.
 */
export interface EstadoAplicacion {
  readonly reto: Reto;
  readonly astJugador: Programa | null;
  readonly operacionesJugador: readonly Operacion[];
  readonly veredicto: Veredicto | null;
  readonly calificacion: Calificacion | null;
}

// ============================================================================
// Dependencias inyectables
// ============================================================================

/** Consulta de la preferencia de movimiento reducido, con suscripción a cambios. */
export interface ConsultaMovimiento {
  /** true cuando el usuario pidió movimiento reducido. */
  reducido(): boolean;
  /** Registra un escucha del cambio de la preferencia; devuelve cómo cancelarlo. */
  alCambiar(escucha: () => void): () => void;
}

export interface DependenciasAplicacion {
  /** Documento del DOM (real o de jsdom). */
  readonly documento: Document;
  /** Contenedor raíz del juego (por omisión, `#aplicacion`). */
  readonly contenedor?: HTMLElement;
  /** Almacén de progreso, o null para memoria pura. */
  readonly almacen: Storage | null;
  /** Reloj de animación (por omisión, `requestAnimationFrame` + `performance.now`). */
  readonly reloj?: Reloj;
  /** Reloj de la espera inicial de la demostración (por omisión, `setTimeout`). */
  readonly relojEspera?: RelojEspera;
  /** Reloj de rebote del contador del editor (por omisión, inmediato). */
  readonly relojRebote?: RelojRebote;
  /** Consulta de movimiento reducido (por omisión, `matchMedia`). */
  readonly movimiento?: ConsultaMovimiento;
  /** Identificador del nivel a resolver (por omisión, `0.1`). */
  readonly idNivel?: string;
}

// ============================================================================
// Interfaz pública de la aplicación (para pruebas)
// ============================================================================

export interface Aplicacion {
  /** Estado del intento en curso. */
  estado(): EstadoAplicacion;
  /** Ejecuta el programa del jugador (flujo de intento del diseño 12.5). */
  ejecutar(): void;
  /** Da un paso del paso a paso. */
  darPaso(): void;
  /** Reinicia el lienzo del jugador. */
  reiniciar(): void;
  /** Vuelve a ver la demostración. */
  verDemostracion(): void;
  /** Cambia la velocidad de la animación. */
  cambiarVelocidad(v: Velocidad): void;
  /** Texto en curso del globo de Kiro. */
  textoGlobo(): string;
  /** Editor, para inspección en pruebas. */
  readonly editor: Editor;
  /** Globo, para inspección en pruebas. */
  readonly globo: GloboKiro;
  /** Cancela las suscripciones (movimiento reducido). */
  destruir(): void;
}

// ============================================================================
// Contexto de dibujo tolerante
// ============================================================================

/**
 * Contexto de dibujo que no hace nada. Se usa cuando `getContext('2d')` no está
 * disponible (jsdom) o cuando una capa lógica no tiene lienzo visible propio, de
 * modo que la aplicación nunca falla por falta de Canvas.
 */
function contextoInerte(): ContextoDibujo {
  const nada = (): void => {};
  return {
    save: nada,
    restore: nada,
    setTransform: nada,
    translate: nada,
    rotate: nada,
    scale: nada,
    beginPath: nada,
    closePath: nada,
    moveTo: nada,
    lineTo: nada,
    quadraticCurveTo: nada,
    bezierCurveTo: nada,
    arc: nada,
    ellipse: nada,
    rect: nada,
    clip: nada,
    fill: nada,
    stroke: nada,
    clearRect: nada,
    setLineDash: nada,
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    strokeStyle: '#000',
    fillStyle: '#000',
  } as unknown as ContextoDibujo;
}

/** Obtiene el contexto 2D de un canvas, o uno inerte si no está disponible. */
function contextoDe(canvas: HTMLCanvasElement | null): ContextoDibujo {
  if (canvas === null) return contextoInerte();
  try {
    const ctx = canvas.getContext('2d');
    if (ctx === null) return contextoInerte();
    return ctx as unknown as ContextoDibujo;
  } catch {
    return contextoInerte();
  }
}

// ============================================================================
// Lectura del tema por getComputedStyle (con reserva)
// ============================================================================

/** Lee una variable CSS del `:root`; devuelve el valor de reserva si está vacía. */
function leerVar(estilo: CSSStyleDeclaration | null, nombre: string, reserva: string): string {
  if (estilo === null) return reserva;
  const valor = estilo.getPropertyValue(nombre).trim();
  return valor.length > 0 ? valor : reserva;
}

/** Lee una variable CSS de grosor en píxeles; convierte a número lógico. */
function leerGrosor(estilo: CSSStyleDeclaration | null, nombre: string, reserva: number): number {
  const bruto = leerVar(estilo, nombre, '');
  if (bruto.length === 0) return reserva;
  const n = Number.parseFloat(bruto);
  return Number.isFinite(n) && n > 0 ? n : reserva;
}

/**
 * Fabrica los lectores de tema del lienzo, del diff y de los personajes a partir
 * del `getComputedStyle` del `:root`. Se invocan en cada redibujado, así que un
 * cambio de tema se refleja al redibujar.
 */
function crearLectoresTema(documento: Document): {
  lienzo: LectorTema;
  diff: LectorTemaDiff;
  personajes: LectorTemaPersonajes;
} {
  function raiz(): CSSStyleDeclaration | null {
    const vista = documento.defaultView;
    if (!vista || typeof vista.getComputedStyle !== 'function') return null;
    const elemento = documento.documentElement;
    try {
      return vista.getComputedStyle(elemento);
    } catch {
      return null;
    }
  }

  function trazo(color: string, grosor: number, guiones: readonly number[] = []): TrazoTema {
    return { color, grosor, guiones };
  }

  const lienzo: LectorTema = (): EstiloLienzo => {
    const e = raiz();
    return {
      fondo: trazo(leerVar(e, '--color-fondo-lienzo', '#ffffff'), 1),
      cuadricula20: trazo(
        leerVar(e, '--color-cuadricula-20', '#dee2e6'),
        leerGrosor(e, '--grosor-cuadricula-20', 0.5),
      ),
      cuadricula100: trazo(
        leerVar(e, '--color-cuadricula-100', '#adb5bd'),
        leerGrosor(e, '--grosor-cuadricula-100', 1),
      ),
      estelaJugador: trazo(
        leerVar(e, '--color-estela-jugador', '#0a58ca'),
        leerGrosor(e, '--grosor-estela-jugador', 3),
      ),
      estelaReferencia: trazo(
        leerVar(e, '--color-estela-referencia', '#495057'),
        leerGrosor(e, '--grosor-estela-referencia', 2),
      ),
    };
  };

  const diff: LectorTemaDiff = (): EstiloDiff => {
    const e = raiz();
    return {
      coincidencia: trazo(
        leerVar(e, '--color-diff-coincidencia', '#2e8b57'),
        leerGrosor(e, '--grosor-diff-coincidencia', 3),
        [],
      ),
      exceso: trazo(
        leerVar(e, '--color-diff-exceso', '#c53030'),
        leerGrosor(e, '--grosor-diff-exceso', 4),
        [4, 12],
      ),
      falta: trazo(
        leerVar(e, '--color-diff-falta', '#5a6268'),
        leerGrosor(e, '--grosor-diff-falta', 2),
        [2, 6],
      ),
    };
  };

  const personajes: LectorTemaPersonajes = (): EstiloPersonajes => {
    const e = raiz();
    return {
      contorno: leerVar(e, '--color-tortuga-contorno', '#000000'),
      relleno: leerVar(e, '--color-tortuga-relleno', '#ffffff'),
      cabeza: leerVar(e, '--color-tortuga-cabeza', '#343a40'),
      kiroContorno: leerVar(e, '--color-kiro-contorno', '#0a58ca'),
      kiroRelleno: leerVar(e, '--color-kiro-relleno', 'rgba(13,110,253,0.1)'),
      lapizContorno: leerVar(e, '--color-lapiz-contorno', '#c53030'),
      marcaRumbo: leerVar(e, '--color-marca-rumbo', '#ff6b6b'),
      grosor: leerGrosor(e, '--grosor-tortuga-contorno', 1.5),
    };
  };

  return { lienzo, diff, personajes };
}

// ============================================================================
// Relojes por omisión (producción)
// ============================================================================

/** Reloj de animación de producción: `requestAnimationFrame` + `performance.now`. */
function relojAnimacionReal(): Reloj {
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback): number => setTimeout(() => cb(ahoraReal()), 16) as unknown as number;
  const caf =
    typeof cancelAnimationFrame === 'function'
      ? cancelAnimationFrame
      : (id: number): void => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  function ahoraReal(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }
  return {
    programar(callback: (ahora: number) => void): number {
      return raf(() => callback(ahoraReal()));
    },
    cancelar(id: number): void {
      caf(id);
    },
    ahora(): number {
      return ahoraReal();
    },
  };
}

/** Reloj de espera de producción: `setTimeout` / `clearTimeout`. */
function relojEsperaReal(): RelojEspera {
  return {
    programar(callback: () => void, ms: number): number {
      return setTimeout(callback, ms) as unknown as number;
    },
    cancelar(id: number): void {
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    },
  };
}

/** Consulta de movimiento reducido de producción: `matchMedia`. */
function consultaMovimientoReal(documento: Document): ConsultaMovimiento {
  const vista = documento.defaultView;
  const consulta =
    vista && typeof vista.matchMedia === 'function'
      ? vista.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  return {
    reducido(): boolean {
      return consulta ? consulta.matches : false;
    },
    alCambiar(escucha: () => void): () => void {
      if (consulta === null) return () => {};
      const manejador = (): void => escucha();
      if (typeof consulta.addEventListener === 'function') {
        consulta.addEventListener('change', manejador);
        return () => consulta.removeEventListener('change', manejador);
      }
      // Reserva para navegadores antiguos.
      if (typeof consulta.addListener === 'function') {
        consulta.addListener(manejador);
        return () => consulta.removeListener?.(manejador);
      }
      return () => {};
    },
  };
}

// ============================================================================
// Tamaño inicial del lienzo
// ============================================================================

/**
 * Deriva el tamaño CSS del lienzo a partir del tamaño real en pantalla del
 * canvas. Sin esto, el búfer no coincide con lo que dibuja el motor y, con
 * densidad de píxeles > 1, el origen lógico (el centro) queda descolocado y la
 * tortuga aparece en una esquina. Si aún no hay medida (por ejemplo en Node o
 * antes del layout), cae al lado lógico de 800.
 */
function tamanoDe(canvas: HTMLCanvasElement | null): TamanoLienzo {
  const vista = canvas?.ownerDocument?.defaultView ?? null;
  const dpr = typeof vista?.devicePixelRatio === 'number' ? vista.devicePixelRatio : 1;

  let lado = 800;
  if (canvas && typeof canvas.getBoundingClientRect === 'function') {
    const r = canvas.getBoundingClientRect();
    const menor = Math.min(r.width, r.height);
    if (menor > 0) lado = menor;
  }
  return { anchoCss: lado, altoCss: lado, devicePixelRatio: dpr };
}

/**
 * Sincroniza el búfer de dibujo del canvas con el escalado: el atributo
 * width/height pasa a ser el búfer (lado · dpr) y el tamaño en pantalla queda
 * en píxeles CSS. Así la transformación del motor, que centra en búfer/2,
 * coincide con el canvas real. Los canvas inertes o nulos se ignoran.
 */
function ajustarBuffer(canvas: HTMLCanvasElement | null, escalado: Escalado): void {
  if (!canvas) return;
  const bufer = Math.round(escalado.bufer);
  if (canvas.width !== bufer) canvas.width = bufer;
  if (canvas.height !== bufer) canvas.height = bufer;
  // El elemento se estira a su tamaño CSS; el CSS ya lo hace con width/height 100%,
  // pero fijamos el lado lógico para lados sin CSS explícito (p. ej. pruebas).
  if (canvas.style) {
    canvas.style.width = `${escalado.lado}px`;
    canvas.style.height = `${escalado.lado}px`;
  }
}

// ============================================================================
// Conversión Velocidad ↔ selector del DOM
// ============================================================================

/** Traduce el valor numérico del `<select id="velocidad">` a la `Velocidad`. */
function velocidadDeValor(valor: string): Velocidad {
  switch (valor) {
    case '0.25':
    case '0.5':
      return 'lenta';
    case '2':
      return 'rapida';
    case '4':
      return 'inmediata';
    case '1':
    default:
      return 'normal';
  }
}

// ============================================================================
// Anuncio único del fin de la ejecución (diseño 12.5)
// ============================================================================

/** Nombra el estado del lápiz por texto, no por color. */
function textoLapiz(abajo: boolean): string {
  return abajo ? 'lápiz abajo' : 'lápiz arriba';
}

/** Compone el anuncio final: motivo, nº de operaciones y estado de la tortuga. */
function componerAnuncioFin(fin: FinDeSecuencia): string {
  const motivo =
    fin.motivo === 'finDeSecuencia'
      ? 'Terminó tu programa'
      : fin.motivo === 'detenidoPorJugador'
        ? 'Detuviste tu programa'
        : 'Detuve tu programa por seguridad';
  const e = fin.estadoFinal;
  const pos = `posición (${Math.round(e.posicion.x)}, ${Math.round(e.posicion.y)})`;
  const rumbo = `rumbo ${Math.round(e.rumbo)}°`;
  return `${motivo}: ${fin.operacionesAplicadas} operación(es) aplicada(s); ${pos}, ${rumbo}, ${textoLapiz(e.lapizAbajo)}.`;
}

// ============================================================================
// Creación de la aplicación
// ============================================================================

/**
 * Crea y cablea la aplicación completa sobre un contenedor del DOM. Cumple los
 * seis pasos del diseño 12.4 y monta el flujo de intento del diseño 12.5. No
 * arranca por su cuenta: el arranque de producción la invoca tras la guarda de
 * `document`.
 */
export function crearAplicacion(deps: DependenciasAplicacion): Aplicacion {
  const documento = deps.documento;
  const contenedor = deps.contenedor ?? (documento.getElementById('aplicacion') as HTMLElement | null) ?? documento.body;
  const idNivel = deps.idNivel ?? '0.1';

  const reloj = deps.reloj ?? relojAnimacionReal();
  const relojEspera = deps.relojEspera ?? relojEsperaReal();
  const movimiento = deps.movimiento ?? consultaMovimientoReal(documento);
  const lectores = crearLectoresTema(documento);

  // --- Región aria-live: el único canal de anuncios ---
  const anuncios = documento.getElementById('anuncios');
  function anunciar(texto: string): void {
    if (anuncios) anuncios.textContent = texto;
  }

  // ---- Paso 1: cargar el progreso, tolerando el fallo del almacén ----
  let progreso: Progreso;
  try {
    progreso = cargarProgreso(deps.almacen);
  } catch (e) {
    console.error('No se pudo cargar el progreso; se sigue en memoria.', e);
    progreso = cargarProgreso(null);
  }

  // ---- Paso 2: resolver el reto; el fallo va a la consola, nunca al globo ----
  const resultado = resolverReto(idNivel, 0);
  if (!resultado.exito) {
    // Fallo de programación: se registra y se detiene el arranque con seguridad.
    console.error('No se pudo resolver el reto inicial:', resultado.error.mensaje);
    throw new Error(`Reto inicial no resoluble: ${resultado.error.id}`);
  }
  const reto = resultado.reto;

  // ---- Paso 3: lienzos, animador y los siete módulos de ui/ ----
  const q = (id: string): HTMLCanvasElement | null =>
    documento.getElementById(id) as HTMLCanvasElement | null;

  // Elementos canvas por capa y lado (para dimensionar sus búferes).
  const canvasReferencia = q('lienzo-referencia');
  const canvasJugador = q('lienzo-jugador');
  const canvasSuperposicion = q('lienzo-superposicion');
  const canvasPersonajesReferencia = q('lienzo-personajes-referencia');
  const canvasPersonajesJugador = q('lienzo-personajes-jugador');
  const canvasFondoReferencia = q('lienzo-fondo-referencia');
  const canvasFondoJugador = q('lienzo-fondo-jugador');

  const canvasLado = {
    referencia: [canvasFondoReferencia, canvasReferencia, canvasPersonajesReferencia],
    jugador: [canvasFondoJugador, canvasJugador, canvasPersonajesJugador],
    superposicion: [canvasSuperposicion],
  } as const;

  const ctxReferencia = contextoDe(canvasReferencia);
  const ctxJugador = contextoDe(canvasJugador);
  const ctxSuperposicion = contextoDe(canvasSuperposicion);
  const ctxPersonajesReferencia = contextoDe(canvasPersonajesReferencia);
  const ctxPersonajesJugador = contextoDe(canvasPersonajesJugador);

  // Un fondo inerte por lado: la cuadrícula se dibuja sobre la propia capa de
  // estela, que se limpia y se vuelve a dibujar; para que la cuadrícula persista
  // usamos capas de fondo dedicadas cuando existan, o inertes en su defecto.
  const fondoReferencia = contextoDe(canvasFondoReferencia);
  const fondoJugador = contextoDe(canvasFondoJugador);

  const tamano = tamanoDe(canvasJugador);

  // Sincroniza el búfer de cada canvas con el escalado ANTES del primer dibujo:
  // sin esto, con densidad de píxeles > 1, el centro lógico queda descolocado y
  // la tortuga aparece en una esquina. Cada lado se mide por separado.
  function ajustarBuferesDeLado(lado: keyof typeof canvasLado, canvasMedida: HTMLCanvasElement | null): void {
    const escalado = calcularEscalado(tamanoDe(canvasMedida));
    for (const c of canvasLado[lado]) ajustarBuffer(c, escalado);
  }
  ajustarBuferesDeLado('referencia', canvasReferencia);
  ajustarBuferesDeLado('jugador', canvasJugador);
  ajustarBuferesDeLado('superposicion', canvasSuperposicion);

  // Lienzo del lado de la referencia (Kiro): estela en `referencia`, personajes
  // en `personajes`; la capa `jugador` no se usa aquí.
  const capasReferencia: CapasLienzo = {
    fondo: fondoReferencia,
    referencia: ctxReferencia,
    jugador: contextoInerte(),
    personajes: ctxPersonajesReferencia,
  };
  const lienzoReferencia: Lienzo = crearLienzo(capasReferencia, lectores.lienzo, tamanoDe(canvasReferencia));

  // Lienzo del lado del jugador: estela en `jugador`, personajes en `personajes`.
  const capasJugador: CapasLienzo = {
    fondo: fondoJugador,
    referencia: contextoInerte(),
    jugador: ctxJugador,
    personajes: ctxPersonajesJugador,
  };
  const lienzoJugador: Lienzo = crearLienzo(capasJugador, lectores.lienzo, tamanoDe(canvasJugador));

  // Animador del jugador: gobierna la capa `jugador` del lienzo del jugador.
  const animador = crearAnimador(lienzoJugador, reloj, () => movimiento.reducido());

  // Diff sobre el lienzo de superposición.
  const diff = crearDiff({ ctx: ctxSuperposicion, leerTema: lectores.diff });

  // Globo de Kiro.
  const globo: GloboKiro = crearGloboKiro({ contenedor, anunciar });

  // Editor.
  const editor: Editor = crearEditor({
    contenedor,
    mundo: reto.nivel.mundo,
    presupuestoEstrella: reto.presupuestoEstrella,
    pedirMensajeLimite: (limite: LimiteAlcanzado, _valor: number) => {
      void _valor;
      const error =
        limite === 'lineas'
          ? crearError('limiteLineasEditor', {})
          : crearError('limiteCaracteresEditor', {});
      globo.mostrarMensajes([error]);
    },
    reloj: deps.relojRebote,
  });

  // Panel de comandos: inserta ejemplos en el editor.
  const panel = crearPanelComandos({
    contenedor,
    mundo: reto.nivel.mundo,
    insertarEjemplo: (ejemplo: string) => editor.insertarEnCursor(ejemplo),
    anunciar,
  });
  void panel;

  // Comparación: dibuja las dos estelas superpuestas y el diff.
  function dibujarSuperposicion(referencia: readonly Segmento[], jugador: readonly Segmento[]): void {
    const estilo = lectores.lienzo();
    // Limpia y redibuja las dos estelas en el lienzo de superposición.
    ctxSuperposicion.save();
    ctxSuperposicion.setTransform(1, 0, 0, 1, 0, 0);
    ctxSuperposicion.clearRect(0, 0, tamano.anchoCss * tamano.devicePixelRatio, tamano.altoCss * tamano.devicePixelRatio);
    ctxSuperposicion.restore();
    dibujarEstelaEn(ctxSuperposicion, referencia, estilo.estelaReferencia);
    dibujarEstelaEn(ctxSuperposicion, jugador, estilo.estelaJugador);
  }
  const comparacion: Comparacion = crearComparacion({
    contenedor,
    diff,
    dibujarSuperposicion,
    anunciar,
  });

  // Demostración de la referencia.
  const demostracion: Demostracion = crearDemostracion({
    lienzo: {
      capaPersonajes: () => lienzoReferencia.capaPersonajes(),
      limpiarPersonajes: () => lienzoReferencia.limpiarPersonajes(),
      limpiarEstela: (capa) => lienzoReferencia.limpiarEstela(capa),
    },
    animador: crearAnimador(lienzoReferencia, reloj, () => movimiento.reducido()),
    operaciones: reto.operaciones,
    estadoInicial: ESTADO_INICIAL,
    leerTemaPersonajes: lectores.personajes,
    relojEspera,
    anunciar,
    avisarSinDemostracion: () => {
      // Un nivel sin operaciones no tiene demostración; se avisa por el globo.
      globo.celebrar('Este reto no tiene demostración que mostrar.');
    },
  });

  // Controles.
  const controles: Controles = crearControles({
    contenedor,
    callbacks: {
      ejecutar: () => ejecutarPrograma(),
      detener: () => detener(),
      darPaso: () => darPaso(),
      reiniciar: () => reiniciar(),
      verDemostracion: () => verDemostracion(),
      cambiarVelocidad: (v: Velocidad) => cambiarVelocidad(v),
    },
  });

  // ---- Estado de la aplicación ----
  let estadoApp: EstadoAplicacion = {
    reto,
    astJugador: null,
    operacionesJugador: [],
    veredicto: null,
    calificacion: null,
  };
  let ejecutando = false;

  // El lienzo de la referencia dibuja los objetivos del reto de una vez.
  lienzoReferencia.ponerEstela('referencia', reto.segmentos);

  // Presenta el reto en el globo y el editor.
  globo.presentarReto({
    idNivel: reto.nivel.id,
    semillaEfectiva: reto.semillaEfectiva,
    pistas: reto.nivel.pistas,
  });
  editor.presentarReto(reto.presupuestoEstrella);
  if (globo.texto().trim().length === 0) {
    globo.celebrar(`${reto.nivel.titulo}: escribe un programa que reproduzca la figura de Kiro.`);
  }

  // Personajes en el estado inicial sobre el lado del jugador.
  dibujarPersonajesEnInicial();

  // Aviso del progreso no guardable, si aplica (una sola vez, por el globo).
  // (El progreso ya informó por consola; aquí no se molesta al jugador.)

  // ---- Paso 5: lanzar la demostración una vez ----
  demostracion.reproducir();

  // ---- Paso 6: suscribirse al cambio de movimiento reducido ----
  const cancelarSuscripcion = movimiento.alCambiar(() => {
    // No recarga ni pierde el texto: el animador vuelve a consultar la
    // preferencia en cada reproducción; aquí solo se redibuja lo visible.
    lienzoJugador.redibujar();
    lienzoReferencia.redibujar();
  });

  // ---- Recalcular el escalado al cambiar de tamaño o de zoom ----
  // El zoom del navegador cambia el tamaño CSS del canvas y la densidad de
  // píxeles. Si no se remide, el búfer queda con el valor del arranque y el
  // centro se descoloca (la tortuga se va a una esquina a ciertos niveles de
  // zoom). Se remide cada lado, se reajusta su búfer y se redimensiona el
  // lienzo, que reaplica la transformación y redibuja desde los segmentos
  // guardados; luego se repintan los personajes en el estado inicial.
  const vistaGlobal = documento.defaultView;
  let idReajuste: number | null = null;
  function reajustarPorTamano(): void {
    ajustarBuferesDeLado('referencia', canvasReferencia);
    ajustarBuferesDeLado('jugador', canvasJugador);
    ajustarBuferesDeLado('superposicion', canvasSuperposicion);
    lienzoReferencia.redimensionar(tamanoDe(canvasReferencia));
    lienzoJugador.redimensionar(tamanoDe(canvasJugador));
    dibujarPersonajesEnInicial();
  }
  function alRedimensionar(): void {
    // Coalesce con requestAnimationFrame para no reajustar en cada evento.
    if (!vistaGlobal) {
      reajustarPorTamano();
      return;
    }
    if (idReajuste !== null) vistaGlobal.cancelAnimationFrame(idReajuste);
    idReajuste = vistaGlobal.requestAnimationFrame(() => {
      idReajuste = null;
      reajustarPorTamano();
    });
  }
  if (vistaGlobal && typeof vistaGlobal.addEventListener === 'function') {
    vistaGlobal.addEventListener('resize', alRedimensionar);
  }

  // ========================================================================
  // Funciones del flujo (diseño 12.5)
  // ========================================================================

  /** Dibuja los personajes en el estado inicial sobre el lado del jugador. */
  function dibujarPersonajesEnInicial(): void {
    lienzoJugador.limpiarPersonajes();
    const personajes: EstadoPersonajes = {
      tortuga: ESTADO_INICIAL,
      kiroMontado: true,
      inclinacionKiro: 0,
      identidad: 'jugador',
      celebracion: false,
    };
    dibujarPersonajes(lienzoJugador.capaPersonajes(), personajes, lectores.personajes);
  }

  /** Analiza el texto del jugador con el mundo del nivel. */
  function analizarTextoJugador(texto: string): {
    programa: Programa | null;
    errores: readonly ErrorKiroLogo[];
  } {
    const lexico = analizarLexico(texto);
    if (lexico.errores.length > 0) {
      return { programa: null, errores: lexico.errores };
    }
    const sintactico = analizar(lexico.tokens, { mundo: reto.nivel.mundo });
    return { programa: sintactico.programa, errores: sintactico.errores };
  }

  /**
   * Flujo de intento (diseño 12.5). Analiza; si hay errores muestra el globo con
   * el texto exacto y no toca nada más; si es correcto reinicia la capa del
   * jugador, ejecuta con el intérprete, extrae segmentos, valida UNA vez,
   * califica, guarda el progreso y comenta. Un único anuncio al terminar.
   */
  function ejecutarPrograma(): void {
    if (ejecutando) return;

    const texto = editor.texto();
    const { programa, errores } = analizarTextoJugador(texto);

    // Errores de análisis: mostrar el texto exacto, sin intérprete ni estrellas,
    // conservando el estado del intento.
    const erroresJugador = errores.filter(esErrorParaJugador);
    if (programa === null || erroresJugador.length > 0) {
      globo.mostrarMensajes(erroresJugador.length > 0 ? erroresJugador : errores);
      return;
    }

    // Programa correcto: cede la demostración y reinicia la capa del jugador.
    ejecutando = true;
    controles.marcarEjecucionEnCurso();
    if (demostracion.enCurso()) demostracion.cederAEjecucion();

    animador.reiniciar(ESTADO_INICIAL); // borra solo la capa del jugador

    // Ejecuta con el intérprete (consumiendo el generador hasta el final).
    const permitidos = comandosDelMundo(reto.nivel.mundo);
    const generador = ejecutar(programa, {
      estadoInicial: ESTADO_INICIAL,
      comandosPermitidos: permitidos,
      semilla: reto.semillaEfectiva,
    });
    let paso = generador.next();
    while (!paso.done) paso = generador.next();
    const resultadoEjecucion = paso.value;
    const operaciones = resultadoEjecucion.operaciones;

    // Extrae segmentos y valida UNA sola vez.
    const segmentos = extraerSegmentos(operaciones);

    let veredicto: Veredicto | null = null;
    let calificacion: Calificacion;
    if (resultadoEjecucion.guardaActivada !== null) {
      // Una guarda impide dibujar: se califica sin veredicto por causa de guarda.
      calificacion = calificar(programa, null, reto, 'guarda');
    } else {
      veredicto = validar(segmentos, reto.segmentos, reto.nivel.normalizacion);
      // Ejecuta y califica aunque supere el presupuesto.
      calificacion = calificar(programa, veredicto, reto);
    }

    // Anima la estela del jugador desde las operaciones ejecutadas.
    animador.cargar(operaciones, 'jugador');
    animador.reproducir();

    // Guarda el progreso ANTES de admitir otra ejecución.
    try {
      progreso.guardar(reto.nivel.id, reto.semillaEfectiva, calificacion);
    } catch (e) {
      console.error('No se pudo guardar el progreso.', e);
    }

    // Comenta la calificación y, si niega la precisión, muestra el diff.
    globo.comentarCalificacion(calificacion);
    comparacion.mostrar({
      segmentosReferencia: reto.segmentos,
      segmentosJugador: segmentos,
      veredicto,
    });

    // Actualiza el estado (veredicto y estrellas ya calculados, sin recalcular).
    estadoApp = {
      reto,
      astJugador: programa,
      operacionesJugador: operaciones,
      veredicto,
      calificacion,
    };

    // Un único anuncio aria-live al terminar, con motivo, nº de ops y estado.
    const fin: FinDeSecuencia = {
      motivo: resultadoEjecucion.guardaActivada !== null ? 'guarda' : 'finDeSecuencia',
      operacionesAplicadas: operaciones.length,
      estadoFinal:
        operaciones.length > 0 ? operaciones[operaciones.length - 1]!.estadoDespues : ESTADO_INICIAL,
    };
    anunciar(componerAnuncioFin(fin));

    controles.marcarFinDeSecuencia();
    ejecutando = false;
  }

  function detener(): void {
    animador.detener();
    ejecutando = false;
    controles.marcarDetenido();
  }

  function darPaso(): void {
    animador.paso();
  }

  function reiniciar(): void {
    animador.reiniciar(ESTADO_INICIAL);
    dibujarPersonajesEnInicial();
    ejecutando = false;
    controles.marcarFinDeSecuencia();
  }

  function verDemostracion(): void {
    demostracion.repetir();
  }

  function cambiarVelocidad(v: Velocidad): void {
    animador.ponerVelocidad(v);
    demostracion.ponerVelocidad(v);
    controles.seleccionarVelocidad(v);
  }

  /** Dibuja una estela en un contexto que ya tiene la transformación aplicada. */
  function dibujarEstelaEn(ctx: ContextoDibujo, segmentos: readonly Segmento[], trazo: TrazoTema): void {
    ctx.save();
    ctx.strokeStyle = trazo.color;
    ctx.lineWidth = trazo.grosor;
    ctx.setLineDash(trazo.guiones.length > 0 ? [...trazo.guiones] : []);
    ctx.beginPath();
    for (const s of segmentos) {
      ctx.moveTo(s.desde.x, s.desde.y);
      ctx.lineTo(s.hasta.x, s.hasta.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  return {
    estado: () => estadoApp,
    ejecutar: ejecutarPrograma,
    darPaso,
    reiniciar,
    verDemostracion,
    cambiarVelocidad,
    textoGlobo: () => globo.texto(),
    editor,
    globo,
    destruir: () => {
      cancelarSuscripcion();
      if (vistaGlobal && typeof vistaGlobal.removeEventListener === 'function') {
        vistaGlobal.removeEventListener('resize', alRedimensionar);
      }
      if (vistaGlobal && idReajuste !== null) vistaGlobal.cancelAnimationFrame(idReajuste);
    },
  };
}

// ============================================================================
// Arranque de producción (no se ejecuta al importar en Node)
// ============================================================================

if (typeof document !== 'undefined') {
  const iniciar = (): void => {
    try {
      const app = crearAplicacion({
        documento: document,
        almacen: (() => {
          try {
            return typeof localStorage !== 'undefined' ? localStorage : null;
          } catch {
            return null;
          }
        })(),
      });

      // Cablea el `<select id="velocidad">` a la aplicación, si existe.
      const selectorVelocidad = document.getElementById('velocidad') as HTMLSelectElement | null;
      if (selectorVelocidad) {
        selectorVelocidad.addEventListener('change', () => {
          app.cambiarVelocidad(velocidadDeValor(selectorVelocidad.value));
        });
      }
    } catch (e) {
      console.error('No se pudo iniciar KiroLogo.', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  } else {
    iniciar();
  }
}
