// Pruebas del análisis de abstracción
// Las seis claves una por una sobre árboles con nodos reservados (16.3).

import { describe, it, expect } from 'vitest';
import { analizar } from './abstraccion.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar as analizar_ } from '../lenguaje/parser.js';
import type {
  Programa,
  Instruccion,
  NumeroLiteral,
  ReferenciaParametro,
  Repeticion,
  DefinicionProcedimiento,
  InvocacionProcedimiento,
  InvocacionComando,
} from '../lenguaje/ast.js';
import type { ExigenciaAbstraccion } from '../niveles/tipos.js';

// ============================================================================
// Constructores de nodos
// ============================================================================

const P = { linea: 1, columna: 1 };
const num = (v: number): NumeroLiteral => ({ tipo: 'numeroLiteral', valor: v, ...P });
const ref = (n: string): ReferenciaParametro => ({ tipo: 'referenciaParametro', nombre: n, ...P });
const av = (v: number): InvocacionComando => ({ tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [num(v)], ...P });
const avRef = (n: string): InvocacionComando => ({ tipo: 'invocacionComando', nombre: 'AVANZA', argumentos: [ref(n)], ...P });
const repite = (cuerpo: readonly Instruccion[]): Repeticion => ({ tipo: 'repeticion', veces: num(4), cuerpo, ...P });
const llamar = (n: string): InvocacionProcedimiento => ({ tipo: 'invocacionProcedimiento', nombre: n, argumentos: [], ...P });
function definir(nombre: string, parametros: readonly string[], cuerpo: readonly Instruccion[]): DefinicionProcedimiento {
  return { tipo: 'definicionProcedimiento', nombre, parametros, cuerpo, ...P };
}
const prog = (instrucciones: readonly Instruccion[]): Programa => ({ tipo: 'programa', instrucciones });

function analizarClave(programa: Programa, clave: ExigenciaAbstraccion['clave'], maximo = 1): boolean {
  const exigencia: ExigenciaAbstraccion =
    clave === 'maximoProcedimientos' ? { clave, maximo } : { clave };
  return analizar(programa, [exigencia]).confirmadas.includes(clave);
}

// ============================================================================
// Las seis claves
// ============================================================================

describe('abstraccion · las seis claves', () => {
  it('usaRepite: confirma solo si hay una repetición', () => {
    expect(analizarClave(prog([repite([av(100)])]), 'usaRepite')).toBe(true);
    expect(analizarClave(prog([av(100)]), 'usaRepite')).toBe(false);
  });

  it('usaRepiteAnidado: confirma solo si una repetición contiene otra', () => {
    expect(analizarClave(prog([repite([repite([av(100)])])]), 'usaRepiteAnidado')).toBe(true);
    expect(analizarClave(prog([repite([av(100)]), repite([av(50)])]), 'usaRepiteAnidado')).toBe(false);
  });

  it('defineProcedimiento: confirma solo si hay una definición', () => {
    expect(analizarClave(prog([definir('CUADRADO', [], [av(100)])]), 'defineProcedimiento')).toBe(true);
    expect(analizarClave(prog([av(100)]), 'defineProcedimiento')).toBe(false);
  });

  it('usaParametros: exige declarar Y usar un parámetro de esa misma definición', () => {
    // Declara :lado y lo usa.
    expect(analizarClave(prog([definir('CUADRADO', ['lado'], [avRef('lado')])]), 'usaParametros')).toBe(true);
    // Declara :lado pero no lo usa.
    expect(analizarClave(prog([definir('CUADRADO', ['lado'], [av(100)])]), 'usaParametros')).toBe(false);
    // No declara parámetros.
    expect(analizarClave(prog([definir('CUADRADO', [], [av(100)])]), 'usaParametros')).toBe(false);
  });

  it('usaRecursion: confirma solo si el cuerpo se invoca a sí mismo', () => {
    expect(analizarClave(prog([definir('ESPIRAL', [], [av(10), llamar('ESPIRAL')])]), 'usaRecursion')).toBe(true);
    expect(analizarClave(prog([definir('CUADRADO', [], [av(100)]), llamar('CUADRADO')]), 'usaRecursion')).toBe(false);
  });

  it('maximoProcedimientos: es una cota superior', () => {
    const dos = prog([definir('A', [], [av(1)]), definir('B', [], [av(2)])]);
    expect(analizarClave(dos, 'maximoProcedimientos', 2)).toBe(true); // 2 ≤ 2
    expect(analizarClave(dos, 'maximoProcedimientos', 1)).toBe(false); // 2 > 1
    expect(analizarClave(prog([av(1)]), 'maximoProcedimientos', 1)).toBe(true); // 0 ≤ 1
  });
});

// ============================================================================
// Conjunto vacío y orden / determinismo
// ============================================================================

describe('abstraccion · conjunto vacío y orden', () => {
  it('el conjunto de exigencias vacío da confirmadas y sinConfirmar vacías', () => {
    const r = analizar(prog([av(100)]), []);
    expect(r.confirmadas).toEqual([]);
    expect(r.sinConfirmar).toEqual([]);
  });

  it('sinConfirmar respeta el orden en que el nivel declara las exigencias', () => {
    const exigencias: ExigenciaAbstraccion[] = [
      { clave: 'usaRepite' },
      { clave: 'defineProcedimiento' },
      { clave: 'usaRecursion' },
    ];
    // Programa que no cumple ninguna.
    const r = analizar(prog([av(100)]), exigencias);
    expect(r.sinConfirmar).toEqual(['usaRepite', 'defineProcedimiento', 'usaRecursion']);
  });

  it('dos AST iguales nodo por nodo dan el mismo resultado', () => {
    const a = prog([definir('CUADRADO', ['lado'], [avRef('lado')])]);
    const b = prog([definir('CUADRADO', ['lado'], [avRef('lado')])]);
    const exigencias: ExigenciaAbstraccion[] = [{ clave: 'defineProcedimiento' }, { clave: 'usaParametros' }];
    expect(analizar(a, exigencias)).toEqual(analizar(b, exigencias));
  });
});

// ============================================================================
// defineProcedimiento · requisito de abstracción del nivel 2.6 (R10.2, R10.3, R10.6)
// ============================================================================
//
// La estrella de abstracción del 2.6 exige que el AST del jugador contenga al
// menos un nodo de definición de procedimiento. Todos estos casos construyen el
// AST a mano: no se parsea ningún texto, porque el verificador analiza el árbol,
// no la cadena de origen (R10.6). Representan el panel 2×2 del 2.6 de dos formas:
// definiéndolo con PARA e invocándolo cuatro veces, o copiándolo inline cuatro
// veces sin definir nada.

const exigenciaDefinir: ExigenciaAbstraccion = { clave: 'defineProcedimiento' };

// El cuerpo de un «panel»: un cuadrado dibujado con repetición.
const panel = (): Repeticion => repite([av(100)]);

describe('abstraccion · defineProcedimiento (nivel 2.6)', () => {
  it('un AST que contiene un nodo de definición cumple el requisito y aparece en confirmadas (R10.2)', () => {
    // PARA PANEL REPITE 4 [AV 100 GD 90] FIN  +  cuatro invocaciones.
    const conProcedimiento = prog([
      definir('PANEL', [], [panel()]),
      llamar('PANEL'),
      llamar('PANEL'),
      llamar('PANEL'),
      llamar('PANEL'),
    ]);

    const r = analizar(conProcedimiento, [exigenciaDefinir]);
    expect(r.confirmadas).toEqual(['defineProcedimiento']);
    expect(r.sinConfirmar).toEqual([]);
  });

  it('un AST que repite el panel inline sin definir procedimiento NO lo cumple y aparece en sinConfirmar (R10.3)', () => {
    // El mismo dibujo del panel copiado cuatro veces, sin ningún PARA.
    const inlineSinDefinir = prog([panel(), panel(), panel(), panel()]);

    const r = analizar(inlineSinDefinir, [exigenciaDefinir]);
    expect(r.confirmadas).toEqual([]);
    expect(r.sinConfirmar).toEqual(['defineProcedimiento']);
  });

  it('reconoce la definición aunque esté anidada dentro de una repetición (R10.2, R10.6)', () => {
    // Un nodo definicionProcedimiento colgando dentro de un REPITE: el análisis
    // recorre el árbol completo, no solo el nivel superior.
    const definicionAnidada = prog([repite([definir('PANEL', [], [panel()])])]);

    const r = analizar(definicionAnidada, [exigenciaDefinir]);
    expect(r.confirmadas).toEqual(['defineProcedimiento']);
    expect(r.sinConfirmar).toEqual([]);
  });

  it('solo invocar un procedimiento, sin un nodo de definición en el árbol, no basta (R10.3, R10.6)', () => {
    // Invocar PANEL sin que el árbol incluya su definicionProcedimiento: el
    // verificador mira el AST presente, no nombres que parezcan procedimientos.
    const soloInvocacion = prog([llamar('PANEL'), llamar('PANEL')]);

    const r = analizar(soloInvocacion, [exigenciaDefinir]);
    expect(r.confirmadas).toEqual([]);
    expect(r.sinConfirmar).toEqual(['defineProcedimiento']);
  });

  it('el veredicto depende del nodo del AST, no de ningún texto de programa (R10.6)', () => {
    // Dos árboles equivalentes salvo por la presencia del nodo de definición dan
    // veredictos opuestos. En ningún momento interviene una cadena de origen.
    const conDefinicion = prog([definir('PANEL', [], [panel()]), llamar('PANEL')]);
    const sinDefinicion = prog([panel()]);

    expect(analizar(conDefinicion, [exigenciaDefinir]).confirmadas).toContain('defineProcedimiento');
    expect(analizar(sinDefinicion, [exigenciaDefinir]).confirmadas).not.toContain('defineProcedimiento');
  });
});

// ============================================================================
// Property 12 · usaRepiteAnidado se otorga si y solo si hay REPITE anidado,
// analizando el AST, no el texto (mundo 3, R6.2, R6.3, R6.4)
// ============================================================================
//
// La estrella de abstracción del mundo 3 exige un REPITE entre los descendientes
// de otro REPITE. Estos casos lo verifican sobre el AST: una lista plana de
// repeticiones NO cumple, y dos textos distintos que producen el MISMO AST
// obtienen el mismo veredicto, porque el verificador analiza el árbol y nunca la
// cadena de origen (R6.4).

describe('Property 12: usaRepiteAnidado analiza el AST, no el texto (mundo 3)', () => {
  // Validates: Requirements 6.2, 6.3, 6.4
  const exigencia: ExigenciaAbstraccion = { clave: 'usaRepiteAnidado' };

  /** Parsea texto KiroLogo del mundo 3 a su AST. Lanza si el texto es inválido. */
  function astDe(texto: string): Programa {
    const { tokens } = analizarLexico(texto);
    const { programa, errores } = analizar_(tokens, { mundo: 3 });
    if (programa === null || errores.length > 0) {
      throw new Error(`texto inválido: "${texto}" — ${errores.map((e) => e.mensaje).join('; ')}`);
    }
    return programa;
  }

  it('un REPITE dentro de otro REPITE cumple usaRepiteAnidado (R6.2)', () => {
    // Construido a mano: una repetición con otra en su cuerpo.
    const anidado = prog([repite([av(100), repite([av(50)])])]);
    expect(analizar(anidado, [exigencia]).confirmadas).toContain('usaRepiteAnidado');
  });

  it('una lista plana de REPITE consecutivos NO cumple usaRepiteAnidado (R6.3)', () => {
    // Dos repeticiones hermanas, ninguna contiene a la otra.
    const plano = prog([repite([av(100)]), repite([av(50)]), repite([av(25)])]);
    expect(analizar(plano, [exigencia]).confirmadas).not.toContain('usaRepiteAnidado');
    expect(analizar(plano, [exigencia]).sinConfirmar).toContain('usaRepiteAnidado');
  });

  it('dos textos distintos con el mismo AST obtienen el mismo veredicto (R6.4)', () => {
    // Nombres largos y abreviaturas producen el mismo AST: el veredicto no puede
    // depender del texto. Ambos tienen REPITE anidado → ambos cumplen.
    const largo = astDe('REPITE 36 [REPITE 4 [AVANZA 100 GIRADERECHA 90] GIRADERECHA 10]');
    const abreviado = astDe('RP 36 [RP 4 [AV 100 GD 90] GD 10]');
    const vLargo = analizar(largo, [exigencia]);
    const vAbreviado = analizar(abreviado, [exigencia]);
    expect(vLargo).toEqual(vAbreviado);
    expect(vLargo.confirmadas).toContain('usaRepiteAnidado');
  });

  it('dos textos con el mismo AST plano obtienen el mismo veredicto negativo (R6.4)', () => {
    const largo = astDe('REPITE 4 [AVANZA 100] REPITE 3 [AVANZA 50]');
    const abreviado = astDe('RP 4 [AV 100] RP 3 [AV 50]');
    const vLargo = analizar(largo, [exigencia]);
    const vAbreviado = analizar(abreviado, [exigencia]);
    expect(vLargo).toEqual(vAbreviado);
    expect(vLargo.confirmadas).not.toContain('usaRepiteAnidado');
  });
});
