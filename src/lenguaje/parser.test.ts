// Pruebas del parser de KiroLogo
// Ejemplos del requisito 5 y las propiedades 4 y 12.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analizar } from './parser.js';
import { analizarLexico } from './lexer.js';
import type { InvocacionComando, NumeroLiteral } from './ast.js';
import { crearPrng } from '../azar/prng.js';
import { type Mundo } from './vocabulario.js';

// ============================================================================
// Ayuda: analizar texto directamente (lexer + parser)
// ============================================================================

function analizarTexto(texto: string, mundo: Mundo = 0) {
  const { tokens } = analizarLexico(texto);
  return analizar(tokens, { mundo });
}

// ============================================================================
// Ejemplos: programa válido del mundo 0
// ============================================================================

describe('parser', () => {
  describe('programa válido del mundo 0', () => {
    it('produce un nodo por comando en orden', () => {
      const { programa, errores } = analizarTexto('AVANZA 100 GIRADERECHA 90 CENTRO');
      expect(errores).toHaveLength(0);
      expect(programa).not.toBeNull();

      const instrucciones = programa!.instrucciones;
      expect(instrucciones).toHaveLength(3);

      const primero = instrucciones[0] as InvocacionComando;
      expect(primero.tipo).toBe('invocacionComando');
      expect(primero.nombre).toBe('AVANZA');
      expect(primero.argumentos).toHaveLength(1);
      expect((primero.argumentos[0] as NumeroLiteral).valor).toBe(100);
      expect(primero.linea).toBe(1);
      expect(primero.columna).toBe(1);

      const segundo = instrucciones[1] as InvocacionComando;
      expect(segundo.nombre).toBe('GIRADERECHA');
      expect((segundo.argumentos[0] as NumeroLiteral).valor).toBe(90);

      const tercero = instrucciones[2] as InvocacionComando;
      expect(tercero.nombre).toBe('CENTRO');
      expect(tercero.argumentos).toHaveLength(0);
    });

    it('usa el nombre largo aunque el jugador escriba la abreviatura', () => {
      const { programa, errores } = analizarTexto('AV 100 GD 90');
      expect(errores).toHaveLength(0);
      const inst = programa!.instrucciones as readonly InvocacionComando[];
      expect(inst[0]!.nombre).toBe('AVANZA');
      expect(inst[1]!.nombre).toBe('GIRADERECHA');
    });

    it('admite la lista vacía de un texto con solo comentarios', () => {
      const { programa, errores } = analizarTexto('# solo un comentario\n# otro');
      expect(errores).toHaveLength(0);
      expect(programa).not.toBeNull();
      expect(programa!.instrucciones).toHaveLength(0);
    });

    it('admite la lista vacía del texto vacío', () => {
      const { programa, errores } = analizarTexto('');
      expect(errores).toHaveLength(0);
      expect(programa!.instrucciones).toHaveLength(0);
    });

    it('registra la línea de cada comando', () => {
      const { programa } = analizarTexto('AVANZA 100\nGIRADERECHA 90');
      const inst = programa!.instrucciones as readonly InvocacionComando[];
      expect(inst[0]!.linea).toBe(1);
      expect(inst[1]!.linea).toBe(2);
    });
  });

  // ==========================================================================
  // Los nueve tipos reservados no los produce ninguna regla del mundo 0
  // ==========================================================================

  describe('nodos reservados no producidos', () => {
    it('un programa válido del mundo 0 solo contiene invocacionComando y numeroLiteral', () => {
      const { programa } = analizarTexto('AVANZA 100 RETROCEDE 50 GIRADERECHA 90 GIRAIZQUIERDA 45 CENTRO BORRAPANTALLA');
      for (const inst of programa!.instrucciones) {
        expect(inst.tipo).toBe('invocacionComando');
        for (const arg of (inst as InvocacionComando).argumentos) {
          expect(arg.tipo).toBe('numeroLiteral');
        }
      }
    });
  });

  // ==========================================================================
  // Comando bloqueado (Requisito 5.4)
  // ==========================================================================

  describe('comando bloqueado', () => {
    it('REPITE en el mundo 0 reporta comandoBloqueado nombrando el mundo 1', () => {
      const { programa, errores } = analizarTexto('REPITE 4');
      expect(programa).toBeNull();
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('comandoBloqueado');
      expect(errores[0]!.linea).toBe(1);
    });

    it('el mismo comando desbloqueado en un mundo posterior se analiza', () => {
      // SUBELAPIZ es del mundo 2; en el mundo 2 ya no está bloqueado como comando,
      // pero es de aridad 0, así que produce un nodo sin argumento.
      const { programa, errores } = analizarTexto('SUBELAPIZ', 2);
      expect(errores).toHaveLength(0);
      const inst = programa!.instrucciones[0] as InvocacionComando;
      expect(inst.nombre).toBe('SUBELAPIZ');
    });
  });

  // ==========================================================================
  // Argumento faltante y de tipo equivocado (Requisitos 5.5, 5.6)
  // ==========================================================================

  describe('argumento faltante', () => {
    it('un comando de aridad 1 al final sin argumento reporta argumentoFaltante', () => {
      const { programa, errores } = analizarTexto('AVANZA');
      expect(programa).toBeNull();
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('argumentoFaltante');
      expect(errores[0]!.linea).toBe(1);
    });

    it('un comando de aridad 1 seguido de otro comando reporta argumentoFaltante', () => {
      const { errores } = analizarTexto('AVANZA GIRADERECHA 90');
      expect(errores[0]!.id).toBe('argumentoFaltante');
    });
  });

  describe('argumento de tipo equivocado', () => {
    it('un comando de aridad 1 seguido de palabra reporta argumentoDeTipoEquivocado', () => {
      const { programa, errores } = analizarTexto('AVANZA "hola');
      expect(programa).toBeNull();
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('argumentoDeTipoEquivocado');
    });

    it('un comando de aridad 1 seguido de corchete reporta argumentoDeTipoEquivocado', () => {
      const { errores } = analizarTexto('AVANZA [');
      expect(errores[0]!.id).toBe('argumentoDeTipoEquivocado');
    });

    it('un comando de aridad 1 seguido de parámetro reporta argumentoDeTipoEquivocado', () => {
      const { errores } = analizarTexto('AVANZA :largo');
      expect(errores[0]!.id).toBe('argumentoDeTipoEquivocado');
    });
  });

  // ==========================================================================
  // Corchetes y tokens inesperados (Requisitos 5.10, 5.11)
  // ==========================================================================

  describe('corchetes y tokens inesperados donde se espera un comando', () => {
    it('corchete de apertura suelto reporta corcheteInesperado', () => {
      const { errores } = analizarTexto('[ AVANZA 100');
      expect(errores.some((e) => e.id === 'corcheteInesperado')).toBe(true);
    });

    it('corchete de cierre sin apertura reporta corcheteDeMas', () => {
      const { errores } = analizarTexto(']');
      expect(errores[0]!.id).toBe('corcheteDeMas');
    });

    it('parámetro suelto reporta parametroInesperado', () => {
      const { errores } = analizarTexto(':largo');
      expect(errores[0]!.id).toBe('parametroInesperado');
    });

    it('palabra con comilla suelta reporta palabraInesperada', () => {
      const { errores } = analizarTexto('"hola');
      expect(errores[0]!.id).toBe('palabraInesperada');
    });

    it('número suelto reporta numeroInesperado', () => {
      const { errores } = analizarTexto('100');
      expect(errores[0]!.id).toBe('numeroInesperado');
    });
  });

  // ==========================================================================
  // Palabra desconocida: delega en el catálogo (Requisito 5, precedencia)
  // ==========================================================================

  describe('palabra desconocida', () => {
    it('AVANSA sugiere AVANZA', () => {
      const { errores } = analizarTexto('AVANSA 100');
      expect(errores[0]!.id).toBe('palabraDesconocidaConSugerencia');
    });

    it('PINTA sin sugerencia', () => {
      const { errores } = analizarTexto('PINTA 100');
      expect(errores[0]!.id).toBe('palabraDesconocidaSinSugerencia');
    });
  });

  // ==========================================================================
  // Recuperación por sincronización (Requisito 5.8)
  // ==========================================================================

  describe('recuperación por sincronización', () => {
    it('tras un error reanuda en el siguiente comando y sigue reportando', () => {
      // AVANSA (desconocido) ... reanuda en GIRADERECHA (válido) ... luego PINTA (desconocido)
      const { programa, errores } = analizarTexto('AVANSA 100 GIRADERECHA 90 PINTA 50');
      expect(programa).toBeNull();
      // Dos errores: AVANSA y PINTA. GIRADERECHA se analiza sin error.
      expect(errores).toHaveLength(2);
      expect(errores[0]!.id).toBe('palabraDesconocidaConSugerencia');
      expect(errores[1]!.id).toBe('palabraDesconocidaSinSugerencia');
    });

    it('descarta los tokens de la instrucción con error y no confunde el argumento siguiente', () => {
      // AVANZA "hola  → error de tipo; sincroniza descartando "hola; reanuda en GIRADERECHA.
      const { errores } = analizarTexto('AVANZA "hola GIRADERECHA 90');
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('argumentoDeTipoEquivocado');
    });
  });

  // ==========================================================================
  // Property 4: El análisis de errores es determinista, ordenado y acotado
  // Valida: Requisitos 4.9, 5.8, 5.9
  // ==========================================================================

  describe('Property 4: análisis de errores determinista, ordenado y acotado', () => {
    it('la misma entrada produce siempre la misma secuencia de errores', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const texto = generarTextoConErrores(semilla);
          const r1 = analizarTexto(texto);
          const r2 = analizarTexto(texto);
          // Determinismo: mismos ids en el mismo orden.
          expect(r1.errores.map((e) => e.id)).toEqual(r2.errores.map((e) => e.id));
          expect(r1.errores.map((e) => `${e.linea}:${e.columna}`)).toEqual(
            r2.errores.map((e) => `${e.linea}:${e.columna}`),
          );
        }),
        { seed: 4, numRuns: 200 },
      );
    });

    it('los errores vienen ordenados por línea y luego por columna, y son a lo sumo 20', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const texto = generarTextoConErrores(semilla);
          const { errores } = analizarTexto(texto);
          expect(errores.length).toBeLessThanOrEqual(20);
          for (let i = 1; i < errores.length; i++) {
            const a = errores[i - 1]!;
            const b = errores[i]!;
            const la = a.linea ?? 0;
            const lb = b.linea ?? 0;
            const ordenado = la < lb || (la === lb && (a.columna ?? 0) <= (b.columna ?? 0));
            expect(ordenado).toBe(true);
          }
        }),
        { seed: 5, numRuns: 200 },
      );
    });

    it('nunca lanza excepción ante entrada arbitraria', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 200 }), (texto) => {
          expect(() => analizarTexto(texto)).not.toThrow();
        }),
        { seed: 6, numRuns: 200 },
      );
    });

    it('un programa con más de 20 errores devuelve exactamente 20', () => {
      // 30 palabras desconocidas, cada una en su línea, separadas por un comando
      // válido para que la sincronización reanude y reporte la siguiente.
      // (Sin el comando intermedio, la sincronización saltaría hasta el final
      //  y solo reportaría el primer error, porque busca el siguiente `comando`.)
      const texto = Array.from({ length: 30 }, (_, i) => `PALABRAX${i}\nCENTRO`).join('\n');
      const { programa, errores } = analizarTexto(texto);
      expect(programa).toBeNull();
      expect(errores).toHaveLength(20);
      // Los conservados son los de menor línea, no los de línea mayor: la primera
      // palabra desconocida está en la línea 1 y las siguientes cada dos líneas.
      expect(errores[0]!.linea).toBe(1);
      // El error 20 corresponde a la palabra desconocida número 20 (línea 39).
      for (let i = 1; i < errores.length; i++) {
        expect(errores[i]!.linea).toBeGreaterThanOrEqual(errores[i - 1]!.linea!);
      }
    });
  });

  // ==========================================================================
  // Property 12: Precedencia de los cinco casos del catálogo
  // Valida: Requisitos 10.2, 10.3, 10.4, 10.5, 10.9, 10.10
  // ==========================================================================

  describe('Property 12: precedencia de los cinco casos del catálogo', () => {
    it('coincidencia exacta con comando bloqueado → comandoBloqueado (caso 1)', () => {
      // REPITE es del mundo 1; en el mundo 0 está bloqueado exacto.
      const { errores } = analizarTexto('REPITE 4', 0);
      expect(errores[0]!.id).toBe('comandoBloqueado');
    });

    it('palabra de la tabla de inglés → comandoEnIngles (caso 2, antes que sugerencia)', () => {
      // RT está en la tabla de inglés (→ GIRADERECHA). No debe sugerir RE por distancia.
      const { errores } = analizarTexto('RT 90', 0);
      expect(errores[0]!.id).toBe('comandoEnIngles');
    });

    it('cercano a comando desbloqueado → palabraDesconocidaConSugerencia (caso 3)', () => {
      const { errores } = analizarTexto('AVANSA 100', 0);
      expect(errores[0]!.id).toBe('palabraDesconocidaConSugerencia');
    });

    it('cercano a comando bloqueado → comandoBloqueadoCercano (caso 4)', () => {
      // REPIT se parece a REPITE (mundo 1), y no hay desbloqueado cercano en el mundo 0.
      const { errores } = analizarTexto('REPIT 4', 0);
      expect(errores[0]!.id).toBe('comandoBloqueadoCercano');
    });

    it('nada aplica → palabraDesconocidaSinSugerencia (caso 5)', () => {
      const { errores } = analizarTexto('PINTA 100', 0);
      expect(errores[0]!.id).toBe('palabraDesconocidaSinSugerencia');
    });

    it('exactamente un mensaje por palabra que no se puede ejecutar, sobre 200 semillas', () => {
      const desconocidas = ['AVANSA', 'RT', 'FD', 'REPITE', 'REPIT', 'PINTA', 'XY', 'GIRADRECHA', 'CENTRP'];
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const palabra = prng.elegir(desconocidas);
          const { errores } = analizarTexto(`${palabra} 100`, 0);
          // Exactamente un error para esa palabra (más, quizá, el número suelto tras sincronizar;
          // pero el primer error corresponde a la palabra y es de una de las cinco clases).
          const clasesValidas = new Set([
            'comandoBloqueado',
            'comandoEnIngles',
            'palabraDesconocidaConSugerencia',
            'comandoBloqueadoCercano',
            'palabraDesconocidaSinSugerencia',
          ]);
          expect(clasesValidas.has(errores[0]!.id)).toBe(true);
        }),
        { seed: 7, numRuns: 200 },
      );
    });
  });
});

// ============================================================================
// Ayuda: generar un texto con una mezcla de comandos válidos y errores
// ============================================================================

/**
 * Construye un texto pseudoaleatorio que mezcla comandos válidos del mundo 0,
 * palabras desconocidas, comandos bloqueados y tokens inesperados, repartidos
 * en varias líneas. Sirve para las pruebas de propiedad del análisis de errores.
 */
function generarTextoConErrores(semilla: number): string {
  const prng = crearPrng(semilla);
  const validos = ['AVANZA 100', 'GIRADERECHA 90', 'CENTRO', 'BORRAPANTALLA', 'RETROCEDE 50'];
  const erroneos = ['PINTA', 'AVANSA', 'REPITE', ']', ':x', '"hola', 'RT', 'XY'];

  const lineas = prng.entero(0, 15);
  const piezas: string[] = [];
  for (let i = 0; i < lineas; i++) {
    const usarValido = prng.siguiente() < 0.5;
    if (usarValido) {
      piezas.push(prng.elegir(validos));
    } else {
      piezas.push(prng.elegir(erroneos));
    }
  }
  return piezas.join('\n');
}
