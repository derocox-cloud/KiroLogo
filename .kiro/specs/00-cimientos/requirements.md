# Requirements Document

**KiroLogo · Spec 00 · Cimientos**

## Introduction

Esta spec levanta el proyecto KiroLogo y construye una **rebanada vertical completa**: un solo nivel
autorado, jugable de punta a punta en el navegador. Kiro montado sobre la tortuga dibuja la figura en
vivo, el jugador escribe su programa en el editor, lo ejecuta animado o paso a paso, y el juego lo
valida geométricamente y le otorga estrellas.

El alcance del lenguaje es únicamente el vocabulario del mundo 0 (`AVANZA`, `RETROCEDE`,
`GIRADERECHA`, `GIRAIZQUIERDA`, `CENTRO`, `BORRAPANTALLA`) con sus abreviaturas. El AST, el tipo
`Operacion` y el tipo `Nivel` se diseñan para admitir sin rediseño lo que llega en las siete specs
siguientes: `REPITE`, `PARA…FIN`, lápiz y color, variables, aritmética, condicionales y recursión.

Queda **fuera de alcance**: `REPITE` y todo vocabulario de mundos posteriores, generadores de retos,
reproducción en paralelo, insignias, mapa de progreso, desafío infinito, modo libre, modo de bloques
y el catálogo completo de niveles.

### Patrones EARS en español

Cada criterio de aceptación sigue exactamente uno de los seis patrones EARS. Las palabras clave se
escriben en español porque el proyecto entero es en español; la equivalencia es literal:

| Patrón | Forma en este documento | EARS |
|---|---|---|
| Ubicuo | EL/LA \<sistema\> DEBERÁ \<respuesta\> | THE … SHALL |
| Dirigido por evento | CUANDO \<disparador\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHEN … |
| Dirigido por estado | MIENTRAS \<condición\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHILE … |
| Evento no deseado | SI \<condición\>, ENTONCES EL/LA \<sistema\> DEBERÁ \<respuesta\> | IF … THEN … |
| Opcional | DONDE \<opción\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHERE … |
| Complejo | DONDE → MIENTRAS → CUANDO/SI → EL/LA \<sistema\> DEBERÁ | WHERE/WHILE/WHEN/IF … |

## Glossary

Sistemas y módulos (los nombres coinciden con los archivos de `estructura.md`):

- **Proyecto**: el repositorio y su configuración (`package.json`, `tsconfig.json`, `vite.config.ts`,
  `README.md`).
- **Compilacion**: el proceso que ejecuta `npm run build` y la definición de compilación en la nube
  `amplify.yml`.
- **Vocabulario**: `src/lenguaje/vocabulario.ts`. Tabla única de comandos: nombre, abreviatura,
  aridad, mundo de desbloqueo.
- **Lexer**: `src/lenguaje/lexer.ts`. Convierte texto en tokens y normaliza la entrada.
- **Parser**: `src/lenguaje/parser.ts`. Convierte tokens en AST.
- **AST**: árbol sintáctico definido en `src/lenguaje/ast.ts`.
- **Programa**: nodo raíz del AST, resultado de analizar un texto KiroLogo completo.
- **Impresor**: `src/lenguaje/impresor.ts`. Convierte un AST en texto KiroLogo.
- **Interprete**: `src/lenguaje/interprete.ts`. Generador que recorre el AST y emite una Operacion por
  paso.
- **Conteo**: `src/lenguaje/conteo.ts`. Única función que cuenta instrucciones de un AST.
- **Catalogo_Errores**: `src/lenguaje/errores.ts`. Todos los mensajes visibles al jugador.
- **Operacion**: registro inmutable que describe un paso de ejecución de la tortuga.
- **Estado_Tortuga**: posición, rumbo, lápiz abajo o arriba, y visibilidad de la tortuga.
- **Tortuga**: `src/motor/tortuga.ts`. Modelo puro del Estado_Tortuga, sin conocimiento del Canvas.
- **Lienzo**: `src/motor/lienzo.ts`. Lienzo lógico de 800 × 800 unidades con cuadrícula de 20 px y
  dibujo de la estela.
- **Personajes**: `src/motor/personajes.ts`. Render de la tortuga con Kiro montado, con trazos de
  Canvas 2D.
- **Animador**: `src/motor/animador.ts`. Consume Operaciones y las reproduce en el tiempo.
- **Extractor_Segmentos**: `src/motor/segmentos.ts`. Operaciones a lista de segmentos dibujados.
- **Encuadre**: `src/motor/encuadre.ts`. Caja envolvente y verificación de que la figura cabe en el
  Lienzo.
- **Validador**: `src/motor/validador.ts`. Comparación geométrica contra la figura de referencia.
- **PRNG**: `src/azar/prng.ts`. Generador pseudoaleatorio determinista por semilla.
- **Codigo_Semilla**: `src/azar/codigo-semilla.ts`. Conversión entre semilla y código corto
  compartible.
- **Reto**: `src/juego/reto.ts` y el objeto que produce. Resultado de resolver el par
  (idNivel, semilla).
- **Estrellas**: `src/juego/estrellas.ts`. Cálculo de precisión, economía y abstracción.
- **Analisis_Abstraccion**: `src/juego/abstraccion.ts`. Análisis del AST para la estrella de
  abstracción.
- **Progreso**: `src/juego/progreso.ts`. Persistencia en `localStorage`.
- **Nivel**: el dato que describe un nivel, definido en `src/niveles/tipos.ts`.
- **Editor**: `src/ui/editor.ts`. Área de escritura con números de línea.
- **Panel_Comandos**: `src/ui/panel-comandos.ts`. Vocabulario desbloqueado con ejemplos.
- **Demostracion**: `src/ui/demostracion.ts`. Kiro dibuja el reto en vivo.
- **Comparacion**: `src/ui/comparacion.ts`. Lado a lado y superposición.
- **Diff**: `src/ui/diff.ts`. Comparación visual al fallar.
- **Globo_Kiro**: `src/ui/globo-kiro.ts`. Diálogos, pistas y celebración.
- **Controles**: `src/ui/controles.ts`. Ejecutar, paso a paso, velocidad, reiniciar.
- **Juego**: la aplicación completa servida por `index.html` y `src/main.ts`.
- **Suite_Pruebas**: el conjunto de pruebas de Vitest que ejecuta `npm test`.

Términos del dominio:

- **Estela**: el trazo que la tortuga deja con el lápiz abajo.
- **Programa de referencia**: el programa KiroLogo que define el reto de un nivel. En un nivel
  autorado está escrito a mano y es constante.
- **Demostración**: la ejecución animada del programa de referencia frente al jugador.
- **Semilla**: entero que alimenta al PRNG. Identifica un reto junto con el idNivel.
- **IoU**: intersección sobre unión de dos máscaras rasterizadas.
- **Exceso de trazo**: píxeles dibujados por el jugador fuera de la máscara objetivo dilatada,
  expresados como porcentaje del total de píxeles del objetivo.
- **presupuestoEstrella**: conteo de instrucciones del programa de referencia. Umbral de la estrella
  de economía.
- **limiteDuro**: `presupuestoEstrella` más un margen. Desactivado en los mundos 0 a 2.
- **Mundo**: agrupación de niveles que comparte concepto y vocabulario desbloqueado.

## Decisiones cerradas en esta fase

Las cinco decisiones que el prompt de la spec dejó abiertas quedan resueltas así, confirmadas en la
fase de requisitos, y cada una está reflejada en criterios de aceptación:

| # | Decisión | Resolución | Requisito |
|---|---|---|---|
| D1 | Representación de una Operacion | Unión discriminada; **toda** Operacion lleva `paso`, `linea`, `estadoAntes` y `estadoDespues` completos, para que la reproducción en paralelo compare posición y rumbo sin cambiar el tipo | 7 |
| D2 | Rasterizado | Arreglo tipado propio (`Uint8Array` de 800 × 800), sin DOM ni `OffscreenCanvas`, para que el Validador corra en Node bajo Vitest | 16 |
| D3 | Forma del tipo Nivel | `origen` como unión discriminada autorado/generado; `normalizacion`, `abstraccion` y `pistas` declarados; **ningún presupuesto almacenado**, se calculan en el Reto | 18 |
| D4 | Límites y resaltado del Editor | 200 líneas y 10 000 caracteres; `textarea` nativo con canaleta de números de línea, **sin resaltado de sintaxis** en esta spec | 21 |
| D5 | Diseño de los personajes | Conjunto tortuga + Kiro inscrito en 40 unidades; el rumbo se comunica por forma (cabeza, muesca del caparazón y marca de rumbo), nunca por color | 13 |

## Requirements

### Requisito 1: Andamiaje del proyecto y dependencias fijadas

**Historia de usuario:** Como persona que desarrolla KiroLogo, quiero un proyecto Vite con TypeScript
estricto y Vitest ya configurados, para escribir código y pruebas desde el primer minuto sin decidir
herramientas otra vez.

#### Criterios de aceptación

1. EL Proyecto DEBERÁ declarar en `package.json` el campo `name` con el valor `KiroLogo` escrito con
   esa misma combinación de mayúsculas y minúsculas, el campo `license` con el valor `MIT` y el campo
   `private` con el valor `true`.
2. EL Proyecto DEBERÁ declarar en `package.json` el campo `engines.node` con un rango cuyo límite
   inferior es la versión 24 y que admite cualquier versión 24 o superior, y DEBERÁ contener en la raíz
   un archivo `.nvmrc` de una sola línea cuya versión satisface ese rango.
3. EL Proyecto DEBERÁ declarar cada dependencia y cada dependencia de desarrollo de `package.json` con
   una versión exacta de tres componentes numéricos (mayor.menor.parche), sin los prefijos `^`, `~`,
   `>`, `>=`, `<` ni `<=`, sin los comodines `*` ni `x`, sin la etiqueta `latest` y sin rangos unidos
   por `||` ni por `-`.
4. EL Proyecto DEBERÁ declarar en `tsconfig.json` las opciones `strict`, `noUncheckedIndexedAccess` y
   `noImplicitOverride` con el valor `true`, y DEBERÁ mantener los archivos de `src/` libres de las
   directivas de supresión `@ts-nocheck` y `@ts-ignore`.
5. EL Proyecto DEBERÁ exponer en `package.json` los guiones nombrados exactamente `dev`, `build`,
   `preview`, `test` y `typecheck`, donde `test` invoca a Vitest en modo de una sola pasada y
   `typecheck` invoca la comprobación de tipos de TypeScript sin emitir archivos.
6. EL Proyecto DEBERÁ contener `package-lock.json` en la raíz, registrado en el control de versiones y
   sin coincidir con ningún patrón de `.gitignore`.
7. EL Proyecto DEBERÁ contener un `README.md` en la raíz, escrito en español, que incluya el nombre
   `KiroLogo` y una descripción de qué es el juego, el comando literal para levantar el entorno de
   desarrollo, el comando literal para ejecutar las pruebas, y enlaces relativos a `.kiro/steering/` y
   a `docs/` que resuelven a rutas existentes del repositorio.
8. EL Proyecto DEBERÁ crear dentro de `src/` únicamente archivos y directorios cuya ruta esté declarada
   en `estructura.md`, con los nombres en minúsculas y en `kebab-case`, con un módulo presente por cada
   entrada del glosario de esta spec que apunte a `src/`, sin directorios vacíos, y con cada archivo de
   pruebas junto al módulo que prueba y con el sufijo `.test.ts`.
9. EL Proyecto DEBERÁ mantener `src/` y todos sus subdirectorios libres de archivos cuya extensión,
   comparada sin distinguir mayúsculas de minúsculas, sea `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`,
   `.webp` o `.ico`; la verificación abarca solo `src/` y no el directorio `assets/` de la raíz, que
   contiene capturas de pantalla de documentación.
10. SI una dependencia directa o transitiva declara una licencia que no permite redistribuir el
    repositorio bajo MIT (MIT, ISC, BSD y Apache-2.0 se consideran compatibles; el copyleft fuerte al
    estilo GPL o AGPL, no), ENTONCES EL Proyecto DEBERÁ excluirla de `dependencies` y de
    `devDependencies` de `package.json` y ningún módulo de `src/` DEBERÁ importarla.
11. EL Proyecto DEBERÁ mantener los archivos `.ts` de `src/` libres de `eval`, de `new Function` y de
    cualquier invocación del constructor `Function`.
12. CUANDO se ejecuta `npm ci` sobre un clon limpio del repositorio con la versión de Node que declara
    `.nvmrc`, EL Proyecto DEBERÁ instalar todas las dependencias declaradas y terminar sin modificar ni
    regenerar `package-lock.json`.
13. CUANDO se ejecuta `npm test`, LA Suite_Pruebas DEBERÁ ejecutar todas las pruebas en una sola
    pasada, terminar sin quedar a la espera de cambios en los archivos, y devolver un código de salida
    distinto de cero si al menos una prueba falla.
14. CUANDO se ejecuta `npm run typecheck`, EL Proyecto DEBERÁ comprobar los tipos de todos los archivos
    de `src/`, terminar con cero errores y no escribir ningún archivo de salida.

### Requisito 2: Compilación y despliegue en AWS Amplify Hosting

**Historia de usuario:** Como persona que despliega KiroLogo, quiero que la compilación en la nube use
el mismo Node y las mismas dependencias exactas que en local, para que el resultado sea reproducible y
revisable en un diff.

#### Criterios de aceptación

1. EL Proyecto DEBERÁ declarar `base` con el valor `'/'` en `vite.config.ts`.
2. CUANDO se ejecuta `npm run build`, LA Compilacion DEBERÁ terminar con código de salida 0 y generar
   el directorio `dist` con un `index.html` en su raíz cuyas referencias a los archivos generados
   comiencen todas con `/`, sin rutas relativas.
3. CUANDO se sirve el contenido de `dist` desde la raíz de un servidor estático, EL Juego DEBERÁ quedar
   jugable en 3 segundos o menos —entendiendo por jugable que dibuja la cuadrícula, acepta texto en el
   editor y ejecuta el programa dibujando la estela— sin registrar ningún mensaje de nivel error en la
   consola del navegador.
4. EL Proyecto DEBERÁ contener `amplify.yml` versionado en la raíz del repositorio, con la definición
   completa de las fases `preBuild` y `build`, de los artefactos y de la caché, de modo que ninguna
   etapa dependa de valores configurados únicamente en la consola de AWS Amplify.
5. EL archivo `amplify.yml` DEBERÁ declarar `npm ci` en la fase `preBuild` y `npm run build` en la fase
   `build`, sin ninguna invocación de `npm install`.
6. EL archivo `amplify.yml` DEBERÁ fijar la versión de Node en la fase `preBuild` invocando `nvm` con
   la versión leída del archivo `.nvmrc`, sin escribir ningún número de versión literal en el archivo,
   de modo que la versión de Node activa al iniciar la fase `build` sea la que declara `.nvmrc`.
7. EL archivo `amplify.yml` DEBERÁ declarar `artifacts.baseDirectory` con el valor `dist`, incluir en
   los artefactos todos los archivos de ese directorio y declarar `node_modules` entre las rutas de
   caché.
8. LA Compilacion DEBERÁ producir un `dist` sin ningún archivo con las extensiones `.png`, `.jpg`,
   `.jpeg`, `.gif`, `.svg`, `.webp` ni `.ico`, dado que la tortuga y Kiro se dibujan con trazos de
   Canvas 2D.
9. LA Compilacion DEBERÁ producir un `dist` que no contenga ningún archivo proveniente del directorio
   `assets/` de la raíz del repositorio —capturas de pantalla de documentación, no activos del Juego—,
   con independencia del nombre que el empaquetador dé a sus propios directorios de salida dentro de
   `dist`.
10. DONDE EL Juego se sirva con una política de seguridad de contenido que omite la directiva
    `unsafe-eval`, EL Juego DEBERÁ completar la demostración y la ejecución del programa del jugador
    sin registrar ninguna violación de la política en la consola del navegador.
11. SI `npm run build` encuentra un error de tipos de TypeScript o un error de empaquetado, ENTONCES LA
    Compilacion DEBERÁ terminar con un código de salida distinto de 0, informar el archivo y la línea
    del error, y no dejar en `dist` artefactos parciales de esa ejecución.
12. SI `package-lock.json` no concuerda con las dependencias declaradas en `package.json`, ENTONCES LA
    Compilacion DEBERÁ detenerse en la fase `preBuild` con un error que identifique la discrepancia, y
    no DEBERÁ instalar ninguna versión distinta de las fijadas.
13. CUANDO LA Compilacion se ejecuta dos veces sobre la misma confirmación del repositorio, LA
    Compilacion DEBERÁ producir en `dist` el mismo conjunto de nombres de archivo con el mismo
    contenido byte a byte.

### Requisito 3: Vocabulario del mundo 0 como fuente única de verdad

**Historia de usuario:** Como persona que desarrolla KiroLogo, quiero que los comandos se declaren en
un solo lugar, para que agregar un comando no obligue a tocar el lexer, el panel de la interfaz y los
mensajes de error por separado.

#### Criterios de aceptación

1. EL Vocabulario DEBERÁ declarar exactamente seis entradas con mundo de desbloqueo 0: `AVANZA` con
   abreviatura `AV`, `RETROCEDE` con `RE`, `GIRADERECHA` con `GD` y `GIRAIZQUIERDA` con `GI`, cada una
   con aridad 1 y su único argumento de tipo número; y `CENTRO` con `CE` y `BORRAPANTALLA` con `BP`,
   cada una con aridad 0.
2. EL Vocabulario DEBERÁ declarar, para cada entrada, su nombre largo, su abreviatura, su aridad, el
   tipo de cada argumento tomado de un conjunto cerrado declarado en el propio Vocabulario, su mundo de
   desbloqueo como entero de 0 a 5, una descripción en español no vacía de 120 caracteres o menos en
   una sola línea, y un ejemplo de uso que, para las entradas de mundo 0, EL Lexer y EL Parser analizan
   sin ningún error.
3. EL Vocabulario DEBERÁ declarar los comandos que el steering `lenguaje-kirologo` lista para los
   mundos 1 a 5, cada uno con su abreviatura cuando la tiene, con su mundo de desbloqueo como entero de
   1 a 5 y marcado como no ejecutable en esta spec, para que EL Catalogo_Errores pueda informar que un
   comando existe pero está bloqueado.
4. EL Lexer, EL Parser, EL Panel_Comandos y EL Catalogo_Errores DEBERÁN reconocer todo nombre largo,
   toda abreviatura, toda aridad y todo mundo de desbloqueo consultando al Vocabulario, sin mantener
   ninguna lista propia de los comandos del lenguaje.
5. SI dos entradas del Vocabulario coinciden, tras convertir a mayúsculas y eliminar los acentos, en su
   nombre largo, en su abreviatura, o entre el nombre largo de una y la abreviatura de la otra,
   ENTONCES LA Suite_Pruebas DEBERÁ fallar nombrando las dos entradas en conflicto y el texto que
   comparten.
6. CUANDO se consulta al Vocabulario con una palabra, EL Vocabulario DEBERÁ compararla convertida a
   mayúsculas y sin acentos contra los nombres largos y las abreviaturas declaradas, y devolver la
   única entrada que coincide con su aridad, sus tipos de argumento y su mundo de desbloqueo.
7. SI la palabra consultada no coincide con ningún nombre largo ni ninguna abreviatura del Vocabulario,
   ENTONCES EL Vocabulario DEBERÁ devolver un resultado explícito de palabra no declarada, sin lanzar
   una excepción y sin elegir un mensaje, dejando esa decisión al Catalogo_Errores.
8. CUANDO se consulta al Vocabulario por los comandos de un mundo, EL Vocabulario DEBERÁ devolver todas
   las entradas cuyo mundo de desbloqueo es menor o igual a ese mundo, ninguna entrada de un mundo
   posterior, y siempre en el mismo orden.

### Requisito 4: Análisis léxico y normalización de la entrada

**Historia de usuario:** Como jugador hispanohablante, quiero que un acento, una minúscula o una coma
decimal no me cuesten un nivel, para concentrarme en la lógica del programa.

#### Criterios de aceptación

1. CUANDO EL Lexer recibe un texto de hasta 200 líneas y hasta 10 000 caracteres, EL Lexer DEBERÁ
   producir una lista de tokens donde cada token lleva su tipo, tomado del conjunto `comando`,
   `identificador`, `numero`, `palabra`, `parametro`, `corchete_abre` y `corchete_cierra`; su valor
   normalizado; su texto original tal como se escribió; su número de línea contado desde 1; y su
   número de columna contado desde 1 en caracteres.
2. CUANDO EL Lexer encuentra una palabra, EL Lexer DEBERÁ normalizarla convirtiéndola a mayúsculas y
   reemplazando las vocales acentuadas `á`, `é`, `í`, `ó`, `ú` y la vocal con diéresis `ü` por `A`,
   `E`, `I`, `O`, `U` y `U`, compararla contra el nombre largo y la abreviatura de todas las entradas
   del Vocabulario sin importar su mundo de desbloqueo, y producir un token `comando` cuando alguna
   entrada coincide o un token `identificador` cuando ninguna coincide, de modo que `avanza`, `AVANZA`
   y `Avanzá` produzcan el mismo tipo y el mismo valor normalizado `AVANZA`, cada uno con su propio
   texto original.
3. EL Lexer DEBERÁ aceptar las letras `ñ` y `Ñ` en cualquier posición de un identificador, de una
   palabra con comilla inicial y de un nombre de parámetro, normalizándolas a `Ñ` y nunca a `N`, de
   modo que `AÑO` y `ANO` produzcan valores normalizados distintos.
4. CUANDO EL Lexer encuentra un número, EL Lexer DEBERÁ producir un token `numero` con el mismo valor
   numérico tanto si el separador decimal es coma como si es punto, aceptando valores sin signo desde
   0 hasta 999 999 con hasta cuatro cifras decimales, un solo separador decimal y al menos un dígito
   a cada lado del separador, y DEBERÁ conservar en el texto original el separador que el jugador
   escribió.
5. CUANDO EL Lexer encuentra el carácter `#`, EL Lexer DEBERÁ descartar sin emitir tokens todos los
   caracteres desde ese `#` hasta el siguiente fin de línea (reconociendo como fin de línea tanto el
   salto de línea solo como el retorno de carro seguido de salto de línea), o hasta el final del texto
   si no hay más saltos de línea, y DEBERÁ conservar la numeración de línea de los tokens posteriores.
6. EL Lexer DEBERÁ producir un token `corchete_abre` para `[`, un token `corchete_cierra` para `]`, un
   token `palabra` para la forma con comilla inicial al estilo `"naranja` y un token `parametro` para
   la forma `:largo`, con el valor normalizado sin la comilla ni los dos puntos iniciales y con la
   misma normalización de mayúsculas, acentos y `ñ` de los criterios 2 y 3, y sin reportar error
   aunque el mundo 0 no use esas formas.
7. SI EL Lexer encuentra un carácter distinto de una letra del alfabeto español (incluidas las vocales
   acentuadas, `ü`, `ñ` y `Ñ`), de un dígito de `0` a `9`, de un separador decimal dentro de un número,
   de `[`, `]`, `"`, `:`, `#`, del espacio, del tabulador, del retorno de carro y del salto de línea,
   ENTONCES EL Lexer DEBERÁ reportar un error del Catalogo_Errores indicando el carácter, su número de
   línea y su número de columna, descartar ese carácter y continuar el análisis del resto del texto.
8. SI EL Lexer encuentra un número con más de un separador decimal o sin dígito a alguno de los lados
   del separador, o una comilla inicial o unos dos puntos sin al menos una letra o un dígito a
   continuación, ENTONCES EL Lexer DEBERÁ reportar un error del Catalogo_Errores indicando el texto
   recibido, su número de línea y su número de columna, descartar ese fragmento y continuar el
   análisis del resto del texto.
9. SI EL Lexer termina el análisis de un texto con uno o más errores, ENTONCES EL Lexer DEBERÁ
   devolver todos los errores ordenados por número de línea y luego por número de columna, junto con
   los tokens que sí reconoció.
10. CUANDO EL Lexer recibe un texto vacío o compuesto únicamente por espacios, tabuladores, saltos de
    línea y comentarios, EL Lexer DEBERÁ producir una lista de tokens vacía sin reportar ningún error.

### Requisito 5: AST, parser y puntos de extensión

**Historia de usuario:** Como persona que desarrolla las siete specs siguientes, quiero un AST que ya
admita `REPITE`, procedimientos, variables, aritmética, condicionales y recursión, para no rediseñar
el lenguaje en el mundo 1.

#### Criterios de aceptación

1. CUANDO EL Parser recibe la lista de tokens de un programa válido del mundo 0 de hasta 200 líneas y
   10 000 caracteres, EL Parser DEBERÁ producir un Programa cuyos nodos pertenezcan únicamente a los
   tipos del mundo 0 (invocación de comando y argumento numérico literal) y cuya lista de
   instrucciones contenga, en el orden de aparición en el texto, un nodo por cada comando escrito con
   el nombre largo del Vocabulario, con su argumento numérico cuando su aridad es 1, y con el número
   de línea y el número de columna de su primer token contados desde 1, admitiendo la lista vacía
   cuando el texto solo contiene comentarios o líneas en blanco.
2. EL AST DEBERÁ definir nueve tipos de nodo para las capacidades futuras (repetición, definición de
   procedimiento, invocación de procedimiento, referencia a parámetro, expresión aritmética,
   condicional de una rama, condicional de dos ramas, interrupción y devolución de valor), cada uno
   con su discriminante de tipo y con sus campos de línea y de columna, integrados en la unión de
   nodos del AST y sin que ninguna regla del Parser de esta spec los produzca.
3. EL AST DEBERÁ acompañar en `src/lenguaje/ast.ts` cada uno de los nueve tipos de nodo del criterio 2
   con un comentario que nombre la capacidad del lenguaje y el número de la spec que la implementa.
4. SI EL Parser, con el mundo del Nivel en curso recibido como parámetro, encuentra una palabra que el
   Vocabulario declara para un mundo posterior a ese, ENTONCES EL Parser DEBERÁ reportar el error de
   comando bloqueado del Catalogo_Errores nombrando el comando escrito, el número del mundo que lo
   desbloquea y el número de línea, sin producir ningún nodo para esa palabra.
5. SI un comando de aridad 1 no va seguido de ningún token de argumento, porque la lista de tokens
   termina o porque el siguiente token es otro comando del Vocabulario, ENTONCES EL Parser DEBERÁ
   reportar el error de argumento faltante del Catalogo_Errores nombrando el comando, su ejemplo de
   uso declarado en el Vocabulario y el número de línea del comando.
6. SI el token que sigue a un comando de aridad 1 es de un tipo distinto del que declara el
   Vocabulario (palabra, palabra con comilla, identificador de parámetro o corchete), ENTONCES EL
   Parser DEBERÁ reportar el error de tipo del Catalogo_Errores nombrando el comando, el texto
   original del token recibido y el número de línea.
7. SI EL Parser llega al final de la lista de tokens con uno o más corchetes sin cerrar, ENTONCES EL
   Parser DEBERÁ reportar el error de corchete sin cerrar del Catalogo_Errores nombrando la línea y la
   columna del corchete de apertura más externo que quedó pendiente.
8. CUANDO EL Parser reporta un error, EL Parser DEBERÁ descartar los tokens restantes de la
   instrucción donde ocurrió y reanudar el análisis en el siguiente token que el Vocabulario declara
   como comando, en lugar de detenerse en el primer error, de modo que la misma lista de tokens
   produzca siempre la misma secuencia de errores.
9. SI el análisis de una lista de tokens produce al menos un error, ENTONCES EL Parser DEBERÁ devolver
   un resultado sin Programa ejecutable, con los errores acumulados hasta un máximo de 20, ordenados
   por número de línea ascendente y, a igual línea, por número de columna ascendente, en lugar de
   lanzar una excepción.
10. SI EL Parser encuentra, donde espera un comando, un corchete de apertura, un identificador de
    parámetro al estilo `:largo`, una palabra con comilla al estilo `"naranja` o un número sin un
    comando que lo reciba, ENTONCES EL Parser DEBERÁ reportar el error correspondiente del
    Catalogo_Errores nombrando el texto original del token, su número de línea y su número de columna.
11. SI EL Parser encuentra un corchete de cierre sin un corchete de apertura pendiente, ENTONCES EL
    Parser DEBERÁ reportar el error de corchete de más del Catalogo_Errores nombrando la línea del
    corchete de cierre.

### Requisito 6: Impresor de KiroLogo y propiedad de ida y vuelta

**Historia de usuario:** Como persona que desarrolla KiroLogo, quiero poder convertir un AST de vuelta
a texto, para mostrar esqueletos de código en las pistas y para verificar el parser con una propiedad
de ida y vuelta.

#### Criterios de aceptación

1. CUANDO EL Impresor recibe un Programa, EL Impresor DEBERÁ producir texto KiroLogo con el nombre
   largo en mayúsculas que declara EL Vocabulario para cada comando, una sola instrucción por línea,
   un espacio entre el nombre del comando y cada uno de sus argumentos, sangría de dos espacios por
   nivel de anidación, cada línea terminada con un único salto de línea y sin espacios en blanco al
   final de ninguna línea, de modo que un Programa analizado del texto `av 100` se imprima como
   `AVANZA 100`.
2. CUANDO EL Impresor escribe un argumento numérico, EL Impresor DEBERÁ usar el punto como separador
   decimal, omitir el signo `+`, omitir los ceros a la derecha del último decimal significativo y
   escribir las cifras decimales necesarias para que EL Lexer recupere exactamente el mismo valor
   numérico, de modo que un Programa analizado del texto `av 10,50` se imprima como `AVANZA 10.5`.
3. PARA TODO Programa válido del mundo 0 de hasta 200 instrucciones, EL Impresor DEBERÁ producir un
   texto que, al pasar de nuevo por EL Lexer y EL Parser, produzca un Programa con la misma secuencia
   de nodos, el mismo comando en cada nodo y argumentos numéricos exactamente iguales a los del
   Programa de origen, difiriendo únicamente en el número de línea y de columna de cada nodo
   (propiedad de ida y vuelta).
4. PARA TODO Programa válido del mundo 0 de hasta 200 instrucciones, EL Conteo DEBERÁ devolver el
   mismo número para el Programa de origen y para el Programa resultante de imprimirlo y volverlo a
   analizar.
5. PARA TODO Programa válido del mundo 0 de hasta 200 instrucciones, EL Impresor DEBERÁ producir un
   texto que, al analizarse de nuevo con EL Lexer y EL Parser y volver a imprimirse, resulte idéntico
   carácter por carácter al texto de la primera impresión (idempotencia del formato).
6. SI EL Impresor recibe un Programa que contiene un nodo de una capacidad reservada para una spec
   posterior o un comando que EL Vocabulario no declara, ENTONCES EL Impresor DEBERÁ reportar el error
   correspondiente del Catalogo_Errores nombrando el tipo de nodo no admitido, sin devolver texto
   parcial.
7. LA Suite_Pruebas DEBERÁ verificar las propiedades de ida y vuelta, de igualdad de Conteo y de
   idempotencia del formato sobre al menos 200 Programas construidos con EL PRNG a partir de 200
   semillas explícitas, de 0 a 50 instrucciones cada uno, con argumentos numéricos sin signo en el
   intervalo de 0 a 999 999 y hasta 3 cifras decimales, que en conjunto cubran los seis comandos del
   mundo 0 y sus abreviaturas.

### Requisito 7: Intérprete como generador de operaciones

**Historia de usuario:** Como persona que desarrolla KiroLogo, quiero un único flujo de operaciones
que alimente la animación, el paso a paso, la validación y la futura reproducción en paralelo, para no
tener dos implementaciones de la ejecución que se desincronicen.

#### Criterios de aceptación

1. EL Interprete DEBERÁ implementarse como una función generadora que recibe un Programa, el
   Estado_Tortuga inicial, el conjunto de comandos permitidos y la semilla; que emite exactamente una
   Operacion por cada instrucción que ejecuta, en el orden en que las instrucciones aparecen en el
   Programa; que suspende la ejecución tras emitir cada Operacion hasta que el consumidor pide la
   siguiente; y que, cuando el Programa no tiene ninguna instrucción, termina sin emitir ninguna
   Operacion y sin reportar ningún error.
2. LA Operacion DEBERÁ ser una unión discriminada por el campo `tipo` con exactamente seis casos
   declarados —`mover`, `girar`, `lapiz`, `visibilidad`, `limpiar` y `reubicar`—, donde los casos
   `lapiz` y `visibilidad` quedan declarados con todos sus campos pero ninguna ejecución de un
   Programa del mundo 0 los emite, de modo que la secuencia de Operaciones de todo Programa del mundo
   0 contenga únicamente casos `mover`, `girar`, `limpiar` y `reubicar`.
3. TODA Operacion DEBERÁ llevar el índice de paso contado desde 0 y creciendo de 1 en 1, sin saltos ni
   repeticiones dentro de una misma ejecución; el número de línea del código de origen contado desde
   1, igual al del nodo del AST que la produjo; la profundidad de invocación como entero de 0 a 100,
   con el valor 0 en las instrucciones del cuerpo principal del Programa; y el Estado_Tortuga anterior
   y el Estado_Tortuga posterior con sus cuatro campos completos —posición en coordenadas del Lienzo
   lógico, rumbo en grados, indicador de lápiz abajo e indicador de visibilidad—, de modo que el
   Estado_Tortuga posterior de cada Operacion sea igual campo por campo al Estado_Tortuga anterior de
   la Operacion siguiente, y el Estado_Tortuga anterior de la primera Operacion sea igual al
   Estado_Tortuga inicial recibido.
4. LA Operacion de tipo `mover` DEBERÁ llevar el punto de partida, el punto de llegada y el indicador
   de lápiz vigente durante el desplazamiento, con los dos puntos en coordenadas del Lienzo lógico y
   registrados tal como se calcularon aunque queden fuera de los límites del Lienzo, sin recortarlos
   ni ajustarlos, y DEBERÁ emitirse también cuando el desplazamiento tiene longitud 0, de modo que EL
   Extractor_Segmentos obtenga cada segmento de la propia Operacion sin reinterpretar el AST.
5. LA Operacion DEBERÁ ser serializable a JSON sin pérdida, entendiendo por sin pérdida que al
   convertirla a texto JSON y volver a leerla se obtiene un valor igual campo por campo al original;
   para ello TODA Operacion DEBERÁ contener únicamente números finitos, booleanos, cadenas y objetos
   simples, sin funciones, sin campos de valor `undefined`, sin referencias cíclicas y sin los valores
   no finitos `NaN`, `Infinity` ni `-Infinity`.
6. CUANDO EL Interprete ejecuta dos veces el mismo Programa con el mismo Estado_Tortuga inicial y la
   misma semilla, EL Interprete DEBERÁ emitir dos secuencias de Operacion de la misma longitud e
   iguales campo por campo, con valores numéricos exactamente iguales, tomando todo valor aleatorio
   del PRNG sembrado con esa semilla y ninguno de una fuente sin semilla, y sin que la primera
   ejecución modifique el Programa ni el Estado_Tortuga recibidos.
7. CUANDO EL Interprete ejecuta `CENTRO`, EL Interprete DEBERÁ emitir exactamente una Operacion
   `reubicar` cuyo Estado_Tortuga posterior deja la posición en el centro del Lienzo lógico y el rumbo
   en 0 grados, conserva sin cambios el indicador de lápiz y el de visibilidad del Estado_Tortuga
   anterior, y no aporta ningún segmento al Extractor_Segmentos, cualesquiera que sean la posición y
   el rumbo anteriores.
8. CUANDO EL Interprete ejecuta `BORRAPANTALLA`, EL Interprete DEBERÁ emitir exactamente una Operacion
   `limpiar` que descarta los segmentos acumulados por las Operaciones anteriores de la misma
   ejecución, cuyo Estado_Tortuga posterior deja la posición en el centro del Lienzo lógico y el rumbo
   en 0 grados, que conserva sin cambios el indicador de lápiz y el de visibilidad del Estado_Tortuga
   anterior, y que no aporta ningún segmento nuevo.
9. EL Interprete DEBERÁ expresar todo rumbo en grados y nunca en radianes, y DEBERÁ normalizar el
   rumbo del Estado_Tortuga posterior al intervalo de 0 grados inclusive a 360 grados exclusive, con
   el rumbo 0 apuntando hacia arriba, sumando los grados de `GIRADERECHA` y restando los de
   `GIRAIZQUIERDA`, de modo que un rumbo calculado de 360 grados o de cualquier múltiplo de 360 se
   registre como 0 y un rumbo calculado negativo se registre como su equivalente dentro de ese
   intervalo.
10. EL Interprete DEBERÁ recibir en cada ejecución, como parámetro explícito, el conjunto de comandos
    permitidos que EL Vocabulario devuelve para el mundo del Nivel, y DEBERÁ resolver cada invocación
    consultando únicamente ese conjunto, sin mantener ninguna lista propia de comandos y sin leer
    ningún valor global ni ningún valor predeterminado.
11. CUANDO EL Interprete ejecuta `AVANZA` o `RETROCEDE` con su argumento numérico, EL Interprete
    DEBERÁ emitir exactamente una Operacion `mover` que desplaza la tortuga esa distancia en unidades
    del Lienzo lógico, en el sentido del rumbo vigente para `AVANZA` y en el sentido opuesto para
    `RETROCEDE`, y cuyo Estado_Tortuga posterior conserva sin cambios el rumbo, el indicador de lápiz
    y el de visibilidad del anterior.
12. CUANDO EL Interprete ejecuta `GIRADERECHA` o `GIRAIZQUIERDA` con su argumento numérico, EL
    Interprete DEBERÁ emitir exactamente una Operacion `girar` que lleva los grados solicitados y el
    sentido del giro, y cuyo Estado_Tortuga posterior conserva sin cambios la posición, el indicador
    de lápiz y el de visibilidad del anterior.
13. SI EL Interprete encuentra en el Programa una invocación cuyo comando no está en el conjunto de
    comandos permitidos, o un nodo de una capacidad reservada para una spec posterior, ENTONCES EL
    Interprete DEBERÁ terminar la ejecución sin emitir ninguna Operacion para ese nodo, reportar el
    error correspondiente del Catalogo_Errores nombrando el comando o el tipo de nodo y su número de
    línea, y conservar sin modificar las Operaciones ya emitidas.

### Requisito 8: Guardas de ejecución

**Historia de usuario:** Como jugador, quiero que un programa mal escrito me dé un mensaje que explica
qué pasó, en lugar de colgar la pestaña del navegador.

#### Criterios de aceptación

1. SI la ejecución en curso necesita emitir la Operacion número 200 001, contadas desde 1 dentro de esa
   ejecución y sin descontar las Operaciones `limpiar` ni las emitidas antes de ellas, ENTONCES EL
   Interprete DEBERÁ detenerse sin emitir esa Operacion, terminar el generador sin lanzar ninguna
   excepción y reportar el error de guarda de pasos del Catalogo_Errores.
2. SI la ejecución en curso necesita entrar al nivel de profundidad de invocación 101, contando 0 para
   las instrucciones del Programa raíz, ENTONCES EL Interprete DEBERÁ detenerse antes de ejecutar la
   primera instrucción de ese nivel, terminar el generador sin lanzar ninguna excepción y reportar el
   error de guarda de recursión del Catalogo_Errores nombrando el procedimiento cuya invocación excedió
   el límite y el número de línea de esa invocación, o únicamente el número de línea cuando el nodo de
   invocación no declara nombre, sin dejar ningún hueco de sustitución vacío en el mensaje.
3. MIENTRAS una ejecución está en curso, EL Interprete DEBERÁ comprobar el tiempo transcurrido desde el
   inicio de esa ejecución con una fuente de tiempo monótona, al menos una vez cada 1 000 Operaciones
   emitidas y una vez antes de entrar a cada nivel de invocación, y en la primera comprobación que
   arroje más de 5 000 milisegundos DEBERÁ detenerse, terminar el generador sin lanzar ninguna excepción
   y reportar el error de guarda de tiempo del Catalogo_Errores.
4. CUANDO una guarda se activa, EL Interprete DEBERÁ devolver todas las Operaciones emitidas antes de la
   activación en su orden de emisión, sin modificar ninguno de sus campos, con sus índices de paso
   consecutivos desde 0 y sin ninguna Operacion incompleta, junto con un resultado explícito que
   identifica cuál de las tres guardas se activó, para que la estela parcial siga visible en el Lienzo.
5. CUANDO una guarda se activa, EL Globo_Kiro DEBERÁ mostrar en 1 000 milisegundos o menos el texto que
   EL Catalogo_Errores declara para esa guarda, en español y sin ningún nombre de excepción, traza de
   pila ni código numérico de error, y DEBERÁ mantenerlo visible hasta que EL jugador vuelva a ejecutar
   o pulse reiniciar.
6. MIENTRAS una ejecución está en curso, CUANDO EL jugador pulsa el control de detener, EL Juego DEBERÁ
   dejar de consumir Operaciones en 100 milisegundos o menos, conservar en el Lienzo la estela dibujada
   hasta ese punto y no mostrar ningún mensaje de guarda, porque la detención la pidió el jugador.
7. LA Suite_Pruebas DEBERÁ verificar cada una de las tres guardas con dos Programas sintéticos
   construidos con nodos del AST, sin pasar por EL Editor porque `REPITE` y la recursión no están
   disponibles en esta spec: un caso en el límite que termina sin error (200 000 Operaciones emitidas,
   100 niveles de invocación anidados, comprobación de tiempo que arroja exactamente 5 000
   milisegundos) y un caso una unidad por encima que activa la guarda (200 001 Operaciones, 101 niveles,
   más de 5 000 milisegundos), comprobando en cada caso el número de Operaciones devueltas y el texto
   exacto del mensaje del Catalogo_Errores.
8. EL Interprete DEBERÁ recibir la fuente de tiempo monótona como parámetro, para que LA Suite_Pruebas
   pueda fijar el tiempo transcurrido y verificar la guarda de tiempo sin esperar 5 segundos reales y
   sin depender del reloj de la máquina.
9. SI en el mismo paso se cumplen las condiciones de dos o más guardas, ENTONCES EL Interprete DEBERÁ
   reportar exactamente un error, eligiendo la guarda de pasos antes que la de recursión y la de
   recursión antes que la de tiempo, de modo que la misma ejecución reporte siempre la misma guarda.
10. CUANDO EL Interprete comienza a ejecutar un Programa, EL Interprete DEBERÁ poner en cero el contador
    de Operaciones, la profundidad de invocación y el origen de la medición de tiempo, sin arrastrar los
    valores de ninguna ejecución anterior.

### Requisito 9: Conteo de instrucciones como fuente única del presupuesto

**Historia de usuario:** Como jugador, quiero que el número de instrucciones que veo mientras escribo
sea exactamente el que se usa para evaluarme, para que la estrella de economía sea justa.

#### Criterios de aceptación

1. CUANDO EL Conteo recibe un Programa de hasta 200 instrucciones escritas y hasta 20 niveles de
   anidación, EL Conteo DEBERÁ devolver, en 50 milisegundos o menos, un entero mayor o igual que 0 que
   suma 1 por cada instrucción escrita —invocación de un comando del Vocabulario de cualquier aridad,
   invocación de un procedimiento, interrupción y devolución de valor—, con independencia de si se
   escribió con el nombre largo o con la abreviatura y de si aparece en el nivel superior del Programa,
   en el cuerpo escrito de una repetición, en una de las listas de un condicional o en el cuerpo de una
   definición de procedimiento, y DEBERÁ devolver 0 cuando la lista de instrucciones del Programa está
   vacía.
2. EL Conteo DEBERÁ contar un nodo de repetición como 1 más el conteo de las instrucciones de su cuerpo
   escrito, sin multiplicar por el número de iteraciones y sin sumar nada por la expresión que fija ese
   número, devolviendo el mismo entero cuando ese número es 0, cuando es 36 y cuando es una expresión
   que no es un número literal, y DEBERÁ contar el cuerpo escrito de cada repetición anidada una sola
   vez.
3. EL Conteo DEBERÁ contar un nodo condicional de una rama como 1 más el conteo de las instrucciones de
   su única lista, y un nodo condicional de dos ramas como 1 más el conteo de las instrucciones de sus
   dos listas, contando 0 por la condición evaluada y 0 por una lista vacía.
4. EL Conteo DEBERÁ contar 0 por la cabecera de una definición de procedimiento —su nombre y sus
   parámetros—, contar las instrucciones de su cuerpo una sola vez aunque el procedimiento no se invoque
   nunca, y contar 1 por cada invocación del procedimiento con independencia del número de argumentos,
   incluida la invocación escrita dentro del cuerpo del propio procedimiento, sin volver a contar el
   cuerpo por causa de esa invocación.
5. EL Conteo DEBERÁ contar 0 por cada nodo que solo puede aparecer como argumento —número literal,
   referencia a parámetro y expresión aritmética—, y DEBERÁ devolver el mismo entero para dos Programas
   analizados de dos textos que difieren únicamente en comentarios, en líneas vacías, en espacios de
   sangría o en el reparto de las instrucciones entre líneas, dado que ninguno de esos elementos produce
   nodos en EL AST.
6. EL Editor, EL Reto y LAS Estrellas DEBERÁN obtener su número invocando la única función de conteo que
   expone EL Conteo, sin recorrer EL AST por su cuenta, de modo que para un mismo Programa el número que
   muestra EL Editor, el `presupuestoEstrella` que devuelve EL Reto y el número con el que LAS Estrellas
   evalúan la economía sean el mismo entero.
7. CUANDO EL Conteo recibe un Programa armado con nodos del AST equivalente al texto
   `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]`, EL Conteo DEBERÁ devolver 5: dos nodos de repetición,
   una invocación de `AVANZA` y dos de `GIRADERECHA`.
8. CUANDO EL Conteo recibe un Programa armado con nodos del AST equivalente al texto de una definición
   de procedimiento `CUADRADO` con el cuerpo `REPITE 4 [AV 100 GD 90]` seguida de dos invocaciones de
   `CUADRADO`, EL Conteo DEBERÁ devolver 5: 0 por la cabecera, 3 por el cuerpo contado una sola vez y 1
   por cada una de las dos invocaciones.
9. CUANDO EL Conteo recibe dos veces el mismo Programa, EL Conteo DEBERÁ devolver el mismo entero en las
   dos invocaciones y dejar el Programa recibido sin ninguna modificación.
10. SI EL Conteo encuentra en el Programa un nodo cuyo discriminante de tipo no pertenece a la unión de
    nodos que declara EL AST, ENTONCES EL Conteo DEBERÁ reportar el error correspondiente del
    Catalogo_Errores nombrando el discriminante recibido, sin devolver ningún conteo parcial.

### Requisito 10: Catálogo de mensajes de error en español

**Historia de usuario:** Como jugador que se equivoca, quiero un mensaje que me diga qué no entendió
la tortuga y qué probar, en lugar de un error de sintaxis genérico.

#### Criterios de aceptación

1. EL Catalogo_Errores DEBERÁ declarar en `src/lenguaje/errores.ts` una entrada por cada situación de
   error que esta spec puede reportar, cada una con un identificador estable, la lista de parámetros
   que rellenan su texto y una función que devuelve el texto ya rellenado; y EL Lexer, EL Parser y EL
   Interprete DEBERÁN obtener de esas funciones todo texto visible al jugador, sin declarar en sus
   propios archivos ninguna cadena en español dirigida al jugador.
2. CUANDO EL Parser encuentra una palabra desconocida cuya distancia de edición de Levenshtein mínima
   —calculada en mayúsculas y sin acentos contra los nombres largos y las abreviaturas de los comandos
   desbloqueados en el mundo en curso— es 2 o menor para un candidato de 4 caracteres o más, o es 1
   para un candidato de 3 caracteres o menos, EL Catalogo_Errores DEBERÁ producir el mensaje que nombra
   la palabra con el texto original que el jugador escribió y sugiere un solo comando por su nombre
   largo en mayúsculas, con la forma `No sé cómo hacer AVANSA. ¿Querías decir AVANZA?`, eligiendo el
   candidato de menor distancia y deshaciendo los empates primero a favor del nombre largo sobre la
   abreviatura y después por el orden en que EL Vocabulario devuelve sus entradas.
3. CUANDO EL Parser encuentra una palabra desconocida que coincide, en mayúsculas y sin acentos, con
   una entrada de la tabla cerrada de comandos de Logo en inglés que EL Catalogo_Errores declara —al
   menos `FD` y `FORWARD` para `AVANZA`, `BK` y `BACK` para `RETROCEDE`, `RT` y `RIGHT` para
   `GIRADERECHA`, `LT` y `LEFT` para `GIRAIZQUIERDA`, `HOME` para `CENTRO`, `CS` y `CLEARSCREEN` para
   `BORRAPANTALLA`, y `REPEAT` para `REPITE`—, EL Catalogo_Errores DEBERÁ producir el mensaje que da el
   equivalente en español por su nombre largo, con la forma `No sé hacer FD. En KiroLogo se dice
   AVANZA.`, sin sugerir ningún otro comando.
4. CUANDO EL Parser encuentra una palabra que coincide con el nombre largo o con la abreviatura de una
   entrada del Vocabulario cuyo mundo de desbloqueo es mayor que el mundo en curso, EL
   Catalogo_Errores DEBERÁ producir el mensaje que nombra esa entrada por su nombre largo en mayúsculas
   y el número entero de su mundo de desbloqueo, con la forma `REPITE todavía no está disponible. Se
   desbloquea en el mundo 1.`, sin sugerir ningún otro comando.
5. SI la distancia de edición mínima de una palabra desconocida a todo nombre largo y a toda
   abreviatura del Vocabulario supera el umbral del criterio 2, ENTONCES EL Catalogo_Errores DEBERÁ
   producir el mensaje que nombra la palabra con el texto original que el jugador escribió y termina
   ahí, con la forma `No sé cómo hacer PINTA.`, sin nombrar ningún comando ni añadir oración de
   sugerencia.
6. TODO mensaje del Catalogo_Errores DEBERÁ estar escrito en español, ocupar una sola línea de 200
   caracteres o menos, conservar las tildes y el signo de apertura `¿` cuando contiene una pregunta,
   dirigirse al jugador en segunda persona, y no contener códigos de error, nombres de excepción,
   nombres de archivo ni nombres de función; DEBERÁ nombrar el número de línea dentro del texto
   únicamente en los mensajes cuya forma fija lo nombra, y TODO error del Catalogo_Errores DEBERÁ
   transportar además, como campos aparte, el identificador de la situación y la línea y la columna
   contadas desde 1 cuando el error tiene posición en el texto.
7. EL Catalogo_Errores DEBERÁ declarar los mensajes de las tres guardas de ejecución: la guarda de
   pasos con el texto `Detuve la ejecución: la tortuga llevaba demasiados pasos. ¿Hay una repetición
   que nunca termina?`; la guarda de recursión con el texto `Detuve la ejecución: ESPIRAL se llama a sí
   mismo sin parar. ¿Le falta el caso que lo detiene?`, donde el nombre del procedimiento es su único
   parámetro; y la guarda de tiempo con un texto que empieza con `Detuve la ejecución:`, nombra el
   límite de 5 segundos y cierra con una pregunta de diagnóstico.
8. LA Suite_Pruebas DEBERÁ comparar carácter por carácter, incluidas las tildes y los signos de
   apertura, el texto que produce cada entrada declarada del Catalogo_Errores con al menos un caso por
   entrada y con sus parámetros rellenados, DEBERÁ verificar que dos invocaciones con los mismos
   parámetros devuelven el mismo texto, y DEBERÁ fallar nombrando la entrada que quede sin prueba.
9. CUANDO EL Parser consulta al Catalogo_Errores por una palabra que no puede ejecutarse en el mundo en
   curso, EL Catalogo_Errores DEBERÁ producir exactamente un mensaje aplicando el primer caso que
   corresponda en este orden: comando que EL Vocabulario declara para un mundo posterior (criterio 4),
   coincidencia con la tabla de comandos de Logo en inglés (criterio 3), sugerencia por distancia de
   edición contra los comandos desbloqueados (criterio 2), sugerencia de comando bloqueado cercano
   (criterio 10) y, en último lugar, mensaje sin sugerencia (criterio 5).
10. CUANDO EL Parser encuentra una palabra desconocida cuya distancia de edición mínima a los comandos
    desbloqueados supera el umbral del criterio 2 pero cuya distancia mínima a un comando que EL
    Vocabulario declara para un mundo posterior al mundo en curso cumple ese mismo umbral, EL
    Catalogo_Errores DEBERÁ producir un mensaje que nombre la palabra escrita, el nombre largo del
    comando bloqueado más cercano y el número entero del mundo que lo desbloquea, en lugar del mensaje
    sin sugerencia del criterio 5.
11. SI EL Catalogo_Errores recibe una solicitud con un identificador de situación que no declara, o con
    un parámetro requerido ausente o de texto vacío, ENTONCES EL Catalogo_Errores DEBERÁ reportar un
    fallo de programación distinguible de un error del jugador, y no DEBERÁ devolver ningún texto con
    un hueco sin rellenar ni con un marcador de plantilla.

### Requisito 11: Modelo puro de la tortuga

**Historia de usuario:** Como persona que desarrolla KiroLogo, quiero que la tortuga sea un modelo sin
Canvas, para poder probarla en Node y para que el renderizador consuma operaciones en lugar de llamarla.

#### Criterios de aceptación

1. LA Tortuga DEBERÁ representar el Estado_Tortuga con una posición de dos números finitos en
   coordenadas del Lienzo lógico —origen en el centro, la coordenada horizontal creciendo hacia la
   derecha y la vertical creciendo hacia arriba, con el interior del Lienzo cubierto por el intervalo
   de -400 a 400 inclusive en ambos ejes—, un rumbo de un número finito en grados dentro del intervalo
   de 0 inclusive a 360 exclusive, un indicador booleano de lápiz abajo y un indicador booleano de
   visibilidad.
2. LA Tortuga DEBERÁ producir un Estado_Tortuga nuevo por cada una de sus transformaciones
   —desplazamiento, giro, reubicación al centro, cambio del lápiz y cambio de visibilidad— y DEBERÁ
   dejar el Estado_Tortuga recibido con la misma posición, el mismo rumbo, el mismo indicador de lápiz
   y el mismo indicador de visibilidad que tenía antes de la invocación, incluso cuando la
   transformación recibe una distancia de 0 unidades o un ángulo de 0 grados y el resultado coincide
   valor por valor con la entrada.
3. LA Tortuga DEBERÁ mantener su módulo y sus pruebas libres de referencias a `document`, a `window` y
   a cualquier API de Canvas, y libres de importaciones de EL Lienzo, de LOS Personajes y de EL
   Animador, de modo que sus pruebas se ejecuten en Node sin ningún entorno que simule el DOM y sin
   ningún fallo.
4. CUANDO LA Tortuga recibe una transformación de desplazamiento con una distancia cuyo valor absoluto
   va de 0 a 999 999 unidades, LA Tortuga DEBERÁ devolver un Estado_Tortuga cuya posición se aparta
   como máximo 0.000001 unidades en cada coordenada de la posición de llegada exacta de recorrer esa
   distancia en la dirección del rumbo —rumbo 0 aumenta la coordenada vertical, rumbo 90 aumenta la
   horizontal, rumbo 180 disminuye la vertical, rumbo 270 disminuye la horizontal, y el desplazamiento
   hacia atrás invierte el sentido—, DEBERÁ conservar sin cambios el rumbo, el lápiz y la visibilidad,
   y DEBERÁ devolver esa posición aunque quede fuera del intervalo de -400 a 400, sin recortarla a los
   límites del Lienzo y sin reportar ningún error.
5. EL Lienzo, EL Animador y LOS Personajes DEBERÁN tomar la posición, el rumbo, el estado del lápiz y
   la visibilidad que dibujan del Estado_Tortuga que acompaña a cada Operacion, sin importar ni
   invocar ninguna transformación de LA Tortuga, de modo que EL Interprete sea el único módulo que
   invoca esas transformaciones.
6. CUANDO LA Tortuga recibe una transformación de giro con un ángulo cuyo valor absoluto va de 0 a
   999 999 grados, LA Tortuga DEBERÁ devolver un Estado_Tortuga cuyo rumbo es el rumbo recibido más el
   ángulo si el giro es a la derecha o menos el ángulo si es a la izquierda, reducido al intervalo de 0
   inclusive a 360 exclusive con una tolerancia de 0.000001 grados —de modo que girar 90 grados a la
   izquierda desde el rumbo 0 devuelva 270 y girar 450 grados a la derecha desde el rumbo 0 devuelva
   90—, y DEBERÁ conservar sin cambios la posición, el lápiz y la visibilidad.
7. LA Tortuga DEBERÁ exponer un Estado_Tortuga inicial con la posición en el centro del Lienzo lógico,
   rumbo 0, lápiz abajo y visibilidad activa, y DEBERÁ devolver de la transformación de reubicación al
   centro un Estado_Tortuga con esa misma posición y ese mismo rumbo, conservando sin cambios el
   indicador de lápiz y el indicador de visibilidad recibidos.
8. SI LA Tortuga recibe en una transformación una distancia o un ángulo que no es un número finito,
   ENTONCES LA Tortuga DEBERÁ devolver un resultado explícito de argumento inválido que identifica la
   transformación y el valor recibido, DEBERÁ dejar el Estado_Tortuga recibido con los mismos valores
   que tenía, y no DEBERÁ producir ninguna coordenada ni ningún rumbo no finito ni lanzar ninguna
   excepción.

### Requisito 12: Lienzo lógico y cuadrícula

**Historia de usuario:** Como jugador, quiero una cuadrícula visible para poder contar los tramos del
recorrido de Kiro, en lugar de adivinar las longitudes.

#### Criterios de aceptación

1. EL Lienzo DEBERÁ definir un espacio lógico cuadrado de 800 × 800 unidades con el origen `(0, 0)` en
   su centro, con la coordenada horizontal creciendo hacia la derecha y la vertical creciendo hacia
   arriba, con los dos ejes acotados de −400 a 400 unidades inclusive, y con el rumbo expresado en
   grados en el intervalo de 0 inclusive a 360 exclusive, donde el rumbo 0 apunta hacia arriba en la
   pantalla y los grados crecen en el sentido del giro a la derecha, de modo que el rumbo 90 apunta a
   la derecha, el 180 hacia abajo y el 270 a la izquierda.
2. EL Lienzo DEBERÁ dibujar la cuadrícula como 41 líneas paralelas al eje horizontal y 41 paralelas al
   eje vertical, separadas 20 unidades entre sí y cubriendo de −400 a 400 unidades en cada eje, donde
   las 9 líneas de cada eje que caen en múltiplos de 100 unidades llevan un grosor de al menos el doble
   del de las líneas de 20 unidades, para que se distingan sin depender del color, todas con un
   contraste mínimo de 3:1 frente al fondo, y con la cuadrícula completa por debajo de la estela de
   referencia, de la estela del jugador y de los Personajes.
3. CUANDO EL elemento de Canvas cambia de tamaño en píxeles de pantalla, EL Lienzo DEBERÁ calcular una
   escala uniforme igual al lado menor del área de dibujo dividido entre 800, acotando ese lado a un
   mínimo de 320 y un máximo de 4096 píxeles de pantalla para que el paso de 20 unidades mida siempre 8
   píxeles o más, mantener el cuadrado lógico centrado en el área con una relación de aspecto de 1:1 con
   una tolerancia de 1 píxel, dimensionar el búfer de dibujo como el tamaño en píxeles de pantalla
   multiplicado por la densidad de píxeles del dispositivo acotada al intervalo de 1 a 3, y multiplicar
   por esa misma escala el grosor de todo trazo de la cuadrícula y de las estelas.
4. EL Lienzo DEBERÁ mantener cuatro capas de dibujo con el orden de apilamiento fijo fondo con
   cuadrícula, estela de referencia, estela del jugador y Personajes, DEBERÁ dibujar la estela de
   referencia con un contraste frente al fondo de al menos 3:1 y estrictamente menor que el de la estela
   del jugador y con un estilo de línea distinto del de esta, para que las dos se distingan sin depender
   del color ni de la intensidad, y DEBERÁ admitir el borrado de la capa de la estela del jugador sin
   alterar las otras tres capas y sin volver a ejecutar el programa de referencia.
5. EL Lienzo DEBERÁ obtener del tema de la interfaz definido en `src/estilos/` el color y el grosor del
   fondo, de las líneas de 20 unidades, de las líneas de 100 unidades, de la estela del jugador y de la
   estela de referencia, leyéndolos en cada redibujado, y DEBERÁ mantener el módulo del Lienzo libre de
   valores de color y de grosor escritos como literales en el código.
6. CUANDO cambia el tamaño en píxeles de pantalla del área de dibujo o la densidad de píxeles del
   dispositivo, EL Lienzo DEBERÁ volver a dibujar la cuadrícula, la estela de referencia y la estela del
   jugador acumuladas a partir de las Operaciones que ya recibió, terminar el redibujado de una estela
   de hasta 500 segmentos en 100 milisegundos o menos, y no volver a ejecutar ningún programa con EL
   Interprete.
7. SI un tramo de estela cae total o parcialmente fuera del espacio lógico de 800 × 800 unidades,
   ENTONCES EL Lienzo DEBERÁ recortar su dibujo al borde del cuadrado lógico, seguir dibujando las
   Operaciones siguientes y terminar sin lanzar ninguna excepción ni interrumpir la ejecución, dejando
   el informe de figura no encuadrada a EL Encuadre.
8. SI el tema de la interfaz no declara el color o el grosor de alguno de los cinco trazos del criterio
   5, ENTONCES EL Lienzo DEBERÁ usar para ese trazo un valor de reserva que conserve el contraste mínimo
   de 3:1 frente al fondo, dibujar de todas formas la cuadrícula y las dos estelas completas, y terminar
   sin lanzar ninguna excepción ni dejar el área de dibujo vacía.

### Requisito 13: Personajes dibujados por código

**Historia de usuario:** Como jugador, quiero ver de un vistazo hacia dónde mira la tortuga y si el
lápiz está abajo, porque esa información es la que me deja entender qué hizo mi programa.

#### Criterios de aceptación

1. LOS Personajes DEBERÁN dibujar la tortuga, a Kiro y el lápiz únicamente con operaciones de trazo y
   de relleno del contexto de Canvas 2D, sin dibujar ninguna imagen ni ningún mapa de bits, sin
   referenciar ningún archivo cuya extensión sea `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp` ni
   `.ico`, sin insertar ningún elemento SVG en el documento, y dibujando siempre en la capa de
   Personajes del Lienzo sin modificar las otras tres capas.
2. LOS Personajes DEBERÁN recibir como parámetro explícito un estado compuesto por el Estado_Tortuga
   que acompaña a la Operacion en curso —posición en coordenadas del Lienzo lógico, rumbo en grados de
   0 inclusive a 360 exclusive, indicador de lápiz abajo e indicador de visibilidad— y por cuatro
   campos de presentación: el indicador de Kiro montado o desmontado, la inclinación de Kiro en grados
   como número finito de −20 a 20 con el signo positivo hacia el sentido del giro a la derecha, la
   identidad de la tortuga tomada de un conjunto cerrado de dos valores declarado en el propio módulo,
   y el indicador de celebración.
3. LOS Personajes DEBERÁN dibujar el conjunto girado rígidamente según el rumbo del estado, para todo
   rumbo finito del intervalo de 0 grados inclusive a 360 exclusive incluidos los valores no enteros y
   reduciendo a ese intervalo todo rumbo finito que llegue fuera de él, con el eje de la cabeza, la
   muesca del caparazón y la marca de rumbo apuntando en la dirección del rumbo con un error de 1 grado
   o menos, y con una silueta que, dibujada con un único color de trazo y de relleno sobre un fondo
   uniforme, obtiene un IoU menor que 0.90 contra ella misma rotada cualquier ángulo múltiplo de 15
   grados entre 15 y 345, de modo que la orientación se deduzca de la forma y nunca del color.
4. LOS Personajes DEBERÁN dibujar a Kiro montado por encima del caparazón en el orden de trazado, con
   su silueta solapando la del caparazón y su centro a 10 unidades o menos del centro del caparazón, e
   inclinado el ángulo que indica el estado acotado al intervalo de −20 a 20 grados, girando únicamente
   la figura de Kiro y dejando sin cambio la posición y el rumbo dibujados de la tortuga, y dibujando a
   Kiro sin inclinación cuando ese ángulo es 0.
5. LOS Personajes DEBERÁN dibujar el lápiz en dos posiciones que se distinguen por la geometría y no
   por el color ni por la opacidad: con el lápiz abajo, la punta a 1 unidad o menos de la posición del
   Estado_Tortuga; con el lápiz arriba, la punta a 8 unidades o más de esa posición sin salir del
   círculo del criterio 6; en los dos casos con el mismo color y el mismo grosor de trazo, y sin
   alterar la posición ni el rumbo dibujados de la tortuga.
6. LOS Personajes DEBERÁN dibujar el conjunto de la tortuga con Kiro montado y el lápiz de modo que
   todo punto trazado o rellenado, incluida la mitad del grosor de cada trazo, quede a 20 unidades o
   menos de la posición del Estado_Tortuga —un círculo de 40 unidades de diámetro del Lienzo lógico,
   para no tapar una figura cuya caja envolvente mide al menos 200 unidades de lado—, y DEBERÁN
   cumplirlo para todo rumbo del intervalo de 0 inclusive a 360 exclusive, con el lápiz abajo y con el
   lápiz arriba, y en los dos extremos de la inclinación de Kiro, expresando esas medidas en unidades
   del Lienzo lógico para que se conserven en cualquier escala de dibujo del Lienzo.
7. MIENTRAS el estado indica que la tortuga está oculta, LOS Personajes DEBERÁN dejar la capa de
   Personajes sin ningún píxel dibujado, omitiendo el trazo de la tortuga, de Kiro y del lápiz, y no
   DEBERÁN modificar ningún píxel de la capa de la estela del jugador ni de la capa de la estela de
   referencia, de modo que la estela siga creciendo con las Operaciones que dibuja EL Lienzo aunque la
   tortuga no se vea.
8. LOS Personajes DEBERÁN declarar en su firma de entrada los campos de Kiro desmontado, de identidad
   de la tortuga y de celebración, cada uno acompañado de un comentario que nombre el estado y el
   número de la spec que lo dibuja, y DEBERÁN producir, para cualquier valor de esos tres campos, el
   mismo dibujo píxel por píxel que producen con Kiro montado, la identidad predeterminada y la
   celebración inactiva, sin reportar ningún error.
9. LOS Personajes DEBERÁN producir el mismo dibujo píxel por píxel en dos invocaciones con el mismo
   estado y el mismo tamaño de área de dibujo, tomando del estado recibido todos los valores que
   dibujan, sin leer ningún valor global, sin importar EL Interprete, sin invocar ninguna
   transformación de LA Tortuga y sin modificar ningún campo del estado recibido.
10. LOS Personajes DEBERÁN obtener del tema de la interfaz definido en `src/estilos/` el color y el
    grosor de cada trazo y de cada relleno de la tortuga, de Kiro y del lápiz, leyéndolos en cada
    dibujado, DEBERÁN mantener el módulo libre de valores de color y de grosor escritos como literales,
    y DEBERÁN dibujar el contorno del conjunto con un contraste de al menos 3:1 frente al fondo del
    Lienzo y frente a la estela del jugador.
11. SI el estado recibido lleva una posición, un rumbo o una inclinación de Kiro que no es un número
    finito, ENTONCES LOS Personajes DEBERÁN omitir el dibujo de la tortuga, de Kiro y del lápiz,
    devolver un resultado explícito de estado inválido que identifica el campo y el valor recibido,
    dejar las cuatro capas del Lienzo iguales píxel por píxel a como estaban, y terminar sin lanzar
    ninguna excepción.

### Requisito 14: Animación de la ejecución y modo paso a paso

**Historia de usuario:** Como jugador, quiero ver el recorrido en el tiempo y poder ir paso a paso,
para encontrar en qué instrucción se desvió mi programa.

#### Criterios de aceptación

1. CUANDO EL Animador recibe una secuencia de Operaciones, EL Animador DEBERÁ aplicarlas en el orden
   ascendente de su índice de paso, una sola vez cada una y sin omitir ninguna, interpolando de forma
   monótona la posición dibujada de la tortuga entre el Estado_Tortuga anterior y el posterior de cada
   Operacion `mover` y haciendo crecer la estela únicamente cuando esa Operacion lleva el lápiz abajo,
   girando la tortuga sin moverla de sitio en cada Operacion `girar`, reubicándola sin dibujar estela
   en cada Operacion `reubicar` y borrando la capa de la estela del jugador en cada Operacion
   `limpiar`, de modo que al terminar la estela dibujada contenga exactamente los segmentos que EL
   Extractor_Segmentos obtiene de esa misma secuencia; y DEBERÁ terminar sin dibujar ninguna Operacion
   y sin reportar ningún error cuando la secuencia recibida está vacía.
2. EL Animador DEBERÁ ofrecer al menos cuatro velocidades de reproducción seleccionables —una lenta con
   una duración objetivo de 1 000 milisegundos por Operacion, una normal de 400 milisegundos, una
   rápida de 120 milisegundos y una inmediata que no espera entre Operaciones—, DEBERÁ cumplir las
   duraciones objetivo de las tres primeras con una tolerancia de ±25 % medida sobre el tiempo total de
   una secuencia de 10 Operaciones, y DEBERÁ completar con la inmediata una secuencia de hasta 500
   Operaciones en 100 milisegundos o menos sin dibujar ninguna posición intermedia.
3. CUANDO EL jugador pide un paso, EL Animador DEBERÁ entrar en modo paso a paso, detener en 100
   milisegundos o menos la reproducción continua que estuviera en curso terminando el dibujo de la
   Operacion en curso sin dejar ningún tramo de estela a medias, aplicar por completo exactamente la
   siguiente Operacion pendiente dejando la tortuga en el Estado_Tortuga posterior de esa Operacion,
   aumentar en 1 el contador de Operaciones aplicadas, y no consumir ninguna Operacion más hasta que EL
   jugador pida otro paso, pulse ejecutar o pulse reiniciar.
4. MIENTRAS EL Animador está en modo paso a paso, EL Editor DEBERÁ resaltar exactamente una línea, la
   que indica el número de línea de la última Operacion aplicada contado desde 1, distinguiéndola por
   al menos un canal además del color, actualizando el resaltado en 100 milisegundos o menos después de
   cada paso, sin mover el foco del teclado fuera del área de escritura, y retirando el resaltado —sin
   interrumpir el modo paso a paso ni la secuencia en curso— mientras ese número de línea no exista en
   el contenido en curso del Editor.
5. CUANDO EL jugador pide reiniciar, EL Animador DEBERÁ detener en 100 milisegundos o menos cualquier
   reproducción en curso, salir del modo paso a paso retirando el resaltado de línea del Editor, dejar
   en cero el contador de Operaciones aplicadas, volver la tortuga al Estado_Tortuga inicial del Nivel,
   borrar únicamente la capa de la estela del jugador dejando sin alterar el fondo con cuadrícula, la
   estela de referencia atenuada y la capa de los Personajes, conservar sin cambios el texto del Editor
   y el Reto en curso, y conservar la secuencia de Operaciones ya recibida para poder reproducirla de
   nuevo sin volver a invocar EL Interprete.
6. MIENTRAS el sistema operativo declara `prefers-reduced-motion` con el valor `reduce`, EL Animador
   DEBERÁ dibujar en 100 milisegundos o menos la estela completa de todas las Operaciones pendientes de
   una secuencia de hasta 500 Operaciones y dejar la tortuga en el Estado_Tortuga posterior de la
   última, sin dibujar ninguna posición intermedia y con independencia de la velocidad seleccionada, y
   DEBERÁ mantener disponible el modo paso a paso aplicando en cada paso una sola Operacion con su
   tramo de estela completo.
7. EL Animador DEBERÁ obtener cada Operacion del flujo que emite EL Interprete y tomar la posición, el
   rumbo, el estado del lápiz y la visibilidad que dibuja de los campos de Estado_Tortuga anterior y
   posterior de esa Operacion, sin volver a analizar el texto del programa con EL Lexer ni con EL
   Parser, sin leer el contenido del Editor y sin invocar ninguna transformación de LA Tortuga, de modo
   que reproducir dos veces la misma secuencia con la misma velocidad deje la misma estela final en EL
   Lienzo.
8. CUANDO EL Animador aplica la última Operacion de la secuencia, EL Animador DEBERÁ dejar la tortuga
   en el Estado_Tortuga posterior de esa Operacion, conservar en EL Lienzo la estela completa dibujada,
   dejar de consumir Operaciones sin lanzar ninguna excepción, y devolver un resultado explícito de fin
   de secuencia que informa el número de Operaciones aplicadas, para que LOS Controles vuelvan a
   habilitar la acción de ejecutar.
9. SI EL jugador pide un paso y no queda ninguna Operacion pendiente en la secuencia, ENTONCES EL
   Animador no DEBERÁ dibujar ninguna Operacion, y DEBERÁ conservar sin cambios la estela y el
   Estado_Tortuga que ya están en pantalla, mantener el contador de Operaciones aplicadas en su valor,
   y devolver el mismo resultado explícito de fin de secuencia, sin lanzar ninguna excepción y sin
   reportar ningún error del Catalogo_Errores.
10. CUANDO EL jugador cambia la velocidad de reproducción con una reproducción en curso, EL Animador
    DEBERÁ aplicar la nueva duración a partir de la siguiente Operacion pendiente, conservar la estela
    ya dibujada y el contador de Operaciones aplicadas, y no volver a dibujar ninguna Operacion ya
    aplicada ni reiniciar la secuencia.

### Requisito 15: Extracción de segmentos y encuadre

**Historia de usuario:** Como persona que desarrolla KiroLogo, quiero obtener los segmentos dibujados
y su caja envolvente a partir de las operaciones, para validar la figura y para saber si cabe en el
lienzo.

#### Criterios de aceptación

1. CUANDO EL Extractor_Segmentos recibe una secuencia de 0 a 200 000 Operaciones, EL
   Extractor_Segmentos DEBERÁ devolver, en 100 milisegundos o menos, la lista de los segmentos de las
   Operaciones `mover` cuyo indicador de lápiz vigente está abajo, ordenada por índice de paso
   ascendente, donde cada segmento lleva el punto de partida y el punto de llegada tomados de la propia
   Operacion en unidades del Lienzo lógico, tal como esta los registró y sin recortarlos al cuadrado de
   800 × 800 ni redondearlos, junto con el índice de paso y el número de línea de esa Operacion; y
   DEBERÁ devolver una lista vacía, sin reportar ningún error, cuando la secuencia está vacía o cuando
   ninguna Operacion cumple esa condición.
2. EL Extractor_Segmentos DEBERÁ excluir de la lista las Operaciones `mover` cuyo indicador de lápiz
   vigente está arriba y las Operaciones `mover` cuya distancia entre el punto de partida y el punto de
   llegada es menor que 0.0001 unidades del Lienzo lógico, y DEBERÁ no aportar ningún segmento por las
   Operaciones de tipo `girar`, `reubicar`, `lapiz` y `visibilidad`, ni por la Operacion `limpiar` más
   allá del efecto que declara el criterio 3, sin reportar ningún error por ninguna de esas exclusiones.
3. CUANDO EL Extractor_Segmentos encuentra una Operacion `limpiar`, EL Extractor_Segmentos DEBERÁ
   descartar todos los segmentos acumulados hasta ese punto, continuar el recorrido con las Operaciones
   siguientes y conservar en los segmentos posteriores el índice de paso y el número de línea originales
   de su Operacion, sin volver a numerarlos desde 0; de modo que una secuencia con varias Operaciones
   `limpiar` conserve únicamente los segmentos posteriores a la última, y una secuencia cuya última
   Operacion `limpiar` no va seguida de ninguna Operacion `mover` con el lápiz abajo produzca una lista
   vacía sin ningún error.
4. CUANDO EL Encuadre recibe una lista de 1 a 200 000 segmentos, EL Encuadre DEBERÁ devolver la caja
   envolvente con su límite izquierdo, su límite derecho, su límite inferior y su límite superior,
   calculados como el valor mínimo y el valor máximo de cada coordenada entre los puntos de partida y de
   llegada de todos los segmentos de la lista, junto con su ancho igual a la diferencia entre el límite
   derecho y el izquierdo y su alto igual a la diferencia entre el límite superior y el inferior, ambos
   mayores o iguales que 0, en 50 milisegundos o menos para una lista de hasta 500 segmentos y sin
   modificar la lista recibida.
5. SI alguno de los cuatro límites de la caja envolvente queda fuera del intervalo de −400 a 400
   unidades inclusive que declara EL Lienzo lógico, ENTONCES EL Encuadre DEBERÁ devolver la caja
   envolvente calculada junto con un indicador explícito de figura no encuadrada que nombra cuál o
   cuáles de los cuatro límites quedaron fuera, sin recortar ningún segmento, sin modificar la lista
   recibida y sin lanzar ninguna excepción, entendiendo que un límite de exactamente −400 o de
   exactamente 400 unidades no constituye figura no encuadrada.
6. SI el ancho o el alto de la caja envolvente de una lista de segmentos es menor que 200 unidades del
   Lienzo lógico, ENTONCES EL Encuadre DEBERÁ devolver la caja envolvente calculada junto con un
   indicador explícito de figura degenerada, sin lanzar ninguna excepción, entendiendo que un ancho o un
   alto de exactamente 200 unidades no constituye figura degenerada; EL Encuadre DEBERÁ calcular ese
   indicador para cualquier lista de segmentos que reciba y dejar la decisión de descartar la figura a
   quien lo invoca, que en esta spec es LA Suite_Pruebas al verificar el programa de referencia del
   nivel autorado; y DEBERÁ devolver este indicador y el del criterio 5 de forma independiente, pudiendo
   los dos ser verdaderos para la misma lista.
7. SI EL Encuadre recibe una lista sin ningún segmento, ENTONCES EL Encuadre DEBERÁ devolver un
   resultado explícito de lista sin segmentos, con el indicador de figura degenerada y sin caja
   envolvente, sin devolver límites con valor 0, sin devolver valores no finitos y sin lanzar ninguna
   excepción.
8. EL Extractor_Segmentos y EL Encuadre DEBERÁN devolver, para una misma entrada recibida dos veces,
   dos resultados iguales campo por campo y con valores numéricos exactamente iguales, y DEBERÁN dejar
   la secuencia de Operaciones y la lista de segmentos recibidas sin ninguna modificación.

### Requisito 16: Validación geométrica

**Historia de usuario:** Como jugador, quiero que se valide mi dibujo y no mi código, para que
cualquier programa que produzca la figura cuente como resuelto.

#### Criterios de aceptación

1. EL Validador DEBERÁ recibir como entrada las dos listas de segmentos que produce EL
   Extractor_Segmentos —la del jugador y la del programa de referencia— junto con la normalización que
   declara EL Nivel, y DEBERÁ devolver el mismo veredicto para dos programas cuyas listas de segmentos
   son iguales, cualesquiera que sean su texto y su AST.
2. EL Validador DEBERÁ rasterizar cada conjunto de segmentos en un arreglo tipado propio de 800 × 800
   posiciones, con una posición por unidad del Lienzo lógico y el intervalo de -400 a 400 de cada eje
   cubierto por los índices 0 a 799, sin usar `OffscreenCanvas`, `document` ni ninguna API de Canvas,
   para poder ejecutarse en Node bajo Vitest.
3. EL Validador DEBERÁ aplicar a las dos máscaras la misma dilatación, encendiendo toda posición cuya
   distancia euclidiana a una posición encendida por un segmento sea de 8 píxeles del arreglo o menos,
   como única tolerancia de trazo.
4. EL Validador DEBERÁ calcular el IoU como el número de posiciones encendidas en las dos máscaras
   dilatadas dividido entre el número de posiciones encendidas en al menos una de las dos, y el exceso
   de trazo como el número de posiciones encendidas por el jugador que no lo están en la máscara
   objetivo dilatada, expresado como porcentaje del total de posiciones encendidas de esa máscara
   objetivo, con el IoU definido como 0 siempre que la unión o la máscara objetivo no tenga ninguna
   posición encendida, en lugar de una división indefinida.
5. CUANDO EL Validador termina de calcular el IoU y el exceso de trazo de una comparación, EL Validador
   DEBERÁ conceder la coincidencia geométrica únicamente si el IoU es 0.90 o mayor y el exceso de trazo
   es 5 % o menor del total de posiciones encendidas de la máscara objetivo dilatada, comparando los dos
   valores sin redondear y reservando el redondeo a la presentación.
6. SI el exceso de trazo supera el 5 % del total del objetivo, ENTONCES EL Validador DEBERÁ negar la
   coincidencia geométrica aunque el IoU alcance el umbral.
7. DONDE el Nivel declara la traslación como libre, EL Validador DEBERÁ trasladar cada figura, antes de
   rasterizar, de modo que el centro de la caja envolvente que devuelve EL Encuadre coincida con el
   centro del arreglo, redondeando la traslación a posiciones enteras.
8. DONDE el Nivel declara la rotación como libre, EL Validador DEBERÁ evaluar los 360 giros enteros del
   objetivo, de 0 a 359 grados, alrededor del centro de su caja envolvente, quedarse con el giro de
   mayor IoU y, en caso de empate, con el de menor ángulo, y DEBERÁ calcular el exceso de trazo, las
   máscaras y las tres regiones que devuelve con ese mismo giro.
9. EL Validador DEBERÁ exigir siempre la coincidencia de escala, sin aplicar ningún ajuste de tamaño a
   ninguna de las dos figuras y sin más tolerancia que la dilatación de 8 píxeles del criterio 3, y
   DEBERÁ rasterizar sin transformación previa toda componente de la normalización —traslación o
   rotación— que EL Nivel declara fija, en las coordenadas del Lienzo lógico que produce EL
   Extractor_Segmentos.
10. CUANDO EL Validador compara un conjunto de segmentos contra sí mismo, EL Validador DEBERÁ devolver
    un IoU de 1.0, un exceso de 0 % y la coincidencia geométrica concedida, cualquiera que sea la
    normalización que declara EL Nivel.
11. CUANDO EL Validador recibe una figura idéntica al objetivo pero con todas sus longitudes
    multiplicadas por 2, EL Validador DEBERÁ negar la coincidencia geométrica, aun con la traslación y
    la rotación declaradas libres.
12. CUANDO EL Validador recibe una figura que contiene todos los segmentos del objetivo más un
    segmento adicional de 100 unidades cuyas posiciones caen fuera de la máscara objetivo dilatada, EL
    Validador DEBERÁ negar la coincidencia geométrica e indicar el exceso de trazo como motivo.
13. CUANDO EL Validador compara dos figuras de hasta 500 segmentos cada una con la rotación declarada
    libre, EL Validador DEBERÁ devolver el resultado en 2 segundos o menos en la peor de tres
    mediciones consecutivas dentro del proceso de la Suite_Pruebas ejecutándose en Node.
14. EL Validador DEBERÁ devolver, junto al veredicto, el valor del IoU, el porcentaje de exceso de
    trazo, la traslación y el ángulo aplicados, las dos máscaras dilatadas y las tres regiones de
    800 × 800 —coincidencia como la intersección de las dos máscaras, exceso como las posiciones del
    jugador que no están en el objetivo, y falta como las posiciones del objetivo que no están en las
    del jugador—, para que EL Diff las dibuje y LAS Estrellas evalúen la precisión sin volver a
    calcularlas.
15. SI un segmento cae total o parcialmente fuera del arreglo de 800 × 800, ENTONCES EL Validador
    DEBERÁ encender solo las posiciones que quedan dentro del arreglo, descartar el resto sin escribir
    fuera de sus límites y sin lanzar ninguna excepción, y contar en el IoU y en el exceso de trazo
    únicamente las posiciones dentro del arreglo, dejando el informe de figura no encuadrada a EL
    Encuadre.
16. SI la lista de segmentos del jugador está vacía, o ninguna de sus posiciones cae dentro del
    arreglo, ENTONCES EL Validador DEBERÁ negar la coincidencia geométrica devolviendo un IoU de 0 y un
    exceso de 0 %, con la región de falta igual a la máscara objetivo dilatada y las regiones de
    coincidencia y de exceso vacías, sin lanzar ninguna excepción.
17. CUANDO EL Validador compara dos veces las mismas dos listas de segmentos con la misma
    normalización, EL Validador DEBERÁ devolver el mismo veredicto, el mismo IoU, el mismo exceso de
    trazo, el mismo ángulo aplicado y máscaras iguales posición por posición, sin modificar las listas
    de segmentos recibidas.

### Requisito 17: Azar determinista y códigos de semilla compartibles

**Historia de usuario:** Como jugador, quiero un código corto que reproduzca exactamente el reto que
estoy viendo, para pedir ayuda o reportar un error con algo verificable.

#### Criterios de aceptación

1. EL PRNG DEBERÁ recibir al crearse una semilla entera explícita del dominio de 0 a 4 294 967 295 —el
   mismo dominio que acepta EL Codigo_Semilla—, DEBERÁ devolver en cada petición básica un número en el
   intervalo de 0 incluido a 1 excluido, y DEBERÁ avanzar su propio estado en cada petición sin leer el
   reloj del sistema ni ningún estado compartido con otra instancia del PRNG.
2. CUANDO EL PRNG se inicializa dos veces con la misma semilla y recibe la misma secuencia de
   peticiones, EL PRNG DEBERÁ devolver dos secuencias de valores exactamente iguales uno a uno en las
   primeras 10 000 peticiones, consumiendo la misma cantidad de valores internos para los mismos
   argumentos, con independencia de cuántas otras instancias se hayan creado o consumido entre las dos
   inicializaciones y de si la ejecución ocurre en el navegador o en Node bajo la Suite_Pruebas.
3. EL Proyecto DEBERÁ mantener los archivos `.ts` de `src/` libres de llamadas a `Math.random` y de
   cualquier otra fuente de aleatoriedad sin semilla explícita, de modo que todo valor aleatorio del
   Juego provenga de una instancia del PRNG sembrada con una semilla del dominio del criterio 1.
4. EL PRNG DEBERÁ exponer tres operaciones, para que los generadores de las specs siguientes no
   reimplementen esa aritmética: un entero en un rango con el mínimo y el máximo incluidos; la elección
   de un elemento de una lista de 1 elemento o más, devolviendo el elemento y no su posición; y un
   múltiplo de un paso entero positivo dentro de un rango con los dos extremos incluidos, siempre
   divisible por ese paso. Las tres DEBERÁN devolver únicamente valores dentro de los límites recibidos
   y, sobre 10 000 peticiones consecutivas con un rango de 10 valores admisibles o menos, DEBERÁN
   devolver al menos una vez cada valor admisible, incluidos los dos extremos.
5. PARA TODA semilla del dominio de 0 a 4 294 967 295, EL Codigo_Semilla DEBERÁ producir un código que
   al decodificarse devuelva exactamente esa semilla y que no coincida con el código de ninguna otra
   semilla del dominio (ida y vuelta, e inyectividad), verificado por LA Suite_Pruebas sobre al menos
   200 semillas que incluyan 0 y el máximo del dominio.
6. EL Codigo_Semilla DEBERÁ producir códigos de exactamente 7 caracteres, todos tomados de un alfabeto
   de 31 símbolos —las 26 letras de la `A` a la `Z` sin `I`, `L` ni `O`, y los dígitos del `2` al `9`,
   por lo que quedan excluidos también `0` y `1`—, en mayúsculas, rellenando a la izquierda con el
   primer símbolo del alfabeto cuando el valor de la semilla no ocupa los 7 caracteres, de modo que dos
   códigos cualesquiera tengan la misma longitud.
7. SI EL Codigo_Semilla recibe, tras descartar los espacios de los extremos y convertir las letras a
   mayúsculas, un código cuya longitud es distinta de 7 caracteres, o que contiene algún símbolo fuera
   del alfabeto del criterio 6, o cuyo valor decodificado queda fuera del dominio de semillas, ENTONCES
   EL Codigo_Semilla DEBERÁ devolver un resultado explícito de código no válido con el error
   correspondiente del Catalogo_Errores, que indique el código recibido y cuál de esas tres causas
   ocurrió, sin devolver ninguna semilla, sin lanzar una excepción y sin modificar el Reto en curso.
8. SI una operación del PRNG recibe un rango cuyo mínimo es mayor que su máximo, una lista vacía, un
   paso que no es un entero positivo, o un rango que no contiene ningún múltiplo del paso, ENTONCES EL
   PRNG DEBERÁ reportar el error correspondiente del Catalogo_Errores nombrando los argumentos
   recibidos, sin devolver ningún valor y sin avanzar su estado, de modo que la secuencia siguiente sea
   la misma que si esa petición no se hubiera hecho.
9. SI EL Codigo_Semilla recibe para codificar un valor que no es un entero o que queda fuera del
   dominio de 0 a 4 294 967 295, ENTONCES EL Codigo_Semilla DEBERÁ reportar el error correspondiente
   del Catalogo_Errores indicando el valor recibido y el dominio admitido, sin devolver ningún código.
10. CUANDO EL Codigo_Semilla recibe un código escrito con minúsculas o con espacios al principio o al
    final, EL Codigo_Semilla DEBERÁ descartar esos espacios y convertir las letras a mayúsculas antes
    de validarlo, y DEBERÁ devolver la misma semilla que devuelve para ese mismo código escrito en
    mayúsculas y sin espacios.

### Requisito 18: Definición de un Nivel y resolución de un Reto

**Historia de usuario:** Como persona que desarrolla las siete specs siguientes, quiero un tipo `Nivel`
que ya distinga autorado de generado y declare su normalización y sus exigencias, para agregar niveles
como datos y nunca como lógica nueva.

#### Criterios de aceptación

1. EL Nivel DEBERÁ declarar su identificador como un texto no vacío de 8 caracteres o menos, único en
   todo el catálogo y formado por el mundo, un punto y el orden del nivel dentro del mundo, como `0.1`;
   su mundo como un entero de 0 a 5; su título como un texto en español no vacío de 60 caracteres o
   menos; el concepto que enseña tomado de un conjunto cerrado declarado en `src/niveles/tipos.ts` que
   incluye al menos secuencia, iteración, descomposición, simetría, generalización y recursión; su
   normalización geométrica; sus exigencias de abstracción; sus tres pistas en el orden fijo
   conceptual, matemática y esqueleto de código, cada una un texto en español no vacío de 200
   caracteres o menos y ninguna con el programa de referencia completo; y el margen del `limiteDuro`
   como un entero opcional de 0 a 10.
2. EL Nivel DEBERÁ declarar su origen como una unión discriminada de exactamente dos variantes:
   `autorado`, que lleva el programa de referencia como AST con al menos una instrucción y solo con
   nodos que EL Parser produce para el mundo que el Nivel declara, y una semilla entera fija; y
   `generado`, que lleva el identificador del generador y sus parámetros y que esta spec declara en el
   tipo sin implementar ningún generador; de modo que EL Proyecto no compile si un Nivel autorado
   declara un identificador de generador, si un Nivel generado declara un AST, o si un consumidor deja
   sin tratar una de las dos variantes.
3. EL Nivel DEBERÁ declarar su normalización con exactamente tres campos —traslación con el valor
   `libre` o `fija`, rotación con el valor `libre` o `fija`, y escala con el único valor admitido
   `exacta`—, DEBERÁ declarar traslación y rotación `libre` cuando su mundo es 0, 1 o 2, y DEBERÁ
   declararlas `fija` cuando su mundo es 3 o mayor.
4. EL Nivel DEBERÁ declarar sus exigencias de abstracción como un conjunto sin claves repetidas tomado
   únicamente de `usaRepite`, `usaRepiteAnidado`, `defineProcedimiento`, `usaParametros`,
   `maximoProcedimientos` y `usaRecursion`, donde `maximoProcedimientos` lleva además un entero de 1 a
   10 y las otras cinco claves no llevan valor, admitiendo el conjunto vacío para el mundo 0 y de modo
   que EL Proyecto no compile si un Nivel declara una clave ajena a esas seis.
5. EL Nivel DEBERÁ mantenerse sin ningún campo que almacene un conteo de instrucciones, un
   `presupuestoEstrella` ya calculado ni un `limiteDuro` ya calculado, admitiendo como único campo
   numérico de presupuesto el margen del `limiteDuro` del criterio 1, de modo que todo número de
   presupuesto de un Nivel se obtenga siempre de EL Conteo en tiempo de resolución.
6. CUANDO EL Reto recibe un identificador de nivel y una semilla entera, EL Reto DEBERÁ devolver un
   único objeto con el programa de referencia como AST, la secuencia completa de Operaciones de una
   sola ejecución de ese AST con EL Interprete desde el Estado_Tortuga inicial que expone LA Tortuga y
   con los comandos del mundo que declara el Nivel, los segmentos que EL Extractor_Segmentos obtiene de
   esa misma secuencia, el `presupuestoEstrella` que devuelve EL Conteo para ese AST, el `limiteDuro`
   acompañado de su indicador de actividad, y el código de semilla compartible que produce EL
   Codigo_Semilla a partir de la semilla efectiva del reto —la semilla fija que declara el Nivel cuando
   su origen es `autorado`, y la semilla recibida cuando es `generado`—, sin ejecutar el programa de
   referencia más de una vez por resolución.
7. CUANDO EL Reto se resuelve dos veces con el mismo identificador de nivel y la misma semilla, EL Reto
   DEBERÁ devolver el mismo programa de referencia nodo por nodo, la misma secuencia de Operacion con
   el mismo número de pasos y los mismos Estado_Tortuga antes y después de cada paso, la misma lista de
   segmentos en el mismo orden, el mismo `presupuestoEstrella`, el mismo `limiteDuro` con el mismo
   indicador de actividad y el mismo código de semilla, con independencia de cuántos otros Retos se
   hayan resuelto entre las dos resoluciones.
8. EL Reto DEBERÁ derivar el `limiteDuro` como la suma del `presupuestoEstrella` y el margen entero que
   declara el Nivel, tomando 3 como margen cuando el Nivel no declara ninguno, y DEBERÁ devolver ese
   número también cuando el `limiteDuro` está inactivo.
9. MIENTRAS el mundo del Nivel es 0, 1 o 2, EL Reto DEBERÁ devolver el `limiteDuro` con su indicador de
   actividad en falso, de modo que un programa del jugador cuyo Conteo supera ese número se ejecute
   igual y solo pierda la estrella de economía.
10. LOS módulos de `src/niveles/` DEBERÁN importar únicamente de `src/lenguaje/`, de `src/azar/` y de
    otros módulos de `src/niveles/`, sin ninguna importación estática, ninguna reexportación y ninguna
    importación dinámica de `src/motor/`, de `src/juego/` ni de `src/ui/`, con independencia de que la
    ruta se escriba de forma relativa o con un alias del proyecto.
11. SI EL Reto recibe un identificador de nivel que ningún Nivel declarado en `src/niveles/` reconoce,
    ENTONCES EL Reto DEBERÁ reportar un fallo de programación distinguible de un error del jugador que
    nombre el identificador recibido, sin ejecutar ningún programa con EL Interprete y sin devolver
    ningún Reto parcial.
12. SI EL Reto no puede producir el programa de referencia de un Nivel, porque el origen del Nivel es
    `generado` y esta spec no implementa ningún generador o porque la ejecución de su AST con EL
    Interprete reporta un error o la corta una guarda de ejecución, ENTONCES EL Reto DEBERÁ reportar un
    fallo de programación distinguible de un error del jugador que nombre el identificador del Nivel y
    la causa, sin devolver ningún Reto parcial y sin devolver ninguna Operacion.
13. MIENTRAS el mundo del Nivel es 3 o mayor, EL Reto DEBERÁ devolver el `limiteDuro` con su indicador
    de actividad en verdadero, dejando la detención del programa que lo excede a la spec que introduce
    ese mundo.

### Requisito 19: Calificación con tres estrellas

**Historia de usuario:** Como jugador, quiero saber si resolví el nivel, si lo resolví con economía y
si usé la herramienta que el nivel enseña, para entender qué me falta aprender y no solo si acerté.

#### Criterios de aceptación

1. CUANDO EL Validador devuelve el veredicto del programa que EL jugador acaba de ejecutar, LAS
   Estrellas DEBERÁN devolver un único resultado con el valor otorgada o negada de cada una de las tres
   estrellas —precisión, economía y abstracción—, el entero del conteo del jugador, el entero del
   `presupuestoEstrella` del Reto y el motivo de cada estrella negada tomado de un conjunto cerrado de
   motivos que declara LAS Estrellas, evaluando la economía con independencia del veredicto de
   precisión y la abstracción con independencia del resultado de economía, de modo que ninguna estrella
   quede sin evaluar por causa de otra salvo la única dependencia que declara el criterio 5.
2. CUANDO LAS Estrellas evalúan un intento, LAS Estrellas DEBERÁN otorgar la estrella de precisión si y
   solo si EL Validador concede la coincidencia geométrica, tomando ese veredicto tal como EL Validador
   lo devuelve, sin volver a rasterizar, sin volver a calcular el IoU ni el exceso de trazo y sin
   aplicar ningún umbral propio, y DEBERÁN incluir en el motivo el IoU y el porcentaje de exceso de
   trazo recibidos cuando la niegan.
3. CUANDO LAS Estrellas evalúan un intento, LAS Estrellas DEBERÁN otorgar la estrella de economía si y
   solo si el entero que devuelve EL Conteo para el AST del jugador es menor o igual que el
   `presupuestoEstrella` que devuelve EL Reto, comparando los dos enteros sin ningún margen,
   otorgándola cuando los dos son iguales, negándola en cuanto el del jugador supera al del Reto aunque
   sea por 1, y evaluándola igual cuando la estrella de precisión se niega.
4. MIENTRAS EL Nivel declara al menos una exigencia de abstracción, CUANDO LAS Estrellas evalúan un
   intento, LAS Estrellas DEBERÁN otorgar la estrella de abstracción si y solo si EL
   Analisis_Abstraccion confirma todas las exigencias declaradas, e incluir en el motivo las exigencias
   sin confirmar en el mismo orden en que EL Nivel las declara.
5. MIENTRAS EL Nivel declara vacío su conjunto de exigencias de abstracción —el caso de todo Nivel del
   mundo 0—, CUANDO LAS Estrellas evalúan un intento, LAS Estrellas DEBERÁN otorgar la estrella de
   abstracción si y solo si otorgan la estrella de precisión, con independencia de lo que EL
   Analisis_Abstraccion devuelva para un conjunto vacío, de modo que ningún programa gane la estrella de
   abstracción sin haber reproducido la figura.
6. EL Analisis_Abstraccion DEBERÁ evaluar las exigencias recorriendo el AST completo del jugador,
   incluidos los nueve tipos de nodo que EL AST reserva para las specs siguientes, sin leer el texto del
   programa, sin invocar EL Impresor y sin comparar el AST del jugador contra el programa de referencia
   del Reto, y DEBERÁ devolver el mismo resultado para dos AST iguales nodo por nodo analizados de dos
   textos distintos.
7. EL Analisis_Abstraccion DEBERÁ confirmar cada una de las seis claves de exigencia que admite EL Nivel
   con esta condición sobre el AST del jugador y con ninguna otra: `usaRepite`, si hay al menos un nodo
   de repetición; `usaRepiteAnidado`, si hay un nodo de repetición con otro nodo de repetición entre sus
   descendientes; `defineProcedimiento`, si hay al menos un nodo de definición de procedimiento;
   `usaParametros`, si alguna definición declara uno o más parámetros y su cuerpo contiene al menos una
   referencia a uno de los parámetros que ella misma declara; `maximoProcedimientos`, si el número de
   nodos de definición de procedimiento es menor o igual que el entero que acompaña a la clave; y
   `usaRecursion`, si el cuerpo de alguna definición contiene una invocación del nombre de esa misma
   definición.
8. MIENTRAS EL Nivel declara al menos una exigencia de abstracción, SI LAS Estrellas niegan la estrella
   de abstracción, ENTONCES EL Globo_Kiro DEBERÁ mostrar un texto en español de una sola oración de 200
   caracteres o menos que nombre la primera exigencia sin confirmar en el orden en que EL Nivel las
   declara y una acción a intentar escrita con comandos que EL Vocabulario declara para el mundo del
   Nivel, sin incluir el programa de referencia ni ninguna parte de él.
9. SI LAS Estrellas niegan la estrella de economía, ENTONCES EL Globo_Kiro DEBERÁ mostrar un texto en
   español de una sola oración de 200 caracteres o menos que contenga el entero del conteo del jugador y
   el entero del `presupuestoEstrella`, los dos tal como LAS Estrellas los devuelven en el resultado del
   criterio 1, sin recalcular ni redondear ninguno de los dos.
10. SI LAS Estrellas reciben un intento sin veredicto del Validador, porque EL Parser reportó al menos
    un error y no hay AST ejecutable o porque una guarda de ejecución detuvo el programa, ENTONCES LAS
    Estrellas DEBERÁN negar las tres estrellas, devolver como motivo de cada una la causa recibida, y no
    lanzar ninguna excepción ni devolver ningún resultado parcial.
11. CUANDO LAS Estrellas evalúan dos veces el mismo AST del jugador con el mismo veredicto del Validador
    y el mismo Reto, LAS Estrellas DEBERÁN devolver las mismas tres estrellas, los mismos motivos y los
    mismos dos enteros, y DEBERÁN dejar el AST, el veredicto y el Reto recibidos sin ninguna
    modificación.

### Requisito 20: Persistencia del progreso

**Historia de usuario:** Como jugador, quiero que mis estrellas sigan ahí cuando vuelva a abrir el
juego, sin crear una cuenta.

#### Criterios de aceptación

1. CUANDO una ejecución del programa del jugador termina y LAS Estrellas devuelven su calificación,
   tanto si conceden las tres estrellas como si niegan alguna, EL Progreso DEBERÁ guardar en
   `localStorage`, antes de que EL Juego admita otra ejecución, el identificador del Nivel, la semilla
   efectiva del Reto y el estado de las tres estrellas —precisión, economía y abstracción— como un
   valor de verdadero o falso por estrella; un intento que no llegó a producir una calificación de LAS
   Estrellas, porque el texto no se pudo analizar o porque la ejecución se detuvo antes de terminar, no
   DEBERÁ modificar el contenido guardado.
2. CUANDO EL Juego arranca, EL Progreso DEBERÁ leer una sola vez el contenido de `localStorage` y
   obtener de él el estado de las tres estrellas de cada identificador de Nivel registrado y el último
   reto en curso, entendido como el par formado por el identificador del Nivel y la semilla del último
   intento guardado, y DEBERÁ responder con ese contenido todas las consultas de estrellas de la
   sesión, actualizándolo con cada guardado.
3. CUANDO EL jugador vuelve a jugar un Nivel que ya tiene un registro guardado, EL Progreso DEBERÁ
   guardar cada una de las tres estrellas con el valor verdadero si el registro previo o el intento
   nuevo la concedió, de modo que ninguna estrella ya ganada vuelva a falso, y DEBERÁ actualizar el
   último reto en curso con el identificador del Nivel y la semilla del intento nuevo aunque ese
   intento no gane ninguna estrella.
4. EL Progreso DEBERÁ guardar todo su contenido en una única clave de `localStorage` cuyo nombre
   incluye un número de versión de formato entero positivo, DEBERÁ escribir como valor un único texto
   JSON que declara ese mismo número de versión, DEBERÁ mantener a lo sumo un registro por
   identificador de Nivel declarado en el catálogo, y no DEBERÁ escribir ni borrar ninguna otra clave
   de `localStorage`.
5. SI al arrancar EL Juego la clave del criterio 4 está ausente, su valor no se puede analizar como
   JSON, su contenido no declara un número de versión, o declara una versión que EL Progreso no
   reconoce, ENTONCES EL Progreso DEBERÁ arrancar con un progreso vacío —ningún Nivel registrado,
   ninguna estrella y ningún último reto en curso—, DEBERÁ dejar EL Juego jugable con la demostración,
   la escritura, la ejecución y la calificación disponibles, no DEBERÁ lanzar ninguna excepción, y
   DEBERÁ conservar el valor no reconocido sin borrarlo hasta el primer guardado exitoso, que lo
   reemplaza por completo.
6. EL Progreso DEBERÁ escribir únicamente el número de versión del formato, el identificador de cada
   Nivel, la semilla de cada reto, el estado de las tres estrellas y el último reto en curso, y ningún
   otro dato: en particular ningún nombre, ningún correo, ningún identificador de dispositivo o de
   sesión, y ningún fragmento del texto que el jugador escribió; y no DEBERÁ enviar el contenido
   guardado por la red.
7. SI la escritura en `localStorage` falla porque el almacenamiento no está disponible o porque se
   agotó su cuota, ENTONCES EL Progreso DEBERÁ conservar en memoria el resultado del intento y seguir
   respondiendo con él las consultas de estrellas de la sesión en curso, EL Globo_Kiro DEBERÁ informar
   una sola vez por sesión que el progreso no se guardará, EL Juego DEBERÁ seguir jugable, y EL
   Progreso no DEBERÁ reintentar la escritura de ese mismo intento ni lanzar ninguna excepción.
8. SI un registro leído nombra un identificador de Nivel que ningún Nivel declara, una semilla fuera
   del dominio de 0 a 4 294 967 295 que admite EL Codigo_Semilla, o un estado de estrella que no es
   verdadero ni falso, ENTONCES EL Progreso DEBERÁ descartar únicamente ese registro, conservar los
   registros restantes que cumplen la forma esperada, arrancar sin ningún último reto en curso si el
   registro descartado era el que lo declaraba, y no DEBERÁ lanzar ninguna excepción.
9. CUANDO EL Juego se recarga después de un guardado exitoso, EL Progreso DEBERÁ devolver para cada
   Nivel registrado el mismo estado de las tres estrellas y el mismo último reto en curso
   —identificador de Nivel y semilla— que devolvía inmediatamente después de ese guardado.

### Requisito 21: Editor y contador de instrucciones

**Historia de usuario:** Como jugador, quiero escribir mi programa con números de línea y ver cuántas
instrucciones llevo, para relacionar los errores con la línea y para cuidar el presupuesto.

#### Criterios de aceptación

1. EL Editor DEBERÁ presentar el programa en un `textarea` nativo acompañado de una canaleta que
   muestre exactamente un número por cada línea del contenido, numerados de forma consecutiva desde 1,
   con el desplazamiento vertical de la canaleta igual al del área de escritura en todo momento, y
   DEBERÁ actualizar la canaleta en 100 milisegundos o menos después de cada cambio del número de
   líneas.
2. EL Editor DEBERÁ admitir hasta 200 líneas y hasta 10 000 caracteres, ambos límites inclusive,
   contando como una línea cada fragmento delimitado por un fin de línea —reconociendo como un solo fin
   de línea tanto el salto de línea solo como el retorno de carro seguido de salto de línea—, contando
   la última línea aunque no termine en fin de línea, y contando dentro de los 10 000 caracteres los
   espacios, los tabuladores y los fines de línea.
3. SI una escritura, un pegado o una inserción del Panel_Comandos llevaría el contenido a más de 200
   líneas o a más de 10 000 caracteres, ENTONCES EL Editor DEBERÁ descartar únicamente la parte que
   excede el límite, conservar sin modificar el contenido admitido, dejar el cursor al final de ese
   contenido, mantener el área de escritura habilitada y pedir al Globo_Kiro un mensaje que nombre cuál
   de los dos límites se alcanzó y su valor.
4. CUANDO EL contenido del Editor cambia, EL Editor DEBERÁ analizar el texto en curso con EL Lexer y EL
   Parser y mostrar como contador de instrucciones el entero que devuelve la única función de conteo que
   expone EL Conteo para el AST resultante, en 200 milisegundos o menos después del último cambio, sin
   recorrer EL AST por su cuenta, sin bloquear la escritura mientras analiza, y mostrando 0 cuando el
   texto está vacío o solo contiene espacios, tabuladores, fines de línea y comentarios.
5. SI EL Lexer, EL Parser o EL Conteo reportan al menos un error para el texto en curso, ENTONCES EL
   Editor DEBERÁ seguir mostrando el último conteo obtenido sin errores acompañado de una marca de
   provisional legible como texto en español además de cualquier diferencia de color, DEBERÁ mostrar 0
   marcado como provisional cuando todavía no obtuvo ningún conteo sin errores, y DEBERÁ mantener el
   área de escritura habilitada y el cursor en su posición.
6. EL Editor DEBERÁ mostrar junto al contador de instrucciones el `presupuestoEstrella` que devuelve EL
   Reto en curso, como el mismo entero con el que LAS Estrellas evalúan la economía, y DEBERÁ exponer
   los dos números en un nombre accesible en español que los nombre por separado.
7. CUANDO EL Editor recibe los errores que EL Lexer o EL Parser reportan para el texto en curso, EL
   Editor DEBERÁ marcar en la canaleta la línea de cada error, hasta un máximo de 20 marcas en el orden
   de línea y de columna en que los recibe, con una marca distinguible por forma además de por color,
   DEBERÁ mostrar por cada línea marcada su número y el texto del mensaje del Catalogo_Errores, y DEBERÁ
   retirar la marca de toda línea que ya no exista en el contenido en curso.
8. CUANDO EL jugador pulsa `Tab` con el foco en el área de escritura, EL Editor DEBERÁ mover el foco al
   siguiente elemento interactivo del Juego en una sola pulsación, DEBERÁ moverlo al elemento anterior
   cuando la pulsación es `Mayús`+`Tab`, y no DEBERÁ insertar ningún carácter en el contenido ni retener
   el foco para ninguna otra acción.
9. EL Editor DEBERÁ presentar el contenido con un único estilo de texto para todas sus líneas, sin
   ningún estilo que dependa del tipo de token ni del comando escrito, admitiendo como únicas marcas
   sobre el texto el resaltado de la línea en curso del modo paso a paso y las marcas de error de la
   canaleta, y dejando el resaltado de sintaxis para una spec posterior.
10. CUANDO EL Juego presenta un Reto al jugador, EL Editor DEBERÁ dejar el área de escritura vacía, el
    contador de instrucciones en 0 y sin marca de provisional, el `presupuestoEstrella` de ese Reto
    junto al contador, y la canaleta sin ninguna marca de error.
11. MIENTRAS el contador de instrucciones del Editor es mayor que el `presupuestoEstrella` del Reto en
    curso, EL Editor DEBERÁ señalar el exceso con un texto en español además de cualquier diferencia de
    color, y DEBERÁ mantener el área de escritura habilitada, dado que en el mundo 0 el `limiteDuro`
    está inactivo.

### Requisito 22: Demostración en vivo de Kiro

**Historia de usuario:** Como jugador, quiero ver a Kiro dibujar la figura en vivo tantas veces como
necesite, para poder leer las longitudes y los giros en lugar de adivinarlos de una imagen.

#### Criterios de aceptación

1. CUANDO EL jugador entra a un Nivel, LA Demostracion DEBERÁ dibujar los Personajes en el
   Estado_Tortuga inicial del Nivel en 1 000 milisegundos o menos y mantenerlos quietos 500
   milisegundos o más, para que el punto de partida y el rumbo inicial queden en pantalla antes del
   primer movimiento, y a continuación DEBERÁ entregar a EL Animador la secuencia completa de
   Operaciones que ya trae el Reto en curso —con la velocidad normal de 400 milisegundos por Operacion
   como selección inicial y con la capa de la estela de referencia del Lienzo como destino del trazo—
   para que las aplique en el orden ascendente de su índice de paso, una sola vez cada una y sin omitir
   ninguna, haciendo crecer un tramo en cada Operacion `mover` con el lápiz abajo y girando la tortuga
   sin moverla de sitio en cada Operacion `girar`, sin volver a invocar EL Interprete y sin dibujar ni
   borrar ningún píxel de la capa de la estela del jugador.
2. CUANDO EL Animador aplica la última Operacion de la Demostracion, LA Demostracion DEBERÁ conservar
   en la capa de la estela de referencia todos los tramos dibujados, con el contraste y el estilo de
   línea que EL Lienzo declara para esa capa; DEBERÁ devolver la tortuga al Estado_Tortuga inicial del
   Nivel en 500 milisegundos o menos sin dibujar ningún tramo durante ese regreso; DEBERÁ dejar iguales
   píxel por píxel el fondo con cuadrícula y la capa de la estela del jugador; y DEBERÁ dejar
   habilitados el control de repetición y la acción de ejecutar de LOS Controles.
3. LA Demostracion DEBERÁ ofrecer un control de repetición habilitado desde que EL jugador entra al
   Nivel y hasta que lo abandona, que admite un número ilimitado de activaciones, que no descuenta
   ninguna instrucción del contador del Editor ni del `presupuestoEstrella` del Reto y que no altera el
   resultado de LAS Estrellas, de modo que un mismo programa del jugador obtenga las mismas tres
   estrellas con independencia de cuántas veces se haya reproducido LA Demostracion, incluidas cero
   veces.
4. LA Demostracion DEBERÁ ofrecer las mismas cuatro velocidades de reproducción que declara EL
   Animador —1 000, 400 y 120 milisegundos por Operacion, y la inmediata sin espera entre
   Operaciones—, DEBERÁ aplicar un cambio de velocidad a partir de la siguiente Operacion pendiente sin
   volver a dibujar ninguna Operacion ya aplicada ni reiniciar la secuencia, y DEBERÁ conservar la
   velocidad seleccionada de una repetición a la siguiente.
5. LA Demostracion DEBERÁ tomar el AST del programa de referencia y la secuencia de Operaciones de la
   misma resolución del Reto de la que EL Validador obtiene sus segmentos objetivo, sin invocar EL
   Interprete, sin volver a resolver EL Reto y sin modificar ninguna Operacion recibida, de modo que
   los segmentos que EL Extractor_Segmentos obtiene de la secuencia que LA Demostracion acaba de
   dibujar sean los mismos segmentos objetivo del Validador, con los mismos puntos y en el mismo orden,
   con independencia de la velocidad seleccionada y del número de repeticiones.
6. MIENTRAS LA Demostracion está en curso, EL Juego DEBERÁ mantener habilitada el área de escritura del
   Editor, admitir toda pulsación de teclado dirigida a ella sin descartar ningún carácter, actualizar
   el contador de instrucciones con el número que devuelve EL Conteo para el texto en curso, y
   conservar el foco del teclado en el elemento que lo tenía al iniciar LA Demostracion sin moverlo al
   Lienzo.
7. LA Demostracion DEBERÁ anunciar en español, en la región `aria-live` con cortesía `polite` del Juego
   y en 500 milisegundos o menos desde cada suceso, el inicio de cada reproducción y su fin, nombrando
   en el anuncio de fin el número de tramos dibujados y el número de giros de la secuencia, sin mover
   el foco del teclado, y DEBERÁ emitir los dos anuncios de nuevo en cada repetición.
8. CUANDO EL jugador activa el control de repetición, LA Demostracion DEBERÁ detener en 100
   milisegundos o menos cualquier reproducción en curso, borrar únicamente la capa de la estela de
   referencia, y volver a aplicar desde el Estado_Tortuga inicial del Nivel la misma secuencia de
   Operaciones del mismo Reto, conservando sin cambios el texto del Editor, la capa de la estela del
   jugador, y el Reto en curso con su semilla y su código de semilla.
9. SI EL jugador pulsa ejecutar mientras LA Demostracion está en curso, ENTONCES LA Demostracion DEBERÁ
   detenerse en 100 milisegundos o menos, dibujar de inmediato en la capa de la estela de referencia
   los tramos de las Operaciones que quedaban pendientes sin dibujar ninguna posición intermedia,
   devolver la tortuga al Estado_Tortuga inicial del Nivel, y ceder EL Animador a la ejecución del
   programa del jugador sin descartar esa pulsación y sin volver a resolver EL Reto.
10. SI EL Reto en curso no aporta ninguna Operacion, ENTONCES LA Demostracion DEBERÁ dejar la capa de
    la estela de referencia sin ningún píxel dibujado, dibujar los Personajes en el Estado_Tortuga
    inicial del Nivel, informar en EL Globo_Kiro que el Nivel no tiene demostración que reproducir,
    mantener habilitados EL Editor, LOS Controles y el control de repetición, y terminar sin lanzar
    ninguna excepción y sin dejar ninguna reproducción en curso.

### Requisito 23: Comparación y diff visual

**Historia de usuario:** Como jugador que falló, quiero ver en qué se diferencia mi dibujo del de
Kiro, para corregir mi programa en lugar de probar al azar.

#### Criterios de aceptación

1. LA Comparacion DEBERÁ presentar la estela de referencia del Reto y la estela de la última ejecución
   del jugador lado a lado, en dos lienzos que comparten el espacio lógico de 800 × 800 unidades, la
   cuadrícula de 20 unidades que dibuja EL Lienzo y una escala uniforme cuya diferencia entre los dos
   lienzos es de 1 píxel de pantalla o menos, sin recortar ni reencuadrar ninguna de las dos figuras, y
   DEBERÁ rotular cada lienzo con un texto y un nombre accesible en español que identifican de quién es
   la figura, para que la autoría no dependa solo de la posición en la pantalla.
2. CUANDO EL jugador activa, con el teclado o con el ratón, el control conmutador de dos estados que
   LA Comparacion ofrece, LA Comparacion DEBERÁ alternar entre la vista lado a lado y la vista de
   superposición, dibujando en la superposición las dos estelas en un solo lienzo alineadas en las
   mismas coordenadas del Lienzo lógico y distinguibles entre sí por estilo de línea además del color,
   completar el cambio de vista en 200 milisegundos o menos, exponer en el control cuál de los dos
   estados está en curso, y no volver a ejecutar ningún programa con EL Interprete.
3. SI LAS Estrellas niegan la estrella de precisión al terminar una ejecución del jugador, ENTONCES EL
   Diff DEBERÁ dibujar sobre la vista de superposición, sin que EL jugador active ningún control, la
   región de coincidencia en verde y línea continua sin huecos, la región de exceso en rojo y línea con
   un grosor de al menos el doble del de la coincidencia, y la región de falta en gris y línea punteada
   con guiones y huecos alternados de entre 4 y 12 unidades del Lienzo lógico, tomando el color y el
   grosor de cada estado del tema de la interfaz, sin literales de color ni de grosor en el módulo, y
   con un contraste de al menos 3:1 de cada uno de los tres estados frente al fondo del Lienzo.
4. EL Diff DEBERÁ distinguir sus tres estados por patrón de guiones y por grosor además del color, de
   modo que, dibujados los tres con un mismo color de trazo sobre el mismo fondo, cada par de estados
   siga diferenciándose por su patrón de guiones o por una relación de grosor de 2 o más, y DEBERÁ
   nombrar cada estado por lo que significa —lo que coincide, lo que sobra y lo que falta— en todo texto
   que lo describa, sin usar el nombre del color como único identificador.
5. EL Diff DEBERÁ recibir como entrada las tres regiones de 800 × 800 —coincidencia, exceso y falta—
   junto con la traslación y el ángulo que devuelve EL Validador, DEBERÁ dibujarlas aplicando esa misma
   traslación y ese mismo ángulo para que queden alineadas con las estelas que EL jugador vio dibujar, y
   DEBERÁ dibujar los tres estados con esos mismos datos cualquiera que sea el veredicto de precisión,
   sin invocar de nuevo al Validador, sin volver a rasterizar ningún segmento y sin ejecutar EL
   Interprete.
6. SI EL Validador devuelve un IoU de 0.90 o mayor y un exceso de trazo superior al 5 % de la máscara
   objetivo, ENTONCES EL Globo_Kiro DEBERÁ comentar el resultado nombrando el trazo sobrante como la
   única causa del fallo de precisión, indicando el porcentaje de exceso redondeado a un decimal y el
   umbral del 5 %, sin atribuir el fallo a la forma ni a la escala de la figura.
7. CUANDO EL Diff termina de dibujar los tres estados, LA Comparacion DEBERÁ publicar en la región
   `aria-live` del Juego, con cortesía `polite` y en 1 segundo o menos, un texto en español que incluye
   el IoU redondeado a dos decimales, el porcentaje de exceso de trazo redondeado a un decimal, y si hay
   o no trazo sobrante y trazo faltante, sin nombrar ningún color como único identificador de un estado.
8. SI EL jugador no ha ejecutado ningún programa en el Reto en curso, o su última ejecución no encendió
   ninguna posición en la región de coincidencia ni en la de exceso, ENTONCES LA Comparacion DEBERÁ
   presentar el lienzo del jugador con la cuadrícula y sin ninguna estela, EL Diff DEBERÁ dibujar
   únicamente la región de falta, LA Comparacion DEBERÁ anunciar en la región `aria-live` que todavía no
   hay estela del jugador que comparar, y el control conmutador DEBERÁ seguir operable sin lanzar
   ninguna excepción.
9. CUANDO EL Diff dibuja dos veces las mismas tres regiones con la misma traslación, el mismo ángulo y
   el mismo tamaño de área de dibujo, EL Diff DEBERÁ producir el mismo dibujo píxel por píxel y DEBERÁ
   dejar las tres regiones recibidas iguales posición por posición, sin modificar ninguna de ellas.
10. MIENTRAS LA Comparacion muestra la vista de superposición con el Diff dibujado, EL Juego DEBERÁ
    mantener EL Editor disponible para escribir y DEBERÁ conservar en pantalla las dos estelas y los
    tres estados del Diff hasta la siguiente ejecución del programa del jugador.

### Requisito 24: Controles de ejecución

**Historia de usuario:** Como jugador, quiero ejecutar, pausar, avanzar de a un paso, cambiar la
velocidad y reiniciar, para controlar el ciclo de prueba y error.

#### Criterios de aceptación

1. LOS Controles DEBERÁN presentar exactamente seis acciones —ejecutar, detener, dar un paso, cambiar
   la velocidad, reiniciar y volver a ver la demostración—, cada una en un único elemento interactivo,
   donde la acción de cambiar la velocidad ofrece las cuatro velocidades que declara EL Animador
   (lenta, normal, rápida e inmediata) con una sola seleccionada a la vez y la normal seleccionada al
   entrar al Nivel; las acciones de dar un paso y de reiniciar invocan respectivamente el modo paso a
   paso y el reinicio que declara EL Animador; y la acción de volver a ver la demostración invoca la
   repetición que ofrece LA Demostracion, sin alterar el texto del Editor ni las Estrellas ya
   otorgadas.
2. CUANDO EL jugador activa la acción de ejecutar y el análisis del texto en curso del Editor con EL
   Lexer y EL Parser no reporta ningún error, LOS Controles DEBERÁN volver la tortuga al
   Estado_Tortuga inicial del Nivel y borrar únicamente la capa de la estela del jugador antes de
   dibujar, ejecutar el Programa resultante con EL Interprete pasándole el conjunto de comandos que EL
   Vocabulario declara para el mundo del Nivel y la semilla del Reto, y reproducir sus Operaciones con
   EL Animador a la velocidad seleccionada, comenzando a dibujar en 200 milisegundos o menos desde la
   activación.
3. SI EL Lexer o EL Parser reportan al menos un error al analizar el texto en curso del Editor tras
   activar la acción de ejecutar, ENTONCES LOS Controles DEBERÁN mostrar en EL Globo_Kiro, en 1 000
   milisegundos o menos, los mensajes que EL Catalogo_Errores declara para esos errores, hasta un
   máximo de 20 y en el orden en que los devuelve EL Parser; no DEBERÁN invocar EL Interprete ni EL
   Animador; y DEBERÁN conservar sin cambios el texto del Editor, la estela ya dibujada y el
   Estado_Tortuga en pantalla, dejando habilitada la acción de ejecutar.
4. MIENTRAS una ejecución del programa del jugador está en curso, LOS Controles DEBERÁN mantener
   deshabilitadas la acción de ejecutar y la de volver a ver la demostración, y habilitadas las de
   detener, dar un paso, cambiar la velocidad y reiniciar, reflejando cada cambio de estado en 100
   milisegundos o menos, exponiendo el estado deshabilitado de forma programática además de visual, y
   sin ejecutar ninguna acción ni modificar el Lienzo cuando EL jugador activa un control
   deshabilitado.
5. LOS Controles DEBERÁN ordenar el foco de sus seis acciones siguiendo el orden visual de izquierda a
   derecha y de arriba abajo, dejar cada acción alcanzable desde EL Editor en 10 pulsaciones de `Tab` o
   menos, permitir activarla con `Enter` y con la barra espaciadora sin requerir ningún dispositivo
   apuntador, mantener visible el indicador de foco en el control enfocado, no capturar el foco —una
   pulsación de `Tab` en el último control lo lleva fuera del grupo—, y, cuando el control que tiene el
   foco se deshabilita, mover el foco al control de detener si el deshabilitado fue el de ejecutar y al
   de ejecutar en el caso contrario, de modo que el foco nunca quede en un elemento no interactivo.
6. LOS Controles DEBERÁN exponer para cada una de sus seis acciones un nombre accesible en español, no
   vacío, distinto del de las otras cinco y estable durante toda la sesión; para cada una de las cuatro
   velocidades, un nombre accesible en español que la distinga de las otras tres; y de forma
   programática, el estado habilitado o deshabilitado de cada acción y cuál velocidad está
   seleccionada, sin depender de un icono ni del color para transmitir de qué acción se trata.
7. CUANDO EL jugador activa la acción de detener con una ejecución en curso, LOS Controles DEBERÁN
   dejar de consumir Operaciones en 100 milisegundos o menos, conservar en EL Lienzo la estela dibujada
   hasta ese punto y el Estado_Tortuga alcanzado, conservar sin cambios el texto del Editor,
   deshabilitar la acción de detener y habilitar la de ejecutar y la de volver a ver la demostración, y
   no DEBERÁN otorgar ninguna Estrella de ese intento ni mostrar ningún mensaje del Catalogo_Errores,
   porque la detención la pidió EL jugador.
8. CUANDO EL Animador devuelve el resultado de fin de secuencia de la ejecución del programa del
   jugador, LOS Controles DEBERÁN, en 100 milisegundos o menos, habilitar la acción de ejecutar y la de
   volver a ver la demostración, deshabilitar la de detener, y entregar a LAS Estrellas la secuencia
   completa de Operaciones aplicadas junto con el AST analizado, para que evalúen precisión, economía y
   abstracción sobre ese mismo intento.
9. SI EL Interprete corta la ejecución con una de las tres guardas, ENTONCES LOS Controles DEBERÁN
   detener la reproducción, conservar en EL Lienzo la estela parcial de las Operaciones ya aplicadas,
   mostrar en EL Globo_Kiro el mensaje que EL Catalogo_Errores declara para esa guarda, habilitar la
   acción de ejecutar y deshabilitar la de detener, sin otorgar ninguna Estrella de ese intento y sin
   modificar el texto del Editor.

### Requisito 25: Globo de diálogo de Kiro

**Historia de usuario:** Como jugador, quiero que Kiro me comente qué pasó y me dé una pista cuando me
atoro, para no quedarme sin camino a seguir.

#### Criterios de aceptación

1. EL Globo_Kiro DEBERÁ ser el único elemento del Juego que presenta texto dirigido al jugador —el
   comentario de resultado, los escalones de pista, los mensajes del Catalogo_Errores y la
   celebración—, atribuyendo todo ese texto a Kiro como emisor, y ningún otro elemento del Juego DEBERÁ
   presentar un globo de diálogo propio ni ningún texto atribuido a la tortuga; quedan fuera de este
   criterio los nombres accesibles, las etiquetas, los números de línea y los anuncios de estado, que no
   son mensajes de Kiro.
2. CUANDO LAS Estrellas devuelven la calificación de un intento del jugador, EL Globo_Kiro DEBERÁ
   mostrar en 1 000 milisegundos o menos un texto en español de 300 caracteres o menos que nombre las
   tres estrellas —precisión, economía y abstracción— y, por cada una, si quedó otorgada o negada, sin
   omitir ninguna de las tres y sin depender de ningún color ni de ningún icono para distinguir otorgada
   de negada.
3. MIENTRAS EL Globo_Kiro tiene 0, 1 o 2 escalones de pista abiertos en el Reto en curso, CUANDO EL
   jugador pide una pista, EL Globo_Kiro DEBERÁ mostrar en 1 000 milisegundos o menos el escalón que
   sigue al último abierto, en el orden fijo conceptual, matemática y esqueleto de código que declara EL
   Nivel, con el texto tal como EL Nivel lo declara y sin agregarle ningún comando ni ningún número, y
   no DEBERÁ mostrar el programa de referencia completo ni el texto que EL Impresor produce para el AST
   de referencia.
4. CUANDO EL Globo_Kiro recibe uno o más mensajes del Catalogo_Errores, EL Globo_Kiro DEBERÁ mostrarlos
   con el texto exacto que devuelve EL Catalogo_Errores, carácter por carácter, sin truncarlo, sin
   reescribirlo y sin agregar ningún nombre de excepción, ninguna traza de pila ni ningún código
   numérico, presentándolos en el orden en que los recibe y hasta un máximo de 20, y DEBERÁ mantenerlos
   visibles hasta la siguiente ejecución del programa del jugador o hasta que EL jugador pulse
   reiniciar.
5. CUANDO EL Globo_Kiro cambia su contenido, EL Globo_Kiro DEBERÁ publicar ese mismo texto en español en
   la región `aria-live` con cortesía `polite` del Juego, en 1 000 milisegundos o menos, reemplazando
   por completo el contenido anterior de la región, sin usar en ningún caso la cortesía `assertive` y
   sin mover el foco del teclado del elemento que lo tenía.
6. EL Globo_Kiro DEBERÁ mantener en memoria, para el Reto en curso, el número de escalones de pista
   abiertos como un entero de 0 a 3, iniciarlo en 0, aumentarlo en exactamente 1 cada vez que muestra un
   escalón por primera vez en ese Reto, dejarlo sin cambio cuando vuelve a mostrar un escalón ya
   abierto, exponerlo para consulta durante toda la sesión, y no DEBERÁ escribirlo en `localStorage` ni
   pedir a EL Progreso que lo guarde, dado que las insignias quedan fuera de esta spec.
7. EL Globo_Kiro DEBERÁ presentar un único elemento interactivo para pedir pista, con un nombre
   accesible en español no vacío y estable durante toda la sesión, alcanzable desde EL Editor en 10
   pulsaciones de `Tab` o menos, activable con `Enter` y con la barra espaciadora sin requerir ningún
   dispositivo apuntador, con el indicador de foco visible mientras lo tiene, y sin capturar el foco:
   una pulsación de `Tab` sobre él lleva el foco fuera del Globo_Kiro.
8. SI EL jugador pide una pista cuando ya abrió los tres escalones del Reto en curso, ENTONCES EL
   Globo_Kiro DEBERÁ conservar visible el texto del tercer escalón, mostrar un texto en español de 200
   caracteres o menos que informe que no hay más escalones para ese Reto, dejar el número de escalones
   abiertos en 3 sin aumentarlo, y no DEBERÁ mostrar el programa de referencia ni ninguna parte de él.
9. CUANDO EL Juego presenta un Reto cuyo identificador de Nivel o cuya semilla efectiva difiere del
   anterior, EL Globo_Kiro DEBERÁ volver a 0 el número de escalones de pista abiertos, dejar el escalón
   conceptual como el siguiente en mostrarse y vaciar el texto de pista visible; y no DEBERÁ reiniciar
   ese número cuando EL jugador vuelve a ejecutar su programa, repite la demostración o pulsa reiniciar
   dentro del mismo Reto.

### Requisito 26: Panel de comandos desbloqueados

**Historia de usuario:** Como jugador que empieza, quiero ver solo los comandos que puedo usar con su
ejemplo, para no enfrentarme a veinticinco comandos de golpe.

#### Criterios de aceptación

1. EL Panel_Comandos DEBERÁ obtener los comandos que presenta consultando al Vocabulario por el
   mundo del Nivel en curso, tomando todas las entradas cuyo mundo de desbloqueo es menor o igual a
   ese mundo, una sola vez cada una y en el mismo orden en que EL Vocabulario las devuelve, sin
   mantener ninguna lista propia de comandos, de modo que en un Nivel del mundo 0 presente
   exactamente seis entradas: `AVANZA`, `RETROCEDE`, `GIRADERECHA`, `GIRAIZQUIERDA`, `CENTRO` y
   `BORRAPANTALLA`.
2. EL Panel_Comandos DEBERÁ mostrar por cada entrada, como texto visible y en el nombre accesible en
   español de su elemento interactivo, el nombre largo, la abreviatura, la descripción en español y
   el ejemplo de uso que EL Vocabulario declara para ella, carácter por carácter y sin recortarlos ni
   reescribirlos, con la descripción en una sola línea de 120 caracteres o menos, y sin depender de
   un icono ni del color para transmitir de qué comando se trata.
3. EL Panel_Comandos DEBERÁ omitir toda entrada del Vocabulario cuyo mundo de desbloqueo es mayor que
   el mundo del Nivel en curso, de modo que en un Nivel del mundo 0 ningún nombre largo, ninguna
   abreviatura, ninguna descripción y ningún ejemplo de los mundos 1 a 5 —`REPITE` y `RP` entre
   ellos— aparezca en ningún texto visible ni en ningún nombre accesible del Panel_Comandos, y sin
   ofrecer ningún elemento interactivo para esas entradas.
4. CUANDO EL jugador activa el elemento de un comando del Panel_Comandos con el ratón, con `Enter` o
   con la barra espaciadora, EL Editor DEBERÁ insertar en la posición del cursor el ejemplo de uso
   que EL Vocabulario declara para ese comando, reemplazando el texto seleccionado cuando hay una
   selección y agregándolo al final del contenido cuando todavía no hay posición de cursor, dejando
   el cursor inmediatamente después del texto insertado, en 100 milisegundos o menos desde la
   activación y sin modificar ninguna otra parte del contenido.
5. EL Panel_Comandos DEBERÁ dejar cada uno de sus elementos de comando alcanzable con el teclado
   desde EL Editor en 10 pulsaciones de `Tab` o menos, activable con `Enter` y con la barra
   espaciadora sin ningún dispositivo apuntador, con el indicador de foco visible en el elemento
   enfocado; DEBERÁ llevar el foco fuera del Panel_Comandos con una sola pulsación de `Tab` desde su
   último elemento y al elemento anterior con `Mayús`+`Tab`; y DEBERÁ conservar el foco en el
   elemento activado después de una inserción, sin retener ninguna pulsación de `Tab` para otra
   acción.
6. SI la inserción del ejemplo llevaría el contenido del Editor a más de 200 líneas o a más de
   10 000 caracteres, ENTONCES EL Panel_Comandos DEBERÁ entregar el ejemplo íntegro al Editor sin
   truncarlo ni descartarlo por su cuenta, dejando que EL Editor aplique su regla de límites y que
   sea EL Editor quien pida el mensaje al Globo_Kiro, DEBERÁ conservar sin cambios la lista de
   comandos presentada y el foco en el elemento activado, y DEBERÁ terminar sin lanzar ninguna
   excepción.
7. CUANDO EL Editor termina de insertar un ejemplo pedido desde el Panel_Comandos, EL Panel_Comandos
   DEBERÁ publicar en la región `aria-live` con cortesía `polite` del Juego, en 500 milisegundos o
   menos, un texto en español que nombra el comando insertado y el número de la línea donde quedó el
   cursor, sin mover el foco del teclado.
8. CUANDO EL Juego presenta un Nivel al jugador, EL Panel_Comandos DEBERÁ presentar la lista completa
   de los comandos desbloqueados de ese Nivel en 500 milisegundos o menos, con todos sus elementos
   operables, y DEBERÁ presentar esa misma lista en ese mismo orden cada vez que EL Juego presenta un
   Nivel del mismo mundo.

### Requisito 27: El nivel 0.1 jugable de punta a punta

**Historia de usuario:** Como jugador, quiero entrar al primer nivel, ver la demostración, escribir mi
programa y recibir mis estrellas, para comprobar que el juego funciona completo y no en partes.

#### Criterios de aceptación

1. EL Juego DEBERÁ incluir en el catálogo de niveles el Nivel autorado `0.1`, con el identificador
   `0.1`, el mundo 0, el concepto secuencia y un título en español no vacío de 60 caracteres o menos, y
   DEBERÁ declarar su programa de referencia armado nodo por nodo como un AST de exactamente una
   instrucción —una invocación de `AVANZA` con un único argumento numérico literal de valor 100—, sin
   construirlo analizando texto con EL Lexer ni con EL Parser, de modo que EL Conteo devuelva 1 para ese
   AST y EL Reto devuelva 1 como `presupuestoEstrella`.
2. EL Nivel `0.1` DEBERÁ declarar su normalización con traslación `libre`, rotación `libre` y escala
   `exacta`; su conjunto de exigencias de abstracción vacío; una semilla fija del dominio de 0 a
   4 294 967 295; ningún margen de `limiteDuro`; y sus tres pistas en el orden fijo conceptual,
   matemática y esqueleto de código, cada una un texto en español no vacío de 200 caracteres o menos y
   ninguna con el programa de referencia completo.
3. CUANDO se ejecuta `npm run dev` y se abre el Juego en el navegador, EL Juego DEBERÁ presentar el
   Nivel `0.1` como Reto en curso en 3 segundos o menos desde que el documento termina de cargar y sin
   registrar ningún mensaje de nivel error en la consola del navegador, con LA Demostracion
   reproduciendo una vez la secuencia de Operaciones de ese Reto sin que EL jugador active ningún
   control, EL Editor vacío con el contador de instrucciones en 0 y el `presupuestoEstrella` 1 a su
   lado, EL Panel_Comandos con los seis comandos que EL Vocabulario declara para el mundo 0 y ninguno de
   un mundo posterior, LOS Controles con sus seis acciones y EL Globo_Kiro con un texto en español no
   vacío, cualquiera que sea el contenido que EL Progreso encuentre guardado, incluido el progreso
   vacío.
4. CUANDO EL jugador escribe en EL Editor un programa cuyo Conteo es 1 y cuya única estela es un tramo
   recto de 100 unidades —como `AVANZA 100`, `av 100`, `Avanzá 100` o `RETROCEDE 100`, que la traslación
   y la rotación libres hacen coincidir con la figura de referencia— y activa la acción de ejecutar, EL
   Juego DEBERÁ otorgar las tres estrellas, y EL Globo_Kiro DEBERÁ celebrarlo en 1 segundo o menos desde
   el fin de la secuencia con un texto en español que nombre las tres estrellas obtenidas.
5. CUANDO EL jugador escribe `AVANZA 100 GIRADERECHA 90 AVANZA 100` en el Nivel `0.1` y activa la acción
   de ejecutar, EL Validador DEBERÁ negar la coincidencia geométrica con un exceso de trazo superior al
   5 % de la máscara objetivo —con la rotación libre, el mejor de los 360 giros del objetivo cubre a lo
   sumo uno de los dos tramos de 100 unidades del jugador y nunca los dos, así que el trazo sobrante
   queda cerca del 100 % del objetivo—, LAS Estrellas DEBERÁN negar la estrella de precisión con un
   motivo que incluya el IoU y el porcentaje de exceso que devuelve EL Validador, y EL Diff DEBERÁ
   dibujar sobre la vista de superposición, sin que EL jugador active ningún control, la región de exceso
   en rojo y con un grosor de al menos el doble del de la región de coincidencia.
6. CUANDO EL jugador escribe `AVANSA 100` en EL Editor y activa la acción de ejecutar, EL Globo_Kiro
   DEBERÁ mostrar en 1 000 milisegundos o menos el texto
   `No sé cómo hacer AVANSA. ¿Querías decir AVANZA?` tal como lo produce EL Catalogo_Errores, carácter
   por carácter incluidas las tildes y el signo de apertura `¿`; EL Juego no DEBERÁ invocar EL
   Interprete ni EL Animador ni producir ninguna Operacion; y EL Juego DEBERÁ conservar sin cambios el
   texto del Editor, la capa de la estela del jugador y el contenido que EL Progreso tiene guardado, sin
   otorgar ni negar ninguna estrella de ese intento y dejando habilitada la acción de ejecutar.
7. CUANDO EL Juego resuelve el Nivel `0.1` dos veces con la semilla fija que el Nivel declara, EL Reto
   DEBERÁ devolver las dos veces el mismo AST nodo por nodo, la misma secuencia de Operaciones con el
   mismo número de pasos, la misma lista de segmentos en el mismo orden, el `presupuestoEstrella` 1, el
   `limiteDuro` 4 con su indicador de actividad en falso y el mismo código de semilla de 7 caracteres,
   con independencia de cuántos otros Retos se hayan resuelto entre las dos resoluciones.
8. EL Juego DEBERÁ completar el flujo del Nivel `0.1` —demostración, escritura, ejecución, calificación
   y guardado— sin emitir ninguna solicitud de red después de la carga inicial de los archivos estáticos
   del propio origen, sin ninguna solicitud a un origen distinto de aquel desde el que se sirve, sin
   pedir ninguna credencial ni ningún registro al jugador, y escribiendo el progreso únicamente en la
   única clave de `localStorage` que declara EL Progreso, sin escribir ninguna cookie ni ningún otro
   almacenamiento del navegador.
9. CUANDO EL jugador gana las tres estrellas del Nivel `0.1` y a continuación vuelve a cargar el Juego,
   EL Progreso DEBERÁ devolver las tres estrellas de ese Nivel en verdadero y el mismo par de
   identificador de Nivel y semilla como último reto en curso, y EL Juego DEBERÁ volver a presentar el
   Nivel `0.1` jugable, con LA Demostracion, EL Editor, LOS Controles y la calificación disponibles.
10. CUANDO EL jugador ejecuta `AVANZA 100 GIRADERECHA 90 AVANZA 100` en el Nivel `0.1`, LAS Estrellas
    DEBERÁN negar la estrella de economía nombrando el conteo 3 del jugador y el `presupuestoEstrella` 1
    del Reto, y DEBERÁN negar la estrella de abstracción por no haber otorgado la de precisión, dado que
    EL Nivel `0.1` declara vacío su conjunto de exigencias de abstracción.
11. MIENTRAS EL Nivel `0.1` es el Reto en curso, EL Juego DEBERÁ ejecutar y calificar todo programa del
    jugador cuyo Conteo supera el `presupuestoEstrella` 1, dentro de los límites de 200 líneas y 10 000
    caracteres del Editor, reproduciendo todas sus Operaciones sin detener la ejecución por presupuesto,
    dado que el `limiteDuro` está inactivo en el mundo 0.

### Requisito 28: Accesibilidad

**Historia de usuario:** Como jugador que usa teclado o lector de pantalla, quiero poder jugar el
nivel completo, porque la accesibilidad es parte del producto y no un extra.

#### Criterios de aceptación

1. EL Juego DEBERÁ permitir completar el flujo del Nivel `0.1` sin ningún dispositivo apuntador —ver LA
   Demostracion y repetirla, cambiar la velocidad, insertar en EL Editor un ejemplo del Panel_Comandos,
   escribir y corregir el texto del programa, ejecutar, detener, dar un paso, reiniciar, alternar las dos
   vistas de LA Comparacion, pedir los tres escalones de pista del Globo_Kiro y leer las Estrellas
   otorgadas—, alcanzando cada uno de esos elementos interactivos con `Tab` y `Mayús`+`Tab` en un orden
   que coincide con el orden visual de izquierda a derecha y de arriba abajo, activándolos con `Enter` o
   con la barra espaciadora, y sin que ninguno retenga el foco: desde cualquier elemento interactivo, 20
   pulsaciones de `Tab` o menos DEBERÁN devolver el foco al área de escritura del Editor.
2. CUANDO EL Animador aplica una Operacion en modo paso a paso, EL Juego DEBERÁ publicar en su región
   `aria-live`, en 500 milisegundos o menos y sin mover el foco del teclado, un texto en español que
   nombra el número de línea de esa Operacion, la posición de la tortuga en unidades del Lienzo lógico
   redondeada al entero más cercano, el rumbo en grados redondeado al entero más cercano dentro del
   intervalo de 0 a 359, y el estado del lápiz con la palabra «abajo» o «arriba», y DEBERÁ publicar un
   texto por cada paso aplicado sin omitir ninguno.
3. EL Juego DEBERÁ mantener, medidas como relación de contraste de WCAG 2.1 sobre los valores del tema de
   la interfaz, una relación de 4.5:1 o mayor entre todo texto visible y el fondo sobre el que se dibuja,
   y una relación de 3:1 o mayor en cada uno de estos pares: cada elemento interactivo de LOS Controles,
   del Panel_Comandos y del Editor frente a su fondo adyacente; el indicador de foco frente al fondo
   adyacente; y frente al fondo del Lienzo, la estela del jugador, la estela de referencia atenuada, cada
   uno de los tres estados del Diff y el conjunto de la tortuga con Kiro.
4. EL Juego DEBERÁ comunicar cada estado de su retroalimentación —los tres estados del Diff, cada una de
   las tres Estrellas otorgada o negada, el estado habilitado o deshabilitado de cada acción de LOS
   Controles, la línea resaltada en modo paso a paso, cada línea marcada con error en la canaleta del
   Editor, la identidad de cada figura en LA Comparacion y el estado del lápiz de la tortuga— con al
   menos uno de estos canales además del color: texto en español, forma, patrón de guiones o grosor de
   línea; de modo que, presentados los estados de un mismo grupo en escala de grises, cada par siga
   distinguiéndose; y no DEBERÁ usar el nombre de un color como único identificador de un estado en
   ningún texto ni en ningún nombre accesible.
5. MIENTRAS el sistema operativo declara `prefers-reduced-motion` con el valor `reduce`, EL Juego DEBERÁ
   presentar sin animación de recorrido LA Demostracion y la ejecución del programa del jugador,
   dibujando en 100 milisegundos o menos el estado final que declara EL Animador; DEBERÁ presentar la
   celebración de las Estrellas sin ningún movimiento y comunicarla con el texto del Globo_Kiro; DEBERÁ
   completar el cambio de vista de LA Comparacion sin transición animada; DEBERÁ mantener disponible el
   modo paso a paso con una Operacion por paso; DEBERÁ dejar la misma estela final píxel por píxel que
   deja con la preferencia inactiva, sin suprimir ningún anuncio de la región `aria-live` ni ningún estado
   del Diff; y DEBERÁ reflejar en 1 segundo o menos un cambio de la preferencia ocurrido durante la
   sesión, sin recargar la página y sin perder el texto del Editor.
6. EL Juego DEBERÁ presentar en todo elemento interactivo que tiene el foco del teclado un indicador
   visible de 2 píxeles de pantalla de grosor o más que rodea el elemento por completo, con una relación
   de contraste de 3:1 o mayor frente al fondo adyacente, con independencia de si el foco llegó por
   teclado o por dispositivo apuntador, con exactamente un elemento enfocado a la vez, y sin dejar nunca
   el foco en un elemento no interactivo, oculto o deshabilitado.
7. EL Juego DEBERÁ presentar en español, con su acentuación completa, todo texto visible y todo nombre
   accesible, ninguno vacío, y DEBERÁ declarar el idioma del documento como español, admitiendo como
   únicas excepciones los nombres y las abreviaturas de comandos que declara EL Vocabulario y los
   términos técnicos estándar que este documento escribe en su forma original (`aria-live`,
   `prefers-reduced-motion`, WCAG).
8. EL Juego DEBERÁ exponer una única región `aria-live` con cortesía `polite`, presente desde que abre el
   Nivel y hasta que EL jugador lo abandona, que no recibe el foco del teclado, que es el destino de los
   anuncios del Globo_Kiro, de LA Demostracion, de LA Comparacion y de los cambios de Estado_Tortuga, que
   publica los anuncios en el orden en que se producen conservando el último hasta que llega el
   siguiente, y que funde en un solo anuncio los cambios de Estado_Tortuga separados por menos de 500
   milisegundos.
9. CUANDO EL Animador deja de consumir Operaciones porque llegó al fin de la secuencia, porque EL jugador
   activó la acción de detener o porque una de las tres guardas cortó la ejecución, EL Juego DEBERÁ
   publicar en su región `aria-live`, en 1 segundo o menos, un único texto en español que nombra el
   motivo, el número de Operaciones aplicadas y el Estado_Tortuga final con su posición, su rumbo y el
   estado del lápiz, y no DEBERÁ publicar ningún anuncio de Estado_Tortuga por las Operaciones
   intermedias de una reproducción continua.
10. LA Suite_Pruebas DEBERÁ verificar los criterios de este requisito que se comprueban sin tecnología
    asistiva —las relaciones de contraste de los valores del tema de la interfaz, la existencia de una
    única región `aria-live` con cortesía `polite`, un nombre accesible en español no vacío en cada
    elemento interactivo, y la distinción en escala de grises de los estados de cada grupo de
    retroalimentación—, DEBERÁ fallar cuando cualquiera de ellos deja de cumplirse, y DEBERÁ declarar en
    su informe que ese conjunto es el piso comprobable por código y que la validación completa de
    accesibilidad requiere pruebas manuales con tecnologías asistivas y revisión por una persona experta.

### Requisito 29: Verificación y pruebas de regresión

**Historia de usuario:** Como persona que desarrolla las siete specs siguientes, quiero una suite que
falle cuando algo de los cimientos se rompe, para construir encima con confianza.

#### Criterios de aceptación

1. CUANDO se ejecuta `npm test`, LA Suite_Pruebas DEBERÁ ejecutar al menos un archivo de prueba con al
   menos una aserción por cada uno de EL Vocabulario, EL Lexer, EL Parser, EL Impresor, EL Interprete,
   las tres guardas de ejecución, EL Conteo, EL Catalogo_Errores, LA Tortuga, EL Extractor_Segmentos,
   EL Encuadre, EL Validador, EL PRNG, EL Codigo_Semilla, EL Reto y LAS Estrellas, y DEBERÁ terminar en
   120 segundos o menos con un código de salida 0, sin ninguna prueba fallida y sin ninguna prueba
   omitida ni marcada como pendiente.
2. LA Suite_Pruebas DEBERÁ ubicar el archivo de prueba de cada módulo en el mismo directorio que el
   módulo, nombrado con el nombre base del módulo más el sufijo `.test.ts`, con un archivo propio por
   cada módulo nombrado en el criterio 1, con las pruebas de las tres guardas de ejecución junto al
   módulo del Interprete, sin agrupar en un mismo archivo las pruebas de dos módulos distintos y sin
   ningún directorio de pruebas separado de `src/`.
3. LA Suite_Pruebas DEBERÁ verificar, para cada Nivel declarado en `src/niveles/` —que en esta spec es
   únicamente el Nivel autorado `0.1`, porque no hay ningún generador implementado—, que al ejecutar su
   programa de referencia con EL Interprete y validar los segmentos resultantes contra los del Reto con
   la normalización que ese Nivel declara, EL Validador devuelve un IoU de 1.0, un exceso de trazo de
   0 % y la coincidencia geométrica concedida, el entero que devuelve EL Conteo para ese AST es igual al
   `presupuestoEstrella` que devuelve EL Reto, y LAS Estrellas otorgan las tres estrellas de precisión,
   economía y abstracción.
4. LA Suite_Pruebas DEBERÁ verificar que dos resoluciones de EL Reto con el mismo identificador de nivel
   y la misma semilla, hechas de forma independiente y separadas por al menos otra resolución de EL
   Reto, devuelven el mismo AST nodo por nodo, la misma cantidad de Operaciones con el mismo
   Estado_Tortuga antes y después de cada paso, la misma lista de segmentos en el mismo orden, el mismo
   `presupuestoEstrella`, el mismo `limiteDuro` con el mismo indicador de actividad y el mismo código de
   semilla; y que EL PRNG, inicializado dos veces con la misma semilla, devuelve valores iguales uno a
   uno en sus primeras 10 000 peticiones.
5. LA Suite_Pruebas DEBERÁ verificar dos propiedades de ida y vuelta: que el AST que EL Parser produce al
   analizar el texto que EL Impresor genera para un AST es igual nodo por nodo al AST de partida, salvo
   la línea y la columna de origen de cada nodo, sobre al menos 20 Programas del mundo 0 que incluyan el
   programa de referencia del Nivel `0.1`, las seis entradas del Vocabulario del mundo 0, sus
   abreviaturas y un argumento decimal escrito con coma; y que EL Codigo_Semilla devuelve exactamente la
   semilla de partida al decodificar el código que produjo para ella, sin que dos semillas distintas
   compartan código, sobre al menos 200 semillas que incluyan 0 y 4 294 967 295.
6. LA Suite_Pruebas DEBERÁ verificar que ningún archivo `.ts` de `src/` ni de sus subdirectorios contiene
   `Math.random`, una llamada a `eval`, una construcción `new Function` ni ninguna otra invocación del
   constructor `Function`, y que `src/` y sus subdirectorios no contienen ningún archivo cuya extensión,
   comparada sin distinguir mayúsculas de minúsculas, sea `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`,
   `.webp` o `.ico`, excluyendo del recorrido el propio archivo de prueba que declara esas cadenas y sin
   abarcar el directorio `assets/` de la raíz, y DEBERÁ fallar nombrando el archivo y la línea de cada
   coincidencia.
7. LA Suite_Pruebas DEBERÁ verificar dos casos negativos de EL Validador, partiendo de los segmentos del
   Reto del Nivel `0.1` y con la traslación y la rotación declaradas libres: que niega la coincidencia
   geométrica e indica el exceso de trazo como motivo cuando recibe esos segmentos más un segmento
   adicional de 100 unidades cuyas posiciones caen fuera de la máscara objetivo dilatada, y que niega la
   coincidencia geométrica cuando recibe esos mismos segmentos con todas sus longitudes multiplicadas
   por 2.
8. CUANDO se ejecuta `npm run typecheck`, EL Proyecto DEBERÁ terminar con un código de salida 0, sin
   ningún error de TypeScript, comprobando también los archivos con sufijo `.test.ts` y sin escribir
   ningún archivo de salida.
9. CUANDO se ejecuta `npm run build`, LA Compilacion DEBERÁ terminar con un código de salida 0, sin
   ningún error de tipos de TypeScript ni de empaquetado, dejando un `index.html` en la raíz de `dist` y
   sin incluir en el empaquetado ningún archivo con sufijo `.test.ts`.
10. LA Suite_Pruebas DEBERÁ ejecutar sus pruebas en Node con `document`, `window` y `OffscreenCanvas`
    ausentes del entorno global, salvo los archivos de prueba que declaren explícitamente un entorno de
    navegador simulado, y DEBERÁ mantener fuera de ese entorno simulado las pruebas del Vocabulario, del
    Lexer, del Parser, del Impresor, del Interprete, del Conteo, del Catalogo_Errores, de la Tortuga,
    del Extractor_Segmentos, del Encuadre, del Validador, del PRNG, del Codigo_Semilla, del Reto y de
    las Estrellas, de modo que una referencia a cualquiera de esas variables globales desde alguno de
    esos módulos haga fallar su prueba.
11. SI el programa de referencia de algún Nivel declarado en `src/niveles/` no obtiene las tres estrellas
    al validarse contra sí mismo, ENTONCES LA Suite_Pruebas DEBERÁ terminar con un código de salida
    distinto de 0 e informar el identificador de ese Nivel, la semilla usada, cuál de las tres estrellas
    quedó negada y el motivo que devuelven LAS Estrellas, sin marcar la ejecución como exitosa y sin
    dejar de verificar los demás Niveles declarados.
12. LA Suite_Pruebas DEBERÁ cubrir con al menos un caso válido cada una de las seis entradas del
    Vocabulario del mundo 0 escrita con su nombre largo y con su abreviatura, al menos un caso de
    entrada con acentos, con mayúsculas y minúsculas mezcladas y con un argumento decimal escrito con
    coma, y al menos un caso de error por cada situación de error que EL Lexer o EL Parser pueden
    reportar, y DEBERÁ fallar nombrando la entrada del Vocabulario o la situación de error que quede sin
    ningún caso.
13. LA Suite_Pruebas DEBERÁ verificar, para cada una de las seis entradas del Vocabulario del mundo 0,
    que EL Interprete emite la cantidad de Operaciones y los tipos de Operacion que corresponden a esa
    entrada, con el Estado_Tortuga antes y después de cada paso y con el número de línea de la
    instrucción que la originó.

## Trazabilidad de los criterios de aceptación del prompt

| # | Criterio del prompt | Requisitos que lo cubren |
|---|---|---|
| 1 | `npm run dev` levanta el juego y el nivel se juega completo | 1.5, 27.3, 27.4 |
| 2 | Kiro dibuja en vivo, con repetición y velocidad | 22.1, 22.3, 22.4 |
| 3 | Ejecución animada y paso a paso | 14.1, 14.3, 24.1 |
| 4 | Correcto otorga precisión; una línea de más falla por exceso y el diff lo muestra | 16.5, 16.6, 16.12, 23.3, 27.4, 27.5 |
| 5 | Comando mal escrito da mensaje descriptivo con sugerencia | 10.2, 27.6 |
| 6 | Las tres guardas cortan con su mensaje, verificadas con AST sintéticos | 8.1, 8.2, 8.3, 8.7 |
| 7 | El mismo (idNivel, semilla) produce el mismo reto | 17.2, 18.7, 27.7, 29.4 |
| 8 | `npm test` pasa con cobertura de las etapas | 29.1, 29.2, 29.12, 29.13 |
| 9 | El nivel de prueba aprueba su propio nivel con las tres estrellas | 29.3, 29.11 |
| 10 | La tortuga con Kiro se lee en cualquier rumbo y no hay archivos de imagen | 13.1, 13.3, 13.6, 1.9, 2.8, 29.6 |
| 11 | `dist` funciona desde la raíz y `amplify.yml` fija Node desde `.nvmrc` | 2.1, 2.2, 2.3, 2.4, 2.6 |
