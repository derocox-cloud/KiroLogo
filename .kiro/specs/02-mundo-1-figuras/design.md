# Design Document

**KiroLogo · Spec 02 · Mundo 1 · Figuras geométricas**

## Overview

Esta spec extiende tres capas del sistema:

1. **Lenguaje** — el lexer ya tokeniza `[` y `]`; el parser necesita un nuevo caso para
   `Nodo_Repite`; el intérprete necesita su brazo de ejecución; el conteo aplica la regla de
   "1 + cuerpo escrito".
2. **Niveles** — dos niveles autorados (1.1 y 1.4) y tres generadores (1.2, 1.3, 1.5) en el
   catálogo existente.
3. **UI** — la reproducción en paralelo (`doble-dibujo`) y la detección de divergencia ya estaban
   esbozadas en la spec 00; aquí se implementan completamente.

No hay nueva infraestructura: todas las piezas (lexer, parser, intérprete, conteo, catálogo,
animador, lienzo) ya existen. El trabajo es ampliar, no rediseñar.

## Architecture

### Capa de lenguaje — flujo de REPITE

```
texto KiroLogo
     │
     ▼
  Lexer                 ← tokeniza [ y ] como BRACKET_ABRE / BRACKET_CIERRA
     │ Token[]
     ▼
  Parser                ← nuevo: parsearRepite() → Nodo_Repite
     │ Programa (AST)
     ▼
  Interprete            ← nuevo: rama case 'repite' en generador
     │ Operacion[]
     ▼
  Tortuga / Lienzo
```

El lexer ya emite `BRACKET_ABRE` y `BRACKET_CIERRA` (o equivalentes) como parte del soporte
preparado en spec 00. Si no, se agregan ahora dos tipos de token sin tocar el resto.

### Capa de niveles — estructura de datos

```typescript
// src/niveles/tipos.ts  (sin cambios en la interfaz pública)
interface NivelAutorado {
  id: string
  tipo: 'autorado'
  programaReferencia: string          // código KiroLogo
  estrellaAbstraccion: CondicionAbstraccion
  pistas: [string, string, string]
  normalizacion: ConfigNormalizacion
  // presupuestoEstrella: calculado, no declarado
}

interface NivelGenerado {
  id: string
  tipo: 'generado'
  generador: (semilla: number) => ProgramaReferencia
  estrellaAbstraccion: CondicionAbstraccion
  pistas: PlantillasPistas
  normalizacion: ConfigNormalizacion
}
```

Los presupuestos no viven en el tipo. Los calcula `contarInstrucciones(parsear(ref.programa))` en
tiempo de validación.

### Reproducción en paralelo

El módulo `src/motor/doble-dibujo.ts` ya existe como stub (spec 00). Aquí se implementa:

```
ejecutarEnParalelo(programaKiro, programaJugador)
  → { divergencia: PuntoDivergencia | null, tipoFallo: 'divergencia' | 'exceso' | 'ninguno' }
```

Internamente usa el mismo generador del intérprete para producir listas de `Operacion[]` de las dos
ejecuciones, luego las compara índice a índice.

## Components and Interfaces

### 1. AST — `src/lenguaje/ast.ts`

Agregar el tipo de nodo:

```typescript
export interface NodoRepite {
  tipo: 'repite'
  veces: number
  cuerpo: Instruccion[]
  lineaFuente?: number    // para mensajes de error
}

// Instruccion = NodoComando | NodoRepite | NodoPara (futuro)
export type Instruccion = NodoComando | NodoRepite
```

`lineaFuente` en el nodo permite señalar dónde abrió el corchete para el mensaje de error.

### 2. Lexer — `src/lenguaje/lexer.ts`

Si los tokens `BRACKET_ABRE` / `BRACKET_CIERRA` aún no existen:

```typescript
type TipoToken =
  | 'COMANDO' | 'NUMERO' | 'BRACKET_ABRE' | 'BRACKET_CIERRA'
  | 'PALABRA' | 'FIN_LINEA'  // … resto existente
```

El lexer registra `linea` en cada token. Ya debería hacerlo para otros errores; si no, se agrega
aquí sin afectar tokens previos.

### 3. Parser — `src/lenguaje/parser.ts`

Nuevo método `parsearRepite()`:

```typescript
private parsearRepite(): NodoRepite {
  const tokenRP = this.consumir('COMANDO')        // REPITE o RP
  const veces   = this.consumirNumero()
  this.consumir('BRACKET_ABRE')                   // puede fallar → error línea
  const cuerpo  = this.parsearListaInstrucciones() // recursivo, permite anidado
  this.consumir('BRACKET_CIERRA')                 // puede fallar → error línea
  return { tipo: 'repite', veces, cuerpo, lineaFuente: tokenRP.linea }
}
```

`parsearListaInstrucciones()` llama a `parsearInstruccion()` en bucle hasta ver `BRACKET_CIERRA`
o fin de entrada. Si llega fin de entrada sin cerrar, lanza el error de corchete sin cerrar con la
línea del `BRACKET_ABRE` guardada en la pila de contexto.

**Manejo de errores de corchete:**

```typescript
// Pila de corchetes abiertos: guardamos la línea de cada [
private pilaCorchetes: number[] = []

// Al encontrar [:
this.pilaCorchetes.push(token.linea)

// Al salir de parsearListaInstrucciones sin encontrar ]:
if (this.pilaCorchetes.length > 0) {
  const lineaApertura = this.pilaCorchetes[this.pilaCorchetes.length - 1]
  throw ErrorCorcheteNoAbierto(lineaApertura)
}

// Al encontrar ] fuera de una lista:
throw ErrorCorcheteSobrante(token.linea)
```

### 4. Intérprete — `src/lenguaje/interprete.ts`

El intérprete es un generador que ya itera `Instruccion[]`. Se agrega el caso:

```typescript
case 'repite': {
  for (let i = 0; i < nodo.veces; i++) {
    yield* ejecutarLista(nodo.cuerpo, estado)
  }
  break
}
```

`ejecutarLista` es la misma función que recorre el programa raíz. Al ser recursiva, soporta
anidación sin trabajo adicional.

### 5. Conteo — `src/lenguaje/conteo.ts`

La regla actual ya debería cubrir `REPITE` si el AST tiene `Nodo_Repite`. Si no existe aún:

```typescript
case 'repite':
  return 1 + contarLista(nodo.cuerpo)
  // NO multiplica por nodo.veces
```

`contarLista` es la suma de `contarInstruccion(i)` para cada `i` del array.

### 6. Errores — `src/lenguaje/errores.ts`

Dos funciones nuevas:

```typescript
export function errorCorcheteNoAbierto(linea: number): ErrorKiroLogo {
  return { mensaje: `Falta cerrar el corchete que abriste en la línea ${linea}.` }
}

export function errorCorcheteSobrante(linea: number): ErrorKiroLogo {
  return { mensaje: `Hay un corchete de cierre en la línea ${linea} que no abriste.` }
}
```

### 7. Niveles — `src/niveles/mundo-1-figuras.ts` (nuevo)

```typescript
// Nivel 1.1 — autorado
export const nivel_1_1: NivelAutorado = {
  id: '1.1',
  tipo: 'autorado',
  programaReferencia: 'REPITE 4 [AV 100 GD 90]',
  estrellaAbstraccion: { tipo: 'usaRepite' },
  pistas: [
    'La tortuga hace lo mismo cuatro veces. ¿Qué instrucción repite exactamente?',
    'Un cuadrado tiene cuatro lados iguales y cuatro giros iguales. Suma los giros: ¿cuánto es?',
    'REPITE 4 [...]',
  ],
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
}

// Nivel 1.4 — autorado
export const nivel_1_4: NivelAutorado = {
  id: '1.4',
  tipo: 'autorado',
  programaReferencia: 'REPITE 360 [AV 2 GD 1]',
  estrellaAbstraccion: { tipo: 'usaRepite' },
  pistas: [
    'Un círculo es un polígono con muchos lados muy cortos. ¿Cuántos?',
    '360 lados, cada uno de 2 pasos, con un giro de 1 grado. El total de giro es 360°.',
    'REPITE 360 [AV 2 GD ...]',
  ],
  normalizacion: { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' },
}
```

**Generadores (1.2, 1.3, 1.5):**

```typescript
// Generador 1.2 — polígono regular GD
export function generador_1_2(semilla: number): ProgramaReferencia {
  const rng = crearPRNG(semilla)
  const n = rng.enteroEntre(3, 8)           // lados
  const L = rng.multiploEntre(20, 60, 140)  // longitud múltiplo de 20
  const angulo = Math.round(360 / n)        // siempre entero exacto para n ∈ 3..8
  const programa = `REPITE ${n} [AV ${L} GD ${angulo}]`
  if (!encuadraEnLienzo(programa) || esNula(programa)) {
    return generador_1_2(semilla + 1)       // reintentar con semilla siguiente
  }
  return { programa, semilla }
}

// Generador 1.3 — polígono regular GI
export function generador_1_3(semilla: number): ProgramaReferencia {
  // igual que 1.2 pero con GI
  const rng = crearPRNG(semilla)
  const n = rng.enteroEntre(3, 8)
  const L = rng.multiploEntre(20, 60, 140)
  const angulo = Math.round(360 / n)
  const programa = `REPITE ${n} [AV ${L} GI ${angulo}]`
  if (!encuadraEnLienzo(programa) || esNula(programa)) {
    return generador_1_3(semilla + 1)
  }
  return { programa, semilla }
}

// Generador 1.5 — arco (polígono incompleto)
export function generador_1_5(semilla: number): ProgramaReferencia {
  const rng = crearPRNG(semilla)
  const n = rng.enteroEntre(4, 8)           // lados del polígono completo (mín 4 para tener arco útil)
  const k = rng.enteroEntre(2, n - 1)       // repeticiones: menos que n, mínimo 2
  const L = rng.multiploEntre(20, 60, 140)
  const angulo = Math.round(360 / n)
  const programa = `REPITE ${k} [AV ${L} GD ${angulo}]`
  if (!encuadraEnLienzo(programa) || esNula(programa)) {
    return generador_1_5(semilla + 1)
  }
  return { programa, semilla }
}
```

**Nota sobre ángulos exactos:** para `n` ∈ {3,4,5,6,7,8} los valores de `360/n` son
{120, 90, 72, 60, ~51.4, 45}. Para `n=7` el ángulo no es entero. El generador 1.2 excluye `n=7`
de los ángulos no derivables, o redondea con `Math.round` sabiendo que 51° introduce un error
acumulado de 7 × 3 = 21° en el cierre — suficientemente visible para que el jugador lo note si
usa el ángulo equivocado. La elección más limpia es excluir 7 del generador o usarlo solo en 1.5
donde el polígono no cierra de todos modos. **Decisión adoptada**: 1.2 y 1.3 usan `n` ∈
{3, 4, 5, 6, 8} (excluyen 7); 1.5 puede incluir 7 porque el arco no cierra igualmente.

### 8. Doble dibujo — `src/motor/doble-dibujo.ts`

```typescript
export interface PuntoDivergencia {
  indice: number           // índice en la lista de operaciones
  tipoKiro: TipoOperacion
  valorKiro: number
  tipoJugador: TipoOperacion
  valorJugador: number
}

export interface ResultadoParalelo {
  divergencia: PuntoDivergencia | null
  excesoDespuesDeIgual: boolean   // programas iguales hasta el final, pero jugador dibujó de más
  programaCortoSeLlamo: 'kiro' | 'jugador' | null
}

export function ejecutarEnParalelo(
  programaKiro: string,
  programaJugador: string
): ResultadoParalelo {
  const opsKiro    = Array.from(interprete(parsear(programaKiro),    estadoInicial()))
  const opsJugador = Array.from(interprete(parsear(programaJugador), estadoInicial()))

  const longMin = Math.min(opsKiro.length, opsJugador.length)
  for (let i = 0; i < longMin; i++) {
    if (divergen(opsKiro[i], opsJugador[i])) {
      return { divergencia: { indice: i, ...detalle(opsKiro[i], opsJugador[i]) }, ... }
    }
  }

  if (opsKiro.length !== opsJugador.length) {
    // uno terminó antes
    const quienCorto = opsKiro.length < opsJugador.length ? 'kiro' : 'jugador'
    return { divergencia: null, programaCortoSeLlamo: quienCorto, excesoDespuesDeIgual: false }
  }

  // misma longitud, sin divergencia → revisar exceso de trazo (responsabilidad del validador)
  return { divergencia: null, programaCortoSeLlamo: null, excesoDespuesDeIgual: false }
}

function divergen(a: Operacion, b: Operacion): boolean {
  if (a.tipo !== b.tipo) return true
  if (a.tipo === 'avanza') return Math.abs(a.distancia - b.distancia) > 8
  if (a.tipo === 'gira')   return Math.abs(normalizarAngulo(a.angulo - b.angulo)) > 1
  return false
}
```

La función `divergen` solo compara operaciones de la tortuga (avanza/gira), no instrucciones de
código. Dos programas equivalentes escritos de forma distinta producirán la misma secuencia de
`Operacion[]` y no divergirán.

### 9. Catálogo — `src/niveles/catalogo.ts`

Agregar mundo 1 al catálogo con los cinco niveles:

```typescript
import { nivel_1_1, nivel_1_4, generador_1_2, generador_1_3, generador_1_5 }
  from './mundo-1-figuras'

export const MUNDOS: Mundo[] = [
  // mundo 0 existente …
  {
    id: 1,
    nombre: 'Figuras geométricas',
    insignia: 'Iteración',
    niveles: [nivel_1_1, nivelGenerado_1_2, nivelGenerado_1_3, nivel_1_4, nivelGenerado_1_5],
  },
]
```

## Data Models

### Nodo_Repite en el AST

```typescript
// src/lenguaje/ast.ts
export interface NodoRepite {
  tipo: 'repite'
  veces: number
  cuerpo: Instruccion[]
  lineaFuente?: number
}

export type Instruccion = NodoComando | NodoRepite
// (NodoPara se añadirá en spec 03)
```

### ProgramaReferencia

```typescript
// src/niveles/tipos.ts
export interface ProgramaReferencia {
  programa: string
  semilla: number
}
```

### ResultadoParalelo

```typescript
// src/motor/doble-dibujo.ts
export interface ResultadoParalelo {
  divergencia: PuntoDivergencia | null
  excesoDespuesDeIgual: boolean
  programaCortoSeLlamo: 'kiro' | 'jugador' | null
}
```

## Error Handling

| Situación | Dónde se detecta | Mensaje |
|---|---|---|
| `[` sin `]` correspondiente | Parser, al final de `parsearListaInstrucciones` | `Falta cerrar el corchete que abriste en la línea N.` |
| `]` sin `[` previo | Parser, al encontrar `BRACKET_CIERRA` fuera de lista | `Hay un corchete de cierre en la línea N que no abriste.` |
| `REPITE` sin número | Parser, al esperar número | `REPITE necesita un número. Por ejemplo: REPITE 4 [AV 100 GD 90]` |
| `REPITE` sin `[` | Parser, al esperar `BRACKET_ABRE` | `Después de REPITE N falta la lista entre corchetes. Por ejemplo: REPITE 4 [AV 100 GD 90]` |
| `REPITE` en mundo 0 | Vocabulario (validación previa al parser) | `REPITE todavía no está disponible. Se desbloquea en el mundo 1.` |

Todos los mensajes viven en `src/lenguaje/errores.ts`. El parser nunca produce cadenas de texto
directamente; siempre llama a la función del catálogo de errores.

## Testing Strategy

### Tests unitarios de lenguaje

- **`lexer.test.ts`** — tokenizar `REPITE 4 [AV 100 GD 90]` produce los tokens correctos con números
  de línea.
- **`parser.test.ts`** — parsear produce `NodoRepite` con `veces=4` y `cuerpo=[NodoComando('av',100),
  NodoComando('gd',90)]`; parsear anidado produce `NodoRepite` dentro de `NodoRepite`; corchete
  sin cerrar lanza error con línea correcta; corchete sobrante lanza error con línea correcta.
- **`interprete.test.ts`** — `REPITE 4 [AV 100 GD 90]` emite las mismas operaciones que el cuadrado
  a mano; `REPITE 0 [AV 100]` no emite operaciones; anidado ejecuta correctamente.
- **`conteo.test.ts`** — `REPITE 4 [AV 100 GD 90]` devuelve 3; `REPITE 36 [REPITE 4 [AV 100 GD 90]
  GD 10]` devuelve 5.
- **`errores.test.ts`** — mensajes de corchete incluyen el número de línea correcto.

### Tests de generadores (property-based sobre 200 semillas)

En `src/niveles/mundo-1-figuras.test.ts`:

```typescript
for (let s = 0; s < 200; s++) {
  const ref = generador_1_2(s)
  expect(encuadraEnLienzo(ref.programa)).toBe(true)
  expect(apruebaTresEstrellas(ref, '1.2', s)).toBe(true)
}
```

Igual para 1.3 y 1.5.

### Tests del doble dibujo

En `src/motor/doble-dibujo.test.ts`:

- Programas idénticos → sin divergencia.
- Pentágono correcto vs. giro de 90° → diverge en el paso 2 (primer giro), valor Kiro=72, jugador=90.
- Programa más corto → `programaCortoSeLlamo = 'jugador'`.
- Programas equivalentes escritos distinto (cuadrado a mano vs. `REPITE`) → sin divergencia.
