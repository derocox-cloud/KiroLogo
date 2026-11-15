// Property 16 (spec 05): el texto numérico es el esperado.
//
// `formatearNumero` es la única forma de convertir un valor en texto para ESCRIBE y ROTULA.
// Se prueba sobre cualquier doble finito y, de punta a punta, sobre lo que emite ESCRIBE
// al ejecutarse: con una expresión, con una palabra escrita a mano y con el cero negativo.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { formatearNumero } from './evaluador.js';
import { ejecutar, type ResultadoEjecucion } from './interprete.js';
import { analizarLexico } from './lexer.js';
import { analizar } from './parser.js';
import { comandosDelMundo } from './vocabulario.js';
import type { Expresion, Programa } from './ast.js';
import { arbExpresion, modeloEvaluar } from '../pruebas/arbitrarios.js';

const PERMITIDOS_MUNDO_4 = comandosDelMundo(4);
const POSICION = { linea: 1, columna: 1 } as const;

// A partir de 1e21 `toFixed` cae en notación exponencial; la propiedad la exceptúa.
const UMBRAL_EXPONENCIAL = 1e21;
// Por encima de 1e15 los dobles ya no distinguen cuatro decimales: no se exige la cercanía.
const UMBRAL_CERCANIA = 1e15;
// Media unidad del cuarto decimal: el peor error de redondear a cuatro decimales.
const TOLERANCIA = 5e-5;

const FORMA = /^-?\d+(\.\d{1,4})?$/;

function correr(programa: Programa): ResultadoEjecucion {
  const gen = ejecutar(programa, { comandosPermitidos: PERMITIDOS_MUNDO_4, semilla: 0 });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

function escribe(argumento: Expresion): Programa {
  return {
    tipo: 'programa',
    instrucciones: [{ tipo: 'invocacionComando', nombre: 'ESCRIBE', argumentos: [argumento], ...POSICION }],
  };
}

/** Texto de la única operación `escribir` que emite el programa. */
function textoEscrito(programa: Programa): string {
  const r = correr(programa);
  expect(r.error).toBeNull();
  expect(r.operaciones).toHaveLength(1);
  const op = r.operaciones[0]!;
  expect(op.tipo).toBe('escribir');
  return (op as { texto: string }).texto;
}

/** Comprueba las cuatro condiciones de la propiedad para el texto de un valor finito. */
function comprobarTexto(texto: string, valor: number): void {
  expect(texto).not.toBe('-0');
  if (Math.abs(valor) >= UMBRAL_EXPONENCIAL) return;
  expect(texto).toMatch(FORMA);
  expect(texto).not.toMatch(/\.\d*0$/);
  if (Math.abs(valor) < UMBRAL_CERCANIA) {
    // `toFixed` redondea el doble exacto, así que el error real nunca pasa de 5e-5. Pero la
    // resta que lo mide también es de doble precisión: en un valor justo en el corte del
    // cuarto decimal (−99.98155) agrega unos ulp de ruido. Se admiten esos ulp, no más.
    const ruidoDeLaResta = 4 * Number.EPSILON * Math.max(1, Math.abs(valor));
    expect(Math.abs(Number(texto) - valor)).toBeLessThanOrEqual(TOLERANCIA + ruidoDeLaResta);
  }
}

// Dobles cualesquiera, más valores cerca de los cortes del cuarto decimal y del cero.
const arbFinito: fc.Arbitrary<number> = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.double({ min: -1000, max: 1000, noNaN: true }),
  fc.integer({ min: -10_000_000, max: 10_000_000 }).map((n) => n / 10_000),
  fc.integer({ min: -10_000_000, max: 10_000_000 }).map((n) => n / 100_000),
  fc.constantFrom(0, -0, 5e-5, -5e-5, 4.9999e-5, -4.9999e-5, 1e-300, -1e-300),
);

// Letras del alfabeto español que acepta el lexer, en mayúscula y minúscula, y dígitos.
const LETRAS = [...'abcdefghijklmnopqrstuvwxyzáéíóúüñABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ'];
const DIGITOS = [...'0123456789'];
const arbPalabra: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(...LETRAS, ...DIGITOS),
    fc.array(fc.constantFrom(...LETRAS, ...DIGITOS), { maxLength: 10 }),
  )
  .map(([primera, resto]) => primera + resto.join(''));

describe('Property 16: el texto numérico es el esperado', () => {
  it('formatearNumero da la forma, sin cero decimal final, nunca -0 y a 5e-5 del valor', () => {
    // **Validates: Requirements 9.2, 9.6**
    fc.assert(
      fc.property(arbFinito, (valor) => {
        comprobarTexto(formatearNumero(valor), valor);
      }),
      { numRuns: 1000 },
    );
  });

  it('ESCRIBE con una expresión emite el valor en ese texto', () => {
    // **Validates: Requirements 9.2**
    fc.assert(
      fc.property(arbExpresion(3, { divisoresSeguros: true }), (expresion) => {
        const esperado = modeloEvaluar(expresion);
        fc.pre(esperado.exito);
        if (!esperado.exito) return;
        const texto = textoEscrito(escribe(expresion));
        expect(texto).toBe(formatearNumero(esperado.valor));
        comprobarTexto(texto, esperado.valor);
      }),
      { numRuns: 300 },
    );
  });

  it('ESCRIBE "palabra emite la palabra sin comilla, con las mayúsculas y acentos escritos', () => {
    // **Validates: Requirements 9.3**
    fc.assert(
      fc.property(arbPalabra, fc.constantFrom('ESCRIBE', 'ES', 'escribe', 'Es'), (palabra, comando) => {
        const { tokens, errores } = analizarLexico(`${comando} "${palabra}`);
        expect(errores).toEqual([]);
        const analisis = analizar(tokens, { mundo: 4 });
        expect(analisis.errores).toEqual([]);
        expect(textoEscrito(analisis.programa!)).toBe(palabra);
      }),
      { numRuns: 300 },
    );
  });

  it('el cero negativo se escribe 0, como valor y como resultado de ESCRIBE', () => {
    // **Validates: Requirements 9.6**
    const ceroNegativo: fc.Arbitrary<Expresion> = fc.oneof(
      fc.constant<Expresion>({
        tipo: 'menosUnario',
        operando: { tipo: 'numeroLiteral', valor: 0, ...POSICION },
        ...POSICION,
      }),
      // 0 * -k da -0 para todo k > 0.
      fc.integer({ min: 1, max: 999 }).map((k): Expresion => ({
        tipo: 'expresionAritmetica',
        operador: '*',
        izquierda: { tipo: 'numeroLiteral', valor: 0, ...POSICION },
        derecha: { tipo: 'menosUnario', operando: { tipo: 'numeroLiteral', valor: k, ...POSICION }, ...POSICION },
        ...POSICION,
      })),
    );
    expect(formatearNumero(-0)).toBe('0');
    fc.assert(
      fc.property(ceroNegativo, (expresion) => {
        const esperado = modeloEvaluar(expresion);
        expect(esperado.exito && Object.is(esperado.valor, -0)).toBe(true);
        expect(textoEscrito(escribe(expresion))).toBe('0');
      }),
      { numRuns: 100 },
    );
  });
});
