// Parser de KiroLogo: tokens → AST
// Descenso recursivo con recuperación por sincronización.
// Desde el mundo 2 es de DOS pasadas: una primera recoge los nombres de los
// procedimientos (PARA … FIN) y la segunda parsea tratando cada nombre recogido
// como invocable (ver `recolectarProcedimientos`).

import type { Token } from './lexer.js';
import type {
  Programa, Instruccion, InvocacionComando, NumeroLiteral, Expresion, Repeticion,
  DefinicionProcedimiento, InvocacionProcedimiento, ArgumentoColor,
} from './ast.js';
import { buscarComando, type Mundo, type EntradaVocabulario } from './vocabulario.js';
import { crearError, resolverPalabraNoEjecutable, type ErrorKiroLogo } from './errores.js';

// ============================================================================
// Tipos públicos
// ============================================================================

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
 */
export function nombresDeProcedimientos(tokens: readonly Token[]): readonly string[] {
  return [...recolectarProcedimientos(tokens)];
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
  readonly procedimientos: ReadonlySet<string>;  // nombres de PARA válidos (1ª pasada)
  readonly definidos: Set<string>;  // nombres ya definidos en ESTA 2ª pasada (para detectar redefinición)
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
  tokens: readonly Token[],
  opciones: OpcionesAnalisis,
): ResultadoSintactico {
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
    procedimientos: recolectarProcedimientos(tokens),
    definidos: new Set<string>(),
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

  const erroresFinales = ordenarYAcotar(estado.errores);

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
      reportar(estado, crearError('corcheteInesperado', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'corchete_cierra':
      reportar(estado, crearError('corcheteDeMasEnLinea', { linea: token.linea }, posicion(token)));
      estado.indice += 1;
      return null;
    case 'parametro':
      reportar(estado, crearError('parametroInesperado', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'palabra':
      reportar(estado, crearError('palabraInesperada', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'numero':
      reportar(estado, crearError('numeroInesperado', {}, posicion(token)));
      estado.indice += 1;
      return null;
    case 'identificador': {
      // Un identificador cuyo nombre normalizado está en la tabla de
      // procedimientos es una invocación, usable igual que un comando del
      // lenguaje (R1.4). Funciona con referencias adelantadas porque el conjunto
      // se construyó en la primera pasada (R1.5).
      if (estado.procedimientos.has(token.valor)) {
        const nodo: InvocacionProcedimiento = {
          tipo: 'invocacionProcedimiento',
          nombre: token.valor,
          argumentos: [],
          linea: token.linea,
          columna: token.columna,
        };
        estado.indice += 1;
        return nodo;
      }
      // Palabra que no es comando ni procedimiento: el catálogo elige el mensaje
      // (sugerencia, inglés, bloqueado cercano o mensaje seco). Pasamos los
      // nombres de procedimiento para que un parecido sugiera uno de ellos (R6.3).
      reportar(
        estado,
        resolverPalabraNoEjecutable(
          token.textoOriginal,
          estado.mundo,
          posicion(token),
          [...estado.procedimientos],
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

  // Consumir el comando.
  const lineaComando = token.linea;
  const columnaComando = token.columna;
  estado.indice += 1;

  // Comando con lista (REPITE): aridad especial.
  if (entrada.tiposArgumento.includes('lista')) {
    return analizarRepite(estado, entrada, lineaComando, columnaComando);
  }

  // PONCOLOR (mundo 2) toma un argumento de color: palabra o terna RGB, no un
  // literal numérico. Se analiza por su propia ruta y se transporta sin resolver.
  if (entrada.nombre === 'PONCOLOR') {
    return analizarComandoColor(estado, entrada, lineaComando, columnaComando);
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

  // Falta el argumento: fin de tokens o el siguiente es otro comando.
  if (siguiente === undefined || siguiente.tipo === 'comando') {
    reportar(
      estado,
      crearError('argumentoFaltante', { comando: entrada.nombre }, { linea: lineaComando, columna: columnaComando }),
    );
    return null;
  }

  // El argumento debe ser un número.
  if (siguiente.tipo !== 'numero') {
    reportar(
      estado,
      crearError(
        'argumentoDeTipoEquivocado',
        { comando: entrada.nombre, recibido: siguiente.textoOriginal },
        posicion(siguiente),
      ),
    );
    // No consumir el token equivocado; la sincronización descartará el resto
    // de la instrucción y reanudará en el siguiente comando.
    return null;
  }

  // Consumir el número.
  const argumento: NumeroLiteral = {
    tipo: 'numeroLiteral',
    valor: siguiente.valor as number,
    linea: siguiente.linea,
    columna: siguiente.columna,
  };
  estado.indice += 1;

  const nodo: InvocacionComando = {
    tipo: 'invocacionComando',
    nombre: entrada.nombre,
    argumentos: [argumento as Expresion],
    linea: lineaComando,
    columna: columnaComando,
  };
  return nodo;
}

/**
 * Analiza el argumento de `PONCOLOR`, que admite tres formas (R4.2):
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
          { comando: entrada.nombre, recibido: t.textoOriginal },
          posicion(t),
        ),
      );
      return null;
    }
    // Fin de tokens sin cerrar la terna: se trata como argumento faltante bien
    // formado, apuntando al comando.
    reportar(
      estado,
      crearError('argumentoFaltante', { comando: entrada.nombre }, { linea: lineaComando, columna: columnaComando }),
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

/** Construye la invocación de PONCOLOR con su argumento de color sin resolver. */
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
  if (tokenNumero === undefined || tokenNumero.tipo !== 'numero') {
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
  const veces = tokenNumero.valor as number;
  const lineaVeces = tokenNumero.linea;
  const columnaVeces = tokenNumero.columna;
  estado.indice += 1;

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
    veces: { tipo: 'numeroLiteral', valor: veces, linea: lineaVeces, columna: columnaVeces },
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
// vive en un solo lugar: la primera pasada (`recolectarProcedimientos`) la aplica
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
function recolectarProcedimientos(tokens: readonly Token[]): ReadonlySet<string> {
  const nombres = new Set<string>();
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

    // Buscar el FIN que cierra esta definición, saltando el cuerpo. El mundo 2 no
    // anida PARA, así que basta con avanzar hasta el primer FIN de comando.
    let j = i + 2;
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
      if (!buscarComando(nombre).hallada && !nombres.has(nombre)) {
        nombres.add(nombre);
      }
      // Reanudar tras el FIN para no volver a ver su contenido.
      i = j + 1;
    } else {
      // PARA sin FIN hasta el final: no registra. Nada más que recorrer.
      i += 1;
    }
  }

  return nombres;
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
    // PARA sin un nombre válido tras él: no hay procedimiento que nombrar, así que
    // no puede terminar bien. Se reporta como paraSinFin con la línea del PARA.
    reportar(estado, crearError('paraSinFin', { nombre: 'PARA', linea: lineaPara }, posicion(tokenPara)));
    return null;
  }
  const nombre = tokenNombre.valor;
  const lineaNombre = tokenNombre.linea;
  estado.indice += 1;   // consumir el nombre

  // Un `:param` entre el nombre y el cuerpo se ignora (el mundo 2 no tiene
  // parámetros; llegan en el mundo 4). No es error.
  while (actual(estado)?.tipo === 'parametro') {
    estado.indice += 1;
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

  const registrable = !colisionLenguaje && !esDuplicado;
  if (registrable) {
    estado.definidos.add(nombre);
  }

  // 4. Cuerpo: instrucciones hasta encontrar el comando FIN.
  const cuerpo = analizarCuerpoDefinicion(estado);

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
    parametros: [],
    cuerpo,
    linea: lineaPara,
    columna: columnaPara,
  };
  return nodo;
}

/**
 * Analiza el cuerpo de una definición: instrucciones hasta el comando FIN o el fin
 * de la entrada. Reutiliza `analizarInstruccion` y la misma recuperación por
 * sincronización que el programa principal; termina en el FIN de comando (que deja
 * sin consumir, para que `analizarDefinicion` decida) en vez de en un corchete.
 */
function analizarCuerpoDefinicion(estado: Estado): readonly Instruccion[] {
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
    if (token.tipo === 'comando') {
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
    if (token.tipo === 'comando' || token.tipo === 'corchete_cierra') {
      return;
    }
    estado.indice += 1;
  }
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
