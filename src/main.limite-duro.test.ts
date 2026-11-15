// @vitest-environment jsdom
//
// Límite duro de punta a punta en el nivel 4.3 (spec 05, tarea 15.3). El caso concreto que el
// nivel quiere provocar: el jugador ve cuatro polígonos encajados y escribe un `REPITE` a mano por
// cada uno, sin `PARA`. Ese programa no se ejecuta, Kiro da la cuenta exacta y el contador del
// editor lo anticipa por texto antes de pulsar «Ejecutar». La propiedad general de la guarda
// (emite si y solo si el conteo cabe) vive en `juego/reto.mundo-4.propiedad.test.ts`; aquí se
// recorre el escenario del enunciado y la retirada de la señal del contador.
//
// Requirements: 18.7, 25.11

import { describe, it, expect, afterEach } from 'vitest';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from './main.js';
import type { Reloj } from './motor/animador.js';
import type { RelojEspera } from './ui/demostracion.js';
import type { RelojRebote } from './ui/editor.js';
import type { Expresion, InvocacionProcedimiento } from './lenguaje/ast.js';
import { crearError } from './lenguaje/errores.js';
import { imprimir } from './lenguaje/impresor.js';
import { resolverReto, type Reto } from './juego/reto.js';
import { cargarProgreso } from './juego/progreso.js';
import type { Calificacion } from './juego/estrellas.js';
import { CATALOGO } from './niveles/catalogo.js';

const TEXTO_BLOQUEO = 'Este programa no se podrá ejecutar: pasa del límite';

function montarDom(): void {
  document.documentElement.lang = 'es';
  document.body.innerHTML = `
    <div id="aplicacion" role="application" aria-label="KiroLogo">
      <div id="anuncios" aria-live="polite" aria-atomic="true"></div>
      <canvas id="lienzo-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-jugador" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-jugador" width="800" height="800"></canvas>
    </div>
  `;
}

function relojInmediato(): Reloj {
  let t = 0;
  return {
    programar(cb: (ahora: number) => void): number {
      t += 100000;
      cb(t);
      return 1;
    },
    cancelar(): void {},
    ahora: () => t,
  };
}

const relojEsperaInerte: RelojEspera = { programar: () => 1, cancelar: () => {} };
const relojReboteInmediato: RelojRebote = {
  programar(cb: () => void): number {
    cb();
    return 1;
  },
  cancelar(): void {},
};
const movimientoReducido: ConsultaMovimiento = { reducido: () => true, alCambiar: () => () => {} };

const APROBADO: Calificacion = {
  precision: { otorgada: true },
  economia: { otorgada: true },
  abstraccion: { otorgada: true },
  conteoJugador: 1,
  presupuestoEstrella: 1,
  mensajeAbstraccion: null,
};

function llamadasDe(reto: Reto): InvocacionProcedimiento[] {
  return reto.referencia.instrucciones.filter(
    (i): i is InvocacionProcedimiento => i.tipo === 'invocacionProcedimiento',
  );
}

/** Primera semilla del 4.3 cuya referencia dibuja `copias` polígonos. */
function semillaConCopias(copias: number): number {
  for (let semilla = 0; semilla < 1000; semilla++) {
    const r = resolverReto('4.3', semilla);
    if (r.exito && llamadasDe(r.reto).length === copias) return semilla;
  }
  throw new Error(`ninguna semilla del 4.3 da ${copias} polígonos`);
}

function numero(e: Expresion | undefined): number {
  if (e?.tipo !== 'numeroLiteral') throw new Error('se esperaba un número literal en la llamada');
  return e.valor;
}

function escribir(app: Aplicacion, texto: string): void {
  app.editor.area.value = texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
}

function textoContador(): string {
  return document.querySelector('.kl-editor-contador')?.textContent ?? '';
}

describe('4.3 · cuatro REPITE a mano chocan con el límite duro', () => {
  let app: Aplicacion | null = null;

  afterEach(() => {
    app?.destruir();
    app = null;
    localStorage.clear();
  });

  it('no se ejecuta, Kiro da la cuenta exacta y el contador avisa por texto hasta que el programa cabe', () => {
    // `idNivel` forzado arranca con la semilla 0, que en el 4.3 da tres polígonos; el escenario
    // pide cuatro. Se reanuda el último reto guardado con una semilla de cuatro copias, igual que
    // al recargar la página, con los niveles anteriores aprobados para que el 4.3 esté abierto.
    const semilla = semillaConCopias(4);
    localStorage.clear();
    const progreso = cargarProgreso(localStorage);
    for (const nivel of CATALOGO) {
      if (nivel.id === '4.3') break;
      progreso.guardar(nivel.id, 0, APROBADO, 1);
    }
    progreso.marcarUltimoReto('4.3', semilla);

    montarDom();
    app = crearAplicacion({
      documento: document,
      almacen: localStorage,
      reloj: relojInmediato(),
      relojEspera: relojEsperaInerte,
      relojRebote: relojReboteInmediato,
      movimiento: movimientoReducido,
    });

    const { reto } = app.estado();
    expect(reto.nivel.id).toBe('4.3');
    expect(reto.semillaEfectiva).toBe(semilla);
    const llamadas = llamadasDe(reto);
    expect(llamadas).toHaveLength(4);
    // Referencia: el cuerpo de POLIGONO (REPITE, AVANZA, GIRADERECHA) más las cuatro llamadas; margen 3.
    expect(reto.presupuestoEstrella).toBe(7);
    expect(reto.limiteDuro).toBe(10);

    // Cada polígono a mano cuesta 3 (REPITE, AVANZA, GIRADERECHA): 4 × 3 = 12 > 10.
    const aMano = llamadas
      .map((ll) => {
        const lados = numero(ll.argumentos[0]);
        const largo = numero(ll.argumentos[1]);
        return `REPITE ${lados} [AVANZA ${largo} GIRADERECHA 360 / ${lados}]`;
      })
      .join('\n');
    escribir(app, aMano);

    // El contador anticipa el bloqueo por texto, con el conteo y el límite a la vista.
    expect(app.editor.estadoContador().conteo).toBe(12);
    const contador = textoContador();
    expect(contador).toContain('Instrucciones: 12');
    expect(contador).toContain('Límite: 10');
    expect(contador).toContain(TEXTO_BLOQUEO);
    expect(document.querySelector('.kl-editor-contador')?.getAttribute('aria-label')).toContain(TEXTO_BLOQUEO);

    app.ejecutar();

    // No se ejecuta: ninguna operación, ninguna calificación, el editor intacto.
    expect(app.estado().operacionesJugador).toHaveLength(0);
    expect(app.estado().calificacion).toBeNull();
    expect(app.editor.area.value).toBe(aMano);
    const globo = app.textoGlobo();
    expect(globo).toContain(crearError('limiteDuroExcedido', { usadas: 12, limite: 10, mundo: 4 }).mensaje);
    expect(globo).toContain('Tu programa usa 12 instrucciones y el máximo para este reto es 10: te sobran 2.');

    // Con la referencia el conteo deja de exceder y la señal se retira.
    const impresa = imprimir(reto.referencia);
    if (!impresa.exito) throw new Error('la referencia del 4.3 no se pudo imprimir');
    escribir(app, impresa.texto);
    const despues = textoContador();
    expect(despues).toContain('Instrucciones: 7');
    expect(despues).not.toContain(TEXTO_BLOQUEO);
    expect(despues).not.toContain('Límite:');
  });
});
