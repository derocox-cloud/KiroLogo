// Feature: 05-mundo-4-parametros, Property 27: Los mensajes conservan lo que el jugador escribió.
// **Validates: Requirements 15.5, 15.6**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearError, type ErrorKiroLogo } from './errores.js';

// Mezcla mayúsculas, minúsculas y acentos para que cualquier normalización se note en el mensaje.
const LETRAS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZáéíóúüñÁÉÍÓÚÜÑ'.split('');

const nombreEscrito = fc
  .array(fc.constantFrom(...LETRAS), { minLength: 1, maxLength: 12 })
  .map((letras) => letras.join(''));

const parametroEscrito = nombreEscrito.map((nombre) => `:${nombre}`);

const parametrosDistintos = fc.uniqueArray(parametroEscrito, { minLength: 1, maxLength: 6 });

const linea = fc.integer({ min: 1, max: 10_000 });

/** Los errores del mundo 4 cuyo texto incluye el número de línea, construidos con esa línea. */
const ERRORES_CON_LINEA: ReadonlyArray<(n: number, simbolo: string, valor: number) => ErrorKiroLogo> = [
  (n) => crearError('parentesisSinCerrar', { linea: n }, { linea: n }),
  (n) => crearError('parentesisDeMas', { linea: n }, { linea: n }),
  (n, simbolo) => crearError('expresionIncompleta', { simbolo, linea: n }, { linea: n }),
  (n) => crearError('divisionPorCero', { linea: n }, { linea: n }),
  (n) => crearError('numeroFueraDeRango', { linea: n }, { linea: n }),
  (n, _s, valor) => crearError('vecesInvalidas', { linea: n, valor }, { linea: n }),
  (n, _s, valor) => crearError('azarRangoInvalido', { linea: n, valor }, { linea: n }),
];

describe('Property 27: los mensajes conservan lo que el jugador escribió', () => {
  it('nombres sin normalizar, línea del texto igual al campo linea y Falta/Faltan según la cantidad', () => {
    fc.assert(
      fc.property(
        nombreEscrito,
        parametrosDistintos,
        nombreEscrito,
        linea,
        fc.nat(),
        fc.constantFrom('+', '-', '*', '/'),
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.nat({ max: ERRORES_CON_LINEA.length - 1 }),
        (procedimiento, parametros, palabra, n, semillaRecibidos, simbolo, valor, indiceConLinea) => {
          const primero = parametros[0]!;

          const noDefinida = crearError('variableNoDefinida', { nombre: primero });
          expect(noDefinida.id).toBe('variableNoDefinida');
          expect(noDefinida.mensaje).toContain(primero);

          const duplicado = crearError('parametroDuplicado', { procedimiento, parametro: primero });
          expect(duplicado.id).toBe('parametroDuplicado');
          expect(duplicado.mensaje).toContain(procedimiento);
          expect(duplicado.mensaje).toContain(primero);

          const equivocado = crearError('argumentoDeTipoEquivocado', {
            comando: procedimiento,
            recibido: `"${palabra}`,
            procedimiento,
            parametro: primero,
          });
          expect(equivocado.id).toBe('argumentoDeTipoEquivocado');
          expect(equivocado.mensaje).toContain(procedimiento);
          expect(equivocado.mensaje).toContain(primero);
          expect(equivocado.mensaje).toContain(`"${palabra}`);

          // Siempre falta al menos uno: recibidos va de 0 a esperados − 1.
          const recibidos = semillaRecibidos % parametros.length;
          const faltan = parametros.length - recibidos;
          const faltantes = crearError('procedimientoArgumentosFaltantes', {
            nombre: procedimiento,
            esperados: parametros,
            recibidos,
          });
          expect(faltantes.id).toBe('procedimientoArgumentosFaltantes');
          expect(faltantes.mensaje).toContain(procedimiento);
          for (const parametro of parametros) expect(faltantes.mensaje).toContain(parametro);
          if (faltan === 1) {
            expect(faltantes.mensaje).toContain('Falta 1:');
            expect(faltantes.mensaje).not.toContain('Faltan');
          } else {
            expect(faltantes.mensaje).toContain(`Faltan ${faltan}:`);
          }
          expect(faltantes.mensaje).toContain(`: ${parametros.slice(recibidos).join(' ')}.`);

          const deMas = crearError(
            'procedimientoArgumentosDeMas',
            { nombre: procedimiento, esperados: parametros, linea: n },
            { linea: n },
          );
          expect(deMas.id).toBe('procedimientoArgumentosDeMas');
          expect(deMas.mensaje).toContain(procedimiento);
          for (const parametro of parametros) expect(deMas.mensaje).toContain(parametro);
          expect(deMas.mensaje).toContain(`línea ${n} `);
          expect(deMas.linea).toBe(n);

          const conLinea = ERRORES_CON_LINEA[indiceConLinea]!(n, simbolo, valor);
          expect(conLinea.severidad).toBe('jugador');
          expect(conLinea.mensaje).toMatch(new RegExp(`línea ${n}\\D`));
          expect(conLinea.linea).toBe(n);
        },
      ),
      { numRuns: 200 },
    );
  });
});
