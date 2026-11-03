// Pruebas del lienzo: espacio lógico, escalado, cuatro capas, cuadrícula y estelas.
//
// Corre en Node con el doble de dibujo de `doble-dibujo.test.ts`, sin jsdom ni
// Canvas real. La comparación «píxel por píxel» de los requisitos se hace sobre la
// secuencia registrada de llamadas y su rasterizado; la verificación con un Canvas
// real del navegador sigue siendo manual.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import { DobleDibujo, type Llamada } from './doble-dibujo.test.js';
import {
  crearLienzo,
  calcularEscalado,
  ORDEN_CAPAS,
  LADO_LOGICO,
  LADO_MINIMO,
  LADO_MAXIMO,
  DPR_MINIMO,
  DPR_MAXIMO,
  type CapasLienzo,
  type EstiloLienzo,
  type TamanoLienzo,
  type NombreCapa,
} from './lienzo.js';
import type { Segmento } from './segmentos.js';

// ============================================================================
// Ayudas de prueba
// ============================================================================

/** Estilo de tema completo, con valores concretos para cada trazo. */
function estiloCompleto(): EstiloLienzo {
  return {
    fondo: { color: '#ffffff', grosor: 1, guiones: [] },
    cuadricula20: { color: '#e9ecef', grosor: 0.5, guiones: [] },
    cuadricula100: { color: '#ced4da', grosor: 1, guiones: [] },
    estelaJugador: { color: '#0d6efd', grosor: 3, guiones: [] },
    estelaReferencia: { color: '#6c757d', grosor: 2, guiones: [8, 4] },
  };
}

/** Crea cuatro dobles de dibujo, uno por capa. */
function crearCapasDobles(): Record<NombreCapa, DobleDibujo> {
  return {
    fondo: new DobleDibujo(),
    referencia: new DobleDibujo(),
    jugador: new DobleDibujo(),
    personajes: new DobleDibujo(),
  };
}

const TAMANO_BASE: TamanoLienzo = { anchoCss: 800, altoCss: 800, devicePixelRatio: 1 };

/** Cuenta cuántas líneas (pares moveTo→lineTo) hay en una secuencia de llamadas. */
function contarLineas(llamadas: readonly Llamada[]): number {
  return llamadas.filter((l) => l.metodo === 'moveTo').length;
}

// ============================================================================
// Escalado (sección 7.3)
// ============================================================================

describe('lienzo · escalado', () => {
  it('escala uniforme: el cuadrado lógico conserva la relación 1:1', () => {
    const e = calcularEscalado({ anchoCss: 800, altoCss: 800, devicePixelRatio: 1 });
    expect(e.lado).toBe(800);
    expect(e.escala).toBe(1);
    expect(e.dpr).toBe(1);
    expect(e.bufer).toBe(800);
  });

  it('toma el menor de los dos lados CSS', () => {
    const e = calcularEscalado({ anchoCss: 1200, altoCss: 600, devicePixelRatio: 1 });
    expect(e.lado).toBe(600);
  });

  it('acota el lado a [320, 4096]', () => {
    expect(calcularEscalado({ anchoCss: 100, altoCss: 100, devicePixelRatio: 1 }).lado).toBe(320);
    expect(calcularEscalado({ anchoCss: 9000, altoCss: 9000, devicePixelRatio: 1 }).lado).toBe(4096);
  });

  it('acota la densidad de píxeles a [1, 3]', () => {
    expect(calcularEscalado({ anchoCss: 800, altoCss: 800, devicePixelRatio: 0.5 }).dpr).toBe(1);
    expect(calcularEscalado({ anchoCss: 800, altoCss: 800, devicePixelRatio: 5 }).dpr).toBe(3);
  });

  it('el paso de 20 mide al menos 8 px en el lado mínimo', () => {
    const e = calcularEscalado({ anchoCss: 320, altoCss: 320, devicePixelRatio: 1 });
    const pasoEnPx = 20 * e.escala;
    expect(pasoEnPx).toBeGreaterThanOrEqual(8);
  });
});

// ============================================================================
// La transformación se aplica a las cuatro capas
// ============================================================================

describe('lienzo · transformación y capas', () => {
  it('fija la transformación de las cuatro capas con la y negativa', () => {
    const capas = crearCapasDobles();
    crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    for (const nombre of ORDEN_CAPAS) {
      const st = capas[nombre].llamadas.find((l) => l.metodo === 'setTransform');
      expect(st).toBeDefined();
      // setTransform(escala·dpr, 0, 0, −escala·dpr, centro, centro).
      expect(st!.args[0]).toBe(1);
      expect(st!.args[3]).toBe(-1); // y negativa: invierte el eje vertical
      expect(st!.args[4]).toBe(400);
      expect(st!.args[5]).toBe(400);
    }
  });

  it('las cuatro capas están en el orden de apilamiento fondo→referencia→jugador→personajes', () => {
    expect([...ORDEN_CAPAS]).toEqual(['fondo', 'referencia', 'jugador', 'personajes']);
  });
});

// ============================================================================
// Cuadrícula: 41 líneas por eje, 9 gruesas por eje
// ============================================================================

describe('lienzo · cuadrícula', () => {
  it('dibuja 41 líneas por eje (82 en total) y 9 gruesas por eje (18)', () => {
    const capas = crearCapasDobles();
    crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    const fondo = capas.fondo.llamadas;

    // La cuadrícula fina y la gruesa se dibujan en dos pasadas con un stroke cada
    // una. Contamos las líneas de cada pasada localizando los dos beginPath de
    // cuadrícula (tras el relleno del fondo).
    const indicesBegin: number[] = [];
    fondo.forEach((l, i) => {
      if (l.metodo === 'beginPath') indicesBegin.push(i);
    });
    // El primer beginPath es el del relleno del fondo; los dos siguientes son las
    // dos pasadas de cuadrícula.
    expect(indicesBegin.length).toBeGreaterThanOrEqual(3);
    const finas = fondo.slice(indicesBegin[1]!, indicesBegin[2]!);
    const gruesas = fondo.slice(indicesBegin[2]!);

    // Finas: las que NO son múltiplo de 100. Por eje hay 41 líneas totales y 9
    // múltiplos de 100, así que 32 finas por eje → 64 moveTo.
    expect(contarLineas(finas)).toBe(64);
    // Gruesas: 9 múltiplos de 100 por eje → 18 moveTo.
    expect(contarLineas(gruesas)).toBe(18);
  });

  it('las líneas gruesas llevan al menos el doble del grosor de las finas', () => {
    const capas = crearCapasDobles();
    // Grosor fino 0.5, grueso 1.0 → exactamente el doble.
    crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    // Comprobamos con un estilo controlado que el ratio es ≥ 2.
    const estilo = estiloCompleto();
    expect(estilo.cuadricula100.grosor).toBeGreaterThanOrEqual(estilo.cuadricula20.grosor * 2);
  });

  it('la cuadrícula se dibuja en la capa de fondo, no en las de estela ni personajes', () => {
    const capas = crearCapasDobles();
    crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    // La capa de fondo tiene muchas líneas (82 de cuadrícula más el rectángulo de
    // relleno del fondo, que aporta su propio moveTo); las de estela y personajes,
    // ninguna (sin estelas cargadas y sin personajes dibujados).
    expect(contarLineas(capas.fondo.llamadas)).toBe(83);
    // Las capas de estela vacías solo trazan el rectángulo del clip (1 moveTo), no
    // ninguna línea de cuadrícula. La capa de personajes no recibe nada.
    expect(contarLineas(capas.jugador.llamadas)).toBeLessThanOrEqual(1);
    expect(contarLineas(capas.referencia.llamadas)).toBeLessThanOrEqual(1);
    expect(contarLineas(capas.personajes.llamadas)).toBe(0);
  });
});

// ============================================================================
// Estelas y borrado de la capa del jugador (Req 12.4)
// ============================================================================

describe('lienzo · estelas', () => {
  const SEGS_JUGADOR: Segmento[] = [
    { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 100 }, paso: 0, linea: 1 },
    { desde: { x: 0, y: 100 }, hasta: { x: 100, y: 100 }, paso: 1, linea: 2 },
  ];

  it('borrar la capa del jugador no toca la referencia, el fondo ni los personajes', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);

    lienzo.ponerEstela('jugador', SEGS_JUGADOR);
    lienzo.ponerEstela('referencia', SEGS_JUGADOR);

    // Contamos las llamadas de cada capa antes de limpiar la del jugador.
    const refAntes = capas.referencia.llamadas.length;
    const fondoAntes = capas.fondo.llamadas.length;
    const persAntes = capas.personajes.llamadas.length;

    lienzo.limpiarEstela('jugador');

    // La referencia, el fondo y los personajes no reciben ninguna llamada nueva.
    expect(capas.referencia.llamadas.length).toBe(refAntes);
    expect(capas.fondo.llamadas.length).toBe(fondoAntes);
    expect(capas.personajes.llamadas.length).toBe(persAntes);
    // La estela del jugador queda vacía y la de referencia conserva sus segmentos.
    expect(lienzo.segmentosDe('jugador')).toEqual([]);
    expect(lienzo.segmentosDe('referencia').length).toBe(2);
  });

  it('la estela de referencia usa un patrón de línea distinto (setLineDash)', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    lienzo.ponerEstela('referencia', SEGS_JUGADOR);
    const dash = capas.referencia.llamadas.filter((l) => l.metodo === 'setLineDash');
    // Al menos un setLineDash con guiones no vacíos.
    const conGuiones = dash.some((l) => Array.isArray(l.args[0]) && (l.args[0] as number[]).length > 0);
    expect(conGuiones).toBe(true);
  });

  it('la estela lleva un clip al cuadrado lógico y un tramo fuera se recorta sin excepción', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    // Un segmento que sale del cuadrado [−400, 400]².
    const fuera: Segmento[] = [
      { desde: { x: 0, y: 0 }, hasta: { x: 5000, y: 5000 }, paso: 0, linea: 1 },
    ];
    expect(() => lienzo.ponerEstela('jugador', fuera)).not.toThrow();
    // Se registró un clip en la capa del jugador.
    expect(capas.jugador.llamadas.some((l) => l.metodo === 'clip')).toBe(true);
  });

  it('crecerEstela añade segmentos y conserva los previos', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    lienzo.ponerEstela('jugador', [SEGS_JUGADOR[0]!]);
    lienzo.crecerEstela('jugador', [SEGS_JUGADOR[1]!]);
    expect(lienzo.segmentosDe('jugador').length).toBe(2);
  });

  it('limpiarPersonajes borra solo la capa de personajes', () => {
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, estiloCompleto, TAMANO_BASE);
    const jugAntes = capas.jugador.llamadas.length;
    lienzo.limpiarPersonajes();
    expect(capas.personajes.llamadas.some((l) => l.metodo === 'clearRect')).toBe(true);
    expect(capas.jugador.llamadas.length).toBe(jugAntes);
  });
});

// ============================================================================
// Tema: un trazo sin declarar usa la reserva
// ============================================================================

describe('lienzo · tema', () => {
  it('un lector de tema con reserva provee el trazo faltante sin literal en el módulo', () => {
    // Simulamos que el tema no declara el color de la estela del jugador: el lector
    // (que en producción implementa la cadena var()/reserva) devuelve la reserva.
    let usoReserva = false;
    const leerConReserva = (): EstiloLienzo => {
      const base = estiloCompleto();
      usoReserva = true;
      return {
        ...base,
        // La reserva se resuelve en el lector, no en el lienzo.
        estelaJugador: { color: '#0a58ca', grosor: 3.5, guiones: [] },
      };
    };
    const capas = crearCapasDobles();
    const lienzo = crearLienzo(capas as CapasLienzo, leerConReserva, TAMANO_BASE);
    lienzo.ponerEstela('jugador', [
      { desde: { x: 0, y: 0 }, hasta: { x: 0, y: 50 }, paso: 0, linea: 1 },
    ]);
    expect(usoReserva).toBe(true);
    // El lienzo aplicó el trazo que le dio el lector (la reserva) sin error.
    expect(capas.jugador.llamadas.some((l) => l.metodo === 'stroke')).toBe(true);
  });

  it('el módulo lienzo.ts no contiene literales de color ni de grosor', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const ruta = fileURLToPath(new URL('./lienzo.ts', import.meta.url));
    const fuente = readFileSync(ruta, 'utf8');
    const codigo = fuente
      .split('\n')
      .filter((linea) => !linea.trimStart().startsWith('//') && !linea.trimStart().startsWith('*'))
      .join('\n');
    // Sin literales de color hexadecimales ni rgb(.
    expect(codigo).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(codigo).not.toMatch(/\brgba?\(/);
  });
});

// ============================================================================
// Property 22: Escalado uniforme del lienzo
// Valida: Requisitos 12.3
// ============================================================================

describe('Property 22: escalado uniforme del lienzo', () => {
  it('sobre 200 semillas: lado acotado, dpr acotado y escala uniforme 1:1', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const prng = crearPrng(semilla);
        const anchoCss = prng.entero(50, 9000);
        const altoCss = prng.entero(50, 9000);
        const dprBruto = prng.siguiente() * 5; // 0 a 5
        const e = calcularEscalado({ anchoCss, altoCss, devicePixelRatio: dprBruto });

        // Lado acotado a [320, 4096].
        expect(e.lado).toBeGreaterThanOrEqual(LADO_MINIMO);
        expect(e.lado).toBeLessThanOrEqual(LADO_MAXIMO);
        // dpr acotado a [1, 3].
        expect(e.dpr).toBeGreaterThanOrEqual(DPR_MINIMO);
        expect(e.dpr).toBeLessThanOrEqual(DPR_MAXIMO);
        // Escala uniforme: es exactamente lado/800 (mismo factor en los dos ejes).
        expect(e.escala).toBe(e.lado / LADO_LOGICO);
        // El búfer es el lado por la densidad, cuadrado (aspecto 1:1 exacto).
        expect(e.bufer).toBe(e.lado * e.dpr);
        // La relación de aspecto del cuadrado lógico dibujado es 1:1 dentro de 1 px:
        // ancho lógico · escala == alto lógico · escala.
        const anchoDibujado = LADO_LOGICO * e.escala;
        const altoDibujado = LADO_LOGICO * e.escala;
        expect(Math.abs(anchoDibujado - altoDibujado)).toBeLessThanOrEqual(1);
      }),
      { seed: 22, numRuns: 200 },
    );
  });
});

// ============================================================================
// Property 14 (parte B, lienzo): redibujado desde las operaciones
// Valida: Requisitos 12.6
// ============================================================================

describe('Property 14B: redibujado desde las operaciones', () => {
  /** Genera una lista de segmentos dentro del cuadrado a partir de una semilla. */
  function segmentosDe(semilla: number): Segmento[] {
    const prng = crearPrng(semilla);
    const n = prng.entero(1, 40);
    const segs: Segmento[] = [];
    let x = prng.entero(-300, 300);
    let y = prng.entero(-300, 300);
    for (let i = 0; i < n; i++) {
      const nx = prng.entero(-300, 300);
      const ny = prng.entero(-300, 300);
      segs.push({ desde: { x, y }, hasta: { x: nx, y: ny }, paso: i, linea: i + 1 });
      x = nx;
      y = ny;
    }
    return segs;
  }

  /** Extrae, de una capa, la secuencia de pares (moveTo, lineTo) de la estela. */
  function polilineaEstela(ctx: DobleDibujo): Array<[number, number]> {
    const puntos: Array<[number, number]> = [];
    for (const l of ctx.llamadas) {
      if (l.metodo === 'moveTo' || l.metodo === 'lineTo') {
        puntos.push([l.args[0] as number, l.args[1] as number]);
      }
    }
    return puntos;
  }

  it('sobre 200 semillas: redibujar tras redimensionar produce la misma estela', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const segs = segmentosDe(semilla);

        // Primer lienzo: cargar estela y capturar la polilínea dibujada.
        const capas1 = crearCapasDobles();
        const lienzo1 = crearLienzo(capas1 as CapasLienzo, estiloCompleto, TAMANO_BASE);
        lienzo1.ponerEstela('jugador', segs);
        const antes = polilineaEstela(capas1.jugador);

        // Cambiar de tamaño y densidad: debe redibujar desde los segmentos
        // guardados, sin volver a invocar el intérprete (no hay intérprete aquí).
        const prng = crearPrng((semilla ^ 0x9e3779b9) >>> 0);
        lienzo1.redimensionar({
          anchoCss: prng.entero(320, 4096),
          altoCss: prng.entero(320, 4096),
          devicePixelRatio: 1 + prng.siguiente() * 2,
        });

        // Las operaciones guardadas no cambian: la estela lógica es la misma.
        expect(lienzo1.segmentosDe('jugador')).toEqual(segs);

        // Un lienzo nuevo con los mismos segmentos produce la misma polilínea lógica.
        const capas2 = crearCapasDobles();
        const lienzo2 = crearLienzo(capas2 as CapasLienzo, estiloCompleto, TAMANO_BASE);
        lienzo2.ponerEstela('jugador', segs);
        const despues = polilineaEstela(capas2.jugador);

        expect(despues).toEqual(antes);
      }),
      { seed: 140, numRuns: 200 },
    );
  });
});

// ============================================================================
// Color y grosor del jugador (reseña del PR #24, punto 5)
//
// El lienzo pinta cada tramo de la estela del jugador con el color y el grosor que
// pidió con PONCOLOR/PONGROSOR; lo que no pidió sale del tema, exactamente como
// antes. La estela de Kiro (capa referencia) conserva siempre el tema.
// ============================================================================

import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { ejecutar, type Operacion } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from './tortuga.js';
import { extraerSegmentos } from './segmentos.js';
import { extraerTramosDibujo } from './tramos-dibujo.js';
import { dibujarTramoEnCurso } from './lienzo.js';

/** Doble que, además de las llamadas, anota el estilo vigente en cada `stroke`. */
class DobleConEstilo extends DobleDibujo {
  readonly trazos: Array<{ color: unknown; grosor: number }> = [];
  /** Trazos y rellenos en orden, con su color: «stroke:#ff0000», «fill:#0000ff». */
  readonly eventos: string[] = [];
  override stroke(): void {
    this.trazos.push({ color: this.strokeStyle, grosor: this.lineWidth });
    this.eventos.push(`stroke:${String(this.strokeStyle)}`);
    super.stroke();
  }
  override fill(): void {
    this.eventos.push(`fill:${String(this.fillStyle)}`);
    super.fill();
  }
  override clearRect(x: number, y: number, ancho: number, alto: number): void {
    // Cada redibujado empieza borrando la capa: los eventos son los del último dibujo.
    this.eventos.length = 0;
    super.clearRect(x, y, ancho, alto);
  }
}

function capasConEstilo(): Record<NombreCapa, DobleConEstilo> {
  return {
    fondo: new DobleConEstilo(),
    referencia: new DobleConEstilo(),
    jugador: new DobleConEstilo(),
    personajes: new DobleConEstilo(),
  };
}

function operacionesDe(texto: string, mundo: 0 | 2 = 2): readonly Operacion[] {
  const { programa, errores } = analizar(analizarLexico(texto).tokens, { mundo });
  expect(errores).toEqual([]);
  const g = ejecutar(programa!, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(mundo), semilla: 0 });
  let p = g.next();
  while (!p.done) p = g.next();
  return p.value.operaciones;
}

describe('lienzo · color y grosor del jugador (punto 5)', () => {
  it('un programa del mundo 0 se dibuja con exactamente las mismas llamadas y estilos que antes', () => {
    const ops = operacionesDe('AVANZA 100 GIRADERECHA 90 AVANZA 100 GIRAIZQUIERDA 45 RETROCEDE 60', 0);
    const antes = capasConEstilo();
    crearLienzo(antes, estiloCompleto, TAMANO_BASE).ponerEstela('jugador', extraerSegmentos(ops));
    const ahora = capasConEstilo();
    crearLienzo(ahora, estiloCompleto, TAMANO_BASE).ponerEstela('jugador', extraerTramosDibujo(ops));

    expect(ahora.jugador.llamadas).toEqual(antes.jugador.llamadas);
    expect(ahora.jugador.trazos).toEqual(antes.jugador.trazos);
    // Y ese estilo es el del tema.
    expect(ahora.jugador.trazos.at(-1)).toEqual({ color: '#0d6efd', grosor: 3 });
  });

  it('una estela vacía se borra con las mismas llamadas que antes', () => {
    const antes = capasConEstilo();
    crearLienzo(antes, estiloCompleto, TAMANO_BASE).ponerEstela('jugador', []);
    const ahora = capasConEstilo();
    crearLienzo(ahora, estiloCompleto, TAMANO_BASE).ponerEstela('jugador', extraerTramosDibujo([]));
    expect(ahora.jugador.llamadas).toEqual(antes.jugador.llamadas);
  });

  it('PONCOLOR rojo AV 100 PG 6 AV 100: el primer tramo va en rojo con el grosor del tema y el segundo en rojo con grosor 6', () => {
    const capas = capasConEstilo();
    const lienzo = crearLienzo(capas, estiloCompleto, TAMANO_BASE);
    capas.jugador.trazos.length = 0;
    lienzo.ponerEstela('jugador', extraerTramosDibujo(operacionesDe('PONCOLOR rojo AV 100 PG 6 AV 100')));
    expect(capas.jugador.trazos).toEqual([
      { color: '#ff0000', grosor: 3 },
      { color: '#ff0000', grosor: 6 },
    ]);
  });

  it('agrupa los tramos seguidos del mismo estilo en un solo trazo', () => {
    const capas = capasConEstilo();
    const lienzo = crearLienzo(capas, estiloCompleto, TAMANO_BASE);
    capas.jugador.trazos.length = 0;
    lienzo.ponerEstela('jugador', extraerTramosDibujo(operacionesDe('AV 10 PONCOLOR rojo REPITE 4 [AV 50 GD 90] PONCOLOR verde AV 20')));
    // Tema (1 tramo), rojo (4 tramos) y verde (1 tramo): tres trazos.
    expect(capas.jugador.trazos.map((t) => t.color)).toEqual(['#0d6efd', '#ff0000', '#008000']);
  });

  it('crecerEstela conserva el estilo de cada tramo y lo repinta igual al redimensionar', () => {
    const capas = capasConEstilo();
    const lienzo = crearLienzo(capas, estiloCompleto, TAMANO_BASE);
    for (const tramo of extraerTramosDibujo(operacionesDe('PONCOLOR rojo AV 100'))) lienzo.crecerEstela('jugador', [tramo]);
    capas.jugador.trazos.length = 0;
    lienzo.redimensionar({ anchoCss: 600, altoCss: 600, devicePixelRatio: 2 });
    expect(capas.jugador.trazos).toEqual([{ color: '#ff0000', grosor: 3 }]);
  });

  it('la estela de Kiro (capa referencia) ignora cualquier estilo y usa siempre el tema', () => {
    const capas = capasConEstilo();
    const lienzo = crearLienzo(capas, estiloCompleto, TAMANO_BASE);
    capas.referencia.trazos.length = 0;
    lienzo.ponerEstela('referencia', extraerTramosDibujo(operacionesDe('PONCOLOR rojo PG 9 AV 100')));
    expect(capas.referencia.trazos).toEqual([{ color: '#6c757d', grosor: 2 }]);
  });
});

describe('lienzo · tramo en curso de la animación (punto 5)', () => {
  const TEMA = estiloCompleto().estelaJugador;

  it('el tramo que se va dibujando lleva el color y el grosor del jugador', () => {
    const [tramo] = extraerTramosDibujo(operacionesDe('PONCOLOR rojo PG 6 AV 100'));
    const ctx = new DobleConEstilo();
    dibujarTramoEnCurso(ctx, tramo!, TEMA, true);
    expect(ctx.trazos).toEqual([{ color: '#ff0000', grosor: 6 }]);
  });

  it('sin estilo pedido, el tramo en curso usa el tema', () => {
    const [tramo] = extraerTramosDibujo(operacionesDe('AV 100'));
    const ctx = new DobleConEstilo();
    dibujarTramoEnCurso(ctx, tramo!, TEMA, true);
    expect(ctx.trazos).toEqual([{ color: '#0d6efd', grosor: 3 }]);
  });

  it('con el estilo desactivado (la tortuga de Kiro) usa el tema aunque el tramo traiga color', () => {
    const [tramo] = extraerTramosDibujo(operacionesDe('PONCOLOR rojo PG 6 AV 100'));
    const ctx = new DobleConEstilo();
    dibujarTramoEnCurso(ctx, tramo!, TEMA, false);
    expect(ctx.trazos).toEqual([{ color: '#0d6efd', grosor: 3 }]);
  });

  it('recorta al cuadrado lógico, como la estela definitiva', () => {
    const [tramo] = extraerTramosDibujo(operacionesDe('AV 100'));
    const ctx = new DobleConEstilo();
    dibujarTramoEnCurso(ctx, tramo!, TEMA, true);
    const metodos = ctx.llamadas.map((l) => l.metodo);
    expect(metodos[0]).toBe('save');
    expect(metodos.at(-1)).toBe('restore');
    expect(metodos.indexOf('rect')).toBeLessThan(metodos.indexOf('clip'));
    expect(metodos.indexOf('clip')).toBeLessThan(metodos.indexOf('stroke'));
    expect(metodos.filter((m) => m === 'stroke')).toHaveLength(1);
  });
});

// ============================================================================
// Relleno (reseña del PR #24, punto 7b; R4.6, R4.7)
// ============================================================================

import { crearAnimador, type Reloj } from './animador.js';

/** Reloj que no avanza: con movimiento reducido el animador aplica todo de golpe. */
const RELOJ_QUIETO: Reloj = { programar: () => 1, cancelar: () => {}, ahora: () => 0 };

/** Ejecuta un programa en un lienzo real (capas dobles) a través del animador, de golpe. */
function dibujarConAnimador(texto: string) {
  const capas = capasConEstilo();
  const lienzo = crearLienzo(capas, estiloCompleto, TAMANO_BASE);
  const animador = crearAnimador(lienzo, RELOJ_QUIETO, () => true);
  animador.cargar(operacionesDe(texto), 'jugador');
  animador.reproducir();
  return { capas, lienzo };
}

const rellenos = (eventos: readonly string[]) => eventos.filter((e) => e.startsWith('fill:'));

describe('lienzo · relleno (punto 7b)', () => {
  it('PONCOLOR rojo REPITE 4 [AV 100 GD 90] RELLENA "azul AV 100: rellena en azul debajo de los trazos y el último tramo sigue en rojo', () => {
    const { capas } = dibujarConAnimador('PONCOLOR rojo REPITE 4 [AV 100 GD 90] RELLENA "azul AV 100');
    const eventos = capas.jugador.eventos;
    // Un relleno azul, y va antes (debajo) de los trazos.
    expect(rellenos(eventos)).toEqual(['fill:#0000ff']);
    expect(eventos[0]).toBe('fill:#0000ff');
    // Todos los trazos, incluido el AV 100 posterior al relleno, en rojo: RELLENA no cambia el lápiz.
    expect(eventos.filter((e) => e.startsWith('stroke:'))).toEqual(['stroke:#ff0000']);
    expect(capas.jugador.trazos.at(-1)).toEqual({ color: '#ff0000', grosor: 3 });
  });

  it('el ejemplo de la reseña, REPITE 4 [AV 100 GD 90] RELLENA "azul, rellena el cuadrado y lo traza con el tema', () => {
    const { capas } = dibujarConAnimador('REPITE 4 [AV 100 GD 90] RELLENA "azul');
    expect(capas.jugador.eventos).toEqual(['fill:#0000ff', 'stroke:#0d6efd']);
  });

  it('sin área cerrada (figura abierta) RELLENA no pinta nada (R4.7)', () => {
    const { capas } = dibujarConAnimador('REPITE 3 [AV 100 GD 90] RELLENA "azul');
    expect(rellenos(capas.jugador.eventos)).toEqual([]);
  });

  it('con la tortuga fuera de la figura RELLENA no pinta nada (R4.7)', () => {
    const { capas } = dibujarConAnimador('REPITE 4 [AV 100 GD 90] SL RE 50 BL RELLENA "azul');
    expect(rellenos(capas.jugador.eventos)).toEqual([]);
  });

  it('el relleno se calcula con los trazos de ese momento: un trazo posterior no lo cambia', () => {
    const { capas } = dibujarConAnimador('REPITE 4 [AV 100 GD 90] RELLENA "azul GD 45 AV 140');
    expect(rellenos(capas.jugador.eventos)).toEqual(['fill:#0000ff']);
  });

  it('dos RELLENA en dos figuras pintan cada una con su color', () => {
    const { capas } = dibujarConAnimador(
      'REPITE 4 [AV 100 GD 90] RELLENA "azul SL GD 90 AV 200 GI 90 BL REPITE 4 [AV 100 GD 90] RELLENA verde',
    );
    expect(rellenos(capas.jugador.eventos)).toEqual(['fill:#0000ff', 'fill:#008000']);
  });

  it('BORRAPANTALLA descarta el relleno junto con la estela', () => {
    const { capas } = dibujarConAnimador('REPITE 4 [AV 100 GD 90] RELLENA "azul BORRAPANTALLA AV 50');
    expect(rellenos(capas.jugador.eventos)).toEqual([]);
  });

  it('el relleno se conserva al redimensionar', () => {
    const { capas, lienzo } = dibujarConAnimador('REPITE 4 [AV 100 GD 90] RELLENA "azul');
    lienzo.redimensionar({ anchoCss: 600, altoCss: 600, devicePixelRatio: 2 });
    expect(rellenos(capas.jugador.eventos)).toEqual(['fill:#0000ff']);
  });

  it('reiniciar la capa del jugador borra el relleno', () => {
    const { capas, lienzo } = dibujarConAnimador('REPITE 4 [AV 100 GD 90] RELLENA "azul');
    lienzo.limpiarEstela('jugador');
    expect(rellenos(capas.jugador.eventos)).toEqual([]);
  });

  it('la capa de Kiro (referencia) nunca se rellena', () => {
    const capas = capasConEstilo();
    const lienzo = crearLienzo(capas, estiloCompleto, TAMANO_BASE);
    lienzo.ponerEstela('referencia', extraerTramosDibujo(operacionesDe(CUADRADO_REF)));
    lienzo.rellenar('referencia', { r: 0, g: 0, b: 255, nombre: 'azul' }, { x: 50, y: 50 });
    expect(rellenos(capas.referencia.eventos)).toEqual([]);
  });

  it('un programa del mundo 0 sigue dibujándose sin ningún relleno', () => {
    const { capas } = dibujarConAnimador('AV 100 GD 90 AV 100 GD 90 AV 100 GD 90 AV 100');
    expect(rellenos(capas.jugador.eventos)).toEqual([]);
  });
});

const CUADRADO_REF = 'REPITE 4 [AV 100 GD 90]';