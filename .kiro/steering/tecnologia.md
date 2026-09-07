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

## Los personajes se dibujan por código

La tortuga y el fantasma de Kiro se construyen con trazos de Canvas 2D en `motor/personajes.ts`. **No
hay imágenes, ni sprites, ni SVG externos.** El proyecto no tiene carpeta de activos gráficos.

Razón: los personajes no son decoración estática, son la interfaz que comunica el estado de la
ejecución. Cada estado tendría que ser un archivo aparte, y las combinaciones se multiplican.

`personajes.ts` recibe estado y devuelve dibujo. Los estados que tiene que representar:

- **Rumbo de la tortuga**, en cualquier ángulo. Se debe leer de un vistazo hacia dónde mira.
- **Kiro montado** sobre el caparazón, y **Kiro desmontado** flotando al lado en el modo paso a paso.
- **Inclinación de Kiro** hacia el próximo giro, como anticipación visual.
- **Lápiz arriba o abajo**, con la animación de Kiro levantándolo. El cambio de estado nunca es
  invisible.
- **Ocultos**, para `OCULTATORTUGA` y `MUESTRATORTUGA`.
- **Dos tortugas a la vez** en la reproducción en paralelo, distinguibles sin depender del color.
- **Celebración**, al ganar estrellas.

Consecuencias que conviene aprovechar:

- Escala sin pérdida a cualquier tamaño de lienzo.
- Nada que precargar, así que no hay pantalla de carga ni estados intermedios sin personaje.
- El color y el grosor salen del tema de la interfaz, así que un modo de alto contraste no necesita
  arte nuevo.
- Todo el repositorio queda redistribuible bajo MIT sin depender de la licencia de un activo gráfico.

En la reproducción en paralelo, **Kiro monta su propia tortuga** y la del jugador va sin jinete. Es la
forma más directa de comunicar cuál recorrido es de quién.

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

## Despliegue

**AWS Amplify Hosting**, sirviendo los archivos estáticos que produce `vite build`.

Solo hosting. **No se usa el backend de Amplify**: ni Gen 2, ni Cognito, ni AppSync, ni almacenamiento
de datos. La regla de "sin backend" del stack sigue intacta, y el progreso sigue viviendo en
`localStorage`. Amplify aquí es un servidor de archivos con HTTPS, compilación desde el repositorio y
un dominio.

Reglas:

- **`base: '/'` en Vite.** Amplify sirve en la raíz del dominio, no en un subdirectorio, así que no hay
  que reescribir rutas de activos.
- **`amplify.yml` va versionado en el repositorio**, no configurado a mano en la consola. Cuando el
  archivo existe, sus valores tienen precedencia sobre lo que diga la consola, y así la compilación es
  revisable y reproducible en lugar de ser un estado invisible de una cuenta de AWS.
- **La versión de Node hay que forzarla en el build.** El contenedor de Amplify trae su propia versión
  por defecto y no respeta el `.nvmrc` de forma automática. En `preBuild` se usa `nvm` leyendo el
  `.nvmrc`, para que la compilación en la nube use exactamente el mismo Node que el desarrollo local.
  Sin esto, un día compila y otro no, y el motivo no aparece en ningún diff.
- **`npm ci`, no `npm install`**, con el `package-lock.json` versionado. Es lo que hace la compilación
  determinista.
- `artifacts.baseDirectory` es `dist`. Caché de `node_modules` entre compilaciones.
- **Sin reescrituras de SPA** mientras el juego sea una sola página. Si más adelante hay rutas, hace
  falta la regla que devuelve `index.html` con código 200.

Seguridad:

- El juego es **público y sin autenticación**, y así corresponde: no hay datos de usuario más allá del
  progreso en `localStorage`, no se recoge información personal y no hay nada que proteger detrás de un
  inicio de sesión. Es una decisión consciente, no un olvido.
- **Nada sensible en el bundle.** Todo lo que se compila es público por definición. Si algún día hacen
  falta variables de entorno, ninguna puede contener secretos.
- **Se puede aplicar una CSP estricta sin `unsafe-eval`**, precisamente porque el intérprete se escribe
  a mano y el proyecto nunca usa `eval` ni `new Function`. Vale la pena aprovecharlo: es un beneficio
  gratuito de una decisión que se tomó por otras razones.

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
