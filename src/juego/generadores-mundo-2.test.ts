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
import { TIMEOUT_TRES_ESTRELLAS } from "../pruebas/tiempos.js";
import { extraerSegmentos, type Segmento } from "../motor/segmentos.js";
import { calcularEncuadre } from "../motor/encuadre.js";
import { comandosDelMundo } from "../lenguaje/vocabulario.js";
import { analizarLexico } from "../lenguaje/lexer.js";
import { analizar as analizarSintaxis } from "../lenguaje/parser.js";
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

/** Parsea texto KiroLogo del mundo 2; lanza si el texto no es válido. */
function programaDeTexto(texto: string): Programa {
  const { programa, errores } = analizarSintaxis(analizarLexico(texto).tokens, { mundo: 2 });
  if (programa === null || errores.length > 0) throw new Error(`texto inválido: ${texto}`);
  return programa;
}

// ---- Cuadrícula 2.6: parámetros y programas alternativos del jugador ----------

interface ParametrosCuadricula {
  readonly lado: number;
  readonly filas: number;
  readonly columnas: number;
  readonly paso: number;
}

/** Extrae los parámetros de la referencia `PARA PANEL … FIN REPITE f [REPITE c [PANEL …] …]`. */
function parametrosCuadricula(texto: string): ParametrosCuadricula {
  const m =
    /^PARA PANEL REPITE 4 \[AV (\d+) GD 90\] FIN REPITE (\d+) \[REPITE (\d+) \[PANEL SUBELAPIZ GD 90 AV (\d+) GI 90 BAJALAPIZ\] SUBELAPIZ GI 90 AV (\d+) GI 90 AV (\d+) GI 180 BAJALAPIZ\]$/.exec(
      texto,
    );
  if (m === null) throw new Error(`la referencia 2.6 no tiene la forma compacta: ${texto}`);
  const [lado, filas, columnas, paso, regreso, baja] = m.slice(1).map(Number) as [
    number, number, number, number, number, number,
  ];
  // El regreso recorre todas las columnas y baja una fila.
  if (regreso !== columnas * paso || baja !== paso) throw new Error(`regreso inconsistente: ${texto}`);
  return { lado, filas, columnas, paso };
}

/** El mismo REPITE anidado, pero con el cuadrado escrito en línea (sin PARA). */
function anidadoSinPara_(p: ParametrosCuadricula): string {
  return (
    `REPITE ${p.filas} [REPITE ${p.columnas} [REPITE 4 [AV ${p.lado} GD 90] SUBELAPIZ GD 90 AV ${p.paso} GI 90 BAJALAPIZ] ` +
    `SUBELAPIZ GI 90 AV ${p.columnas * p.paso} GI 90 AV ${p.paso} GI 180 BAJALAPIZ]`
  );
}

/** Copia literal: cada cuadrado y cada traslado escritos a mano, sin REPITE ni PARA. */
function copiaLiteralSinPara(p: ParametrosCuadricula): string {
  const partes: string[] = [];
  for (let f = 0; f < p.filas; f++) {
    for (let c = 0; c < p.columnas; c++) {
      partes.push(`REPITE 4 [AV ${p.lado} GD 90]`);
      if (c < p.columnas - 1) partes.push(`SUBELAPIZ GD 90 AV ${p.paso} GI 90 BAJALAPIZ`);
    }
    if (f < p.filas - 1) {
      partes.push("SUBELAPIZ");
      partes.push(`GI 90 AV ${p.paso * (p.columnas - 1)} GD 90`);
      partes.push(`GD 180 AV ${p.paso} GI 180`);
      partes.push("BAJALAPIZ");
    }
  }
  return partes.join(" ");
}

/** Conteo de instrucciones (lanza si falla). */
function contar(programa: Programa): number {
  const r = contarInstrucciones(programa);
  if (!r.exito) throw new Error("conteo fallido");
  return r.instrucciones;
}
/**
 * Regresión obligatoria (validacion-geometrica, niveles-y-progresion): cada
 * generador se verifica sobre 200 semillas, no una muestra. La validación
 * geométrica es costosa (giro sobre máscara 800×800), así que estas pruebas
 * llevan un timeout holgado; aun así tardan unos 60–75 s cada una.
 */
const MUESTRA = Array.from({ length: 200 }, (_, i) => i);


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

  /** Lee `REPITE p [AV L GD angulo]` de la referencia de la estrella. */
  function leerEstrella(texto: string): { p: number; L: number; angulo: number } {
    const m = /^REPITE (\d+) \[AV (\d+) GD (\d+)\]$/.exec(texto);
    expect(m, texto).not.toBeNull();
    return { p: Number(m![1]), L: Number(m![2]), angulo: Number(m![3]) };
  }

  it("200 semillas: forma REPITE p [AV L GD 720/p] con L múltiplo de 20 en el rango de cada estrella", () => {
    for (let s = 0; s < 200; s++) {
      const { p, L } = leerEstrella(generarEstrella(s).texto);
      expect([5, 9], `puntas ${p}`).toContain(p);
      expect(L % 20).toBe(0);
      // Lado mínimo por estrella: lo justo para que la caja envolvente llegue a 200 px
      // (la de 5 puntas mide ≈ 0,95·L de alto; la de 9, ≈ 1,2·L). Máximo común: 240.
      expect(L).toBeGreaterThanOrEqual(p === 5 ? 220 : 140);
      expect(L).toBeLessThanOrEqual(240);
    }
  });

  it("200 semillas: salen estrellas de 5 y de 9 puntas, y nunca de 7", () => {
    const vistas = new Set<number>();
    for (let s = 0; s < 200; s++) vistas.add(leerEstrella(generarEstrella(s).texto).p);
    expect([...vistas].sort()).toEqual([5, 9]);
  });

  it("200 semillas: todos los ángulos emitidos son derivables (720/p exacto: 144 y 80, sin redondeos)", () => {
    const angulos = new Set<number>();
    for (let s = 0; s < 200; s++) {
      const { p, angulo } = leerEstrella(generarEstrella(s).texto);
      // Derivable sin aritmética posterior: dos vueltas completas entre p giros.
      expect(Number.isInteger(angulo)).toBe(true);
      expect(angulo * p).toBe(720);
      angulos.add(angulo);
    }
    expect([...angulos].sort((a, b) => a - b)).toEqual([80, 144]);
  });
  it("200 semillas: el presupuesto es el Conteo de la referencia (3)", () => {
    for (let s = 0; s < 200; s++) {
      const r = contarInstrucciones(generarEstrella(s).programa);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(3); // REPITE + AV + GD
    }
  });

  it("200 semillas: la referencia aprueba su nivel con las TRES estrellas", () => {
    for (const s of MUESTRA) {
      apruebaLasTresEstrellas(NIVEL_2_2, generarEstrella(s).programa);
    }
  }, TIMEOUT_TRES_ESTRELLAS);

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

  it("200 semillas: la referencia aprueba su nivel con las TRES estrellas", () => {
    for (const s of MUESTRA) {
      apruebaLasTresEstrellas(NIVEL_2_3, generarEscalera(s).programa);
    }
  }, TIMEOUT_TRES_ESTRELLAS);

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

  it("200 semillas: forma REPITE n [AV L GD 360/n] SL GD 90 AV d GI 90 BL REPITE m [...], con d mult 20 y d > L", () => {
    for (let s = 0; s < 200; s++) {
      const { texto } = generarDosPoligonos(s);
      const m =
        /^REPITE (\d+) \[AV (\d+) GD (\d+)\] SUBELAPIZ GD 90 AV (\d+) GI 90 BAJALAPIZ REPITE (\d+) \[AV (\d+) GD (\d+)\]$/.exec(
          texto,
        );
      expect(m, texto).not.toBeNull();
      if (m) {
        const [n1, L1, a1, d, n2, L2, a2] = m.slice(1).map(Number) as [
          number, number, number, number, number, number, number,
        ];
        for (const n of [n1, n2]) {
          expect(n).toBeGreaterThanOrEqual(3);
          expect(n).toBeLessThanOrEqual(6);
        }
        expect(L2).toBe(L1);
        // Ángulos derivables: 360/n exacto (120, 90, 72, 60).
        expect(a1 * n1).toBe(360);
        expect(a2 * n2).toBe(360);
        // El traslado horizontal cae en la cuadrícula de 20 y supera el lado.
        expect(d % 20).toBe(0);
        expect(d).toBeGreaterThan(L1);
      }
    }
  });

  it("200 semillas: los dos polígonos no se superponen (sus cajas no se tocan)", () => {
    for (let s = 0; s < 200; s++) {
      const { texto, programa } = generarDosPoligonos(s);
      const n1 = Number(/^REPITE (\d+)/.exec(texto)![1]);
      const { segmentos } = ejecutarYObtenerSegmentos(programa);
      const xs = (segs: readonly Segmento[]) => segs.flatMap((g) => [g.desde.x, g.hasta.x]);
      const primero = xs(segmentos.slice(0, n1));
      const segundo = xs(segmentos.slice(n1));
      expect(Math.max(...primero), texto).toBeLessThan(Math.min(...segundo));
    }
  });

  it("200 semillas: la referencia SIN SUBELAPIZ/BAJALAPIZ no obtiene la estrella de precisión", () => {
    for (const s of MUESTRA) {
      const { texto, programa } = generarDosPoligonos(s);
      const { segmentos: objetivo } = ejecutarYObtenerSegmentos(programa);
      const sinLapiz = programaDeTexto(texto.replace(/\s*(SUBELAPIZ|BAJALAPIZ)/g, ""));
      const { segmentos: dibujo } = ejecutarYObtenerSegmentos(sinLapiz);

      const veredicto = validar(dibujo, objetivo, NIVEL_2_5.normalizacion);
      const calificacion = calificar(sinLapiz, veredicto, retoDeReferencia(NIVEL_2_5, programa, objetivo));
      expect(calificacion.precision.otorgada, `semilla ${s}: ${texto}`).toBe(false);
    }
  }, TIMEOUT_TRES_ESTRELLAS);

  it("200 semillas: olvidar SL/BL dejaría un conector que supera con holgura el 5 % de tolerancia", () => {
    // El conector olvidado es un trazo horizontal de d px; si el primer polígono es
    // un cuadrado, sus primeros L px recorren un lado ya dibujado y no cuentan como
    // exceso. Lo que sobra debe ser al menos el 10 % del perímetro (umbral: 5 %).
    for (let s = 0; s < 200; s++) {
      const { texto } = generarDosPoligonos(s);
      const m = /^REPITE (\d+) \[AV (\d+) GD \d+\] SUBELAPIZ GD 90 AV (\d+) GI 90 BAJALAPIZ REPITE (\d+) /.exec(texto)!;
      const [n1, L, d, n2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      const exceso = d - (n1 === 4 ? L : 0);
      expect(exceso, texto).toBeGreaterThanOrEqual(0.1 * (n1 + n2) * L);
    }
  });
  it("la pista 3 describe lo que Kiro dibuja: traslado SL GD 90 AV d GI 90 BL", () => {
    const pista = NIVEL_2_5.pistas[2]!;
    for (const fragmento of ["SUBELAPIZ", "GD 90", "AV", "GI 90", "BAJALAPIZ"]) {
      expect(pista).toContain(fragmento);
    }
    // El orden es el del programa de referencia.
    expect(pista.indexOf("SUBELAPIZ")).toBeLessThan(pista.indexOf("GD 90"));
    expect(pista.indexOf("GD 90")).toBeLessThan(pista.indexOf("GI 90"));
    expect(pista.indexOf("GI 90")).toBeLessThan(pista.indexOf("BAJALAPIZ"));
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

  it("200 semillas: la referencia aprueba su nivel con las TRES estrellas", () => {
    for (const s of MUESTRA) {
      apruebaLasTresEstrellas(NIVEL_2_5, generarDosPoligonos(s).programa);
    }
  }, TIMEOUT_TRES_ESTRELLAS);

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

  it("200 semillas: define PANEL una vez, lo invoca una sola vez dentro de REPITE filas [REPITE columnas [...]] y dibuja filas×columnas paneles", () => {
    for (let s = 0; s < 200; s++) {
      const { texto, programa } = generarCuadricula(s);
      const p = parametrosCuadricula(texto);

      // Una única definición y una única invocación escrita de PANEL.
      expect(programa.instrucciones.filter((n) => n.tipo === "definicionProcedimiento")).toHaveLength(1);
      expect(texto.match(/\bPANEL\b/g), texto).toHaveLength(2); // definición + invocación
      expect(p.filas * p.columnas, texto).toSatisfy((n: number) => [4, 6, 9].includes(n));

      // La repetición anidada es la forma compacta de la plantilla.
      const analisis = analizarAbstraccion(programa, [
        { clave: "defineProcedimiento" },
        { clave: "usaRepiteAnidado" },
      ]);
      expect(analisis.sinConfirmar, texto).toHaveLength(0);

      // Aun con una sola invocación, se dibujan filas×columnas cuadrados de 4 lados.
      const { segmentos } = ejecutarYObtenerSegmentos(programa);
      expect(segmentos, texto).toHaveLength(4 * p.filas * p.columnas);
    }
  });

  it("200 semillas: la tortuga no se va del lienzo al regresar de cada fila (columnas × paso ≤ 400)", () => {
    for (let s = 0; s < 200; s++) {
      const p = parametrosCuadricula(generarCuadricula(s).texto);
      expect(p.columnas * p.paso).toBeLessThanOrEqual(400);
    }
  });

  it("200 semillas: la copia literal sin PARA nunca gana economía y el REPITE anidado sin PARA nunca gana abstracción", () => {
    for (let s = 0; s < 200; s++) {
      const { texto, programa } = generarCuadricula(s);
      const p = parametrosCuadricula(texto);
      const presupuesto = contar(programa);

      const copia = programaDeTexto(copiaLiteralSinPara(p));
      expect(contar(copia), texto).toBeGreaterThan(presupuesto);

      const anidadoSinPara = programaDeTexto(anidadoSinPara_(p));
      expect(contar(anidadoSinPara), texto).toBeLessThanOrEqual(presupuesto);
      expect(analizarAbstraccion(anidadoSinPara, NIVEL_2_6.abstraccion).sinConfirmar, texto).toEqual([
        "defineProcedimiento",
      ]);
    }
  });

  it("tabla del dueño (3×3, semilla 23770): con PARA gana economía y abstracción; REPITE anidado sin PARA solo economía; copia literal ninguna", () => {
    const { texto, programa } = generarCuadricula(23770);
    const p = parametrosCuadricula(texto);
    // Es el reto que probó el dueño: 3×3, lado 80, paso 120.
    expect([p.filas, p.columnas, p.lado, p.paso]).toEqual([3, 3, 80, 120]);

    const { segmentos: objetivo } = ejecutarYObtenerSegmentos(programa);
    const reto = retoDeReferencia(NIVEL_2_6, programa, objetivo);

    const calificar_ = (fuente: string) => {
      const jugador = programaDeTexto(fuente);
      const { segmentos } = ejecutarYObtenerSegmentos(jugador);
      const veredicto = validar(segmentos, objetivo, NIVEL_2_6.normalizacion);
      return calificar(jugador, veredicto, reto);
    };

    const conPara = calificar_(texto);
    const sinPara = calificar_(anidadoSinPara_(p));
    const copia = calificar_(copiaLiteralSinPara(p));

    // El presupuesto es el conteo de la referencia anidada, no el de la copia.
    expect(reto.presupuestoEstrella).toBe(18);
    expect([conPara.conteoJugador, sinPara.conteoJugador, copia.conteoJugador]).toEqual([18, 17, 73]);

    // Los tres dibujan lo mismo: la precisión no distingue entre ellos.
    expect([conPara, sinPara, copia].map((c) => c.precision.otorgada)).toEqual([true, true, true]);
    expect([conPara, sinPara, copia].map((c) => c.economia.otorgada)).toEqual([true, true, false]);
    expect([conPara, sinPara, copia].map((c) => c.abstraccion.otorgada)).toEqual([true, false, false]);
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

  it("200 semillas: la referencia aprueba su nivel con las TRES estrellas", () => {
    for (const s of MUESTRA) {
      apruebaLasTresEstrellas(NIVEL_2_6, generarCuadricula(s).programa);
    }
  }, TIMEOUT_TRES_ESTRELLAS);

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
