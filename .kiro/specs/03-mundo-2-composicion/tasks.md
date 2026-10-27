# Implementation Plan

**KiroLogo · Spec 03 · Mundo 2 · Composición**

## Tasks

- [x] 1. Afianzar la capa de lenguaje que ya ejecuta procedimientos

  Gran parte del andamiaje ya existe (nodos del AST, ejecución en el intérprete, regla de conteo,
  análisis de abstracción). Aquí no se reimplementa nada: se añaden los tests que fijan el
  comportamiento esperado por los requisitos antes de ampliar el parser.

  - [x]* 1.1 Tests del AST de procedimientos en `src/lenguaje/ast.test.ts`
    - Confirmar que `DefinicionProcedimiento` (`tipo: 'definicionProcedimiento'`, `nombre`,
      `parametros: readonly string[]`, `cuerpo`) e `InvocacionProcedimiento`
      (`tipo: 'invocacionProcedimiento'`, `nombre`, `argumentos`) existen con esa forma.
    - No modificar `src/lenguaje/ast.ts`; solo verificar que construir ambos nodos con
      `parametros: []` y `argumentos: []` compila y cumple los tipos.

  - [x]* 1.2 Tests de conteo de procedimientos en `src/lenguaje/conteo.test.ts`
    - `PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN CUADRADO CUADRADO CUADRADO` → **6** (R2.6).
    - El programa equivalente que copia `REPITE 4 [AV 100 GD 90]` tres veces sin definir
      procedimiento → **9** (R2.7: cada `REPITE 4 [AV 100 GD 90]` cuenta 3; la regla no multiplica por iteraciones).
    - La cabecera `PARA NOMBRE` suma 0 (R2.1); `FIN` suma 0 (R2.2); el cuerpo se cuenta una sola
      vez en la definición (R2.3); una `InvocacionProcedimiento` suma 1 (R2.4).
    - Test de propiedad: para `m ≥ 1`, definir e invocar `m` veces nunca cuenta más que copiar el
      cuerpo `m` veces (R2.5).

  - [x]* 1.3 Tests de abstracción `defineProcedimiento` en `src/juego/abstraccion.test.ts`
    - Un AST que contiene un `definicionProcedimiento` cumple `defineProcedimiento` (R10.2, R10.6).
    - Un AST que repite el panel sin definir procedimiento NO lo cumple (R10.3).
    - `defineProcedimiento` analiza el AST, no el texto del programa (R10.6).

- [x] 2. Catálogo de colores — `src/lenguaje/colores.ts` (NUEVO)

  Módulo puro que resuelve nombres de color y ternas RGB. Es dependencia del intérprete y de los
  mensajes de error, así que se construye antes que ellos.

  - [x] 2.1 Definir el catálogo y los resolutores
    - Definir `interface Color { r: number; g: number; b: number; nombre: string | null }`.
    - Exportar `NOMBRES_COLOR` con los once nombres en el orden exacto del mensaje de error:
      `rojo`, `azul`, `verde`, `amarillo`, `naranja`, `morado`, `rosa`, `café`, `negro`, `blanco`,
      `gris` (R6.7).
    - Implementar `resolverColorPorNombre(palabra: string): ResultadoColor`, normalizando acentos y
      mayúsculas con `normalizarPalabra` del vocabulario, de modo que `cafe`, `CAFÉ` y `Café`
      equivalgan.
    - Implementar `resolverColorRGB(r, g, b): ResultadoColor`, válido solo si los tres son enteros
      entre 0 y 255 (R4.2).
    - Fijar el color por omisión en `negro`.

  - [ ]* 2.2 Tests del catálogo de colores en `src/lenguaje/colores.test.ts`
    - Los once nombres resuelven a un `Color` con `nombre` no nulo.
    - `café`, `cafe`, `CAFÉ` y `Café` resuelven al mismo color (equivalencia por acento).
    - `resolverColorRGB(255, 0, 0)` resuelve; `[256 0 0]` y `[−1 0 0]` fallan.
    - Un nombre fuera del catálogo (`turquesa`) falla.

- [x] 3. Errores del mundo 2 — `src/lenguaje/errores.ts` (AMPLIAR el catálogo)

  Agregar los `IdError` nuevos con sus parámetros y los textos exactos de la tabla de Error
  Handling, y permitir que la sugerencia de palabra desconocida considere procedimientos.

  - [x] 3.1 Nuevos `IdError` con mensajes exactos
    - `finSinPara(linea)` → `Encontré FIN en la línea N pero no hay ningún PARA abierto.` (R6.1).
    - `paraSinFin(nombre, linea)` → `El comando NOMBRE que empezaste en la línea N nunca termina con FIN.` (R6.2).
    - `procedimientoRedefinido(nombre, linea)` → `Ya le enseñaste a Kiro qué es NOMBRE más arriba. No puedo aprenderlo dos veces; edita la primera definición.` (R6.5).
    - `paraNombreQueEsLenguaje(nombre)` → `NOMBRE es una palabra de KiroLogo y no se puede volver a definir.` (R6.6).
    - `colorInvalido(palabra)` → `No conozco el color X. Puedes usar: rojo, azul, verde, amarillo, naranja, morado, rosa, café, negro, blanco o gris.` (R4.3, R6.7).
    - `grosorInvalido()` → `El grosor debe ser un número entero entre 1 y 50.` (R4.5).

  - [x] 3.2 Sugerencia hacia procedimientos en `resolverPalabraNoEjecutable`
    - Extender la firma para recibir también los nombres de procedimiento definidos como candidatos
      de sugerencia, junto a los comandos desbloqueados.
    - Aplicar el mismo umbral de distancia de edición ya existente (≤1 para ≤3 caracteres, ≤2 para
      ≥4) sobre el conjunto combinado (R6.3).
    - No cambiar el comportamiento cuando no hay candidato: mensaje sin sugerencia (R6.4).

  - [x]* 3.3 Tests de los mensajes en `src/lenguaje/errores.test.ts`
    - Cada nuevo mensaje con el número de línea correcto (desde 1) donde aplica.
    - `colorInvalido` lista los once nombres en el orden canónico.
    - Una palabra desconocida cercana a un procedimiento definido produce `¿Querías decir …?` con
      ese procedimiento como candidato (R6.3).

- [x] 4. Reconciliar la entrada `PARA` del vocabulario — `src/lenguaje/vocabulario.ts`

  Ajuste pequeño: en el mundo 2 `PARA` no toma parámetros, así que el ejemplo no debe sugerirlos.

  - [x] 4.1 Ajustar el ejemplo de `PARA`
    - Cambiar el ejemplo de `PARA cuadrado :lado` a `PARA cuadrado`.
    - Conservar la entrada (panel, bloqueo por mundo, detección de inglés) y su mapeo
      `TO→PARA`, `END→FIN` en `TABLA_LOGO_INGLES`.

  - [ ]* 4.2 Test de la entrada reconciliada en `src/lenguaje/vocabulario.test.ts`
    - `buscarComando('PARA')` y `buscarComando('FIN')` siguen resolviendo con `mundo: 2`.
    - El ejemplo mostrado ya no contiene `:lado`.

- [x] 5. Parser — definición e invocación de procedimientos en `src/lenguaje/parser.ts` (AMPLIAR)

  El trabajo real del parser: una primera pasada que recoge los nombres de `PARA` y una segunda que
  reconoce invocaciones y definiciones, con los cuatro errores nuevos.

  - [x] 5.1 Primera pasada `recolectarProcedimientos`
    - Implementar `recolectarProcedimientos(tokens): ReadonlySet<string>` que recorre los tokens
      buscando `PARA NOMBRE … FIN` bien formados y devuelve el conjunto de nombres válidos.
    - Descartar los rechazados: nombre que pisa el lenguaje, redefinición (conserva el primero), y
      `PARA` sin `FIN`.
    - Añadir el campo `readonly procedimientos: ReadonlySet<string>` a `Estado` y guardarlo en
      `analizar` antes del bucle de `analizarInstruccion`.

  - [x] 5.2 Reconocer la invocación de procedimiento
    - En `analizarInstruccion`, rama `'identificador'`: si el nombre normalizado está en
      `estado.procedimientos`, producir `InvocacionProcedimiento` con `argumentos: []` y avanzar
      (R1.2 reconocimiento; R1.5 referencia adelantada).
    - Si no está, conservar la caída a `resolverPalabraNoEjecutable` con los procedimientos como
      candidatos de sugerencia (R6.3, R6.4).

  - [x] 5.3 Analizar la definición `PARA NOMBRE … FIN`
    - Implementar `analizarDefinicion(estado, tokenPara)` que consume `PARA`, el `identificador`
      del nombre, las instrucciones del cuerpo y `FIN`, y produce `DefinicionProcedimiento` con
      `parametros: []` e ignorando cualquier `:param` (R1.2).
    - Reportar `paraNombreQueEsLenguaje` si el nombre normalizado coincide con un comando o
      abreviatura del vocabulario y no registrar la definición (R6.6).
    - Reportar `procedimientoRedefinido` en la segunda definición del mismo nombre, conservando la
      primera (R6.5).
    - Reportar `paraSinFin` (nombra el procedimiento y la línea del `PARA`) si se agotan los tokens
      sin `FIN` (R6.2).

  - [x] 5.4 `FIN` suelto y recuperación
    - En `analizarComando`, al ver `FIN` donde se espera una instrucción (sin `PARA` abierto),
      reportar `finSinPara` con la línea del `FIN`, descartarlo y continuar con `sincronizar`
      (R6.1).
    - Respetar `MAXIMO_ERRORES` y el orden por línea/columna.

  - [x]* 5.5 Tests del parser en `src/lenguaje/parser.test.ts`
    - `PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN` → `DefinicionProcedimiento` con
      `nombre: 'CUADRADO'`, `parametros: []` y el cuerpo esperado (R1.2).
    - `CUADRADO PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN` → `CUADRADO` reconocido como
      `InvocacionProcedimiento` por la primera pasada (R1.5).
    - Un `identificador` que no es procedimiento ni comando cae en `resolverPalabraNoEjecutable`,
      con sugerencia hacia un procedimiento cercano cuando aplica (R6.3).
    - Los cuatro errores con su línea: `finSinPara`, `paraSinFin` (nombre + línea del `PARA`),
      `procedimientoRedefinido` (conserva la primera), `paraNombreQueEsLenguaje` (`PARA AVANZA`).
    - Se respeta `MAXIMO_ERRORES` y el orden de reporte.

- [x] 6. Parser — argumentos de `PONCOLOR` y `PONGROSOR` en `src/lenguaje/parser.ts` (AMPLIAR)

  Hoy el análisis de comando con argumento solo contempla un literal numérico. `PONCOLOR` admite
  palabra o terna RGB; hay que representarlos y llevarlos hasta el intérprete.

  - [x] 6.1 Parsear el argumento de `PONCOLOR` y `PONGROSOR`
    - Ampliar `analizarComandoConArgumento` (o la ruta equivalente) para que `PONCOLOR` acepte las
      tres formas: palabra desnuda (`PONCOLOR naranja`), palabra con comilla inicial
      (`PONCOLOR "naranja`) y terna RGB como lista de tres enteros (`PONCOLOR [255 0 0]`) (R4.2).
    - `PONGROSOR` toma un único literal numérico, como hoy (R4.4).
    - Construir el nodo de invocación de comando llevando el argumento sin resolver (palabra o lista
      de tres números) para que el intérprete lo resuelva contra `colores.ts`.

  - [x]* 6.2 Tests del parseo de argumentos en `src/lenguaje/parser.test.ts`
    - `PONCOLOR naranja`, `PONCOLOR "naranja` y `PONCOLOR [255 0 0]` producen el argumento esperado.
    - `PONGROSOR 5` produce el literal numérico.
    - `RL` y las abreviaturas `PC`, `PG` se reconocen como sus comandos (R4.9).

- [x] 7. Intérprete — comandos del mundo 2 en `src/lenguaje/interprete.ts` (AMPLIAR)

  El flujo de `pila`/`Marco`, `buscarDefinicion` y las guardas no cambian. Se amplían la unión
  `Operacion` con el canal decorativo y `ejecutarComando` con los nueve comandos del mundo 2.

  - [x] 7.1 Operaciones decorativas en la unión `Operacion`
    - Añadir `OperacionColor` (`tipo: 'color'`, `color: Color`), `OperacionGrosor`
      (`tipo: 'grosor'`, `grosor: number`) y `OperacionRelleno` (`tipo: 'relleno'`, `color: Color`)
      a la unión `Operacion`.
    - Introducir `EstadoDecorativo { color: Color; grosor: number }` que el intérprete arrastra
      entre operaciones, con valores por omisión `negro` y `1`.

  - [x] 7.2 Lápiz y visibilidad
    - `SUBELAPIZ`/`SL`: emitir `OperacionLapiz` con `lapizAbajo: false` vía `conLapiz(estado, false)`
      (R3.1, R3.2). `BAJALAPIZ`/`BL`: `conLapiz(estado, true)` (R3.3, R3.4).
    - `OCULTATORTUGA`/`OT` y `MUESTRATORTUGA`/`MT`: emitir `OperacionVisibilidad` vía
      `conVisibilidad` (R5.1, R5.2).
    - Confirmar que al iniciar la ejecución el `Estado_Lapiz` queda abajo (R3.5) y que repetir
      `SUBELAPIZ`/`OCULTATORTUGA`/`MUESTRATORTUGA` sobre el mismo estado es idempotente y sin error
      (R3.7, R5.4, R5.5).

  - [x] 7.3 Color, grosor y relleno
    - `PONCOLOR`/`PC`: resolver el argumento con `colores.ts`; si es válido, actualizar
      `EstadoDecorativo.color` y emitir `OperacionColor`; si no, conservar el color vigente y
      reportar `colorInvalido` (R4.1, R4.3).
    - `PONGROSOR`/`PG`: si es entero entre 1 y 50, actualizar `EstadoDecorativo.grosor` y emitir
      `OperacionGrosor`; si no, conservar el grosor vigente y reportar `grosorInvalido` (R4.4, R4.5).
    - `RELLENA`/`RL`: emitir `OperacionRelleno` con el color indicado (R4.6); sin área cerrada no
      cambia el lienzo (R4.7).
    - Ninguno de estos comandos mueve la tortuga: `estadoDespues` conserva posición y rumbo.

  - [x]* 7.4 Tests del intérprete en `src/lenguaje/interprete.test.ts`
    - `PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN CUADRADO` emite exactamente las mismas operaciones,
      en el mismo orden, que `REPITE 4 [AV 100 GD 90]` (R1.1).
    - Procedimiento con cuerpo vacío → cero operaciones, sin error (R1.8).
    - Invocar un procedimiento inexistente en ejecución detiene y reporta `comandoNoPermitido`,
      sin emitir operación por esa invocación (R1.6).
    - `SUBELAPIZ` seguido de `AVANZA 100` no produce ningún segmento vía `extraerSegmentos`;
      `BAJALAPIZ` lo reanuda (R3.2, R3.4).
    - `PONCOLOR`, `PONGROSOR` y `RELLENA` no producen segmentos ni cambian posición ni rumbo.
    - Color inválido conserva el color vigente y reporta `colorInvalido` (R4.3); grosor fuera de
      1..50 conserva el grosor y reporta `grosorInvalido` (R4.5).
    - `OCULTATORTUGA`/`MUESTRATORTUGA` emiten `OperacionVisibilidad` y son idempotentes (R5.4, R5.5).

- [x] 8. Confirmar que el canal decorativo no llega al validador

  Ni `src/motor/segmentos.ts` ni `src/motor/validador.ts` cambian. Se añade un test que lo deja por
  escrito: las decoraciones son invisibles para la precisión.

  - [x]* 8.1 Test de frontera decorativa en `src/motor/validador.test.ts`
    - Un programa con `SUBELAPIZ`/`BAJALAPIZ`, `PONCOLOR`, `PONGROSOR` y `RELLENA` intercalados que
      deja los mismos trazos que su versión sin decoraciones obtiene el mismo IoU y el mismo
      veredicto (R4.8).
    - `extraerSegmentos` ignora `OperacionColor`, `OperacionGrosor`, `OperacionRelleno`,
      `OperacionLapiz` y `OperacionVisibilidad` (no producen segmento).

- [x] 9. Niveles autorados y generados del mundo 2 — `src/niveles/mundo-2-composicion.ts` (NUEVO)

  Mismo molde que `mundo-1-figuras.ts`: `parsearReferencia(texto)` con `{ mundo: 2 }`, los dos
  autorados y los cuatro generados, con presupuesto calculado por el Conteo, nunca escrito a mano.

  - [x] 9.1 Niveles autorados 2.1 y 2.4
    - `REFERENCIA_2_1 = parsearReferencia('REPITE 4 [AV 100 GD 90] AV 100 GD 30 REPITE 3 [AV 100 GD 120]')`
      (casa) y `NIVEL_2_1` con `abstraccion: []`, pistas conceptual/matemática/esqueleto (R8.1).
    - `REFERENCIA_2_4 = parsearReferencia('REPITE 4 [AV 50 GI 90 AV 50 GD 90 AV 50 GI 90]')` (cruz) y
      `NIVEL_2_4` análogo (R8.2).
    - Normalización traslación libre, rotación libre, escala exacta en ambos (R8.4).
    - El `presupuestoEstrella` se deriva del Conteo sobre la referencia, sin número a mano (R8.3).

  - [x] 9.2 Declaración de los niveles generados 2.2, 2.3, 2.5, 2.6
    - `NIVEL_2_2` (`estrella-m2`), `NIVEL_2_3` (`escalera-m2`), `NIVEL_2_5` (`dos-poligonos-m2`) con
      `origen: { tipo: 'generado', idGenerador, parametros: {} }` y `abstraccion: []`.
    - `NIVEL_2_6` (`cuadricula-m2`) con `abstraccion: [{ clave: 'defineProcedimiento' }]` (R10.1).
    - Exportar `MUNDO_2` con los seis niveles en orden, todos con `mundo: 2`,
      `concepto: 'descomposicion'` y normalización libre/libre/exacta.

  - [x]* 9.3 Tests de niveles autorados en `src/niveles/mundo-2-composicion.test.ts`
    - 2.1 y 2.4 parsean sin error.
    - El `presupuestoEstrella` de 2.1 y de 2.4 coincide con `contarInstrucciones` sobre su
      referencia (R8.3), sin valor escrito a mano.
    - La referencia de 2.1 y de 2.4 aprueba las tres estrellas de su propio nivel (R8.4).

- [x] 10. Generadores del mundo 2 — `src/juego/generadores-mundo-2.ts` (NUEVO)

  Cuatro generadores con el patrón del mundo 1 (`crearPrng`, construir texto, `parsear` con
  `{ mundo: 2 }`, `encuadraYNoEsDegenerada`, reintento con la semilla siguiente, fallback
  determinista) y el record `GENERADORES_M2`.

  - [x] 10.1 Generador `estrella-m2` (nivel 2.2)
    - `p ∈ {5, 7, 9}` (`prng.elegir`), `L` múltiplo de 20 entre 100 y 180
      (`prng.multiplo(100, 180, 20)`), forma `REPITE p [AV L GD 360*2/p]` (R9.1).
    - Para `p ∈ {5, 9}` el ángulo es entero (144, 80); para `p = 7` usar el entero más cercano y
      dejar que el lazo descarte la semilla si no encuadra o degenera.

  - [x] 10.2 Generador `escalera-m2` (nivel 2.3)
    - 3 a 6 peldaños (`prng.entero(3, 6)`), huella = altura, múltiplo de 20 entre 20 y 60
      (`prng.multiplo(20, 60, 20)`) (R9.2).

  - [x] 10.3 Generador `dos-poligonos-m2` (nivel 2.5)
    - Dos polígonos, cada uno de 3 a 6 lados, separados por un múltiplo de 20 entre 20 y 100 (R9.3).
    - El texto usa `SUBELAPIZ`/`BAJALAPIZ` para moverse entre los dos sin trazo intermedio (R9.4).

  - [x] 10.4 Generador `cuadricula-m2` (nivel 2.6)
    - Cuadrícula de paneles 2×2, 3×2 o 3×3 (R9.5).
    - La referencia DEFINE un procedimiento con `PARA` e invoca una vez por panel (R9.6), de modo
      que su AST contiene un nodo `definicionProcedimiento`.

  - [x] 10.5 Registro, encuadre y presupuesto
    - Exportar `GENERADORES_M2` con las claves `estrella-m2`, `escalera-m2`, `dos-poligonos-m2`,
      `cuadricula-m2`.
    - Descartar la semilla y probar la siguiente si la figura es degenerada (ancho o alto de la caja
      < 200 px, R9.9) o si no encuadra (se sale de [−400, 400], R9.10).
    - El `presupuestoEstrella` sale del Conteo sobre la referencia devuelta, nunca escrito a mano
      (R9.7, R9.8).

  - [x]* 10.6 Tests de propiedad de los generadores en `src/juego/generadores-mundo-2.test.ts`
    - Para cada generador, 200 semillas consecutivas: todas encuadran y no son degeneradas, y su
      referencia gana las tres estrellas (precisión, economía y abstracción) (R9.11).
    - `dos-poligonos-m2`: la referencia usa `SUBELAPIZ`/`BAJALAPIZ` y no hay trazo entre los dos
      polígonos (R9.4).
    - `cuadricula-m2`: la referencia contiene un nodo `definicionProcedimiento`, lo invoca una vez
      por panel (R9.6) y obtiene la estrella `defineProcedimiento` (R10.2).
    - En los cuatro, el presupuesto proviene del Conteo aplicado a la referencia (R9.7, R9.8).

- [x] 11. Checkpoint — Asegurar que la capa de lenguaje y niveles pasan

  Ejecutar todos los tests de los módulos de lenguaje, niveles y generadores antes de tocar la UI y
  las insignias.

  - [x] 11.1 Correr `npm test` y confirmar que pasan sin regresiones; ante dudas, preguntar al usuario.

- [x] 12. Registrar el mundo 2 en el catálogo — `src/niveles/catalogo.ts` (AMPLIAR)

  Incorporar los seis niveles y las cuatro entradas de generadores al registro que resuelve
  `reto.ts`.

  - [x] 12.1 Añadir `MUNDO_2` y los generadores
    - `import { MUNDO_2 } from './mundo-2-composicion.js';` y
      `CATALOGO = [...MUNDO_0, ...MUNDO_1, ...MUNDO_2]`.
    - Incorporar las cuatro claves de `GENERADORES_M2` al registro de generadores que consulta
      `reto.ts`.

  - [x]* 12.2 Test del catálogo en `src/niveles/catalogo.test.ts`
    - El mundo 2 tiene seis niveles (2.1–2.6) con `insignia: 'Descomposición'`.
    - El nivel 2.6 declara la exigencia de abstracción `defineProcedimiento` (R10.1).
    - El `presupuestoEstrella` de un nivel autorado es el del Conteo, no un valor a mano.

- [x] 13. Panel de comandos con procedimientos del jugador — `src/ui/panel-comandos.ts` (AMPLIAR)

  Mostrar los procedimientos definidos después de los comandos del lenguaje y mantener la lista al
  día cuando el texto cambia.

  - [x] 13.1 `fijarProcedimientos`
    - Añadir `fijarProcedimientos(nombres: readonly string[]): void` que reconstruye la sección de
      procedimientos tras los comandos del mundo, en orden de definición, con el nombre tal como se
      escribió y sin abreviatura (R7.1, R7.2).
    - Respetar el patrón de roving tabindex y no tocar los botones de comando del lenguaje.
    - Omitir las definiciones no registradas (incompletas o rechazadas) sin alterar las demás (R7.5).

  - [x] 13.2 Conectar el editor al panel
    - Al cambiar el texto, parsear, obtener los nombres de procedimiento válidos y llamar
      `fijarProcedimientos` para reflejar altas, bajas y renombres (R7.3, R7.4).

  - [x]* 13.3 Tests del panel en `src/ui/panel-comandos.test.ts`
    - `fijarProcedimientos` añade los procedimientos tras los comandos del mundo, con el nombre sin
      abreviatura y en orden (R7.1, R7.2).
    - Cambiar la lista refleja altas, bajas y renombres (R7.4).
    - Una definición rechazada no aparece (R7.5).
    - En mundo 0/1 el panel no muestra comandos del mundo 2; en mundo 2 los muestra con descripción
      y ejemplo (R12.3, R12.4).

- [x] 14. Insignia Descomposición — `src/juego/insignias.ts` (AMPLIAR)

  Registrar la insignia del mundo 2 derivándola del progreso, sin estado propio.

  - [x] 14.1 Registrar la insignia
    - Añadir `'descomposicion'` a `IdInsignia` y a `MUNDO_DE_INSIGNIA` (`descomposicion: 2`).
    - Implementar `insigniaDescomposicionOtorgada(progreso)` delegando en
      `mundoCompletoConTresEstrellas(2, progreso)` e incluir la rama del mundo 2 en
      `insigniasDelMundo`.

  - [x]* 14.2 Tests de la insignia en `src/juego/insignias.test.ts`
    - Con las tres estrellas en los seis niveles del mundo 2 → insignia otorgada (R11.1).
    - Con una estrella faltante en algún nivel → no otorgada (R11.2).
    - Volver a completar niveles con la insignia ya otorgada la mantiene una sola vez (R11.5).

- [ ] 15. Verificación integral

  Correr la suite completa, confirmar que las specs 00 y 01 no se rompen, correr los tests de
  propiedad de los generadores y repasar el comportamiento en el navegador.

  - [x] 15.1 Ejecutar `npm test` y confirmar que todos los tests pasan sin regresiones en mundos 0 y 1.
  - [x] 15.2 Correr los tests de propiedad de los cuatro generadores sobre 200 semillas cada uno.
  - [~] 15.3 Repaso manual en el navegador:
    - `PARA CUADRADO REPITE 4 [AV 100 GD 90] FIN CUADRADO` dibuja un cuadrado y el panel muestra el
      procedimiento definido.
    - El contador aplica la regla de conteo del procedimiento (6 con procedimiento vs. 9 copiando, del ejemplo de R2).
    - `SUBELAPIZ`/`BAJALAPIZ` cambian el trazo y Kiro reproduce la animación de levantar el lápiz,
      con señal visual persistente mientras está arriba (R3.8, R3.9).
    - El 2.6 niega la abstracción al copiar el panel por casilla y muestra el mensaje de invitación
      (R10.4).
    - `PARA NOMBRE` sin `FIN` muestra el mensaje con el nombre y la línea (R6.2).
    - Un color mal escrito lista los once colores disponibles (R6.7).
    - `RELLENA` da un veredicto estable del validador (R4.8).

## Hallazgos del repaso manual (15.3)

El repaso en el navegador confirmó que la capa de lenguaje, el conteo, los niveles, los
generadores, el panel y la insignia funcionan. También detectó tres defectos de la capa visual
que la implementación inicial dejó sin cubrir:

- **Medalla de insignia (RESUELTO).** El menú de mundos solo pintaba la medalla del mundo 0; la
  insignia *Descomposición* (R11.3, R11.4) y la de *Iteración* no se mostraban. Corregido para que
  cada mundo muestre su medalla. Cubierto por pruebas en `menu-mundos.test.ts`.
- **El color no se pinta en el lienzo (PENDIENTE — fix dedicado).** `PONCOLOR`/`PONGROSOR` fijan el
  estado decorativo y el intérprete emite `OperacionColor`/`OperacionGrosor`, pero el `Segmento` no
  transporta color ni grosor y `dibujarEstela` pinta con el color único del tema, así que el trazo
  del jugador no cambia de color (R4.1, R4.4 incompletos en la capa de dibujo). Arreglarlo es un
  cambio transversal del motor (modelo de `Segmento`, animador y lienzo) que debe preservar R4.8
  (el validador solo ve geometría, nunca color). Se aborda como fix dedicado y revisado, fuera de
  esta entrega.
- **El error de color/grosor inválido no llega a la UI (PENDIENTE — fix dedicado).** El intérprete
  genera `colorInvalido`/`grosorInvalido` (R4.3, R4.5) y conserva el valor anterior, pero
  `concluirIntento` solo muestra el error de ejecución cuando hubo una guarda; sin guarda, el
  comentario de calificación sobrescribe el globo y el mensaje nunca se ve. Mostrarlo requiere
  decidir cómo conviven un error de ejecución y el comentario de calificación en el mismo globo
  (decisión de UX), por lo que se aborda como fix dedicado y revisado.

El mensaje de ayuda del panel y la redacción del error de comilla también se revisarán en esos
fixes (hoy el ejemplo sugerido usa `PONCOLOR "rojo"` con comilla de cierre, que el lenguaje no
acepta).

## Notes

- Las sub-tareas marcadas con `*` son opcionales (tests) y pueden saltarse para un MVP más rápido.
- Cada tarea referencia requisitos concretos para trazabilidad.
- Buena parte de la capa de lenguaje ya existe: las tareas 1, 7 (flujo de pila) y 8 son ampliar y
  probar, no reconstruir.
- Los checkpoints aseguran validación incremental antes de avanzar a la UI y las insignias.
- El presupuesto de todos los niveles sale del Conteo sobre la referencia, nunca escrito a mano.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1", "4.1"] },
    { "id": 1, "tasks": ["2.2", "3.1", "4.2"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["5.1"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["5.3"] },
    { "id": 6, "tasks": ["5.4"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["5.5", "6.2", "7.1"] },
    { "id": 9, "tasks": ["7.2"] },
    { "id": 10, "tasks": ["7.3"] },
    { "id": 11, "tasks": ["7.4", "8.1", "9.1"] },
    { "id": 12, "tasks": ["9.2"] },
    { "id": 13, "tasks": ["9.3", "10.1", "10.2", "10.3", "10.4"] },
    { "id": 14, "tasks": ["10.5"] },
    { "id": 15, "tasks": ["10.6", "12.1"] },
    { "id": 16, "tasks": ["12.2", "13.1", "14.1"] },
    { "id": 17, "tasks": ["13.2", "14.2"] },
    { "id": 18, "tasks": ["13.3", "15.1"] },
    { "id": 19, "tasks": ["15.2", "15.3"] }
  ]
}
```
