---
inclusion: auto
name: niveles-y-progresion
description: Catálogo de mundos y niveles de KiroLogo, generadores de retos, presupuestos de instrucciones, reglas de desbloqueo y el mundo bonus de arquitectura AWS. Consultar al crear o ajustar niveles, al escribir generadores, al definir la progresión o al trabajar en el catálogo.
---

# Mundos, niveles y progresión

Siete mundos. El vocabulario se desbloquea de forma progresiva: el jugador nunca ve los 25 comandos
de golpe. El panel lateral muestra solo lo disponible, con descripción y ejemplo.

## Los dos tipos de nivel

**Autorado.** El reto es un programa fijo, escrito a mano. Se usa en la **primera aparición de cada
concepto**, donde el orden de la lección importa y el azar la arruinaría. Siempre es el mismo para
todos los jugadores.

**Generado.** El reto lo produce un generador paramétrico con una semilla. Se usa en los niveles de
práctica que siguen a cada concepto. Da rejugabilidad infinita y hace imposible memorizar.

En los dos casos el flujo es idéntico: existe un **programa de referencia**, Kiro lo ejecuta en vivo
frente al jugador, y de esa misma ejecución sale la figura que se valida. La diferencia es solo de
dónde vino el programa.

## Cómo se escribe un generador

**El generador produce un programa, no una imagen.** Esa es la regla que hace todo lo demás fácil: si
el reto nace como código KiroLogo válido, es resoluble por construcción, el presupuesto se calcula
solo, y la figura no puede ser imposible.

Restricciones obligatorias para que el reto sea justo:

- **Longitudes en múltiplos de 20**, entre 40 y 200. La cuadrícula del lienzo es de 20 px, así que el
  jugador puede contar los tramos. Nunca `AVANZA 87`.
- **Ángulos derivables**: `360/n` con n entre 3 y 12, o múltiplos de 15. Nada de 37 grados.
- **Solo el vocabulario desbloqueado** hasta ese mundo.
- **La figura cabe en el lienzo** y su caja envolvente ocupa al menos 200 px de lado. Si el candidato
  no cumple, el generador descarta y vuelve a intentar con la semilla siguiente.
- **Nada degenerado**: ni figuras que se reducen a una línea, ni tramos que se pisan por completo.
- El programa emitido es la **forma más compacta** que permite la plantilla. De ahí sale el
  presupuesto, así que un generador descuidado regala la estrella de economía.

Única excepción a la regla de los múltiplos de 20: las **aproximaciones de curva** (círculos con
`AV 2 GD 1`) y los **incrementos de espiral**. Ahí el número pequeño es la lección, no una medida que
el jugador deba leer de la cuadrícula, y lo que se deduce es el patrón, no la longitud. La regla
aplica a los tramos rectos que forman la figura.

## Los presupuestos se calculan, no se escriben

Dos números, ambos derivados del programa de referencia con la regla de conteo de `lenguaje-kirologo`:

- **`presupuestoEstrella`** = conteo exacto del programa de referencia. Es lo que hay que igualar o
  bajar para ganar la estrella de economía.
- **`limiteDuro`** = `presupuestoEstrella` + margen (3 por defecto). Desde el mundo 3, un programa que
  lo excede no se ejecuta.

El margen existe para que un programa equivalente pero un poco más largo pueda correr y verse en
pantalla. Bloquear la ejecución en el número exacto castigaría al jugador que ya entendió la idea y
solo escribió un rodeo. La estrella sigue exigiendo el conteo de la referencia.

Ningún presupuesto se escribe a mano en los datos del nivel. Si aparece un número fijo en `niveles/`,
es un error.

## Mundo 0 · Primeros pasos — insignia *Secuencia*

Concepto: una instrucción tras otra cambia un estado. La tortuga tiene posición y rumbo.

| Nivel | Tipo | Reto | Referencia / rangos |
|---|---|---|---|
| 0.1 | autorado | Una línea recta | `AV 100` |
| 0.2 | autorado | Una ele | `AV 100 GD 90 AV 100` |
| 0.3 | generado | Un camino de tramos rectos | 3 a 5 tramos, largo 40–120, giros de 90° a un lado u otro |
| 0.4 | autorado | Un cuadrado a mano | `AV 100 GD 90` ×4 |
| 0.5 | generado | Un zigzag | 4 a 8 tramos, largo 40–80, giros de 45° alternados |

El 0.4 se resuelve a mano a propósito: es tedioso, y esa fricción es la que hace que `REPITE` se
sienta como un descubrimiento en el mundo 1.

## Mundo 1 · Figuras geométricas — insignia *Iteración*

Concepto: iteración, y la regla del ángulo exterior. La tortuga siempre da una vuelta completa:
360 grados repartidos entre los lados.

| Nivel | Tipo | Reto | Referencia / rangos |
|---|---|---|---|
| 1.1 | autorado | Cuadrado con `REPITE` | `REPITE 4 [AV 100 GD 90]` |
| 1.2 | generado | Polígono regular | lados 3–8, largo 60–140, `REPITE n [AV L GD 360/n]` |
| 1.3 | generado | Polígono girando a la izquierda | igual pero con `GI`, para romper el automatismo del `GD` |
| 1.4 | autorado | Círculo | `REPITE 360 [AV 2 GD 1]` |
| 1.5 | generado | Arco: un polígono a medias | `REPITE k [AV L GD 360/n]` con k < n |

El 1.5 es el más valioso del mundo: el jugador descubre que la figura no cierra si las repeticiones no
alcanzan, y que iterar y cerrar son dos cosas distintas.

Con `presupuestoEstrella` de 3, dibujar estos polígonos a mano queda descartado.

## Mundo 2 · Composición — insignia *Descomposición*

Concepto: una figura compleja es la suma de figuras simples. Nombrar un dibujo permite reusarlo. Es
el camino `CUADRADO` → `FLOR` → `JARDÍN` del artículo del MIT.

| Nivel | Tipo | Reto | Referencia / rangos |
|---|---|---|---|
| 2.1 | autorado | Casa | `REPITE 4 [AV 100 GD 90]` `AV 100` `GD 30` `REPITE 3 [AV 100 GD 120]` |
| 2.2 | generado | Estrella | puntas 5, 7 o 9, largo 100–180, `REPITE p [AV L GD 360*2/p]` |
| 2.3 | generado | Escalera | 3 a 6 peldaños, huella y altura iguales, 20–60 |
| 2.4 | autorado | Cruz | `REPITE 4 [AV 50 GI 90 AV 50 GD 90 AV 50 GI 90]` |
| 2.5 | generado | Dos figuras separadas | dos polígonos 3–6 lados, separación múltiplo de 20; exige `SL`/`BL` |
| 2.6 | generado | Cuadrícula de paneles | 2×2 o 3×2 o 3×3; exige `defineProcedimiento` |

El 2.5 obliga a `SUBELAPIZ` / `BAJALAPIZ`. El 2.6 exige la estrella de abstracción: solo se otorga si
el programa define un procedimiento con `PARA`, y el `presupuestoEstrella` está calculado sobre una
referencia que lo usa, así que copiar el panel seis veces no alcanza.

## Mundo 3 · Rosetones — insignia *Simetría*

Concepto: iteración anidada y simetría rotacional. No hay comandos nuevos, y eso es el mensaje: la
potencia viene de combinar, no de acumular vocabulario.

| Nivel | Tipo | Reto | Referencia / rangos |
|---|---|---|---|
| 3.1 | autorado | Rosetón de 36 cuadrados | `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]` |
| 3.2 | generado | Rosetón de polígonos | copias ∈ {6, 8, 9, 12, 18, 36}, figura interna de 3–6 lados |
| 3.3 | generado | Flor con giro previo | `REPITE c [REPITE n [GD a AV L] GD 360/c]` |
| 3.4 | autorado | Mandala de círculos | `REPITE 8 [GD 45 REPITE 6 [REPITE 90 [AV 2 GD 2] GD 90]]` |

Desde este mundo el `limiteDuro` está activo: si el programa lo excede, no se ejecuta y Kiro lo
explica. Es la única forma de que el jugador no pueda evitar la anidación.

## Mundo 4 · Parámetros — insignia *Generalización*

Concepto: un procedimiento con parámetros resuelve una familia de problemas, no uno solo.

| Nivel | Tipo | Reto | Referencia / rangos |
|---|---|---|---|
| 4.1 | autorado | Hexágono con `POLIGONO` | `PARA POLIGONO :lados :largo` `REPITE :lados [AV :largo GD 360 / :lados]` `FIN` `POLIGONO 6 80` |
| 4.2 | generado | Tres polígonos distintos | tres cantidades de lados distintas, 3–8; exige `maximoProcedimientos: 1` |
| 4.3 | generado | Polígonos concéntricos | 3 a 5 copias, lado creciente en pasos de 20 |
| 4.4 | generado | Estrella de n puntas parametrizada | puntas 5–11 impares; exige `usaParametros` |

En 4.2 la estrella de abstracción exige **un solo** procedimiento definido. Tres procedimientos
distintos que dibujen lo mismo resuelven el nivel pero no ganan la estrella, y Kiro dice por qué.

## Mundo 5 · Fractales — insignia *Recursión*

Concepto: caso base, autosimilitud, un procedimiento que se llama a sí mismo.

| Nivel | Tipo | Reto | Referencia / rangos |
|---|---|---|---|
| 5.1 | autorado | Espiral cuadrada | `PARA ESPIRAL :largo` `SI :largo > 200 [ALTO]` `AV :largo GD 90` `ESPIRAL :largo + 5` `FIN` |
| 5.2 | generado | Espiral de n lados | ángulo `360/n` con n 3–6, incremento 5–20 |
| 5.3 | autorado | Copo de Koch, un lado | `PARA KOCH :largo :nivel` con cuatro llamadas recursivas |
| 5.4 | autorado | Copo de Koch completo | `REPITE 3 [KOCH 300 3 GD 120]` |
| 5.5 | generado | Árbol binario | ángulo de rama 20–40 en pasos de 5, factor 0.6–0.8, profundidad 4–6 |

Los niveles de Koch son autorados: la estructura de las cuatro llamadas recursivas es la lección, y
generarla al azar solo agregaría ruido.

## Mundo bonus · Arquitectura — insignia *Arquitecto*

El último contenido desbloqueable, para quien llegó hasta el final. Las figuras son los iconos de
arquitectura de AWS reducidos a su geometría: la conexión explícita entre "aprendí a componer figuras"
y "así se dibuja un diagrama de arquitectura", que es lo que esta comunidad hace todos los días.

**Desbloqueo:** aprobar con estrella de precisión **todos** los niveles de los mundos 0 al 5. No se
exigen las tres estrellas de cada nivel para entrar; ese es el requisito de las insignias de concepto,
no del mundo bonus.

| Nivel | Tipo | Reto | Qué integra |
|---|---|---|---|
| B.1 | generado | Hexágono de servicio con marco | polígono + reposicionamiento; tamaños variables |
| B.2 | autorado | Cubo isométrico | ángulos de 30° y 150°, aristas paralelas |
| B.3 | generado | Marco de VPC con subredes | 2 o 3 subredes; rectángulos anidados, `SL`/`BL`, `PONCOLOR` |
| B.4 | generado | Diagrama de tres capas conectado | 2 o 3 cajas por capa; procedimiento parametrizado + conectores |
| B.5 | autorado | Región con dos zonas de disponibilidad | composición completa, `RELLENA` |

Son figuras geométricas, no reproducciones de los iconos oficiales de AWS. La referencia es conceptual
y las formas se construyen solo con el vocabulario del juego.

## Reglas de desbloqueo

- El mundo *n* se abre al aprobar (estrella de precisión) todos los niveles del mundo *n-1*.
- Los comandos nuevos se desbloquean al entrar al mundo, no al terminarlo.
- El **modo libre** está disponible desde el primer minuto, con todo el vocabulario ya desbloqueado.
  Explorar nunca se castiga.
- Un nivel aprobado se puede repetir para mejorar estrellas sin perder las ya ganadas. En un nivel
  generado, repetir trae un reto nuevo salvo que se pida la misma semilla.
- **Desafío infinito** por mundo: se abre al terminar el mundo y encadena retos generados de todos sus
  niveles, sin fin. Es el lugar natural para las insignias transversales.

## Al agregar un nivel

1. Decidir si es **autorado o generado**. Regla: primera aparición de un concepto → autorado; práctica
   del concepto → generado.
2. Escribir el programa de referencia, o el generador que lo produce, respetando las restricciones de
   longitudes, ángulos y encuadre.
3. Verificar que la referencia valida contra su propio nivel con las tres estrellas. En un generador,
   verificarlo sobre al menos 200 semillas.
4. Declarar qué exige la estrella de abstracción (`usaRepite`, `usaRepiteAnidado`,
   `defineProcedimiento`, `usaParametros`, `maximoProcedimientos`, `usaRecursion`).
5. Escribir las tres pistas: conceptual, matemática y esqueleto. En un nivel generado las pistas son
   plantillas que se rellenan con los parámetros del reto, nunca texto fijo que mienta.
6. Declarar la normalización geométrica según `validacion-geometrica`.

Los presupuestos no se escriben: se calculan. Ver la sección de arriba.
