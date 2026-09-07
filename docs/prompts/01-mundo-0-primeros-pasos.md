# Prompt · Spec 01 · Mundo 0 · Primeros pasos

> Pegar el texto de abajo al iniciar la spec.

---

Quiero crear la spec **01-mundo-0-primeros-pasos** de KiroLogo. La spec 00-cimientos está terminada:
el lenguaje del mundo 0, el motor, el validador y un nivel de prueba ya funcionan.

## Objetivo

Completar el primer mundo: los cinco niveles, los dos primeros generadores de retos, el sistema de
progreso y desbloqueo, la insignia *Secuencia* y la primera experiencia de quien abre el juego sin
saber qué es Logo.

Concepto que enseña: una instrucción tras otra cambia un estado. La tortuga tiene posición y rumbo, y
obedece literalmente.

## Alcance

**Niveles** (según `niveles-y-progresion`)

- 0.1 autorado, línea recta.
- 0.2 autorado, una ele.
- 0.3 **generado**, camino de 3 a 5 tramos rectos con giros de 90°.
- 0.4 autorado, cuadrado a mano. La fricción es intencional.
- 0.5 **generado**, zigzag de 4 a 8 tramos con giros de 45°.

**Generadores**

Los dos primeros del proyecto, así que esta spec fija el patrón que van a seguir todos los demás:

- Producen **AST**, no texto ni imágenes.
- Respetan longitudes en múltiplos de 20 y ángulos derivables.
- Verifican encuadre y descartan candidatos degenerados, reintentando con la semilla siguiente.
- Emiten la forma más compacta que permite la plantilla, porque de ahí sale el presupuesto.

**Progreso y desbloqueo**

- Estado por nivel: aprobado, estrellas ganadas, mejor conteo.
- Un nivel aprobado se puede repetir sin perder estrellas. En los generados, repetir trae un reto
  nuevo salvo que se pida la misma semilla.
- Reglas de desbloqueo de nivel y de mundo.
- Semilla visible y compartible en la interfaz.

**Insignia**

*Secuencia*, al completar el mundo con las tres estrellas en todos sus niveles.

**Primera experiencia**

Es la parte más delicada de esta spec. Quien abre el juego no sabe qué es Logo ni qué es un comando.
Kiro lo guía con globos de diálogo dentro del propio nivel 0.1, sin pantallas de tutorial aparte y sin
texto largo. Se aprende jugando.

**Pistas**

Los tres escalones para cada nivel. En los generados son plantillas que se rellenan con los parámetros
del reto: una pista que diga "cuenta los tramos" cuando hay cinco y no tres es peor que no tener pista.

## Fuera de alcance

- `REPITE` y el vocabulario de los mundos siguientes.
- Reproducción en paralelo, desafío infinito, mapa de insignias, modo libre.
- Insignias transversales.

## Criterios de aceptación

1. Los cinco niveles se juegan en orden, con desbloqueo progresivo.
2. Los niveles 0.3 y 0.5 dan un reto distinto cada vez, siempre resoluble y encuadrado.
3. La misma semilla reproduce el mismo reto después de recargar la página.
4. El progreso sobrevive al cierre del navegador.
5. La insignia *Secuencia* se otorga solo con las tres estrellas en los cinco niveles.
6. Alguien que nunca vio Logo entiende qué hacer en el nivel 0.1 sin ayuda externa.
7. Las pistas de los niveles generados mencionan los parámetros reales del reto en pantalla.
8. Cada generador se prueba sobre al menos 200 semillas: todas encuadradas, no degeneradas, y su
   referencia aprueba con las tres estrellas.

## Steering a consultar

`niveles-y-progresion` para los niveles, los rangos de los generadores y las reglas de desbloqueo.
`validacion-geometrica` para la normalización libre de traslación y rotación de este mundo.
`lenguaje-kirologo` para el vocabulario disponible.

## Decisiones a cerrar en la fase de requisitos

- La firma de un generador: qué recibe, qué devuelve, cómo reporta un descarte. Se va a reusar siete
  veces, conviene que quede bien.
- Los rangos de `niveles-y-progresion` son estimaciones sin verificar. Hay que mirar figuras reales en
  pantalla y ajustarlos; el criterio es que se vean como un dibujo con intención, no como un garabato.
- Si el nivel 0.4 (cuadrado a mano) debe negar explícitamente la estrella de economía o simplemente
  no ofrecerla. Es el único nivel donde la fuerza bruta es la respuesta correcta.
- Cómo se muestra el código de semilla sin que compita visualmente con el reto.
- Forma del estado persistido, pensando en que va a crecer siete mundos más y una migración temprana
  es más barata que una tardía.
