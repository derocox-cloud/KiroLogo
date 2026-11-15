# Plan de specs de KiroLogo

El proyecto se aborda en **ocho specs**: una de cimientos y una por mundo, más dos specs
transversales (08 y 09) que cambian la presentación y no son un mundo. Cada archivo de
`docs/prompts/` es el texto listo para pegar al iniciar la spec correspondiente.

Para entender **por qué** el proyecto es como es, y qué se descartó en el camino, está la
[bitácora](bitacora.md). El steering dice qué hacer; la bitácora dice de dónde salió cada regla.

Para saber qué guarda `Progreso` en las señales de las insignias transversales (*Sin pistas*,
*Buen ojo* y *Depurador*), quién las escribe y quién las lee, está el documento de
[señales de progreso](senales-de-progreso.md).

## Cómo usar estos prompts

1. Abrir una sesión de tipo **Spec**.
2. Pegar el contenido completo del archivo del prompt.
3. Recorrer requisitos → diseño → tareas como de costumbre.

Los prompts no repiten lo que ya está en `.kiro/steering/`. Los tres archivos siempre activos
(`producto`, `tecnologia`, `estructura`) entran solos; los de consulta (`lenguaje-kirologo`,
`niveles-y-progresion`, `validacion-geometrica`) se activan cuando la tarea los necesita, y cada
prompt dice cuáles hacen falta.

## Orden y dependencias

Es una cadena: cada spec asume terminada la anterior. No hay forma de paralelizar los mundos, porque
cada uno agrega vocabulario al lenguaje y niveles al catálogo.

| # | Spec | Qué entrega | Depende de |
|---|---|---|---|
| 00 | [Cimientos](prompts/00-cimientos.md) | proyecto, lenguaje base, motor, validador, un nivel jugable de punta a punta | — |
| 01 | [Mundo 0 · Primeros pasos](prompts/01-mundo-0-primeros-pasos.md) | 5 niveles, primeros generadores, progreso, insignia *Secuencia* | 00 |
| 02 | [Mundo 1 · Figuras](prompts/02-mundo-1-figuras.md) | `REPITE`, reproducción en paralelo, insignia *Iteración* | 01 |
| 03 | [Mundo 2 · Composición](prompts/03-mundo-2-composicion.md) | `PARA…FIN`, lápiz y color, insignia *Descomposición* | 02 |
| 04 | [Mundo 3 · Rosetones](prompts/04-mundo-3-rosetones.md) | `limiteDuro`, desafío infinito, insignia *Simetría* | 03 |
| 05 | [Mundo 4 · Parámetros](prompts/05-mundo-4-parametros.md) | variables y aritmética, insignia *Generalización* | 04 |
| 06 | [Mundo 5 · Fractales](prompts/06-mundo-5-fractales.md) | condicionales y recursión, insignia *Recursión* | 05 |
| 07 | [Mundo bonus · Arquitectura](prompts/07-mundo-bonus-arquitectura.md) | 5 niveles de diagramas, mapa de insignias, insignia *Arquitecto* | 06 |

## Specs transversales

Dos specs que no agregan mundo ni vocabulario: ordenan la presentación de lo que ya existe. Necesitan
el juego jugable, así que van después de la 01, y no bloquean ni dependen de los mundos 02 a 07. Se
hacen en este orden, porque la 09 parte de la pantalla que documenta la 08.

| # | Spec | Qué entrega | Depende de |
|---|---|---|---|
| 08 | [Diseño visual](prompts/08-diseno-visual.md) | el diseño visual como requisitos verificables; concilia con las specs 00 y 01 los puntos en que se aparta | 01 |
| 09 | [Ajustes de interfaz](prompts/09-ajustes-de-interfaz.md) | atajos sin números, colores planos, menú de mundos desplegable | 08 |

No son rebanadas verticales: la regla de abajo no les aplica, pero la definición de terminado sí.

## La regla que se repite en todas

Cada spec es una **rebanada vertical**: agrega su vocabulario al lenguaje, sus generadores, sus
niveles, su insignia y las piezas de interfaz que ese concepto necesita. Al terminar, el juego está
jugable hasta ese mundo, con pruebas verdes.

Ninguna spec toca el vocabulario de un mundo posterior. Si aparece la tentación de "ya que estoy,
agrego `SI`", es señal de que el alcance se está saliendo de cauce.

## Definición de terminado, común a todas

- `npm run build` y `npm test` pasan.
- Todo reto del mundo aprueba su propio nivel con las tres estrellas ejecutando su programa de
  referencia. En niveles generados, sobre al menos 200 semillas.
- Los mensajes de error nuevos están en `src/lenguaje/errores.ts`, en español y con la forma
  descriptiva del catálogo.
- Los comandos nuevos están declarados en `src/lenguaje/vocabulario.ts` con su mundo de desbloqueo.
- Toda dependencia nueva va con versión fija y con licencia compatible con MIT.
- Ningún presupuesto escrito a mano en `src/niveles/`.
- Ningún uso de `Math.random`.
- Navegable por teclado y con el estado de la tortuga anunciado para lectores de pantalla.
