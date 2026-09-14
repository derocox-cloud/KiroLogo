// Pruebas de la resolución del reto
// Ejemplos del requisito 18 (16.1), Property 9B (16.2) y la regresión del
// catálogo, Property 25 (16.9).

import { describe, it, expect } from 'vitest';
import { resolverReto } from './reto.js';
import { calificar } from './estrellas.js';
import { analizar as analizarAbstraccion } from './abstraccion.js';
import { validar } from '../motor/validador.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { CATALOGO } from '../niveles/catalogo.js';

// ============================================================================
// Ejemplos del nivel 0.1 (16.1)
// ============================================================================

describe('reto · resolución del nivel 0.1', () => {
  it('devuelve el presupuestoEstrella 1', () => {
    const r = resolverReto('0.1', 0);
    expect(r.exito).toBe(true);
    if (r.exito) expect(r.reto.presupuestoEstrella).toBe(1);
  });

  it('el límite duro es 4 e inactivo en el mundo 0', () => {
    const r = resolverReto('0.1', 0);
    if (r.exito) {
      // presupuesto 1 + margen por omisión 3 = 4.
      expect(r.reto.limiteDuro).toBe(4);
      expect(r.reto.limiteDuroActivo).toBe(false);
    }
  });

  it('el código de semilla tiene 7 caracteres y se calcula sobre la semilla efectiva', () => {
    // El nivel 0.1 es autorado: la semilla efectiva es la del nivel, no la recibida.
    const r1 = resolverReto('0.1', 0);
    const r2 = resolverReto('0.1', 999);
    expect(r1.exito && r2.exito).toBe(true);
    if (r1.exito && r2.exito) {
      expect(r1.reto.codigoSemilla).toHaveLength(7);
      // La semilla recibida no cambia el reto autorado.
      expect(r1.reto.semillaEfectiva).toBe(r2.reto.semillaEfectiva);
      expect(r1.reto.codigoSemilla).toBe(r2.reto.codigoSemilla);
    }
  });

  it('las operaciones y los segmentos vienen de una sola ejecución de la referencia', () => {
    const r = resolverReto('0.1', 0);
    if (r.exito) {
      // AVANZA 100 → una operación mover.
      expect(r.reto.operaciones).toHaveLength(1);
      expect(r.reto.operaciones[0]!.tipo).toBe('mover');
      // Los segmentos del reto son exactamente los de extraerSegmentos de esas operaciones.
      const segs = extraerSegmentos(r.reto.operaciones);
      expect(r.reto.segmentos).toEqual(segs);
      expect(r.reto.segmentos).toHaveLength(1);
    }
  });

  it('la referencia del reto es el AST del nivel', () => {
    const r = resolverReto('0.1', 0);
    if (r.exito) {
      expect(r.reto.referencia).toBe(r.reto.nivel.origen.tipo === 'autorado' ? r.reto.nivel.origen.referencia : null);
    }
  });
});

// ============================================================================
// Fallos de programación (16.1)
// ============================================================================

describe('reto · fallos de programación', () => {
  it('un identificador desconocido reporta nivelDesconocido sin reto', () => {
    const r = resolverReto('9.9', 0);
    expect(r.exito).toBe(false);
    if (!r.exito) {
      expect(r.error.id).toBe('nivelDesconocido');
      expect(r.error.severidad).toBe('programacion');
    }
  });
});

// ============================================================================
// Property 9B: determinismo de la resolución del reto (16.2)
// Valida: Requisitos 18.7, 29.4
// ============================================================================

describe('Property 9B: determinismo de la resolución', () => {
  it('dos resoluciones del mismo par, separadas por otra, dan el mismo reto', () => {
    const a = resolverReto('0.1', 0);
    // Una resolución intermedia distinta, para descartar estado a nivel de módulo.
    resolverReto('0.1', 123456);
    const b = resolverReto('0.1', 0);

    expect(a.exito && b.exito).toBe(true);
    if (a.exito && b.exito) {
      expect(a.reto.presupuestoEstrella).toBe(b.reto.presupuestoEstrella);
      expect(a.reto.limiteDuro).toBe(b.reto.limiteDuro);
      expect(a.reto.limiteDuroActivo).toBe(b.reto.limiteDuroActivo);
      expect(a.reto.codigoSemilla).toBe(b.reto.codigoSemilla);
      expect(a.reto.semillaEfectiva).toBe(b.reto.semillaEfectiva);
      // Misma secuencia de operaciones, campo por campo.
      expect(JSON.stringify(a.reto.operaciones)).toBe(JSON.stringify(b.reto.operaciones));
      expect(JSON.stringify(a.reto.segmentos)).toBe(JSON.stringify(b.reto.segmentos));
    }
  });
});

// ============================================================================
// Property 25: todo nivel del catálogo aprueba su propio nivel con 3 estrellas (16.9)
// Valida: Requisitos 29.3, 29.11, 18.8, 18.9, 18.13
// ============================================================================

describe('Property 25: regresión del catálogo', () => {
  it('cada nivel del catálogo aprueba con las tres estrellas ejecutando su referencia', () => {
    const fallos: string[] = [];

    for (const nivel of CATALOGO) {
      const resultado = resolverReto(nivel.id, nivel.origen.tipo === 'autorado' ? nivel.origen.semilla : 0);
      if (!resultado.exito) {
        fallos.push(`${nivel.id}: no se pudo resolver (${resultado.error.id})`);
        continue;
      }
      const reto = resultado.reto;

      // El "jugador" es el propio programa de referencia: debe aprobar todo.
      const veredicto = validar(reto.segmentos, reto.segmentos, nivel.normalizacion);
      const analisis = analizarAbstraccion(reto.referencia, nivel.abstraccion);
      const calificacion = calificar(reto.referencia, veredicto, reto);

      if (!calificacion.precision.otorgada) {
        fallos.push(`${nivel.id} (semilla ${reto.semillaEfectiva}): precisión negada — ${JSON.stringify(calificacion.precision)}`);
      }
      if (!calificacion.economia.otorgada) {
        fallos.push(`${nivel.id} (semilla ${reto.semillaEfectiva}): economía negada — ${JSON.stringify(calificacion.economia)}`);
      }
      if (!calificacion.abstraccion.otorgada) {
        fallos.push(`${nivel.id} (semilla ${reto.semillaEfectiva}): abstracción negada — ${JSON.stringify(calificacion.abstraccion)} · sinConfirmar ${JSON.stringify(analisis.sinConfirmar)}`);
      }
    }

    // Informa todos los fallos antes de terminar.
    expect(fallos, fallos.join('\n')).toHaveLength(0);
  });
});
