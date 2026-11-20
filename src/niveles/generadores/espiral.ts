// Generador `espiral-m5` — nivel 5.2 del mundo 5.
//
// Una espiral de n lados cuyo lado crece en cada vuelta, escrita con recursión y caso base:
//
//   PARA ESPIRAL :largo
//     SI :largo > limite [ALTO]
//     AVANZA :largo
//     GIRADERECHA 360 / n
//     ESPIRAL :largo + incremento
//   FIN
//   ESPIRAL inicio
//
// El ángulo es 360/n con n de 3 a 6, así que es derivable. El incremento (5 a 20) y el largo inicial
// no caen en la cuadrícula de 20: es la excepción documentada de los incrementos de espiral, porque lo
// que se deduce es el patrón. El límite sí es múltiplo de 20 (de 140 a 280: con menos, la espiral de 3 y 4 lados no llena los 200 px de caja) y el programa hace hasta 52 llamadas,
// muy por debajo de la guarda de 100 niveles. Puro: solo importa de `lenguaje/` y `azar/`.

import type { Programa } from '../../lenguaje/ast.js';
import type { Prng } from '../../azar/prng.js';
import type { Generador } from '../tipos.js';
import {
  avanza,
  giro,
  si,
  alto,
  operacion,
  parametro,
  numero,
  definicion,
  llamada,
  generarConReintento,
} from './comun.js';

const LADOS = [3, 4, 5, 6] as const;
const INCREMENTOS = [5, 10, 15, 20] as const;
const INICIO_MIN = 20;
const INICIO_MAX = 60;
const LIMITE_MIN = 140;
const LIMITE_MAX = 280;
const PASO_CUADRICULA = 20;

export const generarEspiral: Generador = (entrada) =>
  generarConReintento(entrada, (prng) => candidatoEspiral(prng));

function candidatoEspiral(prng: Prng): Programa {
  const lados = prng.elegir(LADOS);
  const incremento = prng.elegir(INCREMENTOS);
  const inicio = prng.multiplo(INICIO_MIN, INICIO_MAX, PASO_CUADRICULA);
  const limite = prng.multiplo(LIMITE_MIN, LIMITE_MAX, PASO_CUADRICULA);

  const cuerpo = [
    si(operacion('>', parametro('largo', 2), numero(limite, 2), 2), [alto(2)], 2),
    avanza(parametro('largo', 3), 3),
    giro('GIRADERECHA', operacion('/', numero(360, 4), numero(lados, 4), 4), 4),
    llamada('ESPIRAL', [operacion('+', parametro('largo', 5), numero(incremento, 5), 5)], 5),
  ];

  return {
    tipo: 'programa',
    instrucciones: [
      definicion('ESPIRAL', ['largo'], cuerpo, 1),
      llamada('ESPIRAL', [numero(inicio, 7)], 7),
    ],
  };
}
