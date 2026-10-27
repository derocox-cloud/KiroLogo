// Pruebas de los niveles autorados del mundo 2 (tarea 9.3).
// Se centran en 2.1 y 2.4, que no dependen de los generadores (tarea 10): su
// referencia es un AST fijo, parseable y validable con lo que ya está cableado.
// El cableado del catálogo y de los generados se difiere a las tareas 10 y 12.

import { describe, it, expect } from 'vitest';
import {
  MUNDO_2,
  NIVEL_2_1,
  NIVEL_2_4,
  NIVEL_2_6,
  REFERENCIA_2_1,
  REFERENCIA_2_4,
} from './mundo-2-composicion.js';
import type { Nivel } from './tipos.js';
import type { Programa } from '../lenguaje/ast.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { validar } from '../motor/validador.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';

// ============================================================================
// Utilidad: ejecutar una referencia y extraer sus segmentos
// ============================================================================

const PERMITIDOS_MUNDO_2 = comandosDelMundo(2);

/** Ejecuta un programa del mundo 2 hasta el final y devuelve sus segmentos. */
function segmentosDe(programa: Programa) {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: PERMITIDOS_MUNDO_2,
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  const resultado = paso.value;
  expect(resultado.error).toBeNull();
  return extraerSegmentos(resultado.operaciones);
}

// ============================================================================
// Las referencias parsean sin error (R8.1, R8.2)
// ============================================================================

describe('mundo 2 · referencias autoradas', () => {
  it('2.1 (la casa) parsea como un Programa con dos repeticiones y dos movimientos', () => {
    // Si el parseo fallara, el módulo lanzaría al cargarse; aquí basta confirmar
    // la forma esperada: REPITE, AV, GD, REPITE (cuatro instrucciones en la raíz).
    expect(REFERENCIA_2_1.instrucciones).toHaveLength(4);
    const tipos = REFERENCIA_2_1.instrucciones.map((i) => i.tipo);
    expect(tipos).toEqual(['repeticion', 'invocacionComando', 'invocacionComando', 'repeticion']);
  });

  it('2.4 (la cruz) parsea como un Programa con una sola repetición', () => {
    expect(REFERENCIA_2_4.instrucciones).toHaveLength(1);
    expect(REFERENCIA_2_4.instrucciones[0]!.tipo).toBe('repeticion');
  });
});

// ============================================================================
// El presupuesto sale del Conteo sobre la referencia, sin número a mano (R8.3)
// ============================================================================

describe('mundo 2 · presupuesto derivado del Conteo (R8.3)', () => {
  it('el presupuesto del 2.1 es el que devuelve contarInstrucciones sobre su referencia', () => {
    const r = contarInstrucciones(REFERENCIA_2_1);
    expect(r.exito).toBe(true);
    // Casa: REPITE(1) + cuerpo AV+GD(2) + AV(1) + GD(1) + REPITE(1) + cuerpo AV+GD(2) = 8.
    if (r.exito) expect(r.instrucciones).toBe(8);
  });

  it('el presupuesto del 2.4 es el que devuelve contarInstrucciones sobre su referencia', () => {
    const r = contarInstrucciones(REFERENCIA_2_4);
    expect(r.exito).toBe(true);
    // Cruz: REPITE(1) + cuerpo AV GI AV GD AV GI (6) = 7.
    if (r.exito) expect(r.instrucciones).toBe(7);
  });

  it('ninguno de los autorados guarda un presupuesto en sus datos', () => {
    // El tipo Nivel no tiene campo de presupuesto; esta aserción deja por escrito
    // que el único origen del número es el Conteo.
    for (const nivel of [NIVEL_2_1, NIVEL_2_4]) {
      expect('presupuestoEstrella' in nivel).toBe(false);
      expect('presupuesto' in nivel).toBe(false);
    }
  });
});

// ============================================================================
// La referencia aprueba la precisión de su propio nivel (R8.4)
// ============================================================================
//
// La estrella de economía (igualar el presupuesto) y la de abstracción (vacía en
// 2.1 y 2.4) son triviales para la propia referencia: cuenta exactamente su
// presupuesto y no exige ninguna clave. Aquí se comprueba la precisión, que es la
// que ejercita el validador. El cableado completo vía reto/estrellas se difiere a
// la tarea 12 (catálogo).

describe('mundo 2 · la referencia aprueba la precisión de su nivel (R8.4)', () => {
  it('2.1: su propia estela coincide consigo misma bajo la normalización del nivel', () => {
    const segmentos = segmentosDe(REFERENCIA_2_1);
    const veredicto = validar(segmentos, segmentos, NIVEL_2_1.normalizacion);
    expect(veredicto.coincide).toBe(true);
  });

  it('2.4: su propia estela coincide consigo misma bajo la normalización del nivel', () => {
    const segmentos = segmentosDe(REFERENCIA_2_4);
    const veredicto = validar(segmentos, segmentos, NIVEL_2_4.normalizacion);
    expect(veredicto.coincide).toBe(true);
  });
});

// ============================================================================
// Forma del mundo 2 (R10.1 y orden de los niveles)
// ============================================================================

describe('mundo 2 · catálogo del mundo', () => {
  it('tiene seis niveles en orden 2.1 … 2.6', () => {
    expect(MUNDO_2).toHaveLength(6);
    expect(MUNDO_2.map((n) => n.id)).toEqual(['2.1', '2.2', '2.3', '2.4', '2.5', '2.6']);
  });

  it('todos declaran mundo 2, concepto descomposicion y normalización libre/libre/exacta', () => {
    for (const nivel of MUNDO_2) {
      expect(nivel.mundo).toBe(2);
      expect(nivel.concepto).toBe('descomposicion');
      expect(nivel.normalizacion.traslacion).toBe('libre');
      expect(nivel.normalizacion.rotacion).toBe('libre');
      expect(nivel.normalizacion.escala).toBe('exacta');
    }
  });

  it('solo el 2.6 exige la abstracción defineProcedimiento (R10.1)', () => {
    expect(NIVEL_2_6.abstraccion).toEqual([{ clave: 'defineProcedimiento' }]);
    for (const nivel of MUNDO_2) {
      if (nivel.id !== '2.6') expect(nivel.abstraccion).toEqual([]);
    }
  });

  it('cada nivel tiene tres pistas en español, ≤ 200 caracteres', () => {
    for (const nivel of MUNDO_2) {
      const niv: Nivel = nivel;
      expect(niv.pistas).toHaveLength(3);
      for (const pista of niv.pistas) {
        expect(pista.trim().length).toBeGreaterThan(0);
        expect(pista.length).toBeLessThanOrEqual(200);
      }
    }
  });
});
