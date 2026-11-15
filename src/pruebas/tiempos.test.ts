/**
 * Lectura del repositorio (R15.4): las regresiones de tres estrellas sobre 200
 * semillas de los mundos 2 y 3 comparten un único timeout. Esta prueba lee las
 * fuentes con `fs` (sin red, sin historial de git) y falla si alguna de esas
 * regresiones declara un literal propio en lugar de la constante compartida.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIMEOUT_TRES_ESTRELLAS } from './tiempos.js';

const RAIZ_SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Fuentes que contienen las regresiones de 200 semillas de los mundos 2 y 3. */
const FUENTES = ['juego/generadores-mundo-2.test.ts', 'juego/reto.test.ts'] as const;

/** Un bloque `it(...)` es una regresión de 200 semillas si lo dice su cuerpo. */
const ES_REGRESION_200 = /MUESTRA|200 semillas|length:\s*200/;

/** Cierre de un `it`: `}, <timeout>)` donde el timeout es un literal o un identificador. */
const CIERRE_CON_TIMEOUT = /\}\s*,\s*([\w]+)\s*\)/g;

interface Regresion {
  fuente: string;
  timeout: string;
}

function leer(fuente: string): string {
  return readFileSync(join(RAIZ_SRC, fuente), 'utf8');
}

/** Extrae el timeout con el que se cierra cada `it` que es una regresión de 200 semillas. */
function regresionesDe(fuente: string): Regresion[] {
  const bloques = leer(fuente).split(/\n\s*it\(/).slice(1);
  const encontradas: Regresion[] = [];
  for (const bloque of bloques) {
    if (!ES_REGRESION_200.test(bloque)) continue;
    const cierres = [...bloque.matchAll(CIERRE_CON_TIMEOUT)];
    const ultimo = cierres[cierres.length - 1];
    if (ultimo?.[1]) encontradas.push({ fuente, timeout: ultimo[1] });
  }
  return encontradas;
}

describe('timeout compartido de las regresiones de tres estrellas (R15)', () => {
  it('TIMEOUT_TRES_ESTRELLAS vale 180 000 ms', () => {
    expect(TIMEOUT_TRES_ESTRELLAS).toBe(180_000);
  });

  it('las regresiones de 200 semillas de los mundos 2 y 3 usan solo la constante compartida', () => {
    const regresiones = FUENTES.flatMap(regresionesDe);
    // Piso: 5 en el mundo 2 y las dos del mundo 3. Si el lector no las ve, la prueba no protege nada.
    expect(regresiones.filter((r) => r.fuente.includes('mundo-2')).length).toBeGreaterThanOrEqual(1);
    expect(regresiones.filter((r) => r.fuente.includes('reto')).length).toBeGreaterThanOrEqual(2);
    const ajenas = regresiones
      .filter((r) => r.timeout !== 'TIMEOUT_TRES_ESTRELLAS')
      .map((r) => `${r.fuente}: timeout «${r.timeout}»`);
    expect(ajenas, ajenas.join('\n')).toEqual([]);
  });

  it('cada fuente importa la constante y no declara una propia', () => {
    const problemas: string[] = [];
    for (const fuente of FUENTES) {
      const texto = leer(fuente);
      if (!/import\s*\{[^}]*\bTIMEOUT_TRES_ESTRELLAS\b[^}]*\}\s*from\s*['"][^'"]*pruebas\/tiempos\.js['"]/.test(texto)) {
        problemas.push(`${fuente} no importa TIMEOUT_TRES_ESTRELLAS de pruebas/tiempos`);
      }
      if (/\b(?:const|let|var)\s+TIMEOUT_TRES_ESTRELLAS\b/.test(texto)) {
        problemas.push(`${fuente} declara su propia TIMEOUT_TRES_ESTRELLAS`);
      }
    }
    expect(problemas, problemas.join('\n')).toEqual([]);
  });
});
