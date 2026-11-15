import { describe, it, expect } from 'vitest';
import { generarEstrellaParametrica } from './estrella-parametrica.js';
import { esAceptable } from './comun.js';
import { imprimir } from '../../lenguaje/impresor.js';

describe('generarEstrellaParametrica', () => {
  it('es determinista y produce estrellas aceptables con la forma esperada', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const a = generarEstrellaParametrica({ semilla, intentosMaximos: 200, parametros: {} } as never);
      const b = generarEstrellaParametrica({ semilla, intentosMaximos: 200, parametros: {} } as never);
      expect(a).toEqual(b);
      expect(a.exito).toBe(true);
      if (!a.exito) continue;
      expect(esAceptable(a.referencia)).toBe(true);
      const [def, llam] = a.referencia.instrucciones;
      expect(def?.tipo).toBe('definicionProcedimiento');
      expect(llam?.tipo).toBe('invocacionProcedimiento');
      if (llam?.tipo !== 'invocacionProcedimiento') continue;
      const [p, l] = llam.argumentos;
      expect([5, 7, 9, 11]).toContain(p?.tipo === 'numeroLiteral' ? p.valor : -1);
      expect(l?.tipo === 'numeroLiteral' ? l.valor % 20 : -1).toBe(0);
    }
  });

  it('imprime el giro como 360 * 2 / :puntas', () => {
    const r = generarEstrellaParametrica({ semilla: 1, intentosMaximos: 200, parametros: {} } as never);
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    const texto = imprimir(r.referencia);
    expect(texto.exito).toBe(true);
    if (texto.exito) expect(texto.texto).toContain('GIRADERECHA 360 * 2 / :puntas');
  });
});
