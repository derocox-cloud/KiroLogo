// Generador `poligonos-encajados-m4` — nivel 4.3 del mundo 4 (D15).
//
// El mismo polígono dibujado `copias` veces, cada vez con el lado 20 más largo:
//
//   PARA POLIGONO :lados :largo ... FIN
//   POLIGONO n base
//   POLIGONO n base + 20
//   ...
//
// Las llamadas parten del mismo punto y rumbo y no hay instrucciones entre ellas,
// así que los polígonos comparten el vértice de partida y el primer lado: son
// homotecias con centro en ese vértice, no concéntricos. Puro: solo importa de
// `lenguaje/` y `azar/`. El lazo de reintento y el descarte (encuadre y
// dimensión mínima) son los compartidos de `comun.ts`.

import type { Instruccion, Programa } from '../../lenguaje/ast.js';
import type { Prng } from '../../azar/prng.js';
import type { Generador } from '../tipos.js';
import { generarConReintento } from './comun.js';
import { definicionPoligono, llamadaPoligono } from './poligono-comun.js';

const LADOS_MIN = 3;
const LADOS_MAX = 8;
const COPIAS_MIN = 3;
const COPIAS_MAX = 5;
const LARGO_MIN = 40;
const LARGO_MAX = 200;
const PASO_CUADRICULA = 20;

export const generarPoligonosEncajados: Generador = (entrada) =>
  generarConReintento(entrada, (prng) => candidatoPoligonosEncajados(prng));

function candidatoPoligonosEncajados(prng: Prng): Programa {
  const lados = prng.entero(LADOS_MIN, LADOS_MAX);
  const copias = prng.entero(COPIAS_MIN, COPIAS_MAX);
  // El mayor largo es base + 20·(copias − 1), que nunca pasa de LARGO_MAX.
  const base = prng.multiplo(LARGO_MIN, LARGO_MAX - PASO_CUADRICULA * (copias - 1), PASO_CUADRICULA);

  // La definición ocupa las líneas 1 a 5; las llamadas siguen desde la 6.
  const instrucciones: Instruccion[] = [definicionPoligono()];
  for (let k = 0; k < copias; k++) {
    instrucciones.push(llamadaPoligono(lados, base + PASO_CUADRICULA * k, 6 + k));
  }
  return { tipo: 'programa', instrucciones };
}
