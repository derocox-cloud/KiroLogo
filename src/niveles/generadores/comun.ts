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

import type {
  Programa,
  Instruccion,
  InvocacionComando,
  NumeroLiteral,
  Repeticion,
  Expresion,
  ReferenciaParametro,
  ExpresionAritmetica,
  DefinicionProcedimiento,
  InvocacionProcedimiento,
} from '../../lenguaje/ast.js';
import { evaluar, cantidadDeRepeticiones } from '../../lenguaje/evaluador.js';
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
// Constructores de nodos del AST
// ============================================================================

/** Un argumento o cantidad: número simple o expresión ya construida. */
type ValorOExpresion = number | Expresion;

function comoExpresion(valor: ValorOExpresion, linea: number, columna: number): Expresion {
  return typeof valor === 'number' ? { tipo: 'numeroLiteral', valor, linea, columna } : valor;
}

/** Literal numérico con posición sintética (columna 1). */
export function numero(valor: number, linea: number): NumeroLiteral {
  return { tipo: 'numeroLiteral', valor, linea, columna: 1 };
}

/** Referencia a un parámetro, `:nombre`. El nombre viaja sin los dos puntos. */
export function parametro(nombre: string, linea: number): ReferenciaParametro {
  return { tipo: 'referenciaParametro', nombre: nombre.replace(/^:/, ''), linea, columna: 1 };
}

/** Operación infija, p. ej. `360 / :lados`. */
export function operacion(
  op: '+' | '-' | '*' | '/',
  izquierda: Expresion,
  derecha: Expresion,
  linea: number,
): ExpresionAritmetica {
  return { tipo: 'expresionAritmetica', operador: op, izquierda, derecha, linea, columna: 1 };
}

/** `PARA NOMBRE :p1 :p2 … FIN`. */
export function definicion(
  nombre: string,
  parametros: readonly string[],
  cuerpo: readonly Instruccion[],
  linea: number,
): DefinicionProcedimiento {
  return {
    tipo: 'definicionProcedimiento',
    nombre,
    parametros: parametros.map((p) => p.replace(/^:/, '')),
    cuerpo,
    linea,
    columna: 1,
  };
}

/** Llamada a un procedimiento propio con sus argumentos. */
export function llamada(nombre: string, argumentos: readonly Expresion[], linea: number): InvocacionProcedimiento {
  return { tipo: 'invocacionProcedimiento', nombre, argumentos, linea, columna: 1 };
}

/**
 * Construye un `AVANZA n` como nodo del AST. La línea es la del comando (1 por
 * instrucción, en orden); la columna del comando es 1 y la del número sigue al
 * nombre más un espacio, coherente con lo que produciría el parser.
 */
export function avanza(n: ValorOExpresion, linea: number): InvocacionComando {
  return invocacion('AVANZA', n, linea);
}

/**
 * Construye un giro `GIRADERECHA g` o `GIRAIZQUIERDA g` como nodo del AST.
 */
export function giro(
  nombre: 'GIRADERECHA' | 'GIRAIZQUIERDA',
  grados: ValorOExpresion,
  linea: number,
): InvocacionComando {
  return invocacion(nombre, grados, linea);
}

/**
 * Construye un `REPITE veces [ … ]` como nodo del AST. `veces` viaja como
 * literal numérico o como expresión (`:lados`), coherente con lo que produciría el parser.
 */
export function repite(veces: ValorOExpresion, cuerpo: readonly Instruccion[], linea: number): Repeticion {
  const columnaNumero = 'REPITE'.length + 2; // nombre + un espacio, columnas desde 1
  return {
    tipo: 'repeticion',
    veces: comoExpresion(veces, linea, columnaNumero),
    cuerpo,
    linea,
    columna: 1,
  };
}

/** Nodo de invocación de un comando de aridad 1. */
function invocacion(nombre: string, valor: ValorOExpresion, linea: number): InvocacionComando {
  const columnaNumero = nombre.length + 2; // nombre + un espacio, columnas desde 1
  return {
    tipo: 'invocacionComando',
    nombre,
    argumentos: [comoExpresion(valor, linea, columnaNumero)],
    linea,
    columna: 1,
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

/** Tope de pasos simulados: más allá, el candidato se descarta (D3). */
const MAXIMO_PASOS_CAJA = 50_000;

/** Tope de anidación de llamadas: evita desbordar la pila con recursión sin caso base. */
const MAXIMA_PROFUNDIDAD_CAJA = 100;

/**
 * Recorre el AST de un candidato acumulando la caja envolvente de la estela, con
 * la MISMA geometría que `motor/tortuga.ts`: parte de (0,0) con rumbo 0 apuntando
 * hacia +y; `AVANZA d` mueve `Δx = sen·d`, `Δy = cos·d`; `RETROCEDE d` en sentido
 * opuesto; `GIRADERECHA g` suma al rumbo, `GIRAIZQUIERDA g` resta. El lápiz
 * siempre está abajo, así que todo tramo cuenta.
 *
 * Entiende `PARA` (definiciones del nivel superior), llamadas con entorno y
 * expresiones, evaluadas con `evaluar` de `lenguaje/`. No usa el intérprete ni
 * importa de `motor/`; una prueba compara la caja con los segmentos reales.
 *
 * @returns la caja envolvente, o `null` si no dibuja ningún tramo, si una
 *   evaluación falla, si un procedimiento no existe o si pasa de 50 000 pasos
 */
export function cajaDeReferencia(programa: Programa): Caja | null {
  const estado: EstadoCaja = {
    x: 0,
    y: 0,
    rumbo: 0, // grados, 0 hacia +y
    izquierda: Infinity,
    derecha: -Infinity,
    abajo: Infinity,
    arriba: -Infinity,
    hayTramo: false,
    pasos: 0,
    definiciones: new Map(),
  };
  for (const instruccion of programa.instrucciones) {
    if (instruccion.tipo === 'definicionProcedimiento') {
      estado.definiciones.set(instruccion.nombre.toLowerCase(), instruccion);
    }
  }

  const completo = recorrer(programa.instrucciones, estado, new Map(), 0);

  if (!completo || !estado.hayTramo) return null;
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
  pasos: number;
  readonly definiciones: Map<string, DefinicionProcedimiento>;
}

type Entorno = ReadonlyMap<string, number>;

/** Evalúa una expresión del candidato; `null` si falla. El azar no se usa en los candidatos. */
function valorDe(expresion: Expresion, entorno: Entorno): number | null {
  const r = evaluar(expresion, { valores: entorno, linea: expresion.linea, azar: () => 0 });
  return r.exito ? r.valor : null;
}

/**
 * Recorre una lista de instrucciones mutando el estado de la tortuga.
 * @returns `false` si hay que descartar el candidato (error, tope o procedimiento inexistente)
 */
function recorrer(
  instrucciones: readonly Instruccion[],
  estado: EstadoCaja,
  entorno: Entorno,
  profundidad: number,
): boolean {
  for (const instruccion of instrucciones) {
    if (++estado.pasos > MAXIMO_PASOS_CAJA) return false;

    if (instruccion.tipo === 'repeticion') {
      const valor = valorDe(instruccion.veces, entorno);
      if (valor === null) return false;
      const veces = cantidadDeRepeticiones(valor);
      if (veces === null) return false;
      for (let i = 0; i < veces; i++) {
        if (++estado.pasos > MAXIMO_PASOS_CAJA) return false;
        if (!recorrer(instruccion.cuerpo, estado, entorno, profundidad)) return false;
      }
      continue;
    }
    if (instruccion.tipo === 'invocacionProcedimiento') {
      const definida = estado.definiciones.get(instruccion.nombre.toLowerCase());
      if (definida === undefined) return false;
      if (profundidad >= MAXIMA_PROFUNDIDAD_CAJA) return false;
      if (instruccion.argumentos.length !== definida.parametros.length) return false;
      const nuevo = new Map<string, number>();
      for (let i = 0; i < definida.parametros.length; i++) {
        const valor = valorDe(instruccion.argumentos[i]!, entorno);
        if (valor === null) return false;
        nuevo.set(definida.parametros[i]!.toLowerCase(), valor);
      }
      if (!recorrer(definida.cuerpo, estado, nuevo, profundidad + 1)) return false;
      continue;
    }
    if (instruccion.tipo === 'invocacionComando') {
      if (!aplicarComando(instruccion, estado, entorno)) return false;
    }
    // Las definiciones ya se registraron; otros nodos no aparecen en los candidatos.
  }
  return true;
}

/**
 * Aplica un comando de movimiento o giro al estado de la tortuga, con la misma
 * geometría que `motor/tortuga.ts`. Un AVANZA/RETROCEDE anota los dos extremos
 * del tramo en la caja; un giro solo cambia el rumbo.
 * @returns `false` si el argumento no se pudo evaluar
 */
function aplicarComando(comando: InvocacionComando, estado: EstadoCaja, entorno: Entorno): boolean {
  const arg = comando.argumentos[0];
  if (arg === undefined) return true; // CENTRO, BORRAPANTALLA…: no mueven la caja
  const valor = valorDe(arg, entorno);
  if (valor === null) return false;

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
    default:
      break;
  }
  return true;
}

/** Expande la caja envolvente del estado para incluir el punto (px, py). */
function anotarEnCaja(estado: EstadoCaja, px: number, py: number): void {
  if (px < estado.izquierda) estado.izquierda = px;
  if (px > estado.derecha) estado.derecha = px;
  if (py < estado.abajo) estado.abajo = py;
  if (py > estado.arriba) estado.arriba = py;
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
