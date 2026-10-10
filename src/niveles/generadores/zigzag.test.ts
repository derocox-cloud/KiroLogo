// Pruebas del generador de zigzag (nivel 0.5).
//
// La prueba central cierra el lazo del requisito 4.5 / 8 del steering: sobre al
// menos 200 semillas, cada referencia se ejecuta con el INTÉRPRETE real y se
// valida con el VALIDADOR real contra sí misma (traslación y rotación libres),
// confirmando las tres estrellas, el encuadre y la no degeneración. Además
// verifica la alternancia de sentido propia del zigzag.
import { describe, it, expect } from 'vitest';
import type { Programa, Instruccion } from '../../lenguaje/ast.js';
import { ejecutar } from '../../lenguaje/interprete.js';
import { contarInstrucciones } from '../../lenguaje/conteo.js';
import { comandosDelMundo } from '../../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../../motor/tortuga.js';
import { extraerSegmentos } from '../../motor/segmentos.js';
import { calcularEncuadre } from '../../motor/encuadre.js';
import { validar, type NormalizacionNivel } from '../../motor/validador.js';
import { calificar } from '../../juego/estrellas.js';
import type { Reto } from '../../juego/reto.js';
import { generarZigzag } from './zigzag.js';
import type { EntradaGenerador } from '../tipos.js';

// ============================================================================
// Ayudas
// ============================================================================

const PARAMETROS_0_5 = { tramosMin: 4, tramosMax: 8, largoMin: 60, largoMax: 120 } as const;
const NORMALIZACION_LIBRE: NormalizacionNivel = { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' };

/** Entrada del generador para una semilla dada, con 200 intentos de margen. */
function entrada(semilla: number): EntradaGenerador {
  return { semilla, parametros: PARAMETROS_0_5, intentosMaximos: 200 };
}

/** Ejecuta un programa del mundo 0 y devuelve su resultado (sin guarda ni error). */
function ejecutarMundo0(programa: Programa) {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(0),
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return paso.value;
}

/**
 * Construye el mínimo de un `Reto` que `calificar` necesita: solo lee
 * `presupuestoEstrella` y `nivel.abstraccion`.
 */
function retoDe(referencia: Programa): Reto {
  const conteo = contarInstrucciones(referencia);
  const presupuesto = conteo.exito ? conteo.instrucciones : Number.POSITIVE_INFINITY;
  return {
    nivel: { abstraccion: [] },
    presupuestoEstrella: presupuesto,
  } as unknown as Reto;
}

/** Lista de nodos que son AVANZA, de primer nivel. */
function avances(programa: Programa): Instruccion[] {
  return programa.instrucciones.filter(
    (n: Instruccion) => n.tipo === 'invocacionComando' && n.nombre === 'AVANZA',
  );
}

/** Lista de nodos que son giro (GIRADERECHA/GIRAIZQUIERDA), de primer nivel. */
function giros(programa: Programa): Instruccion[] {
  return programa.instrucciones.filter(
    (n: Instruccion) =>
      n.tipo === 'invocacionComando' && (n.nombre === 'GIRADERECHA' || n.nombre === 'GIRAIZQUIERDA'),
  );
}

// ============================================================================
// Forma del programa generado
// ============================================================================

describe('zigzag · forma del programa', () => {
  it('es un zigzag: AVANZA por tramo y un giro de 90° entre tramos, sin giro final', () => {
    const r = generarZigzag(entrada(1));
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    const ref = r.referencia;

    const nAvances = avances(ref).length;
    const nGiros = giros(ref).length;
    // 4 a 8 tramos; un giro menos que tramos.
    expect(nAvances).toBeGreaterThanOrEqual(4);
    expect(nAvances).toBeLessThanOrEqual(8);
    expect(nGiros).toBe(nAvances - 1);

    // El último nodo es un AVANZA (no hay giro final).
    const ultimo = ref.instrucciones[ref.instrucciones.length - 1]!;
    expect(ultimo.tipo).toBe('invocacionComando');
    if (ultimo.tipo === 'invocacionComando') expect(ultimo.nombre).toBe('AVANZA');

    // Alterna AVANZA y giro, empezando y terminando en AVANZA.
    ref.instrucciones.forEach((nodo, i) => {
      expect(nodo.tipo).toBe('invocacionComando');
      if (nodo.tipo !== 'invocacionComando') return;
      if (i % 2 === 0) expect(nodo.nombre).toBe('AVANZA');
      else expect(['GIRADERECHA', 'GIRAIZQUIERDA']).toContain(nodo.nombre);
    });
  });

  it('usa solo nodos del mundo 0, longitudes múltiplo de 20 y giros de 90°', () => {
    const r = generarZigzag(entrada(99));
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    for (const nodo of r.referencia.instrucciones) {
      expect(nodo.tipo).toBe('invocacionComando');
      if (nodo.tipo !== 'invocacionComando') continue;
      expect(['AVANZA', 'GIRADERECHA', 'GIRAIZQUIERDA']).toContain(nodo.nombre);
      const arg = nodo.argumentos[0]!;
      expect(arg.tipo).toBe('numeroLiteral');
      if (arg.tipo !== 'numeroLiteral') continue;
      if (nodo.nombre === 'AVANZA') {
        expect(arg.valor % 20).toBe(0);
        expect(arg.valor).toBeGreaterThanOrEqual(60);
        expect(arg.valor).toBeLessThanOrEqual(120);
      } else {
        expect(arg.valor).toBe(90);
      }
    }
  });

  it('los giros alternan de sentido de un vértice al siguiente', () => {
    // Sobre varias semillas, la secuencia de giros nunca repite el mismo sentido
    // dos veces seguidas (es un zigzag, no una curva).
    for (const semilla of [0, 3, 11, 42, 77, 128, 199]) {
      const r = generarZigzag(entrada(semilla));
      expect(r.exito).toBe(true);
      if (!r.exito) continue;
      const nombresGiro = giros(r.referencia).map((n) =>
        n.tipo === 'invocacionComando' ? n.nombre : '',
      );
      for (let i = 1; i < nombresGiro.length; i++) {
        expect(nombresGiro[i]).not.toBe(nombresGiro[i - 1]);
      }
    }
  });

  it('es la forma mínima: conteo = tramos + (tramos − 1)', () => {
    const r = generarZigzag(entrada(7));
    expect(r.exito).toBe(true);
    if (!r.exito) return;
    const tramos = avances(r.referencia).length;
    const conteo = contarInstrucciones(r.referencia);
    expect(conteo.exito).toBe(true);
    if (conteo.exito) expect(conteo.instrucciones).toBe(tramos + (tramos - 1));
  });
});

// ============================================================================
// Determinismo
// ============================================================================

describe('zigzag · determinismo', () => {
  it('misma semilla y parámetros producen el mismo resultado', () => {
    const a = generarZigzag(entrada(12345));
    const b = generarZigzag(entrada(12345));
    expect(a.exito && b.exito).toBe(true);
    if (a.exito && b.exito) {
      expect(a.semillaEfectiva).toBe(b.semillaEfectiva);
      expect(a.descartes).toBe(b.descartes);
      expect(JSON.stringify(a.referencia)).toBe(JSON.stringify(b.referencia));
    }
  });
});

// ============================================================================
// 200 semillas: éxito, encuadre, no degeneración y tres estrellas
// ============================================================================

describe('zigzag · 200 semillas (requisito 4.5)', () => {
  it('toda semilla da un reto encuadrado, no degenerado y con las tres estrellas', () => {
    const N = 200;
    const fallos: string[] = [];

    for (let semilla = 0; semilla < N; semilla++) {
      const r = generarZigzag(entrada(semilla));
      if (!r.exito) {
        fallos.push(`semilla ${semilla}: el generador no encontró candidato`);
        continue;
      }
      const ref = r.referencia;

      // Ejecutar la referencia con el intérprete real.
      const resultado = ejecutarMundo0(ref);
      if (resultado.error !== null || resultado.guardaActivada !== null) {
        fallos.push(`semilla ${semilla}: la referencia no se ejecuta limpiamente`);
        continue;
      }
      const segmentos = extraerSegmentos(resultado.operaciones);

      // Encuadrada y no degenerada (motor real).
      const enc = calcularEncuadre(segmentos);
      if (!enc.hayCaja || enc.noEncuadrada.length > 0 || enc.degenerada) {
        fallos.push(`semilla ${semilla}: fuera de encuadre o degenerada`);
        continue;
      }

      // Validar contra sí misma con traslación y rotación libres (validador real).
      const veredicto = validar(segmentos, segmentos, NORMALIZACION_LIBRE);

      // Tres estrellas por la lógica real de calificación.
      const calificacion = calificar(ref, veredicto, retoDe(ref));
      if (!calificacion.precision.otorgada) fallos.push(`semilla ${semilla}: sin precisión`);
      if (!calificacion.economia.otorgada) fallos.push(`semilla ${semilla}: sin economía`);
      if (!calificacion.abstraccion.otorgada) fallos.push(`semilla ${semilla}: sin abstracción`);
    }

    expect(fallos, fallos.slice(0, 10).join('\n')).toEqual([]);
  }, 120_000); // 200 validaciones con rotación libre (360 giros c/u) son pesadas.
});
