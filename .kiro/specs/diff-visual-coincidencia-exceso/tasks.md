# Implementation Plan

- [x] 1. Escribir el test exploratorio de la condición del bug (Caso 1, contraejemplo medido)
  - **Property 1: Bug Condition** - El exceso para pintar no cubre el excedente real (línea 110 vs línea 100)
  - **CRÍTICO**: Este test DEBE FALLAR sobre el código SIN arreglar; el fallo confirma que el bug existe.
  - **NO intentar arreglar el test ni el código cuando falle**: el fallo es el resultado esperado en esta fase.
  - **NOTA**: Este test codifica el comportamiento esperado; validará el arreglo cuando pase tras la implementación.
  - **OBJETIVO**: Surgir el contraejemplo que demuestra que la región de exceso PARA PINTAR, derivada sobre máscaras dilatadas, absorbe el excedente real como coincidencia.
  - **Enfoque PBT acotado**: como es un bug determinista, acotar la propiedad al caso concreto que falla (línea de Kiro `AVANZA 100` vs jugador `AVANZA 110`), para reproducibilidad.
  - Ubicar el test en `src/motor/validador.test.ts`.
  - **Caso 1 — exceso oculto (línea 110 contra línea 100)**: objetivo = `[seg(0,0,0,100,0)]` (línea vertical de 100); jugador = `[seg(0,0,0,110,0)]` (misma línea pero de 110); normalización **libre**. Validar y afirmar que la región de exceso **para pintar** (`excesoVisual`, salida nueva del veredicto) cubre el excedente real a lo largo del trazo: debe haber posiciones de exceso repartidas desde ~`y=100` hasta `y=110`, no concentradas en una puntita de ~2px en el extremo.
  - La aserción debe coincidir con la Expected Behavior del design (Correctness Property 1 e `expectedBehavior`): `excedenteRealVisible(input) ⊆ v'.excesoVisual` a lo largo de todo el trazo.
  - Ejecutar el test sobre el código SIN arreglar (`npm test`).
  - **RESULTADO ESPERADO**: el test FALLA (correcto: hoy `excesoVisual` no existe y el exceso dilatado es ~170 celdas casi todas en la punta, mientras `coincidencia` dilatada absorbe ~8px del excedente).
  - Documentar el contraejemplo observado (p. ej. «`exceso` tiene ~170 celdas concentradas en el extremo; el excedente real de ~10 unidades a lo largo del trazo no aparece como rojo») para confirmar la causa raíz.
  - **RESTRICCIONES**: NO tocar el Caso 2 (`veredictoParaMostrar`) ni el Caso 3 (`pintarVista`/estela-guía); el test observa `excesoVisual`, no toca `excesoPorcentaje`/`coincide`/`motivo`.
  - Marcar la tarea como completa cuando el test esté escrito, ejecutado y el fallo documentado.
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 2. Escribir los tests de preservación (observation-first, ANTES del arreglo)
  - **Property 2: Preservation** - Veredicto idéntico, figura correcta movida, fija/fija, coincidencia y estela vacía intactas
  - **IMPORTANTE**: Seguir la metodología observation-first: observar el comportamiento del código SIN arreglar para las entradas que NO disparan el bug (`isBugCondition` falso) y fijar ese comportamiento en los tests.
  - Ubicar los tests en `src/motor/validador.test.ts`, reutilizando el arbitrario `figuraArb` del bloque `describe('Feature: 08-diseno-visual, Property 1', …)`.
  - **Veredicto idéntico (3.1)** — property-based: con `figuraArb` × `figuraArb` y normalización libre, afirmar que `validar` da los mismos `excesoPorcentaje`, `coincide` y `motivo` que hoy (comparar `validar` consigo mismo como línea base; ≥ 100 iteraciones). Sobre el código sin arreglar, trivialmente pasa; tras el arreglo, garantiza que la nueva salida `excesoVisual` no alteró el conteo.
  - **Figura correcta movida (3.2)**: figura completa y correcta trasladada/girada en normalización libre; observar y afirmar que el exceso para pintar sale **vacío** (`excesoVisual` sin celdas o ausente → toda verde), sin introducir rojo sobre una figura que coincide.
  - **Fija/fija (3.3)**: con normalización `FIJA`, `validar` devuelve el veredicto oficial tal cual, igual que hoy.
  - **Coincidencia otorgada (3.4)**: un dibujo que coincide (`coincide === true`) se comporta como hoy; no se deriva exceso visual que contradiga la coincidencia.
  - **Estela vacía (3.5)**: sin estela del jugador (`motivo === 'sinEstelaDelJugador'`) la falta es toda la figura de referencia y el exceso visual sale vacío.
  - **Property existente intacta (3.1/3.5)**: la propiedad existente «el IoU mostrado nunca baja del oficial y la calificación no cambia» (bloque `Feature: 08-diseno-visual, Property 1`) debe seguir pasando con `figuraArb` y ≥ 100 iteraciones.
  - Property-based recomendado para la preservación: captura bordes en todo el dominio de figuras que las pruebas por ejemplo no cubren.
  - Ejecutar los tests sobre el código SIN arreglar (`npm test`).
  - **RESULTADO ESPERADO**: los tests PASAN (confirma la línea base a preservar).
  - **RESTRICCIONES**: NO tocar el Caso 2 (`veredictoParaMostrar`) ni el Caso 3 (`pintarVista`/estela-guía); los tests no deben depender del cálculo de `excesoPorcentaje` cambiando.
  - Marcar la tarea como completa cuando los tests estén escritos, ejecutados y pasando sobre el código sin arreglar.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Arreglo del exceso visual del diff (Opción A — máscara nueva `excesoVisual`)

  - [x] 3.1 Derivar y propagar la máscara `excesoVisual` en el validador
    - Fichero: `src/motor/validador.ts`; funciones: `comparar`, `validar`; interfaz `Veredicto`.
    - Derivar una máscara **nueva** `excesoVisual` = las posiciones del trazo del jugador que caen **fuera** de la máscara de Kiro **sin dilatar** (o dilatada con un radio menor que 8px), de modo que el excedente a lo largo del trazo se pinte rojo. Para ello, dar acceso al punto de cálculo a la máscara objetivo sin dilatar (o con radio menor): pasarla como parámetro adicional a `comparar`, o calcular `excesoVisual` en `validar` tras `comparar` con las máscaras sin dilatar ya disponibles antes de `dilatar`.
    - Añadir a `interface Veredicto` el campo `readonly excesoVisual?: Mascara;` (opcional, para no romper los veredictos de prueba existentes que no lo fijan). Propagar `excesoVisual` al `Veredicto` en las tres ramas de `validar` (sin estela / rotación libre / rotación fija); en la rama sin estela y en «figura correcta movida» (sin excedente real), `excesoVisual` sale vacía.
    - **NO modificar** la pasada que calcula `interseccion`, `soloAd`, `soloBd`, `totalAd`, `union`, `iou`, `excesoPorcentaje`, `coincide` ni `motivo`: debe quedar **byte a byte igual** (las máscaras dilatadas `exceso`/`coincidencia`/`falta` y el `excesoPorcentaje` que alimenta la estrella no cambian).
    - **NO tocar** `veredictoParaMostrar` ni su desempate por IoU (Caso 2, fuera de alcance), `buscarMejorGiro`, `src/juego/estrellas.ts` ni la firma de la llamada desde `src/main.ts`.
    - _Bug_Condition: isBugCondition(X) del design — normalización libre, `!oficial.coincide`, estela del jugador presente, el jugador excede un poco y `excedenteRealVisible(X) ⊄ oficial.exceso` (la dilatada lo absorbe como coincidencia)_
    - _Expected_Behavior: expectedBehavior(v') — `excedenteRealVisible(X) ⊆ v'.excesoVisual` a lo largo del trazo; `excesoPorcentaje`/`coincide`/`motivo` idénticos (Correctness Property 1)_
    - _Preservation: veredicto y estrellas intactos (3.1), figura correcta movida verde (3.2), fija/fija (3.3), coincidencia (3.4), estela vacía (3.5)_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Pintar con `excesoVisual` en `src/ui/diff.ts`
    - Fichero: `src/ui/diff.ts`; interfaz `RegionesDiff`; función `dibujarLimpio`.
    - Añadir a `interface RegionesDiff` el campo `readonly excesoVisual?: Mascara;`.
    - En `dibujarLimpio`, al clasificar cada tramo del jugador, usar `regiones.excesoVisual` (cuando está presente) **en lugar de** `regiones.exceso` para decidir el rojo; la coincidencia pintada es el trazo del jugador que **no** cae en `excesoVisual`. Si `excesoVisual` no viene (llamadas antiguas), usar `regiones.exceso` como hoy, de modo que `diff.ts` siga pintando fielmente (comportamiento de hoy, requisito 3.5).
    - El dibujo de la **falta** (desde la referencia) NO cambia.
    - **NO tocar** `veredictoParaMostrar` (Caso 2) ni el pintado de la estela-guía / `pintarVista` para el caso de coincidencia (Caso 3).
    - _Bug_Condition: isBugCondition(X) del design (Caso 1)_
    - _Expected_Behavior: el rojo cubre el excedente real a lo largo del trazo usando `excesoVisual`_
    - _Preservation: sin `excesoVisual`, `diff.ts` se comporta como hoy (requisito 3.5); la falta no cambia_
    - _Requirements: 2.1, 3.5_

  - [x] 3.3 Reenviar `excesoVisual` desde `src/ui/comparacion.ts`
    - Fichero: `src/ui/comparacion.ts`; función `pintarDiff`.
    - Incluir `excesoVisual: v.excesoVisual` en el objeto `RegionesDiff` que se pasa a `deps.diff.dibujar(...)`. El resto de campos no cambia.
    - **NO tocar** `pintarVista` para el caso de coincidencia ni la estela-guía (Caso 3 intencional, fuera de alcance).
    - _Bug_Condition: isBugCondition(X) del design (Caso 1)_
    - _Expected_Behavior: el veredicto de Caso 1 llega a `diff.dibujar` con su `excesoVisual`_
    - _Preservation: `pintarVista` y la estela-guía (Caso 3) no cambian; el texto `aria-live` sale de `excesoPorcentaje`, que no cambia_
    - _Requirements: 2.1, 3.4_

  - [x] 3.4 Verificar que el test exploratorio de la tarea 1 ahora pasa (fix checking)
    - **Property 1: Expected Behavior** - El exceso para pintar cubre el excedente real (línea 110 vs línea 100)
    - **IMPORTANTE**: Re-ejecutar el MISMO test de la tarea 1; NO escribir un test nuevo. Ese test codifica el comportamiento esperado.
    - Ejecutar el test exploratorio de la tarea 1 (`npm test`).
    - **RESULTADO ESPERADO**: el test PASA — `excesoVisual` cubre el excedente real repartido a lo largo del trazo (de ~`y=100` a `y=110`), no solo la puntita.
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 Verificar que los tests de preservación de la tarea 2 siguen pasando (preservation checking)
    - **Property 2: Preservation** - Veredicto idéntico, figura correcta movida, fija/fija, coincidencia y estela vacía intactas
    - **IMPORTANTE**: Re-ejecutar los MISMOS tests de la tarea 2; NO escribir tests nuevos.
    - Ejecutar los tests de preservación de la tarea 2 (`npm test`), incluido el veredicto idéntico (`excesoPorcentaje`/`coincide`/`motivo`) y la property existente «el IoU mostrado nunca baja del oficial y la calificación no cambia».
    - **RESULTADO ESPERADO**: los tests PASAN — sin regresiones en veredicto/estrellas (3.1), figura correcta movida (3.2), fija/fija (3.3), coincidencia (3.4) ni estela vacía (3.5).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Verificación final de toda la suite
  - Ejecutar `npm test` (vitest --run) y confirmar que toda la suite pasa en verde.
  - Verificar explícitamente que sigue pasando `src/niveles/catalogo.test.ts` (normalización por mundo: Mundo 0/1 libre/libre), que blinda la invariante de alineación libre.
  - Verificar explícitamente que sigue pasando la property de estrellas / «el IoU mostrado nunca baja del oficial y la calificación no cambia».
  - Confirmar que NO se tocó `veredictoParaMostrar` (Caso 2), el cálculo de `excesoPorcentaje`/`coincide`/`motivo`/`iou`, `src/juego/estrellas.ts`, ni `pintarVista` / la estela-guía (Caso 3).
  - Si surgen dudas o fallos inesperados, consultar al usuario.
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_
