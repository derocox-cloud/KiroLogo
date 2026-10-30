# Implementation Plan

- [x] 1. Escribir el test exploratorio de la condición del bug (Caso 2, contraejemplo medido)
  - **Property 1: Bug Condition** - El desempate por IoU pinta la comparación alineada por caja y descoloca el tramo inicial coincidente (escalonada 150 vs 140, reto AC3VRQC)
  - **CRÍTICO**: Este test DEBE FALLAR sobre el código SIN arreglar; el fallo confirma que el bug existe.
  - **NO intentar arreglar el test ni el código cuando falle**: el fallo es el resultado esperado en esta fase.
  - **NOTA**: Este test codifica el comportamiento esperado; validará el arreglo cuando pase tras la implementación.
  - **OBJETIVO**: Surgir el contraejemplo que demuestra que `veredictoParaMostrar`, con el desempate estricto `real.iou >= oficial.iou`, devuelve la comparación ALINEADA por caja envolvente (`oficial`), cuya alineación desplaza ~10px la figura y descoloca el tramo inicial que en posiciones reales coincide con el de Kiro.
  - **Enfoque PBT acotado**: como es un bug determinista, acotar la propiedad al caso concreto que falla (figura escalonada del nivel 0.3, reto `AC3VRQC`), para reproducibilidad.
  - Ubicar el test en `src/motor/validador.test.ts`, en el bloque `describe('validador · veredictoParaMostrar', …)`.
  - **Caso 2 — escalonada 150 vs 140 (contraejemplo medido)**: construir la figura escalonada del nivel 0.3: Kiro = `AVANZA 80 / GD 90 / AVANZA 140 / GI 90 / AVANZA 120 / GD 90 / AVANZA 140` (objetivo), jugador = la misma forma pero con `150` en los tramos largos de `140`; normalización **libre/libre** (`{ traslacion: 'libre', rotacion: 'libre', escala: 'exacta' }`). Validar las dos comparaciones (`LIBRE` → `oficial`; `POSICIONES_REALES` → `real`).
  - Afirmar primero el estado medido que dispara el bug: `oficial.iou > real.iou` (la alineada gana el desempate estricto actual; medido `oficial.iou ≈ 0.7965 > real.iou ≈ 0.7212`), de modo que `real.iou >= oficial.iou` es **falso**.
  - Afirmar el comportamiento esperado tras el arreglo (lo que hoy FALLA): `veredictoParaMostrar(oficial, jugador, objetivo, LIBRE)` devuelve la comparación de **posiciones reales** — `mostrado.traslacion` igual a `{ x: 0, y: 0 }` y `mostrado.angulo` igual a `0`.
  - Afirmar además que, en esa comparación de posiciones reales, el punto medio del tramo inicial del jugador cae en `coincidencia` (verde) y NO en `exceso`/`falta` (ese es el tramo que hoy se pinta rojo + punteado por el desfase de la alineación).
  - Las aserciones deben coincidir con la Expected Behavior del design (Correctness Property 1): el tramo inicial coincidente en posiciones reales se pinta como coincidencia, sin que el desfase de la alineación por caja lo clasifique como exceso o falta.
  - Ejecutar el test sobre el código SIN arreglar (`npm test`, que corre `vitest --run`).
  - **RESULTADO ESPERADO**: el test FALLA (correcto: hoy `veredictoParaMostrar` devuelve `oficial` con traslación/ángulo de la alineación por caja, porque `0.7212 >= 0.7965` es falso).
  - Documentar el contraejemplo observado (p. ej. «`veredictoParaMostrar` devuelve la comparación alineada: `mostrado.traslacion` ≠ `{0,0}` o `mostrado.angulo` ≠ 0; el tramo inicial coincidente cae en exceso/falta en vez de coincidencia») para confirmar la causa raíz.
  - **RESTRICCIONES**: el test observa `veredictoParaMostrar` (qué veredicto se elige para pintar), NO toca `validar`/`comparar`/`traslacionAlCentro` (veredicto oficial y estrellas), NO toca `excesoVisual` (Caso 1) ni `src/ui/diff.ts`, NO toca la coincidencia otorgada (Caso 3) ni la normalización fija/fija.
  - Marcar la tarea como completa cuando el test esté escrito, ejecutado y el fallo documentado.
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Escribir los tests de preservación (observation-first, ANTES del arreglo)
  - **Property 2: Preservation** - Veredicto oficial idéntico, figura correcta movida sigue alineada y verde, fija/fija, coincidencia, Caso 3 y excesoVisual del Caso 1 intactos
  - **IMPORTANTE**: Seguir la metodología observation-first: observar el comportamiento del código SIN arreglar para las entradas que NO disparan el bug (`isBugCondition` falso) y fijar ese comportamiento en los tests.
  - Ubicar los tests en `src/motor/validador.test.ts`, reutilizando el arbitrario `figuraArb` del bloque `describe('Feature: 08-diseno-visual, Property 1', …)`.
  - **Veredicto oficial idéntico (3.1)** — property-based: con `figuraArb` × `figuraArb` y normalización libre, afirmar que `validar` da los mismos `excesoPorcentaje`, `coincide`, `motivo` e `iou` que hoy (comparar `validar` consigo mismo como línea base; ≥ 100 iteraciones). Como `validar` no se toca, es trivialmente cierto sobre el código sin arreglar; se blinda explícitamente para garantizar que el arreglo del desempate no roza el veredicto oficial ni las estrellas.
  - **Figura correcta movida y girada sigue alineada y verde (3.2)**: figura completa y correcta, trasladada y girada, en normalización libre; observar y afirmar que `veredictoParaMostrar` devuelve la comparación **alineada** (`oficial`) —su `real.iou` cae muy por debajo del margen— y que ese veredicto coincide y sale toda verde (sin exceso ni falta). Reutilizar/mantener la prueba existente de «figura bien hecha pero movida y girada» (bloque `validador · veredictoParaMostrar`).
  - **Fija/fija (3.4)**: con normalización `{ traslacion: 'fija', rotacion: 'fija', … }`, `veredictoParaMostrar` devuelve el veredicto oficial tal cual (antes de llegar al desempate), igual que hoy.
  - **Coincidencia otorgada / Caso 3 (3.5)**: un dibujo que coincide (`coincide === true`) o sin estela del jugador (`motivo === 'sinEstelaDelJugador'`) devuelve el oficial; no se muestra como correcto un dibujo al que el oficial negó la precisión.
  - **Caso 1 (`excesoVisual`) intacto (3.3)**: las pruebas del Caso 1 sobre `excesoVisual` (bloque `Bugfix Caso 1: el exceso visual cubre el excedente real del trazo`) siguen verdes; el arreglo del Caso 2 no toca `validar` ni la máscara `excesoVisual`.
  - **Pintado fiel de `diff.ts` (3.6)**: la propiedad existente de `src/ui/diff.ts` (pinta las máscaras recibidas sin modificarlas) sigue verde; `diff.ts` no se toca.
  - Property-based recomendado para la preservación: captura bordes en todo el dominio de figuras que las pruebas por ejemplo no cubren.
  - Ejecutar los tests sobre el código SIN arreglar (`npm test`).
  - **RESULTADO ESPERADO**: los tests PASAN (confirma la línea base a preservar).
  - **RESTRICCIONES**: NO depender de que `veredictoParaMostrar` ya pinte la comparación real en el Caso 2 (eso lo arregla la tarea 3); los tests de preservación cubren solo entradas donde `isBugCondition` es falso.
  - Marcar la tarea como completa cuando los tests estén escritos, ejecutados y pasando sobre el código sin arreglar.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Arreglo del desfase de alineación del Caso 2 (Opción B — ampliar el desempate de `veredictoParaMostrar` con `MARGEN_MOSTRAR_REAL`)

  - [x] 3.1 Implementar la condición del desempate con `MARGEN_MOSTRAR_REAL`
    - Fichero: `src/motor/validador.ts`; función: `veredictoParaMostrar`.
    - Añadir una **constante nueva exportada** `MARGEN_MOSTRAR_REAL` (tolerancia de IoU, p. ej. `0.1`): el umbral por debajo del cual la comparación en posiciones reales se prefiere para pintar aunque su IoU sea algo menor que la alineada. Exportarla para que la prueba de propiedad la lea y no duplique un número mágico. Calibrar el valor en RED→GREEN: debe cubrir el contraejemplo medido (`0.7965 - 0.7212 = 0.0753`) sin que una figura mal hecha (que en su sitio no se parece a nada, `real.iou` muy bajo) caiga dentro del margen.
    - Cambiar **solo** la última decisión de `veredictoParaMostrar`: de `return real.iou >= oficial.iou ? real : oficial;` a `return real.iou >= oficial.iou - MARGEN_MOSTRAR_REAL ? real : oficial;`.
    - Las dos guardas previas **no cambian**: sigue devolviendo `oficial` cuando `traslacion` y `rotacion` son fijas (3.4), cuando `oficial.motivo === 'sinEstelaDelJugador'`, y cuando `real.coincide || real.motivo === 'sinEstelaDelJugador'` (nunca se muestra como correcto un dibujo al que el oficial negó la precisión, Caso 3 / 3.5).
    - **NO tocar** `validar`, `comparar`, `buscarMejorGiro`, `traslacionAlCentro`, `dilatar`, `rasterizar` ni la interfaz `Veredicto`: el veredicto **oficial** (`excesoPorcentaje`, `coincide`, `motivo`, `iou`) sale byte a byte igual (3.1). **NO tocar** `excesoVisual` (Caso 1, 3.3), `src/ui/diff.ts` (3.6), `src/ui/comparacion.ts`, la firma de la llamada desde `src/main.ts` ni `src/juego/estrellas.ts`.
    - _Bug_Condition: isBugCondition(input) del design — normalización libre/libre, `!oficial.coincide`, `!real.coincide`, estela del jugador presente, `mostrado == oficial` (se pinta la alineada por caja), y el tramo inicial coincide en posiciones reales pero se descoloca al alinear por caja envolvente_
    - _Expected_Behavior: expectedBehavior del design (Correctness Property 1) — el tramo inicial que en posiciones reales está sobre Kiro se pinta verde; cuando `oficial.iou - MARGEN_MOSTRAR_REAL <= real.iou < oficial.iou` se muestra la comparación de posiciones reales; el veredicto oficial (`excesoPorcentaje`/`coincide`/`motivo`/`iou`) queda idéntico_
    - _Preservation: veredicto oficial y estrellas intactos (3.1), figura correcta movida sigue alineada y verde (3.2), excesoVisual del Caso 1 intacto (3.3), fija/fija (3.4), coincidencia/Caso 3 (3.5), diff.ts pinta fiel (3.6)_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.4, 3.5_

  - [x] 3.2 Actualizar la aserción afectada del property test del IoU mostrado
    - Fichero: `src/motor/validador.test.ts`; bloque `describe('Feature: 08-diseno-visual, Property 1: el veredicto de presentación nunca empeora la coincidencia', …)`, test `el IoU mostrado nunca baja del oficial y la calificación no cambia (≥ 100 iteraciones)`.
    - **Relajar SOLO la aserción (1)** del invariante del IoU mostrado: de `expect(mostrado.iou).toBeGreaterThanOrEqual(oficial.iou)` a `expect(mostrado.iou).toBeGreaterThanOrEqual(oficial.iou - MARGEN_MOSTRAR_REAL)`, importando `MARGEN_MOSTRAR_REAL` de `src/motor/validador.ts` (no un número mágico). Documentar en un comentario por qué se relaja (Opción B del design: la presentación puede preferir una comparación con IoU ligeramente menor cuando es la que el jugador ve en pantalla).
    - **Mantener INTACTAS las aserciones (2) y (3)** de esa propiedad: (2) `mostrado` es siempre uno de los dos veredictos reales (oficial o posiciones reales), nunca inventado ni modificado; (3) un dibujo al que el oficial negó la precisión nunca se muestra como correcto.
    - **Ajustar la aserción (4)** (cambio autorizado por el usuario, opción 1): ya NO exige que la precisión/calificación derivada del mostrado iguale byte a byte a la del oficial. Ahora exige únicamente **equivalencia de "otorgada"**: `precisionDeVeredicto(mostrado) === 'otorgada'` sii `precisionDeVeredicto(oficial) === 'otorgada'`. NO exige el mismo sub-motivo de "negada", porque un veredicto rerutado a posiciones reales puede caer en `iouInsuficiente` en vez de `excesoDeTrazo` sin cambiar el número de estrellas (las estrellas salen del veredicto oficial, no del mostrado).
    - Revisar las otras aserciones `mostrado.iou >= oficial.iou` del bloque `validador · veredictoParaMostrar` (p. ej. la de «uno de los dos» y la del caso incompleto): si alguna asume el invariante estricto para entradas que el desempate ampliado reruta, relajarla a la misma tolerancia `oficial.iou - MARGEN_MOSTRAR_REAL`; dejar intacta cualquiera que valide un caso donde `real.iou >= oficial.iou` (resultado idéntico al actual).
    - **NO ampliar** la propiedad a nuevas invariantes ni tocar la aserción de calificación/estrellas; solo relajar el piso del IoU mostrado a la tolerancia acotada.
    - _Bug_Condition: isBugCondition(input) del design (Caso 2)_
    - _Expected_Behavior: la aserción (1) del IoU mostrado se relaja a `mostrado.iou >= oficial.iou - MARGEN_MOSTRAR_REAL` y la aserción (4) se ajusta a equivalencia de "otorgada" (el mostrado otorga precisión sii el oficial la otorga), manteniendo que el mostrado es uno de los dos veredictos reales_
    - _Preservation: las aserciones (2) y (3) de la propiedad quedan intactas; la calificación no cambia porque las estrellas salen del veredicto oficial (3.1)_
    - _Requirements: 2.2, 3.1_

  - [x] 3.3 Verificar que el test exploratorio de la tarea 1 ahora pasa (fix checking)
    - **Property 1: Expected Behavior** - El tramo inicial coincidente se pinta verde: `veredictoParaMostrar` devuelve la comparación de posiciones reales (escalonada 150 vs 140)
    - **IMPORTANTE**: Re-ejecutar el MISMO test de la tarea 1; NO escribir un test nuevo. Ese test codifica el comportamiento esperado.
    - Ejecutar el test exploratorio de la tarea 1 (`npm test`).
    - **RESULTADO ESPERADO**: el test PASA — `veredictoParaMostrar` devuelve la comparación de posiciones reales (`mostrado.traslacion === { x: 0, y: 0 }`, `mostrado.angulo === 0`) y el tramo inicial coincidente cae en `coincidencia` (verde), no en `exceso`/`falta`.
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verificar que los tests de preservación de la tarea 2 siguen pasando (preservation checking)
    - **Property 2: Preservation** - Veredicto oficial idéntico, figura correcta movida alineada y verde, fija/fija, coincidencia, Caso 3 y excesoVisual del Caso 1 intactos
    - **IMPORTANTE**: Re-ejecutar los MISMOS tests de la tarea 2; NO escribir tests nuevos.
    - Ejecutar los tests de preservación de la tarea 2 (`npm test`), incluido el veredicto oficial idéntico (`excesoPorcentaje`/`coincide`/`motivo`/`iou`), la figura correcta movida que sigue alineada y verde, fija/fija, coincidencia/Caso 3, el Caso 1 (`excesoVisual`) y el pintado fiel de `diff.ts`.
    - **RESULTADO ESPERADO**: los tests PASAN — sin regresiones en veredicto oficial/estrellas (3.1), figura correcta movida (3.2), excesoVisual del Caso 1 (3.3), fija/fija (3.4), coincidencia/Caso 3 (3.5) ni pintado fiel de diff.ts (3.6).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Verificación final de toda la suite
  - Ejecutar `npm test` (vitest --run) y confirmar que toda la suite pasa en verde.
  - Verificar explícitamente que sigue pasando `src/niveles/catalogo.test.ts` (normalización por mundo: Mundo 0/1 libre/libre), que blinda la invariante de alineación libre (3.2).
  - Verificar explícitamente que sigue pasando la property del IoU mostrado ya actualizada (`mostrado.iou >= oficial.iou - MARGEN_MOSTRAR_REAL`): la aserción (1) relajada a la tolerancia acotada y la (4) ajustada a equivalencia de "otorgada" (el mostrado otorga precisión sii el oficial la otorga), con las aserciones (2) y (3) intactas (mostrado es uno de los dos reales, dibujo negado no se muestra correcto). Que la calificación no cambie se blinda por el veredicto oficial (`validar`), no por el mostrado.
  - Verificar explícitamente que siguen verdes las pruebas del Caso 1 (`excesoVisual`) y las de `src/ui/diff.ts`.
  - Confirmar explícitamente que NO se tocó `validar`, `comparar`, `traslacionAlCentro`, `buscarMejorGiro`, el cálculo de `excesoPorcentaje`/`coincide`/`motivo`/`iou` del veredicto oficial, `src/juego/estrellas.ts`, la máscara `excesoVisual` (Caso 1), `src/ui/diff.ts`, `src/ui/comparacion.ts` ni la coincidencia otorgada / estela-guía (Caso 3).
  - Si surgen dudas o fallos inesperados, consultar al usuario.
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
