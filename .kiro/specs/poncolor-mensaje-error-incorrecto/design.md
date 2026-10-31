# PONCOLOR y mensajes de argumento incorrectos Bugfix Design

## Overview

Cuando el jugador escribe `PONCOLOR` sin argumento, Kiro dice "PONCOLOR necesita un número. Por ejemplo:
PONCOLOR 100". El mensaje es falso y seguir su ejemplo produce otro error. La causa es que
`construirMensaje` en `src/lenguaje/errores.ts` tiene un único texto para `argumentoFaltante` y otro para
`argumentoDeTipoEquivocado`, ambos con "necesita un número" fijo, y el parser los reutiliza para
`PONCOLOR`. Además `PARA` sin nombre se reporta como `paraSinFin`, un `PARA` anidado falla al ejecutar con
un mensaje engañoso y los parámetros de `PARA` se descartan sin aviso.

**Fuera de alcance (decisión del dueño en la reseña del PR #24):** el mensaje de `REPITE` no se toca, ni
los mensajes del catálogo con texto fijo ("línea 3", "número 100"), que irán a un issue aparte.

La estrategia es mínima y dirigida por datos:

1. El texto de los errores de argumentos se **deriva del `tiposArgumento` y del `ejemplo` que declara
   `vocabulario.ts`**, mediante una tabla por tipo de argumento dentro de `errores.ts`. Los comandos
   numéricos (y `REPITE`, cuyo primer argumento es numérico) conservan su texto actual, byte a byte.
2. Se agregan dos tipos de argumento (`'color'` y `'nombre'`) para que `PONCOLOR` y `PARA` dejen de ser
   indistinguibles de `ESCRIBE` (los tres eran `['palabra']`).
3. Los ids `argumentoFaltante` y `argumentoDeTipoEquivocado` se conservan. Reciben un parámetro opcional
   `parte` (`'terna'`) para la terna RGB de `PONCOLOR`.
4. Tres ids nuevos para `PARA`: `paraSinNombre`, `paraAnidado` y `paraConParametros`.
5. Se corrige el ejemplo de `PONCOLOR` en `vocabulario.ts`, que era inválido para el propio lexer.
6. `RELLENA` (que lleva argumento de color, punto 7 de la reseña) reutiliza la misma plantilla de color
   sin código nuevo: basta con declarar `tiposArgumento: ['color']`.

No cambian posiciones, orden de errores, recuperación por sincronización ni conteo de instrucciones de lo
que ya estaba bien.

## Glossary

- **Bug_Condition (C)**: el parser reporta un error de argumentos de `PONCOLOR` con el texto numérico
  fijo; o reporta `paraSinFin` para un `PARA` sin nombre; o acepta un `PARA` anidado; o descarta los
  parámetros de un `PARA` antes del mundo 4.
- **Property (P)**: el mensaje nombra lo que el comando realmente espera y muestra un ejemplo que el
  propio lexer y parser aceptan.
- **Preservation**: mensajes, ids, posiciones y conteos de todo lo que no cumple C.
- **`construirMensaje`**: función de `src/lenguaje/errores.ts` que arma el texto de cada id.
- **`analizarComandoColor`, `analizarDefinicion`**: funciones de `src/lenguaje/parser.ts` que reportan los
  errores afectados.
- **`tiposArgumento` / `ejemplo`**: campos de `EntradaVocabulario` en `src/lenguaje/vocabulario.ts`.
- **Terna RGB**: la forma `[r g b]` de `PONCOLOR`, con tres números entre corchetes.

## Bug Details

### Bug Condition

`construirMensaje` solo ve el nombre del comando y escribe "necesita un número" sin consultar el
vocabulario. En `PARA`, `analizarDefinicion` usaba `paraSinFin` para un caso que no tiene que ver con FIN,
no distinguía el contexto (nivel principal o anidado) y ignoraba los `:param`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input de tipo ErrorOAceptacionProducida
  OUTPUT: boolean

  RETURN (input.id IN {'argumentoFaltante', 'argumentoDeTipoEquivocado'}
          AND input.comando = 'PONCOLOR'
          AND input.mensaje CONTIENE 'necesita un número')
         OR (input.id = 'paraSinFin' AND el PARA no tiene nombre de procedimiento)
         OR (el texto contiene un PARA dentro de un REPITE o de otro PARA Y se acepta al analizar)
         OR (el texto contiene PARA nombre :param Y mundo < 4 Y no se avisa)
END FUNCTION
```

### Examples

- `PONCOLOR` → antes "PONCOLOR necesita un número. Por ejemplo: PONCOLOR 100". Ahora: "PONCOLOR necesita un
  color. Por ejemplo: PONCOLOR "rojo".
- `PONCOLOR 5` → antes "necesita un número, pero le diste una palabra: 5". Ahora: "PONCOLOR necesita un
  color, pero le diste un número: 5. Por ejemplo: PONCOLOR "rojo".
- `PONCOLOR [255 "a 0]` o `PONCOLOR [255 0` → ahora la terna lleva tres números entre corchetes, con
  ejemplo `PONCOLOR [255 0 0]`.
- `PARA` (solo, o seguido de un número o un corchete) → antes `paraSinFin`. Ahora `paraSinNombre`: "A PARA le
  falta el nombre del procedimiento. Por ejemplo: PARA cuadrado".
- `REPITE 2 [PARA X AV 100 FIN] X` y `PARA A PARA B AV 100 FIN FIN B` → antes se aceptaban y fallaban al
  ejecutar. Ahora `paraAnidado`, un solo error, sin cascada.
- `PARA X :lado AV 100 FIN X 50` → antes el parámetro se descartaba. Ahora `paraConParametros` primero.
- Borde, sin cambio: `AVANZA` → "AVANZA necesita un número. Por ejemplo: AVANZA 100"; `REPITE` → "REPITE
  necesita un número. Por ejemplo: REPITE 100".

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Los cinco comandos numéricos (`AVANZA`, `RETROCEDE`, `GIRADERECHA`, `GIRAIZQUIERDA`, `PONGROSOR`) y
  `REPITE` conservan exactamente ambos mensajes.
- `PONCOLOR` con palabra, identificador o terna válida se analiza sin error; `colorInvalido` sigue siendo
  del intérprete.
- `PARA … FIN` bien formado en el nivel principal se analiza igual y con el mismo conteo.
- Un `PARA` con nombre pero sin `FIN` sigue siendo `paraSinFin`.
- Desde el mundo 4 un `:param` se acepta y se ignora como antes (los parámetros se implementan después).
- Los comandos sin argumento no producen mensajes de argumento.
- Todos los demás ids del catálogo mantienen mensaje, severidad y posición.

**Nota sobre el requisito 3.5:** pide conservar los identificadores de error. Las excepciones son `PARA`
sin nombre (2.5) y los casos 2.7 y 2.8, que tienen ids propios.

## Hypothesized Root Cause

1. **Mensaje independiente del vocabulario**: `construirMensaje` interpolaba solo `p.comando` en un texto
   fijo. Causa principal, confirmada leyendo el código.
2. **Tipos de argumento insuficientes**: `PONCOLOR`, `PARA` y `ESCRIBE` declaraban `['palabra']`.
3. **Id reutilizado en `PARA`**: `analizarDefinicion` enviaba `PARA` sin nombre a `paraSinFin` con
   `nombre: 'PARA'`.
4. **Sin contexto de anidamiento**: `analizarComando` aceptaba `PARA` en cualquier posición; la primera
   pasada (`recolectarProcedimientos`) y `buscarDefinicion` del intérprete solo conocen el nivel principal,
   así que el error aparecía recién al ejecutar y con otro texto.
5. **Parámetros ignorados**: `analizarDefinicion` consumía los `:param` en un bucle sin reportar nada.
6. **Ejemplo inválido en el vocabulario**: `ejemplo` de `PONCOLOR` era `PONCOLOR "rojo"`. El lexer lee `"rojo`
   y deja la comilla final suelta (`comillaSinPalabra`). Derivar ese ejemplo tal cual repetiría el bug.

## Correctness Properties

Property 1: Bug Condition - Los mensajes nombran lo que se espera y dan un ejemplo válido

_For any_ texto fuente donde el bug condition se cumple, el parser corregido SHALL reportar un mensaje en
español que nombre lo que el comando espera (color, terna de tres números, nombre de procedimiento,
nivel principal, mundo 4), no contenga "necesita un número" para `PONCOLOR`, y cuyo ejemplo, al analizarse
con el mismo lexer y parser, no produzca errores.

**Validates: Requirements 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.9**

Property 2: Preservation - Todo lo demás permanece idéntico

_For any_ texto fuente donde el bug condition NO se cumple, el parser corregido SHALL producir los mismos
errores (id, mensaje, severidad, línea, columna, cantidad y orden) y el mismo AST con el mismo conteo de
instrucciones que el código original.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Decisiones de diseño

**D1. Forma del ejemplo de PONCOLOR: sin comilla de cierre.** El mensaje muestra `PONCOLOR "rojo`. Es lo
que acepta el lexer (`leerConPrefijo` consume la comilla y las letras o dígitos siguientes, y no reconoce
comilla de cierre). Como el ejemplo se deriva de `vocabulario.ts`, se corrige ahí: `ejemplo` e `insercion`
pasan a `PONCOLOR "rojo`. Esto arregla de paso el botón de inserción del panel de comandos. En el mensaje,
el ejemplo va al final y sin punto, igual que en la versión numérica.

**D2. Derivación desde `tiposArgumento` y `ejemplo`.** `errores.ts` define una tabla total
`Record<TipoArgumento, PlantillaArgumento>` con el `sustantivo` de cada tipo. Que sea un `Record` completo
hace que agregar un tipo nuevo a `TipoArgumento` sin su plantilla no compile (requisito 1.6).

| Tipo | Sustantivo | Comandos |
|---|---|---|
| `numero` | un número | AVANZA, RETROCEDE, GIRADERECHA, GIRAIZQUIERDA, PONGROSOR, REPITE (primer componente) y los de mundos futuros |
| `color` | un color | PONCOLOR, RELLENA |
| `nombre` | el nombre del procedimiento | PARA |
| `lista` | una lista de instrucciones entre corchetes | segundo componente de REPITE (sin mensaje propio) |
| `palabra`, `expresion` | una palabra / una condición | ESCRIBE, SI (plantilla genérica) |

Reglas de `mensajeArgumentoFaltante` y `mensajeArgumentoEquivocado`:

- Busca la entrada con `buscarComando`. Si no existe, no declara argumentos o su primer tipo es `numero`,
  usa el texto numérico actual con el ejemplo fijo `<COMANDO> 100` (requisito 3.1). `REPITE` entra aquí.
- Con otro tipo: `"<COMANDO> necesita <sustantivo>. Por ejemplo: " + entrada.ejemplo`. En el caso
  equivocado: `"<COMANDO> necesita <sustantivo>, pero le diste <clase>: <recibido>. Por ejemplo: " + ejemplo`.
  `<clase>` sale de la función pura `clasificarRecibido(recibido)`: empieza con dígito → "un número"; `[` o
  `]` → "un corchete"; `:` → "un parámetro"; otro caso → "una palabra". Trabaja sobre texto, no sobre `Token`.
- Con `parte: 'terna'`: `"La terna de <COMANDO> necesita tres números entre corchetes. Por ejemplo:
  <COMANDO> [255 0 0]"`; en el caso equivocado se agrega lo que encontró. El ejemplo de la terna es un
  literal armado con el nombre del comando, porque el vocabulario tiene un solo `ejemplo` por comando.

**D3. Sin ciclos de importación.** `errores.ts` importa de `vocabulario.ts` (solo valores ya importados y el
tipo `TipoArgumento`) y no importa `lexer.ts`, `parser.ts` ni `colores.ts`. `vocabulario.ts` no importa
nada. Una prueba lee el código fuente y falla si aparece alguno de esos imports.

**D4. `PARA` sin nombre: id nuevo `paraSinNombre`.** Mensaje: `"A PARA le falta el nombre del
procedimiento. Por ejemplo: " + ejemplo de PARA` (`PARA cuadrado`). `paraSinFin` queda con un único
significado: un `PARA` con nombre cuyo `FIN` nunca llega.

**D5. `PARA` anidado: id nuevo `paraAnidado`.** El `Estado` del parser cuenta el `anidamiento` (listas de
`REPITE` y cuerpos de `PARA` abiertos). Un `PARA` con `anidamiento > 0` reporta `paraAnidado` en el token
`PARA` y descarta su definición completa hasta su `FIN`, contando los `PARA` que contenga, sin consumir un
corchete de cierre (un `PARA` anidado sin `FIN` no se come el `FIN` de un `PARA` posterior). Su nombre se
registra como procedimiento conocido para que una llamada posterior no diga "No sé cómo hacer…": el error
que importa ya está dicho y no hay cascada. En el mundo 1, donde `PARA` está bloqueado, sigue siendo
`comandoBloqueado`. Mensaje fijo, sin números de línea.

**D6. Parámetros de `PARA`: id nuevo `paraConParametros`.** Se reporta una sola vez, en el primer `:param`,
cuando el mundo es menor que 4: "Los parámetros de PARA (como :lado) se desbloquean en el mundo 4. Por ahora
define el procedimiento sin ellos. Por ejemplo: PARA cuadrado". Desde el mundo 4 se ignoran como antes.

### Changes Required

**`src/lenguaje/vocabulario.ts`**: `TipoArgumento` agrega `'color'` y `'nombre'`; `PONCOLOR` pasa a
`['color']` con `ejemplo` e `insercion` = `PONCOLOR "rojo`; `PARA` pasa a `['nombre']`.

**`src/lenguaje/errores.ts`**: ids `paraSinNombre`, `paraAnidado` y `paraConParametros`; parámetro opcional
`parte` en los dos ids de argumentos; tabla de plantillas, `clasificarRecibido`, `mensajeArgumentoFaltante`
y `mensajeArgumentoEquivocado`; los dos `case` consultan el vocabulario.

**`src/lenguaje/parser.ts`**: `analizarComandoColor` pasa `parte: 'terna'` en los dos errores de la terna;
`analizarDefinicion` reporta `paraSinNombre` y `paraConParametros`; `Estado` agrega `anidamiento` y
`procedimientos` pasa a ser mutable; `reportarParaAnidado` descarta el `PARA` anidado.

## Testing Strategy

### Validation Approach

Primero se escriben pruebas que fallan en el código sin corregir para confirmar la causa. Después se verifica
el arreglo y la preservación. Sin dependencias nuevas.

### Exploratory Bug Condition Checking

Pruebas en `errores.test.ts`, `parser.test.ts`, `vocabulario.test.ts` y `main.test.ts`, ejecutadas antes del
arreglo (fallaron 22 y 20 pruebas en los dos bloques):

1. `PONCOLOR` sin argumento: el mensaje dice "color", no "número", y el ejemplo se analiza sin errores.
2. `PONCOLOR 5`, `PONCOLOR [`, `PONCOLOR :largo`: el mensaje nombra la clase exacta.
3. `PONCOLOR [255 "a 0]` y `PONCOLOR [255 0`: terna de tres números, ejemplo `PONCOLOR [255 0 0]`.
4. `PARA` solo: id `paraSinNombre` en la posición del `PARA`.
5. `REPITE 2 [PARA X AV 100 FIN] X` y `PARA A PARA B AV 100 FIN FIN B`: un solo error `paraAnidado`.
6. `PARA X :lado AV 100 FIN X`: `paraConParametros` en el primer parámetro.
7. Ejemplo del vocabulario: `PONCOLOR "rojo` se analiza sin errores y no termina en comilla.

### Preservation Checking

1. Los cinco comandos numéricos y `REPITE`: ambos mensajes idénticos a los de antes.
2. `PONCOLOR` válido (`"naranja`, `naranja`, `[255 0 0]`) sin errores y mismo AST.
3. `PARA … FIN` bien formado en el nivel principal: sin errores; `PARA` sin `FIN` sigue siendo `paraSinFin`.
4. Un `:param` desde el mundo 4 se acepta como antes.
5. Un nombre de comando desconocido cae al texto numérico.

### Unit Tests

- `errores.test.ts`: `PONCOLOR` faltante y equivocado (con las cuatro clases de `clasificarRecibido`), terna,
  comandos numéricos y `REPITE` sin cambios, plantilla por tipo para todo comando de color del vocabulario
  (cubre a `RELLENA`), los tres ids de `PARA`, y la prueba de arquitectura de imports.
- `vocabulario.test.ts`: `PONCOLOR` declara `['color']`, `PARA` `['nombre']`, el ejemplo no termina en
  comilla, y el tipo incluye `color` y `nombre`.
- `parser.test.ts`: los textos de los ejemplos con ids y posiciones esperados, y la actualización de la
  prueba que fijaba el descarte silencioso del `:param`.

### Integration Tests

- `main.test.ts`: cada caso (`PONCOLOR 5`, `PARA` sin nombre, anidado, con parámetros) muestra su mensaje en
  el globo de Kiro y no califica el intento.
- Regresión obligatoria del catálogo: todo reto aprueba con tres estrellas, sin cambios.

## Seguimiento fuera de alcance

- `REPITE` mal formado sigue con su mensaje numérico (decisión del dueño); queda para un fix aparte.
- Los comandos numéricos con un argumento no numérico siguen diciendo "una palabra" aunque sea un corchete
  (requisito 3.2).
- `ESCRIBE` conserva un ejemplo con comilla de cierre (`ESCRIBE "Hola"`); no es ejecutable hasta el mundo 4.
- Mensajes con texto fijo del catálogo ("línea 3", "número 100"): issue aparte del dueño.
