// Mundo 1 · Figuras geométricas
// Dos niveles autorados (1.1 y 1.4) y tres generadores (1.2, 1.3 y 1.5).

import type { Programa } from '../lenguaje/ast.js';
import type { Nivel } from './tipos.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';

// ============================================================================
// Utilidad interna: parsear texto KiroLogo como programa del mundo 1
// ============================================================================

/**
 * Construye un Programa (AST) a partir de texto KiroLogo del mundo 1.
 * Solo para uso interno al definir referencias de niveles autorados.
 * El texto debe ser válido: si no, lanza un error en tiempo de módulo.
 */
function parsearReferencia(texto: string): Programa {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo: 1 });
  if (programa === null || errores.length > 0) {
    throw new Error(
      `[mundo-1-figuras] programa de referencia inválido: "${texto}" — ${errores.map((e) => e.mensaje).join('; ')}`,
    );
  }
  return programa;
}

// ============================================================================
// Semillas fijas de los niveles autorados
// ============================================================================

const SEMILLA_1_1 = 101;
const SEMILLA_1_4 = 104;

// ============================================================================
// Nivel 1.1 — cuadrado
// ============================================================================

export const REFERENCIA_1_1: Programa = parsearReferencia('REPITE 4 [AV 100 GD 90]');

export const NIVEL_1_1: Nivel = {
  id: '1.1',
  mundo: 1,
  titulo: 'El cuadrado',
  concepto: 'iteracion',
  origen: {
    tipo: 'autorado',
    referencia: REFERENCIA_1_1,
    semilla: SEMILLA_1_1,
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [{ clave: 'usaRepite' }],
  pistas: [
    'La tortuga hace lo mismo cuatro veces. ¿Qué instrucción repite exactamente?',
    'Un cuadrado tiene cuatro lados iguales y cuatro giros iguales. Los giros suman 360°: ¿cuánto es cada uno?',
    'REPITE 4 [...]',
  ],
};

// ============================================================================
// Nivel 1.4 — círculo
// ============================================================================

export const REFERENCIA_1_4: Programa = parsearReferencia('REPITE 360 [AV 2 GD 1]');

export const NIVEL_1_4: Nivel = {
  id: '1.4',
  mundo: 1,
  titulo: 'El círculo',
  concepto: 'iteracion',
  origen: {
    tipo: 'autorado',
    referencia: REFERENCIA_1_4,
    semilla: SEMILLA_1_4,
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [{ clave: 'usaRepite' }],
  pistas: [
    'Un círculo es un polígono con muchísimos lados muy cortos. ¿Cuántos lados necesitas para que parezca redondo?',
    '360 lados, cada uno de 2 pasos, con un giro de 1 grado. El total de giro es 360°.',
    'REPITE 360 [AV 2 GD ...]',
  ],
};

// ============================================================================
// Niveles generados: 1.2, 1.3 y 1.5
// ============================================================================
//
// Cada nivel generado tiene idGenerador e incluye los parámetros fijos.
// El generador concreto se invoca desde resolverReto cuando semilla varía.
// Los parámetros aquí son los del "nivel base" — se combinan con la semilla.

export const NIVEL_1_2: Nivel = {
  id: '1.2',
  mundo: 1,
  titulo: 'Polígono regular (GD)',
  concepto: 'iteracion',
  origen: {
    tipo: 'generado',
    idGenerador: 'poligono-gd',
    parametros: {},
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [{ clave: 'usaRepite' }],
  pistas: [
    'Todos los lados son iguales y todos los giros son iguales. ¿Cuántos lados tiene esta figura?',
    'La suma de los giros exteriores de cualquier polígono regular es 360°. Divide entre el número de lados.',
    'REPITE n [AV L GD angulo]',
  ],
};

export const NIVEL_1_3: Nivel = {
  id: '1.3',
  mundo: 1,
  titulo: 'Polígono regular (GI)',
  concepto: 'iteracion',
  origen: {
    tipo: 'generado',
    idGenerador: 'poligono-gi',
    parametros: {},
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [{ clave: 'usaRepite' }],
  pistas: [
    'Esta figura gira hacia la izquierda. Todos los lados son iguales y todos los giros son iguales.',
    'La suma de los giros exteriores es 360°. Usa GIRAIZQUIERDA (o GI).',
    'REPITE n [AV L GI angulo]',
  ],
};

export const NIVEL_1_5: Nivel = {
  id: '1.5',
  mundo: 1,
  titulo: 'Arco',
  concepto: 'iteracion',
  origen: {
    tipo: 'generado',
    idGenerador: 'arco',
    parametros: {},
  },
  normalizacion: {
    traslacion: 'libre',
    rotacion: 'libre',
    escala: 'exacta',
  },
  abstraccion: [{ clave: 'usaRepite' }],
  pistas: [
    'Es como un polígono regular pero incompleto: la figura no cierra. ¿Cuántos lados dibuja?',
    'Si el polígono completo tendría n lados, este arco solo dibuja k de ellos, con el mismo ángulo.',
    'REPITE k [AV L GD angulo]  — con k menor que n',
  ],
};

// ============================================================================
// Niveles del mundo 1 (en orden)
// ============================================================================

export const MUNDO_1: readonly Nivel[] = [
  NIVEL_1_1,
  NIVEL_1_2,
  NIVEL_1_3,
  NIVEL_1_4,
  NIVEL_1_5,
];