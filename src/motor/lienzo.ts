// Lienzo de KiroLogo: espacio lógico de 800 × 800, cuadrícula, cuatro capas y estelas.
// Sin literales de color ni de grosor: todo sale del tema, leído por una función
// inyectable. Las dependencias del DOM entran por parámetro, así que el núcleo
// lógico se prueba en Node con un doble de dibujo, sin jsdom.
//
// El eje vertical se invierte una sola vez, en `aplicarTransformacion`, con la
// `y` negativa de `setTransform`. A partir de ahí todo el dibujo del proyecto
// usa coordenadas lógicas con `y` hacia arriba.

import type { Segmento } from './segmentos.js';

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

export interface EstiloLienzo {
  readonly fondo: TrazoTema;
  readonly cuadricula20: TrazoTema;
  readonly cuadricula100: TrazoTema;
  readonly estelaJugador: TrazoTema;
  readonly estelaReferencia: TrazoTema;
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
 */
export function dibujarEstela(
  ctx: ContextoDibujo,
  segmentos: readonly Segmento[],
  trazo: TrazoTema,
): void {
  ctx.save();
  recortarAlCuadrado(ctx);
  aplicarTrazo(ctx, trazo);
  ctx.beginPath();
  for (const segmento of segmentos) {
    ctx.moveTo(segmento.desde.x, segmento.desde.y);
    ctx.lineTo(segmento.hasta.x, segmento.hasta.y);
  }
  ctx.stroke();
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
  ponerEstela(capa: CapaEstela, segmentos: readonly Segmento[]): void;
  /** Añade segmentos a la estela de una capa y redibuja esa capa. */
  crecerEstela(capa: CapaEstela, segmentos: readonly Segmento[]): void;
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
  const estelas: Record<CapaEstela, Segmento[]> = {
    jugador: [],
    referencia: [],
  };

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
    dibujarEstela(ctx, estelas[capa], trazoDeCapa(capa, estilo));
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

    ponerEstela(capa: CapaEstela, segmentos: readonly Segmento[]): void {
      estelas[capa] = segmentos.map((s) => ({ ...s }));
      redibujarEstela(capa, leerTema());
    },

    crecerEstela(capa: CapaEstela, segmentos: readonly Segmento[]): void {
      for (const s of segmentos) estelas[capa].push({ ...s });
      redibujarEstela(capa, leerTema());
    },

    limpiarEstela(capa: CapaEstela): void {
      estelas[capa] = [];
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
