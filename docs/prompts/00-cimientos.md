# Prompt · Spec 00 · Cimientos

> Pegar el texto de abajo al iniciar la spec.

---

Quiero crear la spec **00-cimientos** de KiroLogo.

## Objetivo

Levantar el proyecto y construir una **rebanada vertical completa**: un solo nivel autorado, jugable
de punta a punta. Kiro montado en la tortuga dibuja la figura en vivo, el jugador escribe su programa,
lo ejecuta, y el juego lo valida y le da estrellas.

No es un andamiaje vacío. Al terminar esta spec quiero poder jugar ese nivel en el navegador.

## Alcance

**Proyecto**

- Vite + TypeScript en modo estricto, Vitest, sin framework de UI ni backend.
- La estructura de carpetas de `estructura.md`, creando solo los módulos que esta spec necesita.
- `package.json` con `name: "kirologo"` y `license: "MIT"`. El archivo `LICENSE` ya está en la raíz.
- Campo `engines` pidiendo Node ≥ 24, coherente con el `.nvmrc` que ya está en el repositorio.
- Toda dependencia que se agregue va con versión fija y con licencia compatible con MIT.

**Lenguaje** (solo el vocabulario del mundo 0: `AVANZA`, `RETROCEDE`, `GIRADERECHA`,
`GIRAIZQUIERDA`, `CENTRO`, `BORRAPANTALLA`, con sus abreviaturas)

- `vocabulario.ts` como única fuente de verdad, con el mundo de desbloqueo de cada comando.
- Lexer con normalización de acentos, mayúsculas y separador decimal.
- AST y parser. **El AST se diseña para lo que viene**: `REPITE`, `PARA…FIN`, variables,
  aritmética, condicionales y recursión. No se implementan aquí, pero el diseño no debe obligar a
  rehacerlos después. Documentar los puntos de extensión.
- Intérprete como generador que emite una operación por paso, con las tres guardas de ejecución.
- `conteo.ts`: conteo de instrucciones de un AST, único en todo el proyecto.
- `errores.ts` con el catálogo de mensajes en español, incluyendo la sugerencia por distancia de
  edición y el caso del comando escrito en inglés.

**Motor**

- Tortuga como modelo puro. Lienzo lógico de 800 × 800 con cuadrícula visible de 20 px.
- Personajes **dibujados por código** con trazos de Canvas 2D, sin imágenes ni activos externos: la
  tortuga apuntando al rumbo en cualquier ángulo, Kiro montado en el caparazón, la inclinación de Kiro
  hacia el próximo giro, y el lápiz arriba o abajo con Kiro levantándolo. Los estados que esta spec no
  usa todavía (desmontado, oculto, dos tortugas, celebración) no se implementan, pero la API de
  `personajes.ts` debe recibirlos como estado desde el diseño.
- Animador que consume operaciones y las reproduce en el tiempo, con control de velocidad.
- Extractor de segmentos, cálculo de caja envolvente y encuadre.
- Validador geométrico completo: rasterizado, dilatación de 8 px, IoU y penalización por exceso.

**Azar**

- PRNG determinista por semilla y la conversión semilla ↔ código corto compartible.

**Juego**

- Resolución de un reto a partir de `(idNivel, semilla)`.
- Cálculo de las tres estrellas, incluido el análisis de AST para abstracción.
- Persistencia mínima en `localStorage`.

**Interfaz**

- Editor con números de línea y contador de instrucciones en vivo.
- Demostración: Kiro dibuja el reto, con botón de repetir y control de velocidad.
- Comparación lado a lado y superposición con el diff visual de tres estados.
- Controles: ejecutar, paso a paso, velocidad, reiniciar.
- Globo de diálogo de Kiro.
- Panel de comandos con lo desbloqueado.

**Nivel de prueba**

Un solo nivel autorado, el 0.1 (`AV 100`) o equivalente, para demostrar el flujo completo.

## Fuera de alcance

- `REPITE` y todo el vocabulario de los mundos 1 en adelante.
- Generadores de retos. Aquí solo hay un nivel autorado.
- Reproducción en paralelo, insignias, mapa de progreso, desafío infinito, modo libre, modo bloques.
- El catálogo completo de niveles.

## Criterios de aceptación

1. `npm run dev` levanta el juego y el nivel de prueba se puede jugar de principio a fin.
2. Kiro dibuja la demostración en vivo, se puede repetir y cambiar la velocidad.
3. El programa del jugador se ejecuta animado y también paso a paso.
4. Un programa correcto otorga precisión; uno con una línea de más falla por exceso de trazo y el diff
   lo muestra.
5. Un comando mal escrito produce el mensaje descriptivo en español, con sugerencia.
6. Las tres guardas de ejecución (pasos, profundidad, tiempo) cortan con su mensaje en español. Como
   `REPITE` todavía no existe, se verifican con AST sintéticos en las pruebas, no desde el editor.
7. El mismo `(idNivel, semilla)` produce siempre el mismo reto.
8. `npm test` pasa, con cobertura de lexer, parser, intérprete, guardas, conteo y validador.
9. El nivel de prueba aprueba su propio nivel con las tres estrellas ejecutando su referencia.
10. La tortuga con Kiro montado se lee con claridad en cualquier rumbo, y el proyecto no contiene
    ningún archivo de imagen.

## Steering a consultar

`lenguaje-kirologo` para el vocabulario, la sintaxis, la normalización y los mensajes de error.
`validacion-geometrica` para el algoritmo, las tolerancias y las estrellas.
`niveles-y-progresion` para la forma de un nivel y la regla de los presupuestos calculados.

## Decisiones a cerrar en la fase de requisitos

- Cómo se representa una operación de la tortuga, con el detalle suficiente para que la reproducción
  en paralelo funcione después sin cambiar el tipo.
- Si el rasterizado se hace en un `OffscreenCanvas` o en un arreglo tipado propio. Importa porque la
  invariancia a rotación prueba 360 ángulos y las pruebas corren en Node sin DOM.
- Forma exacta del tipo `Nivel`, incluyendo cómo declara normalización y exigencias de abstracción, y
  cómo distingue autorado de generado. Se va a extender en las siete specs siguientes.
- Cuántas líneas admite el editor y si hay resaltado de sintaxis desde el inicio.
- El diseño de los personajes por código. Kiro es un fantasma y la tortuga tiene caparazón: hay que
  resolver cómo se ven juntos, cómo el conjunto comunica el rumbo sin ambigüedad y a qué tamaño se
  dibuja para que no tape la estela ni se pierda en un lienzo de 800 × 800. Conviene bocetarlo en
  código temprano, porque es lo primero que se ve del juego y condiciona la lectura de todo lo demás.
