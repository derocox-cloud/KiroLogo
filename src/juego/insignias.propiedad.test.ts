// Property 26: La insignia y el desafío siguen a las estrellas (spec 05).
//
// Para cada nivel del mundo 4 se genera una historia de guardados con estrellas al azar.
// El oráculo se calcula sobre esa historia, no sobre el progreso: como las estrellas
// guardadas nunca retroceden, cada estrella del nivel es la disyunción de lo concedido en
// sus intentos, y la insignia exige las doce. El desafío del mundo 4 se liga a la insignia
// (D11), así que su disponibilidad tiene que coincidir con ella en todos los casos.
//
// **Validates: Requirements 24.2, 24.3, 24.5**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { cargarProgreso, type Progreso } from './progreso.js';
import type { Calificacion } from './estrellas.js';
import { insigniaGeneralizacionOtorgada, insigniasDelMundo } from './insignias.js';
import { desafioDisponible } from './desafio-infinito.js';
import { CATALOGO } from '../niveles/catalogo.js';

const IDS_MUNDO_4 = CATALOGO.filter((n) => n.mundo === 4).map((n) => n.id);
const IDS_ANTERIORES = CATALOGO.filter((n) => n.mundo < 4).map((n) => n.id);

interface Intento {
  readonly precision: boolean;
  readonly economia: boolean;
  readonly abstraccion: boolean;
}

function calif({ precision, economia, abstraccion }: Intento): Calificacion {
  const est = (o: boolean) =>
    o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } };
  return {
    precision: est(precision),
    economia: est(economia),
    abstraccion: est(abstraccion),
    conteoJugador: 1,
    presupuestoEstrella: 1,
    mensajeAbstraccion: null,
  };
}

const TRES: Intento = { precision: true, economia: true, abstraccion: true };

// Sesgado hacia las tres estrellas: con booleanos uniformes casi nunca se completarían
// los cuatro niveles y el lado verdadero del «si y solo si» quedaría sin ejercitar.
const arbIntento: fc.Arbitrary<Intento> = fc.oneof(
  { arbitrary: fc.constant(TRES), weight: 3 },
  { arbitrary: fc.record({ precision: fc.boolean(), economia: fc.boolean(), abstraccion: fc.boolean() }), weight: 2 },
);

/** Historia de intentos por nivel del mundo 4 (puede estar vacía: nivel sin jugar). */
const arbHistorias = fc.tuple(...IDS_MUNDO_4.map(() => fc.array(arbIntento, { maxLength: 3 })));

function construir(historias: readonly (readonly Intento[])[], anterioresCompletos: boolean): Progreso {
  const progreso = cargarProgreso(null);
  if (anterioresCompletos) for (const id of IDS_ANTERIORES) progreso.guardar(id, 1, calif(TRES), 1);
  IDS_MUNDO_4.forEach((id, i) => {
    for (const intento of historias[i] ?? []) progreso.guardar(id, 1, calif(intento), 1);
  });
  return progreso;
}

/** Oráculo: cada nivel tiene las tres estrellas en la unión de sus intentos. */
function doceEstrellas(historias: readonly (readonly Intento[])[]): boolean {
  return historias.every(
    (h) => h.some((x) => x.precision) && h.some((x) => x.economia) && h.some((x) => x.abstraccion),
  );
}

describe('Property 26: la insignia y el desafío siguen a las estrellas', () => {
  it('el mundo 4 del catálogo son los niveles 4.1 a 4.4', () => {
    expect(IDS_MUNDO_4).toEqual(['4.1', '4.2', '4.3', '4.4']);
  });

  it('Generalización se otorga si y solo si están las doce estrellas, una sola vez, y el desafío la sigue', () => {
    fc.assert(
      fc.property(arbHistorias, fc.boolean(), (historias, anterioresCompletos) => {
        const progreso = construir(historias, anterioresCompletos);
        const esperado = doceEstrellas(historias);

        // R24.2, R24.3
        const otorgada = insigniaGeneralizacionOtorgada(progreso);
        expect(otorgada).toBe(esperado);
        expect(insigniasDelMundo(4, progreso)).toEqual(esperado ? ['generalizacion'] : []);

        // R24.2: repetir la evaluación no la duplica ni cambia el resultado.
        expect(insigniaGeneralizacionOtorgada(progreso)).toBe(otorgada);
        expect(insigniasDelMundo(4, progreso)).toEqual(insigniasDelMundo(4, progreso));

        // R24.5
        expect(desafioDisponible(4, progreso)).toBe(otorgada);
      }),
    );
  });

  it('volver a resolver un nivel con la insignia ya otorgada no la duplica ni la retira', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...IDS_MUNDO_4),
        fc.array(arbIntento, { minLength: 1, maxLength: 3 }),
        (id, nuevos) => {
          const progreso = construir(IDS_MUNDO_4.map(() => [TRES]), false);
          for (const intento of nuevos) progreso.guardar(id, 1, calif(intento), 1);
          expect(insigniasDelMundo(4, progreso)).toEqual(['generalizacion']);
          expect(desafioDisponible(4, progreso)).toBe(true);
        },
      ),
    );
  });
});

// Casos de ejemplo de Generalización (R24.2, R24.3, R24.5).
describe('insignia Generalización · ejemplos', () => {
  it('se otorga con las tres estrellas en 4.1 a 4.4 y abre el desafío', () => {
    const progreso = construir(IDS_MUNDO_4.map(() => [TRES]), false);
    expect(insigniaGeneralizacionOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(4, progreso)).toEqual(['generalizacion']);
    expect(desafioDisponible(4, progreso)).toBe(true);
  });

  it('no se otorga si al 4.3 le falta la estrella de abstracción, y el desafío sigue cerrado', () => {
    const sinAbstraccion: Intento = { precision: true, economia: true, abstraccion: false };
    const progreso = construir([[TRES], [TRES], [sinAbstraccion], [TRES]], true);
    expect(insigniaGeneralizacionOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(4, progreso)).toEqual([]);
    expect(desafioDisponible(4, progreso)).toBe(false);
  });

  it('la precisión en los cuatro niveles no basta para abrir el desafío del mundo 4', () => {
    const soloPrecision: Intento = { precision: true, economia: false, abstraccion: false };
    const progreso = construir(IDS_MUNDO_4.map(() => [soloPrecision]), true);
    expect(insigniaGeneralizacionOtorgada(progreso)).toBe(false);
    expect(desafioDisponible(4, progreso)).toBe(false);
  });

  it('las estrellas repartidas entre intentos se acumulan y completan la insignia', () => {
    const a: Intento = { precision: true, economia: true, abstraccion: false };
    const b: Intento = { precision: true, economia: false, abstraccion: true };
    const progreso = construir([[a, b], [TRES], [TRES], [b, a]], false);
    expect(insigniaGeneralizacionOtorgada(progreso)).toBe(true);
    expect(desafioDisponible(4, progreso)).toBe(true);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaGeneralizacionOtorgada(cargarProgreso(null))).toBe(false);
    expect(desafioDisponible(4, cargarProgreso(null))).toBe(false);
  });
});
