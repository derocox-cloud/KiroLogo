// Generador `tres-poligonos-m4` — nivel 4.2 del mundo 4.
//
// Un solo `PARA POLIGONO :lados :largo` sirve para tres polígonos distintos:
//
//   PARA POLIGONO :lados :largo ... FIN
//   POLIGONO a L
//   POLIGONO b L
//   POLIGONO c L
//
// Los tres comparten largo, punto y rumbo de partida (no hay instrucciones entre
// las llamadas) y tienen tres números de lados distintos. Puro: solo importa de
// `lenguaje/` y `azar/`. El lazo de reintento y el descarte por encuadre y
// dimensión mínima son los compartidos de `comun.ts`.

import type { Programa } from '../../lenguaje/ast.js';
import type { Prng } from '../../azar/prng.js';
import type { Generador } from '../tipos.js';
import { generarConReintento } from './comun.js';
import { definicionPoligono, llamadaPoligono } from './poligono-comun.js';

const LADOS_MIN = 3;
const LADOS_MAX = 8;
const LARGO_MIN = 40;
const LARGO_MAX = 200;
const PASO_CUADRICULA = 20;

export const generarTresPoligonos: Generador = (entrada) =>
  generarConReintento(entrada, (prng) => candidatoTresPoligonos(prng));

/** Elige `cantidad` valores distintos de [minimo, maximo], sin reposición. */
function elegirSinReposicion(prng: Prng, minimo: number, maximo: number, cantidad: number): number[] {
  const disponibles: number[] = [];
  for (let n = minimo; n <= maximo; n++) disponibles.push(n);
  const elegidos: number[] = [];
  for (let i = 0; i < cantidad; i++) {
    const posicion = prng.entero(0, disponibles.length - 1);
    elegidos.push(disponibles.splice(posicion, 1)[0]!);
  }
  return elegidos;
}

function candidatoTresPoligonos(prng: Prng): Programa {
  const lados = elegirSinReposicion(prng, LADOS_MIN, LADOS_MAX, 3);
  const largo = prng.multiplo(LARGO_MIN, LARGO_MAX, PASO_CUADRICULA);

  // La definición ocupa las líneas 1 a 5; las llamadas siguen en 6, 7 y 8.
  return {
    tipo: 'programa',
    instrucciones: [
      definicionPoligono(),
      llamadaPoligono(lados[0]!, largo, 6),
      llamadaPoligono(lados[1]!, largo, 7),
      llamadaPoligono(lados[2]!, largo, 8),
    ],
  };
}
