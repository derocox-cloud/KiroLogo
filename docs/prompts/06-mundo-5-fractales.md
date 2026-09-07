# Prompt · Spec 06 · Mundo 5 · Fractales

> Pegar el texto de abajo al iniciar la spec.

---

Quiero crear la spec **06-mundo-5-fractales** de KiroLogo. Las specs 00 a 05 están terminadas: el juego
es jugable hasta el mundo 4, con procedimientos parametrizados y aritmética.

## Objetivo

Agregar condicionales y recursión, y los cinco niveles del mundo 5. Es el último mundo del recorrido
principal y el más exigente: cierra el arco que empezó con `AVANZA 100`.

Concepto que enseña: caso base, autosimilitud, un procedimiento que se llama a sí mismo.

## Alcance

**Lenguaje**

- `SI` con condición y lista de instrucciones.
- `SINO` con condición y dos listas.
- Comparadores en las condiciones: `=`, `<`, `>`, y decidir si hace falta algo más.
- `ALTO` para terminar el procedimiento actual.
- `DEVUELVE` / `DV` para terminar devolviendo un valor, lo que permite procedimientos que se usan como
  operadores.
- Recursión: un procedimiento que se invoca a sí mismo, con la guarda de 100 niveles de profundidad ya
  definida en `tecnologia.md`.
- Errores nuevos: recursión sin caso base con el mensaje que nombra el procedimiento y sugiere revisar
  la condición de corte, condición mal formada, `DEVUELVE` usado donde no se espera un valor.
- Regla de conteo: `SI` y `SINO` cuentan 1 más las instrucciones de sus listas.

**Niveles**

- 5.1 autorado, espiral cuadrada con caso base por longitud.
- 5.2 generado, espiral de n lados con incremento variable.
- 5.3 autorado, copo de Koch, un lado, con las cuatro llamadas recursivas.
- 5.4 autorado, copo de Koch completo.
- 5.5 generado, árbol binario con ángulo y factor variables.

Los niveles de Koch son autorados a propósito: la estructura de las cuatro llamadas es la lección, y
generarla al azar solo agregaría ruido.

**Estrella de abstracción**

`usaRecursion`.

**Pedagogía de la recursión**

Es el concepto más difícil del juego y merece atención explícita en el diseño:

- La reproducción en paralelo se vuelve la herramienta principal, porque un fractal mal escrito falla de
  formas que no se leen mirando la figura.
- El modo paso a paso necesita mostrar la **profundidad de la llamada actual**. Sin eso, ver ejecutar una
  recursión no enseña nada.
- El mensaje de recursión sin caso base es la diferencia entre entenderla y abandonarla. No puede ser un
  error genérico de la guarda: tiene que nombrar el procedimiento y apuntar a la condición que falta.

**Insignia**

*Recursión*, al completar el mundo con las tres estrellas.

## Fuera de alcance

- El mundo bonus y su vocabulario, si necesitara alguno.
- El mapa de insignias completo, que llega en la spec 07.

## Criterios de aceptación

1. La espiral del 5.1 se dibuja y se detiene por su caso base, sin tocar la guarda de profundidad.
2. `PARA KOCH :largo :nivel` con las cuatro llamadas recursivas produce el copo, y el 5.4 lo compone con
   `REPITE 3`.
3. Un procedimiento recursivo sin caso base corta con el mensaje que lo nombra y sugiere qué falta, no
   con un error genérico.
4. La guarda de profundidad de 100 niveles corta antes de que el navegador se degrade.
5. El árbol del 5.5 se dibuja con `RETROCEDE` para volver sobre la rama, y la validación lo acepta a
   pesar del trazo repetido.
6. El modo paso a paso muestra en qué profundidad de llamada está la ejecución.
7. Los presupuestos salen del conteo de las referencias, sin números a mano.
8. Cada generador se prueba sobre al menos 200 semillas.

## Steering a consultar

`lenguaje-kirologo` para `SI`, `SINO`, `ALTO`, `DEVUELVE` y sus errores.
`niveles-y-progresion` para los niveles y los rangos.
`tecnologia` para las guardas de ejecución.
`validacion-geometrica` para `usaRecursion`.

## Decisiones a cerrar en la fase de requisitos

- **El trazo repetido del árbol.** `AV :largo` seguido de `RE :largo` dibuja dos veces sobre la misma
  línea. El validador compara máscaras rasterizadas, así que probablemente no importa, pero hay que
  verificarlo con el fractal real: si el exceso del 5 % se calcula sobre píxeles, un trazo repetido no
  suma píxeles nuevos y todo está bien. Confirmarlo con una prueba, no por deducción.
- Los fractales generan muchísimos segmentos. Verificar que el rasterizado y la invariancia a rotación
  (aunque en este mundo esté fija) siguen siendo razonables en tiempo.
- Si `DEVUELVE` es necesario para los cinco niveles. Si ninguno lo usa, conviene evaluar si entra en esta
  spec o si es vocabulario que sobra.
- Cómo se visualiza la profundidad de llamada sin abrumar la interfaz.
- Si la profundidad de 100 alcanza para el Koch de nivel 3 y el árbol de profundidad 6, o si el número
  necesita ajustarse con argumentos.
- Ángulos del árbol: `niveles-y-progresion` dice pasos de 5 grados, que no son múltiplos de 15. Decidir
  si el árbol es una excepción documentada a la regla de ángulos derivables, igual que las
  aproximaciones de curva, o si se ajustan los rangos.
