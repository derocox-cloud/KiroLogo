// Pruebas de propiedad del generador `roseton-m3` (nivel 3.2).
//
// El mundo 3 enseña iteración anidada: el rosetón es c copias de un polígono
// regular, giradas 360/c entre copias. Su AST es un REPITE dentro de otro
// REPITE. Estas pruebas verifican todo lo que NO depende del catálogo del mundo
// 3 (aún no existe: es la tarea 6). La Property 7 (tres estrellas contra el
// nivel 3.2) queda documentada como pendiente más abajo.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Instruccion, Repeticion, InvocacionComando } from '../../lenguaje/ast.js';
import { analizar } from '../../juego/abstraccion.js';
import { cajaDeReferencia, LIMITE_LIENZO, DIMENSION_MINIMA } from './comun.js';
import { generarRoseton } from './rosetón.js';

// ============================================================================
// Conjuntos esperados por el requisito
// ============================================================================

const COPIAS_VALIDAS = [6, 8, 9, 12, 18, 36] as const; // c (R5.1)
const LADOS_VALIDOS = [3, 4, 5, 6] as const; // n (R5.1)

// ============================================================================
// Ayudas de recorrido del AST
// ============================================================================

/** El literal numérico de una invocación de aridad 1, o null. */
function argumentoNumerico(nodo: InvocacionComando): number | null {
  const arg = nodo.argumentos[0];
  return arg && arg.tipo === 'numeroLiteral' ? arg.valor : null;
}

/** El valor de `veces` de un nodo de repetición (literal). */
function vecesDe(nodo: Repeticion): number | null {
  return nodo.veces.tipo === 'numeroLiteral' ? nodo.veces.valor : null;
}

/**
 * ¿El ángulo es derivable por el jugador? Un ángulo es derivable si es un
 * múltiplo de 15, o si es 360 dividido por un entero que el jugador puede contar
 * en la figura: el número de lados del polígono (3..6) o el número de copias del
 * rosetón ({6,8,9,12,18,36}). El rango 360/k con k entero de 3 a 36 cubre ambos
 * casos. Cada valor que emite el generador (60,45,40,30,20,10 entre copias;
 * 120,90,72,60 entre lados) es «360 entre un número que se ve», que es lo que la
 * pista matemática le enseña a calcular al jugador.
 */
function esAnguloDerivable(angulo: number): boolean {
  if (angulo % 15 === 0) return true;
  for (let k = 3; k <= 36; k++) {
    if (Math.abs(angulo - 360 / k) < 1e-9) return true;
  }
  return false;
}

/**
 * Recorre todas las invocaciones de comando del AST (a cualquier profundidad)
 * y recoge, por comando, sus argumentos numéricos.
 */
function recogerArgumentos(instrucciones: readonly Instruccion[], acc: { longitudes: number[]; angulos: number[] }): void {
  for (const nodo of instrucciones) {
    if (nodo.tipo === 'invocacionComando') {
      const valor = argumentoNumerico(nodo);
      if (valor !== null) {
        if (nodo.nombre === 'AVANZA' || nodo.nombre === 'RETROCEDE') acc.longitudes.push(valor);
        if (nodo.nombre === 'GIRADERECHA' || nodo.nombre === 'GIRAIZQUIERDA') acc.angulos.push(valor);
      }
    } else if (nodo.tipo === 'repeticion') {
      recogerArgumentos(nodo.cuerpo, acc);
    }
  }
}

// ============================================================================
// Property 8 · encuadra y no degenera, sobre 200 semillas
// ============================================================================

describe('roseton-m3 · Property 8: encuadra y no degenera (200 semillas)', () => {
  // Validates: Requirements 5.6, 5.7
  it('las 200 semillas consecutivas producen éxito, encuadrado y no degenerado', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const r = generarRoseton({ semilla, parametros: {}, intentosMaximos: 200 });
      expect(r.exito, `semilla ${semilla} debería tener éxito`).toBe(true);
      if (r.exito) {
        const caja = cajaDeReferencia(r.referencia);
        expect(caja, `semilla ${semilla} debería dibujar tramos`).not.toBeNull();
        if (caja) {
          expect(caja.izquierda).toBeGreaterThanOrEqual(-LIMITE_LIENZO);
          expect(caja.derecha).toBeLessThanOrEqual(LIMITE_LIENZO);
          expect(caja.abajo).toBeGreaterThanOrEqual(-LIMITE_LIENZO);
          expect(caja.arriba).toBeLessThanOrEqual(LIMITE_LIENZO);
          expect(caja.derecha - caja.izquierda).toBeGreaterThanOrEqual(DIMENSION_MINIMA);
          expect(caja.arriba - caja.abajo).toBeGreaterThanOrEqual(DIMENSION_MINIMA);
        }
      }
    }
  });

  it('el lazo no malgasta intentos: el promedio de descartes por semilla es bajo', () => {
    // El rango de L está elegido para que la mayoría de las semillas acepte a la
    // primera. Este límite ancla esa intención: si un cambio futuro al rango
    // hiciera que el lazo tuviera que descartar mucho, esta prueba lo avisa.
    let descartesTotales = 0;
    for (let semilla = 0; semilla < 200; semilla++) {
      const r = generarRoseton({ semilla, parametros: {}, intentosMaximos: 200 });
      if (r.exito) descartesTotales += r.descartes;
    }
    expect(descartesTotales / 200).toBeLessThan(2);
  });
});

// ============================================================================
// Property 9 · números adivinables
// ============================================================================

describe('roseton-m3 · Property 9: solo números adivinables', () => {
  // Validates: Requirements 5.4
  it('toda longitud es múltiplo de 20 y todo ángulo es derivable', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const r = generarRoseton({ semilla, parametros: {}, intentosMaximos: 200 });
        if (!r.exito) return true; // el lazo garantiza éxito; si falla, otras pruebas lo cazan
        const acc = { longitudes: [] as number[], angulos: [] as number[] };
        recogerArgumentos(r.referencia.instrucciones, acc);
        return (
          acc.longitudes.every((l) => l % 20 === 0) &&
          acc.angulos.every((a) => esAnguloDerivable(a))
        );
      }),
      { numRuns: 200 },
    );
  });
});

// ============================================================================
// Property 10 · forma del rosetón
// ============================================================================

describe('roseton-m3 · Property 10: forma REPITE c [REPITE n [AV L GD 360/n] GD 360/c]', () => {
  // Validates: Requirements 5.1, 5.2, 5.8
  it('la estructura anidada y los conjuntos de c y n son los pedidos', () => {
    for (let semilla = 0; semilla < 200; semilla++) {
      const r = generarRoseton({ semilla, parametros: {}, intentosMaximos: 200 });
      expect(r.exito).toBe(true);
      if (!r.exito) continue;

      const instr = r.referencia.instrucciones;
      // Un solo nodo externo, de repetición (las copias).
      expect(instr).toHaveLength(1);
      const externo = instr[0]!;
      expect(externo.tipo).toBe('repeticion');
      if (externo.tipo !== 'repeticion') continue;

      const c = vecesDe(externo);
      expect(COPIAS_VALIDAS).toContain(c);

      // Cuerpo del externo: [ REPITE n [...], GD 360/c ].
      expect(externo.cuerpo).toHaveLength(2);
      const interno = externo.cuerpo[0]!;
      const giroCopia = externo.cuerpo[1]!;
      expect(interno.tipo).toBe('repeticion');
      expect(giroCopia.tipo).toBe('invocacionComando');
      if (interno.tipo !== 'repeticion' || giroCopia.tipo !== 'invocacionComando') continue;

      // Giro entre copias = 360/c a la derecha.
      expect(giroCopia.nombre).toBe('GIRADERECHA');
      expect(argumentoNumerico(giroCopia)).toBeCloseTo(360 / (c ?? 1), 9);

      const n = vecesDe(interno);
      expect(LADOS_VALIDOS).toContain(n);

      // Cuerpo del interno: [ AV L, GD 360/n ].
      expect(interno.cuerpo).toHaveLength(2);
      const avance = interno.cuerpo[0]!;
      const giroLado = interno.cuerpo[1]!;
      expect(avance.tipo).toBe('invocacionComando');
      expect(giroLado.tipo).toBe('invocacionComando');
      if (avance.tipo !== 'invocacionComando' || giroLado.tipo !== 'invocacionComando') continue;
      expect(avance.nombre).toBe('AVANZA');
      expect(giroLado.nombre).toBe('GIRADERECHA');
      expect(argumentoNumerico(giroLado)).toBeCloseTo(360 / (n ?? 1), 9);
    }
  });

  it('la referencia cumple usaRepiteAnidado (analizando el AST)', () => {
    const r = generarRoseton({ semilla: 0, parametros: {}, intentosMaximos: 200 });
    expect(r.exito).toBe(true);
    if (r.exito) {
      const res = analizar(r.referencia, [{ clave: 'usaRepiteAnidado' }]);
      expect(res.confirmadas).toContain('usaRepiteAnidado');
    }
  });
});

// ============================================================================
// Property 7 · tres estrellas contra el nivel 3.2 — PENDIENTE
// ============================================================================

// Pendiente de la tarea 6 (catálogo del mundo 3) y de la tarea 12.2 (regresión).
// Sin el nivel 3.2 declarado en el catálogo no se puede resolver el reto ni
// validar la referencia, así que la Property 7 (precisión + economía +
// abstracción de la referencia contra su propio nivel) se verifica cuando el
// nivel exista. No se inventa el nivel aquí.
describe.todo('roseton-m3 · Property 7: la referencia gana las tres estrellas contra el nivel 3.2 (pendiente tarea 6 / 12.2)');
