// Generador del rosetón — nivel 3.2 del mundo 3.
//
// Un rosetón es c copias de un polígono regular de n lados, giradas 360/c entre
// copia y copia alrededor del punto de partida. Su AST es un REPITE dentro de
// otro REPITE: el externo repite las copias, el interno dibuja el polígono.
//
//   REPITE c [ REPITE n [ AV L GD 360/n ] GD 360/c ]
//
// Esa es la lección del mundo: un rosetón de 36 copias es imposible de escribir
// a mano dentro del presupuesto, así que el jugador no puede evitar anidar.
//
// Es un `Generador` del contrato de `tipos.ts`, puro, que solo importa de
// `lenguaje/` y `azar/`. Produce AST (no texto ni imágenes) y reusa el lazo de
// reintento compartido de `comun.ts`: el arquetipo solo aporta cómo construir un
// candidato; el encuadre, la no degeneración y el descarte son compartidos.

import type { Programa, Instruccion } from '../../lenguaje/ast.js';
import type { Prng } from '../../azar/prng.js';
import type { Generador } from '../tipos.js';
import { avanza, giro, repite, generarConReintento } from './comun.js';

// ============================================================================
// Conjuntos de parámetros (R5.1, R5.4)
// ============================================================================

/** Copias del rosetón. 360/c es entero para todos (60,45,40,30,20,10). */
const COPIAS = [6, 8, 9, 12, 18, 36] as const;

/** Lados del polígono interno. 360/n es entero para todos (120,90,72,60). */
const LADOS = [3, 4, 5, 6] as const;

/**
 * Rango del lado del polígono interno, en múltiplos de 20. El lazo de reintento
 * descarta las combinaciones que no encuadran o degeneran; este rango está
 * elegido para que la amplia mayoría de las semillas acepte a la primera. El
 * límite superior lo fija el peor caso de tamaño —un hexágono (n=6), cuyo
 * diámetro es 2·L— contra el lienzo [−400,400]: con L≤160 el rosetón entra. El
 * inferior deja que polígonos de pocos lados y L chico (que degenerarían, por
 * debajo de 200 px) se descarten, no que falten.
 */
const LARGO_MIN = 60;
const LARGO_MAX = 160;
const PASO_CUADRICULA = 20;

// ============================================================================
// Generador
// ============================================================================

/**
 * Genera el reto del nivel 3.2. Delega en el lazo compartido, que reintenta con
 * la semilla siguiente hasta encontrar un rosetón encuadrado y no degenerado.
 */
export const generarRoseton: Generador = (entrada) =>
  generarConReintento(entrada, (prng) => candidatoRoseton(prng));

// ============================================================================
// Construcción de un candidato
// ============================================================================

/**
 * Construye un candidato de rosetón a partir del PRNG del intento. La forma es
 * exactamente `REPITE c [REPITE n [AV L GD 360/n] GD 360/c]`, el AST más compacto
 * que dibuja la figura, de modo que el presupuesto que el reto calcule de este
 * AST es el mínimo.
 */
function candidatoRoseton(prng: Prng): Programa {
  const c = prng.elegir(COPIAS);
  const n = prng.elegir(LADOS);
  const largo = prng.multiplo(LARGO_MIN, LARGO_MAX, PASO_CUADRICULA);

  // Cuerpo del REPITE interno: dibuja un lado y gira 360/n.
  const cuerpoInterno: Instruccion[] = [avanza(largo, 2), giro('GIRADERECHA', 360 / n, 2)];

  // Cuerpo del REPITE externo: el polígono interno y el giro entre copias.
  const cuerpoExterno: Instruccion[] = [repite(n, cuerpoInterno, 1), giro('GIRADERECHA', 360 / c, 1)];

  return { tipo: 'programa', instrucciones: [repite(c, cuerpoExterno, 1)] };
}
