// Property 2: el evaluador coincide con un modelo independiente.
//
// La expresión no se evalúa directo: se imprime como texto dentro de un PARA, se
// analiza y se ejecuta con el intérprete, igual que un programa del jugador. Así la
// propiedad cubre a la vez la precedencia y la asociatividad del parser y la
// aritmética del evaluador. El oráculo es `modeloEvaluar` (pila en notación polaca
// inversa), que no comparte código con `evaluador.ts`.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Expresion, Programa } from './ast.js';
import { formatearNumero } from './evaluador.js';
import { imprimir } from './impresor.js';
import { ejecutar, type ResultadoEjecucion } from './interprete.js';
import { analizarLexico } from './lexer.js';
import { analizar } from './parser.js';
import { buscarComando, comandosDelMundo } from './vocabulario.js';
import { arbExpresion, arbNumero, modeloEvaluar } from '../pruebas/arbitrarios.js';

const MUNDO = 4;
const PERMITIDOS = comandosDelMundo(MUNDO);
const PROCEDIMIENTO = 'EVALUAR';
const PARAMETROS = ['a', 'b', 'c'] as const;
const POS = { linea: 1, columna: 1 } as const;

function correrTexto(fuente: string): ResultadoEjecucion {
  const { tokens, errores } = analizarLexico(fuente);
  expect(errores).toEqual([]);
  const { programa, errores: erroresSintaxis } = analizar(tokens, { mundo: MUNDO });
  expect(erroresSintaxis).toEqual([]);
  const gen = ejecutar(programa!, { comandosPermitidos: PERMITIDOS, semilla: 0 });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

/** `PARA EVALUAR :a :b :c` con `ESCRIBE e` y `GIRADERECHA e`, y una llamada con los valores. */
function programaCon(expresion: Expresion, valores: readonly number[]): Programa {
  return {
    tipo: 'programa',
    instrucciones: [
      {
        tipo: 'definicionProcedimiento',
        nombre: PROCEDIMIENTO,
        parametros: PARAMETROS,
        cuerpo: [
          { tipo: 'invocacionComando', nombre: 'ESCRIBE', argumentos: [expresion], ...POS },
          { tipo: 'invocacionComando', nombre: 'GIRADERECHA', argumentos: [expresion], ...POS },
        ],
        ...POS,
      },
      {
        tipo: 'invocacionProcedimiento',
        nombre: PROCEDIMIENTO,
        argumentos: valores.map((valor) => ({ tipo: 'numeroLiteral' as const, valor, ...POS })),
        ...POS,
      },
    ],
  };
}

/** Lo que el intérprete escribió y giró, o el error si no llegó a hacerlo. */
function escritoYGiro(r: ResultadoEjecucion): { texto: string | undefined; grados: number | undefined } {
  const escribir = r.operaciones.find((o) => o.tipo === 'escribir');
  const girar = r.operaciones.find((o) => o.tipo === 'girar');
  return {
    texto: escribir?.tipo === 'escribir' ? escribir.texto : undefined,
    grados: girar?.tipo === 'girar' ? girar.grados : undefined,
  };
}

describe('Property 2: el evaluador coincide con un modelo independiente', () => {
  it('el nombre del procedimiento de prueba no pisa el lenguaje', () => {
    expect(buscarComando(PROCEDIMIENTO).hallada).toBe(false);
  });

  it('ESCRIBE y GIRADERECHA dan exactamente el valor del modelo de pila', () => {
    // **Validates: Requirements 3.2, 3.3, 3.4, 3.6, 4.1, 4.10, 4.11**
    const arbValores = fc.array(arbNumero, { minLength: PARAMETROS.length, maxLength: PARAMETROS.length });
    fc.assert(
      fc.property(arbExpresion(3, { parametros: PARAMETROS }), arbValores, (expresion, valores) => {
        const entorno = new Map(PARAMETROS.map((p, i) => [p, valores[i]!] as const));
        const esperado = modeloEvaluar(expresion, entorno);
        // Sin divisor cero ni desborde: los errores son de otras propiedades.
        fc.pre(esperado.exito);
        if (!esperado.exito) return;

        const impreso = imprimir(programaCon(expresion, valores));
        expect(impreso.exito).toBe(true);
        if (!impreso.exito) return;

        const r = correrTexto(impreso.texto);
        expect(r.error).toBeNull();
        expect(escritoYGiro(r)).toEqual({ texto: formatearNumero(esperado.valor), grados: esperado.valor });
      }),
      { numRuns: 500 },
    );
  });

  it.each([
    ['10 - 4 - 3', 3],
    ['100 / 5 / 4', 5],
    ['2 + 3 * 4', 14],
    ['20 - 12 / 4', 17],
    ['-3 * 4 + 20', 8],
    ['SUMA 2 3 * 4', 14],
    ['(2 + 3) * 4', 20],
  ])('`%s` vale %d', (expresion, valor) => {
    const r = correrTexto(`ESCRIBE ${expresion}\nGIRADERECHA ${expresion}`);
    expect(r.error).toBeNull();
    expect(escritoYGiro(r)).toEqual({ texto: String(valor), grados: valor });
  });
});
