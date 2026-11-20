// Mundo 5 · Fractales
// Tres niveles autorados (5.1, 5.3 y 5.4) y dos generados (5.2 y 5.5). El concepto del mundo es la
// recursión: un procedimiento que se llama a sí mismo y un caso base que lo detiene.
//
// Mismo patrón que los mundos 3 y 4:
//  - la normalización es fija, así que la posición y el rumbo de partida importan;
//  - ningún nivel escribe `presupuestoEstrella` ni `limiteDuro`: los calcula `resolverReto` por el
//    conteo de la referencia, con el margen por omisión;
//  - los niveles de Koch son autorados a propósito: la estructura de las cuatro llamadas recursivas
//    es la lección y generarla al azar solo agregaría ruido.

import type { Programa } from '../lenguaje/ast.js';
import type { Nivel, NormalizacionNivel } from './tipos.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';

/**
 * Construye un Programa (AST) a partir de texto KiroLogo del mundo 5. Solo para las referencias de
 * los niveles autorados: si el texto no es válido, falla al cargar el módulo.
 */
function parsearReferencia(texto: string): Programa {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo: 5 });
  if (programa === null || errores.length > 0) {
    throw new Error(
      `[mundo-5-fractales] programa de referencia inválido: "${texto}" — ${errores.map((e) => e.mensaje).join('; ')}`,
    );
  }
  return programa;
}

const NORMALIZACION_M5: NormalizacionNivel = {
  traslacion: 'fija',
  rotacion: 'fija',
  escala: 'exacta',
};

const SEMILLA_5_1 = 501;
const SEMILLA_5_3 = 503;
const SEMILLA_5_4 = 504;

// ============================================================================
// Referencias autoradas
// ============================================================================

// 5.1: espiral cuadrada que se detiene por su caso base (largo > 200). Conteo 7.
export const REFERENCIA_5_1: Programa = parsearReferencia(
  'PARA ESPIRAL :largo SI :largo > 200 [ALTO] AVANZA :largo GIRADERECHA 90 ESPIRAL :largo + 5 FIN ESPIRAL 20',
);

// Las cuatro llamadas recursivas del copo, con el caso base en nivel 0. Conteo 10.
const DEFINICION_KOCH =
  'PARA KOCH :largo :nivel ' +
  'SINO :nivel = 0 [AVANZA :largo] ' +
  '[KOCH :largo / 3 :nivel - 1 GIRAIZQUIERDA 60 KOCH :largo / 3 :nivel - 1 ' +
  'GIRADERECHA 120 KOCH :largo / 3 :nivel - 1 GIRAIZQUIERDA 60 KOCH :largo / 3 :nivel - 1] FIN ';

// 5.3: un lado del copo. Conteo 10.
export const REFERENCIA_5_3: Programa = parsearReferencia(`${DEFINICION_KOCH}KOCH 300 3`);

// 5.4: el copo completo, tres lados girando 120°. Conteo 12.
export const REFERENCIA_5_4: Programa = parsearReferencia(`${DEFINICION_KOCH}REPITE 3 [KOCH 300 3 GIRADERECHA 120]`);

// ============================================================================
// Niveles
// ============================================================================

export const NIVEL_5_1: Nivel = {
  id: '5.1',
  mundo: 5,
  titulo: 'Espiral cuadrada',
  concepto: 'recursion',
  origen: { tipo: 'autorado', referencia: REFERENCIA_5_1, semilla: SEMILLA_5_1 },
  normalizacion: NORMALIZACION_M5,
  abstraccion: [{ clave: 'usaRecursion' }],
  enunciado:
    'Dibuja la espiral cuadrada de Kiro con un procedimiento que se llame a sí mismo y se detenga solo. La posición y el rumbo de partida importan.',
  pistas: [
    'Cada lado es igual al anterior pero un poco más largo. ¿Cómo le pides a un procedimiento que haga "uno más" repitiéndose a sí mismo, y cuándo debe parar?',
    'El lado empieza en 20 y crece 5 en cada llamada. Hay que parar cuando el lado pasa de 200: esa comparación es el caso base.',
    'PARA ESPIRAL :largo\n  SI :largo > ___ [ALTO]\n  AVANZA :largo\n  GIRADERECHA ___\n  ESPIRAL :largo + ___\nFIN\nESPIRAL ___',
  ],
};

export const NIVEL_5_2: Nivel = {
  id: '5.2',
  mundo: 5,
  titulo: 'Espiral de n lados',
  concepto: 'recursion',
  origen: { tipo: 'generado', idGenerador: 'espiral-m5', parametros: {} },
  normalizacion: NORMALIZACION_M5,
  abstraccion: [{ clave: 'usaRecursion' }],
  enunciado:
    'Dibuja la espiral de Kiro con recursión. Esta vez el número de lados por vuelta y lo que crece cada lado cambian. La posición y el rumbo de partida importan.',
  pistas: [
    'Cuenta cuántos lados tiene cada vuelta y mira cuánto crece cada lado respecto al anterior. Lo que crece es lo que cambia en cada llamada.',
    'Cada vuelta tiene {ladosEspiral} lados: la tortuga gira 360 / {ladosEspiral}. El lado empieza en {inicio}, crece {incremento} en cada llamada y se detiene al pasar de {limite}.',
    'PARA ESPIRAL :largo\n  SI :largo > ___ [ALTO]\n  AVANZA :largo\n  GIRADERECHA ___ / ___\n  ESPIRAL :largo + ___\nFIN\nESPIRAL ___',
  ],
};

export const NIVEL_5_3: Nivel = {
  id: '5.3',
  mundo: 5,
  titulo: 'Un lado del copo de Koch',
  concepto: 'recursion',
  origen: { tipo: 'autorado', referencia: REFERENCIA_5_3, semilla: SEMILLA_5_3 },
  normalizacion: NORMALIZACION_M5,
  abstraccion: [{ clave: 'usaRecursion' }],
  enunciado:
    'Dibuja un lado del copo de Koch: cada tramo se reemplaza por cuatro tramos más cortos con la misma forma. La posición y el rumbo de partida importan.',
  pistas: [
    'En el nivel 0 el lado es una línea recta. En cualquier otro nivel, es lo mismo que cuatro lados más cortos, con una punta en medio. ¿Cuántas llamadas a sí mismo necesitas?',
    'Cada lado nuevo mide un tercio del anterior y el nivel baja en 1. Entre las cuatro llamadas la tortuga gira 60 a la izquierda, 120 a la derecha y 60 a la izquierda.',
    'PARA KOCH :largo :nivel\n  SINO :nivel = 0 [AVANZA :largo] [\n    KOCH ___ ___\n    GIRAIZQUIERDA ___\n    ...\n  ]\nFIN\nKOCH ___ ___',
  ],
};

export const NIVEL_5_4: Nivel = {
  id: '5.4',
  mundo: 5,
  titulo: 'El copo de Koch',
  concepto: 'recursion',
  origen: { tipo: 'autorado', referencia: REFERENCIA_5_4, semilla: SEMILLA_5_4 },
  normalizacion: NORMALIZACION_M5,
  abstraccion: [{ clave: 'usaRecursion' }],
  enunciado:
    'Dibuja el copo de Koch completo: tres lados como el del nivel anterior, formando un triángulo. La posición y el rumbo de partida importan.',
  pistas: [
    'Ya sabes dibujar un lado del copo. ¿Cuántos lados tiene un triángulo y cuánto gira la tortuga entre uno y el siguiente?',
    'El triángulo da una vuelta completa: 360 grados repartidos entre 3 lados, así que giras 120 después de cada lado. Un REPITE basta.',
    'PARA KOCH :largo :nivel\n  ...el mismo del nivel anterior...\nFIN\nREPITE ___ [KOCH ___ ___ GIRADERECHA ___]',
  ],
};

export const NIVEL_5_5: Nivel = {
  id: '5.5',
  mundo: 5,
  titulo: 'Árbol binario',
  concepto: 'recursion',
  origen: { tipo: 'generado', idGenerador: 'arbol-m5', parametros: {} },
  normalizacion: NORMALIZACION_M5,
  abstraccion: [{ clave: 'usaRecursion' }],
  enunciado:
    'Dibuja el árbol de Kiro: cada rama se abre en dos ramas más cortas y vuelve al punto donde nació. La posición y el rumbo de partida importan.',
  pistas: [
    'Cada rama termina en dos ramas más pequeñas que se ven igual que el árbol entero. Y al terminar, la tortuga tiene que volver sobre sus pasos para seguir con la otra.',
    'El árbol tiene {profundidad} niveles. Cada rama mide {factor} veces la anterior y se abre {anguloRama} grados a cada lado. Para volver, RETROCEDE lo que avanzaste.',
    'PARA ARBOL :largo :nivel\n  SI :nivel = 0 [ALTO]\n  AV :largo GI ___\n  ARBOL :largo * ___ :nivel - 1\n  GD ___\n  ARBOL :largo * ___ :nivel - 1\n  GI ___ RE :largo\nFIN\nARBOL ___ ___',
  ],
};

// ============================================================================
// Niveles del mundo 5 (en orden 5.1 … 5.5)
// ============================================================================

export const MUNDO_5: readonly Nivel[] = [NIVEL_5_1, NIVEL_5_2, NIVEL_5_3, NIVEL_5_4, NIVEL_5_5];
