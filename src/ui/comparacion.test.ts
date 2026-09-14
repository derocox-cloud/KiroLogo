// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { crearComparacion, textoAnuncio, type Comparacion, type DatosComparacion } from './comparacion.js';
import type { Diff, RegionesDiff } from './diff.js';
import { crearMascara, LADO, type Veredicto, type Mascara } from '../motor/validador.js';
import type { Segmento } from '../motor/segmentos.js';

function encender(m: Mascara, ix: number, iy: number): void {
  m[iy * LADO + ix] = 1;
}

/** Veredicto con precisión negada por exceso de trazo. */
function veredictoNegado(): Veredicto {
  const coincidencia = crearMascara();
  const exceso = crearMascara();
  const falta = crearMascara();
  encender(coincidencia, 400, 400);
  encender(exceso, 410, 410);
  encender(falta, 420, 420);
  return {
    coincide: false,
    iou: 0.8234,
    excesoPorcentaje: 7.55,
    motivo: 'excesoDeTrazo',
    traslacion: { x: 0, y: 0 },
    angulo: 0,
    mascaraObjetivo: crearMascara(),
    mascaraJugador: crearMascara(),
    coincidencia,
    exceso,
    falta,
  };
}

/** Veredicto de coincidencia (precisión otorgada). */
function veredictoOtorgado(): Veredicto {
  return { ...veredictoNegado(), coincide: true, iou: 0.95, excesoPorcentaje: 1.2, motivo: 'coincide' };
}

/** Veredicto sin estela del jugador. */
function veredictoSinEstela(): Veredicto {
  const falta = crearMascara();
  encender(falta, 420, 420);
  return {
    coincide: false,
    iou: 0,
    excesoPorcentaje: 0,
    motivo: 'sinEstelaDelJugador',
    traslacion: { x: 0, y: 0 },
    angulo: 0,
    mascaraObjetivo: crearMascara(),
    mascaraJugador: crearMascara(),
    coincidencia: crearMascara(),
    exceso: crearMascara(),
    falta,
  };
}

interface Montaje {
  readonly comp: Comparacion;
  readonly diffLlamadas: RegionesDiff[];
  readonly superLlamadas: number;
  readonly anuncios: string[];
}

function montar(): Montaje {
  const cont = document.createElement('div');
  document.body.appendChild(cont);
  const diffLlamadas: RegionesDiff[] = [];
  const superLlamadas = { n: 0 };
  const anuncios: string[] = [];
  const diff: Diff = { dibujar: (r) => diffLlamadas.push(r) };
  const comp = crearComparacion({
    contenedor: cont,
    diff,
    dibujarSuperposicion: () => (superLlamadas.n += 1),
    anunciar: (t) => anuncios.push(t),
  });
  return {
    comp,
    diffLlamadas,
    get superLlamadas() {
      return superLlamadas.n;
    },
    anuncios,
  };
}

const SEG: readonly Segmento[] = [{ desde: { x: 0, y: 0 }, hasta: { x: 100, y: 0 }, paso: 0, linea: 1 }];

describe('comparacion · rótulos y conmutador', () => {
  it('rotula cada figura con texto en español que identifica de quién es', () => {
    const { comp } = montar();
    expect(comp.raiz.textContent).toContain('Figura de Kiro');
    expect(comp.raiz.textContent).toContain('Tu figura');
  });

  it('empieza en lado a lado y el conmutador alterna a superposición', () => {
    const { comp } = montar();
    expect(comp.vista()).toBe('ladoALado');
    expect(comp.conmutador.getAttribute('aria-pressed')).toBe('false');
    comp.conmutador.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(comp.vista()).toBe('superposicion');
    expect(comp.conmutador.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('comparacion · diff sobre la superposición al negar precisión', () => {
  it('pasa a superposición y dibuja el diff sin que el jugador active nada', () => {
    const m = montar();
    const datos: DatosComparacion = {
      segmentosReferencia: SEG,
      segmentosJugador: SEG,
      veredicto: veredictoNegado(),
    };
    m.comp.mostrar(datos);
    expect(m.comp.vista()).toBe('superposicion');
    expect(m.diffLlamadas.length).toBe(1);
  });

  it('no dibuja el diff cuando la precisión se otorga', () => {
    const m = montar();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoOtorgado() });
    expect(m.diffLlamadas.length).toBe(0);
  });
});

describe('comparacion · anuncio en aria-live', () => {
  it('anuncia el IoU a 2 decimales y el exceso a 1 decimal', () => {
    const m = montar();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoNegado() });
    const ultimo = m.anuncios.at(-1)!;
    expect(ultimo).toContain('0.82'); // IoU a 2 decimales
    expect(ultimo).toContain((7.55).toFixed(1)); // exceso a 1 decimal
    // El IoU aparece con exactamente dos decimales y el exceso con uno.
    expect(ultimo).toMatch(/IoU\) de \d+\.\d{2}\b/);
    expect(ultimo).toMatch(/del \d+\.\d %/);
    expect(ultimo).toContain('sobra');
    expect(ultimo).toContain('falta');
  });

  it('el texto no nombra ningún color como único identificador', () => {
    const texto = textoAnuncio(veredictoNegado());
    expect(texto.toLowerCase()).not.toContain('verde');
    expect(texto.toLowerCase()).not.toContain('rojo');
    expect(texto.toLowerCase()).not.toContain('gris');
  });
});

describe('comparacion · sin estela del jugador', () => {
  it('anuncia que no hay estela y deja el conmutador operable', () => {
    const m = montar();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: [], veredicto: veredictoSinEstela() });
    expect(m.anuncios.at(-1)).toContain('Todavía no hay estela');
    // El conmutador sigue operable.
    expect(m.comp.conmutador.disabled).toBe(false);
    m.comp.conmutador.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(m.comp.vista()).toBe('superposicion');
  });

  it('con veredicto null anuncia también que no hay estela', () => {
    const m = montar();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: [], veredicto: null });
    expect(m.anuncios.at(-1)).toContain('Todavía no hay estela');
  });
});
