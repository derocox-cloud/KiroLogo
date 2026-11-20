# Auditoría de la spec 06 · Mundo 5 · Fractales

Rama `spec-06-mundo-5` contra `main` (`git diff main...HEAD`, 46 archivos, +2384 −149).

## Resumen

La rama agrega `SI`, `SINO`, `ALTO`, `DEVUELVE` y los comparadores `= < >`, la recursión con su guarda, los niveles 5.1 a 5.5 (dos generados), el indicador de profundidad y la insignia *Recursión*. Las reglas duras de arquitectura se cumplen: `niveles/` no importa de `motor/`, `juego/` ni `ui/`, no hay `Math.random`, `eval` ni `new Function`, `base: '/'` sigue intacto y `package.json`, el lockfile y `amplify.yml` no cambian. La guarda de profundidad, la de ciclos y la de tiempo cortan la recursión sin caso base, la recursión mutua y los operadores recursivos. No encontré regresiones en los mundos 0 a 4.

Los hallazgos son de severidad media o baja. Los de más peso son un indicador de profundidad que queda desactualizado en pantalla, una estrella de abstracción que se obtiene con recursión que nunca se ejecuta, y diagnósticos engañosos para condiciones que los jugadores escribirán con frecuencia (`<=`, `(:n = 3)`).

**Watch for:** (1) el indicador de profundidad no se oculta al pasar de paso a paso a ejecución continua (confirmado); (2) `usaRecursion` se satisface con un `PARA` recursivo que nunca se invoca (confirmado); (3) `SI (:n = 3) [...]` y `SI :n <= 3 [...]` producen mensajes que apuntan al problema equivocado (confirmado).

**Validación ejecutada**

| Paso | Resultado |
|---|---|
| `npm run typecheck` | sin errores |
| `npm run build` | compila |
| `npm test -- --maxWorkers=2` | 4425 pasan, 1 falla (ver nota) |
| `npm ci` | no se ejecutó, para no reinstalar `node_modules`; los archivos de dependencias no cambian en el diff |

Nota sobre el único fallo: `src/main.test.ts › 21.3 · estructura de archivos` falla porque existe `src/auditoria-sonda.test.ts`, un archivo **sin versionar** que apareció a las 10:41 durante la corrida y que no pertenece a la rama ni lo creé yo. La aserción lista esa única infracción. Con el archivo fuera, la suite debería quedar en verde. No lo borré. Hay que repetir la suite completa una vez retirado.

Las pruebas dinámicas las hice con sondas en `/tmp/aud`, fuera del repositorio. No modifiqué nada de `src/`.

**Veredicto:** ver la sección final.

## Hallazgos

### H1 · Media · El indicador de profundidad queda desactualizado en la ejecución continua

- **Archivos:** `src/main.ts:812-813` (solo muestra si `modoPaso`), `src/main.ts:1434` (`ejecutarPrograma` reinicia la capa del jugador pero no oculta el indicador), `src/main.ts:1615` (solo `reiniciar` lo oculta).
- **Qué pasa:** el diseño dice que el indicador solo vive en el paso a paso (`docs/bitacora.md`, spec 06: «En la ejecución continua no se muestra»). Si el jugador da uno o dos pasos y luego pulsa Ejecutar, `modoPaso` pasa a `false`, el indicador sigue montado con la profundidad del último paso y ya no se actualiza durante la ejecución. Un lector de pantalla no lo anuncia, pero quien mira ve un número obsoleto. Pasa igual al terminar el paso a paso: el último valor queda en pantalla.
- **Reproducir:** mundo 5, programa con `P 2` recursivo, pulsar «Paso» dos veces (el indicador muestra 1), pulsar «Ejecutar». El indicador sigue con el valor del último paso. Las pruebas de `main.mundo-5.test.ts` cubren `reiniciar`, pero no este camino.
- **Corrección:** llamar a `indicadorProfundidad.ocultar()` en `ejecutarPrograma` junto al `vaciarSalida()` de la línea 1435, y al concluir el intento. Agregar una prueba «Ejecutar tras dar pasos oculta el indicador».

### H2 · Media · La estrella de abstracción se obtiene con recursión que nunca se ejecuta

- **Archivo:** `src/juego/abstraccion.ts:216` (`hayRecursion`) y `:227` (`invocaNombre`). La rama amplió `invocaNombre` para ver llamadas dentro de expresiones, pero la condición base ya existía.
- **Qué pasa:** `hayRecursion` solo pide que el cuerpo de alguna definición mencione su propio nombre. No exige que la definición se invoque desde fuera ni que la llamada recursiva sea alcanzable. Los cinco niveles del mundo 5 tienen `usaRecursion` como única exigencia, así que el jugador gana la estrella *Abstracción* dibujando con `REPITE`.
- **Reproducir** (probado con `analizar` de `abstraccion.ts`):
  `PARA X SI 1 > 2 [X] FIN X REPITE 4 [AV 100 GD 90]` devuelve `confirmadas: ['usaRecursion']`.
  `PARA X AV 1 FIN PARA Y SI 1 > 2 [Y] FIN REPITE 4 [AV 100 GD 90]` también, aunque `Y` nunca se invoca.
- **Impacto:** la insignia *Recursión* exige tres estrellas en los cinco niveles, así que se puede ganar sin escribir una recursión real. La spec (R4.2) dice «reconoce la llamada a sí mismo», así que el código cumple la letra; el hueco es de intención pedagógica. El nivel 5.1 de `main.mundo-5.test.ts` prueba que la espiral con `REPITE` no gana la estrella, pero no este truco.
- **Corrección:** exigir que la definición recursiva se invoque desde fuera de su propio cuerpo, reutilizando `invocadoFuera` (que ya usan las otras claves). Alternativa más fuerte: comprobar en la ejecución que el procedimiento llegó a llamarse a sí mismo (requiere un dato del intérprete, así que es una decisión de diseño).

### H3 · Media · `SI (:n = 3) [...]` da «Falta cerrar el paréntesis»

- **Archivo:** `src/lenguaje/parser.ts:826` (dentro de `analizarPrimario`), con `analizarCondicion` en `:930`.
- **Qué pasa:** la comparación no es una expresión, así que dentro de un paréntesis el comparador no se reconoce. El jugador escribe un paréntesis bien cerrado y recibe `parentesisSinCerrar: Falta cerrar el paréntesis que abriste en la línea 1.` El mensaje es falso.
- **Reproducir:** mundo 5, `PARA P :n SI (:n = 3) [AV 1] FIN P 1`.
- **Corrección:** en `analizarPrimario`, si tras la expresión interna aparece un token `comparador`, reportar `condicionMalFormada` con un motivo nuevo (`comparacionEntreParentesis`: «escribe la comparación sin paréntesis: SI :n = 3 [...]»). Alternativa: aceptar la condición entre paréntesis en `analizarCondicion`.

### H4 · Media · `<=`, `>=`, `<>` y `==` se diagnostican como «Falta un número»

- **Archivo:** `src/lenguaje/lexer.ts` (cada carácter es un `comparador` suelto) y `src/lenguaje/parser.ts:930` (`analizarCondicion`, rama «lado derecho»).
- **Qué pasa:** el lexer emite dos tokens para `<=`. El parser lee `<` y espera un número, y reporta `expresionIncompleta: Falta un número después del símbolo < de la línea 1.` Para `==` dice «después del símbolo =». La spec dice que estos operadores no existen (R1.2), pero quien viene de otro lenguaje los va a escribir, y el producto basa el aprendizaje en el mensaje de error.
- **Reproducir:** `PARA P :n SI :n <= 3 [AV 1] FIN P 1`, y lo mismo con `>=`, `<>`, `==`.
- **Corrección:** en `analizarCondicion`, si el comparador va seguido de otro comparador pegado (misma línea y columna contigua), reportar `condicionMalFormada` con motivo `operadorNoExiste` y el texto «KiroLogo solo tiene =, < y >. Para <= escribe SINO :n > 3 [...] [...] o dos SI». Agregar el id al catálogo y a `errores.test.ts`.

### H5 · Baja · Cascada de errores con comparador fuera de `SI`/`SINO`

- **Archivo:** `src/lenguaje/parser.ts` (`analizarRepite` y la ruta de `analizarInstruccion` para `comparador`).
- **Qué pasa:** R1.5 pide evitar cascadas por los corchetes solo para las listas de `SI`/`SINO`, y eso se cumple. Pero `REPITE 3 > 2 [AV 1]` produce dos errores (`argumentoFaltante: REPITE necesita un número` y `corcheteDeMasEnLinea`). `SI :n =` con el número en la línea siguiente produce `expresionIncompleta` más `corcheteDeMasEnLinea`. Es el mismo problema que R1.5 describe, en otros comandos.
- **Reproducir:** `REPITE 3 > 2 [AV 1]` y `PARA P :n\nSI :n =\n3 [AV 1]\nFIN\nP 1`.
- **Corrección:** al reportar un error de argumento por un comparador, descartar la lista entre corchetes siguiente, como hace `descartarListas` (`parser.ts:910`). Para el salto de línea, usar `descartarListas` también en la rama de `reportarExpresionIncompleta` de `analizarCondicion`.

### H6 · Baja · El corte por ciclos se informa como «la tortuga llevaba demasiados pasos»

- **Archivos:** `src/lenguaje/interprete.ts:347` (`llamarComoOperador`), `:457` (`errorDeGuarda('pasos')`), `src/lenguaje/errores.ts:730`.
- **Qué pasa:** un operador recursivo exponencial agota el tope de 2 000 000 de ciclos y se corta con `guardaPasos`: «la tortuga llevaba demasiados pasos. ¿Hay una repetición que nunca termina?». En un operador la tortuga no se mueve, así que el mensaje confunde. El corte en sí funciona: 318 ms.
- **Reproducir:** `PARA F :n SI :n < 2 [DEVUELVE 1] DEVUELVE (F :n - 1) + (F :n - 2) FIN AV F 40`.
- **Corrección:** ruta de error propia cuando el tope de ciclos se alcanza dentro de un operador (por ejemplo, `guardaCalculo`: «Detuve la ejecución: F hizo demasiadas cuentas…»). Es decisión de producto; si no se hace, documentar que el mensaje es genérico.

### H7 · Baja · Con argumentos maximales, el ejemplo clásico de Fibonacci falla con un mensaje equivocado

- **Archivo:** `src/lenguaje/parser.ts` (`analizarLlamadaConValor`); regla en `.kiro/steering/lenguaje-kirologo.md`.
- **Qué pasa:** `F :n - 1 + F :n - 2` se lee `F (:n - 1 + F (:n - 2))`. Es coherente con la regla de argumentos maximales, pero el resultado es una recursión sin fin y el mensaje de la guarda («Revisa su condición de corte: ¿hay un SI con ALTO…?») manda al jugador a revisar algo que está bien.
- **Reproducir:** `PARA F :n SI :n < 2 [DEVUELVE :n] DEVUELVE F :n - 1 + F :n - 2 FIN AV F 10` devuelve `guardaRecursion` con el texto citado.
- **Corrección:** documentar en el steering el patrón `(F :n - 1) + (F :n - 2)` y, si se puede, añadir al mensaje de `guardaRecursion` un recordatorio de que los argumentos se extienden hasta el final de la cuenta. Ningún nivel usa `DEVUELVE`, así que no bloquea.

### H8 · Baja · El paso a paso no muestra ni el `SI`, ni el `ALTO`, ni el retorno

- **Archivos:** `src/main.ts:810-824`, `src/ui/indicador-profundidad.ts`.
- **Qué pasa:** el generador emite una operación por movimiento, así que el paso a paso salta del último `AV` de una llamada al primero de la siguiente. La línea del `SI :largo > 200 [ALTO]` nunca se resalta y la profundidad desciende solo cuando el siguiente movimiento ocurre en un nivel menor. En el caso base no hay ninguna operación, así que el jugador no ve el momento en que la recursión se detiene, que es el concepto del mundo. La bitácora lo reconoce solo para las llamadas con valor.
- **Reproducir:** mundo 5, espiral del 5.1, dar pasos hasta el final. El último paso es el último `AV`, y no hay ningún paso que muestre el `ALTO`.
- **Corrección:** emitir un evento sin movimiento (por ejemplo `{ tipo: 'llamada' | 'retorno' | 'corte', linea, profundidad }`) que el paso a paso muestre y anuncie. Toca el contrato del generador, así que es una decisión de otra spec.

### H9 · Baja · `cajaDeReferencia` duplica la semántica de `SI` y `ALTO`

- **Archivo:** `src/niveles/generadores/comun.ts` (función `recorrer`, ramas de condicional e `interrupcion`).
- **Qué pasa:** `tecnologia.md` pide no duplicar la lógica de ejecución. `recorrer` ya existía como mini-interprete para calcular la caja, y esta rama le suma `SI`, `SINO` y `ALTO`. No entiende `llamadaConValor` ni `devolucionValor`: `valorDe` usa `evaluar` sin `llamar` y devuelve `null`, así que un generador que use operadores propios descartaría todos sus candidatos sin explicación. Hoy ningún generador los usa, y el recorrido se mantiene sincronizado con el intérprete gracias a las 200 semillas de las pruebas.
- **Corrección:** a medio plazo, calcular la caja con el intérprete real. Mientras tanto, dejar en el comentario de `recorrer` que no soporta operadores propios.

### H10 · Baja · Comentarios y documentación inconsistentes

- `src/niveles/mundo-5-fractales.ts:46`: «Conteo 7»; el conteo real de `REFERENCIA_5_1` es 6, como dice el steering (comprobado con `contarInstrucciones`).
- `src/niveles/generadores/espiral.ts:15`: «hasta 52 llamadas», una línea de 200 caracteres. Con inicio 20, incremento 5 y límite 280 salen 54 niveles de llamada (`(280−20)/5 + 2`); la bitácora y el steering dicen 53. Sigue lejos de 100, pero las tres cifras no coinciden.
- `.kiro/steering/estructura.md:69-70`: `mundo-5-fractales.ts` aparece dos veces, y la segunda línea la agrega esta rama.
- `src/ui/menu-mundos.test.ts:344`: la prueba muta `CATALOGO` mediante un cast a `Nivel[]` y lo restaura en `finally`. Funciona, pero rompe la inmutabilidad declarada y puede contaminar otras pruebas si el `finally` no corre.

## Revisado sin hallazgos

- **Guardas.** `llamarComoOperador` pasa por `comprobarGuardas` y cuenta contra los 100 niveles mediante `nivelOperadores`. `correrCuerpoDeOperador` cuenta ciclos por instrucción y por iteración. La recursión directa y mutua, tanto de comandos como de operadores, corta con `guardaRecursion` (100 niveles, 0 a 1 ms). `REPITE 99999 [REPITE 99999 [SI 1 = 1 []]]`, con cuerpo vacío o dentro de un operador, corta por ciclos en 51 a 72 ms.
- **Semántica de `ALTO`.** Atraviesa `REPITE` y `SI` y deja seguir a quien llamó (`PARA P REPITE 3 [AV 10 SI 1 = 1 [ALTO]] AV 99 FIN P GD 90 AV 5` emite 3 operaciones). Un operador sin camino que devuelva da `procedimientoSinResultado`; uno que dibuja, `operadorConEfectos`.
- **Conteo.** `contarNodo` y `contarExpresion` cumplen R4.1. Los conteos de 5.1, 5.3 y 5.4 son 6, 10 y 12, como en el steering.
- **Impresor.** `SINO` anidado con listas vacías y la ida y vuelta con `SI` dentro de `SINO` imprimen y releen igual.
- **Arquitectura.** `lenguaje/interprete.ts` importa `../motor/tortuga.js`; ya ocurría en `main` (línea 24) y queda fuera del alcance de esta rama.
- **Mundos 0 a 4.** Antes del mundo 5, `=`, `<` y `>` dan un único `comparadorBloqueado`, y `SI`, `SINO` y `ALTO` dan `comandoBloqueado`, como pide R1.4. Los cambios de pruebas (`lexer.test.ts`, `errores.test.ts`, `menu-mundos.test.ts`) reflejan solo el cambio de sentido documentado en la bitácora.
- **Profundidad del parser.** Los anidamientos de `SI` y `REPITE` lanzan `RangeError` entre 1250 y 2000 niveles, pero el editor limita el texto a 10 000 caracteres (`ui/editor.ts:23`), que da como máximo unos 1250 niveles con `SI 1=1[`. Con ese tope no se alcanza el desbordamiento, y `REPITE` ya se comportaba igual en `main`.
- **Accesibilidad.** El anuncio `aria-live` de cada paso incluye la profundidad en texto. Las casillas son `aria-hidden` y el número y la etiqueta transmiten lo mismo. El indicador no usa color como único canal, no anima nada y toma sus colores de variables del tema. La región `section` con `aria-label` aparece y desaparece junto al indicador; es aceptable, y la validación con tecnologías asistivas sigue pendiente, como indica `tecnologia.md`.

## Veredicto

**Verdict**: APPROVED

No hay hallazgos de severidad alta ni incumplimientos de las reglas duras. Recomiendo corregir H1 y H2 antes de fusionar, porque la primera contradice el diseño declarado y la segunda abre un atajo a la insignia *Recursión*. H3 y H4 mejoran los mensajes de error que el producto presenta como núcleo de la retroalimentación. Los demás pueden esperar.

La aprobación depende de repetir `npm test -- --maxWorkers=2` después de retirar `src/auditoria-sonda.test.ts`, y de ejecutar `npm ci` en un entorno limpio, que no hice aquí.
