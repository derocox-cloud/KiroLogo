---
inclusion: auto
name: lenguaje-kirologo
description: Especificación del pseudo-lenguaje KiroLogo. Consultar al trabajar en el lexer, el parser, el intérprete, el vocabulario de comandos, los mensajes de error, el conteo de instrucciones o al escribir programas de referencia de niveles.
---

# El lenguaje KiroLogo

Vocabulario **enteramente en español**, basado en el Logo en español clásico (`AVANZA`,
`GIRADERECHA`, `BORRAPANTALLA`). Cada comando tiene forma larga y abreviatura; el intérprete acepta
las dos indistintamente.

**No hay alias en inglés.** Si el jugador escribe `FD`, el error debe sugerir el comando en español:
`No sé hacer FD. ¿Querías decir AVANZA?`

## Mundo 0 · Primeros pasos

| Comando | Abrev. | Qué hace | Ejemplo |
|---|---|---|---|
| `AVANZA` | `AV` | La tortuga camina hacia adelante | `AVANZA 100` |
| `RETROCEDE` | `RE` | Camina hacia atrás | `RE 50` |
| `GIRADERECHA` | `GD` | Gira a la derecha, en grados | `GD 90` |
| `GIRAIZQUIERDA` | `GI` | Gira a la izquierda | `GI 45` |
| `CENTRO` | `CE` | Vuelve al centro mirando hacia arriba | `CENTRO` |
| `BORRAPANTALLA` | `BP` | Limpia el lienzo y regresa al centro | `BP` |

## Mundo 1 · Figuras geométricas

| Comando | Abrev. | Qué hace | Ejemplo |
|---|---|---|---|
| `REPITE` | `RP` | Repite una lista de instrucciones | `REPITE 4 [AV 100 GD 90]` |

## Mundo 2 · Composición

| Comando | Abrev. | Qué hace | Ejemplo |
|---|---|---|---|
| `SUBELAPIZ` | `SL` | Kiro levanta el lápiz: la tortuga se mueve sin dibujar | `SL` |
| `BAJALAPIZ` | `BL` | Baja el lápiz: vuelve a dibujar | `BL` |
| `PONCOLOR` | `PC` | Color de la estela | `PONCOLOR "naranja` |
| `PONGROSOR` | `PG` | Grosor de la estela | `PG 3` |
| `RELLENA` | `RL` | Rellena con un color el área cerrada donde está la tortuga | `RELLENA "azul` |
| `PARA` … `FIN` | — | Define un comando nuevo | ver abajo |
| `OCULTATORTUGA` | `OT` | Esconde a la tortuga y a Kiro | `OT` |
| `MUESTRATORTUGA` | `MT` | Los vuelve a mostrar | `MT` |

## Mundo 3 · Rosetones

No agrega comandos. La dificultad es anidar `REPITE` dentro de `REPITE`. Es deliberado: el jugador
descubre que no necesita herramientas nuevas, solo combinar mejor las que ya tiene.

## Mundo 4 · Parámetros y aritmética

| Comando | Abrev. | Qué hace | Ejemplo |
|---|---|---|---|
| `:nombre` | — | Parámetro de un comando propio | `PARA POLIGONO :lados :largo` |
| `+ - * /` | — | Operadores infijos, con paréntesis | `GD 360 / :lados` |
| `SUMA` | — | Suma **exactamente dos** números | `ESCRIBE SUMA 30 40` |
| `RESTA` | — | Resta el segundo número del primero | `ESCRIBE RESTA 65 45` |
| `PRODUCTO` | — | Multiplica **exactamente dos** números | `ESCRIBE PRODUCTO 5 10` |
| `COCIENTE` | — | Divide el primero entre el segundo, sin truncar | `ESCRIBE COCIENTE 8 2` |
| `RESTO` | — | Resto de la división, con el signo del dividendo | `ESCRIBE RESTO 5 3` |
| `AZAR` | — | Entero al azar entre 0 y n-1 (`n` entero ≥ 1; `AZAR 1` vale 0) | `AVANZA AZAR 100` |
| `ESCRIBE` | `ES` | Muestra un valor o una palabra en la consola | `ESCRIBE 360 / 5` |
| `ROTULA` | `RO` | Escribe un texto o un número sobre el lienzo | `ROTULA "hola` |

Los cinco comandos aritméticos tienen aridad 2, sin abreviatura y **sin variantes de «dos o más
números»**. `SUMA`…`RESTO` y `AZAR` **producen un valor** (`produceValor`): solo sirven como argumento
de otro comando (`ESCRIBE SUMA 30 40`, `AVANZA AZAR 100`). Solos en posición de instrucción son un
error (`operadorSinUso`). Los comandos de acción no producen valor: `AVANZA AVANZA 10` es un error.

`AZAR` es determinista: el generador se siembra con la semilla del reto, una instancia por ejecución,
así que la demostración de Kiro y el programa del jugador ven la misma secuencia. Nunca `Math.random`.

`ESCRIBE` y `ROTULA` no mueven la tortuga y **no participan en la comparación geométrica** (se filtran
de la divergencia y de los segmentos). `ESCRIBE` muestra el número con a lo sumo 4 decimales y sin
ceros finales (`10 / 3` → `3.3333`); con una palabra muestra el texto sin la comilla. `ROTULA` escribe
con el color y la posición vigentes, también con el lápiz arriba, y solo en el lienzo del jugador.

### Expresiones y precedencia

Los operadores se emiten siempre como tokens, con o sin espacios (`100*2`). Doble precisión, sin
redondeo intermedio, de izquierda a derecha.

| Nivel | Operación | Asociatividad |
|---|---|---|
| 1 (más fuerte) | paréntesis `( )` y menos unario `-x` | — |
| 2 | `*` `/` | izquierda |
| 3 | `+` `-` | izquierda |

`360 / 2 + 1` es 181; `360 / (2 + 1)` es 120. Los argumentos de los comandos de operador son
**maximales**: `SUMA 1 2 * 3` es `SUMA 1 (2 * 3)`. Máximo 32 niveles de paréntesis anidados. `= < >` siguen
reservados para el mundo 5.

### Procedimientos con parámetros: tres reglas

- **Ámbito léxico.** `:nombre` solo existe dentro del `PARA` que lo declara. Un procedimiento no hereda
  los parámetros de quien lo llama. Fuera de ámbito: `variableNoDefinida`.
- **Paso por valor.** La llamada evalúa los argumentos de izquierda a derecha en el entorno de quien
  llama y el procedimiento recibe copias.
- **No hay asignación.** Un parámetro nunca cambia de valor dentro de la llamada.

El mundo 5 hereda esas tres reglas para su recursión.

### Regla de la línea y `POLIGONO 6 -80`

El operador infijo continúa la expresión **solo en la misma línea**. El primer argumento de una
instrucción puede empezar en una línea posterior; los siguientes no. Consecuencia: `POLIGONO 6 -80` se
lee como `POLIGONO (6 - 80)`, que le deja un argumento sin dar; el error sugiere escribir
`POLIGONO 6 (-80)`. Un comando de acción en lugar de un argumento en la misma línea
(`AVANZA AVANZA 10`) es `argumentoDeTipoEquivocado`; en una línea posterior es `argumentoFaltante`.

### Bloqueo por mundo

Antes del mundo 4, `+ - * / ( )` reportan **un** `aritmeticaBloqueada` por programa (el primer símbolo)
y los comandos del mundo 4 reportan `comandoBloqueado` en cada ocurrencia. Antes del mundo 4, un `PARA`
con parámetros no define el procedimiento (`paraConParametros`).

## Mundo 5 · Fractales

| Comando | Abrev. | Qué hace | Ejemplo |
|---|---|---|---|
| `SI` | — | Ejecuta una lista si la condición es cierta | `SI :n = 0 [ALTO]` |
| `SINO` | — | Condicional con dos ramas | `SINO :n = 0 [AV 10] [AV 20]` |
| `ALTO` | — | Termina el procedimiento actual | `ALTO` |
| `DEVUELVE` | `DV` | Termina y devuelve un valor | `DEVUELVE :n * 2` |

## Colisiones de abreviaturas

Revisadas y libres. `RE` (retrocede) y `RL` (rellena) se distinguen. `RESTA` y `RESTO` existen solo
en forma larga, así que no chocan con `RE`. Al agregar un comando nuevo hay que verificar la tabla
completa en `vocabulario.ts`.

## Sintaxis

**Procedimientos:**

```
PARA CUADRADO
  REPITE 4 [AV 100 GD 90]
FIN
```

Con parámetros:

```
PARA POLIGONO :lados :largo
  REPITE :lados [AV :largo GD 360 / :lados]
FIN

POLIGONO 6 80
```

Una vez definido, un procedimiento se usa igual que un comando del lenguaje. El jugador no debería
poder distinguir, al leer un programa, cuáles palabras son del lenguaje y cuáles se definieron: eso
es justamente lo que enseña el mundo 2.

**Listas de instrucciones** entre corchetes: `[AV 100 GD 90]`.

**Palabras** con comilla inicial al estilo Logo: `"naranja`. Se acepta también la palabra desnuda
(`PONCOLOR naranja`) porque la comilla suelta es una fuente de frustración innecesaria para quien
empieza.

**Comentarios** con `#` hasta el final de la línea.

## Normalización de la entrada

El lexer normaliza antes de comparar contra el vocabulario:

- Mayúsculas y minúsculas son equivalentes: `avanza`, `AVANZA`, `Avanza`.
- Los acentos se eliminan para comparar: `GIRADERECHÁ` y `RELLENÁ` funcionan. Nadie pierde un nivel
  por un acento.
- Se acepta `ñ` como parte de identificadores.
- Números: se acepta punto o coma decimal. `AV 10,5` y `AV 10.5` son lo mismo.
- Ángulos siempre en grados.

## Colores

Nombres en español: `rojo`, `azul`, `verde`, `amarillo`, `naranja`, `morado`, `rosa`, `café`,
`negro`, `blanco`, `gris`. También la forma RGB en lista: `PONCOLOR [255 0 0]`.

## Mensajes de error

Descriptivos, en español, en el espíritu del Logo original: dicen qué pasó y qué falta, no un código.
Todos viven en `src/lenguaje/errores.ts`.

| Situación | Mensaje |
|---|---|
| Palabra desconocida | `No sé cómo hacer AVANSA. ¿Querías decir AVANZA?` |
| Comando en inglés | `No sé hacer FD. En KiroLogo se dice AVANZA.` |
| Falta un argumento | `AVANZA necesita un número. Por ejemplo: AVANZA 100` |
| Argumento del tipo equivocado | `AVANZA necesita un número, pero le diste una palabra: "hola` |
| Corchete sin cerrar | `Falta cerrar el corchete que abriste en la línea 2.` |
| Corchete de más | `Hay un corchete de cierre en la línea 4 que no abriste.` |
| `FIN` sin `PARA` | `Encontré FIN en la línea 7 pero no hay ningún PARA abierto.` |
| `PARA` sin `FIN` | `El comando CUADRADO que empezaste en la línea 1 nunca termina con FIN.` |
| Variable no definida | `No sé qué vale :largo aquí. ¿La declaraste como parámetro en PARA?` |
| Comando bloqueado | `REPITE todavía no está disponible. Se desbloquea en el mundo 1.` |
| Guarda de pasos | `Detuve la ejecución: la tortuga llevaba demasiados pasos. ¿Hay una repetición que nunca termina?` |
| Guarda de recursión | `Detuve la ejecución: ESPIRAL se llama a sí mismo sin parar. ¿Le falta el caso que lo detiene?` |

### Ids del mundo 4 (17 nuevos; el catálogo pasa de 47 a 64)

Los textos viven solo en `errores.ts`. Los nombres del jugador se muestran tal como los escribió.

| Id | Causa |
|---|---|
| `variableNoDefinida` | `:nombre` fuera del ámbito de su `PARA` |
| `parametroDuplicado` | un `PARA` declara dos veces el mismo parámetro |
| `procedimientoArgumentosFaltantes` | llamada con menos argumentos (`Falta 1: :largo.` / `Faltan 2: ...`); añade `¿Querías escribir (-80) con paréntesis?` si el último token fue un `-` binario |
| `procedimientoArgumentosDeMas` | llamada con más argumentos, o argumentos a un `PARA` sin parámetros |
| `operadorSinUso` | `SUMA`…`AZAR` en posición de instrucción: `SUMA calcula un valor, pero no dijiste qué hacer con él. Por ejemplo: ESCRIBE SUMA 30 40` |
| `aritmeticaBloqueada` | `+ - * / ( )` antes del mundo 4 |
| `parentesisSinCerrar` | `Falta cerrar el paréntesis que abriste en la línea N.` |
| `parentesisDeMas` | `Hay un paréntesis de cierre en la línea N que no abriste.` |
| `expresionIncompleta` | `Falta un número después del símbolo + de la línea N.` |
| `expresionDemasiadoProfunda` | más de 32 paréntesis anidados (o altura 128) |
| `divisionPorCero` | divisor `0` o `-0` en `/`, `COCIENTE` o `RESTO`; detiene la ejecución |
| `numeroFueraDeRango` | el resultado no es finito; detiene la ejecución |
| `vecesInvalidas` | `REPITE` con cantidad no entera (tolerancia 1e-9) o negativa; no ejecuta el cuerpo |
| `azarRangoInvalido` | `AZAR n` con `n` no entero o menor que 1 |
| `guardaEscrituras` | más de 500 operaciones `ESCRIBE`/`ROTULA` |
| `invitacionAbstraccionParametros` | no es fallo: invita a un `PARA` con parámetros tras ganar precisión |
| `invitacionAbstraccionProcedimientos` | no es fallo: se definieron más procedimientos que el máximo del nivel |

`argumentoDeTipoEquivocado` gana procedimiento y parámetro opcionales: `POLIGONO necesita un número en
:lados, pero le diste una palabra: "hola`.

## Guardas de ejecución

Todas detienen con un mensaje en español, conservando lo emitido hasta ese momento.

- 200 000 pasos de tortuga (`escribir` y `rotular` también suman 1).
- 100 niveles de recursión: cuentan solo los marcos de **procedimiento**, no los de `REPITE`
  (`REPITE 150 [CUADRADO]` no la dispara).
- 5 segundos de tiempo, medidos cada cierto número de ciclos.
- 100 operaciones `RELLENA`.
- 500 operaciones `ESCRIBE`/`ROTULA` (`guardaEscrituras`); la 501 no se emite.
- 2 000 000 de ciclos (instrucciones despachadas e iteraciones, incluso con cuerpo vacío); reutiliza
  el mensaje de la guarda de pasos.

La sugerencia de "¿querías decir...?" se calcula por distancia de edición contra el vocabulario
desbloqueado. Si la palabra se parece a un comando aún bloqueado, el mensaje lo dice explícitamente
en lugar de fingir que no existe.

## Conteo de instrucciones (para la estrella de economía)

Regla única, para que el presupuesto sea predecible:

- Cada invocación de comando cuenta 1, esté donde esté escrita.
- `REPITE n [...]` cuenta 1 más las instrucciones **del cuerpo escrito**, no por iteración. Ahí está
  el incentivo: repetir a mano cuesta, iterar no.
- `SI` y `SINO` cuentan 1 más las instrucciones de sus listas.
- La cabecera `PARA … FIN` no cuenta. El cuerpo del procedimiento cuenta sus instrucciones una sola
  vez, y cada llamada cuenta 1. Así definir un procedimiento nunca sale más caro que copiar y pegar.
- Los comentarios y las líneas vacías no cuentan.
- **Las expresiones cuestan 0.** Lo que cuenta es el comando que las recibe: `AVANZA 100`,
  `AVANZA 50 + 50` y `AVANZA SUMA 50 50` cuestan 1 cada uno. Números, parámetros, operadores, menos
  unario, palabras y comandos de operador no suman; la cantidad de un `REPITE` tampoco.
- `ESCRIBE` y `ROTULA` cuentan 1.

Ejemplo: `PARA POLIGONO :lados :largo REPITE :lados [AV :largo GD 360 / :lados] FIN` seguido de
`POLIGONO 6 80` cuenta 4: `REPITE`, `AV`, `GD` y la llamada.

Ejemplo: `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]` cuenta 5 — dos `REPITE`, un `AV` y dos `GD`.
