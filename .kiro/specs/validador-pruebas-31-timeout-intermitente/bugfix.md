# Documento de requisitos del arreglo

## Introduction

Las dos pruebas de propiedades «3.1» de `src/motor/validador.test.ts` (alrededor de las líneas 922 y 1133, incorporadas por el PR #26) tienen un timeout explícito de 60 s y, ejecutadas aisladas, tardan casi todo ese tiempo: 54,8 s la de `excesoPorcentaje, coincide y motivo` y 57,4 s la del veredicto oficial. Con la suite completa en paralelo (`npm test -- --maxWorkers=2`) compiten por CPU y superan el límite. En el PR #24 fallaron en tres corridas (60,8 s, 65,6 s y 78,2 s) y pasaron en las dos últimas: el resultado depende de la máquina y de la carga, no del código.

El steering exige la suite completa en verde antes de aprobar un PR, así que una prueba intermitente desgasta la confianza en esa regla. El costo viene de `figuraArb`: cada iteración valida dos figuras de hasta 4 tramos con coordenadas en [-150, 150] y rotación libre, y la búsqueda de giro opera sobre una máscara de 800 × 800.

Reproducción: `npx vitest --run src/motor/validador.test.ts -t "3.1"`.

Referencia: issue https://github.com/derocox-cloud/KiroLogo/issues/27, rama `fix/27-timeout-pruebas-validador`.

Estrategia decidida por el usuario, en este orden de preferencia:

1. Reducir el tamaño de las figuras que genera `figuraArb` sin perder cobertura de los casos que las propiedades quieren cubrir.
2. Si no basta, bajar `numRuns` solo si la propiedad no necesita 100 iteraciones.
3. Último recurso: subir el timeout de esas dos pruebas a 120 s, como hizo el PR #24 con la prueba de la línea 881.

Restricción: no se vuelve a un timeout global, porque ocultaría pruebas lentas nuevas.

Condición del defecto, sobre una corrida de las pruebas «3.1»:

```pascal
FUNCTION isBugCondition(X)
  INPUT: X de tipo CorridaDePrueba3_1
  OUTPUT: boolean

  RETURN X.duracionAislada >= 0.9 * X.timeoutExplicito
         OR X.duracionBajoCarga > X.timeoutExplicito
END FUNCTION
```

Propiedad (verificación del arreglo):

```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← correrPrueba3_1'(X)
  ASSERT result.duracionAislada <= 0.5 * result.timeoutExplicito
         AND result.duracionBajoCarga <= result.timeoutExplicito
         AND result.aprobada
END FOR
```

Preservación:

```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN la prueba «3.1 · excesoPorcentaje, coincide y motivo de validar son estables…» se ejecuta aislada THEN el sistema tarda unos 54,8 s sobre un timeout de 60 s, casi sin margen

1.2 WHEN la prueba «3.1 · el veredicto oficial … es estable con figuraArb × figuraArb» se ejecuta aislada THEN el sistema tarda unos 57,4 s sobre un timeout de 60 s, casi sin margen

1.3 WHEN la suite completa corre en paralelo con `npm test -- --maxWorkers=2` y las dos pruebas «3.1» compiten por CPU THEN el sistema supera el timeout de 60 s y la prueba falla (se observaron 60,8 s, 65,6 s y 78,2 s en el PR #24)

1.4 WHEN se repite la misma suite sin cambios de código THEN el sistema da resultados distintos según la máquina y la carga (falla en unas corridas y pasa en otras), de modo que no se puede confiar en la suite en verde exigida antes de aprobar un PR

### Expected Behavior (Correct)

2.1 WHEN la prueba «3.1 · excesoPorcentaje, coincide y motivo…» se ejecuta aislada THEN el sistema SHALL terminar con un margen amplio bajo su timeout (como máximo la mitad del límite)

2.2 WHEN la prueba «3.1 · el veredicto oficial …» se ejecuta aislada THEN el sistema SHALL terminar con un margen amplio bajo su timeout (como máximo la mitad del límite)

2.3 WHEN la suite completa corre en paralelo con `npm test -- --maxWorkers=2` THEN el sistema SHALL aprobar las dos pruebas «3.1» sin superar su timeout

2.4 WHEN se repite la suite completa sin cambios de código THEN el sistema SHALL dar el mismo resultado en verde de forma estable, sin depender de la máquina ni de la carga

2.5 WHEN se corrige el costo de las pruebas THEN el sistema SHALL aplicar la estrategia en este orden: primero reducir el tamaño de las figuras de `figuraArb` sin perder cobertura de los casos que las propiedades cubren; luego bajar `numRuns` solo si la propiedad no necesita 100 iteraciones; y como último recurso subir el timeout de esas dos pruebas a 120 s

2.6 WHEN se reduce el tamaño de las figuras THEN el sistema SHALL seguir cubriendo los casos que las propiedades 3.1 quieren ejercitar (los cuatro motivos posibles, coincidencia y no coincidencia, y la estabilidad determinista del veredicto), y toda figura generada seguirá siendo válida para el validador

### Unchanged Behavior (Regression Prevention)

3.1 WHEN se ejecuta la lógica de producción de `src/motor/validador.ts` THEN el sistema SHALL CONTINUE TO producir los mismos veredictos, sin ningún cambio de código de producción

3.2 WHEN se ejecutan las aserciones de las dos pruebas «3.1» THEN el sistema SHALL CONTINUE TO verificar la estabilidad determinista de `excesoPorcentaje`, `coincide`, `motivo` e `iou` del veredicto oficial, con las mismas semillas (2802 y 20 241)

3.3 WHEN se ejecutan las pruebas que usan `figuraArb` fuera de las dos «3.1» (por ejemplo la de la línea 881, con timeout de 120 s y 100 iteraciones) THEN el sistema SHALL CONTINUE TO pasar con su cobertura, su semilla y su timeout actuales

3.4 WHEN se ejecutan las demás pruebas de `src/motor/validador.test.ts` y el resto de la suite THEN el sistema SHALL CONTINUE TO pasar sin modificaciones

3.5 WHEN se configura el timeout de las pruebas THEN el sistema SHALL CONTINUE TO usar timeouts explícitos por prueba, sin introducir un timeout global que oculte pruebas lentas nuevas

3.6 WHEN las pruebas necesitan azar THEN el sistema SHALL CONTINUE TO usar solo semillas explícitas de `fast-check`, sin `Math.random`, y sin agregar ni modificar dependencias
