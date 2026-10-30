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
// de un panel nombrado, invocado una sola vez dentro de REPITE anidados.

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
// Forma: REPITE n1 [AV L GD 360/n1]  SUBELAPIZ GD 90 AV d GI 90 BAJALAPIZ  REPITE n2 [AV L GD 360/n2].
// Cada polígono es regular de 3..6 lados (ángulo 360/n entero: 120, 90, 72, 60);
// entre los dos, SUBELAPIZ levanta el lápiz, la tortuga se traslada d px en
// horizontal (GD 90 → AV d → GI 90, que la deja de nuevo con rumbo 0) y BAJALAPIZ
// lo baja, de modo que NO queda trazo entre ellos (R9.3, R9.4). El extractor de
// segmentos ignora el movimiento con el lápiz arriba, así que la figura
// resultante son exactamente los dos polígonos, sin conector.
//
// Por qué el traslado es horizontal y no una diagonal: con la tortuga mirando
// arriba, cada polígono (giros a la derecha) queda a la derecha de su primer lado,
// entre x = 0 y x = ancho. Trasladar d > ancho del primer polígono deja el segundo
// totalmente a su derecha: las cajas NO se superponen. Con la diagonal anterior
// (GD 45 AV sep GI 45) las cajas se montaban y, con traslación libre, el jugador
// ganaba la precisión sin usar SUBELAPIZ/BAJALAPIZ: el nivel no forzaba su lección.
// Con este traslado, dibujar el conector con el lápiz abajo deja una línea horizontal
// de d px que cae como exceso de trazo, y el nivel exige de verdad SL/BL.
//
// d es múltiplo de 20 (cuadrícula del lienzo, validacion-geometrica) y siempre
// mayor que el ancho del primer polígono —por tanto también mayor que el lado L—:
// d = techo20(ancho1) + hueco, con hueco ∈ {20, ..., 100}.
//
// Conector visible: si el jugador se olvida de SL/BL, el conector es
// un trazo horizontal de d px desde el origen. Si el primer polígono es un cuadrado,
// el conector recorre además su lado inferior (L px), que ya estaba dibujado, y solo
// el resto (d − L) cuenta como exceso. El generador sube d hasta que ese exceso sea al
// menos el 10 % del perímetro de la figura (el umbral del validador es 5 %), para
// que olvidar SL/BL nunca quede dentro de la tolerancia; si no lo cumple, d crece
// (siempre en múltiplos de 20) y el encuadre descarta las combinaciones que no caben.
const FRACCION_MINIMA_CONECTOR = 0.1;
const LADOS_POLIGONO_M2: readonly number[] = [3, 4, 5, 6];

/**
 * Ancho (extensión en x) de un polígono regular de n lados y lado L dibujado con
 * `REPITE n [AV L GD 360/n]` desde el origen mirando arriba. Se calcula caminando
 * el contorno; el polígono es convexo y queda a la derecha de su primer lado, así
 * que su x mínimo es 0 y el ancho es su x máximo.
 */
function anchoPoligono(n: number, L: number): number {
  const giro = 360 / n;
  let x = 0;
  let y = 0;
  let rumbo = 0;
  let maximo = 0;
  for (let i = 0; i < n; i++) {
    const rad = (rumbo * Math.PI) / 180;
    x += L * Math.sin(rad);
    y += L * Math.cos(rad);
    rumbo += giro;
    maximo = Math.max(maximo, x);
  }
  // Redondeo para absorber el ruido de coma flotante (p. ej. 120.00000000000001).
  return Math.round(maximo * 1e6) / 1e6;
}

export function generarDosPoligonos(semilla: number): ResultadoGenerador {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const n1 = prng.elegir(LADOS_POLIGONO_M2);
    const n2 = prng.elegir(LADOS_POLIGONO_M2);
    const L = prng.multiplo(120, 180, 20);
    const hueco = prng.multiplo(20, 100, 20);
    // Traslado mínimo para que el segundo polígono quede a la derecha del primero...
    const dSinSolape = Math.ceil(anchoPoligono(n1, L) / 20) * 20 + hueco;
    // ...y para que un conector olvidado (cuyo tramo sobre un cuadrado ya dibujado no
    // cuenta como exceso) sea claramente visible. Siempre múltiplo de 20.
    const solape = n1 === 4 ? L : 0;
    const dConectorVisible = Math.ceil((solape + FRACCION_MINIMA_CONECTOR * (n1 + n2) * L) / 20) * 20;
    const d = Math.max(dSinSolape, dConectorVisible);
    const a1 = Math.round(360 / n1);
    const a2 = Math.round(360 / n2);
    const texto =
      `REPITE ${n1} [AV ${L} GD ${a1}] ` +
      `SUBELAPIZ GD 90 AV ${d} GI 90 BAJALAPIZ ` +
      `REPITE ${n2} [AV ${L} GD ${a2}]`;
    const programa = parsear(texto);
    if (programa !== null && encuadraYNoEsDegenerada(programa)) {
      return { programa, texto, semillaUsada: semilla + intento };
    }
  }
  // Fallback determinista: hexágono + cuadrado de lado 160. El hexágono mide
  // ≈ 277 de ancho, así que d = 280 + 20 = 300 deja el cuadrado a su derecha.
  const texto =
    "REPITE 6 [AV 160 GD 60] SUBELAPIZ GD 90 AV 300 GI 90 BAJALAPIZ REPITE 4 [AV 160 GD 90]";
  return { programa: parsear(texto)!, texto, semillaUsada: semilla };
}
// ============================================================================
// Generador 2.6 — cuadrícula de paneles con procedimiento
// ============================================================================
//
// La referencia DEFINE un procedimiento PANEL con PARA … FIN y lo invoca UNA sola
// vez, dentro de REPITE filas [REPITE columnas [PANEL …] …] (R9.6): su AST contiene
// un nodo definicionProcedimiento (estrella defineProcedimiento, R10.2) y una
// repetición anidada. Es la forma más compacta que permite la plantilla
// (niveles-y-progresion.md): con la referencia desenrollada (una invocación por
// casilla) el presupuesto salía en 25 / 40 / 58 y regalaba la estrella de economía
// a quien ya usara REPITE. Con el anidado sale en 18 para las tres disposiciones (3 del panel + 15 del recorrido):
//
//   · REPITE anidado CON PARA: conteo = presupuesto → economía y abstracción.
//   · REPITE anidado SIN PARA: conteo = presupuesto − 1 → economía, NO abstracción.
//   · Copia literal sin PARA (cuadrados y traslados a mano): conteo muy superior
//     (30 en 2×2, 73 en 3×3) → ni economía ni abstracción.
//
// Ningún atajo gana las dos estrellas a la vez: la abstracción exige PARA.
//
// El panel es un cuadrado de lado L que empieza y termina en su esquina con el mismo
// rumbo (invocarlo no mueve la tortuga). Entre casillas la tortuga se reposiciona
// con el lápiz arriba, sin dejar trazo. La tortuga arranca mirando arriba (rumbo 0):
//   · siguiente casilla de la fila: SUBELAPIZ GD 90 AV paso GI 90 BAJALAPIZ;
//   · fin de fila: la tortuga quedó columnas·paso a la derecha; vuelve al inicio y
//     baja una fila con SUBELAPIZ GI 90 AV columnas·paso GI 90 AV paso GI 180
//     BAJALAPIZ (tres giros, mirando de nuevo arriba al terminar).
// El cuerpo es uniforme, así que la última fila también "regresa" con el lápiz
// arriba; no deja trazo.
//
// La caja envolvente mide (columnas·paso − separacion)×(filas·paso − separacion),
// que para las tres disposiciones permitidas y un L razonable cae dentro de
// [−400, 400] y por encima de 200. Además se exige columnas·paso ≤ 400 para que la
// tortuga no salga del lienzo al regresar de cada fila.
const DISPOSICIONES_CUADRICULA: readonly (readonly [number, number])[] = [
  [2, 2],
  [3, 2],
  [3, 3],
];

/**
 * Construye el texto de la cuadrícula: el panel se define una vez y se invoca una
 * sola vez dentro de REPITE filas [REPITE columnas [PANEL …] …]. Las casillas se
 * separan `sep` px entre sí.
 */
function textoCuadricula(filas: number, columnas: number, L: number, sep: number): string {
  const paso = L + sep;
  return (
    `PARA PANEL REPITE 4 [AV ${L} GD 90] FIN ` +
    `REPITE ${filas} [` +
    `REPITE ${columnas} [PANEL SUBELAPIZ GD 90 AV ${paso} GI 90 BAJALAPIZ] ` +
    `SUBELAPIZ GI 90 AV ${columnas * paso} GI 90 AV ${paso} GI 180 BAJALAPIZ]`
  );
}

export function generarCuadricula(semilla: number): ResultadoGenerador {
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const prng = crearPrng(semilla + intento);
    const [filas, columnas] = prng.elegir(DISPOSICIONES_CUADRICULA);
    const L = prng.multiplo(60, 100, 20);
    const sep = prng.multiplo(20, 40, 20);
    // La tortuga recorre columnas·paso al regresar de cada fila: que no salga del lienzo.
    if (columnas * (L + sep) > 400) continue;
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
