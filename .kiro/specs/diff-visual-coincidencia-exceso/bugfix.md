# Documento de Requisitos del Arreglo

## Introduction

En la vista de superposición de KiroLogo (la figura del jugador y la de Kiro sobre un mismo lienzo),
el diff visual —verde para lo que coincide, rojo para lo que sobra, punteado para lo que falta— pinta
mal el excedente cuando el jugador se pasa **poco** respecto de Kiro en los niveles de normalización
libre (Mundo 0 y Mundo 1).

Síntoma observado: cuando el jugador traza una línea un poco más larga que la de Kiro (por ejemplo,
Kiro `AVANZA 100` y el jugador `AVANZA 110`), la superposición pinta casi **todo verde** y el
excedente real —los ~10 de más— apenas se marca de rojo, de forma imperceptible. El jugador debería
ver verde hasta donde su trazo realmente coincide con el de Kiro y rojo todo el excedente real a lo
largo del trazo.

El diff visual es la única explicación que recibe el jugador de **por qué** su figura no obtuvo la
estrella de precisión. Mientras el excedente real se pinte como coincidencia (verde) y el rojo quede
reducido a una puntita invisible, la explicación contradice lo que el jugador ve en el lienzo y lo
desorienta en lugar de guiarlo.

### Alcance

Este arreglo cubre **solo el Caso 1**: en normalización libre (Mundo 0 y Mundo 1), cuando la estrella
de precisión fue negada por exceso de trazo y el jugador se pasó poco respecto de Kiro, el excedente
real no se pinta de rojo de forma perceptible a lo largo del trazo. El objetivo es que el diff pinte
verde el tramo que realmente coincide y rojo el excedente real, **sin alterar** el veredicto ni las
estrellas.

### Fuera de alcance

#### Caso 2 — pendiente, spec separado

Existe un segundo defecto confirmado que **no** se trata en este bugfix; se abordará en un spec
separado. En la figura escalonada del nivel 0.3 (código `AC3VRQC`: Kiro
`AVANZA 80 / GD 90 / AVANZA 140 / GI 90 / AVANZA 120 / GD 90 / AVANZA 140`; el jugador igual pero con
`150` en los tramos largos), el tramo inicial coincidente se pinta rojo + punteado porque
`veredictoParaMostrar` (`src/motor/validador.ts`, rama `return real.iou >= oficial.iou ? real :
oficial;`) elige la comparación **alineada** (IoU 0.7965) por encima de la de las posiciones reales
(IoU 0.7212); al alinear por caja envolvente se mete un desfase de ~10px que descoloca el inicio.
**No** se diseñan requisitos de arreglo para el Caso 2 en este documento: queda únicamente documentado
como pendiente en spec separado.

#### Caso 3 — comportamiento intencional, no se toca

Cuando el jugador **coincide** (3 estrellas), la superposición no pinta diff; lo punteado que se ve de
fondo es la estela-guía de Kiro. Está verificado en el código: `pintarVista` solo pinta diff cuando
`!v.coincide`. Es comportamiento intencional y **no** se modifica.

### Causa raíz (Caso 1, verificada con contraejemplo medido)

El defecto está en **cómo se deriva la región `exceso`** que se pinta, no en `src/ui/diff.ts` ni en
`veredictoParaMostrar`.

En `src/motor/validador.ts`, la región `exceso = Bd \ Ad` se calcula sobre máscaras **dilatadas** por
un disco de radio 8px: `validar` construye las máscaras con `dilatar(rasterizar(...))` y `comparar`
opera sobre esas dilatadas (`ad`, `bd`). La dilatación «infla» la línea de Kiro ~8px más allá de su
extremo, de modo que la coincidencia `Ad ∩ Bd` se adueña del excedente del jugador hasta ~8px y la
región `exceso` solo marca la puntita restante.

Contraejemplo medido (línea 100 de Kiro vs. línea 110 del jugador): coincidencia = 1897 celdas,
exceso = 170, falta = 0; en pantalla, verde de `y=0` a `y≈108` y rojo solo de `y≈108` a `y=110` (~2px,
imperceptible).

`src/ui/diff.ts` pinta **fielmente** esas máscaras: clasifica cada tramo del jugador según las
regiones `coincidencia` / `exceso` que recibe. El defecto no está en `diff.ts` ni en
`veredictoParaMostrar`, sino en que la región `exceso` que se pinta se deriva sobre máscaras dilatadas,
que absorben el excedente real.

### Restricción crítica (no alterar el veredicto ni las estrellas)

El `excesoPorcentaje` que decide la estrella de precisión (`comparar`: `soloBd / totalAd * 100`,
umbral `UMBRAL_EXCESO = 5`) también se calcula sobre las máscaras dilatadas. El arreglo del diff visual
**NO** debe alterar ese cálculo ni el veredicto/estrellas. Solo debe corregir las máscaras (o la región
de exceso) que se **pintan**, de modo que el excedente real a lo largo del trazo del jugador se vea
rojo. `excesoPorcentaje`, `coincide` y `motivo` deben quedar idénticos.

### Restricciones de diseño (no negociables)

- **Mundo 0 y Mundo 1 son normalización libre/libre** (blindado por `src/niveles/catalogo.test.ts`).
  Una figura **correcta** pero trasladada o rotada DEBE seguir saliendo toda verde en el diff.
- **Las estrellas salen del veredicto oficial y NO cambian.** El arreglo solo afecta a qué región de
  exceso se pinta; `excesoPorcentaje`, `coincide` y `motivo` quedan idénticos.
- **Mundo 3 en adelante (normalización fija/fija) no cambia su comportamiento.**
- `veredictoParaMostrar` y `src/ui/diff.ts` **no** son la causa del Caso 1; el fix vive en la
  derivación de la región `exceso` que se pinta.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN en un nivel de normalización libre (Mundo 0 o Mundo 1) el jugador traza una línea un poco más
larga que la de Kiro (por ejemplo Kiro `AVANZA 100` y el jugador `AVANZA 110`) y la estrella de
precisión es negada THEN el diff visual pinta casi todo el trazo de verde («coincide») y marca de rojo
(«sobra») solo una puntita imperceptible (~2px) en el extremo

1.2 WHEN el validador deriva la región `exceso = Bd \ Ad` para pintar THEN la calcula sobre máscaras
dilatadas por el disco de radio 8px, de modo que la línea de Kiro queda inflada ~8px más allá de su
extremo y la coincidencia `Ad ∩ Bd` absorbe el excedente real del jugador hasta ~8px

### Expected Behavior (Correct)

2.1 WHEN en un nivel de normalización libre (Mundo 0 o Mundo 1) el jugador traza una línea un poco más
larga que la de Kiro y la estrella de precisión es negada THEN el diff visual SHALL pintar de verde
(«coincide») solo el tramo del trazo del jugador que realmente coincide con el de Kiro y de rojo
(«sobra») todo el excedente real a lo largo del trazo (no solo una puntita)

2.2 WHEN el validador deriva la región `exceso` que se pinta THEN SHALL producir una región de exceso
que refleje el excedente real del trazo del jugador respecto de la línea de Kiro, sin que la dilatación
de la máscara de Kiro absorba ese excedente como coincidencia

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el validador calcula la estrella de precisión THEN el sistema SHALL CONTINUE TO derivar
`excesoPorcentaje` (`soloBd / totalAd * 100`, umbral `UMBRAL_EXCESO = 5`), `coincide` y `motivo` igual
que hoy, de modo que la calificación (número de estrellas) y el veredicto NO cambien por este arreglo

3.2 WHEN el jugador dibuja una figura **correcta** pero trasladada o rotada en un nivel de
normalización libre (Mundo 0 o Mundo 1) THEN el sistema SHALL CONTINUE TO mostrarla toda verde en el
diff (sin exceso ni falta), preservando la alineación libre blindada por `src/niveles/catalogo.test.ts`

3.3 WHEN el nivel tiene normalización fija/fija (Mundo 3 en adelante) THEN el sistema SHALL CONTINUE TO
comportarse exactamente como hoy: el veredicto mostrado es el oficial, sin alineación

3.4 WHEN el jugador coincide con Kiro (estrella de precisión otorgada) THEN el sistema SHALL CONTINUE
TO no pintar diff (solo la superposición de estelas), dejando intacta la estela-guía punteada de fondo

3.5 WHEN `src/ui/diff.ts` recibe las regiones del validador THEN el sistema SHALL CONTINUE TO pintarlas
fielmente, sin que este arreglo cambie la forma en que `diff.ts` clasifica y colorea los trazos

## Condición del Bug y Propiedades

### Función de Condición del Bug

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = { jugador, objetivo, normalizacion }
  OUTPUT: boolean

  // El bug se manifiesta en normalización libre (Mundo 0/1), cuando la estrella de
  // precisión fue negada por exceso de trazo (el jugador se pasó poco respecto de Kiro)
  // y la región `exceso` que se pinta, derivada sobre máscaras dilatadas, absorbe el
  // excedente real como coincidencia: el rojo queda reducido a una puntita imperceptible.
  oficial ← validar(X.jugador, X.objetivo, X.normalizacion)

  RETURN esNormalizacionLibre(X.normalizacion)
         AND NOT oficial.coincide
         AND X.jugador no está vacía
         AND excedeUnPoco(X.jugador, X.objetivo)
         AND excesoRealVisible(X) ⊄ oficial.exceso   // el excedente real NO está cubierto por la región de exceso pintada
END FUNCTION
```

Instancia concreta (contraejemplo medido):

```pascal
// Caso 1 — excedente oculto por la dilatación de las máscaras.
FUNCTION isBugCondition_caso1(X)
  // Kiro traza una línea de 100; el jugador la misma línea pero de 110.
  INPUT: X = { jugador: línea AVANZA 110, objetivo: línea AVANZA 100, normalizacion: libre }
  OUTPUT: boolean
  // Medido: coincidencia = 1897, exceso = 170, falta = 0.
  // En pantalla: verde de y=0 a y≈108, rojo solo de y≈108 a y=110 (~2px, imperceptible).
  // El excedente real (~10 unidades a lo largo del trazo) debería verse rojo.
  RETURN true
END FUNCTION
```

### Especificación de la Propiedad (Fix Checking)

```pascal
// Propiedad: para toda entrada que dispara el bug, la región de exceso que se pinta
// cubre el excedente real del trazo del jugador respecto de la línea de Kiro, sin que
// la dilatación lo absorba como coincidencia; y el veredicto no cambia.
FOR ALL X WHERE isBugCondition(X) DO
  v' ← validar'(X.jugador, X.objetivo, X.normalizacion)
  // Fix Checking: el excedente real visible se pinta como exceso.
  ASSERT excesoRealVisible(X) ⊆ v'.exceso
  // El veredicto y las estrellas quedan intactos.
  ASSERT v'.excesoPorcentaje = validar(X.jugador, X.objetivo, X.normalizacion).excesoPorcentaje
  ASSERT v'.coincide        = validar(X.jugador, X.objetivo, X.normalizacion).coincide
  ASSERT v'.motivo          = validar(X.jugador, X.objetivo, X.normalizacion).motivo
END FOR
```

### Objetivo de Preservación (Preservation Checking)

```pascal
// Propiedad: para entradas que NO disparan el bug, F' se comporta igual que F.
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

En particular:

- `excesoPorcentaje`, `coincide` y `motivo` salen del mismo cálculo sobre las máscaras dilatadas,
  idénticos antes y después: la estrella de precisión no cambia (requisito 3.1).
- Una figura **correcta** pero trasladada o rotada en normalización libre (Mundo 0/1) sigue saliendo
  toda verde: `F'` no la marca con exceso ni falta (requisito 3.2).
- La normalización fija/fija (Mundo 3 en adelante) devuelve el veredicto oficial sin cambios
  (requisito 3.3).
- Coincidencia otorgada y estela vacía se comportan como hoy (requisito 3.4).
- `src/ui/diff.ts` sigue pintando fielmente las regiones que recibe (requisito 3.5).

Definiciones:

- **F**: el código actual, donde la región `exceso = Bd \ Ad` que se pinta se deriva sobre máscaras
  dilatadas por el disco de radio 8px, que absorben el excedente real del jugador como coincidencia.
- **F'**: el código arreglado, donde la región de exceso que se **pinta** refleja el excedente real
  del trazo del jugador, sin cambiar `excesoPorcentaje`, `coincide`, `motivo` ni la alineación libre de
  una figura correcta movida.
