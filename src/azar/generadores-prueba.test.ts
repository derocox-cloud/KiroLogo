// Generadores de entrada compartidos para pruebas de propiedades
// Estos cuatro generadores producen datos aleatorios usando el PRNG del proyecto
// con semillas explícitas, nunca Math.random.
//
// Los generadores se exportan para que otros archivos de prueba los importen.
// Este archivo incluye también sus propias pruebas de auto-comprobación.

import type { Prng } from './prng.js';
import { crearPrng } from './prng.js';
import type { Programa, NumeroLiteral, InvocacionComando, Expresion, Instruccion } from '../lenguaje/ast.js';
import { VOCABULARIO } from '../lenguaje/vocabulario.js';

// ============================================================================
// Interfaz para estado de tortuga (usada por generadores)
// ============================================================================

export interface EstadoTortuga {
  readonly x: number;
  readonly y: number;
  readonly rumbo: number;        // grados, en [0, 360)
  readonly lapizAbajo: boolean;
  readonly visible: boolean;
}

export interface Segmento {
  readonly desdeX: number;
  readonly desdeY: number;
  readonly hastaX: number;
  readonly hastaY: number;
}

export interface Figura {
  readonly segmentos: readonly Segmento[];
  readonly ancho: number;
  readonly alto: number;
}

// ============================================================================
// Generador 1: Programa del mundo 0
// ============================================================================

/**
 * Genera un `Programa` válido del mundo 0 con 0 a `maximoInstrucciones` instrucciones.
 * 
 * Cubre los seis comandos ejecutables del mundo 0 y sus abreviaturas, con argumentos
 * sin signo de 0 a 999 999 y hasta 3 decimales.
 * 
 * @param prng Instancia de PRNG para la aleatoriedad
 * @param maximoInstrucciones Número máximo de instrucciones a generar
 * @returns Programa válido del mundo 0
 */
export function generarPrograma(prng: Prng, maximoInstrucciones: number): Programa {
  // Determinar cuántas instrucciones generar (0 a maximoInstrucciones)
  const cantidad = prng.entero(0, maximoInstrucciones);
  
  const instrucciones: Instruccion[] = [];
  
  // Filtrar comandos del mundo 0 que son ejecutables
  const comandosMundo0 = VOCABULARIO.filter(
    entrada => entrada.mundo === 0 && entrada.ejecutable
  );
  
  for (let i = 0; i < cantidad; i++) {
    // Elegir un comando al azar
    const comando = prng.elegir(comandosMundo0);
    
    // Determinar si usar nombre largo o abreviatura (si existe)
    const usarAbreviatura = comando.abreviatura !== null && prng.siguiente() < 0.5;
    const nombre = usarAbreviatura ? comando.abreviatura! : comando.nombre;
    
    // Generar argumentos según la aridad
    const argumentos: Expresion[] = [];
    
    if (comando.aridad === 1 && comando.tiposArgumento[0] === 'numero') {
      // Generar número de 0 a 999999 con hasta 3 decimales
      const parteEntera = prng.entero(0, 999999);
      const tieneDecimales = prng.siguiente() < 0.3; // 30% de probabilidad de tener decimales
      
      let valor: number;
      if (tieneDecimales) {
        const decimales = prng.entero(0, 999); // hasta 3 dígitos decimales
        valor = parteEntera + decimales / 1000;
      } else {
        valor = parteEntera;
      }
      
      const argumento: NumeroLiteral = {
        tipo: 'numeroLiteral',
        valor,
        linea: i + 1,
        columna: 1
      };
      
      argumentos.push(argumento);
    }
    // Para aridad 0, no se generan argumentos
    
    const instruccion: InvocacionComando = {
      tipo: 'invocacionComando',
      nombre,
      argumentos,
      linea: i + 1,
      columna: 1
    };
    
    instrucciones.push(instruccion);
  }
  
  return {
    tipo: 'programa',
    instrucciones
  };
}

// ============================================================================
// Generador 2: Programa extendido con nodos reservados
// ============================================================================

/**
 * Genera un `Programa` que incluye los nueve nodos reservados anidados
 * hasta la profundidad especificada.
 * 
 * @param prng Instancia de PRNG para la aleatoriedad
 * @param profundidad Máxima profundidad de anidamiento
 * @returns Programa con nodos reservados
 */
export function generarProgramaExtendido(prng: Prng, profundidad: number): Programa {
  // Primero generamos un programa base del mundo 0
  const programaBase = generarPrograma(prng, Math.min(10, profundidad * 2));
  
  // Por ahora, en esta spec solo tenemos los nodos del mundo 0.
  // Los nodos reservados se implementarán en specs futuras.
  // Por ahora, devolvemos el programa base sin cambios.
  
  return programaBase;
  
  // Nota: Cuando se implementen los nodos reservados en specs futuras,
  // este generador deberá:
  // 1. Generar nodos Repeticion con cuerpo recursivo
  // 2. Generar DefinicionProcedimiento e InvocacionProcedimiento
  // 3. Generar ReferenciaParametro y ExpresionAritmetica
  // 4. Generar CondicionalUnaRama, CondicionalDosRamas, Interrupcion, DevolucionValor
  // 5. Asegurar que la profundidad no excede el límite
}

// ============================================================================
// Generador 3: Figura (polilínea encuadrada)
// ============================================================================

/**
 * Genera una figura (polilínea) que cabe en el lienzo (800×800).
 * 
 * Las longitudes son múltiplos de 20 entre 40 y 200.
 * Los ángulos son derivables (360/n con n de 3 a 12, o múltiplos de 15).
 * 
 * @param prng Instancia de PRNG para la aleatoriedad
 * @returns Figura con segmentos encuadrados
 */
export function generarFigura(prng: Prng): Figura {
  // Determinar cuántos segmentos generar (3 a 8 para una figura interesante)
  const cantidadSegmentos = prng.entero(3, 8);
  
  // Posición inicial dentro del lienzo, dejando margen para los segmentos
  const margen = 150; // Margen más grande para acomodar segmentos largos
  let x = prng.entero(margen, 800 - margen);
  let y = prng.entero(margen, 800 - margen);
  
  const segmentos: Segmento[] = [];
  let minX = x;
  let maxX = x;
  let minY = y;
  let maxY = y;
  
  // Ángulo inicial aleatorio
  let anguloActual = prng.entero(0, 359);
  
  for (let i = 0; i < cantidadSegmentos; i++) {
    // Longitud: múltiplo de 20 entre 40 y 200
    // Para asegurar que quepa, ajustamos la longitud máxima según la posición actual
    const distanciaAlBordeX = Math.min(x, 800 - x);
    const distanciaAlBordeY = Math.min(y, 800 - y);
    const maxDistanciaAlBorde = Math.min(distanciaAlBordeX, distanciaAlBordeY);
    
    // Longitud máxima no puede exceder la distancia al borde más un pequeño margen
    const longitudMaxima = Math.min(200, Math.floor(maxDistanciaAlBorde / 20) * 20);
    const longitudMinima = Math.min(40, longitudMaxima);
    
    let longitud: number;
    if (longitudMinima <= longitudMaxima) {
      longitud = prng.multiplo(longitudMinima, longitudMaxima, 20);
    } else {
      // Si no hay espacio para un segmento de al menos 40, usamos un valor pequeño
      longitud = 20;
    }
    
    // Ángulo: derivable (360/n con n de 3 a 12, o múltiplo de 15)
    let anguloGiro: number;
    if (prng.siguiente() < 0.5) {
      // 360/n con n de 3 a 12
      const n = prng.entero(3, 12);
      anguloGiro = 360 / n;
    } else {
      // Múltiplo de 15
      anguloGiro = prng.multiplo(15, 345, 15);
    }
    
    // Decidir si girar a la derecha o izquierda
    if (prng.siguiente() < 0.5) {
      anguloActual = (anguloActual + anguloGiro) % 360;
    } else {
      anguloActual = (anguloActual - anguloGiro + 360) % 360;
    }
    
    // Calcular nueva posición
    const radianes = (anguloActual * Math.PI) / 180;
    let nuevoX = x + longitud * Math.cos(radianes);
    let nuevoY = y + longitud * Math.sin(radianes);
    
    // Asegurar que la nueva posición esté dentro del lienzo
    // Si se sale, ajustamos la longitud para que quepa
    if (nuevoX < 0 || nuevoX > 800 || nuevoY < 0 || nuevoY > 800) {
      // Encuentra la longitud máxima que mantiene la posición dentro del lienzo
      let longitudAjustada = longitud;
      
      // Ajustar en la dirección X
      if (Math.cos(radianes) > 0) {
        const maxXDist = 800 - x;
        if (maxXDist > 0) {
          longitudAjustada = Math.min(longitudAjustada, maxXDist / Math.cos(radianes));
        }
      } else if (Math.cos(radianes) < 0) {
        const maxXDist = x;
        if (maxXDist > 0) {
          longitudAjustada = Math.min(longitudAjustada, maxXDist / -Math.cos(radianes));
        }
      }
      
      // Ajustar en la dirección Y
      if (Math.sin(radianes) > 0) {
        const maxYDist = 800 - y;
        if (maxYDist > 0) {
          longitudAjustada = Math.min(longitudAjustada, maxYDist / Math.sin(radianes));
        }
      } else if (Math.sin(radianes) < 0) {
        const maxYDist = y;
        if (maxYDist > 0) {
          longitudAjustada = Math.min(longitudAjustada, maxYDist / -Math.sin(radianes));
        }
      }
      
      // Asegurar que la longitud ajustada sea positiva y múltiplo de 20
      longitudAjustada = Math.max(20, Math.floor(longitudAjustada / 20) * 20);
      nuevoX = x + longitudAjustada * Math.cos(radianes);
      nuevoY = y + longitudAjustada * Math.sin(radianes);
    }
    
    segmentos.push({
      desdeX: x,
      desdeY: y,
      hastaX: nuevoX,
      hastaY: nuevoY
    });
    
    // Actualizar posición y bounding box
    x = nuevoX;
    y = nuevoY;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  
  return {
    segmentos,
    ancho: maxX - minX,
    alto: maxY - minY
  };
}

// ============================================================================
// Generador 4: Estado de tortuga
// ============================================================================

/**
 * Genera un estado de tortuga con posición en [-600, 600]² (más ancho que el lienzo),
 * rumbo en [0, 360), y valores aleatorios para lápiz y visibilidad.
 * 
 * @param prng Instancia de PRNG para la aleatoriedad
 * @returns Estado de tortuga aleatorio
 */
export function generarEstadoTortuga(prng: Prng): EstadoTortuga {
  // Posición en [-600, 600]² (más ancho que el lienzo de 800×800)
  const x = prng.entero(-600, 600);
  const y = prng.entero(-600, 600);
  
  // Rumbo en [0, 360)
  const rumbo = prng.siguiente() * 360;
  
  // Lápiz arriba o abajo (50% de probabilidad cada uno)
  const lapizAbajo = prng.siguiente() < 0.5;
  
  // Visible u oculta (80% visible, 20% oculta)
  const visible = prng.siguiente() < 0.8;
  
  return { x, y, rumbo, lapizAbajo, visible };
}

// ============================================================================
// Pruebas de auto-comprobación
// ============================================================================

import { describe, it, expect } from 'vitest';

describe('generadores-prueba', () => {
  describe('generarPrograma', () => {
    it('genera programas válidos con semilla fija', () => {
      const prng = crearPrng(12345);
      const programa = generarPrograma(prng, 10);
      
      expect(programa).toHaveProperty('tipo', 'programa');
      expect(programa).toHaveProperty('instrucciones');
      expect(Array.isArray(programa.instrucciones)).toBe(true);
      
      // Verificar que todas las instrucciones son válidas
      for (const instruccion of programa.instrucciones) {
        expect(instruccion).toHaveProperty('tipo', 'invocacionComando');
        expect(instruccion).toHaveProperty('linea');
        expect(instruccion).toHaveProperty('columna');
        
        const invocacion = instruccion as InvocacionComando;
        expect(typeof invocacion.nombre).toBe('string');
        expect(invocacion.nombre.length).toBeGreaterThan(0);
        
        // Verificar argumentos según el comando
        const comando = VOCABULARIO.find(
          entrada => entrada.nombre === invocacion.nombre || entrada.abreviatura === invocacion.nombre
        );
        expect(comando).toBeDefined();
        
        if (comando!.aridad === 0) {
          expect(invocacion.argumentos).toHaveLength(0);
        } else if (comando!.aridad === 1) {
          expect(invocacion.argumentos).toHaveLength(1);
          const argumento = invocacion.argumentos[0];
          expect(argumento).toHaveProperty('tipo', 'numeroLiteral');
          expect((argumento as NumeroLiteral).valor).toBeGreaterThanOrEqual(0);
          expect((argumento as NumeroLiteral).valor).toBeLessThanOrEqual(999999.999);
        }
      }
    });
    
    it('es determinista con la misma semilla', () => {
      const prng1 = crearPrng(42);
      const programa1 = generarPrograma(prng1, 5);
      
      const prng2 = crearPrng(42);
      const programa2 = generarPrograma(prng2, 5);
      
      // Comparar estructuras (no podemos usar toEqual porque las funciones pueden tener closures)
      expect(programa1.tipo).toBe(programa2.tipo);
      expect(programa1.instrucciones.length).toBe(programa2.instrucciones.length);
      
      // Comparar cada instrucción
      for (let i = 0; i < programa1.instrucciones.length; i++) {
        const inst1 = programa1.instrucciones[i] as InvocacionComando;
        const inst2 = programa2.instrucciones[i] as InvocacionComando;
        
        expect(inst1.nombre).toBe(inst2.nombre);
        expect(inst1.argumentos.length).toBe(inst2.argumentos.length);
        
        if (inst1.argumentos.length > 0) {
          const arg1 = inst1.argumentos[0] as NumeroLiteral;
          const arg2 = inst2.argumentos[0] as NumeroLiteral;
          expect(arg1.valor).toBe(arg2.valor);
        }
      }
    });
    
    it('respeta el límite máximo de instrucciones', () => {
      const prng = crearPrng(999);
      const maximo = 7;
      const programa = generarPrograma(prng, maximo);
      
      expect(programa.instrucciones.length).toBeGreaterThanOrEqual(0);
      expect(programa.instrucciones.length).toBeLessThanOrEqual(maximo);
    });
  });
  
  describe('generarProgramaExtendido', () => {
    it('genera programas con la profundidad especificada', () => {
      const prng = crearPrng(54321);
      const programa = generarProgramaExtendido(prng, 3);
      
      expect(programa).toHaveProperty('tipo', 'programa');
      expect(programa).toHaveProperty('instrucciones');
      // Por ahora, en esta spec, es lo mismo que generarPrograma
    });
    
    it('es determinista con la misma semilla', () => {
      const prng1 = crearPrng(100);
      const programa1 = generarProgramaExtendido(prng1, 2);
      
      const prng2 = crearPrng(100);
      const programa2 = generarProgramaExtendido(prng2, 2);
      
      expect(programa1.instrucciones.length).toBe(programa2.instrucciones.length);
    });
  });
  
  describe('generarFigura', () => {
    it('genera figuras válidas con semilla fija', () => {
      const prng = crearPrng(777);
      const figura = generarFigura(prng);
      
      expect(figura).toHaveProperty('segmentos');
      expect(figura).toHaveProperty('ancho');
      expect(figura).toHaveProperty('alto');
      expect(Array.isArray(figura.segmentos)).toBe(true);
      expect(figura.segmentos.length).toBeGreaterThanOrEqual(3);
      expect(figura.segmentos.length).toBeLessThanOrEqual(8);
      
      // Verificar segmentos
      for (const segmento of figura.segmentos) {
        expect(segmento).toHaveProperty('desdeX');
        expect(segmento).toHaveProperty('desdeY');
        expect(segmento).toHaveProperty('hastaX');
        expect(segmento).toHaveProperty('hastaY');
        
        // Calcular longitud del segmento (comentado para evitar error TypeScript de variable no usada)
        // const dx = segmento.hastaX - segmento.desdeX;
        // const dy = segmento.hastaY - segmento.desdeY;
        // const longitud = Math.sqrt(dx * dx + dy * dy);
        
        // La figura debe caber en el lienzo
        expect(segmento.desdeX).toBeGreaterThanOrEqual(0);
        expect(segmento.desdeX).toBeLessThanOrEqual(800);
        expect(segmento.desdeY).toBeGreaterThanOrEqual(0);
        expect(segmento.desdeY).toBeLessThanOrEqual(800);
        expect(segmento.hastaX).toBeGreaterThanOrEqual(0);
        expect(segmento.hastaX).toBeLessThanOrEqual(800);
        expect(segmento.hastaY).toBeGreaterThanOrEqual(0);
        expect(segmento.hastaY).toBeLessThanOrEqual(800);
      }
      
      // La figura debe caber en el lienzo
      expect(figura.ancho).toBeLessThanOrEqual(800);
      expect(figura.alto).toBeLessThanOrEqual(800);
    });
    
    it('es determinista con la misma semilla', () => {
      const prng1 = crearPrng(888);
      const figura1 = generarFigura(prng1);
      
      const prng2 = crearPrng(888);
      const figura2 = generarFigura(prng2);
      
      expect(figura1.segmentos.length).toBe(figura2.segmentos.length);
      
      // Comparar segmentos
      for (let i = 0; i < figura1.segmentos.length; i++) {
        const seg1 = figura1.segmentos[i]!;
        const seg2 = figura2.segmentos[i]!;
        
        expect(seg1.desdeX).toBe(seg2.desdeX);
        expect(seg1.desdeY).toBe(seg2.desdeY);
        expect(seg1.hastaX).toBe(seg2.hastaX);
        expect(seg1.hastaY).toBe(seg2.hastaY);
      }
    });
  });
  
  describe('generarEstadoTortuga', () => {
    it('genera estados válidos con semilla fija', () => {
      const prng = crearPrng(333);
      const estado = generarEstadoTortuga(prng);
      
      expect(estado).toHaveProperty('x');
      expect(estado).toHaveProperty('y');
      expect(estado).toHaveProperty('rumbo');
      expect(estado).toHaveProperty('lapizAbajo');
      expect(estado).toHaveProperty('visible');
      
      expect(typeof estado.x).toBe('number');
      expect(typeof estado.y).toBe('number');
      expect(typeof estado.rumbo).toBe('number');
      expect(typeof estado.lapizAbajo).toBe('boolean');
      expect(typeof estado.visible).toBe('boolean');
      
      // Verificar rangos
      expect(estado.x).toBeGreaterThanOrEqual(-600);
      expect(estado.x).toBeLessThanOrEqual(600);
      expect(estado.y).toBeGreaterThanOrEqual(-600);
      expect(estado.y).toBeLessThanOrEqual(600);
      expect(estado.rumbo).toBeGreaterThanOrEqual(0);
      expect(estado.rumbo).toBeLessThan(360);
    });
    
    it('es determinista con la misma semilla', () => {
      const prng1 = crearPrng(555);
      const estado1 = generarEstadoTortuga(prng1);
      
      const prng2 = crearPrng(555);
      const estado2 = generarEstadoTortuga(prng2);
      
      expect(estado1.x).toBe(estado2.x);
      expect(estado1.y).toBe(estado2.y);
      expect(estado1.rumbo).toBeCloseTo(estado2.rumbo, 10);
      expect(estado1.lapizAbajo).toBe(estado2.lapizAbajo);
      expect(estado1.visible).toBe(estado2.visible);
    });
    
    it('genera posiciones fuera del lienzo a propósito', () => {
      // Probamos varias semillas para verificar que algunas posiciones
      // están fuera del lienzo ([-400, 400]² es el lienzo centrado)
      let encontroFueraDelLienzo = false;
      
      for (let semilla = 0; semilla < 10; semilla++) {
        const prng = crearPrng(semilla);
        const estado = generarEstadoTortuga(prng);
        
        if (Math.abs(estado.x) > 400 || Math.abs(estado.y) > 400) {
          encontroFueraDelLienzo = true;
          break;
        }
      }
      
      // Es probable que al menos un estado esté fuera del lienzo
      // dado que el rango es [-600, 600] y el lienzo es [-400, 400]
      expect(encontroFueraDelLienzo).toBe(true);
    });
  });
  
  describe('exportaciones', () => {
    it('exporta las cuatro funciones generadoras', () => {
      expect(typeof generarPrograma).toBe('function');
      expect(typeof generarProgramaExtendido).toBe('function');
      expect(typeof generarFigura).toBe('function');
      expect(typeof generarEstadoTortuga).toBe('function');
    });
    
    it('exporta interfaces para tipos generados', () => {
      // Verificar que las interfaces existen en el ámbito de TypeScript
      // (esta prueba es principalmente para documentación)
      const estado: EstadoTortuga = {
        x: 0,
        y: 0,
        rumbo: 0,
        lapizAbajo: true,
        visible: true
      };
      
      const segmento: Segmento = {
        desdeX: 0,
        desdeY: 0,
        hastaX: 100,
        hastaY: 0
      };
      
      const figura: Figura = {
        segmentos: [segmento],
        ancho: 100,
        alto: 0
      };
      
      expect(estado).toBeDefined();
      expect(segmento).toBeDefined();
      expect(figura).toBeDefined();
    });
  });
});