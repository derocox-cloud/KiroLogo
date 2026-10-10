// Generador de zigzag — nivel 0.5 del mundo 0.
//
// Un zigzag de tramos rectos unidos por giros de 90° cuyo sentido se **alterna**
// de un vértice al siguiente (derecha, izquierda, derecha…). La alternancia es la
// lección: el jugador no puede repetir el mismo giro, tiene que leer el dibujo.
//
// Nota sobre el ángulo (verificado con figuras reales, ver el diseño de la spec
// 01): los giros son de 90°, no de 45°. Con la geometría de la tortuga —que parte
// mirando hacia arriba— un zigzag de giros de 45° alternados se dibuja como un
// trazo fino en diagonal, degenerado por construcción (su caja envolvente es casi
// una línea). Un zigzag de 90° alternados sí llena el plano en los dos ejes, que
// es lo que `motor/encuadre.ts` exige y lo que se ve como un dibujo con intención.
//
// Es el segundo generador del proyecto y sigue el mismo patrón de `comun.ts` que
// el camino: el arquetipo solo aporta cómo construir un candidato; el lazo de
// reintento, el encuadre y el descarte son compartidos. Produce AST (no texto ni
// imágenes) y solo usa el vocabulario del mundo 0.

import type { Programa } from '../../lenguaje/ast.js';
import type { Prng } from '../../azar/prng.js';
import type { Generador } from '../tipos.js';
import { avanza, giro, generarConReintento } from './comun.js';

// ============================================================================
// Parámetros del nivel
// ============================================================================

/**
 * Rangos del nivel 0.5, con sus valores por omisión verificados (ver el diseño
 * de la spec 01): 4 a 8 tramos, longitud múltiplo de 20 entre 60 y 120. Los
 * valores llegan en `parametros` del nivel; si falta alguno, se usa el de aquí.
 */
const POR_OMISION = {
  tramosMin: 4,
  tramosMax: 8,
  largoMin: 60,
  largoMax: 120,
} as const;

/** Paso de la cuadrícula: toda longitud recta es múltiplo de 20. */
const PASO_CUADRICULA = 20;

/** Ángulo de los giros del zigzag, en grados (ver la nota de cabecera). */
const GIRO = 90;

// ============================================================================
// Generador
// ============================================================================

/**
 * Genera el reto del nivel 0.5. Delega en el lazo compartido, que reintenta con
 * la semilla siguiente hasta encontrar un zigzag encuadrado y no degenerado.
 */
export const generarZigzag: Generador = (entrada) =>
  generarConReintento(entrada, (prng) => candidatoZigzag(prng, entrada.parametros));

// ============================================================================
// Construcción de un candidato
// ============================================================================

/**
 * Construye un candidato de zigzag a partir del PRNG del intento: un `AVANZA`
 * por tramo y, entre dos tramos, un giro de 90° cuyo sentido **alterna** —
 * empezando por uno elegido del PRNG— de un vértice al siguiente, sin giro
 * final. Es la forma más compacta de la plantilla, así que el presupuesto que el
 * reto calcule de este AST es el mínimo.
 */
function candidatoZigzag(prng: Prng, parametros: Readonly<Record<string, number>>): Programa {
  const tramosMin = parametros['tramosMin'] ?? POR_OMISION.tramosMin;
  const tramosMax = parametros['tramosMax'] ?? POR_OMISION.tramosMax;
  const largoMin = parametros['largoMin'] ?? POR_OMISION.largoMin;
  const largoMax = parametros['largoMax'] ?? POR_OMISION.largoMax;

  const tramos = prng.entero(tramosMin, tramosMax);
  const instrucciones: Programa['instrucciones'][number][] = [];
  let linea = 1;

  // El primer giro sale del PRNG; luego el sentido alterna.
  let sentido: 'GIRADERECHA' | 'GIRAIZQUIERDA' = prng.elegir(['GIRADERECHA', 'GIRAIZQUIERDA'] as const);

  for (let i = 0; i < tramos; i++) {
    const largo = prng.multiplo(largoMin, largoMax, PASO_CUADRICULA);
    instrucciones.push(avanza(largo, linea));
    linea += 1;

    // Giro entre tramos, nunca tras el último; el sentido alterna cada vez.
    if (i < tramos - 1) {
      instrucciones.push(giro(sentido, GIRO, linea));
      linea += 1;
      sentido = sentido === 'GIRADERECHA' ? 'GIRAIZQUIERDA' : 'GIRADERECHA';
    }
  }

  return { tipo: 'programa', instrucciones };
}
