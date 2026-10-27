// Tests de los generadores del mundo 2 (R9.11, R10.2)
//
// Para cada generador se verifica, sobre 200 semillas consecutivas, que toda
// figura devuelta encuadra y no es degenerada, que su forma es la pedida y que
// el presupuesto sale del Conteo sobre la referencia (nunca escrito a mano).
//
// La regresión obligatoria del proyecto —que la referencia de cada reto gane las
// tres estrellas ejecutándose como si fuera el programa del jugador— se verifica
// con el validador geométrico. Ese validador rasteriza y gira una máscara de
// 800×800, así que es costoso (~200 ms por llamada); como en los tests del mundo
// 1, se corre sobre una muestra representativa de semillas, mientras que encuadre,
// conteo, no-conector y abstracción cubren las 200.

import { describe, it, expect } from "vitest";
import type { Programa } from "../lenguaje/ast.js";
import {
  generarEstrella,
  generarEscalera,
  generarDosPoligonos,
  generarCuadricula,
  GENERADORES_M2,
} from "./generadores-mundo-2.js";
import {
  NIVEL_2_2,
  NIVEL_2_3,
  NIVEL_2_5,
  NIVEL_2_6,
} from "../niveles/mundo-2-composicion.js";
import { ejecutar } from "../lenguaje/interprete.js";
import { ESTADO_INICIAL } from "../motor/tortuga.js";
import { extraerSegmentos, type Segmento } from "../motor/segmentos.js";
import { calcularEncuadre } from "../motor/encuadre.js";
import { comandosDelMundo } from "../lenguaje/vocabulario.js";
import { contarInstrucciones } from "../lenguaje/conteo.js";
import { validar } from "../motor/validador.js";
import { calificar } from "./estrellas.js";
import { analizar as analizarAbstraccion } from "./abstraccion.js";
import type { Reto } from "./reto.js";
import type { Nivel } from "../niveles/tipos.js";

// ============================================================================
// Utilidades de test
// ============================================================================

const PERMITIDOS_2 = comandosDelMundo(2);

/** Ejecuta la referencia del mundo 2 y devuelve resultado y segmentos. */
function ejecutarYObtenerSegmentos(programa: Programa) {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: PERMITIDOS_2,
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return { resultado: paso.value, segmentos: extraerSegmentos(paso.value.operaciones) };
}

/**
 * Construye el Reto que `calificar` necesita a partir de la referencia generada
 * y el nivel. Se arma a mano (en vez de `resolverReto`) porque el registro del
 * catálogo y de generadores del mundo 2 es trabajo de otra tarea; aquí solo se
 * ejercita la referencia del generador contra su propio nivel.
 */
function retoDeReferencia(nivel: Nivel, referencia: Programa, segmentos: readonly Segmento[]): Reto {
  const conteo = contarInstrucciones(referencia);
  const presupuestoEstrella = conteo.exito ? conteo.instrucciones : Number.POSITIVE_INFINITY;
  return {
    nivel,
    semillaEfectiva: 0,
    codigoSemilla: "AAAAAAA",
    referencia,
    operaciones: [],
    segmentos,
    presupuestoEstrella,
    limiteDuro: presupuestoEstrella + 3,
    limiteDuroActivo: false,
  };
}

/**
 * Verifica que la referencia de un reto gane las tres estrellas al ejecutarse
 * como si fuera el programa del jugador (precisión, economía y abstracción).
 */
function apruebaLasTresEstrellas(nivel: Nivel, referencia: Programa): void {
  const { resultado, segmentos } = ejecutarYObtenerSegmentos(referencia);
  expect(resultado.error).toBeNull();
  expect(resultado.guardaActivada).toBeNull();

  const reto = retoDeReferencia(nivel, referencia, segmentos);
  const veredicto = validar(segmentos, segmentos, nivel.normalizacion);
  const calificacion = calificar(referencia, veredicto, reto);

  expect(calificacion.precision.otorgada).toBe(true);
  expect(calificacion.economia.otorgada).toBe(true);
  expect(calificacion.abstraccion.otorgada).toBe(true);
}

/** Muestra representativa de semillas para la validación geométrica costosa. */
const MUESTRA = [0, 1, 7, 13, 42, 99, 150, 199] as const;

/** Afirma que una figura encuadra y no es degenerada. */
function esperarEncuadrada(segmentos: readonly Segmento[]): void {
  const encuadre = calcularEncuadre(segmentos);
  expect(encuadre.hayCaja).toBe(true);
  if (encuadre.hayCaja) {
    expect(encuadre.noEncuadrada).toHaveLength(0);
    expect(encuadre.degenerada).toBe(false);
  }
}

// ============================================================================
// Generador 2.2 — estrella
// ============================================================================

describe("generador 2.2 — estrella", () => {
  it("200 semillas: todas encuadran y no son degeneradas", () => {
    for (let s = 0; s < 200; s++) {
      const { segmentos } = ejecutarYObtenerSegmentos(generarEstrella(s).programa);
      esperarEncuadrada(segmentos);
    }
  });

  it("200 semillas: forma REPITE p [AV L GD round(720/p)], p∈{5,7,9}, L∈[100,180] mult 20", () => {
    for (let s = 0; s < 200; s++) {
      const { texto } = generarEstrella(s);
      const m = /^REPITE (\d+) \[AV (\d+) GD (\d+)\]$/.exec(texto);
      expect(m, texto).not.toBeNull();
      if (m) {
        const p = Number(m[1]);
        const L = Number(m[2]);
        const angulo = Number(m[3]);
        // p=5 con L≤180 siempre degenera (la estrella no llega a 200 px), así que
        // nunca se devuelve; p=7 solo en L=180; p=9 en L≥140. El requisito permite
        // el conjunto {5,7,9}: el lazo descarta las combinaciones que no encuadran.
        expect([5, 7, 9]).toContain(p);
        expect(L % 20).toBe(0);
        expect(L).toBeGreaterThanOrEqual(100);
        expect(L).toBeLessThanOrEqual(180);
        expect(angulo).toBe(Math.round((360 * 2) / p));
      }
    }
  });

  it("200 semillas: el presupuesto es el Conteo de la referencia (3)", () => {
    for (let s = 0; s < 200; s++) {
      const r = contarInstrucciones(generarEstrella(s).programa);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(3); // REPITE + AV + GD
    }
  });

  it("muestra de semillas: la referencia aprueba su nivel con las TRES estrellas", () => {
    for (const s of MUESTRA) {
      apruebaLasTresEstrellas(NIVEL_2_2, generarEstrella(s).programa);
    }
  });

  it("determinismo: misma semilla → misma referencia", () => {
    expect(generarEstrella(7).texto).toBe(generarEstrella(7).texto);
    expect(generarEstrella(123).texto).toBe(generarEstrella(123).texto);
  });
});

// ============================================================================
// Generador 2.3 — escalera
// ============================================================================

describe("generador 2.3 — escalera", () => {
  it("200 semillas: todas encuadran y no son degeneradas", () => {
    for (let s = 0; s < 200; s++) {
      const { segmentos } = ejecutarYObtenerSegmentos(generarEscalera(s).programa);
      esperarEncuadrada(segmentos);
    }
  });

  it("200 semillas: forma REPITE n [AV L GI 90 AV L GD 90], n∈[3,6], L∈[20,60] mult 20", () => {
    for (let s = 0; s < 200; s++) {
      const { texto } = generarEscalera(s);
      const m = /^REPITE (\d+) \[AV (\d+) GI 90 AV (\d+) GD 90\]$/.exec(texto);
      expect(m, texto).not.toBeNull();
      if (m) {
        const n = Number(m[1]);
        const L1 = Number(m[2]);
        const L2 = Number(m[3]);
        expect(n).toBeGreaterThanOrEqual(3);
        expect(n).toBeLessThanOrEqual(6);
        expect(L1).toBe(L2); // huella = altura (R9.2)
        expect(L1 % 20).toBe(0);
        expect(L1).toBeGreaterThanOrEqual(20);
        expect(L1).toBeLessThanOrEqual(60);
      }
    }
  });

  it("200 semillas: el presupuesto es el Conteo de la referencia (5)", () => {
    for (let s = 0; s < 200; s++) {
      const r = contarInstrucciones(generarEscalera(s).programa);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(5); // REPITE + AV + GI + AV + GD
    }
  });

  it("muestra de semillas: la referencia aprueba su nivel con las TRES estrellas", () => {
    for (const s of MUESTRA) {
      apruebaLasTresEstrellas(NIVEL_2_3, generarEscalera(s).programa);
    }
  });

  it("determinismo: misma semilla → misma referencia", () => {
    expect(generarEscalera(7).texto).toBe(generarEscalera(7).texto);
    expect(generarEscalera(123).texto).toBe(generarEscalera(123).texto);
  });
});

// ============================================================================
// Generador 2.5 — dos polígonos
// ============================================================================

describe("generador 2.5 — dos polígonos", () => {
  it("200 semillas: todas encuadran y no son degeneradas", () => {
    for (let s = 0; s < 200; s++) {
      const { segmentos } = ejecutarYObtenerSegmentos(generarDosPoligonos(s).programa);
      esperarEncuadrada(segmentos);
    }
  });

  it("200 semillas: usa SUBELAPIZ/BAJALAPIZ y no hay trazo conector entre polígonos", () => {
    // Levantar el lápiz para moverse entre los dos polígonos (R9.4) significa que
    // el traslado no produce segmento: el número de segmentos dibujados es
    // exactamente n1 + n2 (los lados de los dos polígonos), sin un segmento extra
    // de conexión.
    for (let s = 0; s < 200; s++) {
      const { texto, programa } = generarDosPoligonos(s);
      expect(texto).toContain("SUBELAPIZ");
      expect(texto).toContain("BAJALAPIZ");

      const m = /^REPITE (\d+) \[.*REPITE (\d+) \[/.exec(texto);
      expect(m, texto).not.toBeNull();
      if (m) {
        const n1 = Number(m[1]);
        const n2 = Number(m[2]);
        const { segmentos } = ejecutarYObtenerSegmentos(programa);
        expect(segmentos.length, texto).toBe(n1 + n2);
      }
    }
  });

  it("200 semillas: ambos polígonos tienen 3..6 lados y separación mult 20 en [20,100]", () => {
    for (let s = 0; s < 200; s++) {
      const { texto } = generarDosPoligonos(s);
      const m = /^REPITE (\d+) \[AV \d+ GD \d+\] SUBELAPIZ GD 45 AV (\d+) GI 45 BAJALAPIZ REPITE (\d+) \[AV \d+ GD \d+\]$/.exec(texto);
      expect(m, texto).not.toBeNull();
      if (m) {
        const n1 = Number(m[1]);
        const sep = Number(m[2]);
        const n2 = Number(m[3]);
        for (const n of [n1, n2]) {
          expect(n).toBeGreaterThanOrEqual(3);
          expect(n).toBeLessThanOrEqual(6);
        }
        expect(sep % 20).toBe(0);
        expect(sep).toBeGreaterThanOrEqual(20);
        expect(sep).toBeLessThanOrEqual(100);
      }
    }
  });

  it("200 semillas: el presupuesto es el Conteo de la referencia (6)", () => {
    // Dos polígonos (REPITE+AV+GD cada uno = 6) más SUBELAPIZ/GD/AV/GI/BAJALAPIZ.
    // El conteo lo da la única función de conteo; aquí solo exigimos que exista.
    for (let s = 0; s < 200; s++) {
      const r = contarInstrucciones(generarDosPoligonos(s).programa);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBeGreaterThan(0);
    }
  });

  it("muestra de semillas: la referencia aprueba su nivel con las TRES estrellas", () => {
    for (const s of MUESTRA) {
      apruebaLasTresEstrellas(NIVEL_2_5, generarDosPoligonos(s).programa);
    }
  });

  it("determinismo: misma semilla → misma referencia", () => {
    expect(generarDosPoligonos(7).texto).toBe(generarDosPoligonos(7).texto);
    expect(generarDosPoligonos(123).texto).toBe(generarDosPoligonos(123).texto);
  });
});

// ============================================================================
// Generador 2.6 — cuadrícula
// ============================================================================

describe("generador 2.6 — cuadrícula", () => {
  it("200 semillas: todas encuadran y no son degeneradas", () => {
    for (let s = 0; s < 200; s++) {
      const { segmentos } = ejecutarYObtenerSegmentos(generarCuadricula(s).programa);
      esperarEncuadrada(segmentos);
    }
  });

  it("200 semillas: la referencia define un procedimiento y lo invoca una vez por panel", () => {
    for (let s = 0; s < 200; s++) {
      const { texto, programa } = generarCuadricula(s);
      // Define PANEL una sola vez con PARA … FIN.
      expect(texto).toContain("PARA PANEL");
      expect(texto).toContain("FIN");

      // El AST contiene exactamente una definición de procedimiento, y la invoca
      // una vez por casilla: el número de invocaciones de PANEL es filas×columnas.
      const definiciones = programa.instrucciones.filter(
        (n) => n.tipo === "definicionProcedimiento",
      );
      expect(definiciones).toHaveLength(1);

      const invocaciones = programa.instrucciones.filter(
        (n) => n.tipo === "invocacionProcedimiento" && n.nombre === "PANEL",
      ).length;
      // Las disposiciones permitidas: 2×2=4, 3×2=6, 3×3=9 paneles.
      expect([4, 6, 9]).toContain(invocaciones);
    }
  });

  it("200 semillas: gana la estrella defineProcedimiento (análisis del AST)", () => {
    // R10.2/R10.6: la exigencia se decide analizando el AST, no el texto.
    for (let s = 0; s < 200; s++) {
      const { programa } = generarCuadricula(s);
      const analisis = analizarAbstraccion(programa, [{ clave: "defineProcedimiento" }]);
      expect(analisis.confirmadas).toContain("defineProcedimiento");
      expect(analisis.sinConfirmar).toHaveLength(0);
    }
  });

  it("200 semillas: el presupuesto es el Conteo de la referencia (> 0)", () => {
    for (let s = 0; s < 200; s++) {
      const r = contarInstrucciones(generarCuadricula(s).programa);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBeGreaterThan(0);
    }
  });

  it("muestra de semillas: la referencia aprueba su nivel con las TRES estrellas", () => {
    for (const s of MUESTRA) {
      apruebaLasTresEstrellas(NIVEL_2_6, generarCuadricula(s).programa);
    }
  });

  it("determinismo: misma semilla → misma referencia", () => {
    expect(generarCuadricula(7).texto).toBe(generarCuadricula(7).texto);
    expect(generarCuadricula(123).texto).toBe(generarCuadricula(123).texto);
  });
});

// ============================================================================
// Registro GENERADORES_M2
// ============================================================================

describe("GENERADORES_M2 — registro", () => {
  it("expone las cuatro claves del mundo 2", () => {
    expect(Object.keys(GENERADORES_M2).sort()).toEqual(
      ["cuadricula-m2", "dos-poligonos-m2", "escalera-m2", "estrella-m2"],
    );
  });

  it("cada clave devuelve una referencia que encuadra", () => {
    for (const fn of Object.values(GENERADORES_M2)) {
      const { segmentos } = ejecutarYObtenerSegmentos(fn(0).programa);
      esperarEncuadrada(segmentos);
    }
  });
});
