// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import {
  crearComparacion,
  textoAnuncio,
  TEXTO_CONMUTADOR,
  type Comparacion,
  type DatosComparacion,
} from './comparacion.js';
import type { Diff, RegionesDiff, TrazosDiff } from './diff.js';
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
  const excesoVisual = crearMascara();
  encender(coincidencia, 400, 400);
  encender(exceso, 410, 410);
  encender(falta, 420, 420);
  // El excedente real a lo largo del trazo (Caso 1): varias celdas repartidas,
  // no una puntita. Distingue `excesoVisual` (marco real) de `exceso` (centrado).
  encender(excesoVisual, 400, 300);
  encender(excesoVisual, 400, 305);
  encender(excesoVisual, 400, 310);
  return {
    coincide: false,
    iou: 0.8234,
    excesoPorcentaje: 7.55,
    motivo: 'excesoDeTrazo',
    traslacion: { x: 0, y: 0 },
    traslacionObjetivo: { x: 0, y: 0 },
    angulo: 0,
    mascaraObjetivo: crearMascara(),
    mascaraJugador: crearMascara(),
    coincidencia,
    exceso,
    falta,
    excesoVisual,
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
    traslacionObjetivo: { x: 0, y: 0 },
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

describe('comparacion · conmutador', () => {
  it('tiene un texto estable en español, y es el estado el que cambia, no la etiqueta', () => {
    const { comp } = montar();
    expect(comp.conmutador.textContent).toBe(TEXTO_CONMUTADOR);
    expect(comp.conmutador.tagName).toBe('BUTTON');
    comp.alternarVista();
    expect(comp.conmutador.textContent).toBe(TEXTO_CONMUTADOR);
    expect(comp.conmutador.getAttribute('aria-pressed')).toBe('true');
  });

  it('cuelga el botón y la leyenda de los contenedores que recibe, cada uno en el suyo', () => {
    const botones = document.createElement('div');
    const leyendas = document.createElement('div');
    document.body.append(botones, leyendas);
    const comp = crearComparacion({
      contenedor: botones,
      contenedorLeyenda: leyendas,
      diff: { dibujar: () => {} },
      dibujarSuperposicion: () => {},
      anunciar: () => {},
    });
    expect(botones.contains(comp.conmutador)).toBe(true);
    expect(botones.contains(comp.leyenda)).toBe(false);
    expect(leyendas.contains(comp.leyenda)).toBe(true);
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

  it('reenvía excesoVisual del veredicto a las regiones del diff (requisitos 2.1, 3.4)', () => {
    // El veredicto del Caso 1 trae la máscara de exceso visual (marco real); debe
    // llegar tal cual a diff.dibujar para que el rojo cubra el excedente a lo largo
    // del trazo y no solo la puntita que marca `exceso`.
    const m = montar();
    const v = veredictoNegado();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: v });
    expect(m.diffLlamadas.length).toBe(1);
    expect(m.diffLlamadas[0]!.excesoVisual).toBe(v.excesoVisual);
    // No altera las demás regiones ni el exceso de conteo.
    expect(m.diffLlamadas[0]!.exceso).toBe(v.exceso);
    expect(m.diffLlamadas[0]!.coincidencia).toBe(v.coincidencia);
  });

  it('no dibuja el diff cuando la precisión se otorga', () => {
    const m = montar();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoOtorgado() });
    expect(m.diffLlamadas.length).toBe(0);
  });

  it('al pasar por su cuenta a la superposición deja el conmutador en estado presionado (requisito 4.2)', () => {
    // El requisito 4.2 exige, además de pasar a la superposición y dibujar el diff, que el
    // control quede presionado sin que el jugador lo toque: es la señal visible de la vista
    // en curso que pide el requisito 4.1. Se parte de lado a lado, sin presionar.
    const m = montar();
    expect(m.comp.conmutador.getAttribute('aria-pressed')).toBe('false');
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoNegado() });
    expect(m.comp.vista()).toBe('superposicion');
    expect(m.comp.conmutador.getAttribute('aria-pressed')).toBe('true');
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

describe('comparacion · aviso de cambio de vista', () => {
  function montarConAviso() {
    const cont = document.createElement('div');
    document.body.appendChild(cont);
    const vistas: string[] = [];
    const superposiciones: number[] = [];
    const diffs: RegionesDiff[] = [];
    const comp = crearComparacion({
      contenedor: cont,
      diff: { dibujar: (r) => diffs.push(r) },
      dibujarSuperposicion: () => superposiciones.push(1),
      anunciar: () => {},
      alCambiarVista: (v) => vistas.push(v),
    });
    return { comp, vistas, superposiciones, diffs };
  }

  it('avisa la vista inicial y cada cambio del conmutador, para mostrar u ocultar el lienzo', () => {
    const { comp, vistas } = montarConAviso();
    expect(vistas).toEqual(['ladoALado']);
    comp.conmutador.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    comp.conmutador.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(vistas).toEqual(['ladoALado', 'superposicion', 'ladoALado']);
  });

  it('avisa que pasó a superposición cuando se niega la precisión sin que el jugador actúe', () => {
    const { comp, vistas } = montarConAviso();
    comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoNegado() });
    expect(vistas.at(-1)).toBe('superposicion');
  });

  it('es opcional: sin él la comparación funciona igual', () => {
    const { comp } = montar();
    expect(() => comp.alternarVista()).not.toThrow();
  });
});

describe('comparacion · restablecer y redibujar', () => {
  function montarConDatos() {
    const cont = document.createElement('div');
    document.body.appendChild(cont);
    const vistas: string[] = [];
    const diffs: RegionesDiff[] = [];
    const anuncios: string[] = [];
    let superposiciones = 0;
    const comp = crearComparacion({
      contenedor: cont,
      diff: { dibujar: (r) => diffs.push(r) },
      dibujarSuperposicion: () => (superposiciones += 1),
      anunciar: (t) => anuncios.push(t),
      alCambiarVista: (v) => vistas.push(v),
    });
    return { comp, vistas, diffs, anuncios, superposiciones: () => superposiciones };
  }

  it('restablecer vuelve a lado a lado y avisa el cambio', () => {
    const m = montarConDatos();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoNegado() });
    expect(m.comp.vista()).toBe('superposicion');

    m.comp.restablecer();

    expect(m.comp.vista()).toBe('ladoALado');
    expect(m.comp.conmutador.getAttribute('aria-pressed')).toBe('false');
    expect(m.vistas.at(-1)).toBe('ladoALado');
  });

  it('restablecer olvida la comparación: al pasar a superposición no vuelve a dibujar el diff viejo', () => {
    const m = montarConDatos();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoNegado() });
    const diffsAntes = m.diffs.length;

    m.comp.restablecer();
    m.comp.alternarVista(); // el jugador abre la superposición a mano
    m.comp.redibujar();

    expect(m.comp.vista()).toBe('superposicion');
    expect(m.diffs.length).toBe(diffsAntes);
  });

  it('redibujar en superposición repinta las estelas y el diff sin anunciar de nuevo', () => {
    const m = montarConDatos();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoNegado() });
    const anunciosAntes = m.anuncios.length;
    const diffsAntes = m.diffs.length;
    const superAntes = m.superposiciones();

    m.comp.redibujar();

    expect(m.superposiciones()).toBe(superAntes + 1);
    expect(m.diffs.length).toBe(diffsAntes + 1);
    expect(m.anuncios.length).toBe(anunciosAntes);
  });

  it('redibujar en lado a lado no dibuja el diff', () => {
    const m = montarConDatos();
    m.comp.redibujar();
    expect(m.diffs.length).toBe(0);
    expect(m.comp.vista()).toBe('ladoALado');
  });

  it('redibujar con la precisión otorgada no dibuja el diff', () => {
    const m = montarConDatos();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoOtorgado() });
    m.comp.alternarVista();
    m.comp.redibujar();
    expect(m.diffs.length).toBe(0);
  });
});

describe('comparacion · leyenda de la superposición', () => {
  it('nombra las tres regiones por lo que significan, en orden, con una muestra de trazo cada una', () => {
    const { comp } = montar();
    const items = [...comp.leyenda.querySelectorAll('.kl-leyenda-item')];
    expect(items.map((i) => i.textContent)).toEqual(['lo que coincide', 'lo que sobra', 'lo que falta']);
    for (const item of items) {
      const muestra = item.querySelector('.kl-leyenda-muestra');
      expect(muestra).not.toBeNull();
      expect(muestra!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('la leyenda solo se ve en la vista superpuesta, y tiene nombre accesible', () => {
    const { comp } = montar();
    expect(comp.leyenda.hidden).toBe(true);
    comp.alternarVista();
    expect(comp.leyenda.hidden).toBe(false);
    comp.alternarVista();
    expect(comp.leyenda.hidden).toBe(true);
    expect(comp.leyenda.getAttribute('aria-label')).toBe('Qué significa cada trazo');
  });
});

describe('comparacion · el diff recibe los trazos y se conserva', () => {
  function montarConTrazos() {
    const cont = document.createElement('div');
    document.body.appendChild(cont);
    const llamadas: Array<{ r: RegionesDiff; t: TrazosDiff | undefined }> = [];
    const comp = crearComparacion({
      contenedor: cont,
      diff: { dibujar: (r, t) => llamadas.push({ r, t }) },
      dibujarSuperposicion: () => {},
      anunciar: () => {},
    });
    return { comp, llamadas };
  }
  const OTRO: readonly Segmento[] = [{ desde: { x: 0, y: 0 }, hasta: { x: 0, y: 100 }, paso: 0, linea: 1 }];

  it('entrega al diff los trazos de las dos figuras, para que dibuje líneas limpias', () => {
    const m = montarConTrazos();
    m.comp.mostrar({ segmentosReferencia: OTRO, segmentosJugador: SEG, veredicto: veredictoNegado() });
    expect(m.llamadas).toHaveLength(1);
    expect(m.llamadas[0]!.t?.referencia).toBe(OTRO);
    expect(m.llamadas[0]!.t?.jugador).toBe(SEG);
  });

  it('si el jugador cambia de vista y vuelve, el diff sigue en pantalla (requisito 23.10)', () => {
    const m = montarConTrazos();
    m.comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoNegado() });
    expect(m.llamadas).toHaveLength(1);

    m.comp.alternarVista(); // a lado a lado: no hay nada que dibujar
    expect(m.llamadas).toHaveLength(1);
    m.comp.alternarVista(); // de vuelta a la superposición: se repinta el diff
    expect(m.comp.vista()).toBe('superposicion');
    expect(m.llamadas).toHaveLength(2);
  });

  it('con la superposición abierta, un intento que gana la precisión la repinta sin diff', () => {
    const cont = document.createElement('div');
    document.body.appendChild(cont);
    let superposiciones = 0;
    const llamadas: unknown[] = [];
    const comp = crearComparacion({
      contenedor: cont,
      diff: { dibujar: (r) => llamadas.push(r) },
      dibujarSuperposicion: () => (superposiciones += 1),
      anunciar: () => {},
    });
    comp.alternarVista();
    const antes = superposiciones;
    comp.mostrar({ segmentosReferencia: SEG, segmentosJugador: SEG, veredicto: veredictoOtorgado() });
    expect(superposiciones).toBe(antes + 1);
    expect(llamadas).toHaveLength(0);
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
