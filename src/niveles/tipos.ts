// Tipos de un Nivel de KiroLogo
// Los niveles son datos, no lógica. Este módulo declara la forma de un Nivel y
// solo importa de `src/lenguaje/`; nunca de `src/motor/`, `src/juego/` ni `src/ui/`.
// Sin prueba propia: se verifica desde `catalogo.test.ts` y con aserciones de
// compilación (`@ts-expect-error`).

import type { Programa } from '../lenguaje/ast.js';
import type { Mundo } from '../lenguaje/vocabulario.js';
import type { ErrorKiroLogo } from '../lenguaje/errores.js';

// ============================================================================
// Concepto que enseña el nivel
// ============================================================================

export type ConceptoNivel =
  | 'secuencia'
  | 'iteracion'
  | 'descomposicion'
  | 'simetria'
  | 'generalizacion'
  | 'recursion';

// ============================================================================
// Normalización geométrica
// ============================================================================

export type ComponenteNormalizacion = 'libre' | 'fija';

export interface NormalizacionNivel {
  readonly traslacion: ComponenteNormalizacion;
  readonly rotacion: ComponenteNormalizacion;
  readonly escala: 'exacta'; // único valor admitido
}

// ============================================================================
// Exigencias de abstracción
// ============================================================================

/**
 * Unión discriminada por `clave`: `maximoProcedimientos` lleva su entero
 * obligatorio (1 a 10) y las otras cinco claves no admiten valor. Una clave
 * ajena a estas seis no compila.
 */
export type ExigenciaAbstraccion =
  | { readonly clave: 'usaRepite' }
  | { readonly clave: 'usaRepiteAnidado' }
  | { readonly clave: 'defineProcedimiento' }
  | { readonly clave: 'usaParametros' }
  | { readonly clave: 'usaRecursion' }
  | { readonly clave: 'maximoProcedimientos'; readonly maximo: number }; // 1 a 10

// ============================================================================
// Origen del nivel
// ============================================================================

/**
 * Unión discriminada de dos variantes. El compilador atrapa un nivel autorado
 * que declara `idGenerador`, un nivel generado que declara un AST, y un
 * consumidor que deja sin tratar una de las dos variantes.
 */
export type OrigenNivel =
  | {
      readonly tipo: 'autorado';
      readonly referencia: Programa; // AST, ≥ 1 instrucción
      readonly semilla: number; // fija
    }
  | {
      readonly tipo: 'generado';
      readonly idGenerador: string;
      readonly parametros: Readonly<Record<string, number>>;
    };

// ============================================================================
// Nivel
// ============================================================================

export interface Nivel {
  readonly id: string; // «0.1», ≤ 8 caracteres, único
  readonly mundo: Mundo;
  readonly titulo: string; // español, ≤ 60 caracteres
  readonly concepto: ConceptoNivel;
  readonly origen: OrigenNivel;
  readonly normalizacion: NormalizacionNivel;
  readonly abstraccion: readonly ExigenciaAbstraccion[];
  readonly pistas: readonly [string, string, string]; // conceptual, matemática, esqueleto
  readonly margenLimiteDuro?: number; // 0 a 10, por omisión 3
}

// ============================================================================
// El contrato de un Generador (spec 01)
// ============================================================================

/**
 * Lo que recibe un Generador. La `semilla` es la inicial del intento; si el
 * primer candidato se descarta, el Generador reintenta con la siguiente, hasta
 * `intentosMaximos`. Los `parametros` son los del nivel (rangos de tramos y
 * longitudes), para que el rango viva en el dato del nivel y no en el código del
 * generador.
 */
export interface EntradaGenerador {
  readonly semilla: number; // inicial, dominio [0, 4 294 967 295]
  readonly parametros: Readonly<Record<string, number>>;
  readonly intentosMaximos: number; // p. ej. 200
}

/**
 * Lo que devuelve un Generador: unión discriminada por `exito`. El caso de éxito
 * expone el programa de referencia como AST, la semilla efectiva con la que lo
 * produjo (puede diferir de la pedida si hubo descartes) y cuántos candidatos
 * descartó antes. El caso de fallo lleva un error del catálogo y los intentos
 * realizados. Un descarte individual **no** es un fallo: es interno al lazo.
 */
export type ResultadoGeneracion =
  | {
      readonly exito: true;
      readonly referencia: Programa;
      readonly semillaEfectiva: number;
      readonly descartes: number;
    }
  | {
      readonly exito: false;
      readonly error: ErrorKiroLogo;
      readonly intentos: number;
    };

/**
 * La firma común de todo Generador del proyecto. Función **pura**: no lee azar
 * global ni estado a nivel de módulo; toda su aleatoriedad sale de un PRNG
 * sembrado con la semilla del intento. Misma entrada → mismo resultado. Un
 * Generador solo puede importar de `lenguaje/` y `azar/`.
 */
export type Generador = (entrada: EntradaGenerador) => ResultadoGeneracion;
