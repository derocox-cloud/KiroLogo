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

// Tipografías autoalojadas (OFL-1.1), empaquetadas por Vite como activos con hash del
// propio origen: así el documento servido no pide nada a un host de fuentes externo
// (requisito 6.4) y una CSP sin `unsafe-eval` ni orígenes de terceros sigue intacta.
// Bricolage Grotesque conserva el eje de peso (`index.css`, 200–800, cubre 400–800) y
// el eje de tamaño óptico (`opsz.css`); JetBrains Mono conserva el eje de peso
// (100–800, cubre 400/500/700). Los nombres de familia que declaran estos paquetes
// llevan sufijo «Variable» y tema.css los nombra así al frente de la pila de reserva.
import '@fontsource-variable/bricolage-grotesque/index.css';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/jetbrains-mono/index.css';

import type { Programa } from './lenguaje/ast.js';
import { analizarLexico } from './lenguaje/lexer.js';
import { analizar, nombresDeProcedimientos } from './lenguaje/parser.js';
import { esErrorParaJugador, crearError, type ErrorKiroLogo } from './lenguaje/errores.js';
import { comandosDelMundo } from './lenguaje/vocabulario.js';
import { ejecutar, type Operacion, type ResultadoEjecucion } from './lenguaje/interprete.js';

import { ESTADO_INICIAL } from './motor/tortuga.js';
import { extraerSegmentos, type Segmento } from './motor/segmentos.js';
import { validar, veredictoParaMostrar, type Veredicto } from './motor/validador.js';
import {
  crearLienzo,
  calcularEscalado,
  aplicarTransformacion,
  dibujarCuadricula,
  dibujarEstela,
  LADO_LOGICO,
  SEMILADO_LOGICO,
  type ContextoDibujo,
  type CapasLienzo,
  type EstiloLienzo,
  type LectorTema,
  type TamanoLienzo,
  type TrazoTema,
  type Lienzo,
  type Escalado,
} from './motor/lienzo.js';
import {
  crearAnimador,
  type Reloj,
  type Velocidad,
  type FinDeSecuencia,
  type Fotograma,
} from './motor/animador.js';
import {
  dibujarPersonajes,
  type EstiloPersonajes,
  type IdentidadTortuga,
  type LectorTemaPersonajes,
} from './motor/personajes.js';
import type { EstadoTortuga } from './motor/tortuga.js';

import { resolverReto, type Reto } from './juego/reto.js';
import { calificar, type Calificacion } from './juego/estrellas.js';
import { cargarProgreso, type Progreso } from './juego/progreso.js';
import { rellenarPistas } from './juego/pistas.js';
import { nivelDesbloqueado } from './juego/desbloqueo.js';
import { insigniaSecuenciaOtorgada } from './juego/insignias.js';
import { decodificar } from './azar/codigo-semilla.js';
import { CATALOGO } from './niveles/catalogo.js';

import { crearEditor, type Editor, type LimiteAlcanzado, type RelojRebote } from './ui/editor.js';
import { crearPanelComandos } from './ui/panel-comandos.js';
import { crearGloboKiro, type GloboKiro } from './ui/globo-kiro.js';
import { crearControles, type Controles } from './ui/controles.js';
import { crearDemostracion, type Demostracion, type RelojEspera } from './ui/demostracion.js';
import { crearPanelSemilla, type PanelSemilla } from './ui/panel-semilla.js';
import { crearMenuMundos, type MenuMundos } from './ui/menu-mundos.js';
import { crearGuia, type Guia } from './ui/guia.js';
import { crearMarcadorEstrellas, type MarcadorEstrellas } from './ui/marcador-estrellas.js';
import { crearDiff, type EstiloDiff, type LectorTemaDiff } from './ui/diff.js';
import { crearComparacion, type Comparacion } from './ui/comparacion.js';
import { compararOperaciones, type ResultadoParalelo } from './motor/divergencia.js';

// ============================================================================
// Constantes visuales
// ============================================================================

/**
 * Agrandado de la tortuga y Kiro sobre el lienzo. La geometría de `personajes.ts`
 * mide unas 25 unidades de largo en un espacio de 800: a tamaño de diseño la
 * tortuga queda en unos 13 px y no se lee como personaje. Es una decisión de
 * presentación, por eso vive aquí y no en el dibujo de los personajes.
 */
const ESCALA_PERSONAJES = 2.4;

/**
 * Cómo se dibujan, en la superposición, las estelas de fondo sobre las que el diff resalta:
 * finas, tenues y la de Kiro a trazos, para que lo que importa —lo que coincide, lo que sobra
 * y lo que falta— se lea encima sin que todo se amontone. Es una decisión de presentación,
 * por eso vive aquí y no en el tema.
 */
const GROSOR_ESTELA_DE_FONDO = 2.5;
const GUIONES_ESTELA_DE_FONDO_REFERENCIA: readonly number[] = [10, 8];
const OPACIDAD_ESTELA_DE_FONDO = 55; // por ciento

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
  /** Navega a un nivel (si está desbloqueado); con semilla opcional. */
  irANivel(idNivel: string, semilla?: number): void;
  /** Identificador del nivel en curso. */
  nivelEnCurso(): string;
  /** Texto en curso del globo de Kiro. */
  textoGlobo(): string;
  /** Editor, para inspección en pruebas. */
  readonly editor: Editor;
  /** Globo, para inspección en pruebas. */
  readonly globo: GloboKiro;
  /** Menú de mundos, para inspección en pruebas. */
  readonly menuMundos: MenuMundos;
  /** Panel de semilla, para inspección en pruebas. */
  readonly panelSemilla: PanelSemilla;
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
 * Lee un patrón de guiones del tema: `solid` (línea continua) o una palabra seguida del
 * largo del guion y del hueco en unidades lógicas, como `dashed 6 9`.
 */
function leerGuiones(
  estilo: CSSStyleDeclaration | null,
  nombre: string,
  reserva: readonly number[],
): readonly number[] {
  const bruto = leerVar(estilo, nombre, '');
  if (bruto.length === 0) return reserva;
  if (bruto === 'solid') return [];
  const largos = bruto.split(/\s+/).slice(1).map(Number);
  return largos.length >= 2 && largos.every((n) => Number.isFinite(n) && n > 0) ? largos : reserva;
}

/**
 * Fabrica los lectores de tema del lienzo y de los personajes a partir
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
        leerGrosor(e, '--grosor-diff-coincidencia', 5),
        leerGuiones(e, '--patron-diff-coincidencia', []),
      ),
      exceso: trazo(
        leerVar(e, '--color-diff-exceso', '#c53030'),
        leerGrosor(e, '--grosor-diff-exceso', 10),
        leerGuiones(e, '--patron-diff-exceso', []),
      ),
      falta: trazo(
        leerVar(e, '--color-diff-falta', '#5a6268'),
        leerGrosor(e, '--grosor-diff-falta', 5),
        leerGuiones(e, '--patron-diff-falta', [6, 9]),
      ),
    };
  };

  const personajes: LectorTemaPersonajes = (): EstiloPersonajes => {
    const e = raiz();
    // Opciones de presentación: si el tema no las define, el dibujo es el del diseño.
    const caparazon = leerVar(e, '--color-tortuga-caparazon', '');
    const detalle = leerVar(e, '--color-tortuga-detalle', '');
    const kiroOjos = leerVar(e, '--color-kiro-ojos', '');
    return {
      ...(caparazon.length > 0 ? { caparazon } : {}),
      ...(detalle.length > 0 ? { detalle } : {}),
      ...(kiroOjos.length > 0 ? { kiroOjos } : {}),
      mostrarLapiz: leerVar(e, '--lapiz-mostrar', 'siempre') === 'arriba' ? 'solo-arriba' : 'siempre',
      mostrarMarcaRumbo: leerVar(e, '--marca-rumbo-mostrar', 'si') !== 'no',
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
 * width/height pasa a ser el búfer (lado · dpr). Así la transformación del motor,
 * que centra en búfer/2, coincide con el canvas real. Los canvas inertes o nulos
 * se ignoran.
 *
 * No toca el tamaño en pantalla: lo manda el CSS (`.kl-capa` llena su cuadro). Fijar
 * aquí un ancho en píxeles congelaba el tamaño medido en el arranque, y al cambiar
 * la ventana el canvas quedaba más grande que su cuadro con el centro lógico fuera
 * de vista (la tortuga «en la esquina»).
 */
function ajustarBuffer(canvas: HTMLCanvasElement | null, escalado: Escalado): void {
  if (!canvas) return;
  const bufer = Math.round(escalado.bufer);
  if (canvas.width !== bufer) canvas.width = bufer;
  if (canvas.height !== bufer) canvas.height = bufer;
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

/**
 * Estado de la tortuga en palabras: posición redondeada al entero, rumbo redondeado
 * y reducido a 0–359 (un 359,6 no se anuncia como 360) y lápiz abajo o arriba.
 */
function textoEstadoTortuga(e: EstadoTortuga): string {
  const pos = `posición (${Math.round(e.posicion.x)}, ${Math.round(e.posicion.y)})`;
  const rumbo = `rumbo ${Math.round(e.rumbo) % 360}°`;
  return `${pos}, ${rumbo}, ${textoLapiz(e.lapizAbajo)}`;
}

/** Compone el anuncio final: motivo, nº de operaciones y estado de la tortuga. */
function componerAnuncioFin(fin: FinDeSecuencia): string {
  const motivo =
    fin.motivo === 'finDeSecuencia'
      ? 'Terminó tu programa'
      : fin.motivo === 'detenidoPorJugador'
        ? 'Detuviste tu programa'
        : 'Detuve tu programa por seguridad';
  return `${motivo}: ${fin.operacionesAplicadas} operación(es) aplicada(s); ${textoEstadoTortuga(fin.estadoFinal)}.`;
}

// ============================================================================
// Elección del reto inicial
// ============================================================================

/**
 * Decide con qué (idNivel, semilla) arranca la aplicación. Prioridad:
 *   1. `idNivelForzado` (lo pasan las pruebas): manda, con semilla 0.
 *   2. El último reto guardado, si su nivel está desbloqueado.
 *   3. El primer nivel desbloqueado sin aprobar.
 *   4. El 0.1, con semilla 0.
 */
function elegirRetoInicial(
  idNivelForzado: string | undefined,
  progreso: Progreso,
): { idNivel: string; semilla: number } {
  if (idNivelForzado !== undefined) return { idNivel: idNivelForzado, semilla: 0 };

  const ultimo = progreso.ultimoReto();
  if (ultimo !== null && nivelDesbloqueado(ultimo.idNivel, progreso)) {
    return { idNivel: ultimo.idNivel, semilla: ultimo.semilla };
  }

  for (const nivel of CATALOGO) {
    if (nivelDesbloqueado(nivel.id, progreso) && progreso.estrellasDe(nivel.id)?.precision !== true) {
      return { idNivel: nivel.id, semilla: 0 };
    }
  }

  return { idNivel: '0.1', semilla: 0 };
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

  // Ranuras que declara index.html para colocar cada pieza de ui/ donde el diseño
  // la quiere. Sin la ranura (pruebas, otros HTML) la pieza cae en el contenedor.
  const ranura = (id: string): HTMLElement => documento.getElementById(id) ?? contenedor;
  const centro = ranura('programa');

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

  // ---- Paso 2: elegir y resolver el reto inicial ----
  // Si `deps.idNivel` viene dado (pruebas), manda. Si no, se reanuda el último
  // reto guardado cuando está desbloqueado; en su defecto, el primer nivel
  // desbloqueado sin aprobar; y como último recurso, el 0.1.
  const inicio = elegirRetoInicial(deps.idNivel, progreso);
  const resultado = resolverReto(inicio.idNivel, inicio.semilla);
  if (!resultado.exito) {
    // Fallo de programación: se registra y se detiene el arranque con seguridad.
    console.error('No se pudo resolver el reto inicial:', resultado.error.mensaje);
    throw new Error(`Reto inicial no resoluble: ${resultado.error.id}`);
  }
  let reto = resultado.reto;

  // ---- Paso 3: lienzos, animador y los siete módulos de ui/ ----
  const q = (id: string): HTMLCanvasElement | null =>
    documento.getElementById(id) as HTMLCanvasElement | null;

  // Elementos canvas por capa y lado (para dimensionar sus búferes).
  const canvasReferencia = q('lienzo-referencia');
  const canvasJugador = q('lienzo-jugador');
  const canvasPersonajesReferencia = q('lienzo-personajes-referencia');
  const canvasPersonajesJugador = q('lienzo-personajes-jugador');
  const canvasFondoReferencia = q('lienzo-fondo-referencia');
  const canvasFondoJugador = q('lienzo-fondo-jugador');
  // La superposición cubre la figura del jugador cuando se compara con la de Kiro.
  const canvasSuperposicion = q('lienzo-superposicion');

  const canvasLado = {
    referencia: [canvasFondoReferencia, canvasReferencia, canvasPersonajesReferencia],
    jugador: [canvasFondoJugador, canvasJugador, canvasPersonajesJugador, canvasSuperposicion],
  } as const;

  const ctxReferencia = contextoDe(canvasReferencia);
  const ctxSuperposicion = contextoDe(canvasSuperposicion);
  const ctxJugador = contextoDe(canvasJugador);
  const ctxPersonajesReferencia = contextoDe(canvasPersonajesReferencia);
  const ctxPersonajesJugador = contextoDe(canvasPersonajesJugador);

  // Un fondo inerte por lado: la cuadrícula se dibuja sobre la propia capa de
  // estela, que se limpia y se vuelve a dibujar; para que la cuadrícula persista
  // usamos capas de fondo dedicadas cuando existan, o inertes en su defecto.
  const fondoReferencia = contextoDe(canvasFondoReferencia);
  const fondoJugador = contextoDe(canvasFondoJugador);

  // Sincroniza el búfer de cada canvas con el escalado ANTES del primer dibujo:
  // sin esto, con densidad de píxeles > 1, el centro lógico queda descolocado y
  // la tortuga aparece en una esquina. Cada lado se mide por separado.
  function ajustarBuferesDeLado(lado: keyof typeof canvasLado, canvasMedida: HTMLCanvasElement | null): void {
    const escalado = calcularEscalado(tamanoDe(canvasMedida));
    for (const c of canvasLado[lado]) ajustarBuffer(c, escalado);
  }
  ajustarBuferesDeLado('referencia', canvasReferencia);
  ajustarBuferesDeLado('jugador', canvasJugador);

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

  // Lo último que se pintó de la tortuga del jugador, para repintarla igual cuando
  // el lienzo cambia de tamaño (al cambiar el búfer del canvas se borra).
  let estadoTortugaJugador: EstadoTortuga = ESTADO_INICIAL;

  /**
   * Pinta un fotograma de la animación sobre la capa de personajes: primero el
   * tramo de estela que la tortuga lleva recorrido en la operación en curso (esa
   * capa se borra en cada fotograma, así que no deja rastro; la estela definitiva
   * la crece el animador al terminar la operación) y encima la tortuga.
   */
  function pintarFotograma(
    lienzo: Lienzo,
    f: Fotograma,
    identidad: IdentidadTortuga,
    trazo: TrazoTema,
  ): void {
    lienzo.limpiarPersonajes();
    const ctx = lienzo.capaPersonajes();
    if (f.tramo !== null) {
      ctx.save();
      // Mismo recorte que la estela definitiva, para que el tramo no asome por
      // fuera del cuadrado lógico y luego desaparezca.
      ctx.beginPath();
      ctx.rect(-SEMILADO_LOGICO, -SEMILADO_LOGICO, LADO_LOGICO, LADO_LOGICO);
      ctx.clip();
      ctx.strokeStyle = trazo.color;
      ctx.lineWidth = trazo.grosor;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(f.tramo.desde.x, f.tramo.desde.y);
      ctx.lineTo(f.tramo.hasta.x, f.tramo.hasta.y);
      ctx.stroke();
      ctx.restore();
    }
    dibujarPersonajes(
      ctx,
      {
        tortuga: f.estado,
        kiroMontado: true,
        inclinacionKiro: 0,
        identidad,
        celebracion: false,
        escala: ESCALA_PERSONAJES,
      },
      lectores.personajes,
    );
  }

  animador.alFotograma((f) => {
    estadoTortugaJugador = f.estado;
    pintarFotograma(lienzoJugador, f, 'jugador', lectores.lienzo().estelaJugador);
  });

  // La línea que se está ejecutando se resalta en el editor, así el jugador ve
  // qué instrucción produce cada movimiento de la tortuga. Se evita reconstruir la
  // canaleta cuando la línea no cambia (un bucle repite la misma muchas veces).
  let lineaResaltada = 0;
  function resaltarLinea(linea: number): void {
    if (linea === lineaResaltada) return;
    lineaResaltada = linea;
    editor.resaltarLinea(linea);
  }

  // Solo el paso a paso anuncia cada operación (requisito 28.2): una reproducción
  // continua anuncia únicamente su final (28.9), no cada paso intermedio.
  let modoPaso = false;
  animador.alAplicar((op) => {
    resaltarLinea(op.linea);
    if (modoPaso) anunciar(`Línea ${op.linea}: ${textoEstadoTortuga(op.estadoDespues)}.`);
  });

  // Globo de Kiro.
  const globo: GloboKiro = crearGloboKiro({ contenedor: centro, anunciar });

  // Editor.
  const editor: Editor = crearEditor({
    contenedor: centro,
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


  // Panel de comandos: inserta el texto de inserción de cada comando en el editor.
  const panel = crearPanelComandos({
    contenedor: centro,
    mundo: reto.nivel.mundo,
    insertarTexto: (t: string) => editor.insertarEnCursor(t),
    anunciar,
  });

  // Mantener el panel al día con los procedimientos que el jugador define en el
  // texto: en cada cambio se tokeniza y se obtienen los nombres válidos (los PARA
  // … FIN bien formados, en orden de definición) para reflejar altas, bajas y
  // renombres (R7.3, R7.4). Se usa la primera pasada del parser por los tokens, no
  // el AST completo: así los procedimientos bien formados aparecen aunque el resto
  // del programa todavía tenga errores mientras el jugador escribe. El panel ignora
  // una lista igual a la vigente, así que esto no reconstruye en cada tecla.
  editor.alCambiar((texto: string) => {
    const lexico = analizarLexico(texto);
    panel.fijarProcedimientos(nombresDeProcedimientos(lexico.tokens));
  });

  // El panel de comandos se crea ANTES que los controles: va junto al editor (a su
  // derecha) y los controles debajo, y el orden del DOM es el orden de Tab. El panel es
  // una sola parada de Tab (flechas dentro), así «Ejecutar» queda a 2 Tabs del editor
  // (requisitos 24.5 y 28.1).

  // Controles.
  const controles: Controles = crearControles({
    contenedor: centro,
    callbacks: {
      ejecutar: () => ejecutarPrograma(),
      detener: () => detener(),
      darPaso: () => darPaso(),
      reiniciar: () => reiniciar(),
      verDemostracion: () => verDemostracion(),
      cambiarVelocidad: (v: Velocidad) => cambiarVelocidad(v),
    },
  });

  // ---- Comparación con Kiro: superposición y diff (requisitos 23 y 27.5) ----
  // «Lado a lado» es la propia pantalla (la figura de Kiro y la tuya). La otra vista pone las
  // dos estelas en un solo lienzo, que cubre la figura del jugador, y encima el diff.

  /**
   * Pinta la superposición: el fondo y la cuadrícula (que tapan la figura del jugador) y las
   * dos estelas como guía, finas y tenues, la de Kiro a trazos y la tuya continua. El diff va
   * encima, más grueso, así lo que importa se lee sin que todo se amontone.
   */
  function dibujarSuperposicion(referencia: readonly Segmento[], jugador: readonly Segmento[]): void {
    const estilo = lectores.lienzo();
    const ctx = ctxSuperposicion;
    // El búfer de este canvas es el mismo cuadrado lógico que el de las demás capas.
    aplicarTransformacion(ctx, lienzoJugador.escaladoActual());
    ctx.save();
    ctx.fillStyle = estilo.fondo.color;
    ctx.beginPath();
    ctx.rect(-SEMILADO_LOGICO, -SEMILADO_LOGICO, LADO_LOGICO, LADO_LOGICO);
    ctx.fill();
    ctx.restore();
    dibujarCuadricula(ctx, estilo);
    const tenue = (color: string): string =>
      `color-mix(in srgb, ${color} ${OPACIDAD_ESTELA_DE_FONDO}%, transparent)`;
    dibujarEstela(ctx, referencia, {
      color: tenue(estilo.estelaReferencia.color),
      grosor: GROSOR_ESTELA_DE_FONDO,
      guiones: GUIONES_ESTELA_DE_FONDO_REFERENCIA,
    });
    dibujarEstela(ctx, jugador, {
      color: tenue(estilo.estelaJugador.color),
      grosor: GROSOR_ESTELA_DE_FONDO,
      guiones: [],
    });
  }

  // El anuncio de la comparación (23.7) y el del fin del programa (28.9) van por la misma
  // región aria-live, y el segundo borraría al primero. La comparación deja aquí su texto y
  // `concluirIntento` lo publica junto con el del fin, en un solo anuncio.
  let anuncioComparacion = '';

  const diff = crearDiff({ ctx: ctxSuperposicion, leerTema: lectores.diff });
  const comparacion: Comparacion = crearComparacion({
    contenedor: ranura('ranura-comparacion'),
    contenedorLeyenda: ranura('ranura-leyenda'),
    diff,
    dibujarSuperposicion,
    anunciar: (texto) => {
      anuncioComparacion = texto;
    },
    alCambiarVista: (vista) => {
      if (canvasSuperposicion) canvasSuperposicion.hidden = vista !== 'superposicion';
    },
  });

  // Marcador de las tres estrellas del intento, bajo el lienzo del jugador.
  const marcador: MarcadorEstrellas = crearMarcadorEstrellas({ contenedor: ranura('ranura-marcador') });

  // Demostración de la referencia. Se (re)crea en `montarReto`, porque captura
  // las operaciones del reto en curso; aquí solo se declara la referencia.
  let demostracion: Demostracion | null = null;

  /** Crea una demostración para el reto en curso sobre el lienzo de la referencia. */
  function crearDemostracionDelReto(): Demostracion {
    const animadorDemo = crearAnimador(lienzoReferencia, reloj, () => movimiento.reducido());
    animadorDemo.alFotograma((f) =>
      pintarFotograma(lienzoReferencia, f, 'kiro', lectores.lienzo().estelaReferencia),
    );
    return crearDemostracion({
      lienzo: {
        capaPersonajes: () => lienzoReferencia.capaPersonajes(),
        limpiarPersonajes: () => lienzoReferencia.limpiarPersonajes(),
        limpiarEstela: (capa) => lienzoReferencia.limpiarEstela(capa),
      },
      animador: animadorDemo,
      operaciones: reto.operaciones,
      estadoInicial: ESTADO_INICIAL,
      leerTemaPersonajes: lectores.personajes,
      escalaPersonajes: ESCALA_PERSONAJES,
      relojEspera,
      anunciar,
      avisarSinDemostracion: () => {
        globo.celebrar('Este reto no tiene demostración que mostrar.');
      },
    });
  }

  // Panel de semilla: pide otro reto o reproduce un código, por callbacks.
  const panelSemilla: PanelSemilla = crearPanelSemilla({
    contenedor: ranura('ranura-reto'),
    callbacks: {
      pedirOtroReto: () => pedirOtroReto(),
      reproducirCodigo: (codigo: string) => reproducirCodigo(codigo),
    },
  });

  // Menú de mundos: navega entre los seis mundos y sus niveles.
  const menuMundos: MenuMundos = crearMenuMundos({
    contenedor: ranura('ranura-ruta'),
    progreso,
    callbacks: { alElegirNivel: (id: string) => cambiarANivel(id) },
  });

  // Guía de primeros pasos: solo se instancia para el 0.1 no completado.
  let guia: Guia | null = null;

  // ---- Estado de la aplicación ----
  let estadoApp: EstadoAplicacion = {
    reto,
    astJugador: null,
    operacionesJugador: [],
    veredicto: null,
    calificacion: null,
  };
  let ejecutando = false;

  // El intento que se está dibujando. Se evalúa —segmentos, validación, estrellas,
  // progreso y comentario de Kiro— cuando el animador devuelve el fin de secuencia
  // (diseño 12.5, requisito 24.8), no antes: calificar al ejecutar anunciaría la
  // respuesta mientras la tortuga aún camina, y obligaría a otorgar estrellas de
  // un intento que el jugador va a detener.
  interface IntentoEnCurso {
    readonly reto: Reto;
    readonly programa: Programa;
    readonly resultado: ResultadoEjecucion;
  }
  let intento: IntentoEnCurso | null = null;

  animador.alTerminar((fin) => {
    const actual = intento;
    resaltarLinea(0);
    ejecutando = false;
    controles.marcarFinDeSecuencia();
    // Al terminar la tortuga vuelve al punto inicial, como la de Kiro al acabar su
    // demostración (requisito 22.2). Agrandada, si se quedara en el final taparía la
    // punta del trazo, que es lo que el jugador quiere ver. El anuncio del final
    // sigue diciendo dónde terminó (`fin.estadoFinal`). Esto cambia lo que dice el
    // requisito 14.8 para la ejecución del jugador (dejarla en el estado final).
    dibujarPersonajesEnInicial();

    if (fin.motivo === 'detenidoPorJugador') {
      // Requisito 24.7: detener no otorga ninguna estrella de ese intento ni muestra
      // ningún mensaje del catálogo, porque la detención la pidió el jugador. Solo
      // se anuncia (28.9) que se detuvo y cómo quedó la tortuga.
      intento = null;
      anunciar(componerAnuncioFin(fin));
      return;
    }
    if (actual === null) {
      // Un paso a paso sobre un intento ya evaluado: no hay nada que evaluar de nuevo,
      // pero llegar al final se anuncia igual (28.9).
      anunciar(componerAnuncioFin(fin));
      return;
    }
    intento = null;
    concluirIntento(actual, fin);
  });

  // ---- Montar el reto inicial y lanzar su demostración una vez (paso 5) ----
  // Si es el 0.1 y la guía no se completó, se instancia y arranca la guía, que
  // publica sus mensajes por el globo en lugar del saludo normal.
  const mostrarGuia = reto.nivel.id === '0.1' && !progreso.guiaCompletada();
  if (mostrarGuia) {
    guia = crearGuia({
      globo,
      alCompletar: () => progreso.marcarGuiaCompletada(),
    });
  }
  montarReto({ lanzarDemostracion: true, saludar: !mostrarGuia });
  if (guia) guia.iniciar();

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
    lienzoReferencia.redimensionar(tamanoDe(canvasReferencia));
    lienzoJugador.redimensionar(tamanoDe(canvasJugador));
    // Cambiar el búfer borra el canvas: se repinta la tortuga del jugador donde
    // estaba y la de Kiro en el inicio (si una demostración está en marcha, su
    // siguiente fotograma la coloca en su sitio), y la superposición si está a la vista.
    pintarTortugaJugador(estadoTortugaJugador);
    pintarTortugaReferenciaEnInicial();
    comparacion.redibujar();
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
  // El tamaño de un cuadro de lienzo puede cambiar sin que cambie la ventana (al
  // reacomodarse la cuadrícula, al cargar la tipografía), y el zoom del navegador
  // lo cambia aunque `resize` no se entere a tiempo: se observan los cuadros.
  const observadorTamano =
    vistaGlobal && typeof vistaGlobal.ResizeObserver === 'function'
      ? new vistaGlobal.ResizeObserver(() => alRedimensionar())
      : null;
  if (observadorTamano) {
    for (const c of [canvasReferencia, canvasJugador]) {
      if (c?.parentElement) observadorTamano.observe(c.parentElement);
    }
  }

  // ========================================================================
  // Funciones del flujo (diseño 12.5)
  // ========================================================================

  /**
   * Monta el reto en curso: dibuja su figura de referencia, reinicia la capa del
   * jugador, (re)crea la demostración, presenta las pistas ya rellenadas y el
   * presupuesto en el editor, y actualiza el panel de semilla. Opcionalmente
   * saluda por el globo y lanza la demostración.
   */
  function montarReto(opciones: { lanzarDemostracion: boolean; saludar: boolean }): void {
    // Cede cualquier demostración anterior y crea la del reto en curso.
    if (demostracion && demostracion.enCurso()) demostracion.cederAEjecucion();
    demostracion = crearDemostracionDelReto();

    // Con demostración, la figura de Kiro se dibuja en vivo desde un lienzo vacío:
    // si ya estuviera completa, la demostración no mostraría nada nuevo. Sin ella
    // (un reto sin operaciones que reproducir), se pone la figura de una vez.
    if (opciones.lanzarDemostracion) lienzoReferencia.limpiarEstela('referencia');
    else lienzoReferencia.ponerEstela('referencia', reto.segmentos);
    animador.reiniciar(ESTADO_INICIAL);
    resaltarLinea(0);
    dibujarPersonajesEnInicial();
    pintarTortugaReferenciaEnInicial();

    // Pistas rellenadas con los parámetros reales del reto (generados) o fijas
    // (autorados), y presupuesto en el editor.
    const pistas = rellenarPistas(reto.nivel, reto);
    globo.presentarReto({
      idNivel: reto.nivel.id,
      semillaEfectiva: reto.semillaEfectiva,
      pistas,
    });
    editor.presentarReto(reto.presupuestoEstrella);
    // Sincroniza el mundo del análisis y del vocabulario con el nivel en curso.
    // montarReto corre en el arranque y en cada cambiarANivel, así que el mundo
    // queda siempre al día; en el primer montaje es un no-op porque ya coincide.
    editor.fijarMundo(reto.nivel.mundo);
    panel.fijarMundo(reto.nivel.mundo);

    // Panel de semilla: el código y si el nivel admite otro reto.
    panelSemilla.presentarReto({
      codigoSemilla: reto.codigoSemilla,
      generado: reto.nivel.origen.tipo === 'generado',
    });

    menuMundos.marcarActual(reto.nivel.id);

    if (opciones.saludar && globo.texto().trim().length === 0) {
      globo.celebrar(`${reto.nivel.titulo}: escribe un programa que reproduzca la figura de Kiro.`);
    }

    if (opciones.lanzarDemostracion && demostracion) demostracion.reproducir();
  }

  /**
   * Cambia al nivel pedido. Si no está desbloqueado, avisa por el globo y no
   * entra. Si una semilla se pasa, se usa (reproducir un código); si no, el
   * generador trae un reto nuevo (y el autorado usa su semilla fija). Reinicia
   * el intento y refresca el selector.
   */
  function cambiarANivel(idNivel: string, semilla?: number): void {
    if (!nivelDesbloqueado(idNivel, progreso)) {
      globo.celebrar('Ese nivel todavía está bloqueado. Aprueba el anterior para abrirlo.');
      return;
    }
    const sem = semilla ?? semillaNuevaParaNivel(idNivel);
    const r = resolverReto(idNivel, sem);
    if (!r.exito) {
      // Fallo de programación: no debería ocurrir con el catálogo real.
      console.error('No se pudo resolver el nivel', idNivel, r.error.mensaje);
      return;
    }
    // Un intento a medio dibujar del nivel anterior se descarta: ni se evalúa ni
    // revela nada en el nivel nuevo. `montarReto` reinicia el animador, que corta la
    // reproducción sin avisar de ningún fin.
    intento = null;
    modoPaso = false;
    reto = r.reto;
    estadoApp = { reto, astJugador: null, operacionesJugador: [], veredicto: null, calificacion: null };
    ejecutando = false;
    controles.marcarFinDeSecuencia();
    marcador.restablecer();
    comparacion.restablecer();
    // Entrar a un nivel lo hace el «último reto», para que una recarga lo reanude.
    try {
      progreso.marcarUltimoReto(reto.nivel.id, reto.semillaEfectiva);
    } catch (e) {
      console.error('No se pudo registrar el último reto.', e);
    }
    montarReto({ lanzarDemostracion: true, saludar: true });
    menuMundos.refrescar();
  }

  /** Pide otro reto del mismo nivel (solo tiene efecto en niveles generados). */
  function pedirOtroReto(): void {
    if (reto.nivel.origen.tipo !== 'generado') return;
    cambiarANivel(reto.nivel.id, semillaNuevaParaNivel(reto.nivel.id));
  }

  /**
   * Reproduce el reto de un código introducido. Decodifica con `codigo-semilla`;
   * si el código es inválido, muestra el error del catálogo por el globo sin
   * cambiar el reto en curso (requisito 9.4).
   */
  function reproducirCodigo(codigo: string): void {
    const resultado = decodificar(codigo);
    if (!resultado.exito) {
      globo.mostrarMensajes([resultado.error]);
      return;
    }
    cambiarANivel(reto.nivel.id, resultado.semilla);
  }

  /** El id del nivel que sigue a `idNivel` en el orden del catálogo, o null. */
  function idSiguienteNivel(idNivel: string): string | null {
    const i = CATALOGO.findIndex((n) => n.id === idNivel);
    if (i < 0 || i + 1 >= CATALOGO.length) return null;
    return CATALOGO[i + 1]!.id;
  }

  /**
   * Deriva una semilla nueva para pedir otro reto de un nivel. Sale del reloj de
   * animación (entropía de arranque documentada), acotada al dominio de semillas.
   */
  function semillaNuevaParaNivel(_idNivel: string): number {
    void _idNivel;
    const t = Math.floor(reloj.ahora() * 1000);
    const dominio = 4_294_967_295 + 1;
    return ((t % dominio) + dominio) % dominio;
  }

  /** Pinta la tortuga del jugador en un estado, sin tramo de estela en curso. */
  function pintarTortugaJugador(estado: EstadoTortuga): void {
    estadoTortugaJugador = estado;
    pintarFotograma(lienzoJugador, { estado, tramo: null }, 'jugador', lectores.lienzo().estelaJugador);
  }

  /** Dibuja los personajes en el estado inicial sobre el lado del jugador. */
  function dibujarPersonajesEnInicial(): void {
    pintarTortugaJugador(ESTADO_INICIAL);
  }

  /** Pinta a Kiro y su tortuga en el inicio del lado de la referencia. */
  function pintarTortugaReferenciaEnInicial(): void {
    pintarFotograma(
      lienzoReferencia,
      { estado: ESTADO_INICIAL, tramo: null },
      'kiro',
      lectores.lienzo().estelaReferencia,
    );
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
    if (demostracion && demostracion.enCurso()) demostracion.cederAEjecucion();

    animador.reiniciar(ESTADO_INICIAL); // borra solo la capa del jugador
    resaltarLinea(0);
    marcador.restablecer();
    // Un intento nuevo vuelve a la vista normal para que se vea caminar a la tortuga.
    comparacion.restablecer();
    dibujarPersonajesEnInicial();

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

    // El intento queda pendiente de evaluación hasta que termine de dibujarse. Lo que
    // ya se sabe de él (programa y operaciones) se publica en el estado desde ahora;
    // el veredicto y las estrellas, solo al concluir.
    intento = { reto, programa, resultado: resultadoEjecucion };
    estadoApp = {
      reto,
      astJugador: programa,
      operacionesJugador: operaciones,
      veredicto: null,
      calificacion: null,
    };
    modoPaso = false;

    // Anima el intento. Con movimiento reducido, velocidad inmediata o sin
    // operaciones el animador termina aquí mismo y el intento se concluye al
    // instante; si no, `ejecutando` y los controles siguen «en curso» hasta el
    // último fotograma, así «Detener» sirve mientras la tortuga camina.
    animador.cargar(operaciones, 'jugador');
    animador.reproducir();
  }

  /**
   * Concluye un intento cuando el animador devolvió el fin de secuencia (diseño 12.5):
   * extrae los segmentos, valida UNA vez, califica, guarda el progreso y lo muestra.
   * Si una guarda cortó la ejecución no hay veredicto ni estrellas: se muestra el
   * mensaje de la guarda y no se guarda nada (requisito 24.9).
   */
  function concluirIntento(actual: IntentoEnCurso, fin: FinDeSecuencia): void {
    if (actual.reto !== reto) return;
    const { programa, resultado } = actual;
    const operaciones = resultado.operaciones;

    if (resultado.guardaActivada !== null) {
      if (resultado.error !== null) globo.mostrarMensajes([resultado.error]);
      anunciar(componerAnuncioFin({ ...fin, motivo: 'guarda', operacionesAplicadas: operaciones.length }));
      return;
    }

    // Extrae segmentos y valida UNA sola vez.
    const segmentos = extraerSegmentos(operaciones);
    const veredicto: Veredicto = validar(segmentos, reto.segmentos, reto.nivel.normalizacion);
    // Califica aunque supere el presupuesto: ese programa corrió y se vio.
    const calificacion: Calificacion = calificar(programa, veredicto, reto);

    // ¿Estaba la insignia Secuencia otorgada ANTES de este guardado? Para saber
    // si este intento es el que la completa.
    const insigniaAntes = insigniaSecuenciaOtorgada(progreso);
    const siguiente = idSiguienteNivel(reto.nivel.id);
    const siguienteDesbloqueadoAntes = siguiente !== null && nivelDesbloqueado(siguiente, progreso);

    // Guarda el progreso. El conteo del jugador alimenta el mejor conteo del nivel
    // (solo baja, y solo con precisión).
    try {
      progreso.guardar(reto.nivel.id, reto.semillaEfectiva, calificacion, calificacion.conteoJugador);
    } catch (e) {
      console.error('No se pudo guardar el progreso.', e);
    }

    // Si la guía estaba activa y este intento acertó, cede a la celebración.
    if (guia && guia.activa && calificacion.precision.otorgada) {
      guia.alPrimerAcierto();
    }

    // Actualiza el estado (veredicto y estrellas ya calculados, sin recalcular).
    estadoApp = { reto, astJugador: programa, operacionesJugador: operaciones, veredicto, calificacion };

    // Muestra las estrellas y el comentario de Kiro.
    marcador.mostrar(calificacion);

    // Si la precisión se niega, compara los dos recorridos para señalar, bajo el
    // lienzo, el primer paso donde se separaron (lo muestra `comparacion`).
    // Reutiliza las operaciones ya ejecutadas: no vuelve a parsear ni ejecutar.
    let divergencia: ResultadoParalelo | null = null;
    if (veredicto !== null && !veredicto.coincide) {
      divergencia = compararOperaciones(reto.operaciones, operaciones);
    }

    // Comenta la calificación y, si niega la precisión, muestra el diff y, bajo
    // el lienzo, dónde se separaron los dos recorridos.
    globo.comentarCalificacion(calificacion);

    // Compara con la figura de Kiro: si la precisión se niega, pasa solo a la superposición y
    // pinta el diff (requisitos 23.3 y 27.5). Las estrellas salieron del veredicto oficial; el
    // diff pinta la comparación que mejor explica el dibujo (en su sitio o alineada), para no
    // marcar como sobrante lo que en pantalla coincide con Kiro.
    anuncioComparacion = '';
    comparacion.mostrar({
      segmentosReferencia: reto.segmentos,
      segmentosJugador: segmentos,
      veredicto: veredictoParaMostrar(veredicto, segmentos, reto.segmentos, reto.nivel.normalizacion),
      divergencia,
    });

    // Refresca el menú (estados e insignia) con el progreso ya guardado.
    menuMundos.refrescar();

    // Si este intento completó la insignia Secuencia, lo comunica por el globo.
    if (!insigniaAntes && insigniaSecuenciaOtorgada(progreso)) {
      globo.celebrar('¡Insignia Secuencia! Completaste el mundo 0 con las tres estrellas en los cinco niveles.');
    }

    // Si al aprobar se desbloqueó el nivel siguiente, ofrece avanzar (sin forzar).
    if (
      calificacion.precision.otorgada &&
      siguiente !== null &&
      !siguienteDesbloqueadoAntes &&
      nivelDesbloqueado(siguiente, progreso)
    ) {
      anunciar(`Desbloqueaste el nivel ${siguiente}. Elígelo en la lista cuando quieras continuar.`);
    }

    // Un único anuncio aria-live al terminar, con motivo, nº de ops y estado y, si hay
    // comparación, el IoU y el exceso (28.9 y 23.7 comparten la misma región).
    anunciar(
      [componerAnuncioFin({ ...fin, operacionesAplicadas: operaciones.length }), anuncioComparacion]
        .filter((texto) => texto.length > 0)
        .join(' '),
    );
    anuncioComparacion = '';
  }

  function detener(): void {
    // El animador avisa del fin con el motivo «detenido por el jugador»; el aviso
    // descarta el intento sin otorgar estrellas (ver `animador.alTerminar`).
    animador.detener();
    ejecutando = false;
    controles.marcarDetenido();
  }

  function darPaso(): void {
    // Desde aquí cada operación aplicada se anuncia por aria-live (28.2). Si el paso
    // llega a la última operación, el animador avisa del fin y el intento pendiente
    // se concluye como cualquier otro (24.8).
    modoPaso = true;
    animador.paso();
  }

  function reiniciar(): void {
    animador.reiniciar(ESTADO_INICIAL);
    resaltarLinea(0);
    dibujarPersonajesEnInicial();
    modoPaso = false;
    ejecutando = false;
    controles.marcarFinDeSecuencia();
    // El intento pendiente se conserva, como la secuencia de operaciones (14.5): si
    // el jugador la recorre otra vez, paso a paso, hasta el final, se evalúa. Reiniciar
    // por sí solo no otorga nada.
  }

  function verDemostracion(): void {
    if (demostracion) demostracion.repetir();
  }

  function cambiarVelocidad(v: Velocidad): void {
    animador.ponerVelocidad(v);
    if (demostracion) demostracion.ponerVelocidad(v);
    controles.seleccionarVelocidad(v);
  }

  return {
    estado: () => estadoApp,
    ejecutar: ejecutarPrograma,
    darPaso,
    reiniciar,
    verDemostracion,
    cambiarVelocidad,
    irANivel: (idNivel: string, semilla?: number) => cambiarANivel(idNivel, semilla),
    nivelEnCurso: () => reto.nivel.id,
    textoGlobo: () => globo.texto(),
    editor,
    globo,
    menuMundos,
    panelSemilla,
    destruir: () => {
      cancelarSuscripcion();
      observadorTamano?.disconnect();
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
