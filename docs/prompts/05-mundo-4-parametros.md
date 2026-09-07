# Prompt · Spec 05 · Mundo 4 · Parámetros

> Pegar el texto de abajo al iniciar la spec.

---

Quiero crear la spec **05-mundo-4-parametros** de KiroLogo. Las specs 00 a 04 están terminadas: el juego
es jugable hasta el mundo 3, con iteración anidada y `limiteDuro`.

## Objetivo

Agregar parámetros a los procedimientos, la aritmética y los cuatro niveles del mundo 4. Es el salto de
"le enseñé a Kiro a dibujar un hexágono" a "le enseñé a dibujar cualquier polígono".

Concepto que enseña: un procedimiento con parámetros resuelve una familia de problemas, no uno solo.

## Alcance

**Lenguaje**

- Parámetros con `:nombre` en `PARA`, y su resolución en el cuerpo del procedimiento.
- Ámbito de las variables: un parámetro existe solo dentro de su procedimiento. Hay que decidir si es
  léxico o dinámico y documentarlo, porque afecta a la recursión del mundo 5.
- Operadores infijos `+ - * /` con precedencia, sobre números y variables.
- Comandos de operador: `SUMA`, `RESTA`, `PRODUCTO`, `COCIENTE`, `RESTO`, todos en forma larga.
- `AZAR`, que debe usar el PRNG del proyecto y no `Math.random`. Ojo con la reproducibilidad: un
  programa del jugador con `AZAR` no es determinista, y eso choca con la validación. Hay que resolverlo.
- `ESCRIBE` / `ES` con su consola de salida, y `ROTULA` / `RO` para escribir sobre el lienzo.
- Errores nuevos: variable no definida, división por cero, aridad incorrecta en una llamada a
  procedimiento, argumento de tipo equivocado.
- Regla de conteo para expresiones aritméticas: una expresión es parte de la instrucción que la
  contiene, no una instrucción aparte.

**Niveles**

- 4.1 autorado, hexágono con `PARA POLIGONO :lados :largo` y `GD 360 / :lados`.
- 4.2 generado, tres polígonos distintos con **un solo** procedimiento. Exige
  `maximoProcedimientos: 1`.
- 4.3 generado, polígonos concéntricos con lado creciente.
- 4.4 generado, estrella de n puntas parametrizada.

**Estrella de abstracción**

Dos exigencias nuevas: `usaParametros` y `maximoProcedimientos`. En el 4.2, tres procedimientos
distintos que dibujen lo mismo resuelven el nivel pero no ganan la estrella, y Kiro dice exactamente
por qué.

**Insignia**

*Generalización*, al completar el mundo con las tres estrellas.

## Fuera de alcance

- Condicionales, `ALTO`, `DEVUELVE` y recursión. Todo eso es del mundo 5.
- Variables mutables o asignación fuera de los parámetros. No hay `HAZ` en el vocabulario, y agregarlo
  sería salirse del alcance: la generalización se enseña con parámetros, no con estado.

## Criterios de aceptación

1. `PARA POLIGONO :lados :largo / REPITE :lados [AV :largo GD 360 / :lados] / FIN` funciona, y
   `POLIGONO 6 80` dibuja un hexágono.
2. `POLIGONO 3 100`, `POLIGONO 5 100` y `POLIGONO 8 100` funcionan con la misma definición.
3. La precedencia de operadores es correcta: `360 / 2 + 1` y `360 / (2 + 1)` dan resultados distintos, o
   se documenta explícitamente que no hay paréntesis.
4. Una llamada con menos argumentos de los declarados produce un error que dice cuántos faltan y cómo se
   llaman.
5. Una variable usada fuera de su procedimiento produce el mensaje que sugiere declararla en `PARA`.
6. En el nivel 4.2, resolver con tres procedimientos da precisión pero no abstracción, con la
   explicación de Kiro.
7. Los presupuestos de los cuatro niveles salen del conteo de sus referencias, sin números a mano.
8. El contador de instrucciones cuenta las expresiones aritméticas según la regla acordada.
9. Cada generador se prueba sobre al menos 200 semillas.

## Steering a consultar

`lenguaje-kirologo` para parámetros, operadores, comandos de operador y errores.
`niveles-y-progresion` para los niveles y las exigencias de abstracción.
`validacion-geometrica` para `usaParametros` y `maximoProcedimientos`.

## Decisiones a cerrar en la fase de requisitos

- **`AZAR` y la validación son incompatibles.** Un programa con `AZAR` produce una figura distinta cada
  vez, así que no puede aprobar un nivel de forma estable. Opciones: dejar `AZAR` disponible solo en el
  modo libre, o fijarle la semilla del reto durante la validación. Hay que decidirlo antes de exponerlo,
  o el jugador va a encontrar el hueco.
- Si hay **paréntesis** en las expresiones. Sin ellos la aritmética es más simple de parsear pero
  `360 * 2 / :puntas` depende por completo de la precedencia, y eso es una fuente de confusión que no
  enseña nada. Recomendación: incluirlos.
- Ámbito de variables, léxico o dinámico. Logo tradicional usa dinámico; léxico es más predecible para
  quien aprende. La decisión condiciona el mundo 5.
- Si `ESCRIBE` y `ROTULA` cuentan para la precisión geométrica. `ROTULA` dibuja sobre el lienzo, así que
  afecta al validador; `ESCRIBE` no.
- Cómo se muestra la consola de `ESCRIBE` sin robarle espacio al lienzo ni al editor.
