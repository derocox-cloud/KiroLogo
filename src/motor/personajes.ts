// Personajes de KiroLogo: la tortuga, Kiro montado y el lápiz.
//
// Toda la geometría de la sección 7.4.3 del diseño se declara en un marco local
// con el origen en la posición de la tortuga, `+y` hacia el frente —la dirección
// del rumbo— y `+x` a estribor. El conjunto se gira rígidamente al rumbo con una
// sola transformación, así que la geometría se escribe una vez para el rumbo 0 y
// funciona para cualquier rumbo finito.
//
// Sin imágenes: solo trazos y rellenos del contexto 2D. Sin literales de color ni
// de grosor: todo sale del tema, leído por una función inyectable. El módulo no
// invoca la tortuga ni el intérprete; toma todo del estado recibido.

import type { EstadoTortuga } from './tortuga.js';
import { normalizarRumbo } from './tortuga.js';
import type { ContextoDibujo } from './lienzo.js';

// ============================================================================
// 7.4.1 · Entrada
// ============================================================================

export type IdentidadTortuga = 'jugador' | 'kiro';

export interface EstadoPersonajes {
  /** Posición, rumbo, lápiz y visibilidad de la tortuga. */
  readonly tortuga: EstadoTortuga;
  /** Kiro desmontado y flotando al lado, para el paso a paso. Dibuja: spec 03. */
  readonly kiroMontado: boolean;
  /** Anticipación visual hacia el próximo giro. −20 a 20 grados, positivo hacia estribor. */
  readonly inclinacionKiro: number;
  /** Distingue las dos tortugas de la reproducción en paralelo. Dibuja: spec 04. */
  readonly identidad: IdentidadTortuga;
  /** Festejo al ganar estrellas. Dibuja: spec 03. */
  readonly celebracion: boolean;
}

export type ResultadoDibujo =
  | { readonly valido: true }
  | { readonly valido: false; readonly campo: string; readonly valorRecibido: number };

// ============================================================================
// Tema de los personajes
// ============================================================================

export interface EstiloPersonajes {
  readonly contorno: string;   // color del contorno de la tortuga
  readonly relleno: string;    // color de relleno de la tortuga
  readonly cabeza: string;     // color de la cabeza y los ojos
  readonly kiroContorno: string;
  readonly kiroRelleno: string;
  readonly lapizContorno: string;
  readonly marcaRumbo: string; // color de la marca de rumbo (flecha de babor)
  readonly grosor: number;     // grosor de trazo, en unidades lógicas
}

export type LectorTemaPersonajes = () => EstiloPersonajes;

// ============================================================================
// 7.4.2 · Marco local y transformación
// ============================================================================

/** Grosor de trazo en unidades lógicas: margen por mitad de trazo 0.75. */
export const GROSOR_TRAZO = 1.5;

/** Cota de la inclinación de Kiro, en grados; positiva hacia estribor. */
export const INCLINACION_MAXIMA = 20;

/** Centro propio de Kiro en el marco local. */
const CENTRO_KIRO = { x: 0, y: -3.4 };

/** Eje unitario del lápiz: 3-4-5 exacto que apunta atrás-estribor. */
const EJE_LAPIZ = { x: 0.8, y: -0.6 };

/** Traslación del lápiz al subirlo, a lo largo de su propio eje. */
const DESPLAZAMIENTO_LAPIZ = 8.6;

/** Punto en el marco local. */
interface PuntoLocal {
  readonly x: number;
  readonly y: number;
}

/**
 * Gira un punto del marco local al rumbo, con la transformación única del diseño
 * 7.4.2. El rumbo llega ya reducido a [0, 360). `+y` local es el frente.
 *
 *   X = x·cos θ + y·sen θ
 *   Y = −x·sen θ + y·cos θ
 */
function alRumbo(p: PuntoLocal, cos: number, sen: number, cx: number, cy: number): PuntoLocal {
  return {
    x: cx + p.x * cos + p.y * sen,
    y: cy - p.x * sen + p.y * cos,
  };
}

/** Gira un punto en torno a un centro propio, en grados, positivo hacia estribor. */
function girarLocal(p: PuntoLocal, centro: PuntoLocal, gradosEstribor: number): PuntoLocal {
  // Positivo hacia estribor (+x): en el marco local con +y al frente, una
  // inclinación a estribor rota el punto de modo que su frente se ladea a +x.
  const rad = (gradosEstribor * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  const dx = p.x - centro.x;
  const dy = p.y - centro.y;
  return {
    x: centro.x + dx * cos + dy * sen,
    y: centro.y - dx * sen + dy * cos,
  };
}

// ============================================================================
// 7.4.3 · Las piezas, en unidades lógicas del marco local
// ============================================================================

// Caparazón: contorno de gota. Vértices del costado de estribor (+x); el de babor
// es su espejo en x. Se recorre proa → estribor → popa → babor → proa con cúbicas.
const CAPARAZON_PROA: PuntoLocal = { x: 0, y: 9.2 };
const CAPARAZON_HOMBRO: PuntoLocal = { x: 7.2, y: 3.6 };
const CAPARAZON_FLANCO: PuntoLocal = { x: 8.6, y: -4.4 };
const CAPARAZON_CUADRIL: PuntoLocal = { x: 4.2, y: -10.2 };
const CAPARAZON_POPA: PuntoLocal = { x: 0, y: -11.0 };

/** Cuello: cápsula de (0, 7.6) a (0, 11.4), radio 2.0. */
const CUELLO_A: PuntoLocal = { x: 0, y: 7.6 };
const CUELLO_B: PuntoLocal = { x: 0, y: 11.4 };
const CUELLO_RADIO = 2.0;

/** Cabeza: círculo en (0, 12.9), radio 3.3. */
const CABEZA_CENTRO: PuntoLocal = { x: 0, y: 12.9 };
const CABEZA_RADIO = 3.3;

/** Ojos: discos en (±1.55, 14.5), radio 0.55. */
const OJO_RADIO = 0.55;
const OJO_DERECHO: PuntoLocal = { x: 1.55, y: 14.5 };

/** Muesca del caparazón: galón (0, 6.2) → (±4.2, 2.8). */
const GALON_VERTICE: PuntoLocal = { x: 0, y: 6.2 };
const GALON_BRAZO: PuntoLocal = { x: 4.2, y: 2.8 };

/** Marca de rumbo: flecha en el flanco de babor (x negativo). */
const FLECHA_ASTA_A: PuntoLocal = { x: -6.6, y: -6.6 };
const FLECHA_ASTA_B: PuntoLocal = { x: -6.6, y: 0.2 };
const FLECHA_PUNTA: PuntoLocal = { x: -6.6, y: 1.6 };
const FLECHA_BARBA_A: PuntoLocal = { x: -7.8, y: -0.4 };
const FLECHA_BARBA_B: PuntoLocal = { x: -5.4, y: -0.4 };

/** Patas: cuatro cápsulas, delanteras más gruesas. Ejes en el costado de estribor. */
const PATA_DEL_DER_A: PuntoLocal = { x: 6.4, y: 4.0 };
const PATA_DEL_DER_B: PuntoLocal = { x: 9.4, y: 6.4 };
const PATA_DEL_RADIO = 2.0;
const PATA_TRAS_DER_A: PuntoLocal = { x: 6.6, y: -6.0 };
const PATA_TRAS_DER_B: PuntoLocal = { x: 9.2, y: -8.6 };
const PATA_TRAS_RADIO = 1.8;

/** Cola: triángulo (0, −13.6), (±1.8, −10.8). */
const COLA_PUNTA: PuntoLocal = { x: 0, y: -13.6 };
const COLA_BASE_DER: PuntoLocal = { x: 1.8, y: -10.8 };

/** Kiro: domo de radio 4.9 en torno al centro. */
const KIRO_DOMO_RADIO = 4.9;
const KIRO_OJO_DERECHO: PuntoLocal = { x: 1.85, y: -1.5 };
const KIRO_OJO_SEMI_X = 0.85;
const KIRO_OJO_SEMI_Y = 1.15;

/** Espejo en x de un punto local. */
function espejo(p: PuntoLocal): PuntoLocal {
  return { x: -p.x, y: p.y };
}

// ============================================================================
// Dibujo de las piezas (todas reciben el transformador al rumbo)
// ============================================================================

/** Transforma un punto local al rumbo y devuelve sus coordenadas de dibujo. */
type Transformador = (p: PuntoLocal) => PuntoLocal;

function trazarPolilinea(
  ctx: ContextoDibujo,
  T: Transformador,
  puntos: readonly PuntoLocal[],
  cerrar: boolean,
): void {
  if (puntos.length === 0) return;
  const primero = T(puntos[0]!);
  ctx.moveTo(primero.x, primero.y);
  for (let i = 1; i < puntos.length; i++) {
    const p = T(puntos[i]!);
    ctx.lineTo(p.x, p.y);
  }
  if (cerrar) ctx.closePath();
}

/** Traza un círculo aproximado por su centro y radio, transformado al rumbo. */
function trazarCirculo(ctx: ContextoDibujo, T: Transformador, centro: PuntoLocal, radio: number): void {
  // Muestreamos el círculo como polígono en el marco local y lo transformamos, así
  // el radio máximo del dibujo coincide con el radio geométrico bajo cualquier rumbo.
  const n = 32;
  const puntos: PuntoLocal[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    puntos.push({ x: centro.x + radio * Math.cos(a), y: centro.y + radio * Math.sin(a) });
  }
  trazarPolilinea(ctx, T, puntos, true);
}

/** Traza una cápsula (rectángulo redondeado) entre dos ejes, con un radio. */
function trazarCapsula(
  ctx: ContextoDibujo,
  T: Transformador,
  a: PuntoLocal,
  b: PuntoLocal,
  radio: number,
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo = Math.hypot(dx, dy);
  if (largo < 1e-9) {
    trazarCirculo(ctx, T, a, radio);
    return;
  }
  // Normal unitaria al eje.
  const nx = -dy / largo;
  const ny = dx / largo;
  // Cuatro esquinas del rectángulo y dos semicírculos en los extremos.
  const puntos: PuntoLocal[] = [];
  const pasos = 8;
  // Semicírculo en a.
  const angA = Math.atan2(ny, nx);
  for (let i = 0; i <= pasos; i++) {
    const t = angA + (Math.PI * i) / pasos;
    puntos.push({ x: a.x + radio * Math.cos(t), y: a.y + radio * Math.sin(t) });
  }
  // Semicírculo en b.
  const angB = Math.atan2(-ny, -nx);
  for (let i = 0; i <= pasos; i++) {
    const t = angB + (Math.PI * i) / pasos;
    puntos.push({ x: b.x + radio * Math.cos(t), y: b.y + radio * Math.sin(t) });
  }
  trazarPolilinea(ctx, T, puntos, true);
}

function dibujarCaparazon(ctx: ContextoDibujo, T: Transformador): void {
  // Contorno de gota con cúbicas entre los vértices y su espejo. Usamos las
  // tangentes suaves entre vértices consecutivos.
  const derecha = [CAPARAZON_PROA, CAPARAZON_HOMBRO, CAPARAZON_FLANCO, CAPARAZON_CUADRIL, CAPARAZON_POPA];
  const izquierda = [
    espejo(CAPARAZON_CUADRIL),
    espejo(CAPARAZON_FLANCO),
    espejo(CAPARAZON_HOMBRO),
  ];
  const contorno = [...derecha, ...izquierda];
  ctx.beginPath();
  const primero = T(contorno[0]!);
  ctx.moveTo(primero.x, primero.y);
  for (let i = 1; i < contorno.length; i++) {
    const anterior = contorno[i - 1]!;
    const actual = contorno[i]!;
    // Control de la cúbica: punto medio desplazado hacia afuera suaviza el borde.
    const c1 = T({ x: anterior.x * 0.7 + actual.x * 0.3, y: anterior.y * 0.7 + actual.y * 0.3 });
    const c2 = T({ x: anterior.x * 0.3 + actual.x * 0.7, y: anterior.y * 0.3 + actual.y * 0.7 });
    const fin = T(actual);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, fin.x, fin.y);
  }
  ctx.closePath();
}

function dibujarMuesca(ctx: ContextoDibujo, T: Transformador): void {
  // Galón: solo contorneado. Del brazo de babor al vértice al brazo de estribor.
  ctx.beginPath();
  trazarPolilinea(ctx, T, [espejo(GALON_BRAZO), GALON_VERTICE, GALON_BRAZO], false);
}

function dibujarMarcaRumbo(ctx: ContextoDibujo, T: Transformador): void {
  // Asta.
  ctx.beginPath();
  trazarPolilinea(ctx, T, [FLECHA_ASTA_A, FLECHA_ASTA_B], false);
  // Punta con barbas: de una barba a la punta a la otra barba.
  trazarPolilinea(ctx, T, [FLECHA_BARBA_A, FLECHA_PUNTA, FLECHA_BARBA_B], false);
}

function dibujarCuelloYCabeza(ctx: ContextoDibujo, T: Transformador): void {
  ctx.beginPath();
  trazarCapsula(ctx, T, CUELLO_A, CUELLO_B, CUELLO_RADIO);
  trazarCirculo(ctx, T, CABEZA_CENTRO, CABEZA_RADIO);
}

function dibujarOjos(ctx: ContextoDibujo, T: Transformador): void {
  ctx.beginPath();
  trazarCirculo(ctx, T, OJO_DERECHO, OJO_RADIO);
  trazarCirculo(ctx, T, espejo(OJO_DERECHO), OJO_RADIO);
}

function dibujarPatasTraseras(ctx: ContextoDibujo, T: Transformador): void {
  ctx.beginPath();
  trazarCapsula(ctx, T, PATA_TRAS_DER_A, PATA_TRAS_DER_B, PATA_TRAS_RADIO);
  trazarCapsula(ctx, T, espejo(PATA_TRAS_DER_A), espejo(PATA_TRAS_DER_B), PATA_TRAS_RADIO);
}

function dibujarPatasDelanteras(ctx: ContextoDibujo, T: Transformador): void {
  ctx.beginPath();
  trazarCapsula(ctx, T, PATA_DEL_DER_A, PATA_DEL_DER_B, PATA_DEL_RADIO);
  trazarCapsula(ctx, T, espejo(PATA_DEL_DER_A), espejo(PATA_DEL_DER_B), PATA_DEL_RADIO);
}

function dibujarCola(ctx: ContextoDibujo, T: Transformador): void {
  ctx.beginPath();
  trazarPolilinea(ctx, T, [COLA_PUNTA, COLA_BASE_DER, espejo(COLA_BASE_DER)], true);
}

function dibujarKiro(ctx: ContextoDibujo, T: Transformador, inclinacion: number): void {
  // El subtrazado de Kiro se gira SOLO en torno a su propio centro, por la
  // inclinación, antes de transformar al rumbo. Con inclinación 0 no gira.
  const K: Transformador = (p) => T(inclinacion === 0 ? p : girarLocal(p, CENTRO_KIRO, inclinacion));

  // Domo: semicírculo de radio 4.9, de (−4.9, cy) por (0, cy+4.9) a (4.9, cy).
  ctx.beginPath();
  const domo: PuntoLocal[] = [];
  const pasos = 24;
  for (let i = 0; i <= pasos; i++) {
    const a = Math.PI * (i / pasos); // 0 a π: lado derecho por arriba al izquierdo
    domo.push({
      x: CENTRO_KIRO.x + KIRO_DOMO_RADIO * Math.cos(a),
      y: CENTRO_KIRO.y + KIRO_DOMO_RADIO * Math.sin(a),
    });
  }
  // Faldón: tres ondas con cuadráticas, de (4.9, cy) a (−4.9, cy). El domo terminó
  // en (−4.9, cy); cerramos por el faldón hasta (4.9, cy).
  const inicioFaldon = { x: CENTRO_KIRO.x - KIRO_DOMO_RADIO, y: CENTRO_KIRO.y };
  const finFaldon = { x: CENTRO_KIRO.x + KIRO_DOMO_RADIO, y: CENTRO_KIRO.y };
  // Trazamos domo y faldón como un solo contorno cerrado.
  const dPrim = K(domo[0]!);
  ctx.moveTo(dPrim.x, dPrim.y);
  for (let i = 1; i < domo.length; i++) {
    const p = K(domo[i]!);
    ctx.lineTo(p.x, p.y);
  }
  // Tres ondas del faldón: valles en y ≈ cy−3.2 (−6.6), crestas en y ≈ cy−4.0 (−7.4).
  const anchoOnda = (finFaldon.x - inicioFaldon.x) / 3;
  let cursor = inicioFaldon;
  for (let o = 0; o < 3; o++) {
    const valleX = cursor.x + anchoOnda / 2;
    const control = K({ x: valleX, y: -6.6 });
    const siguiente = { x: inicioFaldon.x + anchoOnda * (o + 1), y: CENTRO_KIRO.y };
    const fin = K(siguiente);
    ctx.quadraticCurveTo(control.x, control.y, fin.x, fin.y);
    cursor = siguiente;
  }
  ctx.closePath();

  // Estela del fantasma: cúbica de (−1.7, −7.0) a (1.7, −7.0), ápice en y ≈ −10.0.
  ctx.beginPath();
  const estA = K({ x: -1.7, y: -7.0 });
  const c1 = K({ x: -1.2, y: -11.6 });
  const c2 = K({ x: 1.2, y: -11.6 });
  const estB = K({ x: 1.7, y: -7.0 });
  ctx.moveTo(estA.x, estA.y);
  ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, estB.x, estB.y);

  // Ojos de Kiro: elipses en (±1.85, −1.5), semiejes 0.85 y 1.15.
  ctx.beginPath();
  trazarElipseLocal(ctx, K, KIRO_OJO_DERECHO, KIRO_OJO_SEMI_X, KIRO_OJO_SEMI_Y);
  trazarElipseLocal(ctx, K, espejo(KIRO_OJO_DERECHO), KIRO_OJO_SEMI_X, KIRO_OJO_SEMI_Y);
}

/** Traza una elipse muestreada en el marco local y transformada. */
function trazarElipseLocal(
  ctx: ContextoDibujo,
  T: Transformador,
  centro: PuntoLocal,
  semiX: number,
  semiY: number,
): void {
  const n = 20;
  const puntos: PuntoLocal[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    puntos.push({ x: centro.x + semiX * Math.cos(a), y: centro.y + semiY * Math.sin(a) });
  }
  trazarPolilinea(ctx, T, puntos, true);
}

function dibujarLapiz(ctx: ContextoDibujo, T: Transformador, lapizAbajo: boolean): void {
  // Punta en (0,0) con el lápiz abajo; trasladada 8.6 a lo largo del eje si arriba.
  const desplazamiento = lapizAbajo ? 0 : DESPLAZAMIENTO_LAPIZ;
  const punta: PuntoLocal = {
    x: EJE_LAPIZ.x * desplazamiento,
    y: EJE_LAPIZ.y * desplazamiento,
  };
  const largo = 7.6;
  const radio = 0.85;
  // Eje y normal unitarios del lápiz.
  const ex = EJE_LAPIZ.x;
  const ey = EJE_LAPIZ.y;
  const nx = -ey;
  const ny = ex;
  // El cuerpo es una cápsula desde el «cuello» (a un radio de la punta a lo largo
  // del eje) hasta el extremo opuesto; la punta es un vértice afilado, así que el
  // punto dibujado más cercano al origen es exactamente la punta: 0 abajo, 8.6 arriba.
  const cuello: PuntoLocal = { x: punta.x + ex * radio, y: punta.y + ey * radio };
  const opuesto: PuntoLocal = { x: punta.x + ex * largo, y: punta.y + ey * largo };
  const cuelloDer: PuntoLocal = { x: cuello.x + nx * radio, y: cuello.y + ny * radio };
  const cuelloIzq: PuntoLocal = { x: cuello.x - nx * radio, y: cuello.y - ny * radio };

  ctx.beginPath();
  // Punta afilada: de un lado del cuello a la punta y al otro lado del cuello.
  const contorno: PuntoLocal[] = [cuelloDer, punta, cuelloIzq];
  // Semicírculo del extremo opuesto, del lado izquierdo al derecho.
  const pasos = 8;
  const angOpuesto = Math.atan2(-ny, -nx);
  for (let i = 0; i <= pasos; i++) {
    const t = angOpuesto + Math.PI + (Math.PI * i) / pasos;
    contorno.push({ x: opuesto.x + radio * Math.cos(t), y: opuesto.y + radio * Math.sin(t) });
  }
  trazarPolilinea(ctx, T, contorno, true);
}

// ============================================================================
// Función principal
// ============================================================================

/**
 * Dibuja la tortuga, Kiro y el lápiz sobre el contexto, en el orden de trazado de
 * la sección 7.4.4. Toma todo del estado recibido: no lee ningún valor global, no
 * importa el intérprete y no invoca ninguna transformación de la tortuga.
 *
 * Con la tortuga oculta no dibuja nada. Ante una posición, un rumbo o una
 * inclinación no finitos devuelve un resultado inválido que nombra el campo y el
 * valor, sin dibujar y sin lanzar. Los tres campos reservados (`kiroMontado`,
 * `identidad`, `celebracion`) se aceptan pero cualquier valor produce el mismo
 * dibujo que los predeterminados.
 *
 * @param ctx Contexto de dibujo (real o doble de prueba)
 * @param estado Estado de los personajes
 * @param leerTema Lee color y grosor del tema; se invoca en cada dibujado
 * @returns Resultado válido, o inválido con el campo y el valor no finitos
 */
export function dibujarPersonajes(
  ctx: ContextoDibujo,
  estado: EstadoPersonajes,
  leerTema: LectorTemaPersonajes,
): ResultadoDibujo {
  const { tortuga, inclinacionKiro } = estado;

  // Validación de estado: posición, rumbo e inclinación han de ser finitos.
  if (!Number.isFinite(tortuga.posicion.x)) {
    return { valido: false, campo: 'posicion.x', valorRecibido: tortuga.posicion.x };
  }
  if (!Number.isFinite(tortuga.posicion.y)) {
    return { valido: false, campo: 'posicion.y', valorRecibido: tortuga.posicion.y };
  }
  if (!Number.isFinite(tortuga.rumbo)) {
    return { valido: false, campo: 'rumbo', valorRecibido: tortuga.rumbo };
  }
  if (!Number.isFinite(inclinacionKiro)) {
    return { valido: false, campo: 'inclinacionKiro', valorRecibido: inclinacionKiro };
  }

  // Con la tortuga oculta, no se dibuja ningún píxel; las estelas no se tocan.
  if (!tortuga.visible) {
    return { valido: true };
  }

  const estilo = leerTema();

  // Rumbo reducido a [0, 360) antes de transformar.
  const rumbo = normalizarRumbo(tortuga.rumbo);
  const rad = (rumbo * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sen = Math.sin(rad);
  const cx = tortuga.posicion.x;
  const cy = tortuga.posicion.y;
  const T: Transformador = (p) => alRumbo(p, cos, sen, cx, cy);

  // Inclinación de Kiro acotada a [−20, 20].
  const inclinacion = Math.max(-INCLINACION_MAXIMA, Math.min(INCLINACION_MAXIMA, inclinacionKiro));

  ctx.save();
  ctx.lineWidth = estilo.grosor;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Orden de trazado 7.4.4.
  // 1. Patas traseras.
  ctx.strokeStyle = estilo.contorno;
  ctx.fillStyle = estilo.relleno;
  dibujarPatasTraseras(ctx, T);
  ctx.fill();
  ctx.stroke();

  // 2. Cola.
  dibujarCola(ctx, T);
  ctx.fill();
  ctx.stroke();

  // 3. Patas delanteras.
  dibujarPatasDelanteras(ctx, T);
  ctx.fill();
  ctx.stroke();

  // 4. Caparazón, relleno y contorno.
  dibujarCaparazon(ctx, T);
  ctx.fill();
  ctx.stroke();

  // 5. Muesca del caparazón (galón), solo contorno.
  dibujarMuesca(ctx, T);
  ctx.stroke();

  // 6. Marca de rumbo (flecha de babor).
  ctx.strokeStyle = estilo.marcaRumbo;
  dibujarMarcaRumbo(ctx, T);
  ctx.stroke();

  // 7. Cuello, cabeza y ojos.
  ctx.strokeStyle = estilo.contorno;
  ctx.fillStyle = estilo.relleno;
  dibujarCuelloYCabeza(ctx, T);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = estilo.cabeza;
  dibujarOjos(ctx, T);
  ctx.fill();

  // 8. Kiro, girado por la inclinación.
  ctx.strokeStyle = estilo.kiroContorno;
  ctx.fillStyle = estilo.kiroRelleno;
  dibujarKiro(ctx, T, inclinacion);
  ctx.fill();
  ctx.stroke();

  // 9. Lápiz, encima de Kiro.
  ctx.strokeStyle = estilo.lapizContorno;
  dibujarLapiz(ctx, T, tortuga.lapizAbajo);
  ctx.stroke();

  ctx.restore();
  return { valido: true };
}
