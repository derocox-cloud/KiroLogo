# Diseño del Arreglo — diff-visual-desfase-alineacion-caja (Caso 2)

## Overview

En la vista de superposición de KiroLogo, el diff visual (verde = coincide, rojo = sobra, punteado =
falta) pinta mal el **tramo inicial coincidente** del Caso 2: en normalización **libre/libre** (Mundo 0
y Mundo 1), cuando el jugador trazó la forma correcta pero con tramos largos un poco distintos a los de
Kiro, el tramo inicial que en pantalla está exactamente encima del de Kiro se pinta rojo + punteado (como
si sobrara o faltara) en vez de verde. El inicio de la figura del jugador queda descolocado ~10px
respecto de la de Kiro.

La causa raíz está **verificada en el código real** (no copiada del Caso 1) y combina dos piezas de
`src/motor/validador.ts`:

1. **`veredictoParaMostrar` elige por IoU.** Su última línea es `return real.iou >= oficial.iou ? real :
   oficial;`, donde `oficial` es el veredicto con la normalización del nivel (alineado por caja
   envolvente vía `traslacionAlCentro` + `buscarMejorGiro`) y `real` es el veredicto en
   `POSICIONES_REALES` (todo fijo). El desempate devuelve `real` **solo** cuando su IoU **iguala o
   supera** la de la alineada.

2. **La alineación por caja envolvente mete un desfase.** En el contraejemplo medido (nivel 0.3, reto
   `AC3VRQC`: Kiro con tramos de `140`, jugador con `150`), `oficial.iou = 0.7965 > real.iou = 0.7212`.
   Como `0.7212 >= 0.7965` es **falso**, `veredictoParaMostrar` devuelve `oficial`: la comparación
   **alineada**. `traslacionAlCentro` lleva el centro de la caja envolvente de cada figura al centro del
   arreglo; como las cajas del jugador (tramos de 150) y de Kiro (tramos de 140) tienen distinto centro,
   la figura del jugador queda desplazada ~10px. El tramo inicial, que en posiciones reales está encima
   del de Kiro, cae fuera de `coincidencia` y entra en `exceso`/`falta`.

`src/ui/diff.ts` pinta **fielmente** las regiones del veredicto que recibe (verificado: clasifica cada
tramo del jugador según `coincidencia`/`exceso`/`excesoVisual` y la falta según `falta`). El defecto del
Caso 2 **no** está en `diff.ts` sino en que el veredicto elegido para pintar (la comparación alineada)
descoloca el inicio.

La estrategia del arreglo (**Opción B**, justificada abajo): **ampliar el criterio de desempate de
`veredictoParaMostrar`** para que, cuando la comparación en posiciones reales explica la forma casi tan
bien como la alineada (su IoU está dentro de un margen pequeño), se pinte la de posiciones reales —la que
el jugador está viendo—, de modo que el tramo inicial coincidente se pinte verde. El cambio es **solo de
presentación** (`veredictoParaMostrar` nunca alimenta las estrellas) y preserva el invariante existente
`mostrado.iou >= oficial.iou` relajándolo a una tolerancia acotada, documentada y blindada por nuevas
pruebas; la figura correcta movida/girada sigue mostrándose alineada porque en su sitio su IoU cae muy
por debajo del margen.

**Restricción crítica, confirmada en código:** las estrellas salen del **veredicto oficial** (`validar`
con la normalización del nivel), que `src/main.ts` calcula por separado para la calificación
(`validar(...)` en la línea ~1280) y pasa a `veredictoParaMostrar(...)` solo para el diff (línea ~1329).
Este arreglo **NO** toca `validar`, `comparar`, `buscarMejorGiro` ni `traslacionAlCentro`; por
construcción, `excesoPorcentaje`, `coincide` y `motivo` del veredicto oficial quedan **byte a byte
iguales**. Tampoco toca `excesoVisual` (Caso 1) ni `src/ui/diff.ts`.

Alcance: **solo el Caso 2**. No se toca el Caso 1 (máscara `excesoVisual`, spec hermano, ya completo) ni
el Caso 3 (coincidencia = no se pinta diff, intencional) ni la normalización fija/fija (Mundo 3+).

## Glossary

- **Bug_Condition (C)**: la condición que dispara el bug — en normalización libre/libre, con la estrella
  de precisión negada, el jugador trazó la forma correcta pero con tramos largos un poco distintos;
  `veredictoParaMostrar` elige la comparación **alineada por caja envolvente** (porque su IoU es mayor), y
  esa alineación desplaza ~10px la figura, descolocando un tramo inicial que en **posiciones reales**
  coincide con el de Kiro y pintándolo rojo + punteado.
- **Property (P)**: el comportamiento deseado — el tramo inicial que en posiciones reales está sobre el de
  Kiro se pinta de verde (coincidencia), sin que el desfase de la alineación por caja lo clasifique como
  exceso o falta, y **sin** alterar el veredicto oficial del que salen las estrellas.
- **Preservation**: lo que debe quedar intacto — `excesoPorcentaje`, `coincide`, `motivo` e `iou` del
  veredicto **oficial** (la estrella de precisión); la alineación libre de una figura **correcta** movida
  o girada (sigue toda verde, alineada); la máscara `excesoVisual` del Caso 1 y su pintado; la
  normalización fija/fija (Mundo 3+); la coincidencia otorgada (Caso 3); y el pintado fiel de
  `src/ui/diff.ts`.
- **`veredictoParaMostrar`**: función de `src/motor/validador.ts` que, **solo para pintar**, elige entre
  el veredicto oficial (alineado por caja) y el de las posiciones reales. Es el **único** punto que se
  toca en este arreglo.
- **`validar`**: función de `src/motor/validador.ts` que rasteriza, dilata, alinea y compara; devuelve el
  `Veredicto`. **No se toca**: es la fuente del veredicto oficial y de las estrellas.
- **`traslacionAlCentro`**: función de `src/motor/validador.ts` que lleva el centro de la caja envolvente
  de una figura al centro del arreglo. Es la que introduce el desfase de ~10px cuando las cajas del
  jugador y de Kiro tienen distinto centro. **No se toca** (cambiarla alteraría el veredicto oficial).
- **`oficial`**: el `Veredicto` de `validar` con la normalización del nivel (alineado por caja envolvente
  y mejor giro). Alimenta las estrellas. **Intacto.**
- **`real`**: el `Veredicto` de `validar` con `POSICIONES_REALES` (traslación y rotación fijas): la
  comparación tal como el jugador vio dibujar, sin centrar ni girar nada.
- **IoU**: `interseccion / union` de las dos máscaras dilatadas. En el contraejemplo, `oficial.iou =
  0.7965` (alineada) y `real.iou = 0.7212` (posiciones reales).
- **Margen de desempate (`MARGEN_MOSTRAR_REAL`)**: tolerancia nueva (p. ej. 0.1) por debajo de la cual la
  comparación en posiciones reales se prefiere para pintar aunque su IoU sea algo menor que la alineada.
  Solo afecta a `veredictoParaMostrar`; nunca al veredicto oficial.

## Bug Details

### Bug Condition

El bug se manifiesta en niveles de **normalización libre/libre** (Mundo 0 y Mundo 1), cuando la estrella
de precisión fue **negada** (`!oficial.coincide`, hay diff que pintar) y el jugador trazó la **forma
correcta** pero con tramos largos un poco distintos a los de Kiro. `veredictoParaMostrar` elige la
comparación **alineada por caja envolvente** (`oficial`) porque su IoU es mayor que la de las posiciones
reales (`real`); esa alineación, vía `traslacionAlCentro`, desplaza ~10px la figura del jugador porque su
caja envolvente tiene distinto centro que la de Kiro. El tramo inicial, que en **posiciones reales** está
exactamente encima del de Kiro, queda descolocado tras la alineación y cae en `exceso`/`falta` en vez de
`coincidencia`, de modo que `src/ui/diff.ts` lo pinta rojo + punteado.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input = { jugador: Segmento[], objetivo: Segmento[], normalizacion: NormalizacionNivel }
  OUTPUT: boolean

  oficial := validar(input.jugador, input.objetivo, input.normalizacion)
  real    := validar(input.jugador, input.objetivo, POSICIONES_REALES)
  mostrado := (real.iou >= oficial.iou) ? real : oficial   // = veredictoParaMostrar(...) actual

  RETURN esNormalizacionLibre(input.normalizacion)
         AND NOT oficial.coincide
         AND NOT real.coincide
         AND jugadorTieneTinta(input.jugador)
         AND mostrado == oficial                      // se pinta la comparación ALINEADA
         AND tramoInicialCoincideEnReal(input)        // en posiciones reales el inicio está sobre Kiro
         AND tramoInicialSeDescolocaAlAlinear(input)  // la alineación por caja lo saca de la coincidencia
END FUNCTION
```

### Examples

- **Caso 2 — figura escalonada del nivel 0.3, reto `AC3VRQC` (contraejemplo MEDIDO):** Kiro `AVANZA 80 /
  GD 90 / AVANZA 140 / GI 90 / AVANZA 120 / GD 90 / AVANZA 140`; jugador igual pero con `150` en los
  tramos largos; normalización **libre/libre**. Medido: `oficial.iou = 0.7965` (alineada por caja),
  `real.iou = 0.7212` (posiciones reales). Como `0.7212 >= 0.7965` es **falso**, se pinta `oficial`; la
  alineación desplaza ~10px la figura y el tramo inicial coincidente se pinta rojo + punteado. Esperado:
  ese tramo inicial, que en posiciones reales está sobre el de Kiro, debe verse **verde**.

- **Figura correcta movida y girada (NO es el bug; debe seguir alineada y toda verde):** el jugador dibuja
  la figura completa y correcta pero trasladada y girada. En posiciones reales no se parece a nada
  (`real.iou` muy bajo, muy por debajo del margen), así que `veredictoParaMostrar` sigue devolviendo la
  comparación **alineada** (`oficial`), que coincide y sale toda verde. El arreglo debe preservar esto:
  la comparación real solo se prefiere cuando su IoU está **dentro del margen** de la alineada.

- **Dibujo incompleto (dos de cuatro tramos) en su sitio (ya cubierto hoy):** la comparación real explica
  mejor que la alineada (`real.iou > oficial.iou`), así que ya hoy se pinta `real`. El arreglo **no**
  cambia este caso: el desempate ampliado solo añade el tramo `oficial.iou - MARGEN <= real.iou <
  oficial.iou`; cuando `real.iou >= oficial.iou` el resultado es idéntico al actual.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `excesoPorcentaje`, `coincide`, `motivo` e `iou` del veredicto **oficial** se calculan igual que hoy
  (no se toca `validar` ni `comparar`): la estrella de precisión y la calificación **no cambian**
  (requisito 3.1).
- Una figura **correcta** pero trasladada o rotada en normalización libre (Mundo 0/1) sigue
  comparándose **alineada** y saliendo toda verde: la alineación libre no se rompe (requisito 3.2).
- La máscara `excesoVisual` del Caso 1 y su pintado en `src/ui/diff.ts` quedan intactos (requisito 3.3).
- La normalización fija/fija (Mundo 3+) sigue devolviendo el veredicto oficial sin alineación: con
  traslación y rotación fijas, `veredictoParaMostrar` devuelve `oficial` antes de llegar al desempate
  (requisito 3.4).
- Cuando el jugador coincide (estrella otorgada), no se pinta diff; la estela-guía punteada de fondo
  queda intacta (Caso 3, requisito 3.5).
- `src/ui/diff.ts` sigue pintando **fielmente** las regiones que recibe; el arreglo no cambia cómo
  `diff.ts` clasifica y colorea, solo **qué veredicto** llega cuando el real explica la forma dentro del
  margen (requisito 3.6).

**Scope:**
Todo lo que NO es «normalización libre + estrella negada + el jugador trazó la forma correcta con tramos
largos algo distintos + la comparación real explica la forma dentro del margen» queda inalterado. En
particular:
- El cálculo del veredicto y de las estrellas (`validar`, `comparar`, `src/juego/estrellas.ts`).
- El Caso 1 (`excesoVisual`): **no se toca**, spec hermano ya completo.
- El Caso 3 (coincidencia = no se pinta diff; estela-guía): intencional, no se toca.
- Normalización fija/fija (Mundo 3+).
- El caso ya cubierto hoy en que `real.iou >= oficial.iou` (dibujo incompleto en su sitio): resultado
  idéntico al actual.

(El comportamiento correcto concreto se define en «Correctness Properties», Propiedad 1.)

## Hypothesized Root Cause

Causa raíz **confirmada** con contraejemplo medido (no hipótesis especulativa). El defecto está en
**qué comparación elige `veredictoParaMostrar` para pintar**, no en `src/ui/diff.ts` ni en `validar`.

1. **El desempate `real.iou >= oficial.iou` es demasiado estricto para el Caso 2 (causa principal
   confirmada)**: en `src/motor/validador.ts`, `veredictoParaMostrar` devuelve la comparación de
   posiciones reales **solo** si su IoU iguala o supera la de la alineada. Cuando el jugador trazó la
   forma correcta pero con tramos algo distintos, la alineada gana por poco (`0.7965 > 0.7212`), así que
   se pinta la alineada aunque la real sea la que el jugador ve en pantalla.

2. **La alineación por caja envolvente desplaza el inicio (causa estructural confirmada)**:
   `traslacionAlCentro` centra cada figura por su caja envolvente. Con tramos de 150 (jugador) vs 140
   (Kiro), las cajas tienen distinto centro y la figura del jugador queda ~10px desplazada; el tramo
   inicial, que en posiciones reales está sobre el de Kiro, cae fuera de `coincidencia`. **No** se puede
   corregir `traslacionAlCentro`: ese mismo centrado es el que da o niega la estrella (el veredicto
   oficial), y tocarlo violaría la restricción crítica (3.1) y rompería la alineación libre (3.2).

3. **`src/ui/diff.ts` pinta fielmente (no es la causa)**: clasifica cada tramo del jugador según las
   regiones que recibe. Si el veredicto que llega es el alineado (con el inicio descolocado), el rojo +
   punteado del inicio es inevitable aguas abajo. El defecto está aguas arriba, en la elección del
   veredicto.

4. **El arreglo debe vivir en `veredictoParaMostrar`, no en `validar`**: `veredictoParaMostrar` existe
   precisamente para decidir «qué se pinta» sin tocar «qué cuenta». Ampliar su criterio de desempate con
   una tolerancia acotada preserva el veredicto oficial por construcción (ni siquiera se vuelve a
   calcular `validar` con la normalización del nivel) y mantiene la figura correcta movida alineada
   (su IoU real cae muy por debajo del margen).

## Correctness Properties

Property 1: Bug Condition - El tramo inicial coincidente se pinta verde sin alterar el veredicto oficial

_For any_ input where the bug condition holds (isBugCondition returns true) —normalización libre/libre,
estrella negada, el jugador trazó la forma correcta con tramos largos algo distintos, y la comparación en
posiciones reales explica la forma dentro del margen de la alineada—, el código arreglado SHALL pintar el
tramo inicial que en posiciones reales está sobre el de Kiro como **coincidencia** (verde), sin que el
desfase de la alineación por caja envolvente lo clasifique como exceso o falta; y SHALL dejar el veredicto
**oficial** (`excesoPorcentaje`, `coincide`, `motivo`, `iou`) exactamente igual que el código original, de
modo que la estrella de precisión no cambie.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Veredicto oficial, figura correcta movida y Caso 1 intactos

_For any_ input where the bug condition does NOT hold (isBugCondition returns false), el código arreglado
SHALL producir exactamente el mismo resultado que el código original en el veredicto **oficial**
(`excesoPorcentaje`, `coincide`, `motivo`, `iou`); una figura **correcta** pero trasladada o rotada en
normalización libre SHALL seguir comparándose alineada (`veredictoParaMostrar` devuelve el oficial) y
saliendo toda verde; la máscara `excesoVisual` del Caso 1 SHALL quedar intacta; la normalización fija/fija
(Mundo 3+) SHALL devolver el oficial sin alineación; la coincidencia otorgada (Caso 3) SHALL seguir sin
pintar diff; y `src/ui/diff.ts` SHALL seguir pintando fielmente las regiones que recibe.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Opción elegida y tradeoffs

Se evaluaron tres enfoques para que el tramo inicial coincidente se pinte verde sin tocar el veredicto
oficial ni las estrellas:

- **Opción A — corregir el desfase de la alineación por caja envolvente.** Cambiar `traslacionAlCentro`
  (o alinear por un ancla distinta, p. ej. el punto de arranque común) para que las dos figuras no se
  descoloquen.
  - *Tradeoff (DESCARTADA)*: `traslacionAlCentro` alimenta el **veredicto oficial** (es el centrado con
    el que `validar` da o niega la estrella). Tocarla cambiaría `iou`/`excesoPorcentaje`/`coincide` del
    oficial y, con ello, la calificación — viola directamente la restricción crítica (3.1) y rompe la
    alineación libre blindada (3.2). Riesgo máximo sobre las estrellas.

- **Opción B (ELEGIDA) — ampliar el criterio de desempate de `veredictoParaMostrar` con una tolerancia
  acotada.** Hoy se pinta la comparación real solo si `real.iou >= oficial.iou`. Se amplía a: pintar la
  real también cuando su IoU está **dentro de un margen pequeño** de la alineada
  (`real.iou >= oficial.iou - MARGEN_MOSTRAR_REAL`), es decir, cuando la real explica la forma casi tan
  bien y es la que el jugador ve en pantalla. El veredicto **oficial** no se recalcula ni se altera; el
  cambio es puramente de presentación.
  - *Ventaja*: el arreglo vive exactamente donde está el defecto (la elección de qué se pinta), no toca
    `validar`/`comparar`/`traslacionAlCentro`, así que el veredicto oficial y las estrellas quedan
    intactos **por construcción**. La figura correcta movida/girada sigue alineada porque su `real.iou`
    cae muy por debajo del margen (en su sitio no se parece a nada). `excesoVisual` (Caso 1) y
    `src/ui/diff.ts` no se tocan.
  - *Tradeoff*: el invariante existente `mostrado.iou >= oficial.iou` (blindado por la propiedad de
    `src/motor/validador.test.ts`) se **relaja** a `mostrado.iou >= oficial.iou - MARGEN_MOSTRAR_REAL`.
    Hay que actualizar esa aserción del test de propiedad a la tolerancia acotada (documentando por qué),
    manteniendo intacto que `mostrado` sigue siendo **uno de los dos veredictos reales** (oficial o
    posiciones reales, nunca inventado). También se ajusta la aserción de precisión: en vez de exigir que
    la precisión mostrada iguale a la oficial, se exige equivalencia de "otorgada" (el mostrado otorga
    precisión sii el oficial la otorga), porque rerutar a posiciones reales puede dar un sub-motivo de
    "negada" distinto sin cambiar las estrellas, que salen del veredicto oficial. Elegir el valor
    de `MARGEN_MOSTRAR_REAL` es una decisión de calibración: debe cubrir el contraejemplo
    (`0.7965 - 0.7212 = 0.0753`, p. ej. margen `0.1`) sin que una figura mal hecha (que en su sitio no se
    parece a nada) caiga dentro.

- **Opción C — derivar el diff a pintar desde posiciones reales siempre que la forma coincida.** Detectar
  que la forma del jugador es la correcta (p. ej. por conteo de tramos y giros) y, en ese caso, pintar
  siempre la comparación real.
  - *Tradeoff (DESCARTADA)*: requiere un criterio nuevo de «misma forma» fuera del IoU (más superficie de
    error, más frágil, duplica lógica de reconocimiento que ya hace el veredicto) y arriesga pintar real
    en casos donde la real explica peor que la alineada. La Opción B logra el mismo efecto reusando el IoU
    que el validador ya calcula, con un único umbral acotado y verificable.

La **Opción B** es la que mejor cumple la restricción crítica (el veredicto oficial no se toca en
absoluto), preserva la figura correcta movida (sigue alineada por quedar fuera del margen) y minimiza la
superficie de cambio (una sola condición en `veredictoParaMostrar` y una constante nueva). El valor exacto
de `MARGEN_MOSTRAR_REAL` se fija en RED→GREEN con el contraejemplo medido; esta sección fija el enfoque y
los puntos de código.

### Changes Required

Asumiendo que el análisis de causa raíz es correcto:

**Archivo 1 (único con cambio de comportamiento)**: `src/motor/validador.ts`

- **Constante nueva `MARGEN_MOSTRAR_REAL`**: tolerancia de IoU (p. ej. `0.1`) por debajo de la cual la
  comparación en posiciones reales se prefiere para pintar aunque su IoU sea algo menor que la alineada.
  Se exporta para que la prueba de propiedad la lea y no fije un número mágico duplicado.
- **`veredictoParaMostrar(...)`**: cambiar **solo** la última decisión. Hoy:
  `return real.iou >= oficial.iou ? real : oficial;`. Nuevo:
  `return real.iou >= oficial.iou - MARGEN_MOSTRAR_REAL ? real : oficial;`.
  Las dos guardas previas **no cambian**: sigue devolviendo `oficial` cuando traslación y rotación son
  fijas (3.4), cuando `oficial.motivo === 'sinEstelaDelJugador'`, y cuando `real.coincide` o
  `real.motivo === 'sinEstelaDelJugador'` (nunca se muestra como correcto un dibujo al que el oficial
  negó la precisión). `validar`, `comparar`, `buscarMejorGiro`, `traslacionAlCentro` y la interfaz
  `Veredicto` **no se tocan**.

**No se toca**:
- `validar`, `comparar`, `buscarMejorGiro`, `traslacionAlCentro`, `dilatar`, `rasterizar`: el veredicto
  **oficial** (`excesoPorcentaje`, `coincide`, `motivo`, `iou`) sale byte a byte igual (requisito 3.1).
- `excesoVisual` y su cálculo en `validar` (Caso 1, requisito 3.3).
- `src/ui/diff.ts`: sigue pintando fielmente las regiones que recibe (requisito 3.6).
- `src/ui/comparacion.ts` (`pintarDiff`, `RegionesDiff`): recibe el veredicto ya elegido, sin cambios.
- `src/main.ts`: la firma de `veredictoParaMostrar(...)` no cambia; sigue pasando el mismo resultado al
  diff y calculando las estrellas desde `validar(...)` por separado.
- `src/juego/estrellas.ts` ni ningún origen de las estrellas.

### Nota sobre el invariante existente

La propiedad `src/motor/validador.test.ts` «el IoU mostrado nunca baja del oficial y la calificación no
cambia» afirma hoy `mostrado.iou >= oficial.iou`. Con la Opción B se ajustan **dos** de sus cuatro
aserciones; las otras dos quedan intactas:

- **(1) se relaja**: el invariante `mostrado.iou >= oficial.iou` pasa a
  `mostrado.iou >= oficial.iou - MARGEN_MOSTRAR_REAL` (la presentación puede preferir una comparación con
  IoU ligeramente menor cuando es la que el jugador ve).
- **(2) intacta**: `mostrado` es siempre uno de los dos veredictos reales (oficial o posiciones reales),
  nunca inventado.
- **(3) intacta**: un dibujo al que el oficial negó la precisión nunca se muestra como correcto.
- **(4) se ajusta**: ya **no** exige que la precisión derivada del mostrado iguale byte a byte a la del
  oficial. Ahora exige únicamente **equivalencia de "otorgada"**: el mostrado otorga la precisión
  **exactamente cuando** la otorga el oficial (`precisionDeVeredicto(mostrado) === 'otorgada'` sii
  `precisionDeVeredicto(oficial) === 'otorgada'`). No se exige el mismo sub-motivo de "negada", porque la
  elección de presentación puede rerutar a un veredicto con `motivo` distinto (p. ej. `iouInsuficiente`
  en vez de `excesoDeTrazo`) sin cambiar el número de estrellas: las estrellas salen del **veredicto
  oficial**, no del mostrado.

La prueba «una figura bien hecha pero movida y girada se sigue comparando alineada» debe seguir verde con
un margen bien calibrado (su `real.iou` cae muy por debajo del margen).

## Testing Strategy

### Validation Approach

Dos fases: primero surgir un contraejemplo que demuestre el bug sobre el código **sin arreglar** (el tramo
inicial coincidente se pinta rojo/punteado), y luego verificar que el arreglo lo corrige (fix checking)
sin romper lo que ya anda (preservation checking). El runner del proyecto es **Vitest** (`npm test`, que
corre `vitest --run`) y el proyecto ya usa **fast-check** para pruebas de propiedad. Las pruebas del
desempate viven en `src/motor/validador.test.ts`; las de pintado fiel, en `src/ui/diff.test.ts`.

### Exploratory Bug Condition Checking

**Goal**: surgir el contraejemplo que demuestra el bug ANTES de implementar el arreglo, y confirmar la
causa raíz (`veredictoParaMostrar` elige la comparación alineada, que descoloca el inicio). Debe
**FALLAR** sobre el código actual.

**Test Plan**: construir la figura escalonada del nivel 0.3 (Kiro con tramos de `140`, jugador con `150`,
normalización **libre/libre**), validar las dos comparaciones (`LIBRE` y `POSICIONES_REALES`) y afirmar
que `veredictoParaMostrar` devuelve la comparación de **posiciones reales** (la que el jugador ve), en la
que el tramo inicial coincidente cae en coincidencia. Correr sobre el código SIN arreglar para observar el
fallo (hoy devuelve la alineada).

**Test Cases**:
1. **Caso 2 — escalonada 150 vs 140 (contraejemplo medido)**: afirmar que `oficial.iou > real.iou` (la
   alineada gana el desempate estricto actual) y que, tras el arreglo, `veredictoParaMostrar` devuelve la
   comparación de posiciones reales (`traslacion = {0,0}`, `angulo = 0`). Sobre el código actual devuelve
   la alineada: **fallará**.
2. **Tramo inicial en coincidencia (posiciones reales)**: afirmar que, en la comparación de posiciones
   reales, el punto medio del tramo inicial del jugador cae en `coincidencia` y no en `exceso`/`falta`.

**Expected Counterexamples**:
- `veredictoParaMostrar` devuelve la comparación **alineada** (`oficial.traslacion` o `oficial.angulo`
  distintos de 0) en vez de la de posiciones reales, porque `real.iou (0.7212) < oficial.iou (0.7965)` y
  el desempate actual exige `real.iou >= oficial.iou`.
- Causa confirmada: el margen de desempate es demasiado estricto; la alineación por caja envolvente
  descoloca el inicio.

### Fix Checking

**Goal**: verificar que para toda entrada que dispara el bug, el tramo inicial coincidente en posiciones
reales se pinta como coincidencia (verde), sin cambiar el veredicto oficial.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  oficial  := validar(input.jugador, input.objetivo, input.normalizacion)
  mostrado := veredictoParaMostrar(oficial, input.jugador, input.objetivo, input.normalizacion)
  // Fix Checking: se pinta la comparación de posiciones reales (inicio coincidente verde).
  ASSERT mostrado.traslacion = {0,0} AND mostrado.angulo = 0
  ASSERT tramoInicialSePintaComoCoincidencia(mostrado, input)
  ASSERT NOT tramoInicialSePintaComoExcesoOFalta(mostrado, input)
  // El veredicto OFICIAL y las estrellas quedan intactos.
  oficial2 := validar_fixed(input.jugador, input.objetivo, input.normalizacion)
  ASSERT oficial2.excesoPorcentaje = oficial.excesoPorcentaje
  ASSERT oficial2.coincide         = oficial.coincide
  ASSERT oficial2.motivo           = oficial.motivo
  ASSERT oficial2.iou              = oficial.iou
END FOR
```

### Preservation Checking

**Goal**: verificar que para toda entrada que NO dispara el bug, el arreglo se comporta igual que el
código original en todo lo que decide el veredicto, y que el desempate ampliado no reruta a posiciones
reales una figura correcta movida/girada.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // El veredicto OFICIAL y las estrellas son idénticos antes y después (validar no se toca).
  ASSERT validar_original(input).excesoPorcentaje = validar_fixed(input).excesoPorcentaje
  ASSERT validar_original(input).coincide         = validar_fixed(input).coincide
  ASSERT validar_original(input).motivo           = validar_fixed(input).motivo
  ASSERT validar_original(input).iou              = validar_fixed(input).iou
  // El mostrado sigue siendo uno de los dos veredictos reales; el mostrado otorga precisión sii el oficial la otorga.
  ASSERT mostrado === oficial OR mostrado ≡ real
  ASSERT (precisionDe(mostrado) = 'otorgada') = (precisionDe(oficial) = 'otorgada')
END FOR
```

**Testing Approach**: la prueba de propiedad es la adecuada para la preservación porque genera muchos
casos en todo el dominio de figuras y captura bordes que las pruebas por ejemplo no cubren. El proyecto ya
tiene el arbitrario `figuraArb` (polilínea conexa de 1–4 tramos, coordenadas enteras en [-150,150]) y la
propiedad «el IoU mostrado nunca baja del oficial y la calificación no cambia». Esa propiedad se
**actualiza** para reflejar el invariante relajado (`mostrado.iou >= oficial.iou - MARGEN_MOSTRAR_REAL`),
manteniendo intactas las aserciones de que `mostrado` es uno de los dos veredictos reales y de que un
dibujo negado nunca se muestra como correcto, y ajustando la aserción de precisión a la equivalencia de
"otorgada" (el mostrado otorga precisión sii el oficial la otorga).

**Test Plan**: comparar `excesoPorcentaje`/`coincide`/`motivo`/`iou` del veredicto oficial antes y después
con `figuraArb` + `validar` directo (deben ser idénticos porque `validar` no se toca); verificar que la
figura correcta movida/girada sigue devolviendo el oficial; y actualizar la propiedad del IoU mostrado a
la tolerancia acotada.

**Test Cases**:
1. **Veredicto oficial idéntico (3.1)**: property test con `figuraArb` × `figuraArb`; `validar` arreglado
   y original coinciden en `excesoPorcentaje`, `coincide`, `motivo` e `iou` (≥ 100 iteraciones). Como
   `validar` no se toca, es trivialmente cierto, pero se blinda explícitamente.
2. **Figura correcta movida y girada sigue alineada (3.2)**: figura completa y correcta, trasladada y
   girada; `veredictoParaMostrar` devuelve `oficial` (su `real.iou` cae muy por debajo del margen), que
   coincide y sale toda verde. Prueba existente (línea ~618), debe seguir verde con el margen calibrado.
3. **IoU mostrado dentro de la tolerancia (propiedad actualizada)**: `mostrado.iou >= oficial.iou -
   MARGEN_MOSTRAR_REAL`; `mostrado` es uno de los dos veredictos reales; el mostrado otorga precisión sii
   el oficial la otorga (equivalencia de "otorgada", sin exigir el mismo sub-motivo de negada); un dibujo
   negado nunca se muestra como correcto (≥ 100 iteraciones).
4. **Caso 1 (`excesoVisual`) intacto (3.3)**: las pruebas del Caso 1 sobre `excesoVisual` siguen verdes
   (no se toca `validar`).
5. **Fija/fija (3.4)**: con normalización fija/fija, `veredictoParaMostrar` devuelve `oficial` antes del
   desempate (prueba existente, debe seguir verde).
6. **Coincidencia otorgada (3.5)**: un dibujo que coincide no pinta diff (prueba existente, debe seguir
   verde).
7. **`diff.ts` sigue pintando fiel (3.6)**: la propiedad de `src/ui/diff.propiedad.test.ts` sigue verde;
   `diff.ts` no se toca.

### Unit Tests

- Caso 2 (escalonada 150 vs 140): `veredictoParaMostrar` devuelve la comparación de posiciones reales y el
  tramo inicial coincidente cae en coincidencia (verde), no en exceso/falta; el veredicto oficial
  (`excesoPorcentaje`, `coincide`, `motivo`, `iou`) es idéntico al del código actual.
- Figura correcta movida y girada: `veredictoParaMostrar` devuelve el oficial (alineada), toda verde
  (preservación de 3.2).
- Casos límite: estela vacía (devuelve oficial), coincidencia otorgada (devuelve oficial), fija/fija
  (devuelve oficial antes del desempate).

### Property-Based Tests

- **Veredicto oficial invariante** (nueva/reforzada): `validar` arreglado vs original coinciden en
  `excesoPorcentaje`/`coincide`/`motivo`/`iou` con `figuraArb` (≥ 100 iteraciones) — garantiza que la
  estrella no cambia (3.1).
- **IoU mostrado dentro de la tolerancia** (propiedad existente ACTUALIZADA, debe quedar verde): el IoU
  mostrado nunca baja de `oficial.iou - MARGEN_MOSTRAR_REAL`, el mostrado es uno de los dos veredictos
  reales, un dibujo negado nunca se muestra como correcto, y el mostrado otorga precisión sii el oficial
  la otorga (equivalencia de "otorgada", sin exigir el mismo sub-motivo de negada), con `figuraArb`.
- **Pintado fiel** (propiedad existente de `diff.propiedad.test.ts`, debe seguir verde): `diff.ts` pinta
  las máscaras recibidas sin modificarlas.

### Integration Tests

- Flujo de superposición en `src/ui/comparacion.ts` con un veredicto de Caso 2: al pasar a superposición
  (`!veredicto.coincide`), el diff recibe la comparación de posiciones reales y el tramo inicial
  coincidente se pinta verde; se verifica que `src/main.ts` sigue calculando las estrellas desde
  `validar(...)` por separado, de modo que la calificación no cambia.
- Cambio de nivel y de vista: redibujar la superposición tras el arreglo no altera el comportamiento de
  las vistas ni el anuncio `aria-live` (el texto de IoU y exceso sale del veredicto mostrado; con el
  arreglo refleja la comparación que el jugador ve, coherente con el lienzo).
