// Property 24: las pistas se rellenan desde la referencia (spec 05, D2).
//
// Para las primeras 200 semillas de 4.2, 4.3 y 4.4 (más 200 semillas al azar del
// dominio), las tres pistas rellenas no dejan marcadores, nombran los valores del
// reto en pantalla y no revelan el programa. Los valores esperados se leen del AST
// de la referencia con un recorrido propio, no con `parametrosVisiblesDelReto`.
//
// **Validates: Requirements 23.2, 23.3, 23.4, 23.5, 23.6, 23.7**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { rellenarPistas } from './pistas.js';
import { resolverReto, type Reto } from './reto.js';
import { imprimir } from '../lenguaje/impresor.js';
import type { InvocacionProcedimiento, Programa } from '../lenguaje/ast.js';
import { SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../azar/prng.js';

const SEMILLAS_INICIALES = 200;
const EJEMPLOS: Array<[number]> = Array.from({ length: SEMILLAS_INICIALES }, (_, i) => [SEMILLA_MINIMA + i]);
const arbSemilla = fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA });

function retoDe(idNivel: string, semilla: number): Reto {
  const resultado = resolverReto(idNivel, semilla);
  if (!resultado.exito) throw new Error(`${idNivel} con semilla ${semilla}: ${resultado.error.mensaje}`);
  return resultado.reto;
}

function llamadas(referencia: Programa): InvocacionProcedimiento[] {
  return referencia.instrucciones.filter(
    (n): n is InvocacionProcedimiento => n.tipo === 'invocacionProcedimiento',
  );
}

function literalDe(llamada: InvocacionProcedimiento | undefined, indice: number): number {
  const arg = llamada?.argumentos[indice];
  if (!arg || arg.tipo !== 'numeroLiteral') throw new Error('argumento de llamada no literal');
  return arg.valor;
}

/** Todos los literales numéricos del árbol, a cualquier profundidad. */
function literales(nodo: unknown, acumulado: number[] = []): number[] {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) literales(hijo, acumulado);
  } else if (typeof nodo === 'object' && nodo !== null) {
    const registro = nodo as Record<string, unknown>;
    if (registro['tipo'] === 'numeroLiteral' && typeof registro['valor'] === 'number') {
      acumulado.push(registro['valor']);
    }
    for (const valor of Object.values(registro)) literales(valor, acumulado);
  }
  return acumulado;
}

/** El número aparece como numeral aislado (no como parte de otro, p. ej. 6 en 60). */
function contieneNumeral(texto: string, valor: number): boolean {
  return new RegExp(`(^|[^\\d.,])${String(valor).replace('.', '\\.')}($|[^\\d])`).test(texto);
}

function textoImpreso(programa: Programa): string {
  const r = imprimir(programa);
  if (!r.exito) throw new Error('la referencia no se puede imprimir');
  return r.texto.trimEnd();
}

/** Valores que la plantilla de cada nivel declara, leídos del AST. */
function valoresDeclarados(idNivel: string, referencia: Programa): { matematica: number[] } {
  const ll = llamadas(referencia);
  switch (idNivel) {
    case '4.2':
      return { matematica: [literalDe(ll[0], 0), literalDe(ll[1], 0), literalDe(ll[2], 0), literalDe(ll[0], 1)] };
    case '4.3':
      return { matematica: [literalDe(ll[0], 0), ll.length] };
    case '4.4':
      return { matematica: [literalDe(ll[0], 0)] };
    default:
      throw new Error(`nivel inesperado ${idNivel}`);
  }
}

function verificarPistas(idNivel: string, semilla: number): void {
  const reto = retoDe(idNivel, semilla);
  const pistas = rellenarPistas(reto.nivel, reto);
  const [conceptual, matematica, esqueleto] = pistas;
  const referencia = reto.referencia;

  // (a) Sin marcadores de plantilla sin sustituir.
  for (const pista of pistas) {
    expect(pista.trim().length).toBeGreaterThan(0);
    expect(pista).not.toMatch(/\{[A-Za-z0-9]+\}/);
  }

  // (b) Los valores que la plantilla declara.
  for (const valor of valoresDeclarados(idNivel, referencia).matematica) {
    expect(contieneNumeral(matematica, valor), `matemática sin ${valor}: ${matematica}`).toBe(true);
  }

  // R23.3: la vuelta completa y el nombre del parámetro.
  if (idNivel === '4.4') {
    expect(matematica).toContain('360 * 2');
    expect(matematica).toContain(':puntas');
  } else {
    expect(contieneNumeral(matematica, 360)).toBe(true);
    expect(matematica).toContain(':lados');
  }

  // R23.5: la conceptual del 4.2 es una pregunta sin los valores del reto.
  if (idNivel === '4.2') {
    expect(conceptual).toMatch(/¿[^?]*\?/);
    for (const valor of valoresDeclarados(idNivel, referencia).matematica) {
      expect(contieneNumeral(conceptual, valor), `conceptual con ${valor}`).toBe(false);
    }
  }

  // (c) Idénticas al generar el reto otra vez con la misma semilla.
  const otro = retoDe(idNivel, semilla);
  expect(rellenarPistas(otro.nivel, otro)).toEqual(pistas);

  // R23.4: el esqueleto tiene huecos y ningún literal de la referencia.
  expect(esqueleto).toContain('___');
  for (const valor of new Set(literales(referencia))) {
    expect(contieneNumeral(esqueleto, valor), `esqueleto con ${valor}: ${esqueleto}`).toBe(false);
  }

  // R23.4 y R23.7: ninguna pista muestra la referencia completa ni su PARA.
  const textoReferencia = textoImpreso(referencia);
  const definiciones = referencia.instrucciones.filter((n) => n.tipo === 'definicionProcedimiento');
  expect(definiciones.length).toBeGreaterThan(0);
  const textosPara = definiciones.map((d) => textoImpreso({ tipo: 'programa', instrucciones: [d] }));
  expect(esqueleto).not.toBe(textoReferencia);
  for (const pista of pistas) {
    expect(pista).not.toContain(textoReferencia);
    for (const textoPara of textosPara) expect(pista).not.toContain(textoPara);
  }
}

describe('Property 24: las pistas del mundo 4 se rellenan desde la referencia', () => {
  for (const idNivel of ['4.2', '4.3', '4.4']) {
    it(`nivel ${idNivel}: primeras 200 semillas y 200 al azar`, () => {
      fc.assert(
        fc.property(arbSemilla, (semilla) => {
          verificarPistas(idNivel, semilla);
        }),
        { numRuns: SEMILLAS_INICIALES, examples: EJEMPLOS },
      );
    }, 120_000);
  }
});
