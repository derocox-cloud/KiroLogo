// Diff visual de KiroLogo: dibuja las tres regiones que devuelve el validador
// —coincidencia, exceso y falta— sobre la vista de superposición, aplicando la
// misma traslación y el mismo ángulo del veredicto para que queden alineadas con
// las estelas que el jugador vio dibujar.
//
// No rasteriza, no invoca al validador y no ejecuta el intérprete: recibe las
// tres máscaras ya calculadas. Color y grosor salen del tema (sin literales); los
// tres estados se distinguen por patrón de guiones y por grosor además del color.

import type { ContextoDibujo } from '../motor/lienzo.js';
import type { Mascara } from '../motor/validador.js';
import { LADO, aColumna, aFila } from '../motor/validador.js';
import type { Punto } from '../motor/tortuga.js';
import type { Segmento } from '../motor/segmentos.js';

// ============================================================================
// Tema del diff: la única fuente de color, grosor y patrón de guiones
// ============================================================================

export interface TrazoDiff {
  readonly color: string;
  readonly grosor: number;
  /** Patrón de guiones en unidades lógicas; vacío para línea continua. */
  readonly guiones: readonly number[];
}

export interface EstiloDiff {
  readonly coincidencia: TrazoDiff;
  readonly exceso: TrazoDiff;
  readonly falta: TrazoDiff;
}

export type LectorTemaDiff = () => EstiloDiff;

// ============================================================================
// Entrada: las tres regiones y la transformación del veredicto
// ============================================================================

export interface RegionesDiff {
  readonly coincidencia: Mascara;
  readonly exceso: Mascara;
  readonly falta: Mascara;
  /**
   * Excedente del trazo del jugador en MARCO REAL (sin centrar ni girar): el trazo
   * dilatado del jugador que no respalda la línea de Kiro dilatada al mismo radio,
   * con traslación {0, 0}. Cuando está presente, el rojo del pintado limpio se
   * clasifica con esta máscara en lugar de `exceso` (marco centrado), de modo que el
   * excedente se marca a lo largo del trazo y no solo en la punta. Opcional: sin
   * ella (llamadas antiguas) el pintado usa `exceso` exactamente como hoy.
   */
  readonly excesoVisual?: Mascara;
  /** Traslación aplicada por el validador a la figura del jugador, en posiciones enteras. */
  readonly traslacion: Punto;
  /**
   * Traslación aplicada por el validador a la figura OBJETIVO al centrarla, en
   * posiciones enteras. Falta solo en llamadas que no la conocen (se toma (0, 0)).
   */
  readonly traslacionObjetivo?: Punto;
  /** Ángulo, de 0 a 359 grados, que el validador giró la figura OBJETIVO (en sentido horario). */
  readonly angulo: number;
}

/**
 * Los trazos reales de las dos figuras, tal como se dibujaron en el lienzo. Con ellos el
 * diff dibuja líneas limpias en lugar de devolver cada máscara a rayitas: ver
 * `dibujar`. No son una entrada nueva del validador, solo la geometría que se colorea.
 */
export interface TrazosDiff {
  readonly referencia: readonly Segmento[];
  readonly jugador: readonly Segmento[];
}

// ============================================================================
// Dependencias
// ============================================================================

export interface DependenciasDiff {
  /** Contexto de dibujo de la capa de superposición (o doble en pruebas). */
  readonly ctx: ContextoDibujo;
  /** Lee el estilo del diff del tema; se invoca en cada dibujado. */
  readonly leerTema: LectorTemaDiff;
}

// ============================================================================
// Estado del diff que se dibuja: nombra por lo que significa, nunca por color
// ============================================================================

export type EstadoDiff = 'coincidencia' | 'exceso' | 'falta';

/** Nombre en español de un estado, por lo que significa. */
export const NOMBRE_ESTADO: Readonly<Record<EstadoDiff, string>> = {
  coincidencia: 'lo que coincide',
  exceso: 'lo que sobra',
  falta: 'lo que falta',
};

// ============================================================================
// Interfaz pública
// ============================================================================

export interface Diff {
  /**
   * Dibuja las tres regiones, cada una devuelta a su marco real con la traslación y
   * el ángulo del validador, para que queden alineadas con las estelas. Si la máscara
   * del jugador no encendió nada (coincidencia y exceso vacías), dibuja solo la
   * falta. No modifica las máscaras recibidas.
   *
   * Con `trazos` dibuja los trazos reales como líneas limpias: cada tramo del jugador
   * en verde si cae en la región de coincidencia o en rojo si cae en la de exceso, y
   * cada tramo de la referencia en gris punteado si cae en la de falta. Sin `trazos`
   * devuelve cada máscara al lienzo como corridas horizontales, que en una línea
   * vertical se apilan en una banda gruesa donde el patrón de guiones no se ve.
   */
  dibujar(regiones: RegionesDiff, trazos?: TrazosDiff): void;
}

// ============================================================================
// Rasterizado inverso de una máscara a segmentos de dibujo
// ============================================================================

/** Lleva un punto del marco del arreglo (y hacia arriba) al marco real del lienzo. */
type AMarcoReal = (lx: number, ly: number) => Punto;

/**
 * Marco de la coincidencia y el exceso. El validador centra la figura del jugador
 * (esa es `traslacion`) y no la gira, así que basta deshacer la traslación.
 */
function marcoDelJugador(regiones: RegionesDiff): AMarcoReal {
  const t = regiones.traslacion;
  return (lx, ly) => ({ x: lx - t.x, y: ly - t.y });
}

/**
 * Marco de la falta. Es el de la figura OBJETIVO tal como la comparó el validador:
 * centrada (`traslacionObjetivo`) y girada `angulo` grados en sentido horario. Se
 * deshace en orden inverso —primero el giro, antes en sentido antihorario, y luego
 * la traslación— y el trazo cae sobre la estela de referencia real, que es lo que
 * el jugador ve en la superposición. Con rotación y traslación fijas (mundo 3 en
 * adelante) los dos valores son 0 y este marco coincide con el del jugador.
 */
function marcoDelObjetivo(regiones: RegionesDiff): AMarcoReal {
  const t = regiones.traslacionObjetivo ?? { x: 0, y: 0 };
  const rad = (regiones.angulo * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  return (lx, ly) => ({
    x: lx * cos - ly * sen - t.x,
    y: lx * sen + ly * cos - t.y,
  });
}

/**
 * Recorre una máscara y, por cada corrida horizontal de posiciones encendidas,
 * emite un segmento (moveTo/lineTo) en coordenadas lógicas reales, usando el marco
 * de la región para deshacer lo que el validador le aplicó. Una corrida por
 * trazo, para que el patrón de guiones se lea sobre cada tramo.
 *
 * El arreglo tiene el origen lógico en (399.5, 399.5): `x = ix − 399.5`,
 * `y = 399.5 − iy`.
 */
function trazarMascara(ctx: ContextoDibujo, mascara: Mascara, aReal: AMarcoReal): boolean {
  let dibujoAlgo = false;

  const centro = (LADO - 1) / 2; // 399.5

  for (let iy = 0; iy < LADO; iy++) {
    const base = iy * LADO;
    let ix = 0;
    while (ix < LADO) {
      if (mascara[base + ix] !== 1) {
        ix += 1;
        continue;
      }
      // Extiende la corrida horizontal de celdas encendidas.
      const inicio = ix;
      while (ix < LADO && mascara[base + ix] === 1) ix += 1;
      const fin = ix - 1;

      // Convierte los dos extremos a coordenadas lógicas reales.
      const p1 = aReal(inicio - centro, centro - iy);
      const p2 = aReal(fin - centro, centro - iy);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      dibujoAlgo = true;
    }
  }
  return dibujoAlgo;
}

/** ¿Tiene la máscara alguna posición encendida? */
function tieneAlgo(mascara: Mascara): boolean {
  for (let i = 0; i < mascara.length; i++) {
    if (mascara[i] === 1) return true;
  }
  return false;
}

// ============================================================================
// Dibujo limpio: los trazos reales, coloreados según lo que dicen las máscaras
// ============================================================================

/** Cada cuántas unidades lógicas se mira a qué región pertenece un trazo. */
const PASO_MUESTREO = 1;

/** Tope de muestras por trazo: uno que se sale muchísimo del lienzo no cuesta de más. */
const MUESTRAS_MAXIMAS = 2000;

/** Lleva un punto real del lienzo al marco de la máscara (y hacia arriba, centrado). */
type AMarcoMascara = (p: Punto) => Punto;

/** El validador solo traslada la figura del jugador: no la gira. */
function aMarcoMascaraDelJugador(regiones: RegionesDiff): AMarcoMascara {
  const t = regiones.traslacion;
  return (p) => ({ x: p.x + t.x, y: p.y + t.y });
}

/**
 * El validador traslada la figura OBJETIVO al centro y la gira `angulo` grados en sentido
 * horario. Es la inversa exacta de `marcoDelObjetivo`: primero la traslación, luego el giro.
 */
function aMarcoMascaraDelObjetivo(regiones: RegionesDiff): AMarcoMascara {
  const t = regiones.traslacionObjetivo ?? { x: 0, y: 0 };
  const rad = (regiones.angulo * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  return (p) => {
    const x = p.x + t.x;
    const y = p.y + t.y;
    return { x: x * cos + y * sen, y: -x * sen + y * cos };
  };
}

/** ¿Está encendida la posición de la máscara que contiene este punto del marco de la máscara? */
function encendida(mascara: Mascara, p: Punto): boolean {
  const ix = aColumna(p.x);
  const iy = aFila(p.y);
  if (ix < 0 || ix >= LADO || iy < 0 || iy >= LADO) return false;
  return mascara[iy * LADO + ix] === 1;
}

interface Tramo {
  readonly desde: Punto;
  readonly hasta: Punto;
}

/**
 * Parte cada segmento en tramos de una misma clase. Mira el punto medio de cada unidad
 * del segmento; los tramos contiguos de la misma clase se funden en uno, y los que no
 * tienen clase (`null`) no se dibujan.
 */
function trocear<C extends string>(
  segmentos: readonly Segmento[],
  clasificar: (p: Punto) => C | null,
): Map<C, Tramo[]> {
  const porClase = new Map<C, Tramo[]>();
  for (const s of segmentos) {
    const largo = Math.hypot(s.hasta.x - s.desde.x, s.hasta.y - s.desde.y);
    const n = Math.min(MUESTRAS_MAXIMAS, Math.max(1, Math.ceil(largo / PASO_MUESTREO)));
    const en = (t: number): Punto => ({
      x: s.desde.x + (s.hasta.x - s.desde.x) * t,
      y: s.desde.y + (s.hasta.y - s.desde.y) * t,
    });
    const clases: Array<C | null> = [];
    for (let k = 0; k < n; k++) clases.push(clasificar(en((k + 0.5) / n)));

    let k = 0;
    while (k < n) {
      let j = k;
      while (j + 1 < n && clases[j + 1] === clases[k]) j += 1;
      const clase = clases[k]!;
      if (clase !== null) {
        const tramos = porClase.get(clase) ?? [];
        tramos.push({ desde: en(k / n), hasta: en((j + 1) / n) });
        porClase.set(clase, tramos);
      }
      k = j + 1;
    }
  }
  return porClase;
}

// ============================================================================
// Creación
// ============================================================================

export function crearDiff(deps: DependenciasDiff): Diff {
  const ctx = deps.ctx;

  /** Aplica un trazo del tema al contexto: color, grosor y patrón de guiones. */
  function aplicarTrazo(trazo: TrazoDiff): void {
    ctx.strokeStyle = trazo.color;
    ctx.lineWidth = trazo.grosor;
    ctx.setLineDash(trazo.guiones.length > 0 ? [...trazo.guiones] : []);
  }

  function dibujarRegion(mascara: Mascara, trazo: TrazoDiff, aReal: AMarcoReal): void {
    aplicarTrazo(trazo);
    ctx.beginPath();
    trazarMascara(ctx, mascara, aReal);
    ctx.stroke();
  }

  /**
   * Un estado como líneas limpias. Los continuos llevan las puntas redondas, para que los
   * tramos que se tocan no dejen muescas; los punteados, planas, para que el guion mida lo
   * que dice el tema.
   */
  function dibujarTramos(tramos: readonly Tramo[] | undefined, trazo: TrazoDiff): void {
    if (tramos === undefined || tramos.length === 0) return;
    aplicarTrazo(trazo);
    ctx.lineCap = trazo.guiones.length > 0 ? 'butt' : 'round';
    ctx.beginPath();
    for (const t of tramos) {
      ctx.moveTo(t.desde.x, t.desde.y);
      ctx.lineTo(t.hasta.x, t.hasta.y);
    }
    ctx.stroke();
  }

  function dibujarLimpio(regiones: RegionesDiff, trazos: TrazosDiff, estilo: EstiloDiff): void {
    const hayJugador = tieneAlgo(regiones.coincidencia) || tieneAlgo(regiones.exceso);
    const delJugador = aMarcoMascaraDelJugador(regiones);
    const delObjetivo = aMarcoMascaraDelObjetivo(regiones);

    ctx.save();
    // Recorte al cuadrado lógico, como las estelas: un trazo que se sale se corta en el borde.
    ctx.beginPath();
    ctx.rect(-LADO / 2, -LADO / 2, LADO, LADO);
    ctx.clip();

    // El excedente que se pinta de rojo. Con `excesoVisual` presente se clasifica en
    // MARCO REAL (identidad): `excesoVisual` vive en coordenadas reales del trazo del
    // jugador (p. ej. y=100..110), así que se muestrea con el mismo `p` que recorre
    // `trocear` sobre los segmentos reales, SIN `delJugador` (que sumaría la traslación
    // para ir al marco centrado). Sin `excesoVisual` (llamadas antiguas) el rojo se
    // clasifica con `exceso` en el marco centrado, exactamente como hoy. La coincidencia
    // se clasifica siempre en el marco centrado. Se mantiene la precedencia exceso antes
    // que coincidencia.
    const esExceso =
      regiones.excesoVisual !== undefined
        ? (p: Punto) => encendida(regiones.excesoVisual!, p)
        : (p: Punto) => encendida(regiones.exceso, delJugador(p));

    // Sin estela del jugador solo se dibuja la falta (requisito 23.8).
    const delJugadorPorClase = hayJugador
      ? trocear<'coincidencia' | 'exceso'>(trazos.jugador, (p) => {
          if (esExceso(p)) return 'exceso';
          return encendida(regiones.coincidencia, delJugador(p)) ? 'coincidencia' : null;
        })
      : new Map<'coincidencia' | 'exceso', Tramo[]>();
    const faltaDeLaReferencia = trocear<'falta'>(trazos.referencia, (p) =>
      encendida(regiones.falta, delObjetivo(p)) ? 'falta' : null,
    );

    dibujarTramos(delJugadorPorClase.get('coincidencia'), estilo.coincidencia);
    dibujarTramos(delJugadorPorClase.get('exceso'), estilo.exceso);
    dibujarTramos(faltaDeLaReferencia.get('falta'), estilo.falta);
    ctx.restore();
  }

  return {
    dibujar(regiones: RegionesDiff, trazos?: TrazosDiff): void {
      const estilo = deps.leerTema();

      if (trazos !== undefined) {
        dibujarLimpio(regiones, trazos, estilo);
        return;
      }

      const delJugador = marcoDelJugador(regiones);
      const delObjetivo = marcoDelObjetivo(regiones);
      const hayJugador = tieneAlgo(regiones.coincidencia) || tieneAlgo(regiones.exceso);

      if (!hayJugador) {
        // El jugador no ejecutó nada (o no encendió nada): solo la falta.
        dibujarRegion(regiones.falta, estilo.falta, delObjetivo);
        return;
      }

      // Coincidencia continua, exceso más grueso, falta punteada.
      dibujarRegion(regiones.coincidencia, estilo.coincidencia, delJugador);
      dibujarRegion(regiones.exceso, estilo.exceso, delJugador);
      dibujarRegion(regiones.falta, estilo.falta, delObjetivo);
    },
  };
}
