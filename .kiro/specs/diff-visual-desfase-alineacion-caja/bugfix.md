# Documento de Requisitos del Arreglo

## Introduction

En la vista de superposición de KiroLogo (la figura del jugador y la de Kiro sobre un mismo lienzo),
el diff visual —verde para lo que coincide, rojo para lo que sobra, punteado para lo que falta— pinta
el **tramo inicial coincidente** de rojo + punteado (como si sobrara o faltara) en una figura escalonada
de un nivel de **normalización libre** (Mundo 0 / Mundo 1), cuando el jugador trazó la forma correcta
pero con tramos largos un poco distintos a los de Kiro.

Síntoma observado (reportado por el usuario, contraejemplo medido): en la figura escalonada del nivel
0.3 (código de reto `AC3VRQC`: Kiro `AVANZA 80 / GD 90 / AVANZA 140 / GI 90 / AVANZA 120 / GD 90 /
AVANZA 140`; el jugador igual pero con `150` en los tramos largos), el tramo inicial que en pantalla
está exactamente encima del de Kiro se pinta rojo + punteado en vez de verde. El inicio de la figura
queda descolocado ~10px respecto de la de Kiro.

Este defecto es el **Caso 2** confirmado y documentado como fuera de alcance en el spec hermano
`diff-visual-coincidencia-exceso` (sección «Fuera de alcance > Caso 2»). Aquel bugfix trató el Caso 1
(excedente absorbido por la dilatación) y dejó explícitamente el Caso 2 para este spec separado.

El diff visual es la única explicación que recibe el jugador de **por qué** su figura no obtuvo la
estrella de precisión. Si el tramo que coincide se pinta rojo + punteado por un desfase de alineación,
la explicación contradice lo que el jugador ve en el lienzo (su inicio está encima del de Kiro) y lo
desorienta en lugar de guiarlo.

### Causa raíz (verificada en el código, no copiada del Caso 1)

Se verificó el código real antes de redactar estos requisitos: `src/motor/validador.ts`
(`veredictoParaMostrar`, `buscarMejorGiro`, `comparar`, `validar`, `traslacionAlCentro`), `src/ui/diff.ts`
y la normalización del nivel 0.3 en `src/niveles/mundo-0-primeros-pasos.ts`.

El defecto está en **qué comparación elige `veredictoParaMostrar` para pintar**, combinado con el
**desfase que introduce la alineación por caja envolvente**:

1. **El nivel 0.3 es normalización libre/libre.** Verificado: `NIVEL_0_3.normalizacion =
   { traslacion: 'libre', rotacion: 'libre', escala: 'exacta' }`. Con traslación libre, `validar`
   centra cada figura por el centro de su caja envolvente (`traslacionAlCentro`, que usa
   `calcularEncuadre` de `src/motor/encuadre.ts`) y con rotación libre busca el mejor giro
   (`buscarMejorGiro`).

2. **`veredictoParaMostrar` elige entre dos comparaciones por IoU.** Verificado en la última línea de
   `veredictoParaMostrar`: `return real.iou >= oficial.iou ? real : oficial;`, donde `oficial` es el
   veredicto con la normalización del nivel (alineado por caja envolvente) y `real` es el veredicto en
   `POSICIONES_REALES` (todo fijo, sin centrar ni girar). El desempate solo devuelve la comparación de
   posiciones reales cuando su IoU **iguala o supera** la de la alineada.

3. **Con la figura escalonada, la alineada gana el desempate.** Según la medición reportada:
   `oficial.iou` (ALINEADA por caja envolvente) = 0.7965 y `real.iou` (posiciones reales) = 0.7212.
   Como `real.iou (0.7212) >= oficial.iou (0.7965)` es **falso**, `veredictoParaMostrar` devuelve
   `oficial`: la comparación **alineada**.

4. **La alineación por caja envolvente mete un desfase de ~10px.** `traslacionAlCentro` lleva el centro
   de la caja envolvente de cada figura al centro del arreglo. Como el jugador trazó los tramos largos
   con `150` en vez de `140`, su caja envolvente tiene otro centro que la de Kiro; al centrar ambas por
   su caja, la figura del jugador queda desplazada ~10px respecto de la de Kiro. El tramo inicial, que
   en posiciones reales está exactamente encima del de Kiro, queda descolocado tras la alineación y cae
   en `exceso`/`falta` en lugar de `coincidencia`, de modo que `src/ui/diff.ts` lo pinta rojo +
   punteado.

`src/ui/diff.ts` pinta **fielmente** las regiones del veredicto que recibe: clasifica cada tramo del
jugador según `coincidencia`/`exceso`/`excesoVisual` y la falta según `falta`. El defecto del Caso 2
**no** está en `diff.ts` sino en que el veredicto elegido para pintar (la comparación alineada por caja
envolvente) descoloca el inicio.

> Nota de precisión sobre la causa raíz apuntada: el enunciado original decía que el desempate «prefiere
> la comparación alineada cuando su IoU es mayor o igual». Verificado en el código, el desempate
> `real.iou >= oficial.iou ? real : oficial` devuelve la **alineada** (`oficial`) precisamente cuando su
> IoU es **estrictamente mayor** que la de las posiciones reales (empate y mayor-IoU-real favorecen a
> `real`). En este contraejemplo la alineada gana por tener IoU mayor (0.7965 > 0.7212), no por un
> empate. El efecto documentado es correcto; la condición exacta del desempate se afina aquí.

### Restricción crítica (no alterar el veredicto ni las estrellas)

Las estrellas salen del **veredicto oficial** (`validar` con la normalización del nivel), no de
`veredictoParaMostrar`. Verificado: `src/main.ts` calcula `validar(...)` para la calificación y usa
`veredictoParaMostrar(...)` solo para el diff que se pinta. Este arreglo **NO** debe alterar
`excesoPorcentaje`, `coincide` ni `motivo` del veredicto oficial: la estrella de precisión y la
calificación (número de estrellas) deben quedar idénticas.

### Restricciones de diseño (heredadas del Caso 1, no negociables)

- **Mundo 0 y Mundo 1 son normalización libre/libre** (blindado por `src/niveles/catalogo.test.ts`).
  Una figura **correcta** pero trasladada o rotada DEBE seguir saliendo toda verde en el diff. El
  arreglo del Caso 2 no puede romper la alineación libre que permite reconocer una figura bien hecha
  pero movida o girada.
- **Las estrellas salen del veredicto oficial y NO cambian.** `excesoPorcentaje`, `coincide` y `motivo`
  del veredicto oficial quedan idénticos salvo que el análisis demuestre lo contrario.
- **No romper el arreglo del Caso 1.** El Caso 1 introdujo la máscara `excesoVisual` en el validador y
  su pintado en `src/ui/diff.ts`; este arreglo del Caso 2 no debe romper esa máscara ni su pintado.
- **Caso 3 (coincidencia, 3 estrellas, no se pinta diff) es intencional y no se toca.** Verificado:
  el diff solo se pinta cuando `!veredicto.coincide`; la estela-guía punteada de fondo se mantiene.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN en un nivel de normalización libre (Mundo 0 o Mundo 1) el jugador traza una figura escalonada
correcta en forma pero con tramos largos un poco distintos a los de Kiro (p. ej. nivel 0.3, reto
`AC3VRQC`: Kiro con tramos de `140`, el jugador con `150`) THEN el diff visual pinta el **tramo inicial
coincidente** de rojo + punteado (como exceso/falta) en vez de verde

1.2 WHEN `veredictoParaMostrar` elige la comparación a pintar con el desempate `real.iou >= oficial.iou ?
real : oficial` y la comparación ALINEADA por caja envolvente (`oficial`) tiene mayor IoU que la de las
posiciones reales (`real`) (medido: oficial.iou 0.7965 > real.iou 0.7212) THEN el sistema pinta la
comparación alineada, en la que `traslacionAlCentro` desplaza la figura del jugador ~10px respecto de la
de Kiro porque sus cajas envolventes tienen distinto centro

### Expected Behavior (Correct)

2.1 WHEN en un nivel de normalización libre (Mundo 0 o Mundo 1) el jugador traza una figura escalonada
correcta en forma pero con tramos largos un poco distintos a los de Kiro (nivel 0.3, reto `AC3VRQC`)
THEN el diff visual SHALL pintar de verde («coincide») el tramo inicial que en pantalla está sobre el de
Kiro, sin marcarlo de rojo ni punteado por un desfase de alineación

2.2 WHEN `veredictoParaMostrar` elige la comparación a pintar y la comparación alineada por caja
envolvente introduciría un desfase que descoloca un tramo que en posiciones reales coincide con el de
Kiro THEN el sistema SHALL pintar un diff en el que ese tramo inicial coincidente se vea verde, sin que
el desfase de la alineación por caja envolvente lo clasifique como exceso o falta

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el validador calcula la estrella de precisión a partir del veredicto oficial (`validar` con la
normalización del nivel) THEN el sistema SHALL CONTINUE TO derivar `excesoPorcentaje`
(`soloBd / totalAd * 100`, umbral `UMBRAL_EXCESO = 5`), `coincide` y `motivo` igual que hoy, de modo que
la calificación (número de estrellas) y el veredicto oficial NO cambien por este arreglo

3.2 WHEN el jugador dibuja una figura **correcta** pero trasladada o rotada en un nivel de normalización
libre (Mundo 0 o Mundo 1) THEN el sistema SHALL CONTINUE TO mostrarla toda verde en el diff (sin exceso
ni falta), preservando la alineación libre blindada por `src/niveles/catalogo.test.ts`

3.3 WHEN un nivel de normalización libre presenta el Caso 1 (el jugador excede poco y el excedente real
debe verse rojo a lo largo del trazo) THEN el sistema SHALL CONTINUE TO pintar el excedente real con la
máscara `excesoVisual` que introdujo el arreglo del Caso 1, sin que este arreglo del Caso 2 rompa esa
máscara ni su pintado en `src/ui/diff.ts`

3.4 WHEN el nivel tiene normalización fija/fija (Mundo 3 en adelante) THEN el sistema SHALL CONTINUE TO
comportarse exactamente como hoy: el veredicto mostrado es el oficial, sin alineación
(`veredictoParaMostrar` devuelve `oficial` cuando traslación y rotación son fijas)

3.5 WHEN el jugador coincide con Kiro (estrella de precisión otorgada, 3 estrellas) THEN el sistema
SHALL CONTINUE TO no pintar diff (solo la superposición de estelas), dejando intacta la estela-guía
punteada de fondo (Caso 3, intencional)

3.6 WHEN `src/ui/diff.ts` recibe las regiones del validador THEN el sistema SHALL CONTINUE TO pintarlas
fielmente, sin que este arreglo cambie la forma en que `diff.ts` clasifica y colorea los trazos

## Condición del Bug y Propiedades

### Función de Condición del Bug

```pascal
FUNCTION isBugCondition(X)
  INPUT: X = { jugador, objetivo, normalizacion }
  OUTPUT: boolean

  // El bug se manifiesta en normalización libre (Mundo 0/1), cuando el jugador trazó la
  // forma correcta pero con tramos un poco distintos, la estrella de precisión fue negada,
  // y `veredictoParaMostrar` elige la comparación ALINEADA por caja envolvente (porque su
  // IoU es mayor), cuya alineación desplaza ~10px la figura y descoloca un tramo inicial
  // que en POSICIONES REALES coincide con el de Kiro, pintándolo rojo + punteado.
  oficial ← validar(X.jugador, X.objetivo, X.normalizacion)
  real    ← validar(X.jugador, X.objetivo, POSICIONES_REALES)
  mostrado ← (real.iou >= oficial.iou) ? real : oficial   // = veredictoParaMostrar(...)

  RETURN esNormalizacionLibre(X.normalizacion)
         AND NOT oficial.coincide
         AND NOT real.coincide
         AND X.jugador no está vacía
         AND mostrado == oficial                    // se pinta la comparación alineada
         AND tramoInicialCoincideEnReal(X)          // en posiciones reales el inicio está sobre Kiro
         AND tramoInicialSeDescolocaAlAlinear(X)    // la alineación por caja lo saca de la coincidencia
END FUNCTION
```

Instancia concreta (contraejemplo medido):

```pascal
// Caso 2 — tramo inicial coincidente pintado rojo + punteado por desfase de alineación.
FUNCTION isBugCondition_caso2(X)
  // Figura escalonada del nivel 0.3, reto AC3VRQC (normalización libre/libre).
  //   Kiro:    AVANZA 80 / GD 90 / AVANZA 140 / GI 90 / AVANZA 120 / GD 90 / AVANZA 140
  //   Jugador: igual pero con 150 en los tramos largos.
  INPUT: X = { jugador: escalonada con 150, objetivo: escalonada con 140, normalizacion: libre }
  OUTPUT: boolean
  // Medido: oficial.iou (ALINEADA por caja) = 0.7965, real.iou (posiciones reales) = 0.7212.
  //   real.iou (0.7212) >= oficial.iou (0.7965)  →  false  →  se muestra `oficial` (alineada).
  //   La alineación por caja envolvente mete un desfase de ~10px que descoloca el inicio,
  //   y el tramo inicial coincidente se pinta rojo + punteado en vez de verde.
  RETURN true
END FUNCTION
```

### Especificación de la Propiedad (Fix Checking)

```pascal
// Propiedad: para toda entrada que dispara el bug, el tramo inicial que en posiciones
// reales coincide con el de Kiro se pinta como coincidencia (verde), sin que el desfase de
// la alineación por caja envolvente lo clasifique como exceso o falta; y el veredicto
// OFICIAL (del que salen las estrellas) no cambia.
FOR ALL X WHERE isBugCondition(X) DO
  mostrado' ← veredictoParaMostrar'(validar(X.jugador, X.objetivo, X.normalizacion),
                                     X.jugador, X.objetivo, X.normalizacion)
  // Fix Checking: el tramo inicial coincidente en posiciones reales se pinta verde.
  ASSERT tramoInicialSePintaComoCoincidencia(mostrado', X)
  ASSERT NOT tramoInicialSePintaComoExcesoOFalta(mostrado', X)

  // El veredicto OFICIAL y las estrellas quedan intactos.
  oficial  ← validar(X.jugador, X.objetivo, X.normalizacion)
  oficial' ← validar(X.jugador, X.objetivo, X.normalizacion)   // la firma/semántica de `validar` no cambia
  ASSERT oficial'.excesoPorcentaje = oficial.excesoPorcentaje
  ASSERT oficial'.coincide        = oficial.coincide
  ASSERT oficial'.motivo          = oficial.motivo
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

- `excesoPorcentaje`, `coincide` y `motivo` del veredicto OFICIAL salen del mismo cálculo sobre las
  máscaras dilatadas, idénticos antes y después: la estrella de precisión no cambia (requisito 3.1).
- Una figura **correcta** pero trasladada o rotada en normalización libre (Mundo 0/1) sigue saliendo
  toda verde: la alineación libre que permite reconocerla no se rompe (requisito 3.2).
- El Caso 1 (excedente real a lo largo del trazo pintado con `excesoVisual`) sigue funcionando: la
  máscara `excesoVisual` y su pintado quedan intactos (requisito 3.3).
- La normalización fija/fija (Mundo 3 en adelante) devuelve el veredicto oficial sin cambios
  (requisito 3.4).
- Coincidencia otorgada (3 estrellas) no pinta diff; la estela-guía se mantiene (requisito 3.5).
- `src/ui/diff.ts` sigue pintando fielmente las regiones que recibe (requisito 3.6).

Definiciones:

- **F**: el código actual, donde `veredictoParaMostrar` elige por `real.iou >= oficial.iou` y, cuando la
  comparación alineada por caja envolvente tiene mayor IoU, pinta esa comparación, cuyo centrado por
  caja desplaza ~10px la figura del jugador y descoloca el tramo inicial coincidente (rojo + punteado).
- **F'**: el código arreglado, donde el tramo inicial que en posiciones reales coincide con el de Kiro
  se pinta verde, sin cambiar el veredicto OFICIAL (`excesoPorcentaje`, `coincide`, `motivo`), sin romper
  la alineación libre de una figura correcta movida ni la máscara `excesoVisual` del Caso 1.
