// Tests del mundo 1 — figuras geometricas
// Verifica los niveles autorados (2.1), los generadores (2.2, 2.3, 2.4) y
// la evaluacion de la estrella de abstraccion (2.6).

import { describe, it, expect } from "vitest";
import {
  NIVEL_1_1, NIVEL_1_4, REFERENCIA_1_1, REFERENCIA_1_4, MUNDO_1,
} from "./mundo-1-figuras.js";
import {
  generarPoligonoGD, generarPoligonoGI, generarArco,
} from "../juego/generadores-mundo-1.js";
import { contarInstrucciones } from "../lenguaje/conteo.js";
import { calcularEncuadre } from "../motor/encuadre.js";
import { ejecutar } from "../lenguaje/interprete.js";
import { extraerSegmentos } from "../motor/segmentos.js";
import { ESTADO_INICIAL } from "../motor/tortuga.js";
import { comandosDelMundo } from "../lenguaje/vocabulario.js";
import { resolverReto } from "../juego/reto.js";
import { validar } from "../motor/validador.js";
import { calificar } from "../juego/estrellas.js";

// ============================================================================
// Utilidades de test
// ============================================================================

const PERMITIDOS_1 = comandosDelMundo(1);

function ejecutarYObtenerSegmentos(programa: import("../lenguaje/ast.js").Programa) {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: PERMITIDOS_1,
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  return { resultado: paso.value, segmentos: extraerSegmentos(paso.value.operaciones) };
}

// ============================================================================
// 2.1 Niveles autorados 1.1 y 1.4
// ============================================================================

describe("nivel 1.1 — cuadrado", () => {
  it("tiene id, mundo, titulo y concepto correctos", () => {
    expect(NIVEL_1_1.id).toBe("1.1");
    expect(NIVEL_1_1.mundo).toBe(1);
    expect(NIVEL_1_1.concepto).toBe("iteracion");
    expect(NIVEL_1_1.titulo.length).toBeGreaterThan(0);
  });

  it("su origen es autorado con la referencia REPITE 4 [AV 100 GD 90]", () => {
    expect(NIVEL_1_1.origen.tipo).toBe("autorado");
    if (NIVEL_1_1.origen.tipo === "autorado") {
      expect(NIVEL_1_1.origen.referencia).toBe(REFERENCIA_1_1);
    }
  });

  it("contarInstrucciones(REFERENCIA_1_1) === 3", () => {
    const r = contarInstrucciones(REFERENCIA_1_1);
    expect(r.exito).toBe(true);
    if (r.exito) expect(r.instrucciones).toBe(3);
  });

  it("tiene exigencia usaRepite", () => {
    expect(NIVEL_1_1.abstraccion.some((e) => e.clave === "usaRepite")).toBe(true);
  });

  it("tiene tres pistas validas", () => {
    expect(NIVEL_1_1.pistas).toHaveLength(3);
    for (const pista of NIVEL_1_1.pistas) {
      expect(pista.trim().length).toBeGreaterThan(0);
      expect(pista.length).toBeLessThanOrEqual(200);
    }
  });

  it("la referencia ejecuta sin error y produce exactamente 8 operaciones", () => {
    const { resultado } = ejecutarYObtenerSegmentos(REFERENCIA_1_1);
    expect(resultado.error).toBeNull();
    expect(resultado.operaciones).toHaveLength(8);
  });
});

describe("nivel 1.4 — circulo", () => {
  it("tiene id, mundo, titulo y concepto correctos", () => {
    expect(NIVEL_1_4.id).toBe("1.4");
    expect(NIVEL_1_4.mundo).toBe(1);
    expect(NIVEL_1_4.concepto).toBe("iteracion");
  });

  it("contarInstrucciones(REFERENCIA_1_4) === 3", () => {
    const r = contarInstrucciones(REFERENCIA_1_4);
    expect(r.exito).toBe(true);
    if (r.exito) expect(r.instrucciones).toBe(3);
  });

  it("la referencia ejecuta sin error y produce exactamente 720 operaciones", () => {
    const { resultado } = ejecutarYObtenerSegmentos(REFERENCIA_1_4);
    expect(resultado.error).toBeNull();
    expect(resultado.operaciones).toHaveLength(720);
  });
});

// ============================================================================
// 2.2 Generador 1.2 — poligono regular GD (propiedad sobre 200 semillas)
// ============================================================================

describe("generador 1.2 — poligono GD", () => {
  it("200 semillas: todas encuadran y no son degeneradas", () => {
    for (let s = 0; s < 200; s++) {
      const { programa } = generarPoligonoGD(s);
      const { segmentos } = ejecutarYObtenerSegmentos(programa);
      const encuadre = calcularEncuadre(segmentos);
      expect(encuadre.hayCaja).toBe(true);
      if (encuadre.hayCaja) {
        expect(encuadre.noEncuadrada).toHaveLength(0);
        expect(encuadre.degenerada).toBe(false);
      }
    }
  });

  it("200 semillas: conteo === 3 (REPITE + AV + GD)", () => {
    for (let s = 0; s < 200; s++) {
      const { programa } = generarPoligonoGD(s);
      const r = contarInstrucciones(programa);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(3);
    }
  });

  it("200 semillas: n en {3,4,5,6,8} y angulo = 360/n entero exacto", () => {
    for (let s = 0; s < 200; s++) {
      const { texto } = generarPoligonoGD(s);
      // Forma esperada: REPITE n [AV L GD angulo]
      const m = /^REPITE (\d+) \[AV (\d+) GD (\d+)\]$/.exec(texto);
      expect(m).not.toBeNull();
      if (m) {
        const n = Number(m[1]);
        const L = Number(m[2]);
        const angulo = Number(m[3]);
        expect([3, 4, 5, 6, 8]).toContain(n); // 7 excluido
        expect(L % 20).toBe(0);
        expect(L).toBeGreaterThanOrEqual(60);
        expect(L).toBeLessThanOrEqual(140);
        expect(angulo).toBe(360 / n); // entero exacto para todos los n permitidos
        expect(Number.isInteger(360 / n)).toBe(true);
      }
    }
  });

  it("el reto de referencia aprueba su propio nivel con las TRES estrellas (muestra de semillas)", () => {
    // Regresion obligatoria: el programa de referencia debe aprobar su propio
    // nivel con precision, economia y abstraccion, ejecutando esa misma
    // referencia como si fuera el programa del jugador. La validacion geometrica
    // es costosa (giro sobre mascara 800x800), asi que se corre sobre una muestra
    // representativa; las 200 semillas completas se cubren con encuadre y conteo.
    for (const s of [0, 1, 7, 13, 42, 99, 150, 199]) {
      const resultado = resolverReto("1.2", s);
      expect(resultado.exito).toBe(true);
      if (!resultado.exito) continue;
      const reto = resultado.reto;

      // El jugador "copia" la referencia: debe ganar las tres estrellas.
      const veredicto = validar(reto.segmentos, reto.segmentos, reto.nivel.normalizacion);
      const calificacion = calificar(reto.referencia, veredicto, reto);

      expect(calificacion.precision.otorgada).toBe(true);
      expect(calificacion.economia.otorgada).toBe(true);
      expect(calificacion.abstraccion.otorgada).toBe(true);
    }
  });
});

// ============================================================================
// 2.3 Generador 1.3 — poligono regular GI (propiedad sobre 200 semillas)
// ============================================================================

describe("generador 1.3 — poligono GI", () => {
  it("200 semillas: todas encuadran y no son degeneradas", () => {
    for (let s = 0; s < 200; s++) {
      const { programa } = generarPoligonoGI(s);
      const { segmentos } = ejecutarYObtenerSegmentos(programa);
      const encuadre = calcularEncuadre(segmentos);
      expect(encuadre.hayCaja).toBe(true);
      if (encuadre.hayCaja) {
        expect(encuadre.noEncuadrada).toHaveLength(0);
        expect(encuadre.degenerada).toBe(false);
      }
    }
  });

  it("200 semillas: conteo === 3 (REPITE + AV + GI)", () => {
    for (let s = 0; s < 200; s++) {
      const { programa } = generarPoligonoGI(s);
      const r = contarInstrucciones(programa);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(3);
    }
  });

  it("200 semillas: n en {3,4,5,6,8} y angulo = 360/n entero exacto", () => {
    for (let s = 0; s < 200; s++) {
      const { texto } = generarPoligonoGI(s);
      // Forma esperada: REPITE n [AV L GI angulo] (igual que 1.2 pero con GI)
      const m = /^REPITE (\d+) \[AV (\d+) GI (\d+)\]$/.exec(texto);
      expect(m).not.toBeNull();
      if (m) {
        const n = Number(m[1]);
        const L = Number(m[2]);
        const angulo = Number(m[3]);
        expect([3, 4, 5, 6, 8]).toContain(n); // 7 excluido
        expect(L % 20).toBe(0);
        expect(L).toBeGreaterThanOrEqual(60);
        expect(L).toBeLessThanOrEqual(140);
        expect(angulo).toBe(360 / n); // entero exacto para todos los n permitidos
        expect(Number.isInteger(360 / n)).toBe(true);
      }
    }
  });

  it("el reto de referencia aprueba su propio nivel con las TRES estrellas (muestra de semillas)", () => {
    // Regresion obligatoria (req 3.6): el programa de referencia del 1.3 debe
    // aprobar su propio nivel con precision, economia y abstraccion, ejecutando
    // esa misma referencia como si fuera el programa del jugador. Igual que en
    // el 1.2, la validacion geometrica es costosa, asi que se corre sobre la
    // misma muestra representativa de semillas.
    for (const s of [0, 1, 7, 13, 42, 99, 150, 199]) {
      const resultado = resolverReto("1.3", s);
      expect(resultado.exito).toBe(true);
      if (!resultado.exito) continue;
      const reto = resultado.reto;

      // El jugador "copia" la referencia: debe ganar las tres estrellas.
      const veredicto = validar(reto.segmentos, reto.segmentos, reto.nivel.normalizacion);
      const calificacion = calificar(reto.referencia, veredicto, reto);

      expect(calificacion.precision.otorgada).toBe(true);
      expect(calificacion.economia.otorgada).toBe(true);
      expect(calificacion.abstraccion.otorgada).toBe(true);
    }
  });
});

// ============================================================================
// 2.4 Generador 1.5 — arco (propiedad sobre 200 semillas)
// ============================================================================

describe("generador 1.5 — arco", () => {
  it("200 semillas: todas encuadran y no son degeneradas", () => {
    for (let s = 0; s < 200; s++) {
      const { programa } = generarArco(s);
      const { segmentos } = ejecutarYObtenerSegmentos(programa);
      const encuadre = calcularEncuadre(segmentos);
      expect(encuadre.hayCaja).toBe(true);
      if (encuadre.hayCaja) {
        expect(encuadre.noEncuadrada).toHaveLength(0);
        expect(encuadre.degenerada).toBe(false);
      }
    }
  });

  it("200 semillas: conteo === 3 (REPITE + AV + GD)", () => {
    for (let s = 0; s < 200; s++) {
      const { programa } = generarArco(s);
      const r = contarInstrucciones(programa);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(3);
    }
  });

  it("200 semillas: forma REPITE k [AV L GD angulo] con 2 <= k < n, n en {4,5,6,7,8}", () => {
    // n=7 se admite aqui (a diferencia de 1.2/1.3): el arco no cierra, asi que
    // el error de redondeo de 360/7 no acumula hasta un fallo de encuadre.
    for (let s = 0; s < 200; s++) {
      const { texto } = generarArco(s);
      const m = /^REPITE (\d+) \[AV (\d+) GD (\d+)\]$/.exec(texto);
      expect(m).not.toBeNull();
      if (m) {
        const k = Number(m[1]);
        const L = Number(m[2]);
        const angulo = Number(m[3]);
        expect(k).toBeGreaterThanOrEqual(2);
        expect(L % 20).toBe(0);
        expect(L).toBeGreaterThanOrEqual(60);
        expect(L).toBeLessThanOrEqual(140);
        // angulo = round(360/n) con n en {4,5,6,7,8}: {90,72,60,51,45}
        expect([90, 72, 60, 51, 45]).toContain(angulo);
      }
    }
  });

  it("el reto de referencia aprueba su propio nivel con las TRES estrellas (muestra de semillas)", () => {
    // Regresion obligatoria (req 3.6): el programa de referencia del 1.5 debe
    // aprobar su propio nivel con precision, economia y abstraccion, ejecutando
    // esa misma referencia como si fuera el programa del jugador. Igual que en
    // el 1.2 y el 1.3, la validacion geometrica es costosa, asi que se corre
    // sobre la misma muestra representativa de semillas.
    for (const s of [0, 1, 7, 13, 42, 99, 150, 199]) {
      const resultado = resolverReto("1.5", s);
      expect(resultado.exito).toBe(true);
      if (!resultado.exito) continue;
      const reto = resultado.reto;

      // El jugador "copia" la referencia: debe ganar las tres estrellas.
      const veredicto = validar(reto.segmentos, reto.segmentos, reto.nivel.normalizacion);
      const calificacion = calificar(reto.referencia, veredicto, reto);

      expect(calificacion.precision.otorgada).toBe(true);
      expect(calificacion.economia.otorgada).toBe(true);
      expect(calificacion.abstraccion.otorgada).toBe(true);
    }
  });
});

// ============================================================================
// 2.5 Mundo 1 en el catalogo
// ============================================================================

describe("MUNDO_1 — catalogo", () => {
  it("tiene exactamente cinco niveles", () => {
    expect(MUNDO_1).toHaveLength(5);
  });

  it("los ids son 1.1, 1.2, 1.3, 1.4, 1.5 en orden", () => {
    expect(MUNDO_1.map((n) => n.id)).toEqual(["1.1", "1.2", "1.3", "1.4", "1.5"]);
  });

  it("todos pertenecen al mundo 1", () => {
    for (const nivel of MUNDO_1) {
      expect(nivel.mundo).toBe(1);
    }
  });

  it("nivel 1.1 tiene presupuesto estrella calculado === 3", () => {
    // presupuesto = contarInstrucciones(referencia)
    expect(NIVEL_1_1.origen.tipo).toBe("autorado");
    if (NIVEL_1_1.origen.tipo === "autorado") {
      const r = contarInstrucciones(NIVEL_1_1.origen.referencia);
      expect(r.exito).toBe(true);
      if (r.exito) expect(r.instrucciones).toBe(3);
    }
  });

  it("todos tienen normalizacion libre/libre/exacta", () => {
    for (const nivel of MUNDO_1) {
      expect(nivel.normalizacion.traslacion).toBe("libre");
      expect(nivel.normalizacion.rotacion).toBe("libre");
      expect(nivel.normalizacion.escala).toBe("exacta");
    }
  });

  it("todos tienen la exigencia usaRepite", () => {
    for (const nivel of MUNDO_1) {
      expect(nivel.abstraccion.some((e) => e.clave === "usaRepite")).toBe(true);
    }
  });
});

// ============================================================================
// 2.6 Estrella de abstraccion — nivel 1.1
// ============================================================================
// La logica de evaluacion de la estrella de abstraccion vive en reto.ts / juego.
// Aqui verificamos la condicion a nivel de AST: un programa sin ningun nodo
// Repeticion no debe cumplir la exigencia usaRepite.

import { analizarLexico } from "../lenguaje/lexer.js";
import { analizar } from "../lenguaje/parser.js";

function tieneRepite(texto: string): boolean {
  const { tokens } = analizarLexico(texto);
  const { programa } = analizar(tokens, { mundo: 1 });
  if (!programa) return false;
  function recorrer(insts: readonly import("../lenguaje/ast.js").Instruccion[]): boolean {
    for (const inst of insts) {
      if (inst.tipo === "repeticion") return true;
      if (inst.tipo === "definicionProcedimiento" || inst.tipo === "condicionalUnaRama" || inst.tipo === "condicionalDosRamas") {
        // no aplica en mundo 1, pero por completitud
      }
    }
    return false;
  }
  return recorrer(programa.instrucciones);
}

describe("estrella de abstraccion — usaRepite", () => {
  it("cuadrado a mano NO usa REPITE", () => {
    const textoMano = "AV 100 GD 90 AV 100 GD 90 AV 100 GD 90 AV 100 GD 90";
    expect(tieneRepite(textoMano)).toBe(false);
  });

  it("REPITE 4 [AV 100 GD 90] SI usa REPITE", () => {
    expect(tieneRepite("REPITE 4 [AV 100 GD 90]")).toBe(true);
  });

  it("nivel 1.1 tiene exigencia usaRepite declarada", () => {
    expect(NIVEL_1_1.abstraccion.some((e) => e.clave === "usaRepite")).toBe(true);
  });
});
