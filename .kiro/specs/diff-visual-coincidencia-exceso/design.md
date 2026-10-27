# Diseño del Arreglo — diff-visual-coincidencia-exceso

## Overview

En la vista de superposición de KiroLogo, el diff visual (verde = coincide, rojo = sobra, punteado =
falta) pinta mal el excedente del Caso 1: en normalización libre (Mundo 0 y Mundo 1), cuando la
estrella de precisión fue negada por exceso de trazo y el jugador se pasó poco respecto de Kiro, el
excedente real apenas se marca de rojo (una puntita de ~2px, imperceptible) y casi todo el trazo sale
verde. El jugador debería ver verde hasta donde su trazo coincide y rojo todo el excedente real a lo
largo del trazo.

La causa raíz está **verificada** y es la misma que describe el `bugfix.md`: en `src/motor/validador.ts`,
`comparar(ad, bd)` calcula las tres regiones (`coincidencia = Ad ∩ Bd`, `exceso = Bd \ Ad`,
`falta = Ad \ Bd`) sobre máscaras **dilatadas** por un disco de radio 8px. La dilatación infla la línea
de Kiro ~8px más allá de su extremo, de modo que `coincidencia` absorbe el excedente del jugador hasta
~8px y `exceso` solo marca la puntita restante. `src/ui/diff.ts` pinta **fielmente** las máscaras que
recibe (clasifica cada tramo del jugador según las regiones `exceso`/`coincidencia`): no es la causa.
`veredictoParaMostrar` tampoco (ya descartado).

La estrategia del arreglo (Opción A, justificada abajo): **derivar en `comparar`/`validar` una máscara
de exceso visual adicional**, calculada como el trazo del jugador que cae fuera de la máscara de Kiro
**sin dilatar** (o dilatada con un radio menor), de modo que el excedente a lo largo del trazo se pinte
rojo. La región `exceso` que alimenta `excesoPorcentaje` (y por tanto el veredicto y las estrellas) se
**mantiene intacta** (dilatada, como hoy). El diff visual recibe por separado la máscara de exceso
visual y la usa solo para **pintar**, no para decidir la estrella.

Restricción crítica, confirmada en código: en `comparar` (líneas ~206-252), las tres máscaras **y** el
`excesoPorcentaje` (`soloBd / totalAd * 100`, umbral `UMBRAL_EXCESO = 5`) se calculan en la **misma
pasada** sobre las dilatadas. Por eso el fix **no puede** recalcular `exceso` sobre máscaras sin dilatar
y reusar esa máscara para el conteo: eso alteraría `excesoPorcentaje`, `coincide` y `motivo`. La máscara
de exceso **visual** es una salida **nueva y separada**; `excesoPorcentaje`/`coincide`/`motivo` se
siguen computando exactamente igual que hoy.

Alcance: **solo el Caso 1**. No se toca el Caso 2 (desempate por IoU en `veredictoParaMostrar`, spec
separado) ni el Caso 3 (coincidencia = no se pinta diff, intencional).

## Glossary

- **Bug_Condition (C)**: la condición que dispara el bug — en normalización libre, con la estrella de
  precisión negada por exceso de trazo y el jugador trazando un poco más que Kiro, la región de exceso
  que se pinta (derivada sobre máscaras dilatadas) absorbe el excedente real como coincidencia y el rojo
  queda reducido a una puntita imperceptible.
- **Property (P)**: el comportamiento deseado — la región de exceso que se **pinta** cubre el excedente
  real del trazo del jugador a lo largo de todo el trazo, sin que la dilatación de la máscara de Kiro lo
  absorba como coincidencia.
- **Preservation**: lo que debe quedar intacto — `excesoPorcentaje`, `coincide` y `motivo` (la estrella
  de precisión), la alineación libre de una figura **correcta** movida (sigue toda verde), el
  comportamiento fijo/fija (Mundo 3+), la coincidencia otorgada, la estela vacía, y el pintado fiel de
  `src/ui/diff.ts`.
- **`comparar`**: función de `src/motor/validador.ts` que, sobre dos máscaras dilatadas `ad` (objetivo)
  y `bd` (jugador), calcula IoU, `excesoPorcentaje` y las tres regiones en una sola pasada. Es donde se
  deriva la nueva máscara de exceso visual.
- **`validar`**: función de `src/motor/validador.ts` que rasteriza, dilata y compara; devuelve el
  `Veredicto`. Propaga la nueva máscara de exceso visual al veredicto.
- **`veredictoParaMostrar`**: función que, solo para pintar, elige entre el veredicto oficial y el de
  las posiciones reales. **No se toca** en este arreglo (es el foco del Caso 2, fuera de alcance).
- **Máscara dilatada (`ad`, `bd`)**: `dilatar(rasterizar(...))`, con el disco de radio 8px. Es la base
  del cálculo del veredicto y de las estrellas; no cambia.
- **Exceso (de conteo)**: `Bd \ Ad` sobre dilatadas. Alimenta `excesoPorcentaje`. **Intacto.**
- **Exceso visual**: máscara **nueva** = trazo del jugador fuera de la máscara de Kiro **sin dilatar**
  (o con radio menor). Solo para pintar; no alimenta ningún cálculo del veredicto.
- **`excesoPorcentaje`**: `soloBd / totalAd * 100` sobre dilatadas; con `UMBRAL_EXCESO = 5` decide la
  estrella de precisión. **No cambia.**

## Bug Details

### Bug Condition

El bug se manifiesta en niveles de **normalización libre** (Mundo 0 y Mundo 1), cuando la estrella de
precisión fue **negada** por exceso de trazo (`motivo === 'excesoDeTrazo'`, hay diff que pintar porque
`!coincide`) y el jugador trazó un poco más que Kiro. La región `exceso` que se pinta, derivada sobre
máscaras **dilatadas** por el disco de radio 8px, absorbe el excedente real del jugador como
coincidencia: la línea de Kiro queda inflada ~8px más allá de su extremo, `coincidencia = Ad ∩ Bd` se
adueña del excedente hasta ~8px, y `exceso = Bd \ Ad` solo marca la puntita restante.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input = { jugador: Segmento[], objetivo: Segmento[], normalizacion: NormalizacionNivel }
  OUTPUT: boolean

  oficial := validar(input.jugador, input.objetivo, input.normalizacion)

  RETURN esNormalizacionLibre(input.normalizacion)
         AND NOT oficial.coincide
         AND jugadorTieneTinta(input.jugador)
         AND excedeUnPoco(input.jugador, input.objetivo)   // el jugador se pasó poco respecto de Kiro
         AND excedenteRealVisible(input) ⊄ oficial.exceso   // el excedente real NO está cubierto por la
                                                            // región de exceso pintada (la dilatada lo
                                                            // absorbe como coincidencia)
END FUNCTION
```

### Examples

- **Caso 1 — línea 110 contra línea 100 (contraejemplo MEDIDO):** objetivo `AVANZA 100`
  (`[seg(0,0,0,100,0)]`); jugador `AVANZA 110` (`[seg(0,0,0,110,0)]`); normalización **libre**.
  Medido sobre el código actual: `coincidencia = 1897` celdas, `exceso = 170` celdas, `falta = 0`. En
  pantalla: verde de `y=0` a `y≈108`, rojo solo de `y≈108` a `y=110` (~2px, imperceptible). El excedente
  real (~10 unidades a lo largo del trazo) debería verse rojo. La región de exceso **pintada** debe
  cubrir el excedente real a lo largo del trazo, no solo la puntita.

- **Figura correcta movida (NO es el bug; debe seguir toda verde):** el jugador dibuja la figura
  completa y correcta pero trasladada o girada. Esperado y actual: alineación libre, toda verde, sin
  exceso. El arreglo debe preservar esto: la máscara de exceso visual debe salir vacía cuando no hay
  excedente real.

- **Estela vacía (caso límite):** el jugador no ejecutó nada; la falta es toda la figura de referencia,
  sin exceso. Sin cambios: el exceso visual sale vacío.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `excesoPorcentaje`, `coincide` y `motivo` se calculan igual que hoy sobre las máscaras dilatadas: la
  estrella de precisión (número de estrellas) y el veredicto **no cambian** (requisito 3.1).
- Una figura **correcta** pero trasladada o rotada en normalización libre (Mundo 0/1) sigue saliendo
  toda verde en el diff, sin exceso ni falta: la alineación libre no se altera (requisito 3.2).
- La normalización fija/fija (Mundo 3+) sigue comportándose exactamente como hoy (requisito 3.3).
- Cuando el jugador coincide (estrella otorgada), no se pinta diff; la estela-guía punteada de fondo
  queda intacta (requisito 3.4).
- `src/ui/diff.ts` sigue pintando **fielmente** las regiones que recibe; el arreglo no cambia cómo
  `diff.ts` clasifica y colorea los trazos, solo **qué máscara** usa para el exceso al pintar
  (requisito 3.5).
- Sin estela del jugador: la falta es toda la figura de referencia, sin exceso.

**Scope:**
Todo lo que NO es «normalización libre + estrella negada por exceso + el jugador se pasó poco» queda
completamente inalterado. En particular:
- El cálculo del veredicto y de las estrellas (`excesoPorcentaje`, `coincide`, `motivo`,
  `src/juego/estrellas.ts`).
- El Caso 2 (`veredictoParaMostrar` y su desempate por IoU): **no se toca**, spec separado.
- El Caso 3 (coincidencia = no se pinta diff; estela-guía): intencional, no se toca.
- Normalización fija/fija (Mundo 3+).

(El comportamiento correcto concreto se define en «Correctness Properties», Propiedad 1.)

## Hypothesized Root Cause

Causa raíz **confirmada** con contraejemplo medido (no hipótesis especulativa): el defecto está en
**cómo se deriva la región `exceso` que se pinta**, no en `src/ui/diff.ts` ni en `veredictoParaMostrar`.

1. **La región de exceso se deriva sobre máscaras dilatadas (causa principal confirmada)**: en
   `src/motor/validador.ts`, `validar` construye las máscaras con `dilatar(rasterizar(...))` (disco de
   radio 8px) y `comparar` opera sobre esas dilatadas (`ad`, `bd`). `exceso = Bd \ Ad` hereda la
   dilatación: la línea de Kiro inflada ~8px absorbe el excedente del jugador dentro de
   `coincidencia = Ad ∩ Bd`, y a `exceso` solo le queda la puntita del extremo (medido: 170 celdas,
   casi todo concentrado en la punta, vs. 1897 de coincidencia).

2. **`src/ui/diff.ts` pinta fielmente (no es la causa)**: en `dibujarLimpio`, cada tramo del jugador se
   clasifica muestreando su punto medio y consultando primero `encendida(regiones.exceso, ...)` y luego
   `encendida(regiones.coincidencia, ...)`. El color sale **directamente** de las máscaras recibidas.
   Si la máscara de exceso que llega es la dilatada, el rojo es solo la puntita. El defecto está aguas
   arriba, en la máscara que se le entrega.

3. **`veredictoParaMostrar` no es la causa del Caso 1 (ya descartado)**: el síntoma aparece con la
   comparación que elige hoy; cambiar esa elección no corrige el excedente absorbido por la dilatación.
   Ese punto es el foco del Caso 2 y queda fuera de alcance.

4. **El cálculo compartido obliga a separar la salida**: `excesoPorcentaje`, `coincide` y `motivo` se
   computan en la misma pasada que las tres máscaras, sobre las dilatadas. Recalcular `exceso` sin
   dilatar y reusarlo cambiaría el conteo y, con él, la estrella. Por eso la máscara de exceso visual
   debe ser una **salida nueva y separada** de la que alimenta el veredicto.

## Correctness Properties

Property 1: Bug Condition - La región de exceso pintada cubre el excedente real

_For any_ input where the bug condition holds (isBugCondition returns true) —normalización libre,
estrella negada por exceso de trazo y el jugador trazando un poco más que Kiro—, el código arreglado
SHALL producir una región de exceso **para pintar** que cubra el excedente real del trazo del jugador
respecto de la línea de Kiro a lo largo de todo el trazo (no solo una puntita), sin que la dilatación de
la máscara de Kiro absorba ese excedente como coincidencia.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Veredicto, estrellas y figura correcta movida intactos

_For any_ input where the bug condition does NOT hold (isBugCondition returns false), el código
arreglado SHALL producir exactamente el mismo resultado que el código original en `excesoPorcentaje`,
`coincide` y `motivo` (de modo que la estrella de precisión no cambie); una figura **correcta** pero
trasladada o rotada en normalización libre SHALL seguir saliendo toda verde (exceso visual vacío); la
normalización fija/fija (Mundo 3+) SHALL comportarse como hoy; la coincidencia otorgada y la estela
vacía SHALL comportarse como hoy; y `src/ui/diff.ts` SHALL seguir pintando fielmente las regiones que
recibe.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Opción elegida y tradeoffs

Se evaluaron tres enfoques para exponer el excedente real sin tocar el conteo del veredicto:

- **Opción A (ELEGIDA) — máscara de exceso visual derivada sin dilatar (o con radio menor).** `comparar`
  produce una salida **nueva** `excesoVisual` = trazo del jugador fuera de la máscara de Kiro sin
  dilatar (o dilatada con radio menor), además de las tres regiones dilatadas de siempre. El `exceso`
  que alimenta `excesoPorcentaje` se mantiene dilatado e intacto. El `Veredicto` gana un campo opcional
  `excesoVisual`; `RegionesDiff` lo recibe por separado y `diff.ts` lo usa solo para clasificar los
  tramos del jugador al pintar.
  - *Ventaja*: separa limpiamente «lo que se pinta» de «lo que cuenta»; el invariante «figura correcta
    movida = toda verde» se preserva de forma natural (si no hay excedente real, `excesoVisual` sale
    vacía); el riesgo sobre las estrellas es nulo por construcción (no se toca el conteo).
  - *Tradeoff*: añade un campo al `Veredicto`/`RegionesDiff` y una nueva salida en `comparar`; hay que
    decidir dónde se calcula (en `comparar`, con las máscaras sin dilatar disponibles) y cómo llega a
    `diff.dibujar` (vía `Veredicto` → `pintarDiff` en `comparacion.ts` → `RegionesDiff`).

- **Opción B — recortar la región `exceso` pintada al eje real del trazo (proyección).** Mantiene el
  conteo y proyecta geométricamente el exceso al eje del trazo del jugador.
  - *Tradeoff*: geométricamente más complejo y frágil en curvas/esquinas; mayor superficie de error para
    el mismo resultado que A. Descartada.

- **Opción C — erosionar la coincidencia solo para pintar, devolviendo a exceso lo absorbido.**
  - *Tradeoff*: la erosión puede introducir **falsos positivos** de exceso en esquinas y curvas (marca
    de rojo tramos que sí coinciden), lo que riñe con el invariante «figura correcta movida = toda
    verde». Descartada por el riesgo de regresión visual.

La Opción A es la que mejor preserva el invariante «figura correcta movida = toda verde» (el cambio solo
ensancha el rojo donde hay excedente **real** del trazo, no en figuras que coinciden) y la que minimiza
el riesgo sobre las estrellas (no toca el conteo en absoluto). La implementación exacta se fija en
RED→GREEN; esta sección fija el enfoque y los puntos de código.

### Changes Required

**Archivo 1**: `src/motor/validador.ts`

- **`comparar(ad, bd, ...)`**: además de las tres regiones dilatadas de siempre, derivar la máscara
  **nueva** `excesoVisual`: las posiciones del trazo del jugador que caen **fuera** de la máscara de
  Kiro **sin dilatar** (o dilatada con un radio menor que 8px). Para ello, `comparar` necesita acceder a
  la máscara objetivo **sin dilatar** (o con radio menor): se pasa como parámetro adicional, o `validar`
  calcula `excesoVisual` tras `comparar` con las máscaras sin dilatar que ya tiene a mano. **No se
  modifican** `interseccion`, `soloAd`, `soloBd`, `totalAd`, `union`, `iou`, `excesoPorcentaje`,
  `coincide` ni `motivo`: la pasada que los calcula queda **byte a byte igual**.
- **`validar(...)`**: propagar `excesoVisual` al `Veredicto` en las tres ramas (sin estela / rotación
  libre / rotación fija). En la rama sin estela y en «figura correcta movida» (sin excedente real),
  `excesoVisual` sale vacía. La máscara de Kiro sin dilatar/giro necesaria para derivar `excesoVisual`
  es la ya rasterizada antes de `dilatar`; se preserva su disponibilidad en el punto de cálculo.
- **`interface Veredicto`**: añadir el campo opcional `readonly excesoVisual?: Mascara;` (opcional para
  no romper los veredictos de prueba existentes que no lo fijan).

**Archivo 2**: `src/ui/diff.ts`

- **`interface RegionesDiff`**: añadir `readonly excesoVisual?: Mascara;`.
- **`dibujarLimpio`**: al clasificar cada tramo del jugador, usar `regiones.excesoVisual` (cuando está
  presente) **en lugar de** `regiones.exceso` para decidir el rojo; la coincidencia pintada es el trazo
  del jugador que **no** cae en `excesoVisual`. Si `excesoVisual` no viene (llamadas antiguas), el
  comportamiento es el de hoy (usa `regiones.exceso`), de modo que `diff.ts` sigue pintando fielmente.
  El dibujo de la **falta** (desde la referencia) no cambia.

**Archivo 3**: `src/ui/comparacion.ts`

- **`pintarDiff(v)`**: incluir `excesoVisual: v.excesoVisual` en el objeto `RegionesDiff` que se pasa a
  `deps.diff.dibujar(...)`. El resto de campos no cambia.

**No se toca**:
- El cálculo de `excesoPorcentaje`/`coincide`/`motivo`/`iou` en `comparar` (requisito 3.1).
- `veredictoParaMostrar` ni su desempate por IoU (Caso 2, fuera de alcance).
- `src/juego/estrellas.ts` ni ningún origen de las estrellas.
- `pintarVista` para el caso de coincidencia ni la estela-guía (Caso 3, intencional).
- La firma de la llamada desde `src/main.ts`.

## Testing Strategy

### Validation Approach

Dos fases: primero surgir un contraejemplo que demuestre el bug sobre el código **sin arreglar**
(exploratory bug condition checking), y luego verificar que el arreglo lo corrige (fix checking) sin
romper lo que ya anda (preservation checking). El runner del proyecto es **Vitest** (`npm test`, que
corre `vitest --run`) y el proyecto ya usa **fast-check** para pruebas de propiedad. Las pruebas de la
máscara de exceso visual viven en `src/motor/validador.test.ts`; las de pintado fiel, en
`src/ui/diff.test.ts`.

### Exploratory Bug Condition Checking

**Goal**: surgir el contraejemplo que demuestra el bug ANTES de implementar el arreglo, y confirmar la
causa raíz (la región de exceso derivada sobre máscaras dilatadas absorbe el excedente real). Debe
**FALLAR** sobre el código actual.

**Test Plan**: construir el Caso 1 medido (línea Kiro `AVANZA 100` = `[seg(0,0,0,100,0)]` vs jugador
`AVANZA 110` = `[seg(0,0,0,110,0)]`, normalización **libre**), validar, y afirmar que la región de
exceso **para pintar** cubre el excedente real a lo largo del trazo (no solo ~2px). Correr sobre el
código SIN arreglar para observar el fallo.

**Test Cases**:
1. **Caso 1 — exceso oculto (línea 110 vs línea 100)**: afirmar que la región de exceso que se pinta
   cubre el excedente real a lo largo del trazo del jugador (p. ej. que hay posiciones de exceso visual
   repartidas desde ~`y=100` hasta `y=110`, no concentradas en una puntita de ~2px). Sobre el código
   actual, `exceso` tiene solo ~170 celdas casi todas en la punta: **fallará**.

**Expected Counterexamples**:
- La región de exceso pintada no cubre el excedente real: el rojo queda reducido a la puntita del
  extremo (~2px), mientras la coincidencia dilatada absorbe ~8px del excedente.
- Causa confirmada: el `exceso = Bd \ Ad` se deriva sobre máscaras dilatadas por el disco de radio 8px.

### Fix Checking

**Goal**: verificar que para toda entrada que dispara el bug, la región de exceso **para pintar** cubre
el excedente real del trazo, sin cambiar el veredicto.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  v' := validar_fixed(input.jugador, input.objetivo, input.normalizacion)
  // Fix Checking: el excedente real visible se pinta como exceso.
  ASSERT excedenteRealVisible(input) ⊆ v'.excesoVisual
  // El veredicto y las estrellas quedan intactos.
  v  := validar_original(input.jugador, input.objetivo, input.normalizacion)
  ASSERT v'.excesoPorcentaje = v.excesoPorcentaje
  ASSERT v'.coincide         = v.coincide
  ASSERT v'.motivo           = v.motivo
END FOR
```

### Preservation Checking

**Goal**: verificar que para toda entrada que NO dispara el bug, el arreglo se comporta igual que el
código original en todo lo que decide el veredicto, y que el exceso visual no introduce rojo donde no
debe.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // El veredicto y las estrellas son idénticos antes y después.
  ASSERT validar_original(input).excesoPorcentaje = validar_fixed(input).excesoPorcentaje
  ASSERT validar_original(input).coincide         = validar_fixed(input).coincide
  ASSERT validar_original(input).motivo           = validar_fixed(input).motivo
END FOR
```

**Testing Approach**: la prueba de propiedad es la adecuada para la preservación porque genera muchos
casos en todo el dominio de figuras y captura bordes que las pruebas por ejemplo no cubren. El proyecto
ya tiene el arbitrario `figuraArb` (polilínea conexa de 1–4 tramos, coordenadas enteras en [-150,150]) y
la propiedad «el IoU mostrado nunca baja del oficial y las estrellas no cambian», que debe seguir
pasando **intacta** tras el arreglo.

**Test Plan**: comparar `excesoPorcentaje`/`coincide`/`motivo` antes y después con `figuraArb` + `validar`
directo; observar el comportamiento sobre el código SIN arreglar para los casos no-bug (figura correcta
movida, fija/fija, coincidencia, estela vacía) y fijar que el arreglo no lo altera.

**Test Cases**:
1. **Veredicto idéntico (3.1)**: property test con `figuraArb` × `figuraArb`; `validar` arreglado y
   original coinciden en `excesoPorcentaje`, `coincide` y `motivo` (≥ 100 iteraciones).
2. **Figura correcta movida sigue toda verde (3.2)**: figura completa y correcta, trasladada/girada; el
   exceso visual sale **vacío** (sin rojo), igual que hoy la figura sale toda verde.
3. **Fija/fija (3.3)**: con normalización fija/fija, el comportamiento es idéntico al actual.
4. **Coincidencia otorgada (3.4)**: un dibujo que coincide no pinta diff (prueba existente, debe seguir
   pasando).
5. **Estela vacía (3.5)**: sin estela del jugador, la falta es la figura de referencia y el exceso
   visual sale vacío (prueba existente reforzada).
6. **`diff.ts` sigue pintando fiel (3.5)**: la propiedad existente de `src/ui/diff.propiedad.test.ts`
   (las máscaras recibidas se pintan fielmente, sin modificarlas) sigue verde; con `excesoVisual`
   ausente, `diff.ts` usa `exceso` como hoy.
7. **Property existente intacta**: «el IoU mostrado nunca baja del oficial + las estrellas no cambian»
   (`src/motor/validador.test.ts`) sigue verde.

### Unit Tests

- Caso 1 (línea 110 vs línea 100): la región de exceso visual cubre el excedente real a lo largo del
  trazo (no solo la puntita) y el veredicto (`excesoPorcentaje`, `coincide`, `motivo`) es idéntico al
  del código actual.
- Figura correcta movida: exceso visual vacío (preservación de 3.2).
- Casos límite: estela vacía (3.5), coincidencia otorgada (3.4), fija/fija (3.3).

### Property-Based Tests

- **Veredicto invariante** (nueva): `validar` arreglado vs original coinciden en
  `excesoPorcentaje`/`coincide`/`motivo` con `figuraArb` (≥ 100 iteraciones) — garantiza que la estrella
  no cambia (3.1).
- **Preservación del IoU y de las estrellas** (propiedad existente, debe seguir verde): el IoU mostrado
  nunca baja del oficial y la precisión derivada del mostrado iguala a la del oficial, con `figuraArb`.
- **Pintado fiel** (propiedad existente de `diff.propiedad.test.ts`, debe seguir verde): `diff.ts` pinta
  las máscaras recibidas sin modificarlas.

### Integration Tests

- Flujo de superposición en `src/ui/comparacion.ts` con un veredicto de Caso 1: al pasar a superposición
  (`!v.coincide`), `pintarDiff` pasa `excesoVisual` a `diff.dibujar` y el rojo cubre el excedente real a
  lo largo del trazo; se verifica que `pintarVista` **no** cambia para el caso de coincidencia
  (estela-guía intacta, Caso 3 fuera de alcance).
- Cambio de nivel y de vista: redibujar la superposición tras el arreglo no altera el comportamiento de
  las vistas ni el anuncio `aria-live` (el texto de IoU y exceso sale de `excesoPorcentaje`, que no
  cambia).
