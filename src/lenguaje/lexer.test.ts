// Pruebas del lexer de KiroLogo
// Ejemplos del requisito 4 y las propiedades 1, 2 y 3.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { analizarLexico, type Token } from './lexer.js';
import { crearPrng } from '../azar/prng.js';
import { normalizarPalabra } from './vocabulario.js';

// ============================================================================
// Ejemplos: los seis comandos del mundo 0
// ============================================================================

describe('lexer', () => {
  describe('comandos del mundo 0 en nombre largo', () => {
    const casos: ReadonlyArray<[string, string]> = [
      ['AVANZA', 'AVANZA'],
      ['RETROCEDE', 'RETROCEDE'],
      ['GIRADERECHA', 'GIRADERECHA'],
      ['GIRAIZQUIERDA', 'GIRAIZQUIERDA'],
      ['CENTRO', 'CENTRO'],
      ['BORRAPANTALLA', 'BORRAPANTALLA'],
    ];

    for (const [entrada, valorEsperado] of casos) {
      it(`reconoce ${entrada} como comando`, () => {
        const { tokens, errores } = analizarLexico(entrada);
        expect(errores).toHaveLength(0);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]!.tipo).toBe('comando');
        expect(tokens[0]!.valor).toBe(valorEsperado);
        expect(tokens[0]!.textoOriginal).toBe(entrada);
        expect(tokens[0]!.linea).toBe(1);
        expect(tokens[0]!.columna).toBe(1);
      });
    }
  });

  describe('comandos del mundo 0 en abreviatura', () => {
    const casos: ReadonlyArray<[string, string]> = [
      ['AV', 'AV'],
      ['RE', 'RE'],
      ['GD', 'GD'],
      ['GI', 'GI'],
      ['CE', 'CE'],
      ['BP', 'BP'],
    ];

    for (const [entrada, valorEsperado] of casos) {
      it(`reconoce ${entrada} como comando`, () => {
        const { tokens, errores } = analizarLexico(entrada);
        expect(errores).toHaveLength(0);
        expect(tokens).toHaveLength(1);
        expect(tokens[0]!.tipo).toBe('comando');
        expect(tokens[0]!.valor).toBe(valorEsperado);
      });
    }
  });

  // ==========================================================================
  // Texto vacío y solo comentarios (Requisito 4.10)
  // ==========================================================================

  describe('texto vacío y solo comentarios', () => {
    it('texto vacío produce lista de tokens vacía sin errores', () => {
      const { tokens, errores } = analizarLexico('');
      expect(tokens).toHaveLength(0);
      expect(errores).toHaveLength(0);
    });

    it('solo espacios y saltos de línea produce lista vacía sin errores', () => {
      const { tokens, errores } = analizarLexico('   \t\n  \r\n  ');
      expect(tokens).toHaveLength(0);
      expect(errores).toHaveLength(0);
    });

    it('solo comentarios produce lista vacía sin errores', () => {
      const { tokens, errores } = analizarLexico('# esto es un comentario\n# otro más');
      expect(tokens).toHaveLength(0);
      expect(errores).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Normalización: mismo valor, distinto texto original (Requisito 4.2)
  // ==========================================================================

  describe('normalización de escritura', () => {
    it('avanza, AVANZA y Avanzá dan el mismo valor con distinto texto original', () => {
      const r1 = analizarLexico('avanza');
      const r2 = analizarLexico('AVANZA');
      const r3 = analizarLexico('Avanzá');

      expect(r1.tokens[0]!.valor).toBe('AVANZA');
      expect(r2.tokens[0]!.valor).toBe('AVANZA');
      expect(r3.tokens[0]!.valor).toBe('AVANZA');

      expect(r1.tokens[0]!.textoOriginal).toBe('avanza');
      expect(r2.tokens[0]!.textoOriginal).toBe('AVANZA');
      expect(r3.tokens[0]!.textoOriginal).toBe('Avanzá');

      // Los tres son comandos.
      expect(r1.tokens[0]!.tipo).toBe('comando');
      expect(r2.tokens[0]!.tipo).toBe('comando');
      expect(r3.tokens[0]!.tipo).toBe('comando');
    });

    it('una palabra no declarada es un identificador', () => {
      const { tokens, errores } = analizarLexico('pinta');
      expect(errores).toHaveLength(0);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tipo).toBe('identificador');
      expect(tokens[0]!.valor).toBe('PINTA');
    });

    it('preserva ñ como Ñ: AÑO distinto de ANO', () => {
      const rAno = analizarLexico('año');
      const rAno2 = analizarLexico('ano');
      expect(rAno.tokens[0]!.valor).toBe('AÑO');
      expect(rAno2.tokens[0]!.valor).toBe('ANO');
      expect(rAno.tokens[0]!.valor).not.toBe(rAno2.tokens[0]!.valor);
    });
  });

  // ==========================================================================
  // Números (Requisito 4.4)
  // ==========================================================================

  describe('números', () => {
    it('reconoce un entero', () => {
      const { tokens, errores } = analizarLexico('100');
      expect(errores).toHaveLength(0);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tipo).toBe('numero');
      expect(tokens[0]!.valor).toBe(100);
      expect(tokens[0]!.textoOriginal).toBe('100');
    });

    it('acepta coma como separador decimal y conserva el texto original', () => {
      const { tokens, errores } = analizarLexico('10,5');
      expect(errores).toHaveLength(0);
      expect(tokens[0]!.tipo).toBe('numero');
      expect(tokens[0]!.valor).toBe(10.5);
      expect(tokens[0]!.textoOriginal).toBe('10,5');
    });

    it('acepta punto como separador decimal', () => {
      const { tokens, errores } = analizarLexico('10.5');
      expect(errores).toHaveLength(0);
      expect(tokens[0]!.valor).toBe(10.5);
      expect(tokens[0]!.textoOriginal).toBe('10.5');
    });

    it('acepta hasta 4 decimales', () => {
      const { tokens, errores } = analizarLexico('3,1416');
      expect(errores).toHaveLength(0);
      expect(tokens[0]!.valor).toBeCloseTo(3.1416, 10);
    });

    it('acepta 0 y 999999', () => {
      expect(analizarLexico('0').tokens[0]!.valor).toBe(0);
      expect(analizarLexico('999999').tokens[0]!.valor).toBe(999999);
    });

    it('reporta numeroMalFormado con dos separadores', () => {
      const { tokens, errores } = analizarLexico('10.5.3');
      expect(tokens).toHaveLength(0);
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('numeroMalFormado');
      expect(errores[0]!.linea).toBe(1);
      expect(errores[0]!.columna).toBe(1);
    });

    it('reporta numeroMalFormado con separador sin dígito a la derecha', () => {
      const { errores } = analizarLexico('10,');
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('numeroMalFormado');
    });

    it('reporta numeroMalFormado con más de 4 decimales', () => {
      const { errores } = analizarLexico('1,23456');
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('numeroMalFormado');
    });

    it('reporta numeroMalFormado con valor mayor que 999999', () => {
      const { errores } = analizarLexico('1000000');
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('numeroMalFormado');
    });
  });

  // ==========================================================================
  // Corchetes, palabra con comilla y parámetro (Requisito 4.6)
  // ==========================================================================

  describe('corchetes, palabra con comilla y parámetro', () => {
    it('reconoce corchetes de apertura y cierre', () => {
      const { tokens, errores } = analizarLexico('[ ]');
      expect(errores).toHaveLength(0);
      expect(tokens).toHaveLength(2);
      expect(tokens[0]!.tipo).toBe('corchete_abre');
      expect(tokens[1]!.tipo).toBe('corchete_cierra');
    });

    it('reconoce una palabra con comilla, con el valor sin la comilla', () => {
      const { tokens, errores } = analizarLexico('"naranja');
      expect(errores).toHaveLength(0);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tipo).toBe('palabra');
      expect(tokens[0]!.valor).toBe('NARANJA');
      expect(tokens[0]!.textoOriginal).toBe('"naranja');
    });

    it('reconoce un parámetro, con el valor sin los dos puntos', () => {
      const { tokens, errores } = analizarLexico(':largo');
      expect(errores).toHaveLength(0);
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.tipo).toBe('parametro');
      expect(tokens[0]!.valor).toBe('LARGO');
      expect(tokens[0]!.textoOriginal).toBe(':largo');
    });
  });

  // ==========================================================================
  // Casos de error con su posición (Requisitos 4.7, 4.8, 4.9)
  // ==========================================================================

  describe('errores con posición', () => {
    it('caracterNoValido indica línea y columna, descarta y continúa', () => {
      const { tokens, errores } = analizarLexico('AV & 100');
      // El `&` se descarta; AV y 100 se reconocen.
      expect(tokens).toHaveLength(2);
      expect(tokens[0]!.valor).toBe('AV');
      expect(tokens[1]!.valor).toBe(100);
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('caracterNoValido');
      expect(errores[0]!.linea).toBe(1);
      expect(errores[0]!.columna).toBe(4);
    });

    it('comillaSinPalabra indica posición', () => {
      const { errores } = analizarLexico('" 100');
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('comillaSinPalabra');
      expect(errores[0]!.linea).toBe(1);
      expect(errores[0]!.columna).toBe(1);
    });

    it('parametroSinNombre indica posición', () => {
      const { errores } = analizarLexico(': 100');
      expect(errores).toHaveLength(1);
      expect(errores[0]!.id).toBe('parametroSinNombre');
      expect(errores[0]!.columna).toBe(1);
    });

    it('acumula varios errores y los ordena por línea y columna', () => {
      const { errores } = analizarLexico('&\n@\n%');
      expect(errores).toHaveLength(3);
      expect(errores.map((e) => e.id)).toEqual([
        'caracterNoValido',
        'caracterNoValido',
        'caracterNoValido',
      ]);
      expect(errores.map((e) => e.linea)).toEqual([1, 2, 3]);
    });

    it('conserva la numeración de línea después de un comentario', () => {
      const { tokens } = analizarLexico('# comentario\nAVANZA 100');
      expect(tokens[0]!.linea).toBe(2);
      expect(tokens[1]!.linea).toBe(2);
    });

    it('calcula la columna correctamente tras varios comandos en una línea', () => {
      const { tokens } = analizarLexico('AV 100 GD 90');
      expect(tokens[0]!.columna).toBe(1);   // AV
      expect(tokens[1]!.columna).toBe(4);   // 100
      expect(tokens[2]!.columna).toBe(8);   // GD
      expect(tokens[3]!.columna).toBe(11);  // 90
    });
  });

  // ==========================================================================
  // Property 1: Invariancia de escritura de la entrada
  // Valida: Requisitos 3.6, 4.2, 4.3
  // ==========================================================================

  describe('Property 1: invariancia de escritura de la entrada', () => {
    // Genera una escritura arbitraria (mayúsculas, minúsculas, acentos) de una
    // palabra, y verifica que el valor normalizado no depende de cómo se escribió.
    it('el valor normalizado es invariante a mayúsculas, minúsculas y acentos', () => {
      // Pares de escritura equivalente → valor normalizado esperado.
      const equivalencias: ReadonlyArray<readonly [readonly string[], string]> = [
        [['avanza', 'AVANZA', 'Avanza', 'avanzá', 'AVANZÁ'], 'AVANZA'],
        [['giraderecha', 'GIRADERECHA', 'GiraDerecha'], 'GIRADERECHA'],
        [['niño', 'NIÑO', 'Niño'], 'NIÑO'],
        [['número', 'NUMERO', 'número', 'NÚMERO'], 'NUMERO'],
        [['pingüino', 'PINGUINO', 'PINGÜINO'], 'PINGUINO'],
      ];

      for (const [escrituras, esperado] of equivalencias) {
        for (const escritura of escrituras) {
          const { tokens, errores } = analizarLexico(escritura);
          expect(errores).toHaveLength(0);
          expect(tokens).toHaveLength(1);
          expect(tokens[0]!.valor).toBe(esperado);
        }
      }
    });

    it('ñ nunca se normaliza a N (property sobre 200 semillas)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          // Construir una palabra con letras y al menos una ñ intercalada.
          const letras = 'abcdefghijklmnopqrstuvwxyz';
          const largo = prng.entero(1, 8);
          let palabra = '';
          for (let i = 0; i < largo; i++) {
            palabra += letras[prng.entero(0, letras.length - 1)];
          }
          const conEnie = palabra + 'ñ' + palabra;
          const { tokens } = analizarLexico(conEnie);
          const valor = tokens[0]!.valor as string;
          // Debe contener Ñ y coincidir exactamente con la normalización directa.
          expect(valor).toContain('Ñ');
          expect(valor).toBe(normalizarPalabra(conEnie));
        }),
        { seed: 1, numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 2: Invariancia del separador decimal
  // Valida: Requisito 4.4
  // ==========================================================================

  describe('Property 2: invariancia del separador decimal', () => {
    it('coma y punto producen el mismo valor numérico, sobre 200 semillas', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const entera = prng.entero(0, 999_999);
          const numDecimales = prng.entero(1, 4);
          let decimales = '';
          for (let i = 0; i < numDecimales; i++) {
            decimales += String(prng.entero(0, 9));
          }
          const conPunto = `${entera}.${decimales}`;
          const conComa = `${entera},${decimales}`;

          const rp = analizarLexico(conPunto);
          const rc = analizarLexico(conComa);

          // Ambos válidos (el valor puede pasar de 999999 solo por la parte decimal,
          // que nunca lo hace, así que ambos son válidos).
          expect(rp.errores).toHaveLength(0);
          expect(rc.errores).toHaveLength(0);
          expect(rp.tokens[0]!.tipo).toBe('numero');
          expect(rc.tokens[0]!.tipo).toBe('numero');
          // Mismo valor numérico.
          expect(rp.tokens[0]!.valor).toBe(rc.tokens[0]!.valor);
          // Distinto texto original.
          expect(rp.tokens[0]!.textoOriginal).toBe(conPunto);
          expect(rc.tokens[0]!.textoOriginal).toBe(conComa);
        }),
        { seed: 2, numRuns: 200 },
      );
    });
  });

  // ==========================================================================
  // Property 3: Los comentarios y el espacio en blanco no existen para el lexer
  // Valida: Requisito 4.5
  // ==========================================================================

  describe('Property 3: comentarios y espacio en blanco no existen para el lexer', () => {
    it('insertar comentarios y espacio no cambia la secuencia de tokens, sobre 200 semillas', () => {
      const comandos = ['AVANZA', 'RETROCEDE', 'GIRADERECHA', 'GIRAIZQUIERDA', 'CENTRO', 'BORRAPANTALLA'];
      const conArgumento = new Set(['AVANZA', 'RETROCEDE', 'GIRADERECHA', 'GIRAIZQUIERDA']);

      fc.assert(
        fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
          const prng = crearPrng(semilla);
          const cantidad = prng.entero(0, 12);

          // Construir dos textos: uno compacto y otro con comentarios y espacio
          // insertados entre tokens, ambos con la misma secuencia lógica.
          const piezas: string[] = [];
          for (let i = 0; i < cantidad; i++) {
            const cmd = comandos[prng.entero(0, comandos.length - 1)]!;
            piezas.push(cmd);
            if (conArgumento.has(cmd)) {
              piezas.push(String(prng.entero(0, 999_999)));
            }
          }

          const compacto = piezas.join(' ');
          // Versión ruidosa: espacio extra, tabuladores y comentarios entre piezas.
          const ruidosa = piezas
            .map((p, i) => (i % 2 === 0 ? `${p}\t# comentario ${i}\n` : `   ${p}  `))
            .join('');

          const rCompacto = analizarLexico(compacto);
          const rRuidosa = analizarLexico(ruidosa);

          expect(rCompacto.errores).toHaveLength(0);
          expect(rRuidosa.errores).toHaveLength(0);

          const clave = (t: Token) => `${t.tipo}:${t.valor}`;
          expect(rRuidosa.tokens.map(clave)).toEqual(rCompacto.tokens.map(clave));
        }),
        { seed: 3, numRuns: 200 },
      );
    });
  });
});
