# Requirements Document

**KiroLogo · Spec 04 · Mundo 3 · Rosetones**

## Introduction

Esta spec agrega el mundo 3 completo (cuatro niveles), activa de verdad el **límite duro** de
instrucciones que ya estaba cableado pero no se podía evitar, cambia la normalización geométrica a
**fija** (posición y rumbo de partida importan) y añade el **desafío infinito** por mundo, retroactivo
a los mundos 0 a 2. Cierra con la insignia de concepto *Simetría* y las cuatro insignias transversales.

El concepto central es la **iteración anidada** y la **simetría rotacional**: un `REPITE` dentro de
otro `REPITE`. No hay comandos nuevos, y ese es el mensaje del mundo: la potencia viene de combinar lo
que ya se tiene, no de acumular vocabulario. Un rosetón de 36 cuadrados es imposible de escribir a
mano dentro del presupuesto, así que el jugador no puede evitar anidar. Ahí ocurre el clic mental.

El andamiaje del límite duro ya existe en `src/juego/reto.ts` (`presupuestoEstrella`, `limiteDuro`,
`limiteDuroActivo`, `MARGEN_LIMITE_DURO_POR_OMISION`, `PRIMER_MUNDO_CON_LIMITE_DURO`): esta spec lo
consume, no lo reinventa. Las insignias extienden `src/juego/insignias.ts`. El azar del desafío
infinito usa el PRNG del proyecto (`src/azar/prng.ts`), nunca `Math.random`.

### Decisiones cerradas

**El límite duro se exige, no se sugiere** — `limiteDuro = presupuestoEstrella + margen`, con margen 3
por omisión y global al mundo. Un programa cuyo conteo excede `limiteDuro` **no se ejecuta**: Kiro lo
detiene antes de dibujar y explica. Ejecutarlo y luego negar la estrella dejaría al jugador con un
dibujo correcto en pantalla y un mensaje que se siente arbitrario. El margen 3 existe para que un
programa equivalente escrito «con rodeos» quepa y pueda verse; se exige demostrarlo con pruebas de
programas equivalentes más largos que el de referencia pero dentro del margen.

**El mensaje de bloqueo es centralizado y empuja a anidar** — El mensaje vive en
`src/lenguaje/errores.ts`, no como literal suelto. Nombra la cuenta exacta (instrucciones usadas N,
límite M, sobran N−M) y sugiere anidar `REPITE` sin revelar la figura ni la solución. No se escriben
literales de este mensaje fuera del catálogo de errores.

**La normalización del mundo 3 es fija** — Desde el mundo 3 la validación compara la figura completa
tal como quedó en el lienzo, sin centrar por caja envolvente: traslación fija, rotación fija, escala
exacta, con la tolerancia de dilatación existente de `validacion-geometrica`. El enunciado de cada
nivel del mundo 3 advierte explícitamente que la posición y el rumbo de partida importan, porque la
composición espacial ya es parte del reto.

**El desafío infinito encadena retos determinista y sin retroceder** — Al terminar un mundo se abre su
desafío infinito: una secuencia de retos generados de los niveles generados del mundo, encadenados sin
fin y sin volver atrás. Cada reto se identifica por una semilla derivada con el PRNG del proyecto a
partir de una semilla raíz, de modo que toda la secuencia es reproducible por su raíz. El desafío va
rotando entre los niveles generados del mundo. Es retroactivo: los mundos 0, 1 y 2 también lo tienen.

### Patrones EARS en español

| Patrón | Forma en este documento | EARS |
|---|---|---|
| Ubicuo | EL/LA \<sistema\> DEBERÁ \<respuesta\> | THE … SHALL |
| Dirigido por evento | CUANDO \<disparador\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHEN … |
| Dirigido por estado | MIENTRAS \<condición\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHILE … |
| Evento no deseado | SI \<condición\>, ENTONCES EL/LA \<sistema\> DEBERÁ \<respuesta\> | IF … THEN … |
| Opcional | DONDE \<opción\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHERE … |

## Glossary

- **Limite_Duro**: entero `presupuestoEstrella + margen`, donde `margen` es `margenLimiteDuro` del
  nivel o `MARGEN_LIMITE_DURO_POR_OMISION` (3) por omisión. Es el conteo máximo de instrucciones que
  un programa puede tener para ejecutarse. Vive en el campo `limiteDuro` del `Reto` de
  `src/juego/reto.ts`.
- **Limite_Duro_Activo**: condición booleana `mundo ≥ PRIMER_MUNDO_CON_LIMITE_DURO` (3), expuesta como
  `limiteDuroActivo` del `Reto`. Cuando es falsa, el programa corre aunque exceda el presupuesto.
- **Contador_Editor**: componente de la interfaz que muestra, mientras el jugador escribe, el conteo
  de instrucciones del programa actual según `src/lenguaje/conteo.ts`.
- **Catalogo_Errores**: el módulo `src/lenguaje/errores.ts`, única fuente de los mensajes visibles al
  jugador.
- **Mensaje_Limite_Excedido**: mensaje del `Catalogo_Errores` que se produce cuando un programa excede
  el `Limite_Duro` estando activo. Nombra la cuenta exacta y sugiere anidar `REPITE`.
- **Normalizacion_Fija**: configuración de validación con `traslacion: 'fija'`, `rotacion: 'fija'` y
  `escala: 'exacta'`. Compara la figura tal como quedó en el lienzo, sin centrar por caja envolvente.
- **Estrella_Abstraccion_Anidado**: condición `usaRepiteAnidado` — el AST del jugador contiene un nodo
  `REPITE` entre los descendientes de otro nodo `REPITE`.
- **Generador_M3**: función pura `Generador` (contrato de `src/niveles/tipos.ts`) para los niveles
  generados del mundo 3 (3.2 y 3.3). Toda su aleatoriedad sale de un PRNG sembrado con la semilla del
  intento.
- **Desafio_Infinito**: secuencia determinista e ilimitada de retos generados de un mundo, derivada de
  una semilla raíz con el PRNG del proyecto, que rota entre los niveles generados del mundo y no
  retrocede.
- **Semilla_Raiz**: semilla que identifica una corrida completa de `Desafio_Infinito`. A partir de
  ella se derivan de forma determinista las semillas de cada reto de la secuencia.
- **Insignia_Simetria**: insignia de concepto del mundo 3, otorgada cuando todos los niveles del mundo
  3 tienen sus tres estrellas.
- **Presupuesto_Referencia**: conteo de instrucciones del programa de referencia según
  `src/lenguaje/conteo.ts`. Es el `presupuestoEstrella` del nivel; no se escribe a mano.

## Requirements

### Requirement 1: Límite duro de instrucciones en el mundo 3

**User Story:** Como jugador, quiero que un programa que se pasa de largo no se ejecute, para que no pueda dibujar un rosetón de 36 cuadrados copiando y pegando y tenga que aprender a anidar `REPITE`.

#### Acceptance Criteria

1. CUANDO se resuelve un reto de un nivel del mundo 3, EL sistema DEBERÁ fijar `limiteDuro` en `presupuestoEstrella` más el margen del nivel (`margenLimiteDuro`), o más `MARGEN_LIMITE_DURO_POR_OMISION` (3) cuando el nivel no declara margen.
2. CUANDO se resuelve un reto de un nivel del mundo 3, EL sistema DEBERÁ fijar `limiteDuroActivo` en verdadero.
3. MIENTRAS `limiteDuroActivo` es verdadero, SI el conteo del programa del jugador es estrictamente mayor que `limiteDuro`, ENTONCES EL sistema DEBERÁ detener el intento antes de emitir cualquier operación de la tortuga y no dibujar ninguna estela.
4. MIENTRAS `limiteDuroActivo` es verdadero, CUANDO el conteo del programa del jugador es menor o igual que `limiteDuro`, EL sistema DEBERÁ ejecutar el programa con normalidad.
5. MIENTRAS `limiteDuroActivo` es falso (mundos 0 a 2), CUANDO el conteo del programa del jugador es estrictamente mayor que `presupuestoEstrella`, EL sistema DEBERÁ ejecutar el programa y DEBERÁ no otorgar la estrella de economía.
6. DONDE un programa del jugador tiene el mismo conteo que el `presupuestoEstrella` del nivel, EL sistema DEBERÁ ejecutarlo, porque un programa igual al presupuesto nunca excede el `limiteDuro`.
7. DONDE un programa del jugador es un rodeo equivalente al de referencia cuyo conteo supera al `presupuestoEstrella` en no más de 3 instrucciones, EL sistema DEBERÁ ejecutarlo, porque cabe dentro del `limiteDuro`.

### Requirement 2: Mensaje de bloqueo por límite excedido

**User Story:** Como jugador, quiero que cuando mi programa se pase del límite el mensaje me diga por cuánto me pasé y me empuje a anidar, sin revelarme la figura, para corregir por mí mismo.

#### Acceptance Criteria

1. CUANDO el conteo del programa del jugador (`N`) excede el `Limite_Duro` (`M`) estando activo, EL Catalogo_Errores DEBERÁ producir el `Mensaje_Limite_Excedido` incluyendo el conteo usado `N`, el límite `M` y la diferencia `N − M`.
2. EL Mensaje_Limite_Excedido DEBERÁ sugerir anidar `REPITE` dentro de otro `REPITE` como camino para bajar el conteo.
3. EL Mensaje_Limite_Excedido NO DEBERÁ revelar la figura del reto, el programa de referencia ni el valor de `presupuestoEstrella`.
4. EL Mensaje_Limite_Excedido DEBERÁ definirse en el `Catalogo_Errores` (`src/lenguaje/errores.ts`), y ningún otro módulo DEBERÁ escribir el texto de este mensaje como literal suelto.
5. CUANDO el Contador_Editor muestra el conteo del programa mientras el jugador escribe, Y ese conteo excede el `Limite_Duro` del reto en curso estando activo, EL Contador_Editor DEBERÁ señalar que el programa quedará bloqueado antes de que el jugador ejecute.
6. MIENTRAS el conteo del programa en el editor es menor o igual que el `Limite_Duro` del reto en curso, EL Contador_Editor NO DEBERÁ señalar bloqueo.

### Requirement 3: Normalización fija desde el mundo 3

**User Story:** Como jugador del mundo 3, quiero que la posición y el rumbo de partida cuenten para aprobar, porque componer en el espacio ya es parte del reto.

#### Acceptance Criteria

1. CUANDO se valida la precisión de un nivel del mundo 3, EL Validador DEBERÁ usar `Normalizacion_Fija` (traslación fija, rotación fija, escala exacta), comparando la figura tal como quedó en el lienzo sin centrar por caja envolvente.
2. CUANDO se valida la precisión de un nivel del mundo 3, EL Validador DEBERÁ aplicar la tolerancia de dilatación de trazo existente en `validacion-geometrica`, sin cambiarla.
3. CUANDO el jugador dibuja la figura correcta del reto pero desplazada respecto de la posición de partida de la referencia más allá de la tolerancia de dilatación, EL Validador DEBERÁ no otorgar la estrella de precisión.
4. CUANDO el jugador dibuja la figura correcta del reto pero rotada respecto del rumbo de partida de la referencia más allá de la tolerancia de dilatación, EL Validador DEBERÁ no otorgar la estrella de precisión.
5. CADA nivel del mundo 3 DEBERÁ declarar en sus datos `normalizacion` con `traslacion: 'fija'`, `rotacion: 'fija'` y `escala: 'exacta'`.
6. EL enunciado de cada nivel del mundo 3 DEBERÁ advertir explícitamente que la posición y el rumbo de partida de la tortuga importan para aprobar.

### Requirement 4: Niveles autorados del mundo 3 (3.1 y 3.4)

**User Story:** Como jugador, quiero que los niveles 3.1 y 3.4 tengan retos fijos y bien elegidos, para que la primera lección de iteración anidada y el mandala final sean iguales para todos.

#### Acceptance Criteria

1. EL nivel 3.1 DEBERÁ tener como programa de referencia el rosetón de 36 cuadrados `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]`.
2. EL nivel 3.1 DEBERÁ tener un `presupuestoEstrella` de 5, derivado por `src/lenguaje/conteo.ts` de su programa de referencia, sin ningún número de presupuesto escrito a mano en los datos del nivel.
3. EL nivel 3.4 DEBERÁ tener como programa de referencia el mandala `REPITE 8 [GD 45 REPITE 6 [REPITE 90 [AV 2 GD 2] GD 90]]`.
4. CUANDO se ejecuta el programa de referencia del nivel 3.4, EL Intérprete DEBERÁ completar la ejecución sin activar ninguna de las guardas de ejecución, en particular la guarda de 200 000 pasos de tortuga.
5. CADA nivel autorado del mundo 3 DEBERÁ declarar `usaRepiteAnidado` como exigencia de la estrella de abstracción.
6. CUANDO se carga un nivel autorado del mundo 3, EL sistema DEBERÁ fijar su `presupuestoEstrella` con el valor que el Conteo devuelve al aplicarse a su programa de referencia.
7. EL programa de referencia de cada nivel autorado del mundo 3 DEBERÁ obtener las tres estrellas (precisión, economía y abstracción) al validarse contra su propio nivel.

### Requirement 5: Generadores del mundo 3 (3.2 y 3.3)

**User Story:** Como diseñador de niveles, quiero que los niveles 3.2 y 3.3 generen rosetones distintos por semilla, resolubles con iteración anidada y con presupuesto calculado, sin números a mano.

#### Acceptance Criteria

1. CUANDO se genera el nivel 3.2 con una semilla, EL Generador_M3 DEBERÁ producir un rosetón de polígonos con un número de copias en el conjunto {6, 8, 9, 12, 18, 36} y una figura interna de 3 a 6 lados (inclusive).
2. CUANDO se genera el nivel 3.2 con una semilla, EL programa de referencia DEBERÁ tener la forma de un `REPITE` de copias que contiene el `REPITE` de la figura interna y el giro entre copias.
3. CUANDO se genera el nivel 3.3 con una semilla, EL Generador_M3 DEBERÁ producir una flor con un giro previo al avance en cada pétalo, de la forma `REPITE c [REPITE n [GD a AV L] GD 360/c]`.
4. CADA Generador_M3 DEBERÁ emitir únicamente ángulos derivables (`360/n` con `n` de 3 a 12, o múltiplos de 15) y longitudes múltiplos de 20.
5. CADA Generador_M3 DEBERÁ fijar el `presupuestoEstrella` del nivel con el valor que el Conteo devuelve al aplicarse al programa de referencia, en tiempo de ejecución, sin escribir a mano ningún valor de presupuesto en los datos del nivel.
6. SI la figura generada es degenerada (el ancho o el alto de su caja envolvente alineada a los ejes es menor que 200 px), ENTONCES EL Generador_M3 DEBERÁ descartar la semilla e intentar con la semilla siguiente.
7. SI la figura generada no está encuadrada (su caja envolvente alineada a los ejes se sale del rango [−400, 400] px en cualquier eje), ENTONCES EL Generador_M3 DEBERÁ descartar la semilla e intentar con la semilla siguiente.
8. CADA Generador_M3 DEBERÁ declarar `usaRepiteAnidado` como exigencia de la estrella de abstracción del nivel.
9. CUANDO se verifica un Generador_M3 sobre 200 semillas consecutivas, cada una de las 200 DEBERÁ producir un reto encuadrado y no degenerado cuya referencia obtiene las tres estrellas (precisión, economía y abstracción).

### Requirement 6: Estrella de abstracción por iteración anidada

**User Story:** Como jugador, quiero que el mundo 3 me exija de verdad anidar `REPITE` y no solo repetir una lista larga, para aprender que la simetría rotacional se escribe con un bucle dentro de otro.

#### Acceptance Criteria

1. CADA nivel del mundo 3 DEBERÁ declarar `usaRepiteAnidado` como requisito de su estrella de abstracción.
2. CUANDO el jugador aprueba un nivel del mundo 3 con precisión y su AST contiene un nodo `REPITE` entre los descendientes de otro nodo `REPITE`, EL sistema DEBERÁ otorgar la estrella de abstracción.
3. SI el jugador aprueba un nivel del mundo 3 con precisión pero su AST no contiene ningún `REPITE` anidado, ENTONCES EL sistema DEBERÁ otorgar la precisión y no otorgar la estrella de abstracción.
4. CUANDO EL Verificador decide si se cumple `usaRepiteAnidado`, EL Verificador DEBERÁ analizar el AST del jugador, no el texto del programa.

### Requirement 7: Desafío infinito por mundo

**User Story:** Como jugador que ya terminó un mundo, quiero un desafío infinito que encadene retos generados de ese mundo de forma reproducible, para seguir practicando y ganar las insignias transversales.

#### Acceptance Criteria

1. CUANDO el jugador aprueba todos los niveles de un mundo, EL sistema DEBERÁ dejar disponible el `Desafio_Infinito` de ese mundo.
2. MIENTRAS un `Desafio_Infinito` no está disponible (el mundo no está completo), EL sistema DEBERÁ no permitir iniciarlo.
3. CUANDO se inicia un `Desafio_Infinito` con una `Semilla_Raiz`, EL sistema DEBERÁ derivar las semillas de los retos de la secuencia a partir de esa raíz usando el PRNG del proyecto (`src/azar/prng.ts`), sin usar `Math.random`.
4. CUANDO se recorren dos corridas del `Desafio_Infinito` del mismo mundo con la misma `Semilla_Raiz`, EL sistema DEBERÁ producir exactamente la misma secuencia de retos.
5. CUANDO el jugador avanza en un `Desafio_Infinito`, EL sistema DEBERÁ entregar el siguiente reto sin permitir retroceder a un reto anterior de la secuencia.
6. CUANDO el `Desafio_Infinito` genera retos sucesivos, EL sistema DEBERÁ rotar entre los niveles generados del mundo.
7. EL sistema DEBERÁ ofrecer el `Desafio_Infinito` en los mundos 0, 1 y 2, además del mundo 3, de forma retroactiva.
8. SI un mundo no tiene niveles generados, ENTONCES EL sistema DEBERÁ no ofrecer `Desafio_Infinito` para ese mundo.

### Requirement 8: Insignia de concepto Simetría

**User Story:** Como jugador, quiero ganar la insignia *Simetría* al completar el mundo 3 con las tres estrellas en todos los niveles, como reconocimiento de que entendí la iteración anidada.

#### Acceptance Criteria

1. CUANDO cada uno de los niveles del mundo 3 tiene otorgadas sus tres estrellas (precisión, economía y abstracción de forma simultánea), EL sistema DEBERÁ otorgar la `Insignia_Simetria`.
2. SI al menos un nivel del mundo 3 no tiene otorgada alguna de sus tres estrellas, ENTONCES EL sistema DEBERÁ no otorgar la `Insignia_Simetria`.
3. CUANDO el jugador vuelve a completar niveles del mundo 3 con la `Insignia_Simetria` ya otorgada, EL sistema DEBERÁ mantenerla otorgada exactamente una vez, sin crear una segunda instancia.
4. EL otorgamiento de la `Insignia_Simetria` DEBERÁ derivarse solo del progreso y del catálogo, sin estado propio persistido, de modo que sea reproducible a partir de las estrellas guardadas.

### Requirement 9: Insignias transversales

**User Story:** Como jugador, quiero ganar insignias por formas de jugar (depurar, economizar, no pedir pistas, mirar poco), para que el progreso reconozca cómo resuelvo, no solo qué resuelvo.

#### Acceptance Criteria

1. CUANDO el jugador aprueba 5 niveles después de haber usado la reproducción en paralelo, EL sistema DEBERÁ otorgar la insignia *Depurador*.
2. CUANDO el jugador obtiene la estrella de economía en 10 niveles, EL sistema DEBERÁ otorgar la insignia *Minimalista*.
3. CUANDO el jugador completa un mundo entero sin abrir ninguna pista en ninguno de sus niveles, EL sistema DEBERÁ otorgar la insignia *Sin pistas*.
4. CUANDO el jugador resuelve un nivel habiendo visto su demostración una sola vez, EL sistema DEBERÁ otorgar la insignia *Buen ojo*.
5. CUANDO una insignia transversal ya está otorgada, EL sistema DEBERÁ mantenerla otorgada exactamente una vez, sin crear una segunda instancia.
6. EL otorgamiento de cada insignia transversal DEBERÁ derivarse del progreso registrado, de modo que su verificación sea reproducible por pruebas.

### Requirement 10: Alcance del mundo 3

**User Story:** Como mantenedor del proyecto, quiero que esta spec no toque el lenguaje base ni los mundos ya cerrados, para que agregar el mundo 3 no cause regresiones.

#### Acceptance Criteria

1. ESTA spec NO DEBERÁ modificar el lexer ni el parser de KiroLogo.
2. ESTA spec NO DEBERÁ introducir variables, parámetros, aritmética, condicionales ni recursión.
3. CUANDO se ejecutan los retos de referencia de los niveles de los mundos 0, 1 y 2, EL sistema DEBERÁ producir exactamente el mismo comportamiento que antes de esta spec (mismas operaciones, mismos presupuestos, mismas estrellas).
4. ESTA spec NO DEBERÁ construir el mapa de insignias completo, que pertenece a una spec posterior; se limita a las reglas de otorgamiento verificables por pruebas.
5. CUANDO se agrega un nivel del mundo 3, EL sistema DEBERÁ hacerlo como dato en `src/niveles/`, sin lógica de juego nueva fuera de los generadores.
