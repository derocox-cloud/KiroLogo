# Requisitos · Spec 06 · Mundo 5 · Fractales

## Introducción

Agrega condicionales y recursión al lenguaje, los cinco niveles del mundo 5 y la insignia *Recursión*.
Cierra el recorrido principal. Concepto: caso base, autosimilitud, un procedimiento que se llama a sí mismo.

## Requisitos

### R1 · Condicionales y comparadores
1. `SI cond [lista]` ejecuta la lista solo si la condición es cierta; `SINO cond [lista] [lista]` elige entre dos.
2. Los comparadores son `=`, `<` y `>`. La igualdad tiene tolerancia de 1e-9. No hay `<=`, `>=` ni `<>`.
3. La condición compara dos expresiones aritméticas. Sin comparador, con dos comparadores o fuera de `SI`/`SINO`, es `condicionMalFormada`.
4. Antes del mundo 5 los comparadores dan un solo `comparadorBloqueado` por programa y `SI`, `SINO`, `ALTO` y `DEVUELVE` dan `comandoBloqueado`.
5. Una condición rota no produce errores en cascada por los corchetes de sus listas.

### R2 · ALTO y DEVUELVE
1. `ALTO` termina el procedimiento en curso, aunque esté dentro de `REPITE` o `SI`; quien llamó sigue.
2. `ALTO` y `DEVUELVE` fuera de un `PARA` son `altoFueraDeProcedimiento` y `devuelveFueraDeProcedimiento`.
3. Un `PARA` con `DEVUELVE` (`DV`) se usa donde va un número; como operador solo calcula y puede ser recursivo.
4. Llamarlo como instrucción es `devuelveSinUso`; usar como número uno sin `DEVUELVE`, `procedimientoSinValor`; si ningún camino devuelve, `procedimientoSinResultado`; si dibuja o escribe, `operadorConEfectos`.

### R3 · Recursión y guardas
1. Un procedimiento puede invocarse a sí mismo. La guarda de 100 niveles cuenta solo marcos de procedimiento.
2. La recursión sin caso base corta con un mensaje que nombra el procedimiento y sugiere revisar la condición de corte.
3. La espiral del 5.1 se detiene por su caso base sin tocar la guarda.
4. Los 100 niveles alcanzan para Koch de nivel 3 y el árbol de profundidad 6 sin ajustar el número.

### R4 · Conteo y abstracción
1. `SI` y `SINO` cuentan 1 más las instrucciones de sus listas; la condición y las llamadas con valor cuestan 0.
2. `usaRecursion` reconoce la llamada a sí mismo, también dentro de una expresión. Si falta, Kiro invita a la recursión.
3. El impresor escribe y relee `SI`, `SINO`, `ALTO` y `DEVUELVE` sin cambiar el texto.

### R5 · Niveles
1. 5.1 autorado (espiral cuadrada), 5.2 generado (espiral de n lados), 5.3 autorado (un lado de Koch), 5.4 autorado (copo completo), 5.5 generado (árbol binario).
2. Los presupuestos salen del conteo de la referencia, sin números a mano.
3. Cada generador se prueba sobre al menos 200 semillas: encuadrado, no degenerado, tres estrellas y pistas sin marcadores sin rellenar.
4. El árbol usa `RETROCEDE` para volver sobre la rama y el validador lo acepta pese al trazo repetido; se confirma con una prueba.
5. Los ángulos de 5° del árbol son una excepción documentada a la regla de ángulos derivables.

### R6 · Pedagogía e interfaz
1. En el paso a paso del mundo 5 se muestra la profundidad de la llamada actual y se anuncia por `aria-live`.
2. La insignia *Recursión* se gana con las tres estrellas en los cinco niveles; el desafío infinito del mundo 5 se liga a ella.

## Fuera de alcance
El mundo bonus y el mapa de insignias completo (spec 07).
