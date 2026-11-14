// Pruebas de la reproducción en paralelo: comparación operación a operación de
// dos programas y el mensaje de divergencia que Kiro dice bajo el lienzo.

import { describe, it, expect } from 'vitest';
import {
  ejecutarEnParalelo,
  mensajeDeDivergencia,
  divergen,
} from './divergencia.js';

describe('divergencia · reproducción en paralelo', () => {
  it('dos programas idénticos no divergen y ninguno es más corto', () => {
    const r = ejecutarEnParalelo('AV 100 GD 90 AV 100', 'AV 100 GD 90 AV 100');
    expect(r.divergencia).toBeNull();
    expect(r.programaCortoSeLlamo).toBeNull();
    expect(r.excesoDespuesDeIgual).toBe(false);
    expect(mensajeDeDivergencia(r)).toBeNull();
  });

  it('un giro de 72 vs. 90 diverge en el primer giro (índice 1): Kiro=72, jugador=90', () => {
    // Pentágono (giro de 72) contra un giro de cuadrado (90): el avance inicial
    // coincide, el giro no.
    const r = ejecutarEnParalelo('AV 100 GD 72', 'AV 100 GD 90');
    expect(r.divergencia).not.toBeNull();
    expect(r.divergencia!.indice).toBe(1);
    expect(r.divergencia!.tipoKiro).toBe('girar');
    expect(r.divergencia!.tipoJugador).toBe('girar');
    expect(r.divergencia!.valorKiro).toBe(72);
    expect(r.divergencia!.valorJugador).toBe(90);
  });

  it('el mensaje de un giro divergente nombra los grados de cada quien', () => {
    const r = ejecutarEnParalelo('AV 100 GD 72', 'AV 100 GD 90');
    const mensaje = mensajeDeDivergencia(r);
    expect(mensaje).not.toBeNull();
    expect(mensaje!.mensaje).toBe(
      'Hasta aquí íbamos igual; en este giro yo doblé 72 grados y tú 90.',
    );
  });

  it('un cuadrado a mano y REPITE 4 [AV 100 GD 90] son equivalentes: no divergen', () => {
    const aMano = 'AV 100 GD 90 AV 100 GD 90 AV 100 GD 90 AV 100 GD 90';
    const conRepite = 'REPITE 4 [AV 100 GD 90]';
    const r = ejecutarEnParalelo(conRepite, aMano);
    expect(r.divergencia).toBeNull();
    expect(r.programaCortoSeLlamo).toBeNull();
    expect(r.excesoDespuesDeIgual).toBe(false);
  });

  it('cuando el jugador termina antes, programaCortoSeLlamo es "jugador" y no hay exceso', () => {
    // Kiro dibuja dos tramos, el jugador uno: el prefijo coincide, el jugador
    // se queda corto.
    const r = ejecutarEnParalelo('AV 100 GD 90 AV 100', 'AV 100');
    expect(r.divergencia).toBeNull();
    expect(r.programaCortoSeLlamo).toBe('jugador');
    expect(r.excesoDespuesDeIgual).toBe(false);
    expect(mensajeDeDivergencia(r)!.mensaje).toBe(
      'Tu programa terminó aquí, pero todavía faltaban pasos.',
    );
  });

  it('caso extremo: cuando Kiro termina antes, programaCortoSeLlamo es "kiro" y el jugador dibujó de más', () => {
    // El prefijo coincide; el jugador sigue avanzando tras el último paso de Kiro.
    const r = ejecutarEnParalelo('AV 100', 'AV 100 GD 90 AV 100');
    expect(r.divergencia).toBeNull();
    expect(r.programaCortoSeLlamo).toBe('kiro');
    expect(r.excesoDespuesDeIgual).toBe(true);
    expect(mensajeDeDivergencia(r)!.mensaje).toBe(
      'Llegaste al mismo lugar que yo; el problema es que dibujaste de más al final.',
    );
  });

  it('una divergencia de avance (distinta distancia) se mide en posición, no en código', () => {
    // Mismo rumbo, distinta distancia inicial: la posición acumulada diverge en
    // el índice 0 (ambas operaciones son 'mover').
    const r = ejecutarEnParalelo('AV 100', 'AV 40');
    expect(r.divergencia).not.toBeNull();
    expect(r.divergencia!.indice).toBe(0);
    expect(r.divergencia!.tipoKiro).toBe('mover');
    expect(r.divergencia!.valorKiro).toBe(100);
    expect(r.divergencia!.valorJugador).toBe(40);
    expect(mensajeDeDivergencia(r)!.mensaje).toBe(
      'Hasta aquí íbamos igual; en este paso yo avancé 100 y tú 40.',
    );
  });

  it('divergen trata operaciones de distinto tipo como divergentes', () => {
    const giro = ejecutarEnParalelo('GD 90', 'GD 90');
    expect(giro.divergencia).toBeNull();
    // Avance contra giro: tipos distintos, divergen en el índice 0.
    const r = ejecutarEnParalelo('AV 100', 'GD 90');
    expect(r.divergencia).not.toBeNull();
    expect(r.divergencia!.indice).toBe(0);
    expect(r.divergencia!.tipoKiro).toBe('mover');
    expect(r.divergencia!.tipoJugador).toBe('girar');
  });

  it('un avance dentro de la tolerancia de 8 px no diverge', () => {
    // 100 vs. 95: 5 px de diferencia, por debajo del umbral de 8.
    const r = ejecutarEnParalelo('AV 100', 'AV 95');
    expect(r.divergencia).toBeNull();
    // divergen comprueba el mismo criterio sobre las operaciones directas.
    expect(divergen).toBeTypeOf('function');
  });

  it('un giro dentro de la tolerancia de 1° no diverge', () => {
    // 90 vs. 90.5: medio grado de diferencia, por debajo del umbral de 1°.
    const r = ejecutarEnParalelo('AV 100 GD 90', 'AV 100 GD 90.5');
    expect(r.divergencia).toBeNull();
  });
});

// ============================================================================
// Mundo 4: filtro de texto, orden desde 1, ordenSeparacion y semilla (R8.6, R9.12, R25.7)
// ============================================================================

import { compararOperaciones, operacionesComparables } from './divergencia.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { ejecutar, type Operacion } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { fabricaAzar } from '../azar/prng.js';

describe('divergencia · mundo 4', () => {
  function operacionesDel(texto: string): readonly Operacion[] {
    const { programa } = analizar(analizarLexico(texto).tokens, { mundo: 4 });
    expect(programa).not.toBeNull();
    const gen = ejecutar(programa!, { comandosPermitidos: comandosDelMundo(4), semilla: 0 });
    let paso = gen.next();
    while (!paso.done) paso = gen.next();
    return paso.value.operaciones;
  }

  it('operacionesComparables quita solo escribir y rotular, en el mismo orden', () => {
    const ops = operacionesDel('ESCRIBE 1 AVANZA 10 ROTULA "a GIRADERECHA 90 SUBELAPIZ ESCRIBE 2');
    expect(ops.map((o) => o.tipo)).toEqual(['escribir', 'mover', 'rotular', 'girar', 'lapiz', 'escribir']);
    expect(operacionesComparables(ops).map((o) => o.tipo)).toEqual(['mover', 'girar', 'lapiz']);
  });

  it('insertar ESCRIBE y ROTULA en el programa del jugador no cambia el resultado', () => {
    const kiro = 'REPITE 4 [AVANZA 100 GIRADERECHA 90]';
    const conTexto = 'ESCRIBE "hola REPITE 4 [AVANZA 100 ROTULA "esquina GIRADERECHA 90 ESCRIBE 4]';
    expect(ejecutarEnParalelo(kiro, conTexto, 4)).toEqual(ejecutarEnParalelo(kiro, kiro, 4));

    const kiroDistinto = 'REPITE 5 [AVANZA 100 GIRADERECHA 72]';
    expect(ejecutarEnParalelo(kiroDistinto, conTexto, 4)).toEqual(ejecutarEnParalelo(kiroDistinto, kiro, 4));
  });

  it('sin separación, ordenSeparacion es null', () => {
    expect(ejecutarEnParalelo('AV 100 GD 90', 'AV 100 GD 90', 4).ordenSeparacion).toBeNull();
  });

  it('orden y ordenSeparacion cuentan desde 1 sobre las operaciones de tortuga, sin el texto', () => {
    // La tercera operación de tortuga difiere; el ESCRIBE intermedio no cuenta.
    const r = ejecutarEnParalelo('AV 100 GD 90 AV 100', 'AV 100 ESCRIBE 1 GD 90 AV 40', 4);
    expect(r.divergencia).not.toBeNull();
    expect(r.divergencia!.indice).toBe(2);
    expect(r.divergencia!.orden).toBe(3);
    expect(r.ordenSeparacion).toBe(3);
  });

  it('una divergencia en la primera operación tiene orden 1', () => {
    const r = ejecutarEnParalelo('AV 100', 'AV 40', 4);
    expect(r.divergencia!.orden).toBe(1);
    expect(r.ordenSeparacion).toBe(1);
  });

  it('si el jugador es más corto, ordenSeparacion es su longitud + 1', () => {
    const r = ejecutarEnParalelo('AV 100 GD 90 AV 100', 'AV 100 ROTULA "fin', 4);
    expect(r.divergencia).toBeNull();
    expect(r.programaCortoSeLlamo).toBe('jugador');
    expect(r.ordenSeparacion).toBe(2);
  });

  it('si Kiro es más corto, ordenSeparacion es su longitud + 1 y el texto de Kiro no cuenta', () => {
    const r = compararOperaciones(
      operacionesDel('AV 100 ESCRIBE 1 ESCRIBE 2'),
      operacionesDel('AV 100 GD 90 AV 100'),
    );
    expect(r.programaCortoSeLlamo).toBe('kiro');
    expect(r.excesoDespuesDeIgual).toBe(true);
    expect(r.ordenSeparacion).toBe(2);
  });

  it('las dos ejecuciones comparten la semilla de AZAR', () => {
    // El primer AZAR 200 de cada semilla, calculado con el mismo PRNG que se inyecta.
    const primerAzar = (semilla: number): number => fabricaAzar(semilla)(200);
    const semillas = [0, 1, 7, 42, 2024, 123_456_789];
    for (const semilla of semillas) {
      const v = primerAzar(semilla);
      // Kiro usa AZAR; el jugador escribe el número que esa semilla produce.
      const r = ejecutarEnParalelo('AVANZA AZAR 200', `AVANZA ${v}`, 4, semilla);
      expect(r.divergencia).toBeNull();
      expect(r.ordenSeparacion).toBeNull();
      // AZAR contra AZAR nunca diverge, sea cual sea la semilla.
      expect(ejecutarEnParalelo('AVANZA AZAR 200', 'AVANZA AZAR 200', 4, semilla).divergencia).toBeNull();
    }
    // La semilla importa: alguna produce un avance distinto del de la semilla 0 por omisión.
    const distinta = semillas.find((s) => Math.abs(primerAzar(s) - primerAzar(0)) > 8);
    expect(distinta).toBeDefined();
    const conOmision = ejecutarEnParalelo('AVANZA AZAR 200', `AVANZA ${primerAzar(distinta!)}`, 4);
    expect(conOmision.divergencia).not.toBeNull();
  });
});
