// Mundo 4 · Parámetros
// Un nivel autorado (4.1) y tres generados (4.2, 4.3 y 4.4). El concepto del
// mundo es la generalización: un procedimiento con parámetros resuelve una
// familia de problemas, no uno solo.
//
// Mismo patrón que el mundo 3:
//  - la normalización es fija (traslación y rotación fijas), así que la posición
//    y el rumbo de partida importan para aprobar (R20.10);
//  - ningún nivel escribe `presupuestoEstrella` ni `limiteDuro`: los calcula
//    `resolverReto` por el Conteo sobre la referencia (R16.5, R20.11, R20.12).
//    El único valor de límite que se declara es `margenLimiteDuro` del 4.2 (6).

import type { Programa } from '../lenguaje/ast.js';
import type { Nivel, NormalizacionNivel } from './tipos.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';

// ============================================================================
// Utilidad interna: parsear texto KiroLogo como programa del mundo 4
// ============================================================================

/**
 * Construye un Programa (AST) a partir de texto KiroLogo del mundo 4.
 * Solo para uso interno al definir la referencia del nivel autorado.
 * El texto debe ser válido: si no, lanza un error en tiempo de módulo.
 */
function parsearReferencia(texto: string): Programa {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo: 4 });
  if (programa === null || errores.length > 0) {
    throw new Error(
      `[mundo-4-parametros] programa de referencia inválido: "${texto}" — ${errores.map((e) => e.mensaje).join('; ')}`,
    );
  }
  return programa;
}

// ============================================================================
// Normalización fija del mundo 4 (R20.10)
// ============================================================================

const NORMALIZACION_M4: NormalizacionNivel = {
  traslacion: 'fija',
  rotacion: 'fija',
  escala: 'exacta',
};

// ============================================================================
// Semilla fija del nivel autorado
// ============================================================================

const SEMILLA_4_1 = 401;

// ============================================================================
// Referencia autorada
// ============================================================================

// 4.1 — hexágono con POLIGONO (R16.2). Su conteo es 4 (3 del PARA + 1 llamada).
export const REFERENCIA_4_1: Programa = parsearReferencia(
  'PARA POLIGONO :lados :largo REPITE :lados [AVANZA :largo GIRADERECHA 360 / :lados] FIN POLIGONO 6 80',
);

// ============================================================================
// Nivel 4.1 — Hexágono con POLIGONO (autorado)
// ============================================================================

export const NIVEL_4_1: Nivel = {
  id: '4.1',
  mundo: 4,
  titulo: 'Hexágono con POLIGONO',
  concepto: 'generalizacion',
  origen: {
    tipo: 'autorado',
    referencia: REFERENCIA_4_1,
    semilla: SEMILLA_4_1,
  },
  normalizacion: NORMALIZACION_M4,
  abstraccion: [{ clave: 'usaParametros' }],
  enunciado:
    'Dibuja un hexágono con un procedimiento que reciba parámetros. La posición de partida y el rumbo de partida importan para aprobar.',
  pistas: [
    '¿Qué datos cambiarían si quisieras otro polígono? Esos datos pueden ser parámetros de un procedimiento, y así una sola receta sirve para muchas figuras.',
    'La tortuga da una vuelta completa: 360 grados repartidos entre los lados. Con 6 lados, cada giro es de 360 / 6 = 60 grados, y el giro se puede escribir con el parámetro.',
    'PARA POLIGONO :lados :largo\n  REPITE :lados [AVANZA :largo GIRADERECHA ___ / :lados]\nFIN\nPOLIGONO ___ ___',
  ],
};

// ============================================================================
// Nivel 4.2 — Tres polígonos, un solo PARA (generado)
// ============================================================================

export const NIVEL_4_2: Nivel = {
  id: '4.2',
  mundo: 4,
  titulo: 'Tres polígonos, un solo PARA',
  concepto: 'generalizacion',
  origen: {
    tipo: 'generado',
    idGenerador: 'tres-poligonos-m4',
    parametros: {},
  },
  normalizacion: NORMALIZACION_M4,
  abstraccion: [{ clave: 'usaParametros' }, { clave: 'maximoProcedimientos', maximo: 1 }],
  // El rodeo de tres procedimientos cuenta 12; con el margen por omisión (3)
  // el límite sería 9 y Kiro nunca podría explicar por qué no gana la estrella.
  margenLimiteDuro: 6,
  enunciado:
    'Dibuja los tres polígonos que hizo Kiro con un solo procedimiento. La posición de partida y el rumbo de partida importan para aprobar.',
  pistas: [
    '¿Qué cambia de un polígono al siguiente y qué se repite en los tres? Si lo que cambia es un solo dato, quizá baste una sola receta.',
    'Kiro dibujó polígonos de {lados1}, {lados2} y {lados3} lados, todos con lados de {largo}. En cada uno la tortuga da una vuelta completa: 360 grados repartidos entre :lados.',
    '{esqueletoConHuecos}',
  ],
};

// ============================================================================
// Nivel 4.3 — Polígonos encajados (generado)
// ============================================================================

export const NIVEL_4_3: Nivel = {
  id: '4.3',
  mundo: 4,
  titulo: 'Polígonos encajados',
  concepto: 'generalizacion',
  origen: {
    tipo: 'generado',
    idGenerador: 'poligonos-encajados-m4',
    parametros: {},
  },
  normalizacion: NORMALIZACION_M4,
  abstraccion: [{ clave: 'usaParametros' }],
  enunciado:
    'Dibuja los polígonos concéntricos de Kiro: cada uno con el lado más largo que el anterior. La posición y el rumbo de partida importan para que el dibujo sea válido.',
  pistas: [
    '¿Qué tienen en común todos los polígonos de la figura y qué crece de uno al siguiente? Todos arrancan en la misma esquina y miran al mismo lado.',
    'Son {copias} polígonos de {lados} lados y cada lado mide 20 más que el anterior. En cada uno, 360 grados repartidos entre :lados.',
    '{esqueletoConHuecos}',
  ],
};

// ============================================================================
// Nivel 4.4 — Estrella con parámetros (generado)
// ============================================================================

export const NIVEL_4_4: Nivel = {
  id: '4.4',
  mundo: 4,
  titulo: 'Estrella con parámetros',
  concepto: 'generalizacion',
  origen: {
    tipo: 'generado',
    idGenerador: 'estrella-parametrica-m4',
    parametros: {},
  },
  normalizacion: NORMALIZACION_M4,
  abstraccion: [{ clave: 'usaParametros' }],
  enunciado:
    'Dibuja la estrella de Kiro con un procedimiento cuyo giro dependa del número de puntas. La posición de partida y el rumbo de partida importan para aprobar.',
  pistas: [
    '¿Cuántas puntas tiene la estrella y cuántas vueltas da la tortuga antes de cerrarla?',
    'La estrella tiene {puntas} puntas y la tortuga da dos vueltas completas: 360 * 2 grados repartidos entre :puntas.',
    '{esqueletoConHuecos}',
  ],
};

// ============================================================================
// Niveles del mundo 4 (en orden 4.1 … 4.4)
// ============================================================================

export const MUNDO_4: readonly Nivel[] = [NIVEL_4_1, NIVEL_4_2, NIVEL_4_3, NIVEL_4_4];
