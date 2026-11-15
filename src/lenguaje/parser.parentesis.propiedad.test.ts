// Property 12 de la spec 05: paréntesis, operandos y profundidad.
//
// Las expresiones se generan como texto, no como AST: lo que se prueba es justo cómo
// el lexer y el parser leen lo que escribe el jugador. Todas son válidas por
// construcción y cada caso les rompe una sola cosa (un cierre de menos, un cierre de
// más, un operador sin operando), para que el error esperado sea uno solo.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analizar } from './parser.js';
import { analizarLexico } from './lexer.js';
import { crearError } from './errores.js';
import { sinPosiciones } from '../pruebas/arbitrarios.js';

const MUNDO = 4;
const OPERADORES = ['+', '-', '*', '/'] as const;

function analizarTexto(texto: string) {
  return analizar(analizarLexico(texto).tokens, { mundo: MUNDO });
}

// ============================================================================
// Generadores de texto
// ============================================================================

/** Separador entre símbolos: con o sin espacios, que el lexer debe tratar igual. */
const arbSeparador = fc.constantFrom('', ' ', '  ');

const arbEntero = fc.integer({ min: 0, max: 999 }).map(String);

/**
 * Expresión válida de una sola línea, de hasta `altura` niveles, con números,
 * operadores infijos, menos unario y paréntesis. Nunca quedan dos números pegados:
 * entre dos operandos siempre hay un operador.
 */
function arbTextoExpresion(altura: number): fc.Arbitrary<string> {
  if (altura <= 0) return arbEntero;
  const sub = arbTextoExpresion(altura - 1);
  return fc.oneof(
    arbEntero,
    fc.tuple(sub, arbSeparador, fc.constantFrom(...OPERADORES), arbSeparador, sub)
      .map(([a, s1, op, s2, b]) => `${a}${s1}${op}${s2}${b}`),
    fc.tuple(arbSeparador, sub, arbSeparador).map(([s1, a, s2]) => `(${s1}${a}${s2})`),
    sub.map((a) => `-${a}`),
  );
}

const arbExpresionTexto = arbTextoExpresion(3);

/** Líneas válidas antes del caso, para que la línea del error no sea siempre la 1. */
const arbRelleno = fc.integer({ min: 0, max: 3 }).map((n) => 'AVANZA 10\n'.repeat(n));

/** Instrucciones válidas después del caso, en líneas propias. */
const arbCola = fc.constantFrom('', '\nAVANZA 10', '\nGIRADERECHA 90\nAVANZA 20');

// ============================================================================
// Lexer
// ============================================================================

type Pieza = { readonly tipo: 'numero'; readonly valor: number } | { readonly tipo: 'simbolo'; readonly valor: string };

const arbPieza: fc.Arbitrary<Pieza> = fc.oneof(
  fc.integer({ min: 0, max: 999 }).map((valor): Pieza => ({ tipo: 'numero', valor })),
  fc.constantFrom('+', '-', '*', '/', '(', ')').map((valor): Pieza => ({ tipo: 'simbolo', valor })),
);

const TIPO_DE_SIMBOLO: Readonly<Record<string, string>> = {
  '+': 'operador', '-': 'operador', '*': 'operador', '/': 'operador',
  '(': 'parentesis_abre', ')': 'parentesis_cierra',
};

describe('Property 12: paréntesis, operandos y profundidad', () => {
  it('el lexer produce un token por símbolo, con o sin espacios', () => {
    /** **Validates: Requirements 3.1** */
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbPieza, arbSeparador), { minLength: 1, maxLength: 20 }),
        (piezas) => {
          // Dos números seguidos necesitan un espacio: sin él serían un solo número.
          let texto = '';
          piezas.forEach(([pieza, separador], i) => {
            const anterior = piezas[i - 1]?.[0];
            const pegado = anterior?.tipo === 'numero' && pieza.tipo === 'numero' && separador === '';
            texto += (i === 0 ? '' : pegado ? ' ' : separador) + String(pieza.valor);
          });

          const { tokens, errores } = analizarLexico(texto);
          expect(errores).toEqual([]);
          expect(tokens.map((t) => ({ tipo: t.tipo, valor: t.valor }))).toEqual(
            piezas.map(([pieza]) => pieza.tipo === 'numero'
              ? { tipo: 'numero', valor: pieza.valor }
              : { tipo: TIPO_DE_SIMBOLO[pieza.valor], valor: pieza.valor }),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('una expresión válida se analiza igual con o sin espacios', () => {
    /** **Validates: Requirements 3.1** */
    fc.assert(
      fc.property(arbExpresionTexto, (expresion) => {
        const compacta = expresion.replace(/ /g, '');
        const espaciada = [...compacta].join(' ').replace(/(\d) (?=\d)/g, '$1');
        const a = analizarTexto(`AVANZA ${compacta}`);
        const b = analizarTexto(`AVANZA ${espaciada}`);
        expect(a.errores).toEqual([]);
        expect(b.errores).toEqual([]);
        expect(sinPosiciones(b.programa)).toEqual(sinPosiciones(a.programa));
      }),
      { numRuns: 200 },
    );
  });

  it('falta un cierre: parentesisSinCerrar con la línea del ( que quedó abierto', () => {
    /** **Validates: Requirements 3.8** */
    fc.assert(
      fc.property(
        arbRelleno,
        fc.constantFrom(' ', '\n'),
        fc.integer({ min: 1, max: 4 }),
        arbExpresionTexto,
        arbCola,
        (relleno, trasComando, abiertos, expresion, cola) => {
          // El primer argumento puede empezar en la línea siguiente al comando.
          const lineaParentesis = relleno.split('\n').length + (trasComando === '\n' ? 1 : 0);
          // Se abren `abiertos` paréntesis y se cierran todos menos el más externo.
          const texto = `${relleno}AVANZA${trasComando}${'('.repeat(abiertos)}${expresion}${')'.repeat(abiertos - 1)}${cola}`;

          const { programa, errores } = analizarTexto(texto);
          expect(programa).toBeNull();
          expect(errores).toHaveLength(1);
          expect(errores[0]).toMatchObject({
            id: 'parentesisSinCerrar',
            linea: lineaParentesis,
            mensaje: crearError('parentesisSinCerrar', { linea: lineaParentesis }).mensaje,
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it('sobra un ): parentesisDeMas con la línea de ese )', () => {
    /** **Validates: Requirements 3.9** */
    fc.assert(
      fc.property(
        arbRelleno,
        arbExpresionTexto,
        fc.constantFrom('', ' ', '\n', '\n\n'),
        arbCola,
        (relleno, expresion, antesDelCierre, cola) => {
          const lineaCierre = relleno.split('\n').length + antesDelCierre.split('\n').length - 1;
          const texto = `${relleno}AVANZA ${expresion}${antesDelCierre})${cola}`;

          const { programa, errores } = analizarTexto(texto);
          expect(programa).toBeNull();
          expect(errores).toHaveLength(1);
          expect(errores[0]).toMatchObject({
            id: 'parentesisDeMas',
            linea: lineaCierre,
            mensaje: crearError('parentesisDeMas', { linea: lineaCierre }).mensaje,
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it('operador sin operando por fin de línea, ) o fin del programa: expresionIncompleta', () => {
    /** **Validates: Requirements 3.10** */
    fc.assert(
      fc.property(
        arbRelleno,
        arbExpresionTexto,
        fc.constantFrom(...OPERADORES),
        arbSeparador,
        fc.constantFrom('finDeLinea', 'parentesis', 'finDelPrograma'),
        (relleno, expresion, operador, separador, corte) => {
          const linea = relleno.split('\n').length;
          const incompleta = `${expresion}${separador}${operador}`;
          const texto = corte === 'parentesis'
            ? `${relleno}AVANZA (${incompleta})\nAVANZA 10`
            : corte === 'finDeLinea'
              ? `${relleno}AVANZA ${incompleta}\nAVANZA 10`
              : `${relleno}AVANZA ${incompleta}`;

          const { programa, errores } = analizarTexto(texto);
          expect(programa).toBeNull();
          expect(errores).toHaveLength(1);
          expect(errores[0]).toMatchObject({
            id: 'expresionIncompleta',
            linea,
            mensaje: crearError('expresionIncompleta', { simbolo: operador, linea }).mensaje,
          });
        },
      ),
      { numRuns: 200 },
    );
  });

  it('con d de 1 a 40 niveles de paréntesis, se analiza sin error si y solo si d ≤ 32', () => {
    /** **Validates: Requirements 3.11** */
    // Cada nivel envuelve al anterior tal cual, con un operando a la izquierda, a la
    // derecha o con un menos unario: la profundidad de paréntesis es siempre d.
    const arbNivel = fc.oneof(
      fc.constant((x: string) => x),
      fc.tuple(arbEntero, fc.constantFrom(...OPERADORES)).map(([n, op]) => (x: string) => `${n} ${op} ${x}`),
      fc.tuple(arbEntero, fc.constantFrom(...OPERADORES)).map(([n, op]) => (x: string) => `${x} ${op} ${n}`),
      fc.constant((x: string) => `-${x}`),
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 40 }).chain((d) => fc.array(arbNivel, { minLength: d, maxLength: d })),
        arbEntero,
        (niveles, centro) => {
          const d = niveles.length;
          const expresion = niveles.reduce((interior, envolver) => `(${envolver(interior)})`, centro);

          let resultado: ReturnType<typeof analizarTexto> | undefined;
          expect(() => { resultado = analizarTexto(`AVANZA ${expresion}`); }).not.toThrow();
          const { programa, errores } = resultado!;
          if (d <= 32) {
            expect(errores).toEqual([]);
            expect(programa).not.toBeNull();
          } else {
            expect(programa).toBeNull();
            expect(errores.map((e) => e.id)).toEqual(['expresionDemasiadoProfunda']);
            expect(errores[0]!.linea).toBe(1);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
