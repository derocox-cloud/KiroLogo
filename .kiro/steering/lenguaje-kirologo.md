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
| `+ - * /` | — | Operadores infijos | `GD 360 / :lados` |
| `SUMA` | — | Suma dos o más números | `ES SUMA 30 40` |
| `RESTA` | — | Diferencia entre dos números | `ES RESTA 65 45` |
| `PRODUCTO` | — | Multiplica dos o más números | `ES PRODUCTO 5 10` |
| `COCIENTE` | — | Divide | `ES COCIENTE 8 2` |
| `RESTO` | — | Residuo de la división | `ES RESTO 5 3` |
| `AZAR` | — | Número al azar entre 0 y n-1 | `AV AZAR 100` |
| `ESCRIBE` | `ES` | Muestra un valor en la consola | `ES :lados` |
| `ROTULA` | `RO` | Escribe texto sobre el lienzo | `ROTULA "hola` |

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

Ejemplo: `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]` cuenta 5 — dos `REPITE`, un `AV` y dos `GD`.
