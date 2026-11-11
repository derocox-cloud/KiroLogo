// @vitest-environment jsdom

import { describe, it, expect, beforeEach } from 'vitest';
import {
  crearEditor,
  contarLineas,
  contarCaracteres,
  recortarALimites,
  MAXIMO_LINEAS,
  MAXIMO_CARACTERES,
  type Editor,
  type LimiteAlcanzado,
} from './editor.js';

// Reloj de rebote que dispara de inmediato: en las pruebas el análisis es síncrono.
const RELOJ_INMEDIATO = {
  programar(cb: () => void): number {
    cb();
    return 1;
  },
  cancelar(): void {},
};

interface Montaje {
  readonly editor: Editor;
  readonly limites: Array<{ limite: LimiteAlcanzado; valor: number }>;
}

function montar(mundo: 0 | 1 | 2 | 3 | 4 | 5 = 0, presupuesto = 1): Montaje {
  const contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  const limites: Array<{ limite: LimiteAlcanzado; valor: number }> = [];
  const editor = crearEditor({
    contenedor,
    mundo,
    presupuestoEstrella: presupuesto,
    // Por omisión el límite duro está inactivo (mundos 0–2): un valor alto que
    // nunca se alcanza, de modo que el aviso de bloqueo no aparece en estas
    // pruebas y las ya existentes siguen valiendo sin tocarse.
    limiteDuro: Number.MAX_SAFE_INTEGER,
    limiteDuroActivo: false,
    pedirMensajeLimite: (limite, valor) => limites.push({ limite, valor }),
    reloj: RELOJ_INMEDIATO,
  });
  return { editor, limites };
}

/** Montaje del mundo 3 con límite duro activo, para el aviso de bloqueo. */
function montarConLimite(
  presupuesto: number,
  limiteDuro: number,
  limiteDuroActivo: boolean,
): Montaje {
  const contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  const limites: Array<{ limite: LimiteAlcanzado; valor: number }> = [];
  const editor = crearEditor({
    contenedor,
    mundo: 3,
    presupuestoEstrella: presupuesto,
    limiteDuro,
    limiteDuroActivo,
    pedirMensajeLimite: (limite, valor) => limites.push({ limite, valor }),
    reloj: RELOJ_INMEDIATO,
  });
  return { editor, limites };
}

/** Escribe en el área simulando un `input` del usuario. */
function escribir(editor: Editor, texto: string): void {
  editor.area.value = texto;
  editor.area.dispatchEvent(new Event('input'));
}

describe('editor · conteo de líneas y caracteres', () => {
  it('cuenta la última línea aunque no termine en fin de línea', () => {
    expect(contarLineas('a')).toBe(1);
    expect(contarLineas('a\nb')).toBe(2);
    expect(contarLineas('a\nb\n')).toBe(3);
    expect(contarLineas('')).toBe(1);
  });

  it('reconoce \\r\\n como un solo fin de línea', () => {
    expect(contarLineas('a\r\nb')).toBe(2);
    expect(contarLineas('a\r\nb\r\nc')).toBe(3);
  });

  it('cuenta espacios, tabuladores y fines de línea dentro de los caracteres', () => {
    expect(contarCaracteres(' \t\n')).toBe(3);
    expect(contarCaracteres('a\r\nb')).toBe(4);
  });
});

describe('editor · límites exactos', () => {
  it('admite exactamente 200 líneas y descarta la 201', () => {
    const exactas = Array.from({ length: MAXIMO_LINEAS }, (_, i) => `L${i}`).join('\n');
    const rec = recortarALimites(exactas);
    expect(rec.recortado).toBe(false);
    expect(contarLineas(rec.texto)).toBe(MAXIMO_LINEAS);

    const unaMas = exactas + '\nL200';
    const rec2 = recortarALimites(unaMas);
    expect(rec2.recortado).toBe(true);
    expect(rec2.limite).toBe('lineas');
    expect(contarLineas(rec2.texto)).toBe(MAXIMO_LINEAS);
  });

  it('admite exactamente 10 000 caracteres y descarta el 10 001', () => {
    const exactos = 'x'.repeat(MAXIMO_CARACTERES);
    const rec = recortarALimites(exactos);
    expect(rec.recortado).toBe(false);
    expect(rec.texto.length).toBe(MAXIMO_CARACTERES);

    const unoMas = 'x'.repeat(MAXIMO_CARACTERES + 1);
    const rec2 = recortarALimites(unoMas);
    expect(rec2.recortado).toBe(true);
    expect(rec2.limite).toBe('caracteres');
    expect(rec2.texto.length).toBe(MAXIMO_CARACTERES);
  });

  it('reconoce \\r\\n al recortar la línea sobrante', () => {
    const exactas = Array.from({ length: MAXIMO_LINEAS }, (_, i) => `L${i}`).join('\r\n');
    const unaMas = exactas + '\r\nL200';
    const rec = recortarALimites(unaMas);
    expect(rec.limite).toBe('lineas');
    expect(contarLineas(rec.texto)).toBe(MAXIMO_LINEAS);
    // No queda un `\r` colgando al final.
    expect(rec.texto.endsWith('\r')).toBe(false);
  });

  it('al exceder pide al globo el mensaje del límite, conserva lo admitido y deja el cursor al final', () => {
    const { editor, limites } = montar();
    escribir(editor, 'x'.repeat(MAXIMO_CARACTERES + 5));
    expect(editor.texto().length).toBe(MAXIMO_CARACTERES);
    expect(limites.at(-1)).toEqual({ limite: 'caracteres', valor: MAXIMO_CARACTERES });
    expect(editor.area.selectionStart).toBe(MAXIMO_CARACTERES);
    expect(editor.area.disabled).toBe(false);
  });
});

describe('editor · contador de instrucciones', () => {
  let m: Montaje;
  beforeEach(() => {
    m = montar();
  });

  it('muestra 0 con texto vacío o de solo comentarios', () => {
    escribir(m.editor, '');
    expect(m.editor.estadoContador().conteo).toBe(0);
    expect(m.editor.estadoContador().provisional).toBe(false);
  });

  it('muestra el conteo de conteo.ts para un programa válido', () => {
    escribir(m.editor, 'AVANZA 100\nGIRADERECHA 90');
    const e = m.editor.estadoContador();
    expect(e.conteo).toBe(2);
    expect(e.provisional).toBe(false);
    expect(e.errores.length).toBe(0);
  });

  it('ante errores muestra el último conteo bueno con marca provisional', () => {
    escribir(m.editor, 'AVANZA 100');
    expect(m.editor.estadoContador().conteo).toBe(1);
    // Ahora un texto con error: conserva el 1 y lo marca provisional.
    escribir(m.editor, 'AVANZA 100\n&&&');
    const e = m.editor.estadoContador();
    expect(e.conteo).toBe(1);
    expect(e.provisional).toBe(true);
    expect(e.errores.length).toBeGreaterThan(0);
    // La marca provisional es legible como texto, no solo color.
    expect(m.editor.raiz.textContent).toContain('provisional');
  });

  it('muestra 0 provisional si nunca obtuvo un conteo bueno', () => {
    escribir(m.editor, '&&&');
    const e = m.editor.estadoContador();
    expect(e.conteo).toBe(0);
    expect(e.provisional).toBe(true);
  });
});

describe('editor · canaleta y marcas de error', () => {
  it('numera desde 1 y marca la línea de cada error con forma y mensaje', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100\n&&&\nGIRADERECHA 90');
    // La canaleta tiene un span por línea.
    const spans = editor.raiz.querySelectorAll('.kl-canaleta-linea');
    expect(spans.length).toBe(3);
    // Hay al menos una marca en la lista, con número de línea y mensaje.
    const items = editor.raiz.querySelectorAll('.kl-editor-marca');
    expect(items.length).toBeGreaterThan(0);
    const primera = items[0]!;
    expect(primera.textContent).toContain('Línea');
    // La forma ▲ distingue la marca además del color.
    expect(primera.textContent).toContain('▲');
  });

  it('retira la marca de una línea que ya no existe', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100\n&&&');
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBeGreaterThan(0);
    escribir(editor, 'AVANZA 100');
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBe(0);
  });
});

describe('editor · presupuesto al lado', () => {
  it('muestra el presupuesto con nombre accesible que nombra los dos números', () => {
    const { editor } = montar(0, 1);
    escribir(editor, 'AVANZA 100');
    const contador = editor.raiz.querySelector('.kl-editor-contador')!;
    const nombre = contador.getAttribute('aria-label')!;
    expect(nombre).toContain('nstrucciones 1');
    expect(nombre).toContain('presupuesto de estrella 1');
  });

  it('señala el exceso con texto en español y mantiene el área habilitada', () => {
    const { editor } = montar(0, 1);
    escribir(editor, 'AVANZA 100\nGIRADERECHA 90');
    expect(editor.estadoContador().conteo).toBe(2);
    expect(editor.raiz.textContent).toContain('Te pasaste del presupuesto');
    expect(editor.area.disabled).toBe(false);
  });
});

describe('editor · Tab no se captura', () => {
  it('no llama preventDefault en una pulsación de Tab y no inserta ningún carácter', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100');
    const antes = editor.texto();
    const evento = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    editor.area.dispatchEvent(evento);
    expect(evento.defaultPrevented).toBe(false);
    expect(editor.texto()).toBe(antes);
  });
});

describe('editor · presentarReto', () => {
  it('deja el área vacía, el contador en 0 sin provisional y sin marcas', () => {
    const { editor } = montar(0, 1);
    escribir(editor, 'AVANZA 100\n&&&');
    editor.presentarReto(1, Number.MAX_SAFE_INTEGER, false);
    expect(editor.texto()).toBe('');
    const e = editor.estadoContador();
    expect(e.conteo).toBe(0);
    expect(e.provisional).toBe(false);
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBe(0);
  });
});

describe('editor · resaltar línea del paso a paso', () => {
  it('resalta exactamente una línea y la retira cuando el número no existe', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100\nGIRADERECHA 90');
    editor.resaltarLinea(2);
    expect(editor.raiz.querySelectorAll('.kl-canaleta-actual').length).toBe(1);
    // Un número de línea inexistente retira el resalte.
    editor.resaltarLinea(9);
    expect(editor.raiz.querySelectorAll('.kl-canaleta-actual').length).toBe(0);
  });
});

describe('editor · insertar en cursor', () => {
  it('inserta en la posición del cursor y devuelve la línea del cursor', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100\n');
    editor.area.setSelectionRange(editor.texto().length, editor.texto().length);
    const linea = editor.insertarEnCursor('GIRADERECHA 90');
    expect(editor.texto()).toBe('AVANZA 100\nGIRADERECHA 90');
    expect(linea).toBe(2);
  });

  it('reemplaza la selección al insertar', () => {
    const { editor } = montar();
    escribir(editor, 'AVANZA 100');
    editor.area.setSelectionRange(0, 10); // toda la línea
    editor.insertarEnCursor('CENTRO');
    expect(editor.texto()).toBe('CENTRO');
  });
});

// ============================================================================
// Tarea 2 (spec repite-desbloqueo-mundo-1) · Property 2: Preservación
//
// Observación primero: se fija el comportamiento BASE que el arreglo debe
// preservar, sobre el código SIN arreglar. La condición del bug es
// `mundoDelEditor <> mundoDelNivelEnCurso`; aquí se cubre su negación (¬C):
// el editor se crea DIRECTAMENTE en el mundo del nivel (como las pruebas con
// `mundo` forzado), de modo que `mundoDelEditor = mundoDelNivelEnCurso`. Para
// toda entrada así, F' (arreglado) debe comportarse igual que F (actual), por
// lo que estas pruebas PASAN hoy y deben seguir pasando tras el arreglo.
//
// El dominio es pequeño y cerrado (mundos 0..5, vocabulario fijo). El azar que
// hace falta pasa por `azar/prng.ts`, nunca `Math.random`: la semilla fija deja
// el recorrido de los mundos reproducible.
// ============================================================================

import { crearPrng } from '../azar/prng.js';
import { comandosDelMundo, type Mundo } from '../lenguaje/vocabulario.js';

// Un programa válido por mundo que usa solo comandos con `mundo <= m`, con su
// conteo esperado (la línea base del contador que se preserva). Los mundos sin
// comandos nuevos propios (3) reutilizan el vocabulario ya desbloqueado; todos
// parten del vocabulario del mundo 0, que nunca está vacío.
const PROGRAMA_VALIDO_POR_MUNDO: Record<Mundo, { readonly texto: string; readonly conteo: number }> = {
  // El conteo incluye el nodo REPITE más los comandos de su cuerpo (la base del
  // contador que `conteo.ts` calcula y que el arreglo debe preservar).
  0: { texto: 'AVANZA 100\nGIRADERECHA 90', conteo: 2 },
  1: { texto: 'REPITE 4 [AVANZA 100 GIRADERECHA 90]', conteo: 3 },
  2: { texto: 'SUBELAPIZ\nAVANZA 100\nBAJALAPIZ', conteo: 3 },
  3: { texto: 'REPITE 3 [AVANZA 60 GIRADERECHA 120]', conteo: 3 },
  4: { texto: 'AVANZA 100\nGIRAIZQUIERDA 45', conteo: 2 },
  5: { texto: 'REPITE 4 [AVANZA 50 GIRADERECHA 90]', conteo: 3 },
};

const TODOS_LOS_MUNDOS: readonly Mundo[] = [0, 1, 2, 3, 4, 5];

describe('editor · preservación (mundo del editor = mundo del nivel, ¬C)', () => {
  it('para todo mundo m, un programa válido de m se analiza sin errores y con el mismo conteo', () => {
    // Recorre los seis mundos en un orden barajado por el PRNG (semilla fija):
    // el resultado no depende del orden, pero deja el recorrido reproducible y
    // sin recurrir a Math.random.
    const prng = crearPrng(20240531);
    const orden = [...TODOS_LOS_MUNDOS];
    for (let i = orden.length - 1; i > 0; i--) {
      const j = prng.entero(0, i);
      [orden[i], orden[j]] = [orden[j]!, orden[i]!];
    }

    for (const mundo of orden) {
      const { editor } = montar(mundo);
      const caso = PROGRAMA_VALIDO_POR_MUNDO[mundo]!;
      escribir(editor, caso.texto);
      const estado = editor.estadoContador();
      // Sin errores: ningún comando con mundo <= m queda bloqueado.
      expect(estado.errores, `mundo ${mundo}: sin errores`).toEqual([]);
      expect(estado.provisional, `mundo ${mundo}: conteo firme`).toBe(false);
      // El conteo es el de siempre (la base que se preserva).
      expect(estado.conteo, `mundo ${mundo}: conteo`).toBe(caso.conteo);
    }
  });

  it('en el mundo 1, SUBELAPIZ (mundo 2) sigue reportando comandoBloqueado nombrando el mundo 2', () => {
    const { editor } = montar(1);
    escribir(editor, 'SUBELAPIZ');
    const errores = editor.estadoContador().errores;
    const bloqueo = errores.find((e) => e.id === 'comandoBloqueado');
    expect(bloqueo, 'hay un comandoBloqueado para SUBELAPIZ').toBeDefined();
    // El mensaje del catálogo nombra el mundo en que se desbloquea (el 2).
    expect(bloqueo!.mensaje).toContain('mundo 2');
    expect(bloqueo!.mensaje).toContain('SUBELAPIZ');
  });

  it('presentarReto sigue vaciando texto, fijando presupuesto, reiniciando conteo y limpiando marcas', () => {
    // Parte de un programa válido del mundo con un error añadido, para que haya
    // texto, conteo y marcas que limpiar.
    const { editor } = montar(1, 1);
    escribir(editor, 'REPITE 4 [AVANZA 100 GIRADERECHA 90]\n&&&');
    expect(editor.texto().length).toBeGreaterThan(0);
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBeGreaterThan(0);

    editor.presentarReto(7, Number.MAX_SAFE_INTEGER, false);
    // Texto vacío, conteo en 0 sin provisional, sin marcas.
    expect(editor.texto()).toBe('');
    const estado = editor.estadoContador();
    expect(estado.conteo).toBe(0);
    expect(estado.provisional).toBe(false);
    expect(estado.errores).toEqual([]);
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBe(0);
    // El presupuesto nuevo quedó fijado (lo refleja el nombre accesible del contador).
    const contador = editor.raiz.querySelector('.kl-editor-contador')!;
    expect(contador.getAttribute('aria-label')).toContain('presupuesto de estrella 7');
  });
});

// ============================================================================
// Tarea 3.4 (spec repite-desbloqueo-mundo-1) · Property 1: comportamiento esperado
//
// El arreglo: `fijarMundo` cambia el mundo del análisis sin recrear el editor y
// reanaliza el texto en curso, de modo que marcas y contador reflejen el mundo
// nuevo sin esperar al próximo tecleo. Deja presupuesto y texto intactos.
//
// isBugCondition(X) = mundoDelEditor <> mundoDelNivelEnCurso. Aquí se cubre C:
// el editor nace en un mundo y se le fija otro, igual que hace montarReto al
// navegar. El dominio es cerrado (mundos 0..5, vocabulario fijo); el PBT recorre
// todos los pares (inicial, destino) con el PRNG decidiendo solo el orden.
// ============================================================================

describe('editor · fijarMundo cambia el mundo del análisis (Property 1)', () => {
  it('fijarMundo(1) deja REPITE disponible y fijarMundo(0) lo vuelve a bloquear', () => {
    // Nace en el mundo 0: REPITE (mundo 1) está bloqueado.
    const { editor } = montar(0);
    escribir(editor, 'REPITE 4 [AVANZA 100 GIRADERECHA 90]');
    const bloqueoInicial = editor
      .estadoContador()
      .errores.find((e) => e.id === 'comandoBloqueado' && e.mensaje.includes('REPITE'));
    expect(bloqueoInicial, 'en el mundo 0 REPITE está bloqueado').toBeDefined();

    // Fijar el mundo 1 lo desbloquea sin recrear el editor ni volver a teclear.
    editor.fijarMundo(1);
    const estadoUno = editor.estadoContador();
    expect(
      estadoUno.errores.some((e) => e.id === 'comandoBloqueado' && e.mensaje.includes('REPITE')),
      'tras fijarMundo(1) REPITE ya no está bloqueado',
    ).toBe(false);
    expect(estadoUno.errores, 'el programa válido del mundo 1 no deja ningún error').toEqual([]);

    // Volver al mundo 0 lo bloquea de nuevo, nombrando el mundo 1.
    editor.fijarMundo(0);
    const bloqueoVuelta = editor
      .estadoContador()
      .errores.find((e) => e.id === 'comandoBloqueado' && e.mensaje.includes('REPITE'));
    expect(bloqueoVuelta, 'tras fijarMundo(0) REPITE vuelve a bloquearse').toBeDefined();
    expect(bloqueoVuelta!.mensaje).toContain('mundo 1');
  });

  it('reanaliza el texto en curso de inmediato, sin esperar al próximo tecleo', () => {
    const { editor } = montar(0);
    escribir(editor, 'REPITE 4 [AVANZA 100 GIRADERECHA 90]');
    // Antes de fijar el mundo, hay una marca de error de REPITE bloqueado en la canaleta.
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBeGreaterThan(0);

    // fijarMundo(1) reanaliza ya: la marca desaparece sin que el jugador vuelva a teclear.
    editor.fijarMundo(1);
    expect(editor.raiz.querySelectorAll('.kl-editor-marca').length).toBe(0);
    expect(editor.estadoContador().conteo).toBe(3);
    expect(editor.estadoContador().provisional).toBe(false);
  });

  it('no altera el texto en curso ni el presupuesto mostrado', () => {
    const { editor } = montar(0, 5);
    escribir(editor, 'REPITE 4 [AVANZA 100 GIRADERECHA 90]');
    const textoAntes = editor.texto();

    editor.fijarMundo(1);
    // El texto del jugador queda tal cual: fijarMundo configura el análisis, no el intento.
    expect(editor.texto()).toBe(textoAntes);
    // El presupuesto que presentarReto fijó sigue siendo el mismo (no lo toca fijarMundo).
    const contador = editor.raiz.querySelector('.kl-editor-contador')!;
    expect(contador.getAttribute('aria-label')).toContain('presupuesto de estrella 5');
  });

  it('fijarMundo con el mundo ya vigente es idempotente: no cambia conteo ni errores', () => {
    // ¬C: el editor ya está en el mundo del nivel en curso. Volver a fijar el mismo
    // mundo deja el análisis exactamente igual (conteo, provisional y errores).
    const { editor } = montar(1);
    escribir(editor, 'REPITE 4 [AVANZA 100 GIRADERECHA 90]');
    const antes = editor.estadoContador();

    editor.fijarMundo(1); // mismo mundo

    const despues = editor.estadoContador();
    expect(despues.conteo).toBe(antes.conteo);
    expect(despues.provisional).toBe(antes.provisional);
    expect(despues.errores).toEqual(antes.errores);
    // Y con un comando de un mundo posterior, el bloqueo tampoco cambia al reafirmar el mundo.
    escribir(editor, 'SUBELAPIZ');
    const conBloqueo = editor.estadoContador();
    editor.fijarMundo(1); // reafirma el mismo mundo
    expect(editor.estadoContador().errores).toEqual(conBloqueo.errores);
  });

  it('PBT: para todo par (inicial, destino) en 0..5, tras fijarMundo(destino) no hay comandoBloqueado para comandos con mundo <= destino', () => {
    // Todos los pares (inicial, destino) con inicial != destino. El PRNG decide
    // solo el ORDEN del recorrido (semilla fija, reproducible, sin Math.random):
    // el veredicto es determinista y no depende del orden.
    const pares: Array<{ inicial: Mundo; destino: Mundo }> = [];
    for (const inicial of TODOS_LOS_MUNDOS) {
      for (const destino of TODOS_LOS_MUNDOS) {
        if (inicial !== destino) pares.push({ inicial, destino });
      }
    }
    const prng = crearPrng(20240712);
    for (let i = pares.length - 1; i > 0; i--) {
      const j = prng.entero(0, i);
      [pares[i], pares[j]] = [pares[j]!, pares[i]!];
    }

    for (const { inicial, destino } of pares) {
      const { editor } = montar(inicial);
      // Un programa con un comando representativo de cada mundo <= destino, para
      // provocar un bloqueo si el editor se quedara en el mundo inicial.
      escribir(editor, programaRepresentativo(destino));
      editor.fijarMundo(destino);

      const errores = editor.estadoContador().errores;
      for (const entrada of comandosDelMundo(destino)) {
        const bloqueado = errores.some(
          (e) => e.id === 'comandoBloqueado' && e.mensaje.includes(entrada.nombre),
        );
        expect(
          bloqueado,
          `(${inicial} → ${destino}) el editor bloqueó ${entrada.nombre} (mundo ${entrada.mundo} <= ${destino})`,
        ).toBe(false);
      }
    }
  });
});

// Programa que usa UN comando real de cada mundo desbloqueado en `destino`, para
// ejercitar que ninguno queda bloqueado tras fijarMundo. Se construye a partir
// del vocabulario real (vocabulario.ts es la única fuente de verdad), tomando el
// ejemplo declarado de un comando por mundo; así no se inventan literales ni se
// asume qué comandos existen por mundo.
function programaRepresentativo(destino: Mundo): string {
  const lineas: string[] = [];
  const vistos = new Set<Mundo>();
  for (const entrada of comandosDelMundo(destino)) {
    if (vistos.has(entrada.mundo)) continue;
    vistos.add(entrada.mundo);
    // El ejemplo del vocabulario es un uso sintácticamente válido del comando.
    lineas.push(entrada.ejemplo);
  }
  return lineas.join('\n');
}

// ============================================================================
// Tarea 3.2 (spec 04-mundo-3-rosetones) · Property 4: el contador señala
// bloqueo si y solo si el conteo supera el límite duro activo.
//
// Validates: Requirements 2.5, 2.6
//
// El aviso de bloqueo es INDEPENDIENTE del de presupuesto: en el mundo 3 un
// conteo entre `presupuesto + 1` y `limiteDuro` muestra «te pasaste del
// presupuesto» pero NO el de bloqueo; un conteo > `limiteDuro` muestra ambos.
// La frase exacta del bloqueo vive por texto y en el nombre accesible, no solo
// por color (accesibilidad).
// ============================================================================

const FRASE_BLOQUEO = 'Este programa no se podrá ejecutar: pasa del límite';

/** Programa de `n` instrucciones: `n` líneas de `AVANZA 10` (conteo = n). */
function programaDe(n: number): string {
  return Array.from({ length: n }, () => 'AVANZA 10').join('\n');
}

describe('editor · aviso de bloqueo por límite duro (Property 4)', () => {
  it('con límite activo y conteo > límite, muestra el aviso por texto y lo nombra en el aria-label (R2.5)', () => {
    // presupuesto 1, límite duro 4; conteo 5 supera el límite.
    const { editor } = montarConLimite(1, 4, true);
    escribir(editor, programaDe(5));
    expect(editor.estadoContador().conteo).toBe(5);

    const bloqueo = editor.raiz.querySelector('.kl-contador-bloqueo');
    expect(bloqueo, 'hay un span de bloqueo').not.toBeNull();
    expect(bloqueo!.textContent).toBe(FRASE_BLOQUEO);

    const contador = editor.raiz.querySelector('.kl-editor-contador')!;
    expect(contador.getAttribute('aria-label')).toContain(FRASE_BLOQUEO);
  });

  it('con conteo ≤ límite, no hay aviso de bloqueo ni en texto ni en el aria-label (R2.6)', () => {
    // presupuesto 1, límite duro 4; conteo 4 es exactamente el límite, no lo supera.
    const { editor } = montarConLimite(1, 4, true);
    escribir(editor, programaDe(4));
    expect(editor.estadoContador().conteo).toBe(4);

    expect(editor.raiz.querySelector('.kl-contador-bloqueo')).toBeNull();
    const contador = editor.raiz.querySelector('.kl-editor-contador')!;
    expect(contador.getAttribute('aria-label')).not.toContain(FRASE_BLOQUEO);
  });

  it('entre presupuesto+1 y límite: aviso de presupuesto SÍ, aviso de bloqueo NO (independencia)', () => {
    // presupuesto 1, límite duro 4; conteo 3 está en (presupuesto, límite].
    const { editor } = montarConLimite(1, 4, true);
    escribir(editor, programaDe(3));
    expect(editor.estadoContador().conteo).toBe(3);

    // Pasó el presupuesto: aviso de presupuesto presente.
    expect(editor.raiz.querySelector('.kl-contador-aviso')).not.toBeNull();
    expect(editor.raiz.textContent).toContain('Te pasaste del presupuesto');
    // Pero no pasó el límite: sin aviso de bloqueo.
    expect(editor.raiz.querySelector('.kl-contador-bloqueo')).toBeNull();
    const contador = editor.raiz.querySelector('.kl-editor-contador')!;
    expect(contador.getAttribute('aria-label')).not.toContain(FRASE_BLOQUEO);
  });

  it('con conteo > límite muestra AMBOS avisos: presupuesto y bloqueo', () => {
    const { editor } = montarConLimite(1, 4, true);
    escribir(editor, programaDe(5));
    expect(editor.raiz.querySelector('.kl-contador-aviso')).not.toBeNull();
    expect(editor.raiz.querySelector('.kl-contador-bloqueo')).not.toBeNull();
  });

  it('con límite inactivo y conteo alto, nunca hay aviso de bloqueo', () => {
    // limiteDuroActivo falso: aunque el conteo supere el límite, no se señala bloqueo.
    const { editor } = montarConLimite(1, 4, false);
    escribir(editor, programaDe(10));
    expect(editor.estadoContador().conteo).toBe(10);
    expect(editor.raiz.querySelector('.kl-contador-bloqueo')).toBeNull();
    const contador = editor.raiz.querySelector('.kl-editor-contador')!;
    expect(contador.getAttribute('aria-label')).not.toContain(FRASE_BLOQUEO);
  });

  it('presentarReto puede activar el límite duro de un nivel nuevo', () => {
    // Nace con límite inactivo; al presentar un reto del mundo 3 se activa.
    const { editor } = montarConLimite(1, 4, false);
    editor.presentarReto(1, 4, true);
    escribir(editor, programaDe(5));
    expect(editor.raiz.querySelector('.kl-contador-bloqueo')).not.toBeNull();
  });
});
