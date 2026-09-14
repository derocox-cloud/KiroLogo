// Tipos de un Nivel de KiroLogo
// Los niveles son datos, no lógica. Este módulo declara la forma de un Nivel y
// solo importa de `src/lenguaje/`; nunca de `src/motor/`, `src/juego/` ni `src/ui/`.
// Sin prueba propia: se verifica desde `catalogo.test.ts` y con aserciones de
// compilación (`@ts-expect-error`).

import type { Programa } from '../lenguaje/ast.js';
import type { Mundo } from '../lenguaje/vocabulario.js';

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
