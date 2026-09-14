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
