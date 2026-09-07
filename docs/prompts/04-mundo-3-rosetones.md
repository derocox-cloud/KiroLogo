# Prompt · Spec 04 · Mundo 3 · Rosetones

> Pegar el texto de abajo al iniciar la spec.

---

Quiero crear la spec **04-mundo-3-rosetones** de KiroLogo. Las specs 00 a 03 están terminadas: el juego
es jugable hasta el mundo 2, con `REPITE`, procedimientos sin parámetros y control del lápiz.

## Objetivo

Los cuatro niveles del mundo 3 y el mecanismo que los hace obligatorios: el `limiteDuro`. **Este mundo
no agrega ni un comando nuevo**, y eso es el mensaje: la potencia viene de combinar mejor lo que ya se
tiene, no de acumular vocabulario.

Concepto que enseña: iteración anidada y simetría rotacional.

## Alcance

**Nada de lenguaje**

`REPITE` anidado ya funciona desde la spec 02. Si esta spec toca el lexer o el parser, algo se planeó
mal antes.

**El `limiteDuro` se activa**

Es la pieza central de la spec y el primer lugar donde el presupuesto deja de ser informativo:

- `limiteDuro` = `presupuestoEstrella` + margen (3 por defecto).
- Un programa que lo excede **no se ejecuta**. Se detiene antes y Kiro explica por qué.
- La razón de detenerlo antes: ejecutarlo y luego negar la estrella dejaría al jugador con un dibujo
  correcto en pantalla y un mensaje que se siente arbitrario.
- El contador del editor tiene que anticipar el bloqueo mientras se escribe, no sorprender al ejecutar.

**Niveles**

- 3.1 autorado, rosetón de 36 cuadrados: `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]`.
- 3.2 generado, rosetón de polígonos: copias en {6, 8, 9, 12, 18, 36}, figura interna de 3 a 6 lados.
- 3.3 generado, flor con giro previo al avance.
- 3.4 autorado, mandala de círculos: `REPITE 8 [GD 45 REPITE 6 [REPITE 90 [AV 2 GD 2] GD 90]]`.

**Normalización fija**

Este mundo es el primero donde la posición y el rumbo de partida importan: la traslación y la rotación
dejan de ser libres. Como la demostración de Kiro muestra dónde empieza y hacia dónde mira la tortuga,
la exigencia es razonable, pero el enunciado del nivel debe decirlo explícitamente.

**Estrella de abstracción**

`usaRepiteAnidado`.

**Desafío infinito**

Se introduce aquí porque es el primer mundo con suficiente variedad generada para que valga la pena:

- Se abre al terminar el mundo y encadena retos generados de sus niveles, sin fin.
- Es el lugar natural para las insignias transversales.
- Retroactivo: los mundos 0, 1 y 2 también lo tienen, con sus propios generadores.

**Insignias transversales**

- *Depurador* — resolver 5 niveles después de haber usado la reproducción en paralelo.
- *Minimalista* — estrella de economía en 10 niveles.
- *Sin pistas* — completar un mundo entero sin abrir ninguna pista.
- *Buen ojo* — resolver un nivel viendo la demostración una sola vez.

**Insignia de concepto**

*Simetría*, al completar el mundo con las tres estrellas.

## Fuera de alcance

- Variables, parámetros y aritmética.
- Condicionales y recursión.
- Mapa de insignias completo, que llega en la spec 07. Aquí basta con otorgarlas y mostrarlas de forma
  simple.

## Criterios de aceptación

1. `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]` dibuja el rosetón, y el contador muestra 5.
2. Un programa que excede el `limiteDuro` no se ejecuta, y Kiro explica cuántas instrucciones sobran.
3. El editor avisa del bloqueo mientras se escribe, antes de que el jugador presione ejecutar.
4. En este mundo, la misma figura en otra posición o con otro rumbo **no** aprueba, y el enunciado del
   nivel lo advertía.
5. Los mundos 0 a 2 no cambiaron de comportamiento: siguen sin límite duro y con normalización libre.
6. El desafío infinito de cada mundo encadena retos sin repetir semilla y sin quedarse sin variedad.
7. Las cuatro insignias transversales se otorgan según sus reglas, y se verifican con pruebas.
8. Cada generador se prueba sobre al menos 200 semillas.
9. El mandala del 3.4 se ejecuta sin acercarse a la guarda de 200 000 pasos, o si se acerca, el número
   de la guarda se revisa con argumentos.

## Steering a consultar

`niveles-y-progresion` para los niveles, los rangos, `limiteDuro` y el desafío infinito.
`validacion-geometrica` para la normalización fija desde este mundo.
`producto` para las reglas de las insignias transversales.

## Decisiones a cerrar en la fase de requisitos

- El margen de 3 del `limiteDuro` es una estimación. Hay que probarlo con programas equivalentes pero
  escritos con rodeos y ver si 3 alcanza o ahoga. Es el número más delicado del juego: muy bajo
  frustra, muy alto vuelve la anidación opcional.
- Cómo se comunica el bloqueo sin que se lea como un castigo. La frase tiene que empujar hacia la
  anidación, no cerrar la puerta.
- El mandala del 3.4 son 8 × 6 × 90 = 4 320 pasos de avance más los giros. Verificar el rendimiento de
  la animación y del rasterizado con figuras de esa densidad, y si hace falta una estrategia para
  dibujar rápido sin perder la sensación de recorrido.
- Cómo evita el desafío infinito repetir un reto que el jugador acaba de ver.
- Si la normalización fija exige también que el punto de partida coincida, o solo la posición relativa
  de la figura completa.
