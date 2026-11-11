# Design Document

**KiroLogo · Spec 04 · Mundo 3 · Rosetones**

## Overview

Esta spec enseña **iteración anidada** y **simetría rotacional**: un `REPITE` dentro de otro
`REPITE`. No agrega ningún comando al lenguaje y la mayor parte del andamiaje **ya existe** en el
código. Este documento se alinea con los requisitos 2 y 11 a 17 actualizados, y parte del estado real
del repositorio, verificado por lectura del código, no de lo que decía la versión anterior.

### Estado verificado del código

| Pieza | Estado hoy | Qué falta |
|---|---|---|
| `reto.ts`: `presupuestoEstrella`, `limiteDuro`, `limiteDuroActivo` | Hecho | Nada (R1.1, R1.2) |
| Guarda de límite duro en `main.ts` (`ejecutarPrograma`) | Hecha: corta antes de `ejecutando = true`, usa `contarInstrucciones` | Pasar el mundo al mensaje (R13) |
| Aviso de bloqueo en `ui/editor.ts` (`presentarReto(presupuesto, limiteDuro, activo)`) | Hecho | Nada (R2.7, R2.8) |
| `errores.ts`: `limiteDuroExcedido` | Existe con `{ usadas, limite }` y **una sola sugerencia** (anidar `REPITE`) | Parámetro `mundo` y sugerencia por mundo (R2.2, R13) |
| `juego/desafio-infinito.ts` (`nivelesGeneradosDelMundo`, `desafioDisponible`, `retoDesafio`, `derivarSemilla`) | Lógica hecha y probada. «Disponible» = mundo con generados y todos sus niveles con precisión | **Ninguna pantalla la usa** (R12) |
| `juego/insignias.ts`: `simetria` y las 4 transversales | Hechas como predicados puros del progreso | `MUNDO_DE_INSIGNIA` sigue siendo `Record<string, number>` y `insigniasDelMundo` usa `as IdInsignia[]` (R14) |
| `juego/progreso.ts`: los 7 `Metodos_De_Senal` | Hechos, persistentes e idempotentes. `guardar` ya calcula `aprobadoTrasReproduccionParalela` | Nadie los llama |
| Niveles 3.x, generadores `roseton-m3` y `flor-m3`, `MUNDO_3` en el catálogo | Por confirmar contra R3 a R6 en la fase de tareas | Ver §Niveles y generadores |

**Hallazgo central, confirmado con búsqueda en todo `src/`:** `marcarPistaAbierta`,
`registrarVistaDemostracion` y `marcarReproduccionParalelaUsada` **no se invocan desde ningún módulo
de producción**. Solo aparecen su declaración y su implementación en `progreso.ts` y las llamadas de
`progreso.test.ts` e `insignias.test.ts`. Ni `main.ts` ni nada de `src/ui/` los usa. Por eso
*Depurador*, *Sin pistas* y *Buen ojo* no se pueden otorgar jugando.

Hay además un segundo hueco que condiciona el diseño de R11.3: **la reproducción en paralelo no está
montada en la pantalla.** `crearReproduccionParalelo` existe en `ui/reproduccion-paralelo.ts`, pero
`main.ts` no la instancia. Solo importa `compararOperaciones` para mostrar el mensaje de divergencia
bajo el lienzo. Hoy el jugador no tiene ninguna acción que «inicie la reproducción en paralelo», así
que no hay dónde enganchar la señal. El diseño añade esa acción (§4).

Qué se construye, entonces:

1. Sugerencia de bloqueo **por mundo** en `errores.ts` (R2.2, R13).
2. Cableado de las tres señales desde la interfaz, más la acción «Ver en paralelo» (R11).
3. Control mínimo del desafío infinito (R12).
4. Separación de tipos de las insignias (R14).
5. Constante compartida de timeout (R15).
6. Documentación de los métodos de señal (R16).
7. Lo que el estado de la tabla marque pendiente de los requisitos 1 a 10.

## Architecture

### Flujo del intento con límite duro (ya implementado)

```
texto del jugador
      │
      ▼
  analizarTextoJugador ── errores ──► globo (sin ejecutar)
      │ programa OK
      ▼
  guarda de límite duro                  (main.ts, ya existe)
   si reto.limiteDuroActivo y contarInstrucciones(programa) > reto.limiteDuro:
      globo.mostrarMensajes([ limiteDuroExcedido({ usadas, limite, mundo }) ])   ◄── cambia: añade `mundo`
      return   (no se emite ninguna operación, no se toca la capa del jugador)
      │
      ▼
  marcarEjecucionEnCurso · reiniciar capa · ejecutar · animar · concluirIntento
```

`concluirIntento` ya llama a `progreso.guardar(...)`. Como `guardar` fija
`aprobadoTrasReproduccionParalela` mirando la bandera global, **R11.4 se cumple sin tocar `guardar`**
siempre que `marcarReproduccionParalelaUsada` se haya invocado antes: el orden de las llamadas es lo
que importa.

### Una sola fuente para la sugerencia por mundo (fusión de R2.3, R2.4 y R13.1)

Los criterios 3 y 4 del requisito 2 (sugerencia de parámetros en el mundo 4 y de recursión en el 5) y
el criterio 1 del requisito 13 (una sugerencia por mundo con límite activo) describen **la misma regla**.
El diseño la implementa **una sola vez**: una tabla en el catálogo de errores, consultada por el
mensaje.

```typescript
// src/lenguaje/errores.ts
const SUGERENCIA_DE_BLOQUEO_POR_MUNDO: Readonly<Record<number, string>> = {
  3: 'Prueba a poner un REPITE dentro de otro REPITE para repetir un grupo entero de una sola vez.',
  4: 'Prueba a usar parámetros para que un mismo procedimiento sirva para varios tamaños.',
  5: 'Prueba a usar recursión: un procedimiento que se llama a sí mismo con un valor menor.',
};
const MUNDO_DE_SUGERENCIA_POR_OMISION = 3;
```

- Mundo con entrada en la tabla: el mensaje usa esa sugerencia (R13.2).
- Mundo sin entrada (por ejemplo un mundo futuro): usa la del mundo 3 (R13.3).
- Los mundos 0 a 2 nunca llegan al mensaje, porque la guarda no se activa. Si llegaran, también caería
  en el valor por omisión.
- Los textos son **solo texto**: esta spec no agrega parámetros ni recursión al lenguaje (R10.2).

`ParametrosPorError['limiteDuroExcedido']` pasa a `{ usadas: number; limite: number; mundo: number }`.
`crearError` valida que `usadas`, `limite` y `mundo` sean enteros y que `usadas > limite`, igual que
hoy. La diferencia `usadas − limite` se calcula al componer el texto, no se recibe. El mensaje **nunca**
incluye `presupuestoEstrella` (R2.5): la guarda solo le entrega `limite`.

### Cableado de las señales transversales (R11)

Cada señal se escribe en el punto exacto de `main.ts` o de `ui/` donde ocurre la acción, a través de
un único envoltorio que protege al jugador de un fallo de persistencia:

```typescript
// main.ts
/** Ejecuta una escritura de señal; si falla, deja rastro en consola y sigue (R11.11). */
function registrarSenal(escribir: () => void): void {
  try {
    escribir();
  } catch (e) {
    console.error('No se pudo registrar la señal de progreso.', e);
  }
}
```

(Es el mismo patrón que ya usa `progreso.guardar` en `concluirIntento`.)

| Señal | Acción del jugador | Dónde se engancha | Llamada |
|---|---|---|---|
| Pista abierta (R11.1) | Pulsa «Pedir pista» y se muestra un escalón | `globo-kiro.ts` recibe un callback opcional `alAbrirPista`, invocado en `pedirPista` solo cuando se muestra un escalón (no con el aviso «ya te di todas») | `progreso.marcarPistaAbierta(reto.nivel.id)` |
| Demostración vista (R11.2) | Se lanza la demostración | `main.ts`: dos puntos, `montarReto` con `lanzarDemostracion` (`reproducir`) y `verDemostracion` (`repetir`) | `progreso.registrarVistaDemostracion(reto.nivel.id)`, **una vez por demostración lanzada** |
| Reproducción en paralelo usada (R11.3) | Pulsa «Ver en paralelo» | Acción nueva en `controles.ts` y `main.ts` (ver abajo) | `progreso.marcarReproduccionParalelaUsada()`, **antes** de que el jugador pueda apretar «Ejecutar» y aprobar |

Detalles de cada enganche:

**Pista.** `DependenciasGlobo` gana `readonly alAbrirPista?: () => void`. Es opcional para no romper
las pruebas existentes del globo. `main.ts` lo cablea con el nivel en curso leído **en el momento de la
llamada** (`reto` es mutable al cambiar de nivel), igual que el resto de callbacks. El aviso «Ya te di
todas las pistas de este reto» no cuenta como abrir una pista: la bandera ya estaba puesta y
`marcarPistaAbierta` es idempotente de todos modos.

**Demostración.** Se centraliza en una función `lanzarDemostracion(modo: 'reproducir' | 'repetir')`
dentro de `main.ts`. Llama al método de `Demostracion` y luego `registrarSenal(() =>
progreso.registrarVistaDemostracion(reto.nivel.id))`. Consecuencia de R11.2, a tener presente: la
demostración que Kiro lanza sola al entrar al nivel **cuenta como una vista**, igual que cada «Volver a
ver la demostración». Para *Buen ojo* esto significa «solo la que se lanzó al entrar, sin repetir».
Volver a entrar al mismo nivel o pedir otro reto suma otra vista, porque `montarReto` lanza otra
demostración. Es la lectura literal del requisito y se deja anotada para que no sorprenda.

**Reproducción en paralelo (acción nueva).** El módulo `ui/reproduccion-paralelo.ts` ya hace el trabajo
de dibujo; falta montarlo y darle un disparador.

- `controles.ts`: `AccionId` gana `'paralelo'` con texto «Ver en paralelo» y nombre accesible «Ver mi
  recorrido y el de Kiro en paralelo». `CallbacksControles` gana `verEnParalelo: () => void`.
  Arranca **deshabilitada** y se habilita cuando existe un intento ejecutado del reto en curso; mientras
  hay una ejecución en curso se deshabilita, como `demostracion`.
- `main.ts`: instancia `crearReproduccionParalelo` con las dependencias que ya declara (lienzo
  paralelo, reloj, temas de Kiro y del jugador, `movimientoReducido`, `anunciar`) y define
  `verEnParalelo()`:

```typescript
function verEnParalelo(): void {
  if (estadoApp.operacionesJugador === null) return;      // sin intento no hay nada que comparar
  registrarSenal(() => progreso.marcarReproduccionParalelaUsada());   // R11.3
  reproduccionParalelo.reproducir(reto.operaciones, estadoApp.operacionesJugador, ESTADO_INICIAL);
}
```

Se registra la señal **al iniciar**, no al terminar la animación: R11.3 dice «inicia». Por la forma de
`guardar`, un nivel aprobado **después** de este momento queda marcado como posterior (R11.4); uno
aprobado antes no se reescribe, porque la bandera por nivel no retrocede (§R11.4 en
`progreso.ts`). Esta spec no cambia esa semántica.

### Desafío infinito en la interfaz (R12)

La lógica pura vive en `juego/desafio-infinito.ts` y **no cambia**. Se añade un módulo de interfaz
pequeño y un poco de estado en `main.ts`.

```
              ┌──────────────────────────────────────────────────────────┐
 progreso ───►│ desafioDisponible(reto.nivel.mundo, progreso)             │
              └──────────────┬───────────────────────────────────────────┘
                             │ verdadero → el control se muestra; falso → se oculta (R12.1, R12.2)
                             ▼
   [Desafío infinito]  ──activa──►  raíz = semillaNuevaParaNivel(...)      (la misma entropía de arranque
        (botón)                      índice = 0                              que ya usa «Otro reto»; sin Math.random)
                                     reto = retoDesafio(mundo, raíz, 0)
                                     cambiarANivel(reto.idNivel, reto.semilla)
                                     muestra codificar(raíz).código         (R12.6)
   aprobado el reto  ──────────►  el botón pasa a «Siguiente reto»          (R12.4)
   «Siguiente reto»  ──activa──►  índice += 1 → retoDesafio(mundo, raíz, índice) → cambiarANivel(...)
```

`src/ui/control-desafio.ts` (nuevo, mismo molde que `panel-semilla.ts`):

```typescript
export interface CallbacksControlDesafio {
  readonly iniciar: () => void;
  readonly siguiente: () => void;
}
export interface ControlDesafio {
  readonly raiz: HTMLElement;
  readonly boton: HTMLButtonElement;
  /** Oculta el control o lo muestra como «Desafío infinito» / «Siguiente reto». */
  presentar(estado:
    | { fase: 'oculto' }
    | { fase: 'disponible'; mundo: number }
    | { fase: 'enCurso'; mundo: number; codigoRaiz: string; puedeAvanzar: boolean }): void;
}
```

- Es un `<button>` nativo: operable con Enter y Espacio y alcanzable con `Tab` (R12.7). Su nombre
  accesible es «Iniciar el desafío infinito del mundo N» o «Ir al siguiente reto del desafío infinito».
- **No existe ningún control de retroceso** (R12.5): la interfaz del módulo solo tiene `iniciar` y
  `siguiente`. El estado en `main.ts` es `{ mundo, raiz, indice } | null` y solo se incrementa.
- Mientras está en curso, muestra el código de la raíz obtenido con `codificar` de
  `azar/codigo-semilla.ts` (R12.6). Si `codificar` devuelve error (semilla fuera de dominio, no debería
  pasar con una semilla acotada), se omite el código y se avisa con el mensaje del catálogo.
- «Siguiente reto» solo se habilita cuando el reto en curso del desafío está aprobado (estrella de
  precisión guardada para ese `idNivel`), leyendo el progreso al terminar cada intento.
- El estado del desafío se descarta cuando el jugador cambia de nivel por **otro camino** (menú de
  mundos, otro reto, reproducir código). `cambiarANivel` recibe un indicador interno para distinguir
  la llamada que viene del control.
- El control se muestra para el **mundo del nivel en curso**. Es el acceso mínimo que pide el
  requisito: no hay selector de mundo, ni puntuación, ni historial.
- Los niveles que entrega `retoDesafio` son generados de un mundo completo, así que ya están
  desbloqueados y `cambiarANivel` no los rechaza.

### Tipos de insignia separados (R14)

```typescript
// src/juego/insignias.ts
export type IdInsigniaDeConcepto = 'secuencia' | 'iteracion' | 'descomposicion' | 'simetria';
export type IdInsigniaTransversal = 'depurador' | 'minimalista' | 'sinPistas' | 'buenOjo';
export type IdInsignia = IdInsigniaDeConcepto | IdInsigniaTransversal;

/** Solo las de concepto tienen mundo. Consultar una transversal no compila (R14.2, R14.3). */
const MUNDO_DE_INSIGNIA: Readonly<Record<IdInsigniaDeConcepto, number>> = {
  secuencia: 0, iteracion: 1, descomposicion: 2, simetria: 3,
};

/** Recorrido de las de concepto sin aserciones de tipo (R14.4). */
const INSIGNIAS_DE_CONCEPTO: readonly IdInsigniaDeConcepto[] =
  ['secuencia', 'iteracion', 'descomposicion', 'simetria'];

export function insigniasDelMundo(mundo: number, progreso: Progreso): readonly IdInsignia[] {
  const otorgadas: IdInsignia[] = [];
  for (const id of INSIGNIAS_DE_CONCEPTO) {
    if (MUNDO_DE_INSIGNIA[id] === mundo && OTORGADA_DE_CONCEPTO[id](progreso)) otorgadas.push(id);
  }
  return otorgadas;
}
```

Se evita `Object.keys(...) as IdInsignia[]` recorriendo un arreglo tipado. El riesgo de que el arreglo
y el `Record` se desincronicen (agregar una insignia a uno y olvidar el otro) se cubre con una prueba
que compara las claves del `Record` con el arreglo. `OTORGADA_DE_CONCEPTO` es un
`Record<IdInsigniaDeConcepto, (p: Progreso) => boolean>` que reúne los cuatro predicados existentes.

Para que las pruebas de punta a punta de R11.10 puedan verificar la insignia **otorgada** sin añadir
estado, se agrega un predicado derivado:

```typescript
export function insigniasTransversalesOtorgadas(progreso: Progreso): readonly IdInsigniaTransversal[];
```

Es una función pura del progreso. Las pruebas recargan `cargarProgreso(almacen)` con el mismo
almacén que usó la aplicación y le preguntan por ella. No cambia `Aplicacion`. Los resultados de las
pruebas de insignias existentes no cambian (R14.5).

### Timeout compartido (R15)

Se crea `src/pruebas/tiempos.ts` (módulo solo para pruebas, sin dependencias):

```typescript
/** Tiempo máximo de las regresiones de tres estrellas sobre 200 semillas. */
export const TIMEOUT_TRES_ESTRELLAS = 180_000;
```

- `generadores-mundo-2.test.ts` borra su constante local `TIMEOUT_TRES_ESTRELLAS` e importa esta.
- `reto.test.ts` sustituye los dos `120_000` de las regresiones 3.2 y 3.3 (líneas ~211 y ~357) por la
  constante.
- Los `120_000` de `camino.test.ts`, `zigzag.test.ts`, `validador.test.ts` y `main.test.ts` **no son**
  regresiones de tres estrellas de los mundos 2 y 3, así que quedan fuera de R15.4.

El archivo vive en `src/pruebas/` y no junto a un módulo, porque lo comparten pruebas de `juego/` y de
`niveles/`. Es la única excepción a «las pruebas van junto al módulo que prueban», y se justifica por
ser una constante, no una prueba. Esta ubicación se puede cambiar sin tocar nada más.

### Capa de niveles y generadores del mundo 3

Sin cambios de diseño respecto de los requisitos 3 a 6, que no se modificaron:

- `src/niveles/mundo-3-rosetones.ts` exporta `MUNDO_3` con 3.1 y 3.4 autorados (`REPITE 36 [REPITE 4
  [AV 100 GD 90] GD 10]` y `REPITE 8 [GD 45 REPITE 6 [REPITE 90 [AV 2 GD 2] GD 90]]`) y 3.2 y 3.3
  generados (`roseton-m3` y `flor-m3`).
- Los cuatro declaran `normalizacion: { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' }` y
  `abstraccion: [{ clave: 'usaRepiteAnidado' }]`, y sus pistas advierten que la posición y el rumbo de
  partida importan (R3.5, R3.6).
- Los generadores usan el contrato `Generador` de `src/niveles/tipos.ts` y se registran en
  `generadores/registro.ts`. Solo importan de `lenguaje/` y `azar/`. Miden la caja de la figura con su
  propia aritmética de polígono, porque no pueden importar de `motor/`.
- `rosetón`: `REPITE c [REPITE n [AV L GD 360/n] GD 360/c]` con `c ∈ {6, 8, 9, 12, 18, 36}` y
  `n ∈ {3, 4, 5, 6}`. `flor`: `REPITE c [REPITE n [GD a AV L] GD 360/c]`. Longitudes múltiplos de 20.
- Reintento dentro de `intentosMaximos` con semilla `semilla + intento`: se descarta lo degenerado
  (ancho o alto < 200 px) y lo no encuadrado (fuera de `[−400, 400]`). Al agotar los intentos devuelve
  `generadorSinCandidato`.
- El presupuesto lo calcula `resolverReto` con `contarInstrucciones` sobre la referencia; nunca se
  escribe a mano (R4.2, R4.6, R5.5).

## Components and Interfaces

| Módulo | Cambio | Requisitos |
|---|---|---|
| `src/lenguaje/errores.ts` | `limiteDuroExcedido` gana `mundo`; tabla `SUGERENCIA_DE_BLOQUEO_POR_MUNDO` con fallback al mundo 3 | 2.1 a 2.6, 13 |
| `src/main.ts` | pasa `mundo` a `limiteDuroExcedido`; `registrarSenal`; `lanzarDemostracion`; `verEnParalelo`; estado del desafío; cableado del control | 2, 11, 12 |
| `src/ui/globo-kiro.ts` | callback opcional `alAbrirPista` | 11.1 |
| `src/ui/controles.ts` | acción `paralelo` («Ver en paralelo») y `verEnParalelo` | 11.3 |
| `src/ui/control-desafio.ts` | **nuevo**: botón del desafío infinito | 12 |
| `src/ui/reproduccion-paralelo.ts` | sin cambios; solo se instancia en `main.ts` | 11.3 |
| `src/juego/desafio-infinito.ts` | sin cambios | 7, 12 |
| `src/juego/insignias.ts` | tipos separados, `INSIGNIAS_DE_CONCEPTO`, `insigniasTransversalesOtorgadas` | 14, 11.10 |
| `src/juego/progreso.ts` | sin cambios de lógica; documentación de los 7 métodos | 16 |
| `src/pruebas/tiempos.ts` | **nuevo**: `TIMEOUT_TRES_ESTRELLAS` | 15 |
| `docs/` | descripción de los 7 `Metodos_De_Senal` (ver abajo) | 16 |
| `src/niveles/mundo-3-rosetones.ts`, `generadores/rosetón.ts`, `flor.ts`, `registro.ts`, `catalogo.ts` | niveles y generadores del mundo 3 | 3 a 6 |

### Documentación de los métodos de señal (R16)

Se agrega una sección en español a `docs/` (en `docs/README.md` o en un archivo nuevo `docs/senales-de-progreso.md`,
a decidir en las tareas) con una tabla de los siete métodos:

| Método | Señal | Quién la escribe | Quién la lee | Insignia | Efecto en `localStorage` |
|---|---|---|---|---|---|
| `marcarPistaAbierta(id)` | pista abierta en el nivel | `main.ts` vía `alAbrirPista` | `pistaAbiertaEn` | Sin pistas | persiste solo la primera vez |
| `pistaAbiertaEn(id)` | lectura | — | `insignias.ts` | Sin pistas | ninguno |
| `registrarVistaDemostracion(id)` | +1 vista | `main.ts` | `vistasDemostracionDe` | Buen ojo | persiste en cada llamada |
| `vistasDemostracionDe(id)` | lectura | — | `insignias.ts` | Buen ojo | ninguno |
| `marcarReproduccionParalelaUsada()` | bandera global | `main.ts` vía «Ver en paralelo» | `reproduccionParalelaUsada`, `guardar` | Depurador | persiste solo la primera vez; **no retrocede** |
| `reproduccionParalelaUsada()` | lectura | — | `guardar` | Depurador | ninguno |
| `aprobadoTrasReproduccionParalelaEn(id)` | aprobación posterior | `guardar` | `insignias.ts` | Depurador | se escribe dentro de `guardar`; **no retrocede** |

Debe además decir que las señales son anónimas y no registran datos personales (R16.2).

## Data Models

### Parámetros del error de bloqueo

```typescript
readonly limiteDuroExcedido: {
  readonly usadas: number;   // entero, conteo del jugador (N)
  readonly limite: number;   // entero, limiteDuro (M), con usadas > limite
  readonly mundo: number;    // entero, mundo del reto, elige la sugerencia
};
```

### Estado del desafío en `main.ts` (no persistente)

```typescript
interface DesafioEnCurso { readonly mundo: Mundo; readonly raiz: number; indice: number }
let desafio: DesafioEnCurso | null = null;
```

Se recalcula el reto con `retoDesafio(mundo, raiz, indice)`; no se guarda la secuencia (R7.4).

### Señales en `Progreso` (sin cambios)

`pistaAbierta: boolean` y `vistasDemostracion: number` por nivel; `aprobadoTrasReproduccionParalela:
boolean` por nivel; `reproduccionParalelaUsada: boolean` global. Son anónimas y encajan en el formato
versión 2 con lectura tolerante.

## Error Handling

| Situación | Dónde | Resultado |
|---|---|---|
| Programa supera `limiteDuro` activo | guarda en `main.ts` | `limiteDuroExcedido` con `N`, `M`, `N − M` y la sugerencia del mundo; no se ejecuta nada |
| Mundo sin sugerencia definida | `errores.ts` | usa la del mundo 3 (R13.3) |
| `usadas ≤ limite` o parámetros no enteros | `crearError` | `solicitudDeErrorInvalida`, como el resto del catálogo |
| Falla `localStorage` al escribir una señal | `registrarSenal` | `console.error`; la acción del jugador continúa (R11.11) |
| «Ver en paralelo» sin intento ejecutado | `verEnParalelo` | no hace nada; el botón está deshabilitado |
| `codificar` rechaza la raíz del desafío | `control-desafio` | se omite el código compartible; el desafío sigue |
| Generador del mundo 3 agota intentos | generadores | `generadorSinCandidato` |

## Testing Strategy

Dual: pruebas de propiedad (mínimo 100 iteraciones, `fast-check` si ya es una dependencia del
proyecto; en caso contrario, generación con el PRNG propio) y pruebas de ejemplo. Cada propiedad
lleva la etiqueta **Feature: 04-mundo-3-rosetones, Property N**.

**Unitarias y de ejemplo**

- `errores.test.ts`: mundos 3, 4 y 5 incluyen su sugerencia; un mundo sin entrada usa la del 3; `N`, `M`
  y `N − M` aparecen; parámetros inválidos caen en `solicitudDeErrorInvalida`.
- `globo-kiro.test.ts`: `alAbrirPista` se invoca al mostrar cada escalón y **no** con «Ya te di todas».
- `controles.test.ts`: la acción `paralelo` nace deshabilitada, se habilita con un intento y se
  deshabilita durante la ejecución.
- `control-desafio.test.ts`: oculto / disponible / en curso; sin control de retroceso; operable con
  teclado; nombre accesible en español.
- `insignias.test.ts`: las claves de `MUNDO_DE_INSIGNIA` igualan `INSIGNIAS_DE_CONCEPTO`; los resultados
  existentes no cambian (R14.5). Una prueba de tipos (`// @ts-expect-error`) comprueba que consultar el
  mundo de una transversal no compila (R14.3).
- Lectura del repositorio (R15.4): una prueba que falla si en las regresiones de 200 semillas de
  los mundos 2 y 3 aparece un literal de timeout distinto de la constante.

**De punta a punta (R11.9, R11.10, R12.8)** sobre `crearAplicacion` con un almacén en memoria y
`Progreso` recargado desde él:

1. Pedir una pista → `pistaAbiertaEn(nivel)` verdadero (R11.1).
2. Entrar a un nivel / pulsar «Ver la demostración» → `vistasDemostracionDe(nivel)` crece en uno por
   demostración (R11.2).
3. Ejecutar un intento, pulsar «Ver en paralelo» → `reproduccionParalelaUsada()` verdadero (R11.3).
4. Aprobar 5 niveles tras el paso 3 → `insigniasTransversalesOtorgadas` incluye `depurador` (R11.8).
5. Completar un mundo sin abrir pistas → incluye `sinPistas`; abrir una pista en cualquier nivel del
   mundo lo impide (R11.5, R11.6).
6. Resolver un nivel con una sola demostración vista → incluye `buenOjo` (R11.7).
7. Completar un mundo, activar el control del desafío y comprobar que se carga un reto generado de ese
   mundo (R12.8).

**Regresión obligatoria del catálogo** (steering `tecnologia`): todo reto aprueba su nivel con las tres
estrellas; los generados, sobre al menos 200 semillas, con `TIMEOUT_TRES_ESTRELLAS`.

## Correctness Properties

*Una propiedad es una característica o comportamiento que debe cumplirse en todas las ejecuciones
válidas del sistema: una afirmación formal sobre lo que el sistema debe hacer. Las propiedades son el
puente entre la especificación legible por personas y las garantías de corrección verificables por
máquina.*

La reflexión sobre redundancias fundió: la sugerencia por mundo de R2.2 a R2.4 con la de R13.1 a R13.3
(Property 3); la forma del rosetón y la de la flor (Property 11); el determinismo y la rotación del
desafío (Property 13); y las condiciones de las insignias transversales con las de R11.5 a R11.8
(Property 18).

### Property 1: La guarda de límite duro ejecuta si y solo si el conteo cabe

Para todo reto con `limiteDuroActivo` verdadero y todo programa válido del jugador, la ejecución emite
operaciones de tortuga si y solo si el conteo del programa es menor o igual que `limiteDuro`. Si lo
excede, no se emite ninguna operación y no se dibuja ninguna estela.

**Validates: Requirements 1.3, 1.4, 1.6, 1.7**

### Property 2: En los mundos 0 a 2 el exceso de presupuesto ejecuta sin economía

Para todo reto de los mundos 0 a 2 y todo programa válido cuyo conteo es estrictamente mayor que
`presupuestoEstrella`, la ejecución produce operaciones y la estrella de economía no se otorga.

**Validates: Requirements 1.5, 10.3**

### Property 3: El mensaje de bloqueo nombra la cuenta y usa la sugerencia de su mundo

Para todo mundo con límite duro activo y todo par de enteros `N > M`, el `Mensaje_Limite_Excedido`
contiene `N`, `M` y `N − M`, y contiene la sugerencia definida para ese mundo (anidar `REPITE` en el 3,
usar parámetros en el 4, usar recursión en el 5). Para todo mundo sin sugerencia definida, contiene la
del mundo 3.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 13.1, 13.2, 13.3, 13.4**

### Property 4: El mensaje de bloqueo no revela la figura ni el presupuesto

Para todo mundo, todo par `N > M` y todo nivel, el texto del `Mensaje_Limite_Excedido` no contiene el
valor de `presupuestoEstrella`, ni la palabra «presupuesto», ni texto del programa de referencia.

**Validates: Requirements 2.5, 13.5**

### Property 5: El contador del editor señala bloqueo si y solo si el conteo supera el límite activo

Para todo conteo mostrado con el límite duro activo, el contador señala el bloqueo, por texto y en su
nombre accesible, si y solo si el conteo es estrictamente mayor que el `limiteDuro` del reto en curso.

**Validates: Requirements 2.7, 2.8**

### Property 6: La normalización fija niega la precisión a una figura trasladada o rotada

Para toda figura que coincide con la referencia y toda traslación o rotación aplicada más allá de la
tolerancia de dilatación, validar con `Normalizacion_Fija` no otorga la estrella de precisión.

**Validates: Requirements 3.3, 3.4**

### Property 7: El presupuesto de todo nivel del mundo 3 es el conteo de su referencia

Para todo nivel del mundo 3 (autorado o generado, sobre cualquier semilla), el `presupuestoEstrella`
es igual al conteo de instrucciones de su programa de referencia, sin ningún número de presupuesto
escrito a mano en los datos del nivel.

**Validates: Requirements 4.6, 5.5**

### Property 8: Toda referencia del mundo 3 aprueba su propio nivel con las tres estrellas

Para todo nivel del mundo 3 y, en los generados, para toda semilla de al menos 200 consecutivas, el
programa de referencia obtiene las tres estrellas al validarse contra su propio nivel.

**Validates: Requirements 4.7, 5.9**

### Property 9: El reto generado aceptado encuadra y no degenera

Para toda semilla, el reto que un `Generador_M3` acepta tiene una caja envolvente alineada a los ejes
con ancho y alto mayores o iguales que 200 px y contenida en `[−400, 400]` en ambos ejes.

**Validates: Requirements 5.6, 5.7**

### Property 10: Los generadores emiten solo números adivinables

Para toda semilla, la referencia de un `Generador_M3` usa únicamente longitudes múltiplos de 20 y
ángulos derivables (`360/n` con `n` de 3 a 12, o múltiplos de 15).

**Validates: Requirements 5.4**

### Property 11: Los generadores producen la forma anidada pedida

Para toda semilla, la referencia del nivel 3.2 es un `REPITE` de copias (con `c` en
`{6, 8, 9, 12, 18, 36}`) que contiene el `REPITE` de una figura de 3 a 6 lados y el giro entre copias,
y la del nivel 3.3 tiene la forma `REPITE c [REPITE n [GD a AV L] GD 360/c]`.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 12: La estrella de abstracción depende solo de si el AST tiene un REPITE anidado

Para todo intento que gana la precisión en un nivel del mundo 3, la estrella de abstracción se otorga
si y solo si su AST contiene un `REPITE` entre los descendientes de otro `REPITE`. Dos textos distintos
con el mismo AST obtienen el mismo veredicto.

**Validates: Requirements 6.2, 6.3, 6.4**

### Property 13: El desafío infinito es determinista por su raíz y rota entre los generados

Para todo mundo con niveles generados, toda raíz y todo índice `i`, el reto `(idNivel, semilla)` es el
mismo en cualquier recálculo, dos recorridos con la misma raíz producen la misma sucesión, y el
`idNivel` es el que ocupa la posición `i mod cantidadDeGenerados` en el orden del catálogo.

**Validates: Requirements 7.3, 7.4, 7.6**

### Property 14: El desafío está disponible si y solo si el mundo está completo y tiene generados

Para todo mundo y todo progreso, el `Desafio_Infinito` está disponible si y solo si el mundo tiene al
menos un nivel generado y todos sus niveles tienen la estrella de precisión.

**Validates: Requirements 7.1, 7.2, 7.8**

### Property 15: La insignia Simetría se otorga si y solo si el mundo 3 tiene las tres estrellas

Para todo progreso, la `Insignia_Simetria` se otorga si y solo si cada nivel del mundo 3 tiene sus tres
estrellas de forma simultánea.

**Validates: Requirements 8.1, 8.2**

### Property 16: El otorgamiento de toda insignia es función pura e idempotente del progreso

Para todo progreso, el otorgamiento de cada insignia (de concepto o transversal) depende solo del
progreso y del catálogo; evaluarlo repetidamente da siempre el mismo resultado y nunca crea una segunda
instancia.

**Validates: Requirements 8.3, 8.4, 9.5, 9.6**

### Property 17: Cada insignia transversal se deriva de su señal en el progreso

Para todo progreso, cada transversal se otorga exactamente cuando se cumple su condición: *Depurador*
con 5 niveles aprobados tras usar la reproducción en paralelo; *Minimalista* con economía en 10
niveles; *Sin pistas* al completar un mundo sin pista abierta en ninguno de sus niveles; *Buen ojo* al
resolver un nivel con exactamente una demostración vista. Abrir una pista en un nivel de un mundo
impide *Sin pistas* en ese mundo.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 11.5, 11.6, 11.7, 11.8**

### Property 18: Cada acción del jugador escribe su señal en el nivel correcto

Para todo nivel del catálogo y toda secuencia de acciones del jugador en la interfaz, abrir una pista
marca la pista abierta solo de ese nivel; cada demostración mostrada suma exactamente una vista a ese
nivel; y iniciar la reproducción en paralelo marca la bandera global. Un nivel aprobado con precisión
después de iniciar la reproducción en paralelo devuelve verdadero en `aprobadoTrasReproduccionParalelaEn`.

**Validates: Requirements 11.1, 11.2, 11.3, 11.4**

### Property 19: Un fallo al persistir una señal no interrumpe la acción del jugador

Para toda señal cuyo método de escritura lance una excepción, la acción de la interfaz que la dispara
(pedir pista, ver la demostración, ver en paralelo) completa su efecto visible y no propaga el error.

**Validates: Requirements 11.11**

### Property 20: El control del desafío es visible si y solo si el desafío está disponible

Para todo progreso y todo nivel en curso, la interfaz muestra el `Control_Desafio_Infinito` si y solo si
`desafioDisponible(mundo del nivel, progreso)` es verdadero.

**Validates: Requirements 12.1, 12.2**

### Property 21: La raíz del desafío se comparte sin pérdida

Para toda `Semilla_Raiz` válida, el código que la interfaz muestra al iniciar el desafío, decodificado
con `decodificar`, devuelve la misma raíz.

**Validates: Requirements 12.6**

### Criterios sin propiedad

Se verifican por ejemplo, por inspección o por el compilador, no como propiedades universales: 2.6, 7.5,
10.1, 10.2, 10.4 y 10.5 (restricciones de arquitectura y alcance); 3.1, 3.2, 3.5, 3.6, 4.1 a 4.5, 5.8 y
6.1 (datos declarativos del catálogo); 7.7 (ejemplo sobre el catálogo); 11.9, 11.10 y 12.8 (exigencias
sobre el conjunto de pruebas, cubiertas en la Testing Strategy); 12.3, 12.4, 12.5 y 12.7 (ejemplos de
interfaz); 14.1 a 14.5 (compilador y no regresión); 15.1 a 15.4 (configuración de pruebas); 16.1 a 16.4
(documentación) y 17.1 a 17.4 (proceso del equipo).
