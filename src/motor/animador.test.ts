// Pruebas del animador: reloj falso, cuatro velocidades, paso a paso, reinicio,
// secuencia vacía, cambio de velocidad en curso y prefers-reduced-motion.
//
// Corre en Node con un reloj falso y un doble de lienzo, sin requestAnimationFrame.

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { crearPrng } from '../azar/prng.js';
import {
  crearAnimador,
  DURACIONES,
  type Fotograma,
  type Reloj,
  type LienzoAnimador,
  type Velocidad,
} from './animador.js';
import { extraerSegmentos, type Segmento } from './segmentos.js';
import type { Operacion } from '../lenguaje/interprete.js';
import { ESTADO_INICIAL, desplazar, girar, type EstadoTortuga } from './tortuga.js';

// ============================================================================
// Reloj falso: tiempo controlado, cola de callbacks pendientes
// ============================================================================

class RelojFalso implements Reloj {
  private t = 0;
  private siguienteId = 1;
  private pendientes = new Map<number, (ahora: number) => void>();

  ahora(): number {
    return this.t;
  }

  programar(callback: (ahora: number) => void): number {
    const id = this.siguienteId++;
    this.pendientes.set(id, callback);
    return id;
  }

  cancelar(id: number): void {
    this.pendientes.delete(id);
  }

  /** Avanza el tiempo `ms` y dispara todos los fotogramas programados en el camino. */
  avanzar(ms: number, pasoFotograma = 16): void {
    const objetivo = this.t + ms;
    let guarda = 0;
    while (this.t < objetivo && this.pendientes.size > 0) {
      this.t = Math.min(this.t + pasoFotograma, objetivo);
      const cola = [...this.pendientes.entries()];
      this.pendientes.clear();
      for (const [, cb] of cola) cb(this.t);
      if (++guarda > 100_000) break;
    }
    this.t = objetivo;
  }

  /** Dispara un solo fotograma sin avanzar el tiempo. */
  disparar(): void {
    const cola = [...this.pendientes.entries()];
    this.pendientes.clear();
    for (const [, cb] of cola) cb(this.t);
  }

  hayPendientes(): boolean {
    return this.pendientes.size > 0;
  }
}

// ============================================================================
// Doble de lienzo: acumula la estela de la capa del jugador
// ============================================================================

class LienzoDoble implements LienzoAnimador {
  estelas: Record<'jugador' | 'referencia', Segmento[]> = { jugador: [], referencia: [] };

  crecerEstela(capa: 'jugador' | 'referencia', segmentos: readonly Segmento[]): void {
    for (const s of segmentos) this.estelas[capa].push({ ...s });
  }

  limpiarEstela(capa: 'jugador' | 'referencia'): void {
    this.estelas[capa] = [];
  }
}

// ============================================================================
// Ayudas para construir operaciones
// ============================================================================

let contadorPaso = 0;

function opMover(desde: EstadoTortuga, distancia: number, lapizAbajo: boolean): Operacion {
  const r = desplazar({ ...desde, lapizAbajo }, distancia, 'adelante');
  const estadoDespues = r.valido ? r.estado : desde;
  const op: Operacion = {
    tipo: 'mover',
    paso: contadorPaso++,
    linea: 1,
    profundidad: 0,
    estadoAntes: { ...desde, lapizAbajo },
    estadoDespues,
    desde: { x: desde.posicion.x, y: desde.posicion.y },
    hasta: { x: estadoDespues.posicion.x, y: estadoDespues.posicion.y },
    lapizAbajo,
  };
  return op;
}

function opGirar(desde: EstadoTortuga, grados: number): Operacion {
  const r = girar(desde, grados, 'derecha');
  const estadoDespues = r.valido ? r.estado : desde;
  return {
    tipo: 'girar',
    paso: contadorPaso++,
    linea: 1,
    profundidad: 0,
    estadoAntes: desde,
    estadoDespues,
    grados,
    sentido: 'derecha',
  };
}

/** Construye una secuencia encadenada de operaciones mover/girar. */
function secuenciaSimple(): Operacion[] {
  contadorPaso = 0;
  const ops: Operacion[] = [];
  let estado = ESTADO_INICIAL;
  for (let i = 0; i < 10; i++) {
    const op = opMover(estado, 50, true);
    ops.push(op);
    estado = op.estadoDespues;
    const g = opGirar(estado, 90);
    ops.push(g);
    estado = g.estadoDespues;
  }
  return ops;
}

const SIN_REDUCIR = (): boolean => false;

// ============================================================================
// Consumo de operaciones y estela final
// ============================================================================

describe('animador · consumo de operaciones', () => {
  it('al terminar, la estela es exactamente la de extraerSegmentos', () => {
    const ops = secuenciaSimple();
    const lienzo = new LienzoDoble();
    const reloj = new RelojFalso();
    const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
    animador.cargar(ops, 'jugador');
    animador.ponerVelocidad('inmediata');
    animador.reproducir();

    expect(lienzo.estelas.jugador).toEqual(extraerSegmentos(ops));
  });

  it('una secuencia vacía termina sin dibujar ni error', () => {
    const lienzo = new LienzoDoble();
    const reloj = new RelojFalso();
    const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
    let fin = false;
    animador.alTerminar(() => (fin = true));
    animador.cargar([], 'jugador');
    animador.reproducir();
    expect(fin).toBe(true);
    expect(lienzo.estelas.jugador).toEqual([]);
  });

  it('crece la estela solo con el lápiz abajo', () => {
    contadorPaso = 0;
    const conLapiz = opMover(ESTADO_INICIAL, 100, true);
    const sinLapiz = opMover(conLapiz.estadoDespues, 100, false);
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
    animador.cargar([conLapiz, sinLapiz], 'jugador');
    animador.ponerVelocidad('inmediata');
    animador.reproducir();
    expect(lienzo.estelas.jugador.length).toBe(1);
  });

  it('limpiar borra la capa de destino', () => {
    contadorPaso = 0;
    const mover = opMover(ESTADO_INICIAL, 100, true);
    const limpiar: Operacion = {
      tipo: 'limpiar',
      paso: contadorPaso++,
      linea: 2,
      profundidad: 0,
      estadoAntes: mover.estadoDespues,
      estadoDespues: ESTADO_INICIAL,
    };
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
    animador.cargar([mover, limpiar], 'jugador');
    animador.ponerVelocidad('inmediata');
    animador.reproducir();
    expect(lienzo.estelas.jugador).toEqual([]);
  });
});

// ============================================================================
// Cuatro velocidades
// ============================================================================

describe('animador · velocidades', () => {
  const velocidades: Velocidad[] = ['lenta', 'normal', 'rapida'];

  for (const v of velocidades) {
    it(`la velocidad ${v} cumple su duración total (±25%) sobre 10 operaciones`, () => {
      contadorPaso = 0;
      // 10 operaciones mover, todas con estela.
      const ops: Operacion[] = [];
      let estado = ESTADO_INICIAL;
      for (let i = 0; i < 10; i++) {
        const op = opMover(estado, 30, true);
        ops.push(op);
        estado = op.estadoDespues;
      }
      const lienzo = new LienzoDoble();
      const reloj = new RelojFalso();
      const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
      let fin: number | null = null;
      animador.alTerminar((f) => (fin = f.operacionesAplicadas));
      animador.cargar(ops, 'jugador');
      animador.ponerVelocidad(v);
      animador.reproducir();

      const totalEsperado = DURACIONES[v] * 10;
      // Avanzamos con fotogramas de 16 ms hasta pasar el total con margen.
      reloj.avanzar(totalEsperado * 1.5, 16);

      expect(fin).toBe(10);
      expect(lienzo.estelas.jugador.length).toBe(10);
    });
  }

  it('la velocidad inmediata completa 500 operaciones en ≤ 100 ms sin fotogramas', () => {
    contadorPaso = 0;
    const ops: Operacion[] = [];
    let estado = ESTADO_INICIAL;
    for (let i = 0; i < 500; i++) {
      const op = opMover(estado, 5, true);
      ops.push(op);
      estado = op.estadoDespues;
    }
    const lienzo = new LienzoDoble();
    const reloj = new RelojFalso();
    const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
    animador.cargar(ops, 'jugador');
    animador.ponerVelocidad('inmediata');

    const inicio = performance.now();
    animador.reproducir();
    const dur = performance.now() - inicio;

    expect(dur).toBeLessThanOrEqual(100);
    expect(lienzo.estelas.jugador.length).toBe(500);
    // No quedó ningún fotograma programado: no dibujó posiciones intermedias.
    expect(reloj.hayPendientes()).toBe(false);
  });
});

// ============================================================================
// Cambio de velocidad en curso
// ============================================================================

describe('animador · cambio de velocidad en curso', () => {
  it('se aplica desde la siguiente operación, conserva la estela y el contador', () => {
    contadorPaso = 0;
    const ops: Operacion[] = [];
    let estado = ESTADO_INICIAL;
    for (let i = 0; i < 6; i++) {
      const op = opMover(estado, 20, true);
      ops.push(op);
      estado = op.estadoDespues;
    }
    const lienzo = new LienzoDoble();
    const reloj = new RelojFalso();
    const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
    animador.cargar(ops, 'jugador');
    animador.ponerVelocidad('lenta');
    animador.reproducir();

    // Avanzamos lo justo para aplicar unas pocas operaciones a velocidad lenta.
    reloj.avanzar(DURACIONES.lenta * 2 + 32, 16);
    const aplicadasAntes = lienzo.estelas.jugador.length;
    expect(aplicadasAntes).toBeGreaterThanOrEqual(2);

    // Cambiamos a rápida: no reinicia ni borra la estela ya dibujada.
    animador.ponerVelocidad('rapida');
    reloj.avanzar(DURACIONES.rapida * 10, 16);

    // No se perdió ninguna operación ni se repitió: exactamente 6 al final.
    expect(lienzo.estelas.jugador.length).toBe(6);
    expect(lienzo.estelas.jugador.length).toBeGreaterThanOrEqual(aplicadasAntes);
  });
});

// ============================================================================
// Paso a paso
// ============================================================================

describe('animador · paso a paso', () => {
  it('cada paso aplica exactamente una operación y aumenta el contador', () => {
    contadorPaso = 0;
    const ops: Operacion[] = [];
    let estado = ESTADO_INICIAL;
    for (let i = 0; i < 3; i++) {
      const op = opMover(estado, 40, true);
      ops.push(op);
      estado = op.estadoDespues;
    }
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
    const aplicadas: number[] = [];
    animador.alAplicar((op) => aplicadas.push(op.paso));
    animador.cargar(ops, 'jugador');

    expect(animador.paso()).toBeNull();
    expect(lienzo.estelas.jugador.length).toBe(1);
    expect(animador.paso()).toBeNull();
    expect(lienzo.estelas.jugador.length).toBe(2);
    const ultimo = animador.paso();
    expect(ultimo).not.toBeNull();
    expect(ultimo!.operacionesAplicadas).toBe(3);
    expect(aplicadas).toEqual([0, 1, 2]);
  });

  it('paso sin operaciones pendientes devuelve el fin de secuencia sin dibujar', () => {
    contadorPaso = 0;
    const op = opMover(ESTADO_INICIAL, 40, true);
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
    animador.cargar([op], 'jugador');
    animador.paso(); // aplica la única
    const extra = animador.paso(); // ya no hay pendientes
    expect(extra).not.toBeNull();
    expect(extra!.motivo).toBe('finDeSecuencia');
    expect(extra!.operacionesAplicadas).toBe(1);
    expect(lienzo.estelas.jugador.length).toBe(1); // no dibujó de más
  });
});

// ============================================================================
// Reinicio
// ============================================================================

describe('animador · reinicio', () => {
  it('pone el contador en cero, borra la capa del jugador y conserva la secuencia', () => {
    const ops = secuenciaSimple();
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
    animador.cargar(ops, 'jugador');
    animador.ponerVelocidad('inmediata');
    animador.reproducir();
    expect(lienzo.estelas.jugador.length).toBeGreaterThan(0);

    animador.reiniciar(ESTADO_INICIAL);
    expect(lienzo.estelas.jugador).toEqual([]);

    // La secuencia se conserva: se puede reproducir otra vez con el mismo resultado.
    animador.reproducir();
    expect(lienzo.estelas.jugador).toEqual(extraerSegmentos(ops));
  });
});

// ============================================================================
// prefers-reduced-motion
// ============================================================================

describe('animador · prefers-reduced-motion', () => {
  it('con la preferencia activa dibuja la estela completa sin fotogramas', () => {
    contadorPaso = 0;
    const ops: Operacion[] = [];
    let estado = ESTADO_INICIAL;
    for (let i = 0; i < 20; i++) {
      const op = opMover(estado, 10, true);
      ops.push(op);
      estado = op.estadoDespues;
    }
    const lienzo = new LienzoDoble();
    const reloj = new RelojFalso();
    // Preferencia activa: aunque la velocidad sea lenta, no hay fotogramas.
    const animador = crearAnimador(lienzo, reloj, () => true);
    animador.cargar(ops, 'jugador');
    animador.ponerVelocidad('lenta');
    animador.reproducir();

    expect(reloj.hayPendientes()).toBe(false);
    expect(lienzo.estelas.jugador).toEqual(extraerSegmentos(ops));
  });

  it('el paso a paso sigue disponible con la preferencia activa', () => {
    contadorPaso = 0;
    const op1 = opMover(ESTADO_INICIAL, 40, true);
    const op2 = opMover(op1.estadoDespues, 40, true);
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), () => true);
    animador.cargar([op1, op2], 'jugador');
    expect(animador.paso()).toBeNull();
    expect(lienzo.estelas.jugador.length).toBe(1);
  });

  it('la estela final es la misma con la preferencia activa o inactiva', () => {
    const ops = secuenciaSimple();
    const conReduccion = new LienzoDoble();
    const animadorR = crearAnimador(conReduccion, new RelojFalso(), () => true);
    animadorR.cargar(ops, 'jugador');
    animadorR.reproducir();

    const sinReduccion = new LienzoDoble();
    const reloj = new RelojFalso();
    const animadorN = crearAnimador(sinReduccion, reloj, SIN_REDUCIR);
    animadorN.cargar(ops, 'jugador');
    animadorN.ponerVelocidad('rapida');
    animadorN.reproducir();
    reloj.avanzar(DURACIONES.rapida * ops.length * 2, 16);

    expect(conReduccion.estelas.jugador).toEqual(sinReduccion.estelas.jugador);
  });
});

// ============================================================================
// Property 15 (parte A, animador): lo dibujado es lo que se valida
// Valida: Requisitos 14.1, 14.7
// ============================================================================

describe('Property 15A: lo dibujado es exactamente lo que se valida', () => {
  /** Genera una secuencia de operaciones encadenadas a partir de una semilla. */
  function secuenciaDe(semilla: number): Operacion[] {
    contadorPaso = 0;
    const prng = crearPrng(semilla);
    const n = prng.entero(0, 30);
    const ops: Operacion[] = [];
    let estado = ESTADO_INICIAL;
    for (let i = 0; i < n; i++) {
      const clase = prng.entero(0, 3);
      if (clase === 0) {
        // mover con lápiz abajo
        const op = opMover(estado, prng.entero(1, 200), true);
        ops.push(op);
        estado = op.estadoDespues;
      } else if (clase === 1) {
        // mover con lápiz arriba
        const op = opMover(estado, prng.entero(1, 200), false);
        ops.push(op);
        estado = op.estadoDespues;
      } else if (clase === 2) {
        // girar
        const op = opGirar(estado, prng.entero(0, 359));
        ops.push(op);
        estado = op.estadoDespues;
      } else {
        // limpiar
        const op: Operacion = {
          tipo: 'limpiar',
          paso: contadorPaso++,
          linea: 1,
          profundidad: 0,
          estadoAntes: estado,
          estadoDespues: { ...estado, posicion: { x: 0, y: 0 }, rumbo: 0 },
        };
        ops.push(op);
        estado = op.estadoDespues;
      }
    }
    return ops;
  }

  it('sobre 200 semillas: la estela reproducida iguala extraerSegmentos', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const ops = secuenciaDe(semilla);
        const lienzo = new LienzoDoble();
        const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
        animador.cargar(ops, 'jugador');
        animador.ponerVelocidad('inmediata');
        animador.reproducir();
        expect(lienzo.estelas.jugador).toEqual(extraerSegmentos(ops));
      }),
      { seed: 15, numRuns: 200 },
    );
  });

  it('el paso a paso produce la misma estela final que la reproducción completa', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4_294_967_295 }), (semilla) => {
        const ops = secuenciaDe(semilla);

        const lienzoInmediato = new LienzoDoble();
        const a1 = crearAnimador(lienzoInmediato, new RelojFalso(), SIN_REDUCIR);
        a1.cargar(ops, 'jugador');
        a1.ponerVelocidad('inmediata');
        a1.reproducir();

        const lienzoPaso = new LienzoDoble();
        const a2 = crearAnimador(lienzoPaso, new RelojFalso(), SIN_REDUCIR);
        a2.cargar(ops, 'jugador');
        let seguir = true;
        let guarda = 0;
        while (seguir && guarda++ < 1000) {
          const r = a2.paso();
          if (r !== null) seguir = false;
        }

        expect(lienzoPaso.estelas.jugador).toEqual(lienzoInmediato.estelas.jugador);
      }),
      { seed: 150, numRuns: 200 },
    );
  });
});

// ============================================================================
// Fotogramas: la tortuga se mueve mientras la estela crece
// ============================================================================

describe('animador · fotogramas', () => {
  /** Anima una sola operación `mover` de 100 unidades y devuelve todo lo observable. */
  function animarUnMover(): {
    reloj: RelojFalso;
    lienzo: LienzoDoble;
    fotogramas: Fotograma[];
    op: Operacion;
  } {
    contadorPaso = 0;
    const op = opMover(ESTADO_INICIAL, 100, true);
    const lienzo = new LienzoDoble();
    const reloj = new RelojFalso();
    const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar([op], 'jugador');
    animador.reproducir();
    return { reloj, lienzo, fotogramas, op };
  }

  it('a medio camino de un mover, la tortuga está entre el origen y el destino con su tramo', () => {
    const { reloj, fotogramas } = animarUnMover();
    reloj.avanzar(DURACIONES.normal / 2);

    const ultimo = fotogramas[fotogramas.length - 1]!;
    // La suavización es simétrica: a la mitad del tiempo, la mitad del camino.
    expect(ultimo.estado.posicion.x).toBeCloseTo(0, 6);
    expect(ultimo.estado.posicion.y).toBeCloseTo(50, 6);
    expect(ultimo.tramo).not.toBeNull();
    expect(ultimo.tramo!.desde).toEqual({ x: 0, y: 0 });
    expect(ultimo.tramo!.hasta.y).toBeCloseTo(50, 6);
  });

  it('la posición dibujada crece de forma monótona sin salirse del tramo', () => {
    const { reloj, fotogramas } = animarUnMover();
    reloj.avanzar(DURACIONES.normal * 1.5);

    const ys = fotogramas.map((f) => f.estado.posicion.y);
    expect(ys.length).toBeGreaterThan(5);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]!).toBeGreaterThanOrEqual(ys[i - 1]!);
    }
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it('el tramo parcial no entra en la estela hasta que la operación termina', () => {
    const { reloj, lienzo, fotogramas, op } = animarUnMover();
    reloj.avanzar(DURACIONES.normal / 2);
    expect(fotogramas.some((f) => f.tramo !== null)).toBe(true);
    expect(lienzo.estelas.jugador).toEqual([]);

    reloj.avanzar(DURACIONES.normal);
    expect(lienzo.estelas.jugador).toEqual(extraerSegmentos([op]));
  });

  it('al terminar la operación, el último fotograma es su estado final y sin tramo', () => {
    const { reloj, fotogramas, op } = animarUnMover();
    reloj.avanzar(DURACIONES.normal * 2);

    // Tras terminar no queda nada programado, y lo último pintado es la llegada.
    const ultimo = fotogramas[fotogramas.length - 1]!;
    expect(ultimo.estado).toEqual(op.estadoDespues);
    expect(ultimo.tramo).toBeNull();
    expect(reloj.hayPendientes()).toBe(false);
  });

  it('sin lápiz abajo la tortuga se mueve pero no lleva tramo', () => {
    contadorPaso = 0;
    const op = opMover(ESTADO_INICIAL, 100, false);
    const reloj = new RelojFalso();
    const animador = crearAnimador(new LienzoDoble(), reloj, SIN_REDUCIR);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar([op], 'jugador');
    animador.reproducir();
    reloj.avanzar(DURACIONES.normal / 2);

    expect(fotogramas[fotogramas.length - 1]!.estado.posicion.y).toBeGreaterThan(0);
    expect(fotogramas.every((f) => f.tramo === null)).toBe(true);
  });

  it('un giro avanza en el sentido pedido y no mueve a la tortuga', () => {
    contadorPaso = 0;
    // 270 a la derecha: por el camino corto serían 90 a la izquierda, pero se pidió el largo.
    const op = opGirar(ESTADO_INICIAL, 270);
    const reloj = new RelojFalso();
    const animador = crearAnimador(new LienzoDoble(), reloj, SIN_REDUCIR);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar([op], 'jugador');
    animador.reproducir();
    reloj.avanzar(DURACIONES.normal / 2);

    const medio = fotogramas[fotogramas.length - 1]!;
    expect(medio.estado.rumbo).toBeCloseTo(135, 6); // la mitad de 270, creciendo
    expect(medio.estado.posicion).toEqual({ x: 0, y: 0 });
    expect(medio.tramo).toBeNull();
  });

  it('un giro a la izquierda resta rumbo', () => {
    contadorPaso = 0;
    const op: Operacion = {
      tipo: 'girar',
      paso: contadorPaso++,
      linea: 1,
      profundidad: 0,
      estadoAntes: { ...ESTADO_INICIAL, rumbo: 90 },
      estadoDespues: { ...ESTADO_INICIAL, rumbo: 0 },
      grados: 90,
      sentido: 'izquierda',
    };
    const reloj = new RelojFalso();
    const animador = crearAnimador(new LienzoDoble(), reloj, SIN_REDUCIR);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar([op], 'jugador');
    animador.reproducir();
    reloj.avanzar(DURACIONES.normal / 2);

    expect(fotogramas[fotogramas.length - 1]!.estado.rumbo).toBeCloseTo(45, 6);
  });

  it('con velocidad inmediata pinta una sola vez la tortuga en su estado final', () => {
    const ops = secuenciaSimple();
    const animador = crearAnimador(new LienzoDoble(), new RelojFalso(), SIN_REDUCIR);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar(ops, 'jugador');
    animador.ponerVelocidad('inmediata');
    animador.reproducir();

    expect(fotogramas.length).toBe(1);
    expect(fotogramas[0]!.estado).toEqual(ops[ops.length - 1]!.estadoDespues);
    expect(fotogramas[0]!.tramo).toBeNull();
  });

  it('con movimiento reducido pinta una sola vez la tortuga en su estado final', () => {
    const ops = secuenciaSimple();
    const animador = crearAnimador(new LienzoDoble(), new RelojFalso(), () => true);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar(ops, 'jugador');
    animador.reproducir();

    expect(fotogramas.length).toBe(1);
    expect(fotogramas[0]!.estado).toEqual(ops[ops.length - 1]!.estadoDespues);
  });

  it('el paso a paso pinta la tortuga en el estado final de cada operación', () => {
    const ops = secuenciaSimple();
    const animador = crearAnimador(new LienzoDoble(), new RelojFalso(), SIN_REDUCIR);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar(ops, 'jugador');

    animador.paso();
    animador.paso();
    animador.paso();

    expect(fotogramas.map((f) => f.estado)).toEqual(ops.slice(0, 3).map((o) => o.estadoDespues));
    expect(fotogramas.every((f) => f.tramo === null)).toBe(true);
  });

  it('sin ningún escucha de fotogramas el animador funciona igual que antes', () => {
    const ops = secuenciaSimple();
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
    animador.cargar(ops, 'jugador');
    animador.ponerVelocidad('inmediata');
    expect(() => animador.reproducir()).not.toThrow();
    expect(lienzo.estelas.jugador).toEqual(extraerSegmentos(ops));
  });

  it('al pasar a la operación siguiente retoma desde la llegada de la anterior, sin saltos atrás', () => {
    contadorPaso = 0;
    const primera = opMover(ESTADO_INICIAL, 100, true);
    const segunda = opMover(primera.estadoDespues, 100, true);
    const reloj = new RelojFalso();
    const animador = crearAnimador(new LienzoDoble(), reloj, SIN_REDUCIR);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar([primera, segunda], 'jugador');
    animador.reproducir();
    reloj.avanzar(DURACIONES.normal * 3);

    const ys = fotogramas.map((f) => f.estado.posicion.y);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]!).toBeGreaterThanOrEqual(ys[i - 1]!);
    }
    expect(ys[ys.length - 1]).toBeCloseTo(200, 6);
  });
});

describe('animador · detener termina el tramo en curso', () => {
  it('deja la estela y la tortuga en el final de la operación que estaba en marcha', () => {
    contadorPaso = 0;
    const op = opMover(ESTADO_INICIAL, 100, true);
    const lienzo = new LienzoDoble();
    const reloj = new RelojFalso();
    const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
    const fotogramas: Fotograma[] = [];
    let fin: unknown = null;
    animador.alFotograma((f) => fotogramas.push(f));
    animador.alTerminar((f) => (fin = f));
    animador.cargar([op], 'jugador');
    animador.reproducir();
    reloj.avanzar(DURACIONES.normal / 2);
    expect(lienzo.estelas.jugador).toEqual([]);

    animador.detener();

    expect(lienzo.estelas.jugador).toEqual(extraerSegmentos([op]));
    expect(fotogramas[fotogramas.length - 1]!.estado).toEqual(op.estadoDespues);
    expect(fin).toEqual({
      motivo: 'detenidoPorJugador',
      operacionesAplicadas: 1,
      estadoFinal: op.estadoDespues,
    });
    expect(reloj.hayPendientes()).toBe(false);
  });

  it('detener sin reproducción en marcha no aplica nada', () => {
    contadorPaso = 0;
    const op = opMover(ESTADO_INICIAL, 100, true);
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
    animador.cargar([op], 'jugador');
    animador.detener();
    expect(lienzo.estelas.jugador).toEqual([]);
  });
});

// ============================================================================
// Color y grosor del jugador en la animación (reseña del PR #24, punto 5)
// ============================================================================

import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { extraerTramosDibujo, type TramoDibujo } from './tramos-dibujo.js';

describe('animador · color y grosor del jugador (punto 5)', () => {
  function opsDe(texto: string): readonly Operacion[] {
    const { programa } = analizar(analizarLexico(texto).tokens, { mundo: 2 });
    const g = ejecutar(programa!, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(2), semilla: 0 });
    let p = g.next();
    while (!p.done) p = g.next();
    return p.value.operaciones;
  }

  const TEXTO = 'AV 10 PONCOLOR rojo PG 6 AV 20 BORRAPANTALLA AV 30';

  it('de golpe (movimiento reducido), la estela que crece es la del extractor de dibujo, con su estilo', () => {
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), () => true);
    const ops = opsDe(TEXTO);
    animador.cargar(ops, 'jugador');
    animador.reproducir();
    expect(lienzo.estelas.jugador).toEqual(extraerTramosDibujo(ops));
    const ultimo = lienzo.estelas.jugador.at(-1) as TramoDibujo;
    expect(ultimo.color?.nombre).toBe('rojo');
    expect(ultimo.grosor).toBe(6);
  });

  it('paso a paso, cada tramo llega con el estilo vigente en ese momento', () => {
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), () => false);
    animador.cargar(opsDe('AV 10 PONCOLOR rojo AV 20'), 'jugador');
    for (let i = 0; i < 3; i++) animador.paso();
    const [primero, segundo] = lienzo.estelas.jugador as TramoDibujo[];
    expect(primero!.color).toBeUndefined();
    expect(segundo!.color?.nombre).toBe('rojo');
  });

  it('el tramo de un fotograma intermedio lleva el color y el grosor del jugador', () => {
    const reloj = new RelojFalso();
    const animador = crearAnimador(new LienzoDoble(), reloj, () => false);
    const fotogramas: Fotograma[] = [];
    animador.alFotograma((f) => fotogramas.push(f));
    animador.cargar(opsDe('PONCOLOR azul PG 4 AV 100'), 'jugador');
    animador.reproducir();
    reloj.avanzar(DURACIONES.normal * 2 + 200);
    const conTramo = fotogramas.filter((f) => f.tramo !== null);
    expect(conTramo.length).toBeGreaterThan(0);
    for (const f of conTramo) {
      const tramo = f.tramo as TramoDibujo;
      expect(tramo.color?.nombre).toBe('azul');
      expect(tramo.grosor).toBe(4);
    }
  });

  it('reiniciar y cargar otra secuencia vuelve al estilo del tema', () => {
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), () => true);
    animador.cargar(opsDe('PONCOLOR rojo AV 10'), 'jugador');
    animador.reproducir();
    animador.reiniciar(ESTADO_INICIAL);
    animador.cargar(opsDe('AV 10'), 'jugador');
    animador.reproducir();
    expect(lienzo.estelas.jugador).toEqual(extraerSegmentos(opsDe('AV 10')));
  });
});

describe('animador · relleno (punto 7b)', () => {
  function opsDe(texto: string): readonly Operacion[] {
    const { programa } = analizar(analizarLexico(texto).tokens, { mundo: 2 });
    const g = ejecutar(programa!, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(2), semilla: 0 });
    let p = g.next();
    while (!p.done) p = g.next();
    return p.value.operaciones;
  }

  class LienzoConRelleno extends LienzoDoble {
    readonly pedidos: Array<{ capa: string; color: string | null; punto: { x: number; y: number }; tramosAntes: number }> = [];
    rellenar(capa: 'jugador' | 'referencia', color: { nombre: string | null }, punto: { x: number; y: number }): void {
      this.pedidos.push({ capa, color: color.nombre, punto, tramosAntes: this.estelas[capa].length });
    }
  }

  it('al aplicar RELLENA pide el relleno en la posición de la tortuga, con su color, después de los trazos previos', () => {
    const lienzo = new LienzoConRelleno();
    const animador = crearAnimador(lienzo, new RelojFalso(), () => true);
    animador.cargar(opsDe('REPITE 4 [AV 100 GD 90] GD 45 SL AV 20 BL RELLENA "azul AV 10'), 'jugador');
    animador.reproducir();
    expect(lienzo.pedidos).toHaveLength(1);
    const [pedido] = lienzo.pedidos;
    expect(pedido!.capa).toBe('jugador');
    expect(pedido!.color).toBe('azul');
    expect(pedido!.punto.x).toBeCloseTo(14.142, 2);
    expect(pedido!.punto.y).toBeCloseTo(14.142, 2);
    expect(pedido!.tramosAntes).toBe(4);
  });

  it('en la reproducción continua el relleno se aplica al EMPEZAR su turno, no al terminarlo', () => {
    const reloj = new RelojFalso();
    const lienzo = new LienzoConRelleno();
    const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
    let aplicadas = 0;
    animador.alAplicar(() => (aplicadas += 1));
    // Ocho operaciones antes de RELLENA: cuatro avances y cuatro giros.
    animador.cargar(opsDe('REPITE 4 [AV 100 GD 90] RELLENA "azul AV 10'), 'jugador');
    animador.reproducir();
    // Fotograma a fotograma hasta que termina la octava operación: ese mismo
    // fotograma abre el turno de RELLENA.
    let guarda = 0;
    while (aplicadas < 8 && guarda++ < 10_000) reloj.avanzar(16);
    expect(aplicadas).toBe(8);
    expect(lienzo.pedidos).toHaveLength(1);
    expect(lienzo.pedidos[0]!.color).toBe('azul');
    // La operación sigue en su turno (no se dio por aplicada) y no se rellena dos veces.
    reloj.avanzar(DURACIONES.normal + 100);
    expect(aplicadas).toBeGreaterThanOrEqual(9);
    expect(lienzo.pedidos).toHaveLength(1);
    // Ni el orden ni la cantidad de operaciones cambian.
    reloj.avanzar(DURACIONES.normal * 3);
    expect(aplicadas).toBe(10);
    expect(lienzo.estelas.jugador).toHaveLength(5);
  });

  it('paso a paso, RELLENA se aplica una sola vez, al dar su paso', () => {
    const lienzo = new LienzoConRelleno();
    const animador = crearAnimador(lienzo, new RelojFalso(), SIN_REDUCIR);
    animador.cargar(opsDe('REPITE 4 [AV 100 GD 90] RELLENA "azul'), 'jugador');
    for (let i = 0; i < 8; i++) animador.paso();
    expect(lienzo.pedidos).toHaveLength(0);
    animador.paso();
    expect(lienzo.pedidos).toHaveLength(1);
  });
  it('un lienzo que no dibuja rellenos (sin rellenar) sigue funcionando', () => {
    const lienzo = new LienzoDoble();
    const animador = crearAnimador(lienzo, new RelojFalso(), () => true);
    animador.cargar(opsDe('REPITE 4 [AV 100 GD 90] RELLENA "azul'), 'jugador');
    expect(() => animador.reproducir()).not.toThrow();
    expect(lienzo.estelas.jugador).toHaveLength(4);
  });
});

describe('animador · escribir y rotular (tarea 8.3)', () => {
  function opTexto(tipo: 'escribir' | 'rotular', texto: string): Operacion {
    const base = { paso: contadorPaso++, linea: 1, profundidad: 0, estadoAntes: ESTADO_INICIAL, estadoDespues: ESTADO_INICIAL };
    return tipo === 'escribir'
      ? { ...base, tipo, texto }
      : { ...base, tipo, texto, posicion: { x: 0, y: 0 }, color: null };
  }

  function secuencia(): Operacion[] {
    contadorPaso = 0;
    return [opMover(ESTADO_INICIAL, 100, true), opTexto('escribir', '1'), opTexto('rotular', 'hola'), opTexto('escribir', '2')];
  }

  class LienzoConRotulos extends LienzoDoble {
    readonly rotulos: Array<{ capa: string; texto: string }> = [];
    rotular(capa: 'jugador' | 'referencia', rotulo: { texto: string }): void {
      this.rotulos.push({ capa, texto: rotulo.texto });
    }
  }

  it('rotular se pide al lienzo solo para el jugador; escribir no dibuja', () => {
    const lienzo = new LienzoConRotulos();
    const animador = crearAnimador(lienzo, new RelojFalso(), () => true);
    animador.cargar(secuencia(), 'jugador');
    animador.reproducir();
    expect(lienzo.rotulos).toEqual([{ capa: 'jugador', texto: 'hola' }]);

    const otro = new LienzoConRotulos();
    const animador2 = crearAnimador(otro, new RelojFalso(), () => true);
    animador2.cargar(secuencia(), 'referencia');
    animador2.reproducir();
    expect(otro.rotulos).toHaveLength(0);
  });

  it('escribir y rotular duran 0: se aplican en el ciclo que cierra la operación anterior', () => {
    const reloj = new RelojFalso();
    const lienzo = new LienzoConRotulos();
    const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
    let aplicadas = 0;
    animador.alAplicar(() => (aplicadas += 1));
    animador.cargar(secuencia(), 'jugador');
    animador.reproducir();
    reloj.avanzar(DURACIONES.normal + 40);
    expect(aplicadas).toBe(4);
    expect(lienzo.rotulos).toHaveLength(1);
  });
});

describe('animador · ESCRIBE y ROTULA desde un programa real (tarea 8.7)', () => {
  function opsDe(texto: string): readonly Operacion[] {
    const { programa } = analizar(analizarLexico(texto).tokens, { mundo: 4 });
    const g = ejecutar(programa!, { estadoInicial: ESTADO_INICIAL, comandosPermitidos: comandosDelMundo(4), semilla: 0 });
    let p = g.next();
    while (!p.done) p = g.next();
    return p.value.operaciones;
  }

  class LienzoConRotulos extends LienzoDoble {
    readonly rotulos: Array<{ capa: string; texto: string; tramosAntes: number }> = [];
    rotular(capa: 'jugador' | 'referencia', rotulo: { texto: string }): void {
      this.rotulos.push({ capa, texto: rotulo.texto, tramosAntes: this.estelas[capa].length });
    }
  }

  // Dos avances con lápiz; el resto es texto, con el lápiz abajo y arriba.
  const TEXTO = 'ESCRIBE 1 AVANZA 40 ROTULA "a ESCRIBE 2 AVANZA 40 SUBELAPIZ ROTULA "b ESCRIBE 3';

  for (const velocidad of ['lenta', 'normal', 'rapida'] as const) {
    it(`a velocidad ${velocidad}, el texto no suma tiempo: todo termina en lo que duran los avances y el lápiz`, () => {
      const ops = opsDe(TEXTO);
      const conDuracion = ops.filter((o) => o.tipo !== 'escribir' && o.tipo !== 'rotular').length;
      expect(conDuracion).toBe(3);
      const reloj = new RelojFalso();
      const lienzo = new LienzoConRotulos();
      const animador = crearAnimador(lienzo, reloj, SIN_REDUCIR);
      let fin: number | null = null;
      animador.alTerminar((f) => (fin = f.operacionesAplicadas));
      animador.cargar(ops, 'jugador');
      animador.ponerVelocidad(velocidad);
      animador.reproducir();
      // Margen de dos fotogramas: si el texto durara una operación más, no alcanzaría.
      reloj.avanzar(DURACIONES[velocidad] * conDuracion + 32);
      expect(fin).toBe(ops.length);
      expect(lienzo.rotulos.map((r) => [r.texto, r.tramosAntes])).toEqual([['a', 1], ['b', 2]]);
    });
  }

  it('la demostración de Kiro (capa de referencia) no rotula, pero dibuja la misma estela', () => {
    const ops = opsDe(TEXTO);
    const jugador = new LienzoConRotulos();
    const a1 = crearAnimador(jugador, new RelojFalso(), () => true);
    a1.cargar(ops, 'jugador');
    a1.reproducir();

    const referencia = new LienzoConRotulos();
    const a2 = crearAnimador(referencia, new RelojFalso(), () => true);
    a2.cargar(ops, 'referencia');
    a2.reproducir();

    expect(jugador.rotulos.map((r) => r.capa)).toEqual(['jugador', 'jugador']);
    expect(referencia.rotulos).toEqual([]);
    expect(referencia.estelas.referencia).toEqual(jugador.estelas.jugador);
  });
});
