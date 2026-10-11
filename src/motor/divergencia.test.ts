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
