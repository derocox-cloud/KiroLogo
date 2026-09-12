// Pruebas de la extracción de segmentos
// Ejemplos del requisito 15 (1–3, 8) y la Property 16 parte A.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { extraerSegmentos } from './segmentos.js';
import type { Operacion } from '../lenguaje/interprete.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { ESTADO_INICIAL, type EstadoTortuga } from './tortuga.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { crearPrng } from '../azar/prng.js';
import { generarPrograma } from '../azar/generadores-prueba.test.js';

// ============================================================================
// Constructores de operaciones para los ejemplos
// ============================================================================

const E: EstadoTortuga = ESTADO_INICIAL;

function mover(paso: number, linea: number, desde: { x: number; y: number }, hasta: { x: number; y: number }, lapizAbajo: boolean): Operacion {
  return {
    tipo: 'mover',
    paso,
    linea,
    profundidad: 0,
    estadoAntes: { ...E, posicion: desde },
    estadoDespues: { ...E, posicion: hasta },
    desde,
    hasta,
    lapizAbajo,
  };
}

function girarOp(paso: number, linea: number): Operacion {
  return { tipo: 'girar', paso, linea, profundidad: 0, estadoAntes: E, estadoDespues: E, grados: 90, sentido: 'derecha' };
}

function limpiarOp(paso: number, linea: number): Operacion {
  return { tipo: 'limpiar', paso, linea, profundidad: 0, estadoAntes: E, estadoDespues: E };
}

// ============================================================================
// Ejemplos
// ============================================================================

describe('segmentos', () => {
  describe('inclusión y exclusión', () => {
    it('un mover con lápiz abajo aporta un segmento con sus puntos, paso y línea', () => {
      const ops = [mover(0, 1, { x: 0, y: 0 }, { x: 0, y: 100 }, true)];
      const segs = extraerSegmentos(ops);
      expect(segs).toHaveLength(1);
      expect(segs[0]).toEqual({ desde: { x: 0, y: 0 }, hasta: { x: 0, y: 100 }, paso: 0, linea: 1 });
    });

    it('un mover con lápiz arriba no aporta segmento', () => {
      const ops = [mover(0, 1, { x: 0, y: 0 }, { x: 0, y: 100 }, false)];
      expect(extraerSegmentos(ops)).toHaveLength(0);
    });

    it('un mover de longitud menor que 0.0001 no aporta segmento', () => {
      const ops = [mover(0, 1, { x: 0, y: 0 }, { x: 0.00005, y: 0 }, true)];
      expect(extraerSegmentos(ops)).toHaveLength(0);
    });

    it('girar, reubicar, lapiz y visibilidad no aportan segmentos', () => {
      const ops: Operacion[] = [
        girarOp(0, 1),
        { tipo: 'reubicar', paso: 1, linea: 2, profundidad: 0, estadoAntes: E, estadoDespues: E },
        { tipo: 'lapiz', paso: 2, linea: 3, profundidad: 0, estadoAntes: E, estadoDespues: E, lapizAbajo: false },
        { tipo: 'visibilidad', paso: 3, linea: 4, profundidad: 0, estadoAntes: E, estadoDespues: E, visible: false },
      ];
      expect(extraerSegmentos(ops)).toHaveLength(0);
    });

    it('no recorta los puntos fuera del cuadrado ni los redondea', () => {
      const ops = [mover(0, 1, { x: -500.25, y: 0 }, { x: 900.75, y: -0.5 }, true)];
      const segs = extraerSegmentos(ops);
      expect(segs[0]!.desde).toEqual({ x: -500.25, y: 0 });
      expect(segs[0]!.hasta).toEqual({ x: 900.75, y: -0.5 });
    });
  });

  // ==========================================================================
  // Efecto de limpiar (Req 15.3)
  // ==========================================================================

  describe('limpiar', () => {
    it('descarta los segmentos acumulados y conserva paso y línea de los posteriores', () => {
      const ops = [
        mover(0, 1, { x: 0, y: 0 }, { x: 0, y: 100 }, true),
        limpiarOp(1, 2),
        mover(2, 3, { x: 0, y: 0 }, { x: 100, y: 0 }, true),
      ];
      const segs = extraerSegmentos(ops);
      expect(segs).toHaveLength(1);
      // Conserva paso 2 y línea 3, sin renumerar desde 0.
      expect(segs[0]!.paso).toBe(2);
      expect(segs[0]!.linea).toBe(3);
    });

    it('con varios limpiar conserva solo lo posterior al último', () => {
      const ops = [
        mover(0, 1, { x: 0, y: 0 }, { x: 0, y: 100 }, true),
        limpiarOp(1, 2),
        mover(2, 3, { x: 0, y: 0 }, { x: 50, y: 0 }, true),
        limpiarOp(3, 4),
        mover(4, 5, { x: 0, y: 0 }, { x: 0, y: 60 }, true),
      ];
      const segs = extraerSegmentos(ops);
      expect(segs).toHaveLength(1);
      expect(segs[0]!.paso).toBe(4);
    });

    it('un limpiar final sin movimientos posteriores produce lista vacía', () => {
      const ops = [
        mover(0, 1, { x: 0, y: 0 }, { x: 0, y: 100 }, true),
        limpiarOp(1, 2),
      ];
      expect(extraerSegmentos(ops)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Lista vacía e inmutabilidad (Req 15.1, 15.8)
  // ==========================================================================

  describe('lista vacía e inmutabilidad', () => {
    it('una secuencia vacía devuelve lista vacía sin error', () => {
      expect(extraerSegmentos([])).toHaveLength(0);
    });

    it('no modifica la secuencia recibida y es determinista', () => {
      const ops = [mover(0, 1, { x: 0, y: 0 }, { x: 0, y: 100 }, true), girarOp(1, 2)];
      const antes = JSON.stringify(ops);
      const r1 = extraerSegmentos(ops);
      const r2 = extraerSegmentos(ops);
      expect(JSON.stringify(ops)).toBe(antes);
      expect(r1).toEqual(r2);
    });
  });

  // ==========================================================================
  // Property 16 parte A: extracción de segmentos
  // Valida: Requisitos 15.1, 15.2, 15.3
  // ==========================================================================

  describe('Property 16A: extracción de segmentos', () => {
    const permitidos = comandosDelMundo(0).filter((e) => e.ejecutable);

    function operacionesDe(semilla: number): readonly Operacion[] {
      const prng = crearPrng(semilla);
      const programa = generarPrograma(prng, 40);
      const gen = ejecutar(programa, { comandosPermitidos: permitidos, semilla: 0 });
      const ops: Operacion[] = [];
      let paso = gen.next();
      while (!paso.done) {
        ops.push(paso.value);
        paso = gen.next();
      }
      return ops;
    }

    it('cada segmento proviene de un mover con lápiz abajo y longitud suficiente, en orden de paso', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const ops = operacionesDe(semilla);
          const segs = extraerSegmentos(ops);

          // Ordenados por paso ascendente.
          for (let i = 1; i < segs.length; i++) {
            expect(segs[i]!.paso).toBeGreaterThan(segs[i - 1]!.paso);
          }

          // Cada segmento corresponde a un mover válido de la secuencia.
          for (const seg of segs) {
            const op = ops.find((o) => o.paso === seg.paso);
            expect(op).toBeDefined();
            expect(op!.tipo).toBe('mover');
            if (op!.tipo === 'mover') {
              expect(op!.lapizAbajo).toBe(true);
              const dx = op!.hasta.x - op!.desde.x;
              const dy = op!.hasta.y - op!.desde.y;
              expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(0.0001);
            }
          }
        }),
        { seed: 16, numRuns: 200 },
      );
    });

    it('insertar un limpiar deja solo lo posterior, conservando paso y línea', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const ops = operacionesDe(semilla);
          if (ops.length === 0) return;
          // Insertar un limpiar sintético a mitad de la secuencia.
          const corte = Math.floor(ops.length / 2);
          const limpiar: Operacion = { tipo: 'limpiar', paso: -1, linea: 0, profundidad: 0, estadoAntes: E, estadoDespues: E };
          const conLimpiar = [...ops.slice(0, corte), limpiar, ...ops.slice(corte)];

          const segs = extraerSegmentos(conLimpiar);
          // Todos los segmentos resultantes tienen paso >= el primer paso posterior al corte.
          const primerPasoPosterior = ops[corte]?.paso ?? Infinity;
          for (const seg of segs) {
            expect(seg.paso).toBeGreaterThanOrEqual(primerPasoPosterior);
          }
        }),
        { seed: 17, numRuns: 200 },
      );
    });
  });
});
