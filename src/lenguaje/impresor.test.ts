// Pruebas del impresor de KiroLogo
// Ejemplos del requisito 6 y las propiedades 5 (ida y vuelta) y 6 (idempotencia).

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { imprimir } from './impresor.js';
import { analizarLexico } from './lexer.js';
import { analizar } from './parser.js';
import { contarInstrucciones } from './conteo.js';
import type { Programa, InvocacionComando, NumeroLiteral, Instruccion } from './ast.js';
import { crearPrng } from '../azar/prng.js';
import { generarPrograma } from '../azar/generadores-prueba.test.js';
import { buscarComando } from './vocabulario.js';

// ============================================================================
// Ayudas
// ============================================================================

/** Analiza texto a programa (lexer + parser), asumiendo que es válido. */
function programaDe(texto: string, mundo: 0 = 0): Programa {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo });
  if (programa === null) {
    throw new Error(`el texto no es válido: ${errores.map((e) => e.id).join(', ')}`);
  }
  return programa;
}

/**
 * Extrae la secuencia comparable de un programa: comando y argumentos por nodo.
 * El nombre se normaliza a su nombre largo canónico, porque `AV` y `AVANZA` son
 * el mismo comando (requisito 6.3: «el mismo comando en cada nodo»).
 */
function secuencia(programa: Programa): ReadonlyArray<{ nombre: string; args: readonly number[] }> {
  return programa.instrucciones.map((inst) => {
    const inv = inst as InvocacionComando;
    const busqueda = buscarComando(inv.nombre);
    const nombreCanonico = busqueda.hallada ? busqueda.entrada.nombre : inv.nombre;
    return {
      nombre: nombreCanonico,
      args: inv.argumentos.map((a) => (a as NumeroLiteral).valor),
    };
  });
}

// ============================================================================
// Ejemplos
// ============================================================================

describe('impresor', () => {
  describe('ejemplos del requisito 6', () => {
    it('av 100 se imprime como AVANZA 100', () => {
      const r = imprimir(programaDe('av 100'));
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.texto).toBe('AVANZA 100\n');
    });

    it('av 10,50 se imprime como AVANZA 10.5', () => {
      const r = imprimir(programaDe('av 10,50'));
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.texto).toBe('AVANZA 10.5\n');
    });

    it('usa el nombre largo aunque se escriba la abreviatura', () => {
      const r = imprimir(programaDe('gd 90'));
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.texto).toBe('GIRADERECHA 90\n');
    });

    it('imprime un comando de aridad 0 sin argumentos', () => {
      const r = imprimir(programaDe('centro'));
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.texto).toBe('CENTRO\n');
    });

    it('imprime una instrucción por línea, sin espacios finales', () => {
      const r = imprimir(programaDe('av 100 gd 90 centro'));
      expect(r.exito).toBe(true);
      if (r.exito) {
        expect(r.texto).toBe('AVANZA 100\nGIRADERECHA 90\nCENTRO\n');
        // Ninguna línea termina en espacio.
        for (const linea of r.texto.split('\n')) {
          expect(linea).toBe(linea.replace(/\s+$/, ''));
        }
      }
    });

    it('el programa vacío se imprime como texto vacío', () => {
      const r = imprimir(programaDe(''));
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.texto).toBe('');
    });
  });

  // ==========================================================================
  // Nodo no imprimible (Requisito 6.6)
  // ==========================================================================

  describe('nodo no imprimible', () => {
    it('un nodo reservado produce nodoNoImprimible sin texto parcial', () => {
      const repeticion: Instruccion = {
        tipo: 'repeticion',
        veces: { tipo: 'numeroLiteral', valor: 4, linea: 1, columna: 1 },
        cuerpo: [],
        linea: 1,
        columna: 1,
      };
      const prog: Programa = {
        tipo: 'programa',
        instrucciones: [
          { tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [{ tipo: 'numeroLiteral', valor: 100, linea: 1, columna: 1 }], linea: 1, columna: 1 },
          repeticion,
        ],
      };
      const r = imprimir(prog);
      expect(r.exito).toBe(false);
      if (!r.exito) {
        expect(r.error.id).toBe('nodoNoImprimible');
        expect(r.error.severidad).toBe('jugador');
      }
    });

    it('un comando que el vocabulario no declara produce nodoNoImprimible', () => {
      const prog: Programa = {
        tipo: 'programa',
        instrucciones: [
          { tipo: 'invocacionComando', nombre: 'INVENTADO', argumentos: [], linea: 1, columna: 1 },
        ],
      };
      const r = imprimir(prog);
      expect(r.exito).toBe(false);
      if (!r.exito) expect(r.error.id).toBe('nodoNoImprimible');
    });
  });

  // ==========================================================================
  // Property 5: Ida y vuelta entre parser e impresor
  // Valida: Requisitos 6.3, 5.1, 6.1, 6.2, 29.5
  // ==========================================================================

  describe('Property 5: ida y vuelta entre parser e impresor', () => {
    it('imprimir y reanalizar da la misma secuencia de nodos, sobre 200 semillas', () => {
      const comandosVistos = new Set<string>();
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const original = generarPrograma(prng, 50);

          const impreso = imprimir(original);
          expect(impreso.exito).toBe(true);
          if (!impreso.exito) return;

          const reanalizado = programaDe(impreso.texto);

          const seqOriginal = secuencia(original);
          const seqReanalizado = secuencia(reanalizado);

          // Misma cantidad de nodos.
          expect(seqReanalizado.length).toBe(seqOriginal.length);
          // Mismo comando y argumentos numéricos exactamente iguales.
          for (let i = 0; i < seqOriginal.length; i++) {
            expect(seqReanalizado[i]!.nombre).toBe(seqOriginal[i]!.nombre);
            expect(seqReanalizado[i]!.args).toEqual(seqOriginal[i]!.args);
            comandosVistos.add(seqOriginal[i]!.nombre);
          }
        }),
        { seed: 5, numRuns: 200 },
      );

      // El conjunto de 200 programas cubre los seis comandos del mundo 0.
      for (const nombre of ['AVANZA', 'RETROCEDE', 'GIRADERECHA', 'GIRAIZQUIERDA', 'CENTRO', 'BORRAPANTALLA']) {
        expect(comandosVistos.has(nombre)).toBe(true);
      }
    });

    it('el conteo coincide entre el original y el reanalizado, sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const original = generarPrograma(prng, 50);
          const impreso = imprimir(original);
          if (!impreso.exito) return;
          const reanalizado = programaDe(impreso.texto);

          const cOriginal = contarInstrucciones(original);
          const cReanalizado = contarInstrucciones(reanalizado);
          expect(cOriginal.exito && cReanalizado.exito).toBe(true);
          if (cOriginal.exito && cReanalizado.exito) {
            expect(cReanalizado.instrucciones).toBe(cOriginal.instrucciones);
          }
        }),
        { seed: 6, numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 6: Idempotencia del formato y estabilidad del conteo bajo la ida y vuelta
  // Valida: Requisitos 6.4, 6.5, 6.7
  // ==========================================================================

  describe('Property 6: idempotencia del formato', () => {
    it('imprimir → analizar → imprimir da un texto idéntico, sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const original = generarPrograma(prng, 50);

          const primera = imprimir(original);
          expect(primera.exito).toBe(true);
          if (!primera.exito) return;

          const reanalizado = programaDe(primera.texto);
          const segunda = imprimir(reanalizado);
          expect(segunda.exito).toBe(true);
          if (!segunda.exito) return;

          // Idéntico carácter por carácter.
          expect(segunda.texto).toBe(primera.texto);
        }),
        { seed: 7, numRuns: 200 },
      );
    });

    it('el conteo es estable bajo la ida y vuelta (original y doblemente impreso), sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const original = generarPrograma(prng, 50);
          const primera = imprimir(original);
          if (!primera.exito) return;
          const reanalizado = programaDe(primera.texto);

          const c1 = contarInstrucciones(original);
          const c2 = contarInstrucciones(reanalizado);
          if (c1.exito && c2.exito) {
            expect(c2.instrucciones).toBe(c1.instrucciones);
          }
        }),
        { seed: 8, numRuns: 200 },
      );
    });
  });
});
