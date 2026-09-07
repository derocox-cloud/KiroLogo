# KiroLogo — Producto

## Qué es

Un juego web para aprender pensamiento algorítmico escribiendo instrucciones en un pseudo-lenguaje
Logo en español. En cada nivel, Kiro montado sobre la tortuga **dibuja una figura en vivo** frente al
jugador, y este debe escribir el programa que la reproduce. Al lograrlo, sube de nivel.

Inspirado en el Logo del MIT Media Lab:
https://el.media.mit.edu/logo-foundation/what_is_logo/logo_programming.html

## Audiencia

La comunidad de AWS en español en LATAM. Personas técnicas o en formación técnica, hispanohablantes,
que quieren o necesitan afianzar las nociones base de programación: secuencia, iteración,
descomposición, generalización y recursión.

Implicaciones no negociables:

- **Todo en español.** Comandos, mensajes de error, interfaz, documentación. Sin alias en inglés.
- Tolerancia a acentos y mayúsculas en la entrada del jugador.
- Grados, no radianes. Se acepta coma o punto como separador decimal.

## Los tres personajes

La pantalla hace explícita la separación entre quien escribe, quien interpreta y quien ejecuta:

1. **El jugador** escribe el programa.
2. **El fantasma de Kiro** va montado sobre el caparazón. Recibe las instrucciones y se las pasa a
   la tortuga. Es el único que habla: comenta, da pistas y celebra en globos de diálogo.
3. **La tortuga** obedece al pie de la letra y carga el lápiz que deja la estela. Nunca habla.

Esta metáfora sostiene la lección central del juego: **la tortuga hace exactamente lo que dijiste,
no lo que querías decir.** Cuando el dibujo sale mal, el error está en las instrucciones, no en el
jugador ni en "la computadora".

Consecuencias de diseño que se derivan de la metáfora:

- La tortuga apunta al rumbo actual. Kiro se inclina hacia donde viene el próximo giro, como
  anticipación visual.
- En modo paso a paso Kiro **se baja** del caparazón, flota al lado y señala la línea que se ejecuta.
  Separa visualmente "leer la instrucción" de "ejecutar el movimiento".
- `SUBELAPIZ` se anima como Kiro levantando físicamente el lápiz de la tortuga. El cambio de estado
  nunca es invisible.

## El reto es una demostración, no una imagen

**No hay imágenes objetivo en el juego.** Al entrar a un nivel, Kiro y la tortuga recorren la figura
en vivo: se ve el punto de partida, el rumbo inicial, cada tramo y cada giro. Cuando terminan, la
estela queda en pantalla como referencia tenue y la tortuga vuelve al inicio para que el jugador
intente.

Por qué es mejor que una imagen:

- **Las longitudes se pueden leer.** El jugador ve el recorrido sobre una cuadrícula, no una silueta
  de la que hay que adivinar medidas.
- **El punto de partida y el rumbo son explícitos.** Desaparece la clase de frustración que no enseña
  nada.
- **Enseña que una figura es un proceso**, no un resultado. Es exactamente la idea que el juego
  quiere instalar.
- **La demostración se puede repetir** cuantas veces se quiera, sin costo ni penalización. El reto es
  escribir el programa, no memorizar.

**La figura se genera al azar** dentro de las restricciones del nivel, con una semilla. Esto elimina
la memorización y da rejugabilidad infinita, pero exige dos cuidados que son parte del diseño:

- Los números tienen que ser **adivinables**: longitudes en múltiplos de 20 sobre la cuadrícula
  visible, ángulos derivables (360/n o múltiplos de 15). Nunca `AVANZA 87`.
- La **primera aparición de cada concepto se escribe a mano**, no se genera. Una lección necesita
  autoría; el azar entra en los niveles de práctica que vienen después.

## Comparar lo de Kiro con lo del jugador

Tres formas, de menor a mayor detalle:

1. **Lado a lado.** Dos lienzos con la misma cuadrícula: la figura de Kiro y la del jugador.
2. **Superposición.** Un botón funde los dos lienzos y muestra el diff visual (ver más abajo).
3. **Reproducción en paralelo.** Se ejecutan la demostración de Kiro y el programa del jugador al
   mismo tiempo, paso a paso, con dos tortugas avanzando juntas. El juego marca **el paso exacto en
   que se separaron** y Kiro lo señala: *"aquí las dos íbamos igual; en este giro yo doblé 72 grados
   y tú 90."*

La reproducción en paralelo es la herramienta de depuración más potente del juego, y solo existe
porque el reto es un programa y no una imagen. Compara en el tiempo, no solo en el espacio.

## Principio pedagógico central

Cualquier figura se puede dibujar por fuerza bruta repitiendo `AVANZA` y `GIRADERECHA` a mano. Si el
juego solo validara el resultado visual, el jugador nunca aprendería a abstraer.

Por eso cada nivel se califica con **tres estrellas independientes**:

| Estrella | Se gana cuando | Enseña |
|---|---|---|
| **Precisión** | la estela coincide con la figura de Kiro | resolver el problema |
| **Economía** | se resolvió con tantas instrucciones como el programa de Kiro, o menos | usar `REPITE` y procedimientos |
| **Abstracción** | se usó la herramienta que el nivel quiere enseñar | nombrar y generalizar |

El presupuesto no es un número inventado: es el conteo del programa que Kiro acaba de ejecutar en
pantalla. La meta es explicable en una frase, *"hazlo en lo mismo que yo o en menos"*, y eso la vuelve
justa.

Desde el mundo 3 hay además un **límite duro** un poco por encima de ese conteo: un programa que lo
excede no se ejecuta. Un rosetón de 36 cuadrados es imposible sin `REPITE` anidado, y ahí ocurre el
clic mental.

## Insignias por concepto

El progreso se lee como un mapa de habilidades, no como una barra. Las insignias premian conceptos
dominados, no niveles terminados.

**De concepto** (una por mundo, se gana al completar el mundo con las tres estrellas):

- **Secuencia** — mundo 0
- **Iteración** — mundo 1
- **Descomposición** — mundo 2
- **Simetría** — mundo 3
- **Generalización** — mundo 4
- **Recursión** — mundo 5
- **Arquitecto** — mundo bonus

**Transversales:**

- **Depurador** — resolver 5 niveles después de haber usado la reproducción en paralelo
- **Minimalista** — estrella de economía en 10 niveles
- **Sin pistas** — completar un mundo entero sin abrir ninguna pista
- **Buen ojo** — resolver un nivel viendo la demostración una sola vez
- **Explorador** — guardar 5 creaciones propias en el modo libre

## Retroalimentación

El ciclo corto de prueba y error es lo que hace que Logo enseñe. Depende casi por completo de la
calidad del feedback:

- **Errores descriptivos**, al estilo del Logo original: `No sé cómo hacer AVANSA` en lugar de
  "syntax error". `AVANZA necesita un número` en lugar de "missing argument".
- **Ejecución paso a paso** con control de velocidad y resaltado de la línea en curso.
- **Ver de nuevo la demostración**, siempre disponible y sin costo. Con control de velocidad, para
  poder contar los tramos con calma.
- **Diff visual al fallar**: verde lo que coincide, rojo lo que sobra, gris punteado lo que falta.
- **Reproducción en paralelo** para encontrar el paso donde el programa se desvió.
- **Pistas en tres escalones**, nunca la respuesta directa:
  1. conceptual — "¿cuántos lados iguales tiene esta figura?"
  2. matemática — "la tortuga da una vuelta completa: 360 grados repartidos entre los lados"
  3. esqueleto de código con huecos
- **Otro reto igual**: un botón genera una figura nueva del mismo nivel con otra semilla. Sirve para
  quien se atoró con un caso particular, y para quien quiere practicar más del mismo concepto.
- **Semilla visible y compartible.** Cada reto tiene un código corto que lo reproduce exacto. Sirve
  para pedir ayuda, para retar a alguien más y para reportar errores.
- **Modo libre** (sandbox) siempre accesible, con galería para guardar creaciones. Suele ser donde
  nace la motivación real.

## Nombre

El producto se llama **KiroLogo**. En todo lo que sea identificador técnico se escribe en minúsculas y
sin separadores: `kirologo`.

- Nombre del paquete en `package.json`: `kirologo`
- Nombre del repositorio: `kirologo`
- En texto visible al jugador y en documentación: `KiroLogo`

El directorio local de trabajo puede llamarse distinto; no es parte del nombre del proyecto.

## Licencia

**MIT**, con el archivo `LICENSE` en la raíz. El campo `license` de `package.json` debe decir `MIT`.

Consecuencia práctica: todo lo que entre al repositorio tiene que ser redistribuible bajo MIT. En
particular, el mundo bonus se inspira en la **geometría** de los diagramas de arquitectura de AWS,
pero no incluye iconos, logotipos ni activos de marca de AWS. Las figuras se construyen solo con el
vocabulario del juego.

Lo mismo aplica a las dependencias: nada con licencia restrictiva o incompatible.

## Fuera de alcance (por ahora)

- Multijugador y tablas de clasificación.
- Cuentas en servidor. El progreso vive en el navegador.
- Edición colaborativa.
