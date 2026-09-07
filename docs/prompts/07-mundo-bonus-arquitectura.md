# Prompt · Spec 07 · Mundo bonus · Arquitectura

> Pegar el texto de abajo al iniciar la spec.

---

Quiero crear la spec **07-mundo-bonus-arquitectura** de KiroLogo. Las specs 00 a 06 están terminadas: el
recorrido principal completo, del `AVANZA 100` a los fractales.

## Objetivo

El último contenido desbloqueable y el cierre del juego. Cinco niveles donde las figuras son iconos de
arquitectura de AWS reducidos a su geometría, más el mapa de insignias completo y el pulido final.

Es el nivel de cierre pensado para la comunidad de AWS en español en LATAM: conecta "aprendí a componer
figuras" con "así se dibuja un diagrama de arquitectura", que es lo que esa comunidad hace todos los
días.

## Alcance

**Nada de lenguaje**

Estos niveles se construyen solo con el vocabulario de los mundos 0 a 5. Si alguno necesita un comando
nuevo, hay que rediseñar el nivel, no el lenguaje.

**Desbloqueo**

Aprobar con estrella de precisión **todos** los niveles de los mundos 0 al 5. No se exigen las tres
estrellas de cada nivel: ese es el requisito de las insignias de concepto, no del mundo bonus. Exigir
perfección en 29 niveles dejaría este contenido fuera del alcance de casi todos.

La entrada merece una celebración: es lo último que el juego tiene para dar.

**Niveles**

- B.1 generado, hexágono de servicio con marco.
- B.2 autorado, cubo isométrico con ángulos de 30° y 150° y aristas paralelas.
- B.3 generado, marco de VPC con 2 o 3 subredes: rectángulos anidados, `SL`/`BL`, `PONCOLOR`.
- B.4 generado, diagrama de tres capas conectado, con procedimiento parametrizado para la caja y líneas
  conectoras.
- B.5 autorado, región con dos zonas de disponibilidad, composición completa con `RELLENA`.

Son figuras geométricas, no reproducciones de los iconos oficiales de AWS. La referencia es conceptual.
No usar los activos de marca de AWS ni imitarlos de cerca.

**Insignia**

*Arquitecto*, al completar el mundo con las tres estrellas.

**Mapa de insignias**

La vista de progreso completa, que hasta ahora estuvo en su forma simple:

- Las siete insignias de concepto y las cuatro transversales.
- Se lee como un mapa de habilidades, no como una barra de progreso.
- Muestra qué concepto está dominado y qué falta para el que sigue.

**Modo libre y galería**

Pulido de lo que existe desde el principio:

- Sandbox con todo el vocabulario desbloqueado.
- Guardar creaciones, verlas, recuperarlas y compartirlas por código.
- La insignia *Explorador*: guardar 5 creaciones propias.

**Cierre del juego**

Revisión de punta a punta con el recorrido completo disponible:

- Consistencia de los mensajes de Kiro en los 34 niveles.
- Pasada de accesibilidad: recorrido completo por teclado, anuncios de estado, contraste,
  `prefers-reduced-motion`, y el modo de bloques arrastrables si sigue en pie.
- Rendimiento con las figuras más densas del juego.

## Fuera de alcance

- Comandos nuevos.
- Multijugador, tablas de clasificación, cuentas en servidor.

## Criterios de aceptación

1. El mundo bonus está bloqueado hasta aprobar los 29 niveles de los mundos 0 a 5, y el desbloqueo se
   celebra.
2. Los cinco niveles se resuelven con el vocabulario existente, sin agregar nada al lenguaje.
3. El cubo isométrico valida de forma estable: los ángulos de 30° y 150° con la tolerancia de 8 px no
   producen falsos negativos.
4. El nivel B.3 usa color, y quedó claro y probado si el color cuenta para la precisión.
5. El nivel B.5 usa `RELLENA`, y su comportamiento en la validación es el que se decidió en la spec 03.
6. El mapa de insignias muestra las once insignias con su estado real y se entiende sin explicación.
7. El modo libre guarda, recupera y comparte creaciones por código.
8. Recorrido completo por teclado en todas las pantallas, con el estado de la tortuga anunciado.
9. Los 34 niveles del catálogo aprueban su propio nivel con las tres estrellas ejecutando su referencia,
   y los generados sobre al menos 200 semillas.

## Steering a consultar

`niveles-y-progresion` para los niveles y el desbloqueo.
`producto` para el catálogo completo de insignias.
`validacion-geometrica` para el color, el relleno y las tolerancias.
`tecnologia` para los requisitos de accesibilidad.

## Decisiones a cerrar en la fase de requisitos

- **El cubo isométrico y la tolerancia.** Ángulos de 30° con aristas paralelas y una tolerancia de 8 px
  pueden hacer que dos aristas cercanas se confundan en el rasterizado. Verificarlo antes de dar el nivel
  por bueno; puede necesitar una tolerancia propia.
- Si el color cuenta para la precisión en B.3. La decisión venía pendiente de la spec 03 y aquí ya no se
  puede postergar.
- Cómo se resuelven las líneas conectoras del B.4 con el vocabulario disponible, y si el nivel sigue
  siendo razonable en cantidad de instrucciones.
- Qué figuras concretas representan la VPC, las subredes y las zonas de disponibilidad. Tienen que ser
  reconocibles para quien trabaja con AWS y dibujables con `REPITE` y procedimientos. Vale la pena
  bocetarlas antes de escribir el generador.
- Si el modo de bloques arrastrables entra aquí, se convierte en una spec aparte, o se retira del alcance
  del producto. Es la pieza más grande que quedó declarada en el steering y nunca planificada.
