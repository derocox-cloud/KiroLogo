// Property 7: AZAR es determinista, acotado y aislado.
//
// El azar de una ejecución llega inyectado (`fabricaAzar` de `azar/prng.ts`) y se
// siembra con `opciones.semilla`. Si dependiera de algo más (un PRNG compartido, el
// número de ejecuciones previas, la hora), el mismo intento daría dibujos distintos
// en la ejecución completa, el paso a paso y la validación, y un reto compartido
// dejaría de reproducirse.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Expresion, Instruccion, Programa } from './ast.js';
import { ejecutar, type ResultadoEjecucion } from './interprete.js';
import { comandosDelMundo } from './vocabulario.js';
import { fabricaAzar, SEMILLA_MAXIMA } from '../azar/prng.js';
import { resolverReto } from '../juego/reto.js';
import { CATALOGO } from '../niveles/catalogo.js';
import { arbPrograma } from '../pruebas/arbitrarios.js';

const PERMITIDOS = comandosDelMundo(4);
const arbSemilla = fc.integer({ min: 0, max: SEMILLA_MAXIMA });

function correr(programa: Programa, semilla: number): ResultadoEjecucion {
  const gen = ejecutar(programa, { comandosPermitidos: PERMITIDOS, semilla, fabricaAzar });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

const literal = (valor: number, linea: number): Expresion => ({ tipo: 'numeroLiteral', valor, linea, columna: 1 });
const azar = (n: number, linea: number): Expresion => ({
  tipo: 'comandoOperador', nombre: 'AZAR', argumentos: [literal(n, linea)], linea, columna: 9,
});
const comando = (nombre: string, argumento: Expresion, linea: number): Instruccion => ({
  tipo: 'invocacionComando', nombre, argumentos: [argumento], linea, columna: 1,
});

/** `ESCRIBE AZAR n` una vez por cota, cada uno en su línea. */
function escribirAzares(cotas: readonly number[]): Programa {
  return { tipo: 'programa', instrucciones: cotas.map((n, i) => comando('ESCRIBE', azar(n, i + 1), i + 1)) };
}

function textosEscritos(r: ResultadoEjecucion): string[] {
  return r.operaciones.flatMap((o) => (o.tipo === 'escribir' ? [o.texto] : []));
}

const NIVELES_GENERADOS_M4 = CATALOGO.filter((n) => n.mundo === 4 && n.origen.tipo === 'generado').map((n) => n.id);

describe('Property 7: AZAR es determinista, acotado y aislado', () => {
  it('la misma semilla da la misma ejecución, sin importar cuántas hubo antes', () => {
    // **Validates: Requirements 8.5, 8.6**
    fc.assert(
      fc.property(
        arbPrograma(4),
        arbSemilla,
        fc.array(fc.tuple(arbPrograma(4), arbSemilla), { maxLength: 3 }),
        (programa, semilla, intermedias) => {
          const primera = correr(programa, semilla);
          for (const [otro, otraSemilla] of intermedias) correr(otro, otraSemilla);
          const segunda = correr(programa, semilla);
          expect(segunda).toEqual(primera);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('AZAR n vale un entero en [0, n − 1], tomado en orden del PRNG de la semilla', () => {
    // **Validates: Requirements 8.2, 8.3**
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 20 }),
        arbSemilla,
        (cotas, semilla) => {
          const r = correr(escribirAzares(cotas), semilla);
          expect(r.error).toBeNull();
          const valores = textosEscritos(r).map(Number);
          expect(valores).toHaveLength(cotas.length);

          const esperado = fabricaAzar(semilla);
          valores.forEach((k, i) => {
            expect(Number.isInteger(k)).toBe(true);
            expect(k).toBeGreaterThanOrEqual(0);
            expect(k).toBeLessThanOrEqual(cotas[i]! - 1);
            expect(k).toBe(esperado(cotas[i]!));
          });
        },
      ),
      { numRuns: 300 },
    );
  });

  it('AZAR 1 vale 0 con cualquier semilla', () => {
    // **Validates: Requirements 8.2**
    fc.assert(
      fc.property(arbSemilla, fc.integer({ min: 1, max: 10 }), (semilla, veces) => {
        const r = correr(escribirAzares(Array.from({ length: veces }, () => 1)), semilla);
        expect(r.error).toBeNull();
        expect(textosEscritos(r)).toEqual(Array.from({ length: veces }, () => '0'));
      }),
      { numRuns: 200 },
    );
  });

  it('una cota no entera o menor que 1 detiene con azarRangoInvalido, el valor y la línea', () => {
    // **Validates: Requirements 8.7**
    const arbCotaInvalida = fc.oneof(
      fc.integer({ min: -1000, max: 0 }),
      fc.double({ min: -1000, max: 1000, noNaN: true }).filter((v) => !Number.isInteger(v)),
    );
    fc.assert(
      fc.property(arbCotaInvalida, arbSemilla, (n, semilla) => {
        const programa: Programa = {
          tipo: 'programa',
          instrucciones: [
            comando('AVANZA', literal(20, 1), 1),
            comando('AVANZA', azar(n, 2), 2),
            comando('AVANZA', literal(20, 3), 3),
          ],
        };
        const r = correr(programa, semilla);
        expect(r.error?.id).toBe('azarRangoInvalido');
        expect(r.error?.linea).toBe(2);
        expect(r.error?.mensaje).toContain(String(n));
        // Solo queda lo emitido antes de la línea 2.
        expect(r.operaciones.map((o) => o.linea)).toEqual([1]);
      }),
      { numRuns: 300 },
    );
  });

  it('ejecutar un programa con AZAR no cambia el reto que se genera con la misma semilla', () => {
    // **Validates: Requirements 8.8**
    expect(NIVELES_GENERADOS_M4.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(
        fc.constantFrom(...NIVELES_GENERADOS_M4),
        arbSemilla,
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 20 }),
        (idNivel, semilla, cotas) => {
          const antes = resolverReto(idNivel, semilla);
          expect(antes.exito).toBe(true);
          correr(escribirAzares(cotas), semilla);
          const despues = resolverReto(idNivel, semilla);
          expect(despues.exito).toBe(true);
          if (!antes.exito || !despues.exito) return;
          expect(despues.reto.referencia).toEqual(antes.reto.referencia);
          expect(despues.reto.semillaEfectiva).toBe(antes.reto.semillaEfectiva);
        },
      ),
      { numRuns: 50 },
    );
  });
});
