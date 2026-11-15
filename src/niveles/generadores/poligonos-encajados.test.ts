// Pruebas del generador `poligonos-encajados-m4` (nivel 4.3).

import { describe, it, expect } from 'vitest';
import type { InvocacionProcedimiento, Programa } from '../../lenguaje/ast.js';
import { esAceptable } from './comun.js';
import { generarPoligonosEncajados } from './poligonos-encajados.js';

function generar(semilla: number, intentosMaximos = 200) {
  return generarPoligonosEncajados({ semilla, parametros: {}, intentosMaximos });
}

function valor(e: unknown): number {
  return (e as { valor: number }).valor;
}

describe('generarPoligonosEncajados', () => {
  it('produce una definición y de 3 a 5 llamadas con mismos lados y largo creciente de 20 en 20', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const r = generar(semilla);
      expect(r.exito).toBe(true);
      if (!r.exito) continue;
      const p: Programa = r.referencia;
      expect(p.instrucciones[0]!.tipo).toBe('definicionProcedimiento');
      const llamadas = p.instrucciones.slice(1) as InvocacionProcedimiento[];
      expect(llamadas.length).toBeGreaterThanOrEqual(3);
      expect(llamadas.length).toBeLessThanOrEqual(5);
      expect(llamadas.every((l) => l.tipo === 'invocacionProcedimiento' && l.nombre === 'POLIGONO')).toBe(true);
      const lados = llamadas.map((l) => valor(l.argumentos[0]));
      const largos = llamadas.map((l) => valor(l.argumentos[1]));
      expect(new Set(lados).size).toBe(1);
      expect(lados[0]!).toBeGreaterThanOrEqual(3);
      expect(lados[0]!).toBeLessThanOrEqual(8);
      expect(largos[0]! % 20).toBe(0);
      expect(largos[0]!).toBeGreaterThanOrEqual(40);
      largos.forEach((l, k) => expect(l).toBe(largos[0]! + 20 * k));
      expect(largos[largos.length - 1]!).toBeLessThanOrEqual(200);
      expect(esAceptable(p)).toBe(true);
    }
  });

  it('es determinista por semilla', () => {
    expect(generar(1234)).toEqual(generar(1234));
  });

  it('sin intentos devuelve generadorSinCandidato sin lanzar', () => {
    expect(generar(1, 0).exito).toBe(false);
  });
});
