// Property 19: la abstracción exige precisión y no altera las otras estrellas (spec 05, D7).
//
// Sin precisión, la abstracción se niega con `sinPrecision` aunque el programa confirme
// todas las exigencias del nivel. Y la explicación de Kiro no toca las otras dos
// estrellas: calificar el mismo programa con exigencias (que pueden producir texto) o sin
// ellas (que nunca lo producen) da la misma precisión, la misma economía y el mismo conteo.
//
// **Validates: Requirements 21.6, 22.7**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calificar } from './estrellas.js';
import { analizar } from './abstraccion.js';
import { resolverReto, type Reto } from './reto.js';
import { crearMascara, type MotivoVeredicto, type Veredicto } from '../motor/validador.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import type { ExigenciaAbstraccion } from '../niveles/tipos.js';
import { arbPrograma } from '../pruebas/arbitrarios.js';

function veredicto(motivo: MotivoVeredicto): Veredicto {
  const vacia = crearMascara();
  const coincide = motivo === 'coincide';
  return {
    coincide,
    iou: coincide ? 1 : 0.3,
    excesoPorcentaje: motivo === 'excesoDeTrazo' ? 40 : 0,
    motivo,
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

const RETOS: readonly Reto[] = [0, 1, 2, 3].map((semilla) => {
  const r = resolverReto('4.2', semilla);
  if (!r.exito) throw new Error(`no se pudo resolver 4.2 con la semilla ${semilla}`);
  return r.reto;
});

const arbExigencia: fc.Arbitrary<ExigenciaAbstraccion> = fc.oneof(
  fc.constant<ExigenciaAbstraccion>({ clave: 'usaRepite' }),
  fc.constant<ExigenciaAbstraccion>({ clave: 'usaRepiteAnidado' }),
  fc.constant<ExigenciaAbstraccion>({ clave: 'defineProcedimiento' }),
  fc.constant<ExigenciaAbstraccion>({ clave: 'usaParametros' }),
  fc.constant<ExigenciaAbstraccion>({ clave: 'usaRecursion' }),
  fc.integer({ min: 1, max: 3 }).map((maximo): ExigenciaAbstraccion => ({ clave: 'maximoProcedimientos', maximo })),
);

const arbExigencias: fc.Arbitrary<readonly ExigenciaAbstraccion[]> = fc.uniqueArray(arbExigencia, {
  minLength: 0,
  maxLength: 6,
  selector: (e) => e.clave,
});

const arbMotivoFallido = fc.constantFrom<MotivoVeredicto>('excesoDeTrazo', 'iouInsuficiente', 'sinEstelaDelJugador');
const arbMotivo = fc.constantFrom<MotivoVeredicto>('coincide', 'excesoDeTrazo', 'iouInsuficiente', 'sinEstelaDelJugador');

// El presupuesto varía para que la economía salga otorgada y negada.
function conNivel(base: Reto, exigencias: readonly ExigenciaAbstraccion[], presupuesto: number): Reto {
  return { ...base, presupuestoEstrella: presupuesto, nivel: { ...base.nivel, abstraccion: exigencias } };
}

describe('Property 19: la abstracción exige precisión y no altera las otras estrellas', () => {
  it('sin precisión no hay abstracción, aunque el programa confirme todas las exigencias', () => {
    fc.assert(
      fc.property(
        arbPrograma(4),
        arbExigencias,
        arbMotivoFallido,
        fc.constantFrom(...RETOS),
        fc.integer({ min: 1, max: 60 }),
        (programa, declaradas, motivo, base, presupuesto) => {
          // Solo las que este programa confirma: el caso «todo cumplido salvo la precisión».
          const { confirmadas } = analizar(programa, declaradas);
          const cumplidas = declaradas.filter((e) => confirmadas.includes(e.clave));

          for (const exigencias of [declaradas, cumplidas]) {
            const reto = conNivel(base, exigencias, presupuesto);
            const cal = calificar(programa, veredicto(motivo), reto);
            expect(cal.precision.otorgada).toBe(false);
            expect(cal.abstraccion).toEqual({ otorgada: false, motivo: { clave: 'sinPrecision' } });
            expect(cal.mensajeAbstraccion).toBeNull();
          }

          // Contraste: con precisión, el mismo programa sí gana la abstracción de las cumplidas.
          const conPrecision = calificar(programa, veredicto('coincide'), conNivel(base, cumplidas, presupuesto));
          expect(conPrecision.abstraccion.otorgada).toBe(true);
        },
      ),
      { seed: 19, numRuns: 300 },
    );
  });

  it('con y sin explicación, la precisión, la economía y el conteo son los mismos', () => {
    fc.assert(
      fc.property(
        arbPrograma(4),
        arbExigencias,
        arbMotivo,
        fc.constantFrom(...RETOS),
        fc.integer({ min: 1, max: 60 }),
        (programa, exigencias, motivo, base, presupuesto) => {
          const v = veredicto(motivo);
          const conExigencias = calificar(programa, v, conNivel(base, exigencias, presupuesto));
          const sinExigencias = calificar(programa, v, conNivel(base, [], presupuesto));

          expect(sinExigencias.mensajeAbstraccion).toBeNull();
          expect(conExigencias.precision).toEqual(sinExigencias.precision);
          expect(conExigencias.economia).toEqual(sinExigencias.economia);
          expect(conExigencias.conteoJugador).toBe(sinExigencias.conteoJugador);
          expect(conExigencias.presupuestoEstrella).toBe(sinExigencias.presupuestoEstrella);

          // Y ambas salen solo del veredicto y del conteo, no de la abstracción.
          expect(conExigencias.precision.otorgada).toBe(v.coincide);
          const conteo = contarInstrucciones(programa);
          const instrucciones = conteo.exito ? conteo.instrucciones : Number.POSITIVE_INFINITY;
          expect(conExigencias.economia.otorgada).toBe(instrucciones <= presupuesto);
        },
      ),
      { seed: 19, numRuns: 300 },
    );
  });
});
