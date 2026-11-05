// Generador de la flor — nivel 3.3 del mundo 3.
//
// La flor es pariente del rosetón, pero cada pétalo GIRA antes de avanzar, no
// después. Ese cambio de orden es la lección del nivel: la misma potencia de
// anidar REPITE produce una familia de figuras distinta según dónde caiga el
// giro. La forma exacta es:
//
//   REPITE c [ REPITE n [ GD a AV L ] GD 360/c ]
//
// Es un `Generador` del contrato de `tipos.ts`, puro, que solo importa de
// `lenguaje/` y `azar/`. Produce AST y reusa el lazo de reintento compartido de
// `comun.ts`.

import type { Programa, Instruccion } from '../../lenguaje/ast.js';
import type { Prng } from '../../azar/prng.js';
import type { Generador } from '../tipos.js';
import { avanza, giro, repite, generarConReintento } from './comun.js';

// ============================================================================
// Conjuntos de parámetros (R5.3, R5.4)
// ============================================================================

/** Pétalos de la flor. 360/c es entero para todos (60,45,40,30). */
const PETALOS = [6, 8, 9, 12] as const;

/** Segmentos por pétalo. Pocos, para que el pétalo quede compacto. */
const SEGMENTOS = [2, 3, 4] as const;

/**
 * Ángulo previo al avance en cada segmento del pétalo. Todos derivables: 30, 45,
 * 60 y 90 son múltiplos de 15; 72 es 360/5. El giro previo abre el pétalo.
 */
const ANGULOS = [30, 45, 60, 72, 90] as const;

/**
 * Rango del largo de cada segmento, en múltiplos de 20. El lazo de reintento
 * descarta lo que no encuadra o degenera; el rango está elegido para que la
 * mayoría de las semillas acepte a la primera. El límite superior lo acota el
 * peor caso de extensión de la flor contra el lienzo [−400,400]; el inferior
 * deja que los pétalos demasiado chicos (por debajo de 200 px de caja) se
 * descarten en vez de faltar.
 */
const LARGO_MIN = 40;
const LARGO_MAX = 120;
const PASO_CUADRICULA = 20;

// ============================================================================
// Generador
// ============================================================================

/**
 * Genera el reto del nivel 3.3. Delega en el lazo compartido, que reintenta con
 * la semilla siguiente hasta encontrar una flor encuadrada y no degenerada.
 */
export const generarFlor: Generador = (entrada) =>
  generarConReintento(entrada, (prng) => candidatoFlor(prng));

// ============================================================================
// Construcción de un candidato
// ============================================================================

/**
 * Construye un candidato de flor a partir del PRNG del intento. La forma es
 * exactamente `REPITE c [REPITE n [GD a AV L] GD 360/c]`: giro ANTES del avance
 * en cada segmento del pétalo, y giro de 360/c entre pétalos.
 */
function candidatoFlor(prng: Prng): Programa {
  const c = prng.elegir(PETALOS);
  const n = prng.elegir(SEGMENTOS);
  const a = prng.elegir(ANGULOS);
  const largo = prng.multiplo(LARGO_MIN, LARGO_MAX, PASO_CUADRICULA);

  // Cuerpo del REPITE interno: gira y LUEGO avanza (giro previo al avance).
  const cuerpoInterno: Instruccion[] = [giro('GIRADERECHA', a, 2), avanza(largo, 2)];

  // Cuerpo del REPITE externo: el pétalo y el giro entre pétalos.
  const cuerpoExterno: Instruccion[] = [repite(n, cuerpoInterno, 1), giro('GIRADERECHA', 360 / c, 1)];

  return { tipo: 'programa', instrucciones: [repite(c, cuerpoExterno, 1)] };
}
