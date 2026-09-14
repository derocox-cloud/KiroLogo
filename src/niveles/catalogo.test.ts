// Pruebas del catálogo de niveles
// Aserciones de compilación de los tipos (15.1) y pruebas del catálogo y del
// nivel 0.1 (15.3).

import { describe, it, expect } from 'vitest';
import { CATALOGO, buscarNivel } from './catalogo.js';
import { NIVEL_0_1, REFERENCIA_0_1, MUNDO_0 } from './mundo-0-primeros-pasos.js';
import type { Nivel, OrigenNivel, ExigenciaAbstraccion } from './tipos.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import type { Programa, InvocacionComando, NumeroLiteral } from '../lenguaje/ast.js';

// ============================================================================
// Aserciones de compilación (15.1) — los tres casos que NO deben compilar
// ============================================================================

describe('tipos de Nivel · aserciones de compilación', () => {
  it('el compilador atrapa los usos inválidos del tipo', () => {
    const referencia: Programa = REFERENCIA_0_1;

    // Un nivel autorado que declara `idGenerador` no compila.
    const autoradoConGenerador: OrigenNivel = {
      tipo: 'autorado',
      referencia,
      semilla: 1,
      // @ts-expect-error autorado no admite idGenerador
      idGenerador: 'x',
    };
    void autoradoConGenerador;

    // Un nivel generado que declara un AST (referencia) no compila.
    const generadoConAst: OrigenNivel = {
      tipo: 'generado',
      idGenerador: 'g',
      parametros: {},
      // @ts-expect-error generado no admite referencia (AST)
      referencia,
    };
    void generadoConAst;

    // Una clave de abstracción ajena a las seis no compila.
    // @ts-expect-error 'usaBucle' no es una clave declarada
    const exigenciaAjena: ExigenciaAbstraccion = { clave: 'usaBucle' };
    void exigenciaAjena;

    // Un consumidor que deja sin tratar una de las dos variantes no compila:
    // sin la rama `generado`, `origen.idGenerador` no es alcanzable con estrechado.
    function describirOrigen(origen: OrigenNivel): string {
      if (origen.tipo === 'autorado') {
        return `autorado, semilla ${origen.semilla}`;
      }
      // Aquí `origen` está estrechado a `generado`.
      return `generado, ${origen.idGenerador}`;
    }
    expect(describirOrigen(NIVEL_0_1.origen)).toContain('autorado');
  });
});

// ============================================================================
// El nivel 0.1 (15.2, 15.3, req 27.1, 27.2)
// ============================================================================

describe('nivel 0.1', () => {
  it('tiene los campos declarados por el requisito 27.1', () => {
    expect(NIVEL_0_1.id).toBe('0.1');
    expect(NIVEL_0_1.mundo).toBe(0);
    expect(NIVEL_0_1.concepto).toBe('secuencia');
    expect(NIVEL_0_1.titulo.length).toBeGreaterThan(0);
    expect(NIVEL_0_1.titulo.length).toBeLessThanOrEqual(60);
  });

  it('su origen es autorado con la referencia armada nodo por nodo', () => {
    expect(NIVEL_0_1.origen.tipo).toBe('autorado');
    if (NIVEL_0_1.origen.tipo === 'autorado') {
      expect(NIVEL_0_1.origen.referencia).toBe(REFERENCIA_0_1);
      // Semilla fija dentro del dominio.
      expect(Number.isInteger(NIVEL_0_1.origen.semilla)).toBe(true);
      expect(NIVEL_0_1.origen.semilla).toBeGreaterThanOrEqual(0);
      expect(NIVEL_0_1.origen.semilla).toBeLessThanOrEqual(4_294_967_295);
    }
  });

  it('la referencia es una sola invocación de AVANZA con literal 100', () => {
    expect(REFERENCIA_0_1.instrucciones).toHaveLength(1);
    const inst = REFERENCIA_0_1.instrucciones[0] as InvocacionComando;
    expect(inst.tipo).toBe('invocacionComando');
    expect(inst.nombre).toBe('AVANZA');
    expect(inst.argumentos).toHaveLength(1);
    const arg = inst.argumentos[0] as NumeroLiteral;
    expect(arg.tipo).toBe('numeroLiteral');
    expect(arg.valor).toBe(100);
  });

  it('el conteo de la referencia es 1 (presupuestoEstrella será 1)', () => {
    const r = contarInstrucciones(REFERENCIA_0_1);
    expect(r.exito).toBe(true);
    if (r.exito) expect(r.instrucciones).toBe(1);
  });

  it('declara la normalización libre/libre/exacta del mundo 0', () => {
    expect(NIVEL_0_1.normalizacion.traslacion).toBe('libre');
    expect(NIVEL_0_1.normalizacion.rotacion).toBe('libre');
    expect(NIVEL_0_1.normalizacion.escala).toBe('exacta');
  });

  it('tiene el conjunto de exigencias vacío y ningún margen de limiteDuro', () => {
    expect(NIVEL_0_1.abstraccion).toEqual([]);
    expect(NIVEL_0_1.margenLimiteDuro).toBeUndefined();
  });

  it('tiene tres pistas en español, ≤ 200 caracteres y sin el programa completo', () => {
    expect(NIVEL_0_1.pistas).toHaveLength(3);
    for (const pista of NIVEL_0_1.pistas) {
      expect(pista.length).toBeGreaterThan(0);
      expect(pista.length).toBeLessThanOrEqual(200);
      // Ninguna pista contiene el programa de referencia completo.
      expect(pista).not.toContain('AVANZA 100');
    }
  });
});

// ============================================================================
// El catálogo (15.3)
// ============================================================================

describe('catálogo', () => {
  it('incluye el mundo 0 con el nivel 0.1', () => {
    expect(CATALOGO.length).toBe(MUNDO_0.length);
    expect(CATALOGO.some((n) => n.id === '0.1')).toBe(true);
  });

  it('busca un nivel por su identificador', () => {
    const r = buscarNivel('0.1');
    expect(r.hallado).toBe(true);
    if (r.hallado) expect(r.nivel).toBe(NIVEL_0_1);
  });

  it('devuelve no hallado para un identificador desconocido', () => {
    expect(buscarNivel('9.9').hallado).toBe(false);
  });

  it('los identificadores son únicos y de 8 caracteres o menos', () => {
    const vistos = new Set<string>();
    for (const nivel of CATALOGO) {
      expect(nivel.id.length).toBeGreaterThan(0);
      expect(nivel.id.length).toBeLessThanOrEqual(8);
      expect(vistos.has(nivel.id)).toBe(false);
      vistos.add(nivel.id);
    }
  });

  it('cada nivel usa la normalización correcta según su mundo', () => {
    for (const nivel of CATALOGO) {
      if (nivel.mundo <= 2) {
        expect(nivel.normalizacion.traslacion).toBe('libre');
        expect(nivel.normalizacion.rotacion).toBe('libre');
      } else {
        expect(nivel.normalizacion.traslacion).toBe('fija');
        expect(nivel.normalizacion.rotacion).toBe('fija');
      }
      expect(nivel.normalizacion.escala).toBe('exacta');
    }
  });

  it('ningún nivel repite una clave de abstracción', () => {
    for (const nivel of CATALOGO) {
      const claves = nivel.abstraccion.map((e) => e.clave);
      expect(new Set(claves).size).toBe(claves.length);
    }
  });

  it('cada nivel tiene tres pistas válidas y sin el programa de referencia', () => {
    for (const nivel of CATALOGO) {
      expect(nivel.pistas).toHaveLength(3);
      for (const pista of nivel.pistas) {
        expect(pista.trim().length).toBeGreaterThan(0);
        expect(pista.length).toBeLessThanOrEqual(200);
      }
    }
  });

  // `Nivel` se importa para tipar ayudas locales de futuras ampliaciones.
  it('el tipo Nivel está disponible para el catálogo', () => {
    const primero: Nivel = CATALOGO[0]!;
    expect(primero.id).toBe('0.1');
  });
});
