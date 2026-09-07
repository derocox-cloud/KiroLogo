# Bitácora: cómo se concibió KiroLogo

Este documento cuenta el camino, no el resultado. El resultado está en `.kiro/steering/`, que es la
fuente de verdad de las reglas del proyecto. Lo que hay aquí es **por qué esas reglas son esas**, qué
se descartó, y qué decisiones cambiaron de forma sobre la marcha.

Se escribe porque un steering explica lo que hay que hacer, pero no conserva el razonamiento. Y el
razonamiento es lo que hace falta el día que alguien quiera cambiar una de esas reglas.

Sesión de concepción: 6 de septiembre de 2026.

---

## El punto de partida

La idea inicial: un juego basado en el pseudo-lenguaje Logo, donde instrucciones sencillas mueven una
tortuga. El jugador ve una figura geométrica y tiene que reproducirla. El objetivo es que una persona
adquiera nociones de pensamiento algorítmico y programático.

Como referencia, el artículo del MIT Media Lab sobre el lenguaje Logo, y las tablas de comandos de
MSW Logo con ejemplos de figuras: los polígonos con `REPEAT`, los rosetones con `REPEAT` anidado, los
operadores.

La progresión propuesta tenía tres escalones:

1. Figuras geométricas
2. Composición de figuras
3. Repeticiones del nivel 2

Y una idea de identidad: reemplazar la tortuga por el fantasma de Kiro.

Esos tres escalones sobrevivieron intactos hasta el final. Son los mundos 1, 2 y 3.

---

## Decisión 1 · Las tres estrellas, porque la fuerza bruta siempre existe

**El problema.** Cualquier figura se puede dibujar repitiendo `AVANZA` y `GIRADERECHA` a mano. Un juego
que solo valide el resultado visual enseña a dibujar, no a programar. El jugador puede terminarlo
completo sin haber abstraído nada.

**La decisión.** Cada nivel se califica con tres estrellas independientes: **precisión** (la figura
coincide), **economía** (se resolvió dentro del presupuesto de instrucciones) y **abstracción** (se usó
la herramienta que el nivel quiere enseñar).

**La consecuencia.** El presupuesto de instrucciones se vuelve el instrumento pedagógico central del
juego, no un adorno de puntaje. Y desde el mundo 3 se convierte en un límite duro: un rosetón de 36
cuadrados es imposible sin `REPITE` anidado, y ahí ocurre el clic mental.

Esta decisión condicionó todo lo demás. Es la razón por la que el conteo de instrucciones tiene una
regla explícita y vive en un solo módulo del código.

---

## Decisión 2 · Todo en español, sin alias en inglés

**El contexto.** El juego va dirigido a la comunidad de AWS en español en LATAM.

**La decisión.** Comandos, mensajes de error, interfaz y documentación, todo en español. Se adopta el
vocabulario del Logo en español clásico (`AVANZA`, `GIRADERECHA`, `BORRAPANTALLA`), que quien vio Logo
en la escuela en LATAM reconoce, con abreviaturas para cada comando.

Sin alias en inglés. Si alguien escribe `FD`, el error lo dice y sugiere `AVANZA`.

**Las consecuencias que no eran obvias.** Tolerancia a acentos y mayúsculas, porque nadie debería
perder un nivel por escribir `GIRADERECHÁ`. Aceptar coma y punto como separador decimal. Y un catálogo
de mensajes de error en español con la forma descriptiva del Logo original: `No sé cómo hacer AVANSA`
en lugar de "syntax error".

---

## Decisión 3 · Kiro monta la tortuga, no la reemplaza

**El cambio.** La idea inicial era sustituir la tortuga por el fantasma de Kiro. Se cambió a que Kiro
vaya **montado sobre el caparazón**: él recibe las instrucciones y se las pasa a la tortuga, que las
ejecuta al pie de la letra.

**Por qué importa mucho más de lo que parece.** Hace explícita la separación entre quien escribe, quien
interpreta y quien ejecuta. El jugador escribe el programa, Kiro lo interpreta y habla, la tortuga
obedece y nunca habla.

Eso instala la lección más difícil de programar: **la tortuga hace exactamente lo que dijiste, no lo
que querías decir.** Cuando el dibujo sale torcido, la culpa no es del jugador ni de "la computadora":
la instrucción decía otra cosa.

**Lo que se derivó de la metáfora.** Kiro es el único que habla, así que es el tutor con voz. En modo
paso a paso se **baja** del caparazón y señala la línea que se ejecuta, separando "leer la instrucción"
de "ejecutar el movimiento". `SUBELAPIZ` se anima como Kiro levantando físicamente el lápiz, así que el
cambio de estado nunca es invisible. Y Kiro se inclina hacia donde viene el próximo giro, como
anticipación.

Ninguna de esas cuatro cosas estaba en la idea original. Salieron todas de mover a Kiro de reemplazo a
jinete.

---

## Decisión 4 · Insignias por concepto y un mundo bonus de arquitectura

Para conectar el juego con su audiencia se propusieron dos cosas, y las dos entraron:

**Insignias por concepto** en lugar de solo estrellas por nivel. El progreso se lee como un mapa de
habilidades: secuencia, iteración, descomposición, simetría, generalización, recursión. Más cuatro
transversales que premian la forma de jugar, no el avance.

**Un mundo bonus** donde las figuras objetivo son los iconos de arquitectura de AWS reducidos a su
geometría: el cubo isométrico, el hexágono, el marco de una VPC con subredes. Cierra el círculo entre
"aprendí a componer figuras" y "así se dibuja un diagrama de arquitectura", que es lo que esa comunidad
hace todos los días.

Se decidió que fuera **el último contenido desbloqueable**, para quien llegue hasta el final.

---

## Decisión 5 · El reto es una demostración en vivo, no una imagen

Este fue el cambio más grande de la sesión, y llegó cuando el concepto ya parecía cerrado.

**El cambio.** No hay imágenes objetivo en el juego. Al entrar a un nivel, Kiro y la tortuga **dibujan
la figura en vivo** frente al jugador, generada al azar dentro de las restricciones del nivel.

**El problema que resolvió, y que el diseño anterior tenía escondido.** Con una imagen estática, el
jugador tiene que adivinar las longitudes. Con una demostración se ve el punto de partida, el rumbo
inicial, cada tramo y cada giro. Y enseña algo que una silueta no puede: que una figura es un
**proceso**, no un resultado.

**La cascada de consecuencias.** Esta decisión reescribió la mitad del steering:

- **El reto pasa a ser un programa de referencia**, ejecutado dos veces con el mismo intérprete: una
  para la demostración, otra para extraer los segmentos que se validan. Lo que el jugador vio dibujar
  es literalmente lo que se evalúa, y no hay forma de que se desincronicen.
- **Los generadores producen AST, no imágenes.** De ahí sale todo gratis: el reto es resoluble por
  construcción, el presupuesto se calcula solo, y la figura no puede ser imposible.
- **Los presupuestos dejaron de escribirse a mano.** Antes había siete niveles con el número marcado
  como pendiente; desaparecieron. Ahora hay dos valores derivados del conteo de la referencia:
  `presupuestoEstrella` y `limiteDuro`.
- **La cuadrícula de 20 px se volvió parte del contrato.** Los generadores solo emiten longitudes
  múltiplos de 20, y el jugador cuenta los cuadros en lugar de adivinar. Es lo único que hace justo
  exigir la escala exacta.
- **Semillas deterministas** con un PRNG propio, nunca `Math.random`. Cada reto se identifica con
  `(idNivel, semilla)`, así que se puede repetir, compartir con un código corto y reportar de forma
  reproducible.
- **La normalización fija desde el mundo 3 se volvió razonable.** Exigir posición y rumbo exactos era
  injusto con una imagen estática; con una demostración que muestra dónde empieza la tortuga, no.

**Los dos riesgos que trajo, y cómo se cubrieron.** Si el generador produce `AVANZA 87`, nadie lo saca
de mirar: de ahí la regla de los múltiplos de 20 y los ángulos derivables. Y los momentos de enseñanza
no se pueden azarizar: de ahí la distinción entre niveles **autorados** (primera aparición de cada
concepto, escritos a mano) y **generados** (la práctica que viene después).

**Lo que se ganó de regalo.** La comparación más útil no es espacial sino temporal, y solo es posible
si el objetivo es un programa: la **reproducción en paralelo**. Las dos ejecuciones corren al mismo
tiempo, con dos tortugas sobre la misma cuadrícula, y el juego marca el primer paso donde se separan
comparando operaciones de la tortuga, no líneas de código. Kiro lo señala: *"hasta aquí íbamos igual;
en este giro yo doblé 72 grados y tú 90."*

Funciona aunque los dos programas estén escritos de forma completamente distinta. Es la herramienta de
depuración más potente del juego y no existía en el diseño anterior.

---

## Decisión 6 · El `limiteDuro` tiene margen

Un detalle chico con razonamiento propio. El presupuesto exacto de la referencia (`presupuestoEstrella`)
es lo que hay que igualar para ganar la estrella de economía. Pero bloquear la **ejecución** en ese
número exacto castigaría al jugador que ya entendió la idea y solo escribió un rodeo.

Por eso el `limiteDuro` es el presupuesto más un margen. El programa con rodeo corre y se ve en
pantalla; la estrella sigue exigiendo el conteo canónico.

El margen quedó en 3 como estimación, y está marcado para calibrarlo con programas reales. Es el número
más delicado del juego: muy bajo frustra, muy alto vuelve la anidación opcional.

---

## Decisión 7 · Ocho specs, una por mundo

**La decisión.** El proyecto se aborda en ocho specs: una de cimientos y una por mundo. Los prompts de
creación de cada una viven en `docs/prompts/`.

**Cimientos no es un andamiaje vacío.** Es una rebanada vertical con un nivel jugable de punta a punta:
Kiro dibuja, el jugador escribe, el juego valida y da estrellas. Un andamiaje sin nada jugable no se
puede verificar, y los problemas del validador y de la animación aparecerían recién en la spec
siguiente.

**Cada mundo es también una rebanada vertical**: su vocabulario, sus generadores, sus niveles, su
insignia y las piezas de interfaz que ese concepto necesita. La reproducción en paralelo cae en el
mundo 1, no en cimientos, porque es donde los errores dejan de ser evidentes. El `limiteDuro` cae en el
mundo 3, cuando se vuelve obligatorio.

**La cadena no se paraleliza.** Cada mundo agrega vocabulario al lenguaje y niveles al catálogo.

**Los problemas se sembraron a propósito** en los prompts, para que no se descubran a mitad de la
implementación: `AZAR` es incompatible con una validación estable, `RELLENA` no encaja en un validador
que compara trazos, el margen del `limiteDuro` hay que calibrarlo, y el modo de bloques arrastrables
quedó declarado en el steering sin plan.

---

## Decisión 8 · Los personajes se dibujan por código

**La decisión.** La tortuga y Kiro se construyen con trazos de Canvas 2D. No hay imágenes, ni sprites,
ni SVG externos. El proyecto no tiene carpeta de activos gráficos.

**Por qué.** Los personajes no son decoración estática, son la interfaz que comunica el estado de la
ejecución: rumbo en cualquier ángulo, Kiro montado y desmontado, la inclinación hacia el próximo giro,
el lápiz arriba con la animación de levantarlo, ocultos, dos tortugas simultáneas, celebración. Cada
estado sería un archivo aparte, y las combinaciones se multiplican.

**Lo que se resolvió de paso.** En la reproducción en paralelo, Kiro monta su propia tortuga y la del
jugador va sin jinete. Es la forma más directa de comunicar cuál recorrido es de quién sin usar el
color, que está reservado para el diff.

---

## Decisión 9 · El nombre, en dos pasos

Primero se fijó como `kirologo` en minúsculas, por costumbre de identificadores técnicos. Luego se
corrigió a **`KiroLogo`**: se ve más comercial y hace visible la alusión a los dos productos que lo
hacen posible, Kiro y Logo. Esa lectura se pierde escrito todo junto.

**La consecuencia técnica.** Se verificó en la práctica, no por deducción: npm 11 acepta mayúsculas en
`package.json` y `npm install` funciona sin quejas. La restricción está del lado del **registro** de
npm, que rechaza mayúsculas en paquetes nuevos al publicar. De ahí que `package.json` lleve
`"private": true`, que además es lo correcto: KiroLogo es una aplicación web, no una biblioteca.

La mayúscula es del nombre del producto, no de las rutas. Los archivos siguen en `kebab-case`.

---

## Decisión 10 · Hosting en AWS Amplify, solo hosting

**La decisión.** AWS Amplify Hosting sirviendo los archivos estáticos de `vite build`.

**Lo que se dejó explícito.** No entra el backend de Amplify: ni Gen 2, ni Cognito, ni AppSync, ni
almacenamiento de datos. La regla de "sin backend" queda intacta y el progreso sigue en `localStorage`.
Sin esa aclaración, en dos meses alguien iba a proponer guardar el progreso en una base de datos "ya
que estamos en Amplify".

**El detalle que suele morder.** El contenedor de compilación de Amplify trae su propia versión de Node
y no respeta el `.nvmrc` automáticamente. Hay que forzarla en `preBuild`. Sin eso, compila con un Node
distinto al local y el día que falle no habrá nada en el diff que lo explique.

**Un beneficio inesperado.** Se puede aplicar una CSP estricta sin `unsafe-eval`, precisamente porque el
intérprete se escribe a mano y el proyecto nunca usa `eval`. Esa regla se tomó por razones de diseño
del lenguaje y termina pagando en seguridad sin costo.

---

## Las tensiones que moldearon el diseño

Mirando el camino completo, casi todas las decisiones salieron de resolver una de estas cuatro
tensiones. Sirven como criterio para las decisiones que vengan.

**Fuerza bruta contra abstracción.** Siempre se puede dibujar a mano. De aquí salieron las tres
estrellas, los presupuestos calculados, el `limiteDuro` y las exigencias de abstracción por nivel.

**Azar contra autoría.** El azar da rejugabilidad y mata la memorización, pero una lección necesita que
alguien la haya pensado. De aquí salió la distinción entre niveles autorados y generados.

**Exigencia contra justicia.** Exigir escala exacta es correcto, pero solo si el jugador puede leer las
medidas. De aquí salieron la cuadrícula de 20 px, los ángulos derivables, la normalización libre en los
primeros mundos y el margen del `limiteDuro`.

**La retroalimentación es el verdadero motor.** Lo que hace que Logo enseñe es el ciclo corto de prueba
y error. De aquí salieron los mensajes de error descriptivos, el diff visual, la reproducción en
paralelo, las pistas en tres escalones y la regla de que negar una estrella siempre viene con una
explicación concreta.

---

## Lo que quedó abierto a propósito

Marcado en los prompts de las specs, no olvidado:

- **`AZAR` contra la validación.** Un programa que dibuja distinto cada vez no puede aprobar de forma
  estable. Se decide en la spec del mundo 4: o queda solo en modo libre, o se le fija la semilla del
  reto durante la validación.
- **`RELLENA` contra el validador.** El algoritmo compara trazos dilatados; un área rellena es otra
  clase de cosa. Se decide en la spec del mundo 2, y la spec del mundo bonus depende de esa decisión.
- **El margen del `limiteDuro`.** Estimado en 3, a calibrar con programas reales.
- **Los rangos de los generadores.** Todos son estimaciones sin verificar. Por eso la prueba de las 200
  semillas es obligatoria: es la que va a mostrar qué rangos producen basura.
- **El modo de bloques arrastrables.** Declarado en el steering como requisito de accesibilidad y nunca
  planificado. La spec del mundo bonus pregunta si entra, se separa o se retira.
- **TypeScript 7.** Es el port nativo del compilador y el ecosistema alrededor puede no estar igual de
  maduro. La spec de cimientos decide si se fija 7 o la última 5.x.

---

## Estado al cierre de la sesión

**Escrito y versionado.** Seis archivos de steering, un plan de ocho specs con su prompt de creación,
la licencia MIT y esta bitácora.

**Entorno resuelto.** La máquina tenía Node 12.16.3, en fin de soporte desde abril de 2022, y un npm
que no arrancaba porque era de una generación posterior al Node que lo ejecutaba. Se instaló `fnm` y
Node 24.20.0, con `.nvmrc` en el repositorio y activación automática al entrar al directorio.

**Ningún código de aplicación todavía.** Eso arranca con la spec de cimientos.

| Confirmación | Qué fijó |
|---|---|
| `cae1bfd` | Concepto, steering y plan de specs |
| `d191dd1` | Nombre del proyecto y entorno de Node 24 |
| `1594c27` | Personajes dibujados por código |
| `388c581` | Corrección del nombre a KiroLogo |
| `9565cbd` | AWS Amplify Hosting como destino |

---

## Nota de referencia

El concepto se apoya en [The Logo Programming Language, del MIT Media Lab y la Logo
Foundation](https://el.media.mit.edu/logo-foundation/what_is_logo/logo_programming.html), y en las
tablas de comandos y ejemplos de figuras de MSW Logo. Contenido parafraseado por cumplimiento de
licencia.

El mundo bonus se inspira en la **geometría** de los diagramas de arquitectura de AWS. No incluye
iconos, logotipos ni activos de marca de AWS: las figuras se construyen solo con el vocabulario del
juego.
