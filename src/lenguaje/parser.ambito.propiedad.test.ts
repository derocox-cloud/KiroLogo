// Property 9: las referencias fuera de ámbito se reportan una por una.
//
// Se arma el texto de un programa del mundo 4 línea por línea, anotando la posición de
// cada `:x`. El modelo es el ámbito léxico más simple posible: una referencia está en
// ámbito solo si va dentro de un PARA y su nombre normalizado es un parámetro de la
// cabecera de ESE PARA. Todo lo demás (programa principal, parámetro de otro PARA,
// argumento de una llamada hecha desde el principal) es un `variableNoDefinida`.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analizar, firmasDeProcedimientos } from './parser.js';
import { analizarLexico } from './lexer.js';
import { crearError } from './errores.js';
import { buscarComando, normalizarPalabra } from './vocabulario.js';
import { arbEscrituraVariada } from '../pruebas/arbitrarios.js';

const MUNDO = 4;
const MAXIMO_ERRORES = 20;

// Un pozo común de nombres: así un PARA usa a menudo un parámetro que es de otro PARA.
const NOMBRES = ['lado', 'largo', 'angulo', 'paso', 'giro', 'tamano'] as const;
const PROCEDIMIENTOS = ['FIGUNO', 'FIGDOS', 'FIGTRES'] as const;

type Nombre = (typeof NOMBRES)[number];

/** Una pieza de una línea: texto literal o referencia `:x` escrita de alguna forma. */
type Pieza =
  | { readonly tipo: 'texto'; readonly texto: string }
  | { readonly tipo: 'ref'; readonly nombre: Nombre; readonly escrito: string };

type Sentencia = readonly Pieza[];

const texto = (t: string): Pieza => ({ tipo: 'texto', texto: t });

const arbRef: fc.Arbitrary<Pieza> = fc
  .constantFrom(...NOMBRES)
  .chain((nombre) => arbEscrituraVariada(nombre).map((escrito) => ({ tipo: 'ref' as const, nombre, escrito: ':' + escrito })));

/** Sentencias que llevan referencias en los lugares de R2: comandos, REPITE y llamadas. */
function arbSentencia(aridades: readonly number[]): fc.Arbitrary<Sentencia> {
  const opciones: fc.Arbitrary<Sentencia>[] = [
    arbRef.map((r) => [texto('AVANZA'), r]),
    fc.tuple(arbRef, arbRef).map(([a, b]) => [texto('GIRADERECHA'), a, texto('+'), b]),
    fc.tuple(arbRef, arbRef).map(([a, b]) => [texto('REPITE'), a, texto('['), texto('AVANZA'), b, texto(']')]),
  ];
  aridades.forEach((aridad, i) => {
    opciones.push(
      fc.array(arbRef, { minLength: aridad, maxLength: aridad }).map((args) => [texto(PROCEDIMIENTOS[i]!), ...args]),
    );
  });
  return fc.oneof(...opciones);
}

interface Definicion {
  readonly parametros: readonly Nombre[];
  readonly escritos: readonly string[];
  readonly cuerpo: readonly Sentencia[];
}

interface Caso {
  readonly definiciones: readonly Definicion[];
  readonly principal: readonly Sentencia[];
}

const arbCabecera: fc.Arbitrary<{ parametros: Nombre[]; escritos: string[] }> = fc
  .shuffledSubarray([...NOMBRES], { minLength: 0, maxLength: 3 })
  .chain((parametros) =>
    fc.tuple(...parametros.map((p) => arbEscrituraVariada(p))).map((escritos) => ({
      parametros,
      escritos: escritos.map((e) => ':' + e),
    })),
  );

const arbCaso: fc.Arbitrary<Caso> = fc
  .array(arbCabecera, { minLength: 0, maxLength: PROCEDIMIENTOS.length })
  .chain((cabeceras) => {
    const aridades = cabeceras.map((c) => c.parametros.length);
    const sentencias = (max: number) => fc.array(arbSentencia(aridades), { minLength: 0, maxLength: max });
    return fc.record({
      definiciones: fc.tuple(...cabeceras.map((c) => sentencias(4).map((cuerpo) => ({ ...c, cuerpo })))),
      principal: sentencias(5),
    });
  });

interface Esperado {
  readonly nombre: string;
  readonly linea: number;
  readonly columna: number;
}

/** Texto del programa y las referencias fuera de ámbito, con su posición. */
function construir(caso: Caso): { texto: string; fuera: Esperado[] } {
  const lineas: string[] = [];
  const fuera: Esperado[] = [];

  const emitir = (sentencia: Sentencia, sangria: string, ambito: ReadonlySet<string> | null): void => {
    let linea = sangria;
    sentencia.forEach((pieza, i) => {
      if (i > 0) linea += ' ';
      if (pieza.tipo === 'texto') {
        linea += pieza.texto;
      } else {
        const columna = linea.length + 1;
        if (ambito === null || !ambito.has(pieza.nombre)) {
          fuera.push({ nombre: pieza.escrito, linea: lineas.length + 1, columna });
        }
        linea += pieza.escrito;
      }
    });
    lineas.push(linea);
  };

  // La mitad del principal va antes de las definiciones: el ámbito no depende del orden.
  const corte = Math.floor(caso.principal.length / 2);
  caso.principal.slice(0, corte).forEach((s) => emitir(s, '', null));
  caso.definiciones.forEach((d, i) => {
    lineas.push(['PARA', PROCEDIMIENTOS[i]!, ...d.escritos].join(' '));
    const ambito = new Set<string>(d.parametros);
    d.cuerpo.forEach((s) => emitir(s, '  ', ambito));
    lineas.push('FIN');
  });
  caso.principal.slice(corte).forEach((s) => emitir(s, '', null));

  return { texto: lineas.join('\n'), fuera };
}

function analizarTexto(fuente: string) {
  const { tokens, errores } = analizarLexico(fuente);
  expect(errores).toEqual([]);
  return { tokens, ...analizar(tokens, { mundo: MUNDO }) };
}

describe('Property 9: las referencias fuera de ámbito se reportan una por una', () => {
  it('los nombres de procedimiento del generador no pisan el lenguaje', () => {
    for (const p of PROCEDIMIENTOS) expect(buscarComando(p).hallada).toBe(false);
  });

  it('un variableNoDefinida por referencia fuera del PARA que la contiene, ordenados y hasta 20', () => {
    // **Validates: Requirements 2.2, 2.3, 2.4, 2.8**
    fc.assert(
      fc.property(arbCaso, (caso) => {
        const { texto: fuente, fuera } = construir(caso);
        const { programa, errores } = analizarTexto(fuente);

        const esperados = [...fuera]
          .sort((a, b) => a.linea - b.linea || a.columna - b.columna)
          .slice(0, MAXIMO_ERRORES)
          .map((e) => ({
            id: 'variableNoDefinida',
            mensaje: crearError('variableNoDefinida', { nombre: e.nombre }).mensaje,
            linea: e.linea,
            columna: e.columna,
          }));

        expect(errores.map((e) => ({ id: e.id, mensaje: e.mensaje, linea: e.linea, columna: e.columna })))
          .toEqual(esperados);
        // Con al menos un error el programa no llega a ejecutarse.
        if (fuera.length > 0) expect(programa).toBeNull();
        else expect(programa).not.toBeNull();
      }),
      { numRuns: 300 },
    );
  });

  it('un PARA que repite un parámetro reporta parametroDuplicado y no define el procedimiento', () => {
    // **Validates: Requirements 1.5**
    const arbRepetidos = fc
      .array(fc.constantFrom(...NOMBRES), { minLength: 2, maxLength: 5 })
      .filter((ps) => new Set(ps).size < ps.length)
      .chain((ps) => fc.tuple(...ps.map((p) => arbEscrituraVariada(p).map((e) => ':' + e))));
    const arbNombre = arbEscrituraVariada('figuno');

    fc.assert(
      fc.property(arbNombre, arbRepetidos, (nombre, escritos) => {
        // El cuerpo usa solo parámetros de la cabecera: el único error posible es el duplicado.
        const cabecera = `PARA ${nombre} ${escritos.join(' ')}`;
        const fuente = `${cabecera}\n  AVANZA ${escritos[0]}\nFIN`;
        const { tokens, programa, errores } = analizarTexto(fuente);

        // El repetido que se reporta es el primero cuyo nombre normalizado ya apareció.
        const vistos = new Set<string>();
        let indice = -1;
        escritos.forEach((e, i) => {
          const n = normalizarPalabra(e.slice(1)).toLowerCase();
          if (indice === -1 && vistos.has(n)) indice = i;
          vistos.add(n);
        });
        const columna = cabecera.length - escritos.slice(indice).join(' ').length + 1;

        expect(errores.map((e) => ({ id: e.id, mensaje: e.mensaje, linea: e.linea, columna: e.columna }))).toEqual([
          {
            id: 'parametroDuplicado',
            mensaje: crearError('parametroDuplicado', { procedimiento: nombre, parametro: escritos[indice]! }).mensaje,
            linea: 1,
            columna,
          },
        ]);
        expect(programa).toBeNull();
        expect(firmasDeProcedimientos(tokens, MUNDO)).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });
});
