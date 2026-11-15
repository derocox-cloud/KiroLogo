// Parser de KiroLogo: tokens → AST
// Descenso recursivo con recuperación por sincronización.
// Desde el mundo 2 es de DOS pasadas: una primera recoge los nombres de los
// procedimientos (PARA … FIN) y la segunda parsea tratando cada nombre recogido
// como invocable (ver `recolectarProcedimientos`).

import type { Token } from './lexer.js';
import type {
  Programa, Instruccion, InvocacionComando, NumeroLiteral, Expresion, Repeticion,
  DefinicionProcedimiento, InvocacionProcedimiento, ArgumentoColor, PalabraLiteral,
} from './ast.js';
import { buscarComando, type Mundo, type EntradaVocabulario } from './vocabulario.js';
import { crearError, resolverPalabraNoEjecutable, type ErrorKiroLogo } from './errores.js';

// ============================================================================
// Tipos públicos
// ============================================================================

/** Mundo en que se desbloquean los operadores y paréntesis. */
const MUNDO_ARITMETICA = 4;

export interface OpcionesAnalisis {
  readonly mundo: Mundo;                     // el del Nivel en curso
}

export interface ResultadoSintactico {
  readonly programa: Programa | null;         // null si hubo al menos un error
  readonly errores: readonly ErrorKiroLogo[]; // ≤ 20, ordenados por línea y columna
}

/** Máximo de errores que se devuelven; los de línea mayor se descartan. */
const MAXIMO_ERRORES = 20;

/**
 * Firma de un procedimiento tal como la ve la primera pasada. Las llamadas se
 * validan contra ella antes de ejecutar, incluso si la definicion aparece despues.
 */
export interface FirmaProcedimiento {
  readonly nombre: string;                  // normalizado, MAYUSCULAS
  readonly parametros: readonly string[];   // minusculas, sin ':', sin duplicados
  readonly escritos: readonly string[];     // como los escribio el jugador, con ':'
  readonly linea: number;
  // Conocida pero sin nodo (parametro repetido o parametros antes del mundo 4):
  // asi las llamadas se validan contra una aridad razonable y no encadenan "No se como hacer...".
  readonly rechazada: boolean;
}

/**
 * Nombres de los procedimientos válidos de un programa, en orden de definición,
 * tal como quedan registrados en la `Tabla_Procedimientos`. Es la primera pasada
 * del parser (`recolectarProcedimientos`) expuesta como lista ordenada: descarta
 * las definiciones rechazadas (nombre que pisa el lenguaje, redefinición, `PARA`
 * sin `FIN`) y conserva la primera aparición de cada nombre.
 *
 * El panel de comandos la usa para mostrar los procedimientos del jugador junto a
 * los comandos del lenguaje (R7.1, R7.4, R7.5). Opera sobre los tokens y no exige
 * un parse sin errores: aunque el resto del programa tenga fallos, los `PARA … FIN`
 * bien formados siguen reconociéndose, que es justo lo que el panel debe reflejar
 * mientras el jugador escribe.
 *
 * El orden es el de definición porque `recolectarProcedimientos` recorre los tokens
 * de izquierda a derecha y un `Set` conserva el orden de inserción.
 *
 * En un mundo donde `PARA` todavía está bloqueado no hay procedimientos que
 * mostrar: el parser rechaza ese `PARA` con `comandoBloqueado`, así que el panel
 * no debe ofrecer un botón para algo que no se puede definir. El mundo en que se
 * desbloquea sale del vocabulario, no de un número escrito aquí.
 *
 * @param tokens Tokens producidos por el lexer
 * @param mundo Mundo del nivel en curso
 */
export function nombresDeProcedimientos(tokens: readonly Token[], mundo: Mundo): readonly string[] {
  return firmasDeProcedimientos(tokens, mundo).map((f) => f.nombre);
}

/**
 * Firmas de los procedimientos validos de un programa, en orden de definicion.
 * Como nombresDeProcedimientos, no incluye las rechazadas (parametro repetido,
 * parametros antes del mundo 4): el panel no las lista.
 */
export function firmasDeProcedimientos(tokens: readonly Token[], mundo: Mundo): readonly FirmaProcedimiento[] {
  const para = buscarComando('PARA');
  if (!para.hallada || para.entrada.mundo > mundo) return [];
  return [...recolectarFirmas(tokens, mundo).values()].filter((f) => !f.rechazada);
}

// ============================================================================
// Estado del análisis
// ============================================================================

interface Estado {
  readonly tokens: readonly Token[];
  indice: number;
  readonly mundo: Mundo;
  readonly errores: ErrorKiroLogo[];
  pilaCorchetes: number[];   // líneas de los corchetes de apertura activos
  readonly firmas: Map<string, FirmaProcedimiento>; // PARA válidos (1ª pasada) más los de PARA anidados ya reportados
  profundidadParentesis: number;   // paréntesis abiertos en este punto (tope 32)
  nivelExpresion: number;          // anidamiento de unarios/operandos en curso (defensa de pila, tope 128)
  readonly alturas: WeakMap<object, number>; // altura de cada nodo de expresión construido
  anidamiento: number;   // listas de REPITE y cuerpos de PARA abiertos en este punto
  readonly definidos: Set<string>;  // nombres ya definidos en ESTA 2ª pasada (para detectar redefinición)
  // Parámetros visibles: los del PARA en curso, o null en el programa principal. Un procedimiento no hereda los de quien lo llama.
  ambito: ReadonlySet<string> | null;
}

/**
 * Analiza una lista de tokens produciendo un `Programa` o, si hay errores, la
 * lista de errores acumulados (hasta 20) sin árbol.
 *
 * @param tokens Tokens producidos por el lexer
 * @param opciones Opciones de análisis, incluido el mundo del nivel en curso
 * @returns Resultado con el programa (o null) y los errores
 */
export function analizar(
  tokensEscritos: readonly Token[],
  opciones: OpcionesAnalisis,
): ResultadoSintactico {
  // Antes del mundo 4 los símbolos aritméticos no existen: se avisa una sola vez con el
  // primero y se analiza el resto sin ellos. Los demás errores de esas líneas se omiten,
  // porque son consecuencia de haber quitado el símbolo y repetirían el mismo aviso.
  // `comandoBloqueado` se conserva: sale del comando escrito, no del símbolo quitado, y
  // cada ocurrencia de un comando del mundo 4 se reporta (R5.6, R9.8, R11.11).
  let tokens = tokensEscritos;
  let bloqueo: ErrorKiroLogo | null = null;
  const lineasConSimbolo = new Set<number>();
  if (opciones.mundo < MUNDO_ARITMETICA) {
    const esSimbolo = (t: Token): boolean =>
      t.tipo === 'operador' || t.tipo === 'parentesis_abre' || t.tipo === 'parentesis_cierra';
    const primero = tokensEscritos.find(esSimbolo);
    if (primero !== undefined) {
      bloqueo = crearError(
        'aritmeticaBloqueada',
        { simbolo: primero.textoOriginal, mundo: MUNDO_ARITMETICA },
        posicion(primero),
      );
      for (const t of tokensEscritos) if (esSimbolo(t)) lineasConSimbolo.add(t.linea);
      tokens = tokensEscritos.filter((t) => !esSimbolo(t));
    }
  }
  // Primera pasada: recolectar los nombres de los PARA bien formados. La segunda
  // pasada (el bucle de abajo) usa este conjunto para tratar un `identificador`
  // como invocación de procedimiento aunque la definición aparezca más adelante
  // en el texto (referencia adelantada, R1.5), sin reportar «palabra desconocida»
  // sobre un nombre que el jugador sí definió más abajo.
  const estado: Estado = {
    tokens,
    indice: 0,
    mundo: opciones.mundo,
    errores: [],
    pilaCorchetes: [],
    firmas: recolectarFirmas(tokens, opciones.mundo),
    profundidadParentesis: 0,
    nivelExpresion: 0,
    alturas: new WeakMap<object, number>(),
    anidamiento: 0,
    definidos: new Set<string>(),
    ambito: null,
  };

  const instrucciones: Instruccion[] = [];

  while (!finalizado(estado)) {
    const antes = estado.indice;
    const instruccion = analizarInstruccion(estado);
    if (instruccion !== null) {
      instrucciones.push(instruccion);
    } else {
      // Hubo un error: recuperar por sincronización.
      sincronizar(estado);
    }
    // Salvaguarda contra bucles: si no avanzamos ni sincronizamos, forzar avance.
    if (estado.indice === antes) {
      estado.indice += 1;
    }
  }

  const erroresFinales = ordenarYAcotar(
    bloqueo === null
      ? estado.errores
      : [bloqueo, ...estado.errores.filter((e) => e.id === 'comandoBloqueado' || !lineasConSimbolo.has(e.linea ?? 0))],
  );

  if (erroresFinales.length > 0) {
    return { programa: null, errores: erroresFinales };
  }

  return {
    programa: { tipo: 'programa', instrucciones },
    errores: [],
  };
}

// ============================================================================
// Análisis de una instrucción
// ============================================================================

/**
 * Analiza una instrucción a partir del token actual. Devuelve el nodo o `null`
 * si reportó un error (dejando el cursor donde ocurrió, para que el llamador
 * decida la sincronización).
 */
function analizarInstruccion(estado: Estado): Instruccion | null {
  const token = actual(estado)!;

  // Donde se espera un comando, un corchete/parámetro/palabra/número sueltos
  // son errores «inesperado» (requisitos 5.10, 5.11).
  switch (token.tipo) {
    case 'corchete_abre':
      reportar(estado, crearError('corcheteInesperado', { linea: token.linea }, posicion(token)));
      estado.indice += 1;
      return null;
    case 'corchete_cierra':
      reportar(estado, crearError('corcheteDeMasEnLinea', { linea: token.linea }, posicion(token)));
      estado.indice += 1;
      return null;
    case 'parametro':
      reportar(estado, crearError('parametroInesperado', { valor: token.textoOriginal, linea: token.linea }, posicion(token)));
      estado.indice += 1;
      return null;
    case 'palabra':
      reportar(estado, crearError('palabraInesperada', { valor: token.textoOriginal.slice(1), linea: token.linea }, posicion(token)));
      estado.indice += 1;
      return null;
    case 'parentesis_cierra':
      reportar(estado, crearError('parentesisDeMas', { linea: token.linea }, posicion(token)));
      estado.indice += 1;
      return null;
    case 'operador':
    case 'parentesis_abre':
      reportar(estado, crearError('parametroInesperado', { valor: token.textoOriginal, linea: token.linea }, posicion(token)));
      estado.indice += 1;
      return null;
    case 'numero':
      reportar(estado, crearError('numeroInesperado', { valor: token.textoOriginal, linea: token.linea }, posicion(token)));
      estado.indice += 1;
      return null;
    case 'identificador': {
      // Un identificador cuyo nombre normalizado está en la tabla de
      // procedimientos es una invocación, usable igual que un comando del
      // lenguaje (R1.4). Funciona con referencias adelantadas porque el conjunto
      // se construyó en la primera pasada (R1.5).
      const firma = estado.firmas.get(token.valor);
      if (firma !== undefined) return analizarInvocacion(estado, token, firma);
      // Palabra que no es comando ni procedimiento: el catálogo elige el mensaje
      // (sugerencia, inglés, bloqueado cercano o mensaje seco). Pasamos los
      // nombres de procedimiento para que un parecido sugiera uno de ellos (R6.3).
      reportar(
        estado,
        resolverPalabraNoEjecutable(
          token.textoOriginal,
          estado.mundo,
          posicion(token),
          [...estado.firmas.keys()],
        ),
      );
      estado.indice += 1;
      return null;
    }
    case 'comando':
      return analizarComando(estado, token);
  }
}

/**
 * Invocación de un procedimiento: una expresión por parámetro de su firma. La
 * aridad se valida aquí, antes de ejecutar, también para llamadas anteriores a la
 * definición (la firma sale de la primera pasada). Los argumentos siguientes al
 * primero deben empezar en la línea donde terminó el anterior.
 */
function analizarInvocacion(estado: Estado, token: Token, firma: FirmaProcedimiento): Instruccion | null {
  estado.indice += 1;
  const argumentos: Expresion[] = [];
  let ultimoEsResta = false;

  for (let i = 0; i < firma.parametros.length; i++) {
    const siguiente = actual(estado);
    const enLugar = i === 0 || (siguiente !== undefined && siguiente.linea === lineaDelUltimoToken(estado));
    if (siguiente !== undefined && siguiente.tipo === 'palabra' && enLugar) {
      reportar(
        estado,
        crearError(
          'argumentoDeTipoEquivocado',
          {
            comando: token.textoOriginal,
            recibido: siguiente.textoOriginal,
            procedimiento: token.textoOriginal,
            parametro: firma.escritos[i]!,
          },
          posicion(siguiente),
        ),
      );
      return null;
    }
    if (!enLugar || !puedeEmpezarExpresion(siguiente)) {
      reportar(
        estado,
        crearError(
          'procedimientoArgumentosFaltantes',
          {
            nombre: token.textoOriginal,
            esperados: firma.escritos,
            recibidos: i,
            ...(ultimoEsResta ? { menosComoResta: true } : {}),
          },
          posicion(token),
        ),
      );
      return null;
    }
    const inicio = estado.indice;
    const argumento = analizarExpresion(estado);
    if (argumento === null) return null;
    ultimoEsResta = esRestaBinariaSinParentesis(estado, inicio, argumento);
    argumentos.push(argumento);
  }

  // Lo que sobra en la misma línea que el último argumento (o que el nombre).
  const sobrante = actual(estado);
  if (
    sobrante !== undefined &&
    sobrante.linea === lineaDelUltimoToken(estado) &&
    (sobrante.tipo === 'palabra' || puedeEmpezarExpresion(sobrante))
  ) {
    reportar(
      estado,
      crearError(
        'procedimientoArgumentosDeMas',
        { nombre: token.textoOriginal, esperados: firma.escritos, linea: token.linea },
        posicion(sobrante),
      ),
    );
    return null;
  }

  const nodo: InvocacionProcedimiento = {
    tipo: 'invocacionProcedimiento',
    nombre: token.valor as string,
    argumentos,
    linea: token.linea,
    columna: token.columna,
  };
  return nodo;
}

/** ¿La expresión que empieza en `inicio` es una resta de nivel superior (sin paréntesis alrededor)? */
function esRestaBinariaSinParentesis(estado: Estado, inicio: number, expresion: Expresion): boolean {
  if (expresion.tipo !== 'expresionAritmetica' || expresion.operador !== '-') return false;
  let profundidad = 0;
  for (let k = inicio; k < estado.indice; k++) {
    const t = estado.tokens[k]!;
    if (t.tipo === 'parentesis_abre') profundidad += 1;
    else if (t.tipo === 'parentesis_cierra') profundidad -= 1;
    else if (profundidad === 0 && t.tipo === 'operador' && t.linea === expresion.linea && t.columna === expresion.columna) {
      return true;
    }
  }
  return false;
}

/**
 * Analiza un token de tipo `comando`: comprueba que esté desbloqueado y consume
 * su argumento según la aridad.
 */
function analizarComando(estado: Estado, token: Token): Instruccion | null {
  const busqueda = buscarComando(token.valor as string);
  // El lexer solo marca `comando` cuando `buscarComando` halla la entrada, así
  // que aquí siempre existe; el guard mantiene el tipo estricto.
  if (!busqueda.hallada) {
    reportar(
      estado,
      resolverPalabraNoEjecutable(token.textoOriginal, estado.mundo, posicion(token)),
    );
    estado.indice += 1;
    return null;
  }

  const entrada = busqueda.entrada;

  // Comando de un mundo posterior: bloqueado.
  if (entrada.mundo > estado.mundo) {
    reportar(
      estado,
      crearError(
        'comandoBloqueado',
        { nombre: entrada.nombre, mundo: entrada.mundo },
        posicion(token),
      ),
    );
    estado.indice += 1;
    return null;
  }

  // PARA abre una definición de procedimiento; FIN fuera de una definición es un
  // cierre suelto. Ambos se tratan antes de la consumición genérica por aridad.
  if (entrada.nombre === 'PARA') {
    // PARA solo se escribe en el nivel principal: dentro de un REPITE o de otro PARA
    // es un error de sintaxis propio, no algo que falle al ejecutar.
    if (estado.anidamiento > 0) return reportarParaAnidado(estado, token);
    return analizarDefinicion(estado, token);
  }
  if (entrada.nombre === 'FIN') {
    // Un FIN donde se espera una instrucción no tiene PARA que lo abra: el cuerpo
    // de una definición se consume dentro de analizarDefinicion, que lo intercepta
    // antes de que llegue aquí. Se descarta y la sincronización retoma el resto.
    reportar(estado, crearError('finSinPara', { linea: token.linea }, posicion(token)));
    estado.indice += 1;
    return null;
  }

  // Un comando de operador en posición de instrucción calcula un valor que nadie usa.
  // Se analiza completo (para consumir sus argumentos) y el ejemplo se arma con lo escrito.
  if (entrada.produceValor) {
    const inicio = estado.indice;
    const operador = analizarComandoOperador(estado, token, entrada);
    if (operador === null) return null;
    const escrito = estado.tokens.slice(inicio, estado.indice).map((t) => t.textoOriginal).join(' ');
    reportar(
      estado,
      crearError('operadorSinUso', { nombre: entrada.nombre, ejemplo: `ESCRIBE ${escrito}` }, posicion(token)),
    );
    return null;
  }

  // Consumir el comando.
  const lineaComando = token.linea;
  const columnaComando = token.columna;
  estado.indice += 1;

  // Comando con lista (REPITE): aridad especial.
  if (entrada.tiposArgumento.includes('lista')) {
    return analizarRepite(estado, entrada, lineaComando, columnaComando);
  }

  // Los comandos de color (PONCOLOR y RELLENA, mundo 2) toman un argumento de color:
  // palabra o terna RGB, no un literal numérico. Se decide por el tipo que declara el
  // vocabulario, no por el nombre, y se transporta sin resolver.
  if (entrada.tiposArgumento[0] === 'color') {
    return analizarComandoColor(estado, entrada, lineaComando, columnaComando);
  }

  // ESCRIBE y ROTULA aceptan una palabra con comilla o una expresión.
  if (entrada.tiposArgumento[0] === 'valorEscribible') {
    return analizarComandoEscribible(estado, entrada, lineaComando, columnaComando);
  }

  // En el mundo 0 los comandos son de aridad 0 o 1 con argumento numérico. En el
  // mundo 2 PONGROSOR es también aridad 1 numérico, así que reutiliza esta ruta.
  if (entrada.aridad === 1) {
    return analizarComandoConArgumento(estado, entrada, lineaComando, columnaComando);
  }

  // Aridad 0: sin argumento.
  const nodo: InvocacionComando = {
    tipo: 'invocacionComando',
    nombre: entrada.nombre,
    argumentos: [],
    linea: lineaComando,
    columna: columnaComando,
  };
  return nodo;
}

/**
 * Analiza un comando de aridad 1: espera un token `numero` a continuación.
 * Reporta `argumentoFaltante` o `argumentoDeTipoEquivocado` según el caso.
 */
function analizarComandoConArgumento(
  estado: Estado,
  entrada: EntradaVocabulario,
  lineaComando: number,
  columnaComando: number,
): Instruccion | null {
  const siguiente = actual(estado);

  // No consumir el token equivocado; la sincronización descartará el resto
  // de la instrucción y reanudará en el siguiente comando.
  if (!puedeEmpezarExpresion(siguiente)) {
    reportarArgumentoInvalido(estado, entrada.nombre, siguiente, { linea: lineaComando, columna: columnaComando });
    return null;
  }

  const argumento = analizarExpresion(estado);
  if (argumento === null) return null;

  const nodo: InvocacionComando = {
    tipo: 'invocacionComando',
    nombre: entrada.nombre,
    argumentos: [argumento],
    linea: lineaComando,
    columna: columnaComando,
  };
  return nodo;
}

/** `ESCRIBE` y `ROTULA`: una palabra con comilla (`"hola`) o una expresión. */
function analizarComandoEscribible(
  estado: Estado,
  entrada: EntradaVocabulario,
  lineaComando: number,
  columnaComando: number,
): Instruccion | null {
  const siguiente = actual(estado);
  if (siguiente === undefined || esComandoDeAccion(siguiente)) {
    reportarArgumentoInvalido(estado, entrada.nombre, siguiente, { linea: lineaComando, columna: columnaComando });
    return null;
  }

  let argumento: Expresion | null;
  if (siguiente.tipo === 'palabra') {
    estado.indice += 1;
    const palabra: PalabraLiteral = {
      tipo: 'palabraLiteral',
      valor: siguiente.textoOriginal.slice(1),
      linea: siguiente.linea,
      columna: siguiente.columna,
    };
    argumento = palabra;
  } else if (puedeEmpezarExpresion(siguiente)) {
    argumento = analizarExpresion(estado);
  } else {
    reportar(
      estado,
      crearError(
        'argumentoDeTipoEquivocado',
        { comando: entrada.nombre, recibido: siguiente.textoOriginal },
        posicion(siguiente),
      ),
    );
    return null;
  }
  if (argumento === null) return null;

  const nodo: InvocacionComando = {
    tipo: 'invocacionComando',
    nombre: entrada.nombre,
    argumentos: [argumento],
    linea: lineaComando,
    columna: columnaComando,
  };
  return nodo;
}

// ============================================================================
// Expresiones
// ============================================================================
//
//   expresion = termino { ("+" | "-") termino } ;       asociatividad izquierda
//   termino   = unario  { ("*" | "/") unario  } ;
//   unario    = "-" unario | primario ;
//   primario  = NUMERO | PARAMETRO | "(" expresion ")" | operador ;
//   operador  = NOMBRE_OPERADOR expresion { expresion } ;   aridad exacta del vocabulario
//
// Regla de la línea: un operador infijo continúa la expresión solo si está en la
// misma línea que el último token del operando izquierdo, y su operando derecho
// debe estar en la línea del operador. El primer argumento de una instrucción
// puede empezar en una línea posterior; los siguientes de un comando de operador
// deben empezar en la línea donde terminó el argumento anterior.

const MAXIMO_PARENTESIS = 32;
// Defensa de pila, no regla de producto: `evaluar`, `contar` e `imprimir` son recursivos.
const MAXIMA_ALTURA_EXPRESION = 128;

function entradaDe(token: Token): EntradaVocabulario | null {
  if (token.tipo !== 'comando') return null;
  const busqueda = buscarComando(token.valor);
  return busqueda.hallada ? busqueda.entrada : null;
}

function esComandoOperador(token: Token): boolean {
  return entradaDe(token)?.produceValor === true;
}

/** Comando que ejecuta algo (no calcula un valor): termina la instrucción en curso. */
function esComandoDeAccion(token: Token): boolean {
  return token.tipo === 'comando' && !esComandoOperador(token);
}

/**
 * Lo que sigue a `comando` no puede empezar una expresión (D9).
 * - Falta el token, o una acción empieza en una línea posterior: `argumentoFaltante`.
 * - Una acción en la misma línea (`AVANZA AVANZA 10`), un procedimiento u otro token
 *   que no es expresión: `argumentoDeTipoEquivocado`.
 */
function reportarArgumentoInvalido(
  estado: Estado,
  comando: string,
  siguiente: Token | undefined,
  posicionComando: { readonly linea: number; readonly columna: number },
): void {
  const ultimo = estado.tokens[estado.indice - 1];
  const aOtraLinea = siguiente !== undefined && esComandoDeAccion(siguiente) &&
    ultimo !== undefined && siguiente.linea !== ultimo.linea;
  if (siguiente === undefined || aOtraLinea) {
    reportar(estado, crearError('argumentoFaltante', { comando }, posicionComando));
    return;
  }
  reportar(
    estado,
    crearError('argumentoDeTipoEquivocado', { comando, recibido: siguiente.textoOriginal }, posicion(siguiente)),
  );
}

function esOperador(token: Token | undefined, simbolos: string): boolean {
  return token !== undefined && token.tipo === 'operador' && simbolos.includes(token.valor);
}

function puedeEmpezarExpresion(token: Token | undefined): boolean {
  if (token === undefined) return false;
  return (
    token.tipo === 'numero' ||
    token.tipo === 'parametro' ||
    token.tipo === 'parentesis_abre' ||
    esOperador(token, '-') ||
    esComandoOperador(token)
  );
}

function lineaDelUltimoToken(estado: Estado): number {
  return estado.tokens[estado.indice - 1]?.linea ?? 0;
}

function alturaDe(estado: Estado, nodo: Expresion): number {
  return estado.alturas.get(nodo) ?? 1;
}

function registrarAltura(estado: Estado, nodo: Expresion, altura: number): Expresion | null {
  if (altura > MAXIMA_ALTURA_EXPRESION) {
    reportar(estado, crearError('expresionDemasiadoProfunda', {}, posicion(estado.tokens[estado.indice - 1]!)));
    return null;
  }
  estado.alturas.set(nodo, altura);
  return nodo;
}

/** El operador o paréntesis recién consumido se quedó sin operando. */
function reportarExpresionIncompleta(estado: Estado, simbolo: Token): null {
  reportar(
    estado,
    crearError('expresionIncompleta', { simbolo: simbolo.textoOriginal, linea: simbolo.linea }, posicion(simbolo)),
  );
  return null;
}

/**
 * Analiza una expresión desde el token actual. Devuelve `null` si reportó un error
 * (el llamador sincroniza); nunca lanza por entradas muy anidadas.
 */
function analizarExpresion(estado: Estado): Expresion | null {
  let izquierda = analizarTermino(estado);
  if (izquierda === null) return null;

  for (;;) {
    const operador = actual(estado);
    if (!esOperador(operador, '+-') || operador!.linea !== lineaDelUltimoToken(estado)) return izquierda;
    estado.indice += 1;
    const siguiente = actual(estado);
    if (!puedeEmpezarExpresion(siguiente) || siguiente!.linea !== operador!.linea) {
      return reportarExpresionIncompleta(estado, operador!);
    }
    const derecha = analizarTermino(estado);
    if (derecha === null) return null;
    const nodo: Expresion = {
      tipo: 'expresionAritmetica',
      operador: operador!.valor as '+' | '-',
      izquierda,
      derecha,
      linea: operador!.linea,
      columna: operador!.columna,
    };
    const registrado = registrarAltura(estado, nodo, Math.max(alturaDe(estado, izquierda), alturaDe(estado, derecha)) + 1);
    if (registrado === null) return null;
    izquierda = registrado;
  }
}

function analizarTermino(estado: Estado): Expresion | null {
  let izquierda = analizarUnario(estado);
  if (izquierda === null) return null;

  for (;;) {
    const operador = actual(estado);
    if (!esOperador(operador, '*/') || operador!.linea !== lineaDelUltimoToken(estado)) return izquierda;
    estado.indice += 1;
    const siguiente = actual(estado);
    if (!puedeEmpezarExpresion(siguiente) || siguiente!.linea !== operador!.linea) {
      return reportarExpresionIncompleta(estado, operador!);
    }
    const derecha = analizarUnario(estado);
    if (derecha === null) return null;
    const nodo: Expresion = {
      tipo: 'expresionAritmetica',
      operador: operador!.valor as '*' | '/',
      izquierda,
      derecha,
      linea: operador!.linea,
      columna: operador!.columna,
    };
    const registrado = registrarAltura(estado, nodo, Math.max(alturaDe(estado, izquierda), alturaDe(estado, derecha)) + 1);
    if (registrado === null) return null;
    izquierda = registrado;
  }
}

function analizarUnario(estado: Estado): Expresion | null {
  if (estado.nivelExpresion >= MAXIMA_ALTURA_EXPRESION) {
    reportar(estado, crearError('expresionDemasiadoProfunda', {}, posicion(actual(estado) ?? estado.tokens[estado.indice - 1]!)));
    return null;
  }
  estado.nivelExpresion += 1;
  try {
    const menos = actual(estado);
    if (!esOperador(menos, '-')) return analizarPrimario(estado);

    estado.indice += 1;
    const siguiente = actual(estado);
    if (!puedeEmpezarExpresion(siguiente) || siguiente!.linea !== menos!.linea) {
      return reportarExpresionIncompleta(estado, menos!);
    }
    const operando = analizarUnario(estado);
    if (operando === null) return null;
    return registrarAltura(
      estado,
      { tipo: 'menosUnario', operando, linea: menos!.linea, columna: menos!.columna },
      alturaDe(estado, operando) + 1,
    );
  } finally {
    estado.nivelExpresion -= 1;
  }
}

function analizarPrimario(estado: Estado): Expresion | null {
  const token = actual(estado);
  if (token === undefined) return null;

  if (token.tipo === 'numero') {
    estado.indice += 1;
    const numero: NumeroLiteral = { tipo: 'numeroLiteral', valor: token.valor, linea: token.linea, columna: token.columna };
    return numero;
  }

  if (token.tipo === 'parametro') {
    estado.indice += 1;
    const nombreParametro = String(token.valor).toLowerCase();
    if (estado.ambito === null || !estado.ambito.has(nombreParametro)) {
      // Se reporta pero se devuelve la referencia para seguir y acumular más errores.
      reportar(estado, crearError('variableNoDefinida', { nombre: token.textoOriginal }, posicion(token)));
    }
    return { tipo: 'referenciaParametro', nombre: nombreParametro, linea: token.linea, columna: token.columna };
  }

  if (token.tipo === 'parentesis_abre') {
    if (estado.profundidadParentesis >= MAXIMO_PARENTESIS) {
      reportar(estado, crearError('expresionDemasiadoProfunda', {}, posicion(token)));
      return null;
    }
    estado.indice += 1;
    const siguiente = actual(estado);
    if (siguiente === undefined || !puedeEmpezarExpresion(siguiente)) {
      // Un `(` al final del texto quedó sin cerrar; `()` o `(]` dejan al paréntesis sin contenido.
      return siguiente === undefined
        ? (reportar(estado, crearError('parentesisSinCerrar', { linea: token.linea }, posicion(token))), null)
        : reportarExpresionIncompleta(estado, token);
    }
    estado.profundidadParentesis += 1;
    let interior: Expresion | null;
    try {
      interior = analizarExpresion(estado);
    } finally {
      estado.profundidadParentesis -= 1;
    }
    if (interior === null) return null;
    const cierre = actual(estado);
    if (cierre === undefined || cierre.tipo !== 'parentesis_cierra') {
      reportar(estado, crearError('parentesisSinCerrar', { linea: token.linea }, posicion(token)));
      return null;
    }
    estado.indice += 1;
    return interior;
  }

  const entrada = entradaDe(token);
  if (entrada !== null && entrada.produceValor) {
    return analizarComandoOperador(estado, token, entrada);
  }

  // Inalcanzable si el llamador comprobó `puedeEmpezarExpresion`.
  return reportarExpresionIncompleta(estado, estado.tokens[estado.indice - 1] ?? token);
}

/** `SUMA a b`, `AZAR n`…: aridad exacta del vocabulario; cada argumento es la expresión más larga posible. */
function analizarComandoOperador(estado: Estado, token: Token, entrada: EntradaVocabulario): Expresion | null {
  if (entrada.mundo > estado.mundo) {
    reportar(estado, crearError('comandoBloqueado', { nombre: entrada.nombre, mundo: entrada.mundo }, posicion(token)));
    estado.indice += 1;
    return null;
  }
  estado.indice += 1;
  const argumentos: Expresion[] = [];
  const cantidad = typeof entrada.aridad === 'number' ? entrada.aridad : 0;
  for (let i = 0; i < cantidad; i++) {
    const siguiente = actual(estado);
    const enLugar = i === 0 || (siguiente !== undefined && siguiente.linea === lineaDelUltimoToken(estado));
    if (!enLugar || !puedeEmpezarExpresion(siguiente)) {
      reportarArgumentoInvalido(estado, entrada.nombre, enLugar ? siguiente : undefined, posicion(token));
      return null;
    }
    const argumento = analizarExpresion(estado);
    if (argumento === null) return null;
    argumentos.push(argumento);
  }
  return registrarAltura(
    estado,
    { tipo: 'comandoOperador', nombre: entrada.nombre, argumentos, linea: token.linea, columna: token.columna },
    Math.max(0, ...argumentos.map((a) => alturaDe(estado, a))) + 1,
  );
}

/**
 * Analiza el argumento de un comando de color (`PONCOLOR` y `RELLENA`, R4.2, R4.6),
 * que admite tres formas (se muestran con PONCOLOR; RELLENA es igual):
 *   - palabra con comilla inicial: `PONCOLOR "naranja`  → token 'palabra';
 *   - palabra desnuda: `PONCOLOR naranja`               → token 'identificador';
 *   - terna RGB en lista: `PONCOLOR [255 0 0]`          → `[` numero* `]`.
 * Construye la invocación llevando el argumento SIN RESOLVER en `argumentoColor`
 * (palabra o lista de números). El intérprete valida el nombre contra el catálogo
 * y el rango 0..255 de la terna, y reporta `colorInvalido`: un nombre fuera del
 * catálogo o una terna mal formada NO son errores de parseo (R4.3).
 */
function analizarComandoColor(
  estado: Estado,
  entrada: EntradaVocabulario,
  lineaComando: number,
  columnaComando: number,
): Instruccion | null {
  const siguiente = actual(estado);

  // Falta el argumento: fin de tokens o el siguiente es otro comando.
  if (siguiente === undefined || siguiente.tipo === 'comando') {
    reportar(
      estado,
      crearError('argumentoFaltante', { comando: entrada.nombre }, { linea: lineaComando, columna: columnaComando }),
    );
    return null;
  }

  // Forma 1 y 2: una palabra (con comilla) o un identificador (desnudo). En ambos
  // casos el lexer ya normalizó el `valor` (acentos y mayúsculas); el intérprete
  // lo resuelve. No se valida aquí si el nombre existe en el catálogo.
  if (siguiente.tipo === 'palabra' || siguiente.tipo === 'identificador') {
    estado.indice += 1;
    const argumentoColor: ArgumentoColor = { clase: 'palabra', valor: siguiente.valor };
    return crearInvocacionColor(entrada, argumentoColor, lineaComando, columnaComando);
  }

  // Forma 3: terna RGB `[ numero numero numero ]`. Se recogen los números que
  // aparezcan hasta el corchete de cierre; el intérprete exige que sean tres y
  // que cada uno sea un entero 0..255. Un token no numérico dentro de la lista
  // sí es un error de parseo (tipo equivocado), porque el argumento no es una
  // terna de números.
  if (siguiente.tipo === 'corchete_abre') {
    estado.indice += 1;   // consumir '['
    const valores: number[] = [];
    while (!finalizado(estado)) {
      const t = actual(estado)!;
      if (t.tipo === 'corchete_cierra') {
        estado.indice += 1;   // consumir ']'
        const argumentoColor: ArgumentoColor = { clase: 'listaRGB', valores };
        return crearInvocacionColor(entrada, argumentoColor, lineaComando, columnaComando);
      }
      if (t.tipo === 'numero') {
        valores.push(t.valor);
        estado.indice += 1;
        continue;
      }
      // Cualquier otra cosa dentro de la terna es un tipo equivocado. No se
      // consume el token: la sincronización retoma en el siguiente comando.
      reportar(
        estado,
        crearError(
          'argumentoDeTipoEquivocado',
          { comando: entrada.nombre, recibido: t.textoOriginal, parte: 'terna' },
          posicion(t),
        ),
      );
      return null;
    }
    // Fin de tokens sin cerrar la terna: se trata como argumento faltante bien
    // formado, apuntando al comando.
    reportar(
      estado,
      crearError('argumentoFaltante', { comando: entrada.nombre, parte: 'terna' }, { linea: lineaComando, columna: columnaComando }),
    );
    return null;
  }

  // Otro tipo de token (número suelto, corchete de cierre, parámetro): tipo
  // equivocado para el argumento de color.
  reportar(
    estado,
    crearError(
      'argumentoDeTipoEquivocado',
      { comando: entrada.nombre, recibido: siguiente.textoOriginal },
      posicion(siguiente),
    ),
  );
  return null;
}

/** Construye la invocación de un comando de color con su argumento sin resolver. */
function crearInvocacionColor(
  entrada: EntradaVocabulario,
  argumentoColor: ArgumentoColor,
  lineaComando: number,
  columnaComando: number,
): InvocacionComando {
  return {
    tipo: 'invocacionComando',
    nombre: entrada.nombre,
    argumentos: [],
    argumentoColor,
    linea: lineaComando,
    columna: columnaComando,
  };
}

// ============================================================================
// REPITE y lista de instrucciones
// ============================================================================

/**
 * Analiza un nodo `Repeticion` tras haber consumido el token de comando REPITE/RP.
 * Espera: numero `[` instrucciones `]`
 */
function analizarRepite(
  estado: Estado,
  _entrada: EntradaVocabulario,
  lineaComando: number,
  columnaComando: number,
): Instruccion | null {
  // 1. Número de repeticiones
  const tokenNumero = actual(estado);
  if (!puedeEmpezarExpresion(tokenNumero)) {
    reportar(
      estado,
      crearError(
        'argumentoFaltante',
        { comando: 'REPITE' },
        { linea: lineaComando, columna: columnaComando },
      ),
    );
    return null;
  }
  const veces = analizarExpresion(estado);
  if (veces === null) return null;
  const lineaVeces = tokenNumero!.linea;
  const columnaVeces = tokenNumero!.columna;

  // 2. Corchete de apertura
  const tokenAbre = actual(estado);
  if (tokenAbre === undefined || tokenAbre.tipo !== 'corchete_abre') {
    const pos = tokenAbre !== undefined ? posicion(tokenAbre) : { linea: lineaVeces, columna: columnaVeces };
    reportar(
      estado,
      crearError('argumentoFaltante', { comando: 'REPITE' }, pos),
    );
    return null;
  }
  const lineaApertura = tokenAbre.linea;
  estado.indice += 1;

  // Empujar la línea de apertura en la pila
  estado.pilaCorchetes.push(lineaApertura);

  // 3. Lista de instrucciones
  const cuerpo = analizarListaInstrucciones(estado);

  // Si hay errores acumulados durante la lista, devolvemos null más adelante;
  // pero primero intentamos construir el nodo si la lista terminó bien.

  // 4. Corchete de cierre (si no fue consumido por analizarListaInstrucciones al encontrar EOF)
  const tokenCierra = actual(estado);
  if (tokenCierra !== undefined && tokenCierra.tipo === 'corchete_cierra') {
    estado.indice += 1;
    estado.pilaCorchetes.pop();
  }
  // Si cuerpo es null significa que analizarListaInstrucciones reportó EOF sin cierre
  if (cuerpo === null) {
    return null;
  }

  const nodo: Repeticion = {
    tipo: 'repeticion',
    veces,
    cuerpo,
    linea: lineaComando,
    columna: columnaComando,
  };
  return nodo;
}

/**
 * Analiza instrucciones hasta encontrar `corchete_cierra` o fin de entrada.
 * Devuelve la lista de instrucciones, o `null` si llegó al final sin corchete de cierre
 * (en cuyo caso ya reportó el error correspondiente).
 */
function analizarListaInstrucciones(estado: Estado): readonly Instruccion[] | null {
  estado.anidamiento += 1;
  try {
    return analizarListaInstruccionesAbierta(estado);
  } finally {
    estado.anidamiento -= 1;
  }
}

/** Cuerpo de analizarListaInstrucciones, con el anidamiento ya contado. */
function analizarListaInstruccionesAbierta(estado: Estado): readonly Instruccion[] | null {
  const instrucciones: Instruccion[] = [];

  while (!finalizado(estado)) {
    const token = actual(estado)!;

    // Fin de la lista
    if (token.tipo === 'corchete_cierra') {
      return instrucciones;
    }

    const antes = estado.indice;
    const instruccion = analizarInstruccion(estado);
    if (instruccion !== null) {
      instrucciones.push(instruccion);
    } else {
      // Error: recuperar hasta el siguiente comando o corchete de cierre
      sincronizarEnLista(estado);
    }
    // Salvaguarda contra bucles infinitos
    if (estado.indice === antes) {
      estado.indice += 1;
    }
  }

  // EOF sin encontrar corchete de cierre: reportar error con la línea de apertura
  const lineaApertura =
    estado.pilaCorchetes.length > 0
      ? estado.pilaCorchetes[estado.pilaCorchetes.length - 1]!
      : 1;
  reportar(
    estado,
    crearError('corcheteSinCerrarEnLinea', { linea: lineaApertura }, { linea: lineaApertura }),
  );
  return null;
}

// ============================================================================
// Procedimientos: PARA … FIN
// ============================================================================

// El parser trabaja en dos pasadas y ambas tienen que coincidir sobre qué nombres
// son procedimientos invocables. Para que no se separen, la regla de aceptación
// vive en un solo lugar: la primera pasada (`recolectarFirmas`) la aplica
// para construir el conjunto, y `analizarDefinicion` la replica reportando el error
// concreto de cada rechazo. Los tres motivos de rechazo son los mismos en ambas:
//   1. el nombre pisa un comando/abreviatura del lenguaje (paraNombreQueEsLenguaje);
//   2. el nombre ya se definió antes en el programa (procedimientoRedefinido);
//   3. el PARA llega al fin del texto sin su FIN (paraSinFin).
// En el caso 2, el nombre que queda en el conjunto es el de la PRIMERA definición.

/**
 * Primera pasada: recorre los tokens recogiendo los nombres de los `PARA … FIN`
 * bien formados. No reporta errores (eso lo hace la segunda pasada); solo decide
 * qué nombres tratará la segunda pasada como invocables, aplicando exactamente los
 * mismos criterios de aceptación/rechazo que `analizarDefinicion`, para que las dos
 * pasadas no discrepen.
 *
 * @param tokens Tokens producidos por el lexer
 * @returns Conjunto de nombres normalizados de procedimientos válidos
 */
function recolectarFirmas(tokens: readonly Token[], mundo: Mundo): Map<string, FirmaProcedimiento> {
  const firmas = new Map<string, FirmaProcedimiento>();
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    // Solo abre definición un comando PARA; cualquier otro token se ignora aquí.
    if (token.tipo !== 'comando' || token.valor !== 'PARA') {
      i += 1;
      continue;
    }

    // El nombre es el identificador inmediatamente posterior al PARA.
    const tokenNombre = tokens[i + 1];
    if (tokenNombre === undefined || tokenNombre.tipo !== 'identificador') {
      // PARA sin nombre: no registra nada. La segunda pasada reportará el error.
      i += 1;
      continue;
    }
    const nombre = tokenNombre.valor;

    // Los parámetros son los tokens `parametro` consecutivos tras el nombre.
    const parametros: string[] = [];
    const escritos: string[] = [];
    let hayRepetido = false;
    let j = i + 2;
    while (j < tokens.length && tokens[j]!.tipo === 'parametro') {
      const p = tokens[j]!;
      const normalizado = String(p.valor).toLowerCase();
      if (parametros.includes(normalizado)) {
        hayRepetido = true;
      } else {
        parametros.push(normalizado);
        escritos.push(p.textoOriginal);
      }
      j += 1;
    }

    // Buscar el FIN que cierra esta definición, saltando el cuerpo. Los PARA no se
    // anidan, así que basta con avanzar hasta el primer FIN de comando.
    let tieneFin = false;
    while (j < tokens.length) {
      const t = tokens[j]!;
      if (t.tipo === 'comando' && t.valor === 'FIN') {
        tieneFin = true;
        break;
      }
      j += 1;
    }

    if (tieneFin) {
      // Solo se registra si pasa los mismos filtros que la segunda pasada: no pisa
      // el lenguaje y no es un duplicado (se conserva la primera aparición).
      if (!buscarComando(nombre).hallada && !firmas.has(nombre)) {
        firmas.set(nombre, {
          nombre,
          parametros,
          escritos,
          linea: tokenNombre.linea,
          rechazada: hayRepetido || (parametros.length > 0 && mundo < 4),
        });
      }
      // Reanudar tras el FIN para no volver a ver su contenido.
      i = j + 1;
    } else {
      // PARA sin FIN hasta el final: no registra. Nada más que recorrer.
      i += 1;
    }
  }

  return firmas;
}

/**
 * Analiza `PARA NOMBRE <instrucciones> FIN` tras haber reconocido el comando PARA.
 * El cursor está sobre el token PARA. Produce `DefinicionProcedimiento` con
 * `parametros: []` (el mundo 2 no tiene parámetros; un `:param` se ignora sin error).
 * Replica los tres criterios de rechazo descritos arriba, reportando el error que
 * corresponde a cada uno y recuperándose por sincronización.
 */
function analizarDefinicion(estado: Estado, tokenPara: Token): Instruccion | null {
  const lineaPara = tokenPara.linea;
  const columnaPara = tokenPara.columna;
  estado.indice += 1;   // consumir PARA

  // 1. Nombre. Un nombre que pisa el lenguaje (p. ej. `PARA AVANZA`) llega como
  //    token 'comando', porque el lexer resuelve esa palabra contra el vocabulario
  //    antes que el parser; un nombre propio llega como 'identificador'. Ambos son
  //    nombres válidos de PARA en cuanto a forma: la colisión con el lenguaje se
  //    trata como rechazo más abajo, no como «falta el nombre».
  const tokenNombre = actual(estado);
  if (
    tokenNombre === undefined ||
    (tokenNombre.tipo !== 'identificador' && tokenNombre.tipo !== 'comando')
  ) {
    // PARA sin un nombre válido tras él: no hay procedimiento que nombrar. Error
    // propio (paraSinNombre); paraSinFin queda para un PARA con nombre sin su FIN.
    reportar(estado, crearError('paraSinNombre', {}, posicion(tokenPara)));
    return null;
  }
  const nombre = tokenNombre.valor;
  const lineaNombre = tokenNombre.linea;
  estado.indice += 1;   // consumir el nombre

  // Parámetros: los `:param` consecutivos de la cabecera, normalizados a minúsculas.
  // Antes del mundo 4 se avisa una sola vez (en el primero) y el procedimiento no se define.
  const primerParametro = actual(estado)?.tipo === 'parametro' ? actual(estado) : undefined;
  const parametros: string[] = [];
  let parametroRepetido: Token | undefined;
  while (actual(estado)?.tipo === 'parametro') {
    const tokenParametro = actual(estado)!;
    const normalizado = String(tokenParametro.valor).toLowerCase();
    if (parametros.includes(normalizado)) {
      parametroRepetido ??= tokenParametro;
    } else {
      parametros.push(normalizado);
    }
    estado.indice += 1;
  }
  const parametrosBloqueados = primerParametro !== undefined && estado.mundo < 4;
  if (primerParametro !== undefined && parametrosBloqueados) {
    reportar(estado, crearError('paraConParametros', {}, posicion(primerParametro)));
  }

  // 2. Nombre que pisa el lenguaje: rechazar sin registrar. El token 'comando'
  //    ya implica colisión; el guard con buscarComando cubre además el caso de un
  //    identificador que, normalizado, coincida con un comando o abreviatura.
  const colisionLenguaje = tokenNombre.tipo === 'comando' || buscarComando(nombre).hallada;
  if (colisionLenguaje) {
    reportar(estado, crearError('paraNombreQueEsLenguaje', { nombre }, posicion(tokenNombre)));
    // Seguir consumiendo el cuerpo hasta FIN para recuperar limpio, pero sin
    // producir nodo.
  }

  // 3. Duplicado: si ya registramos antes una definición con este nombre en esta
  //    pasada, esta es la segunda. Se reporta en la línea de ESTA definición y no
  //    se produce nodo; la primera se conserva (R6.5). Usamos `estado.definidos`
  //    —no el conjunto de la primera pasada— porque ese conjunto tiene el nombre
  //    para la primera y la segunda aparición por igual, y no distingue cuál es.
  const esDuplicado = !colisionLenguaje && estado.definidos.has(nombre);
  if (esDuplicado) {
    reportar(estado, crearError('procedimientoRedefinido', { nombre, linea: lineaNombre }, posicion(tokenNombre)));
  }

  if (!colisionLenguaje && !esDuplicado) {
    estado.definidos.add(nombre);
  }

  // Parámetro repetido: la firma queda conocida (rechazada) pero no se emite nodo.
  const rechazadoPorParametros = !colisionLenguaje && !esDuplicado && parametroRepetido !== undefined;
  if (rechazadoPorParametros) {
    reportar(
      estado,
      crearError(
        'parametroDuplicado',
        { procedimiento: tokenNombre.textoOriginal, parametro: parametroRepetido!.textoOriginal },
        posicion(parametroRepetido!),
      ),
    );
  }

  const registrable = !colisionLenguaje && !esDuplicado && !rechazadoPorParametros && !parametrosBloqueados;

  // 4. Cuerpo: instrucciones hasta encontrar el comando FIN.
  if (colisionLenguaje) {
    descartarCuerpoDefinicion(estado);
  }
  const ambitoPrevio = estado.ambito;
  estado.ambito = new Set(parametros);
  let cuerpo: readonly Instruccion[];
  try {
    cuerpo = colisionLenguaje ? [] : analizarCuerpoDefinicion(estado);
  } finally {
    estado.ambito = ambitoPrevio;
  }

  // 5. ¿Terminó con FIN?
  const tokenFin = actual(estado);
  if (tokenFin !== undefined && tokenFin.tipo === 'comando' && tokenFin.valor === 'FIN') {
    estado.indice += 1;   // consumir FIN
  } else {
    // Fin de entrada sin FIN: reportar paraSinFin con la línea del PARA.
    reportar(estado, crearError('paraSinFin', { nombre, linea: lineaPara }, posicion(tokenPara)));
    return null;
  }

  // Si el nombre fue rechazado (pisa el lenguaje o duplicado), el cuerpo ya se
  // consumió para recuperar, pero no se produce nodo.
  if (!registrable) {
    return null;
  }

  const nodo: DefinicionProcedimiento = {
    tipo: 'definicionProcedimiento',
    nombre,
    parametros,
    cuerpo,
    linea: lineaPara,
    columna: columnaPara,
  };
  return nodo;
}

/** Consume el cuerpo de una definici\u00f3n rechazada hasta su FIN, sin analizarlo. */
function descartarCuerpoDefinicion(estado: Estado): void {
  let corchetes = 0;
  while (!finalizado(estado)) {
    const token = actual(estado)!;
    if (token.tipo === 'corchete_abre') corchetes += 1;
    if (token.tipo === 'corchete_cierra' && corchetes > 0) corchetes -= 1;
    if (token.tipo === 'comando' && token.valor === 'FIN' && corchetes === 0) return;
    estado.indice += 1;
  }
}

/**
 * Un PARA dentro de un REPITE o de otro PARA: reporta `paraAnidado` en el PARA y
 * descarta su definición completa (hasta su FIN, contando los PARA que contenga) para
 * no encadenar errores por su cuerpo. Se detiene sin consumir en un corchete de cierre,
 * de modo que un PARA anidado sin FIN no se coma el FIN de un PARA posterior. Su nombre
 * se registra como procedimiento conocido para que una llamada posterior no diga
 * «No sé cómo hacer…»: el error que importa ya está dicho.
 */
function reportarParaAnidado(estado: Estado, tokenPara: Token): null {
  reportar(estado, crearError('paraAnidado', {}, posicion(tokenPara)));
  estado.indice += 1;   // consumir PARA

  const tokenNombre = actual(estado);
  if (tokenNombre?.tipo === 'identificador' && !buscarComando(tokenNombre.valor).hallada) {
    estado.firmas.set(tokenNombre.valor, {
      nombre: tokenNombre.valor, parametros: [], escritos: [], linea: tokenNombre.linea, rechazada: true,
    });
  }

  let profundidad = 1;
  let corchetes = 0;
  while (!finalizado(estado) && profundidad > 0) {
    const t = actual(estado)!;
    if (t.tipo === 'corchete_abre') corchetes += 1;
    if (t.tipo === 'corchete_cierra') {
      if (corchetes === 0) break;
      corchetes -= 1;
    }
    if (t.tipo === 'comando' && t.valor === 'PARA') profundidad += 1;
    if (t.tipo === 'comando' && t.valor === 'FIN') profundidad -= 1;
    estado.indice += 1;
  }
  return null;
}
/**
 * Analiza el cuerpo de una definición: instrucciones hasta el comando FIN o el fin
 * de la entrada. Reutiliza `analizarInstruccion` y la misma recuperación por
 * sincronización que el programa principal; termina en el FIN de comando (que deja
 * sin consumir, para que `analizarDefinicion` decida) en vez de en un corchete.
 */
function analizarCuerpoDefinicion(estado: Estado): readonly Instruccion[] {
  estado.anidamiento += 1;
  try {
    return analizarCuerpoDefinicionAbierto(estado);
  } finally {
    estado.anidamiento -= 1;
  }
}

/** Cuerpo de analizarCuerpoDefinicion, con el anidamiento ya contado. */
function analizarCuerpoDefinicionAbierto(estado: Estado): readonly Instruccion[] {
  const instrucciones: Instruccion[] = [];

  while (!finalizado(estado)) {
    const token = actual(estado)!;

    // Fin del cuerpo: el FIN se deja sin consumir para analizarDefinicion.
    if (token.tipo === 'comando' && token.valor === 'FIN') {
      return instrucciones;
    }

    const antes = estado.indice;
    const instruccion = analizarInstruccion(estado);
    if (instruccion !== null) {
      instrucciones.push(instruccion);
    } else {
      // `sincronizar` se detiene en el siguiente comando, FIN incluido, así que la
      // próxima vuelta del bucle reconoce el FIN y cierra el cuerpo.
      sincronizar(estado);
    }
    if (estado.indice === antes) {
      estado.indice += 1;
    }
  }

  // Fin de entrada sin FIN: devolvemos lo acumulado; analizarDefinicion reporta
  // paraSinFin al no encontrar el FIN.
  return instrucciones;
}

// ============================================================================
// Recuperación por sincronización
// ============================================================================

/**
 * Descarta los tokens restantes de la instrucción actual y reanuda en el
 * siguiente token de tipo `comando`. Determinista: no depende de heurísticas
 * ni de cuántos errores se acumularon.
 */
function sincronizar(estado: Estado): void {
  while (!finalizado(estado)) {
    const token = actual(estado)!;
    if (esComandoDeAccion(token) || esOperadorBloqueado(estado, token)) {
      return;
    }
    estado.indice += 1;
  }
}

/**
 * Variante de sincronización dentro de una lista de instrucciones:
 * también se detiene en `corchete_cierra` para no consumir el cierre de la lista.
 */
function sincronizarEnLista(estado: Estado): void {
  while (!finalizado(estado)) {
    const token = actual(estado)!;
    if (esComandoDeAccion(token) || esOperadorBloqueado(estado, token) || token.tipo === 'corchete_cierra') {
      return;
    }
    estado.indice += 1;
  }
}

/**
 * Comando de operador de un mundo posterior. La sincronización se detiene también en él
 * para que cada ocurrencia reporte su `comandoBloqueado` (R5.6) y no se pierda dentro de
 * lo descartado tras el error anterior. Desde su mundo no detiene nada: ahí sigue siendo
 * parte de la expresión que se descarta.
 */
function esOperadorBloqueado(estado: Estado, token: Token): boolean {
  const entrada = entradaDe(token);
  return entrada !== null && entrada.produceValor && entrada.mundo > estado.mundo;
}

// ============================================================================
// Errores acumulados
// ============================================================================

/** Añade un error a la lista acumulada. */
function reportar(estado: Estado, error: ErrorKiroLogo): void {
  estado.errores.push(error);
}

/**
 * Ordena los errores por línea y luego por columna, y devuelve a lo sumo 20,
 * descartando los de línea mayor.
 */
function ordenarYAcotar(errores: readonly ErrorKiroLogo[]): readonly ErrorKiroLogo[] {
  const ordenados = [...errores].sort((a, b) => {
    const la = a.linea ?? 0;
    const lb = b.linea ?? 0;
    if (la !== lb) return la - lb;
    return (a.columna ?? 0) - (b.columna ?? 0);
  });
  return ordenados.slice(0, MAXIMO_ERRORES);
}

// ============================================================================
// Utilidades sobre el cursor
// ============================================================================

function actual(estado: Estado): Token | undefined {
  return estado.tokens[estado.indice];
}

function finalizado(estado: Estado): boolean {
  return estado.indice >= estado.tokens.length;
}

function posicion(token: Token): { readonly linea: number; readonly columna: number } {
  return { linea: token.linea, columna: token.columna };
}
