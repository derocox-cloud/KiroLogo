// Persistencia del progreso de KiroLogo en localStorage.
//
// Formato versión 2 (spec 01). Por nivel guarda las tres estrellas, el mejor
// conteo de instrucciones logrado con precisión, y la última semilla jugada;
// además, el último reto en curso y si ya se completó la guía de primeros pasos.
// Las estrellas nunca retroceden y el mejor conteo solo baja.
//
// Una sola clave, un solo texto JSON, solo datos anónimos. Lectura tolerante,
// migración desde la versión 1 de la spec 00, y degradaciones que dejan el juego
// siempre jugable. Funciona en memoria cuando el almacén es null (Node, pruebas).

import type { Calificacion } from './estrellas.js';
import { buscarNivel } from '../niveles/catalogo.js';
import { SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../azar/prng.js';

// ============================================================================
// Constantes y tipos públicos
// ============================================================================

/** Clave del formato vigente (versión 2). */
export const CLAVE = 'kirologo.progreso.v2';

/** Clave del formato de la spec 00 (versión 1), que se lee solo para migrar. */
export const CLAVE_V1 = 'kirologo.progreso.v1';

export const VERSION_FORMATO = 2;

export interface EstrellasGuardadas {
  readonly precision: boolean;
  readonly economia: boolean;
  readonly abstraccion: boolean;
}

export interface RetoEnCurso {
  readonly idNivel: string;
  readonly semilla: number;
}

export interface Progreso {
  estrellasDe(idNivel: string): EstrellasGuardadas | null;
  /** Mejor conteo de instrucciones logrado con precisión, o null si aún ninguno. */
  mejorConteoDe(idNivel: string): number | null;
  ultimoReto(): RetoEnCurso | null;
  /** ¿Ya se completó la guía de primeros pasos del nivel 0.1? */
  guiaCompletada(): boolean;
  /** Marca la guía como completada y lo persiste. */
  marcarGuiaCompletada(): void;
  /**
   * Registra el reto en curso (idNivel + semilla) sin tocar estrellas ni conteos.
   * Lo usa la navegación: al entrar a un nivel, ese pasa a ser el último reto, de
   * modo que una recarga lo reanude.
   */
  marcarUltimoReto(idNivel: string, semilla: number): void;
  guardar(idNivel: string, semilla: number, calificacion: Calificacion, conteoJugador: number): void;
}

// ============================================================================
// Forma interna del contenido (versión 2)
// ============================================================================

interface RegistroNivel {
  estrellas: EstrellasGuardadas;
  mejorConteo: number | null; // null hasta el primer aprobado con precisión
  ultimaSemilla: number;
}

interface Contenido {
  version: number;
  niveles: Record<string, RegistroNivel>;
  ultimoReto: RetoEnCurso | null;
  guiaVista: boolean;
}

function contenidoVacio(): Contenido {
  return { version: VERSION_FORMATO, niveles: {}, ultimoReto: null, guiaVista: false };
}

// ============================================================================
// carga
// ============================================================================

/**
 * Carga el progreso desde un almacén. Con `null` funciona entero en memoria.
 * Lee una sola vez (migrando desde la versión 1 si hace falta) y responde con
 * ese contenido durante toda la sesión.
 *
 * @param almacen `localStorage` o compatible, o `null` para memoria pura
 * @returns La interfaz de progreso
 */
export function cargarProgreso(almacen: Storage | null): Progreso {
  // Lectura inicial (tolerante). `crudo` conserva el valor v2 no reconocido hasta
  // el primer guardado exitoso.
  let crudo: string | null = null;
  try {
    crudo = almacen ? almacen.getItem(CLAVE) : null;
  } catch {
    crudo = null;
  }

  let contenido: Contenido;
  if (crudo !== null) {
    // Hay contenido en la clave v2: interpretarlo.
    contenido = interpretar(crudo);
  } else {
    // Sin clave v2: intentar migrar desde la v1 (si existe y es legible).
    contenido = migrarDesdeV1(almacen);
  }

  let avisoCuotaDado = false;

  function persistir(): void {
    if (!almacen) return; // memoria pura
    try {
      almacen.setItem(CLAVE, JSON.stringify(contenido));
    } catch {
      // Cuota agotada o almacén no disponible: informar una sola vez por sesión,
      // conservar el resultado en memoria y no reintentar.
      if (!avisoCuotaDado) {
        avisoCuotaDado = true;
        // El aviso al jugador lo emite la UI; aquí solo se registra.
        console.warn('progreso: no se pudo guardar (cuota o almacén no disponible).');
      }
    }
  }

  return {
    estrellasDe(idNivel: string): EstrellasGuardadas | null {
      const registro = contenido.niveles[idNivel];
      return registro ? registro.estrellas : null;
    },

    mejorConteoDe(idNivel: string): number | null {
      const registro = contenido.niveles[idNivel];
      return registro ? registro.mejorConteo : null;
    },

    ultimoReto(): RetoEnCurso | null {
      return contenido.ultimoReto;
    },

    guiaCompletada(): boolean {
      return contenido.guiaVista;
    },

    marcarGuiaCompletada(): void {
      if (contenido.guiaVista) return;
      contenido.guiaVista = true;
      persistir();
    },

    marcarUltimoReto(idNivel: string, semilla: number): void {
      contenido.ultimoReto = { idNivel, semilla };
      persistir();
    },

    guardar(idNivel: string, semilla: number, calificacion: Calificacion, conteoJugador: number): void {
      const previo = contenido.niveles[idNivel];
      // Las estrellas nunca retroceden: verdadero si el previo o el nuevo la concedió.
      const estrellas: EstrellasGuardadas = {
        precision: (previo?.estrellas.precision ?? false) || calificacion.precision.otorgada,
        economia: (previo?.estrellas.economia ?? false) || calificacion.economia.otorgada,
        abstraccion: (previo?.estrellas.abstraccion ?? false) || calificacion.abstraccion.otorgada,
      };
      // El mejor conteo solo cuenta cuando se otorgó la precisión (un conteo bajo
      // sin figura correcta no vale) y solo baja.
      let mejorConteo = previo?.mejorConteo ?? null;
      if (calificacion.precision.otorgada && Number.isFinite(conteoJugador)) {
        mejorConteo = mejorConteo === null ? conteoJugador : Math.min(mejorConteo, conteoJugador);
      }
      contenido.niveles[idNivel] = { estrellas, mejorConteo, ultimaSemilla: semilla };
      // El último reto en curso se actualiza siempre.
      contenido.ultimoReto = { idNivel, semilla };
      persistir();
    },
  };
}

// ============================================================================
// Interpretación tolerante del contenido v2
// ============================================================================

/** Interpreta el texto crudo v2, aplicando las degradaciones de tolerancia. */
function interpretar(crudo: string | null): Contenido {
  if (crudo === null) return contenidoVacio();

  let dato: unknown;
  try {
    dato = JSON.parse(crudo);
  } catch {
    // JSON ilegible: progreso vacío (el crudo se conserva hasta el primer guardado).
    return contenidoVacio();
  }

  if (typeof dato !== 'object' || dato === null) return contenidoVacio();
  const obj = dato as Record<string, unknown>;

  // Versión ausente o no reconocida: progreso vacío.
  if (obj['version'] !== VERSION_FORMATO) return contenidoVacio();

  const contenido = contenidoVacio();

  // Niveles: descartar solo los registros inválidos, conservar los válidos.
  poblarNiveles(contenido, obj['niveles']);

  // Último reto: válido solo si nombra un nivel existente y una semilla del dominio.
  contenido.ultimoReto = interpretarUltimoReto(obj['ultimoReto']);

  // Guía vista: solo un booleano verdadero cuenta.
  contenido.guiaVista = obj['guiaVista'] === true;

  return contenido;
}

/** Puebla `contenido.niveles` con los registros v2 válidos de `niveles`. */
function poblarNiveles(contenido: Contenido, niveles: unknown): void {
  if (typeof niveles !== 'object' || niveles === null) return;
  for (const [idNivel, registro] of Object.entries(niveles as Record<string, unknown>)) {
    const validado = validarRegistroV2(idNivel, registro);
    if (validado) contenido.niveles[idNivel] = validado;
  }
}

/** Interpreta el último reto; null si no nombra un nivel y semilla válidos. */
function interpretarUltimoReto(ultimo: unknown): RetoEnCurso | null {
  if (typeof ultimo !== 'object' || ultimo === null) return null;
  const u = ultimo as Record<string, unknown>;
  const idNivel = u['idNivel'];
  const semilla = u['semilla'];
  if (typeof idNivel === 'string' && buscarNivel(idNivel).hallado && esSemillaValida(semilla)) {
    return { idNivel, semilla: semilla as number };
  }
  return null;
}

/** Valida un registro de nivel v2; devuelve el registro normalizado o null. */
function validarRegistroV2(idNivel: string, registro: unknown): RegistroNivel | null {
  // El nivel debe existir en el catálogo.
  if (!buscarNivel(idNivel).hallado) return null;
  if (typeof registro !== 'object' || registro === null) return null;
  const r = registro as Record<string, unknown>;

  if (!esSemillaValida(r['ultimaSemilla'])) return null;

  const estrellas = validarEstrellas(r['estrellas']);
  if (estrellas === null) return null;

  // mejorConteo: null, o un entero no negativo.
  const bruto = r['mejorConteo'];
  let mejorConteo: number | null;
  if (bruto === null || bruto === undefined) {
    mejorConteo = null;
  } else if (typeof bruto === 'number' && Number.isInteger(bruto) && bruto >= 0) {
    mejorConteo = bruto;
  } else {
    return null; // valor de mejorConteo inválido: registro descartado
  }

  return { estrellas, mejorConteo, ultimaSemilla: r['ultimaSemilla'] as number };
}

/** Valida el objeto de estrellas; devuelve el normalizado o null. */
function validarEstrellas(estrellas: unknown): EstrellasGuardadas | null {
  if (typeof estrellas !== 'object' || estrellas === null) return null;
  const e = estrellas as Record<string, unknown>;
  if (
    typeof e['precision'] !== 'boolean' ||
    typeof e['economia'] !== 'boolean' ||
    typeof e['abstraccion'] !== 'boolean'
  ) {
    return null;
  }
  return {
    precision: e['precision'] as boolean,
    economia: e['economia'] as boolean,
    abstraccion: e['abstraccion'] as boolean,
  };
}

// ============================================================================
// Migración desde la versión 1 (spec 00)
// ============================================================================

/**
 * Migra el contenido de la clave v1 a la forma v2, si existe y es legible. El
 * registro v1 por nivel era `{ semilla, estrellas }`; en v2 pasa a
 * `{ estrellas, mejorConteo: null, ultimaSemilla: semilla }`. `guiaVista` arranca
 * verdadero si algún nivel ya tiene precisión (quien ya jugó el 0.1 no necesita
 * la guía). La clave v1 no se borra. Si no hay v1 legible, progreso vacío.
 */
function migrarDesdeV1(almacen: Storage | null): Contenido {
  let crudoV1: string | null = null;
  try {
    crudoV1 = almacen ? almacen.getItem(CLAVE_V1) : null;
  } catch {
    crudoV1 = null;
  }
  if (crudoV1 === null) return contenidoVacio();

  let dato: unknown;
  try {
    dato = JSON.parse(crudoV1);
  } catch {
    return contenidoVacio();
  }
  if (typeof dato !== 'object' || dato === null) return contenidoVacio();
  const obj = dato as Record<string, unknown>;
  // La v1 declaraba version 1; si no coincide, no es un contenido v1 reconocible.
  if (obj['version'] !== 1) return contenidoVacio();

  const contenido = contenidoVacio();
  let algunaPrecision = false;

  const niveles = obj['niveles'];
  if (typeof niveles === 'object' && niveles !== null) {
    for (const [idNivel, registro] of Object.entries(niveles as Record<string, unknown>)) {
      if (!buscarNivel(idNivel).hallado) continue;
      if (typeof registro !== 'object' || registro === null) continue;
      const r = registro as Record<string, unknown>;
      if (!esSemillaValida(r['semilla'])) continue;
      const estrellas = validarEstrellas(r['estrellas']);
      if (estrellas === null) continue;
      contenido.niveles[idNivel] = {
        estrellas,
        mejorConteo: null, // la v1 no lo guardaba; se queda sin valor hasta el próximo intento
        ultimaSemilla: r['semilla'] as number,
      };
      if (estrellas.precision) algunaPrecision = true;
    }
  }

  contenido.ultimoReto = interpretarUltimoReto(obj['ultimoReto']);
  // Quien ya aprobó algún nivel ya pasó por la guía: no se la mostramos de nuevo.
  contenido.guiaVista = algunaPrecision;

  return contenido;
}

// ============================================================================
// Validación de semillas
// ============================================================================

/** ¿Es una semilla entera dentro del dominio? */
function esSemillaValida(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= SEMILLA_MINIMA && valor <= SEMILLA_MAXIMA;
}
