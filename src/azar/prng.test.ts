// Pruebas del generador de números pseudoaleatorios determinista

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SEMILLA_MINIMA, SEMILLA_MAXIMA, crearPrng } from './prng.js';

// ============================================================================
// Constantes de prueba
// ============================================================================

/** Número de iteraciones para pruebas de secuencia larga */
const ITERACIONES_LARGAS = 10_000;

// ============================================================================
// Pruebas básicas
// ============================================================================

describe('prng', () => {
  describe('constantes públicas', () => {
    it('SEMILLA_MINIMA es 0', () => {
      expect(SEMILLA_MINIMA).toBe(0);
    });
    
    it('SEMILLA_MAXIMA es 4_294_967_295', () => {
      expect(SEMILLA_MAXIMA).toBe(4_294_967_295);
    });
  });
  
  describe('crearPrng', () => {
    it('crea una instancia con semilla 0', () => {
      const prng = crearPrng(0);
      expect(prng).toBeDefined();
      expect(typeof prng.siguiente).toBe('function');
    });
    
    it('crea una instancia con semilla máxima', () => {
      const prng = crearPrng(SEMILLA_MAXIMA);
      expect(prng).toBeDefined();
    });
    
    it('lanza error con semilla menor que SEMILLA_MINIMA', () => {
      expect(() => crearPrng(-1)).toThrow();
    });
    
    it('lanza error con semilla mayor que SEMILLA_MAXIMA', () => {
      expect(() => crearPrng(SEMILLA_MAXIMA + 1)).toThrow();
    });
    
    it('lanza error con semilla no entera', () => {
      expect(() => crearPrng(3.14)).toThrow();
    });
  });
  
  describe('siguiente()', () => {
    it('devuelve número en [0, 1) con semilla 0', () => {
      const prng = crearPrng(0);
      const valor = prng.siguiente();
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThan(1);
    });
    
    it('devuelve número en [0, 1) con semilla máxima', () => {
      const prng = crearPrng(SEMILLA_MAXIMA);
      const valor = prng.siguiente();
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThan(1);
    });
    
    it('produce secuencias diferentes con semillas diferentes', () => {
      const prng1 = crearPrng(42);
      const prng2 = crearPrng(123);
      
      const valores1 = Array.from({ length: 10 }, () => prng1.siguiente());
      const valores2 = Array.from({ length: 10 }, () => prng2.siguiente());
      
      expect(valores1).not.toEqual(valores2);
    });
    
    it('produce la misma secuencia con la misma semilla', () => {
      const prng1 = crearPrng(12345);
      const prng2 = crearPrng(12345);
      
      const valores1 = Array.from({ length: 100 }, () => prng1.siguiente());
      const valores2 = Array.from({ length: 100 }, () => prng2.siguiente());
      
      expect(valores1).toEqual(valores2);
    });
    
    it('produce secuencias deterministas largas (10k iteraciones)', () => {
      const prng1 = crearPrng(999);
      const prng2 = crearPrng(999);
      
      for (let i = 0; i < ITERACIONES_LARGAS; i++) {
        expect(prng1.siguiente()).toBe(prng2.siguiente());
      }
    });
  });
  
  describe('entero()', () => {
    it('devuelve el único valor cuando minimo === maximo', () => {
      const prng = crearPrng(42);
      expect(prng.entero(5, 5)).toBe(5);
      expect(prng.entero(-10, -10)).toBe(-10);
      expect(prng.entero(0, 0)).toBe(0);
    });
    
    it('devuelve valores dentro del rango [min, max] inclusive', () => {
      const prng = crearPrng(123);
      const resultados = new Set<number>();
      
      // Probamos con un rango pequeño para cubrir todos los valores
      for (let i = 0; i < 1000; i++) {
        const valor = prng.entero(1, 5);
        expect(valor).toBeGreaterThanOrEqual(1);
        expect(valor).toBeLessThanOrEqual(5);
        resultados.add(valor);
      }
      
      // Verificar que aparecen todos los valores (probabilidad muy alta en 1000 iteraciones)
      expect(resultados.size).toBe(5);
    });
    
    it('lanza error cuando minimo > maximo', () => {
      const prng = crearPrng(42);
      expect(() => prng.entero(10, 3)).toThrow();
    });
    
    it('no avanza el estado después de error minimo > maximo', () => {
      const prng = crearPrng(42);
      
      // Obtener secuencia normal
      const valoresNormales = Array.from({ length: 5 }, () => prng.siguiente());
      
      // Reiniciar con misma semilla
      const prng2 = crearPrng(42);
      
      try {
        prng2.entero(10, 3);  // Esto debe fallar
      } catch {
        // Ignorar el error
      }
      
      // Verificar que después del error, la secuencia sigue igual
      const valoresDespuesError = Array.from({ length: 5 }, () => prng2.siguiente());
      expect(valoresDespuesError).toEqual(valoresNormales);
    });
    
    it('cubre ambos extremos del rango en muchas iteraciones', () => {
      const prng = crearPrng(777);
      const rangoMin = 0;
      const rangoMax = 9;
      const valoresVistos = new Set<number>();
      
      for (let i = 0; i < 10000; i++) {
        valoresVistos.add(prng.entero(rangoMin, rangoMax));
      }
      
      // Deberían aparecer todos los valores 0-9
      for (let i = rangoMin; i <= rangoMax; i++) {
        expect(valoresVistos.has(i)).toBe(true);
      }
    });
  });
  
  describe('elegir()', () => {
    it('devuelve el único elemento de lista de un elemento', () => {
      const prng = crearPrng(42);
      const lista = ['único'];
      expect(prng.elegir(lista)).toBe('único');
    });
    
    it('devuelve elementos de la lista (no posiciones)', () => {
      const prng = crearPrng(123);
      const lista = ['a', 'b', 'c', 'd', 'e'];
      const resultados = new Set<string>();
      
      for (let i = 0; i < 1000; i++) {
        const elemento = prng.elegir(lista);
        expect(lista).toContain(elemento);
        resultados.add(elemento);
      }
      
      // Deberían aparecer todos los elementos (probabilidad alta en 1000 iteraciones)
      expect(resultados.size).toBe(lista.length);
    });
    
    it('lanza error con lista vacía', () => {
      const prng = crearPrng(42);
      expect(() => prng.elegir([])).toThrow();
    });
    
    it('no avanza el estado después de error lista vacía', () => {
      const prng = crearPrng(42);
      
      // Obtener secuencia normal
      const valoresNormales = Array.from({ length: 5 }, () => prng.siguiente());
      
      // Reiniciar con misma semilla
      const prng2 = crearPrng(42);
      
      try {
        prng2.elegir([]);  // Esto debe fallar
      } catch {
        // Ignorar el error
      }
      
      // Verificar que después del error, la secuencia sigue igual
      const valoresDespuesError = Array.from({ length: 5 }, () => prng2.siguiente());
      expect(valoresDespuesError).toEqual(valoresNormales);
    });
    
    it('mantiene tipos complejos', () => {
      const prng = crearPrng(999);
      const lista = [
        { id: 1, nombre: 'uno' },
        { id: 2, nombre: 'dos' },
        { id: 3, nombre: 'tres' },
      ];
      
      const elemento = prng.elegir(lista);
      expect(lista).toContain(elemento);
      expect(elemento).toHaveProperty('id');
      expect(elemento).toHaveProperty('nombre');
    });
  });
  
  describe('multiplo()', () => {
    it('devuelve múltiplo exacto del paso', () => {
      const prng = crearPrng(42);
      const paso = 5;
      
      for (let i = 0; i < 100; i++) {
        const valor = prng.multiplo(0, 100, paso);
        expect(valor % paso).toBe(0);
        expect(valor).toBeGreaterThanOrEqual(0);
        expect(valor).toBeLessThanOrEqual(100);
      }
    });
    
    it('funciona con rango que tiene un solo múltiplo', () => {
      const prng = crearPrng(123);
      // Solo 15 es múltiplo de 5 en [13, 17]
      expect(prng.multiplo(13, 17, 5)).toBe(15);
    });
    
    it('lanza error cuando paso no es entero positivo', () => {
      const prng = crearPrng(42);
      expect(() => prng.multiplo(0, 10, 0)).toThrow();
      expect(() => prng.multiplo(0, 10, -5)).toThrow();
      expect(() => prng.multiplo(0, 10, 3.14)).toThrow();
    });
    
    it('lanza error cuando minimo > maximo', () => {
      const prng = crearPrng(42);
      expect(() => prng.multiplo(10, 3, 2)).toThrow();
    });
    
    it('lanza error cuando no hay múltiplos en el rango', () => {
      const prng = crearPrng(42);
      // No hay múltiplos de 5 en [12, 13]
      expect(() => prng.multiplo(12, 13, 5)).toThrow();
    });
    
    it('no avanza el estado después de error paso inválido', () => {
      const prng = crearPrng(42);
      
      // Obtener secuencia normal
      const valoresNormales = Array.from({ length: 5 }, () => prng.siguiente());
      
      // Reiniciar con misma semilla
      const prng2 = crearPrng(42);
      
      try {
        prng2.multiplo(0, 10, 0);  // Paso inválido
      } catch {
        // Ignorar el error
      }
      
      // Verificar que después del error, la secuencia sigue igual
      const valoresDespuesError = Array.from({ length: 5 }, () => prng2.siguiente());
      expect(valoresDespuesError).toEqual(valoresNormales);
    });
    
    it('no avanza el estado después de error sin múltiplos', () => {
      const prng = crearPrng(42);
      
      // Obtener secuencia normal
      const valoresNormales = Array.from({ length: 5 }, () => prng.siguiente());
      
      // Reiniciar con misma semilla
      const prng2 = crearPrng(42);
      
      try {
        prng2.multiplo(12, 13, 5);  // Sin múltiplos
      } catch {
        // Ignorar el error
      }
      
      // Verificar que después del error, la secuencia sigue igual
      const valoresDespuesError = Array.from({ length: 5 }, () => prng2.siguiente());
      expect(valoresDespuesError).toEqual(valoresNormales);
    });
    
    it('cubre todos los múltiplos posibles en muchas iteraciones', () => {
      const prng = crearPrng(888);
      const min = 10;
      const max = 50;
      const paso = 5;
      const multiplosEsperados = [10, 15, 20, 25, 30, 35, 40, 45, 50];
      const multiplosVistos = new Set<number>();
      
      for (let i = 0; i < 10000; i++) {
        multiplosVistos.add(prng.multiplo(min, max, paso));
      }
      
      // Deberían aparecer todos los múltiplos
      for (const esperado of multiplosEsperados) {
        expect(multiplosVistos.has(esperado)).toBe(true);
      }
    });
  });
  
  describe('aislamiento entre instancias', () => {
    it('dos instancias con misma semilla producen secuencias iguales', () => {
      const prng1 = crearPrng(123456);
      const prng2 = crearPrng(123456);
      
      // Mezclar llamadas a diferentes métodos
      const resultados1 = [
        prng1.siguiente(),
        prng1.entero(1, 10),
        prng1.elegir(['a', 'b', 'c']),
        prng1.multiplo(0, 100, 10),
        prng1.siguiente(),
      ];
      
      const resultados2 = [
        prng2.siguiente(),
        prng2.entero(1, 10),
        prng2.elegir(['a', 'b', 'c']),
        prng2.multiplo(0, 100, 10),
        prng2.siguiente(),
      ];
      
      expect(resultados1).toEqual(resultados2);
    });
    
    it('instancias con semillas diferentes no interfieren entre sí', () => {
      const prng1 = crearPrng(111);
      const prng2 = crearPrng(222);
      
      // Avanzar una instancia mucho
      for (let i = 0; i < 1000; i++) {
        prng1.siguiente();
      }
      
      // La otra instancia debería seguir en su posición inicial
      const valorPrng2 = prng2.siguiente();
      const prng2Nueva = crearPrng(222);
      expect(valorPrng2).toBe(prng2Nueva.siguiente());
    });
  });
  
  describe('cumplimiento de requisitos específicos', () => {
    // Validación de requisito 17.4: en 10k peticiones con rango ≤ 10 valores,
    // debe aparecer cada valor al menos una vez, incluidos los extremos
    
    it('entero cubre todos los valores en rango pequeño (≤10)', () => {
      const prng = crearPrng(777);
      const min = 0;
      const max = 9;  // 10 valores
      const valoresVistos = new Set<number>();
      
      for (let i = 0; i < ITERACIONES_LARGAS; i++) {
        valoresVistos.add(prng.entero(min, max));
      }
      
      // Deberían aparecer todos los valores 0-9
      for (let valor = min; valor <= max; valor++) {
        expect(valoresVistos.has(valor)).toBe(true);
      }
    });
    
    it('elegir cubre todos los elementos en lista pequeña (≤10)', () => {
      const prng = crearPrng(888);
      const lista = Array.from({ length: 10 }, (_, i) => `elemento-${i}`);
      const elementosVistos = new Set<string>();
      
      for (let i = 0; i < ITERACIONES_LARGAS; i++) {
        elementosVistos.add(prng.elegir(lista));
      }
      
      // Deberían aparecer todos los elementos
      for (const elemento of lista) {
        expect(elementosVistos.has(elemento)).toBe(true);
      }
    });
    
    it('multiplo cubre todos los múltiplos en rango pequeño (≤10 valores)', () => {
      const prng = crearPrng(999);
      const min = 0;
      const max = 45;
      const paso = 5;  // Múltiplos: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45 → 10 valores
      const multiplosVistos = new Set<number>();
      
      for (let i = 0; i < ITERACIONES_LARGAS; i++) {
        multiplosVistos.add(prng.multiplo(min, max, paso));
      }
      
      // Deberían aparecer todos los múltiplos
      for (let valor = min; valor <= max; valor += paso) {
        expect(multiplosVistos.has(valor)).toBe(true);
      }
    });
    
    // Validación de requisito 17.8: errores no avanzan el estado
    
    it('el estado no avanza después de rangoInvalido', () => {
      const semilla = 1234;
      const prng1 = crearPrng(semilla);
      const prng2 = crearPrng(semilla);
      
      // Avanzar ambos un poco
      prng1.siguiente();
      prng2.siguiente();
      
      // Provocar error en prng2
      expect(() => prng2.entero(10, 3)).toThrow();
      
      // Continuar con ambos y verificar que siguen igual
      expect(prng1.siguiente()).toBe(prng2.siguiente());
      expect(prng1.entero(1, 100)).toBe(prng2.entero(1, 100));
    });
    
    it('el estado no avanza después de listaVacia', () => {
      const semilla = 5678;
      const prng1 = crearPrng(semilla);
      const prng2 = crearPrng(semilla);
      
      // Avanzar ambos un poco
      prng1.siguiente();
      prng2.siguiente();
      
      // Provocar error en prng2
      expect(() => prng2.elegir([])).toThrow();
      
      // Continuar con ambos y verificar que siguen igual
      expect(prng1.siguiente()).toBe(prng2.siguiente());
    });
    
    it('el estado no avanza después de pasoInvalido', () => {
      const semilla = 9012;
      const prng1 = crearPrng(semilla);
      const prng2 = crearPrng(semilla);
      
      // Avanzar ambos un poco
      prng1.siguiente();
      prng2.siguiente();
      
      // Provocar error en prng2
      expect(() => prng2.multiplo(0, 10, 0)).toThrow();
      
      // Continuar con ambos y verificar que siguen igual
      expect(prng1.siguiente()).toBe(prng2.siguiente());
    });
    
    it('el estado no avanza después de rangoSinMultiplo', () => {
      const semilla = 3456;
      const prng1 = crearPrng(semilla);
      const prng2 = crearPrng(semilla);
      
      // Avanzar ambos un poco
      prng1.siguiente();
      prng2.siguiente();
      
      // Provocar error en prng2
      expect(() => prng2.multiplo(12, 13, 5)).toThrow();
      
      // Continuar con ambos y verificar que siguen igual
      expect(prng1.siguiente()).toBe(prng2.siguiente());
    });
  });
  
  describe('ejemplos extremos y límites', () => {
    it('maneja rangos grandes correctamente', () => {
      const prng = crearPrng(42);
      const min = -1_000_000;
      const max = 1_000_000;
      
      for (let i = 0; i < 100; i++) {
        const valor = prng.entero(min, max);
        expect(valor).toBeGreaterThanOrEqual(min);
        expect(valor).toBeLessThanOrEqual(max);
        expect(Number.isInteger(valor)).toBe(true);
      }
    });
    
    it('maneja pasos grandes correctamente', () => {
      const prng = crearPrng(123);
      const paso = 1000;
      const min = 0;
      const max = 10_000;
      
      for (let i = 0; i < 100; i++) {
        const valor = prng.multiplo(min, max, paso);
        expect(valor % paso).toBe(0);
        expect(valor).toBeGreaterThanOrEqual(min);
        expect(valor).toBeLessThanOrEqual(max);
      }
    });
    
    it('funciona con valores negativos', () => {
      const prng = crearPrng(456);
      const min = -50;
      const max = -10;
      const paso = 5;
      
      // Prueba entero con negativos
      const enteroNeg = prng.entero(min, max);
      expect(enteroNeg).toBeGreaterThanOrEqual(min);
      expect(enteroNeg).toBeLessThanOrEqual(max);
      
      // Prueba multiplo con negativos
      const multiploNeg = prng.multiplo(min, max, paso);
      expect(multiploNeg % paso === 0).toBe(true);  // Comparación flexible para -0
      expect(multiploNeg).toBeGreaterThanOrEqual(min);
      expect(multiploNeg).toBeLessThanOrEqual(max);
    });
  });
});


  // ============================================================================
  // Property 19: Determinismo, rango y cobertura del PRNG
  // Validates: Requirements 17.2, 17.4
  // ============================================================================

  describe('Property 19: Determinismo, rango y cobertura del PRNG', () => {
    // Semilla explícita para fast-check para asegurar reproducibilidad
    const SEED_FAST_CHECK = 1234567890;

    /**
     * Property 19.1: Determinismo del PRNG
     * Para toda semilla del dominio y para toda secuencia de 1000+ peticiones básicas,
     * dos instancias inicializadas con la misma semilla devuelven valores exactamente iguales.
     */
    it('determinismo: dos instancias con misma semilla producen secuencias idénticas', () => {
      const property = fc.property(
        // Semilla en el dominio válido [0, 4_294_967_295]
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        // Número de peticiones (entre 1 y 1000)
        fc.integer({ min: 1, max: 1000 }),
        (semilla, numPeticiones) => {
          // Crear dos instancias independientes con la misma semilla
          const prng1 = crearPrng(semilla);
          const prng2 = crearPrng(semilla);

          // Ejecutar la misma secuencia de peticiones en ambas
          for (let i = 0; i < numPeticiones; i++) {
            const valor1 = prng1.siguiente();
            const valor2 = prng2.siguiente();
            if (valor1 !== valor2) {
              return false;
            }
          }
          return true;
        }
      );

      fc.assert(property, { seed: SEED_FAST_CHECK });
    });

    /**
     * Property 19.2: Rango de la operación entero()
     * Para todo rango [min, max] válido (min ≤ max), entero() devuelve valores
     * solo dentro de los límites recibidos, ambos inclusive.
     */
    it('rango de entero: valores dentro de [min, max] inclusive', () => {
      const property = fc.property(
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        (min, max, semilla) => {
          // Asegurar min ≤ max para rango válido
          const minimo = Math.min(min, max);
          const maximo = Math.max(min, max);
          
          const prng = crearPrng(semilla);
          const valor = prng.entero(minimo, maximo);
          
          // El valor debe estar dentro del rango inclusive
          return valor >= minimo && valor <= maximo && Number.isInteger(valor);
        }
      );

      fc.assert(property, { seed: SEED_FAST_CHECK });
    });

    /**
     * Property 19.3: Rango de la operación elegir()
     * Para toda lista no vacía, elegir() devuelve un elemento de la lista
     * (no su posición) y ese elemento pertenece a la lista.
     */
    it('rango de elegir: elemento pertenece a la lista', () => {
      const property = fc.property(
        // Generar lista de strings no vacía (tamaño 1-10)
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        (lista, semilla) => {
          const prng = crearPrng(semilla);
          const elemento = prng.elegir(lista);
          
          // El elemento debe estar en la lista
          return lista.includes(elemento);
        }
      );

      fc.assert(property, { seed: SEED_FAST_CHECK });
    });

    /**
     * Property 19.4: Rango de la operación multiplo()
     * Para todo rango [min, max] válido con paso positivo,
     * multiplo() devuelve un múltiplo del paso dentro del rango inclusive.
     */
    it('rango de multiplo: valor divisible por paso y dentro de [min, max]', () => {
      const property = fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: -100, max: 100 }),
        fc.integer({ min: 1, max: 20 }), // paso positivo
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        (min, max, paso, semilla) => {
          // Asegurar min ≤ max para rango válido
          const minimo = Math.min(min, max);
          const maximo = Math.max(min, max);
          
          // Calcular primer y último múltiplo en el rango
          const primerMultiplo = Math.ceil(minimo / paso) * paso;
          const ultimoMultiplo = Math.floor(maximo / paso) * paso;
          
          // Si no hay múltiplos en el rango, la propiedad es trivialmente cierta
          // (la implementación debería lanzar error, pero eso se prueba en otro lugar)
          if (primerMultiplo > ultimoMultiplo) {
            return true; // Propiedad vacuamente verdadera para esta entrada
          }
          
          const prng = crearPrng(semilla);
          const valor = prng.multiplo(minimo, maximo, paso);
          
          // El valor debe ser divisible por paso y estar dentro del rango
          return valor % paso === 0 && valor >= minimo && valor <= maximo;
        }
      );

      fc.assert(property, { seed: SEED_FAST_CHECK });
    });

    /**
     * Property 19.5: Cobertura de entero() en rangos pequeños (≤10 valores)
     * Sobre 10 000 peticiones consecutivas con un rango de 10 valores admisibles o menos,
     * entero() devuelve al menos una vez cada valor admisible, incluidos los dos extremos.
     */
    it('cobertura de entero: todos los valores en rango pequeño aparecen en 10k iteraciones', () => {
      // Probamos varios rangos pequeños
      const rangosPequenos = [
        { min: 0, max: 0, valores: 1 },      // 1 valor
        { min: 0, max: 1, valores: 2 },      // 2 valores
        { min: 0, max: 4, valores: 5 },      // 5 valores
        { min: -2, max: 2, valores: 5 },     // 5 valores con negativos
        { min: 0, max: 9, valores: 10 },     // 10 valores (límite)
        { min: -5, max: 4, valores: 10 },    // 10 valores con negativos
      ];

      for (const { min, max } of rangosPequenos) {
        // Usar semilla fija pero diferente para cada rango
        const semilla = 1000 + min * 100 + max;
        const prng = crearPrng(semilla);
        const valoresVistos = new Set<number>();

        // Ejecutar 10 000 iteraciones
        for (let i = 0; i < ITERACIONES_LARGAS; i++) {
          valoresVistos.add(prng.entero(min, max));
        }

        // Verificar que aparecieron todos los valores
        for (let valor = min; valor <= max; valor++) {
          if (!valoresVistos.has(valor)) {
            throw new Error(
              `Valor ${valor} no apareció en rango [${min}, ${max}] después de ${ITERACIONES_LARGAS} iteraciones`
            );
          }
        }
      }
    });

    /**
     * Property 19.6: Cobertura de elegir() en listas pequeñas (≤10 elementos)
     * Sobre 10 000 peticiones consecutivas con una lista de 10 elementos o menos,
     * elegir() devuelve al menos una vez cada elemento de la lista.
     */
    it('cobertura de elegir: todos los elementos en lista pequeña aparecen en 10k iteraciones', () => {
      // Probamos varias listas pequeñas
      const listasPequenas = [
        ['a'],                                    // 1 elemento
        ['a', 'b'],                               // 2 elementos
        ['a', 'b', 'c', 'd', 'e'],                // 5 elementos
        Array.from({ length: 10 }, (_, i) => `elemento-${i}`),  // 10 elementos (límite)
      ];

      for (const lista of listasPequenas) {
        // Usar semilla fija pero diferente para cada lista
        const semilla = 2000 + lista.length * 100;
        const prng = crearPrng(semilla);
        const elementosVistos = new Set<string>();

        // Ejecutar 10 000 iteraciones
        for (let i = 0; i < ITERACIONES_LARGAS; i++) {
          elementosVistos.add(prng.elegir(lista));
        }

        // Verificar que aparecieron todos los elementos
        for (const elemento of lista) {
          if (!elementosVistos.has(elemento)) {
            throw new Error(
              `Elemento ${elemento} no apareció en lista de tamaño ${lista.length} después de ${ITERACIONES_LARGAS} iteraciones`
            );
          }
        }
      }
    });

    /**
     * Property 19.7: Cobertura de multiplo() en rangos con ≤10 múltiplos
     * Sobre 10 000 peticiones consecutivas con un rango que contiene 10 múltiplos o menos,
     * multiplo() devuelve al menos una vez cada múltiplo posible.
     */
    it('cobertura de multiplo: todos los múltiplos en rango pequeño aparecen en 10k iteraciones', () => {
      // Rangos con ≤10 múltiplos
      const casosMultiplos = [
        { min: 0, max: 0, paso: 1, multiplos: 1 },       // 1 múltiplo: 0
        { min: 10, max: 10, paso: 5, multiplos: 1 },     // 1 múltiplo: 10
        { min: 0, max: 4, paso: 2, multiplos: 3 },       // 3 múltiplos: 0, 2, 4
        { min: 10, max: 30, paso: 5, multiplos: 5 },     // 5 múltiplos: 10, 15, 20, 25, 30
        { min: 0, max: 45, paso: 5, multiplos: 10 },     // 10 múltiplos (límite)
        { min: -20, max: 20, paso: 5, multiplos: 9 },    // 9 múltiplos con negativos
      ];

      for (const { min, max, paso } of casosMultiplos) {
        // Usar semilla fija pero diferente para cada caso
        const semilla = 3000 + min * 100 + max;
        const prng = crearPrng(semilla);
        const multiplosVistos = new Set<number>();

        // Ejecutar 10 000 iteraciones
        for (let i = 0; i < ITERACIONES_LARGAS; i++) {
          multiplosVistos.add(prng.multiplo(min, max, paso));
        }

        // Verificar que aparecieron todos los múltiplos
        for (let valor = min; valor <= max; valor += paso) {
          // Calcular el primer múltiplo ≥ min
          const primerMultiplo = Math.ceil(min / paso) * paso;
          if (valor < primerMultiplo) continue;
          
          if (!multiplosVistos.has(valor)) {
            throw new Error(
              `Múltiplo ${valor} no apareció en rango [${min}, ${max}] con paso ${paso} después de ${ITERACIONES_LARGAS} iteraciones`
            );
          }
        }
      }
    });

    /**
     * Property 19.8: Errores no avanzan el estado del PRNG
     * Cuando una operación recibe argumentos inválidos, reporta un error
     * sin devolver valor y sin avanzar su estado interno.
     */
    it('errores no avanzan el estado del PRNG', () => {
      const property = fc.property(
        fc.integer({ min: SEMILLA_MINIMA, max: SEMILLA_MAXIMA }),
        fc.integer({ min: 1, max: 100 }), // número de llamadas antes/después
        (semilla, numLlamadas) => {
          // Crear dos instancias con la misma semilla
          const prng1 = crearPrng(semilla);
          const prng2 = crearPrng(semilla);

          // Avanzar ambas instancias un poco
          const secuenciaReferencia = [];
          for (let i = 0; i < numLlamadas; i++) {
            secuenciaReferencia.push(prng1.siguiente());
            prng2.siguiente();
          }

          // Provocar errores en prng2 (pero atraparlos)
          try { prng2.entero(10, 3); } catch {}
          try { prng2.elegir([]); } catch {}
          try { prng2.multiplo(0, 10, 0); } catch {}
          try { prng2.multiplo(12, 13, 5); } catch {}

          // Verificar que después de los errores, ambas instancias
          // producen la misma secuencia
          for (let i = 0; i < numLlamadas; i++) {
            const valor1 = prng1.siguiente();
            const valor2 = prng2.siguiente();
            if (valor1 !== valor2) {
              return false;
            }
          }
          return true;
        }
      );

      fc.assert(property, { seed: SEED_FAST_CHECK });
    });
  });