// Reproducción en paralelo de KiroLogo: ejecuta el programa de Kiro y el del
// jugador con el MISMO generador del intérprete, los compara operación a
// operación y señala el primer paso donde los dos recorridos se separan.
//
// La comparación es geométrica, no textual: dos programas escritos de forma
// distinta pero que producen el mismo recorrido (p. ej. un cuadrado a mano y
// `REPITE 4 [AV 100 GD 90]`) generan la misma secuencia de `Operacion[]` y por
// eso NO divergen. Esta es la herramienta de depuración que solo existe porque
// el reto es un programa y no una imagen: compara en el tiempo, no en el espacio.
//
// Este módulo pertenece a `motor/`: puede importar de `lenguaje/`, nunca de
// `ui/` ni de `juego/`. Los mensajes visibles al jugador viven centralizados en
// `lenguaje/errores.ts`; aquí no hay literales de texto para el jugador.

import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { ejecutar, type Operacion } from '../lenguaje/interprete.js';
import { comandosDelMundo, type Mundo } from '../lenguaje/vocabulario.js';
import { crearError, type ErrorKiroLogo } from '../lenguaje/errores.js';
import { ESTADO_INICIAL, normalizarRumbo } from './tortuga.js';

// ============================================================================
// Tipos públicos
// ============================================================================

/** El tipo de una operación de la tortuga; el mismo que emite el intérprete. */
export type TipoOperacion = Operacion['tipo'];

/**
 * Primer paso en que las dos ejecuciones dejan de coincidir. El `indice` es la
 * posición en la lista de operaciones (desde 0). Los valores son los propios de
 * la operación de cada quien en ese índice: grados para un giro, distancia para
 * un avance.
 */
export interface PuntoDivergencia {
  readonly indice: number;
  readonly tipoKiro: TipoOperacion;
  readonly valorKiro: number;
  readonly tipoJugador: TipoOperacion;
  readonly valorJugador: number;
}

/**
 * Resultado de reproducir los dos programas en paralelo.
 *
 * - `divergencia`: el primer paso donde se separaron, o null si nunca lo hicieron.
 * - `excesoDespuesDeIgual`: los dos recorridos coinciden hasta el final del más
 *   corto, pero el del jugador tiene pasos de más al final (dibujó de sobra).
 * - `programaCortoSeLlamo`: quién terminó antes cuando no hubo divergencia pero
 *   las longitudes difieren; null si tuvieron la misma longitud.
 */
export interface ResultadoParalelo {
  readonly divergencia: PuntoDivergencia | null;
  readonly excesoDespuesDeIgual: boolean;
  readonly programaCortoSeLlamo: 'kiro' | 'jugador' | null;
}

// ============================================================================
// Tolerancias de comparación
// ============================================================================

/** Dos posiciones se consideran distintas si se separan más de esto, en píxeles. */
const TOLERANCIA_POSICION = 8;

/** Dos rumbos se consideran distintos si difieren más de esto, en grados. */
const TOLERANCIA_RUMBO = 1;

// ============================================================================
// Función principal
// ============================================================================

/**
 * Ejecuta en paralelo el programa de Kiro y el del jugador y devuelve el primer
 * punto de divergencia (si lo hay), si uno terminó antes y si el jugador dibujó
 * de más al final.
 *
 * Usa el mismo generador del intérprete que todo lo demás: no duplica la lógica
 * de ejecución. Ejecuta en modo batch (consume el generador hasta el final) con
 * el vocabulario del mundo 1, suficiente para AVANZA, GIRADERECHA y REPITE.
 *
 * @param programaKiro Texto del programa de referencia de Kiro
 * @param programaJugador Texto del programa escrito por el jugador
 * @param mundo Mundo cuyo vocabulario se habilita (por omisión, 1)
 * @returns El resultado de la comparación paso a paso
 */
export function ejecutarEnParalelo(
  programaKiro: string,
  programaJugador: string,
  mundo: Mundo = 1,
): ResultadoParalelo {
  const opsKiro = operacionesDe(programaKiro, mundo);
  const opsJugador = operacionesDe(programaJugador, mundo);
  return compararOperaciones(opsKiro, opsJugador);
}

/**
 * Compara dos listas de operaciones ya ejecutadas, operación a operación. Es el
 * corazón de la reproducción en paralelo: `ejecutarEnParalelo` lo usa tras
 * ejecutar los dos textos, y los consumidores que ya tienen las operaciones a
 * mano (p. ej. la UI, que acaba de animar las dos estelas) lo usan directamente
 * para no volver a parsear ni ejecutar.
 *
 * @param opsKiro Operaciones del programa de Kiro
 * @param opsJugador Operaciones del programa del jugador
 * @returns El resultado de la comparación paso a paso
 */
export function compararOperaciones(
  opsKiro: readonly Operacion[],
  opsJugador: readonly Operacion[],
): ResultadoParalelo {
  const longMin = Math.min(opsKiro.length, opsJugador.length);

  // Recorrer en paralelo hasta la longitud mínima buscando la primera separación.
  for (let i = 0; i < longMin; i++) {
    const a = opsKiro[i]!;
    const b = opsJugador[i]!;
    if (divergen(a, b)) {
      return {
        divergencia: {
          indice: i,
          tipoKiro: a.tipo,
          valorKiro: valorDe(a),
          tipoJugador: b.tipo,
          valorJugador: valorDe(b),
        },
        excesoDespuesDeIgual: false,
        programaCortoSeLlamo: null,
      };
    }
  }

  // Sin divergencia en el tramo común. Si las longitudes difieren, uno terminó
  // antes: se reporta quién, y si fue el jugador el más largo, dibujó de más.
  if (opsKiro.length !== opsJugador.length) {
    const quienCorto: 'kiro' | 'jugador' =
      opsKiro.length < opsJugador.length ? 'kiro' : 'jugador';
    // El jugador dibujó de más cuando él es el programa largo (Kiro es el corto).
    const excesoDespuesDeIgual = quienCorto === 'kiro';
    return { divergencia: null, excesoDespuesDeIgual, programaCortoSeLlamo: quienCorto };
  }

  // Misma longitud y sin divergencia: los dos recorridos son equivalentes.
  return { divergencia: null, excesoDespuesDeIgual: false, programaCortoSeLlamo: null };
}

// ============================================================================
// Comparación de operaciones
// ============================================================================

/**
 * ¿Las dos operaciones separan los recorridos? Compara el estado acumulado tras
 * la operación: la posición para los movimientos (tolerancia 8 px) y el rumbo
 * para los giros (tolerancia 1°). Tipos distintos divergen de inmediato.
 *
 * Solo mira el estado geométrico de la tortuga, nunca la instrucción de código,
 * así que dos programas equivalentes escritos distinto no divergen.
 */
export function divergen(a: Operacion, b: Operacion): boolean {
  if (a.tipo !== b.tipo) {
    return true;
  }

  if (a.tipo === 'girar' && b.tipo === 'girar') {
    const difRumbo = diferenciaAngular(a.estadoDespues.rumbo, b.estadoDespues.rumbo);
    return difRumbo > TOLERANCIA_RUMBO;
  }

  // Para movimientos y cualquier otra operación, comparamos la posición
  // acumulada: dos recorridos coinciden mientras la tortuga llegue al mismo
  // sitio dentro de la tolerancia.
  const dx = a.estadoDespues.posicion.x - b.estadoDespues.posicion.x;
  const dy = a.estadoDespues.posicion.y - b.estadoDespues.posicion.y;
  return Math.hypot(dx, dy) > TOLERANCIA_POSICION;
}

/** Valor característico de una operación para el mensaje: grados o distancia. */
function valorDe(op: Operacion): number {
  if (op.tipo === 'girar') {
    return op.grados;
  }
  if (op.tipo === 'mover') {
    return Math.hypot(op.hasta.x - op.desde.x, op.hasta.y - op.desde.y);
  }
  return 0;
}

/** Diferencia angular mínima entre dos rumbos, en [0, 180]. */
function diferenciaAngular(rumboA: number, rumboB: number): number {
  const bruta = Math.abs(normalizarRumbo(rumboA) - normalizarRumbo(rumboB));
  return bruta > 180 ? 360 - bruta : bruta;
}

// ============================================================================
// Mensaje para el globo de Kiro
// ============================================================================

/**
 * Traduce un `ResultadoParalelo` al mensaje que Kiro dice bajo el lienzo, tomado
 * del catálogo central de errores. Devuelve null cuando los dos recorridos son
 * equivalentes y no hay nada que señalar.
 *
 * @param resultado El resultado de `ejecutarEnParalelo`
 * @returns El error/mensaje de Kiro, o null si no hay divergencia ni exceso
 */
export function mensajeDeDivergencia(resultado: ResultadoParalelo): ErrorKiroLogo | null {
  if (resultado.divergencia !== null) {
    const d = resultado.divergencia;
    // La divergencia de un giro se explica con grados; cualquier otra, con pasos.
    if (d.tipoKiro === 'girar' && d.tipoJugador === 'girar') {
      return crearError('divergenciaGiro', {
        gradosKiro: redondear(d.valorKiro),
        gradosJugador: redondear(d.valorJugador),
      });
    }
    return crearError('divergenciaAvance', {
      pasosKiro: redondear(d.valorKiro),
      pasosJugador: redondear(d.valorJugador),
    });
  }

  if (resultado.programaCortoSeLlamo === 'jugador') {
    return crearError('divergenciaJugadorCorto', {});
  }

  if (resultado.excesoDespuesDeIgual) {
    return crearError('divergenciaExcesoFinal', {});
  }

  return null;
}

/** Redondea al entero más próximo para no mostrar decimales de coma flotante. */
function redondear(valor: number): number {
  return Math.round(valor);
}

// ============================================================================
// Ejecución en modo batch
// ============================================================================

/**
 * Parsea y ejecuta un programa hasta el final, devolviendo sus operaciones. Un
 * programa que no parsea produce una lista vacía: la comparación lo tratará como
 * un recorrido de cero pasos, lo que es correcto para la reproducción.
 */
function operacionesDe(texto: string, mundo: Mundo): readonly Operacion[] {
  const lexico = analizarLexico(texto);
  const sintactico = analizar(lexico.tokens, { mundo });
  if (sintactico.programa === null) {
    return [];
  }

  const generador = ejecutar(sintactico.programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(mundo),
    semilla: 0,
  });

  let paso = generador.next();
  while (!paso.done) {
    paso = generador.next();
  }
  return paso.value.operaciones;
}
