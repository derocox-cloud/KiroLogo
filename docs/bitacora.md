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


---

## Decisión 11 · Dos ajustes al cerrar la spec de cimientos

Al cablear `main.ts` y verificar el `build`, aparecieron dos cosas que no estaban previstas y que se
resolvieron sin salirse del contrato de la spec. Quedan anotadas porque las dos son deuda visible que una
spec futura puede querer revisar.

**El minificador.** El `vite.config.ts` pedía `terser`, pero `terser` no está entre las dependencias
fijadas del proyecto, y la regla de versiones fijas prohíbe agregar una nueva sin pensarlo. En vez de
instalarla, se cambió a `minify: 'oxc'`, el minificador integrado de esta versión de Vite (basada en
rolldown), que no necesita ninguna dependencia aparte. El `build` produce el mismo `dist` correcto —
`index.html` con referencias que empiezan con `/`, sin `.test.ts` ni imágenes— y no se tocó
`package.json` ni el archivo de bloqueo.

**El mapa de capas del lienzo.** El modelo `Lienzo` declara cuatro capas —fondo, referencia, jugador y
personajes—, pero el `index.html` de esta spec organiza la pantalla en **dos pilas visuales** (el lado de
la demostración de Kiro y el lado del jugador). Para conectarlos, `main.ts` crea **dos** instancias de
`Lienzo` y mapea a un contexto inerte las capas de fondo que todavía no tienen un `<canvas>` dedicado en
el HTML. El juego queda jugable de punta a punta —la referencia, la estela del jugador, los personajes, el
diff y la comparación se dibujan y todas las pruebas pasan, incluida la de contraste—, pero la cuadrícula
por lado no se pinta en un canvas propio. Es el punto más flojo del cierre y el primer candidato a limpiar
cuando una spec de interfaz retome la pantalla.

---

## Verificación manual del encuadre (spec 08 · diseño visual · tarea 9.2)

Esta nota queda **pendiente de confirmación en un navegador real**. No es un resultado aprobado: es el
registro honesto de qué comprueba la máquina y qué tiene que mirar una persona, con el procedimiento para
hacerlo.

**Por qué es manual y no una prueba automática.** El entorno de pruebas corre sobre jsdom, que modela el
DOM pero **no hace layout**: no calcula alturas reales, no reparte las columnas de la cuadrícula en píxeles
ni dispara desplazamiento. Por eso la forma de las reglas de `src/estilos/pantalla.css` —las tres columnas
de la escena, la `@media` de apilado y el orden de las piezas— sí se puede verificar leyendo el CSS como
texto, y eso es lo que hace `src/main.test.ts`. Pero el **encuadre pintado** —que no aparezca una barra de
desplazamiento, que el corrimiento vertical quede dentro de un límite de píxeles, que nada se recorte— solo
se observa cuando el documento se dibuja de verdad en una ventana con un tamaño concreto. Eso exige un
navegador y un par de ojos.

**Qué confirman ya las pruebas automáticas** (grupo «1.1–1.4 · pantalla.css define las tres columnas y el
apilado responsivo» en `src/main.test.ts`, que lee el CSS real):

- Que `.kl-escena` es una cuadrícula de **exactamente tres columnas** en la presentación ancha.
- Que existe la `@media (max-width: 720px)` y que dentro de ella la escena pasa a **una sola columna**.
- Que en ese apilado el **orden** es el exigido por el requisito 1.7: figura de Kiro (`order: 1`), programa
  (`order: 2`) y figura del jugador (`order: 3`).

Es decir: la **existencia y la forma** de las reglas, y el **orden del apilado**, quedan cubiertos por la
máquina. Lo que la máquina **no** puede afirmar es el comportamiento visual resultante: la presencia o
ausencia de scroll y los límites reales en píxeles.

**Qué falta confirmar a mano, por requisito:**

- **1.5 · a 1440 × 900:** la escena entra completa, **sin desplazamiento vertical ni horizontal**.
- **1.6 · a 1366 × 768:** se admite un **desplazamiento vertical de hasta 8 px**, y **ningún** desplazamiento
  horizontal.
- **1.7 · a menos de 720 px de ancho:** todo queda **apilado en una sola columna**, en orden —cabecera,
  figura de Kiro, programa, figura del jugador—, **sin recortes y sin desplazamiento horizontal**.

**Procedimiento para quien lo verifique** (reproducible, sin medir «a ojo»):

1. Compilar y servir la versión real: `npm run build` y luego `npx vite preview` (o servir el `dist`
   resultante). Conviene usar el `build`, no el servidor de desarrollo, para medir sobre los mismos activos
   que se despliegan.
2. Abrir las herramientas de desarrollo del navegador y fijar el viewport **exacto** a cada tamaño
   (1440 × 900, 1366 × 768 y un ancho menor de 720, por ejemplo 390 × 844). El modo de dispositivo con tamaño
   personalizado da el viewport exacto; conviene confirmarlo leyendo `window.innerWidth`/`innerHeight` en la
   consola, porque la barra de herramientas del propio navegador descuenta píxeles.
3. En cada tamaño, comprobar la ausencia o el límite de desplazamiento comparando `documentElement`:
   horizontal con `scrollWidth <= clientWidth`; vertical con `scrollHeight - clientHeight`, que a 1440 × 900
   debe ser 0 y a 1366 × 768 no debe pasar de 8.
4. A menos de 720 px, confirmar visualmente el orden del apilado (cabecera, figura de Kiro, programa, figura
   del jugador) y que ninguna pieza se recorta por los bordes.

Mientras esta verificación no se ejecute en un navegador y se anote su resultado aquí, **la tarea 9.2 queda
pendiente**: las reglas están y las prueba la máquina, pero el encuadre pintado todavía no se ha confirmado
a mano.

---

## Enmiendas, excepción y decisión al cerrar la spec 08 (diseño visual · tarea 11.1)

La spec 08 no inventó un diseño: formalizó como requisitos verificables el diseño visual que ya vivía en
el repositorio y que el líder había aprobado. Al hacerlo salieron a la luz diez desvíos respecto de la
spec 00 (Cimientos). La regla del proyecto es que ninguna contradicción quede callada: cada desvío se
cierra de forma explícita como **enmienda** (se cita el criterio de la spec 00 y la spec 08 pasa a
prevalecer), **corrección** (se cambia el diseño para cumplir el criterio) o **excepción** (se admite el
desvío con su justificación). Esta nota registra, con su porqué, las ocho enmiendas que tocan conducta
visible, la excepción temporal al steering y la decisión de producto D11.

### Las enmiendas a la spec 00, con su porqué

**00·13.3 — no se dibuja la marca de rumbo.** El Tema fija `--marca-rumbo-mostrar: no` y los Personajes
no dibujan ninguna flecha de rumbo. El porqué es que la cabeza de la tortuga ya apunta hacia el rumbo
actual: una marca extra sería redundante y recargaría el personaje sin agregar información. La spec 00
pedía la marca; la 08 la retira y pasa a prevalecer.

**00·13.5 — el lápiz solo se dibuja cuando está levantado.** Los Personajes dibujan el lápiz únicamente
en su posición levantada cuando `--lapiz-mostrar: arriba`; con cualquier otro valor, o sin valor, lo
dibujan en sus dos posiciones. El porqué es que con el lápiz abajo la estela que va quedando ya comunica
que la tortuga escribe; lo que necesita hacerse visible es el **acto de levantarlo** (`SUBELAPIZ`), el
cambio de estado que de otro modo sería invisible. Dibujar el lápiz abajo de forma permanente no aporta
y estorba a la lectura del trazo.

**00·13.6 — escala 2,4 del conjunto de personajes.** El conjunto tortuga + Kiro + lápiz se dibuja a
escala 2,4 respecto del círculo de 40 unidades que declaraba 00·13.6. El porqué es puramente de lectura:
a tamaño natural la tortuga quedaría de unos 13 px en el Lienzo y no se leería como personaje, que es su
función —comunicar el estado de la ejecución, no decorar. Fijar la escala también resolvió el riesgo de
solapamiento del que hablan las dos enmiendas siguientes.

**00·14.8 y 00·24.7 — al terminar o detener, vuelta al Estado inicial.** Cuando una ejecución termina, o
si el jugador la detiene, el Juego devuelve la tortuga al Estado inicial del Nivel conservando intacta la
estela ya dibujada. La spec 00 dejaba la tortuga donde cayera el último trazo. El porqué de la enmienda
es que el Estado inicial es el punto de referencia estable para volver a intentar, y dejar el personaje
sobre la punta del último trazo lo taparía. En el Nivel 0.1, cuya figura es un tramo abierto que termina
lejos del inicio, la silueta en reposo no se solapa con el extremo final del trazo: el solapamiento se
evitó precisamente al fijar la escala del conjunto (la enmienda 00·13.6). En las figuras cerradas, como
el cuadrado del Nivel 0.4, el trazo termina en el punto de partida y la tortuga descansa ahí mismo, de
modo que la garantía de no solapamiento se limita, con honestidad, al Nivel 0.1.

**00·23.5 — la superposición dibuja en Posiciones reales.** La vista de superposición dibuja las dos
estelas en sus Posiciones reales del Lienzo, y el Diff colorea las tres regiones aplicando el veredicto
de presentación (`veredictoParaMostrar`), que elige entre las Posiciones reales y la Alineación del
Validador el que tenga **mayor coincidencia**. El porqué es que mostrar la figura del jugador en el lugar
exacto donde la dibujó es más honesto y más útil para depurar que mostrarla ya recolocada sobre la de
referencia. La garantía que sostiene la enmienda es que las **Estrellas salen siempre del veredicto
oficial** del Validador: el veredicto de presentación solo afecta cómo se pinta, nunca cómo se califica.

**00·26.2 — solo el ejemplo como texto visible permanente.** El Panel_Comandos muestra como texto visible
permanente únicamente el ejemplo de uso de cada comando; el nombre largo, la abreviatura y la descripción
se revelan al pasar el cursor o al enfocar el botón, y van completos, carácter por carácter, en el nombre
accesible. La spec 00 pedía mostrar también los tres como texto permanente. El porqué de la enmienda es
que la columna de comandos se recargaba con texto y el ejemplo es lo que más enseña de un vistazo; lo
demás sigue disponible al enfocar o al pasar el cursor, y nunca se pierde para un lector de pantalla
porque está íntegro en el nombre accesible.

**00·28.3 — contraste de controles acotado a lo que se identifica como control.** El contraste WCAG 3:1
se exige solo a los elementos interactivos que lo necesitan para identificarse como control, no a todo
borde y fondo de control. El porqué es que el diseño aprobado por el líder conserva el aspecto actual de
los controles —medido entre 1,07:1 y 2,07:1 frente a su fondo— y la enmienda ajusta la exigencia de la
spec 00 a los elementos donde el contraste cumple la función real de distinguir un control de su entorno.
El texto visible sigue en 4.5:1 y el foco en 3:1, sin tocar.

**00·28.6 — foco con `:focus-visible`.** El indicador de foco se muestra según `:focus-visible`, el
comportamiento estándar del navegador, que ya venía en el Tema desde la spec 00. La spec 00 exigía
mostrarlo con independencia de si el foco llegó por teclado o por puntero. El porqué de la enmienda es
que `:focus-visible` es justamente el mecanismo pensado para esto: muestra el anillo cuando ayuda —al
navegar con teclado— y lo omite cuando el usuario hizo clic y no lo necesita, evitando el anillo
«pegajoso» que molesta con el ratón. No es una conducta nueva: es reconocer como correcta la que la base
ya traía.

### La excepción temporal al steering `tecnologia`

El steering `tecnologia` es tajante: el proyecto **no tiene carpeta de activos gráficos**; la tortuga y
Kiro se dibujan por código con Canvas 2D, sin imágenes, sprites ni SVG externos. Hoy hay dos excepciones
a esa regla: el **logo** de KiroLogo y la **mascota** del Globo_Kiro son imágenes de boceto en
`public/marca/` (`kirologo.png` y `mascota.png`). El logo entra como `<img ... alt="KiroLogo">` en
`index.html`; la mascota entra como imagen de **fondo CSS** en `.kl-globo::before` de `pantalla.css`.

Esto es una **excepción temporal**, no un cambio del steering. Son bocetos que, en un inicio, se
dejaron fuera del control de versiones; a partir de esta integración **se versionan** en
`public/marca/` (antes estaban por error en `src/public/marca/`, donde Vite no los sirve, por lo que
el sitio desplegado daba 404 en `/marca/kirologo.png` y `/marca/mascota.png`). Se mueven a la carpeta
`public/` de la raíz, que es la que Vite publica, y se versionan para que el despliegue en Amplify los
incluya. La regla de «personajes por código» sigue vigente para todo lo demás. Se deja dicho su
carácter temporal precisamente para que no se normalice: en cuanto el líder resuelva, o bien la marca
pasa a dibujarse por código como el resto, o bien se abre una spec que modifique el steering de forma
explícita. Mientras tanto, el requisito exige que el
nombre accesible del logo («KiroLogo», en el `alt`) quede disponible aunque la imagen no cargue, para que
la excepción no degrade la accesibilidad.

### Decisión D11 · una sola paleta Kiro

Se adopta una **única paleta**, la paleta Kiro. Se descartó la segunda paleta (Océano) y, con ella, el
Selector_Paleta y la segunda clave de `localStorage`; desaparece además la enmienda de 00·27.8 que esa
segunda clave había motivado. El porqué es de alcance y de producto: una sola paleta, pensada para jugar
muchas horas sin cansar la vista, es suficiente, y mantener dos multiplicaba el trabajo de contraste y de
pruebas sin un beneficio claro para el jugador.

Hay que ser claro con un límite: **el retiro del código es trabajo aparte y las tareas de la spec 08 no
lo tocan.** Siguen en el repositorio, por ahora, `src/ui/selector-paleta.ts`, `src/estilos/paletas.css`
y la clave de `localStorage` `kirologo.paleta`. Esta nota registra la **decisión**; la limpieza del
código se hará en su propio cambio, con su propio diff, para no mezclar el retiro de una función con la
formalización del diseño.

### La regla de no debilitamiento (requisito 9.5)

Todo lo anterior existe por una sola regla, que conviene dejar escrita aquí como cierre: **ninguna prueba
heredada de las specs 00 o 01 se debilita sin una enmienda registrada tanto en la spec como en esta
Bitácora.** Cada una de las ocho enmiendas de arriba deja su rastro en este documento y cita el criterio
de la spec 00 que modifica. Si mañana alguien afloja una prueba heredada sin ese doble registro —en la
spec y en la Bitácora, identificando la prueba afectada—, la Suite_Pruebas debe tratar ese cambio como no
válido. La Bitácora no es un adorno: es la mitad del contrato que permite que una prueba heredada cambie
sin que el cambio sea un olvido silencioso.

---

## Las pruebas del diseño visual y por qué (spec 08 · diseño visual · tarea 12.1)

La spec 08 no construyó funcionalidad: formalizó como requisitos verificables el diseño visual que ya
vivía en el repositorio. Por eso su trabajo de pruebas es de **verificación** y **conciliación**, no de
cobertura nueva. Esta nota reúne, en un solo lugar, las pruebas que la spec reescribió o añadió, con el
motivo de cada una, y deja escrito el límite honesto de todo este aparato: **que las pruebas pasen no es,
por sí solo, prueba de cumplimiento.**

### La lista de pruebas, con su motivo

**Prueba del Tema — dentro de `src/main.test.ts`, no en un archivo propio.** Las adiciones del Tema viven
en `src/main.test.ts` y no en un `src/estilos/tema.test.ts`, porque la regla «21.3 · estructura de
archivos» de ese mismo archivo exige que cada `.test.ts` tenga un módulo `.ts` homónimo, y no existe
`src/estilos/tema.ts`. Crear `tema.test.ts` habría roto esa regla heredada, así que las pruebas nuevas se
suman al grupo transversal del tema que ya estaba ahí. Lo añadido:

- **Las 19 fichas y «ninguna derivada con color literal».** La prueba lee `src/estilos/tema.css` como
  texto, confirma que el primer bloque declara exactamente las 19 fichas de la paleta Kiro y verifica que
  ninguna variable derivada lleva un color literal (hex, `rgb`/`rgba`, `hsl`/`hsla` o nombre CSS): solo
  `var()` a una ficha o una mezcla `color-mix` de fichas. Conoce y respeta dos conjuntos de excepciones
  deliberadas: las variables de sufijo `-reserva` y las ocho de la mascota y el lápiz, que son literales a
  propósito porque la tortuga y el lápiz conservan su color en toda paleta. *Motivo:* el Tema es la única
  fuente de verdad del color (requisito 2.1); la prueba lee el CSS real para que una derivada no pueda
  colar un color a mano.
- **Los huecos de contraste WCAG de 8.3/8.4.** Reutilizando el cálculo WCAG 2.1 que `src/main.test.ts` ya
  tenía (luminancia relativa y razón `(L1 + 0.05) / (L2 + 0.05)`), se confirmó el contraste de las tres
  regiones del Diff y del conjunto tortuga + Kiro frente al fondo del Lienzo ≥ 3:1, sin duplicar los pares
  que el grupo «21.4 · accesibilidad WCAG del tema» ya verificaba (texto principal y secundario ≥ 4.5:1,
  las dos estelas ≥ 3:1, el contorno de la tortuga ≥ 3:1 y el indicador de foco ≥ 3:1). *Motivo:*
  requisitos 2.3, 8.1, 8.3 y 8.4; el contraste se calcula sobre los colores reales del tema, no sobre una
  copia.
- **Las variables `*-reserva` coinciden con la paleta.** La prueba descubre por sí sola las reservas de
  color recorriendo las declaraciones del tema y comprueba que cada `*-reserva` resuelve al mismo color que
  su ficha equivalente de la paleta Kiro. *Motivo:* requisito 2.1; si la reserva y la paleta se
  desincronizan en silencio, el día que falte la variable principal el jugador vería un color distinto al
  diseñado.

**Prueba de literales de color — artefacto nuevo (`src/sin-colores-literales.ts` y su prueba).** Recorre
todos los módulos `.ts` de `src/motor/` y `src/ui/` (excluyendo los `.test.ts`) y falla si alguno escribe
un color como literal: hex de 3/4/6/8 dígitos, `rgb`/`rgba`, `hsl`/`hsla` o un nombre CSS en posición de
color. Al fallar identifica archivo, línea, columna y literal, y no toca el módulo. Excluye a propósito
`src/main.ts`, que mantiene los valores de reserva del lector de tema y las constantes de presentación. El
detector distingue un color dentro de una cadena de la misma palabra en un comentario o embebida en una
frase (no confunde «la red» con `red`). *Motivo:* requisitos 9.1 y 9.2; generaliza a los dos directorios
la comprobación que `personajes.test.ts` ya hacía solo para `personajes.ts`, garantizando que todo color
salga del Tema.

**Verificación del documento servido — `src/main.test.ts`, grupo «6.4».** Lee el `index.html` real y falla
si declara enlaces o preconexiones a un origen de fuentes distinto del propio (`fonts.googleapis.com`,
`fonts.gstatic.com` u otro host externo). *Motivo:* requisito 6.4 (cero solicitudes a otro origen de
fuentes), que cierra el desvío 00·27.8. Se escribió primero para **fallar** con el estado de entonces —dos
`preconnect` y un `stylesheet` a Google Fonts— y confirmar que la verificación detecta el incumplimiento;
tras el autoalojado de fuentes de la tarea 8.3 (paquetes Fontsource con licencia OFL, empaquetados por
Vite desde el propio origen), la misma prueba **pasa**.

**Pruebas de estructura — `src/main.test.ts`, grupo «1.1–1.4 · tres columnas y apilado».** Leen
`pantalla.css` como texto y confirman que `.kl-escena` es una cuadrícula de exactamente tres columnas, que
existe la `@media (max-width: 720px)` que apila a una sola columna, y que el apilado respeta el orden
exigido (figura de Kiro, programa, figura del jugador). Se apoyan en las pruebas de estructura de archivos
que ya comprobaban la región `aria-live` única, las ranuras y los `id` de los lienzos, y añaden la caída a
`#aplicacion` cuando una pieza no encuentra su ranura: no se omite ni interrumpe el montaje de las demás.
*Motivo:* requisitos 1.1–1.4 y 1.8; la forma y el orden de las reglas sí se pueden verificar leyendo el CSS.

**Propiedades 1 y 2 — opcionales, aún sin implementar.** Las tareas 4.2 y 4.3 están marcadas como
opcionales (`[ ]*`) en `tasks.md` y, con honestidad, **todavía no se han escrito**. Quedan descritas para
quien las retome:

- **Property 1 · el veredicto de presentación nunca empeora la coincidencia** (validaría los requisitos 4.3
  y 4.5). El invariante: para toda figura del jugador y de referencia, la coincidencia (IoU) de
  `veredictoParaMostrar` es mayor o igual que la del veredicto oficial, y las Estrellas no cambian, porque
  la calificación sale siempre del veredicto oficial. Es la garantía formal de la enmienda 00·23.5: la
  superposición puede dibujar en la alineación más favorable, pero nunca califica con ella.
- **Property 2 · idempotencia del repintado ante el mismo tema** (validaría el requisito 2.2). El
  invariante: repintar dos veces con los mismos valores del Tema produce el mismo dibujo, porque color y
  grosor son función de las fichas leídas por `getComputedStyle`, no de estado acumulado.

Ambas se pensaron con fast-check 4.9.0, mínimo 100 iteraciones, etiquetadas `Feature: 08-diseno-visual,
Property N`. Mientras no existan, el invariante que cubrirían queda sostenido solo por las pruebas de
ejemplo y por esta nota, no por una comprobación sobre muchas entradas.

**No debilitamiento e integración de mundos — documentales, sin prueba automática.** Las tareas 10.1 y 10.2
son opcionales y documentales: registran reglas en esta Bitácora en lugar de crear pruebas. La regla de no
debilitamiento (ninguna prueba heredada de las specs 00 o 01 se afloja sin una enmienda registrada tanto en
la spec como en la Bitácora) ya quedó escrita en la nota de la tarea 11.1. La regla de integración de un
mundo nuevo —conservar identificador, orden y anidamiento de las ranuras existentes, y no agregar, eliminar
ni modificar declaraciones de `tema.css` ni reglas de `pantalla.css` ajenas a sus propias clases— se
registra aquí con el mismo carácter. *Motivo de que sean documentales y no automáticas:* una prueba que
intentara detectar «debilitamiento de pruebas heredadas» o «un mundo nuevo que toca el tema» bloquearía las
specs de los mundos 02–07, que legítimamente añaden vocabulario, niveles y sus propias clases. La regla es
un contrato de revisión, no un cerrojo de la Suite_Pruebas.

### «Que las pruebas pasen» no basta como prueba de cumplimiento

Conviene dejarlo escrito sin rodeos. Todo lo anterior corre sobre jsdom, que modela el DOM pero **no hace
layout**, no pinta, no calcula píxeles y no tiene ojos. Las pruebas confirman la **existencia y la forma**
de las reglas —que el tema declara las fichas, que ninguna derivada lleva un literal, que el CSS tiene tres
columnas y una `@media`, que `index.html` no pide fuentes a otro origen—, pero no confirman el **resultado
visual**. Una suite verde es condición necesaria, no suficiente. Queda a verificación manual, en un
navegador real y con una persona mirando:

- **El encuadre** (tarea 9.2). Que la escena entre completa a 1440 × 900 sin desplazamiento, con un margen
  de hasta 8 px en vertical a 1366 × 768 y sin desplazamiento horizontal, y que apile en orden a menos de
  720 px sin recortes. jsdom no lo puede afirmar; el procedimiento está en la nota de la tarea 9.2.
- **La lectura visual de los personajes.** Que la tortuga y Kiro se lean de un vistazo: hacia dónde mira la
  tortuga (el rumbo), si el lápiz está arriba o abajo, cuál tortuga lleva jinete en la reproducción en
  paralelo. La prueba confirma que los trazos se dibujan y que el tema puede quitarlos; que **se entiendan**
  es un juicio humano.
- **La calidad del foco pintado.** La prueba confirma que la regla de foco existe y que su color contrasta
  ≥ 3:1. Que el anillo de `:focus-visible` se **vea bien** —grosor, separación, que no quede cortado por un
  borde— solo se comprueba navegando con el teclado y mirando.

Esta separación no es una debilidad del diseño de pruebas: es su honestidad. La máquina verifica lo que se
puede leer en el texto del CSS y del HTML; la persona verifica lo que solo existe cuando el documento se
dibuja. Dar por cumplido un requisito visual porque «las pruebas pasan» sería confundir las dos cosas.

---

## La regla de no debilitamiento de pruebas heredadas (spec 08 · diseño visual · tarea 10.1)

Las notas de las tareas 11.1 y 12.1 ya mencionan esta regla de pasada, al cerrar las enmiendas y al listar
las pruebas. Esta nota la aísla y la deja escrita como regla permanente del proyecto, con el detalle que
las otras dos no alcanzaban a fijar: **cómo se identifica la prueba afectada en cada enmienda** y **por qué
es una regla documental y no una prueba automática.** Es el lugar al que remitir cuando una spec futura
—mundos 02 a 07— necesite aflojar algo que las specs 00 (Cimientos) o 01 (Mundo 0) dejaron fijado.

### La regla

Ninguna prueba heredada de las specs 00 o 01 se **debilita** sin una enmienda registrada **tanto en la spec
que la debilita como en esta Bitácora**. «Debilitar» cubre toda forma de bajar la exigencia de una prueba
existente, no solo borrarla:

- **eliminar** la prueba por completo;
- **relajar un umbral** (bajar un contraste exigido, ampliar una tolerancia geométrica, subir un
  presupuesto de instrucciones);
- **reducir iteraciones** de una prueba de propiedad (por ejemplo, pasar de 200 semillas a menos, o de las
  100 iteraciones mínimas de fast-check a menos);
- **quitar una aserción** de un caso que antes la tenía;
- **convertir en `skip`** (o en `todo`, o comentar) una prueba que antes corría.

Cualquiera de estas acciones sobre una prueba heredada de 00 o 01 exige el **doble registro**. Sin él, el
cambio debe tratarse como no válido en la revisión: una prueba heredada no se afloja por descuido ni en
silencio.

### Cómo se identifica la prueba afectada en cada enmienda

Para que el rastro sea rastreable y no una mención vaga, cada enmienda —en la spec y en la Bitácora— tiene
que señalar la prueba afectada por:

- **su archivo**, con la ruta exacta (por ejemplo `src/main.test.ts` o `src/motor/validador.test.ts`);
- **el nombre exacto del `describe`/`it`**, copiado carácter por carácter como aparece en el código, no
  parafraseado; y, **si aplica, el grupo numerado** al que pertenece (por ejemplo «21.4 · accesibilidad
  WCAG del tema» o «1.1–1.4 · tres columnas y apilado»), porque varias pruebas de este proyecto viven
  agrupadas bajo un mismo encabezado numerado dentro de un archivo grande;
- **qué criterio heredado cubría**, citando el requisito o el punto de la spec 00/01 que la prueba hacía
  cumplir (por ejemplo «00·13.3 · marca de rumbo»), de modo que se vea de un vistazo qué garantía se está
  modificando y contra qué se originó.

Con esos tres datos —archivo, nombre exacto del bloque y grupo, y criterio heredado— cualquiera que lea el
diff puede ir de la enmienda a la prueba concreta y de vuelta al requisito original. Ese ida y vuelta es lo
que convierte el cambio en revisable. Las ocho enmiendas registradas en la nota de la tarea 11.1 son el
modelo a seguir: cada una cita el criterio de la spec 00 que modifica y el porqué del cambio.

### Por qué es documental y no una prueba automática

La tentación es escribir una prueba que detecte el «debilitamiento» por su cuenta y lo bloquee. No se hace,
y la razón es de fondo: **una prueba automática no puede distinguir un debilitamiento legítimo y enmendado
de uno accidental.** Las dos cosas se ven igual desde el código —un umbral que baja, una aserción que
desaparece, una prueba que pasa a `skip`—; lo único que las separa es la **intención**, registrada en la
enmienda de la spec y en esta Bitácora. Eso es exactamente lo que un verificador automático no lee.

Una prueba así, además, haría daño activo: bloquearía de forma indebida las specs de los mundos 02 a 07,
que **legítimamente evolucionan** el catálogo y la interfaz —añaden vocabulario, niveles, generadores y sus
propias clases de CSS—, y que en el camino van a ajustar de forma válida pruebas heredadas con su enmienda
correspondiente. Un cerrojo automático no sabría que esos cambios vienen con su doble registro y los
frenaría a todos por igual.

Por eso la regla es un **contrato de revisión**, no un candado de la Suite_Pruebas: vive en la mirada de
quien revisa el diff, apoyada en la enmienda escrita, no en una aserción que no puede leer la intención.
Esta es, de paso, la misma lógica por la que la regla de integración de mundos nuevos (tarea 10.2) tampoco
se automatiza.

---

## La regla de integración de un mundo nuevo (spec 08 · diseño visual · tarea 10.2)

La nota de la tarea 12.1 enunció esta regla al pasar, en la lista de pruebas, y la nota de la tarea 10.1 la
nombró como su gemela documental. Esta nota la aísla y la deja escrita como regla permanente del proyecto,
porque es la que van a leer las specs de los mundos 02 a 07 y el mundo bonus cada vez que necesiten sumar
una pieza de interfaz o un color. El requisito 9 de la spec 08 —«Integración de los mundos futuros sin
tocar el tema»— la fija en dos criterios, 9.3 y 9.4; aquí quedan con su porqué.

### La regla

Cuando se integra un mundo nuevo, se hace **conservando la base intacta**. En concreto, dos compromisos:

- **(9.3) Las Ranuras de `index.html` no se tocan.** Una pieza de interfaz de un mundo nuevo se cuelga de
  su Ranura **por identificador**, conservando sin cambios el **identificador**, el **orden** y el
  **anidamiento** de las Ranuras que ya existen: `programa`, `ranura-comparacion`, `ranura-leyenda`,
  `ranura-reto`, `ranura-marcador`, `ranura-ruta` y `ranura-paleta`. Agregar un mundo es enganchar su DOM
  en la Ranura que le corresponde, nunca renombrar una Ranura, reordenarlas ni cambiar cómo anidan unas
  dentro de otras. Si una pieza no encuentra su Ranura, cae en el contenedor raíz `#aplicacion` sin omitirse
  ni interrumpir el montaje de las demás; esa caída es la red de seguridad, no una licencia para mover las
  Ranuras de sitio.
- **(9.4) El Tema y la Pantalla no se reescriben.** Integrar un mundo nuevo no agrega, elimina ni modifica
  ninguna declaración de `tema.css`, ni ninguna regla de `pantalla.css` **ajena a las clases propias de ese
  mundo**. Un mundo nuevo solo **añade sus propias clases**; el color de esas clases sale siempre del Tema
  —las 19 fichas de la paleta Kiro— **por variable**, nunca con un literal. Lo que un mundo puede hacer es
  crecer hacia afuera: sumar sus reglas y sus clases. Lo que no puede es entrar a editar las fichas del Tema
  ni las reglas de layout que comparten todos los mundos.

### El porqué

El Tema es la **única fuente de verdad del color** y la Pantalla es un **contrato estable** de layout. Esa
es toda la razón. Si cada mundo se permitiera reescribir una ficha del Tema «solo para su caso», o mover una
Ranura para que su pieza encajara mejor, dos cosas se romperían a la vez: la **coherencia visual** —seis
mundos tirando del mismo color en direcciones distintas dejan de verse como un solo juego— y la
**revisabilidad** —una enmienda al Tema hecha desde el mundo 4 afecta en silencio a los mundos 0 a 3, y
nadie que revise el diff del mundo 4 lo esperaría. Acotar cada mundo a sus propias clases y a colgar de las
Ranuras existentes es lo que permite que el catálogo y la interfaz **evolucionen sin desestabilizar la
base**: un mundo nuevo es siempre una suma, nunca una reescritura de lo compartido.

Es, además, lo que vuelve barata la integración. Añadir un mundo se parece a añadir un nivel, que el
steering ya define como «agregar un objeto a un arreglo»: datos y clases nuevas, no cirugía sobre lo que ya
funciona. Si integrar un mundo obligara a tocar el Tema o a reacomodar las Ranuras, sería la señal de que
falta una capacidad en la base, no de que el mundo tenga derecho a reescribirla.

### Por qué es documental y no una prueba automática

Por la misma lógica que la regla de no debilitamiento de la tarea 10.1, y conviene dejarlo escrito. Una
prueba que afirmara «un mundo nuevo no toca el tema ni la pantalla» tendría que ejecutarse contra código que
**todavía no existe**: las specs de los mundos 02 a 07 aún están por escribirse. Un cerrojo así bloquearía
de antemano a esos mundos, que **legítimamente** van a añadir sus propias clases a `pantalla.css` y a leer
las fichas del Tema por variable. La prueba no sabría distinguir una clase nueva y bien acotada —permitida—
de una modificación de una declaración compartida —prohibida—, porque ambas tocan los mismos archivos; lo
único que las separa es **a qué clases pertenece el cambio**, y eso es un juicio de revisión sobre el diff,
no una condición que una aserción pueda leer sin ambigüedad.

Por eso la regla es un **contrato de revisión del diff**, no un cerrojo de la Suite_Pruebas: se hace cumplir
leyendo qué toca cada mundo cuando llega, apoyándose en este registro, no con una prueba que frenaría por
igual a los mundos que respetan la regla y a los que no.

---

## Enmiendas y decisiones al cerrar la spec 09 (ajustes de interfaz · tarea 7.2)

La spec 09 no reabrió el diseño visual: hizo **tres ajustes acotados** sobre la pantalla que la spec 08
ya había formalizado como estado aprobado del repositorio. Pero cada uno de los tres toca una conducta
que una spec anterior había fijado, así que, por la misma regla de siempre —ninguna contradicción queda
callada—, cada desvío se cierra aquí de forma explícita: se cita el criterio anterior, se dice si queda
**enmendado** (el criterio anterior deja de ser cierto y la spec 09 prevalece sobre él) o **reemplazado**
(el estado que la spec 08 describía como «actual» queda sustituido por el comportamiento de esta spec), y
se explica el porqué. Las enmiendas de la spec 08 son el modelo: cada una con su criterio y su razón.

### Enmienda 00·26.2 y 00·26.4 — el atajo de movimiento ya no anticipa la cantidad

**Qué cambia.** El texto visible permanente del botón de un `Atajo_Movimiento` —`AVANZA`, `RETROCEDE`,
`GIRADERECHA`, `GIRAIZQUIERDA`— deja de ser el ejemplo con cantidad (`AVANZA 100`, `GIRADERECHA 90`…) y
pasa a ser **solo el nombre del comando**. Y al activar el botón, el `Panel_Comandos` deja de insertar el
`ejemplo` con su número: ahora inserta el nombre del comando seguido de un solo espacio, y deja el cursor
justo detrás de ese espacio para que el jugador escriba la cantidad. El ejemplo con cantidad no se pierde:
sigue en la descripción del comando y en el nombre accesible del botón.

**Cómo se hizo sin duplicar la fuente de verdad.** El cambio podría haberse resuelto con una lista aparte
de «qué inserta cada botón», pero eso habría creado una segunda fuente de verdad enfrentada al
Vocabulario. En vez de eso se añadió un campo nuevo, `insercion`, a cada entrada del Vocabulario, con una
regla derivada de los campos que ya existían: aridad 1 con argumento numérico → nombre más un espacio;
aridad 0 (`CENTRO`, `BORRAPANTALLA`) → nombre a secas, sin espacio final; cualquier otra entrada conserva
su `ejemplo` como inserción por ahora, a revisar en la spec de su propio mundo. El `Panel_Comandos`
inserta `insercion` y expone `data-insercion` en el botón; el CSS lo pinta con un `::before` que lee
`attr(data-insercion)`. Así el Vocabulario sigue siendo la única fuente de verdad de lo que un botón
escribe, igual que lo es de su nombre, su aridad y su error.

**El porqué, que es pedagógico.** Un botón que escribe `AVANZA 100` le está diciendo al jugador que la
cantidad es cosa del juego. La lección del mundo 0 es justo la contraria: la cantidad es una decisión del
jugador, y la tortuga avanza lo que uno le diga. Que el botón escriba `AVANZA ` y espere el número hace
visible esa decisión desde el primer nivel. Por eso la enmienda pide explícitamente que **ningún** botón
del mundo 0 muestre un dígito, y una prueba lo verifica sobre los seis.

La spec 00 pedía el ejemplo con cantidad como texto visible (00·26.2) y como lo que el botón inserta
(00·26.4). La spec 09 enmienda ambos criterios y pasa a prevalecer sobre ellos. El significado, la aridad
y los mensajes de error del comando no cambian: pulsar `AVANZA`, escribir `100` y ejecutar en el Nivel 0.1
otorga las tres estrellas igual que antes, y `AVANZA` sin número sigue dando el mismo error del catálogo
(`AVANZA necesita un número. Por ejemplo: AVANZA 100`).

### Enmienda 01·12 — de la fila de un solo mundo a un menú de los seis mundos

**Qué cambia.** La navegación de niveles de la cabecera dejaba ver solo los niveles del **mundo en curso**,
en una fila, sin forma de pasar a otro mundo: al completar el mundo 0, el jugador se quedaba sin salida.
Esa fila (el `Selector_Nivel`) se sustituye por un `Menu_Mundos`: los seis mundos de concepto (0 a 5), cada
uno como un desplegable en acordeón —a lo sumo uno abierto a la vez— que muestra sus niveles. Desde él se
puede abrir cualquier mundo desbloqueado y cargar cualquiera de sus niveles.

**Lo que se conserva y lo que no.** No cambia la regla de desbloqueo de la spec 01: el mundo *n* se abre al
aprobar con estrella de precisión todos los niveles del mundo *n-1*, y el menú lee esa disponibilidad del
`Desbloqueo`, no la reinventa. Tampoco cambia el cometido de cargar un nivel elegido, que era lo que hacía
el `Selector_Nivel` (01·12.2); solo se extiende a niveles de cualquier mundo. Lo que cambia es la
**presentación**: de una fila de un mundo a un menú de seis. Por eso 01·12 queda **enmendado**, no
reemplazado: el acto de elegir y cargar un nivel sigue, su alcance se amplía.

**Los cuidados que trajo el menú.** Para no gastar paradas de Tab contra el límite de 20 de 00·28.1, el
menú entero es **una sola parada de Tab** recorrida con las flechas (el mismo «roving tabindex» que ya usa
el `Panel_Comandos`): con el menú cerrado, una parada; abierto, dos. Se abre como **capa superpuesta** sobre
el contenido, de modo que abrir un mundo no agranda la cabecera ni empuja la escena, que sigue cabiendo a
1440 × 900 sin desplazamiento. Al entrar, queda abierto por defecto el mundo del nivel en curso. Un mundo
sin niveles en el catálogo se muestra como bloqueado con el texto «próximamente», sin niveles que elegir, de
modo que cuando el catálogo incorpore ese mundo el menú lo muestre sin tocar el código del menú. Y la
medalla de la insignia de concepto de un mundo ganado aparece en el encabezado de su desplegable, que es
donde recaló al desaparecer la fila de niveles.

### Reemplazo de elementos de la spec 08

La spec 08 ya anticipaba que estas cosas iban a cambiar: las había dejado descritas como «estado actual que
la spec 09 sustituye». Aquí queda escrito qué sustituye cada una.

- **08·1 — la ruta de niveles como estado actual.** La spec 08 describía la cabecera con una ruta de niveles
  de un solo mundo y la etiqueta «Mundo N · Nombre» con la medalla al final. Queda **reemplazada** por el
  `Menu_Mundos` de seis mundos desplegables descrito arriba. El mundo y el nivel en curso ya no se leen en
  una fila fija, sino en el botón de cabecera que abre el menú.
- **08·5.3 — el panel mostraba el ejemplo como texto visible permanente.** Queda **reemplazado**: el texto
  visible permanente del botón pasa a ser el campo `insercion` (para un atajo, el nombre del comando), no el
  ejemplo con cantidad. Es la cara de presentación de la misma enmienda 00·26.2/00·26.4.
- **08·5.5 y 08·5.7 — la presentación del `Panel_Comandos` que apoyaba mostrar el ejemplo.** Quedan
  **sustituidos** en lo que describían de ese estado anterior: el reparto del texto del botón donde el
  ejemplo era el trozo visible y lo demás se revelaba al enfocar deja de pintar el ejemplo como único trozo
  a la vista. El ejemplo sigue íntegro en el `textContent` y en el nombre accesible del botón —no se pierde
  para un lector de pantalla—, pero el trozo que se **ve** pasa a ser la `insercion`, mostrada por el
  `::before` del botón. La barra de herramientas conserva su única parada de Tab y el recorrido con las
  flechas, sin que la retirada de la cantidad cambie el foco ni el orden de tabulación.

### Decisión de color plano

**Qué se retira.** Se adopta color sólido en la presentación y se retiran los degradados y los resplandores
difuminados enumerados, uno por uno:

- el **halo del logo**, el `filter: drop-shadow` de `.kl-logo`;
- los **fondos del `body`**, los `radial-gradient` de color y la cuadrícula de puntos hecha con gradiente,
  que pasan a un color sólido;
- el **glow del botón del nivel en curso**, la parte con desenfoque del `box-shadow` del elemento «en
  curso» (que desaparece junto con las reglas `.kl-selector-*` al nacer el menú plano `.kl-menu-*`);
- el **degradado y el glow de la medalla** de la insignia: el `radial-gradient` dorado y la sombra
  difuminada de `.kl-insignia-medalla`, que pasa a dorado sólido;
- el **`linear-gradient` de la pluma** (`.kl-pluma`), que además era CSS sin uso en el HTML y se retira por
  completo con su animación.

En todos los casos se conserva el relieve de **Sombra_Dura** —el `box-shadow` con radio de desenfoque
cero—, la paleta Kiro sin tocar un solo valor de color, y el contraste.

**Las dos excepciones, documentadas a propósito.** No todo resplandor es decoración. Se **conservan**, y la
prueba estructural de color plano los admite nombrando selector y propiedad exactos:

- el `drop-shadow` de las **dos estelas del lienzo**, `.kl-capa-estela-referencia` y
  `.kl-capa-estela-jugador`;
- el `text-shadow` del icono de una **estrella otorgada**,
  `.kl-estrella[data-estado="otorgada"] .kl-estrella-icono`.

**El porqué.** Una pantalla sin halos ni degradados es una imagen limpia que no compite con la figura que
el jugador está dibujando, que es lo único que debería brillar. Por eso las dos excepciones son
precisamente las que comunican el resultado del juego: el trazo que quedó en el lienzo y la estrella que se
acaba de ganar. El resplandor ahí no decora, señala un logro; en el logo o en el fondo solo distraía. Y
para que la decisión no se erosione con el tiempo, una prueba estructural (`Prueba_Color_Plano`) lee el
texto real de `pantalla.css` y `tema.css` y falla si reaparece cualquiera de los efectos retirados,
admitiendo solo esas dos excepciones por su selector y propiedad exactos y la Sombra_Dura sin desenfoque.

---

## Spec 05 · Mundo 4 · Parámetros (tarea 14.4)

El mundo 4 es el primero donde el lenguaje deja de ser una lista de órdenes con números fijos y pasa a
tener **valores**: parámetros en `PARA`, aritmética, `AZAR`, `ESCRIBE` y `ROTULA`. Casi todo el
intérprete, el parser y el impresor era nuevo, así que las diez decisiones de abajo se tomaron en la fase
de requisitos, antes de escribir una línea. Cada una lleva su decisión, su razón y lo que se descartó. Se
numeran como «4·1» a «4·10» para no confundirlas con las decisiones 1 a 11 de la sesión de concepción.
Después van las resoluciones D1 a D21 del diseño, que son otra cosa: no cambian ninguna decisión, ajustan
los requisitos al código real.

### Decisión 4·1 · `AZAR` es determinista: se siembra con la semilla del reto

**La decisión.** Toda ejecución crea su PRNG con la semilla efectiva del reto. El mismo programa con el
mismo reto produce siempre las mismas operaciones.

**La razón.** Con un azar distinto en cada corrida, un programa con `AZAR` no podría aprobar un nivel de
forma estable, y la demostración, el paso a paso, la reproducción en paralelo y la validación verían
figuras distintas. Con la semilla, un reporte con el código del reto se reproduce al píxel, y repetir la
corrida no sirve para aprobar por suerte. Ningún programa de referencia usa `AZAR`: la figura que se
valida nunca depende de él.

**Descartado.** Limitar `AZAR` al modo libre: hoy no habría ningún consumidor, porque el modo libre aún no
existe. Dejarlo sin semilla fija: rompe la regla de «nada de `Math.random`» y la reproducibilidad.

### Decisión 4·2 · Se incluyen los paréntesis

**La decisión.** `(` y `)` agrupan, con `*` y `/` sobre `+` y `-`, asociatividad por la izquierda, menos
unario y un tope de anidación de 32.

**La razón.** Sin paréntesis, `360 / 2 + 1` y `360 / (2 + 1)` no se pueden distinguir ni escribir, y
`360 * 2 / :puntas` queda a merced de la precedencia. El tope evita que un texto con miles de paréntesis
desborde la pila del analizador.

**Descartado.** Aritmética sin paréntesis, que obligaría a rodeos con `SUMA` y `COCIENTE` para expresar
algo tan simple como un ángulo derivado.

### Decisión 4·3 · Ámbito léxico, parámetros por valor e inmutables

**La decisión.** Un procedimiento solo ve los parámetros de su propia cabecera. Cada llamada recibe copias
de los valores y no puede cambiarlos. No hay asignación. Un procedimiento que llama a otro no le presta
sus variables.

**La razón.** Es más predecible para quien aprende y permite detectar un `:parámetro` no declarado
**antes de ejecutar**. Además condiciona la recursión del mundo 5: cada llamada recursiva tiene sus
propios valores y ninguna observa los de otra, que es lo que hace comprensible `ESPIRAL :largo + 5`. El
steering lo dice con una frase: el mundo 5 hereda esas tres reglas para su recursión.

**Descartado.** El ámbito dinámico del Logo clásico, donde una llamada ve las variables de quien la llamó:
vuelve impredecible el efecto de renombrar un parámetro y solo se descubre un error al ejecutar. También
se descartó el paso por referencia, que exigiría asignación y con ella estado mutable que el juego todavía
no necesita.

### Decisión 4·4 · `ROTULA` y `ESCRIBE` no cuentan para la precisión geométrica

**La decisión.** El validador compara trazos. El texto no participa. `ROTULA` escribe aunque el lápiz
esté arriba, porque un rótulo no es un trazo. Ambos cuentan una instrucción en el presupuesto y un paso
de ejecución.

**La razón.** Comparar texto dependería de cómo cada navegador dibuja la tipografía, y los generadores
solo emiten tramos, así que no hay un texto de referencia que igualar. Rotular sin penalización es
coherente con «explorar nunca se castiga». Que cuenten en el presupuesto evita que sean instrucciones
gratis.

**Descartado.** Comparar rótulos contra una referencia, y que no cuenten en el presupuesto.

### Decisión 4·5 · La consola es un registro plegable, sin región `aria-live` propia

**La decisión.** `ESCRIBE` va a un elemento `role="log"` enfocable por teclado, plegado hasta la primera
línea de una ejecución. Al terminar, **un único** anuncio por `#anuncios` resume cuántas líneas se
escribieron y cuál fue la última. Su aparición no cambia el tamaño de los lienzos ni el alto del editor.

**La razón.** La interfaz ya tiene una sola región `aria-live` como único canal de anuncios. Una segunda
competiría con los anuncios de la tortuga y leería cada línea de un `REPITE 100 [ES 1]`.

**Descartado.** Una consola con su propia región viva, y un panel fijo siempre visible que le quitaría
espacio al lienzo.

### Decisión 4·6 · Conciliación del vocabulario: manda el steering, salvo en `SUMA` y `PRODUCTO`

**La decisión.** `AZAR` pasa a aridad 1 (resultado entre 0 y n-1), `ESCRIBE` acepta un valor, `ROTULA`
acepta texto o un valor numérico. `SUMA` y `PRODUCTO` quedan con exactamente dos argumentos, y se corrige
el steering que decía «dos o más».

**La razón.** Las firmas que tenía `vocabulario.ts` eran marcadores escritos antes de decidir la
semántica. Una aridad variable sin paréntesis es ambigua (`ES SUMA 1 2 3`) y los operadores `+` y `*` ya
cubren las sumas largas. El steering se versiona con el código, así que se corrige en la misma spec.

**Descartado.** Aridad variable en `SUMA` y `PRODUCTO`, y dejar `AZAR` con dos límites.

### Decisión 4·7 · Los comandos de operador producen valores y no son instrucciones

**La decisión.** `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE`, `RESTO` y `AZAR` son expresiones. Se distinguen
con un campo nuevo, `produceValor`, en la misma tabla del vocabulario. Escritos solos en una línea son un
error que explica qué hacer con el valor, al estilo del Logo clásico.

**La razón.** Así el lexer, el parser, el panel y las sugerencias siguen leyendo una sola tabla. Por eso
el ejemplo de cada operador en el panel es un programa válido por sí solo (`ESCRIBE SUMA 30 40`).

**Descartado.** Una lista de operadores aparte del vocabulario, que sería una segunda fuente de verdad, y
tratar `SUMA 1 2` suelto como instrucción que descarta su resultado en silencio.

### Decisión 4·8 · Una expresión es parte de la instrucción que la contiene

**La decisión.** Las expresiones aritméticas, las referencias a parámetros y los comandos de operador
cuentan 0. `AVANZA 100`, `AVANZA 50 + 50` y `AVANZA SUMA 50 50` cuestan 1. `ESCRIBE` y `ROTULA` cuestan 1.

**La razón.** El jugador no debe ser empujado a elegir una forma de escribir por su costo. La regla
confirma lo que `conteo.ts` ya hacía con los nodos de expresión y la extiende a los nuevos, sin crear una
segunda implementación del presupuesto.

**Descartado.** Contar cada operador como una instrucción, que castigaría escribir `360 / :lados` frente
a un literal y desalentaría justo la generalización que el mundo quiere enseñar.

### Decisión 4·9 · El nivel 4.2 declara un `margenLimiteDuro` de 6

**La decisión.** El 4.2 declara un margen de 6 sobre la referencia.

**La razón.** La referencia (un `PARA` de 3 instrucciones y 3 llamadas) cuenta 6. El rodeo de tres
procedimientos con 3 instrucciones cada uno y 3 llamadas cuenta 12. Con el margen por omisión de 3 el
límite sería 9 y ese programa se bloquearía, así que el jugador nunca vería la explicación de Kiro sobre
por qué aprobó la precisión pero no la abstracción. Con 6, el límite es 12 y el rodeo se ejecuta. El
margen es un dato del nivel; `presupuestoEstrella` y `limiteDuro` se siguen derivando.

**Descartado.** Un presupuesto escrito a mano, que rompería la regla de que la meta es el conteo de lo
que Kiro acaba de dibujar, y subir el margen por omisión de todos los mundos.

### Decisión 4·10 · `usaParametros` exige que el procedimiento se invoque

**La decisión.** La estrella de abstracción del mundo 4 exige un `PARA` con parámetros que se use en su
cuerpo **y** que se invoque al menos una vez. Además la abstracción exige precisión.

**La razón.** Sin la segunda condición, un jugador dibuja a mano con `REPITE` y deja un `PARA` sin llamar
para ganar la estrella. La estrella debe premiar haber generalizado, no haber declarado algo.

**Descartado.** Mantener la regla de la spec 04, que solo miraba la declaración.

### Resoluciones D1 a D21 del diseño

Al leer el código real de la spec 04, algunas piezas no coincidían con los requisitos. Ninguna de las diez
decisiones resultó inviable. Estas son las resoluciones, resumidas:

- **D1, D2 y D14 · impresor, pistas y panel.** El impresor solo sabía escribir comandos simples y se
  reescribe, y su prueba cambia el ejemplo de nodo reservado a `condicionalUnaRama`. Las pistas leen las
  llamadas del nivel superior porque los giros viven dentro de un `PARA`. El panel sigue listando todos
  los procedimientos y muestra la cabecera de los que tienen parámetros: quitar los demás sería una
  regresión.
- **D3 y D20 · generadores.** `cajaDeReferencia` devolvía `null` ante un `PARA` y habría descartado todos
  los candidatos; se amplía con el evaluador. Con 3 lados casi nada cabe, y se deja que el descarte y
  reintento lo filtre.
- **D4 y D5 · guardas.** `REPITE n` apilaba n marcos y disparaba la guarda de recursión sin recursión; los
  marcos ahora llevan un contador. La guarda de 5 s nunca disparaba en producción por no inyectar `ahora`;
  se corrige junto con un tope determinista de ciclos.
- **D6, D9 y D17 · lo que cambia lo ya probado.** Filtrar solo `escribir` y `rotular` en la divergencia
  mantiene el comportamiento del mundo 2. La regla de la línea separa `AVANZA AVANZA 10` de
  `AVANZA⏎GIRADERECHA 90`. Un anuncio por operación en el paso a paso y uno solo al final en la ejecución
  continua, como decidió la spec 00.
- **D7 y D11 · calificación.** `calificar` exige precisión para la abstracción. El desafío del mundo 4 se
  liga a las tres estrellas con una tabla de datos, sin tocar los otros mundos.
- **D8, D10, D12 y D21 · piezas menores.** Campos `produceValor` y `ejecutable` obligatorios; nombres de
  parámetro en minúsculas; semilla nueva con `crypto.getRandomValues` inyectable; el lienzo gana texto.
- **D13 · consola.** `role="log"` implica `aria-live="polite"`, que la decisión 4·5 quería evitar, así que
  se pone `aria-live="off"` explícito. Queda pendiente validarlo con un lector de pantalla real.
- **D15, D16 y D19 · niveles.** El 4.3 se renombra «Polígonos encajados»: las figuras comparten un vértice
  y el primer lado, no son concéntricas. `Nivel` gana un `enunciado` opcional. Una llamada de un `PARA` a
  sí mismo no cuenta como invocación.
- **D18 · deuda conocida.** `lenguaje/interprete.ts` importa `motor/tortuga.ts`, contra la regla de
  `estructura.md`. No lo introdujo esta spec y no se corrige aquí; los módulos nuevos de `lenguaje/` no
  importan nada.

Las resoluciones D6, D7, D9, D11, D13 y D17 alteran la letra de algún criterio y se marcaron «a confirmar»
en el diseño.
