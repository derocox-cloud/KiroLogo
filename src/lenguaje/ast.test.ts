// Pruebas de los nodos del AST de procedimientos (mundo 2 · composición).
// Estas pruebas NO modifican ast.ts: solo confirman la forma de los nodos
// DefinicionProcedimiento e InvocacionProcedimiento y su pertenencia a la
// unión Instruccion. Al construir objetos literales bajo modo estricto, las
// pruebas valen a la vez como verificación en tiempo de compilación.

import { describe, it, expect } from 'vitest';
import type {
  Instruccion,
  NumeroLiteral,
  InvocacionComando,
  DefinicionProcedimiento,
  InvocacionProcedimiento,
} from './ast.js';

// ============================================================================
// Nodos auxiliares para construir cuerpos y argumentos
// ============================================================================

function numero(valor: number): NumeroLiteral {
  return { tipo: 'numeroLiteral', valor, linea: 1, columna: 1 };
}

function invocacion(nombre: string, ...args: NumeroLiteral[]): InvocacionComando {
  return { tipo: 'invocacionComando', nombre, argumentos: args, linea: 1, columna: 1 };
}

describe('AST · nodos de procedimientos', () => {
  // ==========================================================================
  // DefinicionProcedimiento
  // ==========================================================================

  describe('DefinicionProcedimiento', () => {
    it('tiene tipo, nombre, parametros, cuerpo y los campos de NodoBase', () => {
      const cuerpo: readonly Instruccion[] = [
        invocacion('AVANZA', numero(100)),
        invocacion('GIRADERECHA', numero(90)),
      ];
      const definicion: DefinicionProcedimiento = {
        tipo: 'definicionProcedimiento',
        nombre: 'CUADRADO',
        parametros: [],
        cuerpo,
        linea: 3,
        columna: 5,
      };

      expect(definicion.tipo).toBe('definicionProcedimiento');
      expect(definicion.nombre).toBe('CUADRADO');
      expect(definicion.parametros).toEqual([]);
      expect(definicion.cuerpo).toHaveLength(2);
      expect(definicion.linea).toBe(3);
      expect(definicion.columna).toBe(5);
    });

    it('en el mundo 2 parametros es siempre la lista vacía', () => {
      const definicion: DefinicionProcedimiento = {
        tipo: 'definicionProcedimiento',
        nombre: 'TRIANGULO',
        parametros: [],
        cuerpo: [],
        linea: 1,
        columna: 1,
      };
      expect(definicion.parametros).toHaveLength(0);
    });

    it('es asignable a la unión Instruccion', () => {
      const definicion: DefinicionProcedimiento = {
        tipo: 'definicionProcedimiento',
        nombre: 'ESTRELLA',
        parametros: [],
        cuerpo: [invocacion('AVANZA', numero(50))],
        linea: 2,
        columna: 1,
      };
      const comoInstruccion: Instruccion = definicion;
      expect(comoInstruccion.tipo).toBe('definicionProcedimiento');
    });
  });

  // ==========================================================================
  // InvocacionProcedimiento
  // ==========================================================================

  describe('InvocacionProcedimiento', () => {
    it('tiene tipo, nombre, argumentos y los campos de NodoBase', () => {
      const invocacionProc: InvocacionProcedimiento = {
        tipo: 'invocacionProcedimiento',
        nombre: 'CUADRADO',
        argumentos: [],
        linea: 8,
        columna: 1,
      };

      expect(invocacionProc.tipo).toBe('invocacionProcedimiento');
      expect(invocacionProc.nombre).toBe('CUADRADO');
      expect(invocacionProc.argumentos).toEqual([]);
      expect(invocacionProc.linea).toBe(8);
      expect(invocacionProc.columna).toBe(1);
    });

    it('en el mundo 2 argumentos es siempre la lista vacía', () => {
      const invocacionProc: InvocacionProcedimiento = {
        tipo: 'invocacionProcedimiento',
        nombre: 'TRIANGULO',
        argumentos: [],
        linea: 1,
        columna: 1,
      };
      expect(invocacionProc.argumentos).toHaveLength(0);
    });

    it('es asignable a la unión Instruccion', () => {
      const invocacionProc: InvocacionProcedimiento = {
        tipo: 'invocacionProcedimiento',
        nombre: 'ESTRELLA',
        argumentos: [],
        linea: 2,
        columna: 1,
      };
      const comoInstruccion: Instruccion = invocacionProc;
      expect(comoInstruccion.tipo).toBe('invocacionProcedimiento');
    });
  });

  // ==========================================================================
  // Discriminación por 'tipo' sobre la unión Instruccion
  // ==========================================================================

  describe('discriminación de la unión Instruccion', () => {
    it('el campo tipo distingue definición de invocación en una lista', () => {
      const instrucciones: readonly Instruccion[] = [
        {
          tipo: 'definicionProcedimiento',
          nombre: 'CUADRADO',
          parametros: [],
          cuerpo: [invocacion('AVANZA', numero(100))],
          linea: 1,
          columna: 1,
        },
        { tipo: 'invocacionProcedimiento', nombre: 'CUADRADO', argumentos: [], linea: 2, columna: 1 },
      ];

      const tipos = instrucciones.map((i) => i.tipo);
      expect(tipos).toEqual(['definicionProcedimiento', 'invocacionProcedimiento']);
    });
  });
});
