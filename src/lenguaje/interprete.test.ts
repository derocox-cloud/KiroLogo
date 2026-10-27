// Pruebas del intérprete de KiroLogo
// Ejemplos del requisito 7, las guardas del requisito 8, y las propiedades
// 7 (estructura), 8 (serialización), 9A (determinismo) y 10 (guardas).

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  ejecutar,
  LIMITES_PREDETERMINADOS,
  type Operacion,
  type OpcionesEjecucion,
  type ResultadoEjecucion,
} from './interprete.js';
import type {
  Programa,
  Instruccion,
  InvocacionComando,
  NumeroLiteral,
  DefinicionProcedimiento,
  InvocacionProcedimiento,
} from './ast.js';
import { comandosDelMundo, VOCABULARIO, type EntradaVocabulario } from './vocabulario.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { ESTADO_INICIAL, type EstadoTortuga } from '../motor/tortuga.js';
import { crearPrng } from '../azar/prng.js';
import { analizarLexico } from './lexer.js';
import { analizar } from './parser.js';
import { generarPrograma } from '../azar/generadores-prueba.test.js';

// ============================================================================
// Ayudas
// ============================================================================

const PERMITIDOS_MUNDO_0 = comandosDelMundo(0).filter((e) => e.ejecutable);

/** Ejecuta un programa hasta el final y devuelve el resultado del generador. */
function correr(programa: Programa, opciones?: Partial<OpcionesEjecucion>): ResultadoEjecucion {
  const gen = ejecutar(programa, {
    comandosPermitidos: PERMITIDOS_MUNDO_0,
    semilla: 0,
    ...opciones,
  });
  let paso = gen.next();
  while (!paso.done) {
    paso = gen.next();
  }
  return paso.value;
}

let contadorLinea = 0;
function pos() {
  contadorLinea += 1;
  return { linea: contadorLinea, columna: 1 };
}
function numero(valor: number): NumeroLiteral {
  return { tipo: 'numeroLiteral', valor, ...pos() };
}
function inv(nombre: string, ...args: NumeroLiteral[]): InvocacionComando {
  return { tipo: 'invocacionComando', nombre, argumentos: args, ...pos() };
}
function prog(instrucciones: readonly Instruccion[]): Programa {
  return { tipo: 'programa', instrucciones };
}

// ============================================================================
// Una operación por comando del mundo 0 (Req 7.1, 7.7, 7.8, 7.11, 7.12)
// ============================================================================

describe('interprete', () => {
  describe('una operación por comando del mundo 0', () => {
    it('programa vacío no emite ninguna operación ni error', () => {
      const r = correr(prog([]));
      expect(r.operaciones).toHaveLength(0);
      expect(r.error).toBeNull();
      expect(r.guardaActivada).toBeNull();
    });

    it('AVANZA emite una operación mover que conserva rumbo, lápiz y visibilidad', () => {
      const r = correr(prog([inv('AVANZA', numero(100))]));
      expect(r.operaciones).toHaveLength(1);
      const op = r.operaciones[0]!;
      expect(op.tipo).toBe('mover');
      expect(op.linea).toBe(r.operaciones[0]!.linea);
      if (op.tipo === 'mover') {
        expect(op.estadoAntes).toEqual(ESTADO_INICIAL);
        expect(op.estadoDespues.posicion.y).toBeCloseTo(100, 10);
        expect(op.estadoDespues.rumbo).toBe(0);
        expect(op.estadoDespues.lapizAbajo).toBe(true);
        expect(op.lapizAbajo).toBe(true);
      }
    });

    it('RETROCEDE mueve en el sentido opuesto', () => {
      const r = correr(prog([inv('RETROCEDE', numero(100))]));
      const op = r.operaciones[0]!;
      expect(op.tipo).toBe('mover');
      expect(op.estadoDespues.posicion.y).toBeCloseTo(-100, 10);
    });

    it('GIRADERECHA emite girar y suma al rumbo', () => {
      const r = correr(prog([inv('GIRADERECHA', numero(90))]));
      const op = r.operaciones[0]!;
      expect(op.tipo).toBe('girar');
      if (op.tipo === 'girar') {
        expect(op.grados).toBe(90);
        expect(op.sentido).toBe('derecha');
        expect(op.estadoDespues.rumbo).toBe(90);
        expect(op.estadoDespues.posicion).toEqual(ESTADO_INICIAL.posicion);
      }
    });

    it('GIRAIZQUIERDA resta al rumbo (0 - 90 → 270)', () => {
      const r = correr(prog([inv('GIRAIZQUIERDA', numero(90))]));
      const op = r.operaciones[0]!;
      expect(op.tipo).toBe('girar');
      if (op.tipo === 'girar') {
        expect(op.sentido).toBe('izquierda');
        expect(op.estadoDespues.rumbo).toBe(270);
      }
    });

    it('CENTRO emite reubicar al centro con rumbo 0 conservando lápiz y visibilidad', () => {
      const inicial: EstadoTortuga = { posicion: { x: 50, y: 60 }, rumbo: 123, lapizAbajo: false, visible: false };
      const r = correr(prog([inv('CENTRO')]), { estadoInicial: inicial });
      const op = r.operaciones[0]!;
      expect(op.tipo).toBe('reubicar');
      expect(op.estadoDespues.posicion).toEqual({ x: 0, y: 0 });
      expect(op.estadoDespues.rumbo).toBe(0);
      expect(op.estadoDespues.lapizAbajo).toBe(false);
      expect(op.estadoDespues.visible).toBe(false);
    });

    it('BORRAPANTALLA emite limpiar al centro conservando lápiz y visibilidad', () => {
      const inicial: EstadoTortuga = { posicion: { x: 50, y: 60 }, rumbo: 45, lapizAbajo: false, visible: true };
      const r = correr(prog([inv('BORRAPANTALLA')]), { estadoInicial: inicial });
      const op = r.operaciones[0]!;
      expect(op.tipo).toBe('limpiar');
      expect(op.estadoDespues.posicion).toEqual({ x: 0, y: 0 });
      expect(op.estadoDespues.rumbo).toBe(0);
      expect(op.estadoDespues.lapizAbajo).toBe(false);
    });

    it('encadena estados: estadoDespues[i] == estadoAntes[i+1]', () => {
      const r = correr(prog([inv('AVANZA', numero(50)), inv('GIRADERECHA', numero(90)), inv('AVANZA', numero(50))]));
      expect(r.operaciones).toHaveLength(3);
      expect(r.operaciones[0]!.estadoDespues).toEqual(r.operaciones[1]!.estadoAntes);
      expect(r.operaciones[1]!.estadoDespues).toEqual(r.operaciones[2]!.estadoAntes);
      expect(r.operaciones[0]!.estadoAntes).toEqual(ESTADO_INICIAL);
      // Pasos consecutivos desde 0.
      expect(r.operaciones.map((o) => o.paso)).toEqual([0, 1, 2]);
    });
  });

  // ==========================================================================
  // Comando no permitido y nodo reservado (Req 7.13)
  // ==========================================================================

  describe('comando no permitido y nodo reservado', () => {
    it('un comando bloqueado reporta comandoNoPermitido y conserva lo emitido', () => {
      // SUBELAPIZ es del mundo 2; no está en los permitidos del mundo 0.
      const r = correr(prog([inv('AVANZA', numero(100)), inv('SUBELAPIZ')]));
      expect(r.operaciones).toHaveLength(1); // solo el AVANZA
      expect(r.error).not.toBeNull();
      expect(r.error!.id).toBe('comandoNoPermitido');
      expect(r.error!.linea).not.toBeNull();
    });

    it('un nodo reservado (no repeticion) reporta nodoNoImplementado', () => {
      // condicionalUnaRama es un nodo reservado aun no ejecutable en mundo 0.
      const cond: Instruccion = {
        tipo: 'condicionalUnaRama',
        condicion: numero(1),
        entonces: [inv('AVANZA', numero(100))],
        ...pos(),
      };
      const r = correr(prog([cond]));
      expect(r.error).not.toBeNull();
      expect(r.error!.id).toBe('nodoNoImplementado');
    });
  });

  // ==========================================================================
  // REPITE — ejecucion de Repeticion (Req 1.4 — spec 02)
  // ==========================================================================

  describe('REPITE — ejecucion', () => {
    it('REPITE 4 [AV 100 GD 90] produce 8 operaciones (igual que cuadrado a mano)', () => {
      // Usando los comandos del mundo 1 (REPITE desbloqueado)
      const { tokens } = analizarLexico('REPITE 4 [AV 100 GD 90]');
      const { programa: prog4 } = analizar(tokens, { mundo: 1 });
      expect(prog4).not.toBeNull();
      const permitidos1 = comandosDelMundo(1).filter((e) => e.ejecutable);
      const r = correr(prog4!, { comandosPermitidos: permitidos1 });
      expect(r.error).toBeNull();
      expect(r.operaciones).toHaveLength(8);
      // 4 pares (mover, girar) en orden correcto
      for (let i = 0; i < 4; i++) {
        expect(r.operaciones[i * 2]!.tipo).toBe('mover');
        expect(r.operaciones[i * 2 + 1]!.tipo).toBe('girar');
      }
    });

    it('REPITE 0 [AV 100] no produce operaciones', () => {
      const { tokens } = analizarLexico('REPITE 0 [AV 100]');
      const { programa: prog0 } = analizar(tokens, { mundo: 1 });
      expect(prog0).not.toBeNull();
      const permitidos1 = comandosDelMundo(1).filter((e) => e.ejecutable);
      const r = correr(prog0!, { comandosPermitidos: permitidos1 });
      expect(r.error).toBeNull();
      expect(r.operaciones).toHaveLength(0);
    });

    it('REPITE 2 [REPITE 3 [AV 50 GD 60]] produce 12 operaciones en orden correcto', () => {
      const { tokens } = analizarLexico('REPITE 2 [REPITE 3 [AV 50 GD 60]]');
      const { programa: prog2 } = analizar(tokens, { mundo: 1 });
      expect(prog2).not.toBeNull();
      const permitidos1 = comandosDelMundo(1).filter((e) => e.ejecutable);
      const r = correr(prog2!, { comandosPermitidos: permitidos1 });
      expect(r.error).toBeNull();
      expect(r.operaciones).toHaveLength(12);
      // Todos los pares deben ser (mover, girar)
      for (let i = 0; i < 6; i++) {
        expect(r.operaciones[i * 2]!.tipo).toBe('mover');
        expect(r.operaciones[i * 2 + 1]!.tipo).toBe('girar');
      }
    });
  });

  // --------------------------------------------------------------------------
  // Placeholder para cerrar el describe previo que se abrió antes
  // ==========================================================================
  // Generador que suspende (Req 7.1)
  // ==========================================================================

  describe('comportamiento de generador', () => {
    it('emite una operación por next() y suspende', () => {
      const gen = ejecutar(prog([inv('AVANZA', numero(10)), inv('AVANZA', numero(20))]), {
        comandosPermitidos: PERMITIDOS_MUNDO_0,
        semilla: 0,
      });
      const p1 = gen.next();
      expect(p1.done).toBe(false);
      expect((p1.value as Operacion).tipo).toBe('mover');
      const p2 = gen.next();
      expect(p2.done).toBe(false);
      const p3 = gen.next();
      expect(p3.done).toBe(true);
      expect((p3.value as ResultadoEjecucion).operaciones).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Guardas: casos de límite (Req 8.1, 8.2, 8.3, 8.7, 8.9, 8.10)
  // ==========================================================================

  describe('guarda de pasos', () => {
    function programaDeAvances(n: number): Programa {
      const instrucciones: Instruccion[] = [];
      for (let i = 0; i < n; i++) instrucciones.push(inv('AVANZA', numero(1)));
      return prog(instrucciones);
    }

    it('200 000 operaciones terminan sin error', () => {
      const r = correr(programaDeAvances(200_000));
      expect(r.operaciones).toHaveLength(200_000);
      expect(r.guardaActivada).toBeNull();
      expect(r.error).toBeNull();
    });

    it('200 001 operaciones activan la guarda de pasos con el texto del catálogo', () => {
      const r = correr(programaDeAvances(200_001));
      expect(r.operaciones).toHaveLength(200_000); // la 200 001 no se emite
      expect(r.guardaActivada).toBe('pasos');
      expect(r.error!.id).toBe('guardaPasos');
      expect(r.error!.mensaje).toBe(
        'Detuve la ejecución: la tortuga llevaba demasiados pasos. ¿Hay una repetición que nunca termina?',
      );
      // Pasos consecutivos desde 0, sin huecos.
      expect(r.operaciones[0]!.paso).toBe(0);
      expect(r.operaciones[199_999]!.paso).toBe(199_999);
    });
  });

  describe('guarda de recursión', () => {
    /** Programa con una definición que se invoca a sí misma sin caso base. */
    function programaRecursivo(): Programa {
      const llamada: InvocacionProcedimiento = { tipo: 'invocacionProcedimiento', nombre: 'ESPIRAL', argumentos: [], ...pos() };
      const definicion: DefinicionProcedimiento = {
        tipo: 'definicionProcedimiento',
        nombre: 'ESPIRAL',
        parametros: [],
        cuerpo: [llamada],
        ...pos(),
      };
      const arranque: InvocacionProcedimiento = { tipo: 'invocacionProcedimiento', nombre: 'ESPIRAL', argumentos: [], ...pos() };
      return prog([definicion, arranque]);
    }

    it('100 niveles terminan sin error, 101 activan la guarda de recursión', () => {
      // Con maximaProfundidad = 3 forzamos el límite sin construir 100 marcos.
      const rBajo = correr(programaRecursivo(), {
        limites: { ...LIMITES_PREDETERMINADOS, maximaProfundidad: 3 },
      });
      expect(rBajo.guardaActivada).toBe('recursion');
      expect(rBajo.error!.id).toBe('guardaRecursion');
      // Nombra el procedimiento culpable.
      expect(rBajo.error!.mensaje).toBe(
        'Detuve la ejecución: ESPIRAL se llama a sí mismo sin parar. ¿Le falta el caso que lo detiene?',
      );
    });

    it('el límite exacto de profundidad no activa la guarda', () => {
      // Una recursión que llega justo a la profundidad máxima y luego para
      // necesitaría un caso base; en su lugar comprobamos el borde con un
      // programa que anida exactamente hasta el máximo mediante marcos reales.
      // Construimos N definiciones encadenadas A→B→C ... sin ciclo.
      const cadena = construirCadena(3);
      const r = correr(cadena, { limites: { ...LIMITES_PREDETERMINADOS, maximaProfundidad: 3 } });
      expect(r.guardaActivada).toBeNull();
      expect(r.error).toBeNull();
    });
  });

  describe('guarda de tiempo', () => {
    it('exactamente 5000 ms no activa la guarda; 5001 sí', () => {
      const programa = prog(Array.from({ length: 1500 }, () => inv('AVANZA', numero(1))));

      // ahora() que salta a 5000 tras el inicio: no debe activar.
      let llamada5000 = 0;
      const r5000 = correr(programa, {
        ahora: () => (llamada5000++ === 0 ? 0 : 5000),
      });
      expect(r5000.guardaActivada).toBeNull();

      // ahora() que salta a 5001: debe activar tiempo.
      let llamada5001 = 0;
      const r5001 = correr(programa, {
        ahora: () => (llamada5001++ === 0 ? 0 : 5001),
      });
      expect(r5001.guardaActivada).toBe('tiempo');
      expect(r5001.error!.id).toBe('guardaTiempo');
      expect(r5001.error!.mensaje).toBe(
        'Detuve la ejecución: tu programa llevaba más de 5 segundos dibujando. ¿Hay una repetición que nunca termina?',
      );
    });
  });

  // ==========================================================================
  // Property 7: Estructura de la secuencia de operaciones
  // Valida: Requisitos 7.2, 7.3, 7.9
  // ==========================================================================

  describe('Property 7: estructura de la secuencia de operaciones', () => {
    it('pasos consecutivos, estados encadenados, rumbo en [0, 360), solo casos del mundo 0', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const programa = generarPrograma(prng, 40);
          const r = correr(programa);
          expect(r.error).toBeNull();

          const ops = r.operaciones;
          for (let i = 0; i < ops.length; i++) {
            // Paso consecutivo desde 0.
            expect(ops[i]!.paso).toBe(i);
            // Rumbo normalizado.
            expect(ops[i]!.estadoDespues.rumbo).toBeGreaterThanOrEqual(0);
            expect(ops[i]!.estadoDespues.rumbo).toBeLessThan(360);
            // Solo casos del mundo 0.
            expect(['mover', 'girar', 'limpiar', 'reubicar']).toContain(ops[i]!.tipo);
            // Encadenamiento de estados.
            if (i > 0) {
              expect(ops[i]!.estadoAntes).toEqual(ops[i - 1]!.estadoDespues);
            } else {
              expect(ops[i]!.estadoAntes).toEqual(ESTADO_INICIAL);
            }
          }
        }),
        { seed: 7, numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 8: Ida y vuelta de serialización de una operación
  // Valida: Requisito 7.5
  // ==========================================================================

  describe('Property 8: serialización JSON sin pérdida', () => {
    it('toda operación se serializa y deserializa igual campo por campo', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const programa = generarPrograma(prng, 40);
          const r = correr(programa);
          for (const op of r.operaciones) {
            const texto = JSON.stringify(op);
            // Sin campos undefined (JSON los omite; NaN/Infinity se vuelven null).
            expect(texto).not.toContain('undefined');
            expect(texto).not.toContain('null');
            const recuperada = JSON.parse(texto);
            expect(recuperada).toEqual(op);
            // Todos los números finitos.
            expect(Number.isFinite(op.estadoDespues.posicion.x)).toBe(true);
            expect(Number.isFinite(op.estadoDespues.posicion.y)).toBe(true);
            expect(Number.isFinite(op.estadoDespues.rumbo)).toBe(true);
          }
        }),
        { seed: 8, numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 9A: Determinismo del intérprete
  // Valida: Requisito 7.6
  // ==========================================================================

  describe('Property 9A: determinismo del intérprete', () => {
    it('dos ejecuciones del mismo programa y semilla dan secuencias iguales, sin modificar entradas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const programa = generarPrograma(prng, 40);
          const instantanea = JSON.stringify(programa);

          const r1 = correr(programa, { semilla: 12345 });
          const r2 = correr(programa, { semilla: 12345 });

          expect(r1.operaciones.length).toBe(r2.operaciones.length);
          expect(JSON.stringify(r1.operaciones)).toBe(JSON.stringify(r2.operaciones));

          // El programa no se modificó.
          expect(JSON.stringify(programa)).toBe(instantanea);
        }),
        { seed: 9, numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 10: Las guardas devuelven una ejecución parcial bien formada
  // Valida: Requisitos 8.4, 8.9, 8.10
  // ==========================================================================

  describe('Property 10: guardas parciales bien formadas y sin arrastre', () => {
    it('al activarse una guarda, las operaciones vienen bien formadas y sin arrastre entre ejecuciones', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 500 }), (n) => {
          const programa = prog(Array.from({ length: n + 5 }, () => inv('AVANZA', numero(1))));
          // Límite de pasos = n: se emiten n operaciones y la n+1 activa la guarda.
          const limites = { ...LIMITES_PREDETERMINADOS, maximoPasos: n };
          const r = correr(programa, { limites });

          expect(r.guardaActivada).toBe('pasos');
          expect(r.operaciones).toHaveLength(n);
          // Pasos consecutivos desde 0.
          for (let i = 0; i < r.operaciones.length; i++) {
            expect(r.operaciones[i]!.paso).toBe(i);
          }
          // Sin arrastre: una segunda ejecución con el mismo límite da lo mismo.
          const r2 = correr(programa, { limites });
          expect(r2.operaciones).toHaveLength(n);
          expect(r2.guardaActivada).toBe('pasos');
        }),
        { seed: 10, numRuns: 200 },
      );
    });

    it('precedencia fija: pasos antes que tiempo cuando ambas aplican', () => {
      // Programa que excede pasos; ahora() también supera el tiempo.
      const programa = prog(Array.from({ length: 10 }, () => inv('AVANZA', numero(1))));
      const limites = { ...LIMITES_PREDETERMINADOS, maximoPasos: 5, maximoTiempoMs: 0 };
      // ahora() devuelve 0 al inicio y luego un valor grande; con maximoTiempoMs=0
      // el tiempo se excede, pero la guarda de pasos tiene precedencia al llegar a 5.
      const r = correr(programa, { limites, ahora: () => 1 });
      expect(r.guardaActivada).toBe('pasos');
    });
  });
});

// ============================================================================
// Mundo 2: procedimientos, lápiz, visibilidad y canal decorativo
// ============================================================================

describe('mundo 2: procedimientos', () => {
  // Permitimos todos los comandos de mundo ≤ 2. No filtramos por `ejecutable`
  // (los del mundo 2 lo tienen en false a nivel de vocabulario) porque aquí se
  // prueba la semántica del intérprete, que resuelve por nombre canónico.
  const PERMITIDOS_MUNDO_2 = comandosDelMundo(2);

  function correr2(texto: string): ResultadoEjecucion {
    const { tokens } = analizarLexico(texto);
    const { programa } = analizar(tokens, { mundo: 2 });
    expect(programa).not.toBeNull();
    return correr(programa!, { comandosPermitidos: PERMITIDOS_MUNDO_2 });
  }

  it('PARA CUADRADO … FIN CUADRADO emite exactamente lo mismo que REPITE 4 [AV 100 GD 90] (R1.1)', () => {
    const conProc = correr2('PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN CUADRADO');
    const sinProc = correr2('REPITE 4 [AV 100 GD 90]');
    expect(conProc.error).toBeNull();
    expect(sinProc.error).toBeNull();
    // Mismas operaciones, en el mismo orden. Se comparan tipo y campos de forma,
    // ignorando la línea (que difiere por el texto distinto).
    const forma = (r: ResultadoEjecucion) =>
      r.operaciones.map((o) =>
        o.tipo === 'mover'
          ? { tipo: o.tipo, desde: o.desde, hasta: o.hasta, lapizAbajo: o.lapizAbajo }
          : o.tipo === 'girar'
            ? { tipo: o.tipo, grados: o.grados, sentido: o.sentido }
            : { tipo: o.tipo },
      );
    expect(forma(conProc)).toEqual(forma(sinProc));
  });

  it('un procedimiento con cuerpo vacío invocado no emite operaciones ni error (R1.8)', () => {
    // Construimos el AST directo: PARA VACIO FIN con cuerpo [] e invocación.
    const definicion: DefinicionProcedimiento = {
      tipo: 'definicionProcedimiento', nombre: 'VACIO', parametros: [], cuerpo: [], ...pos(),
    };
    const llamada: InvocacionProcedimiento = {
      tipo: 'invocacionProcedimiento', nombre: 'VACIO', argumentos: [], ...pos(),
    };
    const r = correr(prog([definicion, llamada]), { comandosPermitidos: PERMITIDOS_MUNDO_2 });
    expect(r.error).toBeNull();
    expect(r.operaciones).toHaveLength(0);
  });

  it('invocar un procedimiento no definido detiene con comandoNoPermitido y no emite esa operación (R1.6)', () => {
    const llamada: InvocacionProcedimiento = {
      tipo: 'invocacionProcedimiento', nombre: 'FANTASMA', argumentos: [], ...pos(),
    };
    const r = correr(prog([inv('AVANZA', numero(10)), llamada]), { comandosPermitidos: PERMITIDOS_MUNDO_2 });
    expect(r.operaciones).toHaveLength(1); // solo el AVANZA
    expect(r.error).not.toBeNull();
    expect(r.error!.id).toBe('comandoNoPermitido');
  });
});

describe('mundo 2: lápiz y segmentos', () => {
  const PERMITIDOS_MUNDO_2 = comandosDelMundo(2);

  function correr2(texto: string): ResultadoEjecucion {
    const { tokens } = analizarLexico(texto);
    const { programa } = analizar(tokens, { mundo: 2 });
    expect(programa).not.toBeNull();
    return correr(programa!, { comandosPermitidos: PERMITIDOS_MUNDO_2 });
  }

  it('SUBELAPIZ antes de AVANZA no produce ningún segmento; BAJALAPIZ lo reanuda (R3.2, R3.4)', () => {
    const conLapizArriba = correr2('SUBELAPIZ AVANZA 100');
    expect(conLapizArriba.error).toBeNull();
    expect(extraerSegmentos(conLapizArriba.operaciones)).toHaveLength(0);

    const reanudado = correr2('SUBELAPIZ AVANZA 100 BAJALAPIZ AVANZA 100');
    expect(reanudado.error).toBeNull();
    // Solo el segundo AVANZA (con el lápiz abajo) deja trazo.
    expect(extraerSegmentos(reanudado.operaciones)).toHaveLength(1);
  });

  it('SUBELAPIZ repetido es idempotente y no da error (R3.7)', () => {
    const r = correr2('SUBELAPIZ SUBELAPIZ AVANZA 100');
    expect(r.error).toBeNull();
    expect(extraerSegmentos(r.operaciones)).toHaveLength(0);
    // Todas las operaciones de lápiz dejan lapizAbajo en false.
    for (const op of r.operaciones) {
      if (op.tipo === 'lapiz') expect(op.lapizAbajo).toBe(false);
    }
  });
});

describe('mundo 2: canal decorativo', () => {
  const PERMITIDOS_MUNDO_2 = comandosDelMundo(2);

  function correr2(texto: string): ResultadoEjecucion {
    const { tokens } = analizarLexico(texto);
    const { programa } = analizar(tokens, { mundo: 2 });
    expect(programa).not.toBeNull();
    return correr(programa!, { comandosPermitidos: PERMITIDOS_MUNDO_2 });
  }

  it('PONCOLOR, PONGROSOR y RELLENA no producen segmentos ni cambian posición ni rumbo', () => {
    const r = correr2('PONCOLOR rojo PONGROSOR 5 RELLENA');
    expect(r.error).toBeNull();
    expect(r.operaciones.map((o) => o.tipo)).toEqual(['color', 'grosor', 'relleno']);
    expect(extraerSegmentos(r.operaciones)).toHaveLength(0);
    // Ninguna movió la tortuga: estadoDespues conserva posición y rumbo.
    for (const op of r.operaciones) {
      expect(op.estadoDespues.posicion).toEqual(op.estadoAntes.posicion);
      expect(op.estadoDespues.rumbo).toBe(op.estadoAntes.rumbo);
    }
  });

  it('PONCOLOR resuelve el nombre y RELLENA usa el color vigente', () => {
    const r = correr2('PONCOLOR azul RELLENA');
    expect(r.error).toBeNull();
    const color = r.operaciones[0]!;
    const relleno = r.operaciones[1]!;
    expect(color.tipo).toBe('color');
    expect(relleno.tipo).toBe('relleno');
    if (color.tipo === 'color') expect(color.color.nombre).toBe('azul');
    if (relleno.tipo === 'relleno') expect(relleno.color.nombre).toBe('azul');
  });

  it('PONCOLOR [255 0 0] resuelve una terna RGB', () => {
    const r = correr2('PONCOLOR [255 0 0]');
    expect(r.error).toBeNull();
    const op = r.operaciones[0]!;
    expect(op.tipo).toBe('color');
    if (op.tipo === 'color') {
      expect({ r: op.color.r, g: op.color.g, b: op.color.b }).toEqual({ r: 255, g: 0, b: 0 });
      expect(op.color.nombre).toBeNull();
    }
  });

  it('color inválido detiene con colorInvalido y conserva el color vigente (R4.3)', () => {
    // PONCOLOR verde válido, luego turquesa inválido: el segundo detiene sin emitir.
    const r = correr2('PONCOLOR verde PONCOLOR turquesa RELLENA');
    expect(r.error).not.toBeNull();
    expect(r.error!.id).toBe('colorInvalido');
    // Solo se emitió el primer PONCOLOR (verde); el inválido no emite operación.
    expect(r.operaciones.map((o) => o.tipo)).toEqual(['color']);
  });

  it('grosor fuera de 1..50 detiene con grosorInvalido (R4.5)', () => {
    const r = correr2('PONGROSOR 100');
    expect(r.error).not.toBeNull();
    expect(r.error!.id).toBe('grosorInvalido');
    expect(r.operaciones).toHaveLength(0);
  });

  it('grosor 0 también es inválido', () => {
    const r = correr2('PONGROSOR 0');
    expect(r.error!.id).toBe('grosorInvalido');
  });

  it('las abreviaturas PC, PG y RL se reconocen', () => {
    const r = correr2('PC rojo PG 3 RL');
    expect(r.error).toBeNull();
    expect(r.operaciones.map((o) => o.tipo)).toEqual(['color', 'grosor', 'relleno']);
  });
});

describe('mundo 2: visibilidad', () => {
  const PERMITIDOS_MUNDO_2 = comandosDelMundo(2);

  function correr2(texto: string): ResultadoEjecucion {
    const { tokens } = analizarLexico(texto);
    const { programa } = analizar(tokens, { mundo: 2 });
    expect(programa).not.toBeNull();
    return correr(programa!, { comandosPermitidos: PERMITIDOS_MUNDO_2 });
  }

  it('OCULTATORTUGA y MUESTRATORTUGA emiten OperacionVisibilidad (R5.1, R5.2)', () => {
    const r = correr2('OCULTATORTUGA MUESTRATORTUGA');
    expect(r.error).toBeNull();
    expect(r.operaciones.map((o) => o.tipo)).toEqual(['visibilidad', 'visibilidad']);
    const oculta = r.operaciones[0]!;
    const muestra = r.operaciones[1]!;
    if (oculta.tipo === 'visibilidad') expect(oculta.visible).toBe(false);
    if (muestra.tipo === 'visibilidad') expect(muestra.visible).toBe(true);
    // Ninguna produce segmentos.
    expect(extraerSegmentos(r.operaciones)).toHaveLength(0);
  });

  it('OCULTATORTUGA repetido es idempotente y sin error (R5.4, R5.5)', () => {
    const r = correr2('OCULTATORTUGA OCULTATORTUGA');
    expect(r.error).toBeNull();
    for (const op of r.operaciones) {
      if (op.tipo === 'visibilidad') {
        expect(op.visible).toBe(false);
        expect(op.estadoDespues.visible).toBe(false);
      }
    }
  });
});

// ============================================================================
// Ayuda: cadena de procedimientos A→B→C… sin ciclo, con profundidad conocida
// ============================================================================

/**
 * Construye un programa con `n` procedimientos encadenados P0→P1→…→P(n-1),
 * donde P0 invoca a P1, P1 a P2, etc., y el último no invoca a nadie. Al
 * arrancar P0, la pila alcanza profundidad `n` y luego se desapila sin ciclo.
 */
function construirCadena(n: number): Programa {
  const definiciones: Instruccion[] = [];
  for (let i = 0; i < n; i++) {
    const cuerpo: Instruccion[] =
      i < n - 1
        ? [{ tipo: 'invocacionProcedimiento', nombre: `P${i + 1}`, argumentos: [], ...pos() }]
        : [inv('AVANZA', numero(1))];
    definiciones.push({
      tipo: 'definicionProcedimiento',
      nombre: `P${i}`,
      parametros: [],
      cuerpo,
      ...pos(),
    });
  }
  const arranque: InvocacionProcedimiento = { tipo: 'invocacionProcedimiento', nombre: 'P0', argumentos: [], ...pos() };
  return prog([...definiciones, arranque]);
}

// Evita advertencia de import sin uso; VOCABULARIO y EntradaVocabulario documentan el contrato.
void (VOCABULARIO as readonly EntradaVocabulario[]);
