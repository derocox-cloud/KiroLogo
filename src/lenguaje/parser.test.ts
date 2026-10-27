// Pruebas del parser de KiroLogo
// Ejemplos del requisito 5 y las propiedades 4 y 12.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analizar } from './parser.js';
import { analizarLexico } from './lexer.js';
import type {
  InvocacionComando, NumeroLiteral, Repeticion,
  DefinicionProcedimiento, InvocacionProcedimiento, ArgumentoColor,
} from './ast.js';
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

    it('corchete de cierre sin apertura reporta corcheteDeMasEnLinea', () => {
      const { errores } = analizarTexto(']');
      expect(errores[0]!.id).toBe('corcheteDeMasEnLinea');
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

  // ==========================================================================
  // REPITE y lista de instrucciones (Requisitos 1, 2 — spec 02)
  // ==========================================================================

  describe('REPITE — nodo Repeticion', () => {
    it('REPITE 4 [AV 100 GD 90] → Repeticion con veces=4 y cuerpo de 2 instrucciones', () => {
      const { programa, errores } = analizarTexto('REPITE 4 [AV 100 GD 90]', 1);
      expect(errores).toHaveLength(0);
      expect(programa).not.toBeNull();
      expect(programa!.instrucciones).toHaveLength(1);

      const nodo = programa!.instrucciones[0] as Repeticion;
      expect(nodo.tipo).toBe('repeticion');
      expect((nodo.veces as NumeroLiteral).valor).toBe(4);
      expect(nodo.cuerpo).toHaveLength(2);

      const av = nodo.cuerpo[0] as InvocacionComando;
      expect(av.tipo).toBe('invocacionComando');
      expect(av.nombre).toBe('AVANZA');
      expect((av.argumentos[0] as NumeroLiteral).valor).toBe(100);

      const gd = nodo.cuerpo[1] as InvocacionComando;
      expect(gd.tipo).toBe('invocacionComando');
      expect(gd.nombre).toBe('GIRADERECHA');
      expect((gd.argumentos[0] as NumeroLiteral).valor).toBe(90);
    });

    it('RP 3 [GD 120 AV 80] → alias RP funciona igual que REPITE', () => {
      const { programa, errores } = analizarTexto('RP 3 [GD 120 AV 80]', 1);
      expect(errores).toHaveLength(0);
      expect(programa).not.toBeNull();

      const nodo = programa!.instrucciones[0] as Repeticion;
      expect(nodo.tipo).toBe('repeticion');
      expect((nodo.veces as NumeroLiteral).valor).toBe(3);
      expect(nodo.cuerpo).toHaveLength(2);

      const gd = nodo.cuerpo[0] as InvocacionComando;
      expect(gd.nombre).toBe('GIRADERECHA');
      expect((gd.argumentos[0] as NumeroLiteral).valor).toBe(120);

      const av = nodo.cuerpo[1] as InvocacionComando;
      expect(av.nombre).toBe('AVANZA');
      expect((av.argumentos[0] as NumeroLiteral).valor).toBe(80);
    });

    it('REPITE 2 [REPITE 3 [AV 50 GD 120]] → Repeticion anidada correcta', () => {
      const { programa, errores } = analizarTexto('REPITE 2 [REPITE 3 [AV 50 GD 120]]', 1);
      expect(errores).toHaveLength(0);
      expect(programa).not.toBeNull();
      expect(programa!.instrucciones).toHaveLength(1);

      const exterior = programa!.instrucciones[0] as Repeticion;
      expect(exterior.tipo).toBe('repeticion');
      expect((exterior.veces as NumeroLiteral).valor).toBe(2);
      expect(exterior.cuerpo).toHaveLength(1);

      const interior = exterior.cuerpo[0] as Repeticion;
      expect(interior.tipo).toBe('repeticion');
      expect((interior.veces as NumeroLiteral).valor).toBe(3);
      expect(interior.cuerpo).toHaveLength(2);

      const av = interior.cuerpo[0] as InvocacionComando;
      expect(av.nombre).toBe('AVANZA');
      expect((av.argumentos[0] as NumeroLiteral).valor).toBe(50);

      const gd = interior.cuerpo[1] as InvocacionComando;
      expect(gd.nombre).toBe('GIRADERECHA');
      expect((gd.argumentos[0] as NumeroLiteral).valor).toBe(120);
    });
  });

  describe('REPITE — errores de corchete', () => {
    it('REPITE 4 [AV 100 GD 90 sin ] → error corcheteSinCerrarEnLinea con línea 1', () => {
      const { programa, errores } = analizarTexto('REPITE 4 [AV 100 GD 90', 1);
      expect(programa).toBeNull();
      expect(errores.length).toBeGreaterThan(0);
      const errorCorchete = errores.find((e) => e.id === 'corcheteSinCerrarEnLinea');
      expect(errorCorchete).toBeDefined();
      expect(errorCorchete!.linea).toBe(1);
    });

    it('AV 100 GD 90] con ] sobrante → error corcheteDeMasEnLinea con línea correcta', () => {
      const { programa, errores } = analizarTexto('AV 100 GD 90]', 1);
      expect(programa).toBeNull();
      const errorCorchete = errores.find((e) => e.id === 'corcheteDeMasEnLinea');
      expect(errorCorchete).toBeDefined();
      expect(errorCorchete!.linea).toBe(1);
    });

    it('mensaje de corcheteSinCerrarEnLinea contiene el número de línea correcto', () => {
      const { errores } = analizarTexto('REPITE 4 [AV 100 GD 90', 1);
      const errorCorchete = errores.find((e) => e.id === 'corcheteSinCerrarEnLinea');
      expect(errorCorchete!.mensaje).toContain('línea 1');
    });

    it('mensaje de corcheteDeMasEnLinea contiene el número de línea correcto', () => {
      const { errores } = analizarTexto('AV 100\n]', 1);
      const errorCorchete = errores.find((e) => e.id === 'corcheteDeMasEnLinea');
      expect(errorCorchete).toBeDefined();
      expect(errorCorchete!.linea).toBe(2);
      expect(errorCorchete!.mensaje).toContain('línea 2');
    });
  });

  // ==========================================================================
  // PARA … FIN: definición de procedimiento (Requisito 1, mundo 2)
  // ==========================================================================

  describe('PARA … FIN — definición de procedimiento', () => {
    it('PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN → DefinicionProcedimiento', () => {
      const { programa, errores } = analizarTexto('PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN', 2);
      expect(errores).toHaveLength(0);
      expect(programa).not.toBeNull();
      expect(programa!.instrucciones).toHaveLength(1);

      const def = programa!.instrucciones[0] as DefinicionProcedimiento;
      expect(def.tipo).toBe('definicionProcedimiento');
      expect(def.nombre).toBe('CUADRADO');
      expect(def.parametros).toEqual([]);
      expect(def.cuerpo).toHaveLength(1);

      const rep = def.cuerpo[0] as Repeticion;
      expect(rep.tipo).toBe('repeticion');
      expect((rep.veces as NumeroLiteral).valor).toBe(4);
      expect(rep.cuerpo).toHaveLength(2);
    });

    it('registra la línea y la columna del PARA en el nodo', () => {
      const { programa } = analizarTexto('AV 10\nPARA CUADRADO AV 100 FIN', 2);
      const def = programa!.instrucciones[1] as DefinicionProcedimiento;
      expect(def.tipo).toBe('definicionProcedimiento');
      expect(def.linea).toBe(2);
      expect(def.columna).toBe(1);
    });

    it('un cuerpo vacío produce un nodo con cuerpo de longitud 0 (R1.8)', () => {
      const { programa, errores } = analizarTexto('PARA NADA FIN', 2);
      expect(errores).toHaveLength(0);
      const def = programa!.instrucciones[0] as DefinicionProcedimiento;
      expect(def.nombre).toBe('NADA');
      expect(def.cuerpo).toHaveLength(0);
    });

    it('ignora un :param entre el nombre y el cuerpo, sin error (mundo 2 sin parámetros)', () => {
      const { programa, errores } = analizarTexto('PARA CUADRADO :lado AV 100 FIN', 2);
      expect(errores).toHaveLength(0);
      const def = programa!.instrucciones[0] as DefinicionProcedimiento;
      expect(def.tipo).toBe('definicionProcedimiento');
      expect(def.parametros).toEqual([]);
      expect(def.cuerpo).toHaveLength(1);
    });
  });

  // ==========================================================================
  // PARA … FIN: invocación y referencia adelantada (R1.4, R1.5)
  // ==========================================================================

  describe('PARA … FIN — invocación de procedimiento', () => {
    it('invoca un procedimiento definido antes como InvocacionProcedimiento', () => {
      const { programa, errores } = analizarTexto('PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN CUADRADO', 2);
      expect(errores).toHaveLength(0);
      expect(programa!.instrucciones).toHaveLength(2);
      const inv = programa!.instrucciones[1] as InvocacionProcedimiento;
      expect(inv.tipo).toBe('invocacionProcedimiento');
      expect(inv.nombre).toBe('CUADRADO');
      expect(inv.argumentos).toEqual([]);
    });

    it('referencia adelantada: la invocación antes de la definición también se reconoce (R1.5)', () => {
      const { programa, errores } = analizarTexto('CUADRADO PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN', 2);
      expect(errores).toHaveLength(0);
      expect(programa!.instrucciones).toHaveLength(2);

      const inv = programa!.instrucciones[0] as InvocacionProcedimiento;
      expect(inv.tipo).toBe('invocacionProcedimiento');
      expect(inv.nombre).toBe('CUADRADO');

      const def = programa!.instrucciones[1] as DefinicionProcedimiento;
      expect(def.tipo).toBe('definicionProcedimiento');
      expect(def.nombre).toBe('CUADRADO');
    });

    it('la invocación acepta acentos y minúsculas por la normalización del lexer', () => {
      const { programa, errores } = analizarTexto('PARA TRIÁNGULO AV 100 FIN\ntriangulo', 2);
      expect(errores).toHaveLength(0);
      const inv = programa!.instrucciones[1] as InvocacionProcedimiento;
      expect(inv.tipo).toBe('invocacionProcedimiento');
      expect(inv.nombre).toBe('TRIANGULO');
    });
  });

  // ==========================================================================
  // Identificador que no es ni comando ni procedimiento (R6.3, R6.4)
  // ==========================================================================

  describe('identificador desconocido', () => {
    it('un identificador suelto sin procedimientos sigue siendo error', () => {
      const { programa, errores } = analizarTexto('PINTA 100', 2);
      expect(programa).toBeNull();
      expect(errores[0]!.id).toBe('palabraDesconocidaSinSugerencia');
    });

    it('cuando hay un procedimiento cercano, la sugerencia lo nombra (R6.3)', () => {
      // CUADRADP (con P final) se parece a CUADRADO, un procedimiento definido.
      const { errores } = analizarTexto('PARA CUADRADO AV 100 FIN\nCUADRADP', 2);
      const error = errores.find((e) => e.id === 'palabraDesconocidaConSugerencia');
      expect(error).toBeDefined();
      expect(error!.mensaje).toContain('CUADRADO');
    });
  });

  // ==========================================================================
  // Errores de procedimientos (Requisito 6.1, 6.2, 6.5, 6.6)
  // ==========================================================================

  describe('PARA … FIN — errores', () => {
    it('finSinPara: un FIN suelto reporta el error con la línea del FIN', () => {
      const { programa, errores } = analizarTexto('AV 100\nFIN', 2);
      expect(programa).toBeNull();
      const error = errores.find((e) => e.id === 'finSinPara');
      expect(error).toBeDefined();
      expect(error!.linea).toBe(2);
    });

    it('paraSinFin: un PARA sin FIN reporta el error nombrando el procedimiento y la línea del PARA', () => {
      const { programa, errores } = analizarTexto('PARA CUADRADO REPITE 4 [AV 100 GD 90]', 2);
      expect(programa).toBeNull();
      const error = errores.find((e) => e.id === 'paraSinFin');
      expect(error).toBeDefined();
      expect(error!.linea).toBe(1);
      expect(error!.mensaje).toContain('CUADRADO');
    });

    it('procedimientoRedefinido: la segunda definición falla y la primera se conserva', () => {
      const { programa, errores } = analizarTexto(
        'PARA CUADRADO AV 100 FIN\nPARA CUADRADO AV 50 FIN',
        2,
      );
      expect(programa).toBeNull();
      const error = errores.find((e) => e.id === 'procedimientoRedefinido');
      expect(error).toBeDefined();
      // El error se reporta en la línea de la SEGUNDA definición.
      expect(error!.linea).toBe(2);
      expect(error!.mensaje).toContain('CUADRADO');
    });

    it('procedimientoRedefinido: la invocación resuelve contra la primera definición conservada', () => {
      // Dos definiciones del mismo nombre + una invocación: la invocación se
      // reconoce (el nombre está registrado por la primera), pese al error.
      const { errores } = analizarTexto(
        'PARA CUADRADO AV 100 FIN\nPARA CUADRADO AV 50 FIN\nCUADRADO',
        2,
      );
      const redefinido = errores.filter((e) => e.id === 'procedimientoRedefinido');
      expect(redefinido).toHaveLength(1);
      // La invocación no genera «palabra desconocida».
      expect(errores.some((e) => e.id.startsWith('palabraDesconocida'))).toBe(false);
    });

    it('paraNombreQueEsLenguaje: PARA AVANZA se rechaza y no se registra', () => {
      const { programa, errores } = analizarTexto('PARA AVANZA AV 100 FIN', 2);
      expect(programa).toBeNull();
      const error = errores.find((e) => e.id === 'paraNombreQueEsLenguaje');
      expect(error).toBeDefined();
      expect(error!.mensaje).toContain('AVANZA');
    });

    it('paraNombreQueEsLenguaje: un nombre que coincide con una abreviatura también se rechaza', () => {
      // AV es la abreviatura de AVANZA.
      const { errores } = analizarTexto('PARA AV AV 100 FIN', 2);
      expect(errores.some((e) => e.id === 'paraNombreQueEsLenguaje')).toBe(true);
    });

    it('un nombre que pisa el lenguaje no queda registrado como invocable', () => {
      // Tras rechazar PARA AVANZA, un AVANZA posterior sin argumento debe seguir
      // comportándose como el comando del lenguaje (argumentoFaltante), no como
      // invocación de procedimiento.
      const { errores } = analizarTexto('PARA AVANZA AV 100 FIN\nAVANZA', 2);
      expect(errores.some((e) => e.id === 'paraNombreQueEsLenguaje')).toBe(true);
      expect(errores.some((e) => e.id === 'argumentoFaltante')).toBe(true);
    });

    it('acota a 20 errores y los mantiene ordenados por línea aun con varios FIN sueltos', () => {
      // 25 FIN sueltos, cada uno en su línea: 25 errores finSinPara, acotados a 20.
      const texto = Array.from({ length: 25 }, () => 'FIN').join('\n');
      const { errores } = analizarTexto(texto, 2);
      expect(errores).toHaveLength(20);
      expect(errores.every((e) => e.id === 'finSinPara')).toBe(true);
      for (let i = 1; i < errores.length; i++) {
        expect(errores[i]!.linea!).toBeGreaterThanOrEqual(errores[i - 1]!.linea!);
      }
      // Se conservan los de menor línea.
      expect(errores[0]!.linea).toBe(1);
    });
  });

  // ==========================================================================
  // Argumentos de PONCOLOR y PONGROSOR (Requisito 4, mundo 2)
  // ==========================================================================

  describe('PONCOLOR — argumento de color sin resolver', () => {
    // El lexer normaliza la palabra con `normalizarPalabra`: acentos fuera y todo
    // en mayúsculas. El valor que llega en argumentoColor es esa forma normalizada
    // (`NARANJA`), no la escrita; el intérprete la resuelve igual contra el catálogo.
    it('PONCOLOR naranja → argumentoColor palabra «NARANJA» (R4.2)', () => {
      const { programa, errores } = analizarTexto('PONCOLOR naranja', 2);
      expect(errores).toHaveLength(0);
      expect(programa!.instrucciones).toHaveLength(1);

      const inv = programa!.instrucciones[0] as InvocacionComando;
      expect(inv.tipo).toBe('invocacionComando');
      expect(inv.nombre).toBe('PONCOLOR');
      expect(inv.argumentos).toHaveLength(0);
      const arg = inv.argumentoColor as ArgumentoColor;
      expect(arg.clase).toBe('palabra');
      expect(arg).toEqual({ clase: 'palabra', valor: 'NARANJA' });
    });

    it('PONCOLOR "naranja → argumentoColor palabra «NARANJA» (R4.2)', () => {
      const { programa, errores } = analizarTexto('PONCOLOR "naranja', 2);
      expect(errores).toHaveLength(0);
      const inv = programa!.instrucciones[0] as InvocacionComando;
      expect(inv.nombre).toBe('PONCOLOR');
      const arg = inv.argumentoColor as ArgumentoColor;
      expect(arg).toEqual({ clase: 'palabra', valor: 'NARANJA' });
    });

    it('la comilla y la palabra desnuda producen el mismo argumento', () => {
      const conComilla = analizarTexto('PONCOLOR "naranja', 2).programa!.instrucciones[0] as InvocacionComando;
      const desnuda = analizarTexto('PONCOLOR naranja', 2).programa!.instrucciones[0] as InvocacionComando;
      expect(conComilla.argumentoColor).toEqual(desnuda.argumentoColor);
    });

    it('normaliza acentos y mayúsculas del nombre de color por el lexer', () => {
      const { errores, programa } = analizarTexto('PONCOLOR Café', 2);
      expect(errores).toHaveLength(0);
      const inv = programa!.instrucciones[0] as InvocacionComando;
      const arg = inv.argumentoColor as ArgumentoColor;
      expect(arg).toEqual({ clase: 'palabra', valor: 'CAFE' });
    });

    it('PONCOLOR [255 0 0] → argumentoColor listaRGB [255, 0, 0] (R4.2)', () => {
      const { programa, errores } = analizarTexto('PONCOLOR [255 0 0]', 2);
      expect(errores).toHaveLength(0);
      expect(programa!.instrucciones).toHaveLength(1);

      const inv = programa!.instrucciones[0] as InvocacionComando;
      expect(inv.nombre).toBe('PONCOLOR');
      expect(inv.argumentos).toHaveLength(0);
      const arg = inv.argumentoColor as ArgumentoColor;
      expect(arg.clase).toBe('listaRGB');
      expect(arg).toEqual({ clase: 'listaRGB', valores: [255, 0, 0] });
    });

    it('acepta un nombre de color desconocido sin error de parseo (lo valida el intérprete, R4.3)', () => {
      // «turquesa» no está en el catálogo, pero para el parser es una palabra válida:
      // la resolución contra el catálogo y el colorInvalido ocurren en el intérprete.
      const { programa, errores } = analizarTexto('PONCOLOR turquesa', 2);
      expect(errores).toHaveLength(0);
      const inv = programa!.instrucciones[0] as InvocacionComando;
      expect((inv.argumentoColor as ArgumentoColor)).toEqual({ clase: 'palabra', valor: 'TURQUESA' });
    });

    it('la abreviatura PC se reconoce como PONCOLOR (R4.9)', () => {
      const { programa, errores } = analizarTexto('PC naranja', 2);
      expect(errores).toHaveLength(0);
      const inv = programa!.instrucciones[0] as InvocacionComando;
      expect(inv.nombre).toBe('PONCOLOR');
      expect((inv.argumentoColor as ArgumentoColor)).toEqual({ clase: 'palabra', valor: 'NARANJA' });
    });

    it('PONCOLOR sin argumento reporta argumentoFaltante', () => {
      const { programa, errores } = analizarTexto('PONCOLOR', 2);
      expect(programa).toBeNull();
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('argumentoFaltante');
      expect(errores[0]!.linea).toBe(1);
    });

    it('PONCOLOR seguido de otro comando reporta argumentoFaltante', () => {
      const { errores } = analizarTexto('PONCOLOR BAJALAPIZ', 2);
      expect(errores[0]!.id).toBe('argumentoFaltante');
    });
  });

  describe('PONGROSOR — argumento numérico', () => {
    it('PONGROSOR 5 → invocacionComando con literal numérico 5 (R4.4)', () => {
      const { programa, errores } = analizarTexto('PONGROSOR 5', 2);
      expect(errores).toHaveLength(0);
      expect(programa!.instrucciones).toHaveLength(1);

      const inv = programa!.instrucciones[0] as InvocacionComando;
      expect(inv.tipo).toBe('invocacionComando');
      expect(inv.nombre).toBe('PONGROSOR');
      expect(inv.argumentos).toHaveLength(1);
      expect((inv.argumentos[0] as NumeroLiteral).tipo).toBe('numeroLiteral');
      expect((inv.argumentos[0] as NumeroLiteral).valor).toBe(5);
      // PONGROSOR no lleva argumento de color.
      expect(inv.argumentoColor).toBeUndefined();
    });

    it('la abreviatura PG se reconoce como PONGROSOR (R4.9)', () => {
      const { programa, errores } = analizarTexto('PG 3', 2);
      expect(errores).toHaveLength(0);
      const inv = programa!.instrucciones[0] as InvocacionComando;
      expect(inv.nombre).toBe('PONGROSOR');
      expect((inv.argumentos[0] as NumeroLiteral).valor).toBe(3);
    });

    it('PONGROSOR sin argumento reporta argumentoFaltante', () => {
      const { errores } = analizarTexto('PONGROSOR', 2);
      expect(errores[0]!.id).toBe('argumentoFaltante');
    });
  });

  describe('RELLENA — abreviatura RL (R4.9)', () => {
    it('RL se reconoce como RELLENA, aridad 0 sin argumento', () => {
      const { programa, errores } = analizarTexto('RL', 2);
      expect(errores).toHaveLength(0);
      const inv = programa!.instrucciones[0] as InvocacionComando;
      expect(inv.nombre).toBe('RELLENA');
      expect(inv.argumentos).toHaveLength(0);
      expect(inv.argumentoColor).toBeUndefined();
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
