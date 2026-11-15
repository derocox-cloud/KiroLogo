// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import { crearGloboKiro, mensajeNegacion, type GloboKiro, type IdentidadReto } from './globo-kiro.js';
import { calificar, type Calificacion } from '../juego/estrellas.js';
import { resolverReto, type Reto } from '../juego/reto.js';
import { crearMascara, type Veredicto } from '../motor/validador.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import type { Programa } from '../lenguaje/ast.js';
import type { ExigenciaAbstraccion } from '../niveles/tipos.js';
import { crearError } from '../lenguaje/errores.js';

const PISTAS: readonly [string, string, string] = [
  'La tortuga solo camina hacia adelante.',
  'Cada cuadro mide 20 unidades.',
  'Empieza con el comando AVANZA seguido de un número.',
];

const IDENTIDAD_0_1: IdentidadReto = { idNivel: '0.1', semillaEfectiva: 42, pistas: PISTAS };

interface Montaje {
  readonly globo: GloboKiro;
  readonly anuncios: string[];
}

function montar(): Montaje {
  const cont = document.createElement('div');
  document.body.appendChild(cont);
  const anuncios: string[] = [];
  const globo = crearGloboKiro({ contenedor: cont, anunciar: (t) => anuncios.push(t) });
  globo.presentarReto(IDENTIDAD_0_1);
  return { globo, anuncios };
}

function calificacion(otorgadas: { p: boolean; e: boolean; a: boolean }): Calificacion {
  const neg = { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } };
  const ok = { otorgada: true as const };
  return {
    precision: otorgadas.p ? ok : neg,
    economia: otorgadas.e
      ? ok
      : { otorgada: false, motivo: { clave: 'presupuestoExcedido', conteo: 3, presupuesto: 1 } },
    abstraccion: otorgadas.a ? ok : neg,
    conteoJugador: 3,
    presupuestoEstrella: 1,
    mensajeAbstraccion: null,
  };
}

describe('globo-kiro · comentario de resultado', () => {
  it('nombra las tres estrellas y su estado en 300 caracteres o menos', () => {
    const { globo, anuncios } = montar();
    globo.comentarCalificacion(calificacion({ p: true, e: false, a: false }));
    const t = globo.texto();
    expect(t).toContain('precisión');
    expect(t).toContain('economía');
    expect(t).toContain('abstracción');
    expect(t).toContain('otorgada');
    expect(t).toContain('negada');
    expect(t.length).toBeLessThanOrEqual(300);
    expect(anuncios.at(-1)).toBe(t);
  });
});

describe('globo-kiro · explicación de abstracción y pistas multilínea (D7)', () => {
  it('pone el resultado en la primera línea, una línea por invitación y sin el detalle genérico', () => {
    const { globo, anuncios } = montar();
    const largo = 'x'.repeat(250);
    globo.comentarCalificacion({
      ...calificacion({ p: true, e: true, a: false }),
      abstraccion: {
        otorgada: false,
        motivo: { clave: 'exigenciasSinConfirmar', claves: ['usaRepite', 'usaParametros'] },
      },
      mensajeAbstraccion: `Primera invitación.\n${largo}`,
    });
    const lineas = [...globo.raiz.querySelectorAll('.kl-globo-mensaje')].map((p) => p.textContent);
    expect(lineas).toHaveLength(3);
    expect(lineas[0]).toMatch(/^Resultado: /);
    expect(lineas[1]).toBe('Primera invitación.');
    expect(lineas[2]).toBe(largo);
    expect(globo.texto()).not.toContain('Todavía falta cumplir');
    expect(anuncios.at(-1)).toBe(lineas.join('\n'));
  });

  it('muestra cada línea de una pista con saltos de línea en su propio párrafo', () => {
    const { globo } = montar();
    globo.presentarReto({ ...IDENTIDAD_0_1, pistas: ['a', 'b', 'PARA x\n  ___\nFIN'] });
    globo.pedirPista();
    globo.pedirPista();
    globo.pedirPista();
    const lineas = [...globo.raiz.querySelectorAll('.kl-globo-mensaje')].map((p) => p.textContent);
    expect(lineas).toEqual(['Pista esqueleto: PARA x', '  ___', 'FIN']);
  });
});

// Del intento a lo que Kiro dice: `calificar` sobre un reto real del mundo 4 y el globo
// mostrando el resultado. Los textos de R22.4 van escritos a mano para que un cambio en el
// catálogo no pase sin que esta prueba lo note.
describe('globo-kiro · invitaciones de abstracción del mundo 4 (R22)', () => {
  const TEXTO_PARAMETROS =
    'Lo lograste, pero dibujaste con números fijos. Intenta enseñarme un PARA con parámetros, como :lados, y luego pídemelo cambiando los números.';
  const textoProcedimientos = (definidos: number, maximo: number): string =>
    `Lo lograste, pero definiste ${definidos} procedimientos y para este reto basta con ${maximo}. Enséñame uno solo con parámetros y pídemelo varias veces con números distintos.`;
  const GENERICO = 'Todavía falta cumplir';

  const TRES_PARA_SIN_PARAMETROS =
    'PARA A\nAVANZA 20\nFIN\nPARA B\nAVANZA 20\nFIN\nPARA C\nAVANZA 20\nFIN\nA\nB\nC';
  const DOS_PARA_CON_PARAMETROS = 'PARA L :x\nAVANZA :x\nFIN\nPARA M :y\nAVANZA :y\nFIN\nL 20\nM 20';
  const UN_PARA_CON_PARAMETROS = 'PARA L :x\nAVANZA :x\nFIN\nL 20';

  function programa(texto: string): Programa {
    const lexico = analizarLexico(texto);
    expect(lexico.errores, texto).toEqual([]);
    const { programa: ast, errores } = analizar(lexico.tokens, { mundo: 4 });
    expect(errores, texto).toEqual([]);
    return ast!;
  }

  function veredicto(coincide: boolean): Veredicto {
    const vacia = crearMascara();
    return {
      coincide,
      iou: coincide ? 1 : 0.3,
      excesoPorcentaje: 0,
      motivo: coincide ? 'coincide' : 'iouInsuficiente',
      traslacion: { x: 0, y: 0 },
      traslacionObjetivo: { x: 0, y: 0 },
      angulo: 0,
      mascaraObjetivo: vacia,
      mascaraJugador: vacia,
      coincidencia: vacia,
      exceso: vacia,
      falta: vacia,
    };
  }

  /** Reto real del 4.2; `exigencias` reemplaza las del nivel cuando se quiere otro orden. */
  function reto42(exigencias?: readonly ExigenciaAbstraccion[]): Reto {
    const r = resolverReto('4.2', 0);
    if (!r.exito) throw new Error('no se pudo resolver 4.2');
    return exigencias === undefined ? r.reto : { ...r.reto, nivel: { ...r.reto.nivel, abstraccion: exigencias } };
  }

  function comentar(texto: string, reto: Reto, coincide = true): { lineas: string[]; anuncio: string } {
    const { globo, anuncios } = montar();
    globo.comentarCalificacion(calificar(programa(texto), veredicto(coincide), reto));
    const lineas = [...globo.raiz.querySelectorAll('.kl-globo-mensaje')].map((p) => p.textContent ?? '');
    return { lineas, anuncio: anuncios.at(-1) ?? '' };
  }

  it('muestra el texto exacto de usaParametros, sin el genérico', () => {
    const { lineas } = comentar('AVANZA 20', reto42([{ clave: 'usaParametros' }]));
    expect(lineas).toHaveLength(2);
    expect(lineas[1]).toBe(TEXTO_PARAMETROS);
    expect(lineas.join('\n')).not.toContain(GENERICO);
  });

  it('muestra el texto exacto de maximoProcedimientos con definidos y máximo sustituidos', () => {
    const { lineas } = comentar(DOS_PARA_CON_PARAMETROS, reto42());
    expect(lineas).toEqual([expect.stringMatching(/^Resultado: /), textoProcedimientos(2, 1)]);
    expect(lineas.join('\n')).not.toContain(GENERICO);
  });

  it('pone las dos invitaciones en un solo globo, una por línea, en el orden del nivel', () => {
    const enOrden = comentar(TRES_PARA_SIN_PARAMETROS, reto42());
    expect(enOrden.lineas.slice(1)).toEqual([TEXTO_PARAMETROS, textoProcedimientos(3, 1)]);
    expect(enOrden.anuncio).toBe(enOrden.lineas.join('\n'));
    expect(enOrden.anuncio).not.toContain(GENERICO);

    const alReves = comentar(
      TRES_PARA_SIN_PARAMETROS,
      reto42([{ clave: 'maximoProcedimientos', maximo: 1 }, { clave: 'usaParametros' }]),
    );
    expect(alReves.lineas.slice(1)).toEqual([textoProcedimientos(3, 1), TEXTO_PARAMETROS]);
  });

  it('no recorta a 300 caracteres: el globo completo supera ese largo y cada línea queda entera', () => {
    const { lineas, anuncio } = comentar(TRES_PARA_SIN_PARAMETROS, reto42());
    expect(anuncio.length).toBeGreaterThan(300);
    expect(lineas[1]).toBe(TEXTO_PARAMETROS);
    expect(lineas[2]).toBe(textoProcedimientos(3, 1));
  });

  it('no muestra ninguna invitación sin la estrella de precisión', () => {
    const { lineas } = comentar(TRES_PARA_SIN_PARAMETROS, reto42(), false);
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toMatch(/^Resultado: precisión negada/);
    expect(lineas[0]).not.toContain('Lo lograste');
  });

  it('no muestra ninguna invitación cuando todas las exigencias se confirman', () => {
    const { lineas } = comentar(UN_PARA_CON_PARAMETROS, reto42());
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toMatch(/abstracción otorgada\./);
    expect(lineas[0]).not.toContain('Lo lograste');
  });
});

describe('globo-kiro · mensajes del catálogo', () => {
  it('muestra el texto exacto, en orden y hasta 20', () => {
    const { globo } = montar();
    const e1 = crearError('argumentoFaltante', { comando: 'AVANZA' });
    const e2 = crearError('corcheteSinCerrar', {});
    globo.mostrarMensajes([e1, e2]);
    const parrafos = globo.raiz.querySelectorAll('.kl-globo-mensaje');
    expect(parrafos.length).toBe(2);
    expect(parrafos[0]!.textContent).toBe(e1.mensaje);
    expect(parrafos[1]!.textContent).toBe(e2.mensaje);
  });

  it('no agrega nombre de excepción ni traza ni código', () => {
    const { globo } = montar();
    const e = crearError('caracterNoValido', {});
    globo.mostrarMensajes([e]);
    expect(globo.texto()).toBe(e.mensaje);
  });
});

describe('globo-kiro · escalones de pista', () => {
  let m: Montaje;
  beforeEach(() => {
    m = montar();
  });

  it('muestra los tres escalones en orden y sube el contador de 0 a 3', () => {
    expect(m.globo.escalonesAbiertos()).toBe(0);
    m.globo.pedirPista();
    expect(m.globo.escalonesAbiertos()).toBe(1);
    expect(m.globo.texto()).toContain(PISTAS[0]);
    m.globo.pedirPista();
    expect(m.globo.escalonesAbiertos()).toBe(2);
    expect(m.globo.texto()).toContain(PISTAS[1]);
    m.globo.pedirPista();
    expect(m.globo.escalonesAbiertos()).toBe(3);
    expect(m.globo.texto()).toContain(PISTAS[2]);
  });

  it('nunca muestra el programa de referencia', () => {
    m.globo.pedirPista();
    m.globo.pedirPista();
    m.globo.pedirPista();
    expect(m.globo.texto()).not.toContain('AVANZA 100');
  });

  it('la cuarta pista conserva el tercer escalón, informa que no hay más y deja el contador en 3', () => {
    m.globo.pedirPista();
    m.globo.pedirPista();
    m.globo.pedirPista();
    m.globo.pedirPista();
    expect(m.globo.escalonesAbiertos()).toBe(3);
    // Conserva el tercer escalón visible.
    expect(m.globo.texto()).toContain(PISTAS[2]);
    // Informa que no hay más, en 200 caracteres o menos.
    const aviso = m.globo.raiz.querySelector('.kl-globo-sin-mas')!;
    expect(aviso.textContent!.length).toBeLessThanOrEqual(200);
    expect(m.anuncios.at(-1)!.length).toBeLessThanOrEqual(200);
  });
});

describe('globo-kiro · reinicio del contador', () => {
  it('vuelve a 0 al cambiar de idNivel', () => {
    const { globo } = montar();
    globo.pedirPista();
    globo.pedirPista();
    expect(globo.escalonesAbiertos()).toBe(2);
    globo.presentarReto({ idNivel: '0.2', semillaEfectiva: 42, pistas: PISTAS });
    expect(globo.escalonesAbiertos()).toBe(0);
  });

  it('vuelve a 0 al cambiar la semilla efectiva', () => {
    const { globo } = montar();
    globo.pedirPista();
    globo.presentarReto({ idNivel: '0.1', semillaEfectiva: 99, pistas: PISTAS });
    expect(globo.escalonesAbiertos()).toBe(0);
  });

  it('no reinicia el contador al presentar el mismo reto (reejecución/reinicio)', () => {
    const { globo } = montar();
    globo.pedirPista();
    globo.pedirPista();
    globo.presentarReto(IDENTIDAD_0_1); // mismo id y semilla
    expect(globo.escalonesAbiertos()).toBe(2);
  });
});

describe('globo-kiro · negación de economía y abstracción', () => {
  it('nombra los enteros de economía en una oración de 200 caracteres o menos', () => {
    const texto = mensajeNegacion({ clave: 'presupuestoExcedido', conteo: 3, presupuesto: 1 });
    expect(texto).toContain('3');
    expect(texto).toContain('1');
    expect(texto.length).toBeLessThanOrEqual(200);
  });

  it('nombra la primera exigencia sin confirmar de abstracción', () => {
    const texto = mensajeNegacion({ clave: 'exigenciasSinConfirmar', claves: ['usaRepite', 'defineProcedimiento'] });
    expect(texto).toContain('usaRepite');
    expect(texto.length).toBeLessThanOrEqual(200);
  });
});

describe('globo-kiro · aria-live y botón de pista', () => {
  it('publica cada cambio y nunca usa assertive; no mueve el foco', () => {
    const { globo, anuncios } = montar();
    globo.celebrar('¡Muy bien!');
    expect(anuncios.at(-1)).toBe('¡Muy bien!');
    // El botón de pista es un único elemento interactivo con nombre accesible.
    expect(globo.botonPista.tagName).toBe('BUTTON');
    expect((globo.botonPista.getAttribute('aria-label') ?? '').length).toBeGreaterThan(0);
  });

  it('el botón de pedir pista abre el siguiente escalón al hacer click', () => {
    const { globo } = montar();
    globo.botonPista.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(globo.escalonesAbiertos()).toBe(1);
    expect(globo.texto()).toContain(PISTAS[0]);
  });
});

describe('globo-kiro · callback alAbrirPista (R11.1)', () => {
  function montarConCallback(): { globo: GloboKiro; contar(): number } {
    const cont = document.createElement('div');
    document.body.appendChild(cont);
    let aperturas = 0;
    const globo = crearGloboKiro({
      contenedor: cont,
      anunciar: () => {},
      alAbrirPista: () => {
        aperturas += 1;
      },
    });
    globo.presentarReto(IDENTIDAD_0_1);
    return { globo, contar: () => aperturas };
  }

  it('se invoca una vez por cada escalón que se muestra', () => {
    const { globo, contar } = montarConCallback();
    globo.pedirPista();
    expect(contar()).toBe(1);
    globo.pedirPista();
    expect(contar()).toBe(2);
    globo.pedirPista();
    expect(contar()).toBe(3);
  });

  it('no se invoca con el aviso «Ya te di todas las pistas de este reto»', () => {
    const { globo, contar } = montarConCallback();
    globo.pedirPista();
    globo.pedirPista();
    globo.pedirPista();
    globo.pedirPista();
    expect(globo.texto()).toContain('Ya te di todas las pistas de este reto.');
    expect(contar()).toBe(3);
  });

  it('no se invoca si todavía no hay un reto presentado', () => {
    const cont = document.createElement('div');
    document.body.appendChild(cont);
    let n = 0;
    const globo = crearGloboKiro({ contenedor: cont, anunciar: () => {}, alAbrirPista: () => (n += 1) });
    globo.pedirPista();
    expect(n).toBe(0);
  });

  it('el callback es opcional: sin él, pedir pista funciona igual', () => {
    const { globo } = montar();
    expect(() => globo.pedirPista()).not.toThrow();
    expect(globo.escalonesAbiertos()).toBe(1);
  });
});
