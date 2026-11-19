// Mundo 5 (spec 06): condicionales, comparadores, ALTO, DEVUELVE y recursión, de punta a punta
// (lexer → parser → intérprete) más el impresor, el conteo y el análisis de abstracción.

import { describe, it, expect } from 'vitest';
import { analizarLexico } from './lexer.js';
import { analizar } from './parser.js';
import { ejecutar, LIMITES_PREDETERMINADOS, type Operacion, type ResultadoEjecucion } from './interprete.js';
import { comandosDelMundo, type Mundo } from './vocabulario.js';
import { imprimir } from './impresor.js';
import { contarInstrucciones } from './conteo.js';
import { analizar as analizarAbstraccion } from '../juego/abstraccion.js';
import { comparar } from './evaluador.js';
import type { Programa } from './ast.js';

function leer(texto: string, mundo: Mundo = 5) {
  const lexico = analizarLexico(texto);
  const sintactico = analizar(lexico.tokens, { mundo });
  return { programa: sintactico.programa, errores: [...lexico.errores, ...sintactico.errores] };
}

function programaDe(texto: string): Programa {
  const { programa, errores } = leer(texto);
  if (programa === null) throw new Error(errores.map((e) => e.mensaje).join('; '));
  return programa;
}

function correr(texto: string, maximaProfundidad = LIMITES_PREDETERMINADOS.maximaProfundidad): ResultadoEjecucion {
  const gen = ejecutar(programaDe(texto), {
    comandosPermitidos: comandosDelMundo(5),
    semilla: 0,
    limites: { ...LIMITES_PREDETERMINADOS, maximaProfundidad },
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

const idsDe = (texto: string, mundo: Mundo = 5) => leer(texto, mundo).errores.map((e) => e.id);

const avances = (ops: readonly Operacion[]) =>
  ops.filter((o) => o.tipo === 'mover').map((o) => (o.tipo === 'mover' ? Math.round(Math.hypot(o.hasta.x - o.desde.x, o.hasta.y - o.desde.y)) : 0));

describe('comparaciones', () => {
  it('=, < y > comparan con una tolerancia de 1e-9, y exactamente uno de los tres es cierto', () => {
    expect(comparar('=', 0.1 + 0.2, 0.3)).toBe(true);
    expect(comparar('<', 0.1 + 0.2, 0.3)).toBe(false);
    expect(comparar('>', 0.1 + 0.2, 0.3)).toBe(false);
    expect(comparar('<', 1, 2)).toBe(true);
    expect(comparar('>', 2, 1)).toBe(true);
    expect(comparar('=', 1, 2)).toBe(false);
  });
});

describe('SI y SINO', () => {
  it('SI ejecuta su lista solo si la condición es cierta', () => {
    const base = 'PARA P :n SI :n > 0 [AV 10] FIN';
    expect(correr(`${base} P 1`).operaciones).toHaveLength(1);
    expect(correr(`${base} P 0`).operaciones).toHaveLength(0);
  });

  it('SINO elige entre sus dos listas', () => {
    const base = 'PARA P :n SINO :n = 0 [AV 10] [AV 20] FIN';
    expect(avances(correr(`${base} P 0`).operaciones)).toEqual([10]);
    expect(avances(correr(`${base} P 5`).operaciones)).toEqual([20]);
  });

  it('los condicionales anidan y las expresiones aritméticas valen a ambos lados', () => {
    const r = correr('PARA P :n SI :n * 2 > 3 + 1 [SINO :n < 5 [AV 1] [AV 2]] FIN P 3 P 6 P 1');
    expect(avances(r.operaciones)).toEqual([1, 2]);
  });

  it('un condicional dentro de REPITE se evalúa en cada vuelta', () => {
    const r = correr('PARA P :n REPITE 4 [SI :n = 2 [AV 5] GD 90] FIN P 2');
    expect(avances(r.operaciones)).toEqual([5, 5, 5, 5]);
  });
});

describe('ALTO', () => {
  it('termina el procedimiento aunque esté dentro de un REPITE y un SI, y quien llamó sigue', () => {
    const r = correr('PARA P REPITE 5 [AV 1 SI 1 = 1 [ALTO]] AV 99 FIN P AV 7');
    expect(avances(r.operaciones)).toEqual([1, 7]);
  });

  it('la profundidad vuelve a 0 después de un ALTO', () => {
    const r = correr('PARA P SI 1 = 1 [ALTO] FIN P AV 7');
    expect(r.operaciones[0]!.profundidad).toBe(0);
  });
});

describe('recursión', () => {
  const ESPIRAL = 'PARA ESPIRAL :largo SI :largo > 200 [ALTO] AV :largo GD 90 ESPIRAL :largo + 5 FIN';

  it('la espiral cuadrada se detiene por su caso base, sin tocar la guarda', () => {
    const r = correr(`${ESPIRAL} ESPIRAL 20`);
    expect(r.guardaActivada).toBeNull();
    expect(r.error).toBeNull();
    expect(avances(r.operaciones)).toHaveLength(37);
    expect(Math.max(...r.operaciones.map((o) => o.profundidad))).toBe(37);
  });

  it('el parámetro de cada llamada es una copia: la llamada no cambia lo de quien llama', () => {
    const r = correr('PARA P :n SI :n = 0 [ALTO] P :n - 1 AV :n FIN P 3');
    expect(avances(r.operaciones)).toEqual([1, 2, 3]);
  });

  it('sin caso base corta con la guarda y el mensaje nombra el procedimiento y la condición de corte', () => {
    const r = correr('PARA ESPIRAL :largo AV :largo ESPIRAL :largo + 5 FIN ESPIRAL 5');
    expect(r.guardaActivada).toBe('recursion');
    expect(r.error!.id).toBe('guardaRecursion');
    expect(r.error!.mensaje).toContain('ESPIRAL');
    expect(r.error!.mensaje).toContain('condición de corte');
    // Conserva lo dibujado hasta cortar: 100 llamadas caben, la 101 no.
    expect(avances(r.operaciones)).toHaveLength(100);
  });

  it('la guarda de profundidad se puede bajar y corta justo después del límite', () => {
    // La llamada 38, la que ya no dibuja y se detiene por su caso base, también ocupa un nivel.
    expect(correr(`${ESPIRAL} ESPIRAL 20`, 37).guardaActivada).toBe('recursion');
    expect(correr(`${ESPIRAL} ESPIRAL 20`, 38).guardaActivada).toBeNull();
  });

  it('una recursión con dos llamadas por nivel (árbol) dibuja hasta la profundidad n', () => {
    const r = correr('PARA A :n SI :n = 0 [ALTO] AV 1 A :n - 1 A :n - 1 RE 1 FIN A 5');
    expect(Math.max(...r.operaciones.map((o) => o.profundidad))).toBe(5);
    expect(avances(r.operaciones)).toHaveLength(2 * (2 ** 5 - 1));
  });

  it('REPITE no cuenta como nivel de llamada', () => {
    const r = correr('PARA P REPITE 150 [AV 1] FIN P');
    expect(r.guardaActivada).toBeNull();
    expect(Math.max(...r.operaciones.map((o) => o.profundidad))).toBe(1);
  });
});

describe('DEVUELVE y procedimientos con valor', () => {
  it('un procedimiento con DEVUELVE se usa como número', () => {
    const r = correr('PARA DOBLE :n DEVUELVE :n * 2 FIN AV DOBLE 50');
    expect(avances(r.operaciones)).toEqual([100]);
  });

  it('puede ser recursivo: factorial', () => {
    const r = correr('PARA FACT :n SI :n < 2 [DEVUELVE 1] DEVUELVE :n * FACT :n - 1 FIN AV FACT 5');
    expect(avances(r.operaciones)).toEqual([120]);
  });

  it('DV es la abreviatura', () => {
    expect(avances(correr('PARA UNO DV 1 FIN AV UNO').operaciones)).toEqual([1]);
  });

  it('una recursión de valor sin caso base corta con la guarda de recursión', () => {
    const r = correr('PARA F :n DEVUELVE F :n + 1 FIN AV F 1');
    expect(r.guardaActivada).toBe('recursion');
    expect(r.error!.mensaje).toContain('F se llama a sí mismo');
  });

  it('llamarlo como instrucción es un error que sugiere usarlo dentro de otro comando', () => {
    const { errores } = leer('PARA DOBLE :n DEVUELVE :n * 2 FIN DOBLE 3');
    expect(errores.map((e) => e.id)).toEqual(['devuelveSinUso']);
    expect(errores[0]!.mensaje).toContain('ESCRIBE DOBLE 3');
  });

  it('usar como número un procedimiento sin DEVUELVE es un error propio', () => {
    expect(idsDe('PARA CUADRADO AV 1 FIN AV CUADRADO')).toEqual(['procedimientoSinValor']);
  });

  it('si ningún camino devuelve algo, la ejecución se detiene explicando la línea', () => {
    const r = correr('PARA F :n SI :n > 0 [DEVUELVE 1] FIN AV F 0');
    expect(r.error!.id).toBe('procedimientoSinResultado');
    expect(r.error!.mensaje).toContain('DEVUELVE');
  });

  it('como operador solo calcula: dibujar o escribir dentro de él detiene la ejecución', () => {
    const r = correr('PARA F AV 5 DEVUELVE 1 FIN AV F');
    expect(r.error!.id).toBe('operadorConEfectos');
    expect(r.operaciones).toHaveLength(0);
  });

  it('antes del mundo 5 un procedimiento no se acepta donde va un número (sin cambios)', () => {
    expect(idsDe('PARA C AV 1 FIN AV C', 4)).not.toContain('procedimientoSinValor');
  });
});

describe('errores de sintaxis del mundo 5', () => {
  it('una condición sin comparador', () => {
    const { errores } = leer('PARA P :n SI :n [AV 1] FIN');
    expect(errores.map((e) => e.id)).toEqual(['condicionMalFormada']);
    expect(errores[0]!.mensaje).toContain('=, < o >');
  });

  it('dos comparaciones encadenadas, sin errores en cascada por los corchetes', () => {
    expect(idsDe('PARA P :n SI 1 < :n < 3 [AV 1] FIN')).toEqual(['condicionMalFormada']);
  });

  it('una comparación fuera de la condición', () => {
    expect(idsDe('PARA P :n AV :n > 3 FIN')).toEqual(['condicionMalFormada']);
  });

  it('a la comparación le falta el lado derecho', () => {
    expect(idsDe('PARA P :n SI :n > [AV 1] FIN')).toEqual(['expresionIncompleta']);
  });

  it('SI sin lista, y SINO con una sola', () => {
    expect(idsDe('PARA P :n SI :n > 1 FIN')).toEqual(['argumentoFaltante']);
    expect(idsDe('PARA P :n SINO :n > 1 [AV 1] FIN')).toEqual(['argumentoFaltante']);
  });

  it('SI sin condición', () => {
    expect(idsDe('PARA P SI [AV 1] FIN')).toEqual(['argumentoDeTipoEquivocado']);
  });

  it('ALTO y DEVUELVE fuera de un PARA', () => {
    expect(idsDe('ALTO')).toEqual(['altoFueraDeProcedimiento']);
    expect(idsDe('REPITE 2 [ALTO]')).toEqual(['altoFueraDeProcedimiento']);
    expect(idsDe('DEVUELVE 1')).toEqual(['devuelveFueraDeProcedimiento']);
  });

  it('antes del mundo 5 SI, ALTO y los comparadores están bloqueados, y el aviso del comparador sale una vez', () => {
    const ids = idsDe('PARA P :n SI :n = 0 [ALTO] FIN', 4);
    expect(ids.filter((id) => id === 'comparadorBloqueado')).toHaveLength(1);
    expect(ids).toContain('comandoBloqueado');
    expect(idsDe('AV 1 < 2', 4)).toEqual(['comparadorBloqueado']);
  });
});

describe('impresor, conteo y abstracción', () => {
  const TEXTOS = [
    'PARA P :n\n  SI :n > 0 [\n    AVANZA :n\n    ALTO\n  ]\n  SINO :n = 3 [\n    AVANZA 1\n  ] [\n    AVANZA 2\n  ]\nFIN\nP 1\n',
    'PARA F :n\n  DEVUELVE :n * 2\nFIN\nAVANZA F 3 + 1\n',
  ];

  it('imprimir y volver a leer da el mismo texto', () => {
    for (const texto of TEXTOS) {
      const impreso = imprimir(programaDe(texto));
      expect(impreso.exito && impreso.texto).toBe(texto);
    }
  });

  it('listas vacías se imprimen y se leen', () => {
    const texto = 'PARA P :n\n  SINO :n > 1 [] [\n    AVANZA 1\n  ]\nFIN\nP 1\n';
    const impreso = imprimir(programaDe(texto));
    expect(impreso.exito && impreso.texto).toBe(texto);
  });

  it('SI y SINO cuentan 1 más sus listas; las condiciones y las llamadas con valor cuestan 0', () => {
    const cuenta = (t: string) => {
      const c = contarInstrucciones(programaDe(t));
      return c.exito ? c.instrucciones : -1;
    };
    expect(cuenta('PARA P :n SI :n > 0 [AV 1 GD 2] FIN P 1')).toBe(1 + 2 + 1);
    expect(cuenta('PARA P :n SINO :n > 0 [AV 1] [AV 2 GD 1] FIN P 1')).toBe(1 + 1 + 2 + 1);
    expect(cuenta('PARA P :n SI :n > 0 [ALTO] FIN P 1')).toBe(1 + 1 + 1);
    expect(cuenta('PARA F :n DEVUELVE :n FIN AV F 1')).toBe(1 + 1);
  });

  it('usaRecursion reconoce la llamada a sí mismo, también dentro de una expresión', () => {
    const exigencia = [{ clave: 'usaRecursion' as const }];
    const confirma = (t: string) => analizarAbstraccion(programaDe(t), exigencia).sinConfirmar.length === 0;
    expect(confirma('PARA E :l SI :l > 9 [ALTO] AV :l E :l + 1 FIN E 1')).toBe(true);
    expect(confirma('PARA F :n SI :n < 2 [DEVUELVE 1] DEVUELVE :n * F :n - 1 FIN AV F 3')).toBe(true);
    expect(confirma('PARA E AV 1 FIN E')).toBe(false);
    expect(confirma('REPITE 3 [AV 1]')).toBe(false);
  });
});

describe('correcciones de la auditoría de la spec 06', () => {
  it('usaRecursion no se otorga con un PARA recursivo que nadie invoca', () => {
    const exigencia = [{ clave: 'usaRecursion' as const }];
    const confirma = (t: string) => analizarAbstraccion(programaDe(t), exigencia).sinConfirmar.length === 0;
    expect(confirma('PARA E :l SI :l > 9 [ALTO] AV :l E :l + 1 FIN AV 100')).toBe(false);
    expect(confirma('PARA E :l SI :l > 9 [ALTO] AV :l E :l + 1 FIN E 1')).toBe(true);
    // Arrancada desde otro procedimiento también cuenta.
    expect(confirma('PARA E :l SI :l > 9 [ALTO] AV :l E :l + 1 FIN PARA G E 1 FIN G')).toBe(true);
  });

  it('una comparación entre paréntesis dice que va sin ellos, no que falta cerrar', () => {
    const { errores } = leer('PARA P :n SI (:n = 3) [AV 1] FIN P 1');
    expect(errores.map((e) => e.id)).toEqual(['condicionMalFormada']);
    expect(errores[0]!.mensaje).toContain('sin paréntesis');
  });

  it.each(['<=', '>=', '<>', '=='])('%s no existe en KiroLogo y el mensaje lo dice', (simbolo) => {
    const { errores } = leer(`PARA P :n SI :n ${simbolo} 3 [AV 1] FIN P 1`);
    expect(errores.map((e) => e.id)).toEqual(['condicionMalFormada']);
    expect(errores[0]!.mensaje).toContain('solo tiene =, < y >');
  });

  it('una condición rota en la misma línea que FIN no inventa un paraSinFin', () => {
    expect(leer('PARA P :n SI :n FIN').errores.map((e) => e.id)).toEqual(['condicionMalFormada']);
  });

  it('listas anidadas hasta 64 niveles se leen; con más se corta con un solo mensaje y sin desbordar la pila', () => {
    const anidado = (n: number) => 'REPITE 1 ['.repeat(n) + 'AV 1' + ']'.repeat(n);
    expect(leer(anidado(30)).errores).toEqual([]);
    for (const n of [65, 3000]) {
      expect(leer(anidado(n)).errores.map((e) => e.id), `${n} niveles`).toEqual(['anidamientoDemasiadoProfundo']);
    }
    expect(leer('SI 1 = 1 ['.repeat(3000)).errores.map((e) => e.id)).toEqual(['anidamientoDemasiadoProfundo']);
    expect(leer('PARA P ' + 'SI 1 = 1 ['.repeat(3000) + ' FIN').errores.map((e) => e.id)).toEqual(['anidamientoDemasiadoProfundo']);
  });
});
