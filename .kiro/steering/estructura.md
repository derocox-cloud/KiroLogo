# Estructura del proyecto

```
kirologo/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.ts                  punto de entrada, arma la pantalla
    ├── lenguaje/                el pseudo-lenguaje KiroLogo
    │   ├── vocabulario.ts       tabla única de comandos: nombre, abreviatura, aridad, mundo
    │   ├── lexer.ts             texto → tokens (normaliza acentos y mayúsculas)
    │   ├── ast.ts               tipos del árbol sintáctico
    │   ├── parser.ts            tokens → AST
    │   ├── interprete.ts        AST → generador de operaciones
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
    │   └── divergencia.ts       primer paso donde dos ejecuciones se separan
    ├── azar/
    │   ├── prng.ts              aleatorio determinista por semilla, nunca Math.random
    │   └── codigo-semilla.ts    semilla ↔ código corto compartible
    ├── juego/
    │   ├── reto.ts              (idNivel, semilla) → programa de referencia
    │   ├── progreso.ts          persistencia en localStorage
    │   ├── estrellas.ts         precisión, economía, abstracción
    │   ├── abstraccion.ts       análisis del AST para la estrella de abstracción
    │   ├── insignias.ts         reglas de otorgamiento
    │   └── desbloqueo.ts        qué mundo y qué comandos están disponibles
    ├── niveles/
    │   ├── tipos.ts             la forma de un Nivel y de un Generador
    │   ├── generadores/         un archivo por arquetipo: poligono.ts, rosetón.ts, camino.ts…
    │   ├── mundo-0-primeros-pasos.ts
    │   ├── mundo-1-figuras.ts
    │   ├── mundo-2-composicion.ts
    │   ├── mundo-3-rosetones.ts
    │   ├── mundo-4-parametros.ts
    │   ├── mundo-5-fractales.ts
    │   ├── mundo-bonus-arquitectura.ts
    │   └── catalogo.ts          reúne y ordena todos los mundos
    ├── ui/
    │   ├── editor.ts            área de escritura con números de línea
    │   ├── panel-comandos.ts    vocabulario desbloqueado, con ejemplos
    │   ├── demostracion.ts      Kiro dibuja el reto en vivo, con repetición y velocidad
    │   ├── comparacion.ts       lado a lado, superposición y reproducción en paralelo
    │   ├── globo-kiro.ts        diálogos, pistas y celebración
    │   ├── controles.ts         ejecutar, paso a paso, velocidad, reiniciar, otro reto
    │   ├── diff.ts              comparación visual al fallar
    │   ├── mapa-insignias.ts    progreso como mapa de habilidades
    │   └── modo-libre.ts        sandbox y galería
    └── estilos/
        └── *.css
```

## Reglas

- **`vocabulario.ts` es la única fuente de verdad de los comandos.** El lexer, el panel de la
  interfaz, la ayuda contextual y las sugerencias de error leen de ahí. Agregar un comando se hace en
  un solo lugar.
- **`conteo.ts` es la única fuente de verdad del presupuesto.** El contador que ve el jugador mientras
  escribe, el `presupuestoEstrella` derivado de la referencia y la evaluación de la estrella de
  economía usan la misma función. Si hay dos implementaciones, el jugador va a ver un número y ser
  evaluado con otro.
- **Los generadores producen AST, no texto ni imágenes.** `impresor.ts` los convierte a texto solo
  cuando hace falta mostrarlos (pistas, depuración, compartir). Así el conteo y la ejecución siempre
  operan sobre la misma estructura.
- **`niveles/` contiene datos y generadores, no lógica de juego.** Puede importar de `lenguaje/` (para
  construir AST) y de `azar/`, pero nunca de `motor/`, `juego/` ni `ui/`.
- `lenguaje/` no importa nada de ningún otro directorio. Es la capa base, probable en aislamiento.
- `motor/` puede importar de `lenguaje/`, nunca de `ui/`. La interfaz consume el motor, nunca al revés.
- **Nada usa `Math.random`.** Todo el azar pasa por `azar/prng.ts` con semilla explícita, o los retos
  dejan de ser reproducibles y los reportes de error, inútiles.
- Las pruebas van junto al módulo que prueban: `parser.ts` y `parser.test.ts`.
