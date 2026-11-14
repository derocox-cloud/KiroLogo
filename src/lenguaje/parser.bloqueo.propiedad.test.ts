// Property 11: Los símbolos y comandos del mundo 4 están bloqueados antes de él.
//
// Se parte de un programa válido del mundo 0 a 3 (generado e impreso) y se le meten
// símbolos aritméticos, comandos del mundo 4 o cabeceras PARA con parámetros. Como el
// programa base no tiene errores, todo lo que el parser reporte sale de lo insertado.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analizar, firmasDeProcedimientos } from './parser.js';
import { analizarLexico } from './lexer.js';
import { imprimir } from './impresor.js';
import { buscarComando, type Mundo } from './vocabulario.js';
import { arbPrograma, arbEscrituraVariada, type MundoGenerable } from '../pruebas/arbitrarios.js';

const MUNDO_DESBLOQUEO = 4;
const SIMBOLOS = ['+', '-', '*', '/', '(', ')'] as const;

interface Linea {
  readonly sangria: string;
  readonly palabras: string[];
}

function analizarTexto(texto: string, mundo: Mundo) {
  const { tokens } = analizarLexico(texto);
  return { tokens, ...analizar(tokens, { mundo }) };
}

function aLineas(texto: string): Linea[] {
  return texto
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const sangria = /^ */.exec(l)![0];
      return { sangria, palabras: l.slice(sangria.length).split(' ') };
    });
}

const aTexto = (lineas: readonly Linea[]): string =>
  lineas.map((l) => l.sangria + l.palabras.join(' ')).join('\n');

/** Columna (desde 1) de la palabra `indice` de la línea. */
const columnaDe = (linea: Linea, indice: number): number =>
  linea.sangria.length + linea.palabras.slice(0, indice).reduce((s, p) => s + p.length + 1, 0) + 1;

const arbMundoBloqueado = fc.constantFrom<MundoGenerable>(0, 1, 2, 3);

/** Programa válido del mundo, como líneas de palabras. */
const arbBase = (mundo: MundoGenerable): fc.Arbitrary<Linea[]> =>
  arbPrograma(mundo).map((programa) => {
    const impreso = imprimir(programa);
    if (!impreso.exito) throw new Error('el generador produjo un programa no imprimible');
    return aLineas(impreso.texto);
  });

interface Insercion {
  readonly linea: number;
  readonly palabra: number;
  readonly simbolo: string;
  readonly lineaNueva: boolean;
}

const arbInserciones = fc.array(
  fc.record({
    linea: fc.nat(),
    palabra: fc.nat(),
    simbolo: fc.constantFrom(...SIMBOLOS),
    lineaNueva: fc.boolean(),
  }),
  { minLength: 1, maxLength: 6 },
);

/** Mete cada símbolo como palabra suelta, entre dos palabras o en una línea propia. */
function insertarSimbolos(base: readonly Linea[], inserciones: readonly Insercion[]): Linea[] {
  const lineas = base.map((l) => ({ sangria: l.sangria, palabras: [...l.palabras] }));
  for (const ins of inserciones) {
    if (ins.lineaNueva || lineas.length === 0) {
      lineas.splice(ins.linea % (lineas.length + 1), 0, { sangria: '', palabras: [ins.simbolo] });
    } else {
      const linea = lineas[ins.linea % lineas.length]!;
      linea.palabras.splice(ins.palabra % (linea.palabras.length + 1), 0, ins.simbolo);
    }
  }
  return lineas;
}

/** Primer símbolo aritmético en orden de lectura: línea, columna y texto. */
function primerSimbolo(lineas: readonly Linea[]): { linea: number; columna: number; simbolo: string } | null {
  for (let i = 0; i < lineas.length; i++) {
    const indice = lineas[i]!.palabras.findIndex((p) => (SIMBOLOS as readonly string[]).includes(p));
    if (indice >= 0) return { linea: i + 1, columna: columnaDe(lineas[i]!, indice), simbolo: lineas[i]!.palabras[indice]! };
  }
  return null;
}

// Fragmentos con comandos del mundo 4: palabras de la línea y cuáles son comandos bloqueados.
// Incluyen operadores anidados y operadores como argumento, que es donde la recuperación
// del parser podría saltarse una ocurrencia.
interface Fragmento {
  readonly palabras: readonly string[];
  readonly bloqueados: readonly number[];
}

const FRAGMENTOS: readonly Fragmento[] = [
  ...['SUMA', 'RESTA', 'PRODUCTO', 'COCIENTE', 'RESTO'].flatMap((op): Fragmento[] => [
    { palabras: [op, '1', '2'], bloqueados: [0] },
    { palabras: ['AVANZA', op, '40', '20'], bloqueados: [1] },
    { palabras: [op, op, '1', '2', '3'], bloqueados: [0, 1] },
  ]),
  { palabras: ['AZAR', '6'], bloqueados: [0] },
  { palabras: ['GIRADERECHA', 'AZAR', '90'], bloqueados: [1] },
  ...['ESCRIBE', 'ES', 'ROTULA', 'RO'].flatMap((cmd): Fragmento[] => [
    { palabras: [cmd, '5'], bloqueados: [0] },
    { palabras: [cmd, '"hola'], bloqueados: [0] },
    { palabras: [cmd, 'SUMA', '1', '2'], bloqueados: [0, 1] },
  ]),
];

const arbFragmento: fc.Arbitrary<{ palabras: string[]; bloqueados: readonly number[] }> = fc
  .constantFrom(...FRAGMENTOS)
  .chain((f) =>
    fc.tuple(...f.palabras.map((p) => arbEscrituraVariada(p))).map((palabras) => ({ palabras, bloqueados: f.bloqueados })),
  );

const nombreCanonico = (escrito: string): string => {
  const busqueda = buscarComando(escrito);
  if (!busqueda.hallada) throw new Error(`${escrito} no está en el vocabulario`);
  return busqueda.entrada.nombre;
};

describe('Property 11: los símbolos y comandos del mundo 4 están bloqueados antes de él', () => {
  it('los programas base se analizan sin errores en su mundo', () => {
    fc.assert(
      fc.property(arbMundoBloqueado.chain((m) => fc.tuple(fc.constant(m), arbBase(m))), ([mundo, base]) => {
        expect(analizarTexto(aTexto(base), mundo).errores).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.12**
  it('con + - * / ( ) reporta un único aritmeticaBloqueada con el primer símbolo, su línea y el mundo 4', () => {
    fc.assert(
      fc.property(
        arbMundoBloqueado.chain((m) => fc.tuple(fc.constant(m), arbBase(m), arbInserciones)),
        ([mundo, base, inserciones]) => {
          const lineas = insertarSimbolos(base, inserciones);
          const primero = primerSimbolo(lineas)!;
          const { programa, errores } = analizarTexto(aTexto(lineas), mundo);

          expect(programa).toBeNull();
          // Quitados los símbolos queda el programa base, que es válido: no hay otro error.
          expect(errores).toHaveLength(1);
          expect(errores[0]).toMatchObject({ id: 'aritmeticaBloqueada', linea: primero.linea, columna: primero.columna });
          expect(errores[0]!.mensaje).toBe(
            `El símbolo ${primero.simbolo} todavía no está disponible. Se desbloquea en el mundo ${MUNDO_DESBLOQUEO}.`,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  // **Validates: Requirements 5.6, 9.8, 11.11**
  it('reporta un comandoBloqueado con el mundo 4 por cada ocurrencia de un comando del mundo 4', () => {
    fc.assert(
      fc.property(
        arbMundoBloqueado.chain((m) =>
          fc.tuple(
            fc.constant(m),
            arbBase(m),
            fc.array(fc.tuple(arbFragmento, fc.nat(), fc.option(fc.tuple(fc.nat(), fc.constantFrom(...SIMBOLOS)))), {
              minLength: 1,
              maxLength: 5,
            }),
          ),
        ),
        ([mundo, base, fragmentos]) => {
          const lineas: Linea[] = base.map((l) => ({ sangria: l.sangria, palabras: [...l.palabras] }));
          const marcadas: Array<{ linea: Linea; indices: number[] }> = [];
          for (const [fragmento, donde, simbolo] of fragmentos) {
            const palabras = [...fragmento.palabras];
            const indices = [...fragmento.bloqueados];
            // A veces la misma línea lleva además un símbolo aritmético (detrás del primer comando).
            if (simbolo !== null) {
              const [posicion, s] = simbolo;
              const en = 1 + (posicion % palabras.length);
              palabras.splice(en, 0, s);
              for (let k = 0; k < indices.length; k++) if (indices[k]! >= en) indices[k] = indices[k]! + 1;
            }
            const linea: Linea = { sangria: '', palabras };
            lineas.splice(donde % (lineas.length + 1), 0, linea);
            marcadas.push({ linea, indices });
          }

          const esperados = marcadas
            .flatMap(({ linea, indices }) =>
              indices.map((i) => ({
                linea: lineas.indexOf(linea) + 1,
                columna: columnaDe(linea, i),
                mensaje: `${nombreCanonico(linea.palabras[i]!)} todavía no está disponible. Se desbloquea en el mundo ${MUNDO_DESBLOQUEO}.`,
              })),
            )
            .sort((a, b) => a.linea - b.linea || a.columna - b.columna);

          const { programa, errores } = analizarTexto(aTexto(lineas), mundo);
          expect(programa).toBeNull();
          const bloqueados = errores
            .filter((e) => e.id === 'comandoBloqueado')
            .map((e) => ({ linea: e.linea, columna: e.columna, mensaje: e.mensaje }));
          expect(bloqueados).toEqual(esperados);

          const primero = primerSimbolo(lineas);
          const aritmetica = errores.filter((e) => e.id === 'aritmeticaBloqueada');
          expect(aritmetica).toHaveLength(primero === null ? 0 : 1);
          if (primero !== null) expect(aritmetica[0]).toMatchObject({ linea: primero.linea, columna: primero.columna });
        },
      ),
      { numRuns: 200 },
    );
  });

  // **Validates: Requirements 1.4**
  // En los mundos 0 y 1 el propio PARA está bloqueado (comandoBloqueado del mundo 2), así que
  // la cabecera con parámetros solo llega a analizarse en los mundos 2 y 3.
  it('una cabecera PARA con parámetros reporta paraConParametros y no define el procedimiento', () => {
    const arbNombre = fc
      .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), { minLength: 3, maxLength: 8 })
      .map((l) => l.join(''))
      .filter((n) => !buscarComando(n).hallada);
    const arbParametros = fc.uniqueArray(
      fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'), { minLength: 1, maxLength: 6 }).map((l) => l.join('')),
      { minLength: 1, maxLength: 3 },
    );

    fc.assert(
      fc.property(
        fc.constantFrom<MundoGenerable>(2, 3).chain((m) =>
          fc.tuple(fc.constant(m), arbBase(m), arbNombre, arbParametros, fc.nat(), fc.boolean()),
        ),
        ([mundo, base, nombre, parametros, donde, conLlamada]) => {
          const nombres = new Set(base.flatMap((l) => l.palabras));
          fc.pre(!nombres.has(nombre));

          const cabecera: Linea = { sangria: '', palabras: ['PARA', nombre, ...parametros.map((p) => ':' + p)] };
          const definicion: Linea[] = [cabecera, { sangria: '  ', palabras: ['AVANZA', '20'] }, { sangria: '', palabras: ['FIN'] }];
          // La definición va entre dos instrucciones del programa principal, nunca dentro de otra.
          const cortes = [0];
          let nivel = 0;
          base.forEach((l, i) => {
            const primera = l.palabras[0]!;
            if (primera === 'PARA') nivel += 1;
            else if (primera === 'FIN') nivel -= 1;
            else if (l.palabras.at(-1) === '[') nivel += 1;
            else if (primera === ']') nivel -= 1;
            if (nivel === 0) cortes.push(i + 1);
          });
          const corte = cortes[donde % cortes.length]!;
          const lineas = [...base.slice(0, corte), ...definicion, ...base.slice(corte)];
          if (conLlamada) lineas.push({ sangria: '', palabras: [nombre, ...parametros.map(() => '10')] });

          const { programa, errores, tokens } = analizarTexto(aTexto(lineas), mundo);
          expect(programa).toBeNull();
          const avisos = errores.filter((e) => e.id === 'paraConParametros');
          expect(avisos).toHaveLength(1);
          expect(avisos[0]).toMatchObject({ linea: corte + 1, columna: columnaDe(cabecera, 2) });
          expect(firmasDeProcedimientos(tokens, mundo).map((f) => f.nombre)).not.toContain(nombre);
        },
      ),
      { numRuns: 200 },
    );
  });
});
