# Requirements Document

**KiroLogo · Spec 01 · Mundo 0 · Primeros pasos**

## Introduction

Esta spec completa el **primer mundo** de KiroLogo. La spec 00 dejó jugable de punta a punta un solo
nivel autorado (`0.1`); esta spec convierte esa rebanada vertical en un mundo completo:

- **Los cinco niveles del mundo 0**: `0.1` línea recta y `0.2` una ele (autorados, ya casi listos el
  primero), `0.3` un camino y `0.5` un zigzag (**generados**, los dos primeros generadores del
  proyecto) y `0.4` un cuadrado a mano (autorado, con fricción intencional).
- **Los dos primeros generadores de retos**, que fijan el patrón que reusarán las siete specs
  siguientes: producen AST, respetan la cuadrícula de 20 y los ángulos derivables, verifican encuadre,
  descartan candidatos degenerados reintentando con la semilla siguiente, y emiten la forma más
  compacta de la plantilla.
- **El sistema de progreso y desbloqueo**: estado por nivel (aprobado, estrellas ganadas, mejor
  conteo), desbloqueo progresivo de niveles y de mundos, y repetición de niveles aprobados sin perder
  estrellas.
- **La insignia _Secuencia_**, que se otorga con las tres estrellas en los cinco niveles.
- **La primera experiencia**: quien abre el juego sin saber qué es Logo aprende jugando el `0.1`,
  guiado por globos de diálogo de Kiro dentro del propio nivel, sin pantallas de tutorial aparte.
- **Las pistas de los cinco niveles**, con plantillas que en los niveles generados se rellenan con los
  parámetros reales del reto en pantalla.
- **La semilla visible y compartible** en la interfaz, sin competir con el reto.

Concepto que enseña el mundo: **una instrucción tras otra cambia un estado**. La tortuga tiene posición
y rumbo, y obedece literalmente.

Queda **fuera de alcance**, y ningún criterio de esta spec lo exige:

- `REPITE` y todo el vocabulario de los mundos 1 a 5 y bonus. Siguen declarados como no ejecutables en
  `vocabulario.ts` y el parser sigue rechazándolos como comandos bloqueados (spec 00, requisito 5.4).
- La reproducción en paralelo (diff temporal), el desafío infinito, el mapa de insignias y el modo
  libre.
- Las insignias transversales.
- El `limiteDuro` activo: en el mundo 0 el programa corre y la estrella de economía simplemente no se
  otorga (spec 00 y `validacion-geometrica`).

Esta spec **no reescribe** los cimientos: reusa sin cambios el lexer, el parser, el intérprete, el
conteo, el impresor, el PRNG, el código de semilla, la tortuga, el lienzo, los personajes, el animador,
los segmentos, el encuadre, el validador y las estrellas. Los toca solo para **extender** puntos ya
diseñados para crecer: la variante `generado` de `OrigenNivel`, la ruta de niveles generados en
`resolverReto`, y el formato del progreso persistido. Cualquier módulo nuevo respeta la dirección de
dependencias de `estructura.md`.

### Patrones EARS en español

Cada criterio de aceptación sigue exactamente uno de los seis patrones EARS. Las palabras clave van en
español porque el proyecto entero es en español; la equivalencia es literal:

| Patrón | Forma en este documento | EARS |
|---|---|---|
| Ubicuo | EL/LA \<sistema\> DEBERÁ \<respuesta\> | THE … SHALL |
| Dirigido por evento | CUANDO \<disparador\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHEN … |
| Dirigido por estado | MIENTRAS \<condición\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHILE … |
| Evento no deseado | SI \<condición\>, ENTONCES EL/LA \<sistema\> DEBERÁ \<respuesta\> | IF … THEN … |
| Opcional | DONDE \<opción\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHERE … |
| Complejo | DONDE → MIENTRAS → CUANDO/SI → EL/LA \<sistema\> DEBERÁ | WHERE/WHILE/WHEN/IF … |

## Glossary

Sistemas y módulos (los nombres coinciden con los archivos de `estructura.md`; los marcados con ⋆ son
**nuevos** en esta spec, el resto ya existen desde la spec 00 y aquí se reusan o se extienden):

- **Generador** ⋆: función de `src/niveles/generadores/` que, dada una semilla y los parámetros de un
  nivel, produce un programa de referencia como AST. Los dos de esta spec son el **Generador_Camino**
  (`camino.ts`) y el **Generador_Zigzag** (`zigzag.ts`).
- **Registro_Generadores** ⋆: `src/niveles/generadores/registro.ts`. Asocia cada `idGenerador`
  declarado por un nivel con su función generadora, sin que `niveles/` importe de fuera de `lenguaje/`
  y `azar/`.
- **Contrato_Generador** ⋆: la firma común que todo Generador cumple, declarada en
  `src/niveles/tipos.ts`. Fija qué recibe, qué devuelve y cómo reporta un descarte.
- **Nivel**: el dato que describe un nivel, en `src/niveles/tipos.ts`. Su variante `generado` de
  `origen` ya está declarada desde la spec 00.
- **Mundo_0**: `src/niveles/mundo-0-primeros-pasos.ts`. Declara los cinco niveles del mundo 0.
- **Catalogo**: `src/niveles/catalogo.ts`. Reúne y ordena los mundos; `buscarNivel(id)`.
- **Reto**: `src/juego/reto.ts` y el objeto que produce. Resuelve el par (idNivel, semilla) a un
  programa de referencia, sus operaciones, sus segmentos y su presupuesto.
- **Progreso**: `src/juego/progreso.ts`. Persistencia del avance en `localStorage`.
- **Desbloqueo** ⋆: `src/juego/desbloqueo.ts`. Decide qué niveles y qué mundos están disponibles a
  partir del Progreso.
- **Insignias** ⋆: `src/juego/insignias.ts`. Reglas de otorgamiento de las insignias por mundo.
- **Estrellas**: `src/juego/estrellas.ts`. Cálculo de precisión, economía y abstracción.
- **PRNG**: `src/azar/prng.ts`. Generador pseudoaleatorio determinista por semilla.
- **Codigo_Semilla**: `src/azar/codigo-semilla.ts`. Conversión entre semilla y código corto
  compartible.
- **Encuadre**: `src/motor/encuadre.ts`. Caja envolvente, figura no encuadrada y figura degenerada.
- **Validador**: `src/motor/validador.ts`. Comparación geométrica.
- **Impresor**: `src/lenguaje/impresor.ts`. AST → texto KiroLogo; lo usan las pistas de esqueleto.
- **Catalogo_Errores**: `src/lenguaje/errores.ts`. Todos los mensajes visibles al jugador.
- **Guia_Primeros_Pasos** ⋆: `src/ui/guia.ts`. La secuencia de globos de diálogo que enseña el nivel
  `0.1` a quien nunca vio Logo, dentro del propio nivel.
- **Selector_Nivel** ⋆: `src/ui/selector-nivel.ts`. La navegación entre los niveles del mundo, que
  refleja el estado de desbloqueo y las estrellas ganadas.
- **Panel_Semilla** ⋆: `src/ui/panel-semilla.ts`. Muestra el código de semilla del reto y permite
  pedir otro reto o reproducir uno por su código.
- **Globo_Kiro**: `src/ui/globo-kiro.ts`. Diálogos, pistas y celebración; único texto dirigido al
  jugador.
- **Aplicacion**: `src/main.ts`. Arma la pantalla y orquesta el ciclo de un intento y la navegación.
- **Suite_Pruebas**: el conjunto de pruebas de Vitest que ejecuta `npm test`.

Términos del dominio:

- **Programa de referencia**: el programa KiroLogo que define el reto de un nivel. Autorado (escrito a
  mano, constante) o generado (producido por un Generador a partir de la semilla).
- **Semilla**: entero en `[0, 4 294 967 295]` que alimenta al PRNG. Identifica un reto junto con el
  idNivel.
- **Semilla efectiva**: la semilla con la que realmente se resolvió el reto. En un nivel autorado es la
  fija del nivel; en uno generado es la que produjo el primer candidato aceptable del lazo de reintento.
- **Candidato**: un programa de referencia tentativo que un Generador produce para una semilla, antes
  de verificar su encuadre y su no degeneración.
- **Descarte**: el resultado de un Generador cuando un candidato no cumple el encuadre o es degenerado,
  que lleva a reintentar con la semilla siguiente.
- **Nivel aprobado**: un nivel del que el Progreso guarda la estrella de precisión.
- **Nivel completado con tres estrellas**: un nivel del que el Progreso guarda precisión, economía y
  abstracción.
- **Nivel desbloqueado**: un nivel al que el jugador puede entrar según las reglas de desbloqueo.
- **Escalón de pista**: uno de los tres textos de ayuda de un nivel, en orden fijo: conceptual,
  matemática y esqueleto.
- **presupuestoEstrella**: conteo de instrucciones del programa de referencia. Umbral de la estrella de
  economía. Se calcula, nunca se escribe.
- **Insignia _Secuencia_**: la insignia del mundo 0, otorgada al completar sus cinco niveles con las
  tres estrellas.

## Decisiones cerradas en esta fase

El prompt de la spec dejó cinco decisiones abiertas. Quedan resueltas así, y cada una está reflejada en
criterios de aceptación:

| # | Decisión | Resolución | Requisito |
|---|---|---|---|
| G1 | **Firma de un Generador** (se reusa siete veces) | Un Generador es una función pura `(entrada: EntradaGenerador) => ResultadoGeneracion`, donde `EntradaGenerador` lleva `semilla`, `parametros` (los del nivel) y un `intentosMaximos`. Devuelve una **unión discriminada**: `{ exito: true, referencia: Programa, semillaEfectiva, descartes }` o `{ exito: false, error: ErrorKiroLogo, intentos }`. El **lazo de reintento con la semilla siguiente vive dentro del Generador**, acotado por `intentosMaximos`; un descarte individual es un valor interno, no una excepción. El registro asocia `idGenerador` → función. El Generador **solo** importa de `lenguaje/` y `azar/`. | 2, 3, 4 |
| G2 | **Rangos de los generadores** | Los rangos de `niveles-y-progresion` son estimaciones; medidos contra la regla de `Encuadre` (caja ≥ 200 de lado) producen ~99 % de descartes y un lazo inviable. Se **ajustan** a rangos verificados con figuras reales: **camino** largo 80–160 múltiplo de 20, 3–5 tramos, giros de 90°; **zigzag** largo 60–120 múltiplo de 20, 4–8 tramos, giros de 45° alternados. Con estos rangos el lazo acepta en pocos intentos y la figura se ve como un dibujo con intención. El steering se actualiza para reflejar los rangos verificados. | 3, 4 |
| G3 | **Estrella de economía en el `0.4`** (cuadrado a mano) | El `0.4` **ofrece** las tres estrellas como cualquier nivel; su fuerza bruta a mano (`AVANZA 100 GD 90` ×4) **es** la forma más compacta con el vocabulario del mundo 0, así que su `presupuestoEstrella` (8) se alcanza con la solución esperada. No se niega ni se oculta la economía: se gana resolviéndolo bien. El único matiz es que Kiro anticipa, por su pista de esqueleto, que en el mundo 1 habrá una forma más corta. | 5, 8 |
| G4 | **Presentación del código de semilla** | El Panel_Semilla muestra el código en un lugar **secundario y fijo** de la pantalla (junto a los controles, no sobre el lienzo ni el reto), como texto seleccionable de solo lectura con su nombre accesible. No compite con el reto: nunca se superpone al lienzo de la referencia ni al del jugador, y en los niveles autorados se muestra igual pero marcado como no rejugable con otra semilla. | 9 |
| G5 | **Forma del estado persistido** (crecerá siete mundos más) | El formato sube a **versión 2**, con **migración desde la versión 1** de la spec 00. Por nivel se guarda `{ estrellas: {precision, economia, abstraccion}, mejorConteo, ultimaSemilla }`. Las estrellas nunca retroceden y `mejorConteo` solo baja. El progreso guarda además el `ultimoReto` (idNivel + semilla) para reanudar. La migración v1→v2 conserva las estrellas ya ganadas y deja `mejorConteo` nulo hasta el siguiente intento. Un formato de versión desconocida futura degrada a progreso vacío sin borrar el crudo hasta el primer guardado exitoso. | 10 |

## Requirements

### Requisito 1: Los cinco niveles del mundo 0

**Historia de usuario:** Como jugador que empieza KiroLogo, quiero cinco niveles del mundo 0 que
enseñen «una instrucción tras otra cambia un estado» en orden creciente de dificultad, para aprender la
secuencia antes de conocer la repetición.

#### Criterios de aceptación

1. EL Mundo_0 DEBERÁ declarar exactamente cinco niveles con los identificadores `0.1`, `0.2`, `0.3`,
   `0.4` y `0.5`, todos con `mundo` igual a 0 y `concepto` igual a `secuencia`, en ese orden dentro del
   Catalogo.
2. EL Mundo_0 DEBERÁ declarar `0.1`, `0.2` y `0.4` como niveles de origen autorado con su programa de
   referencia escrito como AST (no como texto analizado) y su semilla fija, donde `0.1` es una línea
   recta (`AVANZA 100`), `0.2` es una ele (`AVANZA 100 GIRADERECHA 90 AVANZA 100`) y `0.4` es un
   cuadrado a mano (`AVANZA 100 GIRADERECHA 90` repetido cuatro veces).
3. EL Mundo_0 DEBERÁ declarar `0.3` y `0.5` como niveles de origen generado, cada uno con su
   `idGenerador` (`camino` y `zigzag` respectivamente) y sus `parametros` numéricos, sin ningún
   programa de referencia almacenado y sin ninguna semilla almacenada.
4. CADA nivel del Mundo_0 DEBERÁ declarar su normalización con traslación libre, rotación libre y escala
   exacta, conforme a la tabla de `validacion-geometrica` para los mundos 0 a 2.
5. CADA nivel del Mundo_0 DEBERÁ declarar su lista de exigencias de abstracción vacía, dado que el mundo
   0 no introduce `REPITE` ni procedimientos, de modo que la estrella de abstracción de cada nivel siga
   a su estrella de precisión.
6. CADA nivel del Mundo_0 DEBERÁ declarar exactamente tres escalones de pista en el orden conceptual,
   matemática y esqueleto, todos en español, ninguno vacío, y ninguno DEBERÁ contener el programa de
   referencia completo del nivel.
7. SI el programa de referencia de un nivel autorado del Mundo_0 se ejecuta con el intérprete y sus
   segmentos se validan contra sí mismos con la normalización del nivel, ENTONCES el Validador DEBERÁ
   otorgar la estrella de precisión y la Suite_Pruebas DEBERÁ confirmar además que la referencia gana
   las tres estrellas.
8. EL Mundo_0 DEBERÁ mantener libre `src/niveles/` de todo `presupuestoEstrella` o `limiteDuro`
   escrito a mano; ambos se calculan en el Reto a partir del programa de referencia.

### Requisito 2: El contrato común de un Generador

**Historia de usuario:** Como persona que desarrollará los generadores de las siete specs siguientes,
quiero que la firma de un generador quede fijada aquí, para escribir los demás copiando un patrón
probado en lugar de inventarlo cada vez.

#### Criterios de aceptación

1. EL Contrato_Generador DEBERÁ declararse en `src/niveles/tipos.ts` como una función pura que recibe
   una entrada con la semilla inicial (entero en el dominio de semillas), los parámetros del nivel (un
   registro de nombre a número) y un número máximo de intentos, y que no lee ninguna fuente de azar
   global ni ningún estado a nivel de módulo.
2. CUANDO un Generador produce un candidato aceptable dentro del número máximo de intentos, EL Generador
   DEBERÁ devolver un resultado de éxito con el programa de referencia como AST, la semilla efectiva con
   la que lo produjo y el número de descartes previos.
3. SI un Generador agota el número máximo de intentos sin producir ningún candidato aceptable, ENTONCES
   EL Generador DEBERÁ devolver un resultado de fallo con un error del Catalogo_Errores y el número de
   intentos realizados, sin lanzar una excepción.
4. CUANDO un candidato no cumple el encuadre o resulta degenerado según el Encuadre, EL Generador DEBERÁ
   tratarlo como un descarte interno —incrementar el contador de descartes y reintentar con la semilla
   siguiente (la actual más uno, con envoltura dentro del dominio de semillas)—, sin devolver ese
   candidato y sin reportar un error por ese descarte aislado.
5. EL Generador DEBERÁ producir un programa de referencia compuesto **únicamente** por nodos de AST del
   vocabulario del mundo 0 (invocación de comando y argumento numérico literal), sin ningún nodo
   reservado para specs posteriores.
6. EL Generador DEBERÁ importar exclusivamente de `src/lenguaje/` y `src/azar/`, y la Suite_Pruebas
   DEBERÁ fallar si algún archivo de `src/niveles/` importa de `src/motor/`, `src/juego/` o `src/ui/`.
7. CUANDO se invoca un Generador dos veces con la misma semilla inicial, los mismos parámetros y el
   mismo número máximo de intentos, EL Generador DEBERÁ devolver un resultado idéntico: la misma semilla
   efectiva y un programa de referencia con la misma secuencia de nodos y los mismos argumentos.
8. EL Registro_Generadores DEBERÁ asociar cada `idGenerador` que un nivel declara con su función
   generadora, y SI un nivel generado declara un `idGenerador` que el registro no conoce, ENTONCES la
   resolución del Reto DEBERÁ devolver un error del Catalogo_Errores sin lanzar una excepción.

### Requisito 3: Generador de camino (nivel 0.3)

**Historia de usuario:** Como jugador del nivel `0.3`, quiero un camino de tramos rectos con giros
rectos distinto cada vez, siempre resoluble y que se vea como un recorrido con intención, para practicar
la secuencia sin poder memorizar la respuesta.

#### Criterios de aceptación

1. EL Generador_Camino DEBERÁ producir un programa que alterna tramos rectos y giros: un `AVANZA` por
   cada tramo y, entre dos tramos consecutivos, un `GIRADERECHA` o `GIRAIZQUIERDA` de 90 grados, sin un
   giro final tras el último tramo.
2. EL Generador_Camino DEBERÁ emplear un número de tramos entre 3 y 5 inclusive, y una longitud por
   tramo múltiplo de 20 entre 80 y 160 inclusive, tomando cada valor del PRNG sembrado con la semilla
   del intento en curso.
3. EL Generador_Camino DEBERÁ emitir la forma más compacta de la plantilla: un solo `AVANZA` por tramo
   y un solo giro por vértice, sin instrucciones redundantes, de modo que el `presupuestoEstrella` que
   el Reto calcule sea el conteo de esa forma mínima.
4. CADA candidato del Generador_Camino cuya caja envolvente no quepa en el lienzo de 800 × 800 o cuyo
   ancho o alto sea menor que 200 unidades DEBERÁ ser descartado, reintentando con la semilla siguiente.
5. CUANDO la Suite_Pruebas ejecuta el Generador_Camino sobre al menos 200 semillas iniciales distintas,
   TODAS DEBERÁN producir un resultado de éxito cuyo programa de referencia, ejecutado y validado contra
   sí mismo con traslación y rotación libres, gane las tres estrellas, con caja envolvente encuadrada y
   no degenerada.
6. EL Generador_Camino DEBERÁ producir figuras cuyos tramos no se pisen por completo ni reduzcan la
   figura a una sola línea (no degeneradas), verificado por la regla de dimensión mínima del Encuadre
   sobre los dos ejes.

### Requisito 4: Generador de zigzag (nivel 0.5)

**Historia de usuario:** Como jugador del nivel `0.5`, quiero un zigzag de tramos con giros de 45 grados
alternados, distinto cada vez y siempre resoluble, para practicar giros que no son rectos manteniendo el
patrón de alternancia.

#### Criterios de aceptación

1. EL Generador_Zigzag DEBERÁ producir un programa que alterna tramos rectos y giros de 45 grados cuyo
   sentido se **alterna** entre `GIRADERECHA` y `GIRAIZQUIERDA` de un vértice al siguiente, empezando
   por un sentido elegido del PRNG, sin un giro final tras el último tramo.
2. EL Generador_Zigzag DEBERÁ emplear un número de tramos entre 4 y 8 inclusive, y una longitud por
   tramo múltiplo de 20 entre 60 y 120 inclusive, tomando cada valor del PRNG sembrado con la semilla
   del intento en curso.
3. EL Generador_Zigzag DEBERÁ emitir la forma más compacta de la plantilla, de modo que el
   `presupuestoEstrella` que el Reto calcule sea el conteo de esa forma mínima.
4. CADA candidato del Generador_Zigzag cuya caja envolvente no quepa en el lienzo de 800 × 800 o cuyo
   ancho o alto sea menor que 200 unidades DEBERÁ ser descartado, reintentando con la semilla siguiente.
5. CUANDO la Suite_Pruebas ejecuta el Generador_Zigzag sobre al menos 200 semillas iniciales distintas,
   TODAS DEBERÁN producir un resultado de éxito cuyo programa de referencia, ejecutado y validado contra
   sí mismo con traslación y rotación libres, gane las tres estrellas, con caja envolvente encuadrada y
   no degenerada.
6. EL Generador_Zigzag DEBERÁ producir figuras no degeneradas, con longitud total suficiente para que
   ambos ejes de la caja envolvente alcancen al menos 200 unidades.

### Requisito 5: Resolución de retos generados

**Historia de usuario:** Como jugador, quiero que un nivel generado me dé un reto real —una figura que
Kiro dibuja y que puedo validar—, para que jugar un nivel generado se sienta igual que jugar uno
autorado.

#### Criterios de aceptación

1. CUANDO se resuelve un Reto de un nivel de origen generado con una semilla, EL Reto DEBERÁ localizar
   la función generadora por el `idGenerador` del nivel, invocarla con esa semilla y los parámetros del
   nivel, y usar el programa de referencia que devuelve como referencia del reto.
2. EL Reto de un nivel generado DEBERÁ exponer la **semilla efectiva** con la que el Generador produjo
   el reto (que puede diferir de la semilla pedida si hubo descartes), y su Codigo_Semilla DEBERÁ
   calcularse sobre esa semilla efectiva.
3. EL Reto de un nivel generado DEBERÁ ejecutar el programa de referencia una sola vez con el
   intérprete y derivar de esa ejecución tanto las operaciones de la demostración como los segmentos que
   se validan, sin una segunda ejecución que pudiera desincronizarse.
4. EL Reto DEBERÁ calcular el `presupuestoEstrella` de un nivel generado como el conteo de instrucciones
   de su programa de referencia con la única función de conteo, sin ningún número escrito a mano.
5. SI la resolución de un Reto generado falla porque el Generador agota sus intentos o porque el
   `idGenerador` es desconocido, ENTONCES EL Reto DEBERÁ devolver un resultado de fallo con un error del
   Catalogo_Errores, sin lanzar una excepción.
6. EL Reto de un nivel autorado DEBERÁ seguir resolviéndose como en la spec 00: con la semilla fija del
   nivel, ignorando la semilla pedida, y sin invocar ningún Generador.

### Requisito 6: Progreso, estado por nivel y persistencia

**Historia de usuario:** Como jugador, quiero que mi avance sobreviva al cierre del navegador, para no
perder las estrellas ni el mejor conteo que ya gané.

#### Criterios de aceptación

1. EL Progreso DEBERÁ guardar, por cada nivel jugado, sus tres estrellas (precisión, economía y
   abstracción), su mejor conteo de instrucciones y la última semilla con la que se jugó.
2. CUANDO el jugador aprueba o mejora un nivel, EL Progreso DEBERÁ actualizar cada estrella con un o
   lógico sobre la ya guardada (las estrellas **nunca retroceden**) y actualizar el mejor conteo solo si
   el nuevo conteo, con la estrella de precisión otorgada, es menor que el guardado.
3. CUANDO el jugador cierra y vuelve a abrir el navegador, EL Progreso DEBERÁ recuperar de
   `localStorage` todas las estrellas, los mejores conteos y el último reto en curso guardados antes del
   cierre.
4. EL Progreso DEBERÁ persistir bajo una clave versionada con el formato de versión 2, y CUANDO
   encuentra en `localStorage` un contenido del formato de versión 1 de la spec 00, EL Progreso DEBERÁ
   migrarlo conservando las estrellas ya ganadas por nivel y dejando el mejor conteo sin valor hasta el
   siguiente intento, sin perder progreso.
5. SI el contenido almacenado es ilegible, de una versión desconocida distinta de 1 y 2, o con registros
   inválidos, ENTONCES EL Progreso DEBERÁ degradar a un progreso vacío o descartar solo los registros
   inválidos según el caso, dejando el juego siempre jugable y conservando el crudo hasta el primer
   guardado exitoso.
6. SI el almacén no está disponible o su cuota está agotada, ENTONCES EL Progreso DEBERÁ seguir
   funcionando en memoria durante la sesión y avisar una sola vez, sin interrumpir el juego.
7. EL Progreso DEBERÁ guardar únicamente datos anónimos del avance —identificadores de nivel, semillas,
   estrellas y conteos—, sin ningún dato personal.

### Requisito 7: Desbloqueo de niveles y de mundos

**Historia de usuario:** Como jugador, quiero que los niveles se abran en orden a medida que apruebo los
anteriores, para tener un camino claro sin que el juego me deje entrar donde todavía no estoy listo.

#### Criterios de aceptación

1. EL Desbloqueo DEBERÁ mantener siempre desbloqueado el primer nivel del mundo 0 (`0.1`).
2. EL Desbloqueo DEBERÁ desbloquear un nivel del mundo 0 cuando el nivel inmediatamente anterior en el
   orden del mundo está aprobado (tiene su estrella de precisión guardada en el Progreso).
3. EL Desbloqueo DEBERÁ considerar desbloqueado un mundo cuando todos los niveles del mundo anterior
   están aprobados con la estrella de precisión; el mundo 0, al ser el primero, está desbloqueado desde
   el inicio.
4. SI el jugador intenta entrar a un nivel no desbloqueado, ENTONCES la Aplicacion DEBERÁ impedir la
   entrada y el Selector_Nivel DEBERÁ presentar ese nivel como bloqueado, comunicándolo por texto y
   forma además de por color.
5. CUANDO un nivel aprobado se vuelve a jugar, EL Desbloqueo y el Progreso DEBERÁN permitir el intento
   sin retirar ninguna estrella ya ganada; en un nivel generado, volver a entrar sin pedir una semilla
   concreta trae un reto nuevo, y pedir la misma semilla reproduce el mismo reto.
6. EL Desbloqueo DEBERÁ derivar el estado de disponibilidad solo del Progreso, sin estado propio
   persistido, de modo que sea reproducible a partir de las estrellas guardadas.

### Requisito 8: La insignia Secuencia

**Historia de usuario:** Como jugador, quiero una insignia que reconozca haber dominado el mundo 0 por
completo, para tener una meta clara más allá de aprobar cada nivel.

#### Criterios de aceptación

1. LAS Insignias DEBERÁN otorgar la insignia _Secuencia_ cuando, y solo cuando, los cinco niveles del
   mundo 0 tienen guardadas en el Progreso las tres estrellas cada uno.
2. SI a cualquiera de los cinco niveles del mundo 0 le falta al menos una de sus tres estrellas,
   ENTONCES las Insignias DEBERÁN mantener la insignia _Secuencia_ sin otorgar.
3. CUANDO el último intento que faltaba completa las tres estrellas en los cinco niveles, la Aplicacion
   DEBERÁ comunicar el otorgamiento de la insignia _Secuencia_ por el Globo_Kiro, con texto en español
   atribuido a Kiro.
4. LAS Insignias DEBERÁN derivar el otorgamiento solo del Progreso, sin estado propio persistido, de
   modo que sea reproducible a partir de las estrellas guardadas.
5. LAS Insignias DEBERÁN limitar su alcance a la insignia _Secuencia_ del mundo 0; ninguna insignia de
   otro mundo ni ninguna insignia transversal se otorga en esta spec.

### Requisito 9: Semilla visible y compartible

**Historia de usuario:** Como jugador, quiero ver y compartir el código de un reto generado, para pedir
ayuda con exactamente el mismo reto o retar a otra persona, sin que ese código estorbe la figura.

#### Criterios de aceptación

1. MIENTRAS se juega un nivel generado, EL Panel_Semilla DEBERÁ mostrar el Codigo_Semilla del reto en
   curso como texto de solo lectura seleccionable, en un lugar fijo de la pantalla que no se superpone
   al lienzo de la referencia ni al del jugador.
2. EL Panel_Semilla DEBERÁ ofrecer una acción para pedir **otro** reto del mismo nivel, que resuelve un
   reto nuevo con una semilla distinta, y una acción para reproducir un reto a partir de un código
   introducido.
3. CUANDO el jugador introduce un código de semilla válido y pide reproducirlo, EL Panel_Semilla DEBERÁ
   decodificarlo con el Codigo_Semilla y la Aplicacion DEBERÁ resolver el mismo reto de ese nivel con esa
   semilla.
4. SI el jugador introduce un código con longitud o símbolos inválidos, ENTONCES la Aplicacion DEBERÁ
   mostrar por el Globo_Kiro el mensaje correspondiente del Catalogo_Errores, sin cambiar el reto en
   curso.
5. MIENTRAS se juega un nivel autorado, EL Panel_Semilla DEBERÁ mostrar el código de la semilla fija del
   nivel marcado por texto como no rejugable con otra semilla, sin ofrecer la acción de otro reto.
6. EL Panel_Semilla DEBERÁ declarar un nombre accesible en español para el código y para cada acción, y
   comunicar el estado de una acción no disponible por texto y forma además de por color.

### Requisito 10: La primera experiencia en el nivel 0.1

**Historia de usuario:** Como alguien que nunca vio Logo ni sabe qué es un comando, quiero entender qué
hacer en el primer nivel sin ayuda externa, guiado dentro del propio juego, para aprender jugando en
lugar de leer un tutorial.

#### Criterios de aceptación

1. CUANDO se abre el nivel `0.1` por primera vez, LA Guia_Primeros_Pasos DEBERÁ presentar por el
   Globo_Kiro una secuencia de mensajes breves en español que, sin usar jerga sin explicar, indican qué
   es la tortuga, que Kiro ya dibujó la figura objetivo, y que el jugador debe escribir una instrucción
   para que su tortuga la reproduzca.
2. LA Guia_Primeros_Pasos DEBERÁ enseñar el primer comando mostrando un ejemplo concreto y accionable
   (el comando `AVANZA` con un número), de modo que quien nunca vio Logo pueda escribir su primer
   programa a partir de esa guía, sin ninguna pantalla de tutorial aparte del nivel.
3. MIENTRAS la Guia_Primeros_Pasos está activa, cada mensaje DEBERÁ caber en el globo sin texto largo y
   avanzar por una acción explícita del jugador o por su primer intento, sin bloquear el editor ni los
   controles.
4. CUANDO el jugador ejecuta por primera vez un programa que reproduce la figura del `0.1`, LA Guia DEBERÁ
   dar paso a la celebración del acierto por el Globo_Kiro, sin repetir los mensajes introductorios.
5. LA Guia_Primeros_Pasos DEBERÁ mostrarse solo la primera vez, registrando en el Progreso que ya se
   completó, de modo que un jugador que ya jugó el `0.1` no la vuelva a ver salvo que reinicie su
   progreso.
6. LA Guia_Primeros_Pasos DEBERÁ publicar cada mensaje en la única región `aria-live` `polite` del
   documento, sin recibir foco, de modo que sea perceptible con lector de pantalla.
7. LA Guia_Primeros_Pasos DEBERÁ limitarse al nivel `0.1`; los demás niveles no muestran guía
   introductoria, solo sus pistas bajo demanda.

### Requisito 11: Pistas de los cinco niveles

**Historia de usuario:** Como jugador atascado, quiero pistas que hablen del reto que tengo en pantalla
y no de uno genérico, para que la ayuda me sirva de verdad en lugar de mentirme.

#### Criterios de aceptación

1. CADA nivel del Mundo_0 DEBERÁ ofrecer tres escalones de pista en el orden conceptual, matemática y
   esqueleto, accesibles bajo demanda uno a uno por el Globo_Kiro, sin revelar el programa de
   referencia completo.
2. EN los niveles autorados, las tres pistas DEBERÁN ser textos fijos coherentes con su reto constante.
3. EN los niveles generados, las tres pistas DEBERÁN ser plantillas que la Aplicacion rellena con los
   parámetros reales del reto en curso —el número de tramos, la naturaleza de los giros y la escala de
   la cuadrícula—, de modo que la pista mencione el conteo verdadero del reto en pantalla.
4. SI un reto generado tiene cinco tramos, ENTONCES su pista de conteo DEBERÁ decir cinco y no otro
   número; nunca DEBERÁ presentarse una pista cuyo número contradiga el reto mostrado.
5. LA pista de esqueleto de un nivel generado DEBERÁ construirse con el Impresor sobre una forma parcial
   del programa (por ejemplo, el primer tramo y el primer giro), sin imprimir el programa de referencia
   completo que resolvería el reto.
6. LA Suite_Pruebas DEBERÁ verificar, sobre una muestra de semillas de cada nivel generado, que el
   número de tramos que la pista menciona coincide con el número de tramos del programa de referencia de
   ese reto.

### Requisito 12: Navegación entre niveles del mundo

**Historia de usuario:** Como jugador, quiero moverme entre los niveles del mundo viendo cuáles aprobé y
cuáles siguen bloqueados, para elegir a dónde ir sin perderme.

#### Criterios de aceptación

1. EL Selector_Nivel DEBERÁ presentar los cinco niveles del mundo 0 en orden, indicando por nivel su
   estado —bloqueado, desbloqueado sin aprobar, aprobado, o completado con tres estrellas— por texto y
   forma además de por color.
2. CUANDO el jugador elige un nivel desbloqueado, LA Aplicacion DEBERÁ resolver su reto, presentar la
   figura de referencia, reiniciar el intento y actualizar el Panel_Semilla y las pistas al nivel
   elegido.
3. CUANDO el jugador aprueba el nivel en curso y hay un nivel siguiente recién desbloqueado, LA
   Aplicacion DEBERÁ ofrecer avanzar a él por una acción explícita, sin forzar el cambio.
4. EL Selector_Nivel DEBERÁ declarar un nombre accesible en español por nivel que incluya su
   identificador y su estado, y DEBERÁ integrarse en el orden de foco de izquierda a derecha y de arriba
   abajo, sin atrapar el foco.
5. EL Selector_Nivel DEBERÁ reflejar el otorgamiento de la insignia _Secuencia_ cuando los cinco niveles
   quedan completados con tres estrellas, comunicado por texto además de por color.

### Requisito 13: Integridad, dependencias y calidad

**Historia de usuario:** Como persona que mantiene KiroLogo, quiero que esta spec conserve las
invariantes de los cimientos, para que agregar el mundo 0 completo no erosione las reglas del proyecto.

#### Criterios de aceptación

1. LA Suite_Pruebas DEBERÁ mantener verdes todas las pruebas de la spec 00 tras esta spec, y `npm test`
   y `npm run typecheck` DEBERÁN terminar con código de salida 0.
2. EL Proyecto DEBERÁ mantener `src/` libre de `Math.random`; todo el azar de los generadores y de las
   pruebas de propiedades DEBERÁ salir del PRNG con semilla explícita.
3. EL Proyecto DEBERÁ mantener `src/` libre de `eval`, de `new Function`, de cualquier invocación del
   constructor `Function` y de las extensiones de imagen prohibidas por la spec 00.
4. LA Suite_Pruebas DEBERÁ fallar si un archivo de `src/niveles/` importa de `src/motor/`, `src/juego/`
   o `src/ui/`, o si un archivo de `src/juego/` importa de `src/ui/`, conservando la dirección de
   dependencias de `estructura.md`.
5. TODO mensaje nuevo visible al jugador DEBERÁ vivir en `src/lenguaje/errores.ts`, en español y con la
   forma descriptiva del catálogo, y ningún módulo distinto del Catalogo_Errores DEBERÁ componer texto
   de error.
6. TODA dependencia nueva, si la hubiera, DEBERÁ declararse con versión exacta de tres componentes y con
   licencia compatible con MIT; esta spec no prevé dependencias nuevas.
7. CUANDO se ejecuta `npm run build`, LA Compilacion DEBERÁ terminar con código de salida 0 y dejar el
   juego jugable hasta el mundo 0 completo, con los cinco niveles navegables.
