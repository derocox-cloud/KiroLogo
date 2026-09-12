// Lexer de KiroLogo: texto → tokens
// Autómata de un solo recorrido, sin retroceso, que normaliza acentos y mayúsculas.
// Acumula errores del catálogo sin detenerse en el primero.

import { buscarComando, normalizarPalabra } from './vocabulario.js';
import { crearError, type ErrorKiroLogo } from './errores.js';

// ============================================================================
// Tipos del token
// ============================================================================

export type TipoToken =
  | 'comando' | 'identificador' | 'numero' | 'palabra'
  | 'parametro' | 'corchete_abre' | 'corchete_cierra';

interface TokenBase {
  readonly textoOriginal: string;   // tal como se escribió
  readonly linea: number;           // desde 1
  readonly columna: number;         // desde 1, en caracteres
}

export type Token =
  | (TokenBase & { readonly tipo: 'numero'; readonly valor: number })
  | (TokenBase & { readonly tipo: Exclude<TipoToken, 'numero'>; readonly valor: string });

export interface ResultadoLexico {
  readonly tokens: readonly Token[];
  readonly errores: readonly ErrorKiroLogo[];   // ordenados por línea y luego por columna
}

// ============================================================================
// Clasificación de caracteres
// ============================================================================

/**
 * Determina si un carácter es una letra del alfabeto español, incluidas las
 * vocales acentuadas, `ü`, `ñ` y `Ñ`, en mayúscula o minúscula.
 */
function esLetra(c: string): boolean {
  if (c >= 'a' && c <= 'z') return true;
  if (c >= 'A' && c <= 'Z') return true;
  switch (c) {
    case 'á': case 'é': case 'í': case 'ó': case 'ú': case 'ü': case 'ñ':
    case 'Á': case 'É': case 'Í': case 'Ó': case 'Ú': case 'Ü': case 'Ñ':
      return true;
    default:
      return false;
  }
}

/** Determina si un carácter es un dígito decimal de `0` a `9`. */
function esDigito(c: string): boolean {
  return c >= '0' && c <= '9';
}

/** Determina si un carácter es un separador decimal aceptado: coma o punto. */
function esSeparadorDecimal(c: string): boolean {
  return c === ',' || c === '.';
}

/** Determina si un carácter es espacio en blanco que separa tokens sin emitirlos. */
function esEspacio(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\r' || c === '\n';
}

// ============================================================================
// Estado del recorrido
// ============================================================================

interface Cursor {
  readonly texto: string;
  indice: number;    // posición absoluta en el texto, desde 0
  linea: number;     // desde 1
  columna: number;   // desde 1, en caracteres
}

/**
 * Analiza un texto de KiroLogo produciendo la lista de tokens reconocidos y
 * la lista de errores acumulados, sin detenerse en el primer error.
 *
 * @param texto Texto escrito por el jugador
 * @returns Tokens reconocidos y errores, estos últimos ordenados por línea y columna
 */
export function analizarLexico(texto: string): ResultadoLexico {
  const tokens: Token[] = [];
  const errores: ErrorKiroLogo[] = [];

  const cursor: Cursor = { texto, indice: 0, linea: 1, columna: 1 };

  while (cursor.indice < texto.length) {
    const c = texto[cursor.indice]!;

    // Espacio en blanco: separa, no emite token.
    if (esEspacio(c)) {
      avanzar(cursor);
      continue;
    }

    // Comentario: descarta desde `#` hasta el fin de línea (o del texto).
    if (c === '#') {
      consumirComentario(cursor);
      continue;
    }

    // Corchetes.
    if (c === '[') {
      tokens.push({ tipo: 'corchete_abre', valor: '[', textoOriginal: '[', linea: cursor.linea, columna: cursor.columna });
      avanzar(cursor);
      continue;
    }
    if (c === ']') {
      tokens.push({ tipo: 'corchete_cierra', valor: ']', textoOriginal: ']', linea: cursor.linea, columna: cursor.columna });
      avanzar(cursor);
      continue;
    }

    // Palabra con comilla inicial: `"naranja`.
    if (c === '"') {
      const resultado = leerConPrefijo(cursor, 'palabra');
      if (resultado.ok) {
        tokens.push(resultado.token);
      } else {
        errores.push(resultado.error);
      }
      continue;
    }

    // Parámetro: `:largo`.
    if (c === ':') {
      const resultado = leerConPrefijo(cursor, 'parametro');
      if (resultado.ok) {
        tokens.push(resultado.token);
      } else {
        errores.push(resultado.error);
      }
      continue;
    }

    // Número.
    if (esDigito(c)) {
      const resultado = leerNumero(cursor);
      if (resultado.ok) {
        tokens.push(resultado.token);
      } else {
        errores.push(resultado.error);
      }
      continue;
    }

    // Palabra: comando o identificador.
    if (esLetra(c)) {
      tokens.push(leerPalabra(cursor));
      continue;
    }

    // Cualquier otro carácter: error, se descarta y se continúa.
    errores.push(
      crearError('caracterNoValido', {}, { linea: cursor.linea, columna: cursor.columna }),
    );
    avanzar(cursor);
  }

  // Los tokens ya salen en orden de lectura; los errores también, porque el
  // recorrido es de izquierda a derecha y de arriba abajo. El orden explícito
  // por línea y columna deja la garantía a prueba de futuras reordenaciones.
  errores.sort((a, b) => {
    const la = a.linea ?? 0;
    const lb = b.linea ?? 0;
    if (la !== lb) return la - lb;
    return (a.columna ?? 0) - (b.columna ?? 0);
  });

  return { tokens, errores };
}

// ============================================================================
// Avance del cursor
// ============================================================================

/** Avanza el cursor un carácter, actualizando línea y columna. */
function avanzar(cursor: Cursor): void {
  const c = cursor.texto[cursor.indice]!;
  cursor.indice += 1;
  if (c === '\n') {
    cursor.linea += 1;
    cursor.columna = 1;
  } else {
    cursor.columna += 1;
  }
}

// ============================================================================
// Comentarios
// ============================================================================

/** Consume desde `#` hasta el fin de línea (`\n` o `\r\n`) o el fin del texto. */
function consumirComentario(cursor: Cursor): void {
  const { texto } = cursor;
  while (cursor.indice < texto.length && texto[cursor.indice] !== '\n') {
    avanzar(cursor);
  }
  // El `\n` que cierra el comentario, si lo hay, lo consumirá el bucle principal
  // como espacio en blanco, conservando así la numeración de línea posterior.
}

// ============================================================================
// Palabras: comando o identificador
// ============================================================================

/**
 * Lee una palabra completa (secuencia de letras y dígitos que empieza en letra)
 * y decide con `buscarComando` si es un comando o un identificador.
 */
function leerPalabra(cursor: Cursor): Token {
  const { texto } = cursor;
  const linea = cursor.linea;
  const columna = cursor.columna;

  let original = '';
  while (cursor.indice < texto.length) {
    const c = texto[cursor.indice]!;
    if (esLetra(c) || esDigito(c)) {
      original += c;
      avanzar(cursor);
    } else {
      break;
    }
  }

  const valor = normalizarPalabra(original);
  const tipo: TipoToken = buscarComando(original).hallada ? 'comando' : 'identificador';

  return { tipo, valor, textoOriginal: original, linea, columna };
}

// ============================================================================
// Palabras con prefijo: `"naranja` y `:largo`
// ============================================================================

type ResultadoToken =
  | { readonly ok: true; readonly token: Token }
  | { readonly ok: false; readonly error: ErrorKiroLogo };

/**
 * Lee una forma con prefijo: comilla (`"naranja`) o dos puntos (`:largo`).
 * El cuerpo tras el prefijo son letras y dígitos que empiezan por letra o dígito.
 * Reporta el error correspondiente cuando no hay al menos un carácter válido tras
 * el prefijo, descartando solo el prefijo y continuando.
 */
function leerConPrefijo(cursor: Cursor, tipo: 'palabra' | 'parametro'): ResultadoToken {
  const { texto } = cursor;
  const linea = cursor.linea;
  const columna = cursor.columna;
  const prefijo = texto[cursor.indice]!;   // `"` o `:`

  const siguiente = cursor.indice + 1 < texto.length ? texto[cursor.indice + 1]! : '';
  const hayCuerpo = siguiente !== '' && (esLetra(siguiente) || esDigito(siguiente));

  if (!hayCuerpo) {
    // Prefijo suelto: descartar solo el prefijo y continuar.
    avanzar(cursor);
    const id = tipo === 'palabra' ? 'comillaSinPalabra' : 'parametroSinNombre';
    return { ok: false, error: crearError(id, {}, { linea, columna }) };
  }

  // Consumir el prefijo y el cuerpo.
  avanzar(cursor);
  let cuerpo = '';
  while (cursor.indice < texto.length) {
    const c = texto[cursor.indice]!;
    if (esLetra(c) || esDigito(c)) {
      cuerpo += c;
      avanzar(cursor);
    } else {
      break;
    }
  }

  const valor = normalizarPalabra(cuerpo);
  return {
    ok: true,
    token: { tipo, valor, textoOriginal: prefijo + cuerpo, linea, columna },
  };
}

// ============================================================================
// Números
// ============================================================================

/**
 * Lee un número sin signo, con coma o punto como separador decimal, de 0 a
 * 999 999, un solo separador, al menos un dígito a cada lado y hasta 4 decimales.
 * Conserva el separador escrito en el texto original.
 */
function leerNumero(cursor: Cursor): ResultadoToken {
  const { texto } = cursor;
  const linea = cursor.linea;
  const columna = cursor.columna;

  let original = '';

  // Consumir el fragmento completo del número, incluidos separadores y dígitos,
  // de modo que un número mal formado se descarte entero y no por trozos.
  // Consumimos dígitos y separadores decimales mientras haya.
  while (cursor.indice < texto.length) {
    const c = texto[cursor.indice]!;
    if (esDigito(c) || esSeparadorDecimal(c)) {
      original += c;
      avanzar(cursor);
    } else {
      break;
    }
  }

  // Validar la forma: parte entera, un único separador, parte decimal opcional.
  if (!numeroBienFormado(original)) {
    return { ok: false, error: crearError('numeroMalFormado', {}, { linea, columna }) };
  }

  // Convertir a número usando el punto como separador canónico.
  const canonico = original.replace(',', '.');
  const valor = Number(canonico);

  return {
    ok: true,
    token: { tipo: 'numero', valor, textoOriginal: original, linea, columna },
  };
}

/**
 * Comprueba que un fragmento numérico es válido: sin signo, al menos un dígito a
 * cada lado del único separador, hasta 4 decimales, y valor de 0 a 999 999.
 */
function numeroBienFormado(fragmento: string): boolean {
  // Debe contener solo dígitos y a lo sumo un separador decimal.
  let separadores = 0;
  for (const c of fragmento) {
    if (esSeparadorDecimal(c)) separadores += 1;
    else if (!esDigito(c)) return false;
  }
  if (separadores > 1) return false;

  if (separadores === 0) {
    // Solo parte entera: al menos un dígito (garantizado porque empezó con dígito).
    const entero = Number(fragmento);
    return Number.isInteger(entero) && entero >= 0 && entero <= 999_999;
  }

  // Con separador: dígitos a ambos lados, hasta 4 decimales.
  const posicion = fragmento.search(/[.,]/);
  const parteEntera = fragmento.slice(0, posicion);
  const parteDecimal = fragmento.slice(posicion + 1);

  if (parteEntera.length === 0 || parteDecimal.length === 0) return false;
  if (parteDecimal.length > 4) return false;

  const valor = Number(fragmento.replace(',', '.'));
  return Number.isFinite(valor) && valor >= 0 && valor <= 999_999;
}
