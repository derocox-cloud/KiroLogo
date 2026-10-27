# Requirements Document

**KiroLogo · Spec 03 · Mundo 2 · Composición**

## Introduction

Esta spec agrega los procedimientos con `PARA … FIN` (sin parámetros), el control del lápiz y el
color, y los seis niveles del mundo 2. Es el mundo donde el jugador deja de dar instrucciones y
empieza a **enseñarle palabras nuevas a Kiro**.

El concepto central es la **descomposición**: una figura compleja es la suma de figuras simples, y
nombrar un dibujo permite reusarlo. Es el camino `CUADRADO` → `FLOR` → `JARDÍN` del artículo del MIT:
el jugador define un cuadrado una vez, luego lo usa para construir cosas más grandes, y descubre que
abstraer no solo es más limpio sino más barato que copiar y pegar.

Al terminar el mundo 0 el jugador copió cuatro veces `AV 100 GD 90`; en el mundo 1 aprendió a repetir
con `REPITE`. Ahora aprende que también puede **nombrar** un conjunto de instrucciones y volver a
llamarlo. Esa es la segunda forma de combatir la repetición, y la que habilita todo lo que sigue.

### Decisiones cerradas

**El relleno es decorativo y no entra en la validación geométrica** — El algoritmo de validación
compara trazos dilatados; un área rellena es otra clase de cosa. `RELLENA` se mantiene fuera del
cálculo de precisión: ningún nivel del mundo 2 depende de él para aprobar. El único nivel que lo usa
como parte del reto es el B.5, que vive en el mundo bonus y queda fuera de esta spec. Así el validador
sigue comparando solo trazos, que es lo que sabe hacer de forma estable, y el relleno es un adorno que
el jugador puede usar sin que le cueste ni le ayude a pasar.

**El color no cuenta para la precisión** — Igual que el relleno, el color es decoración, no
pensamiento algorítmico. `PONCOLOR` y `PONGROSOR` no afectan la máscara de trazos que se compara
contra la referencia. La excepción son los niveles del mundo bonus que declaren el color como parte
del reto, pero eso está fuera de esta spec. En el mundo 2, colorear nunca aprueba ni reprueba un
nivel.

**No se impone estructura entre definiciones y programa principal** — Logo no exige separar las
definiciones de procedimientos del programa que las usa, y esta spec tampoco lo hace. Las definiciones
`PARA … FIN` pueden ir en cualquier parte del programa; el editor las reconoce al analizar el texto y
muestra los procedimientos definidos en el panel lateral, junto a los comandos del lenguaje. Imponer
un orden sería una regla artificial que el jugador tendría que recordar sin ganar nada a cambio.

**Redefinir un comando del lenguaje se rechaza; redefinir un procedimiento propio se avisa** — El
mundo 2 enseña que, al leer un programa, no se debe poder distinguir qué palabras vienen del lenguaje
y cuáles se definieron. Por eso un procedimiento se usa igual que un comando del lenguaje. Pero
permitir que el jugador redefina `AVANZA` rompería el vocabulario base del que depende todo lo demás,
así que esa redefinición se rechaza con un error claro. Redefinir un procedimiento propio ya definido
sí está permitido pedagógicamente discutirlo, pero en esta spec se trata como error (`procedimiento
redefinido`) para que el jugador no pierda sin querer una definición anterior; si quiere cambiarla,
edita la definición original.

### Patrones EARS en español

| Patrón | Forma en este documento | EARS |
|---|---|---|
| Ubicuo | EL/LA \<sistema\> DEBERÁ \<respuesta\> | THE … SHALL |
| Dirigido por evento | CUANDO \<disparador\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHEN … |
| Dirigido por estado | MIENTRAS \<condición\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHILE … |
| Evento no deseado | SI \<condición\>, ENTONCES EL/LA \<sistema\> DEBERÁ \<respuesta\> | IF … THEN … |
| Opcional | DONDE \<opción\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHERE … |

## Glossary

Términos nuevos o revisados en esta spec:

- **Nodo_Para**: nodo del AST que representa la definición `PARA NOMBRE … FIN`. Campos: `nombre:
  string`, `cuerpo: Instruccion[]`. En esta spec no declara parámetros.
- **Invocacion_Procedimiento**: nodo del AST que representa la llamada a un procedimiento definido por
  el jugador, por ejemplo `CUADRADO`. Campo: `nombre: string`.
- **Tabla_Procedimientos**: estructura que asocia cada nombre de procedimiento definido con su
  `Nodo_Para`. Es lo que consultan el intérprete, el panel de comandos y la detección de nombres
  desconocidos.
- **Estado_Lapiz**: estado de la tortuga que indica si el lápiz está abajo (dibuja) o arriba (se mueve
  sin dibujar). Lo cambian `SUBELAPIZ` y `BAJALAPIZ`.
- **Color_Trazo**: color actual de la estela, nombre en español o terna RGB. Lo cambia `PONCOLOR`. No
  afecta la validación de precisión.
- **Grosor_Trazo**: grosor actual de la estela en píxeles. Lo cambia `PONGROSOR`. No afecta la
  validación de precisión.
- **Catalogo_Colores**: conjunto de nombres de color válidos en español definido en
  `lenguaje-kirologo` (`rojo`, `azul`, `verde`, `amarillo`, `naranja`, `morado`, `rosa`, `café`,
  `negro`, `blanco`, `gris`), más la forma RGB en lista `[r g b]`.
- **Generador_M2**: función pura `(semilla: number) → ProgramaReferencia` para los niveles generados
  del mundo 2 (2.2, 2.3, 2.5, 2.6).
- **Estrella_Abstraccion_Procedimiento**: condición `defineProcedimiento` — el AST del jugador
  contiene al menos un `Nodo_Para`.
- **Presupuesto_Referencia**: conteo de instrucciones del programa de referencia según la regla de
  `lenguaje-kirologo`. Es el `presupuestoEstrella` del nivel; no se escribe a mano.

## Requirements

### Requirement 1: Definición e invocación de procedimientos

**User Story:** Como jugador, quiero escribir `PARA CUADRADO … FIN` y luego usar `CUADRADO` como si fuera un comando del lenguaje, para enseñarle a Kiro una palabra nueva y dejar de copiar y pegar.

#### Acceptance Criteria

1. CUANDO el jugador escribe `PARA CUADRADO` seguido de `REPITE 4 [AV 100 GD 90]` y `FIN`, y luego invoca `CUADRADO`, EL Intérprete DEBERÁ emitir la misma secuencia de operaciones, en el mismo orden, que `REPITE 4 [AV 100 GD 90]`.
2. CUANDO el Parser reconoce una definición `PARA … FIN`, EL Parser DEBERÁ producir un `Nodo_Para` y registrarlo en la `Tabla_Procedimientos` bajo su nombre.
3. CUANDO el jugador invoca un procedimiento definido, EL Intérprete DEBERÁ ejecutar el cuerpo del `Nodo_Para` correspondiente de la `Tabla_Procedimientos`.
4. EL Intérprete DEBERÁ resolver y ejecutar una `Invocacion_Procedimiento` por el mismo flujo con que resuelve y ejecuta la invocación de un comando del lenguaje.
5. CUANDO un procedimiento se define después de ser invocado en el texto del programa, EL Intérprete DEBERÁ resolver la invocación contra la `Tabla_Procedimientos` ya completa tras el análisis de todo el programa, sin exigir que la definición preceda a la llamada.
6. SI el jugador invoca una palabra que no es comando del lenguaje ni procedimiento registrado en la `Tabla_Procedimientos`, ENTONCES EL Intérprete DEBERÁ detener la ejecución, producir un error de palabra desconocida y no emitir ninguna operación por esa invocación.
7. SI el jugador define dos procedimientos con el mismo nombre, ENTONCES EL Parser DEBERÁ reportar el nombre duplicado y no registrar una segunda entrada en la `Tabla_Procedimientos`.
8. CUANDO el jugador invoca un procedimiento cuyo cuerpo está vacío, EL Intérprete DEBERÁ completar la invocación con cero operaciones y sin error.

### Requirement 2: Conteo de procedimientos para la estrella de economía

**User Story:** Como jugador, quiero que definir un procedimiento nunca me salga más caro que copiar y pegar el mismo código, para que abstraer sea siempre la decisión económica.

#### Acceptance Criteria

1. CUANDO EL Conteo procesa la línea `PARA NOMBRE` de una definición, EL Conteo DEBERÁ sumar exactamente 0 al presupuesto por esa línea.
2. CUANDO EL Conteo procesa la línea `FIN` de una definición, EL Conteo DEBERÁ sumar exactamente 0 al presupuesto por esa línea.
3. CUANDO EL Conteo procesa el cuerpo de un procedimiento, EL Conteo DEBERÁ contar sus instrucciones exactamente una vez, en el lugar de la definición.
4. CUANDO EL Conteo procesa una `Invocacion_Procedimiento`, EL Conteo DEBERÁ sumar exactamente 1, igual que para una `Invocacion_Comando`.
5. DONDE un programa define un procedimiento y lo invoca `m` veces, con `m` entero mayor o igual que 2, y el programa alternativo copia el cuerpo `m` veces, y ambos programas están sintácticamente bien formados, EL Conteo del primero DEBERÁ ser menor o igual que el del segundo. (Con `m = 1` definir e invocar cuesta `cuerpo + 1`, una unidad más que la copia única; la economía de abstraer aparece desde la segunda reutilización.)
6. CUANDO EL Conteo procesa `PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN CUADRADO CUADRADO CUADRADO`, EL Conteo DEBERÁ devolver exactamente 6.
7. CUANDO EL Conteo procesa el programa equivalente que copia el cuerpo `REPITE 4 [AV 100 GD 90]` tres veces sin definir procedimiento, EL Conteo DEBERÁ devolver exactamente 9 (cada `REPITE 4 [AV 100 GD 90]` cuenta 3: la regla de conteo no multiplica el cuerpo por las iteraciones).

> **Nota de corrección (spec 03).** Una versión anterior de este requisito decía que copiar el cuerpo tres veces contaba 12 y que la economía valía para todo `m ≥ 1`. Era un error de esta spec: calculaba el copia-pega expandiendo el bucle. La regla de conteo del proyecto (steering `lenguaje-kirologo` y `conteo.ts`, la única fuente de verdad del presupuesto) cuenta `REPITE 4 [AV 100 GD 90]` como 3, no por iteración, así que tres copias cuentan 9. El caso con procedimiento (6) no cambia, y la lección se conserva: abstraer sigue siendo más barato. El steering y las specs 00–02 ya eran correctos; la discrepancia era solo de la spec 03.

### Requirement 3: Control del lápiz y su animación

**User Story:** Como jugador, quiero levantar y bajar el lápiz para mover la tortuga sin dibujar, y ver claramente cuándo el lápiz está arriba, para componer figuras separadas sin trazos que las unan.

#### Acceptance Criteria

1. CUANDO el jugador ejecuta `SUBELAPIZ`, EL Intérprete DEBERÁ poner el `Estado_Lapiz` en arriba.
2. MIENTRAS el `Estado_Lapiz` está en arriba, EL Intérprete NO DEBERÁ producir segmentos por los movimientos de la tortuga, aun cuando el desplazamiento sea mayor o igual a 0,0001 unidades.
3. CUANDO el jugador ejecuta `BAJALAPIZ`, EL Intérprete DEBERÁ poner el `Estado_Lapiz` en abajo.
4. MIENTRAS el `Estado_Lapiz` está en abajo, EL Intérprete DEBERÁ producir un segmento por cada movimiento de la tortuga cuyo desplazamiento sea mayor o igual a 0,0001 unidades.
5. AL iniciar la ejecución de un programa, EL Intérprete DEBERÁ fijar el `Estado_Lapiz` en abajo.
6. EL Vocabulario DEBERÁ aceptar `SL` como equivalente de `SUBELAPIZ` y `BL` como equivalente de `BAJALAPIZ`, sin distinguir mayúsculas, minúsculas ni acentos.
7. CUANDO el jugador ejecuta `SUBELAPIZ` con el `Estado_Lapiz` ya en arriba, o `BAJALAPIZ` con el `Estado_Lapiz` ya en abajo, EL Intérprete DEBERÁ mantener el estado sin cambios y sin error.
8. CUANDO el `Estado_Lapiz` cambia a arriba, EL Animador DEBERÁ reproducir, dentro de la duración de la operación, una animación de Kiro levantando el lápiz de la tortuga.
9. MIENTRAS el `Estado_Lapiz` está en arriba, EL Animador DEBERÁ mostrar una señal visual persistente en la tortuga, observable en cada fotograma, distinta de su aspecto con el lápiz abajo.

### Requirement 4: Color, grosor y relleno

**User Story:** Como jugador, quiero pintar mis figuras con colores y rellenos, para que mis dibujos se vean como quiero, sin que eso cambie si apruebo el nivel.

#### Acceptance Criteria

1. CUANDO el jugador ejecuta `PONCOLOR "naranja`, EL Intérprete DEBERÁ fijar el `Color_Trazo` en naranja y aplicarlo a todos los segmentos que se dibujen después de esa instrucción, sin modificar los ya dibujados.
2. EL Intérprete DEBERÁ aceptar el color en tres formas equivalentes: palabra desnuda (`PONCOLOR naranja`), palabra con comilla inicial (`PONCOLOR "naranja`) y terna RGB como lista de tres enteros entre 0 y 255 (`PONCOLOR [255 0 0]`).
3. SI el argumento de `PONCOLOR` no corresponde a un nombre de color reconocido ni a una terna de tres enteros entre 0 y 255, ENTONCES EL Intérprete DEBERÁ rechazar la instrucción con un mensaje de error que indique color no válido y DEBERÁ conservar el `Color_Trazo` anterior sin cambios.
4. CUANDO el jugador ejecuta `PONGROSOR n` con `n` entero entre 1 y 50, EL Intérprete DEBERÁ fijar el `Grosor_Trazo` en `n` píxeles y aplicarlo a todos los segmentos que se dibujen después de esa instrucción.
5. SI el argumento de `PONGROSOR` no es un número entero dentro del rango de 1 a 50, ENTONCES EL Intérprete DEBERÁ rechazar la instrucción con un mensaje de error que indique grosor no válido y DEBERÁ conservar el `Grosor_Trazo` anterior sin cambios.
6. CUANDO el jugador ejecuta `RELLENA "azul` y la tortuga está dentro de un área cerrada, EL Intérprete DEBERÁ rellenar esa área con el color indicado.
7. SI el jugador ejecuta `RELLENA` y la tortuga no está dentro de un área cerrada, ENTONCES EL Intérprete DEBERÁ dejar el lienzo sin cambios de relleno.
8. CUANDO EL Validador calcula la estrella de precisión, EL Validador DEBERÁ comparar únicamente los trazos (segmentos) de la figura y NO DEBERÁ considerar el `Color_Trazo`, el `Grosor_Trazo` ni el relleno, de modo que dos figuras con los mismos trazos y distinto color, grosor o relleno obtengan el mismo veredicto de precisión.
9. EL Vocabulario DEBERÁ aceptar `PC`, `PG` y `RL` como equivalentes de `PONCOLOR`, `PONGROSOR` y `RELLENA` respectivamente.

### Requirement 5: Ocultar y mostrar la tortuga

**User Story:** Como jugador, quiero esconder la tortuga y a Kiro para ver mi dibujo terminado sin que lo tapen, y volver a mostrarlos cuando quiera.

#### Acceptance Criteria

1. CUANDO el jugador ejecuta `OCULTATORTUGA`, EL Animador DEBERÁ dejar de dibujar la tortuga y a Kiro a partir del siguiente fotograma, conservando intactos todos los segmentos ya dibujados.
2. CUANDO el jugador ejecuta `MUESTRATORTUGA`, EL Animador DEBERÁ volver a dibujar la tortuga y a Kiro en su posición y rumbo actuales a partir del siguiente fotograma.
3. EL Vocabulario DEBERÁ aceptar `OT` como equivalente de `OCULTATORTUGA` y `MT` como equivalente de `MUESTRATORTUGA`, sin distinguir mayúsculas, minúsculas ni acentos.
4. CUANDO el jugador ejecuta `OCULTATORTUGA` con la tortuga ya oculta, EL Animador DEBERÁ mantenerla oculta sin alterar los segmentos ya dibujados ni producir error.
5. CUANDO el jugador ejecuta `MUESTRATORTUGA` con la tortuga ya visible, EL Animador DEBERÁ mantenerla visible sin alterar los segmentos ya dibujados ni producir error.

### Requirement 6: Errores de procedimientos, lápiz y color

**User Story:** Como jugador, quiero mensajes de error claros cuando me equivoco al definir o invocar un procedimiento o al nombrar un color, para corregir sin adivinar qué pasó.

#### Acceptance Criteria

1. SI el jugador escribe `FIN` sin un `PARA` abierto, ENTONCES EL Catalogo_Errores DEBERÁ producir el mensaje `Encontré FIN en la línea N pero no hay ningún PARA abierto.`, donde N es el número de línea (desde 1) del `FIN`, y DEBERÁ descartar ese `FIN` sin registrar ningún procedimiento.
2. SI el jugador empieza un `PARA NOMBRE` que llega al final del programa sin un `FIN` que lo cierre, ENTONCES EL Catalogo_Errores DEBERÁ producir el mensaje `El comando NOMBRE que empezaste en la línea N nunca termina con FIN.`, donde NOMBRE es el nombre del procedimiento y N es el número de línea (desde 1) donde empezó el `PARA`, y NO DEBERÁ registrar ese procedimiento en la `Tabla_Procedimientos`.
3. SI el jugador invoca una palabra que no es comando del lenguaje ni procedimiento definido en la `Tabla_Procedimientos`, Y existe un comando desbloqueado o un procedimiento definido cuya distancia de edición a la palabra escrita es menor o igual a 1 cuando la palabra tiene 3 caracteres o menos, o menor o igual a 2 cuando tiene 4 caracteres o más, ENTONCES EL Catalogo_Errores DEBERÁ producir un mensaje de palabra desconocida que incluya la sugerencia con la forma `¿Querías decir …?`, donde «…» es ese candidato más cercano.
4. SI el jugador invoca una palabra que no es comando del lenguaje ni procedimiento definido en la `Tabla_Procedimientos`, Y no existe ningún candidato dentro de la distancia de edición de la cláusula anterior, ENTONCES EL Catalogo_Errores DEBERÁ producir un mensaje de palabra desconocida sin sugerencia que nombre la palabra escrita.
5. SI el jugador define dos veces un procedimiento con el mismo nombre en el mismo programa, ENTONCES EL Catalogo_Errores DEBERÁ rechazar la segunda definición con el error `procedimiento redefinido` indicando el nombre del procedimiento y el número de línea (desde 1) de la nueva definición, y DEBERÁ conservar la primera definición en la `Tabla_Procedimientos` sin reemplazarla.
6. SI el jugador intenta definir un procedimiento cuyo nombre coincide, tras normalizarlo, con el nombre largo o la abreviatura de un comando del Vocabulario (por ejemplo `PARA AVANZA`), ENTONCES EL Catalogo_Errores DEBERÁ rechazar la definición con un mensaje que explique que ese nombre pertenece al lenguaje y no se puede redefinir, y NO DEBERÁ registrar esa definición en la `Tabla_Procedimientos`.
7. SI el jugador usa `PONCOLOR` con un nombre de color que no es ninguno del `Catalogo_Colores` (`rojo`, `azul`, `verde`, `amarillo`, `naranja`, `morado`, `rosa`, `café`, `negro`, `blanco` o `gris`) ni una terna RGB en lista `[r g b]`, ENTONCES EL Catalogo_Errores DEBERÁ producir un mensaje que liste esos once nombres de color disponibles, y NO DEBERÁ cambiar el `Color_Trazo` vigente.

### Requirement 7: Panel de comandos con procedimientos del jugador

**User Story:** Como jugador, quiero ver en el panel lateral los procedimientos que yo definí junto a los comandos del lenguaje, para recordar qué palabras le enseñé a Kiro.

#### Acceptance Criteria

1. CUANDO el jugador define un procedimiento con `PARA … FIN`, EL Panel_Comandos DEBERÁ mostrarlo después de los comandos del lenguaje desbloqueados en el mundo actual, en el orden en que las definiciones aparecen en el texto del programa.
2. CUANDO el Panel_Comandos muestra un procedimiento del jugador, EL Panel_Comandos DEBERÁ mostrar su nombre tal como se escribió, sin abreviatura.
3. EL Panel_Comandos DEBERÁ reconocer las definiciones en cualquier posición del texto del programa, sin exigir que estén separadas del programa principal ni en un orden fijo.
4. CUANDO el texto del programa cambia, EL Panel_Comandos DEBERÁ actualizar la lista de procedimientos mostrados para que coincida con la `Tabla_Procedimientos` vigente (altas, bajas y renombres).
5. SI una definición no queda registrada en la `Tabla_Procedimientos` (por estar incompleta o por ser rechazada, como en el caso `procedimiento redefinido`), ENTONCES EL Panel_Comandos DEBERÁ omitirla sin alterar las demás entradas.

### Requirement 8: Niveles autorados del mundo 2

**User Story:** Como jugador, quiero que los niveles 2.1 y 2.4 tengan retos fijos y bien contrastados para que la lección de componer figuras simples sea evidente.

#### Acceptance Criteria

1. EL nivel 2.1 DEBERÁ tener como programa de referencia una casa compuesta por un cuadrado y un triángulo encima: `REPITE 4 [AV 100 GD 90] AV 100 GD 30 REPITE 3 [AV 100 GD 120]`.
2. EL nivel 2.4 DEBERÁ tener como programa de referencia una cruz: `REPITE 4 [AV 50 GI 90 AV 50 GD 90 AV 50 GI 90]`.
3. CUANDO se carga un nivel autorado del mundo 2, EL sistema DEBERÁ fijar su `presupuestoEstrella` con el valor que el Conteo devuelve al aplicarse a su programa de referencia, sin ningún número de presupuesto escrito a mano en los datos del nivel.
4. CUANDO el jugador aprueba un nivel autorado del mundo 2 con precisión bajo la normalización de traslación y rotación libres y escala exacta del mundo 2, EL sistema DEBERÁ otorgar la estrella de precisión.
5. SI el programa de referencia de un nivel autorado del mundo 2 no puede contarse (por no estar sintácticamente bien formado), ENTONCES EL sistema DEBERÁ tratarlo como error de datos del nivel y no asignar un `presupuestoEstrella`.

### Requirement 9: Generadores del mundo 2

**User Story:** Como diseñador de niveles, quiero que los niveles 2.2, 2.3, 2.5 y 2.6 generen retos distintos por semilla y que su presupuesto salga del conteo de la referencia, sin números a mano.

#### Acceptance Criteria

1. CUANDO se genera el nivel 2.2 con una semilla, EL Generador_M2 DEBERÁ producir una estrella de `p` puntas con `p` ∈ {5, 7, 9} y largo `L` múltiplo de 20 entre 100 y 180 (inclusive), de la forma `REPITE p [AV L GD 360*2/p]`.
2. CUANDO se genera el nivel 2.3 con una semilla, EL Generador_M2 DEBERÁ producir una escalera de 3 a 6 peldaños (inclusive) con huella y altura iguales entre sí y múltiplo de 20 entre 20 y 60 (inclusive).
3. CUANDO se genera el nivel 2.5 con una semilla, EL Generador_M2 DEBERÁ producir dos polígonos, cada uno de 3 a 6 lados (inclusive), separados por una distancia múltiplo de 20 entre 20 y 100 (inclusive).
4. CUANDO se genera el nivel 2.5 con una semilla, EL programa de referencia DEBERÁ usar `SUBELAPIZ` y `BAJALAPIZ` para separar los dos polígonos sin trazo entre ellos.
5. CUANDO se genera el nivel 2.6 con una semilla, EL Generador_M2 DEBERÁ producir una cuadrícula de paneles de 2×2, 3×2 o 3×3.
6. CUANDO se genera el nivel 2.6 con una semilla, EL programa de referencia DEBERÁ definir un procedimiento con `PARA` e invocarlo una vez por cada panel de la cuadrícula.
7. CUANDO se genera cualquiera de los niveles 2.2, 2.3, 2.5 y 2.6, EL Generador_M2 DEBERÁ fijar el campo `presupuestoEstrella` del nivel con el valor que el Conteo devuelve al aplicarse al programa de referencia, en tiempo de ejecución.
8. EL Generador_M2 NO DEBERÁ escribir a mano ningún valor de presupuesto en los datos del nivel; el único origen del presupuesto es el Conteo aplicado a la referencia.
9. SI la figura generada es degenerada (el ancho o el alto de su caja envolvente alineada a los ejes es menor que 200 px), ENTONCES EL Generador_M2 DEBERÁ descartar la semilla e intentar con la semilla siguiente.
10. SI la figura generada no está encuadrada (su caja envolvente alineada a los ejes se sale del rango [−400, 400] px en cualquier eje, es decir, desborda el lienzo de 800 × 800 px), ENTONCES EL Generador_M2 DEBERÁ descartar la semilla e intentar con la semilla siguiente.
11. CUANDO se verifica un Generador_M2 sobre 200 semillas consecutivas, cada una de las 200 DEBERÁ producir un reto encuadrado y no degenerado cuya referencia obtiene las tres estrellas (precisión, economía y abstracción).

### Requirement 10: Estrella de abstracción por procedimiento

**User Story:** Como jugador, quiero que el nivel 2.6 me pida de verdad definir un procedimiento y no solo copiar el panel, para aprender que abstraer es la forma correcta de componer.

#### Acceptance Criteria

1. EL nivel 2.6 DEBERÁ declarar `defineProcedimiento` como requisito de la estrella de abstracción.
2. CUANDO el jugador aprueba el nivel 2.6 con precisión y su AST contiene al menos un nodo de definición de procedimiento, EL sistema DEBERÁ otorgar la estrella de abstracción.
3. SI el jugador aprueba el nivel 2.6 con precisión pero su AST no contiene ningún nodo de definición de procedimiento, ENTONCES EL sistema DEBERÁ otorgar la precisión y negar la estrella de abstracción.
4. CUANDO se niega la estrella de abstracción del 2.6, EL sistema DEBERÁ mostrar el mensaje: *"Lo conseguiste, pero dibujaste cada panel por separado. Intenta enseñarme qué es un panel con PARA, y luego pídemelo una vez por cada casilla."*
5. CUANDO el jugador resuelve el 2.6 repitiendo el panel una vez por casilla sin definir un procedimiento, EL Conteo del programa DEBERÁ ser estrictamente mayor que el `presupuestoEstrella`, de modo que no obtenga la estrella de economía.
6. CUANDO EL Verificador decide si se cumple `defineProcedimiento`, EL Verificador DEBERÁ analizar el AST del jugador en busca de un nodo de definición de procedimiento, no el texto del programa.

### Requirement 11: Insignia Descomposición

**User Story:** Como jugador, quiero ganar la insignia *Descomposición* al completar el mundo 2 con las tres estrellas en todos los niveles, como reconocimiento de que entendí el concepto.

#### Acceptance Criteria

1. CUANDO cada uno de los niveles del mundo 2 tiene otorgadas sus tres estrellas (precisión, economía y abstracción de forma simultánea), EL sistema DEBERÁ otorgar la insignia *Descomposición*.
2. SI al menos un nivel del mundo 2 no tiene otorgada alguna de sus tres estrellas, ENTONCES EL sistema DEBERÁ no otorgar la insignia *Descomposición*.
3. MIENTRAS la insignia *Descomposición* esté otorgada, EL sistema DEBERÁ mostrarla en el perfil del jugador.
4. MIENTRAS la insignia *Descomposición* esté otorgada, EL sistema DEBERÁ mostrarla en el mapa de progreso.
5. CUANDO el jugador vuelve a completar niveles del mundo 2 con la insignia ya otorgada, EL sistema DEBERÁ mantenerla otorgada exactamente una vez, sin crear una segunda instancia de la insignia.

### Requirement 12: Vocabulario del mundo 2 bloqueado antes de tiempo

**User Story:** Como diseñador de producto, quiero que los comandos del mundo 2 no estén disponibles antes del mundo 2, para que el desbloqueo se sienta como un logro.

#### Acceptance Criteria

1. MIENTRAS el jugador está en el mundo 0 o en el mundo 1, SI escribe el nombre largo de un comando cuyo mundo de desbloqueo es 2 (`PARA`, `FIN`, `SUBELAPIZ`, `BAJALAPIZ`, `PONCOLOR`, `PONGROSOR`, `RELLENA`, `OCULTATORTUGA` o `MUESTRATORTUGA`), ENTONCES EL Catalogo_Errores DEBERÁ producir un mensaje que nombre el comando e indique que se desbloquea en el mundo 2.
2. MIENTRAS el jugador está en el mundo 0 o en el mundo 1, SI escribe la abreviatura de un comando cuyo mundo de desbloqueo es 2 (`SL`, `BL`, `PC`, `PG`, `RL`, `OT` o `MT`), ENTONCES EL Catalogo_Errores DEBERÁ producir el mismo mensaje de comando bloqueado que para su nombre largo.
3. CUANDO el jugador entra al mundo 2, EL Panel_Comandos DEBERÁ mostrar cada comando cuyo mundo de desbloqueo es 2, con su descripción y un ejemplo.
4. EL Panel_Comandos DEBERÁ mostrar únicamente los comandos cuyo mundo de desbloqueo es menor o igual al mundo actual del jugador, más los procedimientos definidos válidamente con `PARA … FIN`.
