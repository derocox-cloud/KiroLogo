# Design Document

**KiroLogo · Spec 04 · Mundo 3 · Rosetones**

## Overview

Esta spec enseña **iteración anidada** y **simetría rotacional**: un `REPITE` dentro de otro
`REPITE`. No agrega ningún comando al lenguaje —ese es el mensaje del mundo— y la mayor parte del
andamiaje que necesita **ya existe** en el código y solo hay que activarlo o extenderlo.

Lo que ya está resuelto y esta spec **consume sin reinventar**:

- **El límite duro** ya se calcula en `src/juego/reto.ts`. `resolverReto` fija
  `presupuestoEstrella = contarInstrucciones(referencia)`, `limiteDuro = presupuestoEstrella + margen`
  (con `margen = nivel.margenLimiteDuro ?? MARGEN_LIMITE_DURO_POR_OMISION`, donde la constante vale
  `3`) y `limiteDuroActivo = nivel.mundo >= PRIMER_MUNDO_CON_LIMITE_DURO` (la constante vale `3`).
  Los tres campos ya viajan en el `Reto`. Lo que **falta** es *usarlos*: hoy nadie bloquea la
  ejecución cuando el conteo del jugador excede `limiteDuro`.
- **La normalización fija** ya la soporta entero `src/motor/validador.ts`. `validar(..., normalizacion)`
  con `traslacion: 'fija'` no traslada ninguna figura y con `rotacion: 'fija'` compara solo el ángulo 0
  (`comparar(objetivoBase, mascaraJugador)`), aplicando la dilatación de disco 8 existente. La
  tolerancia de dilatación **no se toca**. Lo que falta es que los niveles del mundo 3 **declaren**
  esa normalización en sus datos.
- **La estrella de abstracción `usaRepiteAnidado`** ya está implementada en `src/juego/abstraccion.ts`
  (`hayRepeticionAnidada`: un nodo `repeticion` con otra `repeticion` entre sus descendientes, sobre el
  AST, nunca sobre el texto). `src/juego/estrellas.ts` ya la evalúa vía `analizar(astJugador, exigencias)`.
  Lo que falta es que los niveles declaren `abstraccion: [{ clave: 'usaRepiteAnidado' }]`.
- **El contador del editor** ya vive en `src/ui/editor.ts`, parsea y cuenta con `contarInstrucciones`,
  y ya marca el exceso **de presupuesto**. Lo que falta es anticipar el **bloqueo por límite duro**.
- **El PRNG determinista** (`src/azar/prng.ts`, `crearPrng(semilla)`) y las guardas de ejecución del
  intérprete ya existen. El desafío infinito deriva semillas con ese PRNG, nunca con `Math.random`.
- **Las insignias de concepto** ya se derivan solo del progreso en `src/juego/insignias.ts`
  (`mundoCompletoConTresEstrellas`). *Simetría* es una entrada más del mismo patrón.

Lo que **sí hay que construir o ampliar** en esta spec:

1. **Bloqueo por límite duro** en el camino de ejecución (`src/main.ts`, `ejecutarPrograma`): antes de
   animar, si `limiteDuroActivo` y el conteo del jugador supera `limiteDuro`, Kiro detiene y explica,
   sin emitir una sola operación de tortuga.
2. **Aviso anticipado en el editor** (`src/ui/editor.ts`): el contador señala que el programa quedará
   bloqueado cuando su conteo supere el límite duro del reto en curso estando activo.
3. **Un mensaje de bloqueo centralizado** en `src/lenguaje/errores.ts` (`limiteDuroExcedido`), que
   nombra `N`, `M` y `N − M` y empuja a anidar `REPITE`, sin revelar la figura ni el presupuesto.
4. **Los cuatro niveles del mundo 3** como datos en `src/niveles/mundo-3-rosetones.ts` (3.1 y 3.4
   autorados; 3.2 y 3.3 generados), con `normalizacion` fija y `abstraccion: [{ clave: 'usaRepiteAnidado' }]`.
5. **Dos generadores del mundo 3** en `src/niveles/generadores/` (contrato `Generador` de
   `src/niveles/tipos.ts`), que producen AST, encuadran y no degeneran, con presupuesto calculado.
6. **El desafío infinito** como módulo nuevo `src/juego/desafio-infinito.ts`, que deriva una secuencia
   determinista de retos de los niveles generados de un mundo, rota entre ellos y no retrocede; con su
   disponibilidad derivada del desbloqueo.
7. **La insignia de concepto *Simetría*** y **las cuatro transversales** (*Depurador*, *Minimalista*,
   *Sin pistas*, *Buen ojo*), extendiendo `src/juego/insignias.ts`, derivadas del progreso.

**El trabajo es activar y extender, no rediseñar.** No se toca el lexer, el parser, la forma del AST,
la pila del intérprete, la regla de conteo, el análisis de abstracción ni el algoritmo del validador
(R10.1, R10.2). Los mundos 0 a 2 quedan idénticos (R10.3).

## Architecture

### Dónde entra el límite duro en el flujo de un intento

El límite duro es una guarda **previa a la ejecución**, no una penalización posterior. Se inserta en
`ejecutarPrograma` de `src/main.ts`, entre el análisis del texto y la carga del animador:

```
texto del jugador
      │
      ▼
  analizarTextoJugador  ── errores de análisis ──► globo (texto exacto, sin ejecutar)   [ya existe]
      │ programa OK
      ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ NUEVO: guarda de límite duro                                  │
  │   si reto.limiteDuroActivo                                    │
  │      y contarInstrucciones(programa) > reto.limiteDuro:       │
  │        globo.mostrarMensajes([ limiteDuroExcedido(N, M) ])    │
  │        NO marca ejecución, NO cede la demo, NO reinicia capa, │
  │        NO ejecuta el intérprete, NO carga el animador         │
  │        return  ◄── no se emite ninguna operación de tortuga   │
  └─────────────────────────────────────────────────────────────┘
      │ dentro del límite (o límite inactivo)
      ▼
  marcarEjecucionEnCurso · reiniciar capa jugador · ejecutar · animar   [ya existe]
      │
      ▼
  concluirIntento ── validar · calificar · guardar · comentar           [ya existe]
```

Clave de R1.3: la guarda corta **antes** de `animador.reiniciar`/`cargar`/`reproducir`, así que la
estela del jugador no se borra ni se dibuja nada nuevo. El intento que ya estaba en pantalla queda
intacto; Kiro solo habla.

El conteo que usa la guarda es el **mismo** `contarInstrucciones(programa)` que alimenta el contador
del editor y la estrella de economía: `src/lenguaje/conteo.ts` es la única fuente del presupuesto, de
modo que el número que el jugador ve mientras escribe es exactamente el que bloquea (R2 del steering
`estructura`).

### Mundos 0 a 2: sin cambio de comportamiento

Como `limiteDuroActivo` es `nivel.mundo >= 3`, la guarda nunca dispara en los mundos 0 a 2: un
programa que excede el presupuesto se ejecuta, se dibuja y simplemente no gana la estrella de economía
(R1.5), que es lo que `calificar` ya hace hoy. No hay ninguna rama nueva para esos mundos (R10.3).

### El contador del editor anticipa el bloqueo

```
tecleo del jugador
      │ (rebote 120 ms)
      ▼
  analizarTexto (lexer + parser + conteo)                    [ya existe]
      │ conteo
      ▼
  actualizarContador
      ├─ conteo > presupuesto            ► «Te pasaste del presupuesto»   [ya existe]
      └─ NUEVO: limiteDuroActivo
            y conteo > limiteDuro        ► «Este programa no se podrá ejecutar: pasa del límite»
```

El editor recibe el límite duro y si está activo como datos del reto en curso (igual que ya recibe
`presupuestoEstrella`), y añade el aviso de bloqueo por texto —no solo color— cuando el conteo lo
supera (R2.5). Mientras el conteo sea ≤ límite, no se señala bloqueo (R2.6).

### Capa de niveles del mundo 3

Igual molde que el mundo 2: un archivo `src/niveles/mundo-3-rosetones.ts` exporta `MUNDO_3`, con dos
niveles autorados (`referencia: Programa`) y dos generados (`idGenerador` + `parametros`).
`src/niveles/catalogo.ts` pasa a `CATALOGO = [...MUNDO_0, ...MUNDO_1, ...MUNDO_2, ...MUNDO_3]`.

La diferencia de datos frente a los mundos 0–2 es la **normalización**: los cuatro niveles declaran
`{ traslacion: 'fija', rotacion: 'fija', escala: 'exacta' }` (R3.5). El resto del flujo
(`resolverReto`, demostración, validación) no cambia: el mismo intérprete ejecuta la referencia y de
ahí salen demostración y segmentos objetivo.

### Generadores del mundo 3: contrato `Generador`

Los generados del mundo 3 usan el contrato **`Generador`** de `src/niveles/tipos.ts`
(`(entrada: EntradaGenerador) => ResultadoGeneracion`), el mismo que los del mundo 0, no el
`FnGenerador` por semilla de los mundos 1 y 2. Esta elección es deliberada: el contrato `Generador`
lleva el lazo de reintento con `intentosMaximos` y devuelve `semillaEfectiva` y un error del catálogo
al agotar intentos, que es justo lo que piden R5.6 y R5.7 (descartar la semilla degenerada o no
encuadrada y pasar a la siguiente). `reto.ts` ya resuelve ese contrato primero, vía
`buscarGenerador(idGenerador)` del registro `src/niveles/generadores/registro.ts`, antes de caer al
registro por semilla. Se agregan dos archivos en `src/niveles/generadores/` (`rosetón.ts` y
`flor.ts`) y sus dos entradas al registro.

```
reto.ts  resolverReto(idNivel, semilla)
   │
   ├─ nivel generado → idGenerador
   │       │
   │       ▼
   │   buscarGenerador(idGenerador)           [registro.ts]
   │       │ Generador | null
   │       ├─ null → registro por semilla (mundos 1/2)   [no aplica al mundo 3]
   │       └─ Generador → generador({ semilla, parametros, intentosMaximos })
   │                         │ ResultadoGeneracion
   │                         ├─ exito:false → propaga error del catálogo
   │                         └─ exito:true  → referencia (AST) + semillaEfectiva
   ▼
  ejecuta la referencia UNA vez → presupuestoEstrella = conteo, limiteDuro, segmentos
```

Un `Generador` solo puede importar de `lenguaje/` y `azar/` (regla de `tipos.ts` y de `estructura`).
Para verificar encuadre necesita ejecutar el AST y medir su caja; como no puede importar de `motor/`,
construye los puntos del recorrido con su propia aritmética de polígono (igual que `anchoPoligono` en
`generadores-mundo-2.ts`, que camina el contorno con seno/coseno sin tocar el motor). La figura se
mide sobre esos puntos: ancho y alto de la caja alineada a los ejes, exigiendo ambos ≥ 200 px
(no degenerada, R5.6) y la caja dentro de `[−400, 400]` en los dos ejes (encuadrada, R5.7).

### Desafío infinito: una secuencia determinista derivada de una raíz

El desafío infinito es **puro y sin estado propio persistido**: una función que, dada la raíz y el
índice del reto en la secuencia, devuelve `(idNivel, semilla)`. No guarda la secuencia; la recalcula.
Así dos corridas con la misma raíz producen exactamente la misma secuencia (R7.4) y basta con guardar
`(mundo, raíz, índiceActual)` para reanudar.

```
Semilla_Raiz (R)              nivelesGeneradosDelMundo(m) = [g0, g1, ...]   (orden del catálogo)
     │
     ▼
  prng raíz = crearPrng(R)
     │
     paso i (0,1,2,...):
        idNivel   = g[ i mod cantidadGenerados ]        ← rota entre los generados (R7.6)
        semilla_i = derivar(R, i)                        ← determinista, vía PRNG del proyecto (R7.3)
```

`derivar(R, i)` produce una semilla del dominio `[0, 2³²−1]` a partir de `R` e `i` usando `crearPrng`;
es determinista y reproducible. El índice solo avanza: la API no ofrece retroceder (R7.5). La
disponibilidad se deriva del desbloqueo (ver §9), no de un flag propio.

## Components and Interfaces

### 1. `src/juego/reto.ts` — sin cambios

Ya calcula y expone `presupuestoEstrella`, `limiteDuro` y `limiteDuroActivo` (R1.1, R1.2). Las
constantes `MARGEN_LIMITE_DURO_POR_OMISION = 3` y `PRIMER_MUNDO_CON_LIMITE_DURO = 3` ya están. No se
toca; solo se **consume** lo que ya produce.

### 2. `src/lenguaje/errores.ts` — AMPLIAR el catálogo

Se agrega un `IdError` nuevo con sus parámetros y su mensaje, única fuente del texto (R2.4):

```typescript
// en IdError:
| 'limiteDuroExcedido'

// en ParametrosPorError:
readonly limiteDuroExcedido: { readonly usadas: number; readonly limite: number };
```

El mensaje (severidad `'jugador'`) nombra `N`, `M` y `N − M` y empuja a anidar `REPITE`, sin nombrar
la figura, la referencia ni `presupuestoEstrella` (R2.1, R2.2, R2.3):

```
Tu programa usa {usadas} instrucciones y el máximo para este reto es {limite}: te sobran
{usadas − limite}. Prueba a poner un REPITE dentro de otro REPITE para repetir un grupo entero
de una sola vez.
```

`crearError('limiteDuroExcedido', { usadas, limite })` valida que `usadas` y `limite` sean enteros y
`usadas > limite` (si no, `solicitudDeErrorInvalida`, igual que el resto del catálogo). La diferencia
`usadas − limite` se calcula al construir el mensaje, no se pasa como parámetro (una sola fuente de
verdad para la cuenta).

### 3. `src/main.ts` — AMPLIAR `ejecutarPrograma` con la guarda de límite duro

Tras obtener `programa` válido y **antes** de ceder la demostración y reiniciar la capa del jugador:

```typescript
// Guarda de límite duro (R1.3): activa desde el mundo 3. Si el conteo del jugador
// supera el límite, Kiro detiene ANTES de dibujar y explica. No se emite ninguna
// operación de tortuga, no se toca la capa del jugador, no se ejecuta el intérprete.
if (reto.limiteDuroActivo) {
  const c = contarInstrucciones(programa);
  if (c.exito && c.instrucciones > reto.limiteDuro) {
    globo.mostrarMensajes([
      crearError('limiteDuroExcedido', { usadas: c.instrucciones, limite: reto.limiteDuro }),
    ]);
    return;
  }
}
```

Queda antes de `ejecutando = true`, de `controles.marcarEjecucionEnCurso()`, de
`demostracion.cederAEjecucion()` y de `animador.reiniciar(...)`, de modo que un programa bloqueado
deja todo el estado del intento como estaba (R1.3). Un conteo `≤ limiteDuro`, o un nivel con
`limiteDuroActivo` falso, pasa de largo y ejecuta como hoy (R1.4, R1.6, R1.7).

### 4. `src/ui/editor.ts` — AMPLIAR el aviso del contador

`DependenciasEditor` recibe el límite duro y si está activo del reto en curso, igual que ya recibe
`presupuestoEstrella`:

```typescript
export interface DependenciasEditor {
  // … lo existente …
  readonly presupuestoEstrella: number;
  readonly limiteDuro: number;          // NUEVO
  readonly limiteDuroActivo: boolean;   // NUEVO
}
```

`presentarReto` pasa a recibir también estos dos valores (o el editor los guarda mutables como ya hace
con `presupuesto`). En `actualizarContador`, además del aviso de presupuesto existente, se añade el de
bloqueo cuando `limiteDuroActivo && estado.conteo > limiteDuro` (R2.5): un `span` con texto en español
(«Este programa no se podrá ejecutar: pasa del límite») y una clase para el estilo, y el nombre
accesible (`aria-label`) incorpora la misma frase. Mientras el conteo sea ≤ límite, no aparece (R2.6).
El aviso de bloqueo es independiente del de presupuesto: en el mundo 3 un conteo entre
`presupuesto + 1` y `limiteDuro` muestra «te pasaste del presupuesto» pero **no** el de bloqueo.

### 5. `src/motor/validador.ts` — sin cambios

`validar` ya trata `traslacion: 'fija'` (sin trasladar) y `rotacion: 'fija'` (solo ángulo 0) y aplica
la dilatación de disco 8 existente (R3.1, R3.2). Una figura correcta pero desplazada o rotada respecto
de la referencia, más allá de la tolerancia de dilatación, cae por IoU insuficiente y no gana la
precisión (R3.3, R3.4) — comportamiento que `comparar` ya produce con la normalización fija. No se
toca la tolerancia ni el algoritmo.

### 6. `src/niveles/mundo-3-rosetones.ts` — NUEVO

Mismo molde que `mundo-2-composicion.ts`: `parsearReferencia(texto)` con `{ mundo: 3 }` para los
autorados, semillas fijas, y el array `MUNDO_3`.

```typescript
// 3.1 — rosetón de 36 cuadrados (R4.1). Presupuesto por Conteo, nunca a mano (R4.2).
export const REFERENCIA_3_1: Programa =
  parsearReferencia('REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]');

// 3.4 — mandala de círculos (R4.3). Completa sin disparar la guarda de 200 000 pasos (R4.4).
export const REFERENCIA_3_4: Programa =
  parsearReferencia('REPITE 8 [GD 45 REPITE 6 [REPITE 90 [AV 2 GD 2] GD 90]]');

const NORMALIZACION_M3: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' };

export const NIVEL_3_1: Nivel = {
  id: '3.1', mundo: 3, titulo: 'Rosetón de cuadrados', concepto: 'simetria',
  origen: { tipo: 'autorado', referencia: REFERENCIA_3_1, semilla: 301 },
  normalizacion: NORMALIZACION_M3,
  abstraccion: [{ clave: 'usaRepiteAnidado' }],              // R4.5, R6.1
  pistas: [ /* conceptual, matemática, esqueleto; advierten posición/rumbo de partida (R3.6) */ ],
};

export const NIVEL_3_2: Nivel = {
  id: '3.2', mundo: 3, titulo: 'Rosetón de polígonos', concepto: 'simetria',
  origen: { tipo: 'generado', idGenerador: 'roseton-m3', parametros: {} },
  normalizacion: NORMALIZACION_M3,
  abstraccion: [{ clave: 'usaRepiteAnidado' }],              // R5.8, R6.1
  pistas: [ /* … advierten posición/rumbo (R3.6) … */ ],
};

export const NIVEL_3_3: Nivel = {
  id: '3.3', mundo: 3, titulo: 'Flor con giro', concepto: 'simetria',
  origen: { tipo: 'generado', idGenerador: 'flor-m3', parametros: {} },
  normalizacion: NORMALIZACION_M3,
  abstraccion: [{ clave: 'usaRepiteAnidado' }],
  pistas: [ /* … */ ],
};

export const NIVEL_3_4: Nivel = {
  id: '3.4', mundo: 3, titulo: 'Mandala', concepto: 'simetria',
  origen: { tipo: 'autorado', referencia: REFERENCIA_3_4, semilla: 304 },
  normalizacion: NORMALIZACION_M3,
  abstraccion: [{ clave: 'usaRepiteAnidado' }],
  pistas: [ /* … */ ],
};

export const MUNDO_3: readonly Nivel[] = [NIVEL_3_1, NIVEL_3_2, NIVEL_3_3, NIVEL_3_4];
```

Ningún nivel escribe un número de presupuesto (R4.2, R4.6, R5.5): lo calcula `resolverReto` por el
Conteo sobre la referencia. `margenLimiteDuro` se omite, así que rige el margen por omisión (3). El
enunciado (las pistas y el título) advierte que la posición y el rumbo de partida importan (R3.6).

### 7. `src/niveles/generadores/rosetón.ts` y `flor.ts` — NUEVOS (contrato `Generador`)

Ambos respetan la firma `Generador` de `tipos.ts` y solo importan de `lenguaje/` (lexer, parser,
conteo, impresor si hace falta) y `azar/` (`crearPrng`). Producen AST (R5 del steering `estructura`):
construyen el texto KiroLogo, lo parsean con `{ mundo: 3 }` y devuelven el `Programa`.

**3.2 — `roseton-m3`.** Rosetón de copias de un polígono regular girado entre copias:

```
REPITE c [ REPITE n [ AV L GD 360/n ] GD 360/c ]
```

- `c ∈ {6, 8, 9, 12, 18, 36}` (copias), vía `prng.elegir` (R5.1).
- `n ∈ {3, 4, 5, 6}` (lados de la figura interna), vía `prng.elegir` (R5.1). `360/n` es entero
  (120, 90, 72, 60): ángulo derivable (R5.4).
- `L` múltiplo de 20 (R5.4), vía `prng.multiplo`, en un rango acotado para encuadrar.
- `360/c` es entero para todos los valores de `c` del conjunto (60, 45, 40, 30, 20, 10): ángulo
  derivable (R5.4).
- Forma: un `REPITE` de copias que contiene el `REPITE` de la figura interna y el giro entre copias
  (R5.2). El AST tiene `REPITE` anidado, así que su referencia gana `usaRepiteAnidado` (R5.8, R5.9).

**3.3 — `flor-m3`.** Flor con un giro previo al avance en cada pétalo (R5.3):

```
REPITE c [ REPITE n [ GD a AV L ] GD 360/c ]
```

- `c` (pétalos) de un conjunto cuyo `360/c` sea entero; `n` (segmentos por pétalo); `a` ángulo
  derivable (`360/k` con `k` de 3 a 12, o múltiplo de 15); `L` múltiplo de 20 (R5.4).
- Forma exacta pedida por R5.3: `REPITE c [REPITE n [GD a AV L] GD 360/c]`. También anidado (R5.8).

**Lazo de reintento (los dos).** Dentro de `entrada.intentosMaximos`, con
`prng = crearPrng(entrada.semilla + intento)`: elegir parámetros, construir y parsear el texto, medir
la caja envolvente sobre el recorrido calculado; si la figura es degenerada (ancho o alto < 200 px,
R5.6) o no encuadra (caja fuera de `[−400, 400]`, R5.7), **descartar** y probar la semilla siguiente.
Al aceptar, devolver `{ exito: true, referencia, semillaEfectiva: entrada.semilla + intento, descartes }`.
Al agotar los intentos, `{ exito: false, error: crearError('generadorSinCandidato', {}), intentos }`.
El presupuesto lo calcula `resolverReto` por el Conteo sobre la `referencia`, nunca el generador
(R5.5).

### 8. `src/niveles/generadores/registro.ts` — AMPLIAR

```typescript
import { generarRoseton } from './rosetón.js';
import { generarFlor } from './flor.js';

const GENERADORES: Readonly<Record<string, Generador>> = {
  camino: generarCamino,
  zigzag: generarZigzag,
  'roseton-m3': generarRoseton,   // NUEVO (3.2)
  'flor-m3': generarFlor,         // NUEVO (3.3)
};
```

### 9. `src/juego/desafio-infinito.ts` — NUEVO

Módulo puro de `juego/`: puede importar de `niveles/` (catálogo), `azar/` (PRNG) y `juego/`
(`desbloqueo`). No persiste estado propio más allá de `(mundo, raíz, índice)`, que la navegación
guarda.

```typescript
import { crearPrng, SEMILLA_MINIMA, SEMILLA_MAXIMA } from '../azar/prng.js';
import { CATALOGO } from '../niveles/catalogo.js';
import { mundoDesbloqueado } from './desbloqueo.js';
import type { Progreso } from './progreso.js';
import type { Mundo } from '../lenguaje/vocabulario.js';

/** Los niveles GENERADOS de un mundo, en el orden del catálogo. */
export function nivelesGeneradosDelMundo(mundo: Mundo): readonly string[] {
  return CATALOGO.filter((n) => n.mundo === mundo && n.origen.tipo === 'generado').map((n) => n.id);
}

/**
 * ¿Está disponible el desafío infinito del mundo? Disponible solo si el mundo está
 * COMPLETO (el siguiente mundo desbloqueado ⇒ todos sus niveles aprobados) y tiene
 * al menos un nivel generado (R7.1, R7.2, R7.8).
 */
export function desafioDisponible(mundo: Mundo, progreso: Progreso): boolean {
  if (nivelesGeneradosDelMundo(mundo).length === 0) return false;   // R7.8
  return mundoDesbloqueado((mundo + 1) as Mundo, progreso);          // mundo completo ⇒ siguiente abierto
}

export interface RetoDesafio {
  readonly idNivel: string;
  readonly semilla: number;
}

/**
 * El reto en el índice `i` de la secuencia del mundo, derivado de la raíz. Rota
 * entre los niveles generados (R7.6) y deriva la semilla con el PRNG del proyecto
 * (R7.3). Determinista: misma (mundo, raíz, i) ⇒ mismo reto (R7.4). El índice solo
 * crece; no hay retroceso (R7.5).
 */
export function retoDesafio(mundo: Mundo, raiz: number, indice: number): RetoDesafio {
  const generados = nivelesGeneradosDelMundo(mundo);
  const idNivel = generados[indice % generados.length]!;
  const semilla = derivarSemilla(raiz, indice);
  return { idNivel, semilla };
}

/** Semilla determinista del paso `i` a partir de la raíz, en el dominio de semillas. */
function derivarSemilla(raiz: number, indice: number): number {
  // crearPrng es determinista; se avanza (indice + 1) veces para separar los pasos.
  const prng = crearPrng(raiz);
  let v = 0;
  for (let k = 0; k <= indice; k++) v = prng.siguiente();
  return Math.floor(v * (SEMILLA_MAXIMA - SEMILLA_MINIMA + 1)) + SEMILLA_MINIMA;
}
```

El avance de un reto al siguiente es `indice + 1`: la API nunca ofrece `indice − 1`, así que no se
puede retroceder (R7.5). Es retroactivo: cualquier mundo con niveles generados (0, 1, 2 y 3) tiene
desafío; `nivelesGeneradosDelMundo` lo determina por datos, sin casos especiales (R7.7, R7.8). La
raíz es una semilla del dominio del PRNG; se puede obtener del código-semilla compartible existente.

### 10. `src/juego/insignias.ts` — AMPLIAR (Simetría + cuatro transversales)

**Simetría** sigue exactamente el patrón de las tres insignias de concepto ya presentes:

```typescript
export type IdInsignia =
  | 'secuencia' | 'iteracion' | 'descomposicion'
  | 'simetria'                                    // NUEVO (concepto, mundo 3)
  | 'depurador' | 'minimalista' | 'sinPistas' | 'buenOjo';  // NUEVO (transversales)

const MUNDO_DE_INSIGNIA /* solo conceptos */ = { secuencia: 0, iteracion: 1, descomposicion: 2, simetria: 3 };

export function insigniaSimetriaOtorgada(progreso: Progreso): boolean {
  return mundoCompletoConTresEstrellas(3, progreso);   // R8.1, R8.2
}
```

`insigniasDelMundo(3, progreso)` devuelve `['simetria']` cuando corresponde, reusando
`mundoCompletoConTresEstrellas`. Al derivarse solo del progreso y el catálogo, se otorga exactamente
una vez y se mantiene (R8.3, R8.4).

**Las cuatro transversales** se derivan del progreso. Las reglas que hoy el `Progreso` ya permite
calcular se implementan directamente; las que necesitan señales que el progreso aún no registra
(haber usado la reproducción en paralelo, haber abierto una pista, cuántas veces se vio la
demostración) exigen **extender `src/juego/progreso.ts`** con contadores anónimos por nivel, mínimos y
derivables. Esta spec se limita a las **reglas de otorgamiento verificables por pruebas**, no al mapa
de insignias (R10.4), así que las funciones reciben el progreso y devuelven un booleano:

| Insignia | Regla (R9) | Señal que necesita del progreso |
|---|---|---|
| *Minimalista* | estrella de economía en 10 niveles (R9.2) | ya disponible: contar niveles con `estrellasDe(id).economia` |
| *Simetría* y conceptos | tres estrellas por mundo | ya disponible |
| *Depurador* | aprobar 5 niveles tras haber usado la reproducción en paralelo (R9.1) | nuevo: marcar que se usó la reproducción en paralelo, y contar aprobaciones posteriores |
| *Sin pistas* | completar un mundo sin abrir ninguna pista en sus niveles (R9.3) | nuevo: marcar por nivel si se abrió una pista |
| *Buen ojo* | resolver un nivel visto la demostración una sola vez (R9.4) | nuevo: contar vistas de demostración por nivel del intento en curso |

```typescript
export function insigniaMinimalistaOtorgada(progreso: Progreso): boolean;   // R9.2
export function insigniaDepuradorOtorgada(progreso: Progreso): boolean;     // R9.1
export function insigniaSinPistasOtorgada(progreso: Progreso): boolean;     // R9.3
export function insigniaBuenOjoOtorgada(progreso: Progreso): boolean;       // R9.4
```

Cada una es un predicado puro sobre el progreso guardado, de modo que verificarlas es reproducible
por pruebas (R9.6) y, al no tener estado propio, se mantienen otorgadas exactamente una vez (R9.5).
Las señales nuevas del progreso son anónimas (banderas y contadores por `idNivel`), encajan en el
formato versión 2 y conservan la lectura tolerante y la migración existentes.

### 11. `src/niveles/catalogo.ts` — AMPLIAR

```typescript
import { MUNDO_3 } from './mundo-3-rosetones.js';
export const CATALOGO: readonly Nivel[] = [...MUNDO_0, ...MUNDO_1, ...MUNDO_2, ...MUNDO_3];
```

`mundos.ts` ya declara el mundo 3 («Rosetones», insignia «Simetría»); no se toca.

## Data Models

### Reto (sin cambios de forma)

`presupuestoEstrella`, `limiteDuro` y `limiteDuroActivo` ya existen en `Reto`. El mundo 3 es el primero
donde `limiteDuroActivo` es `true` en la práctica.

### Normalización de los niveles del mundo 3

```typescript
const NORMALIZACION_M3: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' };
```

Los cuatro niveles la declaran idéntica (R3.5). Es estructuralmente compatible con la
`NormalizacionNivel` que el validador ya consume.

### Forma de los cuatro `Nivel` del mundo 3

| id | título | origen | normalización | abstracción |
|---|---|---|---|---|
| 3.1 | Rosetón de cuadrados | autorado, `REFERENCIA_3_1` | fija/fija/exacta | `[{ clave: 'usaRepiteAnidado' }]` |
| 3.2 | Rosetón de polígonos | generado `roseton-m3` | fija/fija/exacta | `[{ clave: 'usaRepiteAnidado' }]` |
| 3.3 | Flor con giro | generado `flor-m3` | fija/fija/exacta | `[{ clave: 'usaRepiteAnidado' }]` |
| 3.4 | Mandala | autorado, `REFERENCIA_3_4` | fija/fija/exacta | `[{ clave: 'usaRepiteAnidado' }]` |

Todos con `mundo: 3`, `concepto: 'simetria'`, `pistas: [conceptual, matemática, esqueleto]` que
advierten que la posición y el rumbo de partida importan.

### Programas de referencia autorados

- 3.1: `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]` (R4.1).
- 3.4: `REPITE 8 [GD 45 REPITE 6 [REPITE 90 [AV 2 GD 2] GD 90]]` (R4.3). Pasos de tortuga ≈
  `8 · 6 · 90 = 4320` avances, muy por debajo de la guarda de 200 000 (R4.4).

### Secuencia del desafío infinito

```typescript
interface RetoDesafio { idNivel: string; semilla: number }   // derivado de (mundo, raíz, índice)
```

No se persiste la secuencia: se recalcula de `(mundo, raíz, índice)`. La navegación guarda esa terna
para reanudar; el reto concreto sale de `retoDesafio(...)`.

### Identificadores de insignia

```typescript
type IdInsignia =
  | 'secuencia' | 'iteracion' | 'descomposicion' | 'simetria'
  | 'depurador' | 'minimalista' | 'sinPistas' | 'buenOjo';
```

## Error Handling

Todos los mensajes viven en `src/lenguaje/errores.ts`; ningún otro módulo arma el texto (R2.4). El
intérprete, el validador y el validador geométrico no cambian su manejo de errores.

| Situación | Dónde se detecta | `IdError` | Mensaje |
|---|---|---|---|
| Programa del jugador excede `limiteDuro` estando activo | `main.ts` `ejecutarPrograma`, antes de animar | `limiteDuroExcedido` (NUEVO) | `Tu programa usa N instrucciones y el máximo para este reto es M: te sobran N−M. Prueba a poner un REPITE dentro de otro REPITE para repetir un grupo entero de una sola vez.` (R2.1, R2.2, R2.3) |
| Generador del mundo 3 agota intentos | `rosetón.ts`/`flor.ts`, al superar `intentosMaximos` | `generadorSinCandidato` (EXISTE) | `[programación] El generador no encontró una figura válida…` |
| Id de generador no registrado | `reto.ts` (ya existente) | `generadorDesconocido` (EXISTE) | `[programación] No hay un generador registrado…` |

El mensaje de bloqueo:
- **incluye** `N` (usadas), `M` (límite) y `N − M` (sobran) (R2.1);
- **sugiere** anidar `REPITE` dentro de otro `REPITE` (R2.2);
- **no revela** la figura, el programa de referencia ni el valor de `presupuestoEstrella` (R2.3).

El único `IdError` nuevo a declarar es `limiteDuroExcedido`.

## Testing Strategy

### Tests unitarios por módulo

- **`errores.test.ts`** — `limiteDuroExcedido` con `{ usadas: 8, limite: 5 }` produce un mensaje que
  contiene `8`, `5` y `3`, menciona `REPITE` y **no** menciona la figura ni `presupuesto` (R2.1–R2.3);
  parámetros inválidos (`usadas ≤ limite`, no enteros) caen en `solicitudDeErrorInvalida`.
- **`main.test.ts`** — con un reto del mundo 3 (`limiteDuroActivo`), un programa cuyo conteo supera
  `limiteDuro` **no** emite ninguna operación de tortuga, no cede la demostración ni reinicia la capa
  del jugador, y muestra `limiteDuroExcedido` (R1.3); un programa con conteo ≤ `limiteDuro` ejecuta
  normal (R1.4); un programa con conteo igual a `presupuestoEstrella` ejecuta (R1.6); un rodeo
  equivalente con conteo `presupuesto + k`, `k ≤ 3`, ejecuta por caber en el límite (R1.7). Con un
  reto de mundo 0–2 el mismo exceso ejecuta y solo no da economía (R1.5, R10.3).
- **`editor.test.ts`** — con `limiteDuroActivo` y conteo > `limiteDuro`, el contador muestra el aviso
  de bloqueo por texto (no solo color) y el `aria-label` lo nombra (R2.5); con conteo ≤ `limiteDuro`,
  no hay aviso de bloqueo (R2.6); con `limiteDuroActivo` falso, nunca hay aviso de bloqueo.
- **`abstraccion.test.ts`** (ya existe `usaRepiteAnidado`) — un AST con `REPITE` dentro de `REPITE`
  cumple `usaRepiteAnidado`; una lista plana de `REPITE` consecutivos no lo cumple (R6.2, R6.3, R6.4).
- **`validador.test.ts`** (normalización fija ya soportada) — una figura correcta pero trasladada y
  otra rotada, con normalización fija, no alcanzan IoU ≥ 0.90 y niegan la precisión (R3.3, R3.4); la
  tolerancia de dilatación es la misma que la de los mundos 0–2 (R3.2).
- **`desafio-infinito.test.ts`** — `retoDesafio(m, raíz, i)` es determinista: misma terna ⇒ mismo
  `(idNivel, semilla)` (R7.4); recorrer `i = 0..k` rota entre los niveles generados del mundo en orden
  (R7.6); `desafioDisponible` es falso en un mundo incompleto (R7.2) y en un mundo sin niveles
  generados (R7.8), y verdadero en un mundo completo con generados (R7.1); los mundos 0, 1, 2 y 3 son
  retroactivos (R7.7). No existe API para retroceder (R7.5).
- **`insignias.test.ts`** — *Simetría* se otorga solo con las tres estrellas en los cuatro niveles del
  mundo 3 (R8.1, R8.2), se mantiene una sola vez (R8.3, R8.4); cada transversal es un predicado puro
  sobre el progreso guardado, otorgado exactamente una vez (R9.1–R9.6).

### Tests de niveles autorados — `src/niveles/mundo-3-rosetones.test.ts`

- 3.1 y 3.4 parsean sin error; su `presupuestoEstrella` sale de `contarInstrucciones` sobre su
  referencia, sin número a mano (R4.2, R4.6).
- La referencia de 3.4 se ejecuta hasta el final sin activar la guarda de 200 000 pasos (R4.4).
- Los cuatro niveles declaran `normalizacion` fija (R3.5) y `usaRepiteAnidado` (R4.5, R6.1).

### Test de regresión del catálogo (steering `validacion-geometrica` y `tecnologia`)

Obligatorio: **todo reto del catálogo aprueba su propio nivel con las tres estrellas**, ejecutando su
programa de referencia. Para 3.1 y 3.4 se verifica precisión + economía + abstracción (`usaRepiteAnidado`)
contra su propio nivel (R4.7). Para 3.2 y 3.3, sobre **al menos 200 semillas consecutivas** (R5.9).

### Tests de generadores (property-based sobre ≥ 200 semillas) — `src/niveles/generadores/*.test.ts`

Uno por generador (`roseton-m3`, `flor-m3`):

```typescript
for (let s = 0; s < 200; s++) {
  const r = generarRoseton({ semilla: s, parametros: {}, intentosMaximos: 200 });
  expect(r.exito).toBe(true);
  if (!r.exito) continue;
  // encuadrada y no degenerada (caja ≥ 200 y dentro de [−400, 400]) (R5.6, R5.7)
  expect(encuadraYNoEsDegenerada(r.referencia)).toBe(true);
  // la referencia gana las tres estrellas contra su nivel, incl. usaRepiteAnidado (R5.9, R5.8)
  expect(apruebaTresEstrellas(r.referencia, '3.2')).toBe(true);
}
```

Para `roseton-m3`: `c ∈ {6,8,9,12,18,36}` y figura interna de 3 a 6 lados (R5.1); forma
`REPITE c [REPITE n [...] GD 360/c]` (R5.2). Para `flor-m3`: forma
`REPITE c [REPITE n [GD a AV L] GD 360/c]` (R5.3). En los dos: solo ángulos derivables y longitudes
múltiplos de 20 (R5.4); el presupuesto del nivel sale del Conteo sobre la referencia, nunca a mano
(R5.5); AST con `REPITE` anidado (R5.8).

### Determinismo (steering `tecnologia`)

- La misma `Semilla_Raiz` produce la misma secuencia de retos del desafío infinito (R7.3, R7.4), y
  cada reto derivado es reproducible por su `(idNivel, semilla)`.
- Todo el azar (generadores y desafío) pasa por `crearPrng`; ninguna ruta usa `Math.random`.

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe cumplirse en todas las ejecuciones
válidas del sistema: una afirmación formal sobre lo que el sistema debe hacer. Las propiedades son el
puente entre la especificación legible por personas y las garantías de corrección verificables por
máquina.*

### Property 1: La guarda de límite duro ejecuta si y solo si el conteo cabe

Para todo reto del mundo 3 (con `limiteDuroActivo` verdadero) y todo programa válido del jugador, la
ejecución emite operaciones de tortuga si y solo si el conteo del programa es menor o igual que
`limiteDuro`; si el conteo lo excede, no se emite ninguna operación y no se dibuja ninguna estela.

**Validates: Requirements 1.3, 1.4, 1.6, 1.7**

### Property 2: En los mundos 0 a 2 el exceso de presupuesto ejecuta sin economía

Para todo reto de los mundos 0 a 2 (con `limiteDuroActivo` falso) y todo programa válido cuyo conteo
es estrictamente mayor que `presupuestoEstrella`, la ejecución produce operaciones y la estrella de
economía no se otorga.

**Validates: Requirements 1.5, 10.3**

### Property 3: El mensaje de bloqueo nombra la cuenta, empuja a anidar y no revela el presupuesto

Para todo par de enteros `N > M`, el `Mensaje_Limite_Excedido` contiene `N`, `M` y `N − M`, menciona
anidar `REPITE` dentro de otro `REPITE`, y no contiene la palabra «presupuesto» ni el valor de
`presupuestoEstrella`.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: El contador del editor señala bloqueo si y solo si el conteo supera el límite activo

Para todo conteo mostrado en el editor con el límite duro activo, el contador señala el bloqueo (por
texto y en el nombre accesible) si y solo si ese conteo es estrictamente mayor que el `limiteDuro` del
reto en curso.

**Validates: Requirements 2.5, 2.6**

### Property 5: La normalización fija niega la precisión a una figura trasladada o rotada

Para toda figura que coincide con la referencia y toda traslación o rotación aplicada más allá de la
tolerancia de dilatación, validar con `Normalizacion_Fija` no otorga la estrella de precisión.

**Validates: Requirements 3.3, 3.4**

### Property 6: El presupuesto de todo nivel del mundo 3 es el conteo de su referencia

Para todo nivel del mundo 3 (autorado o generado, sobre cualquier semilla), el `presupuestoEstrella`
resultante es igual al conteo de instrucciones de su programa de referencia, sin ningún número de
presupuesto escrito a mano en los datos del nivel.

**Validates: Requirements 4.6, 5.5**

### Property 7: Toda referencia del mundo 3 aprueba su propio nivel con las tres estrellas

Para todo nivel del mundo 3 —y, en los generados, para toda semilla sobre al menos 200 consecutivas—
el programa de referencia obtiene las tres estrellas (precisión, economía y abstracción por
`usaRepiteAnidado`) al validarse contra su propio nivel.

**Validates: Requirements 4.7, 5.9**

### Property 8: El reto generado aceptado encuadra y no degenera

Para toda semilla, el reto que un `Generador_M3` acepta tiene una caja envolvente alineada a los ejes
con ancho y alto mayores o iguales que 200 px y contenida en el rango `[−400, 400]` en ambos ejes.

**Validates: Requirements 5.6, 5.7**

### Property 9: Los generadores emiten solo números adivinables

Para toda semilla, el programa de referencia que produce un `Generador_M3` usa únicamente longitudes
múltiplos de 20 y ángulos derivables (`360/n` con `n` de 3 a 12, o múltiplos de 15).

**Validates: Requirements 5.4**

### Property 10: La forma del rosetón generado es un REPITE anidado con giro entre copias

Para toda semilla, el programa de referencia del nivel 3.2 tiene la forma de un `REPITE` de copias
—con un número de copias en `{6, 8, 9, 12, 18, 36}` y una figura interna de 3 a 6 lados— que contiene
el `REPITE` de la figura interna y el giro entre copias.

**Validates: Requirements 5.1, 5.2**

### Property 11: La forma de la flor generada es la plantilla con giro previo al avance

Para toda semilla, el programa de referencia del nivel 3.3 tiene la forma
`REPITE c [REPITE n [GD a AV L] GD 360/c]`.

**Validates: Requirements 5.3**

### Property 12: La estrella de abstracción se otorga si y solo si hay REPITE anidado, analizando el AST

Para todo intento del jugador que gana la precisión en un nivel del mundo 3, la estrella de
abstracción se otorga si y solo si su AST contiene un nodo `REPITE` entre los descendientes de otro
nodo `REPITE`; dos textos distintos con el mismo AST obtienen el mismo veredicto de abstracción.

**Validates: Requirements 6.2, 6.3, 6.4**

### Property 13: El desafío infinito es determinista por su raíz

Para todo mundo con niveles generados, toda raíz y todo índice, el reto derivado `(idNivel, semilla)`
es el mismo en cualquier recálculo; dos recorridos de la secuencia con la misma raíz producen
exactamente la misma sucesión de retos.

**Validates: Requirements 7.3, 7.4**

### Property 14: La secuencia del desafío rota entre los niveles generados del mundo

Para todo mundo con niveles generados y todo índice `i` de la secuencia, el `idNivel` del reto es el
que ocupa la posición `i mod cantidadDeGenerados` en el orden del catálogo.

**Validates: Requirements 7.6**

### Property 15: El desafío está disponible si y solo si el mundo está completo y tiene generados

Para todo mundo y todo progreso, el `Desafio_Infinito` está disponible si y solo si el mundo tiene al
menos un nivel generado y todos sus niveles están aprobados.

**Validates: Requirements 7.1, 7.2, 7.8**

### Property 16: La insignia Simetría se otorga si y solo si el mundo 3 tiene las tres estrellas

Para todo progreso, la `Insignia_Simetria` se otorga si y solo si cada uno de los cuatro niveles del
mundo 3 tiene otorgadas sus tres estrellas de forma simultánea.

**Validates: Requirements 8.1, 8.2**

### Property 17: El otorgamiento de toda insignia es función pura e idempotente del progreso

Para todo progreso, el otorgamiento de cada insignia (la de concepto *Simetría* y las cuatro
transversales) depende solo del progreso y del catálogo, sin estado propio persistido, de modo que
evaluarlo repetidamente sobre el mismo progreso da siempre el mismo resultado booleano, sin crear una
segunda instancia.

**Validates: Requirements 8.3, 8.4, 9.5, 9.6**

### Property 18: Cada insignia transversal se deriva de su señal en el progreso

Para todo progreso, cada insignia transversal se otorga exactamente cuando su condición se cumple
sobre el progreso guardado: *Depurador* con 5 niveles aprobados tras usar la reproducción en paralelo;
*Minimalista* con la estrella de economía en 10 niveles; *Sin pistas* al completar un mundo sin abrir
ninguna pista; *Buen ojo* al resolver un nivel con la demostración vista una sola vez.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

### Propiedades no derivadas (criterios no aptos para prueba de propiedad)

Los siguientes criterios se verifican por ejemplo, por configuración o como pruebas de no-regresión,
no como propiedades universales: 1.6 (ejemplo, subsumido por la Property 1); 2.4, 7.5, 10.1, 10.2,
10.4, 10.5 (restricciones de arquitectura/alcance, verificadas por inspección y por la suite
existente); 3.1, 3.2, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 5.8, 6.1, 7.7 (datos declarativos o
ejemplos concretos sobre el catálogo). La Testing Strategy detalla cómo se cubre cada uno.
