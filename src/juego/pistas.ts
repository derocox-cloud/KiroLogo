// Pistas de un reto: relleno de plantillas con los parámetros reales.
//
// Las pistas de un nivel generado son plantillas con marcadores. Esta utilidad
// las rellena con lo que de verdad hay en pantalla, leyéndolo del AST del
// programa de referencia del reto —no del rango del nivel—, para que la pista
// nunca mienta: si el reto tiene cinco tramos, la pista dice cinco (requisito
// 11.4). El esqueleto se arma con el impresor sobre una forma **parcial** (el
// primer tramo y el primer giro), nunca el programa completo (requisito 11.5).
//
// Vive en `juego/`: consume `niveles/` (el nivel), `lenguaje/` (AST e impresor)
// y el `Reto` de `juego/`. No toca el DOM ni el globo; devuelve texto.

import type { Programa, Instruccion, InvocacionComando } from '../lenguaje/ast.js';
import { imprimir } from '../lenguaje/impresor.js';
import type { Nivel } from '../niveles/tipos.js';
import type { Reto } from './reto.js';

// ============================================================================
// Parámetros visibles del reto
// ============================================================================

export interface ParametrosVisibles {
  /** Número de tramos rectos (invocaciones de AVANZA) de la referencia. */
  readonly tramos: number;
  /** Descripción en español del giro, p. ej. «90 grados alternando». */
  readonly giro: string;
  /** Lado de la cuadrícula en unidades (siempre 20 en esta spec). */
  readonly cuadros: number;
}

/** Lado de la cuadrícula del lienzo, en unidades lógicas. */
const LADO_CUADRICULA = 20;

/**
 * Extrae los parámetros que una pista puede mencionar, recorriendo el AST del
 * programa de referencia del reto: cuenta los `AVANZA` (tramos) y describe los
 * giros a partir de sus ángulos y de si alternan de sentido.
 *
 * @param reto Reto en curso
 */
export function parametrosVisiblesDelReto(reto: Reto): ParametrosVisibles {
  const instrucciones = reto.referencia.instrucciones;
  const avances = instrucciones.filter(
    (n): n is InvocacionComando => n.tipo === 'invocacionComando' && n.nombre === 'AVANZA',
  );
  const giros = instrucciones.filter(
    (n): n is InvocacionComando =>
      n.tipo === 'invocacionComando' && (n.nombre === 'GIRADERECHA' || n.nombre === 'GIRAIZQUIERDA'),
  );

  return {
    tramos: avances.length,
    giro: describirGiro(giros, reto.nivel),
    cuadros: LADO_CUADRICULA,
  };
}

/**
 * Describe los giros en español. El **ángulo** se lee del reto (el primer giro);
 * el **carácter** (alternando o a un lado u otro) es una propiedad del nivel, no
 * de un reto concreto: un camino cuyos giros, por azar, resultan alternados en
 * una semilla no es un zigzag. Por eso el carácter sale del generador del nivel,
 * mientras que el ángulo y el conteo salen del reto en pantalla.
 */
function describirGiro(giros: readonly InvocacionComando[], nivel: Nivel): string {
  if (giros.length === 0) return 'sin giros';
  const grados = anguloDe(giros[0]!);
  const texto = `${grados} grados`;

  const alterna = nivel.origen.tipo === 'generado' && nivel.origen.idGenerador === 'zigzag';
  return alterna ? `${texto} alternando` : `${texto} a un lado u otro`;
}

/** Ángulo (en grados) del literal de un giro, o 0 si no es un literal. */
function anguloDe(giro: InvocacionComando): number {
  const arg = giro.argumentos[0];
  return arg && arg.tipo === 'numeroLiteral' ? arg.valor : 0;
}

// ============================================================================
// Relleno de las pistas
// ============================================================================

/**
 * Devuelve las tres pistas del nivel listas para el globo. En un nivel autorado
 * son los textos fijos tal cual. En un nivel generado, sustituye los marcadores
 * `{tramos}`, `{giro}`, `{cuadros}` con los parámetros reales del reto y
 * `{esqueleto}` con el esqueleto impreso de la forma parcial.
 *
 * @param nivel Nivel en curso (de él salen las plantillas)
 * @param reto Reto en curso (de él salen los parámetros reales)
 */
export function rellenarPistas(nivel: Nivel, reto: Reto): readonly [string, string, string] {
  // Autorado: pistas fijas, sin marcadores que rellenar.
  if (nivel.origen.tipo === 'autorado') {
    return nivel.pistas;
  }

  const p = parametrosVisiblesDelReto(reto);
  const esqueleto = esqueletoParcial(reto.referencia);

  const rellenar = (plantilla: string): string =>
    plantilla
      .replaceAll('{tramos}', String(p.tramos))
      .replaceAll('{giro}', p.giro)
      .replaceAll('{cuadros}', String(p.cuadros))
      .replaceAll('{esqueleto}', esqueleto);

  const [conceptual, matematica, esquema] = nivel.pistas;
  return [rellenar(conceptual), rellenar(matematica), rellenar(esquema)];
}

// ============================================================================
// Esqueleto parcial
// ============================================================================

/**
 * Arma el esqueleto de una pista con el impresor sobre una forma **parcial** del
 * programa: el primer tramo y, si existe, el primer giro. Nunca el programa
 * completo. Si la referencia no tiene instrucciones imprimibles, devuelve cadena
 * vacía (no debería ocurrir con los generadores del mundo 0).
 */
export function esqueletoParcial(referencia: Programa): string {
  const parciales: Instruccion[] = [];

  // Primer AVANZA.
  const primerAvance = referencia.instrucciones.find(
    (n) => n.tipo === 'invocacionComando' && n.nombre === 'AVANZA',
  );
  if (primerAvance) parciales.push(primerAvance);

  // Primer giro.
  const primerGiro = referencia.instrucciones.find(
    (n) => n.tipo === 'invocacionComando' && (n.nombre === 'GIRADERECHA' || n.nombre === 'GIRAIZQUIERDA'),
  );
  if (primerGiro) parciales.push(primerGiro);

  if (parciales.length === 0) return '';

  const resultado = imprimir({ tipo: 'programa', instrucciones: parciales });
  // El impresor solo falla ante nodos no imprimibles, que aquí no se dan.
  return resultado.exito ? resultado.texto.trimEnd() : '';
}
