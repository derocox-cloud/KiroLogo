// Editor de KiroLogo: `textarea` nativo + canaleta de números de línea + contador
// de instrucciones. Aplica los dos límites (200 líneas y 10 000 caracteres),
// resalta la línea del paso a paso y marca las líneas con error.
//
// No resalta sintaxis (D4) y no recorre el AST: pide el número a `conteo.ts`.
// Las dependencias del DOM entran por parámetro (un contenedor), y el lexer, el
// parser, el conteo y el reloj de rebote también, para poder probar en jsdom.

import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import type { ErrorKiroLogo } from '../lenguaje/errores.js';
import type { Mundo } from '../lenguaje/vocabulario.js';

// ============================================================================
// Límites del editor (requisito 21.2)
// ============================================================================

/** Máximo de líneas admitidas, inclusive. */
export const MAXIMO_LINEAS = 200;

/** Máximo de caracteres admitidos, inclusive. */
export const MAXIMO_CARACTERES = 10_000;

/** Espera del rebote del contador, en milisegundos (≤ 200 ms tras el último cambio). */
export const REBOTE_CONTADOR_MS = 120;

/** Máximo de marcas de error en la canaleta (requisito 21.7). */
export const MAXIMO_MARCAS = 20;

/** Cuál de los dos límites se alcanzó al recortar. */
export type LimiteAlcanzado = 'lineas' | 'caracteres';

// ============================================================================
// Dependencias inyectables
// ============================================================================

/**
 * Reloj de rebote inyectable: en producción envuelve `setTimeout`/`clearTimeout`;
 * en pruebas se inyecta uno con tiempo controlado para disparar el análisis ya.
 */
export interface RelojRebote {
  programar(callback: () => void, ms: number): number;
  cancelar(id: number): void;
}

/** Reloj de rebote por omisión, sobre `setTimeout`. */
export const RELOJ_REBOTE_INMEDIATO: RelojRebote = {
  programar(callback: () => void): number {
    // Dispara de inmediato: útil como reloj degenerado; producción usa setTimeout.
    callback();
    return 0;
  },
  cancelar(): void {
    // Nada que cancelar en el reloj inmediato.
  },
};

export interface DependenciasEditor {
  /** Contenedor del DOM donde el editor crea sus elementos. */
  readonly contenedor: HTMLElement;
  /** Mundo del nivel en curso, para el análisis del parser. */
  readonly mundo: Mundo;
  /** `presupuestoEstrella` del reto en curso. */
  readonly presupuestoEstrella: number;
  /**
   * Pide al globo el mensaje del límite alcanzado. El editor no compone texto de
   * jugador: nombra cuál límite y su valor y deja al globo mostrarlo.
   */
  readonly pedirMensajeLimite: (limite: LimiteAlcanzado, valor: number) => void;
  /** Reloj de rebote del contador; por omisión dispara de inmediato. */
  readonly reloj?: RelojRebote;
}

// ============================================================================
// Conteo de líneas y caracteres (requisito 21.2)
// ============================================================================

/**
 * Cuenta las líneas de un texto: cada fragmento delimitado por un fin de línea,
 * reconociendo `\r\n` y `\n` como un solo fin, contando la última línea aunque no
 * termine en fin de línea. Un texto vacío tiene 1 línea.
 */
export function contarLineas(texto: string): number {
  let lineas = 1;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '\n') {
      lineas += 1;
    }
  }
  return lineas;
}

/** Número de caracteres del texto, contando espacios, tabuladores y fines de línea. */
export function contarCaracteres(texto: string): number {
  return texto.length;
}

export interface ResultadoRecorte {
  readonly texto: string;
  readonly recortado: boolean;
  readonly limite: LimiteAlcanzado | null;
}

/**
 * Recorta un texto a los dos límites, descartando únicamente el excedente y
 * conservando el contenido admitido. Aplica primero el límite de líneas (corta
 * al final de la línea 200) y luego el de caracteres. Reconoce `\r\n` y `\n`.
 */
export function recortarALimites(texto: string): ResultadoRecorte {
  let resultado = texto;
  let limite: LimiteAlcanzado | null = null;

  // Límite de líneas: conservar hasta MAXIMO_LINEAS líneas.
  if (contarLineas(resultado) > MAXIMO_LINEAS) {
    resultado = recortarLineas(resultado, MAXIMO_LINEAS);
    limite = 'lineas';
  }

  // Límite de caracteres: conservar los primeros MAXIMO_CARACTERES.
  if (resultado.length > MAXIMO_CARACTERES) {
    resultado = resultado.slice(0, MAXIMO_CARACTERES);
    limite = 'caracteres';
  }

  return { texto: resultado, recortado: limite !== null, limite };
}

/** Conserva las primeras `maximo` líneas del texto, sin el fin de línea sobrante. */
function recortarLineas(texto: string, maximo: number): string {
  let lineas = 1;
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '\n') {
      lineas += 1;
      if (lineas > maximo) {
        // Corta antes de este `\n`, incluyendo el `\r` que lo preceda.
        const fin = i > 0 && texto[i - 1] === '\r' ? i - 1 : i;
        return texto.slice(0, fin);
      }
    }
  }
  return texto;
}

// ============================================================================
// Contador de instrucciones (requisitos 21.4, 21.5)
// ============================================================================

/** Estado del contador que el editor expone para consulta. */
export interface EstadoContador {
  /** Entero mostrado (el último conteo bueno cuando el actual falla). */
  readonly conteo: number;
  /** true cuando el conteo mostrado es provisional por errores del análisis. */
  readonly provisional: boolean;
  /** Errores del lexer y del parser del texto en curso, en orden. */
  readonly errores: readonly ErrorKiroLogo[];
}

// ============================================================================
// Interfaz pública del editor
// ============================================================================

export interface Editor {
  /** Elemento raíz del editor, para insertarlo en el árbol. */
  readonly raiz: HTMLElement;
  /** El `textarea` nativo, foco y navegación por teclado de serie. */
  readonly area: HTMLTextAreaElement;
  /** Devuelve el texto en curso. */
  texto(): string;
  /** Fija el texto por completo, aplicando la regla de límites. */
  ponerTexto(texto: string): void;
  /**
   * Inserta un fragmento en la posición del cursor (reemplaza la selección; al
   * final si no hay cursor), aplica la regla de límites y devuelve la línea del
   * cursor resultante (desde 1).
   */
  insertarEnCursor(fragmento: string): number;
  /** Estado del contador: conteo, provisional y errores. */
  estadoContador(): EstadoContador;
  /** Línea del cursor (desde 1) según la posición de selección del área. */
  lineaDelCursor(): number;
  /** Presenta un reto: vacía el área, pone el presupuesto y limpia marcas. */
  presentarReto(presupuestoEstrella: number): void;
  /** Resalta exactamente la línea dada en el paso a paso; 0 o menos retira el resalte. */
  resaltarLinea(linea: number): void;
  /** Fuerza el reanálisis y actualización del contador y las marcas ahora. */
  analizarAhora(): void;
  /** Registra un escucha de cada cambio del texto. */
  alCambiar(escucha: (texto: string) => void): void;
}

// ============================================================================
// Creación
// ============================================================================

/**
 * Crea el editor sobre un contenedor del DOM. Construye el `textarea`, la
 * canaleta hermana, el contador con el presupuesto al lado y la lista de marcas
 * de error. Sincroniza el desplazamiento de la canaleta y aplica los límites.
 */
export function crearEditor(deps: DependenciasEditor): Editor {
  const doc = deps.contenedor.ownerDocument;
  const reloj = deps.reloj ?? RELOJ_REBOTE_INMEDIATO;
  let presupuesto = deps.presupuestoEstrella;

  // --- Estructura del DOM ---
  const raiz = doc.createElement('div');
  raiz.className = 'kl-editor';

  const zonaTexto = doc.createElement('div');
  zonaTexto.className = 'kl-editor-zona';

  const canaleta = doc.createElement('div');
  canaleta.className = 'kl-editor-canaleta';
  canaleta.setAttribute('aria-hidden', 'true'); // los números de línea no son mensaje de Kiro

  const area = doc.createElement('textarea');
  area.className = 'kl-editor-area';
  area.setAttribute('aria-label', 'Área de escritura del programa');
  area.setAttribute('spellcheck', 'false');
  area.setAttribute('wrap', 'off');

  zonaTexto.appendChild(canaleta);
  zonaTexto.appendChild(area);

  // Contador con el presupuesto al lado, con nombre accesible que los nombra por separado.
  const contador = doc.createElement('div');
  contador.className = 'kl-editor-contador';
  contador.setAttribute('role', 'status');

  const marcas = doc.createElement('ul');
  marcas.className = 'kl-editor-marcas';
  marcas.setAttribute('aria-label', 'Líneas con error');

  raiz.appendChild(zonaTexto);
  raiz.appendChild(contador);
  raiz.appendChild(marcas);
  deps.contenedor.appendChild(raiz);

  // --- Estado del contador ---
  let ultimoConteoBueno = 0;
  let obtuvoConteoBueno = false;
  let estado: EstadoContador = { conteo: 0, provisional: false, errores: [] };
  let lineaResaltada = 0;
  let idRebote: number | null = null;

  const escuchasCambio: Array<(texto: string) => void> = [];

  // --- Canaleta ---
  function actualizarCanaleta(): void {
    const total = contarLineas(area.value);
    // Reconstruye los números 1..total. Marca las líneas con error por forma (▲) y color.
    const lineasConError = new Set<number>();
    for (const e of estado.errores.slice(0, MAXIMO_MARCAS)) {
      if (e.linea !== null && e.linea >= 1 && e.linea <= total) lineasConError.add(e.linea);
    }
    canaleta.textContent = '';
    // Un `<span>` por número de línea; sin innerHTML para no escapar nada.
    for (let n = 1; n <= total; n++) {
      const span = doc.createElement('span');
      span.className = 'kl-canaleta-linea';
      span.setAttribute('data-linea', String(n));
      if (lineasConError.has(n)) span.classList.add('kl-canaleta-error');
      if (n === lineaResaltada && lineaResaltada >= 1) span.classList.add('kl-canaleta-actual');
      span.textContent = (lineasConError.has(n) ? '▲ ' : '') + String(n);
      canaleta.appendChild(span);
    }
    canaleta.scrollTop = area.scrollTop;
  }

  // --- Marcas de error (lista con número y mensaje) ---
  function actualizarMarcas(): void {
    const total = contarLineas(area.value);
    marcas.textContent = '';
    let mostradas = 0;
    for (const e of estado.errores) {
      if (mostradas >= MAXIMO_MARCAS) break;
      if (e.linea === null || e.linea < 1 || e.linea > total) continue; // retira las que ya no existen
      const li = doc.createElement('li');
      li.className = 'kl-editor-marca';
      li.setAttribute('data-linea', String(e.linea));
      // Distinguible por forma (▲) además de por color.
      li.textContent = `▲ Línea ${e.linea}: ${e.mensaje}`;
      marcas.appendChild(li);
      mostradas += 1;
    }
  }

  // --- Contador con presupuesto ---
  function actualizarContador(): void {
    contador.textContent = '';

    const conteoTxt = doc.createElement('span');
    conteoTxt.className = 'kl-contador-instrucciones';
    const marcaProvisional = estado.provisional ? ' (provisional)' : '';
    conteoTxt.textContent = `Instrucciones: ${estado.conteo}${marcaProvisional}`;

    const presTxt = doc.createElement('span');
    presTxt.className = 'kl-contador-presupuesto';
    presTxt.textContent = `Presupuesto: ${presupuesto}`;

    const excede = estado.conteo > presupuesto;
    if (excede) {
      // Señala el exceso con texto en español además del color.
      presTxt.classList.add('kl-contador-exceso');
      const aviso = doc.createElement('span');
      aviso.className = 'kl-contador-aviso';
      aviso.textContent = 'Te pasaste del presupuesto';
      contador.appendChild(conteoTxt);
      contador.appendChild(presTxt);
      contador.appendChild(aviso);
    } else {
      contador.appendChild(conteoTxt);
      contador.appendChild(presTxt);
    }

    // Nombre accesible que nombra los dos números por separado.
    const nombre = `Instrucciones ${estado.conteo}${
      estado.provisional ? ' provisional' : ''
    }; presupuesto de estrella ${presupuesto}${excede ? '; te pasaste del presupuesto' : ''}`;
    contador.setAttribute('aria-label', nombre);
  }

  // --- Análisis: lexer + parser + conteo ---
  function analizarTexto(): void {
    const texto = area.value;
    const errores: ErrorKiroLogo[] = [];

    const lexico = analizarLexico(texto);
    for (const e of lexico.errores) errores.push(e);

    let conteoActual: number | null = null;
    if (lexico.errores.length === 0) {
      const sintactico = analizar(lexico.tokens, { mundo: deps.mundo });
      for (const e of sintactico.errores) errores.push(e);
      if (sintactico.programa !== null && sintactico.errores.length === 0) {
        const c = contarInstrucciones(sintactico.programa);
        if (c.exito) {
          conteoActual = c.instrucciones;
        } else {
          errores.push(c.error);
        }
      }
    }

    if (conteoActual !== null) {
      // Conteo bueno: se muestra sin marca de provisional.
      ultimoConteoBueno = conteoActual;
      obtuvoConteoBueno = true;
      estado = { conteo: conteoActual, provisional: false, errores };
    } else {
      // Hay errores: sigue mostrando el último conteo bueno (0 si nunca hubo).
      estado = {
        conteo: obtuvoConteoBueno ? ultimoConteoBueno : 0,
        provisional: true,
        errores,
      };
    }

    actualizarContador();
    actualizarMarcas();
    actualizarCanaleta();
  }

  function programarAnalisis(): void {
    if (idRebote !== null) reloj.cancelar(idRebote);
    idRebote = reloj.programar(() => {
      idRebote = null;
      analizarTexto();
    }, REBOTE_CONTADOR_MS);
  }

  function emitirCambio(): void {
    for (const e of escuchasCambio) e(area.value);
  }

  // --- Eventos ---
  area.addEventListener('input', () => {
    // Aplica los dos límites al valor actual (cubre escritura y pegado).
    const recorte = recortarALimites(area.value);
    if (recorte.recortado) {
      area.value = recorte.texto;
      // Cursor al final del contenido admitido.
      const fin = area.value.length;
      area.setSelectionRange(fin, fin);
      if (recorte.limite === 'lineas') deps.pedirMensajeLimite('lineas', MAXIMO_LINEAS);
      else if (recorte.limite === 'caracteres') deps.pedirMensajeLimite('caracteres', MAXIMO_CARACTERES);
    }
    emitirCambio();
    programarAnalisis();
  });

  area.addEventListener('scroll', () => {
    canaleta.scrollTop = area.scrollTop;
  });

  // No captura Tab: el `textarea` nativo ya mueve el foco. No añadimos preventDefault.

  function fijarValor(texto: string): void {
    const recorte = recortarALimites(texto);
    area.value = recorte.texto;
    const fin = area.value.length;
    area.setSelectionRange(fin, fin);
    if (recorte.limite === 'lineas') deps.pedirMensajeLimite('lineas', MAXIMO_LINEAS);
    else if (recorte.limite === 'caracteres') deps.pedirMensajeLimite('caracteres', MAXIMO_CARACTERES);
    emitirCambio();
    analizarTexto();
  }

  function lineaEnPosicion(pos: number): number {
    let linea = 1;
    const hasta = Math.min(pos, area.value.length);
    for (let i = 0; i < hasta; i++) {
      if (area.value[i] === '\n') linea += 1;
    }
    return linea;
  }

  // Estado inicial.
  actualizarContador();
  actualizarCanaleta();
  actualizarMarcas();

  return {
    raiz,
    area,

    texto(): string {
      return area.value;
    },

    ponerTexto(texto: string): void {
      fijarValor(texto);
    },

    insertarEnCursor(fragmento: string): number {
      const inicio = area.selectionStart;
      const fin = area.selectionEnd;
      let nuevoTexto: string;
      let posCursor: number;
      if (typeof inicio === 'number' && typeof fin === 'number') {
        nuevoTexto = area.value.slice(0, inicio) + fragmento + area.value.slice(fin);
        posCursor = inicio + fragmento.length;
      } else {
        // Sin posición de cursor: al final.
        nuevoTexto = area.value + fragmento;
        posCursor = nuevoTexto.length;
      }

      const recorte = recortarALimites(nuevoTexto);
      area.value = recorte.texto;
      // El cursor queda tras el texto insertado, acotado al contenido admitido.
      const pos = Math.min(posCursor, area.value.length);
      area.setSelectionRange(pos, pos);
      if (recorte.limite === 'lineas') deps.pedirMensajeLimite('lineas', MAXIMO_LINEAS);
      else if (recorte.limite === 'caracteres') deps.pedirMensajeLimite('caracteres', MAXIMO_CARACTERES);
      emitirCambio();
      analizarTexto();
      return lineaEnPosicion(pos);
    },

    estadoContador(): EstadoContador {
      return { conteo: estado.conteo, provisional: estado.provisional, errores: estado.errores.slice() };
    },

    lineaDelCursor(): number {
      return lineaEnPosicion(area.selectionStart ?? area.value.length);
    },

    presentarReto(presupuestoEstrella: number): void {
      presupuesto = presupuestoEstrella;
      ultimoConteoBueno = 0;
      obtuvoConteoBueno = false;
      lineaResaltada = 0;
      area.value = '';
      area.setSelectionRange(0, 0);
      estado = { conteo: 0, provisional: false, errores: [] };
      actualizarContador();
      actualizarCanaleta();
      actualizarMarcas();
    },

    resaltarLinea(linea: number): void {
      lineaResaltada = linea >= 1 ? linea : 0;
      actualizarCanaleta();
    },

    analizarAhora(): void {
      if (idRebote !== null) {
        reloj.cancelar(idRebote);
        idRebote = null;
      }
      analizarTexto();
    },

    alCambiar(escucha: (texto: string) => void): void {
      escuchasCambio.push(escucha);
    },
  };
}
