// Property 14 (spec 05): el texto no cambia la geometría ni la comparación.
//
// A un programa válido del mundo 4 se le insertan instrucciones `ESCRIBE` y `ROTULA` en
// huecos al azar: el programa principal, los cuerpos de `REPITE` y los de `PARA`. Del
// mismo plan salen dos variantes: una con el texto y otra con `GIRADERECHA 0` en su lugar.
// El giro nulo ocupa un paso y no toca el estado, así que alinea las dos ejecuciones
// operación por operación: donde una tiene el giro, la otra debe tener exactamente una
// operación de texto con la misma línea, profundidad, llamada y estado. Un prefijo opcional
// sube el lápiz o saca a la tortuga del lienzo para cubrir rótulos con el lápiz arriba y
// fuera del área visible.
//
// El archivo lleva el nombre de `divergencia.ts` porque es lo que más ejercita, pero
// también compara la extracción de segmentos y el veredicto del validador.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ejecutar, type Operacion, type ResultadoEjecucion } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import type { Expresion, Instruccion, Programa } from '../lenguaje/ast.js';
import { fabricaAzar } from '../azar/prng.js';
import { arbNumeroLiteral, arbPrograma } from '../pruebas/arbitrarios.js';
import { ESTADO_INICIAL } from './tortuga.js';
import { extraerSegmentos, type Segmento } from './segmentos.js';
import { validar, type NormalizacionNivel, type Veredicto } from './validador.js';
import { compararOperaciones, divergen, operacionesComparables } from './divergencia.js';

const PERMITIDOS = comandosDelMundo(4);
const POSICION = { linea: 1, columna: 1 } as const;
// Las líneas de las instrucciones insertadas empiezan aquí; las del programa generado valen 1.
const PRIMERA_LINEA_INSERTADA = 1_000;

const numero = (valor: number): Expresion => ({ tipo: 'numeroLiteral', valor, ...POSICION });
const comando = (nombre: string, argumentos: readonly Expresion[], linea = 1): Instruccion => ({
  tipo: 'invocacionComando', nombre, argumentos, linea, columna: 1,
});

function correr(programa: Programa, semilla: number): ResultadoEjecucion {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL, comandosPermitidos: PERMITIDOS, semilla, fabricaAzar,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

// ----------------------------------------------------------------------------
// Inserción de texto
// ----------------------------------------------------------------------------

type NombreTexto = 'ESCRIBE' | 'ROTULA';

interface Insercion {
  readonly hueco: number;
  readonly nombre: NombreTexto;
  readonly valor: Expresion;
}

const arbPalabra: fc.Arbitrary<Expresion> = fc
  .stringMatching(/^[a-zA-Z]{1,8}$/)
  .map((valor): Expresion => ({ tipo: 'palabraLiteral', valor, ...POSICION }));

const arbInsercion: fc.Arbitrary<Insercion> = fc.record({
  hueco: fc.nat(),
  nombre: fc.constantFrom<NombreTexto>('ESCRIBE', 'ROTULA'),
  valor: fc.oneof(arbPalabra, arbNumeroLiteral),
});

/**
 * Recorre las listas de instrucciones en preorden y, en cada hueco (antes de cada
 * instrucción y al final de la lista), pone lo que el plan asigne a ese número de hueco.
 */
function insertar(
  instrucciones: readonly Instruccion[],
  plan: ReadonlyMap<number, readonly Instruccion[]>,
  contador: { n: number },
): Instruccion[] {
  const salida: Instruccion[] = [];
  for (let i = 0; i <= instrucciones.length; i++) {
    salida.push(...(plan.get(contador.n) ?? []));
    contador.n += 1;
    if (i === instrucciones.length) break;
    const instruccion = instrucciones[i]!;
    if (instruccion.tipo === 'repeticion' || instruccion.tipo === 'definicionProcedimiento') {
      salida.push({ ...instruccion, cuerpo: insertar(instruccion.cuerpo, plan, contador) });
    } else {
      salida.push(instruccion);
    }
  }
  return salida;
}

function contarHuecos(programa: Programa): number {
  const contador = { n: 0 };
  insertar(programa.instrucciones, new Map(), contador);
  return contador.n;
}

/** Arma el programa con el prefijo y, en cada hueco, la instrucción que da `fabricar`. */
function variante(
  base: Programa,
  prefijo: readonly Instruccion[],
  inserciones: readonly Insercion[],
  fabricar: (insercion: Insercion, linea: number) => Instruccion,
): Programa {
  const huecos = contarHuecos(base);
  const plan = new Map<number, Instruccion[]>();
  inserciones.forEach((ins, i) => {
    const hueco = ins.hueco % huecos;
    plan.set(hueco, [...(plan.get(hueco) ?? []), fabricar(ins, PRIMERA_LINEA_INSERTADA + i)]);
  });
  return { tipo: 'programa', instrucciones: [...prefijo, ...insertar(base.instrucciones, plan, { n: 0 })] };
}

const conTexto = (ins: Insercion, linea: number): Instruccion => comando(ins.nombre, [ins.valor], linea);
const conGiroNulo = (_ins: Insercion, linea: number): Instruccion => comando('GIRADERECHA', [numero(0)], linea);

// Ninguno, lápiz arriba, lápiz arriba fuera del lienzo y lápiz abajo fuera del lienzo.
const arbPrefijo: fc.Arbitrary<readonly Instruccion[]> = fc.constantFrom(
  [],
  [comando('SUBELAPIZ', [])],
  [comando('SUBELAPIZ', []), comando('AVANZA', [numero(600)])],
  [comando('SUBELAPIZ', []), comando('AVANZA', [numero(600)]), comando('BAJALAPIZ', [])],
);

interface Caso {
  readonly base: Programa;
  readonly prefijo: readonly Instruccion[];
  readonly inserciones: readonly Insercion[];
  readonly otro: Programa;
  readonly semilla: number;
}

const arbCaso: fc.Arbitrary<Caso> = fc.record({
  base: arbPrograma(4),
  prefijo: arbPrefijo,
  inserciones: fc.array(arbInsercion, { minLength: 1, maxLength: 6 }),
  otro: arbPrograma(4),
  semilla: fc.nat(),
});

interface Ejecuciones {
  readonly sinTexto: ResultadoEjecucion;
  readonly texto: ResultadoEjecucion;
  readonly giroNulo: ResultadoEjecucion;
  readonly otro: ResultadoEjecucion;
}

function ejecutarCaso(caso: Caso): Ejecuciones {
  const sinInsertar: Programa = { tipo: 'programa', instrucciones: [...caso.prefijo, ...caso.base.instrucciones] };
  return {
    sinTexto: correr(sinInsertar, caso.semilla),
    texto: correr(variante(caso.base, caso.prefijo, caso.inserciones, conTexto), caso.semilla),
    giroNulo: correr(variante(caso.base, caso.prefijo, caso.inserciones, conGiroNulo), caso.semilla),
    otro: correr(caso.otro, caso.semilla),
  };
}

// El `paso` de un segmento apunta a la operación que lo produjo, así que se corre con cada
// operación insertada antes que él. La geometría y la línea de origen no cambian.
const geometria = (segmentos: readonly Segmento[]) =>
  segmentos.map(({ desde, hasta, linea }) => ({ desde, hasta, linea }));

/** Oráculo del orden de separación: primera operación de tortuga que difiere, o la corta + 1. */
function ordenEsperado(a: readonly Operacion[], b: readonly Operacion[]): number | null {
  const ta = a.filter((o) => o.tipo !== 'escribir' && o.tipo !== 'rotular');
  const tb = b.filter((o) => o.tipo !== 'escribir' && o.tipo !== 'rotular');
  const minimo = Math.min(ta.length, tb.length);
  for (let i = 0; i < minimo; i++) if (divergen(ta[i]!, tb[i]!)) return i + 1;
  return ta.length === tb.length ? null : minimo + 1;
}

describe('Property 14: el texto no cambia la geometría ni la comparación', () => {
  it('cada texto emite una operación con su línea y profundidad, sin tocar posición, rumbo ni lápiz', () => {
    // **Validates: Requirements 9.4, 9.5, 11.2, 11.3, 11.4, 11.12**
    let insertadasEjecutadas = 0;
    fc.assert(
      fc.property(arbCaso, (caso) => {
        const { sinTexto, texto, giroNulo } = ejecutarCaso(caso);
        // Con texto de más, la guarda de escrituras puede cortar antes que en la variante sin texto.
        fc.pre(texto.guardaActivada !== 'escrituras');

        expect(texto.guardaActivada).toBe(giroNulo.guardaActivada);
        expect(texto.error).toEqual(giroNulo.error);
        expect(texto.operaciones).toHaveLength(giroNulo.operaciones.length);

        giroNulo.operaciones.forEach((neutra, i) => {
          const op = texto.operaciones[i]!;
          if (neutra.linea < PRIMERA_LINEA_INSERTADA) {
            expect(op).toEqual(neutra);
            return;
          }
          const insercion = caso.inserciones[neutra.linea - PRIMERA_LINEA_INSERTADA]!;
          expect(op.tipo).toBe(insercion.nombre === 'ESCRIBE' ? 'escribir' : 'rotular');
          expect(op.paso).toBe(neutra.paso);
          expect(op.linea).toBe(neutra.linea);
          expect(op.profundidad).toBe(neutra.profundidad);
          expect(op.lineaLlamada).toBe(neutra.lineaLlamada);
          expect(op.estadoAntes).toEqual(neutra.estadoAntes);
          expect(op.estadoDespues).toEqual(op.estadoAntes);
          if (op.tipo === 'rotular') expect(op.posicion).toEqual(op.estadoAntes.posicion);
        });

        // Una sola operación por instrucción de texto ejecutada, ni más ni menos.
        const esTexto = (o: Operacion) => o.tipo === 'escribir' || o.tipo === 'rotular';
        const insertadas = giroNulo.operaciones.filter((o) => o.linea >= PRIMERA_LINEA_INSERTADA).length;
        if (texto.error === null && sinTexto.error === null) {
          expect(texto.operaciones.filter(esTexto).length).toBe(sinTexto.operaciones.filter(esTexto).length + insertadas);
        }
        insertadasEjecutadas += insertadas;
      }),
      { numRuns: 200 },
    );
    // Si ninguna inserción llegara a ejecutarse, la propiedad no habría probado nada.
    expect(insertadasEjecutadas).toBeGreaterThan(0);
  });

  it('los segmentos y la comparación con cualquier otro recorrido son los del programa sin texto', () => {
    // **Validates: Requirements 9.11, 9.12, 11.8, 25.7**
    fc.assert(
      fc.property(arbCaso, (caso) => {
        const { sinTexto, texto, otro } = ejecutarCaso(caso);
        fc.pre(texto.guardaActivada !== 'escrituras');

        expect(geometria(extraerSegmentos(texto.operaciones))).toEqual(
          geometria(extraerSegmentos(sinTexto.operaciones)),
        );
        expect(operacionesComparables(texto.operaciones).length).toBe(
          operacionesComparables(sinTexto.operaciones).length,
        );

        // Contra sí mismo sin texto no hay separación.
        const consigo = compararOperaciones(sinTexto.operaciones, texto.operaciones);
        expect(consigo.divergencia).toBeNull();
        expect(consigo.ordenSeparacion).toBeNull();

        // Contra otro recorrido, en los dos papeles, el resultado no cambia.
        expect(compararOperaciones(otro.operaciones, texto.operaciones)).toEqual(
          compararOperaciones(otro.operaciones, sinTexto.operaciones),
        );
        expect(compararOperaciones(texto.operaciones, otro.operaciones)).toEqual(
          compararOperaciones(sinTexto.operaciones, otro.operaciones),
        );

        // El orden de separación cuenta desde 1 sobre las operaciones de tortuga.
        const r = compararOperaciones(otro.operaciones, texto.operaciones);
        expect(r.ordenSeparacion).toBe(ordenEsperado(otro.operaciones, texto.operaciones));
        if (r.divergencia !== null) expect(r.divergencia.orden).toBe(r.ordenSeparacion);
      }),
      { numRuns: 200 },
    );
  });

  // El validador rasteriza y dilata dos máscaras de 800 × 800 por llamada, y con rotación
  // libre además barre ángulos. Cada corrida valida cuatro veces, así que van pocas
  // corridas con un tiempo propio, holgado para la suite en paralelo.
  const TIEMPO_VALIDADOR = 120_000;
  // `toEqual` recorre cada máscara de 640 000 posiciones elemento a elemento y tarda segundos:
  // las máscaras se comparan byte a byte y el resto de los campos con `toEqual`.
  function mismosBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function esperarMismoVeredicto(a: Veredicto, b: Veredicto): void {
    const escalares = (v: Veredicto) =>
      Object.fromEntries(Object.entries(v).filter(([, valor]) => !(valor instanceof Uint8Array)));
    expect(escalares(a)).toEqual(escalares(b));
    for (const [clave, valor] of Object.entries(a)) {
      if (!(valor instanceof Uint8Array)) continue;
      const otra = (b as unknown as Record<string, unknown>)[clave];
      expect(otra instanceof Uint8Array && mismosBytes(valor, otra), clave).toBe(true);
    }
  }

  const veredictoIgual = (rotacion: NormalizacionNivel['rotacion'], numRuns: number) => () => {
    fc.assert(
      fc.property(arbCaso, fc.constantFrom<NormalizacionNivel['traslacion']>('libre', 'fija'), (caso, traslacion) => {
        const normalizacion: NormalizacionNivel = { traslacion, rotacion, escala: 'exacta' };
        const { sinTexto, texto, otro } = ejecutarCaso(caso);
        fc.pre(texto.guardaActivada !== 'escrituras');
        const segSin = extraerSegmentos(sinTexto.operaciones);
        const segCon = extraerSegmentos(texto.operaciones);
        const segOtro = extraerSegmentos(otro.operaciones);

        esperarMismoVeredicto(validar(segCon, segOtro, normalizacion), validar(segSin, segOtro, normalizacion));
        esperarMismoVeredicto(validar(segOtro, segCon, normalizacion), validar(segOtro, segSin, normalizacion));
      }),
      { numRuns },
    );
  };

  it(
    'el veredicto del validador es el mismo con y sin texto, como jugador y como objetivo',
    // **Validates: Requirements 11.8**
    veredictoIgual('fija', 25),
    TIEMPO_VALIDADOR,
  );

  it(
    'con rotación libre el veredicto tampoco cambia',
    // **Validates: Requirements 11.8**
    // El barrido de ángulos encarece cada validación: menos corridas cubren la rama.
    veredictoIgual('libre', 10),
    TIEMPO_VALIDADOR,
  );
});
