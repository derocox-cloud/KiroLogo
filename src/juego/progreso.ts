// Persistencia del progreso de KiroLogo en localStorage.
// Una sola clave, un solo texto JSON, solo datos anónimos. Lectura tolerante y
// cuatro degradaciones que dejan el juego siempre jugable. Funciona en memoria
// cuando el almacén es null (Node, pruebas).

import type { Calificacion } from './estrellas.js';
import { buscarNivel } from '../niveles/catalogo.js';
import { SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../azar/prng.js';

// ============================================================================
// Constantes y tipos públicos
// ============================================================================

export const CLAVE = 'kirologo.progreso.v1';
export const VERSION_FORMATO = 1;

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
  ultimoReto(): RetoEnCurso | null;
  guardar(idNivel: string, semilla: number, calificacion: Calificacion): void;
}

// ============================================================================
// Forma interna del contenido
// ============================================================================

interface Contenido {
  version: number;
  niveles: Record<string, { semilla: number; estrellas: EstrellasGuardadas }>;
  ultimoReto: RetoEnCurso | null;
}

function contenidoVacio(): Contenido {
  return { version: VERSION_FORMATO, niveles: {}, ultimoReto: null };
}

// ============================================================================
// carga
// ============================================================================

/**
 * Carga el progreso desde un almacén. Con `null` funciona entero en memoria.
 * Lee una sola vez y responde con ese contenido durante toda la sesión.
 *
 * @param almacen `localStorage` o compatible, o `null` para memoria pura
 * @returns La interfaz de progreso
 */
export function cargarProgreso(almacen: Storage | null): Progreso {
  // Lectura inicial (tolerante). `crudo` conserva el valor no reconocido hasta
  // el primer guardado exitoso.
  let crudo: string | null = null;
  try {
    crudo = almacen ? almacen.getItem(CLAVE) : null;
  } catch {
    crudo = null;
  }

  const contenido = interpretar(crudo);
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

    ultimoReto(): RetoEnCurso | null {
      return contenido.ultimoReto;
    },

    guardar(idNivel: string, semilla: number, calificacion: Calificacion): void {
      const previo = contenido.niveles[idNivel];
      // Las estrellas nunca retroceden: verdadero si el previo o el nuevo la concedió.
      const estrellas: EstrellasGuardadas = {
        precision: (previo?.estrellas.precision ?? false) || calificacion.precision.otorgada,
        economia: (previo?.estrellas.economia ?? false) || calificacion.economia.otorgada,
        abstraccion: (previo?.estrellas.abstraccion ?? false) || calificacion.abstraccion.otorgada,
      };
      contenido.niveles[idNivel] = { semilla, estrellas };
      // El último reto en curso se actualiza siempre.
      contenido.ultimoReto = { idNivel, semilla };
      persistir();
    },
  };
}

// ============================================================================
// Interpretación tolerante del contenido almacenado
// ============================================================================

/** Interpreta el texto crudo, aplicando las degradaciones de la tabla 11.6. */
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
  const niveles = obj['niveles'];
  if (typeof niveles === 'object' && niveles !== null) {
    for (const [idNivel, registro] of Object.entries(niveles as Record<string, unknown>)) {
      const validado = validarRegistro(idNivel, registro);
      if (validado) contenido.niveles[idNivel] = validado;
    }
  }

  // Último reto: válido solo si nombra un nivel existente y una semilla del dominio.
  const ultimo = obj['ultimoReto'];
  if (typeof ultimo === 'object' && ultimo !== null) {
    const u = ultimo as Record<string, unknown>;
    const idNivel = u['idNivel'];
    const semilla = u['semilla'];
    if (
      typeof idNivel === 'string' &&
      buscarNivel(idNivel).hallado &&
      esSemillaValida(semilla)
    ) {
      contenido.ultimoReto = { idNivel, semilla: semilla as number };
    }
  }

  return contenido;
}

/** Valida un registro de nivel; devuelve el registro normalizado o null. */
function validarRegistro(
  idNivel: string,
  registro: unknown,
): { semilla: number; estrellas: EstrellasGuardadas } | null {
  // El nivel debe existir en el catálogo.
  if (!buscarNivel(idNivel).hallado) return null;
  if (typeof registro !== 'object' || registro === null) return null;
  const r = registro as Record<string, unknown>;

  if (!esSemillaValida(r['semilla'])) return null;

  const estrellas = r['estrellas'];
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
    semilla: r['semilla'] as number,
    estrellas: {
      precision: e['precision'] as boolean,
      economia: e['economia'] as boolean,
      abstraccion: e['abstraccion'] as boolean,
    },
  };
}

/** ¿Es una semilla entera dentro del dominio? */
function esSemillaValida(valor: unknown): boolean {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= SEMILLA_MINIMA && valor <= SEMILLA_MAXIMA;
}
