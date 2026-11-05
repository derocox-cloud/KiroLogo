// Pruebas de los niveles del mundo 3 (rosetones).
//
// Verifican lo que NO depende del catálogo (tarea 7): el presupuesto de los
// niveles autorados sale del Conteo sobre su referencia (nunca a mano, R4.2,
// R4.6), la referencia del mandala (3.4) se ejecuta hasta el final sin activar
// la guarda de 200 000 pasos (R4.4), y los cuatro niveles declaran normalización
// fija (R3.5) y la exigencia de abstracción `usaRepiteAnidado` (R4.5, R6.1).

import { describe, it, expect } from 'vitest';
import {
  REFERENCIA_3_1,
  REFERENCIA_3_4,
  NIVEL_3_1,
  NIVEL_3_2,
  NIVEL_3_3,
  NIVEL_3_4,
  MUNDO_3,
} from './mundo-3-rosetones.js';
import type { Nivel } from './tipos.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';

// ============================================================================
// Property 6 · el presupuesto es el conteo de la referencia (R4.2, R4.6)
// ============================================================================

describe('mundo 3 · Property 6: el presupuesto autorado es el conteo de la referencia', () => {
  // Validates: Requirements 4.2, 4.6
  it('la referencia 3.1 (rosetón de 36 cuadrados) cuenta 5 instrucciones', () => {
    // REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]:
    //   externo (1) + [ interno (1 + AV(1) + GD(1) = 3) + GD(1) ] = 1 + 4 = 5.
    const c = contarInstrucciones(REFERENCIA_3_1);
    expect(c.exito).toBe(true);
    if (c.exito) expect(c.instrucciones).toBe(5);
  });

  it('la referencia 3.4 (mandala) parsea sin error y su conteo es un entero positivo', () => {
    const c = contarInstrucciones(REFERENCIA_3_4);
    expect(c.exito).toBe(true);
    if (c.exito) {
      expect(Number.isInteger(c.instrucciones)).toBe(true);
      expect(c.instrucciones).toBeGreaterThan(0);
    }
  });

  it('ningún nivel autorado escribe un número de presupuesto a mano', () => {
    // El tipo Nivel no tiene campo de presupuesto: lo deriva resolverReto por el
    // Conteo. Esta aserción documenta esa invariante estructural.
    for (const nivel of [NIVEL_3_1, NIVEL_3_4]) {
      expect(nivel.origen.tipo).toBe('autorado');
      expect('presupuesto' in nivel).toBe(false);
      expect('presupuestoEstrella' in nivel).toBe(false);
    }
  });
});

// ============================================================================
// R4.4 · la referencia del mandala no activa la guarda de 200 000 pasos
// ============================================================================

describe('mundo 3 · la referencia del mandala (3.4) termina sin activar la guarda', () => {
  // Validates: Requirements 4.4
  it('ejecuta hasta el final: guardaActivada null y sin error', () => {
    const permitidos = comandosDelMundo(3);
    const generador = ejecutar(REFERENCIA_3_4, {
      estadoInicial: ESTADO_INICIAL,
      comandosPermitidos: permitidos,
      semilla: 304,
    });
    let paso = generador.next();
    while (!paso.done) paso = generador.next();
    const resultado = paso.value;

    expect(resultado.guardaActivada).toBeNull();
    expect(resultado.error).toBeNull();
    // 8 · 6 · 90 = 4320 avances (más sus giros): muy por debajo de 200 000 pasos.
    expect(resultado.operaciones.length).toBeLessThan(200_000);
    expect(resultado.operaciones.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// R3.5, R4.5, R6.1 · normalización fija y usaRepiteAnidado en los cuatro
// ============================================================================

describe('mundo 3 · los cuatro niveles declaran normalización fija y usaRepiteAnidado', () => {
  const niveles: readonly Nivel[] = [NIVEL_3_1, NIVEL_3_2, NIVEL_3_3, NIVEL_3_4];

  it('MUNDO_3 son exactamente los cuatro niveles 3.1..3.4 en orden', () => {
    expect(MUNDO_3).toEqual([NIVEL_3_1, NIVEL_3_2, NIVEL_3_3, NIVEL_3_4]);
    expect(MUNDO_3.map((n) => n.id)).toEqual(['3.1', '3.2', '3.3', '3.4']);
  });

  it('cada nivel es del mundo 3 y enseña simetría', () => {
    for (const nivel of niveles) {
      expect(nivel.mundo).toBe(3);
      expect(nivel.concepto).toBe('simetria');
    }
  });

  it('cada nivel declara traslación fija, rotación fija y escala exacta (R3.5)', () => {
    for (const nivel of niveles) {
      expect(nivel.normalizacion).toEqual({ traslacion: 'fija', rotacion: 'fija', escala: 'exacta' });
    }
  });

  it('cada nivel exige usaRepiteAnidado para la estrella de abstracción (R4.5, R6.1)', () => {
    for (const nivel of niveles) {
      expect(nivel.abstraccion).toEqual([{ clave: 'usaRepiteAnidado' }]);
    }
  });

  it('ningún nivel declara margenLimiteDuro (rige el margen por omisión, 3)', () => {
    for (const nivel of niveles) {
      expect(nivel.margenLimiteDuro).toBeUndefined();
    }
  });

  it('3.1 y 3.4 son autorados; 3.2 y 3.3 generados (roseton-m3 y flor-m3)', () => {
    expect(NIVEL_3_1.origen.tipo).toBe('autorado');
    expect(NIVEL_3_4.origen.tipo).toBe('autorado');
    expect(NIVEL_3_2.origen).toMatchObject({ tipo: 'generado', idGenerador: 'roseton-m3' });
    expect(NIVEL_3_3.origen).toMatchObject({ tipo: 'generado', idGenerador: 'flor-m3' });
  });

  it('cada nivel advierte en sus pistas que la posición y el rumbo de partida importan (R3.6)', () => {
    for (const nivel of niveles) {
      expect(nivel.pistas).toHaveLength(3);
      const texto = nivel.pistas.join(' ').toLowerCase();
      expect(texto).toContain('posición');
      expect(texto).toContain('rumbo');
    }
  });
});
