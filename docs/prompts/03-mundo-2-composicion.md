# Prompt · Spec 03 · Mundo 2 · Composición

> Pegar el texto de abajo al iniciar la spec.

---

Quiero crear la spec **03-mundo-2-composicion** de KiroLogo. Las specs 00 a 02 están terminadas: el
juego es jugable hasta el mundo 1, con `REPITE` y reproducción en paralelo.

## Objetivo

Agregar los procedimientos con `PARA…FIN`, el control del lápiz y el color, y los seis niveles del
mundo 2. Es el mundo donde el jugador deja de dar instrucciones y empieza a **enseñarle palabras
nuevas** a Kiro.

Concepto que enseña: una figura compleja es la suma de figuras simples, y nombrar un dibujo permite
reusarlo. Es el camino `CUADRADO` → `FLOR` → `JARDÍN` del artículo del MIT.

## Alcance

**Lenguaje**

- `PARA … FIN` sin parámetros: definición de procedimientos y su invocación.
- Un procedimiento definido se usa **igual que un comando del lenguaje**. Al leer un programa no se
  debe poder distinguir cuáles palabras vienen del lenguaje y cuáles se definieron. Eso es justamente
  lo que enseña este mundo, y debe reflejarse en el panel de comandos y en los mensajes de error.
- `SUBELAPIZ` / `SL`, `BAJALAPIZ` / `BL`.
- `PONCOLOR` / `PC`, `PONGROSOR` / `PG`, `RELLENA` / `RL`, con nombres de color en español y la forma
  RGB en lista.
- `OCULTATORTUGA` / `OT`, `MUESTRATORTUGA` / `MT`.
- Errores nuevos: `FIN` sin `PARA`, `PARA` sin `FIN`, procedimiento redefinido, invocación de un
  procedimiento inexistente.
- Regla de conteo: la cabecera `PARA…FIN` no cuenta, el cuerpo cuenta una vez, cada llamada cuenta 1.
  Definir un procedimiento nunca puede salir más caro que copiar y pegar.

**Animación**

`SUBELAPIZ` se anima como Kiro levantando físicamente el lápiz de la tortuga, y la tortuga se ve
distinta mientras el lápiz está arriba. El cambio de estado nunca es invisible.

**Niveles**

- 2.1 autorado, casa: cuadrado más triángulo encima.
- 2.2 generado, estrella de 5, 7 o 9 puntas.
- 2.3 generado, escalera de 3 a 6 peldaños.
- 2.4 autorado, cruz.
- 2.5 generado, dos figuras separadas. Obliga a `SUBELAPIZ` / `BAJALAPIZ`.
- 2.6 generado, cuadrícula de paneles de 2×2, 3×2 o 3×3. Exige `defineProcedimiento`.

**Estrella de abstracción**

Segunda exigencia nueva: `defineProcedimiento`. En el 2.6 el presupuesto se calcula sobre una
referencia que usa `PARA`, así que copiar el panel seis veces no alcanza.

**Relleno**

`RELLENA` necesita detección del área cerrada donde está la tortuga. Hay que decidir si se implementa
como relleno por inundación sobre el rasterizado o como algo más simple, y cómo afecta al validador
geométrico, que hasta ahora solo compara trazos.

## Fuera de alcance

- Parámetros de procedimientos y variables. Aquí `PARA` no recibe argumentos.
- Aritmética, condicionales, recursión.
- `limiteDuro`, desafío infinito.

## Criterios de aceptación

1. `PARA CUADRADO / REPITE 4 [AV 100 GD 90] / FIN` seguido de `CUADRADO` dibuja un cuadrado.
2. El panel de comandos muestra los procedimientos definidos por el jugador junto a los del lenguaje.
3. El contador de instrucciones aplica la regla de conteo de procedimientos, y definir uno nunca
   resulta más caro que repetir el código.
4. `SL` y `BL` cambian el trazo, y la animación muestra a Kiro levantando el lápiz.
5. El nivel 2.6 no otorga abstracción si el jugador copió el panel varias veces, con la explicación de
   Kiro.
6. `PARA` sin `FIN` produce el mensaje con el nombre del procedimiento y la línea donde empezó.
7. Un color mal escrito produce un error que lista los colores disponibles.
8. `RELLENA` produce un resultado que el validador puede comparar de forma estable.
9. Cada generador se prueba sobre al menos 200 semillas.

## Steering a consultar

`lenguaje-kirologo` para la sintaxis de `PARA`, los colores, el conteo y los errores.
`niveles-y-progresion` para los niveles y los rangos.
`validacion-geometrica` para la exigencia `defineProcedimiento` y el impacto del relleno.

## Decisiones a cerrar en la fase de requisitos

- Cómo entra el relleno en la validación geométrica. El algoritmo actual compara trazos dilatados; un
  área rellena es otra clase de cosa. La opción conservadora es que `RELLENA` sea decorativo y no
  cuente para la precisión, y que ningún nivel dependa de él para aprobar. Hay que decidirlo antes de
  escribir el nivel B.5, que sí lo usa.
- Si el color cuenta para la precisión. Recomendación: no, salvo en los niveles del mundo bonus que lo
  declaren explícitamente. Colorear no es pensamiento algorítmico.
- Cómo se muestra en el editor la separación entre la definición de procedimientos y el programa
  principal, sin imponer una estructura que Logo no exige.
- Qué pasa si el jugador nombra un procedimiento igual que un comando del lenguaje.
