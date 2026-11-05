// Mundo 3 · Rosetones
// Dos niveles autorados (3.1 y 3.4) y dos generados (3.2 y 3.3). El concepto del
// mundo es la iteración anidada y la simetría rotacional: un `REPITE` dentro de
// otro `REPITE`. No se agrega ningún comando al lenguaje; la potencia viene de
// combinar lo que ya se tiene.
//
// Dos diferencias de datos frente a los mundos 0–2:
//  - la normalización es fija (traslación y rotación fijas): desde el mundo 3 la
//    posición y el rumbo de partida importan para aprobar (R3.5);
//  - los cuatro niveles exigen `usaRepiteAnidado` para la estrella de abstracción
//    (R4.5, R5.8, R6.1).
//
// Ningún nivel escribe un número de presupuesto: lo calcula `resolverReto` por el
// Conteo sobre la referencia (R4.2, R4.6, R5.5). `margenLimiteDuro` se omite, así
// que rige el margen por omisión (3).

import type { Programa } from '../lenguaje/ast.js';
import type { Nivel, NormalizacionNivel } from './tipos.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';

// ============================================================================
// Utilidad interna: parsear texto KiroLogo como programa del mundo 3
// ============================================================================

/**
 * Construye un Programa (AST) a partir de texto KiroLogo del mundo 3.
 * Solo para uso interno al definir referencias de niveles autorados.
 * El texto debe ser válido: si no, lanza un error en tiempo de módulo.
 */
function parsearReferencia(texto: string): Programa {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo: 3 });
  if (programa === null || errores.length > 0) {
    throw new Error(
      `[mundo-3-rosetones] programa de referencia inválido: "${texto}" — ${errores.map((e) => e.mensaje).join('; ')}`,
    );
  }
  return programa;
}

// ============================================================================
// Normalización fija del mundo 3 (R3.5)
// ============================================================================

// Los cuatro niveles la declaran idéntica: la composición espacial ya es parte
// del reto, así que la validación compara la figura tal como quedó en el lienzo,
// sin centrar por caja envolvente.
const NORMALIZACION_M3: NormalizacionNivel = {
  traslacion: 'fija',
  rotacion: 'fija',
  escala: 'exacta',
};

// ============================================================================
// Semillas fijas de los niveles autorados
// ============================================================================

const SEMILLA_3_1 = 301;
const SEMILLA_3_4 = 304;

// ============================================================================
// Referencias autoradas
// ============================================================================

// 3.1 — rosetón de 36 cuadrados (R4.1). Su conteo es 5: es imposible de escribir
// a mano dentro del presupuesto sin anidar `REPITE`, que es justo la lección.
export const REFERENCIA_3_1: Programa = parsearReferencia('REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]');

// 3.4 — mandala (R4.3). Sus ≈ 8·6·90 = 4320 avances quedan muy por debajo de la
// guarda de 200 000 pasos de tortuga (R4.4).
export const REFERENCIA_3_4: Programa = parsearReferencia('REPITE 8 [GD 45 REPITE 6 [REPITE 90 [AV 2 GD 2] GD 90]]');

// ============================================================================
// Nivel 3.1 — Rosetón de cuadrados (autorado)
// ============================================================================

export const NIVEL_3_1: Nivel = {
  id: '3.1',
  mundo: 3,
  titulo: 'Rosetón de cuadrados',
  concepto: 'simetria',
  origen: {
    tipo: 'autorado',
    referencia: REFERENCIA_3_1,
    semilla: SEMILLA_3_1,
  },
  normalizacion: NORMALIZACION_M3,
  abstraccion: [{ clave: 'usaRepiteAnidado' }],
  pistas: [
    'Un rosetón son muchas copias de la misma figura, giradas un poco cada vez alrededor de un punto. Aquí la figura es un cuadrado. Fíjate dónde empieza la tortuga y hacia dónde mira: la posición y el rumbo de partida importan para aprobar.',
    'Si hay 36 copias, entre copia y copia la tortuga gira 360/36 = 10°. Cada cuadrado son cuatro giros de 90°. Pon el REPITE del cuadrado dentro del REPITE de las copias, y parte desde la misma posición y el mismo rumbo que ves en la demostración.',
    'REPITE 36 [ REPITE 4 [...] GD ... ]  —el cuadrado va dentro; cuida el punto y el rumbo de partida.',
  ],
};

// ============================================================================
// Nivel 3.2 — Rosetón de polígonos (generado)
// ============================================================================

export const NIVEL_3_2: Nivel = {
  id: '3.2',
  mundo: 3,
  titulo: 'Rosetón de polígonos',
  concepto: 'simetria',
  origen: {
    tipo: 'generado',
    idGenerador: 'roseton-m3',
    parametros: {},
  },
  normalizacion: NORMALIZACION_M3,
  abstraccion: [{ clave: 'usaRepiteAnidado' }],
  pistas: [
    'Es un rosetón como el anterior, pero la figura que se repite es un polígono de varios lados. Cuenta cuántas copias hay y cuántos lados tiene el polígono. La posición y el rumbo de partida de la tortuga cuentan para aprobar.',
    'Entre copias la tortuga gira 360 dividido entre el número de copias; dentro del polígono gira 360 dividido entre su número de lados. Un REPITE para el polígono, dentro de otro REPITE para las copias. Empieza desde la misma posición y el mismo rumbo que la demostración.',
    'REPITE copias [ REPITE lados [...] GD ... ]  —arranca donde arranca la demostración, mirando igual.',
  ],
};

// ============================================================================
// Nivel 3.3 — Flor con giro (generado)
// ============================================================================

export const NIVEL_3_3: Nivel = {
  id: '3.3',
  mundo: 3,
  titulo: 'Flor con giro',
  concepto: 'simetria',
  origen: {
    tipo: 'generado',
    idGenerador: 'flor-m3',
    parametros: {},
  },
  normalizacion: NORMALIZACION_M3,
  abstraccion: [{ clave: 'usaRepiteAnidado' }],
  pistas: [
    'Una flor son pétalos repetidos alrededor de un centro, y cada pétalo se inclina antes de dibujarse. Cuenta los pétalos. Dónde empieza la tortuga y hacia dónde mira son parte del reto: la posición y el rumbo de partida importan.',
    'Entre pétalo y pétalo la tortuga gira 360 dividido entre el número de pétalos. Dentro de cada pétalo gira primero y luego avanza, varias veces. Un REPITE del pétalo dentro del REPITE de los pétalos, partiendo desde la misma posición y el mismo rumbo de la demostración.',
    'REPITE petalos [ REPITE n [ GD ... AV ... ] GD ... ]  —el giro va antes del avance; respeta el punto y el rumbo de partida.',
  ],
};

// ============================================================================
// Nivel 3.4 — Mandala (autorado)
// ============================================================================

export const NIVEL_3_4: Nivel = {
  id: '3.4',
  mundo: 3,
  titulo: 'Mandala',
  concepto: 'simetria',
  origen: {
    tipo: 'autorado',
    referencia: REFERENCIA_3_4,
    semilla: SEMILLA_3_4,
  },
  normalizacion: NORMALIZACION_M3,
  abstraccion: [{ clave: 'usaRepiteAnidado' }],
  pistas: [
    'Un mandala es un rosetón de rosetones: un patrón que se repite varias veces alrededor del centro, y ese patrón ya tiene su propia repetición dentro. Observa con calma la demostración y cuenta las vueltas. La posición y el rumbo de partida de la tortuga importan para aprobar.',
    'Hay un REPITE dentro de otro dentro de otro: el más interno dibuja un círculo con avances cortos y giros iguales, el del medio lo repite en abanico, y el externo rota todo el abanico varias veces. Empieza desde la misma posición y el mismo rumbo que la demostración.',
    'REPITE [ ... REPITE [ REPITE [ AV ... GD ... ] GD ... ] ]  —tres niveles de anidación; parte desde el punto y el rumbo de la demostración.',
  ],
};

// ============================================================================
// Niveles del mundo 3 (en orden 3.1 … 3.4)
// ============================================================================

export const MUNDO_3: readonly Nivel[] = [NIVEL_3_1, NIVEL_3_2, NIVEL_3_3, NIVEL_3_4];
