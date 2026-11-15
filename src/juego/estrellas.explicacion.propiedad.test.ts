// Property 18: la explicación de Kiro nombra lo que falta (spec 05, D7).
//
// Con la precisión otorgada, `mensajeAbstraccion` lleva una línea por cada exigencia
// sin confirmar que tiene invitación, en el orden en que el nivel las declara, con el
// texto exacto de R22.4. Sin precisión, o con todo confirmado, es `null`.
//
// Qué exigencias quedan sin confirmar lo decide `analizar` (su corrección es la
// Property 17); aquí se prueba lo que `calificar` hace con ese resultado.
//
// **Validates: Requirements 22.1, 22.2, 22.3, 22.5, 22.6**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calificar } from './estrellas.js';
import { analizar, contarProcedimientos } from './abstraccion.js';
import { resolverReto, type Reto } from './reto.js';
import { crearMascara, type Veredicto } from '../motor/validador.js';
import { imprimir } from '../lenguaje/impresor.js';
import type { ExigenciaAbstraccion } from '../niveles/tipos.js';
import { arbPrograma } from '../pruebas/arbitrarios.js';

// Textos exactos de R22.4 (y el de REPITE del mundo 1), escritos aquí a mano para que
// un cambio en el catálogo no pase sin que esta prueba lo note.
const TEXTO_REPITE =
  'Lo conseguiste. Pero dibujaste los cuatro lados uno a uno: yo los vi llegar de la misma forma, cuatro veces. ¿Puedes enseñarme a repetir con REPITE?';
const TEXTO_PARAMETROS =
  'Lo lograste, pero dibujaste con números fijos. Intenta enseñarme un PARA con parámetros, como :lados, y luego pídemelo cambiando los números.';
const textoProcedimientos = (definidos: number, maximo: number): string =>
  `Lo lograste, pero definiste ${definidos} procedimientos y para este reto basta con ${maximo}. Enséñame uno solo con parámetros y pídemelo varias veces con números distintos.`;

function veredicto(coincide: boolean): Veredicto {
  const vacia = crearMascara();
  return {
    coincide,
    iou: coincide ? 1 : 0.3,
    excesoPorcentaje: 0,
    motivo: coincide ? 'coincide' : 'iouInsuficiente',
    traslacion: { x: 0, y: 0 },
    traslacionObjetivo: { x: 0, y: 0 },
    angulo: 0,
    mascaraObjetivo: vacia,
    mascaraJugador: vacia,
    coincidencia: vacia,
    exceso: vacia,
    falta: vacia,
  };
}

// Retos reales del nivel 4.2: la referencia tiene números (lados, largo, giros) que la
// explicación nunca debe filtrar.
const RETOS: readonly Reto[] = [0, 1, 2, 3, 4].map((semilla) => {
  const r = resolverReto('4.2', semilla);
  if (!r.exito) throw new Error(`no se pudo resolver 4.2 con la semilla ${semilla}`);
  return r.reto;
});

// El máximo va de 1 a 3 para que `maximoProcedimientos` quede sin confirmar a menudo:
// los programas generados definen de 0 a 3 procedimientos.
const arbExigencia: fc.Arbitrary<ExigenciaAbstraccion> = fc.oneof(
  fc.constant<ExigenciaAbstraccion>({ clave: 'usaRepite' }),
  fc.constant<ExigenciaAbstraccion>({ clave: 'usaRepiteAnidado' }),
  fc.constant<ExigenciaAbstraccion>({ clave: 'defineProcedimiento' }),
  fc.constant<ExigenciaAbstraccion>({ clave: 'usaParametros' }),
  fc.constant<ExigenciaAbstraccion>({ clave: 'usaRecursion' }),
  fc.integer({ min: 1, max: 3 }).map((maximo): ExigenciaAbstraccion => ({ clave: 'maximoProcedimientos', maximo })),
);

const arbExigencias: fc.Arbitrary<readonly ExigenciaAbstraccion[]> = fc.uniqueArray(arbExigencia, {
  minLength: 1,
  maxLength: 6,
  selector: (e) => e.clave,
});

function lineaEsperada(exigencia: ExigenciaAbstraccion, definidos: number): string | null {
  switch (exigencia.clave) {
    case 'usaRepite': return TEXTO_REPITE;
    case 'usaParametros': return TEXTO_PARAMETROS;
    case 'maximoProcedimientos': return textoProcedimientos(definidos, exigencia.maximo);
    default: return null;
  }
}

describe('Property 18: la explicación de Kiro nombra lo que falta', () => {
  it('una línea exacta por exigencia sin confirmar con invitación, en el orden del nivel; null si no hay precisión o todo se confirma', () => {
    fc.assert(
      fc.property(
        arbPrograma(4),
        arbExigencias,
        fc.boolean(),
        fc.constantFrom(...RETOS),
        (programa, exigencias, coincide, retoBase) => {
          const reto: Reto = { ...retoBase, nivel: { ...retoBase.nivel, abstraccion: exigencias } };
          const cal = calificar(programa, veredicto(coincide), reto);

          const { sinConfirmar } = analizar(programa, exigencias);
          const definidos = contarProcedimientos(programa);
          const esperadas = exigencias
            .filter((e) => sinConfirmar.includes(e.clave))
            .map((e) => lineaEsperada(e, definidos))
            .filter((l): l is string => l !== null);

          if (!coincide || sinConfirmar.length === 0) {
            expect(cal.mensajeAbstraccion).toBeNull();
            return;
          }
          if (esperadas.length === 0) {
            // Solo faltan exigencias sin invitación: siguen con el texto genérico.
            expect(cal.mensajeAbstraccion).toBeNull();
            return;
          }

          expect(cal.mensajeAbstraccion).not.toBeNull();
          const mensaje = cal.mensajeAbstraccion!;
          expect(mensaje.split('\n')).toEqual(esperadas);

          // R22.6: ni la referencia ni el presupuesto. Los únicos números que puede
          // llevar son {definidos} y {maximo}.
          const maximo = exigencias.find((e) => e.clave === 'maximoProcedimientos');
          const permitidos = new Set<string>([String(definidos)]);
          if (maximo?.clave === 'maximoProcedimientos') permitidos.add(String(maximo.maximo));
          for (const numero of mensaje.match(/\d+/g) ?? []) {
            expect(permitidos.has(numero)).toBe(true);
          }
          const impresa = imprimir(reto.referencia);
          if (impresa.exito) expect(mensaje).not.toContain(impresa.texto.trim());
        },
      ),
      { seed: 18, numRuns: 300 },
    );
  });
});
