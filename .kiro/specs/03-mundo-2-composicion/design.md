# Design Document

**KiroLogo · Spec 03 · Mundo 2 · Composición**

## Overview

Esta spec enseña **descomposición**: nombrar un conjunto de instrucciones con `PARA … FIN` y
reusarlo como si fuera un comando del lenguaje. Agrega además el control del lápiz, el color, el
grosor y el relleno, la visibilidad de la tortuga, y los seis niveles del mundo 2.

La buena noticia es que la mayor parte del andamiaje de la **capa de lenguaje ya existe** desde
specs anteriores y solo hay que activarlo:

- `src/lenguaje/ast.ts` ya declara `DefinicionProcedimiento` (`tipo: 'definicionProcedimiento'`,
  con `nombre`, `parametros: readonly string[]`, `cuerpo`) e `InvocacionProcedimiento`
  (`tipo: 'invocacionProcedimiento'`, con `nombre`, `argumentos`) como nodos reservados. En esta
  spec `parametros` es **siempre** `[]`: el mundo 2 no tiene parámetros (llegan en el mundo 4).
- `src/lenguaje/interprete.ts` ya **ejecuta** esos nodos: salta la definición (el cuerpo se ejecuta
  al invocar), y la invocación empuja un `Marco` en la `pila` con guarda de recursión
  (`comprobarGuardas`), resolviendo la definición con `buscarDefinicion(programa, nombre)` y
  reportando `comandoNoPermitido` si no existe. Como `buscarDefinicion` devuelve la **primera**
  definición del programa, la resolución de referencias adelantadas (R1.5) sale gratis.
- `src/lenguaje/conteo.ts` ya cuenta `definicionProcedimiento` como `contarLista(cuerpo)` (0 por la
  cabecera, el cuerpo una sola vez) e `invocacionProcedimiento` como 1. La regla de economía (R2)
  ya está implementada: necesita pruebas, no código nuevo.
- `src/juego/abstraccion.ts` ya implementa `defineProcedimiento` (busca un nodo
  `definicionProcedimiento` en el AST) y `maximoProcedimientos`. La estrella de abstracción del 2.6
  (R10) ya está resuelta en código.
- `src/motor/tortuga.ts` ya tiene `conLapiz(estado, abajo)` y `conVisibilidad(estado, visible)`,
  puros, que devuelven un estado nuevo. `ESTADO_INICIAL.lapizAbajo` es `true` (R3.5).
- `src/motor/segmentos.ts` ya emite segmento **solo** para `mover` con `lapizAbajo === true` y
  longitud ≥ 0,0001; `lapiz`, `visibilidad`, `girar` y `reubicar` no aportan nada. El lápiz
  arriba no produce trazo en cuanto el intérprete emite el `mover` con el flag correcto (R3.2, R3.4).
- `src/motor/validador.ts` compara **solo trazos** (máscaras de segmentos) por IoU y exceso. Nunca
  lee color, grosor ni relleno. R4.8 se cumple por construcción mientras esas decoraciones no se
  vuelvan segmentos.
- `src/lenguaje/vocabulario.ts` ya declara los nueve comandos del mundo 2 (`SUBELAPIZ/SL`,
  `BAJALAPIZ/BL`, `PONCOLOR/PC`, `PONGROSOR/PG`, `RELLENA/RL`, `PARA`, `FIN`, `OCULTATORTUGA/OT`,
  `MUESTRATORTUGA/MT`) con `mundo: 2`. `TABLA_LOGO_INGLES` ya mapea `PU→SUBELAPIZ`, `PD→BAJALAPIZ`,
  `FILL→RELLENA`, `TO→PARA`, `END→FIN`, `HT→OCULTATORTUGA`, `ST→MUESTRATORTUGA`, etc.

Lo que **sí hay que construir o ampliar** es el trabajo real de esta spec:

1. **Parser** — reconocer `PARA NOMBRE … FIN` → `DefinicionProcedimiento` con `parametros: []`, y
   reconocer un `identificador` que coincide con un procedimiento definido → `InvocacionProcedimiento`
   (hoy un `identificador` suelto es siempre error). Requiere una **primera pasada** que recoja los
   nombres de los `PARA` para que las referencias adelantadas y la regla «un procedimiento se usa
   igual que un comando» funcionen.
2. **Intérprete / `ejecutarComando`** — semántica de los comandos del mundo 2: lápiz y visibilidad
   por el estado de la tortuga; color, grosor y relleno como un **canal decorativo** que el
   renderizador dibuja pero que **no** produce segmentos y **no** llega al validador.
3. **Los seis niveles** (2.1 y 2.4 autorados; 2.2, 2.3, 2.5 y 2.6 generados) más los cuatro
   generadores, con presupuesto calculado por el Conteo, nunca escrito a mano.
4. **Nuevos `IdError`** — `FIN` sin `PARA`, `PARA` sin `FIN`, procedimiento redefinido, nombre de
   procedimiento que pisa el lenguaje, y color inválido.
5. **Extensión del panel de comandos** para mostrar los procedimientos del jugador.
6. **Catálogo de colores** (`Catalogo_Colores`): once nombres en español y la forma RGB `[r g b]`.

**El trabajo es ampliar, no rediseñar.** No se toca la forma del AST, la pila del intérprete, la
regla de conteo, el análisis de abstracción ni el validador.

## Architecture

### Flujo de la capa de lenguaje con procedimientos y canal decorativo

```
texto KiroLogo
     │
     ▼
  Lexer                      ← PARA y FIN ya son tokens 'comando'; el NOMBRE tras
     │ Token[]                 PARA es un token 'identificador' (sin cambio de lexer)
     ▼
  Parser (DOS PASADAS)       ← nuevo:
     │                         1ª pasada: recoge nombres de todos los PARA → Set<string>
     │                         2ª pasada: parsea; un 'identificador' cuyo nombre está
     │                         en el Set es InvocacionProcedimiento, no error
     │ Programa (AST)
     ▼
  Interprete (pila/Marco)    ← ya resuelve invocacionProcedimiento vía buscarDefinicion;
     │                         ejecutarComando se amplía con los comandos del mundo 2
     │ Operacion[]
     ├───────────────────────────────────────────────┐
     ▼                                                ▼
  mover / girar / lapiz /                      color / grosor / relleno
  visibilidad / reubicar / limpiar             (CANAL DECORATIVO)
     │                                                │
     ▼                                                ▼
  extraerSegmentos                              Renderizador (lienzo)
  (SOLO mover + lapizAbajo)                     dibuja color, grosor y relleno
     │                                                ╎
     ▼                                                ╎ (nunca produce segmentos)
  validador  ◄────── trazos únicamente ◄──────────────╳  el validador NO ve esto
  (IoU + exceso)
```

La línea quebrada (`╳`) es la frontera clave de esta spec: las operaciones decorativas
(`OperacionColor`, `OperacionGrosor`, `OperacionRelleno`) viajan hacia el renderizador para que el
dibujo se vea como el jugador quiere, pero `extraerSegmentos` ya ignora todo lo que no sea `mover`
con el lápiz abajo, así que **nunca** entran en la máscara que compara el validador. Color, grosor
y relleno no pueden aprobar ni reprobar un nivel (R4.8).

### Las dos pasadas del parser

```
analizar(tokens, { mundo: 2 })
   │
   ├─ recolectarProcedimientos(tokens) ───► Set<string> de nombres válidos de PARA
   │     (recorre buscando PARA NOMBRE … FIN bien formado; descarta los rechazados:
   │      nombre que pisa el lenguaje, redefinición, PARA sin FIN)
   │
   └─ bucle de analizarInstruccion(estado), con estado.procedimientos = ese Set
         │
         ├─ 'comando' PARA ─► analizarDefinicion → DefinicionProcedimiento (parametros: [])
         ├─ 'comando' FIN  sin PARA abierto ─► error finSinPara
         └─ 'identificador' cuyo nombre ∈ estado.procedimientos
                            ─► InvocacionProcedimiento (ya no resolverPalabraNoEjecutable)
```

La primera pasada existe para que una invocación escrita **antes** de la definición se reconozca
igual (R1.5) y para que el parser no reporte «palabra desconocida» sobre un nombre que el jugador
sí definió más abajo. La resolución final contra la definición concreta la hace el intérprete con
`buscarDefinicion` sobre el programa ya completo.

### Capa de niveles

Igual que el mundo 1: dos niveles autorados con `referencia: Programa` (AST), y cuatro generados con
`idGenerador` + `parametros`. Nada de presupuesto en los datos; lo calcula el Conteo sobre la
referencia en tiempo de ejecución (R8.3, R9.7, R9.8). Un archivo nuevo `src/niveles/mundo-2-composicion.ts`
exporta `MUNDO_2`, y `src/niveles/catalogo.ts` pasa a `CATALOGO = [...MUNDO_0, ...MUNDO_1, ...MUNDO_2]`.

Los generadores del mundo 2 siguen el patrón de `src/juego/generadores-mundo-1.ts`: elegir
parámetros con `crearPrng`, construir el texto KiroLogo, `parsear` → `ejecutar` →
`encuadraYNoEsDegenerada`, reintentar con la semilla siguiente hasta `MAX_INTENTOS`, y un fallback
determinista. Se registran en `src/juego/generadores-mundo-2.ts` y se exponen por un record
`GENERADORES`.

## Components and Interfaces

### 1. AST — `src/lenguaje/ast.ts` (sin cambios)

`DefinicionProcedimiento` e `InvocacionProcedimiento` **ya existen** como nodos reservados. El
parser del mundo 2 empieza a producirlos; `parametros` será siempre `[]`.

```typescript
// EXISTE — el parser del mundo 2 lo produce con parametros: []
export interface DefinicionProcedimiento extends NodoBase {
  readonly tipo: 'definicionProcedimiento';
  readonly nombre: string;
  readonly parametros: readonly string[];   // [] en el mundo 2
  readonly cuerpo: readonly Instruccion[];
}

// EXISTE — el parser del mundo 2 lo produce con argumentos: []
export interface InvocacionProcedimiento extends NodoBase {
  readonly tipo: 'invocacionProcedimiento';
  readonly nombre: string;
  readonly argumentos: readonly Expresion[];  // [] en el mundo 2
}
```

### 2. Lexer — `src/lenguaje/lexer.ts` (sin cambios)

`PARA` y `FIN` están en `VOCABULARIO`, así que `leerPalabra` los marca como `comando`. El nombre que
sigue a `PARA` (p. ej. `CUADRADO`) no está en el vocabulario, así que `buscarComando` falla y el
lexer lo emite como `identificador` — exactamente lo que el parser necesita. No hay cambio de lexer.

### 3. Vocabulario — `src/lenguaje/vocabulario.ts` (reconciliar `PARA`)

Las nueve entradas del mundo 2 ya están. Un punto a **reconciliar**: la entrada de `PARA` declara
hoy `aridad: 'variable'` y el ejemplo `PARA cuadrado :lado`. En esta spec `PARA` no toma parámetros.
Se conserva la entrada del vocabulario (para el panel, el bloqueo por mundo y la detección de
inglés), pero el parser del mundo 2 produce `DefinicionProcedimiento` con `parametros: []` e ignora
cualquier `:param` (los parámetros reales llegan en la spec 05). Se ajusta el ejemplo a
`PARA cuadrado` para no sugerir una capacidad que el mundo 2 no tiene.

### 4. Parser — `src/lenguaje/parser.ts` (AMPLIAR)

Se amplía `Estado` con el conjunto de nombres de procedimiento y una pila de `PARA` abiertos:

```typescript
interface Estado {
  readonly tokens: readonly Token[];
  indice: number;
  readonly mundo: Mundo;
  readonly errores: ErrorKiroLogo[];
  pilaCorchetes: number[];
  readonly procedimientos: ReadonlySet<string>;  // NUEVO: nombres de PARA válidos (1ª pasada)
}
```

Función nueva de primera pasada:

```typescript
/**
 * Primera pasada: recorre los tokens recogiendo los nombres de los PARA bien
 * formados. Descarta los rechazados (nombre que pisa el lenguaje, redefinición,
 * PARA sin FIN) para que la segunda pasada no los trate como invocables.
 */
function recolectarProcedimientos(tokens: readonly Token[]): ReadonlySet<string>;
```

`analizar` ejecuta la primera pasada, guarda el `Set` en `estado.procedimientos` y luego corre el
bucle existente de `analizarInstruccion` + `sincronizar`, respetando `MAXIMO_ERRORES` y el orden por
línea/columna.

En `analizarInstruccion` cambian dos ramas del `switch (token.tipo)`:

```typescript
case 'identificador':
  // NUEVO: si el nombre normalizado es un procedimiento definido, es una invocación.
  if (estado.procedimientos.has(token.valor as string)) {
    estado.indice += 1;
    return {
      tipo: 'invocacionProcedimiento',
      nombre: token.valor as string,
      argumentos: [],
      linea: token.linea,
      columna: token.columna,
    };
  }
  // Si no, el catálogo elige el mensaje (igual que hoy).
  reportar(estado, resolverPalabraNoEjecutable(token.textoOriginal, estado.mundo, posicion(token)));
  estado.indice += 1;
  return null;

case 'comando':
  // PARA abre una definición; FIN suelto es error; el resto como hoy.
  return analizarComando(estado, token);
```

Funciones nuevas para `PARA … FIN`:

```typescript
/**
 * Analiza `PARA NOMBRE <instrucciones> FIN`. El NOMBRE es un token 'identificador'.
 * Produce DefinicionProcedimiento con parametros: []. Reporta:
 *  - paraNombreQueEsLenguaje si el nombre normalizado coincide con un comando/abreviatura;
 *  - procedimientoRedefinido si el nombre ya se definió antes (conserva la primera);
 *  - paraSinFin si se llega al fin del programa sin FIN.
 */
function analizarDefinicion(estado: Estado, tokenPara: Token): Instruccion | null;
```

Al encontrar `FIN` donde se espera una instrucción (sin `PARA` abierto), `analizarComando` reporta
`finSinPara` con la línea del `FIN`, lo descarta y continúa. La recuperación usa la `sincronizar`
existente.

### 5. Intérprete — `src/lenguaje/interprete.ts` (AMPLIAR `ejecutarComando` y `Operacion`)

El flujo de `pila`/`Marco`, la resolución de `invocacionProcedimiento` por `buscarDefinicion` y las
tres guardas **ya existen y no cambian**. Se amplía el estado de la tortuga que lleva el intérprete
para arrastrar las decoraciones vigentes:

```typescript
// Estado decorativo que el intérprete mantiene entre operaciones (no vive en EstadoTortuga,
// porque la tortuga pura no conoce color ni grosor). Arranca en los valores por omisión.
interface EstadoDecorativo {
  color: Color;        // negro por omisión
  grosor: number;      // 1 por omisión
}
```

Nuevos tipos de operación en la unión `Operacion`, todos decorativos (el renderizador los consume;
`extraerSegmentos` los ignora):

```typescript
/** Cambio de color del trazo. Decorativa: no produce segmento, no la lee el validador. */
export interface OperacionColor extends OperacionBase {
  readonly tipo: 'color';
  readonly color: Color;             // nombre resuelto o terna RGB
}

/** Cambio de grosor del trazo. Decorativa. */
export interface OperacionGrosor extends OperacionBase {
  readonly tipo: 'grosor';
  readonly grosor: number;           // entero 1..50
}

/** Relleno del área cerrada donde está la tortuga. Decorativa. */
export interface OperacionRelleno extends OperacionBase {
  readonly tipo: 'relleno';
  readonly color: Color;
}

export type Operacion =
  | OperacionMover | OperacionGirar | OperacionLapiz | OperacionVisibilidad
  | OperacionLimpiar | OperacionReubicar
  | OperacionColor | OperacionGrosor | OperacionRelleno;   // NUEVO
```

`ejecutarComando` se amplía con los casos del mundo 2. Lápiz y visibilidad usan las ayudas puras de
la tortuga; color, grosor y relleno emiten operaciones decorativas:

```typescript
case 'SUBELAPIZ': {
  const estadoDespues = conLapiz(estadoAntes, false);
  return { ...base, tipo: 'lapiz', lapizAbajo: false, estadoDespues };
}
case 'BAJALAPIZ': {
  const estadoDespues = conLapiz(estadoAntes, true);
  return { ...base, tipo: 'lapiz', lapizAbajo: true, estadoDespues };
}
case 'OCULTATORTUGA': {
  const estadoDespues = conVisibilidad(estadoAntes, false);
  return { ...base, tipo: 'visibilidad', visible: false, estadoDespues };
}
case 'MUESTRATORTUGA': {
  const estadoDespues = conVisibilidad(estadoAntes, true);
  return { ...base, tipo: 'visibilidad', visible: true, estadoDespues };
}
case 'PONCOLOR':   // argumento palabra o terna RGB (ver §7)
case 'PONGROSOR':  // argumento entero 1..50
case 'RELLENA':    // sin argumento geométrico; opcional color
  // Emiten OperacionColor / OperacionGrosor / OperacionRelleno. No tocan posición
  // ni rumbo: estadoDespues === estadoAntes salvo el canal decorativo.
```

Como estos comandos **no mueven** la tortuga, `estadoDespues` conserva posición y rumbo; y como no
emiten `mover`, no hay trazo. La idempotencia de R3.7 (SUBELAPIZ con el lápiz ya arriba) sale de que
`conLapiz` devuelve un estado equivalente sin error; igual para OT/MT ya oculta/visible (R5.4, R5.5).

**Argumento no numérico.** `argumento(instruccion)` hoy extrae solo un `numeroLiteral`. Para
`PONCOLOR` el argumento es una palabra (`naranja`, `"naranja`) o una lista RGB (`[255 0 0]`); el
parser lo representa y el intérprete lo resuelve contra el `Catalogo_Colores` (§7). Un color inválido
detiene la instrucción, conserva el color vigente y reporta `colorInvalido` (R4.3, R6.7). Un grosor
fuera de 1..50 conserva el grosor vigente y reporta `grosorInvalido` (R4.5).

### 6. Segmentos y validador — `src/motor/segmentos.ts`, `src/motor/validador.ts` (sin cambios)

`extraerSegmentos` ya hace `switch (operacion.tipo)` y solo trata `mover` (con `lapizAbajo`) y
`limpiar`; cualquier `tipo` desconocido cae en ramas que no aportan segmento. Las tres operaciones
decorativas nuevas no necesitan una rama: no producen segmentos. El validador compara máscaras de
segmentos, así que R4.8 se cumple sin tocar ninguno de los dos módulos. Se deja constancia explícita
en esta sección de que **el validador no se modifica**.

### 7. Catálogo de colores — `src/lenguaje/colores.ts` (NUEVO)

```typescript
/** Un color es un nombre del catálogo (ya resuelto a RGB) o una terna directa. */
export interface Color {
  readonly r: number;  // 0..255
  readonly g: number;
  readonly b: number;
  readonly nombre: string | null;  // el nombre en español si vino por nombre; null si fue RGB
}

/** Los once nombres válidos del mundo 2, en el orden del mensaje de error. */
export const NOMBRES_COLOR: readonly string[] =
  ['rojo', 'azul', 'verde', 'amarillo', 'naranja', 'morado', 'rosa', 'café', 'negro', 'blanco', 'gris'];

export type ResultadoColor =
  | { readonly ok: true; readonly color: Color }
  | { readonly ok: false };

/** Resuelve una palabra de color (normalizada) a un Color, o falla. */
export function resolverColorPorNombre(palabra: string): ResultadoColor;

/** Resuelve una terna [r g b] de enteros 0..255 a un Color, o falla. */
export function resolverColorRGB(r: number, g: number, b: number): ResultadoColor;
```

`café` se compara tras normalizar acentos con `normalizarPalabra` del vocabulario, de modo que
`cafe`, `CAFÉ` y `Café` equivalen. El color por omisión es `negro`.

### 8. Errores — `src/lenguaje/errores.ts` (AMPLIAR el catálogo)

Se agregan `IdError` nuevos con sus parámetros y mensajes (textos exactos en la tabla de Error
Handling). `resolverPalabraNoEjecutable` no cambia: la invocación de procedimiento válida ya no pasa
por ahí (la resuelve el parser por el `Set`); y una palabra que ni es comando ni procedimiento sigue
cayendo en los cinco casos existentes, que ahora incluyen de forma natural la sugerencia hacia un
procedimiento definido si está dentro del umbral (R6.3) — para eso, `resolverPalabraNoEjecutable`
recibe también los nombres de procedimiento como candidatos de sugerencia.

### 9. Panel de comandos — `src/ui/panel-comandos.ts` (AMPLIAR)

Hoy `crearPanelComandos` construye botones desde `comandosDelMundo(mundo)`. Se amplía para mostrar,
**después** de los comandos del lenguaje, los procedimientos que el jugador definió en el texto
actual, en orden de aparición, con el nombre tal como se escribió y sin abreviatura (R7.1, R7.2).

```typescript
export interface PanelComandos {
  // … lo existente (raiz, botones, ayuda, entradas, activar, fijarMundo) …
  /**
   * Fija la lista de procedimientos del jugador (nombres en orden de definición,
   * ya filtrados: solo los registrados en la Tabla_Procedimientos). Reconstruye
   * la sección de procedimientos sin tocar los botones de comando del lenguaje.
   */
  fijarProcedimientos(nombres: readonly string[]): void;   // NUEVO
}
```

El editor, cada vez que el texto cambia, parsea, obtiene los nombres de procedimiento válidos y llama
`fijarProcedimientos` (R7.3, R7.4). Las definiciones incompletas o rechazadas (p. ej. `procedimiento
redefinido`) no aparecen en esa lista, así que el panel las omite sin alterar las demás (R7.5). La
reconstrucción respeta el patrón de roving tabindex ya presente.

### 10. Niveles — `src/niveles/mundo-2-composicion.ts` (NUEVO)

Mismo molde que `mundo-1-figuras.ts`: `parsearReferencia(texto)` con `{ mundo: 2 }`, constantes de
semilla fija para los autorados, y el array `MUNDO_2`.

```typescript
export const REFERENCIA_2_1: Programa =
  parsearReferencia('REPITE 4 [AV 100 GD 90] AV 100 GD 30 REPITE 3 [AV 100 GD 120]');  // casa (R8.1)
export const REFERENCIA_2_4: Programa =
  parsearReferencia('REPITE 4 [AV 50 GI 90 AV 50 GD 90 AV 50 GI 90]');                  // cruz (R8.2)

export const NIVEL_2_1: Nivel = { id: '2.1', mundo: 2, titulo: 'La casa', concepto: 'descomposicion',
  origen: { tipo: 'autorado', referencia: REFERENCIA_2_1, semilla: 201 },
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
  abstraccion: [], pistas: [ /* conceptual, matemática, esqueleto */ ] };

export const NIVEL_2_6: Nivel = { id: '2.6', mundo: 2, titulo: 'La cuadrícula', concepto: 'descomposicion',
  origen: { tipo: 'generado', idGenerador: 'cuadricula-m2', parametros: {} },
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
  abstraccion: [{ clave: 'defineProcedimiento' }],   // R10.1
  pistas: [ /* … */ ] };
// 2.2 (estrella), 2.3 (escalera) y 2.5 (dos polígonos) análogos, origen generado.
```

Los niveles generados declaran `idGenerador` (`estrella-m2`, `escalera-m2`, `dos-poligonos-m2`,
`cuadricula-m2`) y `parametros: {}`; el presupuesto lo calcula el Conteo sobre la referencia que
devuelve el generador (R9.7). La normalización del mundo 2 es traslación libre, rotación libre,
escala exacta (R8.4).

### 11. Generadores — `src/juego/generadores-mundo-2.ts` (NUEVO)

Mismo patrón que `generadores-mundo-1.ts`: `PERMITIDOS_MUNDO_2 = comandosDelMundo(2)`, `parsear` con
`{ mundo: 2 }`, `encuadraYNoEsDegenerada` (ejecuta, exige caja no degenerada ancho/alto ≥ 200 y
dentro de [−400, 400]), reintento con `semilla + intento` hasta `MAX_INTENTOS`, y un fallback
determinista.

```typescript
export function generarEstrellaM2(semilla: number): ResultadoGenerador;       // 2.2
export function generarEscaleraM2(semilla: number): ResultadoGenerador;       // 2.3
export function generarDosPoligonosM2(semilla: number): ResultadoGenerador;   // 2.5
export function generarCuadriculaM2(semilla: number): ResultadoGenerador;     // 2.6

export const GENERADORES_M2: Readonly<Record<string, (semilla: number) => ResultadoGenerador>> = {
  'estrella-m2': generarEstrellaM2,
  'escalera-m2': generarEscaleraM2,
  'dos-poligonos-m2': generarDosPoligonosM2,
  'cuadricula-m2': generarCuadriculaM2,
};
```

Notas de cada generador:

- **2.2 estrella** — `p ∈ {5, 7, 9}` (`prng.elegir`), `L` múltiplo de 20 entre 100 y 180
  (`prng.multiplo(100, 180, 20)`), ángulo `360*2/p`. Para `p ∈ {5, 7, 9}` el paso del polígono
  estrellado es `720/p = {144, 102.857…, 80}`. Para que el ángulo quede en un entero exacto el
  generador construye el texto con el ángulo redondeado solo cuando `720/p` es entero (5 y 9 dan 144
  y 80); para `p = 7` se usa el entero más cercano y, si la figura no encuadra o degenera, el lazo de
  reintento la descarta — igual que el mundo 1 descarta `n = 7` donde `360/n` no es entero. Forma
  `REPITE p [AV L GD angulo]` (R9.1).
- **2.3 escalera** — 3 a 6 peldaños (`prng.entero(3, 6)`), huella = altura, múltiplo de 20 entre 20 y
  60 (`prng.multiplo(20, 60, 20)`) (R9.2).
- **2.5 dos polígonos** — cada uno de 3 a 6 lados, separados por un múltiplo de 20 entre 20 y 100; el
  texto usa `SUBELAPIZ`/`BAJALAPIZ` para moverse entre los dos sin trazo (R9.3, R9.4).
- **2.6 cuadrícula** — paneles 2×2, 3×2 o 3×3; la referencia **define** un procedimiento con `PARA` y
  lo invoca una vez por panel (R9.5, R9.6). Su referencia obtiene, además de las tres estrellas, la de
  abstracción `defineProcedimiento` por contener un nodo de definición (R10.2).

### 12. Catálogo — `src/niveles/catalogo.ts` (AMPLIAR)

```typescript
import { MUNDO_2 } from './mundo-2-composicion.js';
export const CATALOGO: readonly Nivel[] = [...MUNDO_0, ...MUNDO_1, ...MUNDO_2];
```

El registro de generadores (`registro.ts` o `generadores-mundo-1.ts`'s `GENERADORES`, según cómo
`reto.ts` resuelva) incorpora las cuatro entradas de `GENERADORES_M2`.

### 13. Insignia Descomposición — `src/juego/insignias.ts` (AMPLIAR)

Se añade `'descomposicion'` a `IdInsignia` y al mapa `MUNDO_DE_INSIGNIA` (`descomposicion: 2`), y una
`insigniaDescomposicionOtorgada(progreso)` que delega en el helper existente
`mundoCompletoConTresEstrellas(2, progreso)`. `insigniasDelMundo` incluye la rama del mundo 2. El
otorgamiento sigue derivándose solo del progreso y el catálogo, sin estado propio; por eso se otorga
exactamente una vez y se mantiene (R11.1, R11.2, R11.5). Mostrarla en el perfil y en el mapa (R11.3,
R11.4) usa la misma vía que *Secuencia* e *Iteración*.

## Data Models

### Uso del AST (sin cambios de forma)

- `DefinicionProcedimiento` con `parametros: []` y `cuerpo: Instruccion[]`.
- `InvocacionProcedimiento` con `argumentos: []`.

### Operaciones decorativas (nuevas en la unión `Operacion`)

```typescript
interface OperacionColor   extends OperacionBase { tipo: 'color';   color: Color }
interface OperacionGrosor  extends OperacionBase { tipo: 'grosor';  grosor: number }
interface OperacionRelleno extends OperacionBase { tipo: 'relleno'; color: Color }
```

Ninguna produce segmento; `extraerSegmentos` las ignora por construcción.

### Catálogo de colores

```typescript
interface Color { r: number; g: number; b: number; nombre: string | null }
const NOMBRES_COLOR: readonly string[] =
  ['rojo','azul','verde','amarillo','naranja','morado','rosa','café','negro','blanco','gris'];
```

### Generadores y su registro

```typescript
type FnGeneradorM2 = (semilla: number) => ResultadoGenerador;  // mismo ResultadoGenerador del mundo 1
const GENERADORES_M2: Readonly<Record<string, FnGeneradorM2>> = {
  'estrella-m2': generarEstrellaM2,
  'escalera-m2': generarEscaleraM2,
  'dos-poligonos-m2': generarDosPoligonosM2,
  'cuadricula-m2': generarCuadriculaM2,
};
```

### Forma de los seis `Nivel` del mundo 2

| id | título | origen | abstracción |
|---|---|---|---|
| 2.1 | La casa | autorado, `REFERENCIA_2_1` | `[]` |
| 2.2 | La estrella | generado `estrella-m2` | `[]` |
| 2.3 | La escalera | generado `escalera-m2` | `[]` |
| 2.4 | La cruz | autorado, `REFERENCIA_2_4` | `[]` |
| 2.5 | Dos polígonos | generado `dos-poligonos-m2` | `[]` |
| 2.6 | La cuadrícula | generado `cuadricula-m2` | `[{ clave: 'defineProcedimiento' }]` |

Todos con `mundo: 2`, `concepto: 'descomposicion'`, normalización traslación/rotación libres y escala
exacta, y `pistas: [conceptual, matemática, esqueleto]`.

## Error Handling

Todos los mensajes viven en `src/lenguaje/errores.ts`. El parser y el intérprete nunca arman cadenas
de texto: siempre llaman a `crearError(id, parametros, posicion?)`.

| Situación | Dónde se detecta | `IdError` | Mensaje |
|---|---|---|---|
| `FIN` sin `PARA` abierto | Parser, en `analizarComando` al ver `FIN` donde se espera instrucción | `finSinPara` (NUEVO) | `Encontré FIN en la línea N pero no hay ningún PARA abierto.` |
| `PARA NOMBRE` que llega al fin del programa sin `FIN` | Parser, en `analizarDefinicion` al agotar tokens | `paraSinFin` (NUEVO) | `El comando NOMBRE que empezaste en la línea N nunca termina con FIN.` |
| Dos procedimientos con el mismo nombre | Parser (1ª pasada y `analizarDefinicion`); conserva la primera | `procedimientoRedefinido` (NUEVO) | `Ya le enseñaste a Kiro qué es NOMBRE más arriba. No puedo aprenderlo dos veces; edita la primera definición.` (nombra NOMBRE y la línea de la segunda, R6.5) |
| `PARA` con nombre que pisa un comando/abreviatura del lenguaje | Parser, en `analizarDefinicion` (compara normalizado contra `buscarComando`) | `paraNombreQueEsLenguaje` (NUEVO) | `NOMBRE es una palabra de KiroLogo y no se puede volver a definir.` (R6.6) |
| Invocar palabra desconocida con candidato cercano | Parser, vía `resolverPalabraNoEjecutable` (candidatos incluyen procedimientos definidos) | `palabraDesconocidaConSugerencia` (EXISTE) | `No sé cómo hacer X. ¿Querías decir Y?` (R6.3) |
| Invocar palabra desconocida sin candidato | Parser, vía `resolverPalabraNoEjecutable` | `palabraDesconocidaSinSugerencia` (EXISTE) | `No sé cómo hacer X.` (R6.4) |
| Invocar procedimiento inexistente en ejecución | Intérprete, cuando `buscarDefinicion` devuelve null | `comandoNoPermitido` (EXISTE) | `No puedo ejecutar NOMBRE en la línea L: todavía no está disponible.` (R1.6) |
| `PONCOLOR` con color inválido | Intérprete (resolución de color contra `Catalogo_Colores`) | `colorInvalido` (NUEVO) | `No conozco el color X. Puedes usar: rojo, azul, verde, amarillo, naranja, morado, rosa, café, negro, blanco o gris.` (R6.7, R4.3) |
| `PONGROSOR` fuera de 1..50 | Intérprete | `grosorInvalido` (NUEVO) | `El grosor debe ser un número entero entre 1 y 50.` (R4.5) |
| Comando del mundo 2 escrito en mundo 0 o 1 | Parser, rama de `comando` bloqueado por mundo | `comandoBloqueado` (EXISTE) | `NOMBRE todavía no está disponible. Se desbloquea en el mundo 2.` (R12.1, R12.2) |

`comandoBloqueado` ya cubre tanto el nombre largo como la abreviatura, porque el parser bloquea por
la entrada del vocabulario resuelta (R12.2). Los `IdError` nuevos a declarar son: `finSinPara`,
`paraSinFin`, `procedimientoRedefinido`, `paraNombreQueEsLenguaje`, `colorInvalido`, `grosorInvalido`.

## Testing Strategy

### Tests unitarios por módulo

- **`parser.test.ts`**
  - `PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN` produce un `DefinicionProcedimiento` con
    `nombre: 'CUADRADO'`, `parametros: []` y el cuerpo esperado (R1.2).
  - Invocación **adelantada**: `CUADRADO PARA CUADRADO … FIN` reconoce `CUADRADO` como
    `InvocacionProcedimiento` gracias a la primera pasada (R1.5).
  - Un `identificador` que no es procedimiento ni comando sigue cayendo en
    `resolverPalabraNoEjecutable`, con sugerencia hacia un procedimiento cercano cuando aplica (R6.3).
  - Los cuatro errores nuevos con su línea: `finSinPara`, `paraSinFin` (nombra el procedimiento y la
    línea del `PARA`), `procedimientoRedefinido` (conserva la primera definición), y
    `paraNombreQueEsLenguaje` (p. ej. `PARA AVANZA`). Se respeta `MAXIMO_ERRORES` y el orden.
- **`interprete.test.ts`**
  - `PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN CUADRADO` emite exactamente las mismas operaciones, en
    el mismo orden, que `REPITE 4 [AV 100 GD 90]` (R1.1).
  - Procedimiento con cuerpo vacío → cero operaciones, sin error (R1.8).
  - `SUBELAPIZ` seguido de `AVANZA 100` no produce **ningún** segmento (vía `extraerSegmentos`);
    `BAJALAPIZ` lo reanuda (R3.2, R3.4). `SUBELAPIZ` con el lápiz ya arriba no cambia estado ni da
    error (R3.7).
  - `PONCOLOR`, `PONGROSOR` y `RELLENA` no producen segmentos y **no** cambian el veredicto del
    validador: dos programas con los mismos trazos y distinto color/grosor/relleno obtienen el mismo
    IoU y el mismo veredicto (R4.8).
  - `OCULTATORTUGA`/`MUESTRATORTUGA` emiten `OperacionVisibilidad` y son idempotentes (R5.4, R5.5).
  - Color inválido conserva el color vigente y reporta `colorInvalido` (R4.3); grosor fuera de rango
    conserva el grosor y reporta `grosorInvalido` (R4.5).
- **`conteo.test.ts`** — `PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN CUADRADO CUADRADO CUADRADO`
  devuelve **6**; el programa equivalente que copia `REPITE 4 [AV 100 GD 90]` tres veces sin definir
  procedimiento devuelve **9** (R2.6, R2.7; la regla no multiplica el cuerpo del REPITE por sus
  iteraciones). Property: definir e invocar `m` veces nunca cuenta más
  que copiar el cuerpo `m` veces (R2.5).
- **`abstraccion.test.ts`** — un AST con un `definicionProcedimiento` cumple `defineProcedimiento`;
  uno que repite el panel sin definir no lo cumple (R10.2, R10.3, R10.6).
- **`colores.test.ts`** — los once nombres (con y sin acento en `café`) resuelven; una terna
  `[255 0 0]` resuelve; un nombre fuera del catálogo y una terna fuera de 0..255 fallan.
- **`panel-comandos.test.ts`** — `fijarProcedimientos` añade los procedimientos tras los comandos del
  mundo, con el nombre sin abreviatura y en orden; cambiar la lista refleja altas, bajas y renombres;
  una definición rechazada no aparece (R7.1–R7.5). En mundo 0/1 el panel no muestra comandos de mundo
  2 (R12.4).

### Tests de generadores (property-based sobre ≥ 200 semillas)

En `src/juego/generadores-mundo-2.test.ts`, uno por generador (`estrella-m2`, `escalera-m2`,
`dos-poligonos-m2`, `cuadricula-m2`), siguiendo el estilo del mundo 1:

```typescript
for (let s = 0; s < 200; s++) {
  const ref = generarEstrellaM2(s);
  expect(encuadraYNoEsDegenerada(ref.programa)).toBe(true);     // encuadrada y no degenerada (R9.9, R9.10)
  expect(apruebaTresEstrellas(ref, '2.2')).toBe(true);          // precisión + economía + abstracción (R9.11)
}
```

Para `cuadricula-m2` se añade que la referencia contiene un nodo `definicionProcedimiento` y lo
invoca una vez por panel (R9.6), y que obtiene la estrella `defineProcedimiento` (R10.2). Para
`dos-poligonos-m2` se verifica que la referencia usa `SUBELAPIZ`/`BAJALAPIZ` y que no hay trazo entre
los dos polígonos (R9.4). En los cuatro, el presupuesto del nivel sale del Conteo aplicado a la
referencia, nunca de un número escrito a mano (R9.7, R9.8).

### Tests de niveles autorados

En `src/niveles/mundo-2-composicion.test.ts`: 2.1 y 2.4 parsean sin error; su `presupuestoEstrella`
coincide con `contarInstrucciones` sobre su referencia (R8.3); una referencia mal formada se trataría
como error de datos (R8.5). La insignia *Descomposición* se otorga solo con las tres estrellas en los
seis niveles y se mantiene una sola vez (R11.1, R11.2, R11.5), reusando los tests de `insignias.test.ts`.
