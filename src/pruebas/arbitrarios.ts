// Generadores de datos para las pruebas de propiedad del mundo 4 (spec 05) y un
// modelo de evaluación independiente del evaluador.
//
// Las propiedades 1 a 12 comparten estos generadores para que todas hablen de los
// mismos programas y expresiones. Todo el azar lo pone fast-check con su propia
// semilla; aquí no hay Math.random.
//
// Los nombres de comando salen de `vocabulario.ts`: si mañana cambia un nombre, los
// generadores lo siguen sin tocar este archivo.

import fc from 'fast-check';
import type {
  ArgumentoColor,
  ComandoOperador,
  DefinicionProcedimiento,
  Expresion,
  ExpresionAritmetica,
  Instruccion,
  InvocacionComando,
  InvocacionProcedimiento,
  MenosUnario,
  NumeroLiteral,
  PalabraLiteral,
  Programa,
  ReferenciaParametro,
  Repeticion,
} from '../lenguaje/ast.js';
import type { IdError } from '../lenguaje/errores.js';
import { NOMBRES_COLOR } from '../lenguaje/colores.js';
import { VOCABULARIO, buscarComando, normalizarPalabra, type EntradaVocabulario } from '../lenguaje/vocabulario.js';

/** Mundos para los que hay programas generables (el 5 agrega condicionales, aún no imprimibles). */
export type MundoGenerable = 0 | 1 | 2 | 3 | 4;

// La posición no forma parte de la equivalencia entre AST (Property 1): se fija en 1:1.
const POSICION = { linea: 1, columna: 1 } as const;

// ============================================================================
// Números
// ============================================================================

/**
 * Números de 0 a 999 con hasta 2 decimales. `c / 100` es una división correctamente
 * redondeada, así que da el mismo doble que leer el texto `String(c / 100)`: la ida y
 * vuelta por el impresor no pierde nada.
 */
export const arbNumero: fc.Arbitrary<number> = fc.oneof(
  fc.integer({ min: 0, max: 999 }),
  fc.integer({ min: 0, max: 99_900 }).map((c) => c / 100),
);

/** Divisor que nunca es cero: un literal de 1 a 999 con hasta 2 decimales. */
const arbDivisorSeguro: fc.Arbitrary<number> = fc.oneof(
  fc.integer({ min: 1, max: 999 }),
  fc.integer({ min: 100, max: 99_900 }).map((c) => c / 100),
);

function numeroLiteral(valor: number): NumeroLiteral {
  return { tipo: 'numeroLiteral', valor, ...POSICION };
}

export const arbNumeroLiteral: fc.Arbitrary<NumeroLiteral> = arbNumero.map(numeroLiteral);

// ============================================================================
// Expresiones
// ============================================================================

// Comandos que producen valor, tomados del vocabulario. Se separan por aridad: los
// binarios (SUMA…RESTO) y el unario con efecto (AZAR).
const OPERADORES_BINARIOS: readonly string[] = VOCABULARIO
  .filter((e) => e.produceValor && e.aridad === 2)
  .map((e) => e.nombre);
const OPERADORES_UNARIOS: readonly string[] = VOCABULARIO
  .filter((e) => e.produceValor && e.aridad === 1)
  .map((e) => e.nombre);

// Comandos binarios cuyo segundo argumento es un divisor. Es la única semántica que
// el generador necesita conocer: dónde poner un divisor seguro.
const COMANDOS_DIVISORES = new Set(['COCIENTE', 'RESTO']);

export interface OpcionesExpresion {
  /** Parámetros visibles (minúsculas, sin `:`). Sin ellos solo hay literales como hojas. */
  readonly parametros?: readonly string[];
  /** Si es true, el divisor de `/`, `COCIENTE` y `RESTO` es siempre un literal ≥ 1. */
  readonly divisoresSeguros?: boolean;
  /** Si es true, también aparece `AZAR` con un argumento cualquiera. */
  readonly incluirAzar?: boolean;
}

/**
 * Expresiones numéricas de hasta `altura` niveles: números, parámetros, `+ - * /`,
 * menos unario y comandos de operador. Sin divisores seguros, el divisor puede valer
 * cero: quien la use filtra con `modeloEvaluar` y `fc.pre`.
 */
export function arbExpresion(altura: number, opciones: OpcionesExpresion = {}): fc.Arbitrary<Expresion> {
  const parametros = opciones.parametros ?? [];
  const hoja: fc.Arbitrary<Expresion> = parametros.length === 0
    ? arbNumeroLiteral
    : fc.oneof(
        arbNumeroLiteral,
        fc.constantFrom(...parametros).map((nombre): ReferenciaParametro => ({
          tipo: 'referenciaParametro', nombre, ...POSICION,
        })),
      );
  if (altura <= 0) return hoja;

  const sub = arbExpresion(altura - 1, opciones);
  const divisor: fc.Arbitrary<Expresion> = opciones.divisoresSeguros === true
    ? arbDivisorSeguro.map(numeroLiteral)
    : sub;

  const infija = fc.constantFrom<'+' | '-' | '*' | '/'>('+', '-', '*', '/').chain((operador) =>
    fc.tuple(sub, operador === '/' ? divisor : sub).map(([izquierda, derecha]): ExpresionAritmetica => ({
      tipo: 'expresionAritmetica', operador, izquierda, derecha, ...POSICION,
    })),
  );
  const menos = sub.map((operando): MenosUnario => ({ tipo: 'menosUnario', operando, ...POSICION }));
  const comando = fc.constantFrom(...OPERADORES_BINARIOS).chain((nombre) =>
    fc.tuple(sub, COMANDOS_DIVISORES.has(nombre) ? divisor : sub).map(([a, b]): ComandoOperador => ({
      tipo: 'comandoOperador', nombre, argumentos: [a, b], ...POSICION,
    })),
  );

  const ramas: fc.Arbitrary<Expresion>[] = [hoja, hoja, infija, infija, menos, comando];
  if (opciones.incluirAzar === true && OPERADORES_UNARIOS.length > 0) {
    ramas.push(
      fc.tuple(fc.constantFrom(...OPERADORES_UNARIOS), sub).map(([nombre, argumento]): ComandoOperador => ({
        tipo: 'comandoOperador', nombre, argumentos: [argumento], ...POSICION,
      })),
    );
  }
  return fc.oneof(...ramas);
}

// ============================================================================
// Programas
// ============================================================================

interface Firma {
  readonly nombre: string;
  readonly parametros: readonly string[];
}

interface Contexto {
  readonly mundo: MundoGenerable;
  readonly parametros: readonly string[];
  /** Procedimientos que se pueden llamar desde aquí. Solo los anteriores: sin recursión. */
  readonly invocables: readonly Firma[];
  readonly profundidadRepite: number;
}

const MAXIMA_PROFUNDIDAD_REPITE = 2;
const MAXIMOS_PROCEDIMIENTOS = 3;
const MAXIMOS_PARAMETROS = 3;

const disponibles = (mundo: MundoGenerable): readonly EntradaVocabulario[] =>
  VOCABULARIO.filter((e) => e.mundo <= mundo && !e.produceValor);

const esNumerico = (e: EntradaVocabulario): boolean =>
  e.aridad === 1 && e.tiposArgumento.length === 1 && e.tiposArgumento[0] === 'numero';
const esDeColor = (e: EntradaVocabulario): boolean => e.tiposArgumento[0] === 'color';
const esEscribible = (e: EntradaVocabulario): boolean => e.tiposArgumento[0] === 'valorEscribible';
// Sin argumentos y ejecutable por sí solo: FIN cierra un PARA, no es una instrucción.
const esSinArgumentos = (e: EntradaVocabulario): boolean => e.aridad === 0 && e.nombre !== 'FIN';

// El intérprete exige un grosor entero de 1 a 50; con otro valor el programa no se ejecuta.
const GROSOR = 'PONGROSOR';

const letras = (abecedario: string, minimo: number, maximo: number): fc.Arbitrary<string> =>
  fc.array(fc.constantFrom(...abecedario), { minLength: minimo, maxLength: maximo }).map((l) => l.join(''));

const MAYUSCULAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MINUSCULAS = 'abcdefghijklmnopqrstuvwxyz';

/** Nombre de procedimiento ya normalizado (como lo deja el lexer) que no pisa ningún comando. */
const arbNombreProcedimiento: fc.Arbitrary<string> = letras(MAYUSCULAS, 3, 8)
  .filter((nombre) => !buscarComando(nombre).hallada);

/** Nombres de parámetros únicos, en minúsculas y sin `:`, como los guarda el parser. */
const arbParametros: fc.Arbitrary<readonly string[]> = fc.uniqueArray(letras(MINUSCULAS, 1, 6), {
  maxLength: MAXIMOS_PARAMETROS,
});

// El lexer normaliza la palabra de un color, así que el AST la lleva en mayúsculas y sin acento.
const arbColor: fc.Arbitrary<ArgumentoColor> = fc.oneof(
  fc.constantFrom(...NOMBRES_COLOR).map((nombre): ArgumentoColor => ({
    clase: 'palabra', valor: normalizarPalabra(nombre),
  })),
  fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 3, maxLength: 3 }).map((valores): ArgumentoColor => ({
    clase: 'listaRGB', valores,
  })),
);

// `PalabraLiteral` conserva las mayúsculas originales: se generan mezcladas.
const arbPalabraLiteral: fc.Arbitrary<PalabraLiteral> = letras(MAYUSCULAS + MINUSCULAS, 1, 8).map(
  (valor): PalabraLiteral => ({ tipo: 'palabraLiteral', valor, ...POSICION }),
);

function arbArgumento(contexto: Contexto): fc.Arbitrary<Expresion> {
  if (contexto.mundo < 4) return arbNumeroLiteral;
  return arbExpresion(2, { parametros: contexto.parametros, divisoresSeguros: true, incluirAzar: true });
}

function invocacion(nombre: string, argumentos: readonly Expresion[], argumentoColor?: ArgumentoColor): InvocacionComando {
  return argumentoColor === undefined
    ? { tipo: 'invocacionComando', nombre, argumentos, ...POSICION }
    : { tipo: 'invocacionComando', nombre, argumentos, argumentoColor, ...POSICION };
}

function arbInstruccion(contexto: Contexto): fc.Arbitrary<Instruccion> {
  const entradas = disponibles(contexto.mundo);
  const ramas: fc.Arbitrary<Instruccion>[] = [];

  const numericos = entradas.filter((e) => esNumerico(e) && e.nombre !== GROSOR).map((e) => e.nombre);
  ramas.push(
    fc.tuple(fc.constantFrom(...numericos), arbArgumento(contexto)).map(([nombre, a]) => invocacion(nombre, [a])),
  );

  const sinArgumentos = entradas.filter(esSinArgumentos).map((e) => e.nombre);
  if (sinArgumentos.length > 0) {
    ramas.push(fc.constantFrom(...sinArgumentos).map((nombre) => invocacion(nombre, [])));
  }

  if (entradas.some((e) => e.nombre === GROSOR)) {
    ramas.push(fc.integer({ min: 1, max: 50 }).map((g) => invocacion(GROSOR, [numeroLiteral(g)])));
  }

  const deColor = entradas.filter(esDeColor).map((e) => e.nombre);
  if (deColor.length > 0) {
    ramas.push(fc.tuple(fc.constantFrom(...deColor), arbColor).map(([nombre, color]) => invocacion(nombre, [], color)));
  }

  const escribibles = entradas.filter(esEscribible).map((e) => e.nombre);
  if (escribibles.length > 0) {
    const valor: fc.Arbitrary<Expresion> = fc.oneof(arbPalabraLiteral, arbArgumento(contexto));
    ramas.push(fc.tuple(fc.constantFrom(...escribibles), valor).map(([nombre, v]) => invocacion(nombre, [v])));
  }

  if (contexto.mundo >= 1 && contexto.profundidadRepite < MAXIMA_PROFUNDIDAD_REPITE) {
    // La cantidad es un literal pequeño para que el programa se pueda ejecutar entero.
    const interior = { ...contexto, profundidadRepite: contexto.profundidadRepite + 1 };
    ramas.push(
      fc.tuple(fc.integer({ min: 1, max: 3 }), arbLista(interior, 0, 3)).map(([veces, cuerpo]): Repeticion => ({
        tipo: 'repeticion', veces: numeroLiteral(veces), cuerpo, ...POSICION,
      })),
    );
  }

  if (contexto.invocables.length > 0) {
    ramas.push(
      fc.constantFrom(...contexto.invocables).chain((firma) =>
        fc.tuple(...firma.parametros.map(() => arbArgumento(contexto))).map(
          (argumentos): InvocacionProcedimiento => ({
            tipo: 'invocacionProcedimiento', nombre: firma.nombre, argumentos, ...POSICION,
          }),
        ),
      ),
    );
  }

  return fc.oneof(...ramas);
}

function arbLista(contexto: Contexto, minimo: number, maximo: number): fc.Arbitrary<readonly Instruccion[]> {
  return fc.array(arbInstruccion(contexto), { minLength: minimo, maxLength: maximo });
}

/** Inserta las definiciones en el programa principal, cada una en la posición elegida. */
function intercalar(
  principal: readonly Instruccion[],
  definiciones: readonly DefinicionProcedimiento[],
  posiciones: readonly number[],
): Instruccion[] {
  const salida = [...principal];
  definiciones.forEach((definicion, i) => {
    salida.splice(posiciones[i]! % (salida.length + 1), 0, definicion);
  });
  return salida;
}

/**
 * Programas válidos de un mundo: comandos del vocabulario disponible, `REPITE` desde el
 * mundo 1 (hasta 2 de profundidad), `PARA` desde el 2 (con 0 a 3 parámetros únicos solo
 * en el 4) y llamadas con su aridad, antes o después de la definición. Un procedimiento
 * solo llama a los generados antes que él, así que nunca hay recursión. Desde el mundo 4
 * los argumentos son expresiones con divisores seguros, e incluyen `ESCRIBE` y `ROTULA`.
 */
export function arbPrograma(mundo: MundoGenerable): fc.Arbitrary<Programa> {
  const raiz = (invocables: readonly Firma[]): Contexto => ({ mundo, parametros: [], invocables, profundidadRepite: 0 });
  const programa = (instrucciones: readonly Instruccion[]): Programa => ({ tipo: 'programa', instrucciones });

  if (mundo < 2) return arbLista(raiz([]), 0, 6).map(programa);

  const arbFirmas: fc.Arbitrary<readonly Firma[]> = fc
    .uniqueArray(arbNombreProcedimiento, { maxLength: MAXIMOS_PROCEDIMIENTOS })
    .chain((nombres) =>
      fc.tuple(...nombres.map(() => (mundo >= 4 ? arbParametros : fc.constant<readonly string[]>([])))).map(
        (listas) => nombres.map((nombre, i): Firma => ({ nombre, parametros: listas[i]! })),
      ),
    );

  return arbFirmas.chain((firmas) => {
    const definiciones = firmas.map((firma, i) =>
      arbLista(
        { mundo, parametros: firma.parametros, invocables: firmas.slice(0, i), profundidadRepite: 0 },
        1,
        4,
      ).map((cuerpo): DefinicionProcedimiento => ({
        tipo: 'definicionProcedimiento', nombre: firma.nombre, parametros: firma.parametros, cuerpo, ...POSICION,
      })),
    );
    return fc
      .tuple(
        fc.tuple(...definiciones),
        arbLista(raiz(firmas), 0, 6),
        fc.array(fc.nat(), { minLength: firmas.length, maxLength: firmas.length }),
      )
      .map(([defs, principal, posiciones]) => programa(intercalar(principal, defs, posiciones)));
  });
}

// ============================================================================
// Texto con mayúsculas y acentos arbitrarios
// ============================================================================

const ACENTUADAS: Readonly<Record<string, readonly [string, string]>> = {
  a: ['á', 'Á'], e: ['é', 'É'], i: ['í', 'Í'], o: ['ó', 'Ó'], u: ['ú', 'Ú'],
};

/**
 * El mismo texto con cada letra en mayúscula, minúscula o con acento, al azar. Las
 * palabras con comilla (`"hola`) se dejan como están porque `PalabraLiteral` conserva
 * lo escrito; todo lo demás el lexer lo normaliza, así que el AST no debe cambiar.
 */
export function arbEscrituraVariada(texto: string): fc.Arbitrary<string> {
  const caracteres = [...texto];
  return fc.array(fc.nat(3), { minLength: caracteres.length, maxLength: caracteres.length }).map((elecciones) => {
    let salida = '';
    let enPalabraConComilla = false;
    caracteres.forEach((c, i) => {
      if (c === '"') enPalabraConComilla = true;
      else if (!/[A-Za-z0-9]/.test(c)) enPalabraConComilla = false;
      const minuscula = c.toLowerCase();
      if (enPalabraConComilla || !/[a-z]/.test(minuscula)) {
        salida += c;
        return;
      }
      const acentos = ACENTUADAS[minuscula];
      const opciones = acentos === undefined
        ? [minuscula, minuscula.toUpperCase()]
        : [minuscula, minuscula.toUpperCase(), acentos[0], acentos[1]];
      salida += opciones[elecciones[i]! % opciones.length]!;
    });
    return salida;
  });
}

// ============================================================================
// Comparación de AST sin posiciones
// ============================================================================

/** Copia profunda sin `linea` ni `columna`: dos AST equivalentes quedan iguales con `toEqual`. */
export function sinPosiciones<T>(nodo: T): T {
  if (Array.isArray(nodo)) return nodo.map((n) => sinPosiciones(n)) as T;
  if (nodo === null || typeof nodo !== 'object') return nodo;
  const salida: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(nodo)) {
    if (clave === 'linea' || clave === 'columna') continue;
    salida[clave] = sinPosiciones(valor);
  }
  return salida as T;
}

// ============================================================================
// Modelo independiente: notación polaca inversa con una pila
// ============================================================================
//
// Sirve de oráculo para la Property 2. No importa nada de `evaluador.ts`: compila la
// expresión a una secuencia posfija y la recorre con una pila. El orden posfijo es el
// mismo «de izquierda a derecha» del evaluador, así que el primer error que encuentra
// es el mismo que reportaría él.

type OperadorModelo = '+' | '-' | '*' | '/' | '%';

type TokenPosfijo =
  | { readonly clase: 'numero'; readonly valor: number }
  | { readonly clase: 'parametro'; readonly nombre: string }
  | { readonly clase: 'negar' }
  | { readonly clase: 'binario'; readonly operador: OperadorModelo }
  | { readonly clase: 'azar' }
  // Un nodo que no da número. Se emite sin sus hijos porque el evaluador lo rechaza
  // antes de evaluar los operandos.
  | { readonly clase: 'invalido' };

// Semántica de cada comando binario expresada con el operador del modelo.
const BINARIO_DE_COMANDO: Readonly<Record<string, OperadorModelo>> = {
  SUMA: '+', RESTA: '-', PRODUCTO: '*', COCIENTE: '/', RESTO: '%',
};

function aPosfija(expresion: Expresion, salida: TokenPosfijo[]): void {
  switch (expresion.tipo) {
    case 'numeroLiteral':
      salida.push({ clase: 'numero', valor: expresion.valor });
      return;
    case 'referenciaParametro':
      salida.push({ clase: 'parametro', nombre: expresion.nombre });
      return;
    case 'palabraLiteral':
      salida.push({ clase: 'invalido' });
      return;
    case 'menosUnario':
      aPosfija(expresion.operando, salida);
      salida.push({ clase: 'negar' });
      return;
    case 'expresionAritmetica': {
      const op = expresion.operador;
      if (op !== '+' && op !== '-' && op !== '*' && op !== '/') {
        salida.push({ clase: 'invalido' });
        return;
      }
      aPosfija(expresion.izquierda, salida);
      aPosfija(expresion.derecha, salida);
      salida.push({ clase: 'binario', operador: op });
      return;
    }
    case 'comandoOperador': {
      const binario = BINARIO_DE_COMANDO[expresion.nombre];
      if (binario !== undefined && expresion.argumentos.length === 2) {
        aPosfija(expresion.argumentos[0]!, salida);
        aPosfija(expresion.argumentos[1]!, salida);
        salida.push({ clase: 'binario', operador: binario });
        return;
      }
      if (OPERADORES_UNARIOS.includes(expresion.nombre) && expresion.argumentos.length === 1) {
        aPosfija(expresion.argumentos[0]!, salida);
        salida.push({ clase: 'azar' });
        return;
      }
      salida.push({ clase: 'invalido' });
      return;
    }
  }
}

function aplicar(operador: OperadorModelo, a: number, b: number): number {
  switch (operador) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return a / b;
    case '%': return a % b;
  }
}

export type ResultadoModelo =
  | { readonly exito: true; readonly valor: number }
  | { readonly exito: false; readonly id: IdError };

/**
 * Valor de una expresión según el modelo de pila, o el id del primer error: el mismo
 * que el evaluador debe reportar. `azar(n)` recibe la cota ya validada (entero ≥ 1).
 */
export function modeloEvaluar(
  expresion: Expresion,
  valores: ReadonlyMap<string, number> = new Map(),
  azar: (n: number) => number = () => 0,
): ResultadoModelo {
  const posfija: TokenPosfijo[] = [];
  aPosfija(expresion, posfija);
  const pila: number[] = [];
  const falla = (id: IdError): ResultadoModelo => ({ exito: false, id });

  for (const token of posfija) {
    switch (token.clase) {
      case 'numero':
        pila.push(token.valor);
        break;
      case 'parametro': {
        const valor = valores.get(token.nombre.toLowerCase());
        if (valor === undefined) return falla('variableNoDefinida');
        pila.push(valor);
        break;
      }
      case 'invalido':
        return falla('nodoNoImplementado');
      case 'negar':
        pila.push(-pila.pop()!);
        break;
      case 'azar': {
        const n = pila.pop()!;
        if (!Number.isInteger(n) || n < 1) return falla('azarRangoInvalido');
        pila.push(azar(n));
        break;
      }
      case 'binario': {
        const b = pila.pop()!;
        const a = pila.pop()!;
        // `b === 0` es verdadero también para -0.
        if ((token.operador === '/' || token.operador === '%') && b === 0) return falla('divisionPorCero');
        const r = aplicar(token.operador, a, b);
        if (!Number.isFinite(r)) return falla('numeroFueraDeRango');
        pila.push(r);
        break;
      }
    }
  }
  return { exito: true, valor: pila[0]! };
}
