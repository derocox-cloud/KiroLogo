// Generadores del mundo 1 · Figuras geométricas
// Producen el programa de referencia (como Programa AST) a partir de una semilla.
// Los tres generadores siguen el mismo patron: elegir parametros con el PRNG,
// construir el texto KiroLogo, parsearlo, verificar encuadre; si falla, reintentar.

import type { Programa } from "../lenguaje/ast.js";
import { analizarLexico } from "../lenguaje/lexer.js";
import { analizar } from "../lenguaje/parser.js";
import { ejecutar } from "../lenguaje/interprete.js";
import { crearPrng } from "../azar/prng.js";
import { ESTADO_INICIAL } from "../motor/tortuga.js";
import { extraerSegmentos } from "../motor/segmentos.js";
import { calcularEncuadre } from "../motor/encuadre.js";
import { comandosDelMundo } from "../lenguaje/vocabulario.js";

// ============================================================================
// Tipos publicos
// ============================================================================

export interface ResultadoGenerador {
  readonly programa: Programa;
  readonly texto: string;
  readonly semillaUsada: number;
}

// ============================================================================
// Utilidades internas
// ============================================================================

const PERMITIDOS_MUNDO_1 = comandosDelMundo(1);

/** Parsea texto KiroLogo del mundo 1; devuelve null si hay errores. */
function parsear(texto: string): Programa | null {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo: 1 });
  if (programa === null || errores.length > 0) return null;
  return programa;
}

/**
 * Ejecuta un programa y verifica que la figura encuadre en el lienzo
 * y no sea degenerada (ancho y alto >= 200).
 */
function encuadraYNoEsDegenerada(programa: Programa): boolean {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: PERMITIDOS_MUNDO_1,
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  const resultado = paso.value;
  if (resultado.error !== null) return false;

  const segmentos = extraerSegmentos(resultado.operaciones);
  const encuadre = calcularEncuadre(segmentos);

  if (!encuadre.hayCaja) return false;
  if (encuadre.degenerada) return false;
  if (encuadre.noEncuadrada.length > 0) return false;
  return true;
}

// Lados validos para poligono regular (excluye 7 porque 360/7 no es entero)
const LADOS_POLIGONO: readonly number[] = [3, 4, 5, 6, 8];

// ============================================================================
// Generador 1.2 — poligono regular GD
// ============================================================================

export function generarPoligonoGD(semilla: number): ResultadoGenerador {
  const MAX_INTENTOS = 1000;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const n = prng.elegir(LADOS_POLIGONO);
    const L = prng.multiplo(60, 140, 20);
    const angulo = Math.round(360 / n);
    const texto = `REPITE ${n} [AV ${L} GD ${angulo}]`;
    const programa = parsear(texto);
    if (programa !== null && encuadraYNoEsDegenerada(programa)) {
      return { programa, texto, semillaUsada: semilla + intento };
    }
  }
  // Fallback determinista con cuadrado
  const texto = "REPITE 4 [AV 100 GD 90]";
  return { programa: parsear(texto)!, texto, semillaUsada: semilla };
}

// ============================================================================
// Generador 1.3 — poligono regular GI
// ============================================================================

export function generarPoligonoGI(semilla: number): ResultadoGenerador {
  const MAX_INTENTOS = 1000;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const n = prng.elegir(LADOS_POLIGONO);
    const L = prng.multiplo(60, 140, 20);
    const angulo = Math.round(360 / n);
    const texto = `REPITE ${n} [AV ${L} GI ${angulo}]`;
    const programa = parsear(texto);
    if (programa !== null && encuadraYNoEsDegenerada(programa)) {
      return { programa, texto, semillaUsada: semilla + intento };
    }
  }
  const texto = "REPITE 4 [AV 100 GI 90]";
  return { programa: parsear(texto)!, texto, semillaUsada: semilla };
}

// ============================================================================
// Generador 1.5 — arco (poligono incompleto)
// ============================================================================

const LADOS_ARCO: readonly number[] = [4, 5, 6, 7, 8];

export function generarArco(semilla: number): ResultadoGenerador {
  const MAX_INTENTOS = 1000;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const n = prng.elegir(LADOS_ARCO);
    const k = prng.entero(2, n - 1);           // k < n: no cierra el poligono
    const L = prng.multiplo(60, 140, 20);
    const angulo = Math.round(360 / n);
    const texto = `REPITE ${k} [AV ${L} GD ${angulo}]`;
    const programa = parsear(texto);
    if (programa !== null && encuadraYNoEsDegenerada(programa)) {
      return { programa, texto, semillaUsada: semilla + intento };
    }
  }
  const texto = "REPITE 3 [AV 100 GD 90]";
  return { programa: parsear(texto)!, texto, semillaUsada: semilla };
}

// ============================================================================
// Registro de generadores por idGenerador
// ============================================================================

export type FnGenerador = (semilla: number) => ResultadoGenerador;

export const GENERADORES: Readonly<Record<string, FnGenerador>> = {
  "poligono-gd": generarPoligonoGD,
  "poligono-gi": generarPoligonoGI,
  "arco": generarArco,
};
