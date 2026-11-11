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
import { TIMEOUT_TRES_ESTRELLAS } from '../pruebas/tiempos.js';

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
      // generador produce un reto resoluble por construcción, y su aprobación con
      // las tres estrellas sobre las 200 semillas vive en las pruebas de cada
      // generador (mundo 1: mundo-1-figuras.test; mundo 2: generadores-mundo-2.test).
      // Aquí se confirma el cableado de punta a punta de todo el catálogo.
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
  }, TIMEOUT_TRES_ESTRELLAS);
});

// ============================================================================
// Cableado del mundo 2 (12.2)
// Confirma que resolverReto resuelve los seis niveles del mundo 2 de punta a
// punta: autorados (2.1, 2.4) y generados (2.2, 2.3, 2.5, 2.6). El chequeo
// pesado sobre 200 semillas vive en 10.6; aquí solo se confirma el CABLEADO.
// ============================================================================

describe('reto · cableado del mundo 2', () => {
  it('resuelve el 2.1 (autorado) con presupuesto 8 y límite duro inactivo', () => {
    const r = resolverReto('2.1', 0);
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    // El presupuesto es el Conteo de la referencia, no un número a mano.
    const conteo = contarInstrucciones(r.reto.referencia);
    expect(conteo.exito).toBe(true);
    if (conteo.exito) expect(r.reto.presupuestoEstrella).toBe(conteo.instrucciones);
    expect(r.reto.presupuestoEstrella).toBe(8);
    // Mundo 2 < 3: el límite duro no se activa.
    expect(r.reto.limiteDuroActivo).toBe(false);
  });

  it('resuelve el 2.4 (autorado) con presupuesto 7 y límite duro inactivo', () => {
    const r = resolverReto('2.4', 0);
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    expect(r.reto.presupuestoEstrella).toBe(7);
    expect(r.reto.limiteDuroActivo).toBe(false);
  });

  it('resuelve los cuatro generados (2.2, 2.3, 2.5, 2.6) para varias semillas', () => {
    const fallos: string[] = [];
    for (const id of ['2.2', '2.3', '2.5', '2.6']) {
      for (const semilla of [0, 1, 7, 42, 100]) {
        const r = resolverReto(id, semilla);
        if (!r.exito) {
          fallos.push(`${id} (semilla ${semilla}): no se resolvió (${r.error.id})`);
          continue;
        }
        // La referencia encuadra (hay al menos un segmento) y el límite duro
        // sigue inactivo en el mundo 2.
        if (r.reto.segmentos.length === 0) {
          fallos.push(`${id} (semilla ${semilla}): sin segmentos`);
        }
        if (r.reto.limiteDuroActivo) {
          fallos.push(`${id} (semilla ${semilla}): límite duro activo en mundo 2`);
        }
        // El presupuesto siempre se deriva del Conteo de la referencia.
        const conteo = contarInstrucciones(r.reto.referencia);
        if (conteo.exito && r.reto.presupuestoEstrella !== conteo.instrucciones) {
          fallos.push(`${id} (semilla ${semilla}): presupuesto no deriva del Conteo`);
        }
      }
    }
    expect(fallos, fallos.join('\n')).toHaveLength(0);
  });

  it('la referencia del 2.6 gana la abstracción defineProcedimiento (R10.2)', () => {
    const r = resolverReto('2.6', 3);
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    const analisis = analizarAbstraccion(r.reto.referencia, [{ clave: 'defineProcedimiento' }]);
    expect(analisis.confirmadas).toContain('defineProcedimiento');
  });

  it('cada generado del mundo 2 aprueba su propio nivel con las tres estrellas', () => {
    for (const id of ['2.2', '2.3', '2.5', '2.6']) {
      const r = resolverReto(id, 9);
      expect(r.exito).toBe(true);
      if (!r.exito) continue;
      const veredicto = validar(r.reto.segmentos, r.reto.segmentos, r.reto.nivel.normalizacion);
      const cal = calificar(r.reto.referencia, veredicto, r.reto);
      expect(cal.precision.otorgada, `${id} precisión`).toBe(true);
      expect(cal.economia.otorgada, `${id} economía`).toBe(true);
      expect(cal.abstraccion.otorgada, `${id} abstracción`).toBe(true);
    }
  });

  it('la misma semilla reproduce el mismo reto generado del mundo 2 (determinismo)', () => {
    for (const id of ['2.2', '2.3', '2.5', '2.6']) {
      const a = resolverReto(id, 12345);
      const b = resolverReto(id, 12345);
      expect(a.exito && b.exito).toBe(true);
      if (a.exito && b.exito) {
        expect(a.reto.semillaEfectiva).toBe(b.reto.semillaEfectiva);
        expect(JSON.stringify(a.reto.referencia)).toBe(JSON.stringify(b.reto.referencia));
        expect(a.reto.segmentos.length).toBe(b.reto.segmentos.length);
      }
    }
  });
});

// ============================================================================
// Tarea 12.2 · Regresión del catálogo del mundo 3 vía resolverReto (R4.7, R5.9)
// ============================================================================
//
// La Property 7 de los generadores (roseton.test / flor.test) prueba el
// generador AISLADO sobre un puñado de semillas. Property 25 recorre todo el
// catálogo con UNA semilla por nivel generado. Esta regresión cierra lo que
// falta: el camino COMPLETO de punta a punta —catálogo → generador → conteo →
// validación → calificación— de los dos niveles generados del mundo 3, repetido
// sobre 200 semillas CONSECUTIVAS a través de `resolverReto` (no del generador
// directamente). Es lo que prueba que el cableado del nivel generado no se
// degrada en ninguna de las 200, no solo en una.

describe('Tarea 12.2: regresión del catálogo del mundo 3 sobre 200 semillas', () => {
  // Validates: Requirements 4.7, 5.9
  it('3.2 y 3.3 ganan las tres estrellas vía resolverReto en las 200 semillas consecutivas', () => {
    const fallos: string[] = [];

    for (const id of ['3.2', '3.3']) {
      for (let semilla = 0; semilla < 200; semilla++) {
        const resultado = resolverReto(id, semilla);
        if (!resultado.exito) {
          fallos.push(`${id} (semilla ${semilla}): no se pudo resolver (${resultado.error.id})`);
          continue;
        }
        const reto = resultado.reto;

        // El límite duro se activa desde el mundo 3 (R1.2), a diferencia de 0–2.
        if (!reto.limiteDuroActivo) {
          fallos.push(`${id} (semilla ${semilla}): límite duro inactivo en el mundo 3`);
        }

        // El "jugador" es el propio programa de referencia resuelto: debe aprobar
        // con la normalización FIJA del nivel 3 (traslación/rotación fija).
        const veredicto = validar(reto.segmentos, reto.segmentos, reto.nivel.normalizacion);
        const analisis = analizarAbstraccion(reto.referencia, reto.nivel.abstraccion);
        const calificacion = calificar(reto.referencia, veredicto, reto);

        if (!calificacion.precision.otorgada) {
          fallos.push(`${id} (semilla ${semilla}, efectiva ${reto.semillaEfectiva}): precisión negada — ${JSON.stringify(calificacion.precision)}`);
        }
        if (!calificacion.economia.otorgada) {
          fallos.push(`${id} (semilla ${semilla}, efectiva ${reto.semillaEfectiva}): economía negada — ${JSON.stringify(calificacion.economia)}`);
        }
        if (!calificacion.abstraccion.otorgada) {
          fallos.push(`${id} (semilla ${semilla}, efectiva ${reto.semillaEfectiva}): abstracción (usaRepiteAnidado) negada — ${JSON.stringify(calificacion.abstraccion)} · sinConfirmar ${JSON.stringify(analisis.sinConfirmar)}`);
        }
      }
    }

    // Informa todos los fallos antes de terminar.
    expect(fallos, fallos.join('\n')).toHaveLength(0);
  }, TIMEOUT_TRES_ESTRELLAS);

  it('los niveles autorados 3.1 y 3.4 ganan las tres estrellas vía resolverReto (R4.7)', () => {
    for (const id of ['3.1', '3.4']) {
      const resultado = resolverReto(id, 0);
      expect(resultado.exito, `${id} debería resolverse`).toBe(true);
      if (!resultado.exito) continue;
      const reto = resultado.reto;

      // Autorado del mundo 3: límite duro activo.
      expect(reto.limiteDuroActivo, `${id} límite duro activo`).toBe(true);

      const veredicto = validar(reto.segmentos, reto.segmentos, reto.nivel.normalizacion);
      const calificacion = calificar(reto.referencia, veredicto, reto);
      expect(calificacion.precision.otorgada, `${id} precisión`).toBe(true);
      expect(calificacion.economia.otorgada, `${id} economía`).toBe(true);
      expect(calificacion.abstraccion.otorgada, `${id} abstracción`).toBe(true);
    }
  });

  it('la referencia de 3.4 se resuelve sin activar la guarda de 200 000 pasos (R4.4)', () => {
    // resolverReto convierte una guarda activada en el fallo de programación
    // `referenciaNoEjecutable`; que resuelva con éxito prueba que el mandala
    // completa su ejecución sin disparar ninguna de las guardas.
    const resultado = resolverReto('3.4', 0);
    expect(resultado.exito).toBe(true);
    if (resultado.exito) {
      expect(resultado.reto.operaciones.length).toBeGreaterThan(0);
      expect(resultado.reto.operaciones.length).toBeLessThan(200_000);
    }
  });
});

// ============================================================================
// Tarea 12.3 · No-regresión de los mundos 0 a 2 (R10.3)
// ============================================================================
//
// R10.3 pide que agregar el mundo 3 no cambie el comportamiento de los mundos 0,
// 1 y 2. El invariante estructural más fuerte y barato de afirmar es que el
// límite duro —la única palanca de comportamiento que esta spec activa— sigue
// INACTIVO en TODOS los niveles de los mundos 0, 1 y 2 del catálogo, resolviendo
// cada uno de punta a punta. Property 25 ya prueba que cada nivel sigue ganando
// sus tres estrellas; lo que faltaba era la aserción explícita y exhaustiva de
// que ningún nivel de 0–2 quedó con el límite duro encendido por accidente.

describe('Tarea 12.3: no-regresión de los mundos 0 a 2', () => {
  // Validates: Requirements 10.3
  it('ningún nivel de los mundos 0, 1 y 2 del catálogo tiene el límite duro activo', () => {
    const fallos: string[] = [];
    const nivelesM012 = CATALOGO.filter((n) => n.mundo <= 2);

    // El catálogo declara 16 niveles en 0–2 (5 + 5 + 6): ancla que el filtro no
    // quedó vacío si un refactor futuro moviera niveles de mundo.
    expect(nivelesM012.length).toBe(16);

    for (const nivel of nivelesM012) {
      // Semilla fija para autorados, una cualquiera para generados: el valor de
      // limiteDuroActivo no depende de la semilla, solo del mundo del nivel.
      const semilla = nivel.origen.tipo === 'autorado' ? nivel.origen.semilla : 1;
      const resultado = resolverReto(nivel.id, semilla);
      if (!resultado.exito) {
        fallos.push(`${nivel.id}: no se pudo resolver (${resultado.error.id})`);
        continue;
      }
      if (resultado.reto.limiteDuroActivo) {
        fallos.push(`${nivel.id} (mundo ${nivel.mundo}): límite duro activo — debería estar inactivo en los mundos 0–2`);
      }
    }

    expect(fallos, fallos.join('\n')).toHaveLength(0);
  });
});
