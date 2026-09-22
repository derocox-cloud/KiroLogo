// Catálogo de errores de KiroLogo
// Fuente única de todos los mensajes de error visibles al jugador

import { VOCABULARIO, buscarComando, normalizarPalabra, EntradaVocabulario, Mundo } from './vocabulario.js';

// ============================================================================
// Tipos base
// ============================================================================

/**
 * Identificadores de los 40 errores del catálogo.
 * Cada id corresponde a un mensaje en español con parámetros específicos.
 */
export type IdError =
  // léxicos
  | 'caracterNoValido' | 'numeroMalFormado' | 'comillaSinPalabra' | 'parametroSinNombre'
  // sintácticos
  | 'palabraDesconocidaConSugerencia' | 'palabraDesconocidaSinSugerencia'
  | 'comandoEnIngles' | 'comandoBloqueado' | 'comandoBloqueadoCercano'
  | 'argumentoFaltante' | 'argumentoDeTipoEquivocado'
  | 'corcheteSinCerrar' | 'corcheteDeMas' | 'corcheteInesperado'
  | 'parametroInesperado' | 'palabraInesperada' | 'numeroInesperado'
  // ejecución
  | 'comandoNoPermitido' | 'nodoNoImplementado' | 'nodoNoImprimible'
  | 'guardaPasos' | 'guardaRecursion' | 'guardaTiempo'
  // interfaz y persistencia
  | 'limiteLineasEditor' | 'limiteCaracteresEditor' | 'progresoNoSeGuarda'
  // azar y semillas
  | 'codigoSemillaLongitud' | 'codigoSemillaSimbolo' | 'codigoSemillaFueraDeDominio'
  | 'semillaFueraDeDominio' | 'rangoInvalido' | 'listaVacia' | 'pasoInvalido'
  | 'rangoSinMultiplo'
  // fallos de programación
  | 'nodoDesconocidoEnConteo' | 'nivelDesconocido' | 'referenciaNoEjecutable'
  | 'generadorSinCandidato' | 'generadorDesconocido'
  | 'solicitudDeErrorInvalida';

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
  readonly corcheteDeMas: Record<string, never>;
  readonly corcheteInesperado: Record<string, never>;
  readonly parametroInesperado: Record<string, never>;
  readonly palabraInesperada: Record<string, never>;
  readonly numeroInesperado: Record<string, never>;
  
  // ejecución
  readonly comandoNoPermitido: { readonly nombre: string };
  readonly nodoNoImplementado: Record<string, never>;
  readonly nodoNoImprimible: Record<string, never>;
  readonly guardaPasos: Record<string, never>;
  readonly guardaRecursion: { readonly nombre: string } | { readonly linea: number };
  readonly guardaTiempo: Record<string, never>;
  
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
    case 'corcheteDeMas':
      return 'Hay un corchete de cierre en la línea 4 que no abriste.';
    case 'corcheteInesperado':
      return 'Encontré un corchete en la línea 3 sin un comando que lo reciba.';
    case 'parametroInesperado':
      return 'Encontré :largo en la línea 3 sin un comando que lo reciba.';
    case 'palabraInesperada':
      return 'Encontré la palabra "hola" en la línea 3 sin un comando que la reciba.';
    case 'numeroInesperado':
      return 'Encontré el número 100 en la línea 3 sin un comando que lo reciba.';
    
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
 * Resuelve una palabra que no se puede ejecutar aplicando exactamente un mensaje
 * en el orden de precedencia de los cinco casos.
 * @param palabra Palabra escrita por el jugador
 * @param mundoActual Mundo actual del jugador (0-5)
 * @param posicion Opcional: línea y columna donde ocurrió el error
 * @returns Error correspondiente al primer caso que aplica
 */
export function resolverPalabraNoEjecutable(
  palabra: string,
  mundoActual: Mundo,
  posicion?: { readonly linea: number; readonly columna?: number },
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
  if (mejorDesbloqueado !== null) {
    return crearError('palabraDesconocidaConSugerencia', {
      escrita: palabra,
      sugerencia: mejorDesbloqueado.entrada.nombre,
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