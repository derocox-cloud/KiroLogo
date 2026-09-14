// Mundo 0 · Primeros pasos
// El nivel autorado 0.1: el primer reto jugable de punta a punta.

import type { Programa } from '../lenguaje/ast.js';
import type { Nivel } from './tipos.js';

// ============================================================================
// Programa de referencia del nivel 0.1
// ============================================================================

/**
 * Referencia armada **nodo por nodo**, sin analizar texto con el lexer ni el
 * parser: una sola invocación de `AVANZA` con un argumento literal de valor 100.
 * El conteo de este AST es 1, así que el `presupuestoEstrella` del reto es 1.
 */
export const REFERENCIA_0_1: Programa = {
  tipo: 'programa',
  instrucciones: [
    {
      tipo: 'invocacionComando',
      nombre: 'AVANZA',
      argumentos: [
        { tipo: 'numeroLiteral', valor: 100, linea: 1, columna: 8 },
      ],
      linea: 1,
      columna: 1,
    },
  ],
};

// ============================================================================
// Nivel 0.1
// ============================================================================

/** Semilla fija del reto, dentro del dominio [0, 4 294 967 295]. */
const SEMILLA_0_1 = 42;

export const NIVEL_0_1: Nivel = {
  id: '0.1',
  mundo: 0,
  titulo: 'Un paso al frente',
  concepto: 'secuencia',
  origen: {
    tipo: 'autorado',
    referencia: REFERENCIA_0_1,
    semilla: SEMILLA_0_1,
  },
  normalizacion: {
    // Mundos 0 a 2: traslación y rotación libres.
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [],
  pistas: [
    // Conceptual.
    'La tortuga solo camina hacia adelante. Dile cuántos pasos dar en una sola instrucción.',
    // Matemática.
    'Cuenta los cuadros de la cuadrícula que recorre: cada cuadro mide 20 unidades.',
    // Esqueleto (sin el programa completo).
    'Empieza con el comando AVANZA seguido de un número.',
  ],
  // Sin margenLimiteDuro: usa el valor por omisión al resolver el reto.
};

// ============================================================================
// Niveles del mundo 0
// ============================================================================

export const MUNDO_0: readonly Nivel[] = [NIVEL_0_1];
