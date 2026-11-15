// @vitest-environment jsdom
//
// Property 22 (spec 05): el presupuesto y el límite duro del mundo 4 se derivan de la referencia.
//
// Dos mitades. La primera es pura: para cada reto del mundo 4, `resolverReto` deriva
// `presupuestoEstrella` del conteo de la referencia, le suma el margen del nivel y activa el
// límite. La segunda recorre el flujo real del jugador (`main.ts`), porque la guarda que impide
// ejecutar vive ahí: un programa válido emite operaciones si y solo si su conteo cabe en el
// límite, y si no cabe, Kiro explica con la cuenta exacta y la sugerencia del mundo 4.
//
// **Validates: Requirements 16.5, 17.4, 18.7, 20.11, 20.13**

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { resolverReto, type Reto } from './reto.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { crearError } from '../lenguaje/errores.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from '../main.js';
import type { Reloj } from '../motor/animador.js';
import type { RelojEspera } from '../ui/demostracion.js';
import type { RelojRebote } from '../ui/editor.js';
import { TIMEOUT_TRES_ESTRELLAS } from '../pruebas/tiempos.js';

const SEMILLAS = 200;
const NIVELES_GENERADOS = ['4.2', '4.3', '4.4'] as const;
const NIVELES_M4 = ['4.1', ...NIVELES_GENERADOS] as const;

/** Margen que cada nivel declara: solo el 4.2 escribe 6; el resto usa el de omisión. */
const MARGEN: Readonly<Record<string, number>> = { '4.1': 3, '4.2': 6, '4.3': 3, '4.4': 3 };

function retoDe(idNivel: string, semilla: number): Reto {
  const r = resolverReto(idNivel, semilla);
  if (!r.exito) throw new Error(`${idNivel} (semilla ${semilla}): ${r.error.mensaje}`);
  return r.reto;
}

function llamadasDeNivelSuperior(reto: Reto): number {
  return reto.referencia.instrucciones.filter((i) => i.tipo === 'invocacionProcedimiento').length;
}

/** El presupuesto que el diseño anuncia para cada nivel, calculado sin `contarInstrucciones`. */
function presupuestoAnunciado(reto: Reto): number {
  switch (reto.nivel.id) {
    case '4.1':
    case '4.4':
      return 4;
    case '4.2':
      return 6;
    case '4.3':
      return 3 + llamadasDeNivelSuperior(reto);
    default:
      throw new Error(`nivel inesperado ${reto.nivel.id}`);
  }
}

function comprobarDerivacion(reto: Reto): void {
  const conteo = contarInstrucciones(reto.referencia);
  expect(conteo.exito).toBe(true);
  if (!conteo.exito) return;
  expect(reto.presupuestoEstrella).toBe(conteo.instrucciones);
  expect(reto.presupuestoEstrella).toBe(presupuestoAnunciado(reto));
  expect(reto.limiteDuro).toBe(reto.presupuestoEstrella + MARGEN[reto.nivel.id]!);
  expect(reto.limiteDuroActivo).toBe(true);
}

describe('Property 22 · presupuesto y límite duro derivados de la referencia', () => {
  it('4.1: presupuesto 4, límite 7 y límite activo, con cualquier semilla pedida', () => {
    fc.assert(
      fc.property(fc.nat(), (semilla) => {
        const reto = retoDe('4.1', semilla);
        comprobarDerivacion(reto);
        expect(reto.limiteDuro).toBe(7);
      }),
      { numRuns: 50 },
    );
  });

  it.each(NIVELES_GENERADOS)(
    '%s: sobre 200 semillas el presupuesto es el conteo de la referencia y el límite suma el margen del nivel',
    (idNivel) => {
      for (let semilla = 0; semilla < SEMILLAS; semilla++) {
        comprobarDerivacion(retoDe(idNivel, semilla));
      }
    },
    TIMEOUT_TRES_ESTRELLAS,
  );

  it('4.2 deriva siempre presupuesto 6 y límite 12; 4.3 cuenta entre 6 y 8', () => {
    for (let semilla = 0; semilla < SEMILLAS; semilla++) {
      const r42 = retoDe('4.2', semilla);
      expect([r42.presupuestoEstrella, r42.limiteDuro]).toEqual([6, 12]);
      const r43 = retoDe('4.3', semilla);
      expect(r43.presupuestoEstrella).toBeGreaterThanOrEqual(6);
      expect(r43.presupuestoEstrella).toBeLessThanOrEqual(8);
    }
  }, TIMEOUT_TRES_ESTRELLAS);
});

// ============================================================================
// La guarda del flujo del jugador
// ============================================================================

function montarDom(): void {
  document.documentElement.lang = 'es';
  document.body.innerHTML = `
    <div id="aplicacion" role="application" aria-label="KiroLogo">
      <div id="anuncios" aria-live="polite" aria-atomic="true"></div>
      <canvas id="lienzo-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-jugador" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-jugador" width="800" height="800"></canvas>
    </div>
  `;
}

function relojInmediato(): Reloj {
  let t = 0;
  return {
    programar(cb: (ahora: number) => void): number {
      t += 100000;
      cb(t);
      return 1;
    },
    cancelar(): void {},
    ahora: () => t,
  };
}

const relojEsperaInerte: RelojEspera = { programar: () => 1, cancelar: () => {} };
const relojReboteInmediato: RelojRebote = {
  programar(cb: () => void): number {
    cb();
    return 1;
  },
  cancelar(): void {},
};
const movimientoReducido: ConsultaMovimiento = { reducido: () => true, alCambiar: () => () => {} };

function crearAppEn(idNivel: string): Aplicacion {
  montarDom();
  return crearAplicacion({
    documento: document,
    almacen: null,
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte,
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    idNivel,
  });
}

const DEFINICION = 'PARA POLIGONO :lados :largo REPITE :lados [AVANZA :largo GIRADERECHA 360 / :lados] FIN';

/**
 * Instrucciones de nivel superior que siempre emiten al menos una operación, de modo que
 * «no emitió nada» solo pueda deberse a la guarda. Las de `POLIGONO` exigen la definición.
 */
const UNIDADES_SIMPLES = [
  'AVANZA 20',
  'GIRADERECHA 90',
  'GIRAIZQUIERDA 45',
  'RETROCEDE 20',
  'REPITE 3 [AVANZA 20 GIRADERECHA 120]',
  'REPITE 2 [REPITE 4 [AVANZA 20 GIRADERECHA 90] GIRADERECHA 45]',
] as const;
const UNIDADES_CON_PROCEDIMIENTO = [...UNIDADES_SIMPLES, 'POLIGONO 4 40', 'POLIGONO 5 20'] as const;

/** Programa válido del mundo 4 cuyo conteo recorre ambos lados de cualquier límite del mundo. */
const arbProgramaValido: fc.Arbitrary<string> = fc.oneof(
  fc.array(fc.constantFrom(...UNIDADES_SIMPLES), { minLength: 1, maxLength: 18 }).map((u) => u.join('\n')),
  fc
    .array(fc.constantFrom(...UNIDADES_CON_PROCEDIMIENTO), { minLength: 1, maxLength: 15 })
    .map((u) => [DEFINICION, ...u].join('\n')),
);

function conteoDe(texto: string): number {
  const lexico = analizarLexico(texto);
  expect(lexico.errores).toEqual([]);
  const sintactico = analizar(lexico.tokens, { mundo: 4 });
  expect(sintactico.errores).toEqual([]);
  expect(sintactico.programa).not.toBeNull();
  const conteo = contarInstrucciones(sintactico.programa!);
  if (!conteo.exito) throw new Error('el programa generado no se puede contar');
  return conteo.instrucciones;
}

describe('Property 22 · la guarda emite operaciones si y solo si el conteo cabe en el límite', () => {
  beforeEach(() => {
    montarDom();
  });

  it.each(NIVELES_M4)(
    '%s: ejecución real del jugador con programas válidos de conteo variable',
    (idNivel) => {
      fc.assert(
        fc.property(arbProgramaValido, (texto) => {
          const app = crearAppEn(idNivel);
          try {
            const { limiteDuro, limiteDuroActivo } = app.estado().reto;
            expect(limiteDuroActivo).toBe(true);
            const conteo = conteoDe(texto);

            app.editor.area.value = texto;
            app.editor.area.dispatchEvent(new Event('input'));
            app.editor.analizarAhora();
            app.ejecutar();

            const emitidas = app.estado().operacionesJugador.length;
            if (conteo <= limiteDuro) {
              expect(emitidas).toBeGreaterThan(0);
            } else {
              expect(emitidas).toBe(0);
              expect(app.estado().calificacion).toBeNull();
              const esperado = crearError('limiteDuroExcedido', { usadas: conteo, limite: limiteDuro, mundo: 4 });
              const globo = app.textoGlobo();
              expect(globo).toContain(esperado.mensaje);
              expect(globo).toContain(`usa ${conteo} instrucciones`);
              expect(globo).toContain(`es ${limiteDuro}`);
              expect(globo).toContain('parámetros');
            }
          } finally {
            app.destruir();
          }
        }),
        { numRuns: 40 },
      );
    },
    TIMEOUT_TRES_ESTRELLAS,
  );
});
