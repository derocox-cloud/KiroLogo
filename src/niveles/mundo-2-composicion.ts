// Mundo 2 · Composición
// Dos niveles autorados (2.1 y 2.4) y cuatro generados (2.2, 2.3, 2.5 y 2.6).
// El concepto del mundo es la descomposición: nombrar figuras simples con
// `PARA … FIN` y componerlas en figuras mayores.

import type { Programa } from '../lenguaje/ast.js';
import type { Nivel } from './tipos.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';

// ============================================================================
// Utilidad interna: parsear texto KiroLogo como programa del mundo 2
// ============================================================================

/**
 * Construye un Programa (AST) a partir de texto KiroLogo del mundo 2.
 * Solo para uso interno al definir referencias de niveles autorados.
 * El texto debe ser válido: si no, lanza un error en tiempo de módulo.
 */
function parsearReferencia(texto: string): Programa {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo: 2 });
  if (programa === null || errores.length > 0) {
    throw new Error(
      `[mundo-2-composicion] programa de referencia inválido: "${texto}" — ${errores.map((e) => e.mensaje).join('; ')}`,
    );
  }
  return programa;
}

// ============================================================================
// Semillas fijas de los niveles autorados
// ============================================================================

const SEMILLA_2_1 = 201;
const SEMILLA_2_4 = 204;

// ============================================================================
// Nivel 2.1 — la casa (cuadrado + triángulo encima)
// ============================================================================

// R8.1: casa = cuadrado + triángulo. El presupuesto sale del Conteo sobre esta
// referencia (nunca escrito a mano); dos repeticiones son dos figuras simples
// compuestas, que es justo la lección de descomposición del mundo.
export const REFERENCIA_2_1: Programa = parsearReferencia(
  'REPITE 4 [AV 100 GD 90] AV 100 GD 30 REPITE 3 [AV 100 GD 120]',
);

export const NIVEL_2_1: Nivel = {
  id: '2.1',
  mundo: 2,
  titulo: 'La casa',
  concepto: 'descomposicion',
  origen: {
    tipo: 'autorado',
    referencia: REFERENCIA_2_1,
    semilla: SEMILLA_2_1,
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [],
  pistas: [
    'Una casa es un cuadrado con un triángulo encima. ¿Puedes dibujar primero la pared y luego el techo?',
    'La pared es un cuadrado (cuatro giros de 90°). El techo es un triángulo (tres giros de 120°), y entre los dos hay que inclinarse para empezar el pico.',
    'REPITE 4 [...]  luego gira  luego REPITE 3 [...]',
  ],
};

// ============================================================================
// Nivel 2.4 — la cruz
// ============================================================================

// R8.2: cruz. El patrón izquierda/derecha/izquierda dibuja una escotadura, y
// repetirlo cuatro veces cierra la cruz. También aquí el presupuesto lo da el
// Conteo sobre la referencia.
export const REFERENCIA_2_4: Programa = parsearReferencia(
  'REPITE 4 [AV 50 GI 90 AV 50 GD 90 AV 50 GI 90]',
);

export const NIVEL_2_4: Nivel = {
  id: '2.4',
  mundo: 2,
  titulo: 'La cruz',
  concepto: 'descomposicion',
  origen: {
    tipo: 'autorado',
    referencia: REFERENCIA_2_4,
    semilla: SEMILLA_2_4,
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [],
  pistas: [
    'Una cruz tiene cuatro brazos iguales. ¿Qué recorrido dibuja un brazo con su escotadura, para poder repetirlo?',
    'Cada brazo entra, dobla a un lado, vuelve y dobla al otro: tres tramos iguales con giros de 90°, uno a la izquierda, uno a la derecha y otro a la izquierda. Repite ese brazo cuatro veces.',
    'REPITE 4 [AV L GI 90 AV L GD 90 AV L GI 90]',
  ],
};

// ============================================================================
// Niveles generados: 2.2, 2.3, 2.5 y 2.6
// ============================================================================
//
// Cada nivel generado guarda solo el `idGenerador`; la función generadora vive
// en `src/juego/generadores-mundo-2.ts` y se resuelve en tiempo de ejecución
// vía el registro. El presupuesto lo calcula el Conteo sobre la referencia que
// devuelve el generador, nunca un número escrito a mano (R9.7, R9.8).

export const NIVEL_2_2: Nivel = {
  id: '2.2',
  mundo: 2,
  titulo: 'La estrella',
  concepto: 'descomposicion',
  origen: {
    tipo: 'generado',
    idGenerador: 'estrella-m2',
    parametros: {},
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [],
  pistas: [
    'Una estrella se dibuja de un solo trazo: avanzas y giras siempre el mismo ángulo, pero el giro es tan grande que la punta se cruza. ¿Cuántas puntas tiene?',
    'Con p puntas, la tortuga da dos vueltas completas (720°) repartidas en p giros iguales: cada giro es 360·2/p.',
    'REPITE p [AV L GD angulo]',
  ],
};

export const NIVEL_2_3: Nivel = {
  id: '2.3',
  mundo: 2,
  titulo: 'La escalera',
  concepto: 'descomposicion',
  origen: {
    tipo: 'generado',
    idGenerador: 'escalera-m2',
    parametros: {},
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [],
  pistas: [
    'Una escalera repite el mismo peldaño varias veces: sube un tramo y avanza otro tramo igual. ¿Cuántos peldaños cuentas?',
    'Cada peldaño es subir y avanzar la misma distancia, con dos giros de 90° (uno a cada lado) que dejan la tortuga lista para el siguiente.',
    'REPITE n [AV L GI 90 AV L GD 90]',
  ],
};

export const NIVEL_2_5: Nivel = {
  id: '2.5',
  mundo: 2,
  titulo: 'Dos polígonos',
  concepto: 'descomposicion',
  origen: {
    tipo: 'generado',
    idGenerador: 'dos-poligonos-m2',
    parametros: {},
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [],
  pistas: [
    'Son dos figuras separadas, sin ninguna línea que las una. ¿Cómo mueves la tortuga de una a la otra sin dejar rastro?',
    'Dibuja el primer polígono, levanta el lápiz con SUBELAPIZ, avanza hasta el segundo, bájalo con BAJALAPIZ y dibuja el otro.',
    'REPITE n [...]  SUBELAPIZ  AV d  BAJALAPIZ  REPITE m [...]',
  ],
};

// R10.1: el 2.6 exige `defineProcedimiento` para la estrella de abstracción;
// copiar el panel una vez por casilla pasa la precisión pero no la abstracción.
export const NIVEL_2_6: Nivel = {
  id: '2.6',
  mundo: 2,
  titulo: 'La cuadrícula',
  concepto: 'descomposicion',
  origen: {
    tipo: 'generado',
    idGenerador: 'cuadricula-m2',
    parametros: {},
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [{ clave: 'defineProcedimiento' }],
  pistas: [
    'La cuadrícula está hecha de muchos paneles idénticos. En vez de copiar el panel una y otra vez, ¿puedes enseñarle a Kiro qué es un panel?',
    'Define el panel una sola vez con PARA … FIN y luego pídeselo a Kiro una vez por cada casilla: filas por columnas de invocaciones.',
    'PARA panel ... FIN   luego   REPITE filas [REPITE columnas [panel ...] ...]',
  ],
};

// ============================================================================
// Niveles del mundo 2 (en orden 2.1 … 2.6)
// ============================================================================

export const MUNDO_2: readonly Nivel[] = [
  NIVEL_2_1,
  NIVEL_2_2,
  NIVEL_2_3,
  NIVEL_2_4,
  NIVEL_2_5,
  NIVEL_2_6,
];
