// Pruebas del relleno de pistas con los parámetros reales del reto (requisito 11).
import { describe, it, expect } from 'vitest';
import { resolverReto } from './reto.js';
import { parametrosVisiblesDelReto, rellenarPistas, esqueletoParcial } from './pistas.js';
import { buscarNivel } from '../niveles/catalogo.js';
import { imprimir } from '../lenguaje/impresor.js';
import type { InvocacionComando } from '../lenguaje/ast.js';

// ============================================================================
// Ayudas
// ============================================================================

/** Resuelve un reto o lanza si no se pudo (no debería en estas pruebas). */
function reto(idNivel: string, semilla: number) {
  const r = resolverReto(idNivel, semilla);
  if (!r.exito) throw new Error(`no se pudo resolver ${idNivel} con semilla ${semilla}`);
  return r.reto;
}

/** Cuenta los AVANZA de primer nivel de la referencia de un reto. */
function contarAvances(r: ReturnType<typeof reto>): number {
  return r.referencia.instrucciones.filter(
    (n) => n.tipo === 'invocacionComando' && (n as InvocacionComando).nombre === 'AVANZA',
  ).length;
}

// ============================================================================
// parametrosVisiblesDelReto
// ============================================================================

describe('pistas · parametrosVisiblesDelReto', () => {
  it('los tramos coinciden con los AVANZA de la referencia del 0.3, sobre varias semillas', () => {
    for (let s = 0; s < 40; s++) {
      const r = reto('0.3', s);
      const p = parametrosVisiblesDelReto(r);
      expect(p.tramos).toBe(contarAvances(r));
      expect(p.cuadros).toBe(20);
      // El camino usa giros de 90° «a un lado u otro», nunca «alternando»
      // (aunque por azar una semilla produzca giros que alternen).
      expect(p.giro).toBe('90 grados a un lado u otro');
    }
  });

  it('el zigzag describe los giros como alternando, sobre varias semillas', () => {
    for (let s = 0; s < 40; s++) {
      const r = reto('0.5', s);
      const p = parametrosVisiblesDelReto(r);
      expect(p.tramos).toBe(contarAvances(r));
      expect(p.giro).toBe('90 grados alternando');
    }
  });
});

// ============================================================================
// rellenarPistas · niveles generados
// ============================================================================

describe('pistas · rellenarPistas en generados', () => {
  it('el número de tramos de la pista coincide con los AVANZA del reto (req 11.4, 11.6)', () => {
    for (const idNivel of ['0.3', '0.5']) {
      const nivel = buscarNivel(idNivel);
      expect(nivel.hallado).toBe(true);
      if (!nivel.hallado) continue;
      for (let s = 0; s < 30; s++) {
        const r = reto(idNivel, s);
        const tramos = contarAvances(r);
        const pistas = rellenarPistas(nivel.nivel, r);
        // La primera pista (conceptual) menciona el número de tramos.
        expect(pistas[0]).toContain(`${tramos} tramos`);
        // Ningún marcador queda sin sustituir.
        for (const pista of pistas) {
          expect(pista).not.toContain('{tramos}');
          expect(pista).not.toContain('{giro}');
          expect(pista).not.toContain('{cuadros}');
          expect(pista).not.toContain('{esqueleto}');
        }
      }
    }
  });

  it('la pista de esqueleto no contiene el programa de referencia completo (req 11.5)', () => {
    for (const idNivel of ['0.3', '0.5']) {
      const nivel = buscarNivel(idNivel);
      if (!nivel.hallado) continue;
      for (let s = 0; s < 30; s++) {
        const r = reto(idNivel, s);
        const pistas = rellenarPistas(nivel.nivel, r);
        const esqueleto = pistas[2];

        // El programa completo impreso.
        const completo = imprimir(r.referencia);
        expect(completo.exito).toBe(true);
        if (!completo.exito) continue;

        // El esqueleto no incluye el texto completo del programa.
        expect(esqueleto).not.toContain(completo.texto.trimEnd());
        // Y es estrictamente más corto que el programa completo (es parcial).
        const lineasCompleto = completo.texto.trim().split('\n').length;
        const lineasEsqueleto = esqueletoParcial(r.referencia).split('\n').length;
        expect(lineasEsqueleto).toBeLessThan(lineasCompleto);
      }
    }
  });

  it('el esqueleto es el primer tramo y el primer giro, impresos', () => {
    const r = reto('0.3', 1);
    const esqueleto = esqueletoParcial(r.referencia);
    const lineas = esqueleto.split('\n');
    expect(lineas).toHaveLength(2);
    expect(lineas[0]!.startsWith('AVANZA ')).toBe(true);
    expect(/^GIRA(DERECHA|IZQUIERDA) 90$/.test(lineas[1]!)).toBe(true);
  });
});

// ============================================================================
// rellenarPistas · niveles autorados
// ============================================================================

describe('pistas · rellenarPistas en autorados', () => {
  it('devuelve las pistas fijas tal cual, sin marcadores', () => {
    for (const idNivel of ['0.1', '0.2', '0.4']) {
      const nivel = buscarNivel(idNivel);
      expect(nivel.hallado).toBe(true);
      if (!nivel.hallado) continue;
      const r = reto(idNivel, 0);
      const pistas = rellenarPistas(nivel.nivel, r);
      expect(pistas).toEqual(nivel.nivel.pistas);
      for (const pista of pistas) {
        expect(pista).not.toContain('{');
      }
    }
  });
});
