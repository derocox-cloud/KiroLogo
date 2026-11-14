# Requirements Document

**KiroLogo · Spec 05 · Mundo 4 · Parámetros**

## Introduction

Esta spec agrega el mundo 4 completo (cuatro niveles) y las capacidades del lenguaje que lo hacen posible:
**parámetros** en los procedimientos `PARA`, **aritmética** (operadores infijos con precedencia y
paréntesis, y los comandos `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE`, `RESTO`), **`AZAR`**, **`ESCRIBE`** con
una consola de salida y **`ROTULA`** para escribir sobre el lienzo. Cierra con la insignia de concepto
*Generalización*.

El concepto central es la **generalización**: un procedimiento con parámetros resuelve una familia de
problemas, no uno solo. Es el salto de «le enseñé a Kiro a dibujar un hexágono» a «le enseñé a dibujar
cualquier polígono». El límite duro ya está activo desde el mundo 3, así que en este mundo también empuja
al jugador: tres polígonos escritos a mano no caben, y tres procedimientos casi iguales tampoco ganan la
estrella de abstracción.

### Precondición: base de código

La rama de trabajo actual (`spec-08-09-diseno-visual-y-ajustes-de-interfaz`) solo contiene el mundo 0. El
trabajo de las specs 02 a 04 (mundos 1 a 3, `limiteDuro`, `abstraccion.ts`, generadores `roseton` y `flor`,
desafío infinito, insignias transversales) vive en `origin/spec-04-mundo-3`, que no está fusionado a `main`.
Esta spec **asume ese código**: la implementación DEBE hacerse sobre una rama que parta de
`spec-04-mundo-3` (o de `main` una vez que esa rama se fusione). La fase de requisitos no modifica el
repositorio salvo los archivos de esta spec.

### Estado del código del que parte esta spec

Lo que ya existe y esta spec consume, no reinventa:

- `src/lenguaje/ast.ts` ya declara `DefinicionProcedimiento.parametros`, `ReferenciaParametro`,
  `InvocacionProcedimiento` y `ExpresionAritmetica` (cuyos operadores `=`, `<` y `>` están reservados para
  el mundo 5).
- El parser ya reconoce el token `parametro` (`:nombre`) y, antes del mundo 4, rechaza un `PARA` con
  parámetros con el error `paraConParametros`.
- El intérprete (`src/lenguaje/interprete.ts`) ya tiene pila de marcos, guardas y un PRNG creado al inicio
  de cada ejecución a partir de `OpcionesEjecucion.semilla`, pero solo evalúa argumentos que son
  `numeroLiteral`.
- El lexer no tiene símbolos de operador ni paréntesis: hoy los trata como `caracterNoValido`.
- `src/lenguaje/conteo.ts` ya cuenta `numeroLiteral`, `referenciaParametro` y `expresionAritmetica` con 0, y
  la cabecera de `PARA` con 0.
- `src/lenguaje/vocabulario.ts` ya declara las entradas del mundo 4 como marcadores no ejecutables, con
  firmas que contradicen el steering (se resuelven en el requisito 12).
- `src/juego/reto.ts` ya calcula `presupuestoEstrella`, `limiteDuro` y `limiteDuroActivo` (activo desde el
  mundo 3), y `src/lenguaje/errores.ts` ya tiene la sugerencia de bloqueo del mundo 4 («usar parámetros»).
- `src/juego/abstraccion.ts` ya implementa `usaParametros` y `maximoProcedimientos`; esta spec endurece la
  primera y exige que la segunda se use de verdad.

### Decisiones cerradas

Cada decisión lleva la marca **[Decisión propuesta · revisar]**: es una postura razonada de esta fase de
requisitos, pensada para que el usuario la confirme o la cambie antes del diseño.

**[Decisión propuesta · revisar] 1 · `AZAR` es determinista: se siembra con la semilla del reto** — Un
programa con `AZAR` produciría una figura distinta en cada corrida y no podría aprobar un nivel de forma
estable. Se descartan dos salidas. Limitar `AZAR` al modo libre lo dejaría sin ningún consumidor hoy, porque
el modo libre aún no existe en el repositorio. Dejarlo sin semilla fija rompe la reproducibilidad. La
postura: `AZAR` está disponible desde el mundo 4 y **toda ejecución crea su PRNG con la semilla efectiva del
reto**. Así el mismo programa con el mismo reto produce siempre las mismas operaciones, la demostración, el
paso a paso, la reproducción en paralelo y la validación ven exactamente la misma figura, y un reporte con la
semilla se reproduce al píxel. No queda hueco: repetir la corrida no cambia el resultado, así que el azar no
sirve para aprobar por suerte. Ningún programa de referencia usa `AZAR`, de modo que la figura que se valida
nunca depende de él.

**[Decisión propuesta · revisar] 2 · Se incluyen los paréntesis** — Es la recomendación del prompt. Sin
ellos, `360 * 2 / :puntas` depende por completo de la precedencia, y `360 / 2 + 1` frente a `360 / (2 + 1)`
no se podría distinguir ni escribir. Se agregan `(` y `)` como agrupación, con precedencia de `*` y `/` sobre
`+` y `-`, asociatividad por la izquierda y menos unario. Se pone un tope de anidación de 32 para que un
texto con miles de paréntesis no desborde la pila del analizador.

**[Decisión propuesta · revisar] 3 · Ámbito léxico, parámetros por valor e inmutables** — Un procedimiento
solo ve los parámetros de su propia cabecera `PARA`. Cada llamada recibe copias de los valores de sus
argumentos y no puede cambiarlos (no hay asignación en esta spec). Un procedimiento que llama a otro no le
presta sus variables. Es más predecible para quien aprende que el ámbito dinámico del Logo clásico, y permite
detectar `:variable` no declarada **antes de ejecutar**. Condiciona la recursión del mundo 5: cada llamada
recursiva tendrá sus propios valores y ninguna observa los de otra, que es justo lo que ese mundo necesita
para que `ESPIRAL :largo + 5` sea comprensible.

**[Decisión propuesta · revisar] 4 · `ROTULA` y `ESCRIBE` no cuentan para la precisión geométrica** — El
validador compara trazos (segmentos con el lápiz abajo). Un rótulo es texto, no geometría, y compararlo
dependería de cómo cada navegador dibuja la tipografía. Además los generadores solo emiten tramos, de modo
que no hay un texto de referencia que igualar. Así el jugador puede rotular sin penalización, en línea con
«explorar nunca se castiga». Ambos comandos sí cuentan como una instrucción cada uno en el presupuesto, y
ambos cuentan para el tope de pasos de ejecución. `ROTULA` escribe aunque el lápiz esté arriba, porque el
rótulo no es un trazo.

**[Decisión propuesta · revisar] 5 · La consola es un registro plegable con su propia ranura, sin región
`aria-live` propia** — La interfaz ya tiene una única región `aria-live` (`#anuncios`) como único canal de
anuncios. La consola es un elemento `role="log"` enfocable por teclado (para leerlo con el lector de
pantalla a voluntad), plegado hasta que una ejecución produzca su primera línea. Cuando una ejecución
termina, un único anuncio por la región existente resume cuántas líneas se escribieron y cuál fue la última.
Así no compite con los anuncios de la tortuga ni lee cada línea de un `REPITE 100 [ES 1]`. Su aparición no
cambia el tamaño de los lienzos ni el alto del editor.

**[Decisión propuesta · revisar] 6 · Conciliación del vocabulario: manda el steering, salvo en `SUMA` y
`PRODUCTO`** — `vocabulario.ts` es la única fuente de verdad de los comandos, pero las firmas del mundo 4
que hoy tiene son marcadores escritos antes de decidir la semántica. Se corrigen así:

| Comando | Hoy en `vocabulario.ts` | Steering `lenguaje-kirologo` | Prevalece |
|---|---|---|---|
| `AZAR` | aridad 2, «entre dos límites», `AZAR 1 10` | un argumento `n`, resultado entre 0 y n-1, `AV AZAR 100` | steering: aridad 1 |
| `ESCRIBE` / `ES` | argumento `palabra`, `ESCRIBE "Hola"` | muestra un valor, `ES :lados`, `ES SUMA 30 40` | steering: acepta un valor |
| `ROTULA` / `RO` | argumento `numero`, `ROTULA 42` | escribe texto sobre el lienzo, `ROTULA "hola` | steering: acepta texto; además acepta un valor numérico |
| `SUMA`, `PRODUCTO` | aridad fija 2 | «dos o más números» | vocabulario: aridad 2, y se corrige el steering |

`SUMA` y `PRODUCTO` quedan con exactamente dos argumentos porque una aridad variable sin paréntesis es
ambigua (`ES SUMA 1 2 3`), y los operadores infijos `+` y `*` ya cubren las sumas largas. El steering se
corrige en la misma spec, porque se versiona con el código.

**[Decisión propuesta · revisar] 7 · Los comandos de operador producen valores y no son instrucciones** —
`SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE`, `RESTO` y `AZAR` son expresiones. Se distinguen de los comandos de
acción con un campo nuevo en `vocabulario.ts` (`produceValor`), de modo que el lexer, el parser, el panel y
las sugerencias siguen leyendo una sola tabla. Escrito solo en una línea (`SUMA 1 2`), un comando de
operador es un error que explica qué hacer con el valor, al estilo del Logo clásico («no sé qué hacer con
3»). Por eso el ejemplo y el texto de inserción de cada operador en el panel son programas válidos por sí
solos (`ESCRIBE SUMA 30 40`).

**[Decisión propuesta · revisar] 8 · Una expresión es parte de la instrucción que la contiene** — Regla de
conteo: las expresiones aritméticas, las referencias a parámetros y los comandos de operador cuentan 0. Así
`AVANZA 100`, `AVANZA 50 + 50` y `AVANZA SUMA 50 50` cuestan lo mismo (1) y el jugador no es empujado a
elegir una forma por su costo. Confirma lo que `conteo.ts` ya hace con los nodos de expresión y lo extiende a
los nodos nuevos. Los comandos de acción `ESCRIBE` y `ROTULA` cuentan 1, como cualquier invocación.

**[Decisión propuesta · revisar] 9 · El nivel 4.2 declara un margen de límite duro de 6** — El criterio de
aceptación 6 pide que resolver el 4.2 con tres procedimientos dé precisión pero no abstracción. Eso solo es
posible si ese programa **se ejecuta**, y el límite duro está activo en el mundo 4. La referencia del 4.2 (un
`PARA` de 3 instrucciones más 3 llamadas) cuenta 6. Tres procedimientos de 3 instrucciones más 3 llamadas
cuentan 12. Con el margen por omisión (3) el límite sería 9 y ese programa se bloquearía, así que el jugador
nunca vería la explicación de Kiro. La postura: `margenLimiteDuro` de 6 en el 4.2, que deja el rodeo de tres
procedimientos justo en el límite (12). El margen es un dato del nivel que `tipos.ts` ya admite (0 a 10), no
un presupuesto escrito a mano: `presupuestoEstrella` y `limiteDuro` siguen derivándose.

**[Decisión propuesta · revisar] 10 · `usaParametros` exige que el procedimiento se invoque** — Hoy basta
con declarar un `PARA` con parámetros y usarlos en su cuerpo. Un jugador podría dibujar a mano con `REPITE`
y dejar un `PARA` sin llamar para ganar la abstracción. Esta spec exige además que el procedimiento
parametrizado se invoque al menos una vez.

**Precedencia, menos unario y argumentos** — En la gramática de expresiones, `*` y `/` ligan más que `+` y
`-`, y todos asocian por la izquierda. El `-` es unario cuando abre una expresión, sigue a `(` o sigue a
otro operador. Cada argumento de un comando o de un procedimiento es la expresión completa más larga que se
pueda leer: `SUMA 1 2 * 3` es `SUMA 1 (2 * 3)`, igual que en Logo. Consecuencia que el mensaje de error debe
poder explicar: `POLIGONO 6 -80` se lee como un único argumento `6 - 80`, y se escribe `POLIGONO 6 (-80)`.

**Los valores son solo números** — En el mundo 4 todo parámetro, argumento y resultado es un número. Las
palabras solo existen como literal de `ESCRIBE` y `ROTULA`. Pasar una palabra a un procedimiento es un error
de tipo. No se agregan listas ni variables mutables: no hay `HAZ`.

**Precisión numérica** — La aritmética usa números de doble precisión sin redondeo intermedio. La figura
cierra por la tolerancia de dilatación de la validación, no porque los ángulos sean exactos.

**Entrega** — La rama se actualiza con `git merge`, sin rebase, y el PR se fusiona con merge commit, según
las reglas de control de versiones del proyecto.

### Trazabilidad con los criterios de aceptación del prompt

| Criterio del prompt | Cubierto en |
|---|---|
| 1. `POLIGONO 6 80` dibuja un hexágono | Requisitos 1, 7 y 16 |
| 2. `POLIGONO 3 100`, `5 100` y `8 100` con la misma definición | Requisito 7 (criterio 2) y requisito 16 |
| 3. Precedencia, `360 / 2 + 1` frente a `360 / (2 + 1)` | Requisito 3 |
| 4. Llamada con menos argumentos: cuántos faltan y cómo se llaman | Requisitos 7 y 15 |
| 5. Variable fuera de su procedimiento sugiere declararla en `PARA` | Requisitos 2 y 15 |
| 6. En el 4.2, tres procedimientos dan precisión sin abstracción, con explicación de Kiro | Requisitos 17, 21 y 22 |
| 7. Presupuestos derivados del conteo de la referencia | Requisito 20 |
| 8. El contador cuenta las expresiones según la regla acordada | Requisito 13 |
| 9. Cada generador probado sobre al menos 200 semillas | Requisito 20 |

### Patrones EARS en español

| Patrón | Forma en este documento | EARS |
|---|---|---|
| Ubicuo | EL/LA \<sistema\> DEBERÁ \<respuesta\> | THE … SHALL |
| Dirigido por evento | CUANDO \<disparador\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHEN … |
| Dirigido por estado | MIENTRAS \<condición\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHILE … |
| Evento no deseado | SI \<condición\>, ENTONCES EL/LA \<sistema\> DEBERÁ \<respuesta\> | IF … THEN … |
| Opcional | DONDE \<opción\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHERE … |

## Glossary

- **Vocabulario**: el módulo `src/lenguaje/vocabulario.ts`, única fuente de verdad de los comandos del
  lenguaje: nombre, abreviatura, aridad, tipos de argumento, mundo de desbloqueo y si es ejecutable.
- **Lexer**: el módulo `src/lenguaje/lexer.ts`, que convierte texto en tokens.
- **Parser**: el módulo `src/lenguaje/parser.ts`, que convierte tokens en AST y reporta los errores de
  sintaxis y de ámbito.
- **Interprete**: el módulo `src/lenguaje/interprete.ts`, el generador `ejecutar` que emite una operación
  por paso. Alimenta a todos los consumidores (demostración, animación, paso a paso, validación y
  reproducción en paralelo).
- **Impresor**: el módulo `src/lenguaje/impresor.ts`, que convierte un AST en texto KiroLogo.
- **Conteo**: el módulo `src/lenguaje/conteo.ts`, única fuente del presupuesto de instrucciones.
- **Catalogo_Errores**: el módulo `src/lenguaje/errores.ts`, única fuente de los mensajes visibles al
  jugador.
- **Validador**: el módulo `src/motor/validador.ts`, que compara la geometría del jugador con la de la
  referencia.
- **Extractor_Segmentos**: el módulo `src/motor/segmentos.ts`, que reduce operaciones a segmentos dibujados
  con el lápiz abajo.
- **Divergencia**: el módulo `src/motor/divergencia.ts`, que busca el primer paso en que dos ejecuciones se
  separan.
- **Interfaz**: la pantalla de KiroLogo armada por `src/main.ts` y los módulos de `src/ui/`.
- **Panel_Comandos**: el módulo `src/ui/panel-comandos.ts`, que muestra el vocabulario desbloqueado con
  ejemplos.
- **Globo_Kiro**: el módulo `src/ui/globo-kiro.ts`, donde Kiro habla (errores, pistas, explicaciones).
- **Lienzo**: el módulo `src/motor/lienzo.ts`, que dibuja la cuadrícula y la estela en el Canvas 2D.
- **Contador_Editor**: componente de la Interfaz que muestra, mientras el jugador escribe, el conteo de
  instrucciones del programa actual según el Conteo.
- **Region_Anuncios**: el elemento `#anuncios` de `index.html`, la única región `aria-live` de la Interfaz.
- **Parametro**: nombre con prefijo `:` declarado en la cabecera de un `PARA` (`:lados`). Su valor es un
  número, fijo durante la llamada.
- **Ambito_Lexico**: regla por la que el cuerpo de un procedimiento solo puede referirse a los
  `Parametro` de su propia cabecera.
- **Expresion**: construcción que se evalúa a un valor: número, `Parametro`, operación infija, expresión
  entre paréntesis, menos unario o `Comando_Operador`.
- **Operador_Infijo**: uno de `+`, `-`, `*`, `/` escrito entre dos `Expresion`.
- **Comando_Operador**: comando del `Vocabulario` con `produceValor` verdadero: `SUMA`, `RESTA`, `PRODUCTO`,
  `COCIENTE`, `RESTO` y `AZAR`. Solo puede escribirse donde se espera una `Expresion`.
- **Comando_Accion**: comando del `Vocabulario` con `produceValor` falso (`AVANZA`, `ESCRIBE`, `ROTULA`,
  etcétera). Solo puede escribirse como instrucción.
- **Valor_Escribible**: lo que aceptan `ESCRIBE` y `ROTULA`: una `Expresion` numérica o una palabra con
  comilla inicial (`"hola`).
- **Texto_Numerico**: la forma en que se muestra un número en la consola y en los rótulos: hasta 4
  decimales, sin ceros finales, con punto decimal.
- **Consola**: componente de la Interfaz que muestra, línea por línea, lo que escribe `ESCRIBE` durante la
  ejecución del programa del jugador.
- **Rotulo**: texto que `ROTULA` deja sobre el lienzo del jugador, anclado en la posición de la tortuga.
- **Operacion_Escribir**: operación del flujo del Interprete que lleva el texto de un `ESCRIBE`.
- **Operacion_Rotular**: operación del flujo del Interprete que lleva el texto, la posición y el color de un
  `ROTULA`.
- **Semilla_Ejecucion**: valor de `OpcionesEjecucion.semilla` con el que el Interprete crea su PRNG al
  inicio de cada ejecución. Para un reto es la `semillaEfectiva`.
- **Limite_Duro**: entero `presupuestoEstrella + margen` de `src/juego/reto.ts`; un programa que lo excede
  no se ejecuta. Activo desde el mundo 3.
- **Presupuesto_Referencia**: conteo de instrucciones del programa de referencia según el `Conteo`. Es el
  `presupuestoEstrella` del nivel y no se escribe a mano.
- **Rodeo_Tres_Procedimientos**: programa para el nivel 4.2 que define tres procedimientos, uno por
  polígono, y los invoca una vez cada uno.
- **Procedimiento_Poligono**: el procedimiento `PARA POLIGONO :lados :largo` que dibuja un polígono regular
  de `:lados` lados de longitud `:largo`.
- **Generador_M4**: función pura `Generador` (contrato de `src/niveles/tipos.ts`) de uno de los niveles
  generados 4.2, 4.3 o 4.4. Toda su aleatoriedad sale de un PRNG sembrado con la semilla del intento.
- **Insignia_Generalizacion**: insignia de concepto del mundo 4, otorgada cuando todos los niveles del mundo
  4 tienen sus tres estrellas.
- **Normalizacion_Fija**: configuración de validación con `traslacion: 'fija'`, `rotacion: 'fija'` y
  `escala: 'exacta'`.
- **Desafio_Infinito**: secuencia determinista de retos generados de un mundo (`src/juego/desafio-infinito.ts`).

## Requirements

### Requirement 1: Parámetros en la cabecera de PARA

**User Story:** Como jugador, quiero declarar parámetros con `:nombre` en un `PARA`, para que un mismo procedimiento dibuje figuras de distinto tamaño o número de lados.

#### Acceptance Criteria

1. CUANDO el Parser analiza `PARA POLIGONO :lados :largo … FIN` en un nivel del mundo 4 o posterior, EL Parser DEBERÁ producir una `DefinicionProcedimiento` cuyo campo `parametros` tiene exactamente dos elementos, `lados` y `largo`, en el orden en que se escribieron.
2. CUANDO el Parser lee el nombre de un Parametro en la cabecera de un `PARA`, EL Parser DEBERÁ normalizarlo a minúsculas y sin acentos, de modo que `:Largo`, `:LARGO` y `:largó` produzcan el mismo nombre `largo`.
3. CUANDO el Parser analiza un `PARA` sin parámetros en la cabecera, EL Parser DEBERÁ producir `parametros` con cero elementos, y las llamadas a ese procedimiento con cero argumentos DEBERÁN producir las mismas operaciones que en el mundo 2.
4. SI el mundo del nivel es menor que 4 y la cabecera de un `PARA` declara al menos un Parametro, ENTONCES EL Parser DEBERÁ reportar el error `paraConParametros` existente y no definir el procedimiento.
5. SI la cabecera de un `PARA` declara dos o más veces el mismo Parametro (comparado tras la normalización del criterio 2), ENTONCES EL Parser DEBERÁ reportar el error `parametroDuplicado` que incluye el nombre del procedimiento y el nombre del parámetro repetido, y no definir el procedimiento.
6. SI en la cabecera de un `PARA` aparece `:` que no va seguido de un nombre, ENTONCES EL Lexer DEBERÁ reportar el error `parametroSinNombre` existente con la línea del `:`.
7. CUANDO el Parser termina su primera pasada sobre el programa, EL Parser DEBERÁ conocer el número de parámetros de cada `PARA` con parámetros, de modo que las llamadas se validen antes de ejecutar (requisito 7), incluidas las llamadas escritas antes de la definición.
8. SI el nombre de un procedimiento coincide con un comando del Vocabulario, incluidos los comandos del mundo 4, ENTONCES EL Parser DEBERÁ rechazar la definición con el mismo error que reportaba antes de esta spec y no definir el procedimiento.

### Requirement 2: Ámbito léxico y variables no definidas

**User Story:** Como jugador, quiero que un parámetro exista solo dentro de su procedimiento y que el error me diga cómo declararlo cuando lo uso fuera, para entender de dónde sale cada valor.

#### Acceptance Criteria

1. EL Parser DEBERÁ resolver cada referencia `:nombre` solo contra los Parametro declarados en la cabecera del `PARA` que contiene esa referencia, de modo que un procedimiento invocado no herede los Parametro del procedimiento que lo invoca.
2. CUANDO el Parser encuentra `:nombre` dentro del cuerpo de un `PARA` (incluidas las listas de `REPITE` anidadas en ese cuerpo y los argumentos de invocaciones) y `nombre` no es un Parametro de la cabecera de ese `PARA`, EL Parser DEBERÁ reportar el error `variableNoDefinida` con la línea y la columna de esa referencia, incluso si `nombre` es un Parametro de otro `PARA` del programa.
3. CUANDO el Parser encuentra `:nombre` fuera de cualquier `PARA` (el programa principal, las listas de `REPITE` que contiene y los argumentos de invocaciones del programa principal), EL Parser DEBERÁ reportar el error `variableNoDefinida` con la línea y la columna de esa referencia.
4. SI un programa contiene varias referencias no definidas, ENTONCES EL Parser DEBERÁ reportar un error `variableNoDefinida` por cada referencia, ordenados por línea y columna, dentro del tope de 20 errores del Parser.
5. CUANDO el Interprete entra a un procedimiento, EL Interprete DEBERÁ evaluar los argumentos en el marco de quien llama, crear un marco nuevo cuyos Parametro valen una copia de esos valores, y evaluar el cuerpo solo contra ese marco.
6. CUANDO una llamada de un procedimiento termina, EL Interprete DEBERÁ dejar sin cambios los valores del marco que la invocó, de modo que, en dos llamadas del mismo procedimiento (una dentro de otra o una tras otra), cada Parametro valga en cada llamada el argumento de esa llamada.
7. EL Vocabulario DEBERÁ no contener ningún comando que asigne o modifique un Parametro, y EL Parser DEBERÁ tratar una palabra como `HAZ` igual que a cualquier palabra que no es comando ni procedimiento.
8. SI el Parser reporta al menos un error `variableNoDefinida`, ENTONCES EL sistema DEBERÁ no ejecutar el programa: el Interprete no emite ninguna operación y el Lienzo del jugador queda sin cambios, igual que con cualquier otro error de sintaxis.

### Requirement 3: Expresiones aritméticas con precedencia y paréntesis

**User Story:** Como jugador, quiero escribir cuentas como `360 / :lados` con la precedencia que espero y poder agrupar con paréntesis, para repartir los grados sin calcular a mano.

#### Acceptance Criteria

1. CUANDO el texto contiene `+`, `-`, `*`, `/`, `(` o `)` fuera de una palabra con comilla, EL Lexer DEBERÁ producir un token distinto por cada símbolo, con o sin espacios alrededor (`100*2` produce tres tokens), y DEBERÁ dejar al Parser la decisión de si el mundo del nivel los permite.
2. EL Parser DEBERÁ analizar las expresiones con esta precedencia, de mayor a menor: paréntesis y menos unario, luego `*` y `/`, luego `+` y `-`, con asociatividad por la izquierda, de modo que `10 - 3 - 2` sea `(10 - 3) - 2` (5), `100 / 10 / 2` sea `(100 / 10) / 2` (5) y `-2 * 3` sea `(-2) * 3` (-6).
3. CUANDO el programa contiene `360 / 2 + 1`, EL Interprete DEBERÁ evaluarlo a 181, y CUANDO contiene `360 / (2 + 1)`, EL Interprete DEBERÁ evaluarlo a 120.
4. CUANDO un `-` abre una expresión, sigue a `(` o sigue a otro operador, EL Parser DEBERÁ tratarlo como menos unario, de modo que `AVANZA -50`, `AVANZA 100 * -1` y `AVANZA (-:largo)` sean expresiones válidas sin error de sintaxis.
5. EL Parser DEBERÁ aceptar una `Expresion` en cada uno de estos lugares: el argumento de `AVANZA`, `RETROCEDE`, `GIRADERECHA`, `GIRAIZQUIERDA` y `PONGROSOR`; la cantidad de veces de `REPITE`; cada argumento de la invocación de un procedimiento; cada argumento de `ESCRIBE` y `ROTULA`; y cada argumento de un `Comando_Operador`.
6. EL Parser DEBERÁ leer cada argumento como la expresión completa más larga posible, de modo que `SUMA 1 2 * 3` se analice como `SUMA 1 (2 * 3)`.
7. EL Parser DEBERÁ aceptar como operando de una expresión únicamente un número, una referencia a `Parametro`, una expresión entre paréntesis o un `Comando_Operador` con todos sus argumentos.
8. SI falta el paréntesis de cierre de una expresión, ENTONCES EL Parser DEBERÁ reportar `parentesisSinCerrar` con el número de línea del paréntesis de apertura que quedó sin cerrar, y el sistema NO DEBERÁ ejecutar el programa.
9. SI aparece un `)` sin un `(` abierto que le corresponda, ENTONCES EL Parser DEBERÁ reportar `parentesisDeMas` con el número de línea de ese `)`, y el sistema NO DEBERÁ ejecutar el programa.
10. SI un operador infijo no tiene operando a su derecha porque lo siguen el fin de la línea, un `)` o el fin del programa (`AVANZA 100 *`), ENTONCES EL Parser DEBERÁ reportar `expresionIncompleta` con el símbolo del operador y su número de línea, y el sistema NO DEBERÁ ejecutar el programa.
11. SI el anidamiento de paréntesis de una expresión llega a 33 niveles o más, ENTONCES EL Parser DEBERÁ reportar `expresionDemasiadoProfunda` con el número de línea y terminar el análisis sin lanzar una excepción de desbordamiento de pila; una expresión con hasta 32 niveles DEBERÁ analizarse sin error.
12. SI el mundo del nivel es menor que 4 y el programa contiene `+`, `-`, `*`, `/`, `(` o `)` en posición de expresión, ENTONCES EL Parser DEBERÁ reportar `aritmeticaBloqueada` con el primer símbolo en orden de lectura, su número de línea y el mundo que lo desbloquea (4), y el sistema NO DEBERÁ ejecutar el programa.
13. EL Lexer y el Parser DEBERÁN tratar `=`, `<` y `>` como `caracterNoValido` en todos los mundos, porque las comparaciones pertenecen al mundo 5.
14. EL Parser DEBERÁ analizar el argumento de color de `PONCOLOR` (palabra o lista RGB) con el mismo resultado que antes de este requisito, sin interpretarlo como `Expresion`.
15. PARA TODA `Expresion` sin divisiones por cero, generada al azar con semilla explícita en al menos 200 casos, EL Impresor seguido del Parser DEBERÁ producir un AST estructuralmente idéntico al original, con los mismos nodos, operadores y orden de operandos (propiedad de ida y vuelta, ver requisito 14).

### Requirement 4: Evaluación aritmética en el intérprete

**User Story:** Como jugador, quiero que la tortuga use el resultado exacto de mis cuentas y que un error de cálculo me lo explique, para depurar mis fórmulas.

#### Acceptance Criteria

1. EL Interprete DEBERÁ evaluar las `Expresion` con un evaluador escrito a mano, sin `eval` ni `new Function`, en aritmética de doble precisión y sin redondeo intermedio: cada operación DEBERÁ producir el mismo valor que la operación equivalente de doble precisión del lenguaje de implementación, sin truncar ni redondear resultados parciales.
2. CUANDO el Interprete evalúa una `Expresion` con más de un operando, EL Interprete DEBERÁ evaluar los operandos de izquierda a derecha, de modo que si dos operandos producen error, se reporte el del operando situado más a la izquierda.
3. CUANDO una `Expresion` contiene un `Parametro`, EL Interprete DEBERÁ sustituirlo por el valor que tiene en el marco de la llamada en curso, sin consultar los marcos de las llamadas que la precedieron.
4. SI el divisor de `/`, de `COCIENTE` o de `RESTO` vale 0 (incluido −0), ENTONCES EL Interprete DEBERÁ detener la ejecución con el error `divisionPorCero` y la línea de la instrucción, no DEBERÁ emitir ninguna operación posterior al error y DEBERÁ conservar sin cambios las operaciones ya emitidas.
5. SI el resultado de una operación es `Infinity`, `-Infinity` o `NaN` y su divisor no es 0, ENTONCES EL Interprete DEBERÁ detener la ejecución con el error `numeroFueraDeRango` y la línea de la instrucción, conservando sin cambios las operaciones ya emitidas.
6. CUANDO el Interprete evalúa la cantidad de veces de un `REPITE` y su valor `v` cumple que `|v − redondeo(v)| < 1e-9` y `redondeo(v) ≥ 0`, EL Interprete DEBERÁ ejecutar el cuerpo exactamente `redondeo(v)` veces.
7. SI la cantidad de veces de un `REPITE` evalúa a un `v` con `|v − redondeo(v)| ≥ 1e-9` o con `redondeo(v) < 0`, ENTONCES EL Interprete DEBERÁ detener la ejecución con el error `vecesInvalidas` que incluya el valor `v` y la línea de la instrucción, sin ejecutar ninguna vez el cuerpo.
8. CUANDO el Interprete evalúa `RESTO a b` con `b` distinto de 0, EL Interprete DEBERÁ devolver un residuo con el signo de `a` y con valor absoluto menor que el de `b`, de modo que `RESTO -7 3` valga −1 y `RESTO 7 -3` valga 1.
9. CUANDO el Interprete evalúa `a / b` o `COCIENTE a b` con `b` distinto de 0, EL Interprete DEBERÁ devolver la división real sin truncar, de modo que `7 / 2` y `COCIENTE 7 2` valgan 3.5.
10. PARA TODA expresión generada al azar sin divisiones por cero, en al menos 200 semillas, el valor que escribe `ESCRIBE` DEBERÁ ser idéntico, sin tolerancia, al calculado por un evaluador de referencia independiente escrito en la prueba (propiedad basada en modelo).
11. CUANDO el Interprete ejecuta un giro o un avance, EL Interprete DEBERÁ usar el valor que la `Expresion` tiene al ejecutar la instrucción, sin redondearlo ni aplicarle la tolerancia de `REPITE`, de modo que con `:lados` igual a 7, `GD 360 / :lados` emita un giro de exactamente `360 / 7` grados.

### Requirement 5: Comandos de operador SUMA, RESTA, PRODUCTO, COCIENTE y RESTO

**User Story:** Como jugador, quiero comandos con nombre para las cuatro operaciones y el resto, para escribir cuentas al estilo Logo cuando me resulten más claras que los símbolos.

#### Acceptance Criteria

1. EL Vocabulario DEBERÁ declarar `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE` y `RESTO` como Comando_Operador (`produceValor` verdadero), con aridad exactamente 2, ambos argumentos de tipo número, mundo de desbloqueo 4 y ninguna abreviatura. Con esto ninguno de los cinco comandos coincide con `RE` (retrocede) ni con `RL` (rellena).
2. CUANDO el Interprete evalúa `SUMA a b`, `RESTA a b`, `PRODUCTO a b`, `COCIENTE a b` o `RESTO a b`, EL Interprete DEBERÁ devolver respectivamente `a + b`, `a - b`, `a * b`, la división real `a / b` sin truncar, y el residuo de `a` entre `b` con el signo del dividendo. Por ejemplo, `SUMA 30 40` devuelve 70, `COCIENTE 7 2` devuelve 3.5, `RESTO 7 3` devuelve 1 y `RESTO -7 3` devuelve -1. El caso `b` igual a 0 en `COCIENTE` y `RESTO` lo cubre el requisito 4 (`divisionPorCero`).
3. PARA TODO par de números finitos `a` y `b` generados al azar (con `b` distinto de 0 en `COCIENTE`), EL Interprete DEBERÁ producir con `SUMA a b`, `RESTA a b`, `PRODUCTO a b` y `COCIENTE a b` exactamente el mismo valor numérico que con `a + b`, `a - b`, `a * b` y `a / b` (propiedad de equivalencia, sobre al menos 100 pares por operador).
4. EL Parser DEBERÁ aceptar como cada uno de los dos argumentos de un Comando_Operador cualquier `Expresion`: un número, un Parametro, una expresión aritmética o entre paréntesis, o el resultado de otro Comando_Operador. Por ejemplo, `ESCRIBE SUMA PRODUCTO 2 3 RESTA 10 4` se analiza sin error y escribe 12.
5. SI a un Comando_Operador le falta uno o ambos argumentos (por ejemplo `ESCRIBE SUMA 1` o `ESCRIBE RESTA`), ENTONCES EL Parser DEBERÁ reportar el error existente `argumentoFaltante` con el nombre del comando y la línea donde aparece.
6. SI el mundo del nivel es menor que 4 y el programa contiene un Comando_Operador (`SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE` o `RESTO`), ENTONCES EL Parser DEBERÁ reportar `comandoBloqueado` por cada ocurrencia, con el nombre del comando, su línea y el mundo 4 como mundo de desbloqueo.
7. EL Lexer DEBERÁ reconocer cada Comando_Operador escrito en cualquier combinación de mayúsculas y minúsculas y con o sin acentos (por ejemplo `suma`, `Resto`, `prodúcto`), con el mismo resultado que su escritura canónica.

### Requirement 6: Distinción entre comandos de acción y de operador

**User Story:** Como jugador, quiero que el lenguaje me diga qué hacer cuando escribo `SUMA 1 2` solo en una línea, para entender que calcula un valor y que ese valor hay que usarlo.

#### Acceptance Criteria

1. EL Vocabulario DEBERÁ declarar en cada entrada un campo `produceValor` booleano, con valor verdadero únicamente en `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE`, `RESTO` y `AZAR`, y con valor falso en todas las demás entradas.
2. EL Lexer, el Parser, el Panel_Comandos, la ayuda contextual y las sugerencias de error DEBERÁN obtener la clasificación operador/acción únicamente del campo `produceValor` del Vocabulario, de modo que ningún archivo fuera de `vocabulario.ts` contenga una lista literal de los nombres `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE`, `RESTO` y `AZAR` para ese fin.
3. SI un Comando_Operador aparece donde se espera una instrucción (en el nivel superior del programa, dentro de los corchetes de un `REPITE` o en el cuerpo de un `PARA … FIN`; por ejemplo `SUMA 1 2` solo en una línea), ENTONCES EL Parser DEBERÁ reportar `operadorSinUso` indicando la línea del operador, su nombre y un ejemplo de uso con la forma `ESCRIBE <operador con sus argumentos>` (por ejemplo `ESCRIBE SUMA 1 2`), y el programa NO DEBERÁ ejecutarse.
4. SI un Comando_Accion aparece donde se espera una `Expresion` (por ejemplo `AVANZA AVANZA 10`), ENTONCES EL Parser DEBERÁ reportar `argumentoDeTipoEquivocado` indicando la línea y el nombre del Comando_Accion recibido (`AVANZA` en el segundo lugar del ejemplo), y el programa NO DEBERÁ ejecutarse.
5. SI el nombre de un procedimiento definido por el jugador aparece donde se espera una `Expresion` (por ejemplo `AVANZA cuadrado`), ENTONCES EL Parser DEBERÁ reportar `argumentoDeTipoEquivocado` indicando la línea y el nombre de ese procedimiento, porque en el mundo 4 los procedimientos dibujan y no devuelven valores, y el programa NO DEBERÁ ejecutarse.
6. CUANDO el jugador escribe, en un nivel del mundo 4 o posterior, una palabra que no es un comando y cuya distancia de edición, tras normalizar acentos y mayúsculas, es de a lo más 1 respecto de un comando o abreviatura del mundo 4 (palabra de 3 caracteres o menos) o de a lo más 2 (palabra de 4 caracteres o más), EL Parser DEBERÁ reportar `palabraDesconocidaConSugerencia` con el comando más cercano como sugerencia. CUANDO esa misma palabra se escribe en un nivel de un mundo menor que 4, EL Parser DEBERÁ reportar `comandoBloqueadoCercano` con el nombre del comando y el número 4 como mundo que lo desbloquea.
7. PARA CADA comando del mundo 4, EL campo `ejemplo` del Vocabulario DEBERÁ analizarse sin errores como programa completo en un nivel del mundo 4. PARA CADA Comando_Operador, EL campo `insercion` del Vocabulario DEBERÁ además analizarse sin errores como programa completo en un nivel del mundo 4 (por ejemplo `ESCRIBE SUMA 30 40`), y por tanto NO DEBERÁ producir `operadorSinUso`.
### Requirement 7: Llamadas a procedimientos con argumentos

**User Story:** Como jugador, quiero llamar a mi procedimiento con números distintos y que el error me diga cuántos argumentos faltan y cómo se llaman, para corregir la llamada sin adivinar.

#### Acceptance Criteria

1. CUANDO el programa contiene `PARA POLIGONO :lados :largo REPITE :lados [AVANZA :largo GIRADERECHA 360 / :lados] FIN` seguido de `POLIGONO 6 80`, EL Interprete DEBERÁ emitir exactamente 6 avances de 80 unidades, cada uno seguido de un giro a la derecha de 60 grados, y ninguna otra operación de movimiento o giro.
2. CUANDO el programa del criterio 1 se ejecuta sin modificar la definición, con `POLIGONO 3 100`, `POLIGONO 5 100` o `POLIGONO 8 100`, EL Interprete DEBERÁ emitir respectivamente 3 avances de 100 unidades con giros de 120 grados, 5 avances de 100 con giros de 72 grados y 8 avances de 100 con giros de 45 grados, cada avance seguido de su giro a la derecha.
3. EL Parser DEBERÁ aceptar una `Expresion` en cada argumento de una llamada y DEBERÁ terminar cada argumento en el primer token que no pueda continuar la expresión. Por eso `POLIGONO 3 + 3 40 * 2` se analiza como una llamada válida, sin errores, con exactamente 2 argumentos que valen 6 y 80.
4. CUANDO el Interprete invoca un procedimiento, EL Interprete DEBERÁ evaluar sus argumentos de izquierda a derecha en el entorno de quien llama, antes de crear el marco del procedimiento. Así, en `PARA DOBLE :largo POLIGONO 4 :largo * 2 FIN`, `:largo` toma el valor del marco de `DOBLE`, y si la evaluación de un argumento falla no se crea ningún marco nuevo.
5. SI una llamada tiene menos argumentos que los parámetros declarados, es decir, si la línea termina o aparece un `]` antes de completarlos, ENTONCES EL Parser DEBERÁ reportar `procedimientoArgumentosFaltantes` con el nombre del procedimiento, la cantidad que falta (parámetros declarados menos argumentos recibidos) y el nombre de cada parámetro que falta, en el orden de la declaración.
6. SI el procedimiento declara al menos un parámetro y, después de su último argumento, el siguiente token de la misma línea es un número, un parámetro o un paréntesis de apertura, ENTONCES EL Parser DEBERÁ reportar `procedimientoArgumentosDeMas` con el nombre del procedimiento, la cantidad de parámetros que declara, los nombres de esos parámetros y la línea de la llamada. Un operador infijo en esa posición continúa la expresión del último argumento y no cuenta como argumento de más.
7. SI se llama con al menos un argumento a un procedimiento declarado sin parámetros, ENTONCES EL Parser DEBERÁ reportar `procedimientoArgumentosDeMas` con 0 argumentos esperados, el nombre del procedimiento y la línea de la llamada.
8. SI un argumento de una llamada es una palabra con comilla, ENTONCES EL Parser DEBERÁ reportar `argumentoDeTipoEquivocado` con el nombre del procedimiento, el nombre del parámetro que recibiría esa palabra y la palabra tal como la escribió el jugador.
9. EL Parser DEBERÁ validar la aridad y el tipo de cada argumento de cada llamada antes de que el Interprete emita su primera operación, incluidas las llamadas dentro del cuerpo de otro procedimiento y dentro de un `REPITE`. SI alguna llamada es inválida, ENTONCES EL Parser DEBERÁ reportar el error de la primera llamada inválida en orden de aparición en el texto, y el programa no DEBERÁ emitir ninguna operación.
10. CUANDO un procedimiento se llama en una línea anterior a la de su definición, EL Parser DEBERÁ validar esa llamada con los parámetros que registró la primera pasada, y DEBERÁ reportar los mismos errores y con los mismos datos que si la definición estuviera antes.

### Requirement 8: AZAR determinista por semilla del reto

**User Story:** Como jugador, quiero un comando de azar que se comporte igual cada vez que ejecuto el mismo reto, para poder repetir, compartir y depurar mi programa.

#### Acceptance Criteria

1. EL Vocabulario DEBERÁ declarar `AZAR` con aridad 1, argumento numérico, mundo 4 y `produceValor` verdadero.
2. CUANDO el Interprete evalúa `AZAR n` con `n` entero mayor o igual que 1, EL Interprete DEBERÁ devolver un entero `k` con `0 ≤ k ≤ n - 1`, obtenido del PRNG de `src/azar/prng.ts`, de modo que `AZAR 1` devuelva siempre 0.
3. CUANDO el Interprete inicia una ejecución, EL Interprete DEBERÁ crear su PRNG con la Semilla_Ejecucion recibida en `OpcionesEjecucion.semilla`.
4. CUANDO la Interfaz inicia una ejecución para un reto, LA Interfaz DEBERÁ pasar como Semilla_Ejecucion la `semillaEfectiva` del reto en curso.
5. CUANDO el mismo programa se ejecuta dos o más veces con la misma Semilla_Ejecucion, EL Interprete DEBERÁ emitir la misma secuencia de operaciones y los mismos valores de `AZAR` en cada ejecución, sin depender del número de ejecuciones previas ni de la hora.
6. CUANDO el jugador ejecuta un programa con `AZAR` en un reto, LA Interfaz DEBERÁ usar la misma Semilla_Ejecucion en la ejecución completa, el paso a paso, la reproducción en paralelo y la validación de ese intento, y EL Validador DEBERÁ dar el mismo veredicto en cada repetición.
7. SI `n` en `AZAR n` no es un entero mayor o igual que 1 (por ejemplo 0, un negativo o 2.5), ENTONCES EL Interprete DEBERÁ detener la ejecución sin emitir más operaciones y reportar el error `azarRangoInvalido` con el valor recibido y la línea de `AZAR`.
8. CUANDO el Interprete consume números del PRNG de la ejecución, EL Interprete DEBERÁ dejar sin cambios el PRNG que usa el generador del reto, de modo que generar el reto con la misma semilla antes y después de ejecutar el programa produzca el mismo AST de referencia.
9. EL código fuente de `src/` NO DEBERÁ usar `Math.random`, `Date.now` ni el reloj como fuente de azar ni de semilla; el reloj solo puede usarse para animar y para la guarda de tiempo de ejecución.
10. LOS programas de referencia de todos los niveles, autorados y generados (en el caso de los generados, sobre al menos 200 semillas por nivel), NO DEBERÁN contener `AZAR`.

### Requirement 9: ESCRIBE y ES

**User Story:** Como jugador, quiero escribir el valor de una cuenta en la consola, para comprobar qué vale `:lados` o cuánto da `360 / :lados` antes de girar.

#### Acceptance Criteria

1. EL Vocabulario DEBERÁ declarar `ESCRIBE` con abreviatura `ES`, aridad 1, un argumento que es un Valor_Escribible y `produceValor` falso.
2. CUANDO el Interprete ejecuta `ESCRIBE` con una `Expresion`, EL Interprete DEBERÁ emitir una Operacion_Escribir cuyo texto es el valor de la `Expresion` en Texto_Numerico (por ejemplo, `ESCRIBE 360 / 5` emite `72` y `ESCRIBE 10 / 3` emite `3.3333`).
3. CUANDO el Interprete ejecuta `ESCRIBE "hola`, EL Interprete DEBERÁ emitir una Operacion_Escribir cuyo texto es `hola`, sin la comilla inicial.
4. CUANDO el Interprete emite una Operacion_Escribir, EL Interprete DEBERÁ dejar idénticos, antes y después de esa operación, la posición, el rumbo y el estado del lápiz de la tortuga.
5. CUANDO el Interprete emite una Operacion_Escribir, EL Interprete DEBERÁ incluir en ella el número de línea de la instrucción `ESCRIBE` y la profundidad de llamada vigente, igual que en las demás operaciones.
6. CUANDO el valor de la `Expresion` es el cero negativo, EL Interprete DEBERÁ emitir una Operacion_Escribir cuyo texto es `0`, sin signo.
7. SI `ESCRIBE` o `ES` aparece sin argumento, ENTONCES EL Parser DEBERÁ reportar el error existente `argumentoFaltante`.
8. SI el mundo del nivel es menor que 4, ENTONCES EL Parser DEBERÁ reportar el error existente `comandoBloqueado` para `ESCRIBE` y para `ES`.
9. CUANDO el Interprete emite una Operacion_Escribir o una Operacion_Rotular, EL Interprete DEBERÁ sumar 1 al contador de pasos de la ejecución, sujeto al tope de 200 000 pasos.
10. SI una ejecución intenta emitir la operación número 501 entre Operacion_Escribir y Operacion_Rotular sumadas, ENTONCES EL Interprete DEBERÁ detener la ejecución con el error `guardaEscrituras` sin emitir esa operación, y las 500 operaciones ya emitidas DEBERÁN conservarse.
11. EL Extractor_Segmentos DEBERÁ producir la misma lista de segmentos para un programa con Operacion_Escribir que para el mismo programa sin ellas.
12. LA Divergencia DEBERÁ ignorar las Operacion_Escribir al comparar dos ejecuciones, de modo que dos ejecuciones que difieren solo en sus Operacion_Escribir no reporten ningún paso de separación.

### Requirement 10: Consola de salida en la Interfaz

**User Story:** Como jugador, quiero ver lo que escribe `ESCRIBE` en un lugar fijo que no me quite espacio del lienzo ni del editor, para leer los valores mientras depuro.

#### Acceptance Criteria

1. DONDE el mundo del nivel es 4 o mayor, LA Interfaz DEBERÁ ofrecer la Consola en una ranura propia de la columna del programa, como un único elemento `role="log"` con nombre accesible «Consola» y sin atributo `aria-live` propio.
2. DONDE el mundo del nivel es menor que 4, LA Interfaz DEBERÁ no incluir la Consola en el DOM, de modo que no ocupe espacio ni aparezca en el árbol de accesibilidad.
3. MIENTRAS la ejecución actual no ha producido ninguna Operacion_Escribir, LA Consola DEBERÁ mostrarse plegada, con solo su título y su botón de plegado visibles y sin líneas.
4. CUANDO la animación o el paso a paso aplican una Operacion_Escribir del programa del jugador, LA Consola DEBERÁ desplegarse si estaba plegada y agregar al final una línea con el texto de esa operación, en el mismo ciclo de animación en que se aplica.
5. CUANDO el jugador inicia una nueva ejecución, cambia de nivel o pide otro reto, LA Consola DEBERÁ vaciarse y quedar plegada antes de que se aplique la primera operación de la nueva ejecución o del nuevo reto.
6. SI una ejecución termina con un error después de haber escrito una o más líneas, ENTONCES LA Consola DEBERÁ conservar todas las líneas ya escritas, y EL Globo_Kiro DEBERÁ mostrar el error con el mismo mecanismo que usa para los demás errores.
7. LA Consola DEBERÁ mostrar a lo sumo 6 líneas a la vez, con desplazamiento interno para las demás.
8. CUANDO la Consola aparece, se pliega, se despliega o recibe una línea, EL alto y el ancho en píxeles de cada Lienzo y el alto del editor DEBERÁN permanecer idénticos a los que tenían antes del cambio.
9. LA Consola DEBERÁ incluir un botón de plegado y desplegado con nombre accesible en español, que exponga su estado con `aria-expanded` (`true` desplegada, `false` plegada) y que se active con `Enter` y con `Espacio`.
10. MIENTRAS la Consola está desplegada, LA Consola DEBERÁ ser alcanzable con `Tab`, permitir el desplazamiento de sus líneas con las flechas arriba y abajo, y permitir salir de ella con `Tab` y `Shift+Tab` en un solo pulso.
11. CUANDO la Consola agrega una línea, EL foco del teclado DEBERÁ permanecer en el elemento que lo tenía antes de agregarla.
12. CUANDO una ejecución termina, con o sin error, y produjo al menos una Operacion_Escribir, LA Interfaz DEBERÁ anunciar en la Region_Anuncios un único mensaje en español que contenga el número de líneas escritas y el texto de la última, sin anunciar cada línea por separado.
13. LA Consola DEBERÁ cumplir contraste mínimo AA (4,5:1 para texto y 3:1 para el borde del botón y el indicador de foco) y obtener todos sus colores de las fichas de `src/estilos/tema.css`, sin colores literales.
14. EL conjunto de pruebas DEBERÁ incluir una prueba de punta a punta que, en un nivel de mundo 4 o mayor, ejecute `ESCRIBE` desde el editor y compruebe tres cosas: la línea con el texto esperado en la Consola, un único mensaje nuevo en la Region_Anuncios al terminar, y que el ancho y el alto de cada Lienzo y el alto del editor son iguales antes y después de la ejecución.

### Requirement 11: ROTULA y RO sobre el lienzo

**User Story:** Como jugador, quiero escribir texto o el valor de una cuenta sobre el lienzo, para rotular mis figuras sin que eso estropee la validación.

#### Acceptance Criteria

1. EL Vocabulario DEBERÁ declarar `ROTULA` con abreviatura `RO`, aridad 1, un argumento que es un Valor_Escribible y `produceValor` falso.
2. CUANDO el Interprete ejecuta `ROTULA` con un Valor_Escribible, EL Interprete DEBERÁ emitir exactamente una Operacion_Rotular que lleve el texto (en Texto_Numerico si el valor es numérico, y sin la comilla inicial si es una palabra), la posición que tenía la tortuga al ejecutar la instrucción y el color de trazo vigente en ese momento.
3. CUANDO el Interprete ejecuta `ROTULA` con el lápiz arriba, EL Interprete DEBERÁ emitir la Operacion_Rotular igual que con el lápiz abajo.
4. CUANDO el Interprete emite una Operacion_Rotular, EL Interprete DEBERÁ dejar sin cambios la posición, el rumbo y el estado del lápiz de la tortuga, y NO DEBERÁ emitir operaciones de movimiento, giro ni cambio de lápiz por esa instrucción.
5. CUANDO el Lienzo aplica una Operacion_Rotular, EL Lienzo DEBERÁ dibujar el texto en horizontal, sin rotarlo según el rumbo de la tortuga, con su punto de anclaje en la posición de la operación, con la tipografía tomada de las fichas de `src/estilos/tema.css` y con el color de la operación resuelto desde esas fichas, sin colores literales.
6. SI el texto de un Rotulo queda total o parcialmente fuera del área visible del lienzo, ENTONCES EL Lienzo DEBERÁ dibujar solo la parte contenida en el área visible, sin lanzar ningún error y sin interrumpir la aplicación de las operaciones siguientes.
7. CUANDO el Lienzo aplica un `BORRAPANTALLA`, EL Lienzo DEBERÁ borrar en ese mismo momento la estela y todos los Rotulo dibujados hasta entonces, y los Rotulo posteriores DEBERÁN dibujarse con normalidad.
8. EL Extractor_Segmentos DEBERÁ ignorar las Operacion_Rotular, de modo que la lista de segmentos de un programa con `ROTULA` sea idéntica a la del mismo programa sin esas instrucciones, y el Validador, el diff visual y la Divergencia DEBERÁN producir el mismo resultado con y sin Rotulo.
9. CUANDO se aplica una Operacion_Rotular, LA Interfaz DEBERÁ anunciar en la Region_Anuncios un mensaje en español que incluya el texto rotulado, sin crear ninguna región `aria-live` adicional.
10. DONDE `prefers-reduced-motion` está activo, EL Lienzo DEBERÁ dibujar cada Rotulo completo y sin animación de aparición, en el mismo instante en que dibuja el resto de la estela.
11. SI el mundo del nivel es menor que 4, ENTONCES EL Parser DEBERÁ reportar `comandoBloqueado` para `ROTULA` y `RO`, con el mundo 4 como mundo de desbloqueo.
12. EL conjunto de pruebas DEBERÁ verificar que un programa del jugador que dibuja la figura correcta y además usa `ROTULA` (con el lápiz arriba, con el lápiz abajo y con el texto fuera del área visible) obtiene la estrella de precisión, igual que el mismo programa sin `ROTULA`.
13. SI `ROTULA` o `RO` no tiene argumento, ENTONCES EL Parser DEBERÁ reportar `argumentoFaltante`, el error existente, y NO DEBERÁ emitirse ninguna Operacion_Rotular.

### Requirement 12: Conciliación del vocabulario del mundo 4

**User Story:** Como mantenedor, quiero que `vocabulario.ts` diga lo mismo que el steering para los comandos del mundo 4, para que el lexer, el panel y los errores lean una sola verdad.

#### Acceptance Criteria

1. EL Vocabulario DEBERÁ declarar `AZAR` con mundo 4, aridad 1, un argumento numérico, descripción «Elige un número entero al azar entre 0 y n-1.» y ejemplo `ESCRIBE AZAR 100`.
2. EL Vocabulario DEBERÁ declarar `ESCRIBE` y `ROTULA` con un único tipo de argumento nuevo que represente un Valor_Escribible, de modo que ninguna de las dos entradas conserve `palabra` ni `numero` en sus tipos de argumento.
3. EL Vocabulario DEBERÁ declarar `SUMA` y `PRODUCTO` con aridad fija igual a 2, sin usar la aridad variable.
4. EL Vocabulario DEBERÁ declarar como ejecutables las ocho entradas del mundo 4 (`AZAR`, `ESCRIBE`, `ROTULA`, `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE` y `RESTO`) y DEBERÁ declarar como no ejecutables las cuatro entradas del mundo 5 (`SI`, `SINO`, `ALTO` y `DEVUELVE`).
5. LA descripción de cada una de las ocho entradas del mundo 4 DEBERÁ estar redactada en español, no ser vacía y ocupar una sola línea, sin saltos de línea, de a lo sumo 120 caracteres.
6. MIENTRAS el nivel en curso es del mundo 4 o posterior, EL Panel_Comandos DEBERÁ mostrar las ocho entradas del mundo 4, cada una con su nombre, su abreviatura (si la tiene), su descripción y su ejemplo, leídos del Vocabulario.
7. MIENTRAS el nivel en curso es de un mundo menor que 4, EL Panel_Comandos NO DEBERÁ mostrar ninguna de las ocho entradas del mundo 4.
8. CUANDO el texto del editor cambia, EL Panel_Comandos DEBERÁ listar, dentro de los 500 ms siguientes, exactamente los procedimientos con al menos un Parametro que el Parser acepta en ese texto, cada uno con su nombre y sus Parametro en el orden de la cabecera `PARA` (por ejemplo `POLIGONO :lados :largo`).
9. EL conjunto de pruebas DEBERÁ verificar, sobre la tabla completa del Vocabulario y comparando con la normalización del Lexer (sin distinguir mayúsculas ni acentos), que ninguna abreviatura se repite entre dos entradas y que ninguna abreviatura es igual al nombre de otra entrada.
10. EL conjunto de pruebas DEBERÁ verificar que el programa de referencia de cada nivel de los mundos 0 a 3 (y, en los niveles generados, el de al menos 200 semillas) no define ningún procedimiento cuyo nombre sea igual, tras la normalización del Lexer, al nombre o a la abreviatura de una entrada del mundo 4.
### Requirement 13: Conteo de instrucciones con expresiones

**User Story:** Como jugador, quiero que el contador me cuente una cuenta como parte de la instrucción donde la escribo, para que usar una fórmula nunca cueste más que usar un número.

#### Acceptance Criteria

1. EL Conteo DEBERÁ sumar 0 por cada nodo `numeroLiteral`, `referenciaParametro`, `expresionAritmetica`, menos unario, palabra literal y Comando_Operador, a cualquier profundidad de anidamiento dentro del argumento de una instrucción.
2. EL Conteo DEBERÁ sumar exactamente 1 por cada invocación de `ESCRIBE` y de `ROTULA`, sin importar cuántos nodos de expresión o palabras literales tengan sus argumentos.
3. EL Conteo DEBERÁ conservar sin cambios la regla vigente para `PARA … FIN`: la cabecera suma 0, el cuerpo se cuenta una sola vez (sin multiplicar por el número de llamadas) y cada llamada suma 1.
4. PARA TODO programa, reemplazar un argumento numérico por una `Expresion` que valga lo mismo DEBERÁ producir un conteo idéntico al del programa original. En particular, `AVANZA 100`, `AVANZA 50 + 50` y `AVANZA SUMA 50 50` DEBERÁN contar 1 cada uno.
5. CUANDO el Conteo recibe el programa `PARA POLIGONO :lados :largo REPITE :lados [AVANZA :largo GIRADERECHA 360 / :lados] FIN POLIGONO 6 80`, EL Conteo DEBERÁ devolver 4 (1 por `REPITE`, 1 por `AVANZA`, 1 por `GIRADERECHA`, 1 por la llamada `POLIGONO 6 80`, y 0 por la cabecera y por las expresiones).
6. EL Contador_Editor, el cálculo de `presupuestoEstrella` y la evaluación de la estrella de economía DEBERÁN obtener el número de instrucciones llamando a la misma función de `conteo.ts`, y NO DEBERÁN recorrer el AST por su cuenta, de modo que para un mismo programa los tres muestren el mismo valor.
7. SI el AST contiene un nodo cuyo discriminante no pertenece a los tipos de nodo declarados, ENTONCES EL Conteo DEBERÁ devolver un resultado fallido con el error de programación existente `nodoDesconocidoEnConteo`, sin incluir ningún conteo parcial en el resultado.
8. EL comentario de tabla de `conteo.ts` DEBERÁ listar cada tipo de nodo de expresión nuevo del mundo 4 (menos unario, palabra literal y Comando_Operador) con su costo 0, junto a los `numeroLiteral`, `referenciaParametro` y `expresionAritmetica` que ya figuran.

### Requirement 14: Impresor y ida y vuelta

**User Story:** Como mantenedor, quiero que el impresor escriba parámetros, expresiones y los comandos nuevos de modo que volver a analizarlos dé el mismo programa, para que las pistas y el compartir no mientan.

#### Acceptance Criteria

1. CUANDO el Impresor imprime una `definicionProcedimiento`, EL Impresor DEBERÁ escribir la cabecera en una sola línea como `PARA NOMBRE :a :b` (cada `Parametro` con el prefijo `:`, en el orden de la declaración y separados por un espacio), cada instrucción del cuerpo en su propia línea con dos espacios de sangría más que la cabecera, y `FIN` en una línea propia con la misma sangría que `PARA`.
2. CUANDO el Impresor imprime una `invocacionProcedimiento`, EL Impresor DEBERÁ escribir el nombre del procedimiento seguido de sus argumentos en el orden del AST, separados por un espacio, en una sola línea.
3. CUANDO el Impresor imprime una `Expresion`, EL Impresor DEBERÁ escribir paréntesis solo cuando quitarlos haría que el Parser leyera un AST distinto, según estas reglas:
   a. Un operando con operador de menor precedencia que el de su operación padre lleva paréntesis.
   b. El operando derecho con la misma precedencia que su operación padre lleva paréntesis. Así `1 - (2 - 3)` y `8 / (4 / 2)` los conservan, y `(1 - 2) - 3` se imprime como `1 - 2 - 3`.
   c. Un `Comando_Operador` que es operando izquierdo de un `Operador_Infijo` lleva paréntesis, porque `SUMA 1 2 * 3` se lee como `SUMA 1 (2 * 3)`.
4. CUANDO el Impresor imprime un `Comando_Operador`, EL Impresor DEBERÁ escribir su nombre largo en mayúsculas seguido de sus argumentos en el orden del AST (dos en `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE` y `RESTO`; uno en `AZAR`), separados por un espacio. CUANDO imprime un menos unario, DEBERÁ escribir `-` pegado a su operando (`-:largo`, `-(1 + 2)`). CUANDO imprime el literal de palabra de `ESCRIBE` o `ROTULA`, DEBERÁ escribir la comilla inicial seguida de la palabra sin alterarla (`"hola`).
5. CUANDO un argumento de un comando o de un procedimiento empieza con menos unario y no es el primer argumento de esa instrucción, EL Impresor DEBERÁ escribirlo entre paréntesis, de modo que `POLIGONO 6 (-80)` no se lea como el único argumento `6 - 80`.
6. PARA TODO programa que el Parser acepta con el mundo del nivel entre 0 y 4, el Parser aplicado al texto del Impresor DEBERÁ producir un AST equivalente al original (propiedad de ida y vuelta: analizar, imprimir, analizar). Dos ASTs son equivalentes cuando tienen los mismos tipos de nodo, nombres, valores, operadores, parámetros, orden y anidamiento, sin comparar `linea` ni `columna`.
7. SI el AST contiene un nodo que el Impresor no sabe imprimir (un tipo de nodo reservado a un mundo posterior al 4, un operador `=`, `<` o `>`, o un comando que el Vocabulario no declara), ENTONCES EL Impresor DEBERÁ devolver el error `nodoNoImprimible` existente y NO DEBERÁ devolver texto parcial.

### Requirement 15: Catálogo de errores del mundo 4

**User Story:** Como jugador, quiero errores que me digan qué pasó y qué falta, en español y al estilo del Logo original, para corregir mi programa sin adivinar.

#### Acceptance Criteria

1. EL Catalogo_Errores DEBERÁ definir los errores de la tabla siguiente (15 nuevos más la ampliación de `argumentoDeTipoEquivocado`, que ya existe), con los identificadores indicados, todos de severidad `jugador`, y cada mensaje DEBERÁ aceptar como parámetros únicamente los valores variables que su forma contiene (nombre, número de línea, cantidad, símbolo o valor).
2. NINGÚN módulo distinto de `src/lenguaje/errores.ts` DEBERÁ contener el texto de estos mensajes como literal, y una prueba DEBERÁ comprobarlo buscando en el código fuente de `src/` la plantilla de cada mensaje.
3. CADA mensaje de la tabla DEBERÁ estar en español y nombrar la causa del error; CUANDO su forma en la tabla incluya una indicación de qué hacer, el mensaje DEBERÁ incluirla.
4. EL conjunto de pruebas DEBERÁ verificar, para cada mensaje de la tabla, que el texto producido con los valores de ejemplo de la columna «Mensaje (forma)» es idéntico, carácter por carácter, a ese ejemplo. Para `procedimientoArgumentosFaltantes` DEBERÁ verificar además la forma singular (`Falta 1: :largo.`) y la plural (`Faltan 2: :lados :largo.`).
5. SI un mensaje de la tabla incluye un nombre escrito por el jugador (procedimiento, parámetro o palabra), ENTONCES EL Catalogo_Errores DEBERÁ mostrarlo con las mismas letras, mayúsculas, minúsculas y acentos con que el jugador lo escribió, sin normalizarlo.
6. SI un mensaje de la tabla incluye un número de línea, ENTONCES EL Catalogo_Errores DEBERÁ mostrar ese número contado desde 1 y DEBERÁ devolver el mismo valor en el campo de línea del error.

| Id | Cuándo | Mensaje (forma) |
|---|---|---|
| `variableNoDefinida` | `:nombre` no declarado en el `PARA` que lo contiene | `No sé qué vale :largo aquí. ¿La declaraste como parámetro en PARA?` |
| `parametroDuplicado` | un `PARA` repite un parámetro | `El comando POLIGONO declara :lados dos veces. Cada parámetro necesita un nombre distinto.` |
| `procedimientoArgumentosFaltantes` | llamada con menos argumentos | `POLIGONO necesita 2 argumentos (:lados :largo) y solo le diste 1. Falta 1: :largo.` En plural: `Faltan 2: :lados :largo.` |
| `procedimientoArgumentosDeMas` | llamada con más argumentos | `POLIGONO recibe 2 argumentos (:lados :largo), pero en la línea 5 le diste más. Quita lo que sobra.` |
| `argumentoDeTipoEquivocado` | palabra donde se espera un número, ahora también en llamadas | `POLIGONO necesita un número en :lados, pero le diste una palabra: "hola` |
| `operadorSinUso` | `SUMA 1 2` suelto | `SUMA calcula un valor, pero no dijiste qué hacer con él. Por ejemplo: ESCRIBE SUMA 1 2` |
| `aritmeticaBloqueada` | símbolo aritmético antes del mundo 4 | `El símbolo + todavía no está disponible. Se desbloquea en el mundo 4.` |
| `parentesisSinCerrar` | falta `)` | `Falta cerrar el paréntesis que abriste en la línea 3.` |
| `parentesisDeMas` | sobra `)` | `Hay un paréntesis de cierre en la línea 4 que no abriste.` |
| `expresionIncompleta` | operador sin operando | `Falta un número después del símbolo * de la línea 2.` |
| `expresionDemasiadoProfunda` | más de 32 niveles | `Tienes demasiados paréntesis anidados (más de 32). Divide la cuenta en pasos más cortos.` |
| `divisionPorCero` | divisor 0 en ejecución | `Detuve la ejecución: en la línea 4 intentaste dividir entre cero. ¿Qué valor tenía el divisor?` |
| `numeroFueraDeRango` | resultado no finito | `Detuve la ejecución: la cuenta de la línea 3 se volvió demasiado grande para calcularla.` |
| `vecesInvalidas` | `REPITE` con valor no entero o negativo | `Detuve la ejecución: REPITE necesita un número entero de veces y en la línea 3 recibió 2.5.` |
| `azarRangoInvalido` | `AZAR` con valor no válido | `AZAR necesita un entero mayor que 0 y en la línea 2 recibió 0. Por ejemplo: AZAR 100` |
| `guardaEscrituras` | más de 500 escrituras | `Detuve la ejecución: escribiste demasiadas veces en la consola y en el lienzo. ¿Hay una repetición que nunca termina?` |

### Requirement 16: Nivel 4.1, hexágono con POLIGONO (autorado)

**User Story:** Como jugador, quiero que la primera aparición de los parámetros sea una lección escrita a mano, para ver con claridad cómo un procedimiento se vuelve reutilizable.

#### Acceptance Criteria

1. EL catálogo DEBERÁ incluir exactamente un nivel con identificador `4.1`, de mundo 4, tipo autorado, concepto `generalizacion` y una semilla fija que sea la misma en cada carga.
2. LA referencia del nivel 4.1 DEBERÁ ser un AST estructuralmente igual al de `PARA POLIGONO :lados :largo REPITE :lados [AVANZA :largo GIRADERECHA 360 / :lados] FIN POLIGONO 6 80`, sin contar las posiciones de origen del texto.
3. EL nivel 4.1 DEBERÁ declarar `normalizacion` con `traslacion: 'fija'`, `rotacion: 'fija'` y `escala: 'exacta'`, y su enunciado DEBERÁ mencionar que la posición de partida y el rumbo de partida importan.
4. EL nivel 4.1 DEBERÁ declarar la exigencia de abstracción `usaParametros`, que se cumple solo si el programa del jugador define un `PARA` con al menos un parámetro, usa ese parámetro en su cuerpo e invoca el procedimiento al menos una vez.
5. EL `presupuestoEstrella` del nivel 4.1 DEBERÁ derivarse del Conteo de su referencia, con valor 4, y los datos del nivel NO DEBERÁN contener un valor escrito a mano para `presupuestoEstrella`.
6. CUANDO el jugador ejecuta en el 4.1 un programa cuya estela coincide con la referencia, usa un `PARA` con parámetros invocado al menos una vez y cuenta 4 instrucciones o menos, EL sistema DEBERÁ otorgar las tres estrellas (precisión, economía y abstracción).
7. CUANDO el jugador ejecuta en el 4.1 `REPITE 6 [AVANZA 80 GIRADERECHA 60]` (conteo 2), EL sistema DEBERÁ otorgar la estrella de precisión y la de economía, y NO DEBERÁ otorgar la de abstracción.
8. EL nivel 4.1 DEBERÁ declarar exactamente tres pistas, en este orden: conceptual, matemática y esqueleto con huecos en los números. El esqueleto NO DEBERÁ coincidir con la referencia impresa completa.
9. EL conjunto de pruebas DEBERÁ ejecutar la referencia del nivel 4.1 y verificar que produce seis segmentos de longitud 80 unidos por giros de 60 grados, y que aprueba su propio nivel con las tres estrellas.

### Requirement 17: Nivel 4.2, tres polígonos con un solo procedimiento (generado)

**User Story:** Como jugador, quiero que un único procedimiento sirva para tres polígonos distintos, para descubrir que un procedimiento con parámetros resuelve una familia de problemas.

#### Acceptance Criteria

1. EL catálogo DEBERÁ incluir el nivel `4.2`, de mundo 4, tipo generado, concepto `generalizacion`, con su Generador_M4 registrado en `src/niveles/generadores/registro.ts`.
2. EL Generador_M4 del nivel 4.2 DEBERÁ producir una referencia que contenga exactamente una definición `PARA POLIGONO :lados :largo` y exactamente tres llamadas consecutivas a `POLIGONO`, sin ninguna instrucción de movimiento ni de giro entre ellas, con tres valores de `:lados` distintos entre sí y dentro del rango de 3 a 8 inclusive, un mismo valor de `:largo` en las tres llamadas, y el mismo punto y rumbo de partida para los tres polígonos.
3. EL nivel 4.2 DEBERÁ declarar las exigencias de abstracción `usaParametros` y `maximoProcedimientos` con valor máximo de 1.
4. EL nivel 4.2 DEBERÁ declarar `margenLimiteDuro` con valor 6 y NO DEBERÁ declarar `presupuestoEstrella` ni `limiteDuro`, de modo que ambos se deriven del Conteo de la referencia (`presupuestoEstrella` de 6 y `limiteDuro` de 12).
5. CUANDO el jugador envía al 4.2 el Rodeo_Tres_Procedimientos (conteo 12), EL sistema DEBERÁ ejecutarlo sin mostrar el `limiteDuroExcedido`, otorgar la estrella de precisión, NO otorgar la de economía y NO otorgar la de abstracción.
6. CUANDO el jugador envía al 4.2 tres `REPITE` sin ningún `PARA`, cada uno con `AVANZA` y `GIRADERECHA` en su cuerpo (conteo 9), EL sistema DEBERÁ ejecutarlo sin mostrar el `limiteDuroExcedido`, otorgar la estrella de precisión y NO otorgar la de economía ni la de abstracción.
7. CUANDO el jugador envía al 4.2 una única definición `PARA` con al menos un parámetro usado en su cuerpo, invocada tres veces, con un conteo menor o igual que el `presupuestoEstrella` y que reproduce la figura de la referencia, EL sistema DEBERÁ otorgar las tres estrellas.
8. EL conjunto de pruebas DEBERÁ construir el Rodeo_Tres_Procedimientos a partir de la referencia de al menos 200 semillas distintas del 4.2 y verificar, para cada una, que su Conteo es menor o igual que el `limiteDuro` del reto.
9. EL enunciado del nivel 4.2 DEBERÁ mencionar de forma explícita que la posición de partida y el rumbo de partida importan.

### Requirement 18: Nivel 4.3, polígonos concéntricos (generado)

**User Story:** Como jugador, quiero dibujar el mismo polígono con lados cada vez más largos, para practicar cambiar un parámetro de una llamada a otra.

#### Acceptance Criteria

1. EL catálogo DEBERÁ incluir el nivel `4.3`, de mundo 4, tipo generado, concepto `generalizacion`, con su generador registrado en `src/niveles/generadores/registro.ts`.
2. EL Generador_M4 del nivel 4.3 DEBERÁ producir una referencia con una única definición `PARA POLIGONO :lados :largo`, con el mismo cuerpo que la referencia del nivel 4.1, seguida de entre 3 y 5 llamadas a `POLIGONO` (ambos extremos incluidos) y de ninguna otra instrucción entre ellas, de modo que todas parten del mismo punto y rumbo.
3. EL Generador_M4 del nivel 4.3 DEBERÁ producir, en todas las llamadas de una misma referencia, el mismo valor de `:lados`, entero entre 3 y 8, y valores de `:largo` múltiplos de 20 donde cada llamada suma exactamente 20 al `:largo` de la anterior.
4. EL Generador_M4 del nivel 4.3 DEBERÁ producir una referencia que solo use comandos cuyo mundo de desbloqueo en el Vocabulario sea menor o igual que 4 y en la que ningún procedimiento se invoque a sí mismo, directa o indirectamente.
5. EL nivel 4.3 DEBERÁ declarar la exigencia de abstracción `usaParametros`, y DEBERÁ no escribir `presupuestoEstrella`, `limiteDuro` ni `margenLimiteDuro`, de modo que rija el margen por omisión de 3.
6. CUANDO el jugador resuelve el 4.3 con una repetición a mano de cada polígono sin `PARA` y el conteo de su programa es menor o igual que el `limiteDuro`, EL sistema DEBERÁ ejecutarlo, otorgar la estrella de precisión y no otorgar las estrellas de economía ni de abstracción.
7. SI el jugador envía al 4.3 un programa sin `PARA` con una repetición a mano de cada polígono y su conteo excede el `limiteDuro`, ENTONCES EL sistema DEBERÁ no ejecutarlo, no otorgar ninguna estrella y mostrar el `limiteDuroExcedido` del mundo 4, con la cuenta exacta.
8. CUANDO el jugador resuelve el 4.3 con la referencia, EL sistema DEBERÁ otorgar las tres estrellas.
9. EL enunciado del nivel 4.3 DEBERÁ mencionar expresamente que la posición y el rumbo de partida importan para que el dibujo sea válido.
### Requirement 19: Nivel 4.4, estrella de n puntas parametrizada (generado)

**User Story:** Como jugador, quiero generalizar la estrella con el número de puntas como parámetro, para ver que el giro depende de `:puntas` y no es un número fijo.

#### Acceptance Criteria

1. EL catálogo DEBERÁ incluir el nivel `4.4`, de mundo 4, tipo generado, concepto `generalizacion`, con su generador registrado en `src/niveles/generadores/registro.ts`.
2. EL Generador_M4 del nivel 4.4 DEBERÁ producir una referencia compuesta por exactamente una definición `PARA ESTRELLA :puntas :largo`, cuyo cuerpo es `REPITE :puntas [AVANZA :largo GIRADERECHA 360 * 2 / :puntas]`, y exactamente una llamada a `ESTRELLA` con dos argumentos numéricos literales, sin otras instrucciones.
3. EL Generador_M4 del nivel 4.4 DEBERÁ elegir el número de puntas de la llamada entre los valores 5, 7, 9 y 11, y el `:largo` dentro de los límites del requisito 20 (múltiplo de 20 entre 40 y 200).
4. EL nivel 4.4 DEBERÁ declarar la exigencia de abstracción `usaParametros`, que se cumple solo si el programa del jugador define un `PARA` con al menos un parámetro, usa ese parámetro en su cuerpo e invoca el procedimiento al menos una vez.
5. CUANDO el jugador resuelve el 4.4 con la referencia, EL sistema DEBERÁ otorgar las tres estrellas para cualquier semilla.
6. CUANDO el jugador resuelve el 4.4 con un programa sin `PARA` con parámetros que dibuja la estrella con `REPITE` y números literales en lugar de `:puntas` y `:largo` (por ejemplo, `REPITE 7 [AVANZA 100 GIRADERECHA 720 / 7]` para un reto de 7 puntas y largo 100), EL sistema DEBERÁ otorgar la estrella de precisión y la de economía, y NO DEBERÁ otorgar la de abstracción.
7. EL enunciado del nivel 4.4 DEBERÁ advertir que la posición y el rumbo de partida importan.

### Requirement 20: Reglas comunes de los generadores y presupuestos del mundo 4

**User Story:** Como mantenedor, quiero que los tres generadores del mundo 4 cumplan las mismas reglas de justicia y de datos que los de los mundos anteriores, para que ningún reto sea injusto, irresoluble o dependa del azar del navegador.

#### Acceptance Criteria

1. CADA Generador_M4 DEBERÁ ser una función pura que cumple el contrato `Generador` de `src/niveles/tipos.ts` y cuyo archivo importa únicamente de `lenguaje/` y `azar/`.
2. CADA Generador_M4 DEBERÁ obtener toda su aleatoriedad de un PRNG creado con la semilla del intento y NO DEBERÁ invocar `Math.random`.
3. CADA Generador_M4 DEBERÁ producir como referencia un AST (no texto ni imágenes) que contiene la definición del procedimiento con sus parámetros y los argumentos de giro como `Expresion` sin evaluar, de modo que `360 / :lados` (o `360 * 2 / :puntas` en el 4.4) aparezca como expresión y no como número.
4. CADA Generador_M4 DEBERÁ emitir solo valores de `:largo` que sean múltiplos de 20 entre 40 y 200 inclusive, y solo giros que, al evaluarse, valgan `360 / n` con `n` entero entre 3 y 12 inclusive (niveles 4.2 y 4.3) o `360 * 2 / puntas` (nivel 4.4).
5. CADA Generador_M4 DEBERÁ usar solo vocabulario con mundo menor o igual que 4 y NO DEBERÁ emitir `AZAR`, `SI` ni llamadas recursivas.
6. CADA reto de un Generador_M4 DEBERÁ cumplir tres condiciones: su caja envolvente queda dentro del lienzo de 800 × 800 px, su ancho y su alto miden al menos 200 px cada uno, y no es una figura degenerada.
7. SI un candidato de un Generador_M4 incumple alguna condición del criterio 6, ENTONCES EL generador DEBERÁ descartarlo y reintentar con la semilla siguiente, hasta un máximo de 200 intentos por reto.
8. SI un Generador_M4 agota los 200 intentos sin un candidato válido, ENTONCES EL generador DEBERÁ devolver un resultado de fallo con un error del Catalogo_Errores y el número de intentos realizados, sin lanzar una excepción.
9. CUANDO se ejecuta un Generador_M4 dos veces con la misma semilla y los mismos parámetros, EL generador DEBERÁ devolver ASTs estructuralmente idénticos (igualdad profunda) y la misma semilla efectiva.
10. CADA nivel del mundo 4 (4.1 a 4.4) DEBERÁ declarar `normalizacion` con `traslacion: 'fija'`, `rotacion: 'fija'` y `escala: 'exacta'`.
11. CUANDO el sistema construye un reto de un nivel del mundo 4, EL sistema DEBERÁ derivar `presupuestoEstrella` del Conteo de la referencia, fijar `limiteDuro` en `presupuestoEstrella` más el `margenLimiteDuro` del nivel (3 si el nivel no lo declara) y fijar `limiteDuroActivo` en verdadero.
12. NINGÚN nivel del mundo 4 DEBERÁ declarar en sus datos `presupuestoEstrella` ni `limiteDuro`; el único valor de límite que un nivel del mundo 4 puede declarar es `margenLimiteDuro`, y solo el nivel 4.2, con valor 6.
13. MIENTRAS `limiteDuroActivo` es verdadero, SI el conteo del programa del jugador es mayor que el `limiteDuro`, ENTONCES EL sistema DEBERÁ no ejecutar el programa (sin emitir ninguna operación) y mostrar el mensaje `limiteDuroExcedido` del mundo 4, que incluye el conteo del programa, el `limiteDuro` y la sugerencia de usar parámetros.
14. LOS niveles 4.1, 4.2, 4.3 y 4.4 DEBERÁN estar definidos como datos en `src/niveles/mundo-4-parametros.ts`, y `src/niveles/catalogo.ts` DEBERÁ incluirlos en ese orden inmediatamente después del último nivel del mundo 3.
15. EL conjunto de pruebas DEBERÁ verificar, para cada Generador_M4 y sobre al menos 200 semillas distintas, que el reto cumple las condiciones del criterio 6 y que ejecutar su propia referencia obtiene las tres estrellas.
16. EL conjunto de pruebas DEBERÁ verificar, para cada nivel 4.1 a 4.4, que su referencia se ejecuta con el mismo Interprete que el programa del jugador y que no contiene `AZAR`.
17. LAS regresiones de tres estrellas del mundo 4 sobre 200 semillas DEBERÁN usar la constante compartida `TIMEOUT_TRES_ESTRELLAS`, de 180 000 ms, como tiempo máximo de la prueba, sin repetir ese valor como literal.

### Requirement 21: Estrella de abstracción con usaParametros y maximoProcedimientos

**User Story:** Como jugador, quiero que la estrella de abstracción premie usar un procedimiento con parámetros de verdad, para que dejar un `PARA` sin usar no me la regale.

#### Acceptance Criteria

1. CUANDO el análisis de abstracción evalúa la exigencia `usaParametros`, EL análisis DEBERÁ confirmarla si y solo si existe al menos un mismo `PARA` que cumple las tres condiciones: (a) declara uno o más parámetros, (b) su cuerpo referencia al menos uno de sus propios parámetros en cualquier `Expresion`, incluidas las anidadas, y (c) es invocado al menos una vez en cualquier parte del programa. Una referencia a un parámetro en el cuerpo de otro `PARA` no cuenta como uso.
2. CUANDO el análisis de abstracción evalúa la exigencia `maximoProcedimientos`, EL análisis DEBERÁ contar todas las definiciones `PARA` del programa, con o sin parámetros e invocadas o no, y DEBERÁ confirmarla si y solo si ese número es menor o igual que el máximo declarado por el nivel.
3. CUANDO el nivel declara `usaParametros` y `maximoProcedimientos` con máximo 1, EL análisis DEBERÁ evaluar cada exigencia por separado y DEBERÁ listar como sin confirmar cualquiera que no se cumpla. Un programa sin ningún `PARA` DEBERÁ confirmar `maximoProcedimientos` (0 ≤ 1) y DEBERÁ no confirmar `usaParametros`.
4. SI el programa define un `PARA` con parámetros que no se invoca en ninguna parte del programa, ENTONCES EL análisis DEBERÁ no confirmar `usaParametros` por ese `PARA`, aunque su cuerpo use sus parámetros.
5. EL análisis de abstracción DEBERÁ recorrer todos los tipos de nodo de expresión, incluidos Comando_Operador, menos unario y literal de palabra, de modo que un parámetro referenciado dentro de cualquiera de ellos (por ejemplo `AVANZA SUMA :largo 10` o `AVANZA -:largo`) cuente como usado, y de modo que el compilador de TypeScript rechace un recorrido que deje un tipo de nodo sin tratar.
6. SI la estrella de precisión no se otorgó, ENTONCES EL sistema DEBERÁ no otorgar la estrella de abstracción, aunque todas las exigencias de abstracción del nivel estén confirmadas.
7. CUANDO el programa del jugador declara dos o más procedimientos con parámetros en el nivel 4.2, EL análisis DEBERÁ no confirmar `maximoProcedimientos`, porque el máximo declarado es 1.
8. EL conjunto de pruebas DEBERÁ cubrir `usaParametros` y `maximoProcedimientos` con al menos estos casos: un programa que cumple ambas; un programa sin `PARA` (criterio 3); un `PARA` con parámetros que no usa en su cuerpo; un `PARA` con parámetros usados pero sin invocar (criterio 4); un parámetro usado solo dentro de una expresión anidada (criterio 5); y dos `PARA` con parámetros en el nivel 4.2 (criterio 7).

### Requirement 22: Explicación de Kiro cuando falta la abstracción

**User Story:** Como jugador, quiero que Kiro me diga exactamente por qué no ganó la estrella de abstracción, para convertir un nivel resuelto a medias en una lección.

#### Acceptance Criteria

1. CUANDO el jugador gana la estrella de precisión y el análisis de abstracción deja `usaParametros` sin confirmar, EL Globo_Kiro DEBERÁ mostrar el texto de `usaParametros` del Catalogo_Errores y NO DEBERÁ mostrar el texto genérico que hoy aparece para cualquier exigencia de abstracción sin confirmar.
2. CUANDO el jugador gana la estrella de precisión y el análisis de abstracción deja `maximoProcedimientos` sin confirmar, EL Globo_Kiro DEBERÁ mostrar el texto de `maximoProcedimientos` del Catalogo_Errores, con el número de procedimientos `PARA` definidos por el jugador y el máximo declarado por el nivel sustituidos en el texto, y NO DEBERÁ mostrar el texto genérico.
3. CUANDO el jugador gana la estrella de precisión y el análisis deja sin confirmar `usaParametros` y `maximoProcedimientos` a la vez, EL Globo_Kiro DEBERÁ mostrar en un único globo los dos textos, cada uno en su propia línea, en el mismo orden en que el nivel declara las exigencias, y NO DEBERÁ mostrar el texto genérico.
4. EL Catalogo_Errores DEBERÁ definir los dos textos como invitaciones (sin las palabras «error», «fallo» ni «incorrecto»), en español y en la voz de Kiro, con esta forma exacta, donde `{definidos}` y `{maximo}` son los valores sustituidos en la ejecución:
   - `usaParametros`: `Lo lograste, pero dibujaste con números fijos. Intenta enseñarme un PARA con parámetros, como :lados, y luego pídemelo cambiando los números.`
   - `maximoProcedimientos`: `Lo lograste, pero definiste {definidos} procedimientos y para este reto basta con {maximo}. Enséñame uno solo con parámetros y pídemelo varias veces con números distintos.`
5. EL Globo_Kiro NO DEBERÁ mostrar texto de explicación de abstracción CUANDO el jugador no gana la estrella de precisión o CUANDO el análisis confirma todas las exigencias de abstracción del nivel.
6. LAS explicaciones NO DEBERÁN contener la figura, el texto o el AST del programa de referencia ni el valor de `presupuestoEstrella`; los únicos números variables que pueden contener son `{definidos}` y `{maximo}`.
7. CUANDO se muestra una explicación de abstracción, EL sistema DEBERÁ otorgar y registrar las estrellas de precisión y economía con el mismo resultado que obtendría sin la explicación, y DEBERÁ registrarlas antes de que el Globo_Kiro muestre la explicación.
8. EL conjunto de pruebas DEBERÁ verificar, con comparación de texto exacto:
   - el texto de `usaParametros`;
   - el texto de `maximoProcedimientos` con al menos dos pares distintos de `{definidos}` y `{maximo}`;
   - el orden y la separación en líneas del caso de las dos exigencias sin confirmar;
   - los casos de ausencia del criterio 5;
   - el criterio 7.

### Requirement 23: Pistas de los niveles del mundo 4

**User Story:** Como jugador atascado, quiero tres pistas por nivel que nunca me den la respuesta directa y que digan la verdad sobre mi reto, para avanzar sin que me arruinen el descubrimiento.

#### Acceptance Criteria

1. CADA nivel del mundo 4 (4.1, 4.2, 4.3 y 4.4) DEBERÁ declarar exactamente tres pistas, no vacías y en español, en este orden de posición: la primera conceptual, la segunda matemática y la tercera esqueleto con huecos.
2. PARA CADA pista de los niveles generados 4.2, 4.3 y 4.4 que mencione un valor del reto, EL sistema DEBERÁ construirla como plantilla y rellenarla con valores leídos del AST de la referencia del reto, nunca de texto fijo. Los valores son: en el 4.2, los tres números de lados y el `:largo`; en el 4.3, el número de lados y el número de llamadas (copias); en el 4.4, el número de puntas.
3. LA pista matemática de los niveles 4.2 y 4.3 DEBERÁ contener el número `360` y el nombre `:lados`, y explicar que la tortuga da una vuelta completa de 360 grados repartidos entre `:lados`. LA pista matemática del nivel 4.4 DEBERÁ contener la expresión `360 * 2` y el nombre `:puntas`, y explicar que ese giro se reparte entre `:puntas`.
4. EL esqueleto de cada nivel DEBERÁ generarse con el Impresor a partir del AST de la referencia, con un marcador de hueco visible en lugar de cada literal numérico, de modo que contenga al menos un hueco, ningún literal numérico de la referencia y un texto distinto del que el Impresor produce para la referencia completa.
5. LA pista conceptual del nivel 4.2 DEBERÁ estar formulada como pregunta (entre `¿` y `?`) sobre qué cambia de un polígono al siguiente y qué se repite, y NO DEBERÁ contener como numeral ningún valor de lados ni de `:largo` de la referencia.
6. EL conjunto de pruebas DEBERÁ verificar, sobre al menos 200 semillas por cada nivel generado del mundo 4, que cada una de sus tres pistas: (a) no contiene ningún marcador de plantilla sin sustituir; (b) contiene los valores de la referencia que su plantilla declara; (c) es idéntica al ejecutar el generador dos veces con la misma semilla; y que el esqueleto difiere del texto impreso de la referencia.
7. NINGUNA pista de los niveles del mundo 4 DEBERÁ contener el texto impreso del programa de referencia completo ni el de su definición `PARA` completa.

### Requirement 24: Insignia Generalización, desbloqueo y desafío infinito

**User Story:** Como jugador, quiero que completar el mundo 4 con las tres estrellas me dé la insignia *Generalización* y abra su desafío infinito, para sentir que dominé el concepto.

#### Acceptance Criteria

1. EL módulo `src/juego/insignias.ts` DEBERÁ incluir `generalizacion` en el tipo `IdInsigniaDeConcepto`, asociarla al mundo 4 en `MUNDO_DE_INSIGNIA` y listarla en `INSIGNIAS_DE_CONCEPTO`, sin aserciones de tipo (`as`, `!`, `<T>`) y con `tsc --noEmit` sin errores.
2. CUANDO el progreso guardado contiene las tres estrellas (precisión, economía y abstracción) en cada uno de los niveles 4.1, 4.2, 4.3 y 4.4, EL sistema DEBERÁ otorgar la Insignia_Generalizacion, y DEBERÁ registrarla exactamente una vez aunque la evaluación se repita o se vuelvan a resolver esos niveles.
3. SI al menos uno de los niveles 4.1, 4.2, 4.3 o 4.4 no tiene guardadas las tres estrellas, ENTONCES EL sistema NO DEBERÁ otorgar la Insignia_Generalizacion.
4. CUANDO el jugador tiene la estrella de precisión guardada en todos los niveles del mundo 3, EL sistema DEBERÁ desbloquear el mundo 4 y los comandos que su vocabulario habilita, aplicando la regla de `src/juego/desbloqueo.ts` sin modificarla.
5. MIENTRAS la Insignia_Generalizacion esté otorgada, EL Desafio_Infinito del mundo 4 DEBERÁ estar disponible, y MIENTRAS no lo esté, NO DEBERÁ estar disponible.
6. CUANDO el Desafio_Infinito del mundo 4 genera retos consecutivos, EL sistema DEBERÁ usar los niveles 4.2, 4.3 y 4.4 de forma cíclica en el orden del catálogo (4.2, 4.3, 4.4, 4.2, …), y para una misma semilla inicial DEBERÁ producir la misma secuencia de niveles y retos.
7. EL comentario de `src/juego/desafio-infinito.ts` que afirma que los mundos 4 y 5 no tienen niveles generados DEBERÁ reescribirse para que no afirme eso del mundo 4 y sí del mundo 5.
8. EL nombre del mundo 4 («Parámetros») y el de su insignia («Generalización») DEBERÁN leerse de `src/niveles/mundos.ts`, sin literales duplicados en `src/juego/insignias.ts` ni en `src/juego/desafio-infinito.ts`.
9. CUANDO se ejecuta el conjunto de pruebas existente de `src/juego/insignias.test.ts`, TODAS sus pruebas anteriores DEBERÁN pasar sin modificar sus aserciones.

### Requirement 25: Integración con el flujo de ejecución existente

**User Story:** Como jugador, quiero que la demostración, el paso a paso, la reproducción en paralelo, «otro reto» y la semilla visible funcionen en el mundo 4 como en los anteriores, para no tener que aprender una interfaz distinta.

#### Acceptance Criteria

1. CUANDO el jugador entra a un nivel del mundo 4, EL sistema DEBERÁ ejecutar la demostración de Kiro con el mismo Interprete que ejecuta el programa del jugador, sobre el AST de la referencia, y dibujar en el Lienzo cada tramo y cada giro que produce la referencia, incluidos los tramos que dibuja cada llamada al procedimiento, en el orden en que el Interprete los emite.
2. CUANDO el jugador pide «otro reto igual» en un nivel generado del mundo 4, EL sistema DEBERÁ elegir una semilla distinta de la del reto actual, mostrar el código corto de la nueva semilla y reiniciar la demostración con la referencia que el generador produce para esa semilla.
3. CUANDO el jugador reproduce un código de semilla válido en un nivel generado del mundo 4, EL sistema DEBERÁ producir el mismo reto que produjo ese código antes: la misma semilla efectiva, un AST de referencia equivalente, el mismo `presupuestoEstrella` y el mismo `limiteDuro`.
4. SI `decodificar` de `src/azar/codigo-semilla.ts` devuelve un error para el código que el jugador reproduce en un nivel generado del mundo 4, ENTONCES EL Globo_Kiro DEBERÁ mostrar el mensaje de ese error y EL sistema DEBERÁ conservar sin cambios el reto, la semilla y el programa del editor.
5. EL sistema DEBERÁ mostrar la semilla de cada reto del mundo 4 como el código de 7 caracteres que produce `codificar` de `src/azar/codigo-semilla.ts`, y el código mostrado DEBERÁ ser el mismo que reproduce el reto al introducirlo.
6. MIENTRAS el jugador ejecuta paso a paso un programa del mundo 4, CUANDO el Interprete ejecuta una instrucción dentro del cuerpo de un procedimiento, EL sistema DEBERÁ resaltar al mismo tiempo la línea de esa instrucción en el cuerpo y la línea de la llamada que la contiene, y DEBERÁ retirar el resaltado de la llamada cuando el procedimiento termina.
7. CUANDO el jugador usa la reproducción en paralelo en el mundo 4, LA Divergencia DEBERÁ comparar únicamente las operaciones de movimiento y de giro, ignorando las Operacion_Escribir y las Operacion_Rotular, y DEBERÁ señalar como punto de separación el número de orden (empezando en 1) de la primera operación comparada que difiere. SI una de las dos ejecuciones termina antes que la otra, ENTONCES la separación DEBERÁ señalarse en la primera operación que solo existe en la más larga. Este resultado DEBERÁ ser el mismo aunque los programas usen procedimientos, parámetros o expresiones distintas.
8. SI una ejecución del mundo 4 se detiene con `divisionPorCero`, `numeroFueraDeRango`, `vecesInvalidas`, `azarRangoInvalido` o `guardaEscrituras`, ENTONCES EL Globo_Kiro DEBERÁ mostrar el mensaje de ese error del Catalogo_Errores con el número de línea que corresponda, EL Lienzo DEBERÁ conservar dibujadas todas las operaciones emitidas antes del error y no dibujar ninguna posterior, y EL sistema DEBERÁ conservar el programa del editor sin cambios.
9. CUANDO el Interprete aplica una operación de movimiento, giro o cambio de lápiz durante una ejecución del mundo 4, incluidas las que ocurren dentro del cuerpo de un procedimiento, EL sistema DEBERÁ anunciar en la Region_Anuncios la posición, el rumbo y el estado del lápiz resultantes.
10. EN el mundo 4, EL editor y el Panel_Comandos DEBERÁN poder recorrerse solo con teclado: `Tab` y `Shift+Tab` DEBERÁN sacar el foco de cada uno, y activar con `Enter` o `Espacio` un comando del mundo 4 en el Panel_Comandos DEBERÁ insertar en el editor el texto de `insercion` de ese comando.
11. MIENTRAS el conteo del programa del editor excede el `limiteDuro` de un nivel del mundo 4, EL Contador_Editor DEBERÁ mostrar el conteo y el `limiteDuro` junto a un texto que indique que el programa no se ejecutará, sin depender solo del color, y DEBERÁ retirar esa señal cuando el conteo deja de excederlo.

### Requirement 26: Documentación y steering

**User Story:** Como mantenedor, quiero que el steering y la bitácora reflejen las decisiones de esta spec, para que quien escriba el mundo 5 sepa qué ámbito, qué aritmética y qué azar heredó.

#### Acceptance Criteria

1. EL archivo `.kiro/steering/lenguaje-kirologo.md` DEBERÁ contener, en la tabla del mundo 4, una fila por cada uno de estos comandos con la firma indicada: `SUMA` y `PRODUCTO` con exactamente dos argumentos, `AZAR n` con resultado entre 0 y n-1 sembrado con la semilla del reto, `ESCRIBE`/`ES` con un valor, y `ROTULA`/`RO` con texto o valor numérico. DEBERÁ además incluir una sección con los paréntesis y la tabla de precedencia (paréntesis y menos unario, luego `*` y `/`, luego `+` y `-`, con asociatividad por la izquierda). NO DEBERÁ conservar la descripción «dos o más números» para `SUMA` ni `PRODUCTO`.
2. EL archivo `.kiro/steering/lenguaje-kirologo.md` DEBERÁ contener una sección que defina el Ambito_Lexico, el paso de parámetros por valor y la ausencia de asignación, y DEBERÁ incluir una frase explícita que indique que el mundo 5 hereda esas tres reglas para su recursión.
3. EL archivo `.kiro/steering/lenguaje-kirologo.md` DEBERÁ documentar la regla de conteo: las expresiones, las referencias a Parametro y los Comando_Operador cuentan 0, y `ESCRIBE` y `ROTULA` cuentan 1. DEBERÁ incluir como ejemplo que `AVANZA 100`, `AVANZA 50 + 50` y `AVANZA SUMA 50 50` cuestan 1 cada uno.
4. EL archivo `.kiro/steering/lenguaje-kirologo.md` DEBERÁ listar cada identificador de error que esta spec agrega a `src/lenguaje/errores.ts`, entre ellos `variableNoDefinida`, `parentesisSinCerrar` y `parentesisDeMas`, y DEBERÁ indicar la causa de cada uno en una frase.
5. EL archivo `.kiro/steering/niveles-y-progresion.md` DEBERÁ contener una entrada por cada nivel 4.1, 4.2, 4.3 y 4.4 que coincida con lo implementado en `src/niveles/mundo-4-parametros.ts` e indique, de cada nivel, su objetivo y sus exigencias de abstracción. La entrada del nivel 4.2 DEBERÁ declarar `margenLimiteDuro` de 6 y su razón: la referencia cuenta 6, el rodeo de tres procedimientos cuenta 12, y con el margen por omisión de 3 el límite sería 9 y bloquearía ese rodeo.
6. EL archivo `.kiro/steering/validacion-geometrica.md` DEBERÁ declarar que `ESCRIBE` y `ROTULA` no participan en la comparación geométrica, y que `usaParametros` exige que el procedimiento parametrizado se invoque al menos una vez.
7. LA bitácora `docs/bitacora.md` DEBERÁ contener una entrada por cada una de las decisiones 1 a 10 de esta spec, y cada entrada DEBERÁ incluir la decisión, su razón y las alternativas descartadas.
8. TODO texto añadido o modificado por esta spec en los archivos de los criterios 1 a 7 DEBERÁ estar escrito en español, salvo los términos técnicos estándar del ecosistema (`AST`, `token`, `lexer`, `parser`) y los identificadores de código.

### Requirement 27: Base de código, integración y definición de terminado

**User Story:** Como mantenedor, quiero que la spec se implemente sobre la base correcta y se fusione con las mismas reglas que las anteriores, para conservar un historial rastreable y evitar perder el trabajo de los mundos 1 a 3.

#### Acceptance Criteria

1. CUANDO el equipo crea la rama de esta spec, DEBERÁ crearla a partir de `spec-04-mundo-3`, o a partir de `main` si `spec-04-mundo-3` ya está fusionada en `main`, y DEBERÁ hacerlo antes del primer commit de implementación de esta spec.
2. CUANDO el equipo incorpora a la rama de esta spec los cambios de `main`, DEBERÁ usar `git merge` y NO DEBERÁ usar `git rebase`, de modo que el historial de la rama no se reescriba.
3. CUANDO el PR de esta spec se fusiona a `main`, EL equipo DEBERÁ usar la estrategia de merge commit y NO DEBERÁ usar squash ni rebase.
4. CUANDO se solicita la aprobación del PR, EL equipo DEBERÁ haber ejecutado `npm ci`, `npm run typecheck`, `npm run build` y `npm test -- --maxWorkers=2` sobre la rama del PR, y cada uno de los cuatro comandos DEBERÁ terminar con código de salida 0.
5. CUANDO se solicita la aprobación del PR, EL revisor DEBERÁ verificar que el código de la rama cumple todas estas reglas del steering, y el PR NO DEBERÁ aprobarse si alguna falla:
   a. No hay `Math.random` en `src/` fuera de `src/azar/prng.ts` (excluidas las pruebas).
   b. No hay `eval` ni `new Function` en `src/`.
   c. `vite.config.ts` conserva `base: '/'`.
   d. Ningún identificador, comando ni mensaje del dominio tiene alias en inglés.
   e. Ningún literal de mensaje visible al jugador está fuera de `src/lenguaje/errores.ts`.
   f. Ningún nivel de `src/niveles/` escribe a mano un `presupuestoEstrella` ni un `limiteDuro`, salvo que los derive del conteo de la referencia.
   g. Toda dependencia nueva en `package.json` tiene versión exacta, sin rango, y una licencia compatible con MIT.
6. EL conjunto de pruebas DEBERÁ cubrir las seis áreas siguientes, y el plan de tareas DEBERÁ escribirlas en este orden de prioridad: (1) lexer y parser con los mensajes exactos en español, (2) intérprete y guardas de ejecución, (3) validador, (4) generadores sobre al menos 200 semillas, (5) contador de instrucciones y (6) determinismo.
7. EL conjunto de pruebas DEBERÁ ejecutar el programa de referencia de cada nivel del mundo 4 (`4.1`, `4.2`, `4.3` y `4.4`) y comprobar que obtiene las tres estrellas al validarse contra su propio nivel; para los niveles generados `4.2`, `4.3` y `4.4`, DEBERÁ comprobarlo sobre al menos 200 semillas distintas cada uno.
8. EL conjunto de pruebas DEBERÁ comprobar, para cada Generador_M4 de los niveles `4.2`, `4.3` y `4.4`, que invocarlo dos veces con la misma semilla produce ASTs idénticos, y que invocarlo con al menos dos semillas distintas produce al menos dos ASTs distintos.
9. EL conjunto de pruebas DEBERÁ incluir una prueba de punta a punta que recorra el mundo 4 y, en ese orden: escriba en el editor un programa que defina y llame a `POLIGONO` con parámetros, lo ejecute, compruebe que se muestran las tres estrellas del intento, complete los cuatro niveles del mundo 4 con las tres estrellas cada uno, y compruebe que la insignia *Generalización* aparece otorgada solo después de completar el último nivel.
