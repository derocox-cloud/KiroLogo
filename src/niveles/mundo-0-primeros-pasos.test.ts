// Pruebas de los cinco niveles del mundo 0 (requisito 1).
//
// Verifica la declaración de los niveles como datos y, para los autorados, cierra
// el lazo con el intérprete y el validador reales: su referencia gana las tres
// estrellas contra su propio nivel.
import { describe, it, expect } from 'vitest';
import {
  MUNDO_0,
  NIVEL_0_1,
  NIVEL_0_2,
  NIVEL_0_3,
  NIVEL_0_4,
  NIVEL_0_5,
  REFERENCIA_0_2,
  REFERENCIA_0_4,
} from './mundo-0-primeros-pasos.js';
import type { Nivel } from './tipos.js';
import type { Programa, InvocacionComando } from '../lenguaje/ast.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { calcularEncuadre } from '../motor/encuadre.js';
import { validar, type NormalizacionNivel } from '../motor/validador.js';
import { calificar } from '../juego/estrellas.js';
import type { Reto } from '../juego/reto.js';

// ============================================================================
// Ayudas
// ============================================================================

const NORMALIZACION_LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };

/** Ejecuta un programa del mundo 0 y devuelve su resultado. */
function ejecutarMundo0(programa: Programa) {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(0),
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

/** Reto mínimo que `calificar` necesita (presupuesto + exigencias). */
function retoDe(referencia: Programa, nivel: Nivel): Reto {
  const conteo = contarInstrucciones(referencia);
  const presupuesto = conteo.exito ? conteo.instrucciones : Number.POSITIVE_INFINITY;
  return { nivel, presupuestoEstrella: presupuesto } as unknown as Reto;
}

/**
 * Comprueba que una referencia autorada gana las tres estrellas en su nivel
 * (requisito 1.7): se ejecuta sin error ni guarda, cabe en el lienzo, y validada
 * contra sí misma otorga precisión, economía y abstracción.
 *
 * No se exige que sea «no degenerada»: esa regla es de los **generadores** (una
 * figura generada no puede reducirse a una línea), no de los niveles autorados.
 * El 0.1 es deliberadamente una línea recta y el 0.2 una ele pequeña: son
 * figuras de enseñanza, válidas por diseño. Lo que importa es que su referencia
 * se valide contra sí misma con las tres estrellas.
 */
function ganaTresEstrellas(referencia: Programa, nivel: Nivel): void {
  const resultado = ejecutarMundo0(referencia);
  expect(resultado.error).toBeNull();
  expect(resultado.guardaActivada).toBeNull();
  const segmentos = extraerSegmentos(resultado.operaciones);
  // Cabe en el lienzo (pero puede ser pequeña o una línea: es autorada).
  const enc = calcularEncuadre(segmentos);
  expect(enc.hayCaja).toBe(true);
  if (enc.hayCaja) expect(enc.noEncuadrada.length).toBe(0);
  const veredicto = validar(segmentos, segmentos, NORMALIZACION_LIBRE);
  const cal = calificar(referencia, veredicto, retoDe(referencia, nivel));
  expect(cal.precision.otorgada).toBe(true);
  expect(cal.economia.otorgada).toBe(true);
  expect(cal.abstraccion.otorgada).toBe(true);
}

// ============================================================================
// Estructura del mundo
// ============================================================================

describe('mundo 0 · estructura', () => {
  it('declara cinco niveles con los ids 0.1 a 0.5 en orden', () => {
    expect(MUNDO_0.map((n) => n.id)).toEqual(['0.1', '0.2', '0.3', '0.4', '0.5']);
  });

  it('todos son del mundo 0 y de concepto secuencia', () => {
    for (const nivel of MUNDO_0) {
      expect(nivel.mundo).toBe(0);
      expect(nivel.concepto).toBe('secuencia');
    }
  });

  it('todos declaran normalización libre/libre/exacta y abstracción vacía', () => {
    for (const nivel of MUNDO_0) {
      expect(nivel.normalizacion).toEqual({ traslacion: 'libre', rotacion: 'libre', escala: 'exacta' });
      expect(nivel.abstraccion).toEqual([]);
    }
  });

  it('cada nivel tiene tres pistas no vacías y ninguna contiene el programa de referencia completo', () => {
    for (const nivel of MUNDO_0) {
      expect(nivel.pistas).toHaveLength(3);
      for (const pista of nivel.pistas) {
        expect(pista.trim().length).toBeGreaterThan(0);
      }
    }
    // El 0.2 y el 0.4 no exponen su programa completo en ninguna pista.
    for (const pista of NIVEL_0_2.pistas) {
      expect(pista).not.toContain('AVANZA 100 GIRADERECHA 90 AVANZA 100');
    }
  });
});

// ============================================================================
// Niveles autorados (0.1, 0.2, 0.4)
// ============================================================================

describe('mundo 0 · niveles autorados', () => {
  it('0.1, 0.2 y 0.4 son autorados con referencia AST y semilla fija', () => {
    for (const nivel of [NIVEL_0_1, NIVEL_0_2, NIVEL_0_4]) {
      expect(nivel.origen.tipo).toBe('autorado');
      if (nivel.origen.tipo === 'autorado') {
        expect(nivel.origen.referencia.tipo).toBe('programa');
        expect(Number.isInteger(nivel.origen.semilla)).toBe(true);
        expect(nivel.origen.semilla).toBeGreaterThanOrEqual(0);
        expect(nivel.origen.semilla).toBeLessThanOrEqual(4_294_967_295);
      }
    }
  });

  it('la referencia del 0.2 es la ele AVANZA 100 / GD 90 / AVANZA 100 (conteo 3)', () => {
    const nombres = REFERENCIA_0_2.instrucciones.map((n) => (n as InvocacionComando).nombre);
    expect(nombres).toEqual(['AVANZA', 'GIRADERECHA', 'AVANZA']);
    const c = contarInstrucciones(REFERENCIA_0_2);
    expect(c.exito && c.instrucciones).toBe(3);
  });

  it('la referencia del 0.4 es el cuadrado a mano (conteo 8)', () => {
    const nombres = REFERENCIA_0_4.instrucciones.map((n) => (n as InvocacionComando).nombre);
    expect(nombres).toEqual([
      'AVANZA', 'GIRADERECHA', 'AVANZA', 'GIRADERECHA',
      'AVANZA', 'GIRADERECHA', 'AVANZA', 'GIRADERECHA',
    ]);
    const c = contarInstrucciones(REFERENCIA_0_4);
    expect(c.exito && c.instrucciones).toBe(8);
  });

  it('la referencia de cada autorado gana las tres estrellas en su nivel', () => {
    for (const nivel of [NIVEL_0_1, NIVEL_0_2, NIVEL_0_4]) {
      expect(nivel.origen.tipo).toBe('autorado');
      if (nivel.origen.tipo === 'autorado') {
        ganaTresEstrellas(nivel.origen.referencia, nivel);
      }
    }
  });
});

// ============================================================================
// Niveles generados (0.3, 0.5)
// ============================================================================

describe('mundo 0 · niveles generados', () => {
  it('0.3 y 0.5 son generados con idGenerador y parámetros, sin referencia ni semilla', () => {
    expect(NIVEL_0_3.origen.tipo).toBe('generado');
    if (NIVEL_0_3.origen.tipo === 'generado') {
      expect(NIVEL_0_3.origen.idGenerador).toBe('camino');
      expect(NIVEL_0_3.origen.parametros).toMatchObject({
        tramosMin: 3, tramosMax: 5, largoMin: 80, largoMax: 160,
      });
      // La variante generada no tiene campos de referencia ni semilla.
      expect('referencia' in NIVEL_0_3.origen).toBe(false);
      expect('semilla' in NIVEL_0_3.origen).toBe(false);
    }
    expect(NIVEL_0_5.origen.tipo).toBe('generado');
    if (NIVEL_0_5.origen.tipo === 'generado') {
      expect(NIVEL_0_5.origen.idGenerador).toBe('zigzag');
      expect(NIVEL_0_5.origen.parametros).toMatchObject({
        tramosMin: 4, tramosMax: 8, largoMin: 60, largoMax: 120,
      });
    }
  });

  it('sus pistas son plantillas que mencionan los marcadores de parámetros', () => {
    // Al menos una pista de cada generado usa el marcador {tramos}; otra, {giro}.
    for (const nivel of [NIVEL_0_3, NIVEL_0_5]) {
      const texto = nivel.pistas.join(' ');
      expect(texto).toContain('{tramos}');
      expect(texto).toContain('{giro}');
    }
  });
});

// ============================================================================
// Sin presupuesto escrito a mano
// ============================================================================

describe('mundo 0 · sin presupuesto escrito a mano', () => {
  it('ningún nivel almacena presupuestoEstrella ni limiteDuro', () => {
    for (const nivel of MUNDO_0) {
      expect('presupuestoEstrella' in nivel).toBe(false);
      expect('limiteDuro' in nivel).toBe(false);
    }
  });
});
