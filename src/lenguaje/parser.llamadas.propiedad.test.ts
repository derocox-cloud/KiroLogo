// Property 10: las llamadas y los comandos de operador se validan antes de ejecutar.
//
// Tres partes, cada una contra un modelo pequeño escrito aquí:
//   1. Aridad de las llamadas: con `k` parámetros y `m` argumentos en la misma línea, el
//      único error esperado depende solo de comparar `m` con `k`. La llamada va antes o
//      después de la definición, suelta, dentro de un REPITE o dentro de otro PARA.
//   2. Comandos de operador sueltos: `operadorSinUso` con el ejemplo armado con lo escrito.
//   3. Firmas del panel: las de `firmasDeProcedimientos` son exactamente las de los PARA
//      que la segunda pasada del parser acepta (sin error de rechazo en su cabecera).

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analizar, firmasDeProcedimientos } from './parser.js';
import { analizarLexico } from './lexer.js';
import { crearError, type ErrorKiroLogo } from './errores.js';
import { VOCABULARIO, buscarComando, normalizarPalabra } from './vocabulario.js';
import type { DefinicionProcedimiento } from './ast.js';
import { arbEscrituraVariada } from '../pruebas/arbitrarios.js';

const MUNDO = 4;
const PARAMETROS = ['lado', 'largo', 'angulo', 'paso'] as const;
const PROCEDIMIENTO = 'MIFIGURA';
const ENVOLTORIO = 'OTRAFIG';

function analizarTexto(fuente: string) {
  const { tokens, errores } = analizarLexico(fuente);
  expect(errores).toEqual([]);
  return { tokens, ...analizar(tokens, { mundo: MUNDO }) };
}

const resumen = (e: ErrorKiroLogo) => ({
  id: e.id,
  mensaje: e.mensaje,
  linea: e.linea,
  columna: e.columna,
});

// Argumentos que nunca empiezan con un `-` de nivel superior: un `-` tras otro argumento
// sería una resta binaria y uniría los dos en uno (eso lo cubre R15, no esta propiedad).
const arbArgumento: fc.Arbitrary<string> = fc.oneof(
  fc.integer({ min: 0, max: 400 }).map(String),
  fc.tuple(fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 99 })).map(([a, b]) => `(${a} - ${b})`),
  fc.tuple(fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 9 })).map(([a, b]) => `${a} * ${b}`),
  fc.tuple(fc.integer({ min: 1, max: 99 }), fc.integer({ min: 1, max: 99 })).map(([a, b]) => `SUMA ${a} ${b}`),
);

type Lugar = 'suelta' | 'repite' | 'dentroDePara';

interface CasoLlamada {
  readonly parametros: readonly string[];     // como se escribieron, con ':'
  readonly nombreEscrito: string;
  readonly argumentos: readonly string[];
  readonly continuacion: string | null;       // operador infijo tras el último argumento
  readonly antesDeLaDefinicion: boolean;
  readonly lugar: Lugar;
}

const arbCasoLlamada: fc.Arbitrary<CasoLlamada> = fc.record({
  parametros: fc
    .shuffledSubarray([...PARAMETROS], { minLength: 0, maxLength: 3 })
    .chain((ps) => fc.tuple(...ps.map((p) => arbEscrituraVariada(p).map((e) => ':' + e)))),
  nombreEscrito: arbEscrituraVariada(PROCEDIMIENTO.toLowerCase()),
  argumentos: fc.array(arbArgumento, { minLength: 0, maxLength: 5 }),
  continuacion: fc.option(
    fc.tuple(fc.constantFrom('+', '*', '/'), fc.integer({ min: 1, max: 9 })).map(([o, n]) => `${o} ${n}`),
    { nil: null },
  ),
  antesDeLaDefinicion: fc.boolean(),
  lugar: fc.constantFrom<Lugar>('suelta', 'repite', 'dentroDePara'),
});

/** Texto del programa, más la línea y columna de la llamada y del primer argumento sobrante. */
function construirLlamada(caso: CasoLlamada) {
  const k = caso.parametros.length;
  const piezas = [...caso.argumentos];
  if (caso.continuacion !== null && piezas.length > 0) {
    piezas[piezas.length - 1] = `${piezas[piezas.length - 1]} ${caso.continuacion}`;
  }
  const textoLlamada = [caso.nombreEscrito, ...piezas].join(' ');
  // Columna (1-based, relativa al inicio de la llamada) del argumento k+1, si existe.
  const desplazamientoSobrante =
    piezas.length > k ? [caso.nombreEscrito, ...piezas.slice(0, k)].join(' ').length + 1 : null;

  const definicion = [`PARA ${PROCEDIMIENTO} ${caso.parametros.join(' ')}`.trimEnd(), '  AVANZA 10', 'FIN'];

  // Las líneas de la llamada; el prefijo es lo que va antes de ella en su línea.
  let prefijo: string;
  let bloque: string[];
  switch (caso.lugar) {
    case 'suelta':
      prefijo = '';
      bloque = [textoLlamada, 'AVANZA 10'];
      break;
    case 'repite':
      prefijo = 'REPITE 2 [ ';
      bloque = [`${prefijo}${textoLlamada} ]`, 'AVANZA 10'];
      break;
    case 'dentroDePara':
      prefijo = '  ';
      bloque = [`PARA ${ENVOLTORIO}`, `${prefijo}${textoLlamada}`, '  AVANZA 10', 'FIN', ENVOLTORIO];
      break;
  }

  const lineas = caso.antesDeLaDefinicion ? [...bloque, ...definicion] : [...definicion, ...bloque];
  const desplazamientoBloque = caso.antesDeLaDefinicion ? 0 : definicion.length;
  const lineaLlamada = desplazamientoBloque + (caso.lugar === 'dentroDePara' ? 2 : 1);
  const columnaLlamada = prefijo.length + 1;

  return {
    texto: lineas.join('\n'),
    lineaLlamada,
    columnaLlamada,
    columnaSobrante: desplazamientoSobrante === null ? null : columnaLlamada + desplazamientoSobrante,
  };
}

describe('Property 10: las llamadas y los comandos de operador se validan antes de ejecutar', () => {
  it('los nombres de procedimiento del generador no pisan el lenguaje', () => {
    for (const p of [PROCEDIMIENTO, ENVOLTORIO]) expect(buscarComando(p).hallada).toBe(false);
  });

  it('la aridad de cada llamada se valida contra la firma, antes o después de la definición', () => {
    // **Validates: Requirements 7.3, 7.5, 7.6, 7.7, 7.9, 7.10**
    fc.assert(
      fc.property(arbCasoLlamada, (caso) => {
        const { texto, lineaLlamada, columnaLlamada, columnaSobrante } = construirLlamada(caso);
        const { programa, errores } = analizarTexto(texto);
        const k = caso.parametros.length;
        const m = caso.argumentos.length;

        if (m === k) {
          // El operador infijo tras el último argumento lo continúa: no es un argumento más.
          expect(errores.map(resumen)).toEqual([]);
          expect(programa).not.toBeNull();
          return;
        }

        const esperado = resumen(
          m < k
            ? crearError(
                'procedimientoArgumentosFaltantes',
                { nombre: caso.nombreEscrito, esperados: caso.parametros, recibidos: m },
                { linea: lineaLlamada, columna: columnaLlamada },
              )
            : crearError(
                'procedimientoArgumentosDeMas',
                { nombre: caso.nombreEscrito, esperados: caso.parametros, linea: lineaLlamada },
                { linea: lineaLlamada, columna: columnaSobrante! },
              ),
        );
        expect(errores.map(resumen)).toEqual([esperado]);
        expect(programa).toBeNull();

        // Los que faltan se nombran como se declararon y en el orden de la cabecera.
        if (m < k) {
          const faltan = caso.parametros.slice(m);
          expect(errores[0]!.mensaje).toContain(`${faltan.length}: ${faltan.join(' ')}.`);
        }
      }),
      { numRuns: 400 },
    );
  });

  it('un comando de operador suelto reporta operadorSinUso con un ejemplo ESCRIBE', () => {
    // **Validates: Requirements 6.3**
    const operadores = VOCABULARIO.filter((e) => e.produceValor);
    expect(operadores.length).toBeGreaterThan(0);

    const arbCaso = fc
      .constantFrom(...operadores)
      .chain((entrada) =>
        fc.record({
          entrada: fc.constant(entrada),
          escrito: arbEscrituraVariada(entrada.nombre.toLowerCase()),
          argumentos: fc.array(fc.integer({ min: 1, max: 99 }).map(String), {
            minLength: Number(entrada.aridad),
            maxLength: Number(entrada.aridad),
          }),
          continuacion: fc.option(
            fc.tuple(fc.constantFrom('+', '*'), fc.integer({ min: 1, max: 9 })).map(([o, n]) => `${o} ${n}`),
            { nil: null },
          ),
          lugar: fc.constantFrom<Lugar>('suelta', 'repite', 'dentroDePara'),
        }),
      );

    fc.assert(
      fc.property(arbCaso, ({ entrada, escrito, argumentos, continuacion, lugar }) => {
        const instruccion = [escrito, ...argumentos, ...(continuacion === null ? [] : [continuacion])].join(' ');
        let lineas: string[];
        let linea: number;
        let columna: number;
        switch (lugar) {
          case 'suelta':
            lineas = ['AVANZA 10', instruccion, 'AVANZA 10'];
            linea = 2;
            columna = 1;
            break;
          case 'repite':
            lineas = [`REPITE 3 [ ${instruccion} ]`];
            linea = 1;
            columna = 'REPITE 3 [ '.length + 1;
            break;
          case 'dentroDePara':
            lineas = [`PARA ${ENVOLTORIO}`, `  ${instruccion}`, 'FIN'];
            linea = 2;
            columna = 3;
            break;
        }
        const { programa, errores } = analizarTexto(lineas.join('\n'));

        expect(errores.map(resumen)).toEqual([
          resumen(
            crearError(
              'operadorSinUso',
              { nombre: entrada.nombre, ejemplo: `ESCRIBE ${instruccion}` },
              { linea, columna },
            ),
          ),
        ]);
        expect(programa).toBeNull();
      }),
      { numRuns: 300 },
    );
  });

  it('las firmas del panel son exactamente las de los procedimientos que el parser acepta', () => {
    // **Validates: Requirements 1.7, 12.8**
    // Nombres que se repiten (redefinición), uno que pisa el lenguaje y parámetros
    // que a veces se repiten: todos los motivos de rechazo de una cabecera.
    const NOMBRES = ['FIGUNO', 'FIGDOS', 'AVANZA'] as const;
    const arbDefinicion = fc.record({
      nombre: fc.constantFrom(...NOMBRES).chain((n) => arbEscrituraVariada(n.toLowerCase())),
      parametros: fc
        .array(fc.constantFrom('lado', 'largo', 'giro'), { minLength: 0, maxLength: 3 })
        .chain((ps) => fc.tuple(...ps.map((p) => arbEscrituraVariada(p).map((e) => ':' + e)))),
    });
    const RECHAZOS = new Set(['paraNombreQueEsLenguaje', 'procedimientoRedefinido', 'parametroDuplicado']);

    fc.assert(
      fc.property(fc.array(arbDefinicion, { minLength: 0, maxLength: 5 }), (definiciones) => {
        const lineas: string[] = [];
        const lineasCabecera: number[] = [];
        for (const d of definiciones) {
          lineas.push(['PARA', d.nombre, ...d.parametros].join(' '));
          lineasCabecera.push(lineas.length);
          lineas.push('  AVANZA 10', 'FIN');
        }
        const { tokens, programa, errores } = analizarTexto(lineas.join('\n'));

        const conRechazo = new Set(errores.filter((e) => RECHAZOS.has(e.id)).map((e) => e.linea));
        const aceptadas = definiciones
          .filter((_, i) => !conRechazo.has(lineasCabecera[i]!))
          .map((d) => ({
            nombre: normalizarPalabra(d.nombre),
            parametros: d.parametros.map((p) => normalizarPalabra(p.slice(1)).toLowerCase()),
          }));

        const firmas = firmasDeProcedimientos(tokens, MUNDO).map((f) => ({ nombre: f.nombre, parametros: f.parametros }));
        expect(firmas).toEqual(aceptadas);

        // Sin errores, las firmas coinciden también con las definiciones del AST.
        if (programa !== null) {
          const delAst = programa.instrucciones
            .filter((i): i is DefinicionProcedimiento => i.tipo === 'definicionProcedimiento')
            .map((d) => ({ nombre: d.nombre, parametros: d.parametros }));
          expect(firmas).toEqual(delAst);
        }
      }),
      { numRuns: 300 },
    );
  });
});
