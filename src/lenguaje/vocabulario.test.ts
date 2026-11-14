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
import { resolverPalabraNoEjecutable } from './errores.js';
import { analizarLexico } from './lexer.js';
import { analizar } from './parser.js';

describe('vocabulario.ts', () => {
  describe('Tipos básicos', () => {
    it('TipoArgumento es una unión de strings', () => {
      const tipos: TipoArgumento[] = ['numero', 'palabra', 'lista', 'expresion', 'valorEscribible'];
      expect(tipos).toHaveLength(5);
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

    describe('Tabla del mundo 0', () => {
      const mundo0 = VOCABULARIO.filter(e => e.mundo === 0);
      
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

    describe('Entradas de mundos posteriores', () => {
      it('REPITE está en mundo 1 y bloqueado', () => {
        const repite = VOCABULARIO.find(e => e.nombre === 'REPITE');
        expect(repite).toBeDefined();
        expect(repite!.mundo).toBe(1);
        expect(repite!.abreviatura).toBe('RP');
        expect(repite!.aridad).toBe(2);
        expect(repite!.tiposArgumento).toEqual(['numero', 'lista']);
      });

      it('Mundo 2 tiene 9 comandos bloqueados', () => {
        const mundo2 = VOCABULARIO.filter(e => e.mundo === 2);
        expect(mundo2).toHaveLength(9);
      });

      it('Mundo 3 no agrega vocabulario', () => {
        const mundo3 = VOCABULARIO.filter(e => e.mundo === 3);
        expect(mundo3).toHaveLength(0);
      });

      it('Mundo 4 tiene 8 comandos bloqueados', () => {
        const mundo4 = VOCABULARIO.filter(e => e.mundo === 4);
        expect(mundo4).toHaveLength(8);
      });

      it('Mundo 4: firmas de los operadores, AZAR, ESCRIBE y ROTULA', () => {
        const firma = (nombre: string) => {
          const e = VOCABULARIO.find(x => x.nombre === nombre)!;
          return [e.abreviatura, e.aridad, e.tiposArgumento];
        };
        for (const op of ['SUMA', 'RESTA', 'PRODUCTO', 'COCIENTE', 'RESTO']) {
          expect(firma(op)).toEqual([null, 2, ['numero', 'numero']]);
        }
        expect(firma('AZAR')).toEqual([null, 1, ['numero']]);
        expect(firma('ESCRIBE')).toEqual(['ES', 1, ['valorEscribible']]);
        expect(firma('ROTULA')).toEqual(['RO', 1, ['valorEscribible']]);
      });

      it('produceValor es true solo en los cinco operadores y AZAR', () => {
        const producen = VOCABULARIO.filter(e => e.produceValor).map(e => e.nombre);
        expect(producen).toEqual(['SUMA', 'RESTA', 'PRODUCTO', 'COCIENTE', 'RESTO', 'AZAR']);
      });

      it('ejecutable es false solo en SI, SINO, ALTO y DEVUELVE', () => {
        const noEjecutables = VOCABULARIO.filter(e => !e.ejecutable).map(e => e.nombre);
        expect(noEjecutables).toEqual(['SI', 'SINO', 'ALTO', 'DEVUELVE']);
      });

      it('Mundo 5 tiene 4 comandos bloqueados', () => {
        const mundo5 = VOCABULARIO.filter(e => e.mundo === 5);
        expect(mundo5).toHaveLength(4);
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

  describe('Vocabulario bloqueado en el mundo 0', () => {
    // Req. 7 — Vocabulario bloqueado: en el mundo 0, REPITE todavía no existe
    // para el jugador. El bloqueo es un dato del vocabulario (REPITE vive en el
    // mundo 1), no una regla del parser.
    it('REPITE no forma parte del vocabulario desbloqueado del mundo 0', () => {
      const desbloqueados = comandosDelMundo(0);
      expect(desbloqueados.some(e => e.nombre === 'REPITE')).toBe(false);

      const repite = VOCABULARIO.find(e => e.nombre === 'REPITE');
      expect(repite).toBeDefined();
      // El mundo de REPITE (1) es posterior al mundo actual (0): está bloqueado.
      expect(repite!.mundo).toBeGreaterThan(0);
    });

    it('intentar usar REPITE en el mundo 0 produce el mensaje de desbloqueo', () => {
      const error = resolverPalabraNoEjecutable('REPITE', 0);
      expect(error.mensaje).toBe(
        'REPITE todavía no está disponible. Se desbloquea en el mundo 1.',
      );
    });

    it('la comprobación es de vocabulario bloqueado, no un error de parser genérico', () => {
      // El id es comandoBloqueado (validación previa al parser), no un error
      // sintáctico como palabraInesperada o numeroInesperado.
      const error = resolverPalabraNoEjecutable('REPITE', 0);
      expect(error.id).toBe('comandoBloqueado');
      // Es un mensaje dirigido al jugador, no un fallo de programación.
      expect(error.severidad).toBe('jugador');
    });

    it('REPITE queda disponible al entrar al mundo 1', () => {
      const desbloqueados = comandosDelMundo(1);
      expect(desbloqueados.some(e => e.nombre === 'REPITE')).toBe(true);
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

  describe('Campo insercion', () => {
    // Feature: 09-ajustes-de-interfaz, Property 1: insercion cumple su regla derivada de los campos
    it('insercion cumple su regla derivada en las 28 entradas', () => {
      for (const entrada of VOCABULARIO) {
        const esperado =
          entrada.aridad === 1 && entrada.tiposArgumento[0] === 'numero' && !entrada.produceValor
            ? entrada.nombre + ' '
            : entrada.aridad === 0
              ? entrada.nombre
              : entrada.ejemplo;

        expect(entrada.insercion, `insercion de ${entrada.nombre}`).toBe(esperado);
      }
    });
  });
});

describe('vocabulario.ts · tipos de argumento de PONCOLOR y PARA (punto 8)', () => {
  it('TipoArgumento incluye color y nombre', () => {
    const tipos: TipoArgumento[] = ['numero', 'palabra', 'lista', 'expresion', 'color', 'nombre'];
    expect(tipos).toHaveLength(6);
  });

  it('PONCOLOR declara un argumento de color y su ejemplo e inserción son válidos (sin comilla de cierre)', () => {
    const r = buscarComando('PONCOLOR');
    expect(r.hallada).toBe(true);
    if (!r.hallada) return;
    expect(r.entrada.tiposArgumento).toEqual(['color']);
    expect(r.entrada.ejemplo).toBe('PONCOLOR "rojo');
    expect(r.entrada.insercion).toBe('PONCOLOR "rojo');
    expect(r.entrada.ejemplo.endsWith('"')).toBe(false);
  });

  it('PARA declara un argumento de nombre', () => {
    const r = buscarComando('PARA');
    expect(r.hallada).toBe(true);
    if (r.hallada) expect(r.entrada.tiposArgumento).toEqual(['nombre']);
  });
});

describe('vocabulario.ts · RELLENA lleva un argumento de color (punto 7a)', () => {
  it('RELLENA y RL: aridad 1, tipo color, ejemplo e inserción RELLENA "azul (sin comilla de cierre)', () => {
    for (const palabra of ['RELLENA', 'RL']) {
      const r = buscarComando(palabra);
      expect(r.hallada, palabra).toBe(true);
      if (!r.hallada) continue;
      expect(r.entrada.nombre).toBe('RELLENA');
      expect(r.entrada.aridad).toBe(1);
      expect(r.entrada.tiposArgumento).toEqual(['color']);
      expect(r.entrada.ejemplo).toBe('RELLENA "azul');
      expect(r.entrada.insercion).toBe('RELLENA "azul');
    }
  });
});

// ============================================================================
// Mundo 4: tabla de las ocho entradas (spec 05, tarea 1.4)
// ============================================================================

describe('vocabulario.ts · las ocho entradas del mundo 4', () => {
  const OCHO = ['SUMA', 'RESTA', 'PRODUCTO', 'COCIENTE', 'RESTO', 'AZAR', 'ESCRIBE', 'ROTULA'] as const;
  const OPERADORES = ['SUMA', 'RESTA', 'PRODUCTO', 'COCIENTE', 'RESTO', 'AZAR'] as const;
  const entrada = (nombre: string) => VOCABULARIO.find((e) => e.nombre === nombre)!;

  it('la tabla completa coincide con el diseño (R12.1–R12.4)', () => {
    const tabla = OCHO.map((n) => {
      const e = entrada(n);
      return [e.nombre, e.abreviatura, e.aridad, e.tiposArgumento, e.mundo, e.produceValor, e.ejecutable, e.descripcion, e.ejemplo];
    });
    expect(tabla).toEqual([
      ['SUMA', null, 2, ['numero', 'numero'], 4, true, true, 'Suma dos números.', 'ESCRIBE SUMA 30 40'],
      ['RESTA', null, 2, ['numero', 'numero'], 4, true, true, 'Resta el segundo número del primero.', 'ESCRIBE RESTA 65 45'],
      ['PRODUCTO', null, 2, ['numero', 'numero'], 4, true, true, 'Multiplica dos números.', 'ESCRIBE PRODUCTO 5 10'],
      ['COCIENTE', null, 2, ['numero', 'numero'], 4, true, true, 'Divide el primer número entre el segundo, sin truncar.', 'ESCRIBE COCIENTE 8 2'],
      ['RESTO', null, 2, ['numero', 'numero'], 4, true, true, 'Calcula el resto de la división.', 'ESCRIBE RESTO 5 3'],
      ['AZAR', null, 1, ['numero'], 4, true, true, 'Elige un número entero al azar entre 0 y n-1.', 'ESCRIBE AZAR 100'],
      ['ESCRIBE', 'ES', 1, ['valorEscribible'], 4, false, true, 'Muestra un valor en la consola.', 'ESCRIBE 360 / 5'],
      ['ROTULA', 'RO', 1, ['valorEscribible'], 4, false, true, 'Escribe un texto o un número sobre el lienzo.', 'ROTULA "hola'],
    ]);
  });

  it('produceValor es verdadero solo en las seis entradas de operador (R6.1)', () => {
    for (const e of VOCABULARIO) {
      expect(e.produceValor, e.nombre).toBe((OPERADORES as readonly string[]).includes(e.nombre));
    }
  });

  it('ESCRIBE y ROTULA no conservan palabra ni numero en sus tipos (R12.2)', () => {
    for (const n of ['ESCRIBE', 'ROTULA']) {
      expect(entrada(n).tiposArgumento).not.toContain('palabra');
      expect(entrada(n).tiposArgumento).not.toContain('numero');
    }
  });

  it('SUMA y PRODUCTO tienen aridad fija 2, no variable (R12.3)', () => {
    expect(entrada('SUMA').aridad).toBe(2);
    expect(entrada('PRODUCTO').aridad).toBe(2);
  });

  it('las descripciones son de una línea, no vacías y de a lo sumo 120 caracteres (R12.5)', () => {
    for (const n of OCHO) {
      const { descripcion } = entrada(n);
      expect(descripcion.trim().length, n).toBeGreaterThan(0);
      expect(descripcion, n).not.toMatch(/[\r\n]/);
      expect(descripcion.length, n).toBeLessThanOrEqual(120);
    }
  });

  it('ninguna abreviatura se repite ni iguala el nombre de otra entrada, con la normalización del lexer (R12.9)', () => {
    // Se normaliza pasando cada palabra por el lexer: es la misma normalización que verá el jugador.
    const normalizar = (palabra: string): string => {
      const { tokens } = analizarLexico(palabra);
      return String(tokens[0]!.valor);
    };
    const conAbreviatura = VOCABULARIO.filter((e) => e.abreviatura !== null);
    const abreviaturas = conAbreviatura.map((e) => normalizar(e.abreviatura!));
    expect(new Set(abreviaturas).size).toBe(abreviaturas.length);

    for (const e of conAbreviatura) {
      const abreviatura = normalizar(e.abreviatura!);
      for (const otra of VOCABULARIO) {
        if (otra === e) continue;
        expect(normalizar(otra.nombre), `${e.abreviatura} de ${e.nombre} contra ${otra.nombre}`).not.toBe(abreviatura);
      }
    }
  });

  it('el ejemplo de cada entrada y la inserción de cada operador se analizan sin errores en el mundo 4 (R6.7)', () => {
    const errores = (texto: string) => {
      const lexico = analizarLexico(texto);
      return [...lexico.errores, ...analizar(lexico.tokens, { mundo: 4 }).errores].map((e) => e.id);
    };
    for (const n of OCHO) {
      expect(errores(entrada(n).ejemplo), `ejemplo de ${n}`).toEqual([]);
    }
    for (const n of OPERADORES) {
      expect(entrada(n).insercion, n).toBe(entrada(n).ejemplo);
      expect(errores(entrada(n).insercion), `inserción de ${n}`).toEqual([]);
    }
  });
});
