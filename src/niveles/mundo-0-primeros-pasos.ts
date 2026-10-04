// Mundo 0 · Primeros pasos
//
// Los cinco niveles del primer mundo. Concepto: una instrucción tras otra cambia
// un estado; la tortuga tiene posición y rumbo y obedece literalmente.
//
//   0.1  autorado   línea recta        AVANZA 100
//   0.2  autorado   una ele            AVANZA 100 GIRADERECHA 90 AVANZA 100
//   0.3  generado   un camino          giros de 90° (generador «camino»)
//   0.4  autorado   un cuadrado a mano  AVANZA 100 GIRADERECHA 90 ×4
//   0.5  generado   un zigzag          giros de 90° alternados (generador «zigzag»)
//
// Las referencias autoradas se arman **nodo por nodo**, sin pasar por el lexer ni
// el parser. Ningún presupuesto se escribe: lo calcula `reto.ts` del AST. Los
// niveles generados no almacenan ni referencia ni semilla; su reto nace del
// generador. Las pistas de los generados son **plantillas** con marcadores
// (`{tramos}`, `{giro}`, `{cuadros}`) que `main.ts` rellena con los parámetros
// reales del reto en pantalla.

import type { Programa, InvocacionComando, NumeroLiteral } from '../lenguaje/ast.js';
import type { Nivel } from './tipos.js';

// ============================================================================
// Constructores de nodos autorados (línea y columna coherentes)
// ============================================================================

/**
 * Construye una invocación de aridad 1 (`AVANZA`, `GIRADERECHA`, …) en la línea
 * dada, con el número situado tras el nombre más un espacio, como lo escribiría
 * el jugador. Así el AST autorado tiene las mismas posiciones que uno analizado.
 */
function invocacion(nombre: string, valor: number, linea: number): InvocacionComando {
  const argumento: NumeroLiteral = {
    tipo: 'numeroLiteral',
    valor,
    linea,
    columna: nombre.length + 2, // nombre + un espacio, columnas desde 1
  };
  return {
    tipo: 'invocacionComando',
    nombre,
    argumentos: [argumento],
    linea,
    columna: 1,
  };
}

// ============================================================================
// Nivel 0.1 · Un paso al frente (autorado)
// ============================================================================

/** `AVANZA 100`. Conteo 1, así que el presupuesto del reto es 1. */
export const REFERENCIA_0_1: Programa = {
  tipo: 'programa',
  instrucciones: [invocacion('AVANZA', 100, 1)],
};

/** Semilla fija del reto, dentro del dominio [0, 4 294 967 295]. */
const SEMILLA_0_1 = 42;

export const NIVEL_0_1: Nivel = {
  id: '0.1',
  mundo: 0,
  titulo: 'Un paso al frente',
  concepto: 'secuencia',
  origen: { tipo: 'autorado', referencia: REFERENCIA_0_1, semilla: SEMILLA_0_1 },
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
  abstraccion: [],
  pistas: [
    // Conceptual.
    'La tortuga solo camina hacia adelante. Dile cuántos pasos dar en una sola instrucción.',
    // Matemática.
    'Cuenta los cuadros de la cuadrícula que recorre: cada cuadro mide 20 unidades.',
    // Esqueleto (sin el programa completo).
    'Empieza con el comando AVANZA seguido de un número.',
  ],
};

// ============================================================================
// Nivel 0.2 · La primera esquina (autorado)
// ============================================================================

/** `AVANZA 100 GIRADERECHA 90 AVANZA 100`. Conteo 3. */
export const REFERENCIA_0_2: Programa = {
  tipo: 'programa',
  instrucciones: [
    invocacion('AVANZA', 100, 1),
    invocacion('GIRADERECHA', 90, 2),
    invocacion('AVANZA', 100, 3),
  ],
};

/** Semilla fija. */
const SEMILLA_0_2 = 101;

export const NIVEL_0_2: Nivel = {
  id: '0.2',
  mundo: 0,
  titulo: 'La primera esquina',
  concepto: 'secuencia',
  origen: { tipo: 'autorado', referencia: REFERENCIA_0_2, semilla: SEMILLA_0_2 },
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
  abstraccion: [],
  pistas: [
    'Son dos tramos con una vuelta en medio: avanza, gira, y vuelve a avanzar.',
    'Los dos tramos miden lo mismo y la vuelta es de 90 grados, como la esquina de una hoja.',
    'Empieza así: AVANZA un número, luego GIRADERECHA 90, y avanza de nuevo.',
  ],
};

// ============================================================================
// Nivel 0.3 · Un camino (generado)
// ============================================================================

export const NIVEL_0_3: Nivel = {
  id: '0.3',
  mundo: 0,
  titulo: 'Un camino',
  concepto: 'secuencia',
  origen: {
    tipo: 'generado',
    idGenerador: 'camino',
    parametros: { tramosMin: 3, tramosMax: 5, largoMin: 80, largoMax: 160 },
  },
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
  abstraccion: [],
  // Plantillas: `main.ts` sustituye {tramos}, {giro} y {cuadros} con los valores
  // reales del reto en curso antes de mostrarlas.
  pistas: [
    'El camino tiene {tramos} tramos rectos. Dibuja uno, gira, dibuja el siguiente.',
    'Cada vuelta es de {giro}. Cuenta los cuadros de cada tramo: cada cuadro mide 20.',
    'Empieza por el primer tramo y su vuelta; sigue el camino tramo a tramo.',
  ],
};

// ============================================================================
// Nivel 0.4 · Cuatro paredes (autorado, cuadrado a mano)
// ============================================================================

/**
 * `AVANZA 100 GIRADERECHA 90` cuatro veces. Conteo 8, que es la forma más
 * compacta posible con el vocabulario del mundo 0: por eso la estrella de
 * economía se gana resolviéndolo así (ver G3 del diseño). La fricción de repetir
 * ocho veces es intencional; prepara el descubrimiento de REPITE en el mundo 1.
 */
export const REFERENCIA_0_4: Programa = {
  tipo: 'programa',
  instrucciones: [
    invocacion('AVANZA', 100, 1),
    invocacion('GIRADERECHA', 90, 2),
    invocacion('AVANZA', 100, 3),
    invocacion('GIRADERECHA', 90, 4),
    invocacion('AVANZA', 100, 5),
    invocacion('GIRADERECHA', 90, 6),
    invocacion('AVANZA', 100, 7),
    invocacion('GIRADERECHA', 90, 8),
  ],
};

/** Semilla fija. */
const SEMILLA_0_4 = 202;

export const NIVEL_0_4: Nivel = {
  id: '0.4',
  mundo: 0,
  titulo: 'Cuatro paredes',
  concepto: 'secuencia',
  origen: { tipo: 'autorado', referencia: REFERENCIA_0_4, semilla: SEMILLA_0_4 },
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
  abstraccion: [],
  pistas: [
    'Un cuadrado son cuatro lados iguales con una vuelta de 90 grados en cada esquina.',
    'Recorre: avanza un lado, gira 90, y repite hasta cerrar las cuatro paredes.',
    // Esqueleto que insinúa el alivio futuro sin adelantar vocabulario (G3).
    'Escribe AVANZA y GIRADERECHA 90, y hazlo cuatro veces. Más adelante habrá una forma de no repetirte tanto.',
  ],
};

// ============================================================================
// Nivel 0.5 · Zigzag (generado)
// ============================================================================

export const NIVEL_0_5: Nivel = {
  id: '0.5',
  mundo: 0,
  titulo: 'Zigzag',
  concepto: 'secuencia',
  origen: {
    tipo: 'generado',
    idGenerador: 'zigzag',
    parametros: { tramosMin: 4, tramosMax: 8, largoMin: 60, largoMax: 120 },
  },
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
  abstraccion: [],
  // Plantillas rellenadas por `main.ts` con los valores reales del reto.
  pistas: [
    'El zigzag tiene {tramos} tramos. El sentido del giro cambia en cada esquina: una a la derecha, la siguiente a la izquierda.',
    'Cada vuelta es de {giro}. Cuenta los cuadros de cada tramo: cada cuadro mide 20.',
    'Empieza por el primer tramo y su vuelta; en la esquina siguiente gira hacia el otro lado.',
  ],
};

// ============================================================================
// Niveles del mundo 0, en orden
// ============================================================================

export const MUNDO_0: readonly Nivel[] = [NIVEL_0_1, NIVEL_0_2, NIVEL_0_3, NIVEL_0_4, NIVEL_0_5];
