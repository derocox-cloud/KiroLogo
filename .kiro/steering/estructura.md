# Estructura del proyecto

```
KiroLogo/
├── LICENSE                      MIT
├── README.md
├── .gitignore
├── .nvmrc                       Node 24
├── amplify.yml                  compilación en AWS Amplify Hosting
├── index.html
├── package.json                 name KiroLogo, private true, engines Node >= 24
├── package-lock.json            versionado, el despliegue usa npm ci
├── tsconfig.json
├── vite.config.ts               base '/'
├── .kiro/
│   └── steering/                las reglas del proyecto, versionadas
├── docs/
│   ├── README.md                plan de las ocho specs
│   ├── bitacora.md              cómo se concibió el juego y por qué
│   └── prompts/                 el prompt de creación de cada spec
└── src/
    ├── main.ts                  punto de entrada, arma la pantalla
    ├── lenguaje/                el pseudo-lenguaje KiroLogo
    │   ├── vocabulario.ts       tabla única de comandos: nombre, abreviatura, aridad, mundo
    │   ├── lexer.ts             texto → tokens (normaliza acentos y mayúsculas)
    │   ├── ast.ts               tipos del árbol sintáctico
    │   ├── parser.ts            tokens → AST
    │   ├── evaluador.ts         expresiones aritméticas y AZAR → número (puro)
    │   ├── interprete.ts        AST → generador de operaciones; el azar llega inyectado (fabricaAzar)
    │   ├── colores.ts           colores del mundo 2: nombres y ternas RGB
    │   ├── conteo.ts            instrucciones de un AST, única fuente del presupuesto
    │   ├── impresor.ts          AST → texto KiroLogo (lo usan los generadores)
    │   └── errores.ts           todos los mensajes visibles al jugador
    ├── motor/
    │   ├── tortuga.ts           modelo puro: posición, rumbo, lápiz
    │   ├── lienzo.ts            cuadrícula de 20 px y dibujo de la estela
    │   ├── personajes.ts        render de la tortuga con Kiro montado
    │   ├── animador.ts          consume operaciones y las reproduce en el tiempo
    │   ├── segmentos.ts         operaciones → lista de segmentos dibujados
    │   ├── encuadre.ts          caja envolvente, ¿cabe en el lienzo?
    │   ├── validador.ts         comparación geométrica contra la figura de referencia
    │   ├── divergencia.ts       primer paso donde dos ejecuciones se separan
    │   ├── relleno.ts           área cerrada de RELLENA, calculada desde los trazos
    │   └── tramos-dibujo.ts     estela con color y grosor, solo para dibujar
    ├── azar/
    │   ├── prng.ts              aleatorio determinista por semilla, nunca Math.random
    │   ├── entropia.ts          único punto de entropía: elige la semilla de un reto nuevo
    │   └── codigo-semilla.ts    semilla ↔ código corto compartible
    ├── juego/
    │   ├── reto.ts              (idNivel, semilla) → programa de referencia
    │   ├── desafio-infinito.ts  secuencia determinista de retos generados de un mundo
    │   ├── pistas.ts            pistas en tres escalones y sus marcadores
    │   ├── progreso.ts          persistencia en localStorage
    │   ├── estrellas.ts         precisión, economía, abstracción
    │   ├── abstraccion.ts       análisis del AST para la estrella de abstracción
    │   ├── insignias.ts         reglas de otorgamiento
    │   └── desbloqueo.ts        qué mundo y qué comandos están disponibles
    ├── niveles/
    │   ├── tipos.ts             la forma de un Nivel y de un Generador
    │   ├── generadores/         un archivo por arquetipo: camino.ts, zigzag.ts, roseton.ts, flor.ts,
    │   │                        tres-poligonos.ts, poligonos-encajados.ts, estrella-parametrica.ts…;
    │   │                        comun.ts y poligono-comun.ts son piezas compartidas y registro.ts
    │   │                        asocia cada id de generador con su función
    │   ├── mundo-0-primeros-pasos.ts
    │   ├── mundo-1-figuras.ts
    │   ├── mundo-2-composicion.ts
    │   ├── mundo-3-rosetones.ts
    │   ├── mundo-4-parametros.ts
    │   ├── mundo-5-fractales.ts
    │   ├── mundo-bonus-arquitectura.ts
    │   ├── mundos.ts            nombre e insignia de cada mundo, para mostrarlos al jugador
    │   └── catalogo.ts          reúne y ordena todos los mundos
    ├── ui/
    │   ├── editor.ts            área de escritura con números de línea
    │   ├── panel-comandos.ts    vocabulario desbloqueado, con ejemplos
    │   ├── demostracion.ts      Kiro dibuja el reto en vivo, con repetición y velocidad
    │   ├── comparacion.ts       lado a lado, superposición y reproducción en paralelo
    │   ├── globo-kiro.ts        diálogos, pistas y celebración
    │   ├── consola.ts           salida de ESCRIBE; ranura vacía antes del mundo 4
    │   ├── control-desafio.ts   iniciar y avanzar el desafío infinito
    │   ├── reproduccion-paralelo.ts  dibujo de las dos tortugas, cuadro a cuadro
    │   ├── controles.ts         ejecutar, paso a paso, velocidad, reiniciar, otro reto
    │   ├── diff.ts              comparación visual al fallar
    │   ├── marcador-estrellas.ts  las tres estrellas del intento, por forma, texto y color
    │   ├── menu-mundos.ts       menú desplegable de los seis mundos en acordeón, con el nivel en curso marcado
    │   ├── panel-semilla.ts     código del reto, otro reto y reproducir un código
    │   ├── guia.ts              primeros pasos del nivel 0.1
    │   ├── mapa-insignias.ts    progreso como mapa de habilidades
    │   └── modo-libre.ts        sandbox y galería
    ├── estilos/
    │   ├── tema.css             fichas de color de la paleta Kiro (la única) y variables derivadas de ellas
    │   └── pantalla.css         la presentación; lee los colores del tema, nunca los repite
    └── pruebas/                 ayudas compartidas por las pruebas; nunca las importa el juego
        ├── tiempos.ts           TIMEOUT_TRES_ESTRELLAS de las regresiones sobre 200 semillas
        └── arbitrarios.ts       generadores de fast-check (expresiones, programas) y el modelo de pila
```

## Reglas

- **`vocabulario.ts` es la única fuente de verdad de los comandos.** El lexer, el panel de la
  interfaz, la ayuda contextual y las sugerencias de error leen de ahí. Agregar un comando se hace en
  un solo lugar.
- **`conteo.ts` es la única fuente de verdad del presupuesto.** El contador que ve el jugador mientras
  escribe, el `presupuestoEstrella` derivado de la referencia y la evaluación de la estrella de
  economía usan la misma función. Si hay dos implementaciones, el jugador va a ver un número y ser
  evaluado con otro.
- **`evaluador.ts` es la única fuente de verdad de la aritmética.** Los operadores infijos y los
  comandos `SUMA`…`RESTO` y `AZAR` se evalúan ahí; el intérprete no reimplementa operaciones. Es puro:
  solo importa `errores.ts` y los tipos de `ast.ts`.
- **El azar entra al intérprete por inyección.** `lenguaje/` no importa de `azar/`: quien ejecuta pasa
  `opciones.fabricaAzar` (de `azar/prng.ts`) junto con `opciones.semilla`. Se crea una sola vez por
  ejecución y solo si el programa usa `AZAR`.
- **`azar/entropia.ts` es el único lugar donde se elige una semilla nueva.** Dentro de la ejecución y
  de los generadores el azar sigue pasando por `prng.ts`.
- **Los generadores producen AST, no texto ni imágenes.** `impresor.ts` los convierte a texto solo
  cuando hace falta mostrarlos (pistas, depuración, compartir). Así el conteo y la ejecución siempre
  operan sobre la misma estructura.
- **`niveles/` contiene datos y generadores, no lógica de juego.** Puede importar de `lenguaje/` (para
  construir AST) y de `azar/`, pero nunca de `motor/`, `juego/` ni `ui/`.
- `lenguaje/` no importa nada de ningún otro directorio. Es la capa base, probable en aislamiento.
- `motor/` puede importar de `lenguaje/`, nunca de `ui/`. La interfaz consume el motor, nunca al revés.
- **Nada usa `Math.random`.** Todo el azar pasa por `azar/prng.ts` con semilla explícita, o los retos
  dejan de ser reproducibles y los reportes de error, inútiles.
- Las pruebas van junto al módulo que prueban: `parser.ts` y `parser.test.ts`. Si un módulo tiene
  varias, el aspecto va entre el nombre y `.test.ts`: `parser.ambito.propiedad.test.ts` o
  `main.consola.test.ts` acompañan a `parser.ts` y a `main.ts` de la misma carpeta. Lo que manda es
  el nombre hasta el primer punto, y ese módulo tiene que existir; las únicas pruebas sin módulo son
  las ayudas listadas en `main.test.ts`.
