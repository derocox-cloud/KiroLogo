# Tecnología y arquitectura

## Stack

- **TypeScript** en modo estricto.
- **Vite** como bundler y servidor de desarrollo.
- **Canvas 2D** para el lienzo, la tortuga y Kiro. Sin motor de juego.
- **Vitest** para pruebas.
- Sin framework de UI. La interfaz es DOM directo con módulos pequeños.
- Sin backend. El progreso se guarda en `localStorage`.

Razón: el juego es un intérprete más un lienzo. Un motor de juego o un framework de UI agregarían
peso y capas sin resolver el problema real, que es el pipeline léxico → sintáctico → ejecución.

## Arquitectura del intérprete

Cadena estricta, cada etapa con su módulo y sus pruebas:

```
texto → lexer → tokens → parser → AST → intérprete → operaciones
```

Reglas duras:

- **Nunca `eval` ni `new Function`.** El intérprete se escribe a mano.
- **El intérprete es un generador** (`function*`) que emite una operación por paso:
  `{ tipo: 'mover', desde, hasta, lapizAbajo, linea }`. Ese único flujo alimenta a todos los
  consumidores: la demostración de Kiro, la animación del programa del jugador, el modo paso a paso,
  el extractor de segmentos para validar y la reproducción en paralelo. No se duplica la lógica de
  ejecución en ninguna parte.
- **El programa de referencia de un nivel se ejecuta con el mismo intérprete que el del jugador.** Lo
  que el jugador vio dibujar es exactamente lo que se valida. No hay un camino especial para el
  objetivo.
- **Todo el azar pasa por un PRNG propio con semilla explícita.** Nunca `Math.random`: sin
  determinismo, un reto no se puede repetir, compartir ni reportar.
- **El modelo de la tortuga es puro**: posición, rumbo, lápiz. No conoce el Canvas. El renderizador
  consume operaciones, no llama a la tortuga.

## Guardas de ejecución

El jugador va a escribir `REPITE 99999` y recursiones sin caso base. No debe poder colgar la pestaña.

- Máximo 200 000 pasos de tortuga por ejecución.
- Máximo 100 niveles de profundidad de recursión.
- Máximo 5 segundos de tiempo de ejecución.
- Al superar cualquiera de los tres, se detiene con un error explicativo en español, no con un cuelgue
  ni un error genérico: `Detuve la ejecución: la tortuga llevaba demasiados pasos. ¿Hay una repetición
  que nunca termina?`

## Accesibilidad

Requisito de producto, no un extra:

- Navegable completamente por teclado. El editor y el panel de comandos nunca capturan el foco de
  forma que impida salir con `Tab`.
- El estado de la tortuga (posición, rumbo, lápiz) se anuncia en una región `aria-live` para lectores
  de pantalla.
- La retroalimentación nunca depende solo del color: el diff visual usa además línea continua,
  punteada y grosor.
- Contraste mínimo AA en texto e interfaz.
- Respeta `prefers-reduced-motion`: si está activo, la estela se dibuja sin animación de recorrido.
- Modo de bloques arrastrables que genera el texto KiroLogo equivalente, para quien todavía no
  escribe con fluidez.

Nota: la validación completa de accesibilidad requiere pruebas manuales con tecnologías asistivas y
revisión por una persona experta. Estas reglas son el piso, no la certificación.

## Convenciones de código

- **El dominio se nombra en español**: `Tortuga`, `Comando`, `Nivel`, `Insignia`, `Estela`,
  `Vocabulario`, `rumbo`, `lapizAbajo`. El juego es en español y el código debe leerse igual que la
  conversación del equipo.
- Los términos técnicos estándar del ecosistema se mantienen como son: `index.ts`, `tsconfig`,
  `AST`, `token`, `lexer`, `parser`.
- Archivos en `kebab-case`, en español: `panel-comandos.ts`, `globo-kiro.ts`.
- Tipos e interfaces en `PascalCase`, funciones y variables en `camelCase`.
- Sin comentarios que repitan el código. Comentar el *por qué*, sobre todo en la geometría y en las
  tolerancias de validación.
- Los mensajes de error visibles al jugador viven centralizados en `src/lenguaje/errores.ts`. No se
  escriben literales sueltos en el intérprete.

## Datos, no código

Los niveles son datos. Agregar un nivel debe ser agregar un objeto a un arreglo, nunca escribir
lógica nueva. Si un nivel necesita código especial, es señal de que falta una capacidad en el motor.

## Pruebas

Prioridad, en orden:

1. **Lexer y parser** — casos válidos, errores de sintaxis y los mensajes exactos en español.
2. **Intérprete** — que cada comando produzca las operaciones correctas, y que las guardas corten.
3. **Validador geométrico** — que el programa de referencia de cada nivel valide contra sí mismo, y
   que variantes conocidas (mismo dibujo escrito de otra forma) también pasen.
4. **Generadores de retos** — que produzcan figuras encuadradas, no degeneradas y resolubles con el
   vocabulario disponible.
5. **Contador de instrucciones** — que el presupuesto se calcule igual siempre.
6. **Determinismo** — que la misma semilla produzca siempre el mismo reto.

Prueba de regresión obligatoria: **todo reto del catálogo debe aprobar su propio nivel con las tres
estrellas**, ejecutando su programa de referencia. En los niveles generados, sobre al menos 200
semillas. Esa sola prueba atrapa la mayoría de los errores de datos y de generadores.
