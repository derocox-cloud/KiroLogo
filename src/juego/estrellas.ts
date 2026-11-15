// Las tres estrellas de KiroLogo: precisión, economía y abstracción.
// Precisión y economía son independientes. La abstracción exige además la precisión:
// sin ella no se otorga, haya o no exigencias en el nivel.

import type { Programa } from '../lenguaje/ast.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import type { Veredicto } from '../motor/validador.js';
import type { Reto } from './reto.js';
import { analizar, contarProcedimientos } from './abstraccion.js';
import { crearError } from '../lenguaje/errores.js';

// ============================================================================
// Tipos públicos
// ============================================================================

export type MotivoNegada =
  | { readonly clave: 'sinCoincidenciaGeometrica'; readonly iou: number; readonly exceso: number }
  | { readonly clave: 'excesoDeTrazo'; readonly iou: number; readonly exceso: number }
  | { readonly clave: 'presupuestoExcedido'; readonly conteo: number; readonly presupuesto: number }
  | { readonly clave: 'exigenciasSinConfirmar'; readonly claves: readonly string[] }
  | { readonly clave: 'sinPrecision' }
  | { readonly clave: 'sinVeredicto'; readonly causa: 'erroresDeAnalisis' | 'guarda' };

export type EstadoEstrella =
  | { readonly otorgada: true }
  | { readonly otorgada: false; readonly motivo: MotivoNegada };

export interface Calificacion {
  readonly precision: EstadoEstrella;
  readonly economia: EstadoEstrella;
  readonly abstraccion: EstadoEstrella;
  readonly conteoJugador: number;
  readonly presupuestoEstrella: number;
  /**
   * Invitación afirmativa a usar la abstracción que el nivel enseña. Solo se
   * fija cuando el jugador ganó la precisión pero no cumplió la exigencia de
   * abstracción: es una invitación posterior, nunca un bloqueo. `null` en
   * cualquier otro caso (sin precisión, sin exigencias, o exigencia cumplida).
   */
  readonly mensajeAbstraccion: string | null;
}

const OTORGADA: EstadoEstrella = { otorgada: true };

// ============================================================================
// Calificación
// ============================================================================

/**
 * Califica un intento con las tres estrellas.
 *
 * @param astJugador AST del jugador, o null si no hubo AST ejecutable
 * @param veredicto Veredicto del validador, o null si no hubo ejecución/guarda
 * @param reto Reto en curso, con el presupuesto y las exigencias del nivel
 * @param causaSinVeredicto Causa cuando falta el veredicto (por omisión, análisis)
 */
export function calificar(
  astJugador: Programa | null,
  veredicto: Veredicto | null,
  reto: Reto,
  causaSinVeredicto: 'erroresDeAnalisis' | 'guarda' = 'erroresDeAnalisis',
): Calificacion {
  const presupuestoEstrella = reto.presupuestoEstrella;

  // Intento sin veredicto o sin AST: niega las tres con la causa recibida.
  if (astJugador === null || veredicto === null) {
    const motivo: MotivoNegada = { clave: 'sinVeredicto', causa: causaSinVeredicto };
    const negada: EstadoEstrella = { otorgada: false, motivo };
    return {
      precision: negada,
      economia: negada,
      abstraccion: negada,
      conteoJugador: 0,
      presupuestoEstrella,
      mensajeAbstraccion: null,
    };
  }

  // Conteo del jugador: siempre por la única función de conteo.
  const resultadoConteo = contarInstrucciones(astJugador);
  const conteoJugador = resultadoConteo.exito ? resultadoConteo.instrucciones : Number.POSITIVE_INFINITY;

  // --- Precisión: tal como el validador la devuelve, sin recalcular ---
  const precision: EstadoEstrella = veredicto.coincide
    ? OTORGADA
    : {
        otorgada: false,
        motivo:
          veredicto.motivo === 'excesoDeTrazo'
            ? { clave: 'excesoDeTrazo', iou: veredicto.iou, exceso: veredicto.excesoPorcentaje }
            : { clave: 'sinCoincidenciaGeometrica', iou: veredicto.iou, exceso: veredicto.excesoPorcentaje },
      };

  // --- Economía: conteo ≤ presupuesto, sin margen, independiente de precisión ---
  const economia: EstadoEstrella =
    conteoJugador <= presupuestoEstrella
      ? OTORGADA
      : {
          otorgada: false,
          motivo: { clave: 'presupuestoExcedido', conteo: conteoJugador, presupuesto: presupuestoEstrella },
        };

  // --- Abstracción ---
  const exigencias = reto.nivel.abstraccion;
  let abstraccion: EstadoEstrella;
  let mensajeAbstraccion: string | null = null;
  if (exigencias.length === 0) {
    // Sin exigencias: se otorga si y solo si se otorgó la precisión.
    abstraccion = precision.otorgada ? OTORGADA : { otorgada: false, motivo: { clave: 'sinPrecision' } };
  } else {
    const analisis = analizar(astJugador, exigencias);
    // La abstracción exige precisión: sin ella no se otorga aunque se cumplan las exigencias.
    if (!precision.otorgada) {
      abstraccion = { otorgada: false, motivo: { clave: 'sinPrecision' } };
    } else if (analisis.sinConfirmar.length === 0) {
      abstraccion = OTORGADA;
    } else {
      abstraccion = {
        otorgada: false,
        motivo: { clave: 'exigenciasSinConfirmar', claves: analisis.sinConfirmar },
      };
      // Una línea por exigencia sin confirmar, en el orden en que el nivel las declara.
      const lineas: string[] = [];
      for (const exigencia of exigencias) {
        if (!analisis.sinConfirmar.includes(exigencia.clave)) continue;
        if (exigencia.clave === 'usaRepite') {
          lineas.push(crearError('invitacionAbstraccionRepite', {}).mensaje);
        } else if (exigencia.clave === 'usaParametros') {
          lineas.push(crearError('invitacionAbstraccionParametros', {}).mensaje);
        } else if (exigencia.clave === 'maximoProcedimientos') {
          lineas.push(
            crearError('invitacionAbstraccionProcedimientos', {
              definidos: contarProcedimientos(astJugador),
              maximo: exigencia.maximo,
            }).mensaje,
          );
        }
      }
      mensajeAbstraccion = lineas.length > 0 ? lineas.join('\n') : null;
    }
  }

  return { precision, economia, abstraccion, conteoJugador, presupuestoEstrella, mensajeAbstraccion };
}
