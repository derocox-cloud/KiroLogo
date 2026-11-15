// Lienzo de KiroLogo: espacio lógico de 800 × 800, cuadrícula, cuatro capas y estelas.
// Sin literales de color ni de grosor: todo sale del tema, leído por una función
// inyectable. Las dependencias del DOM entran por parámetro, así que el núcleo
// lógico se prueba en Node con un doble de dibujo, sin jsdom.
//
// El eje vertical se invierte una sola vez, en `aplicarTransformacion`, con la
// `y` negativa de `setTransform`. A partir de ahí todo el dibujo del proyecto
// usa coordenadas lógicas con `y` hacia arriba.

import type { Segmento } from './segmentos.js';
import type { Color } from '../lenguaje/colores.js';
import type { Punto } from './tortuga.js';
import { calcularRelleno, type Corrida } from './relleno.js';
import {
  SIN_ESTILO,
  cssDeColor,
  mismoEstilo,
  trazoDeTramo,
  type EstiloPedido,
  type TramoDibujo,
} from './tramos-dibujo.js';

// ============================================================================
// 7.2 · ContextoDibujo — la costura de dibujo
// ============================================================================

/**
 * Subconjunto estructural de `CanvasRenderingContext2D`, derivado con `Pick` para
 * que un contexto real lo satisfaga por construcción. Los tipos del DOM existen
 * porque `tsconfig.json` declara `"lib": ["ES2023", "DOM"]`; los globales del DOM
 * no existen en Node, que es lo que exige el requisito 29.10.
 */
export type ContextoDibujo = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'setTransform'
  | 'translate'
  | 'rotate'
  | 'scale'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'quadraticCurveTo'
  | 'bezierCurveTo'
  | 'arc'
  | 'ellipse'
  | 'rect'
  | 'clip'
  | 'fill'
  | 'stroke'
  | 'clearRect'
  | 'setLineDash'
  | 'lineWidth'
  | 'lineCap'
  | 'lineJoin'
  | 'strokeStyle'
  | 'fillStyle'
  | 'fillText'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
>;

// ============================================================================
// Constantes del espacio lógico
// ============================================================================

/** Lado del espacio lógico, en unidades. */
export const LADO_LOGICO = 800;

/** Semilado: los ejes van de −400 a 400 inclusive. */
export const SEMILADO_LOGICO = 400;

/** Separación de la cuadrícula fina, en unidades lógicas. */
export const PASO_CUADRICULA = 20;

/** Separación de la cuadrícula gruesa (múltiplos de 100), en unidades lógicas. */
export const PASO_CUADRICULA_GRUESA = 100;

/** Cota inferior del lado en píxeles: garantiza que el paso de 20 mida ≥ 8 px. */
export const LADO_MINIMO = 320;

/** Cota superior del lado en píxeles: evita búferes de más de 12 288 px con dpr 3. */
export const LADO_MAXIMO = 4096;

/** Cota inferior de la densidad de píxeles. */
export const DPR_MINIMO = 1;

/** Cota superior de la densidad de píxeles. */
export const DPR_MAXIMO = 3;

/** Identificadores de las cuatro capas, en su orden de apilamiento en el DOM. */
export type NombreCapa = 'fondo' | 'referencia' | 'jugador' | 'personajes';

/** Orden de apilamiento de las cuatro capas: fondo abajo, personajes arriba. */
export const ORDEN_CAPAS: readonly NombreCapa[] = ['fondo', 'referencia', 'jugador', 'personajes'];

/** Las dos capas que llevan estela: la del jugador y la de la referencia. */
export type CapaEstela = 'jugador' | 'referencia';

// ============================================================================
// Tema: la única fuente de color y grosor
// ============================================================================

/**
 * Trazos que el lienzo lee del tema en cada redibujado. No hay ningún literal de
 * color ni de grosor en este módulo: todos estos valores entran por `LectorTema`.
 */
export interface TrazoTema {
  readonly color: string;
  readonly grosor: number;
  /** Patrón de guiones en unidades lógicas; vacío para línea continua. */
  readonly guiones: readonly number[];
}

/** Tipografía de los rótulos: color por omisión, familia y tamaño en unidades lógicas. */
export interface TipografiaRotulo {
  readonly color: string;
  readonly fuente: string;
  readonly tamano: number;
}

export interface EstiloLienzo {
  readonly fondo: TrazoTema;
  readonly cuadricula20: TrazoTema;
  readonly cuadricula100: TrazoTema;
  readonly estelaJugador: TrazoTema;
  readonly estelaReferencia: TrazoTema;
  readonly rotulo: TipografiaRotulo;
}

/**
 * Lee el estilo del lienzo del tema. En producción se implementa con
 * `getComputedStyle` sobre el contenedor; en pruebas se inyecta un doble.
 * Se invoca en cada redibujado, así que un cambio de tema se refleja al redibujar.
 */
export type LectorTema = () => EstiloLienzo;

// ============================================================================
// Tamaño y transformación (sección 7.3)
// ============================================================================

/** Tamaño del lienzo en píxeles CSS y densidad de píxeles solicitada. */
export interface TamanoLienzo {
  readonly anchoCss: number;
  readonly altoCss: number;
  readonly devicePixelRatio: number;
}

/** Resultado del escalado: lado acotado, escala uniforme, dpr acotado y búfer. */
export interface Escalado {
  readonly lado: number;   // píxeles CSS, acotado a [320, 4096]
  readonly escala: number; // lado / 800
  readonly dpr: number;    // acotado a [1, 3]
  readonly bufer: number;  // lado · dpr, en cada eje
}

/** Acota un valor al intervalo [min, max]. */
function acotar(valor: number, min: number, max: number): number {
  if (valor < min) return min;
  if (valor > max) return max;
  return valor;
}

/**
 * Calcula el escalado del lienzo según la sección 7.3: el lado es el menor de los
 * dos lados CSS acotado a [320, 4096], la escala es el lado entre 800, la densidad
 * de píxeles se acota a [1, 3] y el búfer es el lado por la densidad. La escala es
 * uniforme en los dos ejes, así que el cuadrado lógico conserva la relación 1:1.
 */
export function calcularEscalado(tamano: TamanoLienzo): Escalado {
  const ladoBruto = Math.min(tamano.anchoCss, tamano.altoCss);
  const lado = acotar(ladoBruto, LADO_MINIMO, LADO_MAXIMO);
  const escala = lado / LADO_LOGICO;
  const dpr = acotar(tamano.devicePixelRatio, DPR_MINIMO, DPR_MAXIMO);
  const bufer = lado * dpr;
  return { lado, escala, dpr, bufer };
}

/**
 * Fija la transformación de un contexto para el escalado dado. La `y` negativa
 * invierte el eje vertical una sola vez y en un solo lugar: a partir de aquí todo
 * el dibujo usa coordenadas lógicas con `y` hacia arriba y el grosor de línea en
 * unidades lógicas, que la transformación escala (requisito 12.3).
 */
export function aplicarTransformacion(ctx: ContextoDibujo, escalado: Escalado): void {
  const factor = escalado.escala * escalado.dpr;
  const centro = (escalado.lado * escalado.dpr) / 2;
  ctx.setTransform(factor, 0, 0, -factor, centro, centro);
}

// ============================================================================
// Recorte al cuadrado lógico
// ============================================================================

/**
 * Recorta el contexto al cuadrado lógico [−400, 400]². Un tramo que se salga se
 * recorta al borde y el dibujo continúa sin excepción; el informe de figura no
 * encuadrada queda para `encuadre.ts`.
 */
function recortarAlCuadrado(ctx: ContextoDibujo): void {
  ctx.beginPath();
  ctx.rect(-SEMILADO_LOGICO, -SEMILADO_LOGICO, LADO_LOGICO, LADO_LOGICO);
  ctx.clip();
}

/** Aplica un trazo del tema a un contexto: color, grosor y patrón de guiones. */
function aplicarTrazo(ctx: ContextoDibujo, trazo: TrazoTema): void {
  ctx.strokeStyle = trazo.color;
  ctx.lineWidth = trazo.grosor;
  ctx.setLineDash(trazo.guiones.length > 0 ? [...trazo.guiones] : []);
}

// ============================================================================
// Cuadrícula (sección 7.3)
// ============================================================================

/**
 * Dibuja las 41 líneas paralelas a cada eje, separadas 20 unidades de −400 a 400.
 * Las 9 de cada eje que caen en múltiplos de 100 llevan al menos el doble de
 * grosor, para distinguirse sin depender del color. La cuadrícula completa queda
 * por debajo de las estelas y de los personajes, porque se dibuja en la capa de
 * fondo.
 */
export function dibujarCuadricula(ctx: ContextoDibujo, estilo: EstiloLienzo): void {
  // Las finas primero, las gruesas después, para que las gruesas queden encima.
  dibujarLineasCuadricula(ctx, estilo.cuadricula20, false);
  dibujarLineasCuadricula(ctx, estilo.cuadricula100, true);
}

/**
 * Dibuja las líneas de un nivel de la cuadrícula. Con `soloMultiplosDe100` en
 * false traza las 41 líneas por eje que no son múltiplo de 100; en true traza las
 * 9 líneas por eje que sí lo son, con al menos el doble del grosor de las finas.
 */
function dibujarLineasCuadricula(
  ctx: ContextoDibujo,
  trazo: TrazoTema,
  soloMultiplosDe100: boolean,
): void {
  aplicarTrazo(ctx, trazo);
  ctx.beginPath();
  for (let c = -SEMILADO_LOGICO; c <= SEMILADO_LOGICO; c += PASO_CUADRICULA) {
    const esMultiploDe100 = Math.abs(c) % PASO_CUADRICULA_GRUESA === 0;
    if (esMultiploDe100 !== soloMultiplosDe100) continue;
    // Línea vertical en x = c.
    ctx.moveTo(c, -SEMILADO_LOGICO);
    ctx.lineTo(c, SEMILADO_LOGICO);
    // Línea horizontal en y = c.
    ctx.moveTo(-SEMILADO_LOGICO, c);
    ctx.lineTo(SEMILADO_LOGICO, c);
  }
  ctx.stroke();
}

// ============================================================================
// Estelas: dibujo desde los segmentos guardados
// ============================================================================

/**
 * Dibuja una estela como polilínea de segmentos con un trazo del tema. Aplica el
 * recorte al cuadrado lógico: un tramo que se sale se recorta al borde y el dibujo
 * continúa sin excepción. Un segmento por trazo independiente, porque los
 * segmentos de una estela no son necesariamente contiguos.
 *
 * Con `conEstilo`, cada tramo se pinta con el color y el grosor que pidió el
 * jugador (PONCOLOR, PONGROSOR); lo no pedido sale de `trazo`. Los tramos seguidos
 * del mismo estilo van en un solo trazo. Sin nada pedido hay un único grupo con el
 * trazo del tema, así que las llamadas son exactamente las de siempre.
 */
export function dibujarEstela(
  ctx: ContextoDibujo,
  segmentos: readonly TramoDibujo[],
  trazo: TrazoTema,
  conEstilo = true,
): void {
  ctx.save();
  recortarAlCuadrado(ctx);
  for (const grupo of agruparPorEstilo(segmentos, trazo, conEstilo)) {
    aplicarTrazo(ctx, grupo.trazo);
    ctx.beginPath();
    for (const segmento of grupo.tramos) {
      ctx.moveTo(segmento.desde.x, segmento.desde.y);
      ctx.lineTo(segmento.hasta.x, segmento.hasta.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Agrupa los tramos seguidos que piden el mismo estilo. Una estela vacía da un solo
 * grupo vacío con el trazo del tema, para conservar las llamadas de siempre.
 */
function agruparPorEstilo(
  tramos: readonly TramoDibujo[],
  tema: TrazoTema,
  conEstilo: boolean,
): Array<{ trazo: TrazoTema; tramos: TramoDibujo[]; estilo: EstiloPedido }> {
  const grupos: Array<{ trazo: TrazoTema; tramos: TramoDibujo[]; estilo: EstiloPedido }> = [];
  for (const tramo of tramos) {
    const estilo: EstiloPedido = conEstilo ? tramo : SIN_ESTILO;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo !== undefined && mismoEstilo(ultimo.estilo, estilo)) {
      ultimo.tramos.push(tramo);
    } else {
      grupos.push({ trazo: trazoDeTramo(estilo, tema), tramos: [tramo], estilo });
    }
  }
  if (grupos.length === 0) grupos.push({ trazo: tema, tramos: [], estilo: SIN_ESTILO });
  return grupos;
}

/**
 * Pinta el tramo que la tortuga lleva recorrido en la operación en curso (en la
 * capa de personajes, que se borra en cada fotograma). Con `conEstilo` lleva el
 * color y el grosor que pidió el jugador; sin él (la tortuga de Kiro), el tema. El
 * recorte es el mismo que el de la estela definitiva, para que el tramo no asome
 * por fuera del cuadrado lógico y luego desaparezca. Línea siempre continua.
 */
export function dibujarTramoEnCurso(
  ctx: ContextoDibujo,
  tramo: TramoDibujo,
  tema: TrazoTema,
  conEstilo: boolean,
): void {
  const trazo = conEstilo ? trazoDeTramo(tramo, tema) : tema;
  ctx.save();
  recortarAlCuadrado(ctx);
  ctx.strokeStyle = trazo.color;
  ctx.lineWidth = trazo.grosor;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(tramo.desde.x, tramo.desde.y);
  ctx.lineTo(tramo.hasta.x, tramo.hasta.y);
  ctx.stroke();
  ctx.restore();
}

// ============================================================================
// Rellenos (R4.6, R4.7)
// ============================================================================

/** Un relleno ya calculado: su color y las corridas del área cerrada. */
export interface RellenoDibujado {
  readonly color: Color;
  readonly corridas: readonly Corrida[];
}

/**
 * Pinta los rellenos, cada uno como un solo `fill` de sus corridas (rectángulos de
 * una unidad de alto que no se solapan, así que no quedan costuras). Sin rellenos
 * no hace ninguna llamada: un dibujo sin RELLENA es exactamente el de siempre.
 */
export function dibujarRellenos(ctx: ContextoDibujo, rellenos: readonly RellenoDibujado[]): void {
  if (rellenos.length === 0) return;
  ctx.save();
  recortarAlCuadrado(ctx);
  for (const relleno of rellenos) {
    ctx.fillStyle = cssDeColor(relleno.color);
    ctx.beginPath();
    for (const c of relleno.corridas) ctx.rect(c.x0, c.y, c.x1 - c.x0, 1);
    ctx.fill();
  }
  ctx.restore();
}

// ============================================================================
// Rótulos (R11.5, R11.6, R11.7)
// ============================================================================

/** Un rótulo ya aplicado: su texto, dónde empieza y el color que pidió el jugador, si lo pidió. */
export interface RotuloDibujado {
  readonly texto: string;
  readonly posicion: Punto;
  readonly color: Color | null;
}

/**
 * Pinta los rótulos. La transformación del lienzo invierte `y`, así que cada texto se
 * dibuja con `scale(1, -1)` para que no salga espejado; es siempre horizontal, sin
 * depender del rumbo. Se recorta al cuadrado lógico y nunca lanza. Sin rótulos no
 * hace ninguna llamada.
 */
export function dibujarRotulos(
  ctx: ContextoDibujo,
  rotulos: readonly RotuloDibujado[],
  tipografia: TipografiaRotulo,
): void {
  if (rotulos.length === 0) return;
  ctx.save();
  recortarAlCuadrado(ctx);
  ctx.font = `${tipografia.tamano}px ${tipografia.fuente}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const rotulo of rotulos) {
    ctx.fillStyle = rotulo.color === null ? tipografia.color : cssDeColor(rotulo.color);
    ctx.save();
    ctx.translate(rotulo.posicion.x, rotulo.posicion.y);
    ctx.scale(1, -1);
    ctx.fillText(rotulo.texto, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

// ============================================================================
// Lienzo: cuatro capas y las operaciones que las gobiernan
// ============================================================================

/**
 * Las cuatro capas de dibujo. Cada una expone un `ContextoDibujo` del mismo
 * tamaño y con la misma transformación. En producción son cuatro `<canvas>`
 * apilados; en pruebas son cuatro dobles de dibujo.
 */
export type CapasLienzo = Readonly<Record<NombreCapa, ContextoDibujo>>;

export interface Lienzo {
  /** Fija el tamaño y la transformación de las cuatro capas y redibuja el fondo. */
  redimensionar(tamano: TamanoLienzo): void;
  /** Devuelve el escalado vigente. */
  escaladoActual(): Escalado;
  /**
   * Sustituye por completo la estela de una capa por estos segmentos y la
   * redibuja. Guarda los segmentos para poder redibujar al cambiar de tamaño sin
   * volver a invocar el intérprete.
   */
  ponerEstela(capa: CapaEstela, segmentos: readonly TramoDibujo[]): void;
  /** Añade segmentos a la estela de una capa y redibuja esa capa. */
  crecerEstela(capa: CapaEstela, segmentos: readonly TramoDibujo[]): void;
  /**
   * Rellena con un color el área cerrada donde está la tortuga, calculada con los
   * trazos que la capa tiene en este momento (R4.6). Sin área cerrada no cambia nada
   * (R4.7). Solo la capa del jugador se rellena; en la de Kiro no hace nada.
   */
  rellenar(capa: CapaEstela, color: Color, punto: Punto): void;
  /**
   * Escribe un rótulo horizontal en la capa del jugador; se repinta tras la estela y
   * se borra con ella. En la capa de Kiro no hace nada.
   */
  rotular(capa: CapaEstela, rotulo: RotuloDibujado): void;
  /** Borra la estela de una capa sin tocar las otras tres. */
  limpiarEstela(capa: CapaEstela): void;
  /** Devuelve una copia de los segmentos guardados de una capa de estela. */
  segmentosDe(capa: CapaEstela): readonly Segmento[];
  /** Redibuja el fondo (cuadrícula) y las dos estelas desde sus segmentos. */
  redibujar(): void;
  /** Da acceso a la capa de personajes para que el animador dibuje sobre ella. */
  capaPersonajes(): ContextoDibujo;
  /** Borra por completo la capa de personajes. */
  limpiarPersonajes(): void;
}

/**
 * Crea un lienzo sobre cuatro capas ya provistas y un lector de tema inyectable.
 * No busca ningún elemento por su cuenta: las dependencias del DOM entran por
 * parámetro, así que el mismo código corre en Node con dobles de dibujo.
 *
 * @param capas Las cuatro capas de dibujo, cada una un `ContextoDibujo`
 * @param leerTema Lee el estilo del tema; se invoca en cada redibujado
 * @param tamanoInicial Tamaño y densidad de píxeles de partida
 */
export function crearLienzo(
  capas: CapasLienzo,
  leerTema: LectorTema,
  tamanoInicial: TamanoLienzo,
): Lienzo {
  let escalado = calcularEscalado(tamanoInicial);

  // Cada capa de estela guarda las operaciones (segmentos) que recibió, para
  // redibujar al cambiar de tamaño o densidad sin volver a invocar el intérprete.
  // Los de la capa del jugador conservan el estilo que pidió (color y grosor).
  const estelas: Record<CapaEstela, TramoDibujo[]> = {
    jugador: [],
    referencia: [],
  };

  // Rellenos de la figura del jugador, en el orden en que se pidieron. Se pintan
  // debajo de su estela; BORRAPANTALLA y reiniciar los descartan con ella.
  let rellenosJugador: RellenoDibujado[] = [];

  // Rótulos del jugador: van encima de su estela y se descartan con ella.
  let rotulosJugador: RotuloDibujado[] = [];

  function fijarTransformaciones(): void {
    for (const nombre of ORDEN_CAPAS) {
      aplicarTransformacion(capas[nombre], escalado);
    }
  }

  function borrarCapa(ctx: ContextoDibujo): void {
    // clearRect en coordenadas lógicas: cubre todo el espacio y algo de margen.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, escalado.bufer, escalado.bufer);
    ctx.restore();
  }

  function trazoDeCapa(capa: CapaEstela, estilo: EstiloLienzo): TrazoTema {
    return capa === 'jugador' ? estilo.estelaJugador : estilo.estelaReferencia;
  }

  function redibujarFondo(estilo: EstiloLienzo): void {
    const ctx = capas.fondo;
    borrarCapa(ctx);
    // Fondo sólido detrás de la cuadrícula.
    ctx.save();
    ctx.fillStyle = estilo.fondo.color;
    ctx.beginPath();
    ctx.rect(-SEMILADO_LOGICO, -SEMILADO_LOGICO, LADO_LOGICO, LADO_LOGICO);
    ctx.fill();
    ctx.restore();
    dibujarCuadricula(ctx, estilo);
  }

  function redibujarEstela(capa: CapaEstela, estilo: EstiloLienzo): void {
    const ctx = capa === 'jugador' ? capas.jugador : capas.referencia;
    borrarCapa(ctx);
    // Los rellenos van debajo de los trazos de la figura del jugador.
    if (capa === 'jugador') dibujarRellenos(ctx, rellenosJugador);
    // Solo la figura del jugador lleva su color y grosor; la de Kiro, siempre el tema.
    dibujarEstela(ctx, estelas[capa], trazoDeCapa(capa, estilo), capa === 'jugador');
    if (capa === 'jugador') dibujarRotulos(ctx, rotulosJugador, estilo.rotulo);
  }

  function redibujar(): void {
    const estilo = leerTema();
    redibujarFondo(estilo);
    redibujarEstela('referencia', estilo);
    redibujarEstela('jugador', estilo);
  }

  // Estado inicial: transformación y primer dibujo.
  fijarTransformaciones();
  redibujar();

  return {
    redimensionar(tamano: TamanoLienzo): void {
      escalado = calcularEscalado(tamano);
      fijarTransformaciones();
      // Redibuja todo desde los segmentos guardados, sin invocar el intérprete.
      redibujar();
    },

    escaladoActual(): Escalado {
      return escalado;
    },

    ponerEstela(capa: CapaEstela, segmentos: readonly TramoDibujo[]): void {
      estelas[capa] = segmentos.map((s) => ({ ...s }));
      if (capa === 'jugador') {
        rellenosJugador = [];
        rotulosJugador = [];
      }
      redibujarEstela(capa, leerTema());
    },

    crecerEstela(capa: CapaEstela, segmentos: readonly TramoDibujo[]): void {
      for (const s of segmentos) estelas[capa].push({ ...s });
      redibujarEstela(capa, leerTema());
    },

    rellenar(capa: CapaEstela, color: Color, punto: Punto): void {
      if (capa !== 'jugador') return;
      const corridas = calcularRelleno(estelas.jugador, punto);
      if (corridas === null) return;
      rellenosJugador.push({ color, corridas });
      redibujarEstela('jugador', leerTema());
    },

    rotular(capa: CapaEstela, rotulo: RotuloDibujado): void {
      if (capa !== 'jugador') return;
      rotulosJugador.push({ ...rotulo, posicion: { ...rotulo.posicion } });
      redibujarEstela('jugador', leerTema());
    },

    limpiarEstela(capa: CapaEstela): void {
      estelas[capa] = [];
      if (capa === 'jugador') {
        rellenosJugador = [];
        rotulosJugador = [];
      }
      redibujarEstela(capa, leerTema());
    },

    segmentosDe(capa: CapaEstela): readonly Segmento[] {
      return estelas[capa].map((s) => ({ ...s }));
    },

    redibujar,

    capaPersonajes(): ContextoDibujo {
      return capas.personajes;
    },

    limpiarPersonajes(): void {
      borrarCapa(capas.personajes);
    },
  };
}
