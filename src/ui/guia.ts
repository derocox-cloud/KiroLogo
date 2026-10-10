// Guía de primeros pasos de KiroLogo (nivel 0.1).
//
// La primera experiencia de quien nunca vio Logo. Una secuencia corta de
// mensajes breves, publicados por el globo de Kiro (único canal de texto, y por
// tanto en la región aria-live), que explican qué es la tortuga, que Kiro ya
// dibujó la figura a copiar, y cómo dar la primera orden con un ejemplo concreto
// y accionable. Avanza por acción del jugador, nunca por temporizador, y no
// bloquea el editor ni los controles. Al primer acierto cede a la celebración y
// se marca completada; solo se muestra la primera vez.
//
// La guía no decide cuándo mostrarse: `main.ts` la crea e inicia solo en el 0.1
// cuando `progreso.guiaCompletada()` es falso (requisito 10.7).

// Solo necesita publicar texto; el globo expone `celebrar(texto)` para eso.
export interface GloboParaGuia {
  celebrar(texto: string): void;
}

// ============================================================================
// Los pasos (requisito 10.1, 10.2): breves, sin jerga sin explicar
// ============================================================================

/**
 * Mensajes de la guía, en orden. El último trae el ejemplo accionable `AVANZA
 * 100`, de modo que quien nunca vio Logo pueda escribir su primer programa a
 * partir de la guía, sin ninguna pantalla de tutorial aparte.
 */
export const PASOS_GUIA: readonly string[] = [
  'Hola, soy Kiro. La figurita del centro es la tortuga: dibuja una línea por donde camina.',
  'Yo ya dibujé la figura que hay que copiar, la que ves a un lado. Tu tortuga tiene que hacer la misma.',
  'Se le dan órdenes escribiendo. Prueba esta: escribe AVANZA 100 y pulsa Ejecutar.',
];

// ============================================================================
// Interfaz pública
// ============================================================================

export interface Guia {
  /** ¿La guía sigue activa (no completada ni agotada)? */
  readonly activa: boolean;
  /** Índice del paso visible (0 a PASOS_GUIA.length-1), o -1 si no ha empezado. */
  readonly pasoActual: number;
  /** Publica el primer paso. */
  iniciar(): void;
  /** Pasa al siguiente paso; en el último, no avanza más (espera el acierto). */
  avanzar(): void;
  /** Al primer acierto: cede a la celebración y marca la guía completada. */
  alPrimerAcierto(): void;
}

export interface DependenciasGuia {
  readonly globo: GloboParaGuia;
  /** Se invoca una sola vez, cuando la guía se completa (marca el progreso). */
  readonly alCompletar: () => void;
}

// ============================================================================
// Creación
// ============================================================================

/**
 * Crea la guía de primeros pasos. No arranca sola: `main.ts` llama a `iniciar`.
 * El avance entre pasos lo dispara el jugador (una acción explícita o su primer
 * intento), nunca un temporizador, así que la guía no bloquea nada.
 */
export function crearGuia(deps: DependenciasGuia): Guia {
  let indice = -1;
  let activa = false;
  let completada = false;

  function publicar(): void {
    const texto = PASOS_GUIA[indice];
    if (texto !== undefined) deps.globo.celebrar(texto);
  }

  return {
    get activa() {
      return activa;
    },
    get pasoActual() {
      return indice;
    },

    iniciar(): void {
      if (completada || activa) return;
      activa = true;
      indice = 0;
      publicar();
    },

    avanzar(): void {
      if (!activa) return;
      // No pasa del último paso: ahí la guía espera el primer acierto.
      if (indice < PASOS_GUIA.length - 1) {
        indice += 1;
        publicar();
      }
    },

    alPrimerAcierto(): void {
      if (completada) return;
      completada = true;
      activa = false;
      // Cede a la celebración normal (la emite `main.ts`); aquí solo se marca.
      deps.alCompletar();
    },
  };
}
