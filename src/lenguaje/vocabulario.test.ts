import { describe, it, expect } from 'vitest';
import {
  TipoArgumento,
  Aridad,
  Mundo,
  VOCABULARIO,
  normalizarPalabra,
  buscarComando,
  comandosDelMundo,
} from './vocabulario.js';

describe('vocabulario.ts', () => {
  describe('Tipos básicos', () => {
    it('TipoArgumento es una unión de strings', () => {
      const tipos: TipoArgumento[] = ['numero', 'palabra', 'lista', 'expresion'];
      expect(tipos).toHaveLength(4);
    });

    it('Aridad es una unión de números y "variable"', () => {
      const aridades: Aridad[] = [0, 1, 2, 3, 'variable'];
      expect(aridades).toHaveLength(5);
    });

    it('Mundo es una unión de números del 0 al 5', () => {
      const mundos: Mundo[] = [0, 1, 2, 3, 4, 5];
      expect(mundos).toHaveLength(6);
    });
  });

  describe('VOCABULARIO', () => {
    it('contiene exactamente 28 entradas', () => {
      expect(VOCABULARIO).toHaveLength(28);
    });

    describe('Tabla del mundo 0 (ejecutable: true)', () => {
      const mundo0 = VOCABULARIO.filter(e => e.mundo === 0 && e.ejecutable);
      
      it('tiene 6 comandos ejecutables', () => {
        expect(mundo0).toHaveLength(6);
      });

      it('AVANZA tiene todas las propiedades correctas', () => {
        const avanza = mundo0.find(e => e.nombre === 'AVANZA');
        expect(avanza).toBeDefined();
        expect(avanza!.abreviatura).toBe('AV');
        expect(avanza!.aridad).toBe(1);
        expect(avanza!.tiposArgumento).toEqual(['numero']);
        expect(avanza!.descripcion).toBe('La tortuga camina hacia adelante los pasos que le digas.');
        expect(avanza!.descripcion.length).toBeLessThanOrEqual(120);
        expect(avanza!.ejemplo).toBe('AVANZA 100');
      });

      it('RETROCEDE tiene todas las propiedades correctas', () => {
        const retrocede = mundo0.find(e => e.nombre === 'RETROCEDE');
        expect(retrocede).toBeDefined();
        expect(retrocede!.abreviatura).toBe('RE');
        expect(retrocede!.aridad).toBe(1);
        expect(retrocede!.tiposArgumento).toEqual(['numero']);
        expect(retrocede!.descripcion).toBe('La tortuga camina hacia atrás sin cambiar de rumbo.');
        expect(retrocede!.descripcion.length).toBeLessThanOrEqual(120);
        expect(retrocede!.ejemplo).toBe('RETROCEDE 50');
      });

      it('GIRADERECHA tiene todas las propiedades correctas', () => {
        const giraderecha = mundo0.find(e => e.nombre === 'GIRADERECHA');
        expect(giraderecha).toBeDefined();
        expect(giraderecha!.abreviatura).toBe('GD');
        expect(giraderecha!.aridad).toBe(1);
        expect(giraderecha!.tiposArgumento).toEqual(['numero']);
        expect(giraderecha!.descripcion).toBe('Gira a la derecha los grados que le digas.');
        expect(giraderecha!.descripcion.length).toBeLessThanOrEqual(120);
        expect(giraderecha!.ejemplo).toBe('GIRADERECHA 90');
      });

      it('GIRAIZQUIERDA tiene todas las propiedades correctas', () => {
        const giraizquierda = mundo0.find(e => e.nombre === 'GIRAIZQUIERDA');
        expect(giraizquierda).toBeDefined();
        expect(giraizquierda!.abreviatura).toBe('GI');
        expect(giraizquierda!.aridad).toBe(1);
        expect(giraizquierda!.tiposArgumento).toEqual(['numero']);
        expect(giraizquierda!.descripcion).toBe('Gira a la izquierda los grados que le digas.');
        expect(giraizquierda!.descripcion.length).toBeLessThanOrEqual(120);
        expect(giraizquierda!.ejemplo).toBe('GIRAIZQUIERDA 45');
      });

      it('CENTRO tiene todas las propiedades correctas', () => {
        const centro = mundo0.find(e => e.nombre === 'CENTRO');
        expect(centro).toBeDefined();
        expect(centro!.abreviatura).toBe('CE');
        expect(centro!.aridad).toBe(0);
        expect(centro!.tiposArgumento).toEqual([]);
        expect(centro!.descripcion).toBe('Vuelve al centro del lienzo mirando hacia arriba.');
        expect(centro!.descripcion.length).toBeLessThanOrEqual(120);
        expect(centro!.ejemplo).toBe('CENTRO');
      });

      it('BORRAPANTALLA tiene todas las propiedades correctas', () => {
        const borrapantalla = mundo0.find(e => e.nombre === 'BORRAPANTALLA');
        expect(borrapantalla).toBeDefined();
        expect(borrapantalla!.abreviatura).toBe('BP');
        expect(borrapantalla!.aridad).toBe(0);
        expect(borrapantalla!.tiposArgumento).toEqual([]);
        expect(borrapantalla!.descripcion).toBe('Limpia el lienzo y vuelve al centro mirando hacia arriba.');
        expect(borrapantalla!.descripcion.length).toBeLessThanOrEqual(120);
        expect(borrapantalla!.ejemplo).toBe('BORRAPANTALLA');
      });
    });

    describe('Entradas bloqueadas (ejecutable: false)', () => {
      it('REPITE está en mundo 1 y bloqueado', () => {
        const repite = VOCABULARIO.find(e => e.nombre === 'REPITE');
        expect(repite).toBeDefined();
        expect(repite!.mundo).toBe(1);
        expect(repite!.ejecutable).toBe(false);
        expect(repite!.abreviatura).toBe('RP');
        expect(repite!.aridad).toBe(2);
        expect(repite!.tiposArgumento).toEqual(['numero', 'lista']);
      });

      it('Mundo 2 tiene 9 comandos bloqueados', () => {
        const mundo2 = VOCABULARIO.filter(e => e.mundo === 2);
        expect(mundo2).toHaveLength(9);
        expect(mundo2.every(e => !e.ejecutable)).toBe(true);
      });

      it('Mundo 3 no agrega vocabulario', () => {
        const mundo3 = VOCABULARIO.filter(e => e.mundo === 3);
        expect(mundo3).toHaveLength(0);
      });

      it('Mundo 4 tiene 8 comandos bloqueados', () => {
        const mundo4 = VOCABULARIO.filter(e => e.mundo === 4);
        expect(mundo4).toHaveLength(8);
        expect(mundo4.every(e => !e.ejecutable)).toBe(true);
      });

      it('Mundo 5 tiene 4 comandos bloqueados', () => {
        const mundo5 = VOCABULARIO.filter(e => e.mundo === 5);
        expect(mundo5).toHaveLength(4);
        expect(mundo5.every(e => !e.ejecutable)).toBe(true);
      });

      it('PARA tiene aridad "variable"', () => {
        const para = VOCABULARIO.find(e => e.nombre === 'PARA');
        expect(para).toBeDefined();
        expect(para!.aridad).toBe('variable');
      });

      it('FIN no tiene abreviatura', () => {
        const fin = VOCABULARIO.find(e => e.nombre === 'FIN');
        expect(fin).toBeDefined();
        expect(fin!.abreviatura).toBeNull();
      });
    });
  });

  describe('normalizarPalabra', () => {
    it('convierte a mayúsculas', () => {
      expect(normalizarPalabra('avanza')).toBe('AVANZA');
      expect(normalizarPalabra('AvAnZa')).toBe('AVANZA');
    });

    it('reemplaza vocales acentuadas sin usar normalize("NFD")', () => {
      expect(normalizarPalabra('á')).toBe('A');
      expect(normalizarPalabra('Á')).toBe('A');
      expect(normalizarPalabra('é')).toBe('E');
      expect(normalizarPalabra('É')).toBe('E');
      expect(normalizarPalabra('í')).toBe('I');
      expect(normalizarPalabra('Í')).toBe('I');
      expect(normalizarPalabra('ó')).toBe('O');
      expect(normalizarPalabra('Ó')).toBe('O');
      expect(normalizarPalabra('ú')).toBe('U');
      expect(normalizarPalabra('Ú')).toBe('U');
      expect(normalizarPalabra('ü')).toBe('U');
      expect(normalizarPalabra('Ü')).toBe('U');
    });

    it('preserva ñ como Ñ', () => {
      expect(normalizarPalabra('ñ')).toBe('Ñ');
      expect(normalizarPalabra('Ñ')).toBe('Ñ');
      expect(normalizarPalabra('año')).toBe('AÑO');
      expect(normalizarPalabra('AÑO')).toBe('AÑO');
    });

    it('AÑO es distinto de ANO', () => {
      expect(normalizarPalabra('AÑO')).toBe('AÑO');
      expect(normalizarPalabra('ANO')).toBe('ANO');
      expect(normalizarPalabra('AÑO')).not.toBe(normalizarPalabra('ANO'));
    });
  });

  describe('buscarComando', () => {
    it('encuentra comandos por nombre largo', () => {
      const resultado = buscarComando('AVANZA');
      expect(resultado.hallada).toBe(true);
      expect(resultado.hallada && resultado.entrada.nombre).toBe('AVANZA');
    });

    it('encuentra comandos por abreviatura', () => {
      const resultado = buscarComando('AV');
      expect(resultado.hallada).toBe(true);
      expect(resultado.hallada && resultado.entrada.nombre).toBe('AVANZA');
    });

    it('normaliza la palabra antes de buscar', () => {
      expect(buscarComando('avanza').hallada).toBe(true);
      expect(buscarComando('AvAnZa').hallada).toBe(true);
      expect(buscarComando('Ávanza').hallada).toBe(true); // á → A
    });

    it('busca en todas las entradas sin filtrar por mundo', () => {
      // REPITE está en mundo 1 y bloqueado, pero debe ser encontrado
      const resultado = buscarComando('REPITE');
      expect(resultado.hallada).toBe(true);
      expect(resultado.hallada && resultado.entrada.nombre).toBe('REPITE');
      expect(resultado.hallada && resultado.entrada.ejecutable).toBe(false);
    });

    it('devuelve hallada: false para palabra no declarada', () => {
      const resultado = buscarComando('XYZ123');
      expect(resultado.hallada).toBe(false);
    });

    it('devuelve resultado explícito sin excepción', () => {
      // Esto no debería lanzar error
      const resultado = buscarComando('NOEXISTE');
      expect(resultado).toEqual({ hallada: false });
    });
  });

  describe('comandosDelMundo', () => {
    it('devuelve entradas con mundo ≤ n', () => {
      const mundo0 = comandosDelMundo(0);
      expect(mundo0).toHaveLength(6); // solo los 6 del mundo 0
      expect(mundo0.every(e => e.mundo === 0)).toBe(true);

      const mundo1 = comandosDelMundo(1);
      expect(mundo1).toHaveLength(7); // 6 del mundo 0 + 1 del mundo 1
      expect(mundo1.filter(e => e.mundo === 0)).toHaveLength(6);
      expect(mundo1.filter(e => e.mundo === 1)).toHaveLength(1);
    });

    it('mantiene el orden de declaración', () => {
      const todos = comandosDelMundo(5);
      const nombres = todos.map(e => e.nombre);
      
      // Los primeros deben ser los del mundo 0 en el orden declarado
      expect(nombres.slice(0, 6)).toEqual([
        'AVANZA', 'RETROCEDE', 'GIRADERECHA', 
        'GIRAIZQUIERDA', 'CENTRO', 'BORRAPANTALLA'
      ]);
      
      // Luego REPITE del mundo 1
      expect(nombres[6]).toBe('REPITE');
    });

    it('mundo 5 incluye todos los comandos', () => {
      const mundo5 = comandosDelMundo(5);
      expect(mundo5).toHaveLength(VOCABULARIO.length);
    });
  });

  describe('Prueba de colisiones', () => {
    it('no hay colisiones entre nombres largos tras normalizar', () => {
      const nombresNormalizados = VOCABULARIO.map(e => normalizarPalabra(e.nombre));
      const nombresUnicos = new Set(nombresNormalizados);
      
      if (nombresNormalizados.length !== nombresUnicos.size) {
        // Encontrar duplicados
        const contador = new Map<string, string[]>();
        VOCABULARIO.forEach(entrada => {
          const normalizado = normalizarPalabra(entrada.nombre);
          const lista = contador.get(normalizado) || [];
          lista.push(entrada.nombre);
          contador.set(normalizado, lista);
        });
        
        const conflictos = Array.from(contador.entries())
          .filter(([_, nombres]) => nombres.length > 1);
        
        if (conflictos.length > 0) {
          const mensaje = conflictos.map(([texto, nombres]) => 
            `${texto} → ${nombres.join(', ')}`
          ).join('; ');
          throw new Error(`Conflicto de nombres largos: ${mensaje}`);
        }
      }
      
      expect(nombresNormalizados.length).toBe(nombresUnicos.size);
    });

    it('no hay colisiones entre abreviaturas tras normalizar', () => {
      const abreviaturasNormalizadas = VOCABULARIO
        .filter(e => e.abreviatura !== null)
        .map(e => normalizarPalabra(e.abreviatura!));
      const abreviaturasUnicas = new Set(abreviaturasNormalizadas);
      
      if (abreviaturasNormalizadas.length !== abreviaturasUnicas.size) {
        // Encontrar duplicados
        const contador = new Map<string, string[]>();
        VOCABULARIO.forEach(entrada => {
          if (entrada.abreviatura !== null) {
            const normalizado = normalizarPalabra(entrada.abreviatura);
            const lista = contador.get(normalizado) || [];
            lista.push(`${entrada.nombre} (${entrada.abreviatura})`);
            contador.set(normalizado, lista);
          }
        });
        
        const conflictos = Array.from(contador.entries())
          .filter(([_, entradas]) => entradas.length > 1);
        
        if (conflictos.length > 0) {
          const mensaje = conflictos.map(([texto, entradas]) => 
            `${texto} → ${entradas.join(', ')}`
          ).join('; ');
          throw new Error(`Conflicto de abreviaturas: ${mensaje}`);
        }
      }
      
      expect(abreviaturasNormalizadas.length).toBe(abreviaturasUnicas.size);
    });

    it('hay exactamente 17 abreviaturas', () => {
      const conAbreviatura = VOCABULARIO.filter(e => e.abreviatura !== null);
      expect(conAbreviatura).toHaveLength(17);
    });

    it('nombres largos y abreviaturas no colisionan entre sí', () => {
      const todasCadenas = VOCABULARIO.flatMap(entrada => [
        normalizarPalabra(entrada.nombre),
        ...(entrada.abreviatura !== null ? [normalizarPalabra(entrada.abreviatura)] : [])
      ]);
      
      const unicas = new Set(todasCadenas);
      expect(todasCadenas.length).toBe(unicas.size);
    });
  });
});