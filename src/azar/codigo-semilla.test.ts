// Pruebas de conversión entre semilla numérica y código de 7 caracteres

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ALFABETO, LARGO_CODIGO, codificar, decodificar, esCodigoValido } from './codigo-semilla.js';
import { SEMILLA_MAXIMA } from './prng.js';

// ============================================================================
// Pruebas básicas
// ============================================================================

describe('codigo-semilla', () => {
  describe('constantes públicas', () => {
    it('ALFABETO tiene 31 símbolos', () => {
      expect(ALFABETO).toBe('ABCDEFGHJKMNPQRSTUVWXYZ23456789');
      expect(ALFABETO.length).toBe(31);
    });
    
    it('LARGO_CODIGO es 7', () => {
      expect(LARGO_CODIGO).toBe(7);
    });
    
    it('alfabeto excluye I, L, O, 0, 1', () => {
      expect(ALFABETO).not.toContain('I');
      expect(ALFABETO).not.toContain('L');
      expect(ALFABETO).not.toContain('O');
      expect(ALFABETO).not.toContain('0');
      expect(ALFABETO).not.toContain('1');
    });
  });
  
  describe('codificar', () => {
    it('semilla 0 → AAAAAAA', () => {
      const resultado = codificar(0);
      expect(resultado.exito).toBe(true);
      if (resultado.exito) {
        expect(resultado.codigo).toBe('AAAAAAA');
        expect(resultado.codigo.length).toBe(LARGO_CODIGO);
      }
    });
    
    it('semilla máxima (4_294_967_295) produce código válido', () => {
      const resultado = codificar(SEMILLA_MAXIMA);
      expect(resultado.exito).toBe(true);
      if (resultado.exito) {
        expect(resultado.codigo.length).toBe(LARGO_CODIGO);
        // Todos los caracteres deben estar en el alfabeto
        for (const caracter of resultado.codigo) {
          expect(ALFABETO).toContain(caracter);
        }
      }
    });
    
    it('códigos siempre miden 7 caracteres', () => {
      const casos = [0, 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, SEMILLA_MAXIMA];
      
      for (const semilla of casos) {
        const resultado = codificar(semilla);
        expect(resultado.exito).toBe(true);
        if (resultado.exito) {
          expect(resultado.codigo.length).toBe(LARGO_CODIGO);
        }
      }
    });
    
    it('semilla no entera → error semillaFueraDeDominio', () => {
      const resultado = codificar(3.14);
      expect(resultado.exito).toBe(false);
      if (!resultado.exito) {
        expect(resultado.error.id).toBe('semillaFueraDeDominio');
      }
    });
    
    it('semilla menor que 0 → error semillaFueraDeDominio', () => {
      const resultado = codificar(-1);
      expect(resultado.exito).toBe(false);
      if (!resultado.exito) {
        expect(resultado.error.id).toBe('semillaFueraDeDominio');
      }
    });
    
    it('semilla mayor que SEMILLA_MAXIMA → error semillaFueraDeDominio', () => {
      const resultado = codificar(SEMILLA_MAXIMA + 1);
      expect(resultado.exito).toBe(false);
      if (!resultado.exito) {
        expect(resultado.error.id).toBe('semillaFueraDeDominio');
      }
    });
  });
  
  describe('decodificar', () => {
    it('AAAAAAA → semilla 0', () => {
      const resultado = decodificar('AAAAAAA');
      expect(resultado.exito).toBe(true);
      if (resultado.exito) {
        expect(resultado.semilla).toBe(0);
      }
    });
    
    it('normaliza espacios y minúsculas', () => {
      // Código con espacios y minúsculas
      const resultado1 = decodificar('  ab2cdef ');
      expect(resultado1.exito).toBe(true);
      
      // Mismo código en mayúsculas sin espacios
      const resultado2 = decodificar('AB2CDEF');
      expect(resultado2.exito).toBe(true);
      
      if (resultado1.exito && resultado2.exito) {
        expect(resultado1.semilla).toBe(resultado2.semilla);
      }
    });
    
    it('código de semilla máxima se decodifica correctamente', () => {
      // Primero codificamos la semilla máxima
      const resultadoCodificacion = codificar(SEMILLA_MAXIMA);
      expect(resultadoCodificacion.exito).toBe(true);
      
      if (resultadoCodificacion.exito) {
        // Luego decodificamos el código resultante
        const resultadoDecodificacion = decodificar(resultadoCodificacion.codigo);
        expect(resultadoDecodificacion.exito).toBe(true);
        
        if (resultadoDecodificacion.exito) {
          expect(resultadoDecodificacion.semilla).toBe(SEMILLA_MAXIMA);
        }
      }
    });
    
    it('ida y vuelta para varias semillas', () => {
      const semillas = [0, 1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, SEMILLA_MAXIMA];
      
      for (const semilla of semillas) {
        const resultadoCod = codificar(semilla);
        expect(resultadoCod.exito).toBe(true);
        
        if (resultadoCod.exito) {
          const resultadoDec = decodificar(resultadoCod.codigo);
          expect(resultadoDec.exito).toBe(true);
          
          if (resultadoDec.exito) {
            expect(resultadoDec.semilla).toBe(semilla);
          }
        }
      }
    });
    
    describe('errores de decodificación', () => {
      it('longitud distinta de 7 → error codigoSemillaLongitud', () => {
        const casos = ['ABC', 'ABCD', 'ABCDE', 'ABCDEF', 'ABCDEFGH', 'ABCDEFGHI'];
        
        for (const codigo of casos) {
          const resultado = decodificar(codigo);
          expect(resultado.exito).toBe(false);
          if (!resultado.exito) {
            expect(resultado.error.id).toBe('codigoSemillaLongitud');
          }
        }
      });
      
      it('símbolo fuera del alfabeto → error codigoSemillaSimbolo', () => {
        const casos = [
          'AB1CDEF',  // contiene '1'
          'AB0CDEF',  // contiene '0'
          'ABICDEF',  // contiene 'I'
          'ABLCDEF',  // contiene 'L'
          'ABOCDEF',  // contiene 'O'
        ];
        
        for (const codigo of casos) {
          const resultado = decodificar(codigo);
          expect(resultado.exito).toBe(false);
          if (!resultado.exito) {
            expect(resultado.error.id).toBe('codigoSemillaSimbolo');
          }
        }
      });
      
      it('valor decodificado fuera del dominio → error codigoSemillaFueraDeDominio', () => {
        // ZZZZZZZ en base 31 es 31^7 - 1 ≈ 27_512_614_110, que es mayor que SEMILLA_MAXIMA
        const resultado = decodificar('ZZZZZZZ');
        expect(resultado.exito).toBe(false);
        if (!resultado.exito) {
          expect(resultado.error.id).toBe('codigoSemillaFueraDeDominio');
        }
      });
    });
  });
  
  describe('esCodigoValido', () => {
    it('devuelve true para códigos válidos', () => {
      expect(esCodigoValido('AAAAAAA')).toBe(true);
      expect(esCodigoValido('ABCDEFG')).toBe(true);
      expect(esCodigoValido('2345678')).toBe(true);
      expect(esCodigoValido('AB2CDEF')).toBe(true);
    });
    
    it('normaliza antes de validar', () => {
      expect(esCodigoValido('  aaaaaaa  ')).toBe(true);
      expect(esCodigoValido('AB2CDEF')).toBe(true);
      expect(esCodigoValido('  ab2cdef  ')).toBe(true);
    });
    
    it('devuelve false para longitud incorrecta', () => {
      expect(esCodigoValido('ABC')).toBe(false);
      expect(esCodigoValido('ABCD')).toBe(false);
      expect(esCodigoValido('ABCDE')).toBe(false);
      expect(esCodigoValido('ABCDEF')).toBe(false);
      expect(esCodigoValido('ABCDEFGH')).toBe(false);
    });
    
    it('devuelve false para símbolos inválidos', () => {
      expect(esCodigoValido('AB1CDEF')).toBe(false);  // contiene '1'
      expect(esCodigoValido('ABCDEF0')).toBe(false);  // contiene '0'
      expect(esCodigoValido('ABCDEFI')).toBe(false);  // contiene 'I'
      expect(esCodigoValido('ABCDEFL')).toBe(false);  // contiene 'L'
      expect(esCodigoValido('ABCDEFO')).toBe(false);  // contiene 'O'
    });
  });
  
  describe('propiedades específicas del alfabeto', () => {
    it('alfabeto comienza con A', () => {
      expect(ALFABETO[0]).toBe('A');
    });
    
    it('semilla 0 se codifica con solo A', () => {
      const resultado = codificar(0);
      expect(resultado.exito).toBe(true);
      if (resultado.exito) {
        expect(resultado.codigo).toBe('AAAAAAA');
      }
    });
    
    it('códigos son sensibles a mayúsculas después de normalizar', () => {
      // 'ab2cdef' normalizado es 'AB2CDEF'
      const resultado1 = decodificar('ab2cdef');
      const resultado2 = decodificar('AB2CDEF');
      
      expect(resultado1.exito).toBe(true);
      expect(resultado2.exito).toBe(true);
      
      if (resultado1.exito && resultado2.exito) {
        expect(resultado1.semilla).toBe(resultado2.semilla);
      }
    });
    
    it('los códigos solo contienen caracteres del alfabeto', () => {
      const semillas = [0, 1, 10, 100, 1000, 10000, 100000, 1000000, SEMILLA_MAXIMA];
      
      for (const semilla of semillas) {
        const resultado = codificar(semilla);
        expect(resultado.exito).toBe(true);
        
        if (resultado.exito) {
          for (const caracter of resultado.codigo) {
            expect(ALFABETO).toContain(caracter);
          }
        }
      }
    });
  });
  
  describe('mensajes de error exactos', () => {
    it('error codigoSemillaLongitud tiene texto exacto', () => {
      const resultado = decodificar('ABC');
      expect(resultado.exito).toBe(false);
      if (!resultado.exito) {
        expect(resultado.error.mensaje).toBe('El código ABC no sirve: un código de reto tiene 7 letras y números.');
      }
    });
    
    it('error codigoSemillaSimbolo tiene texto exacto', () => {
      // Necesitamos un código de 7 caracteres con un símbolo inválido
      const resultado = decodificar('AB1DEFG');  // '1' no está en el alfabeto
      expect(resultado.exito).toBe(false);
      if (!resultado.exito && resultado.error.id === 'codigoSemillaSimbolo') {
        expect(resultado.error.mensaje).toBe('El código AB1DEFG no sirve: no uso el símbolo 1 en los códigos de reto.');
      }
    });
    
    it('error codigoSemillaFueraDeDominio tiene texto exacto', () => {
      // ZZZZZZZ decodifica a un valor fuera del dominio
      const resultado = decodificar('ZZZZZZZ');
      expect(resultado.exito).toBe(false);
      if (!resultado.exito && resultado.error.id === 'codigoSemillaFueraDeDominio') {
        expect(resultado.error.mensaje).toBe('El código ZZZZZZZ no corresponde a ningún reto.');
      }
    });
    
    it('error semillaFueraDeDominio tiene texto exacto', () => {
      const resultado = codificar(-1);
      expect(resultado.exito).toBe(false);
      if (!resultado.exito) {
        expect(resultado.error.mensaje).toBe('La semilla 5000000000 está fuera del rango permitido.');
      }
    });
  });
});
  
  // ============================================================================
  // Pruebas de propiedades (Property 18)
  // ============================================================================
  
  describe('Property 18: Ida y vuelta de la semilla y de su código', () => {
    // Semilla 0 ya está probada en los tests básicos, pero la incluimos explícitamente
    // para cumplir con Requirement 29.5
    it('cumple round-trip para semilla 0 (Requirement 29.5)', () => {
      const resultado = codificar(0);
      expect(resultado.exito).toBe(true);
      if (resultado.exito) {
        expect(resultado.codigo).toBe('AAAAAAA');
        
        const resultadoDec = decodificar(resultado.codigo);
        expect(resultadoDec.exito).toBe(true);
        if (resultadoDec.exito) {
          expect(resultadoDec.semilla).toBe(0);
        }
      }
    });
    
    it('cumple round-trip para semilla máxima', () => {
      const resultado = codificar(SEMILLA_MAXIMA);
      expect(resultado.exito).toBe(true);
      if (resultado.exito) {
        const resultadoDec = decodificar(resultado.codigo);
        expect(resultadoDec.exito).toBe(true);
        if (resultadoDec.exito) {
          expect(resultadoDec.semilla).toBe(SEMILLA_MAXIMA);
        }
      }
    });
    
    // **Property 18.1: Round-trip para todas las semillas del dominio**
    it('cumple round-trip para todas las semillas del dominio (Requirement 17.5)', () => {
      // Generador de semillas dentro del dominio
      const arbitrarioSemilla = fc.integer({ min: 0, max: SEMILLA_MAXIMA });
      
      fc.assert(
        fc.property(arbitrarioSemilla, (semilla) => {
          const resultadoCod = codificar(semilla);
          if (!resultadoCod.exito) {
            // Si la codificación falla, el test falla
            return false;
          }
          
          const resultadoDec = decodificar(resultadoCod.codigo);
          if (!resultadoDec.exito) {
            // Si la decodificación falla, el test falla
            return false;
          }
          
          // La semilla decodificada debe ser igual a la original
          return resultadoDec.semilla === semilla;
        }),
        { 
          seed: 42,
          numRuns: 200, // Número razonable de pruebas para cubrir el dominio
          verbose: true
        }
      );
    });
    
    // **Property 18.2: Inyectividad - semillas distintas producen códigos distintos**
    it('las semillas distintas producen códigos distintos (Requirement 17.5)', () => {
      const arbitrarioSemilla = fc.integer({ min: 0, max: SEMILLA_MAXIMA });
      
      fc.assert(
        fc.property(
          arbitrarioSemilla, 
          arbitrarioSemilla,
          (semilla1, semilla2) => {
            // Solo comparamos cuando las semillas son distintas
            if (semilla1 === semilla2) {
              return true;
            }
            
            const resultadoCod1 = codificar(semilla1);
            const resultadoCod2 = codificar(semilla2);
            
            // Si alguna codificación falla, el test falla
            if (!resultadoCod1.exito || !resultadoCod2.exito) {
              return false;
            }
            
            // Los códigos deben ser distintos
            return resultadoCod1.codigo !== resultadoCod2.codigo;
          }
        ),
        { 
          seed: 123,
          numRuns: 200,
          verbose: true
        }
      );
    });
    
    // **Property 18.3: Formato del código - 7 caracteres del alfabeto de 31 símbolos**
    it('todos los códigos miden exactamente 7 caracteres y usan solo el alfabeto (Requirement 17.6)', () => {
      const arbitrarioSemilla = fc.integer({ min: 0, max: SEMILLA_MAXIMA });
      
      fc.assert(
        fc.property(arbitrarioSemilla, (semilla) => {
          const resultado = codificar(semilla);
          if (!resultado.exito) {
            return false;
          }
          
          const codigo = resultado.codigo;
          
          // Verificar longitud
          if (codigo.length !== LARGO_CODIGO) {
            return false;
          }
          
          // Verificar que todos los caracteres están en el alfabeto
          for (let i = 0; i < codigo.length; i++) {
            if (!ALFABETO.includes(codigo[i]!)) {
              return false;
            }
          }
          
          return true;
        }),
        { 
          seed: 456,
          numRuns: 200,
          verbose: true
        }
      );
    });
    
    // **Property 18.4: Normalización de minúsculas y espacios**
    it('normaliza minúsculas y espacios en los extremos (Requirement 17.10)', () => {
      // Generador de códigos válidos
      const arbitrarioSemilla = fc.integer({ min: 0, max: SEMILLA_MAXIMA });
      
      fc.assert(
        fc.property(arbitrarioSemilla, (semilla) => {
          const resultadoCod = codificar(semilla);
          if (!resultadoCod.exito) {
            return false;
          }
          
          const codigoOriginal = resultadoCod.codigo;
          
          // Crear variantes con minúsculas y espacios
          const variantes = [
            codigoOriginal.toLowerCase(),
            `  ${codigoOriginal.toLowerCase()}  `,
            ` ${codigoOriginal} `,
            codigoOriginal.toLowerCase().slice(0, 3) + codigoOriginal.toUpperCase().slice(3)
          ];
          
          // Todas las variantes deben decodificar a la misma semilla
          for (const variante of variantes) {
            const resultadoDec = decodificar(variante);
            if (!resultadoDec.exito) {
              return false;
            }
            
            if (resultadoDec.semilla !== semilla) {
              return false;
            }
          }
          
          return true;
        }),
        { 
          seed: 789,
          numRuns: 100, // Menos pruebas porque cada prueba hace múltiples decodificaciones
          verbose: true
        }
      );
    });
    
    // **Property 18.5: Códigos válidos normalizados son equivalentes**
    it('códigos válidos con diferentes formatos de escritura producen la misma semilla', () => {
      // Generador de códigos aleatorios del alfabeto
      const arbitrarioCaracter = fc.constantFrom(...ALFABETO.split(''));
      const arbitrarioCodigo = fc.array(arbitrarioCaracter, { minLength: LARGO_CODIGO, maxLength: LARGO_CODIGO })
        .map(arr => arr.join(''));
      
      fc.assert(
        fc.property(arbitrarioCodigo, (codigoBase) => {
          // Crear variantes del código
          const variantes = [
            codigoBase,
            codigoBase.toLowerCase(),
            `  ${codigoBase.toLowerCase()}  `,
            ` ${codigoBase} `,
          ];
          
          // Decodificar la primera variante como referencia
          const resultadoRef = decodificar(variantes[0]!);
          if (!resultadoRef.exito) {
            // Si el código base no es válido, el test pasa (no es responsabilidad de esta propiedad)
            return true;
          }
          
          const semillaEsperada = resultadoRef.semilla;
          
          // Todas las variantes deben decodificar a la misma semilla
          for (let i = 1; i < variantes.length; i++) {
            const resultado = decodificar(variantes[i]!);
            if (!resultado.exito) {
              return false;
            }
            
            if (resultado.semilla !== semillaEsperada) {
              return false;
            }
          }
          
          return true;
        }),
        { 
          seed: 999,
          numRuns: 100,
          verbose: true
        }
      );
    });
  });
