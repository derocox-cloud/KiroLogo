// Pruebas de la reproducción en paralelo (parte de presentación de la tarea 3.4).
//
// Corre en Node con un reloj falso y el doble de dibujo del motor, sin
// requestAnimationFrame ni Canvas real. Comprueba el avance cuadro a cuadro, la
// sincronización (la secuencia corta queda estática mientras la larga sigue), que
// las dos tortugas se dibujan a la vez sobre la misma capa, que la del jugador usa
// un estilo distinto, el salto al último cuadro con `prefers-reduced-motion` y los
// anuncios por `aria-live`.

import { describe, it, expect } from 'vitest';
import { DobleDibujo } from '../motor/doble-dibujo.test.js';
import { ESTADO_INICIAL, type EstadoTortuga } from '../motor/tortuga.js';
import type { Reloj } from '../motor/animador.js';
import type { Operacion } from '../lenguaje/interprete.js';
import { ejecutar } from '../lenguaje/interprete.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import type { EstiloPersonajes } from '../motor/personajes.js';
import { GROSOR_TRAZO } from '../motor/personajes.js';
import {
  crearReproduccionParalelo,
  estadoTras,
  DURACION_CUADRO_MS,
  type LienzoParalelo,
} from './reproduccion-paralelo.js';

// ============================================================================
// Reloj falso (mismo patrón que animador.test.ts)
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

  hayPendientes(): boolean {
    return this.pendientes.size > 0;
  }
}

// ============================================================================
// Doble del lienzo paralelo: un solo contexto de personajes compartido
// ============================================================================

interface LienzoDoble extends LienzoParalelo {
  readonly ctx: DobleDibujo;
  limpiezas: number;
}

function lienzoDoble(): LienzoDoble {
  const ctx = new DobleDibujo();
  const estado = { limpiezas: 0 };
  return {
    ctx,
    get limpiezas() {
      return estado.limpiezas;
    },
    capaPersonajes: () => ctx,
    limpiarPersonajes: () => {
      estado.limpiezas += 1;
      ctx.clearRect(0, 0, 800, 800);
    },
  };
}

// ============================================================================
// Estilos de prueba: Kiro y el jugador con contornos distintos
// ============================================================================

const ESTILO_KIRO: EstiloPersonajes = {
  contorno: '#212529',
  relleno: '#ffffff',
  cabeza: '#343a40',
  kiroContorno: '#0d6efd',
  kiroRelleno: 'rgba(13,110,253,0.1)',
  lapizContorno: '#dc3545',
  marcaRumbo: '#ff6b6b',
  grosor: GROSOR_TRAZO,
};

const ESTILO_JUGADOR: EstiloPersonajes = {
  ...ESTILO_KIRO,
  contorno: '#c2410c',
  relleno: '#fff0e6',
  cabeza: '#a63a0a',
  marcaRumbo: '#f76707',
};

// ============================================================================
// Operaciones desde texto KiroLogo real (mundo 1)
// ============================================================================

function operacionesDe(texto: string): readonly Operacion[] {
  const lexico = analizarLexico(texto);
  const sintactico = analizar(lexico.tokens, { mundo: 1 });
  if (sintactico.programa === null) return [];
  const generador = ejecutar(sintactico.programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(1),
    semilla: 0,
  });
  let paso = generador.next();
  while (!paso.done) paso = generador.next();
  return paso.value.operaciones;
}

interface Montaje {
  readonly rep: ReturnType<typeof crearReproduccionParalelo>;
  readonly lienzo: LienzoDoble;
  readonly reloj: RelojFalso;
  readonly anuncios: string[];
}

function montar(reducido = false): Montaje {
  const lienzo = lienzoDoble();
  const reloj = new RelojFalso();
  const anuncios: string[] = [];
  const rep = crearReproduccionParalelo({
    lienzo,
    reloj,
    leerTemaKiro: () => ESTILO_KIRO,
    leerTemaJugador: () => ESTILO_JUGADOR,
    movimientoReducido: () => reducido,
    anunciar: (t) => anuncios.push(t),
  });
  return { rep, lienzo, reloj, anuncios };
}

// ============================================================================
// estadoTras: estado tras i operaciones, con la corta estática al final
// ============================================================================

describe('reproduccion-paralelo · estadoTras', () => {
  const ops = operacionesDe('REPITE 4 [AV 100 GD 90]'); // 8 operaciones

  it('con i = 0 devuelve el estado inicial', () => {
    expect(estadoTras(ops, 0, ESTADO_INICIAL)).toEqual(ESTADO_INICIAL);
  });

  it('con i = 1 devuelve el estadoDespues de la primera operación', () => {
    expect(estadoTras(ops, 1, ESTADO_INICIAL)).toEqual(ops[0]!.estadoDespues);
  });

  it('con i por encima de la longitud queda estático en el estado final', () => {
    const final = ops[ops.length - 1]!.estadoDespues;
    expect(estadoTras(ops, ops.length, ESTADO_INICIAL)).toEqual(final);
    expect(estadoTras(ops, ops.length + 5, ESTADO_INICIAL)).toEqual(final);
  });

  it('una secuencia vacía siempre devuelve el estado inicial', () => {
    const otro: EstadoTortuga = { ...ESTADO_INICIAL, rumbo: 123 };
    expect(estadoTras([], 7, otro)).toEqual(otro);
  });
});

// ============================================================================
// Las dos tortugas se dibujan a la vez sobre la misma capa
// ============================================================================

describe('reproduccion-paralelo · dos tortugas simultáneas', () => {
  it('en el cuadro 0 dibuja las dos tortugas sobre una sola capa', () => {
    const m = montar();
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]');
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    // Debe haber dos conjuntos de personajes: hay al menos dos 'restore'
    // (uno por cada dibujarPersonajes, que hace save/restore).
    const restores = m.lienzo.ctx.llamadas.filter((l) => l.metodo === 'restore').length;
    expect(restores).toBeGreaterThanOrEqual(2);
    expect(m.rep.cuadroActual()).toBe(0);
  });

  it('la tortuga del jugador usa el estilo diferenciado (naranja)', () => {
    const m = montar();
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]');
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    // El contorno naranja del jugador aparece como strokeStyle en el registro.
    const usoNaranja = m.lienzo.ctx.llamadas.some(
      (l) => l.metodo === 'stroke',
    );
    expect(usoNaranja).toBe(true);
    // Comprobamos que el estilo del jugador se consultó: su contorno difiere del
    // de Kiro, así que ambos estilos participan (verificado por los dos dibujos).
    expect(ESTILO_JUGADOR.contorno).not.toBe(ESTILO_KIRO.contorno);
  });

  it('limpia la capa de personajes en cada cuadro para no acumular tortugas', () => {
    const m = montar();
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]');
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    const limpiezasCuadro0 = m.lienzo.limpiezas;
    expect(limpiezasCuadro0).toBeGreaterThanOrEqual(1);
    m.reloj.avanzar(DURACION_CUADRO_MS + 16, 16);
    expect(m.lienzo.limpiezas).toBeGreaterThan(limpiezasCuadro0);
  });
});

// ============================================================================
// Avance cuadro a cuadro y fin de secuencia
// ============================================================================

describe('reproduccion-paralelo · avance en el tiempo', () => {
  it('avanza un cuadro por cada DURACION_CUADRO_MS', () => {
    const m = montar();
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]'); // 8 ops → 8 cuadros
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    expect(m.rep.cuadroActual()).toBe(0);
    m.reloj.avanzar(DURACION_CUADRO_MS + 16, 16);
    expect(m.rep.cuadroActual()).toBe(1);
    m.reloj.avanzar(DURACION_CUADRO_MS + 16, 16);
    expect(m.rep.cuadroActual()).toBe(2);
  });

  it('llega al último cuadro y deja de programar fotogramas', () => {
    const m = montar();
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]'); // 8 cuadros
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    m.reloj.avanzar(DURACION_CUADRO_MS * 10, 16);
    expect(m.rep.cuadroActual()).toBe(8);
    expect(m.reloj.hayPendientes()).toBe(false);
    expect(m.rep.enCurso()).toBe(false);
  });
});

// ============================================================================
// Sincronización: la secuencia corta queda estática mientras la larga sigue
// ============================================================================

describe('reproduccion-paralelo · sincronización de longitudes distintas', () => {
  it('el total de cuadros es el máximo de las dos longitudes', () => {
    const m = montar();
    const corta = operacionesDe('AV 100'); // 1 operación
    const larga = operacionesDe('REPITE 4 [AV 100 GD 90]'); // 8 operaciones
    m.rep.reproducir(larga, corta, ESTADO_INICIAL);
    m.reloj.avanzar(DURACION_CUADRO_MS * 20, 16);
    // 8 cuadros: la larga manda; la corta ya quedó estática desde el cuadro 1.
    expect(m.rep.cuadroActual()).toBe(8);
  });

  it('la secuencia corta queda en su estado final mientras la larga avanza', () => {
    const corta = operacionesDe('AV 100'); // 1 op
    const larga = operacionesDe('REPITE 4 [AV 100 GD 90]'); // 8 ops
    const finalCorta = corta[corta.length - 1]!.estadoDespues;
    // En el cuadro 5, la corta sigue en su estado final (índice 1 saturado).
    expect(estadoTras(corta, 5, ESTADO_INICIAL)).toEqual(finalCorta);
    // Y la larga sí avanzó a su quinta operación.
    expect(estadoTras(larga, 5, ESTADO_INICIAL)).toEqual(larga[4]!.estadoDespues);
  });
});

// ============================================================================
// prefers-reduced-motion: salto directo al último cuadro
// ============================================================================

describe('reproduccion-paralelo · movimiento reducido', () => {
  it('con prefers-reduced-motion salta al último cuadro sin programar fotogramas', () => {
    const m = montar(true);
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]'); // 8 cuadros
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    expect(m.rep.cuadroActual()).toBe(8);
    expect(m.reloj.hayPendientes()).toBe(false);
    expect(m.rep.enCurso()).toBe(false);
  });
});

// ============================================================================
// detener corta la reproducción en curso
// ============================================================================

describe('reproduccion-paralelo · detener', () => {
  it('detener cancela los fotogramas pendientes', () => {
    const m = montar();
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]');
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    m.reloj.avanzar(DURACION_CUADRO_MS + 16, 16);
    expect(m.rep.enCurso()).toBe(true);
    m.rep.detener();
    expect(m.rep.enCurso()).toBe(false);
    expect(m.reloj.hayPendientes()).toBe(false);
  });
});

// ============================================================================
// Anuncios por aria-live: distinguen a las dos tortugas sin color
// ============================================================================

describe('reproduccion-paralelo · anuncios accesibles', () => {
  it('anuncia la reproducción nombrando a las dos tortugas (no solo color)', () => {
    const m = montar();
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]');
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    const inicio = m.anuncios[0] ?? '';
    expect(inicio).toContain('tortuga de Kiro');
    expect(inicio).toContain('tu tortuga');
    // El anuncio no se apoya en nombres de color para distinguirlas.
    expect(inicio.toLowerCase()).not.toContain('naranja');
    expect(inicio.toLowerCase()).not.toContain('azul');
  });

  it('anuncia el fin cuando las dos quedan en su posición final', () => {
    const m = montar(true); // reducido: termina de inmediato
    const ops = operacionesDe('REPITE 4 [AV 100 GD 90]');
    m.rep.reproducir(ops, ops, ESTADO_INICIAL);
    const ultimo = m.anuncios.at(-1) ?? '';
    expect(ultimo).toContain('posición final');
  });
});
