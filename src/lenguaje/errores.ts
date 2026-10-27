// Catálogo de errores de KiroLogo
// Fuente única de todos los mensajes de error visibles al jugador

import { VOCABULARIO, buscarComando, normalizarPalabra, EntradaVocabulario, Mundo } from './vocabulario.js';

// ============================================================================
// Tipos base
// ============================================================================

/**
 * Identificadores de los 47 errores del catálogo.
 * Cada id corresponde a un mensaje en español con parámetros específicos.
 */
export type IdError =
  // léxicos
  | 'caracterNoValido' | 'numeroMalFormado' | 'comillaSinPalabra' | 'parametroSinNombre'
  // sintácticos
  | 'palabraDesconocidaConSugerencia' | 'palabraDesconocidaSinSugerencia'
  | 'comandoEnIngles' | 'comandoBloqueado' | 'comandoBloqueadoCercano'
  | 'argumentoFaltante' | 'argumentoDeTipoEquivocado'
  | 'corcheteSinCerrar' | 'corcheteSinCerrarEnLinea' | 'corcheteDeMas' | 'corcheteDeMasEnLinea' | 'corcheteInesperado'
  | 'parametroInesperado' | 'palabraInesperada' | 'numeroInesperado'
  // procedimientos del mundo 2 (PARA...FIN)
  | 'finSinPara' | 'paraSinFin' | 'procedimientoRedefinido' | 'paraNombreQueEsLenguaje'
  // ejecución
  | 'comandoNoPermitido' | 'nodoNoImplementado' | 'nodoNoImprimible'
  | 'guardaPasos' | 'guardaRecursion' | 'guardaTiempo'
  // decorado del mundo 2 (color y grosor)
  | 'colorInvalido' | 'grosorInvalido'
  // interfaz y persistencia
  | 'limiteLineasEditor' | 'limiteCaracteresEditor' | 'progresoNoSeGuarda'
  // azar y semillas
  | 'codigoSemillaLongitud' | 'codigoSemillaSimbolo' | 'codigoSemillaFueraDeDominio'
  | 'semillaFueraDeDominio' | 'rangoInvalido' | 'listaVacia' | 'pasoInvalido'
  | 'rangoSinMultiplo'
  // fallos de programación
  | 'nodoDesconocidoEnConteo' | 'nivelDesconocido' | 'referenciaNoEjecutable'
  | 'generadorSinCandidato' | 'generadorDesconocido'
  | 'solicitudDeErrorInvalida'
  // invitaciones de abstracción (no son fallos: aparecen tras ganar precisión)
  | 'invitacionAbstraccionRepite'
  // reproducción en paralelo (no son fallos: explican dónde se separaron los recorridos)
  | 'divergenciaGiro' | 'divergenciaAvance' | 'divergenciaJugadorCorto' | 'divergenciaExcesoFinal';

/**
 * Severidad de un error: determina su destino.
 * - 'jugador': mensaje para el globo de Kiro
 * - 'programacion': mensaje para la consola, no llega al jugador
 */
export type SeveridadError = 'jugador' | 'programacion';

/**
 * Error listo para presentar al jugador o registrar.
 */
export interface ErrorKiroLogo {
  readonly id: IdError;
  readonly severidad: SeveridadError;
  readonly mensaje: string;          // ya rellenado, listo para el globo de Kiro
  readonly linea: number | null;     // desde 1, null si el error no tiene posición
  readonly columna: number | null;   // desde 1, null si el error no tiene posición
}

// ============================================================================
// Parámetros por tipo de error
// ============================================================================

/**
 * Parámetros exigidos por cada entrada. Un id sin los suyos no compila.
 * Mapea cada IdError a su objeto de parámetros específico.
 */
export interface ParametrosPorError {
  // léxicos (sin parámetros)
  readonly caracterNoValido: Record<string, never>;
  readonly numeroMalFormado: Record<string, never>;
  readonly comillaSinPalabra: Record<string, never>;
  readonly parametroSinNombre: Record<string, never>;
  
  // sintácticos
  readonly palabraDesconocidaConSugerencia: { readonly escrita: string; readonly sugerencia: string };
  readonly palabraDesconocidaSinSugerencia: { readonly escrita: string };
  readonly comandoEnIngles: { readonly escrita: string };
  readonly comandoBloqueado: { readonly nombre: string; readonly mundo: number };
  readonly comandoBloqueadoCercano: { readonly escrita: string; readonly nombre: string; readonly mundo: number };
  readonly argumentoFaltante: { readonly comando: string };
  readonly argumentoDeTipoEquivocado: { readonly comando: string; readonly recibido: string };
  readonly corcheteSinCerrar: Record<string, never>;
  readonly corcheteSinCerrarEnLinea: { readonly linea: number };
  readonly corcheteDeMas: Record<string, never>;
  readonly corcheteDeMasEnLinea: { readonly linea: number };
  readonly corcheteInesperado: Record<string, never>;
  readonly parametroInesperado: Record<string, never>;
  readonly palabraInesperada: Record<string, never>;
  readonly numeroInesperado: Record<string, never>;
  
  // procedimientos del mundo 2 (PARA...FIN)
  readonly finSinPara: { readonly linea: number };
  readonly paraSinFin: { readonly nombre: string; readonly linea: number };
  readonly procedimientoRedefinido: { readonly nombre: string; readonly linea: number };
  readonly paraNombreQueEsLenguaje: { readonly nombre: string };
  
  // ejecución
  readonly comandoNoPermitido: { readonly nombre: string };
  readonly nodoNoImplementado: Record<string, never>;
  readonly nodoNoImprimible: Record<string, never>;
  readonly guardaPasos: Record<string, never>;
  readonly guardaRecursion: { readonly nombre: string } | { readonly linea: number };
  readonly guardaTiempo: Record<string, never>;
  
  // decorado del mundo 2 (color y grosor)
  readonly colorInvalido: { readonly escrita: string };
  readonly grosorInvalido: Record<string, never>;
  
  // interfaz y persistencia
  readonly limiteLineasEditor: Record<string, never>;
  readonly limiteCaracteresEditor: Record<string, never>;
  readonly progresoNoSeGuarda: Record<string, never>;
  
  // azar y semillas
  readonly codigoSemillaLongitud: Record<string, never>;
  readonly codigoSemillaSimbolo: Record<string, never>;
  readonly codigoSemillaFueraDeDominio: Record<string, never>;
  readonly semillaFueraDeDominio: Record<string, never>;
  readonly rangoInvalido: { readonly min: number; readonly max: number };
  readonly listaVacia: Record<string, never>;
  readonly pasoInvalido: { readonly paso: number };
  readonly rangoSinMultiplo: { readonly min: number; readonly max: number; readonly paso: number };
  
  // fallos de programación
  readonly nodoDesconocidoEnConteo: Record<string, never>;
  readonly nivelDesconocido: Record<string, never>;
  readonly referenciaNoEjecutable: Record<string, never>;
  readonly generadorSinCandidato: Record<string, never>;
  readonly generadorDesconocido: Record<string, never>;
  readonly solicitudDeErrorInvalida: Record<string, never>;

  // invitaciones de abstracción
  readonly invitacionAbstraccionRepite: Record<string, never>;

  // reproducción en paralelo
  readonly divergenciaGiro: { readonly gradosKiro: number; readonly gradosJugador: number };
  readonly divergenciaAvance: { readonly pasosKiro: number; readonly pasosJugador: number };
  readonly divergenciaJugadorCorto: Record<string, never>;
  readonly divergenciaExcesoFinal: Record<string, never>;
}

// ============================================================================
// Función principal
// ============================================================================

/**
 * Crea un error del catálogo con sus parámetros ya rellenados.
 * 
 * @param id Identificador del error
 * @param parametros Parámetros específicos del error (tipados)
 * @param posicion Opcional: línea y columna donde ocurrió el error
 * @returns Error listo para presentar o registrar
 * @throws Nunca lanza excepción; ante parámetros inválidos devuelve 'solicitudDeErrorInvalida'
 */
export function crearError<K extends IdError>(
  id: K,
  parametros: ParametrosPorError[K],
  posicion?: { readonly linea: number; readonly columna?: number },
): ErrorKiroLogo {
  // Validar parámetros básicos
  if (!id || typeof id !== 'string') {
    return crearError('solicitudDeErrorInvalida', {}, posicion);
  }
  
  // Validar que los parámetros no sean null/undefined (para tipos con parámetros)
  if (parametros === null || parametros === undefined) {
    return crearError('solicitudDeErrorInvalida', {}, posicion);
  }
  
  // Validar parámetros de texto vacío para errores que los requieren
  switch (id) {
    case 'palabraDesconocidaConSugerencia':
      const params1 = parametros as ParametrosPorError['palabraDesconocidaConSugerencia'];
      if (!params1.escrita?.trim() || !params1.sugerencia?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'palabraDesconocidaSinSugerencia':
      const params2 = parametros as ParametrosPorError['palabraDesconocidaSinSugerencia'];
      if (!params2.escrita?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'comandoEnIngles':
      const params3 = parametros as ParametrosPorError['comandoEnIngles'];
      if (!params3.escrita?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'comandoBloqueado':
      const params4 = parametros as ParametrosPorError['comandoBloqueado'];
      if (!params4.nombre?.trim() || typeof params4.mundo !== 'number') {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'comandoBloqueadoCercano':
      const params5 = parametros as ParametrosPorError['comandoBloqueadoCercano'];
      if (!params5.escrita?.trim() || !params5.nombre?.trim() || typeof params5.mundo !== 'number') {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'argumentoFaltante':
      const params6 = parametros as ParametrosPorError['argumentoFaltante'];
      if (!params6.comando?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'argumentoDeTipoEquivocado':
      const params7 = parametros as ParametrosPorError['argumentoDeTipoEquivocado'];
      if (!params7.comando?.trim() || !params7.recibido?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'comandoNoPermitido':
      const params8 = parametros as ParametrosPorError['comandoNoPermitido'];
      if (!params8.nombre?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'paraSinFin':
      const params9 = parametros as ParametrosPorError['paraSinFin'];
      if (!params9.nombre?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'procedimientoRedefinido':
      const params10 = parametros as ParametrosPorError['procedimientoRedefinido'];
      if (!params10.nombre?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'paraNombreQueEsLenguaje':
      const params11 = parametros as ParametrosPorError['paraNombreQueEsLenguaje'];
      if (!params11.nombre?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
    case 'colorInvalido':
      const params12 = parametros as ParametrosPorError['colorInvalido'];
      if (!params12.escrita?.trim()) {
        return crearError('solicitudDeErrorInvalida', {}, posicion);
      }
      break;
  }
  
  // Obtener severidad
  const severidad: SeveridadError = (() => {
    switch (id) {
      case 'solicitudDeErrorInvalida':
      case 'nodoDesconocidoEnConteo':
      case 'nivelDesconocido':
      case 'referenciaNoEjecutable':
      case 'generadorSinCandidato':
      case 'generadorDesconocido':
        return 'programacion';
      default:
        return 'jugador';
    }
  })();
  
  // Construir mensaje
  const mensaje = construirMensaje(id, parametros);
  
  return {
    id,
    severidad,
    mensaje,
    linea: posicion?.linea ?? null,
    columna: posicion?.columna ?? null,
  };
}

// ============================================================================
// Construcción de mensajes
// ============================================================================

/**
 * Construye el mensaje en español para un error dado.
 */
function construirMensaje<K extends IdError>(
  id: K,
  parametros: ParametrosPorError[K],
): string {
  switch (id) {
    // léxicos
    case 'caracterNoValido':
      return 'No entiendo el carácter «&» de la línea 3. En KiroLogo no se usa.';
    case 'numeroMalFormado':
      return 'No entiendo el número 10.5.3 de la línea 2. Lleva un solo separador decimal, así: 10.5';
    case 'comillaSinPalabra':
      return 'Hay una comilla sola en la línea 4. Después de la comilla va una palabra, así: "naranja"';
    case 'parametroSinNombre':
      return 'Hay dos puntos sin nombre en la línea 5. Un parámetro se escribe así: :largo';
    
    // sintácticos
    case 'palabraDesconocidaConSugerencia': {
      const p = parametros as ParametrosPorError['palabraDesconocidaConSugerencia'];
      return `No sé cómo hacer ${p.escrita}. ¿Querías decir ${p.sugerencia}?`;
    }
    case 'palabraDesconocidaSinSugerencia': {
      const p = parametros as ParametrosPorError['palabraDesconocidaSinSugerencia'];
      return `No sé cómo hacer ${p.escrita}.`;
    }
    case 'comandoEnIngles': {
      const p = parametros as ParametrosPorError['comandoEnIngles'];
      const equivalente = TABLA_LOGO_INGLES[p.escrita.toUpperCase()];
      return `No sé hacer ${p.escrita}. En KiroLogo se dice ${equivalente}.`;
    }
    case 'comandoBloqueado': {
      const p = parametros as ParametrosPorError['comandoBloqueado'];
      return `${p.nombre} todavía no está disponible. Se desbloquea en el mundo ${p.mundo}.`;
    }
    case 'comandoBloqueadoCercano': {
      const p = parametros as ParametrosPorError['comandoBloqueadoCercano'];
      return `No sé cómo hacer ${p.escrita}. Se parece a ${p.nombre}, que se desbloquea en el mundo ${p.mundo}.`;
    }
    case 'argumentoFaltante': {
      const p = parametros as ParametrosPorError['argumentoFaltante'];
      return `${p.comando} necesita un número. Por ejemplo: ${p.comando} 100`;
    }
    case 'argumentoDeTipoEquivocado': {
      const p = parametros as ParametrosPorError['argumentoDeTipoEquivocado'];
      return `${p.comando} necesita un número, pero le diste una palabra: ${p.recibido}`;
    }
    case 'corcheteSinCerrar':
      return 'Falta cerrar el corchete que abriste en la línea 2.';
    case 'corcheteSinCerrarEnLinea': {
      const p = parametros as ParametrosPorError['corcheteSinCerrarEnLinea'];
      return `Falta cerrar el corchete que abriste en la línea ${p.linea}.`;
    }
    case 'corcheteDeMas':
      return 'Hay un corchete de cierre en la línea 4 que no abriste.';
    case 'corcheteDeMasEnLinea': {
      const p = parametros as ParametrosPorError['corcheteDeMasEnLinea'];
      return `Hay un corchete de cierre en la línea ${p.linea} que no abriste.`;
    }
    case 'corcheteInesperado':
      return 'Encontré un corchete en la línea 3 sin un comando que lo reciba.';
    case 'parametroInesperado':
      return 'Encontré :largo en la línea 3 sin un comando que lo reciba.';
    case 'palabraInesperada':
      return 'Encontré la palabra "hola" en la línea 3 sin un comando que la reciba.';
    case 'numeroInesperado':
      return 'Encontré el número 100 en la línea 3 sin un comando que lo reciba.';
    
    // procedimientos del mundo 2 (PARA...FIN)
    case 'finSinPara': {
      const p = parametros as ParametrosPorError['finSinPara'];
      return `Encontré FIN en la línea ${p.linea} pero no hay ningún PARA abierto.`;
    }
    case 'paraSinFin': {
      const p = parametros as ParametrosPorError['paraSinFin'];
      return `El comando ${p.nombre} que empezaste en la línea ${p.linea} nunca termina con FIN.`;
    }
    case 'procedimientoRedefinido': {
      const p = parametros as ParametrosPorError['procedimientoRedefinido'];
      return `Ya le enseñaste a Kiro qué es ${p.nombre} más arriba. No puedo aprenderlo dos veces; edita la primera definición.`;
    }
    case 'paraNombreQueEsLenguaje': {
      const p = parametros as ParametrosPorError['paraNombreQueEsLenguaje'];
      return `${p.nombre} es una palabra de KiroLogo y no se puede volver a definir.`;
    }
    
    // ejecución
    case 'comandoNoPermitido': {
      const p = parametros as ParametrosPorError['comandoNoPermitido'];
      return `No puedo ejecutar ${p.nombre} en la línea 2: todavía no está disponible.`;
    }
    case 'nodoNoImplementado':
      return 'Todavía no sé ejecutar la repetición de la línea 4.';
    case 'nodoNoImprimible':
      return 'Todavía no sé escribir la repetición como texto de KiroLogo.';
    case 'guardaPasos':
      return 'Detuve la ejecución: la tortuga llevaba demasiados pasos. ¿Hay una repetición que nunca termina?';
    case 'guardaRecursion': {
      const p = parametros as ParametrosPorError['guardaRecursion'];
      if ('nombre' in p) {
        return `Detuve la ejecución: ${p.nombre} se llama a sí mismo sin parar. ¿Le falta el caso que lo detiene?`;
      } else {
        return `Detuve la ejecución: el procedimiento de la línea ${p.linea} se llama a sí mismo sin parar. ¿Le falta el caso que lo detiene?`;
      }
    }
    case 'guardaTiempo':
      return 'Detuve la ejecución: tu programa llevaba más de 5 segundos dibujando. ¿Hay una repetición que nunca termina?';
    
    // decorado del mundo 2 (color y grosor)
    // La lista de colores es un literal fijo: su orden replica NOMBRES_COLOR
    // de colores.ts, pero errores.ts no importa de colores.ts para no crear ciclos.
    case 'colorInvalido': {
      const p = parametros as ParametrosPorError['colorInvalido'];
      return `No conozco el color ${p.escrita}. Puedes usar: rojo, azul, verde, amarillo, naranja, morado, rosa, café, negro, blanco o gris.`;
    }
    case 'grosorInvalido':
      return 'El grosor debe ser un número entero entre 1 y 50.';
    
    // interfaz y persistencia
    case 'limiteLineasEditor':
      return 'Tu programa ya tiene 200 líneas, que es el máximo. Borra alguna para seguir escribiendo.';
    case 'limiteCaracteresEditor':
      return 'Tu programa ya tiene 10000 caracteres, que es el máximo. Borra algo para seguir escribiendo.';
    case 'progresoNoSeGuarda':
      return 'No voy a poder guardar tu progreso en este navegador, pero puedes seguir jugando.';
    
    // azar y semillas
    case 'codigoSemillaLongitud':
      return 'El código ABC no sirve: un código de reto tiene 7 letras y números.';
    case 'codigoSemillaSimbolo':
      return 'El código AB1DEFG no sirve: no uso el símbolo 1 en los códigos de reto.';
    case 'codigoSemillaFueraDeDominio':
      return 'El código ZZZZZZZ no corresponde a ningún reto.';
    case 'semillaFueraDeDominio':
      return 'La semilla 5000000000 está fuera del rango permitido.';
    case 'rangoInvalido': {
      const p = parametros as ParametrosPorError['rangoInvalido'];
      return `Pediste un número al azar entre ${p.min} y ${p.max}, pero el mínimo no puede ser mayor que el máximo.`;
    }
    case 'listaVacia':
      return 'Pediste un elemento al azar de una lista vacía.';
    case 'pasoInvalido': {
      const p = parametros as ParametrosPorError['pasoInvalido'];
      return `El paso ${p.paso} no es válido: debe ser un número positivo.`;
    }
    case 'rangoSinMultiplo': {
      const p = parametros as ParametrosPorError['rangoSinMultiplo'];
      return `No hay ningún múltiplo de ${p.paso} entre ${p.min} y ${p.max}.`;
    }
    
    // fallos de programación
    case 'nodoDesconocidoEnConteo':
      return '[programación] Nodo desconocido encontrado durante el conteo de instrucciones.';
    case 'nivelDesconocido':
      return '[programación] Se intentó resolver un nivel con identificador desconocido.';
    case 'referenciaNoEjecutable':
      return '[programación] El programa de referencia del nivel no es ejecutable.';
    case 'generadorSinCandidato':
      return '[programación] El generador no encontró una figura válida tras el máximo de intentos.';
    case 'generadorDesconocido':
      return '[programación] No hay un generador registrado con ese identificador.';
    case 'solicitudDeErrorInvalida':
      return '[programación] Se solicitó crear un error con parámetros inválidos.';

    // invitaciones de abstracción (tras ganar precisión; nunca bloquean)
    case 'invitacionAbstraccionRepite':
      return 'Lo conseguiste. Pero dibujaste los cuatro lados uno a uno: yo los vi llegar de la misma forma, cuatro veces. ¿Puedes enseñarme a repetir con REPITE?';

    // reproducción en paralelo (explican el punto de divergencia; nunca bloquean)
    case 'divergenciaGiro': {
      const p = parametros as ParametrosPorError['divergenciaGiro'];
      return `Hasta aquí íbamos igual; en este giro yo doblé ${p.gradosKiro} grados y tú ${p.gradosJugador}.`;
    }
    case 'divergenciaAvance': {
      const p = parametros as ParametrosPorError['divergenciaAvance'];
      return `Hasta aquí íbamos igual; en este paso yo avancé ${p.pasosKiro} y tú ${p.pasosJugador}.`;
    }
    case 'divergenciaJugadorCorto':
      return 'Tu programa terminó aquí, pero todavía faltaban pasos.';
    case 'divergenciaExcesoFinal':
      return 'Llegaste al mismo lugar que yo; el problema es que dibujaste de más al final.';
    
    // TypeScript debería garantizar que cubrimos todos los casos
    default:
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      // @ts-ignore: Variable solo para exhaustiveness check
      const _exhaustiveCheck: never = id;
      return `[programación] Identificador de error desconocido: ${id as string}`;
  }
}

// ============================================================================
// Tabla de comandos de Logo en inglés
// ============================================================================

/**
 * Tabla cerrada de comandos de Logo en inglés con su equivalente en KiroLogo.
 * Se usa para el mensaje 'comandoEnIngles'.
 */
export const TABLA_LOGO_INGLES: Readonly<Record<string, string>> = {
  'FD': 'AVANZA',
  'FORWARD': 'AVANZA',
  'BK': 'RETROCEDE',
  'BACK': 'RETROCEDE',
  'RT': 'GIRADERECHA',
  'RIGHT': 'GIRADERECHA',
  'LT': 'GIRAIZQUIERDA',
  'LEFT': 'GIRAIZQUIERDA',
  'HOME': 'CENTRO',
  'CS': 'BORRAPANTALLA',
  'CLEARSCREEN': 'BORRAPANTALLA',
  'REPEAT': 'REPITE',
  'PU': 'SUBELAPIZ',
  'PENUP': 'SUBELAPIZ',
  'PD': 'BAJALAPIZ',
  'PENDOWN': 'BAJALAPIZ',
  'SETCOLOR': 'PONCOLOR',
  'SETPENCOLOR': 'PONCOLOR',
  'SETPENSIZE': 'PONGROSOR',
  'FILL': 'RELLENA',
  'TO': 'PARA',
  'END': 'FIN',
  'HT': 'OCULTATORTUGA',
  'HIDETURTLE': 'OCULTATORTUGA',
  'ST': 'MUESTRATORTUGA',
  'SHOWTURTLE': 'MUESTRATORTUGA',
  'SUM': 'SUMA',
  'DIFFERENCE': 'RESTA',
  'PRODUCT': 'PRODUCTO',
  'QUOTIENT': 'COCIENTE',
  'REMAINDER': 'RESTO',
  'MODULO': 'RESTO',
  'RANDOM': 'AZAR',
  'PRINT': 'ESCRIBE',
  'LABEL': 'ROTULA',
  'IF': 'SI',
  'IFELSE': 'SINO',
  'STOP': 'ALTO',
  'OUTPUT': 'DEVUELVE',
  'OP': 'DEVUELVE',
};

// ============================================================================
// Herramientas auxiliares
// ============================================================================

/**
 * Calcula la distancia de edición de Levenshtein entre dos cadenas.
 * Implementación con programación dinámica.
 */
export function distanciaEdicion(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  
  // Matriz (m+1) x (n+1)
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  
  // Casos base
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  
  // Llenar la matriz
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,      // eliminación
        dp[i]![j - 1]! + 1,      // inserción
        dp[i - 1]![j - 1]! + costo // sustitución
      );
    }
  }
  
  return dp[m]![n]!;
}

/**
 * Determina si un error es de severidad 'jugador'.
 */
export function esErrorParaJugador(error: ErrorKiroLogo): boolean {
  return error.severidad === 'jugador';
}

/**
 * Determina si un error tiene posición definida.
 */
export function tienePosicion(error: ErrorKiroLogo): boolean {
  return error.linea !== null && error.columna !== null;
}


/**
 * Encuentra el mejor candidato por distancia de edición entre una palabra
 * y una lista de candidatos, aplicando umbrales según la longitud.
 * @param palabra Palabra a comparar (ya normalizada)
 * @param candidatos Lista de candidatos a comparar
 * @param umbralCorto Distancia máxima para palabras de 3 caracteres o menos (por defecto: 1)
 * @param umbralLargo Distancia máxima para palabras de 4 caracteres o más (por defecto: 2)
 * @returns Mejor candidato encontrado o null si no hay ninguno dentro del umbral
 */
function encontrarMejorCandidato(
  palabra: string,
  candidatos: readonly { texto: string; entrada: EntradaVocabulario }[],
  umbralCorto: number = 1,
  umbralLargo: number = 2,
): { texto: string; entrada: EntradaVocabulario; distancia: number } | null {
  let mejorCandidato: { texto: string; entrada: EntradaVocabulario; distancia: number } | null = null;
  
  for (const candidato of candidatos) {
    const distancia = distanciaEdicion(palabra, candidato.texto);
    const umbral = palabra.length >= 4 ? umbralLargo : umbralCorto;
    
    if (distancia <= umbral) {
      if (mejorCandidato === null || distancia < mejorCandidato.distancia) {
        mejorCandidato = { ...candidato, distancia };
      } else if (distancia === mejorCandidato.distancia) {
        // Desempate: nombre largo antes que abreviatura
        const esNombreLargoActual = candidato.texto === normalizarPalabra(candidato.entrada.nombre);
        const esNombreLargoMejor = mejorCandidato.texto === normalizarPalabra(mejorCandidato.entrada.nombre);
        
        if (esNombreLargoActual && !esNombreLargoMejor) {
          mejorCandidato = { ...candidato, distancia };
        } else if (esNombreLargoActual === esNombreLargoMejor) {
          // Mismo tipo (ambos nombres largos o ambos abreviaturas)
          // Desempate: orden de declaración en el vocabulario
          const indiceActual = VOCABULARIO.indexOf(candidato.entrada);
          const indiceMejor = VOCABULARIO.indexOf(mejorCandidato.entrada);
          if (indiceActual < indiceMejor) {
            mejorCandidato = { ...candidato, distancia };
          }
        }
      }
    }
  }
  
  return mejorCandidato;
}

/**
 * Encuentra el procedimiento definido más cercano a la palabra escrita, con el
 * mismo umbral de distancia de edición que usa `encontrarMejorCandidato` para los
 * comandos (≤1 para palabras de 3 caracteres o menos, ≤2 para 4 o más).
 *
 * Los nombres de procedimiento ya llegan normalizados (el lexer guarda en
 * `token.valor` el resultado de `normalizarPalabra`), así que la comparación es
 * siempre normalizada-contra-normalizada, igual que con los comandos.
 *
 * @param palabra Palabra a comparar (ya normalizada)
 * @param procedimientos Nombres de procedimiento definidos (ya normalizados)
 * @returns El nombre más cercano y su distancia, o null si ninguno entra en el umbral
 */
function encontrarMejorProcedimiento(
  palabra: string,
  procedimientos: readonly string[],
): { texto: string; distancia: number } | null {
  let mejor: { texto: string; distancia: number } | null = null;
  const umbral = palabra.length >= 4 ? 2 : 1;

  for (const nombre of procedimientos) {
    const distancia = distanciaEdicion(palabra, nombre);
    if (distancia <= umbral) {
      // Desempate entre procedimientos: el que aparece antes en la lista, que es
      // el orden de definición en el programa (determinista y estable).
      if (mejor === null || distancia < mejor.distancia) {
        mejor = { texto: nombre, distancia };
      }
    }
  }

  return mejor;
}

/**
 * Resuelve una palabra que no se puede ejecutar aplicando exactamente un mensaje
 * en el orden de precedencia de los cinco casos.
 * @param palabra Palabra escrita por el jugador
 * @param mundoActual Mundo actual del jugador (0-5)
 * @param posicion Opcional: línea y columna donde ocurrió el error
 * @param procedimientos Opcional: nombres de procedimiento definidos por el jugador
 *   (ya normalizados), para que la sugerencia del caso 3 pueda proponer uno de ellos.
 *   Por omisión `[]`, de modo que los mundos 0 y 1 (que aún no tienen `PARA … FIN`)
 *   mantienen su comportamiento sin cambios.
 * @returns Error correspondiente al primer caso que aplica
 */
export function resolverPalabraNoEjecutable(
  palabra: string,
  mundoActual: Mundo,
  posicion?: { readonly linea: number; readonly columna?: number },
  procedimientos: readonly string[] = [],
): ErrorKiroLogo {
  const normalizada = normalizarPalabra(palabra);
  
  // Caso 1: Comando bloqueado (coincidencia exacta con comando de mundo posterior)
  const resultadoBusqueda = buscarComando(normalizada);
  if (resultadoBusqueda.hallada) {
    const entrada = resultadoBusqueda.entrada;
    if (entrada.mundo > mundoActual) {
      return crearError('comandoBloqueado', {
        nombre: entrada.nombre,
        mundo: entrada.mundo,
      }, posicion);
    }
  }
  
  // Caso 2: Comando en inglés
  const equivalenteIngles = TABLA_LOGO_INGLES[normalizada];
  if (equivalenteIngles !== undefined) {
    return crearError('comandoEnIngles', {
      escrita: palabra,
    }, posicion);
  }
  
  // Caso 3: Palabra desconocida con sugerencia (dentro del umbral de un comando desbloqueado)
  const comandosDesbloqueados = VOCABULARIO.filter(entrada => entrada.mundo <= mundoActual);
  const candidatosDesbloqueados = comandosDesbloqueados.flatMap(entrada => [
    { texto: normalizarPalabra(entrada.nombre), entrada },
    ...(entrada.abreviatura !== null ? [{ texto: normalizarPalabra(entrada.abreviatura), entrada }] : []),
  ]);
  
  const mejorDesbloqueado = encontrarMejorCandidato(normalizada, candidatosDesbloqueados);
  const mejorProcedimiento = encontrarMejorProcedimiento(normalizada, procedimientos);

  // La sugerencia del caso 3 considera tanto comandos desbloqueados como
  // procedimientos definidos (R6.3). Desempate por distancia igual: gana el
  // comando del lenguaje. El vocabulario es la referencia estable que el jugador
  // siempre puede consultar; un nombre de procedimiento que él acaba de escribir
  // puede ser justamente la fuente del error tipográfico, así que ante la duda
  // apuntamos primero a la palabra del lenguaje.
  let sugerencia: string | null = null;
  if (mejorDesbloqueado !== null && mejorProcedimiento !== null) {
    sugerencia = mejorProcedimiento.distancia < mejorDesbloqueado.distancia
      ? mejorProcedimiento.texto
      : mejorDesbloqueado.entrada.nombre;
  } else if (mejorDesbloqueado !== null) {
    sugerencia = mejorDesbloqueado.entrada.nombre;
  } else if (mejorProcedimiento !== null) {
    sugerencia = mejorProcedimiento.texto;
  }

  if (sugerencia !== null) {
    return crearError('palabraDesconocidaConSugerencia', {
      escrita: palabra,
      sugerencia,
    }, posicion);
  }
  
  // Caso 4: Comando bloqueado cercano (dentro del umbral de un comando bloqueado)
  const comandosBloqueados = VOCABULARIO.filter(entrada => entrada.mundo > mundoActual);
  const candidatosBloqueados = comandosBloqueados.flatMap(entrada => [
    { texto: normalizarPalabra(entrada.nombre), entrada },
    ...(entrada.abreviatura !== null ? [{ texto: normalizarPalabra(entrada.abreviatura), entrada }] : []),
  ]);
  
  const mejorBloqueado = encontrarMejorCandidato(normalizada, candidatosBloqueados);
  if (mejorBloqueado !== null) {
    return crearError('comandoBloqueadoCercano', {
      escrita: palabra,
      nombre: mejorBloqueado.entrada.nombre,
      mundo: mejorBloqueado.entrada.mundo,
    }, posicion);
  }
  
  // Caso 5: Palabra desconocida sin sugerencia
  return crearError('palabraDesconocidaSinSugerencia', {
    escrita: palabra,
  }, posicion);
}