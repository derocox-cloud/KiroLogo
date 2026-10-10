// Pruebas de la resolución del reto
// Ejemplos del requisito 18 (16.1), Property 9B (16.2) y la regresión del
// catálogo, Property 25 (16.9).

import { describe, it, expect } from 'vitest';
import { resolverReto } from './reto.js';
import { calificar } from './estrellas.js';
import { analizar as analizarAbstraccion } from './abstraccion.js';
import { validar } from '../motor/validador.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
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
// Resolución de niveles generados (spec 01, requisito 5)
// ============================================================================

describe('reto · niveles generados (0.3, 0.5)', () => {
  it('resuelve el 0.3 (camino) con presupuesto calculado y semilla efectiva', () => {
    const r = resolverReto('0.3', 7);
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    // El presupuesto es el conteo de la referencia generada (no un número fijo).
    const conteo = contarInstrucciones(r.reto.referencia);
    expect(conteo.exito).toBe(true);
    if (conteo.exito) expect(r.reto.presupuestoEstrella).toBe(conteo.instrucciones);
    // La semilla efectiva está en el dominio y el código se calcula sobre ella.
    expect(Number.isInteger(r.reto.semillaEfectiva)).toBe(true);
    expect(r.reto.codigoSemilla).toHaveLength(7);
    // Operaciones y segmentos vienen de una sola ejecución de esa referencia.
    expect(r.reto.operaciones.length).toBeGreaterThan(0);
    expect(r.reto.segmentos).toEqual(extraerSegmentos(r.reto.operaciones));
    // El reto aprueba las tres estrellas contra sí mismo.
    const veredicto = validar(r.reto.segmentos, r.reto.segmentos, r.reto.nivel.normalizacion);
    const cal = calificar(r.reto.referencia, veredicto, r.reto);
    expect(cal.precision.otorgada).toBe(true);
    expect(cal.economia.otorgada).toBe(true);
    expect(cal.abstraccion.otorgada).toBe(true);
  });

  it('resuelve el 0.5 (zigzag) con las tres estrellas contra sí mismo', () => {
    const r = resolverReto('0.5', 3);
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    const veredicto = validar(r.reto.segmentos, r.reto.segmentos, r.reto.nivel.normalizacion);
    const cal = calificar(r.reto.referencia, veredicto, r.reto);
    expect(cal.precision.otorgada).toBe(true);
    expect(cal.economia.otorgada).toBe(true);
    expect(cal.abstraccion.otorgada).toBe(true);
  });

  it('la misma semilla reproduce el mismo reto generado', () => {
    const a = resolverReto('0.3', 12345);
    const b = resolverReto('0.3', 12345);
    expect(a.exito && b.exito).toBe(true);
    if (a.exito && b.exito) {
      expect(a.reto.semillaEfectiva).toBe(b.reto.semillaEfectiva);
      expect(a.reto.codigoSemilla).toBe(b.reto.codigoSemilla);
      expect(JSON.stringify(a.reto.referencia)).toBe(JSON.stringify(b.reto.referencia));
      expect(JSON.stringify(a.reto.operaciones)).toBe(JSON.stringify(b.reto.operaciones));
    }
  });

  it('semillas distintas pueden traer retos distintos (rejugabilidad)', () => {
    // Sobre varias semillas, al menos un par de retos del 0.3 difiere.
    const refs = [0, 1, 2, 5, 9, 13, 21].map((s) => {
      const r = resolverReto('0.3', s);
      return r.exito ? JSON.stringify(r.reto.referencia) : null;
    });
    expect(refs.every((x) => x !== null)).toBe(true);
    expect(new Set(refs).size).toBeGreaterThan(1);
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
      // Autorado: usa su semilla fija. Generado: una semilla cualquiera; el
      // generador produce un reto resoluble por construcción (su aprobación con
      // tres estrellas sobre 200 semillas la cubren además las pruebas de cada
      // generador). Así esta regresión abarca los cinco niveles del mundo 0.
      const semilla = nivel.origen.tipo === 'autorado' ? nivel.origen.semilla : 1;
      const resultado = resolverReto(nivel.id, semilla);
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
