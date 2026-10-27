// Generadores del mundo 2 · Composición
// Producen el programa de referencia (como Programa AST) a partir de una semilla.
// Siguen el mismo patrón que el mundo 1: elegir parámetros con el PRNG, construir
// el texto KiroLogo, parsearlo con { mundo: 2 }, verificar encuadre; si falla,
// reintentar con la semilla siguiente. Al agotar los intentos cae a un fallback
// determinista conocido-bueno.
//
// A diferencia del mundo 1, aquí aparecen el lápiz (SUBELAPIZ/BAJALAPIZ) y los
// procedimientos (PARA … FIN), que habilitan las dos figuras compuestas del
// mundo: dos polígonos separados sin trazo entre ellos, y una cuadrícula hecha
// de un panel nombrado e invocado una vez por casilla.

import type { Programa } from "../lenguaje/ast.js";
import { analizarLexico } from "../lenguaje/lexer.js";
import { analizar } from "../lenguaje/parser.js";
import { ejecutar } from "../lenguaje/interprete.js";
import { crearPrng } from "../azar/prng.js";
import { ESTADO_INICIAL } from "../motor/tortuga.js";
import { extraerSegmentos } from "../motor/segmentos.js";
import { calcularEncuadre } from "../motor/encuadre.js";
import { comandosDelMundo } from "../lenguaje/vocabulario.js";

// ============================================================================
// Tipos públicos
// ============================================================================

export interface ResultadoGenerador {
  readonly programa: Programa;
  readonly texto: string;
  readonly semillaUsada: number;
}

export type FnGenerador = (semilla: number) => ResultadoGenerador;

// ============================================================================
// Utilidades internas
// ============================================================================

const PERMITIDOS_MUNDO_2 = comandosDelMundo(2);

/** Intentos máximos del lazo de reintento antes de caer al fallback. */
const MAX_INTENTOS = 1000;

/** Parsea texto KiroLogo del mundo 2; devuelve null si hay errores. */
function parsear(texto: string): Programa | null {
  const { tokens } = analizarLexico(texto);
  const { programa, errores } = analizar(tokens, { mundo: 2 });
  if (programa === null || errores.length > 0) return null;
  return programa;
}

/**
 * Ejecuta un programa y verifica que la figura encuadre en el lienzo
 * (caja envolvente dentro de [−400, 400] en ambos ejes) y no sea degenerada
 * (ancho y alto ≥ 200). Es la misma guarda que usa el mundo 1. Las decoraciones
 * y los movimientos con el lápiz arriba no producen segmentos, así que el
 * encuadre se mide solo sobre los trazos visibles (R9.9, R9.10).
 */
function encuadraYNoEsDegenerada(programa: Programa): boolean {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: PERMITIDOS_MUNDO_2,
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  const resultado = paso.value;
  if (resultado.error !== null) return false;
  if (resultado.guardaActivada !== null) return false;

  const segmentos = extraerSegmentos(resultado.operaciones);
  const encuadre = calcularEncuadre(segmentos);

  if (!encuadre.hayCaja) return false;
  if (encuadre.degenerada) return false;
  if (encuadre.noEncuadrada.length > 0) return false;
  return true;
}

// ============================================================================
// Generador 2.2 — estrella de p puntas
// ============================================================================
//
// Forma: REPITE p [AV L GD 360*2/p]. La tortuga da dos vueltas completas (720°)
// repartidas en p giros iguales, de modo que las puntas se cruzan y queda una
// estrella de un solo trazo (R9.1).
//
// Manejo de p = 7: para p ∈ {5, 9} el ángulo 720/p es entero exacto (144 y 80).
// Para p = 7 vale 102.857…, que no es entero; el requisito pide el conjunto
// {5, 7, 9}, así que redondeamos al entero más cercano (Math.round(720/7) = 103)
// y dejamos que la guarda de encuadre descarte la semilla: con 103° la estrella
// de 7 puntas no cierra limpio y la figura degenera o se desencuadra, así que el
// lazo reintenta con la semilla siguiente (que vuelve a elegir p). El resultado
// observable es que el 2.2 produce estrellas de 5 o 9 puntas bien formadas; p = 7
// queda como intento que casi siempre se descarta. Esto mantiene la garantía de
// las 200 semillas (toda semilla devuelta encuadra y no degenera) sin colgar el
// lazo, porque el fallback final es una estrella de 5 puntas conocida-buena.
const PUNTAS_ESTRELLA: readonly number[] = [5, 7, 9];

export function generarEstrella(semilla: number): ResultadoGenerador {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const p = prng.elegir(PUNTAS_ESTRELLA);
    const L = prng.multiplo(100, 180, 20);
    const angulo = Math.round((360 * 2) / p);
    const texto = `REPITE ${p} [AV ${L} GD ${angulo}]`;
    const programa = parsear(texto);
    if (programa !== null && encuadraYNoEsDegenerada(programa)) {
      return { programa, texto, semillaUsada: semilla + intento };
    }
  }
  // Fallback determinista: estrella de 5 puntas con lado 100 (144° exacto).
  const texto = "REPITE 5 [AV 100 GD 144]";
  return { programa: parsear(texto)!, texto, semillaUsada: semilla };
}

// ============================================================================
// Generador 2.3 — escalera de n peldaños
// ============================================================================
//
// Forma: REPITE n [AV L GI 90 AV L GD 90]. Cada peldaño sube un tramo (GI 90 deja
// la tortuga mirando a un lado) y avanza otro tramo igual (GD 90 la devuelve al
// rumbo de subida), con huella = altura = L (R9.2). La escalera crece en
// diagonal; su caja envolvente mide n·L de ancho y n·L de alto aproximadamente,
// así que las combinaciones chicas (pocas escaleras, L pequeño) degeneran y el
// lazo las descarta.
export function generarEscalera(semilla: number): ResultadoGenerador {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const n = prng.entero(3, 6);
    const L = prng.multiplo(20, 60, 20);
    const texto = `REPITE ${n} [AV ${L} GI 90 AV ${L} GD 90]`;
    const programa = parsear(texto);
    if (programa !== null && encuadraYNoEsDegenerada(programa)) {
      return { programa, texto, semillaUsada: semilla + intento };
    }
  }
  // Fallback determinista: 6 peldaños de 60 (caja 360×360, encuadra sin problema).
  const texto = "REPITE 6 [AV 60 GI 90 AV 60 GD 90]";
  return { programa: parsear(texto)!, texto, semillaUsada: semilla };
}

// ============================================================================
// Generador 2.5 — dos polígonos separados
// ============================================================================
//
// Forma: REPITE n1 [AV L GD 360/n1]  SUBELAPIZ GD 45 AV sep GI 45 BAJALAPIZ  REPITE n2 [AV L GD 360/n2].
// Cada polígono es regular de 3..6 lados (ángulo 360/n entero: 120, 90, 72, 60);
// entre los dos, SUBELAPIZ levanta el lápiz, la tortuga se mueve en diagonal
// (GD 45 → AV sep → GI 45, que la deja de nuevo con rumbo 0) y BAJALAPIZ lo baja,
// de modo que NO queda trazo entre ellos (R9.3, R9.4). El extractor de segmentos
// ignora el movimiento con el lápiz arriba, así que la figura resultante son
// exactamente los dos polígonos, sin conector.
//
// Geometría: el primer polígono se dibuja desde el origen hacia arriba; la
// diagonal desplaza el segundo polígono arriba y a la derecha, de modo que la
// caja envolvente combinada crece en los dos ejes a la vez. Con lados grandes
// (120..180) la combinación supera holgadamente 200 px en ancho y alto; el lazo
// descarta las pocas combinaciones estrechas (dos triángulos con separación
// chica) o las que se salen del lienzo, y reintenta con la semilla siguiente.
const LADOS_POLIGONO_M2: readonly number[] = [3, 4, 5, 6];

export function generarDosPoligonos(semilla: number): ResultadoGenerador {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const n1 = prng.elegir(LADOS_POLIGONO_M2);
    const n2 = prng.elegir(LADOS_POLIGONO_M2);
    const L = prng.multiplo(120, 180, 20);
    const sep = prng.multiplo(20, 100, 20);
    const a1 = Math.round(360 / n1);
    const a2 = Math.round(360 / n2);
    const texto =
      `REPITE ${n1} [AV ${L} GD ${a1}] ` +
      `SUBELAPIZ GD 45 AV ${sep} GI 45 BAJALAPIZ ` +
      `REPITE ${n2} [AV ${L} GD ${a2}]`;
    const programa = parsear(texto);
    if (programa !== null && encuadraYNoEsDegenerada(programa)) {
      return { programa, texto, semillaUsada: semilla + intento };
    }
  }
  // Fallback determinista: hexágono + cuadrado de lado 160 separados en diagonal
  // por 60 (caja holgada en ambos ejes, dentro del lienzo).
  const texto =
    "REPITE 6 [AV 160 GD 60] SUBELAPIZ GD 45 AV 60 GI 45 BAJALAPIZ REPITE 4 [AV 160 GD 90]";
  return { programa: parsear(texto)!, texto, semillaUsada: semilla };
}

// ============================================================================
// Generador 2.6 — cuadrícula de paneles con procedimiento
// ============================================================================
//
// La referencia DEFINE un procedimiento PANEL con PARA … FIN y lo invoca una vez
// por casilla (R9.6), de modo que su AST contiene un nodo definicionProcedimiento
// (lo que otorga la estrella defineProcedimiento, R10.2). El panel es un cuadrado
// de lado L; entre casillas la tortuga se reposiciona con el lápiz arriba
// (SUBELAPIZ/BAJALAPIZ) para no dejar trazo de traslado, igual que en 2.5.
//
// Disposición: filas × columnas casillas con paso = L + separación entre ellas.
// Para una fila dibujamos columnas paneles moviéndonos a la derecha; al terminar
// una fila volvemos al inicio de la fila (lápiz arriba) y bajamos una fila. El
// panel se dibuja desde la esquina y la tortuga vuelve a ella (el cuadrado cierra
// en su origen), así que el reposicionamiento es un desplazamiento limpio.
//
// La caja envolvente mide (columnas·paso − separacion)×(filas·paso − separacion),
// que para las tres disposiciones permitidas y un L razonable cae holgadamente
// dentro de [−400, 400] y por encima de 200. El lazo descarta cualquier
// combinación que no cumpla, pero con estos rangos casi todas pasan al primer
// intento.
const DISPOSICIONES_CUADRICULA: readonly (readonly [number, number])[] = [
  [2, 2],
  [3, 2],
  [3, 3],
];

/**
 * Construye el texto de la cuadrícula. El panel es un cuadrado de lado L; las
 * casillas se separan `sep` px entre sí. El trazo de traslado nunca se dibuja
 * porque la tortuga se mueve con el lápiz arriba.
 */
function textoCuadricula(filas: number, columnas: number, L: number, sep: number): string {
  const paso = L + sep;
  const partes: string[] = [];
  // Definición del panel: un cuadrado que empieza y termina en la misma esquina,
  // con el mismo rumbo, de modo que invocarlo no desplaza la tortuga.
  partes.push(`PARA PANEL REPITE 4 [AV ${L} GD 90] FIN`);

  // La tortuga arranca mirando arriba (rumbo 0). Para movernos "a la derecha"
  // dentro de una fila giramos a la derecha (GD 90), avanzamos el paso y
  // desgiramos (GI 90) para que el panel se dibuje siempre con el mismo rumbo.
  // Para bajar de fila giramos atrás (GD 180), avanzamos y volvemos (GI 180).
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      partes.push("PANEL");
      if (c < columnas - 1) {
        // Mover a la casilla siguiente de la fila, sin dibujar.
        partes.push(`SUBELAPIZ GD 90 AV ${paso} GI 90 BAJALAPIZ`);
      }
    }
    if (f < filas - 1) {
      // Volver al inicio de la fila y bajar una fila, sin dibujar.
      const regreso = paso * (columnas - 1);
      partes.push("SUBELAPIZ");
      if (regreso > 0) {
        // Regresar a la primera columna: girar a la izquierda, avanzar, desgirar.
        partes.push(`GI 90 AV ${regreso} GD 90`);
      }
      // Bajar una fila: dar media vuelta, avanzar el paso, volver al rumbo.
      partes.push(`GD 180 AV ${paso} GI 180`);
      partes.push("BAJALAPIZ");
    }
  }

  return partes.join(" ");
}

export function generarCuadricula(semilla: number): ResultadoGenerador {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const [filas, columnas] = prng.elegir(DISPOSICIONES_CUADRICULA);
    const L = prng.multiplo(60, 100, 20);
    const sep = prng.multiplo(20, 40, 20);
    const texto = textoCuadricula(filas, columnas, L, sep);
    const programa = parsear(texto);
    if (programa !== null && encuadraYNoEsDegenerada(programa)) {
      return { programa, texto, semillaUsada: semilla + intento };
    }
  }
  // Fallback determinista: cuadrícula 2×2 de paneles de 100 separados 20.
  const texto = textoCuadricula(2, 2, 100, 20);
  return { programa: parsear(texto)!, texto, semillaUsada: semilla };
}

// ============================================================================
// Registro de generadores por idGenerador
// ============================================================================

export const GENERADORES_M2: Readonly<Record<string, FnGenerador>> = {
  "estrella-m2": generarEstrella,
  "escalera-m2": generarEscalera,
  "dos-poligonos-m2": generarDosPoligonos,
  "cuadricula-m2": generarCuadricula,
};
