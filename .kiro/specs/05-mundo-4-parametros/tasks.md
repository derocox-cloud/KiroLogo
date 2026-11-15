# Implementation Plan

**KiroLogo · Spec 05 · Mundo 4 · Parámetros**

## Overview

A diferencia de la spec 04 (activar y extender), aquí **casi todo es nuevo**: el lexer no conoce
operadores, el parser no conoce parámetros, el intérprete solo evalúa literales y el impresor solo
imprime comandos simples. El plan sigue la cadena del intérprete de abajo hacia arriba
(`texto → lexer → parser → evaluador → intérprete → operaciones`) y después cuelga de ella los
consumidores:

1. Precondición de rama (R27.1), vocabulario y catálogo de errores (la tabla única de verdad).
2. AST y lexer, parser (firmas, ámbito, expresiones, aridad, bloqueo por mundo) y evaluador.
3. Intérprete (marcos con entorno, `AZAR`, `escribir`/`rotular`, guardas nuevas) y punto de control.
4. Conteo e impresor, motor (segmentos, divergencia, animador, lienzo y rótulos).
5. Juego (abstracción, estrellas, pistas, insignia, desafío, entropía) y niveles (caja de referencia,
   tres generadores, mundo 4, catálogo).
6. Interfaz (consola, editor, panel, globo, `main.ts`), documentación, pruebas de punta a punta y
   la regresión de tres estrellas sobre 200 semillas.

Las decisiones marcadas «a confirmar» en el diseño se implementan **como el diseño las propone**
(el usuario no las objetó): D6 (filtro de `escribir`/`rotular` en la divergencia), D7 (la abstracción
exige precisión y la explicación de Kiro se muestra), D9 (regla de línea para `AVANZA AVANZA 10`),
D11 (desafío del mundo 4 con tres estrellas), D13 (`aria-live="off"` en la consola) y D17 (anuncios:
uno por operación en paso a paso, uno solo al final en ejecución continua).

Convenciones del plan:

- Las pruebas de propiedad usan `fast-check` (ya es dependencia, versión exacta) con al menos 100
  iteraciones, **una prueba por propiedad**, cada una en su propio archivo `*.propiedad.test.ts` junto
  al módulo que prueba, con el comentario **Feature: 05-mundo-4-parametros, Property N: …**.
- Las pruebas existentes que el diseño lista como cambiadas se actualizan en tareas **no opcionales**:
  sin ellas la suite se rompe.
- Prioridad de pruebas del proyecto: lexer/parser con mensajes exactos, intérprete y guardas,
  validador, generadores sobre 200 semillas, conteo, determinismo.
- Todo texto visible al jugador vive en `src/lenguaje/errores.ts`; ningún `Math.random`, `Date.now`
  como fuente de azar, `eval` ni `new Function`; colores solo desde `tema.css`.

## Tasks

- [x] 0. Precondición de rama (R27.1)
  - [x] 0.1 Crear la rama de la spec a partir de `spec-04-mundo-3`
    - Verificar con `git branch -a` que `origin/spec-04-mundo-3` existe y si ya está fusionada en
      `main`; crear la rama de trabajo `spec-05-mundo-4` desde `spec-04-mundo-3` (o desde `main` si
      esa rama ya está fusionada) **antes del primer commit de implementación**.
    - Confirmar que `src/niveles/mundo-3-rosetones.ts`, `src/juego/abstraccion.ts` y
      `src/niveles/generadores/rosetón.ts` existen en la rama nueva.
    - Las actualizaciones posteriores con `main` se hacen con `git merge`, nunca con `rebase`; el PR se
      fusiona con merge commit (R27.2, R27.3).
    - _Requirements: 27.1, 27.2, 27.3_

- [x] 1. Vocabulario y catálogo de errores — `vocabulario.ts`, `errores.ts` (AMPLIAR)
  Son la tabla única de verdad del lenguaje y de los mensajes: lexer, parser, panel y generadores
  leen de aquí, así que se construyen primero.
  - [x] 1.1 `src/lenguaje/vocabulario.ts`: `produceValor`, `ejecutable`, `valorEscribible` y las ocho entradas
    - `TipoArgumento` gana `'valorEscribible'`; `EntradaVocabulario` gana `produceValor` y `ejecutable`
      (obligatorios). Las 35 entradas existentes los reciben; `ejecutable: false` en `SI`, `SINO`,
      `ALTO` y `DEVUELVE`; `produceValor: true` solo en `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE`,
      `RESTO` y `AZAR` (D8).
    - Corregir las ocho entradas del mundo 4 según la tabla del diseño: `SUMA`, `RESTA`, `PRODUCTO`,
      `COCIENTE`, `RESTO` con aridad 2 y sin abreviatura; `AZAR` con aridad 1 y descripción «Elige un
      número entero al azar entre 0 y n-1.»; `ESCRIBE`/`ES` y `ROTULA`/`RO` con tipo
      `valorEscribible`. Ejemplo e inserción de cada operador son programas válidos
      (`ESCRIBE SUMA 30 40`), descripciones de una línea y ≤ 120 caracteres.
    - `PLANTILLAS_ARGUMENTO` gana `valorEscribible: { sustantivo: 'un valor o una palabra' }`.
    - Sin listas literales de los seis nombres de operador fuera de este archivo y de `evaluador.ts`.
    - _Requirements: 5.1, 6.1, 6.2, 6.7, 8.1, 9.1, 11.1, 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x] 1.2 `src/lenguaje/errores.ts`: 17 ids nuevos y ampliación de `argumentoDeTipoEquivocado`
    - Añadir a `IdError` y `ParametrosPorError`: `variableNoDefinida`, `parametroDuplicado`,
      `procedimientoArgumentosFaltantes` (con `menosComoResta?`), `procedimientoArgumentosDeMas`,
      `operadorSinUso`, `aritmeticaBloqueada`, `parentesisSinCerrar`, `parentesisDeMas`,
      `expresionIncompleta`, `expresionDemasiadoProfunda`, `divisionPorCero`, `numeroFueraDeRango`,
      `vecesInvalidas`, `azarRangoInvalido`, `guardaEscrituras`, `invitacionAbstraccionParametros` e
      `invitacionAbstraccionProcedimientos` (el catálogo pasa de 47 a 64 ids).
    - Los 15 textos de R15 salen idénticos de la tabla; singular («Falta 1: :largo.») y plural
      («Faltan 2: :lados :largo.») según `esperados.length − recibidos`; frase extra
      «¿Querías escribir (-80) con paréntesis?» cuando `menosComoResta`; texto propio para
      `esperados: []`. Los dos textos de R22.4 se escriben aquí, una sola vez.
    - `argumentoDeTipoEquivocado` gana `procedimiento?` y `parametro?` (texto «POLIGONO necesita un
      número en :lados, pero le diste una palabra: "hola»); sin esos campos, el texto de hoy no cambia.
    - Los nombres del jugador se muestran sin normalizar; el número de línea del texto es el del campo
      `linea` del error; `crearError` valida enteros ≥ 1 y `definidos > maximo ≥ 1`, y si no devuelve
      `solicitudDeErrorInvalida`.
    - _Requirements: 15.1, 15.2, 15.3, 15.5, 15.6, 22.4, 7.8, 6.4_
  - [x] 1.3 Actualizar las pruebas existentes de `vocabulario.test.ts` y `errores.test.ts`
    - `vocabulario.test.ts`: firmas del mundo 4, campos `produceValor` y `ejecutable`.
    - `errores.test.ts`: el conteo de 47 ids pasa a 64 y se actualiza la enumeración de ids.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 15.1_
  - [x]* 1.4 Pruebas de ejemplo nuevas en `vocabulario.test.ts` y `errores.test.ts`
    - Vocabulario: tabla de las ocho entradas; `produceValor` solo en las seis; abreviaturas sin
      repetirse ni igualar otro nombre (R12.9); ejemplo e inserción analizan sin errores en el mundo 4
      (R6.7, se completa con el parser en la tarea 3.8); descripciones de una línea y ≤ 120.
    - Errores: cada texto de la tabla de R15 **carácter por carácter**; singular y plural de
      `Falta`/`Faltan`; texto con `menosComoResta`; los dos textos de R22.4; `crearError` inválido.
    - _Requirements: 6.7, 12.5, 12.9, 15.4, 22.8_
  - [x]* 1.5 Prueba de propiedad en `src/lenguaje/errores.propiedad.test.ts`
    - **Property 27: Los mensajes conservan lo que el jugador escribió**
    - **Validates: Requirements 15.5, 15.6**

- [x] 2. AST y lexer — `ast.ts`, `lexer.ts` (AMPLIAR)
  - [x] 2.1 `src/lenguaje/ast.ts`: nodos de expresión nuevos
    - Añadir `PalabraLiteral`, `MenosUnario` y `ComandoOperador` (`nombre: string`,
      `argumentos: readonly Expresion[]`); ampliar la unión `Expresion`. `ExpresionAritmetica` conserva
      `=`, `<`, `>` reservados para el mundo 5.
    - _Requirements: 3.5, 5.4, 9.3, 11.2, 13.1_
  - [x] 2.2 `src/lenguaje/lexer.ts`: tokens `operador`, `parentesis_abre`, `parentesis_cierra`
    - `TipoToken` gana los tres; `operador` con `valor` `'+' | '-' | '*' | '/'`. Se emiten siempre, sin
      mirar el mundo, con o sin espacios (`100*2` son tres tokens). No hay lexado especial de signos:
      `-5` son dos tokens y `100-50`, `100 - 50` y `100 -50` dan los mismos tokens.
    - `=`, `<` y `>` siguen siendo `caracterNoValido`; los comandos de operador se reconocen sin
      distinguir mayúsculas ni acentos.
    - _Requirements: 3.1, 3.13, 5.7_
  - [x]* 2.3 Pruebas del lexer en `src/lenguaje/lexer.test.ts`
    - `100*2` tres tokens; equivalencia de `100-50`/`100 - 50`/`100 -50`; `(` y `)` con y sin espacios;
      `=`, `<`, `>` son `caracterNoValido`; `suma`, `Resto`, `prodúcto` igual que su forma canónica;
      `parametroSinNombre` con la línea del `:`.
    - _Requirements: 1.6, 3.1, 3.13, 5.7_

- [x] 3. Parser — `src/lenguaje/parser.ts` (AMPLIAR)
  Un solo archivo, seis cambios secuenciales. Los mensajes son siempre los de `errores.ts`.
  - [x] 3.1 Firmas de procedimientos y parámetros en la cabecera
    - `recolectarProcedimientos` pasa de `Set<string>` a `Map<string, FirmaProcedimiento>`
      (`nombre`, `parametros` en minúsculas, `escritos` con `:`, `linea`, `rechazada`), con
      `firmasDeProcedimientos` exportada y `nombresDeProcedimientos` derivada (D10).
    - `analizarDefinicion` consume los `parametro` consecutivos de la cabecera y los guarda en el nodo
      si `mundo >= 4`; en mundos menores reporta `paraConParametros` y no define el procedimiento.
      Parámetro repetido: `parametroDuplicado`, sin nodo, firma conocida con `rechazada: true`.
    - Se conservan los tres rechazos existentes (pisa el lenguaje, redefinición, `PARA` sin `FIN`).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7, 1.8_
  - [x] 3.2 Gramática de expresiones, regla de la línea y paréntesis
    - Descenso recursivo `expresion → termino → unario → primario` con asociatividad izquierda, menos
      unario más fuerte que `*`, argumentos maximales (`SUMA 1 2 * 3` es `SUMA 1 (2 * 3)`) y
      `analizarExpresion` devolviendo `Expresion | null`.
    - Regla de la línea: el operador infijo continúa solo en la misma línea; el primer argumento de una
      instrucción puede empezar en línea posterior, los siguientes no.
    - `parentesisSinCerrar` (línea del `(`), `parentesisDeMas`, `expresionIncompleta`, tope de 32
      niveles de paréntesis y altura 128 con `expresionDemasiadoProfunda`, sin desbordar la pila.
    - Despacho por `tiposArgumento[0]`: `numero` → expresión; `valorEscribible` → `PalabraLiteral` o
      expresión; `color` → `analizarComandoColor` sin cambios. `REPITE` acepta expresión en su cantidad.
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.14_
  - [x] 3.3 Ámbito léxico: `variableNoDefinida`
    - `estado.ambito` = parámetros del `PARA` en curso (`null` en el programa principal); cada
      `:nombre` fuera del ámbito reporta `variableNoDefinida` con línea y columna y devuelve igual un
      `ReferenciaParametro` para seguir; ordenados y dentro del tope de 20 errores. Un procedimiento no
      hereda parámetros del que lo llama. Con errores, el programa no se ejecuta.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7, 2.8_
  - [x] 3.4 Llamadas con argumentos y aridad
    - `analizarInvocacion(estado, token, firma)`: una expresión por parámetro; menos →
      `procedimientoArgumentosFaltantes` con los nombres que faltan como se declararon (y
      `menosComoResta` si el último token fue un `-` binario); más (o argumentos a un `PARA` sin
      parámetros) → `procedimientoArgumentosDeMas`; palabra con comilla →
      `argumentoDeTipoEquivocado` con procedimiento y parámetro. Valida llamadas anteriores a la
      definición, dentro de otro `PARA` y dentro de `REPITE`, y reporta la primera inválida en orden.
    - _Requirements: 7.3, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_
  - [x] 3.5 Comandos de operador frente a comandos de acción (D9)
    - Operador en posición de instrucción → `operadorSinUso` con ejemplo `ESCRIBE <operador y
      argumentos>`; procedimiento en posición de expresión → `argumentoDeTipoEquivocado`; acción en
      posición de expresión → `argumentoDeTipoEquivocado` si está **en la misma línea** (`AVANZA AVANZA
      10`) y `argumentoFaltante` si está en una línea posterior.
    - Aridad exacta de los comandos de operador y `argumentoFaltante` cuando faltan argumentos.
      `sincronizar` y `sincronizarEnLista` se detienen solo en comandos de acción (`!produceValor`).
      Se mantienen las sugerencias de `resolverPalabraNoEjecutable` (umbrales de R6.6).
    - _Requirements: 5.4, 5.5, 6.3, 6.4, 6.5, 6.6, 9.7, 11.13_
  - [x] 3.6 Bloqueo por mundo: `aritmeticaBloqueada` y `comandoBloqueado`
    - Antes del mundo 4, una pasada sobre los tokens: si hay `operador`, `(` o `)` se reporta **un**
      `aritmeticaBloqueada` con el primer símbolo, su línea y el mundo 4, y se sigue sin repetirlo.
      Los comandos del mundo 4 (`SUMA`…`RESTO`, `AZAR`, `ESCRIBE`/`ES`, `ROTULA`/`RO`) reportan
      `comandoBloqueado` por cada ocurrencia.
    - _Requirements: 3.12, 5.6, 9.8, 11.11_
  - [x] 3.7 Actualizar las pruebas existentes de `src/lenguaje/parser.test.ts`
    - «Un comando de aridad 1 seguido de otro comando» pasa a distinguir misma línea
      (`argumentoDeTipoEquivocado`) de línea posterior (`argumentoFaltante`), según D9.
    - Las pruebas que fijaban «los `:param` de la cabecera se ignoran» desde el mundo 4 se reescriben
      para esperar parámetros en el nodo.
    - _Requirements: 1.1, 6.4_
  - [x]* 3.8 Pruebas de ejemplo nuevas del parser en `src/lenguaje/parser.test.ts`
    - Ejemplos de R3.2 y R3.3 (`360 / 2 + 1` frente a `360 / (2 + 1)`), R3.4, R3.6, R7.3
      (`POLIGONO 3 + 3 40 * 2`), `POLIGONO 6 -80` (falta un argumento con la frase del paréntesis), las
      formas de R15 en contexto, llamadas antes de la definición, `PARA` con y sin parámetros en cada
      mundo, regla de la línea, ejemplo e inserción de cada comando del mundo 4 sin errores (R6.7).
    - _Requirements: 3.2, 3.3, 3.4, 3.6, 6.7, 7.3, 7.10_
  - [x]* 3.9 Prueba de propiedad en `src/lenguaje/parser.ambito.propiedad.test.ts`
    - **Property 9: Las referencias fuera de ámbito se reportan una por una**
    - **Validates: Requirements 1.5, 2.2, 2.3, 2.4, 2.8**
  - [x]* 3.10 Prueba de propiedad en `src/lenguaje/parser.llamadas.propiedad.test.ts`
    - **Property 10: Las llamadas y los comandos de operador se validan antes de ejecutar**
    - **Validates: Requirements 1.7, 6.3, 7.3, 7.5, 7.6, 7.7, 7.9, 7.10, 12.8**
  - [x]* 3.11 Prueba de propiedad en `src/lenguaje/parser.bloqueo.propiedad.test.ts`
    - **Property 11: Los símbolos y comandos del mundo 4 están bloqueados antes de él**
    - **Validates: Requirements 1.4, 3.12, 5.6, 9.8, 11.11**
  - [x]* 3.12 Prueba de propiedad en `src/lenguaje/parser.parentesis.propiedad.test.ts`
    - **Property 12: Paréntesis, operandos y profundidad**
    - **Validates: Requirements 3.1, 3.8, 3.9, 3.10, 3.11**

- [x] 4. Evaluador — `src/lenguaje/evaluador.ts` (NUEVO)
  Módulo puro de `lenguaje/` que no importa nada salvo `errores.ts` y los tipos de `ast.ts` (D18).
  - [x] 4.1 Implementar `evaluar`, `formatearNumero` y `cantidadDeRepeticiones`
    - `evaluar(expresion, { valores, linea, azar })` → `{ exito, valor } | { exito: false, error }`,
      escrito a mano, doble precisión sin redondeo intermedio, izquierda a derecha (gana el error de la
      izquierda). Tabla `OPERADORES` (`SUMA`…`RESTO`) y `AZAR` aparte.
    - `divisionPorCero` para divisor `0` o `-0` en `/`, `COCIENTE`, `RESTO`; `numeroFueraDeRango` si el
      resultado no es finito; `RESTO` con el signo del dividendo; `azarRangoInvalido` si `n` no es
      entero ≥ 1; `variableNoDefinida` defensivo; `nodoNoImplementado` para `= < >` y palabras en
      contexto numérico.
    - `formatearNumero`: `toFixed(4)` sin ceros finales, `0` para `-0`; `cantidadDeRepeticiones(v)`:
      `redondeo(v)` si `|v − redondeo(v)| < 1e-9` y `≥ 0`, si no `null`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.11, 5.2, 8.2, 9.2, 9.6_
  - [x]* 4.2 Pruebas de ejemplo en `src/lenguaje/evaluador.test.ts`
    - `-0` como divisor, `7 / 2`, `COCIENTE 7 2`, `RESTO -7 3` (−1), `RESTO 7 -3` (1), `1e308 * 10`,
      `10 / 3` → `3.3333`, claves de `OPERADORES` más `AZAR` iguales a las entradas con `produceValor`.
    - _Requirements: 4.4, 4.5, 4.8, 4.9, 5.2, 9.2_
  - [x]* 4.3 Arbitrarios y modelo independiente en `src/pruebas/arbitrarios.ts`
    - `arbExpresion(altura)`, `arbPrograma(mundo)` y `modeloEvaluar` (notación polaca inversa con pila,
      sin compartir código con `evaluador.ts`), reutilizados por las propiedades 1 a 12.
    - _Requirements: 4.10, 3.15_
  - [x]* 4.4 Prueba de propiedad en `src/lenguaje/evaluador.modelo.propiedad.test.ts`
    - **Property 2: El evaluador coincide con un modelo independiente**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.6, 4.1, 4.10, 4.11**
  - [x]* 4.5 Prueba de propiedad en `src/lenguaje/evaluador.equivalencia.propiedad.test.ts`
    - **Property 3: Los comandos de operador equivalen a los infijos**
    - **Validates: Requirements 5.2, 5.3**
  - [x]* 4.6 Prueba de propiedad en `src/lenguaje/evaluador.resto.propiedad.test.ts`
    - **Property 4: RESTO y COCIENTE**
    - **Validates: Requirements 4.8, 4.9, 5.2**
  - [x]* 4.7 Prueba de propiedad en `src/lenguaje/evaluador.texto.propiedad.test.ts`
    - **Property 16: El texto numérico es el esperado**
    - **Validates: Requirements 9.2, 9.3, 9.6**

- [x] 5. Intérprete — `src/lenguaje/interprete.ts` (AMPLIAR)
  Un solo archivo, cuatro cambios secuenciales. El generador sigue siendo el único flujo de
  operaciones para todos los consumidores.
  - [x] 5.1 Operaciones nuevas, `lineaLlamada` y tipos de guarda
    - `OperacionEscribir { texto }` y `OperacionRotular { texto, posicion, color }` con
      `estadoAntes === estadoDespues`; `OperacionBase.lineaLlamada?: number`; `EstadoDecorativo.color`
      pasa a `Color | null` con valor inicial `null`; `TipoGuarda` gana `'escrituras'`;
      `LimitesEjecucion` gana `maximoEscrituras?` (500) y `maximoCiclos?` (2 000 000), opcionales.
    - _Requirements: 9.4, 9.5, 11.2, 11.4, 25.6_
  - [x] 5.2 Marcos con entorno y llamadas con argumentos (D4)
    - `Marco` con `restantes`, `entorno`, `procedimiento` y `lineaLlamada`; `REPITE` apila **un** marco
      con contador (ya no n marcos); `profundidad` cuenta solo marcos de procedimiento, de modo que
      `REPITE 150 [CUADRADO]` no dispara `guardaRecursion`. Definiciones indexadas en un `Map`.
    - La llamada evalúa los argumentos de izquierda a derecha en el entorno de quien llama; si alguno
      falla no se crea marco; el marco nuevo recibe copias de los valores (paso por valor).
    - _Requirements: 2.5, 2.6, 4.3, 7.1, 7.2, 7.4_
  - [x] 5.3 Evaluación de argumentos, `REPITE`, `AZAR`, `ESCRIBE` y `ROTULA`
    - `ejecutarComando` recibe valores ya evaluados con el entorno del marco; `PONGROSOR` valida
      entero 1 a 50 sobre el valor evaluado; `REPITE` usa `cantidadDeRepeticiones` y reporta
      `vecesInvalidas` sin ejecutar el cuerpo; giros y avances usan el valor exacto.
    - PRNG creado perezosamente, una instancia por ejecución, con `opciones.semilla`; `AZAR 1` vale 0.
    - `ESCRIBE` emite `escribir` con `formatearNumero` o la palabra sin comilla; `ROTULA` emite
      `rotular` con posición y color vigentes, también con el lápiz arriba.
    - _Requirements: 4.6, 4.7, 4.11, 8.2, 8.3, 8.5, 9.2, 9.3, 9.4, 9.6, 11.2, 11.3, 11.4_
  - [x] 5.4 Guardas: escrituras, ciclos y tiempo (D5)
    - `escribir` y `rotular` suman 1 a los pasos; la operación 501 entre ambas no se emite y termina con
      `guardaEscrituras` conservando las 500 anteriores; `maximoCiclos` cuenta instrucciones
      despachadas e iteraciones (incluso con cuerpo vacío) y reutiliza `guardaPasos`; la guarda de
      tiempo se mide cada `pasosEntreMediciones` **ciclos**.
    - _Requirements: 9.9, 9.10, 4.4, 4.5_
  - [x] 5.5 Actualizar las pruebas existentes de `src/lenguaje/interprete.test.ts`
    - Las que afirmaban el valor inflado de `profundidad` dentro de un `REPITE` pasan a esperar la
      profundidad de procedimientos; los datos de `LimitesEjecucion` siguen compilando porque los
      campos nuevos son opcionales.
    - _Requirements: 7.1, 9.9_
  - [x]* 5.6 Pruebas de ejemplo nuevas en `src/lenguaje/interprete.test.ts`
    - `POLIGONO 6 80`, `3 100`, `5 100`, `8 100` (R7.1, R7.2); `profundidad` 1 y no 150 dentro de
      `REPITE 150 [CUADRADO]`; cada guarda; `AZAR 1` es 0; `ESCRIBE` no mueve la tortuga; el límite de
      500 conserva exactamente 500 operaciones; `ROTULA` con lápiz arriba y abajo.
    - _Requirements: 7.1, 7.2, 8.2, 9.4, 9.10, 11.3_
  - [x]* 5.7 Prueba de propiedad en `src/lenguaje/interprete.aritmetica.propiedad.test.ts`
    - **Property 5: Un error aritmético detiene la ejecución y conserva lo emitido**
    - **Validates: Requirements 4.2, 4.4, 4.5, 25.8**
  - [x]* 5.8 Prueba de propiedad en `src/lenguaje/interprete.repite.propiedad.test.ts`
    - **Property 6: La cantidad de un REPITE se evalúa con tolerancia**
    - **Validates: Requirements 4.6, 4.7**
  - [x]* 5.9 Prueba de propiedad en `src/lenguaje/interprete.azar.propiedad.test.ts`
    - **Property 7: AZAR es determinista, acotado y aislado**
    - **Validates: Requirements 8.2, 8.3, 8.5, 8.6, 8.7, 8.8**
  - [x]* 5.10 Prueba de propiedad en `src/lenguaje/interprete.llamadas.propiedad.test.ts`
    - **Property 8: Llamar a un procedimiento equivale a sustituir sus parámetros**
    - **Validates: Requirements 1.3, 2.1, 2.5, 2.6, 4.3, 7.1, 7.2, 7.4**
  - [x]* 5.11 Prueba de propiedad en `src/lenguaje/interprete.limites.propiedad.test.ts`
    - **Property 15: Los pasos y las escrituras tienen tope**
    - **Validates: Requirements 9.9, 9.10**

- [x] 6. Checkpoint - Lenguaje completo hasta el intérprete
  - Ejecutar `npm run typecheck` y `npm test -- --maxWorkers=2` sobre `src/lenguaje/`.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Conteo e impresor — `conteo.ts`, `impresor.ts`
  - [x] 7.1 `src/lenguaje/conteo.ts`: recorrido exhaustivo de expresiones
    - Recorrido de expresiones con `switch` exhaustivo (0 para número, parámetro, aritmética, menos
      unario, palabra y `ComandoOperador`; `default` con `lanzarNodoDesconocido(nodo: never)`) invocado
      para cada argumento, el cuerpo de `PARA`/`REPITE` y la cantidad de `REPITE`. `ESCRIBE` y
      `ROTULA` cuentan 1. Actualizar el comentario de tabla de la cabecera con los nodos nuevos (costo 0).
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6, 13.7, 13.8_
  - [x] 7.2 `src/lenguaje/impresor.ts`: reescritura (D1)
    - Imprimir `REPITE` (cabecera, cuerpo con 2 espacios más, `]` en línea propia; vacío en una línea),
      `PARA … FIN` con parámetros, invocaciones, `PONCOLOR`/`RELLENA` con su `argumentoColor`,
      `PalabraLiteral` (`"hola`), `MenosUnario` pegado al operando y comandos de operador.
    - Paréntesis mínimos: menor precedencia, operando derecho de igual precedencia, y
      `terminaEnComandoAbierto` para el operando izquierdo (R14.3 c generalizada); argumento que empieza
      con menos unario y no es el primero va entre paréntesis (`POLIGONO 6 (-80)`).
    - `opciones.hueco` reemplaza cada `numeroLiteral`; `nodoNoImprimible` sin texto parcial para
      números negativos o no finitos, `condicionalUnaRama`, `= < >` y comandos no declarados.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.7, 23.4_
  - [x] 7.3 Actualizar la prueba existente de `src/lenguaje/impresor.test.ts` (D1)
    - El ejemplo de «nodo reservado» pasa de `repeticion` a `condicionalUnaRama`.
    - _Requirements: 14.7_
  - [x]* 7.4 Pruebas de ejemplo en `src/lenguaje/conteo.test.ts`
    - `PARA POLIGONO … POLIGONO 6 80` cuenta 4; `AVANZA 100`, `AVANZA 50 + 50` y `AVANZA SUMA 50 50`
      cuentan 1; `ESCRIBE`/`ROTULA` cuentan 1; nodo desconocido → `nodoDesconocidoEnConteo` sin conteo
      parcial; cabecera de `PARA` suma 0.
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.7_
  - [x]* 7.5 Prueba de propiedad en `src/lenguaje/impresor.idavuelta.propiedad.test.ts`
    - **Property 1: Ida y vuelta entre impresor y parser**
    - **Validates: Requirements 1.1, 1.2, 3.5, 3.15, 5.4, 5.7, 14.3, 14.5, 14.6**
  - [x]* 7.6 Prueba de propiedad en `src/lenguaje/conteo.propiedad.test.ts`
    - **Property 13: El conteo no depende de las expresiones**
    - **Validates: Requirements 13.1, 13.2, 13.4**

- [x] 8. Motor — `segmentos.ts`, `divergencia.ts`, `animador.ts`, `lienzo.ts`
  - [x] 8.1 `src/motor/segmentos.ts`: casos explícitos de texto
    - `escribir` y `rotular` agregados al `switch` junto a `girar`, `reubicar`, `lapiz` y `visibilidad`;
      la lista de segmentos es idéntica con y sin ellas.
    - _Requirements: 9.11, 11.8_
  - [x] 8.2 `src/motor/divergencia.ts`: filtro de texto, orden 1-based y semilla (D6)
    - `operacionesComparables` filtra solo `escribir` y `rotular`; `PuntoDivergencia.orden` =
      `indice + 1`; `ResultadoParalelo.ordenSeparacion` (si una ejecución es más corta,
      `longitudDeLaCorta + 1`); `ejecutarEnParalelo(kiro, jugador, mundo?, semilla?)` usa la misma
      semilla en ambas ejecuciones (por omisión 0). Los textos de los mensajes no cambian.
    - _Requirements: 8.6, 9.12, 25.7_
  - [x] 8.3 `src/motor/animador.ts`: `escribir` y `rotular`
    - `aplicarCompleta`: `escribir` no dibuja (la consola se alimenta por `alAplicar`); `rotular` llama a
      `lienzo.rotular?` solo para el destino `jugador`. `LienzoAnimador` gana `rotular?`. Ambas
      operaciones duran 0 sin importar la velocidad y se aplican en el ciclo que cierra la anterior;
      con `prefers-reduced-motion` o velocidad inmediata aparecen completas.
    - _Requirements: 10.4, 11.10_
  - [x] 8.4 `src/motor/lienzo.ts`: rótulos y tipografía (D21)
    - `ContextoDibujo` gana `fillText`, `font`, `textAlign`, `textBaseline`; `EstiloLienzo.rotulo`
      (`TipografiaRotulo`); `dibujarRotulos` y `Lienzo.rotular(capa, rotulo)` solo en la capa
      `jugador`. Texto horizontal con `save`/`translate`/`scale(1, -1)`/`fillText`/`restore`, recortado
      al cuadrado lógico sin lanzar, repintado tras la estela y borrado con `limpiarEstela('jugador')`.
      Color de la operación o `tipografia.color`; ningún literal de color.
    - _Requirements: 11.5, 11.6, 11.7_
  - [x] 8.5 Actualizar `src/motor/lienzo.test.ts` y `src/motor/doble-dibujo.test.ts`
    - Los dobles de dibujo ganan `fillText`, `font`, `textAlign`, `textBaseline` y los estilos de prueba
      ganan `rotulo`, para que la suite siga compilando.
    - _Requirements: 11.5_
  - [x] 8.6 `src/ui/reproduccion-paralelo.ts`: usar `operacionesComparables`
    - Un cuadro por operación comparable, de modo que una línea de `ESCRIBE` no sea un cuadro con la
      tortuga quieta; la separación se señala con `ordenSeparacion`.
    - _Requirements: 25.7_
  - [x]* 8.7 Pruebas de ejemplo de segmentos, divergencia y animador
    - `src/motor/segmentos.test.ts`: programa con y sin `ESCRIBE`/`ROTULA` da la misma lista.
      `src/motor/divergencia.test.ts`: filtro, `orden` desde 1, `ordenSeparacion` con ejecución más
      corta, semilla compartida. `src/motor/animador.test.ts`: `rotular` solo en la capa del jugador y
      duración 0 de `escribir`/`rotular`.
    - _Requirements: 9.11, 9.12, 11.8, 25.7_
  - [x]* 8.8 Pruebas de rótulos en `src/motor/lienzo.test.ts`
    - Orden de dibujo, `scale(1, -1)`, recorte fuera del área sin error, borrado con la estela y con
      `BORRAPANTALLA`, el rótulo no aparece en la capa de Kiro, color desde tipografía del tema.
    - _Requirements: 11.5, 11.6, 11.7_
  - [x]* 8.9 Prueba de propiedad en `src/motor/texto.propiedad.test.ts`
    - **Property 14: El texto no cambia la geometría ni la comparación**
    - **Validates: Requirements 9.4, 9.5, 9.11, 9.12, 11.2, 11.3, 11.4, 11.8, 11.12, 25.7**

- [x] 9. Checkpoint - Lenguaje y motor
  - Ejecutar `npm run typecheck` y `npm test -- --maxWorkers=2` sobre `src/lenguaje/` y `src/motor/`.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Juego — `abstraccion.ts`, `estrellas.ts`, `pistas.ts`, `insignias.ts`, `desafio-infinito.ts`, `azar/entropia.ts`
  - [x] 10.1 `src/juego/abstraccion.ts`: `usaParametros` endurecido
    - `contarProcedimientos(programa)` (todas las definiciones); `usaParametros` exige un `PARA` que
      declara parámetros, **usa uno propio** en una expresión de su cuerpo (a cualquier profundidad) y
      se invoca **fuera de su propio cuerpo** (D19). Recorridos de expresión con `switch` sobre
      `Expresion['tipo']` y `default` con `nuncaExpresion(e: never)`; `PalabraLiteral` no usa
      parámetros. `maximoProcedimientos` cuenta todas las definiciones.
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.7_
  - [x] 10.2 `src/juego/estrellas.ts`: abstracción exige precisión y explicación de Kiro (D7)
    - `calificar` otorga abstracción solo si la precisión se otorga; sin ella
      `motivo: { clave: 'sinPrecision' }`. `mensajeAbstraccion` compone, con precisión otorgada, una
      línea por exigencia sin confirmar **en el orden del nivel** (`usaRepite`, `usaParametros`,
      `maximoProcedimientos` con `definidos` y `maximo`), unidas por `\n`; `null` si no hay precisión o
      todo está confirmado. Precisión y economía no cambian.
    - _Requirements: 21.6, 22.1, 22.2, 22.3, 22.5, 22.6, 22.7_
  - [x] 10.3 `src/juego/pistas.ts`: placeholders del mundo 4 (D2)
    - `rellenarPistas` conserva `{tramos}`, `{giro}`, `{cuadros}`, `{esqueleto}` y gana `{lados1}`,
      `{lados2}`, `{lados3}`, `{lados}`, `{largo}`, `{copias}`, `{puntas}` leídos de las llamadas del
      nivel superior de la referencia, y `{esqueletoConHuecos}` =
      `imprimir(referencia, { hueco: '___' })`. Un valor ilegible deja el placeholder sin sustituir.
    - _Requirements: 23.2, 23.3, 23.4, 23.6_
  - [x] 10.4 `src/juego/insignias.ts`: insignia *Generalización*
    - `IdInsigniaDeConcepto` gana `'generalizacion'`; `MUNDO_DE_INSIGNIA.generalizacion = 4`; entrada en
      `INSIGNIAS_DE_CONCEPTO`; `insigniaGeneralizacionOtorgada` = `mundoCompletoConTresEstrellas(4, …)`
      y entrada en `OTORGADA_DE_CONCEPTO`. Sin aserciones de tipo; el nombre sale de `MUNDOS[4]`.
    - _Requirements: 24.1, 24.2, 24.3, 24.8, 24.9_
  - [x] 10.5 `src/juego/desafio-infinito.ts`: umbral por mundo (D11)
    - `UMBRAL_DESAFIO_POR_MUNDO` (`precision` en 0 a 3 y 5, `tresEstrellas` en 4); `mundoCompleto` la
      consulta. Reescribir el comentario de cabecera para que solo el mundo 5 quede sin niveles
      generados.
    - _Requirements: 24.5, 24.6, 24.7_
  - [x] 10.6 `src/azar/entropia.ts` (NUEVO): entropía de semillas (D12)
    - `FuenteEntropia`, `entropiaDelNavegador` (`crypto.getRandomValues`, con respaldo congruencial
      determinista a partir de la semilla actual, nunca el reloj) y
      `semillaDistinta(fuente, actual)`: hasta 8 intentos y, si agota, `(actual + 1) mod 2^32`.
    - _Requirements: 8.9, 25.2_
  - [x] 10.7 Actualizar la prueba existente de `src/juego/estrellas.test.ts`
    - Cualquier prueba que afirme abstracción otorgada sin precisión (D7) pasa a esperar `sinPrecision`.
    - _Requirements: 21.6_
  - [x]* 10.8 Pruebas de ejemplo en `src/juego/abstraccion.test.ts`
    - Los casos de R21.8: cumple ambas; sin `PARA`; `PARA` con parámetros que no usa; `PARA` usado pero
      sin invocar; parámetro solo en expresión anidada (`AVANZA SUMA :largo 10`, `AVANZA -:largo`); dos
      `PARA` con parámetros en el 4.2.
    - _Requirements: 21.3, 21.4, 21.5, 21.7, 21.8_
  - [x]* 10.9 Pruebas de ejemplo en `src/azar/entropia.test.ts`
    - Con una fuente que devuelve siempre lo mismo, `semillaDistinta` termina y no repite.
    - _Requirements: 25.2_
  - [x]* 10.10 Pruebas de ejemplo en `src/juego/pistas.test.ts`
    - Placeholders nuevos sustituidos; placeholder sin valor queda sin sustituir; `{esqueletoConHuecos}`
      sin literales numéricos; el esqueleto del mundo 0 no cambia.
    - _Requirements: 23.2, 23.4, 23.6_
  - [x]* 10.11 Prueba de propiedad en `src/juego/abstraccion.propiedad.test.ts`
    - **Property 17: usaParametros y maximoProcedimientos**
    - **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.7**
  - [x]* 10.12 Prueba de propiedad en `src/juego/estrellas.explicacion.propiedad.test.ts`
    - **Property 18: La explicación de Kiro nombra lo que falta**
    - **Validates: Requirements 22.1, 22.2, 22.3, 22.5, 22.6**
  - [x]* 10.13 Prueba de propiedad en `src/juego/estrellas.propiedad.test.ts`
    - **Property 19: La abstracción exige precisión y no altera las otras estrellas**
    - **Validates: Requirements 21.6, 22.7**

- [x] 11. Niveles y generadores — `src/niveles/`
  `niveles/` solo importa de `lenguaje/` y `azar/`. Todos los generadores producen AST con
  expresiones **sin evaluar**.
  - [x] 11.1 `src/niveles/tipos.ts`: campo `enunciado?` (D16)
    - `Nivel` gana `readonly enunciado?: string` (≤ 240 caracteres); los niveles 0 a 3 no lo declaran.
    - _Requirements: 16.3, 17.9, 18.9, 19.7_
  - [x] 11.2 `src/niveles/generadores/comun.ts`: constructores de AST y `cajaDeReferencia` ampliada (D3)
    - Constructores `numero`, `parametro`, `operacion`, `definicion`, `llamada`; `avanza`, `giro` y
      `repite` aceptan `number | Expresion`.
    - `cajaDeReferencia` recorre `PARA`, llamadas con entorno y expresiones usando `evaluar` de
      `lenguaje/` (sin importar de `motor/`); devuelve `null` ante error, procedimiento inexistente o
      más de 50 000 pasos. Para programas sin `PARA` produce el mismo resultado de hoy, de modo que los
      generadores de los mundos 0 a 3 no cambian.
    - _Requirements: 20.3, 20.6, 20.7_
  - [x]* 11.3 Pruebas de ejemplo en `src/niveles/generadores/comun.test.ts`
    - Caja de una llamada a `POLIGONO`, de repeticiones con cantidades calculadas, `null` ante error;
      regresión: misma caja que antes para programas de los mundos 0 a 3.
    - _Requirements: 20.6_
  - [x] 11.4 Generador `tres-poligonos-m4` (nivel 4.2) y `generadores/poligono-comun.ts`
    - `definicionPoligono()` compartida (`PARA POLIGONO :lados :largo REPITE :lados [AVANZA :largo
      GIRADERECHA 360 / :lados] FIN`). `lados`: tres valores distintos de `3..8` sin reposición;
      `largo = prng.multiplo(40, 200, 20)`; tres llamadas consecutivas. Lazo de reintento con semilla
      `semilla + intento`, hasta 200 intentos, descartando por dimensión mínima 200 y encuadre; al
      agotar, `generadorSinCandidato` sin lanzar excepción.
    - _Requirements: 17.1, 17.2, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9_
  - [x] 11.5 Generador `estrella-parametrica-m4` (nivel 4.4)
    - `puntas = prng.elegir([5, 7, 9, 11])`, `largo = prng.multiplo(40, 200, 20)`; `PARA ESTRELLA
      :puntas :largo` con `REPITE :puntas [AVANZA :largo GIRADERECHA 360 * 2 / :puntas]` y una llamada.
      Mismo lazo de reintento y descarte.
    - _Requirements: 19.1, 19.2, 19.3, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9_
  - [x] 11.6 Generador `poligonos-encajados-m4` (nivel 4.3, D15)
    - `lados = prng.entero(3, 8)`, `copias = prng.entero(3, 5)`,
      `base = prng.multiplo(40, 200 − 20·(copias − 1), 20)`; `copias` llamadas con
      `largo = base + 20·k` y ninguna otra instrucción entre ellas (comparten el vértice de partida y
      el primer lado). Mismo lazo de reintento y descarte (con 3 lados y 4 lados solo pasan los casos
      que cumplen la dimensión mínima).
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9_
  - [x] 11.7 `src/niveles/generadores/registro.ts`: registrar los tres generadores
    - Añadir `tres-poligonos-m4`, `poligonos-encajados-m4` y `estrella-parametrica-m4` a `GENERADORES`
      sin alterar las entradas existentes.
    - _Requirements: 17.1, 18.1, 19.1_
  - [x] 11.8 `src/niveles/mundo-4-parametros.ts` (NUEVO): niveles 4.1 a 4.4
    - `parsearReferencia(texto)` con `{ mundo: 4 }`; `NORMALIZACION_M4` fija/fija/exacta. 4.1 autorado
      (semilla 401, referencia `POLIGONO 6 80`); 4.2 «Tres polígonos, un solo PARA» con `usaParametros` y
      `maximoProcedimientos` 1 y `margenLimiteDuro: 6`; 4.3 «Polígonos encajados» con `usaParametros`;
      4.4 «Estrella con parámetros» con `usaParametros`. Concepto `generalizacion`.
    - Ningún `presupuestoEstrella` ni `limiteDuro` escrito a mano. Cada nivel con `enunciado` que
      advierte que la posición y el rumbo de partida importan, y tres pistas (conceptual, matemática,
      esqueleto con huecos) con las plantillas del diseño; la del 4.1 con texto fijo. Exportar
      `MUNDO_4`.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.8, 17.3, 17.4, 17.9, 18.5, 18.9, 19.4, 19.7, 20.10, 20.12, 23.1, 23.5, 23.7_
  - [x] 11.9 `src/niveles/catalogo.ts` y `catalogo.test.ts`: agregar `...MUNDO_4`
    - `...MUNDO_4` inmediatamente después de `...MUNDO_3`; actualizar el comentario de la cabecera y
      las expectativas de `catalogo.test.ts` (mundos y cantidad de niveles). `mundos.ts` no se toca.
    - _Requirements: 20.14, 24.8_
  - [x] 11.10 Actualizar `src/juego/desafio-infinito.test.ts`
    - Se invierte la prueba que afirmaba que el mundo 4 no tiene niveles generados; el desafío del
      mundo 4 solo se habilita con tres estrellas (D11) y cicla `4.2, 4.3, 4.4`.
    - _Requirements: 24.5, 24.6_
  - [x]* 11.11 Pruebas de ejemplo en `src/niveles/mundo-4-parametros.test.ts`
    - 4.1 parsea y su conteo es 4 (límite duro 7); 4.2 conteo 6 y límite 12; 4.3 y 4.4 derivan
      presupuesto y límite; pistas de 4.1 con esqueleto distinto de la referencia impresa;
      `REPITE 6 [AVANZA 80 GIRADERECHA 60]` gana precisión y economía pero no abstracción en 4.1.
    - _Requirements: 16.2, 16.5, 16.7, 16.8, 20.11, 20.13_
  - [x]* 11.12 Prueba de propiedad en `src/niveles/generadores/mundo-4.propiedad.test.ts`
    - **Property 20: Los generadores del mundo 4 producen retos con la forma pedida**
    - **Validates: Requirements 17.2, 18.2, 18.3, 18.4, 19.2, 19.3, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8**
    - Sobre 200 semillas por generador, incluida la comparación de la caja con los segmentos reales
      (`ejecutar` + `extraerSegmentos`, tolerancia 1e-6).
  - [x]* 11.13 Prueba de propiedad en `src/juego/reto.mundo-4.propiedad.test.ts`
    - **Property 22: El presupuesto y el límite duro se derivan de la referencia**
    - **Validates: Requirements 16.5, 17.4, 18.7, 20.11, 20.13**
  - [x]* 11.14 Prueba de propiedad en `src/juego/rodeos.propiedad.test.ts`
    - **Property 23: Los rodeos corren, aprueban la precisión y no ganan lo demás**
    - **Validates: Requirements 17.5, 17.6, 17.8, 18.6, 19.6**
  - [x]* 11.15 Prueba de propiedad en `src/juego/pistas.mundo-4.propiedad.test.ts`
    - **Property 24: Las pistas se rellenan desde la referencia**
    - **Validates: Requirements 23.2, 23.3, 23.4, 23.5, 23.6, 23.7**
  - [x]* 11.16 Prueba de propiedad en `src/juego/reto.semilla.propiedad.test.ts`
    - **Property 25: Los retos son reproducibles por semilla**
    - **Validates: Requirements 20.9, 25.2, 25.3, 25.5, 27.8**
  - [x]* 11.17 Prueba de propiedad en `src/juego/insignias.propiedad.test.ts`
    - **Property 26: La insignia y el desafío siguen a las estrellas**
    - **Validates: Requirements 24.2, 24.3, 24.5**
    - Además, casos de ejemplo nuevos de *Generalización*; las pruebas existentes de `insignias.test.ts`
      pasan sin modificar sus aserciones (R24.9).
  - [x]* 11.18 Prueba de propiedad en `src/juego/desafio-infinito.propiedad.test.ts`
    - **Property 28: El desafío infinito del mundo 4 es cíclico y determinista**
    - **Validates: Requirements 24.6**

- [x] 12. Checkpoint - Juego y niveles
  - Ejecutar `npm run typecheck`, `npm run build` y `npm test -- --maxWorkers=2`.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Interfaz — `ui/` y `main.ts`
  - [x] 13.1 `src/estilos/tema.css` y `pantalla.css`: fichas y reglas de consola, rótulo y llamada
    - Fichas de consola (`--lineas-visibles-consola: 6`, `--alto-linea-consola: 1.5rem`,
      `--color-consola-fondo/texto/titulo/borde`, `--fuente-consola`) y `--color-rotulo` apuntando a
      `--color-estela-jugador`. En `pantalla.css`: `.kl-consola*`, `.kl-canaleta-llamada` (subrayado
      punteado y «↳» por CSS, sin depender del color) y `.kl-globo-mensaje { white-space: pre-wrap }`.
      Las reglas leen `var(--…)` sin valores de reserva literales.
    - _Requirements: 10.13, 11.5, 25.6_
  - [x] 13.2 `src/ui/consola.ts` (NUEVO)
    - `crearConsola({ contenedor })` con `fijarMundo`, `agregar`, `vaciar`, `lineas`, `plegada`,
      `resumen`. Ranura persistente; `<section>` con título, botón con `aria-expanded` y registro
      `role="log"`, `aria-label="Consola"`, **`aria-live="off"` explícito (D13)**, `tabindex="0"`,
      desplazable. Solo desde el mundo 4 (antes no hay nodo con rol); plegada por omisión y tras
      `vaciar`; `agregar` despliega, desplaza al final y **nunca llama a `focus()`**; máximo 500 líneas.
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.7, 10.9, 10.10, 10.11_
  - [x] 13.3 `src/ui/editor.ts`: `resaltarLineas(principal, llamada)`
    - `resaltarLineas(principal, llamada | null)`; `resaltarLinea(l)` delega con `null`. La canaleta
      marca `kl-canaleta-actual` y `kl-canaleta-llamada`; al terminar el procedimiento se retira la
      marca de la llamada.
    - _Requirements: 25.6_
  - [x] 13.4 `src/ui/panel-comandos.ts`: `fijarFirmas`
    - `fijarFirmas(firmas)` muestra la cabecera con parámetros (`POLIGONO :lados :largo`) y los incluye
      en el nombre accesible; `fijarProcedimientos(nombres)` delega con firmas sin parámetros. Las ocho
      entradas del mundo 4 aparecen solo desde el mundo 4 (D14: se siguen listando todos los
      procedimientos válidos).
    - _Requirements: 12.6, 12.7, 12.8, 25.10_
  - [x] 13.5 `src/ui/globo-kiro.ts`: explicación de abstracción y pistas multilínea (D7)
    - `comentarCalificacion` pone el resultado en la primera línea, omite el detalle genérico de
      abstracción cuando hay `mensajeAbstraccion` y muestra cada línea de la explicación en su propio
      `<p>` con `fijarLineas`, **sin recorte**; las pistas con `\n` (esqueleto) se muestran con
      `fijarLineas`. Las estrellas se guardan antes de comentar. El saludo usa `nivel.enunciado` si existe.
    - _Requirements: 22.1, 22.2, 22.3, 22.7, 23.4_
  - [x] 13.6 `src/main.ts` (1/2): consola, anuncios (D17), resaltado y panel
    - Crear la consola después de los controles (orden de `Tab`); `montarReto` llama a
      `consola.fijarMundo` y `vaciar`; `alAplicar` agrega líneas en `escribir`; vaciar al iniciar
      ejecución, en `cambiarANivel` y en `reiniciar`; un error posterior conserva las líneas.
    - Resaltado `resaltarLineas(op.linea, op.lineaLlamada ?? null)` con clave de caché `linea|llamada`.
    - Anuncios (D17): paso a paso, uno por operación («Línea N: escribiste «72» en la consola.»,
      «Línea N: rotulaste «hola».»); ejecución continua, **un único anuncio final** que añade el
      resumen de `consola.resumen()` y de los rótulos, también si el jugador detiene la ejecución. Sin
      región `aria-live` nueva. `panel.fijarFirmas(firmasDeProcedimientos(...))` en `alCambiar` y
      `montarReto`.
    - _Requirements: 10.4, 10.5, 10.6, 10.12, 11.9, 12.8, 25.6, 25.9_
  - [x] 13.7 `src/main.ts` (2/2): guardas, semillas, divergencia y estilo de rótulo
    - `ejecutar(..., { ahora: ahoraReal })` (D5); `semillaNuevaParaNivel` desaparece y se usa
      `semillaDistinta(entropia, reto.semillaEfectiva)` con `DependenciasAplicacion.entropia?`;
      `ejecutarEnParalelo(..., reto.semillaEfectiva)`; el `Aplicacion` expone `consola`; la tipografía
      de rótulo se lee del tema (`--color-rotulo`); error de código de semilla inválido deja reto,
      semilla y editor intactos.
    - _Requirements: 8.4, 8.6, 8.9, 25.2, 25.3, 25.4, 25.5_
  - [x] 13.8 Actualizar las pruebas existentes de `src/main.test.ts`
    - Adaptar las que dependían de `semillaNuevaParaNivel`, de la forma del `Aplicacion` y de los
      dobles de dibujo; añadir la entropía inyectable a los dobles de dependencias.
    - _Requirements: 8.9, 25.2_
  - [x]* 13.9 Pruebas de ejemplo en `src/ui/consola.test.ts`
    - Plegada por omisión; no está en el DOM antes del mundo 4; `aria-expanded`; `Enter` y `Espacio`;
      no roba el foco; `role="log"` con nombre «Consola» y `aria-live="off"`; máximo de 6 líneas leído
      de la ficha; `vaciar` pliega.
    - _Requirements: 10.1, 10.2, 10.3, 10.7, 10.9, 10.10, 10.11_
  - [x]* 13.10 Pruebas de ejemplo en `src/ui/editor.test.ts`
    - `resaltarLineas` marca línea actual y de llamada; la retira al terminar el procedimiento; el
      contador muestra el aviso de bloqueo por límite duro en el mundo 4.
    - _Requirements: 25.6, 25.11_
  - [x]* 13.11 Pruebas de ejemplo en `src/ui/panel-comandos.test.ts`
    - Ocho entradas en el mundo 4 y ninguna en el 3; firmas con parámetros en orden de cabecera;
      actualización dentro de 500 ms; activar con `Enter`/`Espacio` inserta `insercion`.
    - _Requirements: 12.6, 12.7, 12.8, 25.10_
  - [x]* 13.12 Pruebas de ejemplo en `src/ui/globo-kiro.test.ts`
    - Texto exacto de cada invitación, dos invitaciones en un solo globo en el orden del nivel,
      ausencia sin precisión o con todo confirmado, sin recorte a 300 caracteres.
    - _Requirements: 22.1, 22.2, 22.3, 22.5, 22.8_
  - [x]* 13.13 Prueba de contraste de la consola en `src/ui/consola.contraste.test.ts`
    - Lee `tema.css`, resuelve las fichas y comprueba 4,5:1 en el texto y 3:1 en el borde del botón y
      el indicador de foco; sin colores literales en `.kl-consola*`.
    - _Requirements: 10.13_

- [x] 14. Documentación y steering (R26)
  - [x] 14.1 `.kiro/steering/lenguaje-kirologo.md`
    - Filas del mundo 4 (`SUMA`/`PRODUCTO` con dos argumentos, `AZAR n` sembrado con la semilla del
      reto, `ESCRIBE`/`ES`, `ROTULA`/`RO`); paréntesis y tabla de precedencia; ámbito léxico, paso por
      valor y ausencia de asignación con la frase «el mundo 5 hereda esas tres reglas para su
      recursión»; regla de conteo (`AVANZA 100`, `AVANZA 50 + 50`, `AVANZA SUMA 50 50` cuestan 1); regla
      de la línea y lectura de `POLIGONO 6 -80`; los 17 ids nuevos con su causa. Sin «dos o más números».
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.8_
  - [x] 14.2 `.kiro/steering/niveles-y-progresion.md`
    - Entradas de 4.1 a 4.4 como en `mundo-4-parametros.ts`; el 4.2 con `margenLimiteDuro` 6 y su razón
      (referencia 6, rodeo 12, límite 9 con el margen por omisión); el 4.3 renombrado «Polígonos
      encajados» (D15).
    - _Requirements: 26.5, 26.8_
  - [x] 14.3 `.kiro/steering/validacion-geometrica.md`
    - `ESCRIBE` y `ROTULA` no participan en la comparación geométrica; `usaParametros` exige invocar el
      procedimiento; la abstracción exige precisión.
    - _Requirements: 26.6, 26.8_
  - [x] 14.4 `docs/bitacora.md`
    - Una entrada por cada decisión 1 a 10 (decisión, razón, alternativas descartadas) y una sección
      corta con las resoluciones D1 a D21.
    - _Requirements: 26.7, 26.8_
  - [x] 14.5 `.kiro/steering/estructura.md`
    - Añadir `lenguaje/evaluador.ts`, `ui/consola.ts` y `azar/entropia.ts` al árbol del proyecto.
    - _Requirements: 26.8_

- [x] 15. Pruebas de punta a punta, regresión y escaneos
  - [x]* 15.1 Punta a punta de la consola en `src/main.consola.test.ts`
    - En un nivel del mundo 4, `ESCRIBE 360 / 5` desde el editor: la línea `72` en la consola, **un**
      mensaje nuevo en `#anuncios` al terminar con el resumen, y `width`/`height` de cada lienzo y alto
      del editor iguales antes y después.
    - _Requirements: 10.12, 10.14_
  - [x]* 15.2 Punta a punta del mundo 4 en `src/main.mundo-4.test.ts`
    - Escribir un programa que defina y llame a `POLIGONO` con parámetros, ejecutarlo, comprobar las
      tres estrellas del intento, completar 4.1 a 4.4 con tres estrellas cada uno y comprobar con
      `menuMundos.insigniaVisible(4)` que *Generalización* aparece solo tras el último nivel.
    - _Requirements: 27.9, 24.2_
  - [x]* 15.3 Límite duro en `src/main.limite-duro.test.ts`
    - En el 4.3, cuatro `REPITE` a mano no se ejecutan, muestran la cuenta exacta y el contador
      muestra el aviso de bloqueo por texto.
    - _Requirements: 18.7, 25.11_
  - [x]* 15.4 Errores a mitad de camino en `src/main.errores.test.ts`
    - `ESCRIBE 1` seguido de `AVANZA 1 / 0`: `1` queda en la consola, el error en el globo y la estela
      intacta; el editor conserva el programa.
    - _Requirements: 10.6, 25.8_
  - [x]* 15.5 Regresión de tres estrellas en `src/niveles/mundo-4-parametros.regresion.test.ts`
    - **Property 21: Toda referencia del mundo 4 aprueba su nivel con tres estrellas**
    - **Validates: Requirements 8.10, 16.6, 16.9, 17.7, 18.8, 19.5, 20.15, 20.16, 25.1, 27.7**
    - 4.1 una vez; 4.2, 4.3 y 4.4 sobre 200 semillas cada uno, en pruebas separadas con
      `TIMEOUT_TRES_ESTRELLAS` (única fuente del timeout); referencias sin `AZAR`; programa de un solo
      `PARA` con parámetros dentro del presupuesto también obtiene las tres estrellas.
  - [x]* 15.6 Escaneos del repositorio en `src/escaneo-mundo-4.test.ts`
    - Sin `Math.random` ni `Date.now` en `src/` salvo pruebas; sin `eval` ni `new Function`;
      `vite.config.ts` con `base: '/'`; los mensajes nuevos no aparecen como literal fuera de
      `errores.ts`; ningún `presupuestoEstrella` ni `limiteDuro` escrito en `src/niveles/`; ninguna
      lista literal de los seis nombres de operador fuera de `vocabulario.ts` y `evaluador.ts`;
      programas de referencia de los mundos 0 a 3 no definen procedimientos que choquen con el
      vocabulario del mundo 4.
    - _Requirements: 6.2, 8.9, 12.10, 15.2, 20.12, 27.5_

- [x] 16. Checkpoint final - Cierre de la spec
  - Ejecutar `npm ci`, `npm run typecheck`, `npm run build` y `npm test -- --maxWorkers=2`; los cuatro
    deben terminar con código de salida 0 (R27.4).
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y se pueden omitir para un MVP más rápido, pero
  las tareas de **actualizar pruebas existentes** (1.3, 3.7, 5.5, 7.3, 8.5, 10.7, 11.9, 11.10, 13.8) no
  llevan `*` porque sin ellas la suite deja de compilar o de pasar.
- Cada tarea cita los requisitos concretos que cubre; las propiedades 1 a 28 del diseño tienen cada una
  su sub-tarea de prueba (1→7.5, 2→4.4, 3→4.5, 4→4.6, 5→5.7, 6→5.8, 7→5.9, 8→5.10, 9→3.9, 10→3.10,
  11→3.11, 12→3.12, 13→7.6, 14→8.9, 15→5.11, 16→4.7, 17→10.11, 18→10.12, 19→10.13, 20→11.12,
  21→15.5, 22→11.13, 23→11.14, 24→11.15, 25→11.16, 26→11.17, 27→1.5, 28→11.18).
- Los archivos de propiedad llevan sufijo `.propiedad.test.ts` y son independientes, para que las
  tareas de una misma ola no escriban el mismo archivo.
- Los cuatro cambios de `parser.ts` y los cuatro de `interprete.ts` son secuenciales a propósito:
  cada uno edita el mismo archivo.
- Fuera de alcance de esta spec (D18): la importación de `../motor/tortuga.js` desde
  `lenguaje/interprete.ts` ya existe y no se corrige aquí.
- Esta spec no ejecuta código ni cambia de rama durante la fase de planificación: la tarea 0.1 es la
  primera que toca el repositorio.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1"] },
    { "id": 1, "tasks": ["1.1", "1.2", "2.1", "10.6", "11.1", "13.1"] },
    { "id": 2, "tasks": ["1.3", "2.2", "4.1", "10.9", "13.2", "13.3", "13.4"] },
    { "id": 3, "tasks": ["1.4", "1.5", "2.3", "3.1", "4.2", "4.3", "5.1", "7.1", "7.2", "10.1", "10.4", "10.5", "11.2", "13.9", "13.10", "13.11", "13.13"] },
    { "id": 4, "tasks": ["3.2", "5.2", "7.3", "7.4", "8.1", "8.3", "8.4", "10.2", "11.3", "11.4", "11.5"] },
    { "id": 5, "tasks": ["3.3", "5.3", "8.5", "10.3", "10.7", "11.6", "13.5"] },
    { "id": 6, "tasks": ["3.4", "5.4", "8.2", "8.8", "10.10", "11.7", "13.12"] },
    { "id": 7, "tasks": ["3.5", "5.5", "8.6"] },
    { "id": 8, "tasks": ["3.6", "5.6", "8.7"] },
    { "id": 9, "tasks": ["3.7", "3.9", "3.10", "3.11", "3.12", "4.4", "4.5", "4.6", "4.7", "5.7", "5.8", "5.9", "5.10", "5.11", "7.5", "7.6", "8.9", "10.8", "10.11", "10.12", "10.13", "11.8", "13.6"] },
    { "id": 10, "tasks": ["3.8", "11.9", "11.11", "13.7", "14.1", "14.2", "14.3", "14.4", "14.5"] },
    { "id": 11, "tasks": ["11.10", "11.12", "11.13", "11.14", "11.15", "11.16", "11.17", "11.18", "13.8", "15.5", "15.6"] },
    { "id": 12, "tasks": ["15.1", "15.2", "15.3", "15.4"] }
  ]
}
```
