# Implementation Plan: KiroLogo · Spec 00 · Cimientos

## Overview

El plan construye la **rebanada vertical completa** del diseño: el nivel autorado `0.1` jugable de
punta a punta. Se implementa de abajo hacia arriba, siguiendo la dirección de las dependencias que
fija la sección 2.3 del diseño, para que ninguna tarea dependa de algo que se escribe después:

```
andamiaje → vocabulario + errores → azar → lexer/AST/parser → conteo/impresor
→ tortuga → intérprete + guardas → segmentos/encuadre → validador
→ lienzo/personajes/animador → niveles → juego → ui → main.ts → transversales
```

Tres ajustes de orden respecto de la lectura por directorios, cada uno forzado por una dependencia
real y señalado en el grupo correspondiente:

- **`lenguaje/errores.ts` va antes que el lexer y el parser.** Los tres lo consultan para todo texto
  visible al jugador (requisito 10.1).
- **`azar/prng.ts` va antes de las pruebas de propiedades del lenguaje.** Toda la entrada generada de
  las pruebas sale del PRNG del proyecto con semilla explícita (diseño 14.0), y `prng.ts` solo
  necesita `errores.ts`, que es la única arista permitida desde `azar/` (diseño 2.3).
- **`motor/tortuga.ts` va antes que `lenguaje/interprete.ts`.** El intérprete es el único módulo que
  invoca las transformaciones de la tortuga (requisito 11.5) y `EstadoTortuga` viaja dentro de cada
  `Operacion` (diseño 4.1). Esa arista queda declarada como la segunda excepción documentada de la
  regla de dependencias, junto con `azar/` → `lenguaje/errores.ts`, y la prueba de dirección de
  dependencias de la tarea 21.2 la admite explícitamente.

Cada tarea de módulo incluye escribir su archivo `.test.ts` al lado, con los ejemplos y los casos
límite que el requisito fija. Las 26 propiedades de corrección del diseño van en sub-tareas propias,
adyacentes a la tarea del módulo que verifican y sobre el mismo archivo de prueba.

## Tasks

- [x] 1. Andamiaje del proyecto
  - [x] 1.1 Crear `package.json` con versiones fijas y guiones, y generar `package-lock.json`
    - Declarar `name` con el valor `KiroLogo`, `private: true`, `license: "MIT"` y `engines.node` con `">=24"`
    - Declarar como `devDependencies` exactamente `vite` `8.2.2`, `vitest` `5.0.0`, `typescript` `7.0.2`, `fast-check` `4.9.0`, `@types/node` `26.4.1` y `jsdom` `30.0.1`, todas con versión exacta de tres componentes, sin `^`, `~`, `>`, `>=`, `<`, `<=`, `*`, `x`, `latest`, `||` ni `-`
    - Declarar los guiones `dev`, `build`, `preview`, `test` (Vitest en una sola pasada, con `--run`) y `typecheck` (comprobación de tipos sin emitir)
    - Verificar que `.nvmrc` contiene una sola línea con `24` y que satisface el rango de `engines.node`
    - Generar `package-lock.json` con `npm install` y comprobar que `.gitignore` no lo ignora
    - Comprobar con `npm ci` sobre el árbol limpio que la instalación termina sin regenerar el archivo de bloqueo
    - _Requisitos: 1.1, 1.2, 1.3, 1.5, 1.6, 1.10, 1.12, 2.12_

  - [x] 1.2 Crear `tsconfig.json` estricto y `vite.config.ts`
    - Declarar en `tsconfig.json` `strict`, `noUncheckedIndexedAccess` y `noImplicitOverride` en `true`, y `"lib": ["ES2023", "DOM"]` para que los tipos del DOM estén disponibles sin los globales (diseño 7.2)
    - Incluir en la comprobación de tipos los archivos con sufijo `.test.ts` y no emitir archivos de salida
    - Declarar en `vite.config.ts` `base: '/'` y la configuración de Vitest con el entorno `node` por omisión, de modo que `document`, `window` y `OffscreenCanvas` estén ausentes salvo en los archivos que declaren `// @vitest-environment jsdom`
    - _Requisitos: 1.4, 1.5, 1.14, 2.1, 29.8, 29.10_

  - [x] 1.3 Crear `index.html` y las dos hojas de estilo del tema
    - Declarar el documento con `lang="es"`, el título del juego y **una única** región `aria-live` con `aria-live="polite"` que no recibe foco, más los contenedores de las cuatro capas del lienzo, del editor con su canaleta, del panel de comandos, de los controles y del globo de Kiro, en el orden visual de izquierda a derecha y de arriba abajo
    - Referenciar `src/main.ts` como módulo; el arranque real llega en la tarea 19.1, así que hasta entonces la verificación de este grupo es `npm test` y `npm run typecheck`, no `npm run build`
    - Crear `src/estilos/tema.css` como **única** fuente de color y grosor: fondo del lienzo, líneas de cuadrícula de 20 y de 100 unidades, estela del jugador, estela de referencia, los tres estados del diff, la tortuga con Kiro, el lápiz, el texto, los controles y el indicador de foco, con valores de reserva para cada trazo
    - Crear `src/estilos/pantalla.css` con la disposición de la pantalla y el indicador de foco de 2 píxeles o más que rodea el elemento completo
    - No incluir ningún archivo `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` ni `.ico` dentro de `src/`
    - _Requisitos: 1.8, 1.9, 12.5, 12.8, 13.10, 28.3, 28.6, 28.7, 28.8_

  - [x] 1.4 Crear `amplify.yml` y `README.md`
    - Declarar en `amplify.yml` las fases `preBuild` con `nvm install "$(cat .nvmrc)"`, `nvm use "$(cat .nvmrc)"`, `node -v` y `npm ci` —sin ningún número de versión literal y sin `npm install`—, `build` con `npm run build`, `artifacts.baseDirectory` igual a `dist` con `files: ['**/*']`, y `cache.paths` con `node_modules/**/*`
    - Escribir `README.md` en español con el nombre `KiroLogo`, la descripción del juego, el comando literal para levantar el entorno de desarrollo, el comando literal para ejecutar las pruebas, y enlaces relativos a `.kiro/steering/` y a `docs/` que resuelven a rutas existentes
    - _Requisitos: 1.7, 2.4, 2.5, 2.6, 2.7_

- [x] 2. Vocabulario y catálogo de errores, las dos fuentes únicas de verdad
  - [x] 2.1 Implementar `src/lenguaje/vocabulario.ts` y su prueba
    - Declarar `TipoArgumento`, `Aridad`, `Mundo`, `EntradaVocabulario`, `ResultadoBusqueda` y la constante `VOCABULARIO` con la firma de la sección 3.1 del diseño
    - Declarar las seis entradas ejecutables del mundo 0 con su nombre largo, abreviatura, aridad, tipos de argumento, descripción en español de una línea de 120 caracteres o menos y ejemplo de uso: `AVANZA`/`AV`, `RETROCEDE`/`RE`, `GIRADERECHA`/`GD`, `GIRAIZQUIERDA`/`GI`, `CENTRO`/`CE` y `BORRAPANTALLA`/`BP`
    - Declarar las entradas de los mundos 1 a 5 con `ejecutable: false`, según la tabla del diseño 3.1: `REPITE`/`RP`; `SUBELAPIZ`/`SL`, `BAJALAPIZ`/`BL`, `PONCOLOR`/`PC`, `PONGROSOR`/`PG`, `RELLENA`/`RL`, `PARA` con `aridad: 'variable'`, `FIN`, `OCULTATORTUGA`/`OT`, `MUESTRATORTUGA`/`MT`; `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE`, `RESTO`, `AZAR`, `ESCRIBE`/`ES`, `ROTULA`/`RO`; `SI`, `SINO`, `ALTO`, `DEVUELVE`/`DV`
    - Implementar `normalizarPalabra` con tabla explícita de reemplazo —mayúsculas y `á é í ó ú ü` → `A E I O U U`— preservando `ñ` como `Ñ` y sin usar `normalize('NFD')`
    - Implementar `buscarComando` comparando contra **todas** las entradas sin filtrar por mundo y devolviendo un resultado explícito de palabra no declarada, sin excepción y sin elegir mensaje; e implementar `comandosDelMundo` devolviendo las entradas de mundo menor o igual siempre en el orden de declaración
    - Escribir `vocabulario.test.ts` con la tabla del mundo 0 completa, las entradas bloqueadas, `AÑO` distinto de `ANO`, la palabra no declarada, y la prueba de colisiones que recalcula los 28 nombres largos y las 17 abreviaturas tras normalizar y falla nombrando las dos entradas en conflicto y el texto que comparten
    - Dejar el módulo como la única fuente de nombres largos, abreviaturas, aridades y mundos de desbloqueo, de modo que el lexer, el parser, el panel de comandos y el catálogo de errores lo consulten en lugar de mantener listas propias
    - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 2.2 Implementar `src/lenguaje/errores.ts` con sus entradas y textos, y su prueba
    - Declarar `IdError` con los 38 identificadores de la sección 6.1 del diseño, `SeveridadError`, `ErrorKiroLogo` con `id`, `severidad`, `mensaje`, `linea` y `columna`, el mapa `ParametrosPorError` con los parámetros exigidos por cada id, y `crearError` con parámetros tipados
    - Escribir el texto de cada entrada según la tabla del diseño 6.2, en español, en una sola línea de 200 caracteres o menos, con tildes y con `¿` cuando pregunta, y en segunda persona; incluidos los tres textos de las guardas con su forma fija
    - Declarar la variante de `guardaRecursion` que nombra solo el número de línea, para cuando el nodo de invocación no declara nombre, de modo que nunca quede un hueco vacío
    - Devolver el fallo `solicitudDeErrorInvalida` con severidad `programacion` ante un id no declarado o un parámetro ausente o de texto vacío, sin devolver ningún texto con hueco ni marcador de plantilla
    - Escribir `errores.test.ts` comparando carácter por carácter, incluidas tildes y `¿`, al menos un caso por cada id de `IdError` con sus parámetros rellenados, verificando que dos invocaciones con los mismos parámetros devuelven el mismo texto, y fallando nombrando el id que quede sin caso
    - _Requisitos: 10.1, 10.6, 10.7, 10.8, 10.11_

  - [x] 2.3 Implementar la distancia de edición, la tabla de Logo en inglés y la precedencia de los cinco casos
    - Implementar Levenshtein clásico por programación dinámica sobre las cadenas ya normalizadas, comparando contra los nombres largos y las abreviaturas, con umbral 2 para candidatos de 4 caracteres o más y 1 para los de 3 o menos
    - Desempatar por menor distancia, luego nombre largo antes que abreviatura, luego orden de declaración del vocabulario
    - Declarar la tabla cerrada de Logo en inglés de la sección 6.4 del diseño, con las 28 filas, dando siempre el equivalente por su nombre largo
    - Implementar la resolución de una palabra que no se puede ejecutar aplicando **exactamente un** mensaje en el orden: `comandoBloqueado`, `comandoEnIngles`, `palabraDesconocidaConSugerencia`, `comandoBloqueadoCercano`, `palabraDesconocidaSinSugerencia`
    - Ampliar `errores.test.ts` con `AVANSA` → sugerencia `AVANZA`, `FD` → `AVANZA`, `RT` que no debe sugerir `RE`, `REPITE` bloqueado del mundo 1, `REPIT` como bloqueado cercano, `PINTA` sin sugerencia, `XY` sin sugerencia por el umbral corto, y la verificación de que ninguna clave de la tabla de inglés coincide con un nombre largo ni con una abreviatura del vocabulario
    - _Requisitos: 10.2, 10.3, 10.4, 10.5, 10.9, 10.10_

- [x] 3. Azar determinista con semilla explícita
  - [x] 3.1 Implementar `src/azar/prng.ts` y su prueba de ejemplos
    - Declarar `SEMILLA_MINIMA`, `SEMILLA_MAXIMA` (4 294 967 295), la interfaz `Prng` y `crearPrng`
    - Implementar mulberry32 con estado de 32 bits propio de la instancia, sin ningún estado a nivel de módulo, y `siguiente()` devolviendo un valor en `[0, 1)`
    - Implementar `entero(min, max)` con los dos extremos incluidos, `elegir(lista)` devolviendo el elemento y no su posición, y `multiplo(min, max, paso)` siempre divisible por el paso y con los dos extremos incluidos
    - Reportar `rangoInvalido`, `listaVacia`, `pasoInvalido` y `rangoSinMultiplo` del catálogo nombrando los argumentos recibidos, **sin devolver valor y sin avanzar el estado**, de modo que la secuencia siguiente sea la misma que si esa petición no se hubiera hecho
    - Escribir `prng.test.ts` con la semilla 0 y la semilla máxima, los extremos de cada rango, y los cuatro casos de argumento inválido comprobando que el estado no avanzó
    - _Requisitos: 17.1, 17.3, 17.4, 17.8_

  - [x] 3.2 Escribir la prueba de propiedad del PRNG
    - **Property 19: Determinismo, rango y cobertura del PRNG**
    - **Valida: Requisitos 17.2, 17.4**

  - [x] 3.3 Implementar `src/azar/codigo-semilla.ts` y su prueba de ejemplos
    - Declarar `ALFABETO` con los 31 símbolos `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, `LARGO_CODIGO` igual a 7, `codificar` y `decodificar` con resultados explícitos
    - Implementar la conversión posicional en base 31 con relleno a la izquierda con `A`, de modo que la semilla 0 sea `AAAAAAA` y todos los códigos midan 7 caracteres
    - Descartar espacios de los extremos y convertir a mayúsculas antes de validar
    - Devolver las tres causas de invalidez con su propio mensaje del catálogo —longitud distinta de 7, símbolo fuera del alfabeto, valor decodificado fuera del dominio— sin devolver semilla, sin excepción y sin modificar nada; y reportar `semillaFueraDeDominio` al codificar un valor no entero o fuera del dominio
    - Escribir `codigo-semilla.test.ts` con la semilla 0, la máxima, `  ab2cdef ` equivalente a `AB2CDEF`, y las tres causas de invalidez con su texto exacto
    - _Requisitos: 17.6, 17.7, 17.9, 17.10_

  - [x] 3.4 Escribir la prueba de propiedad del código de semilla
    - **Property 18: Ida y vuelta de la semilla y de su código**
    - **Valida: Requisitos 17.5, 17.6, 17.10, 29.5**

  - [x] 3.5 Escribir los cuatro generadores de entrada compartidos por las pruebas de propiedades
    - Crear `src/azar/generadores-prueba.test.ts` con los cuatro generadores de la sección 14.0 del diseño, exportados para que los demás archivos de prueba los importen: `generarPrograma(prng, maximoInstrucciones)`, `generarProgramaExtendido(prng, profundidad)`, `generarFigura(prng)` y `generarEstadoTortuga(prng)`
    - Sembrar todo el azar con `crearPrng` y semillas explícitas, sin `Math.random` y sin el generador interno de fast-check; los generadores de fast-check se siembran con `fc.assert(..., { seed })`
    - Incluir en el propio archivo una prueba de auto-comprobación barata: cada generador con una semilla fija produce una salida bien formada y repetible, para que el archivo sea un archivo de prueba legítimo y su importación desde otros no encarezca la suite
    - Nota para la tarea 21.3: este es el **único** archivo de ayudas compartidas de `src/`, y la prueba de estructura debe admitirlo de forma explícita, porque `estructura.md` no declara ninguna ruta para ayudas de prueba
    - `generarPrograma` cubre los seis comandos del mundo 0 y sus abreviaturas, con argumentos sin signo de 0 a 999 999 y hasta 3 decimales; `generarProgramaExtendido` añade los nueve nodos reservados anidados; `generarFigura` produce polilíneas encuadradas con longitudes múltiplas de 20 entre 40 y 200 y ángulos derivables; `generarEstadoTortuga` usa posiciones en `[−600, 600]²`, a propósito más ancho que el lienzo
    - _Requisitos: 6.7, 17.3_

- [x] 4. Lexer, AST y parser
  - [x] 4.1 Implementar `src/lenguaje/lexer.ts` con el tipo `Token` y su prueba de ejemplos
    - Declarar `TipoToken`, `TokenBase` y la unión `Token` de la sección 3.2 del diseño, con `valor` normalizado, `textoOriginal` tal como se escribió, `linea` y `columna` desde 1
    - Declarar `ResultadoLexico` y `analizarLexico(texto)` como autómata de un solo recorrido sin retroceso, según la tabla del diseño 3.3
    - Aceptar letras del alfabeto español incluidas `á é í ó ú ü ñ Ñ`, cerrando cada palabra con `buscarComando` para decidir entre `comando` e `identificador`
    - Aceptar números con coma o punto como separador decimal, sin signo, de 0 a 999 999, un solo separador, al menos un dígito a cada lado y hasta 4 decimales, conservando el separador escrito en `textoOriginal`
    - Emitir `corchete_abre`, `corchete_cierra`, `palabra` para `"naranja` y `parametro` para `:largo`, aunque el mundo 0 no los use, con el valor sin la comilla ni los dos puntos
    - Descartar desde `#` hasta el fin de línea, reconociendo `\n` y `\r\n`, conservando la numeración de línea posterior
    - Acumular errores del catálogo sin detenerse: `caracterNoValido`, `numeroMalFormado`, `comillaSinPalabra` y `parametroSinNombre`, descartando el fragmento y continuando, y devolverlos ordenados por línea y luego por columna junto con los tokens reconocidos
    - Escribir `lexer.test.ts` con los seis comandos en nombre largo y abreviatura, texto vacío, texto de solo comentarios, `avanza`/`AVANZA`/`Avanzá` con el mismo valor normalizado y distinto texto original, y los cuatro casos de error con su posición
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [x] 4.2 Escribir la prueba de propiedad de la normalización de la entrada
    - **Property 1: Invariancia de escritura de la entrada**
    - **Valida: Requisitos 3.6, 4.2, 4.3**

  - [x] 4.3 Escribir la prueba de propiedad del separador decimal
    - **Property 2: Invariancia del separador decimal**
    - **Valida: Requisitos 4.4**

  - [x] 4.4 Escribir la prueba de propiedad de comentarios y espacio en blanco
    - **Property 3: Los comentarios y el espacio en blanco no existen para el lexer**
    - **Valida: Requisitos 4.5**

  - [x] 4.5 Implementar `src/lenguaje/ast.ts` con los dos nodos vivos y los nueve reservados
    - Declarar `NodoBase`, `NumeroLiteral` e `InvocacionComando` como los tipos vivos de esta spec
    - Declarar los nueve tipos reservados con la forma exacta de la sección 3.4 del diseño: `Repeticion`, `DefinicionProcedimiento`, `InvocacionProcedimiento`, `ReferenciaParametro`, `ExpresionAritmetica` —con los operadores `+ - * / = < >` en un solo tipo—, `CondicionalUnaRama`, `CondicionalDosRamas`, `Interrupcion` y `DevolucionValor`
    - Acompañar cada uno de los nueve con un comentario que nombre la capacidad del lenguaje y el número de la spec que la implementa
    - Declarar las uniones `Expresion`, `Instruccion` y `Nodo`, y el nodo raíz `Programa`
    - Sin archivo de prueba propio: se verifica desde las pruebas del parser, del conteo y del análisis de abstracción
    - _Requisitos: 5.2, 5.3_

  - [x] 4.6 Implementar `src/lenguaje/parser.ts` y su prueba de ejemplos
    - Declarar `OpcionesAnalisis` con el mundo del nivel en curso como parámetro explícito, `ResultadoSintactico` con `programa: Programa | null`, y `analizar(tokens, opciones)`
    - Implementar el descenso recursivo de una pasada que produce un nodo por comando escrito, con el nombre largo del vocabulario, su argumento numérico cuando la aridad es 1, y la línea y la columna de su primer token; admitiendo la lista vacía
    - Resolver cada palabra en tres pasos —`buscarComando`, ¿existe?, ¿su mundo es menor o igual al mundo en curso?— y delegar en el catálogo la elección del mensaje para toda palabra que no se puede ejecutar
    - Reportar `comandoBloqueado`, `argumentoFaltante` con el ejemplo de uso del vocabulario, `argumentoDeTipoEquivocado`, `corcheteSinCerrar` nombrando el corchete de apertura más externo pendiente, `corcheteDeMas`, y `corcheteInesperado`, `parametroInesperado`, `palabraInesperada` y `numeroInesperado` donde se esperaba un comando
    - Implementar la recuperación por sincronización: al reportar un error descarta los tokens restantes de la instrucción y reanuda en el siguiente token de tipo `comando`
    - Devolver `programa: null` cuando hay al menos un error, con hasta 20 errores ordenados por línea y luego por columna, descartando los de línea mayor, sin lanzar excepción
    - Escribir `parser.test.ts` con un nodo por comando en orden, la lista vacía de un texto con solo comentarios, los nueve tipos reservados declarados y no producidos por ninguna regla, y un caso por cada situación de error incluida la recuperación por sincronización
    - _Requisitos: 5.1, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_

  - [x] 4.7 Escribir la prueba de propiedad del análisis de errores
    - **Property 4: El análisis de errores es determinista, ordenado y acotado**
    - **Valida: Requisitos 4.9, 5.8, 5.9**

  - [x] 4.8 Escribir la prueba de propiedad de la precedencia del catálogo
    - **Property 12: Precedencia de los cinco casos del catálogo**
    - **Valida: Requisitos 10.2, 10.3, 10.4, 10.5, 10.9, 10.10**

- [x] 5. Conteo e impresor
  - [x] 5.1 Implementar `src/lenguaje/conteo.ts` y su prueba de ejemplos
    - Declarar `ResultadoConteo` y `contarInstrucciones(programa)` como la **única** función de conteo del proyecto
    - Implementar el recorrido en profundidad con la tabla de la sección 3.7 del diseño: 1 por `invocacionComando` y por `invocacionProcedimiento`; 1 más el cuerpo escrito por `repeticion`, sin multiplicar por las iteraciones; 1 más las listas por los dos condicionales; 0 por la cabecera de una definición más su cuerpo contado una sola vez; 1 por `interrupcion` y por `devolucionValor`; 0 por `numeroLiteral`, `referenciaParametro` y `expresionAritmetica`
    - Reportar `nodoDesconocidoEnConteo` nombrando el discriminante recibido, sin devolver conteo parcial
    - Escribir `conteo.test.ts` con el equivalente de `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]` → 5, la definición de `CUADRADO` con dos invocaciones → 5, el programa vacío → 0, dos textos que difieren solo en comentarios, líneas vacías, sangría y reparto entre líneas devolviendo el mismo entero, y el discriminante fuera de la unión
    - Terminar la prueba en 50 milisegundos o menos para un programa de 200 instrucciones y 20 niveles de anidación
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8, 9.10_

  - [x] 5.2 Escribir la prueba de propiedad de estabilidad del conteo y forma de los mensajes
    - **Property 11: Estabilidad e inmutabilidad del conteo, y forma de los mensajes del catálogo**
    - **Valida: Requisitos 9.1, 9.9, 10.6, 10.8**
    - Escribe en `src/lenguaje/conteo.test.ts` y en `src/lenguaje/errores.test.ts`

  - [x] 5.3 Implementar `src/lenguaje/impresor.ts` y su prueba de ejemplos
    - Declarar `ResultadoImpresion` e `imprimir(programa)`
    - Escribir el nombre largo en mayúsculas del vocabulario, nunca la abreviatura; una instrucción por línea; un espacio entre el nombre y cada argumento; sangría de dos espacios por nivel de anidación; cada línea con un único `\n` y sin espacios al final
    - Escribir los números con punto decimal, sin `+`, sin ceros a la derecha del último decimal significativo, usando la representación más corta que recupera el mismo valor
    - Reportar `nodoNoImprimible` ante un nodo reservado o un comando que el vocabulario no declara, sin devolver texto parcial
    - Escribir `impresor.test.ts` con `av 100` → `AVANZA 100`, `av 10,50` → `AVANZA 10.5`, y los dos casos de error
    - _Requisitos: 6.1, 6.2, 6.6_

  - [x] 5.4 Escribir la prueba de propiedad de ida y vuelta entre parser e impresor
    - **Property 5: Ida y vuelta entre parser e impresor**
    - **Valida: Requisitos 6.3, 5.1, 6.1, 6.2, 29.5**
    - Sobre al menos 200 programas construidos con el PRNG a partir de 200 semillas explícitas, de 0 a 50 instrucciones, que en conjunto cubran los seis comandos del mundo 0 y sus abreviaturas

  - [x] 5.5 Escribir la prueba de propiedad de idempotencia del formato
    - **Property 6: Idempotencia del formato y estabilidad del conteo bajo la ida y vuelta**
    - **Valida: Requisitos 6.4, 6.5, 6.7**

- [x] 6. Punto de control — capa de lenguaje sin ejecución
  - Ejecutar `npm test` y `npm run typecheck`; asegurarse de que todas las pruebas pasan y preguntar al usuario si surgen dudas

- [x] 7. Modelo puro de la tortuga
  - [x] 7.1 Implementar `src/motor/tortuga.ts` y su prueba de ejemplos
    - Declarar `Punto`, `EstadoTortuga` con `posicion`, `rumbo`, `lapizAbajo` y `visible`, y `ESTADO_INICIAL` en `(0, 0)`, rumbo 0, lápiz abajo y visible
    - Declarar `ResultadoTortuga` e implementar `desplazar`, `girar`, `alCentro`, `conLapiz`, `conVisibilidad` y `normalizarRumbo`
    - Implementar la geometría de la sección 7.1 del diseño con el rumbo en grados y la conversión a radianes confinada dentro del módulo: rumbo 0 aumenta `y`, 90 aumenta `x`, 180 disminuye `y`, 270 disminuye `x`, y el desplazamiento hacia atrás invierte el sentido
    - Reducir el rumbo a `[0, 360)` con tolerancia de 1e−6, de modo que 360 y sus múltiplos den 0, girar 450 a la derecha desde 0 dé 90 y girar 90 a la izquierda desde 0 dé 270
    - Devolver un objeto nuevo en cada transformación y dejar el recibido intacto **incluso** con distancia 0 o ángulo 0, sin ningún camino de retorno del mismo objeto por optimización
    - Devolver posiciones fuera de `[−400, 400]` tal cual, sin recortar y sin error; y devolver un resultado explícito de argumento inválido ante una distancia o un ángulo no finito, sin producir coordenadas ni rumbos no finitos y sin lanzar
    - Escribir `tortuga.test.ts` con el estado inicial, las cinco transformaciones, los rumbos 0, 90, 180, 270, 360, 450 y negativos, la comparación por identidad que detecta mutación accidental, y la ausencia de referencias a `document`, `window` y a cualquier API de Canvas
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 7.2 Escribir la prueba de propiedad de la tortuga
    - **Property 13: La tortuga es pura y su geometría es exacta**
    - **Valida: Requisitos 11.2, 11.4, 11.6**

- [x] 8. Intérprete como generador de operaciones, y las tres guardas
  - [x] 8.1 Implementar `src/lenguaje/interprete.ts` con la unión `Operacion` y el núcleo de ejecución
    - Declarar `SentidoGiro`, `OperacionBase` con `paso`, `linea`, `profundidad`, `estadoAntes` y `estadoDespues`, y la unión `Operacion` con los seis casos `mover`, `girar`, `lapiz`, `visibilidad`, `limpiar` y `reubicar` de la sección 4.2 del diseño
    - Declarar `TipoGuarda`, `LimitesEjecucion`, `LIMITES_PREDETERMINADOS` (200 000 pasos, 100 niveles, 5 000 ms, 1 000 pasos entre mediciones), `OpcionesEjecucion` con `estadoInicial`, `comandosPermitidos`, `semilla`, `ahora` y `limites`, y `ResultadoEjecucion`
    - Implementar `ejecutar` como función generadora que emite una `Operacion` por instrucción y suspende hasta que el consumidor pide la siguiente, y que devuelve el arreglo completo junto con la guarda activada y el error
    - Implementar el núcleo con **pila explícita de marcos**, no recursión de JavaScript, con `Marco = { instrucciones, indice, nombre, lineaInvocacion }` y la profundidad como dato observable
    - Ejecutar `definicionProcedimiento` e `invocacionProcedimiento` sin parámetros ni valor de retorno (decisión D6), y terminar con `nodoNoImplementado` en los otros siete nodos reservados
    - Implementar la semántica de los seis comandos del mundo 0 según la tabla del diseño 4.4, con `CENTRO` y `BORRAPANTALLA` conservando el lápiz y la visibilidad, y `BORRAPANTALLA` descartando los segmentos acumulados
    - Emitir la operación `mover` también cuando la distancia es 0, y registrar `desde` y `hasta` tal como se calcularon aunque queden fuera del cuadrado lógico
    - Resolver cada invocación consultando únicamente `comandosPermitidos`, sin lista propia ni valor global, y reportar `comandoNoPermitido` conservando sin modificar las operaciones ya emitidas
    - Crear la instancia de PRNG al inicio de cada ejecución con la semilla recibida, y usar `ahora()` solo para comparar contra el límite de tiempo
    - Escribir `interprete.test.ts` con una operación por comando para los seis del mundo 0 —cantidad, tipo, estados antes y después y número de línea—, el programa sin instrucciones, el comando no permitido y el nodo reservado
    - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 29.13_

  - [x] 8.2 Escribir la prueba de propiedad de la estructura de la secuencia de operaciones
    - **Property 7: Estructura de la secuencia de operaciones**
    - **Valida: Requisitos 7.2, 7.3, 7.9**

  - [x] 8.3 Escribir la prueba de propiedad de serialización de una operación
    - **Property 8: Ida y vuelta de serialización de una operación**
    - **Valida: Requisitos 7.5**

  - [x] 8.4 Implementar las tres guardas de ejecución con su precedencia y sus pruebas de límite
    - Implementar `comprobarGuardas` como **único** punto de decisión, que prueba las tres condiciones en el orden fijo pasos → recursión → tiempo y devuelve la primera
    - Comprobar la guarda de pasos justo antes de emitir cada operación, deteniéndose sin emitir la número 200 001, contando desde 1 y sin descontar las `limpiar` ni las emitidas antes de ellas
    - Comprobar la guarda de recursión en `entrarMarco`, antes de ejecutar la primera instrucción del nuevo nivel, rechazando el nivel 101 y nombrando el procedimiento culpable y la línea de la invocación
    - Comprobar la guarda de tiempo con la fuente monótona inyectada al menos una vez cada 1 000 operaciones y una vez antes de cada `entrarMarco`, activándose con **más** de 5 000 ms y no con exactamente 5 000
    - Terminar el generador normalmente, sin lanzar, devolviendo las operaciones emitidas en orden con `paso` consecutivo desde 0, ninguna a medias, ninguna modificada, y el resultado explícito con la guarda activada y el error del catálogo
    - Poner en cero el contador de pasos, la profundidad y el origen de la medición de tiempo al comenzar cada ejecución
    - Ampliar `interprete.test.ts` con dos programas sintéticos armados con nodos del AST por guarda: 200 000 y 200 001 operaciones, 100 y 101 niveles de invocación anidados con una definición que se invoca a sí misma, y una `ahora` falsa que devuelve exactamente 5 000 y 5 001 ms; comprobando en cada caso el número de operaciones devueltas y el texto exacto del mensaje del catálogo
    - _Requisitos: 8.1, 8.2, 8.3, 8.4, 8.7, 8.8, 8.9, 8.10_

  - [x] 8.5 Escribir la prueba de propiedad de las guardas
    - **Property 10: Las guardas devuelven una ejecución parcial bien formada, con precedencia fija y sin arrastre**
    - **Valida: Requisitos 8.4, 8.9, 8.10**

  - [x] 8.6 Escribir la prueba de propiedad de determinismo del intérprete
    - **Property 9 (parte A, intérprete): Determinismo del pipeline completo**
    - **Valida: Requisitos 7.6**
    - La parte B, sobre dos resoluciones del reto, se escribe en la tarea 16.2

- [x] 9. Punto de control — ejecución y guardas
  - Ejecutar `npm test` y `npm run typecheck`; asegurarse de que todas las pruebas pasan y preguntar al usuario si surgen dudas

- [x] 10. Extracción de segmentos y encuadre
  - [x] 10.1 Implementar `src/motor/segmentos.ts` y su prueba de ejemplos
    - Declarar `Segmento` con `desde`, `hasta`, `paso` y `linea`, y `extraerSegmentos(operaciones)` como un solo recorrido en orden de `paso`
    - Aportar un segmento por cada `mover` con el lápiz abajo y longitud mayor o igual que 0.0001, copiando los puntos tal como la operación los registró, sin recortar al cuadrado de 800 × 800 y sin redondear
    - Excluir los `mover` con el lápiz arriba y los de longitud menor que 0.0001, y no aportar nada por `girar`, `reubicar`, `lapiz` ni `visibilidad`
    - Descartar en cada `limpiar` todos los segmentos acumulados y continuar el recorrido, conservando en los posteriores su `paso` y su `linea` originales sin renumerar
    - Devolver una lista vacía sin error cuando la secuencia está vacía o ninguna operación cumple la condición, y terminar en 100 milisegundos o menos para 200 000 operaciones
    - Escribir `segmentos.test.ts` con un `mover` con lápiz abajo y otro con lápiz arriba, varios `limpiar`, un `limpiar` final sin movimientos posteriores, la longitud por debajo del umbral, y la conservación de `paso` y `linea` tras un `limpiar`
    - _Requisitos: 15.1, 15.2, 15.3, 15.8_

  - [x] 10.2 Escribir la prueba de propiedad de extracción de segmentos
    - **Property 16 (parte A, segmentos): Extracción de segmentos, encuadre y veredicto geométrico**
    - **Valida: Requisitos 15.1, 15.2, 15.3**

  - [x] 10.3 Implementar `src/motor/encuadre.ts` y su prueba de ejemplos
    - Declarar `CajaEnvolvente` con los cuatro límites, `ancho`, `alto` y `centro`, `ResultadoEncuadre` como unión discriminada por `hayCaja`, y `calcularEncuadre(segmentos)`
    - Calcular los límites como mínimo y máximo de cada coordenada entre los puntos de partida y de llegada, con `ancho` y `alto` mayores o iguales que 0, en 50 milisegundos o menos para 500 segmentos y sin modificar la lista recibida
    - Devolver en `noEncuadrada` **cuáles** de los cuatro límites caen fuera de `[−400, 400]`, entendiendo que exactamente −400 o 400 no cuenta como fuera
    - Devolver `degenerada` cuando el ancho o el alto es menor que 200 unidades, entendiendo que exactamente 200 no cuenta, calculándolo para cualquier lista y de forma independiente del indicador anterior
    - Devolver `hayCaja: false` con `degenerada: true` para una lista sin segmentos, sin límites en 0 y sin valores no finitos
    - Escribir `encuadre.test.ts` con la caja de una figura conocida, los casos de exactamente −400, 400 y 200 que no disparan las banderas, los dos indicadores verdaderos a la vez, y la lista vacía
    - _Requisitos: 15.4, 15.5, 15.6, 15.7, 15.8_

  - [x] 10.4 Escribir la prueba de propiedad del encuadre
    - **Property 16 (parte B, encuadre): Extracción de segmentos, encuadre y veredicto geométrico**
    - **Valida: Requisitos 15.4, 15.5, 15.6, 15.8**

- [x] 11. Validador geométrico
  - [x] 11.1 Implementar la máscara, el mapeo de coordenadas y el trazado de segmentos
    - Declarar en `src/motor/validador.ts` el tipo `Mascara` como `Uint8Array` de 640 000 posiciones con índice `iy·800 + ix`, y la constante `LADO` igual a 800, sin `OffscreenCanvas`, sin `document` y sin ninguna API de Canvas
    - Implementar el mapeo `ix = ⌊x + 400⌋`, `iy = ⌊400 − y⌋`, con la convención de celda de la sección 9.3 del diseño y el centro del arreglo en `(399.5, 399.5)`
    - Implementar el trazado DDA con paso de 0.5 unidades lógicas a lo largo del segmento, encendiendo la celda de cada muestra y siempre las dos celdas de los extremos, con trazo de un píxel de ancho
    - Descartar las posiciones fuera del arreglo sin escribir fuera de sus límites y sin lanzar, incluidas `x = 400` y `y = −400` que mapean al índice 800
    - Escribir en `validador.test.ts` las pruebas del mapeo en las cuatro esquinas y en el origen, la ausencia de huecos en pendientes casi horizontales y casi verticales, y el segmento parcialmente fuera del arreglo
    - _Requisitos: 16.2, 16.15_

  - [x] 11.2 Implementar la dilatación separable del disco de 8 píxeles y verificarla contra fuerza bruta
    - Descomponer el disco `dx² + dy² ≤ 64` en las **17 corridas horizontales** con semianchos `w = [0, 3, 5, 6, 6, 7, 7, 7, 8, 7, 7, 7, 6, 6, 5, 3, 0]` para `dy` de −8 a 8
    - Implementar `Dilatar_corrida` en O(1) por celda con sumas de prefijo por fila, y la dilatación como el `OR` de las 17 corridas desplazadas, con coste fijo de unos 11.5 M de operaciones por máscara e independiente de la tinta
    - Ampliar `validador.test.ts` con la prueba que compara la dilatación separable, posición por posición, contra una implementación por **fuerza bruta** con el elemento estructurante circular sobre máscaras pequeñas, para fijar que la tolerancia sigue siendo 8 píxeles euclidianos exactos
    - Incluir casos con posiciones encendidas pegadas a los cuatro bordes del arreglo, donde el recorte de las sumas de prefijo es el que puede fallar
    - _Requisitos: 16.3_

  - [x] 11.3 Implementar el IoU, el exceso de trazo y las tres regiones
    - Calcular `coincidencia = Ad ∩ Bd`, `exceso = Bd \ Ad` y `falta = Ad \ Bd`, el IoU como `|coincidencia| / |Ad ∪ Bd|` y el exceso como `|exceso| / |Ad| · 100`
    - Definir el IoU como 0 cuando la unión o la máscara objetivo no tiene ninguna posición encendida, en lugar de una división indefinida
    - Conceder la coincidencia geométrica si y solo si el IoU es 0.90 o mayor **y** el exceso es 5 % o menor, comparando sin redondear y reservando el redondeo a la presentación
    - Elegir el motivo con precedencia fija: `excesoDeTrazo` antes que `iouInsuficiente`
    - Contar en el IoU y en el exceso únicamente las posiciones dentro del arreglo
    - Ampliar `validador.test.ts` con el exceso que niega la coincidencia aunque el IoU alcance el umbral, y con la estela del jugador vacía que devuelve IoU 0, exceso 0 %, la región de falta igual al objetivo dilatado y las otras dos vacías
    - _Requisitos: 16.4, 16.5, 16.6, 16.14, 16.16_

  - [x] 11.4 Implementar la búsqueda del mejor giro y su prueba de rendimiento
    - Dilatar cada máscara **una sola vez** y girar la ya dilatada, aprovechando que el disco es isótropo
    - Construir el índice de posiciones encendidas de `Ad` como un par de `Int16Array` con el desplazamiento de cada posición respecto del centro de giro, y derivar unión y exceso de la intersección con `|Ad ∪ Bd| = |Ad| + |Bd| − |coincidencia|` y `|exceso| = |Bd| − |coincidencia|`
    - Implementar el barrido de los 360 ángulos enteros sobre ese índice, con seno y coseno calculados una vez por ángulo
    - Implementar el nivel grueso: cuando `|Ad|` supera `UMBRAL_BUSQUEDA_GRUESA = 120 000`, barrer sobre un submuestreo de factor 4 —200 × 200, celda encendida si alguna de sus 16 celdas finas lo está—, usándolo solo para **ordenar** los ángulos y nunca para decidir
    - Implementar el afinado exacto de los 8 mejores ángulos según la estimación **más el ángulo 0 siempre**, materializando `Ad` girada por **mapeo inverso** en un búfer auxiliar para no dejar huecos de redondeo, y ganando el de mayor IoU exacto con desempate por menor ángulo
    - Derivar el IoU, el exceso, el ángulo y las tres regiones devueltos del afinado exacto del ángulo ganador, nunca de la estimación del barrido
    - Ampliar `validador.test.ts` con la prueba de rendimiento del requisito 16.13: dos figuras de hasta 500 segmentos con rotación libre, resultado en 2 segundos o menos en la peor de tres mediciones consecutivas en Node; y con la comprobación de que comparar un conjunto contra sí mismo gana en el ángulo 0 con IoU 1.0 exacto
    - _Requisitos: 16.8, 16.10, 16.13_

  - [x] 11.5 Implementar `validar` con la normalización del nivel y los casos negativos
    - Declarar `Veredicto` con `coincide`, `iou`, `excesoPorcentaje`, `motivo`, `traslacion`, `angulo`, las dos máscaras dilatadas y las tres regiones, y la firma `validar(segmentosJugador, segmentosObjetivo, normalizacion)`
    - Con la traslación `libre`, trasladar **cada** figura antes de rasterizar para que el centro de su caja envolvente coincida con el centro del arreglo, con la traslación redondeada a posiciones enteras; con la traslación `fija`, rasterizar sin transformación previa
    - Con la rotación `libre`, usar la búsqueda de la tarea 11.4; con la rotación `fija`, evaluar solo el ángulo 0
    - Exigir siempre la coincidencia de escala, sin ningún ajuste de tamaño y sin más tolerancia que la dilatación de 8 píxeles
    - Ampliar `validador.test.ts` con los dos casos negativos del requisito 29.7 partiendo de los segmentos del nivel `0.1`: el segmento adicional de 100 unidades fuera de la máscara objetivo dilatada, que niega la coincidencia indicando el exceso como motivo; y las longitudes multiplicadas por 2, que la niegan aun con traslación y rotación libres
    - _Requisitos: 16.1, 16.7, 16.9, 16.11, 16.12, 16.14, 16.17, 29.7_

  - [x] 11.6 Escribir la prueba de propiedad del veredicto geométrico
    - **Property 16 (parte C, validador): Extracción de segmentos, encuadre y veredicto geométrico**
    - **Valida: Requisitos 16.1, 16.4, 16.10, 16.17**

- [x] 12. Punto de control — validación geométrica
  - Ejecutar `npm test` y `npm run typecheck`; comprobar que la prueba de rendimiento del validador cabe en su presupuesto y preguntar al usuario si surgen dudas

- [x] 13. Lienzo, personajes y animador
  - [x] 13.1 Declarar la costura `ContextoDibujo` y el doble de dibujo de las pruebas
    - Declarar en `src/motor/lienzo.ts` el tipo `ContextoDibujo` derivado con `Pick<CanvasRenderingContext2D, …>` sobre los métodos y propiedades de la sección 7.2 del diseño, para que un contexto real lo satisfaga por construcción
    - Escribir en `src/motor/lienzo.test.ts` el doble de dibujo, **dentro del propio archivo de prueba** y no como módulo de `src/`: registra la secuencia de llamadas con sus argumentos y aplana cada trazo y cada relleno a polilíneas que rasteriza en un `Uint8Array`, para medir en Node el IoU de una silueta, su inscripción en un círculo y la igualdad de dos dibujos
    - Documentar en la prueba que la comparación «píxel por píxel» de los requisitos 13.9 y 23.9 se hace sobre la secuencia registrada de llamadas y su rasterizado, que es una condición más fuerte que la igualdad de píxeles, y que la verificación con un Canvas real del navegador sigue siendo manual
    - _Requisitos: 13.9, 23.9, 29.10_

  - [x] 13.2 Implementar `src/motor/lienzo.ts` con el espacio lógico, la cuadrícula y las cuatro capas
    - Definir el espacio lógico de 800 × 800 unidades con origen en el centro, `x` a la derecha, `y` hacia arriba, ejes acotados de −400 a 400 inclusive, y el rumbo en grados en `[0, 360)` con 0 hacia arriba
    - Crear las cuatro capas `fondo`, `referencia`, `jugador` y `personajes` como elementos apilados con el mismo tamaño y la misma transformación, en ese orden de apilamiento, y permitir borrar la capa del jugador sin alterar las otras tres y sin volver a ejecutar el programa de referencia
    - Implementar el escalado de la sección 7.3 del diseño: lado acotado a `[320, 4096]`, escala igual al lado entre 800, densidad de píxeles acotada a `[1, 3]`, búfer igual al lado por la densidad, cuadrado centrado con relación de aspecto 1:1 dentro de 1 píxel, y `setTransform` con `y` negativa para invertir el eje vertical **una sola vez y en un solo lugar**
    - Dibujar 41 líneas paralelas a cada eje separadas 20 unidades de −400 a 400, con las 9 de cada eje que caen en múltiplos de 100 con al menos el doble de grosor, todas con contraste mínimo 3:1 y por debajo de las dos estelas y de los personajes
    - Guardar en cada capa de estela las operaciones que recibió, para redibujar desde ellas al cambiar el tamaño o la densidad sin volver a invocar el intérprete, terminando el redibujado de 500 segmentos en 100 milisegundos o menos
    - Dibujar la estela de referencia con contraste mayor o igual que 3:1 contra el fondo, estrictamente menor que el de la estela del jugador y con un patrón de línea distinto; y aplicar `clip` al cuadrado lógico para recortar al borde los tramos que se salen y seguir dibujando sin excepción
    - Leer del tema, con `getComputedStyle` sobre el contenedor y en cada redibujado, el color y el grosor del fondo, de las líneas de 20, de las de 100 y de las dos estelas, sin ningún literal de color ni de grosor en el módulo, con valor de reserva y, si tampoco existe, calculado por inversión del contraste del fondo verificando 3:1
    - Escribir en `lienzo.test.ts` las 41 líneas por eje y las 9 gruesas, el orden de las cuatro capas, el borrado de la capa del jugador sin tocar las otras tres, el tramo fuera del cuadrado recortado, y el tema sin declarar un trazo
    - _Requisitos: 12.1, 12.2, 12.4, 12.5, 12.7, 12.8_

  - [x] 13.3 Escribir la prueba de propiedad del escalado del lienzo
    - **Property 22: Escalado uniforme del lienzo**
    - **Valida: Requisitos 12.3**

  - [x] 13.4 Escribir la prueba de propiedad del redibujado desde las operaciones
    - **Property 14 (parte B, lienzo): Legibilidad del rumbo, inscripción en el círculo y determinismo del dibujo**
    - **Valida: Requisitos 12.6**

  - [x] 13.5 Implementar `src/motor/personajes.ts` con la geometría de la sección 7.4 y su prueba de ejemplos
    - Declarar `IdentidadTortuga`, `EstadoPersonajes` con `tortuga`, `kiroMontado`, `inclinacionKiro`, `identidad` y `celebracion` —cada uno de los tres reservados con su comentario de estado y de spec que lo dibuja—, `ResultadoDibujo` y `dibujarPersonajes(ctx, estado)`
    - Declarar toda la geometría en el marco local con origen en la posición de la tortuga, `+y` al frente y `+x` a estribor, y girar el conjunto rígidamente con la transformación única del diseño 7.4.2, reduciendo a `[0, 360)` todo rumbo que llegue fuera
    - Trazar las piezas con las coordenadas concretas del diseño 7.4.3: caparazón de gota con los cinco vértices y su espejo; cuello, cabeza en `(0, 12.9)` radio 3.3 y ojos en `(±1.55, 14.5)`; muesca del caparazón como galón de `(0, 6.2)` a `(±4.2, 2.8)`; marca de rumbo como flecha en el flanco de babor con asta de `(−6.6, −6.6)` a `(−6.6, 0.2)` y punta en `(−6.6, 1.6)`; las cuatro patas con sus ejes y radios, delanteras más gruesas; cola como triángulo `(0, −13.6)`, `(±1.8, −10.8)`; y Kiro con centro en `(0, −3.4)`, domo de radio 4.9, faldón de tres ondas, estela y ojos en `(±1.85, −1.5)`
    - Usar `grosorTrazo = 1.5` unidades lógicas, de modo que todo punto declarado caiga dentro de un radio de 19.25
    - Girar **solo** el subtrazado de Kiro en torno a su propio centro, con la inclinación acotada a `[−20, 20]` grados y positiva hacia estribor, sin cambiar la posición ni el rumbo dibujados de la tortuga y sin girar nada cuando la inclinación es 0
    - Dibujar el lápiz al final, encima de Kiro, con eje unitario `(0.8, −0.6)`, cápsula de largo 7.6 y radio 0.85, con la punta en `(0, 0)` con el lápiz abajo y trasladada 8.6 unidades a lo largo de su propio eje con el lápiz arriba, con el mismo color y grosor en los dos estados
    - Respetar el orden de trazado de la sección 7.4.4: patas traseras, cola, patas delanteras, caparazón, muesca, marca de rumbo, cuello y cabeza, Kiro, lápiz
    - Dejar la capa de personajes sin ningún píxel dibujado cuando la tortuga está oculta, sin tocar las capas de estela; producir el mismo dibujo para cualquier valor de los tres campos reservados; leer color y grosor del tema en cada dibujado sin literales; y devolver un resultado explícito de estado inválido ante una posición, un rumbo o una inclinación no finitos, dejando las cuatro capas iguales y sin lanzar
    - Escribir `personajes.test.ts` con las nueve piezas trazadas, la punta del lápiz a 1 unidad o menos abajo y a 8 o más arriba, la tortuga oculta, la inclinación fuera de rango acotada, y los tres campos reservados con todos sus valores
    - _Requisitos: 13.1, 13.2, 13.4, 13.5, 13.7, 13.8, 13.10, 13.11, 1.9_

  - [x] 13.6 Escribir la prueba de propiedad de la legibilidad del rumbo y del círculo de 40 unidades
    - **Property 14 (parte A, personajes): Legibilidad del rumbo, inscripción en el círculo y determinismo del dibujo**
    - **Valida: Requisitos 13.3, 13.6, 13.8, 13.9**
    - Medir con el doble de dibujo de la tarea 13.1 el IoU de la silueta contra ella misma girada cada múltiplo de 15 grados entre 15 y 345, exigiendo **menor que 0.90**; y medir el radio máximo de todo punto trazado o rellenado, incluida la mitad del grosor, exigiendo 20 unidades o menos para todo rumbo, con el lápiz abajo y arriba y en los dos extremos de la inclinación de Kiro
    - Si algún ángulo se acercara a 0.90, aplicar en este orden las dos palancas documentadas en el diseño 7.4.6: alargar el eje cabeza-cola y alargar el lápiz, que tiene 2.2 unidades de margen

  - [x] 13.7 Implementar `src/motor/animador.ts` con el reloj inyectable y su prueba de ejemplos
    - Declarar `Reloj` con `programar`, `cancelar` y `ahora`, `Velocidad`, `DURACIONES` (1 000, 400, 120 y 0 ms), `FinDeSecuencia` con `motivo`, `operacionesAplicadas` y `estadoFinal`, la interfaz `Animador` y `crearAnimador(lienzo, reloj, movimientoReducido)`
    - Aplicar las operaciones en orden ascendente de `paso`, una sola vez cada una, tomando posición, rumbo, lápiz y visibilidad de `estadoAntes` y `estadoDespues`, sin volver a analizar el texto, sin leer el editor y sin invocar ninguna transformación de la tortuga
    - Interpolar de forma monótona la posición dibujada en cada `mover` y hacer crecer la estela solo cuando lleva el lápiz abajo; girar sin moverse en `girar`; reubicar sin estela en `reubicar`; borrar la capa de destino en `limpiar`; y actualizar el estado dibujado sin aportar estela en `lapiz` y `visibilidad`
    - Cumplir las tres duraciones objetivo con tolerancia de ±25 % medida sobre el total de una secuencia de 10 operaciones, y completar con la velocidad inmediata 500 operaciones en 100 milisegundos o menos sin dibujar posiciones intermedias
    - Aplicar un cambio de velocidad a partir de la siguiente operación pendiente, conservando la estela y el contador y sin reiniciar la secuencia
    - Implementar `paso()` con los cuatro pasos de la sección 8.4 del diseño, notificando por `alAplicar`, y devolviendo el mismo resultado de fin de secuencia sin dibujar nada cuando no queda ninguna operación pendiente
    - Implementar `reiniciar` deteniendo la reproducción, saliendo del paso a paso, poniendo el contador en cero, devolviendo la tortuga al estado inicial, borrando **solo** la capa del jugador y conservando la secuencia recibida
    - Consultar `movimientoReducido()` al empezar cada reproducción y, cuando es verdadero, dibujar la estela completa de hasta 500 operaciones en 100 milisegundos o menos sin posiciones intermedias, manteniendo disponible el paso a paso y dejando la misma estela final
    - Devolver el resultado explícito de fin de secuencia con el número de operaciones aplicadas al aplicar la última, sin lanzar
    - Escribir `animador.test.ts` con reloj falso: las cuatro velocidades, el paso a paso, el reinicio, la secuencia vacía, el paso sin operaciones pendientes, el cambio de velocidad en curso y `prefers-reduced-motion`
    - _Requisitos: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 28.5_

  - [x] 13.8 Escribir la prueba de propiedad de que lo dibujado es lo que se valida
    - **Property 15 (parte A, animador): Lo que se dibujó es exactamente lo que se valida**
    - **Valida: Requisitos 14.1, 14.7**
    - La parte B, sobre la demostración y el anuncio por paso, se escribe en la tarea 18.9

- [x] 14. Punto de control — motor completo
  - Ejecutar `npm test` y `npm run typecheck`; asegurarse de que todas las pruebas pasan y preguntar al usuario si surgen dudas

- [x] 15. Niveles como datos
  - [x] 15.1 Implementar `src/niveles/tipos.ts` con la forma de un `Nivel`
    - Declarar `ConceptoNivel` con los seis conceptos, `ComponenteNormalizacion`, `NormalizacionNivel` con `escala: 'exacta'` como único valor admitido, `ExigenciaAbstraccion` como unión discriminada por `clave` con las seis claves y el entero obligatorio de `maximoProcedimientos`, `OrigenNivel` como unión discriminada `autorado`/`generado`, y `Nivel` con `id`, `mundo`, `titulo`, `concepto`, `origen`, `normalizacion`, `abstraccion`, `pistas` como tupla de tres y `margenLimiteDuro` opcional
    - No declarar ningún campo que almacene un conteo, un `presupuestoEstrella` ni un `limiteDuro` ya calculados
    - Declarar la variante `generado` con `idGenerador` y `parametros` sin implementar ningún generador en esta spec
    - Importar únicamente de `src/lenguaje/` y de `src/azar/`, sin ninguna importación estática, reexportación ni importación dinámica de `src/motor/`, `src/juego/` ni `src/ui/`
    - Escribir las aserciones de compilación con `@ts-expect-error` en `src/niveles/catalogo.test.ts` para los tres casos que no deben compilar: un nivel autorado que declara `idGenerador`, un nivel generado que declara un AST, y un consumidor que deja sin tratar una de las dos variantes; más una clave de abstracción ajena a las seis
    - _Requisitos: 18.1, 18.2, 18.3, 18.4, 18.5, 18.10_

  - [x] 15.2 Declarar el nivel `0.1` en `src/niveles/mundo-0-primeros-pasos.ts`
    - Armar `REFERENCIA_0_1` **nodo por nodo** como un `Programa` de exactamente una `invocacionComando` de `AVANZA` con un `numeroLiteral` de valor 100, sin analizar texto con el lexer ni con el parser
    - Declarar el nivel con `id: '0.1'`, `mundo: 0`, `concepto: 'secuencia'`, título en español de 60 caracteres o menos, `origen` autorado con esa referencia y una semilla fija del dominio, normalización con traslación `libre`, rotación `libre` y escala `exacta`, `abstraccion: []`, sin `margenLimiteDuro`, y las tres pistas en el orden conceptual, matemática y esqueleto, cada una en español de 200 caracteres o menos y ninguna con el programa de referencia completo
    - Exportar `MUNDO_0` como el arreglo de niveles del mundo 0
    - _Requisitos: 27.1, 27.2_

  - [x] 15.3 Implementar `src/niveles/catalogo.ts` y su prueba
    - Reunir y ordenar los mundos declarados —en esta spec solo el 0— y exponer la búsqueda de un nivel por su identificador
    - Ampliar `catalogo.test.ts` con el nivel `0.1` completo, identificadores únicos de 8 caracteres o menos, las tres pistas de 200 caracteres o menos y sin el programa completo, la normalización correcta según el mundo —libre en los mundos 0 a 2 y fija desde el 3—, y la ausencia de claves de abstracción repetidas
    - _Requisitos: 18.1, 18.3, 18.4, 27.1, 27.2_

- [ ] 16. Capa de juego: reto, abstracción, estrellas y progreso
  - [ ] 16.1 Implementar `src/juego/reto.ts` y su prueba de ejemplos
    - Declarar `Reto` con `nivel`, `semillaEfectiva`, `codigoSemilla`, `referencia`, `operaciones`, `segmentos`, `presupuestoEstrella`, `limiteDuro` y `limiteDuroActivo`, `ResultadoReto` y `resolverReto(idNivel, semilla)`
    - Resolver según el diagrama de la sección 11.3 del diseño, **ejecutando el programa de referencia una sola vez** por resolución, con el estado inicial que expone la tortuga y los comandos del mundo que declara el nivel
    - Tomar como semilla efectiva la que declara el nivel cuando el origen es `autorado`, y calcular el código de semilla siempre sobre la efectiva
    - Derivar el `limiteDuro` como `presupuestoEstrella` más el margen del nivel, tomando 3 cuando no declara ninguno, devolviéndolo también cuando está inactivo; con el indicador en falso en los mundos 0 a 2 y en verdadero desde el 3
    - Reportar el fallo de programación `nivelDesconocido` para un identificador que ningún nivel reconoce, y `referenciaNoEjecutable` para un origen `generado` o una referencia que el intérprete no puede ejecutar, sin devolver ningún reto parcial y sin devolver ninguna operación
    - No mantener ningún estado a nivel de módulo: cada resolución crea su propio PRNG con la semilla efectiva
    - Escribir `reto.test.ts` con el `presupuestoEstrella` 1, el `limiteDuro` 4 inactivo, el código de semilla de 7 caracteres, la comprobación de que la referencia se ejecuta una sola vez, y los tres fallos de programación
    - _Requisitos: 18.6, 18.8, 18.9, 18.11, 18.12, 18.13, 27.7_

  - [ ] 16.2 Escribir la prueba de propiedad de determinismo de la resolución del reto
    - **Property 9 (parte B, reto): Determinismo del pipeline completo**
    - **Valida: Requisitos 18.7, 29.4**
    - Dos resoluciones con el mismo par, hechas de forma independiente y separadas por al menos otra resolución

  - [ ] 16.3 Implementar `src/juego/abstraccion.ts` y su prueba
    - Declarar `ResultadoAbstraccion` con `confirmadas` y `sinConfirmar` en el orden en que el nivel declara las exigencias, y `analizar(programa, exigencias)`
    - Recorrer el AST completo del jugador, incluidos los nueve tipos reservados, sin leer el texto del programa, sin invocar el impresor y sin comparar contra el programa de referencia
    - Confirmar cada clave con la condición de la tabla de la sección 11.4 del diseño y con ninguna otra; en particular `usaParametros` exige declarar **y** usar un parámetro de esa misma definición, y `maximoProcedimientos` es una cota superior
    - Escribir `abstraccion.test.ts` con las seis claves una por una sobre árboles armados con nodos reservados, el conjunto de exigencias vacío, y dos AST iguales nodo por nodo analizados de dos textos distintos devolviendo el mismo resultado
    - _Requisitos: 19.6, 19.7_

  - [ ] 16.4 Implementar `src/juego/estrellas.ts` y su prueba de ejemplos
    - Declarar `MotivoNegada` con las seis claves de la sección 11.5 del diseño, `EstadoEstrella`, `Calificacion` con las tres estrellas, `conteoJugador` y `presupuestoEstrella`, y `calificar(astJugador, veredicto, reto)`
    - Otorgar precisión si y solo si el veredicto concede la coincidencia geométrica, tomándolo tal como el validador lo devuelve, sin volver a rasterizar, sin recalcular el IoU ni el exceso y sin umbral propio, e incluyendo los dos valores en el motivo cuando la niega
    - Otorgar economía si y solo si el conteo del jugador es menor o igual que el `presupuestoEstrella`, sin margen, otorgándola cuando son iguales y negándola en cuanto lo supera por 1, y evaluándola con independencia del veredicto de precisión
    - Otorgar abstracción si y solo si el análisis confirma todas las exigencias declaradas; y cuando el nivel declara el conjunto vacío, si y solo si se otorgó la precisión
    - Negar las tres estrellas con la causa recibida como motivo ante un intento sin veredicto, por errores de análisis o por guarda, sin excepción y sin resultado parcial
    - Obtener el conteo invocando la única función de `conteo.ts`, sin recorrer el AST por su cuenta
    - Escribir `estrellas.test.ts` con los seis motivos y sus datos, el nivel sin exigencias, el conteo 3 contra el presupuesto 1, y las dos causas de intento sin veredicto
    - _Requisitos: 19.1, 19.2, 19.3, 19.4, 19.5, 19.10, 19.11, 9.6, 27.10_

  - [ ] 16.5 Escribir la prueba de propiedad de las tres estrellas
    - **Property 17: Las tres estrellas son bicondicionales independientes**
    - **Valida: Requisitos 19.1, 19.2, 19.3, 19.5, 19.11, 27.11**

  - [ ] 16.6 Escribir la prueba de propiedad de equivalencia geométrica en el nivel `0.1`
    - **Property 26: Equivalencia geométrica de programas escritos de otra forma**
    - **Valida: Requisitos 27.4, 16.7, 16.8**
    - Se escribe en `src/juego/estrellas.test.ts` y no en `validador.test.ts`, porque exige el veredicto **y** las tres estrellas, y `motor/` no puede importar de `juego/`

  - [ ] 16.7 Implementar `src/juego/progreso.ts` y su prueba
    - Declarar `CLAVE` con el número de versión en el nombre, `VERSION_FORMATO`, `EstrellasGuardadas`, `RetoEnCurso`, la interfaz `Progreso` y `cargarProgreso(almacen)` admitiendo `null` para funcionar entero en memoria
    - Escribir en una única clave un único texto JSON con la forma de la sección 11.6 del diseño, que declara el mismo número de versión, con a lo sumo un registro por identificador de nivel, sin escribir ni borrar ninguna otra clave
    - Guardar únicamente la versión, los identificadores de nivel, las semillas, los tres booleanos y el último reto en curso; ningún nombre, correo, identificador de dispositivo o de sesión, ni fragmento del texto del jugador, y sin enviar nada por la red
    - Guardar todo intento calificado antes de que el juego admita otra ejecución, y no modificar el contenido guardado por un intento que no llegó a producir calificación
    - Guardar cada estrella en verdadero si el registro previo **o** el intento nuevo la concedió, y actualizar siempre el último reto en curso
    - Leer una sola vez al arrancar y responder con ese contenido toda la sesión, actualizándolo con cada guardado, con las cuatro degradaciones de la tabla del diseño 11.6: contenido no reconocido conservado hasta el primer guardado exitoso, registro inválido descartado en solitario, cuota agotada informando una sola vez por sesión sin reintentar, y `almacen` nulo en memoria
    - Escribir `progreso.test.ts` con un doble de `Storage` en memoria: la clave y la versión, el JSON escrito, la única clave tocada, el JSON ilegible, la versión no reconocida conservada, el registro inválido descartado, y la cuota agotada avisando una vez
    - _Requisitos: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9_

  - [ ] 16.8 Escribir la prueba de propiedad de la persistencia
    - **Property 20: La persistencia va y vuelve, nunca retrocede y no guarda de más**
    - **Valida: Requisitos 20.3, 20.6, 20.9**

  - [ ] 16.9 Escribir la prueba de regresión obligatoria del catálogo
    - **Property 25: Todo nivel del catálogo aprueba su propio nivel con las tres estrellas**
    - **Valida: Requisitos 29.3, 29.11, 18.8, 18.9, 18.13**
    - Se escribe en `src/juego/reto.test.ts` recorriendo el catálogo completo desde ya, para que la spec 01 herede la prueba y sus generadores solo agreguen el barrido de 200 semillas
    - Al fallar, informar el identificador del nivel, la semilla usada, cuál de las tres estrellas quedó negada y el motivo que devuelven las estrellas, y **seguir verificando los demás niveles** antes de terminar con código de salida distinto de cero

- [ ] 17. Punto de control — capa de juego
  - Ejecutar `npm test` y `npm run typecheck`; comprobar que la prueba de regresión del catálogo pasa y preguntar al usuario si surgen dudas

- [ ] 18. Interfaz
  - [ ] 18.1 Implementar `src/ui/editor.ts` y su prueba
    - Presentar el programa en un `textarea` nativo con una canaleta hermana que muestra un número por línea desde 1, con el desplazamiento vertical sincronizado y actualizada en 100 milisegundos o menos tras cada cambio del número de líneas
    - Admitir hasta 200 líneas y 10 000 caracteres inclusive, reconociendo `\n` y `\r\n` como un solo fin de línea, contando la última línea aunque no termine en fin de línea, y contando espacios, tabuladores y fines de línea dentro de los 10 000
    - Descartar únicamente la parte que excede el límite, conservar el contenido admitido, dejar el cursor al final, mantener el área habilitada y pedir al globo el mensaje que nombra cuál límite se alcanzó y su valor
    - Analizar el texto en curso y mostrar el entero de `conteo.ts` en 200 milisegundos o menos desde el último cambio, sin recorrer el AST por su cuenta, sin bloquear la escritura y mostrando 0 con el texto vacío o de solo comentarios
    - Ante errores del lexer, del parser o del conteo, seguir mostrando el último conteo sin errores con una marca de provisional legible como texto en español además del color, y 0 provisional si todavía no obtuvo ninguno
    - Marcar en la canaleta la línea de cada error, hasta 20, distinguible por forma además de por color, mostrando por cada línea marcada su número y el texto del mensaje, y retirando la marca de toda línea que ya no exista
    - Mostrar junto al contador el `presupuestoEstrella` del reto, con un nombre accesible en español que los nombra por separado, y señalar el exceso con texto en español manteniendo el área habilitada
    - Resaltar exactamente una línea en modo paso a paso, la de la última operación aplicada, distinguida por al menos un canal además del color, actualizada en 100 milisegundos o menos, sin mover el foco y retirando el resaltado mientras ese número de línea no exista
    - No capturar `Tab`: una pulsación mueve el foco al siguiente elemento interactivo y `Mayús`+`Tab` al anterior, sin insertar ningún carácter
    - Presentar el contenido con un único estilo de texto, sin resaltado de sintaxis
    - Escribir `editor.test.ts` con `// @vitest-environment jsdom`: el contador provisional, las marcas en la canaleta, el `Tab` que no se captura, el presupuesto al lado, los límites exactos de 200 líneas y 10 000 caracteres, una línea más, un carácter más, y `\r\n`
    - _Requisitos: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10, 21.11, 14.4_

  - [ ] 18.2 Escribir la prueba de propiedad del editor
    - **Property 21: El editor cuenta líneas y respeta sus dos límites**
    - **Valida: Requisitos 21.1, 21.2, 21.3**

  - [ ] 18.3 Implementar `src/ui/panel-comandos.ts` y su prueba
    - Obtener los comandos consultando `comandosDelMundo` con el mundo del nivel en curso, una sola vez cada uno y en el orden en que el vocabulario los devuelve, sin lista propia, de modo que en el mundo 0 presente exactamente las seis entradas
    - Mostrar por cada entrada, como texto visible y en el nombre accesible en español de su elemento interactivo, el nombre largo, la abreviatura, la descripción y el ejemplo tal como el vocabulario los declara, carácter por carácter, sin depender de icono ni de color
    - Omitir toda entrada de un mundo posterior en todo texto visible y en todo nombre accesible, y no ofrecer ningún elemento interactivo para ellas
    - Al activar un elemento con el ratón, `Enter` o la barra espaciadora, pedir al editor la inserción del ejemplo en la posición del cursor, reemplazando la selección cuando hay una y agregándolo al final cuando no hay posición de cursor, en 100 milisegundos o menos
    - Entregar el ejemplo íntegro sin truncarlo ni descartarlo, dejando que el editor aplique su regla de límites y que sea el editor quien pida el mensaje al globo
    - Dejar cada elemento alcanzable desde el editor en 10 pulsaciones de `Tab` o menos, activable con `Enter` y con la barra espaciadora, con indicador de foco visible, sin capturar el foco y conservándolo en el elemento activado tras la inserción
    - Publicar en la región `aria-live` `polite`, en 500 milisegundos o menos, un texto en español que nombra el comando insertado y el número de la línea donde quedó el cursor, sin mover el foco
    - Presentar la lista completa en 500 milisegundos o menos al presentar un nivel, con todos sus elementos operables y en el mismo orden para todo nivel del mismo mundo
    - Escribir `panel-comandos.test.ts` con `// @vitest-environment jsdom`: las seis entradas del mundo 0 y ninguna posterior, la inserción en la posición del cursor y con selección, y la inserción que excedería el límite
    - _Requisitos: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8_

  - [ ] 18.4 Escribir la prueba de propiedad del panel de comandos
    - **Property 23: El filtro por mundo del panel y la fidelidad de sus textos**
    - **Valida: Requisitos 3.8, 26.1, 26.2, 26.3**

  - [ ] 18.5 Implementar `src/ui/globo-kiro.ts` y su prueba
    - Ser el **único** elemento que presenta texto dirigido al jugador —comentario de resultado, escalones de pista, mensajes del catálogo y celebración—, atribuyéndolo a Kiro, sin que ningún otro módulo tenga globo propio ni texto atribuido a la tortuga
    - Mostrar en 1 000 milisegundos o menos, al recibir la calificación, un texto en español de 300 caracteres o menos que nombra las tres estrellas y si cada una quedó otorgada o negada, sin depender de color ni de icono
    - Mostrar los mensajes del catálogo con su texto exacto, carácter por carácter, sin truncar, sin reescribir y sin agregar nombre de excepción, traza de pila ni código numérico, en el orden recibido y hasta 20, manteniéndolos visibles hasta la siguiente ejecución o hasta reiniciar
    - Mantener en memoria el número de escalones de pista abiertos del reto en curso como entero de 0 a 3, iniciarlo en 0, aumentarlo en 1 solo al mostrar un escalón por primera vez, exponerlo para consulta y no escribirlo en `localStorage`
    - Mostrar el escalón siguiente al último abierto en el orden fijo del nivel, con el texto tal como el nivel lo declara y sin agregar comandos ni números, y sin mostrar nunca el programa de referencia ni ninguna parte de él
    - Al pedir una pista con los tres escalones ya abiertos, conservar visible el tercero, informar en 200 caracteres o menos que no hay más escalones y dejar el contador en 3
    - Volver el contador a 0, dejar el escalón conceptual como el siguiente y vaciar el texto de pista cuando cambia el identificador de nivel o la semilla efectiva, y no reiniciarlo al volver a ejecutar, repetir la demostración o reiniciar dentro del mismo reto
    - Mostrar los mensajes de negación de economía y de abstracción con los enteros y la primera exigencia sin confirmar tal como las estrellas los devuelven, en una sola oración de 200 caracteres o menos
    - Publicar todo cambio de contenido en la región `aria-live` `polite` en 1 000 milisegundos o menos, reemplazando por completo el contenido anterior, sin usar `assertive` y sin mover el foco
    - Presentar un único elemento interactivo para pedir pista, con nombre accesible en español estable, alcanzable desde el editor en 10 pulsaciones de `Tab` o menos, activable con `Enter` y con la barra espaciadora, con indicador de foco visible y sin capturar el foco
    - Escribir `globo-kiro.test.ts` con `// @vitest-environment jsdom`: las tres estrellas nombradas, los tres escalones en orden, la cuarta pista pedida, el cambio de reto que reinicia el contador, y la región `aria-live` `polite`
    - _Requisitos: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 19.8, 19.9, 8.5, 20.7_

  - [ ] 18.6 Escribir la prueba de propiedad del globo de Kiro
    - **Property 24: Fidelidad del texto de Kiro y contador de pistas**
    - **Valida: Requisitos 25.4, 25.6**

  - [ ] 18.7 Implementar `src/ui/controles.ts` y su prueba
    - Presentar exactamente seis acciones —ejecutar, detener, dar un paso, cambiar la velocidad, reiniciar y volver a ver la demostración—, cada una en un único elemento interactivo, con las cuatro velocidades del animador, una sola seleccionada y la normal al entrar al nivel
    - Pedir a `main.ts` la ejecución en lugar de conocer el intérprete, e invocar el paso a paso y el reinicio del animador y la repetición de la demostración
    - Mantener deshabilitadas ejecutar y volver a ver la demostración mientras una ejecución está en curso, y habilitadas detener, dar un paso, cambiar la velocidad y reiniciar, reflejando cada cambio en 100 milisegundos o menos, exponiendo el estado de forma programática además de visual, y sin hacer nada cuando se activa un control deshabilitado
    - Ordenar el foco de las seis acciones según el orden visual, cada una alcanzable desde el editor en 10 pulsaciones de `Tab` o menos, activable con `Enter` y con la barra espaciadora, con indicador de foco visible, sin capturar el foco, y moviendo el foco al control de detener o al de ejecutar cuando el que lo tiene se deshabilita
    - Exponer un nombre accesible en español no vacío, distinto y estable para cada acción y para cada velocidad, sin depender de icono ni de color
    - Al detener a pedido del jugador, dejar de consumir operaciones en 100 milisegundos o menos, conservar la estela y el estado alcanzado, conservar el texto del editor, invertir los estados habilitados, y **no** otorgar ninguna estrella ni mostrar ningún mensaje
    - Al recibir el fin de secuencia, en 100 milisegundos o menos habilitar ejecutar y volver a ver la demostración, deshabilitar detener y entregar a las estrellas la secuencia aplicada junto con el AST analizado
    - Escribir `controles.test.ts` con `// @vitest-environment jsdom`: las seis acciones, los estados durante y después de una ejecución, el foco que se mueve al deshabilitarse, el control deshabilitado que no hace nada, y la detención pedida por el jugador
    - _Requisitos: 24.1, 24.4, 24.5, 24.6, 24.7, 24.8, 8.6_

  - [ ] 18.8 Implementar `src/ui/demostracion.ts` y su prueba
    - Dibujar los personajes en el estado inicial del nivel en 1 000 milisegundos o menos y mantenerlos quietos 500 milisegundos o más antes del primer movimiento
    - Entregar al animador la secuencia completa que **ya trae el reto**, con la velocidad normal como selección inicial y la capa de referencia como destino, sin invocar el intérprete, sin volver a resolver el reto y sin tocar la capa del jugador
    - Al aplicar la última operación, conservar los tramos en la capa de referencia, devolver la tortuga al estado inicial en 500 milisegundos o menos sin dibujar durante el regreso, dejar iguales el fondo y la capa del jugador, y dejar habilitados el control de repetición y la acción de ejecutar
    - Ofrecer un control de repetición habilitado durante todo el nivel, con activaciones ilimitadas, que no descuenta instrucciones ni altera el resultado de las estrellas; y al activarlo, detener en 100 milisegundos o menos, borrar únicamente la capa de referencia y volver a aplicar la misma secuencia desde el estado inicial
    - Ofrecer las cuatro velocidades del animador, aplicando el cambio a partir de la siguiente operación pendiente y conservando la velocidad de una repetición a la siguiente
    - Mantener habilitada el área de escritura mientras la demostración está en curso, admitir toda pulsación dirigida a ella, actualizar el contador y conservar el foco donde estaba
    - Anunciar en la región `aria-live` `polite`, en 500 milisegundos o menos, el inicio y el fin de cada reproducción, nombrando en el de fin el número de tramos dibujados y el número de giros, sin mover el foco y repitiendo los dos anuncios en cada repetición
    - Al pulsar ejecutar con la demostración en curso, detenerse en 100 milisegundos o menos, dibujar de inmediato los tramos pendientes en la capa de referencia, devolver la tortuga al estado inicial y ceder el animador sin descartar la pulsación y sin volver a resolver el reto
    - Con un reto sin ninguna operación, dejar la capa de referencia sin píxeles, dibujar los personajes en el estado inicial, informar en el globo que el nivel no tiene demostración, mantener todo habilitado y terminar sin excepción
    - Escribir `demostracion.test.ts` con `// @vitest-environment jsdom` y reloj falso
    - _Requisitos: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10_

  - [ ] 18.9 Escribir la prueba de propiedad de la demostración y del anuncio por paso
    - **Property 15 (parte B, demostración): Lo que se dibujó es exactamente lo que se valida**
    - **Valida: Requisitos 22.3, 22.5, 28.2**

  - [ ] 18.10 Implementar `src/ui/diff.ts` y su prueba
    - Recibir las tres regiones de 800 × 800 junto con la traslación y el ángulo del veredicto, y dibujarlas aplicando esa misma traslación y ese mismo ángulo para que queden alineadas con las estelas que el jugador vio dibujar
    - Dibujar la coincidencia en línea continua sin huecos, el exceso con un grosor de al menos el doble del de la coincidencia, y la falta punteada con guiones y huecos alternados de entre 4 y 12 unidades lógicas, tomando color y grosor del tema y sin literales en el módulo
    - Distinguir los tres estados por patrón de guiones y por grosor además del color, de modo que dibujados con un mismo color cada par siga diferenciándose, y nombrar cada estado por lo que significa y nunca por el nombre de su color
    - Dibujar los tres estados con esos mismos datos cualquiera que sea el veredicto de precisión, sin invocar de nuevo al validador, sin volver a rasterizar y sin ejecutar el intérprete
    - Dibujar únicamente la región de falta cuando el jugador no ha ejecutado nada o su ejecución no encendió ninguna posición
    - Escribir `diff.test.ts` con el doble de dibujo: los tres estados distinguibles en escala de grises, el contraste 3:1 de cada uno frente al fondo, y el caso sin estela del jugador
    - _Requisitos: 23.3, 23.4, 23.5, 23.9_

  - [ ] 18.11 Escribir la prueba de propiedad del determinismo del diff
    - **Property 14 (parte C, diff): Legibilidad del rumbo, inscripción en el círculo y determinismo del dibujo**
    - **Valida: Requisitos 23.9**

  - [ ] 18.12 Implementar `src/ui/comparacion.ts` y su prueba
    - Presentar la estela de referencia y la de la última ejecución del jugador lado a lado, en dos lienzos que comparten el espacio lógico, la cuadrícula de 20 unidades y una escala uniforme con diferencia de 1 píxel o menos, sin recortar ni reencuadrar, y rotular cada uno con texto y nombre accesible en español que identifican de quién es la figura
    - Ofrecer un conmutador de dos estados, operable con teclado y con ratón, que alterna con la vista de superposición dibujando las dos estelas en un solo lienzo alineadas en las mismas coordenadas y distinguibles por estilo de línea además del color, completando el cambio en 200 milisegundos o menos, exponiendo el estado en curso y sin volver a ejecutar ningún programa
    - Invocar el diff sobre la vista de superposición sin que el jugador active ningún control cuando las estrellas niegan la precisión
    - Publicar en la región `aria-live` `polite`, en 1 segundo o menos, un texto en español con el IoU redondeado a dos decimales, el exceso redondeado a un decimal y si hay o no trazo sobrante y faltante, sin nombrar ningún color como único identificador; y anunciar que todavía no hay estela del jugador cuando corresponde
    - Mantener el editor disponible y conservar en pantalla las dos estelas y los tres estados hasta la siguiente ejecución
    - Escribir `comparacion.test.ts` con `// @vitest-environment jsdom`: los rótulos, el conmutador, el anuncio con los dos números redondeados, y el caso sin estela del jugador con el conmutador operable
    - _Requisitos: 23.1, 23.2, 23.6, 23.7, 23.8, 23.10_

- [ ] 19. `main.ts` y el cableado del flujo completo
  - [ ] 19.1 Implementar el arranque de `src/main.ts`
    - Declarar `EstadoAplicacion` con `reto`, `astJugador`, `operacionesJugador`, `veredicto` y `calificacion`
    - Ejecutar los seis pasos de arranque de la sección 12.4 del diseño: cargar el progreso con degradación a memoria, resolver el reto del nivel `0.1` con su semilla fija, crear el lienzo con sus cuatro capas y el animador con el reloj real y la preferencia de movimiento, crear los siete módulos de `ui/`, cablear los callbacks, lanzar la demostración una vez sin que el jugador active ningún control, y suscribirse al cambio de `prefers-reduced-motion` para reflejarlo en 1 segundo o menos sin recargar y sin perder el texto del editor
    - Comunicar entre módulos por callbacks explícitos, nunca por eventos globales ni por estado compartido mutable
    - Presentar el nivel con el editor vacío, el contador en 0 sin marca de provisional, el `presupuestoEstrella` 1 al lado, la canaleta sin marcas, los seis comandos del mundo 0, las seis acciones de los controles y un texto en español no vacío en el globo, cualquiera que sea el progreso guardado
    - Escribir el fallo de programación en la consola y no mostrarlo nunca en el globo
    - _Requisitos: 27.3, 27.9, 28.5_

  - [ ] 19.2 Cablear el flujo completo de un intento y verificar el nivel `0.1` de punta a punta
    - Implementar la secuencia de la sección 12.5 del diseño: analizar el texto del editor con el mundo del nivel; ante errores, mostrar los mensajes en el globo sin invocar el intérprete ni el animador y sin otorgar ni negar ninguna estrella; si el análisis es correcto, reiniciar el animador, ejecutar con el intérprete, extraer segmentos, **invocar el validador una sola vez** por intento, calificar, guardar el progreso antes de admitir otra ejecución, comentar en el globo y mostrar el diff cuando la precisión se niega
    - Repartir el veredicto a las estrellas y al diff sin recalcularlo, y no reescribir ningún mensaje del catálogo
    - Publicar en la región `aria-live` un único texto al dejar de consumir operaciones, nombrando el motivo, el número de operaciones aplicadas y el estado final con posición, rumbo y estado del lápiz, y sin publicar anuncios de estado por las operaciones intermedias de una reproducción continua
    - Ejecutar y calificar todo programa cuyo conteo supera el presupuesto, sin detener la ejecución por presupuesto, y sin emitir ninguna solicitud de red después de la carga inicial ni escribir ninguna cookie
    - Escribir en `src/main.test.ts`, con `// @vitest-environment jsdom`, el recorrido del nivel `0.1`: el programa correcto que gana las tres estrellas, `AVANZA 100 GIRADERECHA 90 AVANZA 100` que niega precisión por exceso y economía nombrando 3 y 1, y `AVANSA 100` que muestra `No sé cómo hacer AVANSA. ¿Querías decir AVANZA?` sin producir ninguna operación
    - Comprobar que `npm run build` termina con código 0 y deja un `index.html` en la raíz de `dist` con referencias que comienzan con `/`
    - _Requisitos: 27.3, 27.4, 27.5, 27.6, 27.8, 27.10, 27.11, 24.2, 24.3, 24.9, 28.9, 2.2, 2.11_

- [ ] 20. Punto de control — juego jugable de punta a punta
  - Ejecutar `npm test`, `npm run typecheck` y `npm run build`; asegurarse de que todas las pruebas pasan y preguntar al usuario si surgen dudas

- [ ] 21. Pruebas transversales y verificación final
  - [ ] 21.1 Escribir la prueba de recorrido de `src/`
    - En `src/main.test.ts`, recorrer todos los archivos `.ts` de `src/` y sus subdirectorios y afirmar que ninguno contiene `Math.random`, una llamada a `eval`, una construcción `new Function` ni ninguna otra invocación del constructor `Function`
    - Afirmar que ni `src/` ni sus subdirectorios contienen archivos cuya extensión, comparada sin distinguir mayúsculas de minúsculas, sea `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` o `.ico`
    - Excluir del recorrido el propio archivo de prueba que declara esas cadenas y no abarcar el directorio `assets/` de la raíz
    - Fallar nombrando el archivo y la línea de cada coincidencia
    - Dejar anotado en la prueba que esta ausencia es lo que habilita servir el juego con una política de seguridad de contenido estricta sin la directiva `unsafe-eval`
    - _Requisitos: 1.9, 1.11, 2.10, 17.3, 29.6_

  - [ ] 21.2 Escribir la prueba de dirección de las dependencias
    - En `src/main.test.ts`, leer los `import` de cada archivo de `src/` —rutas relativas y con alias, estáticas y dinámicas— y afirmar las aristas prohibidas de la sección 2.3 del diseño: `lenguaje/` no importa de ningún otro directorio; `azar/` tampoco, salvo `lenguaje/errores.ts`; `niveles/` solo importa de `lenguaje/`, de `azar/` y de sí mismo; y `motor/` no importa de `ui/` ni de `juego/`
    - Declarar como las **dos** excepciones documentadas y admitidas `azar/` → `lenguaje/errores.ts` y `lenguaje/interprete.ts` → `motor/tortuga.ts`, con el comentario que explica por qué cada una existe
    - Fallar nombrando el archivo que importa, el archivo importado y la regla violada
    - _Requisitos: 1.8, 18.10, 29.2_

  - [ ] 21.3 Escribir la prueba de estructura del proyecto
    - En `src/main.test.ts`, afirmar que cada entrada del glosario de los requisitos que apunta a `src/` tiene su módulo presente, que no hay directorios vacíos, que todos los nombres de archivo y de carpeta están en `kebab-case` minúsculas, y que cada archivo de prueba está junto al módulo que prueba con el sufijo `.test.ts`
    - Admitir de forma explícita `src/azar/generadores-prueba.test.ts` de la tarea 3.5 como el único archivo de ayudas compartidas, dejando anotada la razón
    - Afirmar que existe un archivo de prueba propio por cada módulo nombrado en el requisito 29.1, con las pruebas de las tres guardas junto al módulo del intérprete, sin agrupar dos módulos en un mismo archivo y sin ningún directorio de pruebas separado de `src/`
    - _Requisitos: 1.8, 29.1, 29.2_

  - [ ] 21.4 Escribir la prueba de accesibilidad comprobable por código
    - En `src/main.test.ts`, con `// @vitest-environment jsdom`, calcular las relaciones de contraste de WCAG 2.1 sobre los valores de `src/estilos/tema.css` y afirmar 4.5:1 o más para todo texto y 3:1 o más para los controles, el indicador de foco, las dos estelas, los tres estados del diff y el conjunto de la tortuga con Kiro
    - Afirmar que existe **una única** región `aria-live` con cortesía `polite` que no recibe foco, que ningún elemento la usa con `assertive`, y que el documento declara el idioma español
    - Afirmar un nombre accesible en español no vacío en cada elemento interactivo, y la distinción en escala de grises de los estados de cada grupo de retroalimentación
    - Recorrer el flujo completo del nivel `0.1` **solo con teclado**, sin ningún dispositivo apuntador —repetir la demostración, cambiar la velocidad, insertar un ejemplo del panel, escribir y corregir el programa, ejecutar, detener, dar un paso, reiniciar, alternar las dos vistas de la comparación, pedir los tres escalones de pista y leer las estrellas—, comprobando que el orden de `Tab` coincide con el orden visual, que cada elemento se activa con `Enter` y con la barra espaciadora, y que desde cualquier elemento interactivo 20 pulsaciones de `Tab` o menos devuelven el foco al área de escritura
    - Declarar en el informe de la prueba que ese conjunto es el piso comprobable por código, y que la validación completa de accesibilidad requiere pruebas manuales con tecnologías asistivas y revisión por una persona experta
    - _Requisitos: 28.1, 28.3, 28.4, 28.7, 28.8, 28.10_

  - [ ] 21.5 Verificar los tres comandos y el contenido de `dist`, y corregir lo que falle
    - `npm test`: termina en 120 segundos o menos con código de salida 0, sin ninguna prueba fallida, omitida ni pendiente, y con al menos una aserción por cada módulo del requisito 29.1
    - `npm run typecheck`: código de salida 0, sin errores, comprobando también los `.test.ts` y sin escribir ningún archivo
    - `npm run build`: código de salida 0, `index.html` en la raíz de `dist` con referencias que comienzan con `/`, sin ningún archivo con sufijo `.test.ts` en el empaquetado, sin ningún archivo con las siete extensiones de imagen, y sin ningún archivo proveniente de `assets/`
    - Comprobar que dos compilaciones sobre la misma confirmación producen el mismo conjunto de nombres de archivo con el mismo contenido
    - Servir el contenido de `dist` desde la raíz de un servidor estático con `npm run preview` y comprobar que el juego dibuja la cuadrícula, acepta texto en el editor y ejecuta el programa dibujando la estela en 3 segundos o menos, sin ningún mensaje de nivel error en la consola y sin ninguna violación de una política de seguridad de contenido que omite `unsafe-eval`
    - Comprobar que la cobertura de casos del requisito 29.12 está completa: cada entrada del vocabulario del mundo 0 con nombre largo y abreviatura, un caso con acentos, uno con mayúsculas y minúsculas mezcladas, uno con argumento decimal escrito con coma, y un caso de error por cada situación que el lexer o el parser pueden reportar
    - _Requisitos: 1.13, 1.14, 2.2, 2.3, 2.8, 2.9, 2.10, 2.13, 29.1, 29.6, 29.8, 29.9, 29.12_

- [ ] 22. Punto de control final
  - Ejecutar `npm test`, `npm run typecheck` y `npm run build`; asegurarse de que todas las pruebas pasan y preguntar al usuario si surgen dudas

## Notes

- **Ninguna tarea está marcada como opcional.** La spec entrega una rebanada vertical jugable: cada
  módulo participa en el flujo del nivel `0.1`, y las pruebas no son un extra sino el mecanismo con el
  que las siete specs siguientes construyen encima. La prueba de regresión de la tarea 16.9 y la de
  rendimiento del validador de la tarea 11.4 son requisitos explícitos (29.3, 29.11 y 16.13).
- **Las pruebas viven junto a su módulo**, con el sufijo `.test.ts`, y la tarea de cada módulo incluye
  escribir sus ejemplos y sus casos límite. Las 26 propiedades de corrección van en sub-tareas
  adyacentes que escriben en ese mismo archivo, para que el fallo de una propiedad apunte al módulo y
  no a un directorio de pruebas aparte.
- **Cuatro propiedades se parten en dos o tres sub-tareas** porque el diseño las asigna a módulos que
  se implementan en momentos distintos: la 9 (intérprete y reto), la 14 (personajes, lienzo y diff),
  la 15 (animador y demostración) y la 16 (segmentos, encuadre y validador). Cada parte nombra los
  criterios que le tocan.
- **Dos propiedades se escriben en un archivo distinto del que sugiere la sección 15.3 del diseño**, y
  la razón es la dirección de las dependencias: la 25 va en `juego/reto.test.ts` y la 26 en
  `juego/estrellas.test.ts`, porque `niveles/` no puede importar de `juego/` ni `motor/` de `juego/`.
- **Tres tareas concentran el riesgo técnico** y conviene no fusionarlas con sus vecinas: la 11.2
  (dilatación separable verificada contra fuerza bruta), la 11.4 (búsqueda del mejor giro dentro del
  presupuesto de 2 segundos) y la 13.5 con la 13.6 (geometría de los personajes y su IoU bajo
  rotación).
- **Las costuras inyectables se crean antes de sus consumidores**: `ahora` en la tarea 8.1,
  `ContextoDibujo` en la 13.1 y `Reloj` en la 13.7. Son lo que permite probar en Node sin DOM y sin
  esperar tiempos reales, así que ninguna se puede posponer.
- El grupo 1 crea `index.html` con la referencia a `src/main.ts`, que no existe hasta la tarea 19.1.
  Hasta ese punto la verificación de cada punto de control es `npm test` y `npm run typecheck`;
  `npm run build` entra en el punto de control 20.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0,  "tasks": ["1.1"] },
    { "id": 1,  "tasks": ["1.2", "1.4"] },
    { "id": 2,  "tasks": ["1.3"] },
    { "id": 3,  "tasks": ["2.1"] },
    { "id": 4,  "tasks": ["2.2"] },
    { "id": 5,  "tasks": ["2.3"] },
    { "id": 6,  "tasks": ["3.1"] },
    { "id": 7,  "tasks": ["3.2"] },
    { "id": 8,  "tasks": ["3.3"] },
    { "id": 9,  "tasks": ["3.4"] },
    { "id": 10, "tasks": ["3.5"] },
    { "id": 11, "tasks": ["4.1", "4.5"] },
    { "id": 12, "tasks": ["4.2", "4.6"] },
    { "id": 13, "tasks": ["4.3", "4.7"] },
    { "id": 14, "tasks": ["4.4", "4.8"] },
    { "id": 15, "tasks": ["5.1"] },
    { "id": 16, "tasks": ["5.2", "5.3"] },
    { "id": 17, "tasks": ["5.4"] },
    { "id": 18, "tasks": ["5.5"] },
    { "id": 19, "tasks": ["7.1"] },
    { "id": 20, "tasks": ["7.2"] },
    { "id": 21, "tasks": ["8.1"] },
    { "id": 22, "tasks": ["8.2"] },
    { "id": 23, "tasks": ["8.3"] },
    { "id": 24, "tasks": ["8.4"] },
    { "id": 25, "tasks": ["8.5"] },
    { "id": 26, "tasks": ["8.6"] },
    { "id": 27, "tasks": ["10.1"] },
    { "id": 28, "tasks": ["10.2", "10.3"] },
    { "id": 29, "tasks": ["10.4"] },
    { "id": 30, "tasks": ["11.1"] },
    { "id": 31, "tasks": ["11.2"] },
    { "id": 32, "tasks": ["11.3"] },
    { "id": 33, "tasks": ["11.4"] },
    { "id": 34, "tasks": ["11.5"] },
    { "id": 35, "tasks": ["11.6"] },
    { "id": 36, "tasks": ["13.1"] },
    { "id": 37, "tasks": ["13.2"] },
    { "id": 38, "tasks": ["13.3", "13.5"] },
    { "id": 39, "tasks": ["13.4", "13.6"] },
    { "id": 40, "tasks": ["13.7"] },
    { "id": 41, "tasks": ["13.8"] },
    { "id": 42, "tasks": ["15.1"] },
    { "id": 43, "tasks": ["15.2"] },
    { "id": 44, "tasks": ["15.3"] },
    { "id": 45, "tasks": ["16.1"] },
    { "id": 46, "tasks": ["16.2", "16.3"] },
    { "id": 47, "tasks": ["16.4"] },
    { "id": 48, "tasks": ["16.5", "16.7"] },
    { "id": 49, "tasks": ["16.6", "16.8"] },
    { "id": 50, "tasks": ["16.9"] },
    { "id": 51, "tasks": ["18.1"] },
    { "id": 52, "tasks": ["18.2", "18.3", "18.5"] },
    { "id": 53, "tasks": ["18.4", "18.6", "18.7", "18.10"] },
    { "id": 54, "tasks": ["18.8", "18.11", "18.12"] },
    { "id": 55, "tasks": ["18.9"] },
    { "id": 56, "tasks": ["19.1"] },
    { "id": 57, "tasks": ["19.2"] },
    { "id": 58, "tasks": ["21.1"] },
    { "id": 59, "tasks": ["21.2"] },
    { "id": 60, "tasks": ["21.3"] },
    { "id": 61, "tasks": ["21.4"] },
    { "id": 62, "tasks": ["21.5"] }
  ]
}
```
