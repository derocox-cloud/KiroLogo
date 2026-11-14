// Generador de la estrella paramétrica — nivel 4.4 del mundo 4.
//
// La forma es una definición con dos parámetros y una sola llamada:
//
//   PARA ESTRELLA :puntas :largo
//     REPITE :puntas [AVANZA :largo GIRADERECHA 360 * 2 / :puntas]
//   FIN
//   ESTRELLA p L
//
// El giro 360 * 2 / :puntas se deja SIN evaluar: el AST conserva la expresión.
// Con puntas impar, 2 vueltas completas cierran la estrella. Es un `Generador`
// puro que solo importa de `lenguaje/` y `azar/`.

import type { Programa } from '../../lenguaje/ast.js';
import type { Prng } from '../../azar/prng.js';
import type { Generador } from '../tipos.js';
import {
  avanza,
  giro,
  repite,
  parametro,
  operacion,
  numero,
  definicion,
  llamada,
  generarConReintento,
} from './comun.js';

/** Puntas impares: con ellas el giro de 720/p cierra la estrella en 2 vueltas. */
const PUNTAS = [5, 7, 9, 11] as const;

const LARGO_MIN = 40;
const LARGO_MAX = 200;
const PASO_CUADRICULA = 20;

/**
 * Genera el reto del nivel 4.4. Reintenta con la semilla siguiente hasta
 * encontrar una estrella encuadrada y no degenerada.
 */
export const generarEstrellaParametrica: Generador = (entrada) =>
  generarConReintento(entrada, (prng) => candidatoEstrella(prng));

function candidatoEstrella(prng: Prng): Programa {
  const puntas = prng.elegir(PUNTAS);
  const largo = prng.multiplo(LARGO_MIN, LARGO_MAX, PASO_CUADRICULA);

  // 360 * 2 / :puntas, asociando a la izquierda: (360 * 2) / :puntas.
  const angulo = operacion('/', operacion('*', numero(360, 2), numero(2, 2), 2), parametro('puntas', 2), 2);

  const cuerpo = [repite(parametro('puntas', 2), [avanza(parametro('largo', 3), 3), giro('GIRADERECHA', angulo, 4)], 2)];

  return {
    tipo: 'programa',
    instrucciones: [
      definicion('ESTRELLA', ['puntas', 'largo'], cuerpo, 1),
      llamada('ESTRELLA', [numero(puntas, 6), numero(largo, 6)], 6),
    ],
  };
}
