# Prompt · Spec 02 · Mundo 1 · Figuras geométricas

> Pegar el texto de abajo al iniciar la spec.

---

Quiero crear la spec **02-mundo-1-figuras** de KiroLogo. Las specs 00-cimientos y
01-mundo-0-primeros-pasos están terminadas: el juego es jugable hasta el mundo 0, con generadores,
progreso e insignias.

## Objetivo

Agregar `REPITE` al lenguaje y los cinco niveles del mundo 1. Es el momento más importante del juego:
donde el jugador descubre que repetir a mano es innecesario.

Concepto que enseña: iteración, y la regla del ángulo exterior. La tortuga siempre da una vuelta
completa, 360 grados repartidos entre los lados.

## Alcance

**Lenguaje**

- `REPITE` / `RP` con lista de instrucciones entre corchetes.
- Nodo de AST, caso del intérprete y regla de conteo: `REPITE` cuenta 1 más las instrucciones del
  cuerpo escrito, no por iteración. Ese detalle **es** el incentivo pedagógico del juego, y ya está
  especificado en `lenguaje-kirologo`.
- Errores de corchete sin cerrar y de cierre sobrante, con número de línea.
- Anidación permitida desde el principio en el lenguaje, aunque el mundo 3 sea el que la exige.

**Niveles**

- 1.1 autorado, cuadrado con `REPITE`. Viene justo después del cuadrado a mano del 0.4, y el contraste
  es la lección.
- 1.2 generado, polígono regular de 3 a 8 lados.
- 1.3 generado, el mismo polígono pero girando a la izquierda, para romper el automatismo del `GD`.
- 1.4 autorado, círculo con `REPITE 360 [AV 2 GD 1]`.
- 1.5 generado, arco: un polígono con menos repeticiones de las que necesita para cerrar.

El 1.5 es el más valioso del mundo. El jugador descubre que iterar y cerrar son dos cosas distintas.

**Estrella de abstracción**

Primera aparición real: `usaRepite`. Un cuadrado dibujado a mano en el nivel 1.1 gana precisión pero no
abstracción, y Kiro explica por qué con una frase concreta.

**Reproducción en paralelo**

Aquí es donde empieza a hacer falta, porque los errores dejan de ser evidentes: un pentágono con giros
de 90° se ve raro pero no dice dónde está la falla.

- Las dos ejecuciones corren al mismo tiempo, con dos tortugas sobre la misma cuadrícula.
- Se detecta el primer paso donde divergen, comparando **operaciones de la tortuga**, no líneas de
  código, con tolerancia de 8 px y 1 grado.
- Kiro señala la diferencia concreta: *"hasta aquí íbamos igual; en este giro yo doblé 72 grados y tú
  90."*
- Casos de borde: un programa más corto que el otro, y programas que nunca divergen pero fallan por
  exceso de trazo al final.

**Insignia**

*Iteración*, al completar el mundo con las tres estrellas.

## Fuera de alcance

- `PARA…FIN`, lápiz, color y todo el vocabulario del mundo 2 en adelante.
- `limiteDuro`, que se activa en el mundo 3.
- Desafío infinito.

## Criterios de aceptación

1. `REPITE 4 [AV 100 GD 90]` dibuja un cuadrado, y el contador de instrucciones muestra 3.
2. `REPITE` anidado se parsea y ejecuta correctamente, aunque ningún nivel de este mundo lo pida.
3. Los presupuestos de los niveles generados salen del conteo de su referencia, sin números a mano.
4. En el nivel 1.1, resolver a mano da precisión y economía pero no abstracción, con la explicación de
   Kiro.
5. La reproducción en paralelo encuentra el paso exacto de divergencia en un pentágono resuelto con
   giros de 90°.
6. Dos programas escritos de forma distinta pero equivalentes no divergen en la reproducción.
7. Un corchete sin cerrar produce el mensaje con el número de línea correcto.
8. Cada generador se prueba sobre al menos 200 semillas.

## Steering a consultar

`lenguaje-kirologo` para `REPITE`, la sintaxis de listas, la regla de conteo y los mensajes de error.
`niveles-y-progresion` para los niveles y los rangos.
`validacion-geometrica` para la reproducción en paralelo y el diff temporal.

## Decisiones a cerrar en la fase de requisitos

- Cómo se sincronizan visualmente las dos ejecuciones en la reproducción en paralelo cuando tienen
  cantidades muy distintas de pasos. Alinear por paso es lo correcto para detectar divergencia, pero
  puede verse extraño si una tortuga termina mucho antes.
- Si el círculo del 1.4 exige las 360 repeticiones o acepta aproximaciones equivalentes. La tolerancia
  de 8 px probablemente ya lo resuelve, conviene verificarlo con casos reales.
- Si el arco del 1.5 mantiene la invariancia a rotación. Una figura abierta bajo rotación libre puede
  volver la validación más permisiva de lo deseable.
- Cómo se presenta la primera negación de la estrella de abstracción para que se lea como una
  invitación y no como un castigo.
