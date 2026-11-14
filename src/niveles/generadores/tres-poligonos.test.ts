// Pruebas del generador `tres-poligonos-m4` (nivel 4.2).

import { describe, it, expect } from 'vitest';
import type { InvocacionProcedimiento, Programa } from '../../lenguaje/ast.js';
import { esAceptable } from './comun.js';
import { generarTresPoligonos } from './tres-poligonos.js';

function generar(semilla: number, intentosMaximos = 200) {
  return generarTresPoligonos({ semilla, parametros: {}, intentosMaximos });
}

function valor(e: unknown): number {
  return (e as { valor: number }).valor;
}

describe('generarTresPoligonos', () => {
  it('produce una definición y tres llamadas con lados distintos y mismo largo, aceptables', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const r = generar(semilla);
      expect(r.exito).toBe(true);
      if (!r.exito) continue;
      const p: Programa = r.referencia;
      expect(p.instrucciones).toHaveLength(4);
      expect(p.instrucciones[0]!.tipo).toBe('definicionProcedimiento');
      const llamadas = p.instrucciones.slice(1) as InvocacionProcedimiento[];
      expect(llamadas.every((l) => l.tipo === 'invocacionProcedimiento' && l.nombre === 'POLIGONO')).toBe(true);
      const lados = llamadas.map((l) => valor(l.argumentos[0]));
      const largos = llamadas.map((l) => valor(l.argumentos[1]));
      expect(new Set(lados).size).toBe(3);
      expect(lados.every((n) => n >= 3 && n <= 8)).toBe(true);
      expect(new Set(largos).size).toBe(1);
      expect(largos[0]! % 20).toBe(0);
      expect(largos[0]!).toBeGreaterThanOrEqual(40);
      expect(largos[0]!).toBeLessThanOrEqual(200);
      expect(esAceptable(p)).toBe(true);
    }
  });

  it('es determinista por semilla', () => {
    expect(generar(1234)).toEqual(generar(1234));
  });

  it('el giro es una expresión sin evaluar', () => {
    const r = generar(7);
    if (!r.exito) throw new Error('debía generar');
    const def = r.referencia.instrucciones[0] as unknown as { cuerpo: { cuerpo: { argumentos: { tipo: string }[] }[] }[] };
    expect(def.cuerpo[0]!.cuerpo[1]!.argumentos[0]!.tipo).toBe('expresionAritmetica');
  });

  it('sin intentos devuelve generadorSinCandidato sin lanzar', () => {
    const r = generar(1, 0);
    expect(r.exito).toBe(false);
  });
});
