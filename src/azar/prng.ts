// Generador de números pseudoaleatorios determinista
// Fuente única de azar para todo el juego, nunca Math.random

import { crearError } from '../lenguaje/errores.js';

// ============================================================================
// Constantes públicas
// ============================================================================

/**
 * Mínimo valor admitido para una semilla.
 */
export const SEMILLA_MINIMA = 0;

/**
 * Máximo valor admitido para una semilla: 2³² − 1.
 * Dominio de 0 a 4 294 967 295 inclusive.
 */
export const SEMILLA_MAXIMA = 4_294_967_295;  // 0xFFFFFFFF

// ============================================================================
// Interfaz pública
// ============================================================================

/**
 * Generador de números pseudoaleatorios determinista.
 * Cada instancia lleva su propio estado de 32 bits, sin ningún estado a nivel de módulo.
 */
export interface Prng {
  /**
   * Devuelve el siguiente número pseudoaleatorio en el intervalo [0, 1).
   * Avanza el estado interno de la instancia.
   */
  siguiente(): number;
  
  /**
   * Devuelve un entero aleatorio en el intervalo [minimo, maximo], ambos inclusive.
   * Ante argumentos inválidos (minimo > maximo) reporta un error sin devolver valor y sin avanzar el estado.
   */
  entero(minimo: number, maximo: number): number;
  
  /**
   * Devuelve un elemento aleatorio de la lista recibida, devolviendo el elemento y no su posición.
   * Ante lista vacía reporta un error sin devolver valor y sin avanzar el estado.
   */
  elegir<T>(lista: readonly T[]): T;
  
  /**
   * Devuelve un múltiplo de `paso` en el intervalo [minimo, maximo], ambos inclusive.
   * El resultado siempre es divisible por `paso`.
   * Ante argumentos inválidos (paso no positivo, mínimo > máximo, rango sin ningún múltiplo)
   * reporta un error sin devolver valor y sin avanzar el estado.
   */
  multiplo(minimo: number, maximo: number, paso: number): number;
}

// ============================================================================
// Implementación privada
// ============================================================================

/**
 * Estado interno de una instancia de PRNG.
 */
class PrngImpl implements Prng {
  private estado: number;
  
  /**
   * Crea una instancia con la semilla dada.
   * @param semilla Semilla inicial en el dominio [SEMILLA_MINIMA, SEMILLA_MAXIMA].
   */
  constructor(semilla: number) {
    // Validar que la semilla esté en el dominio permitido
    if (!Number.isInteger(semilla) || semilla < SEMILLA_MINIMA || semilla > SEMILLA_MAXIMA) {
      // Este error no debería ocurrir si el llamador validó primero, pero lo comprobamos por seguridad
      const error = crearError('semillaFueraDeDominio', {});
      // En lugar de lanzar excepción, usamos una semilla por defecto pero registramos el problema
      console.error(`Prng: semilla ${semilla} fuera de dominio, usando 0. Error:`, error.mensaje);
      this.estado = 0;
    } else {
      this.estado = semilla | 0;  // Asegurar que es un entero de 32 bits
    }
  }
  
  /**
   * Implementación del algoritmo mulberry32.
   * Devuelve un número en [0, 1) y avanza el estado.
   */
  siguiente(): number {
    // Avanzar el estado
    this.estado = (this.estado + 0x6D2B79F5) | 0;
    
    // Mezcla
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    
    // Extraer valor y normalizar a [0, 1)
    const valor = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return valor;
  }
  
  entero(minimo: number, maximo: number): number {
    // Validar argumentos
    if (!Number.isInteger(minimo) || !Number.isInteger(maximo)) {
      const error = crearError('rangoInvalido', { min: minimo, max: maximo });
      console.error(error.mensaje);
      // No avanzar estado, no devolver valor
      throw error;
    }
    
    if (minimo > maximo) {
      const error = crearError('rangoInvalido', { min: minimo, max: maximo });
      console.error(error.mensaje);
      // No avanzar estado, no devolver valor
      throw error;
    }
    
    // Caso trivial: rango de un solo valor
    if (minimo === maximo) {
      return minimo;
    }
    
    // Generar número en [0, 1) y escalar al rango
    const aleatorio = this.siguiente();
    const rango = maximo - minimo + 1;  // +1 porque ambos extremos son inclusive
    const resultado = Math.floor(aleatorio * rango) + minimo;
    
    // Asegurar que el resultado está dentro del rango (por seguridad numérica)
    return Math.max(minimo, Math.min(maximo, resultado));
  }
  
  elegir<T>(lista: readonly T[]): T {
    // Validar argumentos
    if (lista.length === 0) {
      const error = crearError('listaVacia', {});
      console.error(error.mensaje);
      // No avanzar estado, no devolver valor
      throw error;
    }
    
    // Caso trivial: lista de un solo elemento
    if (lista.length === 1) {
      return lista[0]!;
    }
    
    // Seleccionar índice aleatorio
    const indice = this.entero(0, lista.length - 1);
    return lista[indice]!;
  }
  
  multiplo(minimo: number, maximo: number, paso: number): number {
    // Validar argumentos
    if (!Number.isInteger(paso) || paso <= 0) {
      const error = crearError('pasoInvalido', { paso });
      console.error(error.mensaje);
      // No avanzar estado, no devolver valor
      throw error;
    }
    
    if (!Number.isInteger(minimo) || !Number.isInteger(maximo)) {
      const error = crearError('rangoInvalido', { min: minimo, max: maximo });
      console.error(error.mensaje);
      // No avanzar estado, no devolver valor
      throw error;
    }
    
    if (minimo > maximo) {
      const error = crearError('rangoInvalido', { min: minimo, max: maximo });
      console.error(error.mensaje);
      // No avanzar estado, no devolver valor
      throw error;
    }
    
    // Encontrar el primer múltiplo en el rango
    const primerMultiplo = Math.ceil(minimo / paso) * paso;
    const ultimoMultiplo = Math.floor(maximo / paso) * paso;
    
    if (primerMultiplo > ultimoMultiplo) {
      const error = crearError('rangoSinMultiplo', { min: minimo, max: maximo, paso });
      console.error(error.mensaje);
      // No avanzar estado, no devolver valor
      throw error;
    }
    
    // Caso trivial: solo un múltiplo en el rango
    if (primerMultiplo === ultimoMultiplo) {
      return primerMultiplo;
    }
    
    // Calcular cuántos múltiplos hay en el rango
    const cantidadMultiplos = (ultimoMultiplo - primerMultiplo) / paso + 1;
    
    // Seleccionar múltiplo aleatorio
    const indice = this.entero(0, cantidadMultiplos - 1);
    const resultado = primerMultiplo + (indice * paso);
    
    return resultado;
  }
  
  /**
   * Obtiene el estado actual (solo para pruebas).
   */
  obtenerEstado(): number {
    return this.estado;
  }
}

// ============================================================================
// Función de creación
// ============================================================================

/**
 * Crea una nueva instancia de PRNG con la semilla dada.
 * 
 * @param semilla Semilla inicial en el dominio [SEMILLA_MINIMA, SEMILLA_MAXIMA].
 * @returns Instancia de PRNG lista para usar.
 * @throws Si la semilla está fuera del dominio.
 */
export function crearPrng(semilla: number): Prng {
  // Validar la semilla antes de crear la instancia
  if (!Number.isInteger(semilla) || semilla < SEMILLA_MINIMA || semilla > SEMILLA_MAXIMA) {
    const error = crearError('semillaFueraDeDominio', {});
    // Lanzar el error para que el llamador lo maneje
    throw error;
  }
  
  return new PrngImpl(semilla);
}