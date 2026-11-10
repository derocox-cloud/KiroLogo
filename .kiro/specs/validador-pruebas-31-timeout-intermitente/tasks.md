# Implementation Plan

Issue #27, rama `fix/27-timeout-pruebas-validador`. Único archivo a modificar: `src/motor/validador.test.ts`. Sin cambios en `src/motor/validador.ts`, `package.json`, lockfile ni `vitest.config`.

## Reglas TDD estrictas (aplican a TODAS las tareas)

- **Ciclo obligatorio RED → GREEN → REFACTOR por cada cambio.** Está prohibido escribir o cambiar código (de prueba o de producción) antes de tener una prueba que falle **por la razón correcta**.
- **RED**: escribir primero la prueba y ejecutarla viendo que FALLA. Se registra la salida literal y se confirma que la razón del fallo es la esperada (por ejemplo «`crearFiguraArb` no existe» o «la longitud total de trazo supera el presupuesto»), no un error de sintaxis, de importación ajena ni un timeout casual.
- **GREEN**: implementar lo mínimo para pasar y ver la prueba en verde. Las mediciones de tiempo (aislada y bajo carga) se registran como evidencia de GREEN.
- **REFACTOR**: limpiar con las pruebas en verde, sin cambiar comportamiento; se vuelve a ejecutar lo afectado y se anota que sigue en verde.
- Cada paso de la estrategia (1 figuras ligeras, 2 `numRuns`, 3 timeout 120 s) abre con su RED propio.
- Las pruebas de apoyo que se comitean van en `src/motor/validador.test.ts` (o junto al módulo), sin `Math.random`, con semillas explícitas de `fast-check` y **sin timeout global**: cada prueba lleva su timeout explícito.
- Los scripts de medición exploratoria NO se comitean; solo se comitean las pruebas que protegen una propiedad.
- Commits en español que explican el **por qué**, **un commit por ciclo completo** (RED + GREEN + REFACTOR juntos), sin atribución de IA ni `Co-Authored-By`, formato de commits convencionales.
- La estrategia se aplica en orden estricto: 3.1 → 3.2 → 3.3 (el timeout de 120 s es el último recurso). Un paso posterior solo se abre si el RED medido del paso anterior demuestra que no bastó.

- [x] 1. Medir la línea base y escribir la prueba de exploración de la condición del defecto
  - **Property 1: Bug Condition** - Las pruebas 3.1 terminan con margen bajo su timeout
  - **IMPORTANT**: Esta tarea se hace ANTES de cambiar nada en `src/motor/validador.test.ts`; es el RED medido del defecto
  - **GOAL**: Confirmar con números que las pruebas 3.1 cumplen `isBugCondition` y fijar la línea base y los umbrales que usarán los RED de los pasos
  - **Scoped PBT Approach**: el defecto es determinista y de rendimiento; acotar la propiedad a las dos pruebas «3.1» con sus semillas actuales (2802 y 20 241) y sus 100 iteraciones
  - Registrar `node -v` (debe ser 24) y CPU/núcleos; usar la misma máquina para todas las mediciones y no correr nada más en paralelo
  - Aislada: `npx vitest --run src/motor/validador.test.ts -t "3.1" --reporter=verbose`, tres corridas consecutivas; anotar la duración de cada prueba y tomar el máximo
  - Bajo carga: `npm test -- --maxWorkers=2 --reporter=verbose`, tres corridas consecutivas; anotar el máximo de las dos pruebas 3.1
  - Medir la curva de costo con un script temporal fuera del repo o un `it.skip` local NO comiteado: tiempo por iteración y longitud total de trazo promedio y máxima con arbitrarios equivalentes a `crearFiguraArb` en (4, 150), (3, 100), (2, 80) y (2, 60), con las semillas 2802 y 20 241; confirmar o refutar la hipótesis de que el tiempo escala con la longitud de trazo
  - Fijar, a partir de la curva, los umbrales numéricos que usarán los RED siguientes: (a) tope de longitud total de trazo por figura y por muestra para el paso 1, (b) tope de `numRuns × longitud media` para el paso 2; dejar ambos anotados con su justificación
  - **EXPECTED OUTCOME**: aislada ≥ 54 s en ambas pruebas (≥ 90 % de 60 s) y al menos una corrida bajo carga cerca de, o por encima de, 60 s; esto confirma que el defecto existe
  - **Evidencia RED a anotar**: salida de las 3 corridas aisladas y de las 3 bajo carga (duración por prueba, resultado, máximo), `node -v`, CPU/núcleos, tabla de la curva de costo y los umbrales fijados
  - **Evidencia GREEN a anotar**: no aplica (esta tarea solo observa el defecto); la medición equivalente en verde se repite en 3.4
  - Si la medición refuta la hipótesis (costo constante por llamada), anotarlo: el paso 1 no basta y se pasa a 3.2 sin insistir en reducir figuras (su RED sigue siendo obligatorio)
  - Sin commit (solo mediciones y script temporal fuera del repo)
  - Marcar la tarea completa cuando la medición esté hecha y registrada
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [~] 2. Escribir las pruebas de preservación como pruebas de caracterización (ANTES de aplicar el arreglo)
  - **Property 2: Preservation** - Comportamiento fuera de las pruebas 3.1 y de sus aserciones
  - **IMPORTANT**: Seguir la metodología de observación primero; son pruebas de caracterización, por lo que PASAN sobre el código sin arreglar. Para cumplir el ciclo, su RED se obtiene por mutación: se rompe a propósito lo protegido y se ve que la prueba falla por la razón correcta
  - Observar sobre el código SIN arreglar: la prueba de la línea ~835 (semilla 804, 100 iteraciones, timeout 120 s) pasa; registrar su duración aislada
  - Observar `fc.sample(figuraArb, { seed: 804, numRuns: 100 })` y calcular su huella (hash estable del JSON de la muestra) y las 3 primeras figuras literales; guardar ambas como constantes en `src/motor/validador.test.ts`
  - Escribir la prueba comiteable «`figuraArb` conserva su muestra sembrada (semilla 804)» que compara la muestra actual contra la huella y las 3 primeras figuras literales; sin `Math.random`, con semilla explícita
  - Observar que `grep -n "Math.random" src/motor/validador.test.ts` y `grep -rn "testTimeout" vitest.config.* vite.config.*` no devuelven resultados y que las semillas 2802 y 20 241 están presentes
  - Ejecutar `npm test -- --maxWorkers=2` y confirmar que el resto de la suite pasa en el código sin arreglar
  - **RED (por mutación)**: cambiar temporalmente un límite de `figuraArb` (por ejemplo rango 150 → 149) y ver que la prueba de huella FALLA por diferencia de muestra; revertir la mutación y comprobar que vuelve a verde
  - **GREEN**: la prueba de huella y el resto de las comprobaciones PASAN sobre el código sin arreglar
  - **REFACTOR**: dejar nombres y comentarios (el *por qué* de la huella) con las pruebas en verde, sin cambiar comportamiento
  - **Evidencia RED a anotar**: salida del fallo de la mutación (diff de muestra) y confirmación de que se revirtió
  - **Evidencia GREEN a anotar**: salida en verde de la prueba de huella, duración aislada de la prueba ~835, y suite completa en verde
  - **Commit** (español, por qué): `test(validador): fijar la huella de figuraArb con semilla 804 para proteger la prueba de la línea ~835`
  - **EXPECTED OUTCOME**: las comprobaciones de preservación PASAN sobre el código sin arreglar (confirma la línea base a preservar) y se demostró que detectan una alteración
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Arreglo de las pruebas 3.1 intermitentes por timeout (estrategia en orden estricto, un ciclo RED → GREEN → REFACTOR por paso, midiendo entre paso y paso)

  - [~] 3.1 Paso 1: `crearFiguraArb` y figuras ligeras (ciclo TDD completo)
    - **RED (escribir y ver fallar ANTES de tocar `figuraArb`)**:
      - Añadir en `src/motor/validador.test.ts` el punto de enganche de prueba `figurasDe31Arb` (alias de `figuraArb`) y hacer que las dos pruebas 3.1 lo usen; no cambia comportamiento y se comitea junto al resto del ciclo
      - (a) Pruebas de `crearFiguraArb` que fallan porque la fábrica aún no existe: equivalencia sembrada con semilla 804 de `crearFiguraArb()` contra la huella/figuras literales de la tarea 2 (el `figuraArb` original); límites de tramos (1 a `maxTramos`) y de rango (coordenadas dentro de ±`rango`) con `crearFiguraArb({ maxTramos: 2, rango: 80 })`; polilínea conexa (cada tramo parte del destino del anterior); `minLength: 1`; el caso límite de un tramo de longitud 0 sigue siendo generable/válido
      - (b) Prueba de presupuesto que fija la propiedad del arreglo y falla sobre el estado actual: las figuras de `figurasDe31Arb`, muestreadas con las semillas 2802 y 20 241, tienen una longitud total de trazo acotada por el umbral fijado en la tarea 1; falla hoy porque 3.1 usa `figuraArb` (4 tramos, ±150)
      - (c) Prueba de cobertura de motivos con semillas 2802 y 20 241 sobre `figurasDe31Arb`: al menos un caso de cada motivo (`coincide`, `excesoDeTrazo`, `iouInsuficiente`, `sinEstelaDelJugador`) y ambos valores de `coincide`; con timeout explícito por prueba (nunca global). Si ya pasa en el estado actual se anota como guarda de no regresión (no como motor del RED) y se demuestra su sensibilidad con una mutación puntual
      - Ejecutar `npx vitest --run src/motor/validador.test.ts -t "crearFiguraArb|presupuesto|cobertura"` y VER el fallo
    - **Evidencia RED a anotar**: salida literal de la ejecución con los fallos; (a) «`crearFiguraArb` is not defined / not a function», (b) «longitud total de trazo X > umbral Y» con los valores medidos; confirmar que la razón del fallo es la correcta y no un error de sintaxis; nota sobre si (c) pasa o falla hoy
    - **GREEN (lo mínimo para pasar)**:
      - Reemplazar `figuraArb` por la fábrica `crearFiguraArb({ maxTramos = 4, rango = 150 } = {})` y definir `const figuraArb = crearFiguraArb()`; con los valores por defecto conserva el orden de generadores y los límites, de modo que la prueba de la línea ~835 genera lo mismo con la semilla 804
      - Crear `const figuraLigeraArb = crearFiguraArb({ maxTramos: 2, rango: 80 })` como primera hipótesis y apuntar `figurasDe31Arb` a ella; usarla solo en las dos pruebas 3.1
      - Mantener `minLength: 1`, enteros y polilínea conexa para que toda figura siga siendo válida para el validador
      - Actualizar el título de las dos pruebas de «con figuraArb × figuraArb» a «con figuras ligeras» (`-t "3.1"` sigue coincidiendo)
      - Ver las pruebas (a), (b) y (c) en VERDE
      - Medir con el protocolo de la tarea 1 (3 corridas aisladas y 3 bajo carga) y aceptar el paso solo si aislada ≤ 30 s, bajo carga ≤ 60 s y 3 de 3 en verde
      - Si no cumple, volver a RED con un umbral/parámetro más estricto y ajustar dentro del paso 1 (candidatos: tramos 2–3, rango 60–100) con el menor recorte posible, sin bajar de 2 tramos ni de rango 60; si aun así no cumple, abrir 3.2
      - Si (c) revela que falta algún motivo, primero se escribe la prueba que lo exige (RED) y luego se añaden dos `examples` fijos de `fast-check` (figura vacía o degenerada, y objetivo igual al jugador) antes que ensanchar las figuras
    - **Evidencia GREEN a anotar**: salida en verde de (a), (b) y (c); conteo de motivos y de `coincide` true/false con las semillas 2802 y 20 241; tabla de tiempos del paso 1 (aislada ×3, carga ×3, máximos) comparada con la línea base de la tarea 1
    - **REFACTOR (con todo en verde, sin cambiar comportamiento)**: ordenar la fábrica y sus constantes, nombrar los umbrales, ajustar comentarios del *por qué* de las figuras ligeras; volver a ejecutar las pruebas (a), (b), (c), las dos 3.1 y la de la línea ~835 y anotar que siguen en verde
    - **Commit** (español, por qué), solo si el ciclo está completo: `test(validador): usar figuras ligeras en las pruebas 3.1 para evitar el timeout intermitente (#27)`; el cuerpo explica que el costo escala con la longitud de trazo y que `figuraArb` por defecto no cambia para no alterar la prueba de la línea ~835
    - Si el paso cumple, OMITIR 3.2 y 3.3 y anotarlos como no necesarios en la descripción del PR
    - _Bug_Condition: isBugCondition(X) donde X.duracionAislada >= 0.9 * X.timeoutExplicito OR X.duracionBajoCarga > X.timeoutExplicito_
    - _Expected_Behavior: duracionAislada <= 0.5 * timeoutExplicito AND duracionBajoCarga <= timeoutExplicito AND aprobada_
    - _Preservation: la prueba de la línea ~835 conserva figuraArb, semilla 804, 100 iteraciones y timeout 120 s; aserciones y semillas de las 3.1 intactas_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2, 3.3_

  - [~] 3.2 Paso 2 (SOLO si 3.1 no basta): bajar `numRuns` (ciclo TDD completo)
    - Condición de uso: tras el paso 1 y su GREEN medido, la duración aislada supera el 50 % del timeout, o bajo carga supera el 100 %, o la cobertura impide reducir más las figuras
    - **RED (escribir y ver fallar ANTES de cambiar `numRuns`)**:
      - Extraer `numRuns` de las dos pruebas a una constante de prueba (`NUM_RUNS_31`) cuyo valor sigue siendo 100 y hacer que ambas la usen (sin cambio de comportamiento)
      - Escribir la prueba de presupuesto de ejecución: `NUM_RUNS_31 × longitud media de trazo de figurasDe31Arb` (semillas 2802 y 20 241) no supera el tope fijado en la tarea 1; falla con 100 iteraciones
      - Escribir (o conservar) la prueba de cobertura de motivos y de `coincide` true/false con `NUM_RUNS_31` iteraciones reales, que debe seguir exigiéndose tras bajar el valor
      - Ejecutar y VER el fallo del presupuesto; además registrar la medición real que justifica abrir el paso (aislada > 50 % o carga > 100 % tras el paso 1)
    - **Evidencia RED a anotar**: salida literal del fallo («`NUM_RUNS_31 × longitud` = X > tope Y») y las duraciones del paso 1 que demuestran que no bastó
    - **GREEN (lo mínimo para pasar)**:
      - Bajar `NUM_RUNS_31` en escalones 100 → 70 → 50 → 40, midiendo cada escalón con el protocolo común y quedándose con el mayor que cumpla; nunca por debajo de 40 (precedente de las pruebas ~510 y ~554)
      - Re-verificar en cada escalón la cobertura de motivos y de `coincide` true/false; conservar las semillas 2802 y 20 241
      - Ver el presupuesto y la cobertura en VERDE
    - **Evidencia GREEN a anotar**: tabla escalón × aislada × carga con el escalón elegido, salida en verde del presupuesto y de la cobertura
    - **REFACTOR (en verde, sin cambiar comportamiento)**: ajustar títulos y comentarios que digan «≥ 100 iteraciones» para que citen `NUM_RUNS_31`; volver a correr las pruebas afectadas y anotar que siguen en verde
    - **Commit** (español, por qué): `test(validador): reducir las iteraciones de las pruebas 3.1 a N porque la propiedad es determinista y la cobertura se mantiene (#27)`
    - Si ni con 40 se cumple, abrir 3.3
    - _Bug_Condition: isBugCondition(X) persiste tras el paso 1_
    - _Expected_Behavior: duracionAislada <= 0.5 * timeoutExplicito AND duracionBajoCarga <= timeoutExplicito AND aprobada_
    - _Preservation: semillas y aserciones de las 3.1 intactas; resto de pruebas sin cambios_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.2_

  - [~] 3.3 Paso 3 (ÚLTIMO RECURSO, SOLO si 3.1 y 3.2 no bastan): timeout de 120 s (ciclo TDD completo)
    - **RED (ver fallar ANTES de cambiar el timeout)**:
      - Con los pasos 1 y 2 aplicados, ejecutar `npm test -- --maxWorkers=2 --reporter=verbose` y VER fallar al menos una de las dos pruebas 3.1 por la razón correcta: «Test timed out in 60000ms» (no una aserción ni un error de importación); repetir hasta 3 corridas
      - Escribir la guarda comiteable de que el timeout es explícito por prueba y no global: `grep -rn "testTimeout" vitest.config.* vite.config.*` sin resultados, y las dos 3.1 declaran su timeout como argumento de `it`
    - **Evidencia RED a anotar**: salida literal del «Test timed out in 60000ms» con nombre de prueba, duración y carga de la máquina; resultado de la guarda
    - **GREEN (lo mínimo para pasar)**:
      - Cambiar `60_000` por `120_000` únicamente en las dos pruebas 3.1, como hizo el PR #24 en la línea ~881
      - Criterio de aceptación con 120 s: aislada ≤ 60 s y bajo carga ≤ 120 s, 3 de 3 en verde
      - Confirmar con `grep -rn "testTimeout" vitest.config.* vite.config.*` que no existe timeout global
    - **Evidencia GREEN a anotar**: tabla de tiempos (aislada ×3, carga ×3, máximos) frente al límite de 120 s y salida de la guarda
    - **REFACTOR (en verde, sin cambiar comportamiento)**: dejar un comentario con el *por qué* del timeout alto; volver a correr las dos 3.1 y anotar que siguen en verde
    - **Commit** (español, por qué): `test(validador): subir a 120 s el timeout de las pruebas 3.1 porque reducir figuras e iteraciones no dio margen suficiente (#27)`; documentar en la descripción del PR por qué los pasos 1 y 2 no bastaron
    - _Bug_Condition: isBugCondition(X) persiste tras los pasos 1 y 2_
    - _Expected_Behavior: aprobada con margen bajo el timeout de 120 s_
    - _Preservation: timeouts explícitos por prueba, sin timeout global_
    - _Requirements: 2.3, 2.4, 2.5, 3.5_

  - [~] 3.4 Verificar que la prueba de exploración de la condición del defecto ahora pasa
    - **Property 1: Expected Behavior** - Las pruebas 3.1 terminan con margen bajo su timeout
    - **IMPORTANT**: Repetir la MISMA medición de la tarea 1; no escribir una medición nueva
    - Comparar la tabla final con la línea base: aislada ≤ 50 % del timeout vigente, bajo carga ≤ 100 %, 3 de 3 corridas en verde
    - Evidencia extra (no criterio): una corrida con `--maxWorkers=2` mientras `npm run typecheck` ocupa un núcleo en otra terminal sigue en verde
    - **Evidencia GREEN a anotar**: tabla final paso × aislada × carga junto a la línea base de la tarea 1 (esa fila es la evidencia RED de origen), y qué pasos (1, 2, 3) se aplicaron
    - **EXPECTED OUTCOME**: la medición cumple la Property 1 (confirma que el defecto está arreglado)
    - Sin commit propio (solo verificación)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [~] 3.5 Verificar que las comprobaciones de preservación siguen pasando
    - **Property 2: Preservation** - Comportamiento fuera de las pruebas 3.1 y de sus aserciones
    - **IMPORTANT**: Repetir las MISMAS comprobaciones de la tarea 2; no escribir nuevas
    - La prueba de huella confirma que `crearFiguraArb()` y `figuraArb` generan la muestra sembrada con semilla 804 idéntica a la original
    - La prueba de la línea ~835 pasa con su timeout de 120 s y su duración no se movió más que por ruido
    - `git diff --stat` solo muestra `src/motor/validador.test.ts`; `git diff -- package.json package-lock.json` vacío; `src/motor/validador.ts` sin cambios
    - `grep -n "Math.random" src/motor/validador.test.ts` y `grep -rn "testTimeout" vitest.config.* vite.config.*` sin resultados; semillas 2802 y 20 241 presentes
    - Eliminar cualquier script o test temporal no comiteado antes de cerrar
    - **Evidencia GREEN a anotar**: salida de la prueba de huella, duración de la prueba ~835 antes y después, `git diff --stat` y resultados de los `grep`
    - **EXPECTED OUTCOME**: las comprobaciones PASAN (confirma que no hay regresiones)
    - Sin commit propio (solo verificación)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [~] 4. Checkpoint - Verificación final con la suite completa
  - Ejecutar en este orden, todo en verde: `npm ci`, `npm run typecheck`, `npm run build`
  - Ejecutar `npm test -- --maxWorkers=2` tres veces consecutivas, sin fallos de timeout en ninguna
  - Revisar el historial de la rama: un commit por ciclo completo, en español, explicando el por qué, sin atribución de IA; cada commit deja la suite en verde
  - Registrar en la descripción del PR: la tabla paso × aislada × carga, la evidencia RED y GREEN de cada ciclo, la cobertura de motivos y qué pasos (1, 2, 3) se aplicaron
  - Asegurar que todas las pruebas pasan; consultar al usuario si surge alguna duda
  - _Requirements: 2.3, 2.4, 3.4_
