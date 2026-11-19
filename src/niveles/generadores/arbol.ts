// Generador `arbol-m5` — nivel 5.5 del mundo 5.
//
// Un árbol binario: cada rama avanza, se abre a un lado, dibuja el subárbol, se abre al otro, dibuja
// el segundo subárbol y vuelve sobre sí misma con RETROCEDE hasta el punto donde nació.
//
//   PARA ARBOL :largo :nivel
//     SI :nivel = 0 [ALTO]
//     AVANZA :largo
//     GIRAIZQUIERDA a
//     ARBOL :largo * f :nivel - 1
//     GIRADERECHA 2a
//     ARBOL :largo * f :nivel - 1
//     GIRAIZQUIERDA a
//     RETROCEDE :largo
//   FIN
//   ARBOL L p
//
// El ángulo va de 20 a 40 en pasos de 5 y el factor de 0.6 a 0.8 en pasos de 0.05. Los pasos de 5 no
// son múltiplos de 15: es la excepción documentada de las aproximaciones de curva, porque la lección es
// la estructura recursiva, no deducir el ángulo. El largo inicial sí cae en la cuadrícula de 20; los
// largos de las ramas ya no, porque cada nivel multiplica por el factor. Con profundidad 6 hay 7
// niveles de llamada, muy por debajo de la guarda de 100. Puro: solo importa de `lenguaje/` y `azar/`.

import type { Programa } from '../../lenguaje/ast.js';
import type { Prng } from '../../azar/prng.js';
import type { Generador } from '../tipos.js';
import {
  avanza,
  retrocede,
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

const ANGULO_MIN = 20;
const ANGULO_MAX = 40;
const PASO_ANGULO = 5;
/** Factores en centésimas, para no acumular error de coma flotante al sortear. */
const FACTOR_MIN_CENTESIMAS = 60;
const FACTOR_MAX_CENTESIMAS = 80;
const PASO_FACTOR_CENTESIMAS = 5;
const PROFUNDIDAD_MIN = 4;
const PROFUNDIDAD_MAX = 6;
const LARGO_MIN = 80;
const LARGO_MAX = 160;
const PASO_CUADRICULA = 20;

export const generarArbol: Generador = (entrada) =>
  generarConReintento(entrada, (prng) => candidatoArbol(prng));

function candidatoArbol(prng: Prng): Programa {
  const angulo = prng.multiplo(ANGULO_MIN, ANGULO_MAX, PASO_ANGULO);
  const factor = prng.multiplo(FACTOR_MIN_CENTESIMAS, FACTOR_MAX_CENTESIMAS, PASO_FACTOR_CENTESIMAS) / 100;
  const profundidad = prng.entero(PROFUNDIDAD_MIN, PROFUNDIDAD_MAX);
  const largo = prng.multiplo(LARGO_MIN, LARGO_MAX, PASO_CUADRICULA);

  const subarbol = (linea: number) =>
    llamada(
      'ARBOL',
      [
        operacion('*', parametro('largo', linea), numero(factor, linea), linea),
        operacion('-', parametro('nivel', linea), numero(1, linea), linea),
      ],
      linea,
    );

  const cuerpo = [
    si(operacion('=', parametro('nivel', 2), numero(0, 2), 2), [alto(2)], 2),
    avanza(parametro('largo', 3), 3),
    giro('GIRAIZQUIERDA', numero(angulo, 4), 4),
    subarbol(5),
    giro('GIRADERECHA', numero(angulo * 2, 6), 6),
    subarbol(7),
    giro('GIRAIZQUIERDA', numero(angulo, 8), 8),
    retrocede(parametro('largo', 9), 9),
  ];

  return {
    tipo: 'programa',
    instrucciones: [
      definicion('ARBOL', ['largo', 'nivel'], cuerpo, 1),
      llamada('ARBOL', [numero(largo, 11), numero(profundidad, 11)], 11),
    ],
  };
}
