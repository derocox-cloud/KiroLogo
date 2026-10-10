// Registro de generadores de KiroLogo.
//
// Asocia cada `idGenerador` que un nivel declara en su `origen` con la función
// que lo produce. Es la única pieza que conoce la correspondencia id → función,
// de modo que `reto.ts` resuelve un nivel generado sin importar cada generador
// por su nombre: le basta el id del dato del nivel.
//
// Vive en `niveles/`, así que solo importa de `niveles/`, `lenguaje/` y `azar/`
// (los generadores que registra respetan esa regla).

import type { Generador } from '../tipos.js';
import { generarCamino } from './camino.js';
import { generarZigzag } from './zigzag.js';

// ============================================================================
// Tabla de generadores
// ============================================================================

/**
 * Correspondencia entre el `idGenerador` de un nivel y su función generadora.
 * Agregar un arquetipo nuevo (specs futuras) es agregar una entrada aquí.
 */
const GENERADORES: Readonly<Record<string, Generador>> = {
  camino: generarCamino,
  zigzag: generarZigzag,
};

// ============================================================================
// Búsqueda
// ============================================================================

/**
 * Busca la función generadora asociada a un identificador.
 *
 * @param idGenerador Identificador declarado por el nivel, como `camino`
 * @returns La función generadora, o `null` si el id no está registrado. La
 *   decisión de qué error reportar ante un id desconocido es del llamador
 *   (`reto.ts` emite `generadorDesconocido`).
 */
export function buscarGenerador(idGenerador: string): Generador | null {
  return GENERADORES[idGenerador] ?? null;
}

/**
 * Los identificadores de generador registrados, en orden de declaración. Útil
 * para pruebas y para recorrer los arquetipos disponibles.
 */
export function idsGenerador(): readonly string[] {
  return Object.keys(GENERADORES);
}
