// @vitest-environment jsdom

// Property 15 (parte B, demostración): Lo que se dibujó es exactamente lo que se valida.
// Valida: Requisitos 22.3, 22.5, 28.2.
//
// La demostración entrega al animador la secuencia que ya trae el reto, sobre la
// capa de referencia. Los tramos que quedan dibujados en esa capa han de ser los
// mismos segmentos que el validador toma como objetivo (los del reto), con los
// mismos puntos y en el mismo orden, sea cual sea la velocidad y el número de
// repeticiones.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import { crearDemostracion } from './demostracion.js';
import { crearAnimador, type Reloj, DURACIONES, type Velocidad } from '../motor/animador.js';
import { GROSOR_TRAZO, type EstiloPersonajes } from '../motor/personajes.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';
import type { Segmento } from '../motor/segmentos.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { resolverReto } from '../juego/reto.js';

const VELOCIDADES: readonly Velocidad[] = ['lenta', 'normal', 'rapida', 'inmediata'];

function estiloPersonajes(): EstiloPersonajes {
  return {
    contorno: '#212529',
    relleno: '#ffffff',
    cabeza: '#343a40',
    kiroContorno: '#0d6efd',
    kiroRelleno: 'rgba(13,110,253,0.1)',
    lapizContorno: '#dc3545',
    marcaRumbo: '#ff6b6b',
    grosor: GROSOR_TRAZO,
  };
}

function relojFalso(): Reloj & { correr(): void } {
  let t = 0;
  let pendiente: ((ahora: number) => void) | null = null;
  return {
    programar(cb: (ahora: number) => void): number {
      pendiente = cb;
      return 1;
    },
    cancelar(): void {
      pendiente = null;
    },
    ahora(): number {
      return t;
    },
    correr(): void {
      let guarda = 0;
      while (pendiente !== null && guarda < 100000) {
        const cb = pendiente;
        pendiente = null;
        t += DURACIONES.lenta + 1; // supera cualquier duración por fotograma
        cb(t);
        guarda += 1;
      }
    },
  };
}

class LienzoDoble {
  readonly personajes = { llamadas: [] as unknown[] };
  readonly estelas: Record<'jugador' | 'referencia', Segmento[]> = { jugador: [], referencia: [] };
  crecerEstela(capa: 'jugador' | 'referencia', segmentos: readonly Segmento[]): void {
    for (const s of segmentos) this.estelas[capa].push({ ...s });
  }
  limpiarEstela(capa: 'jugador' | 'referencia'): void {
    this.estelas[capa] = [];
  }
  capaPersonajes() {
    // Doble mínimo: la demostración solo necesita un ContextoDibujo válido.
    return crearContextoNulo();
  }
  limpiarPersonajes(): void {}
}

/** ContextoDibujo que no hace nada: la propiedad no mira los personajes. */
function crearContextoNulo() {
  const nada = () => {};
  return {
    save: nada, restore: nada, setTransform: nada, translate: nada, rotate: nada,
    scale: nada, beginPath: nada, closePath: nada, moveTo: nada, lineTo: nada,
    quadraticCurveTo: nada, bezierCurveTo: nada, arc: nada, ellipse: nada, rect: nada,
    clip: nada, fill: nada, stroke: nada, clearRect: nada, setLineDash: nada,
    lineWidth: 1, lineCap: 'butt' as CanvasLineCap, lineJoin: 'miter' as CanvasLineJoin,
    strokeStyle: '#000', fillStyle: '#000',
  };
}

function segmentosIguales(a: readonly Segmento[], b: readonly Segmento[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const s = a[i]!;
    const t = b[i]!;
    if (s.desde.x !== t.desde.x || s.desde.y !== t.desde.y) return false;
    if (s.hasta.x !== t.hasta.x || s.hasta.y !== t.hasta.y) return false;
  }
  return true;
}

describe('Property 15B · lo dibujado en la demostración es lo que se valida', () => {
  it('los tramos en referencia son los segmentos del reto, en cualquier velocidad y repetición', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng(semilla);
        const velocidad = VELOCIDADES[prng.entero(0, VELOCIDADES.length - 1)]!;
        const repeticiones = prng.entero(1, 3);

        const resuelto = resolverReto('0.1', 42);
        expect(resuelto.exito).toBe(true);
        if (!resuelto.exito) return;
        const reto = resuelto.reto;

        // Los segmentos objetivo del validador son extraerSegmentos(operaciones).
        const objetivo = extraerSegmentos(reto.operaciones);
        expect(segmentosIguales(objetivo, reto.segmentos)).toBe(true);

        const lienzo = new LienzoDoble();
        const reloj = relojFalso();
        const animador = crearAnimador(lienzo, reloj, () => false);
        const demo = crearDemostracion({
          lienzo,
          animador,
          operaciones: reto.operaciones,
          estadoInicial: ESTADO_INICIAL,
          leerTemaPersonajes: estiloPersonajes,
          relojEspera: { programar: (cb) => (cb(), 1), cancelar: () => {} },
          anunciar: () => {},
          avisarSinDemostracion: () => {},
        });
        demo.ponerVelocidad(velocidad);

        for (let r = 0; r < repeticiones; r++) {
          if (r === 0) demo.reproducir();
          else demo.repetir();
          reloj.correr();
        }

        // Tras cualquier número de repeticiones, la referencia tiene exactamente
        // los segmentos objetivo, con los mismos puntos y en el mismo orden.
        expect(segmentosIguales(lienzo.estelas.referencia, objetivo)).toBe(true);
        expect(lienzo.estelas.jugador.length).toBe(0);
      }),
      { seed: 15, numRuns: 200 },
    );
  });
});
