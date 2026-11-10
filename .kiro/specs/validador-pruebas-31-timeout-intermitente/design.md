# Pruebas 3.1 del validador con timeout intermitente Bugfix Design

## Overview

Las dos pruebas de propiedades «3.1» de `src/motor/validador.test.ts` (líneas ~922 y ~1133) tardan entre 54,8 s y 57,4 s aisladas sobre un timeout de 60 s, y fallan bajo carga con `--maxWorkers=2`. El costo no está en el código de producción sino en el arbitrario `figuraArb`: cada una de las 100 iteraciones valida dos figuras de hasta 4 tramos con coordenadas en [-150, 150], rotación libre y una máscara de 800 × 800. Además, cada iteración llama a `validar` dos veces (línea base y repetición para comprobar determinismo).

El arreglo es solo de pruebas, sin tocar `src/motor/validador.ts`, y sigue la estrategia decidida en orden estricto, con una medición entre paso y paso:

1. Reducir el tamaño de las figuras que usan las pruebas 3.1.
2. Si no basta, bajar `numRuns` solo si la propiedad no necesita 100.
3. Último recurso: timeout de 120 s en esas dos pruebas. Nunca un timeout global.

Decisión de diseño clave: `figuraArb` lo comparte también la prueba de la línea ~835 (semilla 804, 100 iteraciones, timeout 120 s), que el requisito 3.3 manda preservar con su cobertura y su semilla. Cambiar `figuraArb` en sitio alteraría las figuras que genera esa prueba. Por eso el paso 1 se implementa como una fábrica parametrizada, `crearFiguraArb({ maxTramos, rango })`, cuyo valor por defecto reproduce exactamente el `figuraArb` actual (mismo orden de generadores, mismos límites), de modo que `figuraArb = crearFiguraArb()` genera los mismos valores con la misma semilla. Las dos pruebas 3.1 usan `crearFiguraArb` con parámetros reducidos.

## Glossary

- **Bug_Condition (C)**: una corrida de una prueba 3.1 cuya duración aislada es ≥ 90 % de su timeout, o cuya duración bajo carga supera el timeout.
- **Property (P)**: tras el arreglo, la duración aislada es ≤ 50 % del timeout, la duración bajo carga ≤ 100 % del timeout, y la prueba aprueba.
- **Preservation**: las aserciones, las semillas (2802 y 20 241), la prueba de la línea ~835, las demás pruebas, el código de producción y la ausencia de timeout global no cambian.
- **figuraArb**: arbitrario de `fast-check` que genera una polilínea conexa de 1 a 4 tramos con enteros en [-150, 150].
- **crearFiguraArb**: fábrica nueva que parametriza tramos máximos y rango; sin argumentos equivale a `figuraArb`.
- **Aislada**: `npx vitest --run src/motor/validador.test.ts -t "3.1"`.
- **Bajo carga**: `npm test -- --maxWorkers=2` (suite completa).

## Bug Details

### Bug Condition

La condición se da porque el costo por iteración de `validar` con `LIBRE` (traslación y rotación libres) es alto: `buscarMejorGiro` hace un barrido de 360 ángulos más un afinado exacto de los 8 mejores candidatos más el ángulo 0, sobre máscaras dilatadas de 800 × 800. Ese costo crece con el área trazada (`|Ad|`), que depende de la longitud total de los tramos. Con coordenadas en [-150, 150] y 4 tramos, la longitud media es grande, y 100 iteraciones × 2 llamadas a `validar` × 2 figuras dejan el total pegado al límite.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X de tipo CorridaDePrueba3_1
  OUTPUT: boolean

  RETURN X.duracionAislada >= 0.9 * X.timeoutExplicito
         OR X.duracionBajoCarga > X.timeoutExplicito
END FUNCTION
```

### Examples

- «3.1 · excesoPorcentaje, coincide y motivo…» aislada: ~54,8 s sobre 60 s (91 %). Esperado: ≤ 30 s.
- «3.1 · el veredicto oficial…» aislada: ~57,4 s sobre 60 s (96 %). Esperado: ≤ 30 s.
- Suite completa con `--maxWorkers=2` en el PR #24: 60,8 s, 65,6 s y 78,2 s, o sea timeout. Esperado: aprobar siempre.
- Caso límite: una figura de 1 tramo de longitud 0 (inicio igual al destino). Debe seguir siendo válida para `validar` (devuelve `sinEstelaDelJugador` o equivalente) y no se debe excluir por reducir el tamaño.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `src/motor/validador.ts` no cambia: mismos veredictos.
- Las aserciones de las dos pruebas 3.1 y sus semillas (2802, 20 241) no cambian.
- La prueba de la línea ~835 conserva `figuraArb` original, semilla 804, 100 iteraciones y timeout 120 s.
- Los timeouts siguen siendo explícitos por prueba, sin timeout global.
- Solo semillas explícitas de `fast-check`, sin `Math.random`, y sin tocar dependencias.

**Scope:**
Todo lo que no sea la definición de los arbitrarios y los parámetros (`numRuns`, timeout) de las dos pruebas 3.1 queda intacto. Esto incluye:
- Las demás pruebas del archivo y de la suite.
- El archivo `package.json`, `vitest.config` y el lockfile.
- Los comentarios descriptivos de los bloques, salvo ajustar el título de las dos pruebas si se cambia `numRuns` (ver paso 2).

## Hypothesized Root Cause

1. **Longitud de trazo excesiva**: el rango [-150, 150] con 4 tramos produce figuras largas; la dilatación y el índice de giro escalan con los píxeles trazados. Es la causa principal y la que ataca el paso 1.
2. **Doble llamada a `validar` por iteración**: duplica el costo, pero es la esencia del chequeo de determinismo, así que no se toca.
3. **Rotación libre**: dispara `buscarMejorGiro` en cada iteración. Es parte de lo que las pruebas cubren (`LIBRE`), así que no se cambia.
4. **Contención de CPU**: con `--maxWorkers=2` el tiempo se infla de 1,1× a 1,4×. Es un amplificador, no la causa: se resuelve dejando margen aislado.

Hipótesis a confirmar con la medición del paso 0: el tiempo escala aproximadamente con la longitud total de trazo. Si la medición la refuta (por ejemplo, el costo dominante fuera constante por llamada), el paso 1 no basta y se pasa al paso 2 sin insistir en reducir figuras.

## Correctness Properties

Property 1: Bug Condition - Las pruebas 3.1 terminan con margen bajo su timeout

_For any_ corrida de una prueba 3.1 donde la condición del defecto se cumple en el código actual (isBugCondition devuelve true), la prueba corregida SHALL terminar aislada en ≤ 50 % de su timeout, terminar bajo carga (`--maxWorkers=2`) en ≤ 100 % de su timeout y aprobar, de forma estable entre corridas repetidas.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Comportamiento fuera de las pruebas 3.1 y de sus aserciones

_For any_ corrida donde la condición del defecto NO se cumple (las demás pruebas del archivo y de la suite), el código corregido SHALL producir el mismo resultado que el original, preservando los veredictos de producción, las aserciones y semillas de las pruebas 3.1, la prueba de la línea ~835 con su `figuraArb`, `numRuns` y timeout, los timeouts explícitos por prueba y la ausencia de dependencias o azar no sembrado.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

**File**: `src/motor/validador.test.ts` (único archivo modificado)

**Cambios, aplicados en orden y deteniéndose en el primero que cumpla la Property 1:**

1. **Paso 1 · Figuras más pequeñas (fábrica `crearFiguraArb`)**
   - Reemplazar la definición de `figuraArb` por `crearFiguraArb({ maxTramos = 4, rango = 150 } = {})` y `const figuraArb = crearFiguraArb()`. El caso por defecto conserva el orden de generadores y los límites, así que la prueba de la línea ~835 genera lo mismo con la semilla 804. Se comprueba con un test de equivalencia (ver Testing Strategy).
   - Crear `const figuraLigeraArb = crearFiguraArb({ maxTramos: 2, rango: 80 })` como punto de partida y usarla en las dos pruebas 3.1. Los valores 2 y 80 son la primera hipótesis; se ajustan con la medición (candidatos: tramos 2–3, rango 60–100) hasta cumplir el objetivo de tiempo con el menor recorte posible.
   - Mantener `minLength: 1`, enteros, polilínea conexa (cada tramo parte del destino del anterior) para que toda figura siga siendo válida para el validador (2.6).
   - Condición de cobertura (2.6): con `figuraLigeraArb` y las semillas fijas, las 100 iteraciones deben producir al menos una vez cada uno de los cuatro motivos y tanto `coincide = true` como `false`. Ver la verificación de cobertura abajo. Si algún motivo desaparece, se amplía el rango o los tramos antes de pasar al paso 2.
   - Actualizar el texto del título de las dos pruebas («con figuraArb × figuraArb») a «con figuras ligeras». Los títulos se citan en `-t "3.1"`, que sigue coincidiendo.

2. **Paso 2 · Bajar `numRuns` (solo si el paso 1 no basta)**
   - Condición de uso: el paso 1 aislado supera 50 % del timeout, o bajo carga supera 100 %, o la cobertura exige figuras que ya no se pueden reducir.
   - Criterio de "no necesita 100": las propiedades son deterministas (comparan `validar` consigo misma) y la semilla es fija; la cobertura de motivos se obtiene con pocas iteraciones. Se baja al menor `numRuns` ≥ 40 que siga cumpliendo la cobertura de motivos del paso 1 (las pruebas de las líneas ~510 y ~554 ya usan 40 como precedente del archivo). No se baja por debajo de lo que la cobertura mida.
   - Se ajustan los títulos que dicen «≥ 100 iteraciones» y el comentario correspondiente. El requisito 2.5 y el título de la issue permiten esto solo en este paso.

3. **Paso 3 · Timeout de 120 s (último recurso)**
   - Condición de uso: tras los pasos 1 y 2 aún falla la Property 1 bajo carga.
   - Cambiar `60_000` por `120_000` solo en las dos pruebas 3.1, igual que hizo el PR #24 en la línea ~881. Sin `testTimeout` global en `vitest.config`.
   - Si se llega aquí se documenta en el PR por qué los pasos 1 y 2 no bastaron.

## Testing Strategy

### Validation Approach

Dos fases: medir el estado actual (counterexamples) y verificar el arreglo con la misma metodología. Cada paso se mide antes de pasar al siguiente, y el paso solo se acepta si cumple la Property 1.

**Protocolo de medición común** (se registra en la descripción del PR en una tabla paso × aislada × carga):

- Aislada: `npx vitest --run src/motor/validador.test.ts -t "3.1" --reporter=verbose`. Se anota la duración de cada una de las dos pruebas (el reporter verbose la imprime por prueba). Tres corridas consecutivas; se toma el máximo.
- Bajo carga: `npm test -- --maxWorkers=2` con la suite completa. Tres corridas consecutivas; se toma el máximo de las dos pruebas 3.1 en la salida verbose (`npm test -- --maxWorkers=2 --reporter=verbose`).
- Criterios de aceptación por paso: aislada ≤ 30 s (50 % de 60 s), bajo carga ≤ 60 s en las 3 corridas, y 3 de 3 corridas en verde. Si se llega al paso 3 con 120 s: aislada ≤ 60 s y bajo carga ≤ 120 s.
- Entorno: misma máquina para todas las mediciones; anotar CPU/núcleos y Node (`node -v`, debe ser 24). Cerrar procesos pesados y no ejecutar en paralelo otras corridas.
- Para estresar el margen bajo carga, repetir una corrida adicional de la suite con `--maxWorkers=2` mientras otra tarea ocupa un núcleo (por ejemplo `npm run typecheck` en otra terminal); debe seguir en verde. Es evidencia extra, no criterio.

### Exploratory Bug Condition Checking

**Goal**: Confirmar la causa (costo proporcional al trazo) y fijar la línea base antes de cambiar nada.

**Test Plan**: Sobre el código SIN arreglar, medir los tiempos con el protocolo común (paso 0) y, con un script temporal fuera del repo o un `it.skip` local no comiteado, medir la longitud total de trazo promedio de `figuraArb` frente al tiempo por iteración. Además medir el tiempo de la prueba con `crearFiguraArb` de distintos parámetros para dibujar la curva tiempo × (maxTramos, rango).

**Test Cases**:
1. **Aislada, prueba 1** (`excesoPorcentaje, coincide y motivo`): se espera ~55 s (confirma 1.1).
2. **Aislada, prueba 2** (`veredicto oficial`): se espera ~57 s (confirma 1.2).
3. **Bajo carga**: al menos una de las 3 corridas se espera por encima de 60 s o cerca (confirma 1.3 y 1.4).
4. **Curva de costo**: tiempo por iteración con (4, 150), (3, 100), (2, 80), (2, 60).

**Expected Counterexamples**:
- Tiempo aislado ≥ 54 s en ambas pruebas.
- Posible causa alternativa a descartar: costo dominado por una iteración atípica (figuras muy largas). Si pasa, el recorte de rango pesa más que el de tramos.

### Fix Checking

**Goal**: Verificar que para toda corrida donde se cumplía la condición, la prueba corregida cumple la Property 1.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := correrPrueba3_1_corregida(X)
  ASSERT result.duracionAislada <= 0.5 * result.timeoutExplicito
         AND result.duracionBajoCarga <= result.timeoutExplicito
         AND result.aprobada
END FOR
```

**Procedimiento por paso** (se avanza al siguiente solo si el actual falla algún criterio):

- **Paso 1**: aplicar `crearFiguraArb` + `figuraLigeraArb`; medir aislada (3 corridas) y bajo carga (3 corridas); verificar cobertura de motivos (abajo). Aceptar si cumple los criterios. Si no, ajustar parámetros dentro del paso 1 (menos tramos o menor rango) hasta un mínimo razonable: no menos de 2 tramos y rango no menor a 60, para no perder geometría relevante (cruces entre tramos, orientaciones varias). Si con ese mínimo no cumple, pasar al paso 2.
- **Paso 2**: con las figuras del paso 1, bajar `numRuns` en escalones (100 → 70 → 50 → 40); medir cada escalón y quedarse con el mayor que cumpla. Re-verificar cobertura de motivos en cada escalón. Si ni con 40 se cumple, pasar al paso 3.
- **Paso 3**: poner 120 s en las dos pruebas; medir con el criterio de 120 s; confirmar con `grep -n "testTimeout" vitest.config.* vite.config.*` que no hay timeout global.

**Verificación de cobertura (requisito 2.6)**: mientras se mide, un test de apoyo temporal (no comiteado) o un script con `fc.sample(figuraLigeraArb, ...)` con las semillas 2802 y 20 241 cuenta, sobre las iteraciones reales, la frecuencia de cada `motivo` y de `coincide` true/false. Se exige al menos 1 caso de cada motivo (`coincide`, `excesoDeTrazo`, `iouInsuficiente`, `sinEstelaDelJugador`) y ambos valores de `coincide`. Si `sinEstelaDelJugador` o `coincide = true` solo aparecieran por azar en `figuraArb` original, esta verificación lo detecta: en ese caso se añaden dos ejemplos fijos con `examples` de `fast-check` (figura vacía/degenerada, y objetivo igual al jugador) en lugar de ensanchar las figuras. Los resultados de cobertura se anotan en el PR.

### Preservation Checking

**Goal**: Verificar que lo que no es el defecto no cambió.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT originalSuite(X) = correctedSuite(X)
END FOR
```

**Testing Approach**: Se apoya en la suite existente más cuatro comprobaciones puntuales, todas baratas.

**Test Cases**:
1. **Equivalencia de `figuraArb`**: con un test o script temporal, `fc.sample(figuraArb, { seed: 804, numRuns: 100 })` antes y después del cambio debe ser igual (deep equal). Garantiza 3.3: la prueba de la línea ~835 genera lo mismo con la semilla 804.
2. **Prueba de la línea ~835**: pasa con su timeout de 120 s y su duración aislada no se mueve más de lo esperado por ruido (medir antes y después).
3. **Diff de producción vacío**: `git diff --stat` solo muestra `src/motor/validador.test.ts` (3.1, 3.6); `git diff -- package.json package-lock.json` vacío.
4. **Reglas duras**: `grep -n "Math.random" src/motor/validador.test.ts` sin resultados; `grep -rn "testTimeout" vitest.config.* vite.config.*` sin resultados (3.5); las semillas 2802 y 20 241 siguen presentes (3.2).
5. **Suite completa**: `npm ci`, `npm run typecheck`, `npm run build` y `npm test -- --maxWorkers=2` en verde, tres veces consecutivas (2.4 y 3.4).

### Unit Tests

- Cada una de las dos pruebas 3.1 aprueba con `figuraLigeraArb` y mantiene sus aserciones.
- Equivalencia de `crearFiguraArb()` con el `figuraArb` original (muestra sembrada).
- Toda figura de `figuraLigeraArb` es una polilínea conexa de 1 a `maxTramos` tramos, con coordenadas dentro de ±`rango`.

### Property-Based Tests

- Las dos pruebas 3.1 siguen siendo propiedades de `fast-check` con semillas explícitas (2802 y 20 241); se conserva la semilla incluso si baja `numRuns`.
- La prueba de la línea ~835 sigue siendo la propiedad con 100 iteraciones sobre el `figuraArb` original.

### Integration Tests

- Suite completa con `npm test -- --maxWorkers=2`, tres corridas consecutivas, sin fallos de timeout.
- Corrida con carga extra (otra tarea en paralelo) para comprobar el margen.
- `npm run typecheck` y `npm run build` en verde, como exige el steering antes de aprobar el PR.
