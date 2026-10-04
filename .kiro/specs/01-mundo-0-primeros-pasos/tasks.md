# Implementation Plan: KiroLogo · Spec 01 · Mundo 0 · Primeros pasos

## Overview

El plan completa el **mundo 0** sobre los cimientos de la spec 00, de abajo hacia arriba, siguiendo la
dirección de dependencias de `estructura.md` para que ninguna tarea dependa de algo escrito después:

```
errores (2 ids nuevos) → contrato + comun (lazo, simulación, encuadre)
→ camino → zigzag → registro → niveles del mundo 0
→ reto (rama generada) → progreso v2 + migración → desbloqueo → insignias
→ pistas rellenables → panel-semilla → selector-nivel → guia → main (navegación)
→ transversales (deps, build, steering)
```

Reglas que rigen todo el plan, heredadas del proyecto:

- Cada tarea de módulo escribe su `.test.ts` al lado, con los ejemplos y casos límite del requisito.
- Los generadores viven en `niveles/` y **solo** importan de `lenguaje/` y `azar/`. Las pruebas sí
  cruzan capas (importan el intérprete y el validador reales para cerrar el lazo de las 200 semillas).
- Ningún `presupuestoEstrella` ni `limiteDuro` escrito a mano en `niveles/`.
- Ningún `Math.random`; todo azar por `crearPrng(semilla)`.
- Todo texto de error en `src/lenguaje/errores.ts`.

## Tasks

- [x] 1. Mensajes de programación nuevos en el catálogo
  - Añadir a `src/lenguaje/errores.ts` los `IdError` `generadorSinCandidato` y `generadorDesconocido`, ambos de categoría programación, con su texto en español descriptivo, y su caso en `crearError`
  - Ampliar `errores.test.ts` para cubrir los dos ids nuevos y confirmar que no son visibles al jugador (`esErrorParaJugador` falso)
  - _Requisitos: 2.3, 2.8, 5.5, 13.5_

- [x] 2. Contrato del generador y utilidades compartidas
  - [x] 2.1 Declarar el `Contrato_Generador` y sus tipos
    - En `src/niveles/tipos.ts` (o `src/niveles/generadores/tipos.ts` importado por `tipos.ts`), declarar `EntradaGenerador { semilla, parametros, intentosMaximos }`, la unión `ResultadoGeneracion` (`exito: true` con `referencia`, `semillaEfectiva`, `descartes` / `exito: false` con `error`, `intentos`) y el tipo `Generador`
    - Sin prueba propia (tipos); se verifica desde las pruebas de los generadores y con aserciones de compilación
    - _Requisitos: 2.1, 2.2, 2.3_
  - [x] 2.2 Escribir `src/niveles/generadores/comun.ts` con el lazo, la simulación pura y el encuadre
    - `generarConReintento(entrada, candidatoDe)`: crea el PRNG con la semilla del intento, pide un candidato, lo acepta o lo descarta, reintenta con `(semilla + 1)` con envoltura al dominio hasta `intentosMaximos`, y devuelve éxito con `semillaEfectiva` y `descartes` o fallo con `generadorSinCandidato`
    - `cajaDeReferencia(programa)`: simulación pura de la tortuga (posición y rumbo desde `(0,0)` a 90°) que acumula la caja envolvente de los tramos con lápiz abajo, sin importar `motor/`
    - `esAceptable(programa)`: caja dentro de `[-400, 400]` en ambos ejes y ancho y alto ≥ 200, con las constantes `LIMITE_LIENZO = 400` y `DIMENSION_MINIMA = 200`
    - Helpers `avanza(n)`, `giro(sentido, grados)` que construyen nodos `invocacionComando`/`numeroLiteral` con línea y columna coherentes
    - En `comun.test.ts`: determinismo del lazo; reintento con semilla+1 (candidato degenerado forzado); `cajaDeReferencia` correcta en casos conocidos; y una prueba que importa `LIMITE_LIENZO`/`DIMENSION_MINIMA` de `motor/encuadre.ts` y las compara con las de `comun.ts` para anclarlas
    - _Requisitos: 2.4, 2.5, 2.6, 2.7, 4.4 (encuadre), 3.6, 4.6_

- [x] 3. Generador de camino (nivel 0.3)
  - Escribir `src/niveles/generadores/camino.ts`: `generarCamino` delega en `generarConReintento` con `candidatoCamino`, que toma `tramos ∈ [tramosMin, tramosMax]` y `largo` múltiplo de 20 en `[largoMin, largoMax]` del PRNG, emite un `AVANZA` por tramo y un giro de 90° (`GIRADERECHA`/`GIRAIZQUIERDA` del PRNG) entre tramos, sin giro final
  - En `camino.test.ts`: sobre **al menos 200 semillas iniciales distintas**, todas devuelven éxito; ejecutar cada referencia con el **intérprete real** y validarla contra sí misma con traslación y rotación libres usando el **validador real**, comprobando las tres estrellas, el encuadre y la no degeneración; comprobar que la referencia solo contiene nodos del mundo 0 y que es la forma mínima (conteo = tramos + (tramos−1)); determinismo con misma semilla/parámetros
  - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 2.5, 2.7_

- [x] 4. Generador de zigzag (nivel 0.5)
  - Escribir `src/niveles/generadores/zigzag.ts`: `generarZigzag` con `candidatoZigzag`, que toma `tramos ∈ [4, 8]` y `largo` múltiplo de 20 en `[60, 120]`, emite un `AVANZA` por tramo y giros de 90° (ángulo verificado; 45° es degenerado, ver G2) cuyo sentido **alterna** empezando por uno elegido del PRNG, sin giro final
  - En `zigzag.test.ts`: 200 semillas con el mismo cierre de lazo (intérprete + validador reales, tres estrellas, encuadre, no degeneración); verificar la alternancia de sentido; forma mínima; determinismo
  - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 2.5, 2.7_

- [x] 5. Registro de generadores
  - Escribir `src/niveles/generadores/registro.ts`: `buscarGenerador(idGenerador): Generador | null`, asociando `'camino' → generarCamino` y `'zigzag' → generarZigzag`
  - En `registro.test.ts`: id conocido devuelve función; id desconocido devuelve null
  - _Requisitos: 2.8_

- [ ] 6. Los cinco niveles del mundo 0 como datos
  - Reescribir `src/niveles/mundo-0-primeros-pasos.ts` para declarar `0.1`–`0.5`: `0.1`/`0.2`/`0.4` autorados con su AST nodo por nodo y semilla fija; `0.3`/`0.5` generados con `idGenerador` y `parametros` (rangos verificados) y sin referencia ni semilla almacenadas; todos con `concepto: 'secuencia'`, normalización libre/libre/exacta, `abstraccion: []`, y sus tres pistas (las de los generados como plantillas con marcadores `{tramos}`/`{giro}`/`{cuadros}`)
  - Exportar `MUNDO_0` con los cinco niveles en orden; `catalogo.ts` no cambia
  - En `catalogo.test.ts` (o `mundo-0`): los cinco ids presentes y en orden; autorados válidos; sin presupuesto escrito a mano; las referencias autoradas ganan tres estrellas contra su propio nivel (intérprete + validador reales)
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 3.3, 5.4_

- [ ] 7. Resolución de retos generados en `reto.ts`
  - Extender `resolverReto` para distinguir origen autorado (como hoy) y generado: buscar el generador por `idGenerador`, invocarlo con la semilla recibida y los `parametros`, usar su `referencia` y su `semillaEfectiva`; error del catálogo si el id es desconocido o el generador agota intentos
  - El resto del flujo (ejecución única, segmentos, conteo del presupuesto, `codigoSemilla` sobre la semilla efectiva) queda igual
  - En `reto.test.ts`: nivel generado resuelve con semilla efectiva y presupuesto calculado; misma semilla → mismo reto; autorado sin cambios; `idGenerador` desconocido → error; generador sin candidato → error
  - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [ ] 8. Progreso versión 2 y migración
  - Actualizar `src/juego/progreso.ts` a la clave `kirologo.progreso.v2` y `VERSION_FORMATO = 2`; registro por nivel `{ estrellas, mejorConteo, ultimaSemilla }`; añadir `guiaVista` al contenido
  - Añadir a la interfaz `Progreso`: `mejorConteoDe(idNivel)`, `guiaCompletada()`, `marcarGuiaCompletada()`; `guardar` gana el parámetro `conteoJugador` y actualiza `mejorConteo` solo con precisión otorgada y solo si baja
  - Implementar la migración v1→v2: leer el crudo v1, convertir cada registro conservando las estrellas, `mejorConteo: null`, `ultimaSemilla` de la v1; `guiaVista` verdadero si algún nivel ya tiene precisión; escribir bajo la clave v2 al primer guardado; no borrar la clave v1
  - En `progreso.test.ts`: guarda y recupera estrellas/mejorConteo/semilla; estrellas nunca retroceden; mejorConteo solo baja y solo con precisión; migración v1→v2 conserva estrellas; versión desconocida → vacío; cuota agotada → memoria + aviso único
  - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 10.5_

- [ ] 9. Desbloqueo de niveles y mundos
  - Escribir `src/juego/desbloqueo.ts`: `estadoDeNivel`, `nivelDesbloqueado`, `mundoDesbloqueado`, derivados solo del progreso y del catálogo; primer nivel del mundo 0 siempre abierto; un nivel se abre cuando el anterior está aprobado; un mundo cuando todos los del anterior lo están
  - En `desbloqueo.test.ts`: 0.1 abierto sin progreso; cadena de desbloqueo 0.1→…→0.5; estado `tresEstrellas`; reproducible desde las estrellas guardadas
  - _Requisitos: 7.1, 7.2, 7.3, 7.5, 7.6_

- [ ] 10. Insignia Secuencia
  - Escribir `src/juego/insignias.ts`: `insigniaSecuenciaOtorgada(progreso)` verdadero solo con las tres estrellas en los cinco niveles del mundo 0; `insigniasDelMundo(0, progreso)`; derivado del progreso, sin persistencia propia
  - En `insignias.test.ts`: 15 estrellas → otorgada; falta una → no; reproducible
  - _Requisitos: 8.1, 8.2, 8.4, 8.5_

- [ ] 11. Pistas rellenables con los parámetros reales del reto
  - Escribir la utilidad (en `main.ts` o un módulo de apoyo) `parametrosVisiblesDelReto(reto)` que cuenta los `AVANZA` del AST de la referencia y deduce el giro, y `rellenarPistas(nivel, reto)` que sustituye `{tramos}`/`{giro}`/`{cuadros}` en las plantillas y construye la pista de esqueleto con el `Impresor` sobre una forma **parcial** (primer tramo + primer giro), nunca el programa completo
  - Prueba: sobre una muestra de semillas de `0.3` y `0.5`, el número de tramos de la pista coincide con los `AVANZA` de la referencia; la pista de esqueleto no contiene el programa completo
  - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 12. Panel de semilla
  - Escribir `src/ui/panel-semilla.ts`: franja fija junto a los controles, `<output>` de solo lectura con el `codigoSemilla` y nombre accesible; acción «Otro reto» (solo generados) y «Reproducir código» (campo + botón) por callbacks `pedirOtroReto`/`reproducirCodigo`; en autorados muestra el código marcado como no rejugable, sin «Otro reto»; estados por texto y forma además de color; nunca se superpone a los lienzos
  - En `panel-semilla.test.ts`: «Otro reto» ausente en autorado; código inválido dispara el error del catálogo por el callback sin cambiar el reto; nombres accesibles en español
  - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [ ] 13. Selector de nivel
  - Escribir `src/ui/selector-nivel.ts`: presenta los cinco niveles en orden con su `EstadoNivel` por texto y forma además de color; callback `alElegirNivel(idNivel)` solo para desbloqueados; refleja la insignia _Secuencia_ por texto; nombre accesible por nivel con id y estado; integrado en el orden de foco sin atraparlo
  - En `selector-nivel.test.ts`: estados representados sin depender solo del color; elegir un bloqueado no navega; elegir un desbloqueado invoca el callback; refleja la insignia
  - _Requisitos: 12.1, 12.2, 12.4, 12.5, 7.4_

- [ ] 14. Guía de primeros pasos (nivel 0.1)
  - Escribir `src/ui/guia.ts`: secuencia corta de mensajes publicados por el `GloboKiro` (y por tanto en `aria-live`), que explican la tortuga, la figura de Kiro y el primer comando con un ejemplo accionable (`AVANZA` con un número); avanza por acción del jugador, no por temporizador; no bloquea editor ni controles; al primer acierto cede a la celebración y marca la guía completada
  - En `guia.test.ts`: la secuencia avanza por acción; publica en la región `aria-live`; al primer acierto marca completada; no se reinicia sola
  - _Requisitos: 10.1, 10.2, 10.3, 10.4, 10.6, 10.7_

- [ ] 15. Orquestación de la navegación en `main.ts`
  - Extender `main.ts` para manejar los cinco niveles: arrancar en el `ultimoReto` desbloqueado o el primer nivel jugable; `cambiarANivel(idNivel, semilla?)` que verifica desbloqueo (si no, avisa por el globo y no entra), resuelve el reto, redibuja la referencia, reinicia el intento y actualiza panel de semilla, pistas rellenadas y selector; tras aprobar, guardar con `conteoJugador`, recalcular desbloqueo e insignias y ofrecer avanzar sin forzar; instanciar y arrancar la guía solo en `0.1` con `guiaCompletada()` falso; comunicar la insignia _Secuencia_ por el globo al completarse
  - Cablear los nuevos módulos de `ui/` por callbacks explícitos, sin que se hablen entre sí
  - En `main.test.ts` (jsdom): navegación entre niveles respeta el desbloqueo; un intento aprobado desbloquea el siguiente; la guía solo aparece en `0.1` la primera vez; completar las 15 estrellas anuncia la insignia
  - _Requisitos: 5, 7.4, 8.3, 10.5, 12.2, 12.3, 13.7_

- [ ] 16. Transversales: dependencias, build y steering
  - Extender la prueba de dirección de dependencias para cubrir los módulos nuevos: `niveles/generadores/*` no importan de `motor/`, `juego/` ni `ui/`; `juego/desbloqueo.ts` e `insignias.ts` no importan de `ui/`
  - Verificar `npm test`, `npm run typecheck` y `npm run build` en verde, y que el juego queda jugable con los cinco niveles navegables
  - Actualizar `.kiro/steering/niveles-y-progresion.md` con los rangos y ángulos verificados (camino largo 80–160 giros 90°, zigzag largo 60–120 giros **90°** en vez de 45°), señalando que salen de medir figuras reales contra la regla de caja ≥ 200
  - _Requisitos: 13.1, 13.2, 13.3, 13.4, 13.6, 13.7, 3.2, 4.2_
```
