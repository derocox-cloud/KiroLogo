// Pruebas del conteo de instrucciones de KiroLogo
// Ejemplos del requisito 9 y la propiedad 11 (parte de conteo).

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { contarInstrucciones } from './conteo.js';
import type {
  Programa,
  Instruccion,
  InvocacionComando,
  NumeroLiteral,
  Repeticion,
  DefinicionProcedimiento,
  InvocacionProcedimiento,
} from './ast.js';
import { analizarLexico } from './lexer.js';
import { analizar } from './parser.js';
import { crearPrng } from '../azar/prng.js';
import { generarPrograma } from '../azar/generadores-prueba.test.js';

// ============================================================================
// Constructores de nodos para los ejemplos con nodos reservados
// ============================================================================

let contadorLinea = 0;
function pos() {
  contadorLinea += 1;
  return { linea: contadorLinea, columna: 1 };
}

function numero(valor: number): NumeroLiteral {
  return { tipo: 'numeroLiteral', valor, ...pos() };
}

function invocacion(nombre: string, ...args: NumeroLiteral[]): InvocacionComando {
  return { tipo: 'invocacionComando', nombre, argumentos: args, ...pos() };
}

function repite(veces: number, cuerpo: readonly Instruccion[]): Repeticion {
  return { tipo: 'repeticion', veces: numero(veces), cuerpo, ...pos() };
}

function programa(instrucciones: readonly Instruccion[]): Programa {
  return { tipo: 'programa', instrucciones };
}

// ============================================================================
// Ejemplos
// ============================================================================

describe('conteo', () => {
  describe('ejemplos del requisito 9', () => {
    it('programa vacío devuelve 0', () => {
      const r = contarInstrucciones(programa([]));
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(0);
    });

    it('REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10] devuelve 5', () => {
      // Equivalente al texto del requisito 9.7.
      const interior = repite(4, [invocacion('AVANZA', numero(100)), invocacion('GIRADERECHA', numero(90))]);
      const exterior = repite(36, [interior, invocacion('GIRADERECHA', numero(10))]);
      const r = contarInstrucciones(programa([exterior]));
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(5);
    });

    it('no multiplica por el número de iteraciones (0, 36 o expresión dan lo mismo)', () => {
      const cuerpo = [invocacion('AVANZA', numero(100)), invocacion('GIRADERECHA', numero(90))];
      const con0 = contarInstrucciones(programa([repite(0, cuerpo)]));
      const con36 = contarInstrucciones(programa([repite(36, cuerpo)]));
      expect(con0.exito && con36.exito).toBe(true);
      if (con0.exito && con36.exito) {
        expect(con0.instrucciones).toBe(3); // 1 (repite) + 2 (cuerpo)
        expect(con36.instrucciones).toBe(3);
      }
    });

    it('definición de CUADRADO con dos invocaciones devuelve 5', () => {
      // PARA CUADRADO: cuerpo REPITE 4 [AV 100 GD 90] (=3); + 2 invocaciones.
      const cuerpoCuadrado = [
        repite(4, [invocacion('AVANZA', numero(100)), invocacion('GIRADERECHA', numero(90))]),
      ];
      const definicion: DefinicionProcedimiento = {
        tipo: 'definicionProcedimiento',
        nombre: 'CUADRADO',
        parametros: [],
        cuerpo: cuerpoCuadrado,
        ...pos(),
      };
      const llamada1: InvocacionProcedimiento = { tipo: 'invocacionProcedimiento', nombre: 'CUADRADO', argumentos: [], ...pos() };
      const llamada2: InvocacionProcedimiento = { tipo: 'invocacionProcedimiento', nombre: 'CUADRADO', argumentos: [], ...pos() };

      const r = contarInstrucciones(programa([definicion, llamada1, llamada2]));
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(5); // 0 cabecera + 3 cuerpo + 1 + 1
    });

    it('cuenta el cuerpo de una definición aunque nunca se invoque', () => {
      const definicion: DefinicionProcedimiento = {
        tipo: 'definicionProcedimiento',
        nombre: 'TRIANGULO',
        parametros: [],
        cuerpo: [invocacion('AVANZA', numero(100)), invocacion('GIRADERECHA', numero(120))],
        ...pos(),
      };
      const r = contarInstrucciones(programa([definicion]));
      expect(r.exito && r.instrucciones === 2).toBe(true);
    });

    it('condicional de una rama cuenta 1 + su lista', () => {
      const cond: Instruccion = {
        tipo: 'condicionalUnaRama',
        condicion: numero(1),
        entonces: [invocacion('AVANZA', numero(100))],
        ...pos(),
      };
      const r = contarInstrucciones(programa([cond]));
      expect(r.exito && r.instrucciones === 2).toBe(true);
    });

    it('condicional de dos ramas cuenta 1 + las dos listas', () => {
      const cond: Instruccion = {
        tipo: 'condicionalDosRamas',
        condicion: numero(1),
        entonces: [invocacion('AVANZA', numero(100))],
        siNo: [invocacion('RETROCEDE', numero(50)), invocacion('CENTRO')],
        ...pos(),
      };
      const r = contarInstrucciones(programa([cond]));
      expect(r.exito && r.instrucciones === 4).toBe(true); // 1 + 1 + 2
    });

    it('interrupción y devolución de valor cuentan 1 cada una', () => {
      const alto: Instruccion = { tipo: 'interrupcion', ...pos() };
      const devuelve: Instruccion = { tipo: 'devolucionValor', valor: numero(10), ...pos() };
      const r = contarInstrucciones(programa([alto, devuelve]));
      expect(r.exito && r.instrucciones === 2).toBe(true);
    });
  });

  // ==========================================================================
  // Estabilidad frente a comentarios, líneas vacías y sangría (Req 9.5)
  // ==========================================================================

  describe('estabilidad frente al formato del texto', () => {
    function contarTexto(texto: string): number {
      const { tokens } = analizarLexico(texto);
      const { programa: prog } = analizar(tokens, { mundo: 0 });
      const r = contarInstrucciones(prog!);
      if (!r.exito) throw new Error('conteo falló');
      return r.instrucciones;
    }

    it('dos textos que difieren solo en formato dan el mismo entero', () => {
      const compacto = 'AVANZA 100 GIRADERECHA 90 CENTRO';
      const conFormato = '# figura\nAVANZA 100\n\n  GIRADERECHA 90   # giro\n\nCENTRO\n';
      expect(contarTexto(compacto)).toBe(contarTexto(conFormato));
      expect(contarTexto(compacto)).toBe(3);
    });
  });

  // ==========================================================================
  // Nodo desconocido (Req 9.10)
  // ==========================================================================

  describe('nodo desconocido', () => {
    it('reporta nodoDesconocidoEnConteo sin conteo parcial', () => {
      const nodoRaro = { tipo: 'nodoInventado', linea: 1, columna: 1 } as unknown as Instruccion;
      const r = contarInstrucciones(programa([invocacion('AVANZA', numero(100)), nodoRaro]));
      expect(r.exito).toBe(false);
      if (!r.exito) {
        expect(r.error.id).toBe('nodoDesconocidoEnConteo');
        expect(r.error.severidad).toBe('programacion');
      }
    });
  });

  // ==========================================================================
  // Rendimiento (Req 9.1): 200 instrucciones, 20 niveles, ≤ 50 ms
  // ==========================================================================

  describe('rendimiento', () => {
    it('cuenta 200 instrucciones con 20 niveles de anidación en ≤ 50 ms', () => {
      // Construir una repetición anidada 20 niveles con ~200 nodos en total.
      let cuerpo: readonly Instruccion[] = [
        invocacion('AVANZA', numero(100)),
        invocacion('GIRADERECHA', numero(90)),
      ];
      for (let nivel = 0; nivel < 20; nivel++) {
        const relleno: Instruccion[] = [];
        for (let i = 0; i < 8; i++) relleno.push(invocacion('AVANZA', numero(10)));
        cuerpo = [repite(4, cuerpo), ...relleno];
      }
      const prog = programa([...cuerpo]);

      const inicio = performance.now();
      const r = contarInstrucciones(prog);
      const duracion = performance.now() - inicio;

      expect(r.exito).toBe(true);
      expect(duracion).toBeLessThanOrEqual(50);
    });
  });

  // ==========================================================================
  // Property 11 (parte conteo): Estabilidad e inmutabilidad del conteo
  // Valida: Requisitos 9.1, 9.9
  // ==========================================================================

  describe('Property 11: estabilidad e inmutabilidad del conteo', () => {
    it('dos invocaciones sobre el mismo programa dan el mismo entero, sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const prog = generarPrograma(prng, 50);
          const r1 = contarInstrucciones(prog);
          const r2 = contarInstrucciones(prog);
          expect(r1.exito).toBe(true);
          expect(r2.exito).toBe(true);
          if (r1.exito && r2.exito) {
            expect(r1.instrucciones).toBe(r2.instrucciones);
            // Para el mundo 0, un programa es una lista plana de invocaciones:
            // el conteo es exactamente el número de instrucciones.
            expect(r1.instrucciones).toBe(prog.instrucciones.length);
          }
        }),
        { seed: 11, numRuns: 200 },
      );
    });

    it('no modifica el programa recibido, sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const prog = generarPrograma(prng, 50);
          const instantanea = JSON.stringify(prog);
          contarInstrucciones(prog);
          expect(JSON.stringify(prog)).toBe(instantanea);
        }),
        { seed: 12, numRuns: 200 },
      );
    });
  });
});
