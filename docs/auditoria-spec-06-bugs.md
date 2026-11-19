# Auditoría adversarial · Spec 06 · Mundo 5 (rama `spec-06-mundo-5`)

Método: pruebas de sondeo en un archivo temporal (`src/auditoria-sonda.test.ts`, ya borrado) con
programas KiroLogo hostiles, dos fuzzers (40 000 programas de fragmentos al azar y 30 000 programas
generados por gramática, la mitad mutados), 2 000 semillas por cada generador del mundo 5 y la
regresión `npx vitest --run src/lenguaje src/niveles --maxWorkers=2`.

Resultado de la regresión: **90 archivos, 1 757 pruebas, todo en verde**. Ninguna entrada produjo
un cuelgue ni una excepción en el intérprete. Sí hay una excepción sin capturar en el parser
(hallazgo 1). No modifiqué ningún archivo de `src/`.

Nota: `docs/auditoria-spec-06-revision.md` aparece sin seguimiento en `git status`. No lo creé yo.

## Hallazgos

### 1. Media · `RangeError: Maximum call stack size exceeded` en el parser con listas muy anidadas

- **Dónde:** `src/lenguaje/parser.ts`, `analizarListaInstrucciones` (≈L1240) y `analizarCuerpoDefinicion`
  (≈L1571). `estado.anidamiento` se incrementa pero nunca se compara con un tope. Quien llama,
  `analizarTextoJugador` en `src/main.ts` (≈L1380-1390), no tiene `try/catch`.
- **Reproducción** (JS en una prueba de Vitest):
  ```ts
  analizar(analizarLexico('PARA P ' + 'SI 1 = 1 ['.repeat(3000) + 'AV 1' + ']'.repeat(3000) + ' FIN P').tokens, { mundo: 5 });
  analizar(analizarLexico('REPITE 1 ['.repeat(3000) + 'AV 1' + ']'.repeat(3000)).tokens, { mundo: 5 });
  analizar(analizarLexico('SI 1 = 1 ['.repeat(3000)).tokens, { mundo: 5 });   // corchetes sin cerrar
  ```
- **Observado:** con 2 000 niveles funciona y con 3 000 lanza `RangeError`. El umbral exacto depende de
  la pila del motor de JS (Node en Vitest). El navegador probablemente falle antes, porque cada nivel
  consume varios marcos. En `main.ts` la excepción sale del manejador de «Ejecutar» y el jugador no ve
  ningún mensaje. No comprobé si la interfaz queda utilizable después.
- **Esperado:** un error en español, como `expresionDemasiadoProfunda` hace con las expresiones (tope
  128 en `MAXIMA_ALTURA_EXPRESION`).
- **Corrección sugerida:** en `parser.ts`, comprobar `estado.anidamiento > MAXIMO_ANIDAMIENTO_LISTAS` (por
  ejemplo 64) al entrar en `analizarListaInstrucciones` y `analizarCuerpoDefinicion`. Reportar un error
  nuevo en `errores.ts` y no descender. Como segunda red, un `try/catch` en `analizarTextoJugador` que
  devuelva un error de catálogo. REPITE ya tenía el problema antes del mundo 5, pero SI y SINO lo
  amplían.

### 2. Media · `usaRecursion` da por buena una recursión que nunca se invoca

- **Dónde:** `src/juego/abstraccion.ts`, `hayRecursion` (≈L216). A diferencia de
  `hayParametroDeclaradoYUsado`, que exige `invocadoFuera(...)`, `hayRecursion` solo mira el cuerpo.
- **Reproducción** (mundo 5):
  ```
  PARA P :n
    SI :n > 0 [P :n - 1]
  FIN
  ```
  más cualquier dibujo por fuerza bruta. `analizar(programa, [{ clave: 'usaRecursion' }])` devuelve
  `confirmadas: ['usaRecursion']`.
- **Observado:** la estrella de abstracción se concede con un procedimiento recursivo que nunca se
  ejecuta. Lo frena solo la estrella de economía, porque ese `PARA` cuenta 2 instrucciones, pero la
  abstracción no debería depender de eso.
- **Esperado:** exigir que el procedimiento recursivo se invoque desde fuera de su propio cuerpo, igual
  que `usaParametros` (D19).
- **Corrección sugerida:** en `hayRecursion`, combinar `invocaNombre(nodo.cuerpo, nodo.nombre)` con
  `invocadoFuera(raiz, nodo)`. Hay que pasar la raíz, como hace `hayParametroDeclaradoYUsado`.
- **Relacionado (informativo, coincide con R4.2 tal como está escrito):** la recursión mutua
  (`A` llama a `B` y `B` llama a `A`) **no** cuenta como recursión.
  `PARA A :n SI :n > 0 [B :n - 1] FIN  PARA B :n SI :n > 0 [A :n - 1] FIN  A 3` da
  `sinConfirmar: ['usaRecursion']`. Conviene decidirlo y documentarlo. Un jugador que resuelve 5.x con
  recursión mutua perdería la estrella sin explicación.

### 3. Baja · Condición rota en la misma línea que `FIN` produce un `paraSinFin` falso

- **Dónde:** `src/lenguaje/parser.ts`, `descartarListas` (≈L920). Salta el resto de la línea hasta un
  `[`, y se lleva el `FIN` por delante.
- **Reproducción:** `PARA P :n SI :n FIN` (mundo 5).
- **Observado:** `paraSinFin@1` y `condicionMalFormada`. Con `PARA P :n SI :n [AV 1] FIN` solo sale
  `condicionMalFormada`.
- **Esperado:** solo `condicionMalFormada` (R1.5, sin cascada).
- **Corrección sugerida:** en el bucle de `descartarListas`, detenerse también ante el token `FIN`
  (y ante `PARA`).

### 4. Baja · `SI cond [..] [..]` (con dos listas) da dos errores y ninguno menciona `SINO`

- **Reproducción:** `PARA P :n\n SI :n > 1 [AV 1] [AV 2]\nFIN`.
- **Observado:** `corcheteInesperado` («un corchete sin un comando que lo reciba») y
  `corcheteDeMasEnLinea`. Es el error típico de quien viene de un `if/else`.
- **Esperado:** un solo error que sugiera `SINO`.
- **Corrección sugerida:** en `analizarCondicional`, tras la lista de un `SI`, si el siguiente token es
  `[` en la misma línea, reportar un error propio («SI lleva una sola lista; para dos usa SINO») y
  descartar la lista sobrante.

### 5. Baja · Comparador fuera de `SI`/`SINO`: mensajes inconsistentes

| Programa | Observado | Esperado |
|---|---|---|
| `REPITE 1 = 1 [AV 10]` | `argumentoFaltante` («REPITE necesita un número») y `corcheteDeMasEnLinea` | `condicionMalFormada`, sin cascada |
| `AV (1 < 2) * 10` | `parentesisSinCerrar` | `condicionMalFormada` |
| `SI (1 < 2) = (2 > 1) [AV 10]` | `parentesisSinCerrar` | `condicionMalFormada` («compara solo dos valores») |

`AV 1 < 2` y `ESCRIBE 1 < 2` sí dan `condicionMalFormada`. La corrección va en el manejo de
`REPITE` y en la lectura de paréntesis de `parser.ts`: reconocer un comparador dentro de paréntesis y
tras `REPITE`.

### 6. Baja (anterior al spec 06) · Número mayor de 999 999 muestra un mensaje de ejemplo fijo

- **Dónde:** `src/lenguaje/errores.ts` L619-620 (el mensaje de `numeroMalFormado` está escrito a mano) y
  `src/lenguaje/lexer.ts` L342 (`crearError('numeroMalFormado', {}, …)`).
- **Reproducción:** `REPITE 99999999 [AV 1]` o `AV 1000000`.
- **Observado:** «No entiendo el número 10.5.3 de la línea 2. Lleva un solo separador decimal…». El
  número, la línea y la causa (fuera de rango) son inventados.
- **Esperado:** nombrar el número escrito, la línea real y el máximo permitido (999 999).
- **Corrección sugerida:** que `numeroMalFormado` reciba `{ escrito, linea }` y que el lexer distinga
  «fuera de rango» de «separador repetido».
- Importa aquí porque `REPITE 99999999` es la entrada hostil más obvia del mundo 5.

### 7. Baja · La igualdad usa tolerancia absoluta de 1e-9 y falla con magnitudes grandes

- **Dónde:** `src/lenguaje/evaluador.ts`, `comparar` (≈L41).
- **Reproducción:** `SI (0.1 + 0.2) * 10000 * 10000 = 0.3 * 10000 * 10000 [AV 1]`.
- **Observado:** no dibuja nada, es decir, la condición es falsa. `SI 0.1 + 0.2 = 0.3 [AV 1]` sí
  dibuja. Con valores del orden de 3·10⁷ la diferencia de coma flotante (3.7·10⁻⁹) supera la
  tolerancia.
- **Esperado:** el mismo resultado que a escala pequeña.
- **Corrección sugerida:** tolerancia relativa,
  `Math.abs(a - b) < TOLERANCIA * Math.max(1, Math.abs(a), Math.abs(b))`. Afecta a `=`, `<` y `>`,
  porque los tres usan `iguales`.

### 8. Baja · `ejecutar` desactiva la guarda de 5 s si el llamador no pasa `ahora`

- **Dónde:** `src/lenguaje/interprete.ts` ≈L252 (`opciones.ahora ?? (() => 0)`). Sin `ahora` pasan por
  esa vía `src/motor/divergencia.ts` L286 (`operacionesDe`), `src/juego/reto.ts` L124 y los generadores
  de los mundos 1 y 2. `main.ts` sí pasa `ahora`.
- **Reproducción:** ejecutar sin `ahora` un programa de unos 900 caracteres:
  `REPITE 99999 [REPITE 99999 [SI (1+1+…+1 /*100 términos*/) + (…) + (…) = 0 []]]`.
- **Observado:** 11 451 ms y corta por `pasos` (2 000 000 ciclos). Con `ahora: Date.now`, 5 001 ms y
  corta por `tiempo`.
- **Impacto real:** latente. `ejecutarEnParalelo` (la que usa `operacionesDe`) no tiene ningún
  llamador fuera de las pruebas. Es una trampa para el siguiente que la conecte.
- **Corrección sugerida:** que `operacionesDe` pase `ahora: () => Date.now()`. Valorar usar `Date.now`
  como valor por omisión, o exigir `ahora` en las opciones.

### 9. Baja · Mensajes de guarda que no describen lo ocurrido

- **Recursión mutua.** `PARA A AV 1 B FIN  PARA B AV 1 A FIN  A` dice «A se llama a sí mismo sin parar».
  Sería más exacto nombrar el ciclo («A y B se llaman entre sí»).
- **Ciclos sin tortuga.** El tope de 2 000 000 ciclos se informa como `guardaPasos`, «la tortuga llevaba
  demasiados pasos», aunque no haya movido nada. Ocurre con `REPITE 99999 [REPITE 99999 [SI 1 = 1 []]]`
  (0 operaciones) y con recursión de valor exponencial.
  `PARA F :n SI :n < 1 [DEVUELVE 1] DEVUELVE (F (:n - 1)) + (F (:n - 1)) FIN  AV F 60` también corta con
  ese mensaje, tras 267 ms.
- **Corrección sugerida:** un mensaje de catálogo propio para el tope de ciclos (por ejemplo
  `guardaCiclos`), con `TipoGuarda` nuevo o reutilizando `pasos` solo en el tipo.

### 10. Baja · Mensaje de expresión demasiado profunda habla de paréntesis cuando no los hay

- **Reproducción:** `AV 1+1+…+1` con 130 términos, o `AV F F F … 1` con 300 llamadas anidadas.
- **Observado:** «Tienes demasiados paréntesis anidados (más de 32)». El tope real es de altura 128
  (`MAXIMA_ALTURA_EXPRESION`, `parser.ts` L599) y aquí no hay paréntesis.
- **Corrección sugerida:** mensaje distinto para el tope de altura, o redactar el actual para cubrir
  ambos casos.

### 11. Baja (anterior al spec 06) · Nombres de palabras aún bloqueadas

- `PARA ALTO AV 1 FIN ALTO` en los mundos 2 a 4 da `paraNombreQueEsLenguaje` **y** `comandoBloqueado`
  (dos errores). `PARA SI …` en el mundo 3 y `PARA DV …` en el 4 son rechazados con «es una palabra de
  KiroLogo», sin que el jugador la haya desbloqueado.
- Sigue el mismo criterio que `PARA ESCRIBE` en el mundo 2, así que es coherente, pero `ALTO` es una
  palabra de uso natural (altura). Conviene valorar si se permite hasta el mundo 5.
- Con una palabra desconocida en posición de número, `AV G 1` da «AVANZA necesita un número, pero le
  diste una palabra: G». Habría que decir «No sé cómo hacer G», como indica `producto.md`.

## Qué se probó y resultó correcto

### Cuelgues y DoS (guardas)
Todas cortaron con mensaje en español, sin excepción y sin desbordar la pila de JS.

- Recursión directa sin base (`PARA P :n AV 1 P :n + 1 FIN`): corta en profundidad 100, tras 100
  operaciones.
- Recursión mutua `A`↔`B`, con y sin `AV`: `guardaRecursion`, 1-3 ms.
- Recursión de valor sin base: `PARA F :n DEVUELVE F :n + 1 FIN AV F 1` corta con `guardaRecursion` en
  1 ms. Una mutua de valor (`A`→`B`→`A`) también.
- Profundidad exacta: un procedimiento a 100 niveles funciona y a 101 corta. Un operador a 100 niveles
  funciona y a 101 corta. Un procedimiento a profundidad 99 que llama a un operador (nivel 100) funciona.
- `REPITE 99999 [REPITE 99999 [...]]` dentro de un operador y dentro de un `REPITE` externo: corta por
  ciclos en 40-80 ms.
- `REPITE 99999 [AV F 1 GD 1]` (llamada con valor en cada vuelta): 199 998 operaciones en 271 ms, y con
  `REPITE` anidado corta en `pasos` a las 200 000.
- `SI` y `SINO` con listas vacías dentro de `REPITE 99999` anidados: corta en 57-71 ms.
- Recursión de valor exponencial (2⁶⁰ llamadas): corta por ciclos en 267 ms.
- Con `ahora` real, el programa de la guarda de tiempo corta en 5 001 ms con `tiempo`.
- Un `REPITE` con veces negativo dentro de un operador da `vecesInvalidas`.

### Operadores (`llamarComoOperador`)
- La guarda de profundidad cuenta `nivelProcedimientos + nivelOperadores`. `nivelOperadores` se
  decrementa en un `finally`, así que queda consistente tras cualquier error.
- Operador con efectos (`AV` en su cuerpo): `operadorConEfectos`. Si la rama con efectos no se
  ejecuta, no da error. Operador sin camino que devuelva: `procedimientoSinResultado`. `ALTO` dentro de
  un operador: `procedimientoSinResultado`.
- Los argumentos se evalúan de izquierda a derecha (`G 10 3` da 7). `FACT 5` da 120.
- `lineaLlamada` y la profundidad de las operaciones salen correctas.

### ALTO y DEVUELVE
- `ALTO` dentro de `SI` dentro de `REPITE`, con el procedimiento llamado desde un `REPITE` del programa
  principal: se desapilan los marcos correctos. Las profundidades quedaron `1, 0, 1, 0, 0` y el
  `REPITE` externo siguió.
- `ALTO` después de una llamada recursiva (`Q 3` con profundidad 4) retoma bien en cada nivel.
- `DEVUELVE` dentro de `REPITE` y `SI` anidados devuelve el valor esperado.
- `ALTO` y `DEVUELVE` fuera de `PARA`: `altoFueraDeProcedimiento` y `devuelveFueraDeProcedimiento`.
  Llamar un `PARA` con `DEVUELVE` como instrucción: `devuelveSinUso`, también si la definición va
  después. Usar como número uno sin `DEVUELVE`: `procedimientoSinValor`.

### Parser
- Mundo 4 y anteriores: ningún comparador, `SI`, `SINO`, `ALTO`, `DEVUELVE` ni llamada con valor llega
  al AST. Se comprobó con 20 000 programas (con y sin mutaciones) en los mundos 2, 3 y 4: **0 fugas**.
  Los comparadores dan un solo `comparadorBloqueado` por programa.
- Condiciones raras (`SI = 1 [..]`, `SI :n = [..]`, `SI :n [..]`, `SI :n = 1 = 2 [..]`, `SINO` con una
  lista o sin lista, comparador a mitad de línea): cada una da un error sin cascada en las pruebas
  con una lista, y las listas rotas se descartan correctamente.
- Nombres que colisionan (`SI`, `SINO`, `ALTO`, `DV`, `AVANZA`): `paraNombreQueEsLenguaje`.
  Redefinición: `procedimientoRedefinido`. `PARA` anidado: `paraAnidado`. Argumentos de menos:
  `procedimientoArgumentosFaltantes`.
- Fuzz: 70 000 programas, **0 excepciones, 0 bucles**, ninguno tardó más de 150 ms en analizarse ni
  500 ms en ejecutarse, y nunca hubo más de 20 errores.
- Paréntesis: 31 funciona y 33 da `expresionDemasiadoProfunda` sin desbordar. `-` repetido 20 000
  veces, 100 000 sumas y 5 000 llamadas anidadas dan el mismo error en 1-25 ms.

### Comparaciones
- `NaN` e `Infinity` no llegan al lenguaje: las operaciones no finitas dan `numeroFueraDeRango` y
  `/0` da `divisionPorCero`. `comparar` por sí sola con `NaN` devuelve `false` en los tres casos y es
  coherente.
- Tolerancia: `0 = 1e-9` es falso, `0 = 0.999e-9` es verdadero, `0 < 1e-9` es falso. `-0 = 0` es
  verdadero. Exactamente uno de `=`, `<`, `>` es cierto en los casos probados.
- `999999 * 999999 / 7 * 7 = 999999 * 999999` es verdadero (el hallazgo 7 es otro caso).

### Impresor, conteo y abstracción
- Ida y vuelta imprimir → parsear → imprimir con 16 programas escritos a mano (SI, SINO con listas
  vacías, `ALTO`, `DV`, llamadas con valor, `-:n` y `- - 1` en comparaciones, `SUMA`, `COCIENTE`, `AZAR`,
  decimales con coma): texto, AST (sin líneas ni columnas) y conteo idénticos.
- Mismo resultado en las 16 497 variantes válidas del fuzz de gramática: **0 fallos**.
- Conteo: `SI` cuenta 1 más su lista, `SINO` 1 más ambas, la condición y las llamadas con valor
  cuestan 0 (`PARA F … AV F 3` da 4, como el cálculo a mano).
- `usaRecursion`: reconoce la llamada a sí mismo directa, dentro de una expresión, de un `REPITE`, de
  una condición y con el nombre en minúsculas. No hay falso positivo cuando un `PARA` llama a otro que
  no lo llama de vuelta, ni cuando solo llama a otro con valor.

### Generadores `espiral-m5` y `arbol-m5` (2 000 semillas cada uno)
- 0 fallos de generación, 0 marcadores `{…}` sin rellenar en las tres pistas, 0 retos fuera de
  encuadre o degenerados.
- `cajaDeReferencia` coincide con la caja de los segmentos reales del intérprete en todas las
  semillas (diferencia máxima < 1e-6).
- El árbol termina en el origen en las 2 000 semillas (distancia máxima 3.7e-13). Profundidad máxima 6,
  315 operaciones como máximo. La espiral llega a profundidad 53.
- 253 espirales y 244 árboles distintos. El mismo código de semilla da exactamente las mismas
  operaciones. El presupuesto sale del conteo de la referencia (6 y 10 en los ejemplos).
- Semillas raras (`-1`, `2³²`, `2⁵³`, `1.5`, `NaN`, `Infinity`, `0`): todas se normalizan sin error.
- Los niveles autorados 5.1 (ancho 195, alto 200) y 5.3 (alto 300, ancho 86) salen «degenerados» según
  `calcularEncuadre`, pero ese filtro solo se aplica a los generadores, así que no afecta.

### Seguridad
- No hay `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function` ni `Math.random` en
  `src/` fuera de pruebas y comentarios.
- `src/ui/indicador-profundidad.ts` escribe solo con `textContent` y `append`, y únicamente números
  y texto fijo. `main.ts` (≈L813) anuncia `textoProfundidad(op.profundidad)`, otro número.
- Los mensajes de error que interpolan nombres del jugador (`errores.ts`: `nombre`, `escrita`) llegan
  al globo de Kiro, que usa `textContent` en todas sus rutas (`globo-kiro.ts` L147-173).
