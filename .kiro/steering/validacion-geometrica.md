---
inclusion: auto
name: validacion-geometrica
description: Algoritmo de validación de figuras en KiroLogo, tolerancias, normalización por mundo, semillas y cálculo de las tres estrellas. Consultar al trabajar en el validador, en el extractor de segmentos, en el diff visual, en la reproducción en paralelo o al ajustar la dificultad de un nivel.
---

# Validación geométrica

Se compara **geometría, no texto**. Cualquier programa que produzca la figura es válido. Nunca se
compara el código del jugador contra el programa de referencia.

## El objetivo viene del programa de referencia

No hay imágenes en el juego. Cada reto es un **programa de referencia** en KiroLogo: escrito a mano si
el nivel es autorado, producido por un generador si es generado.

El mismo intérprete lo ejecuta dos veces, con el mismo flujo de operaciones:

1. **Para la demostración** — Kiro y la tortuga lo dibujan en vivo frente al jugador.
2. **Para la validación** — se extraen sus segmentos y se comparan contra los del jugador.

Consecuencia: **lo que el jugador vio dibujar es exactamente lo que se valida.** No hay forma de que la
figura mostrada y la evaluada se desincronicen, porque son la misma ejecución del mismo programa.

## Semillas

Todo reto se identifica con `(idNivel, semilla)`. La semilla alimenta un generador de números
pseudoaleatorios determinista propio, nunca `Math.random`, para que el mismo par produzca siempre la
misma figura.

Sirve para:

- Volver a intentar **el mismo** reto tras cerrar el navegador.
- Pedir **otro** reto del mismo nivel.
- Compartir un reto con un código corto, para pedir ayuda o retar a alguien.
- Reproducir errores: un reporte con la semilla es reproducible al pixel.

Los niveles autorados usan semilla fija y su programa de referencia es constante.

## Algoritmo de comparación

1. **Extraer segmentos.** Se ejecuta el programa del jugador y se recogen solo los movimientos con
   lápiz abajo, como lista de segmentos `{ desde, hasta }`. Lo mismo se hizo antes con la referencia.
2. **Normalizar** según la configuración del nivel (ver abajo).
3. **Rasterizar** ambos conjuntos en una rejilla del lienzo lógico de 800 × 800.
4. **Dilatar** ambas máscaras 8 píxeles, como tolerancia de trazo.
5. **Comparar** con IoU (intersección sobre unión) de las máscaras dilatadas.
6. **Penalizar lo que sobra**: los píxeles dibujados fuera de la máscara objetivo dilatada se cuentan
   aparte. Si superan el 5 % del total del objetivo, el nivel no se aprueba aunque el IoU alcance.

Umbrales:

- IoU ≥ **0.90** para la estrella de precisión.
- Exceso de trazo ≤ **5 %** del objetivo.

Los dos criterios son necesarios. Sin el segundo, "dibujé el cuadrado pero me quedó una línea de más"
pasaría por accidente, y ese es justamente un error que el jugador debe ver.

## La cuadrícula es parte del contrato

El lienzo muestra una cuadrícula de **20 px**, y los generadores solo emiten longitudes múltiplos de
20. Es lo que hace justo exigir la escala exacta: el jugador puede contar los cuadros del recorrido de
Kiro en lugar de adivinar.

Si un generador emite longitudes que no caen en la cuadrícula, el nivel es injusto por construcción.
Es un error de datos, no un ajuste de dificultad. La excepción son las aproximaciones de curva y los
incrementos de espiral, donde lo que se deduce es el patrón y no la medida; está documentada en
`niveles-y-progresion`.

## Normalización por mundo

| Mundos | Traslación | Rotación | Escala |
|---|---|---|---|
| 0 – 2 | libre | libre | debe coincidir |
| 3 en adelante | fija | fija | debe coincidir |
| bonus | fija | fija | debe coincidir |

Razón: en los primeros mundos la frustración debe venir de la lógica, no de la orientación. Si el
jugador dibujó un pentágono perfecto pero apuntando a otro lado, aprendió lo que había que aprender.

Desde el mundo 3 la composición espacial ya es parte del reto: la posición y el rumbo de partida
importan. Como la demostración muestra dónde empieza y hacia dónde mira la tortuga, la exigencia es
razonable; antes, con una imagen estática, no lo habría sido.

**La escala nunca es libre.** Los números son parte del aprendizaje; `AV 100` y `AV 50` no pueden ser
lo mismo. La tolerancia de escala está solo en la dilatación de 8 píxeles.

Implementación de la invariancia: se prueba la coincidencia contra el objetivo rotado en pasos de 1° y
se toma el mejor IoU, con las dos figuras centradas por su caja envolvente. Es fuerza bruta, pero
sobre máscaras de 800 × 800 rasterizadas una sola vez es aceptable, y es mucho más simple de depurar
que un emparejamiento de segmentos.

## Las tres estrellas

**Precisión** — IoU ≥ 0.90 y exceso ≤ 5 %.

**Economía** — el conteo de instrucciones del jugador es ≤ `presupuestoEstrella`, que es el conteo
exacto del programa de referencia. La regla de conteo está en `lenguaje-kirologo` y vive en un solo
módulo, para que el número que ve el jugador mientras escribe sea exactamente el que se evalúa.

**Abstracción** — se analiza el AST, no el texto. Cada nivel declara qué exige:

- `usaRepite` — hay al menos un nodo `REPITE`
- `usaRepiteAnidado` — hay un `REPITE` dentro de otro
- `defineProcedimiento` — hay al menos un `PARA`
- `usaParametros` — un procedimiento declara y usa parámetros
- `maximoProcedimientos: 1` — no se permite resolverlo duplicando procedimientos
- `usaRecursion` — un procedimiento se invoca a sí mismo

Cuando la estrella de abstracción no se otorga, Kiro dice **por qué** en una frase concreta: *"Lo
lograste, pero dibujaste los cuatro cuadrados uno por uno. Intenta enseñarme qué es un cuadrado con
PARA, y luego pídemelo cuatro veces."* Un nivel resuelto sin esa estrella es una oportunidad de
enseñanza, no un castigo.

## Diff visual al fallar

Sobre el lienzo, usando las dos máscaras:

- **Verde, línea continua** — coincide con la figura de Kiro.
- **Rojo, línea gruesa** — se dibujó y no debía.
- **Gris, línea punteada** — faltó dibujar.

Nunca solo color: el estilo de línea comunica lo mismo para quien no distingue los tonos.

## Diff temporal: la reproducción en paralelo

La comparación más útil no es espacial sino temporal, y solo es posible porque el objetivo es un
programa.

Se reproducen las dos ejecuciones al mismo tiempo, con dos tortugas avanzando en paralelo sobre la
misma cuadrícula. Se recorren las dos listas de operaciones en orden y se marca **el primer paso donde
divergen**, comparando posición final y rumbo con la misma tolerancia de 8 píxeles y 1 grado.

Kiro señala ese paso con la diferencia concreta: *"hasta aquí íbamos igual; en este giro yo doblé 72
grados y tú 90."*

Detalles que importan:

- La divergencia se busca sobre **operaciones de la tortuga**, no sobre líneas de código: los dos
  programas pueden estar escritos de forma completamente distinta y aun así compararse paso a paso.
- Si un programa tiene más pasos que el otro, se reporta el punto donde el corto se acabó.
- Si nunca divergen y el jugador aun así falló la precisión, el problema está en el exceso de trazo al
  final del recorrido. El mensaje lo dice así.

## Presupuesto excedido

Desde el mundo 3 el `limiteDuro` está activo. Si el programa lo excede, **no se ejecuta**: Kiro lo
detiene antes y explica. Ejecutarlo y luego negar la estrella dejaría al jugador con un dibujo correcto
en pantalla y un mensaje que se siente arbitrario.

En los mundos 0 a 2 no hay límite duro: el programa corre y la estrella de economía simplemente no se
otorga.

## Pruebas del validador

- La referencia de cada nivel autorado aprueba su propio nivel con las tres estrellas.
- Cada generador se verifica sobre **al menos 200 semillas**: todas producen un reto encuadrado, no
  degenerado, y su propia referencia lo aprueba con las tres estrellas.
- Variantes equivalentes conocidas (el mismo dibujo escrito de otra forma) también aprueban precisión.
- Casos negativos: una línea de más falla por exceso; una figura correcta a otra escala falla.
