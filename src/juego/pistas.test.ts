// Pruebas del relleno de pistas con los parámetros reales del reto (requisito 11).
import { describe, it, expect } from 'vitest';
import { resolverReto } from './reto.js';
import { parametrosVisiblesDelReto, rellenarPistas, esqueletoParcial } from './pistas.js';
import { buscarNivel } from '../niveles/catalogo.js';
import { imprimir } from '../lenguaje/impresor.js';
import type { InvocacionComando, InvocacionProcedimiento } from '../lenguaje/ast.js';
import type { Nivel } from '../niveles/tipos.js';

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

// ============================================================================
// rellenarPistas · mundo 4 (D2, requisito 23)
// ============================================================================

/** Llamadas a procedimiento del nivel superior de la referencia de un reto. */
function llamadasDe(r: ReturnType<typeof reto>): InvocacionProcedimiento[] {
  return r.referencia.instrucciones.filter(
    (n): n is InvocacionProcedimiento => n.tipo === 'invocacionProcedimiento',
  );
}

/** Texto del argumento `i` de una llamada; la prueba exige que sea literal. */
function literal(llamada: InvocacionProcedimiento | undefined, i: number): string {
  const arg = llamada?.argumentos[i];
  if (!arg || arg.tipo !== 'numeroLiteral') throw new Error(`argumento ${i} no literal`);
  return String(arg.valor);
}

function nivelDe(idNivel: string): Nivel {
  const n = buscarNivel(idNivel);
  if (!n.hallado) throw new Error(`no existe el nivel ${idNivel}`);
  return n.nivel;
}

/** Un numeral suelto (no parte de un nombre como `P2`). */
const NUMERAL = /\b\d+(?:[.,]\d+)?\b/;

describe('pistas · rellenarPistas en el mundo 4', () => {
  it('el 4.2 sustituye {lados1}, {lados2}, {lados3} y {largo} con las llamadas de la referencia (req 23.2)', () => {
    const nivel = nivelDe('4.2');
    for (let s = 0; s < 20; s++) {
      const r = reto('4.2', s);
      const llamadas = llamadasDe(r);
      expect(llamadas).toHaveLength(3);
      const [, matematica] = rellenarPistas(nivel, r);
      expect(matematica).toContain(
        `polígonos de ${literal(llamadas[0], 0)}, ${literal(llamadas[1], 0)} y ${literal(llamadas[2], 0)} lados`,
      );
      expect(matematica).toContain(`lados de ${literal(llamadas[0], 1)}`);
      expect(matematica).not.toMatch(/\{[a-zA-Z0-9]+\}/);
    }
  });

  it('el 4.3 sustituye {copias} y {lados}, y el 4.4 sustituye {puntas} (req 23.2)', () => {
    const n43 = nivelDe('4.3');
    const n44 = nivelDe('4.4');
    for (let s = 0; s < 20; s++) {
      const r43 = reto('4.3', s);
      const ll43 = llamadasDe(r43);
      expect(rellenarPistas(n43, r43)[1]).toContain(`Son ${ll43.length} polígonos de ${literal(ll43[0], 0)} lados`);

      const r44 = reto('4.4', s);
      const ll44 = llamadasDe(r44);
      expect(rellenarPistas(n44, r44)[1]).toContain(`La estrella tiene ${literal(ll44[0], 0)} puntas`);
    }
  });

  it('un placeholder cuyo valor no se puede leer queda sin sustituir', () => {
    const base = nivelDe('4.2');
    const r = reto('4.2', 0);
    const nivel: Nivel = { ...base, pistas: ['{lados1} {lados3}', '{largo} {copias}', '{puntas} {lados}'] };
    const sinLlamadas = { ...r, referencia: { tipo: 'programa' as const, instrucciones: [] } };
    expect(rellenarPistas(nivel, sinLlamadas)).toEqual([
      '{lados1} {lados3}',
      '{largo} {copias}',
      '{puntas} {lados}',
    ]);

    // Con una sola llamada, {lados2} y {lados3} no tienen de dónde salir.
    const unaLlamada = {
      ...r,
      referencia: {
        tipo: 'programa' as const,
        instrucciones: r.referencia.instrucciones.filter(
          (n) => n.tipo !== 'invocacionProcedimiento' || n === llamadasDe(r)[0],
        ),
      },
    };
    const [p] = rellenarPistas({ ...base, pistas: ['{lados1}|{lados2}|{lados3}', '', ''] }, unaLlamada);
    expect(p).toBe(`${literal(llamadasDe(r)[0], 0)}|{lados2}|{lados3}`);
  });

  it('{esqueletoConHuecos} no tiene literales numéricos, tiene huecos y difiere de la referencia (req 23.4, 23.6)', () => {
    for (const idNivel of ['4.2', '4.3', '4.4']) {
      const nivel = nivelDe(idNivel);
      for (let s = 0; s < 20; s++) {
        const r = reto(idNivel, s);
        const esqueleto = rellenarPistas(nivel, r)[2];
        const completo = imprimir(r.referencia);
        expect(completo.exito).toBe(true);
        if (!completo.exito) continue;

        expect(esqueleto).toContain('___');
        expect(esqueleto).not.toMatch(NUMERAL);
        expect(esqueleto).not.toBe(completo.texto.trimEnd());
        expect(esqueleto).not.toContain('{');
        expect(esqueleto.endsWith(' ') || esqueleto.endsWith('\n')).toBe(false);
      }
    }
  });

  it('el esqueleto del mundo 0 no cambia: primer tramo y primer giro con sus números, sin huecos', () => {
    const nivel = nivelDe('0.3');
    for (let s = 0; s < 10; s++) {
      const r = reto('0.3', s);
      const esperado = esqueletoParcial(r.referencia);
      expect(esperado).toMatch(/^AVANZA \d+\nGIRA(DERECHA|IZQUIERDA) 90$/);
      const esquema = rellenarPistas(nivel, r)[2];
      expect(esquema).toContain(esperado);
      expect(esquema).not.toContain('___');
    }
  });
});
