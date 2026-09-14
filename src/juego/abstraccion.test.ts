// Pruebas del análisis de abstracción
// Las seis claves una por una sobre árboles con nodos reservados (16.3).

import { describe, it, expect } from 'vitest';
import { analizar } from './abstraccion.js';
import type {
  Programa,
  Instruccion,
  NumeroLiteral,
  ReferenciaParametro,
  Repeticion,
  DefinicionProcedimiento,
  InvocacionProcedimiento,
  InvocacionComando,
} from '../lenguaje/ast.js';
import type { ExigenciaAbstraccion } from '../niveles/tipos.js';

// ============================================================================
// Constructores de nodos
// ============================================================================

const P = { linea: 1, columna: 1 };
const num = (v: number): NumeroLiteral => ({ tipo: 'numeroLiteral', valor: v, ...P });
const ref = (n: string): ReferenciaParametro => ({ tipo: 'referenciaParametro', nombre: n, ...P });
const av = (v: number): InvocacionComando => ({ tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [num(v)], ...P });
const avRef = (n: string): InvocacionComando => ({ tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [ref(n)], ...P });
const repite = (cuerpo: readonly Instruccion[]): Repeticion => ({ tipo: 'repeticion', veces: num(4), cuerpo, ...P });
const llamar = (n: string): InvocacionProcedimiento => ({ tipo: 'invocacionProcedimiento', nombre: n, argumentos: [], ...P });
function definir(nombre: string, parametros: readonly string[], cuerpo: readonly Instruccion[]): DefinicionProcedimiento {
  return { tipo: 'definicionProcedimiento', nombre, parametros, cuerpo, ...P };
}
const prog = (instrucciones: readonly Instruccion[]): Programa => ({ tipo: 'programa', instrucciones });

function analizarClave(programa: Programa, clave: ExigenciaAbstraccion['clave'], maximo = 1): boolean {
  const exigencia: ExigenciaAbstraccion =
    clave === 'maximoProcedimientos' ? { clave, maximo } : { clave };
  return analizar(programa, [exigencia]).confirmadas.includes(clave);
}

// ============================================================================
// Las seis claves
// ============================================================================

describe('abstraccion · las seis claves', () => {
  it('usaRepite: confirma solo si hay una repetición', () => {
    expect(analizarClave(prog([repite([av(100)])]), 'usaRepite')).toBe(true);
    expect(analizarClave(prog([av(100)]), 'usaRepite')).toBe(false);
  });

  it('usaRepiteAnidado: confirma solo si una repetición contiene otra', () => {
    expect(analizarClave(prog([repite([repite([av(100)])])]), 'usaRepiteAnidado')).toBe(true);
    expect(analizarClave(prog([repite([av(100)]), repite([av(50)])]), 'usaRepiteAnidado')).toBe(false);
  });

  it('defineProcedimiento: confirma solo si hay una definición', () => {
    expect(analizarClave(prog([definir('CUADRADO', [], [av(100)])]), 'defineProcedimiento')).toBe(true);
    expect(analizarClave(prog([av(100)]), 'defineProcedimiento')).toBe(false);
  });

  it('usaParametros: exige declarar Y usar un parámetro de esa misma definición', () => {
    // Declara :lado y lo usa.
    expect(analizarClave(prog([definir('CUADRADO', ['lado'], [avRef('lado')])]), 'usaParametros')).toBe(true);
    // Declara :lado pero no lo usa.
    expect(analizarClave(prog([definir('CUADRADO', ['lado'], [av(100)])]), 'usaParametros')).toBe(false);
    // No declara parámetros.
    expect(analizarClave(prog([definir('CUADRADO', [], [av(100)])]), 'usaParametros')).toBe(false);
  });

  it('usaRecursion: confirma solo si el cuerpo se invoca a sí mismo', () => {
    expect(analizarClave(prog([definir('ESPIRAL', [], [av(10), llamar('ESPIRAL')])]), 'usaRecursion')).toBe(true);
    expect(analizarClave(prog([definir('CUADRADO', [], [av(100)]), llamar('CUADRADO')]), 'usaRecursion')).toBe(false);
  });

  it('maximoProcedimientos: es una cota superior', () => {
    const dos = prog([definir('A', [], [av(1)]), definir('B', [], [av(2)])]);
    expect(analizarClave(dos, 'maximoProcedimientos', 2)).toBe(true); // 2 ≤ 2
    expect(analizarClave(dos, 'maximoProcedimientos', 1)).toBe(false); // 2 > 1
    expect(analizarClave(prog([av(1)]), 'maximoProcedimientos', 1)).toBe(true); // 0 ≤ 1
  });
});

// ============================================================================
// Conjunto vacío y orden / determinismo
// ============================================================================

describe('abstraccion · conjunto vacío y orden', () => {
  it('el conjunto de exigencias vacío da confirmadas y sinConfirmar vacías', () => {
    const r = analizar(prog([av(100)]), []);
    expect(r.confirmadas).toEqual([]);
    expect(r.sinConfirmar).toEqual([]);
  });

  it('sinConfirmar respeta el orden en que el nivel declara las exigencias', () => {
    const exigencias: ExigenciaAbstraccion[] = [
      { clave: 'usaRepite' },
      { clave: 'defineProcedimiento' },
      { clave: 'usaRecursion' },
    ];
    // Programa que no cumple ninguna.
    const r = analizar(prog([av(100)]), exigencias);
    expect(r.sinConfirmar).toEqual(['usaRepite', 'defineProcedimiento', 'usaRecursion']);
  });

  it('dos AST iguales nodo por nodo dan el mismo resultado', () => {
    const a = prog([definir('CUADRADO', ['lado'], [avRef('lado')])]);
    const b = prog([definir('CUADRADO', ['lado'], [avRef('lado')])]);
    const exigencias: ExigenciaAbstraccion[] = [{ clave: 'defineProcedimiento' }, { clave: 'usaParametros' }];
    expect(analizar(a, exigencias)).toEqual(analizar(b, exigencias));
  });
});
