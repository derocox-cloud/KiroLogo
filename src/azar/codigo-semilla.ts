// Conversión entre semilla numérica y código de 7 caracteres
// Fuente única de códigos de reto compartibles

import { crearError, ErrorKiroLogo } from '../lenguaje/errores.js';
import { SEMILLA_MINIMA, SEMILLA_MAXIMA } from './prng.js';

// ============================================================================
// Constantes públicas
// ============================================================================

/**
 * Alfabeto de 31 símbolos para códigos de semilla.
 * Excluye I, L, O, 0, 1 para evitar confusiones.
 */
export const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Longitud fija de todos los códigos de semilla.
 */
export const LARGO_CODIGO = 7;

// ============================================================================
// Tipos de resultado
// ============================================================================

/**
 * Resultado exitoso de codificación.
 */
export interface ResultadoCodificacionExitoso {
  readonly exito: true;
  readonly codigo: string;
}

/**
 * Resultado fallido de codificación.
 */
export interface ResultadoCodificacionFallido {
  readonly exito: false;
  readonly error: ErrorKiroLogo;
}

/**
 * Resultado de la función `codificar`.
 */
export type ResultadoCodificacion = 
  | ResultadoCodificacionExitoso
  | ResultadoCodificacionFallido;

/**
 * Resultado exitoso de decodificación.
 */
export interface ResultadoDecodificacionExitoso {
  readonly exito: true;
  readonly semilla: number;
}

/**
 * Resultado fallido de decodificación.
 */
export interface ResultadoDecodificacionFallido {
  readonly exito: false;
  readonly error: ErrorKiroLogo;
}

/**
 * Resultado de la función `decodificar`.
 */
export type ResultadoDecodificacion =
  | ResultadoDecodificacionExitoso
  | ResultadoDecodificacionFallido;

// ============================================================================
// Funciones públicas
// ============================================================================

/**
 * Codifica una semilla numérica en un código de 7 caracteres.
 * 
 * @param semilla Semilla a codificar en el dominio [SEMILLA_MINIMA, SEMILLA_MAXIMA]
 * @returns Resultado con código de 7 caracteres o error si la semilla está fuera del dominio
 */
export function codificar(semilla: number): ResultadoCodificacion {
  // Validar que la semilla sea un entero dentro del dominio
  if (!Number.isInteger(semilla)) {
    return {
      exito: false,
      error: crearError('semillaFueraDeDominio', {})
    };
  }
  
  if (semilla < SEMILLA_MINIMA || semilla > SEMILLA_MAXIMA) {
    return {
      exito: false,
      error: crearError('semillaFueraDeDominio', {})
    };
  }
  
  // Codificar en base 31 con relleno a la izquierda con 'A'
  let valorRestante = semilla;
  const caracteres: string[] = [];
  
  for (let i = 0; i < LARGO_CODIGO; i++) {
    const indice = valorRestante % ALFABETO.length;
    caracteres.unshift(ALFABETO[indice]!);
    valorRestante = Math.floor(valorRestante / ALFABETO.length);
  }
  
  // El valor restante debe ser 0 si la semilla cabe en 7 dígitos base 31
  // Como SEMILLA_MAXIMA = 4_294_967_295 y 31^7 ≈ 27_512_614_111,
  // todas las semillas del dominio caben en 7 dígitos
  if (valorRestante !== 0) {
    // Esto no debería ocurrir dado el dominio, pero lo comprobamos por seguridad
    return {
      exito: false,
      error: crearError('semillaFueraDeDominio', {})
    };
  }
  
  const codigo = caracteres.join('');
  return {
    exito: true,
    codigo
  };
}

/**
 * Normaliza un código: descarta espacios de los extremos y convierte a mayúsculas.
 * 
 * @param codigo Código crudo que puede tener espacios y minúsculas
 * @returns Código normalizado (sin espacios, en mayúsculas)
 */
function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

/**
 * Decodifica un código de 7 caracteres en una semilla numérica.
 * 
 * @param codigo Código de 7 caracteres (acepta espacios y minúsculas, los normaliza)
 * @returns Resultado con semilla numérica o error si el código es inválido
 */
export function decodificar(codigo: string): ResultadoDecodificacion {
  // Normalizar el código: descartar espacios y convertir a mayúsculas
  const codigoNormalizado = normalizarCodigo(codigo);
  
  // Validar longitud
  if (codigoNormalizado.length !== LARGO_CODIGO) {
    return {
      exito: false,
      error: crearError('codigoSemillaLongitud', {})
    };
  }
  
  // Validar que todos los caracteres estén en el alfabeto
  for (let i = 0; i < codigoNormalizado.length; i++) {
    const caracter = codigoNormalizado[i]!;
    if (!ALFABETO.includes(caracter)) {
      return {
        exito: false,
        error: crearError('codigoSemillaSimbolo', {})
      };
    }
  }
  
  // Decodificar de base 31
  let semilla = 0;
  for (let i = 0; i < codigoNormalizado.length; i++) {
    const caracter = codigoNormalizado[i]!;
    const valor = ALFABETO.indexOf(caracter);
    semilla = semilla * ALFABETO.length + valor;
  }
  
  // Validar que la semilla decodificada esté dentro del dominio
  if (semilla < SEMILLA_MINIMA || semilla > SEMILLA_MAXIMA) {
    return {
      exito: false,
      error: crearError('codigoSemillaFueraDeDominio', {})
    };
  }
  
  return {
    exito: true,
    semilla
  };
}

/**
 * Verifica si un código es válido sin decodificarlo completamente.
 * Útil para validación rápida en la interfaz de usuario.
 * 
 * @param codigo Código a verificar
 * @returns true si el código tiene la longitud correcta y todos sus caracteres están en el alfabeto
 */
export function esCodigoValido(codigo: string): boolean {
  const codigoNormalizado = normalizarCodigo(codigo);
  
  if (codigoNormalizado.length !== LARGO_CODIGO) {
    return false;
  }
  
  for (let i = 0; i < codigoNormalizado.length; i++) {
    const caracter = codigoNormalizado[i]!;
    if (!ALFABETO.includes(caracter)) {
      return false;
    }
  }
  
  return true;
}
