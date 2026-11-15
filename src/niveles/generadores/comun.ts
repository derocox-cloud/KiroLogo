// Utilidades compartidas por los generadores de KiroLogo.
//
// Fija el patrón que reusan los siete generadores del proyecto:
//   - el lazo de reintento con la semilla siguiente, acotado por `intentosMaximos`;
//   - el criterio de aceptación (encuadrado y no degenerado);
//   - la simulación pura de la tortuga para calcular la caja envolvente;
//   - los constructores de nodos del AST del mundo 0.
//
// `niveles/` solo puede importar de `lenguaje/` y `azar/`, así que este módulo
// NO importa `motor/encuadre.ts`; reimplementa su criterio con las mismas dos
// constantes (400 y 200). Una prueba las ancla contra el comportamiento real de
// `motor/encuadre.ts` para que no se separen.

import type { Programa, Instruccion, InvocacionComando, NumeroLiteral, Repeticion } from '../../lenguaje/ast.js';
import { crearPrng, type Prng, SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../../azar/prng.js';
import { crearError } from '../../lenguaje/errores.js';
import type { EntradaGenerador, ResultadoGeneracion } from '../tipos.js';

// ============================================================================
// Constantes de encuadre (espejo de motor/encuadre.ts, ancladas por prueba)
// ============================================================================

/** Límite del lienzo lógico: [−400, 400] inclusive en ambos ejes. */
export const LIMITE_LIENZO = 400;

/** Ancho o alto mínimo para que la figura no sea degenerada (200 no cuenta). */
export const DIMENSION_MINIMA = 200;

// ============================================================================
// Constructores de nodos del AST del mundo 0
// ============================================================================

/**
 * Construye un `AVANZA n` como nodo del AST. La línea es la del comando (1 por
 * instrucción, en orden); la columna del comando es 1 y la del número sigue al
 * nombre más un espacio, coherente con lo que produciría el parser.
 */
export function avanza(n: number, linea: number): InvocacionComando {
  return invocacion('AVANZA', n, linea);
}

/**
 * Construye un giro `GIRADERECHA g` o `GIRAIZQUIERDA g` como nodo del AST.
 */
export function giro(nombre: 'GIRADERECHA' | 'GIRAIZQUIERDA', grados: number, linea: number): InvocacionComando {
  return invocacion(nombre, grados, linea);
}

/**
 * Construye un `REPITE veces [ … ]` como nodo del AST. El mundo 1 en adelante lo
 * usa; el mundo 3 lo anida (un `repite` en el cuerpo de otro). `veces` viaja como
 * literal numérico, coherente con lo que produciría el parser.
 */
export function repite(veces: number, cuerpo: readonly Instruccion[], linea: number): Repeticion {
  const columnaNombre = 1;
  const columnaNumero = 'REPITE'.length + 2; // nombre + un espacio, columnas desde 1
  const vecesNodo: NumeroLiteral = {
    tipo: 'numeroLiteral',
    valor: veces,
    linea,
    columna: columnaNumero,
  };
  return {
    tipo: 'repeticion',
    veces: vecesNodo,
    cuerpo,
    linea,
    columna: columnaNombre,
  };
}

/** Nodo de invocación de un comando de aridad 1 con un literal numérico. */
function invocacion(nombre: string, valor: number, linea: number): InvocacionComando {
  const columnaNombre = 1;
  const columnaNumero = nombre.length + 2; // nombre + un espacio, columnas desde 1
  const argumento: NumeroLiteral = {
    tipo: 'numeroLiteral',
    valor,
    linea,
    columna: columnaNumero,
  };
  return {
    tipo: 'invocacionComando',
    nombre,
    argumentos: [argumento],
    linea,
    columna: columnaNombre,
  };
}

// ============================================================================
// Simulación pura de la tortuga (solo para el filtro de aceptación)
// ============================================================================

interface Caja {
  readonly izquierda: number;
  readonly derecha: number;
  readonly abajo: number;
  readonly arriba: number;
}

/**
 * Recorre el AST de un candidato del mundo 0 acumulando la caja envolvente de la
 * estela, con la MISMA geometría que `motor/tortuga.ts`: parte de (0,0) con
 * rumbo 0 apuntando hacia +y; `AVANZA d` mueve `Δx = sen·d`, `Δy = cos·d`;
 * `RETROCEDE d` mueve en sentido opuesto; `GIRADERECHA g` suma al rumbo,
 * `GIRAIZQUIERDA g` resta. En el mundo 0 el lápiz siempre está abajo, así que
 * todo tramo cuenta.
 *
 * No sustituye al intérprete: es solo el filtro que decide si el generador
 * acepta el candidato. El reto real se ejecuta después con `interprete.ts`.
 *
 * @returns la caja envolvente, o `null` si el candidato no dibuja ningún tramo
 */
export function cajaDeReferencia(programa: Programa): Caja | null {
  // Estado mutable de la tortuga compartido por todo el recorrido, incluidos los
  // cuerpos de las repeticiones. Parte de (0,0) con rumbo 0 apuntando hacia +y.
  const estado = {
    x: 0,
    y: 0,
    rumbo: 0, // grados, 0 hacia +y
    izquierda: Infinity,
    derecha: -Infinity,
    abajo: Infinity,
    arriba: -Infinity,
    hayTramo: false,
  };

  recorrer(programa.instrucciones, estado);

  if (!estado.hayTramo) return null;
  return {
    izquierda: estado.izquierda,
    derecha: estado.derecha,
    abajo: estado.abajo,
    arriba: estado.arriba,
  };
}

interface EstadoCaja {
  x: number;
  y: number;
  rumbo: number;
  izquierda: number;
  derecha: number;
  abajo: number;
  arriba: number;
  hayTramo: boolean;
}

/**
 * Recorre una lista de instrucciones mutando el estado de la tortuga. Los nodos
 * `repeticion` se ejecutan `veces` veces sobre su `cuerpo` —con la misma
 * geometría que `motor/tortuga.ts`— porque el mundo 3 es todo REPITE anidado y
 * una caja que ignorara la repetición daría una figura vacía o degenerada. El
 * mundo 0/1/2 queda idéntico: sus candidatos sin REPITE recorren exactamente las
 * mismas ramas de siempre.
 */
function recorrer(instrucciones: readonly Instruccion[], estado: EstadoCaja): void {
  for (const instruccion of instrucciones) {
    if (instruccion.tipo === 'repeticion') {
      const veces = instruccion.veces.tipo === 'numeroLiteral' ? instruccion.veces.valor : 0;
      for (let i = 0; i < veces; i++) {
        recorrer(instruccion.cuerpo, estado);
      }
      continue;
    }
    if (instruccion.tipo === 'invocacionComando') {
      aplicarComando(instruccion, estado);
    }
    // Otros nodos (procedimientos, condicionales…) no aparecen en los candidatos
    // de los generadores, que solo usan AVANZA/RETROCEDE/giros y REPITE.
  }
}

/**
 * Aplica un comando de movimiento o giro al estado de la tortuga, con la misma
 * geometría que `motor/tortuga.ts`. Un AVANZA/RETROCEDE anota los dos extremos
 * del tramo en la caja; un giro solo cambia el rumbo.
 */
function aplicarComando(comando: InvocacionComando, estado: EstadoCaja): void {
  const valor = argumentoNumerico(comando);
  if (valor === null) return;

  switch (comando.nombre) {
    case 'AVANZA':
    case 'RETROCEDE': {
      const signo = comando.nombre === 'AVANZA' ? 1 : -1;
      const rad = (estado.rumbo * Math.PI) / 180;
      const desdeX = estado.x;
      const desdeY = estado.y;
      estado.x += Math.sin(rad) * valor * signo;
      estado.y += Math.cos(rad) * valor * signo;
      anotarEnCaja(estado, desdeX, desdeY);
      anotarEnCaja(estado, estado.x, estado.y);
      estado.hayTramo = true;
      break;
    }
    case 'GIRADERECHA':
      estado.rumbo = normalizar(estado.rumbo + valor);
      break;
    case 'GIRAIZQUIERDA':
      estado.rumbo = normalizar(estado.rumbo - valor);
      break;
    // CENTRO y BORRAPANTALLA no aparecen en los candidatos de esta spec.
    default:
      break;
  }
}

/** Expande la caja envolvente del estado para incluir el punto (px, py). */
function anotarEnCaja(estado: EstadoCaja, px: number, py: number): void {
  if (px < estado.izquierda) estado.izquierda = px;
  if (px > estado.derecha) estado.derecha = px;
  if (py < estado.abajo) estado.abajo = py;
  if (py > estado.arriba) estado.arriba = py;
}

/** Extrae el argumento numérico literal de una invocación de aridad 1, o null. */
function argumentoNumerico(nodo: InvocacionComando): number | null {
  const arg = nodo.argumentos[0];
  if (arg && arg.tipo === 'numeroLiteral') return arg.valor;
  return null;
}

/** Reduce un rumbo a [0, 360). */
function normalizar(grados: number): number {
  let r = grados % 360;
  if (r < 0) r += 360;
  return r;
}

// ============================================================================
// Criterio de aceptación
// ============================================================================

/**
 * ¿El candidato cabe en el lienzo y no es degenerado? El criterio es el de
 * `motor/encuadre.ts`, sobre la caja **alineada a los ejes** de la figura tal
 * como se dibuja: cabe si su caja queda dentro de [−400, 400] en ambos ejes
 * (exactamente ±400 no cuenta como fuera); no es degenerado si su ancho y su
 * alto son ambos ≥ 200 (exactamente 200 sí cuenta). Un candidato sin tramos se
 * rechaza.
 *
 * Se mide la caja tal como se dibuja —no una envolvente rotada— porque es así
 * como el jugador ve la figura y como `motor/encuadre.ts` la juzga: una figura
 * que, dibujada, es un trazo fino en diagonal es un garabato, no un reto, por
 * más que una caja girada la hiciera parecer ancha. Son los generadores los que
 * deben producir figuras que llenen el plano, no el filtro el que las disculpe.
 */
export function esAceptable(programa: Programa): boolean {
  const caja = cajaDeReferencia(programa);
  if (caja === null) return false;

  // Encuadrado: dentro del lienzo.
  if (caja.izquierda < -LIMITE_LIENZO) return false;
  if (caja.derecha > LIMITE_LIENZO) return false;
  if (caja.abajo < -LIMITE_LIENZO) return false;
  if (caja.arriba > LIMITE_LIENZO) return false;

  // No degenerado: ambos ejes ≥ 200.
  const ancho = caja.derecha - caja.izquierda;
  const alto = caja.arriba - caja.abajo;
  if (ancho < DIMENSION_MINIMA || alto < DIMENSION_MINIMA) return false;

  return true;
}

// ============================================================================
// Lazo de reintento
// ============================================================================

/** Construye un candidato AST a partir del PRNG del intento en curso. */
export type CandidatoDe = (prng: Prng) => Programa;

/**
 * Ejecuta el patrón común de todos los generadores: crea el PRNG con la semilla
 * del intento, pide un candidato, y si es aceptable lo devuelve con su semilla
 * efectiva y el número de descartes previos; si no, reintenta con la semilla
 * siguiente, hasta `intentosMaximos`. Agotados los intentos, devuelve un fallo
 * de programación (`generadorSinCandidato`) sin lanzar una excepción.
 *
 * @param entrada Semilla inicial, parámetros del nivel y máximo de intentos
 * @param candidatoDe Constructor del candidato específico del arquetipo
 */
export function generarConReintento(entrada: EntradaGenerador, candidatoDe: CandidatoDe): ResultadoGeneracion {
  let semilla = normalizarSemilla(entrada.semilla);

  for (let intento = 0; intento < entrada.intentosMaximos; intento++) {
    const prng = crearPrng(semilla);
    const referencia = candidatoDe(prng);
    if (esAceptable(referencia)) {
      return { exito: true, referencia, semillaEfectiva: semilla, descartes: intento };
    }
    semilla = siguienteSemilla(semilla);
  }

  return { exito: false, error: crearError('generadorSinCandidato', {}), intentos: entrada.intentosMaximos };
}

// ============================================================================
// Semillas
// ============================================================================

/** Ajusta una semilla al dominio [0, 4 294 967 295] por envoltura. */
function normalizarSemilla(semilla: number): number {
  if (!Number.isInteger(semilla)) return SEMILLA_MINIMA;
  const rango = SEMILLA_MAXIMA - SEMILLA_MINIMA + 1;
  let s = semilla % rango;
  if (s < 0) s += rango;
  return s;
}

/** La semilla siguiente, con envoltura al inicio del dominio tras el máximo. */
export function siguienteSemilla(semilla: number): number {
  return semilla >= SEMILLA_MAXIMA ? SEMILLA_MINIMA : semilla + 1;
}
