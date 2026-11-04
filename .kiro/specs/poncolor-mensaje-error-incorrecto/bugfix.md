# Bugfix Requirements Document

## Introduction

Cuando el jugador escribe `PONCOLOR` sin argumento, Kiro responde: *"PONCOLOR necesita un número. Por
ejemplo: PONCOLOR 100"*. El mensaje es falso: `PONCOLOR` recibe un color (una palabra como `"rojo` o
una terna RGB como `[255 0 0]`), no un número. Seguir el ejemplo del mensaje produce otro error. En un
juego cuya lección central es que la tortuga hace exactamente lo que se le dice, un mensaje que da una
instrucción equivocada es especialmente dañino: el jugador no puede saber que el error está en el
mensaje y no en su programa.

La causa es que el catálogo de errores tiene un único mensaje para `argumentoFaltante` y otro para
`argumentoDeTipoEquivocado`, ambos con el texto "necesita un número" fijo, y el parser los reutiliza
también para comandos cuyo argumento no es un número. El mensaje depende solo del nombre del comando,
no del tipo de argumento que declara `vocabulario.ts`.

La revisión del mapeo de errores de argumentos en `src/lenguaje/errores.ts`, `src/lenguaje/parser.ts` y
`src/lenguaje/vocabulario.ts` encontró el mismo defecto en otros puntos:

- `PONCOLOR` con un argumento del tipo equivocado (por ejemplo `PONCOLOR 5`) dice "necesita un número,
  pero le diste una palabra: 5", que es doblemente incorrecto.
- `REPITE` sin número o sin corchete dice "REPITE necesita un número. Por ejemplo: REPITE 100", que no
  es una forma válida de `REPITE`. **Fuera de alcance de esta spec**: `REPITE` es del mundo 1, y el
  dueño pidió en la reseña del PR #24 no tocar su mensaje; queda como seguimiento para un fix aparte.
- `PARA` sin nombre se reporta como `paraSinFin` con el texto "El comando PARA que empezaste en la
  línea N nunca termina con FIN", que no dice que falta el nombre.
- `PARA` anidado (dentro de `REPITE` o de otro `PARA`) se acepta al analizar y falla al ejecutar con un
  mensaje que no corresponde ("No sé cómo hacer B", "todavía no está disponible"): `PARA` solo se
  escribe en el nivel principal del programa y debería ser un error de sintaxis propio.
- `PARA X :lado …` descarta el parámetro sin aviso y el error que sale después habla de otra cosa; los
  parámetros se desbloquean en el mundo 4 y el jugador debería saberlo.

Comandos revisados sin defecto: `PONGROSOR` es de argumento numérico y su mensaje es correcto.
`SUBELAPIZ`, `BAJALAPIZ`, `OCULTATORTUGA`, `MUESTRATORTUGA`, `CENTRO` y `BORRAPANTALLA` no reciben
argumento, así que no tienen mensaje de argumento faltante.

`RELLENA` **sí lleva argumento**: la especificación del lenguaje define `RELLENA "azul` (aridad 1, mismo
tipo de argumento que `PONCOLOR`) y el PR #24 la implementa así (punto 7 de la reseña). Esta spec solo
define que su mensaje de argumento se derive del tipo `color`, igual que el de `PONCOLOR`; el comando
mismo se implementa aparte.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN el jugador escribe `PONCOLOR` sin argumento (al final del programa o seguido de otro comando) THEN el sistema reporta `argumentoFaltante` con el mensaje "PONCOLOR necesita un número. Por ejemplo: PONCOLOR 100", que afirma un tipo de argumento y da un ejemplo inválidos

1.2 WHEN el jugador escribe `PONCOLOR` seguido de un argumento que no es un color (por ejemplo `PONCOLOR 5`, `PONCOLOR [` o `PONCOLOR :largo`) THEN el sistema reporta `argumentoDeTipoEquivocado` con el mensaje "PONCOLOR necesita un número, pero le diste una palabra: …", que pide un número a un comando que no lo acepta y llama "palabra" a lo que escribió el jugador aunque sea un número o un símbolo

1.3 WHEN el jugador escribe `PONCOLOR [` con un elemento no numérico o sin cerrar la terna RGB (por ejemplo `PONCOLOR [255 "a 0]`) THEN el sistema reporta el mismo mensaje "necesita un número" sin explicar que el comando espera un color o una terna de tres números

1.4 *(Fuera de alcance, ver la introducción.)* WHEN el jugador escribe `REPITE` sin número de repeticiones, o con número pero sin el corchete de apertura THEN el sistema reporta "REPITE necesita un número. Por ejemplo: REPITE 100". No se cambia en esta spec

1.5 WHEN el jugador escribe `PARA` sin nombre de procedimiento THEN el sistema reporta `paraSinFin` con el mensaje "El comando PARA que empezaste en la línea N nunca termina con FIN", que describe un problema distinto del que existe (falta el nombre)

1.6 WHEN se agrega o cambia un comando de `vocabulario.ts` cuyo argumento no es numérico THEN el sistema sigue produciendo el texto "necesita un número", porque el mensaje no deriva del tipo de argumento declarado en el vocabulario

1.7 WHEN el jugador escribe un `PARA` dentro de un `REPITE` o dentro de otro `PARA` THEN el sistema lo acepta al analizar y falla al ejecutar con un mensaje que no explica que `PARA` solo va en el nivel principal

1.8 WHEN el jugador escribe `PARA nombre :parametro …` antes del mundo 4 THEN el sistema descarta el parámetro sin aviso y el error posterior habla de otra cosa

### Expected Behavior (Correct)

2.1 WHEN el jugador escribe `PONCOLOR` sin argumento THEN el sistema SHALL reportar un mensaje en español que diga que `PONCOLOR` necesita un color y muestre un ejemplo válido de `PONCOLOR` (por ejemplo `PONCOLOR "rojo`), sin mencionar números

2.2 WHEN el jugador escribe `PONCOLOR` seguido de un argumento que no es un color THEN el sistema SHALL reportar un mensaje en español que diga que `PONCOLOR` necesita un color, nombre lo que el jugador escribió con una descripción exacta de su clase (número, corchete, parámetro o palabra) y muestre un ejemplo válido

2.3 WHEN el jugador escribe una terna RGB con un elemento no numérico o sin cerrar THEN el sistema SHALL reportar un mensaje en español que diga que la terna debe tener tres números entre corchetes, con un ejemplo válido como `PONCOLOR [255 0 0]`

2.4 *(Fuera de alcance: el mensaje de `REPITE` no se modifica en esta spec.)*

2.5 WHEN el jugador escribe `PARA` sin nombre de procedimiento THEN el sistema SHALL reportar un mensaje en español que diga que a `PARA` le falta el nombre del procedimiento y muestre un ejemplo válido como `PARA cuadrado`

2.6 WHEN falta o es incorrecto el argumento de cualquier comando con argumento THEN el sistema SHALL construir el mensaje a partir del tipo de argumento y del ejemplo que declara `vocabulario.ts`, de modo que todos los textos de error de argumentos vivan en `src/lenguaje/errores.ts`, estén en español y sean coherentes entre comandos

2.7 WHEN el jugador escribe un `PARA` dentro de un `REPITE` o dentro de otro `PARA` THEN el sistema SHALL reportar un error de sintaxis con id propio (`paraAnidado`) que diga que `PARA` solo se escribe en el nivel principal del programa, sin cascada de errores por el cuerpo del `PARA` anidado

2.8 WHEN el jugador escribe `PARA nombre :parametro …` en un mundo anterior al 4 THEN el sistema SHALL reportar un error con id propio (`paraConParametros`) que diga que los parámetros de `PARA` se desbloquean en el mundo 4 y muestre cómo definir el procedimiento sin ellos

2.9 WHEN el jugador escribe `RELLENA` sin argumento, o con uno que no es un color, THEN el sistema SHALL reportar el mismo mensaje de color que `PONCOLOR`, con el ejemplo `RELLENA "azul` (se verifica al implementar `RELLENA` con argumento, punto 7 de la reseña)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN el jugador escribe un comando de argumento numérico (`AVANZA`, `RETROCEDE`, `GIRADERECHA`, `GIRAIZQUIERDA`, `PONGROSOR`) sin argumento THEN el sistema SHALL CONTINUE TO reportar `argumentoFaltante` con el texto "<COMANDO> necesita un número. Por ejemplo: <COMANDO> 100"

3.2 WHEN el jugador escribe un comando de argumento numérico seguido de una palabra THEN el sistema SHALL CONTINUE TO reportar `argumentoDeTipoEquivocado` con el texto "<COMANDO> necesita un número, pero le diste una palabra: <lo escrito>"

3.3 WHEN el jugador escribe `PONCOLOR` con una palabra (`"naranja`, `naranja`) o una terna RGB de tres números válida THEN el sistema SHALL CONTINUE TO analizarlo sin error de parseo y resolverlo en el intérprete, incluido el error `colorInvalido` para un nombre fuera del catálogo

3.4 WHEN el jugador escribe `REPITE 4 [ … ]` bien formado, o `PARA nombre … FIN` bien formado THEN el sistema SHALL CONTINUE TO analizarlo sin errores y con el mismo conteo de instrucciones

3.5 WHEN el parser reporta errores de argumentos THEN el sistema SHALL CONTINUE TO usar los mismos identificadores de error (salvo `PARA` sin nombre, que según 2.5 pasa a un id propio, `paraSinNombre`, y los casos nuevos 2.7 y 2.8, que tienen los suyos), las mismas posiciones (línea y columna) y la misma recuperación por sincronización, de modo que la cantidad y el orden de los errores reportados no cambien

3.6 WHEN el jugador escribe `SUBELAPIZ`, `BAJALAPIZ`, `OCULTATORTUGA`, `MUESTRATORTUGA`, `CENTRO` o `BORRAPANTALLA` THEN el sistema SHALL CONTINUE TO tratarlos como comandos sin argumento, sin mensajes de argumento faltante. `RELLENA` no figura en esta lista: lleva un argumento de color (aridad 1, como `PONCOLOR`)

3.7 WHEN se piden errores de cualquier otro identificador del catálogo THEN el sistema SHALL CONTINUE TO producir exactamente los mismos mensajes, severidades y posiciones que hoy

3.8 WHEN el jugador escribe `REPITE` mal formado THEN el sistema SHALL CONTINUE TO reportar exactamente los mensajes actuales de `REPITE` (esta spec no los modifica)
