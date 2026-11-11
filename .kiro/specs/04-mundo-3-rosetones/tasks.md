# Implementation Plan

**KiroLogo · Spec 04 · Mundo 3 · Rosetones**

## Overview

El trabajo es **activar y extender**, no rediseñar. El límite duro ya se calcula en `reto.ts`, la
normalización fija ya la soporta el validador, `usaRepiteAnidado` ya existe en `abstraccion.ts` y las
insignias de concepto ya se derivan del progreso. Esta spec consume ese andamiaje y agrega: el
bloqueo por límite duro en el camino de ejecución, el aviso anticipado del editor, los cuatro niveles
del mundo 3 con sus dos generadores, el desafío infinito y las insignias nuevas. No se toca el lexer
ni el parser (R10.1), ni la forma del AST, la pila del intérprete, la regla de conteo ni el algoritmo
del validador. Los mundos 0 a 2 quedan idénticos (R10.3).

Se construye de abajo hacia arriba: primero el mensaje y la guarda, luego el aviso del editor, después
los generadores y los niveles, el registro y el catálogo, el desafío infinito y por último las
insignias y la verificación integral.

## Tasks

- [x] 1. Mensaje de bloqueo por límite excedido — `src/lenguaje/errores.ts` (AMPLIAR)

  El mensaje vive en el catálogo de errores, única fuente del texto (R2.4). Es la base del bloqueo:
  tanto la guarda de `main.ts` como el aviso del editor dependen de él, así que se construye primero.

  - [x] 1.1 Nuevo `IdError` `limiteDuroExcedido` con su mensaje exacto
    - Añadir `'limiteDuroExcedido'` a `IdError` y a `ParametrosPorError` con
      `{ readonly usadas: number; readonly limite: number }`.
    - Severidad `'jugador'`. El texto nombra `N` (usadas), `M` (límite) y la diferencia `N − M`
      calculada al construir el mensaje (no se pasa como parámetro), y sugiere poner un `REPITE`
      dentro de otro `REPITE` (R2.1, R2.2).
    - El texto NO menciona la figura, el programa de referencia, la palabra «presupuesto» ni el valor
      de `presupuestoEstrella` (R2.3).
    - `crearError('limiteDuroExcedido', { usadas, limite })` valida que ambos sean enteros y
      `usadas > limite`; si no, `solicitudDeErrorInvalida`, como el resto del catálogo.
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x]* 1.2 Tests del mensaje en `src/lenguaje/errores.test.ts`
    - **Property 3: El mensaje de bloqueo nombra la cuenta, empuja a anidar y no revela el presupuesto**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - `limiteDuroExcedido({ usadas: 8, limite: 5 })` produce un mensaje que contiene `8`, `5` y `3`,
      menciona `REPITE` y no contiene «presupuesto».
    - Parámetros inválidos (`usadas ≤ limite`, no enteros) caen en `solicitudDeErrorInvalida`.

- [x] 2. Guarda de límite duro — `src/main.ts` `ejecutarPrograma` (AMPLIAR)

  Guarda previa a la ejecución: corta antes de ceder la demostración, reiniciar la capa del jugador,
  ejecutar el intérprete y cargar el animador, de modo que un programa bloqueado deja el intento como
  estaba y no emite ninguna operación de tortuga.

  - [x] 2.1 Insertar la guarda antes de animar
    - Tras obtener `programa` válido y antes de `ejecutando = true`,
      `controles.marcarEjecucionEnCurso()`, `demostracion.cederAEjecucion()` y
      `animador.reiniciar(...)`: si `reto.limiteDuroActivo`, contar con
      `contarInstrucciones(programa)` (el mismo conteo del editor y la economía) y, si
      `c.exito && c.instrucciones > reto.limiteDuro`, mostrar
      `crearError('limiteDuroExcedido', { usadas: c.instrucciones, limite: reto.limiteDuro })` en el
      globo y `return` sin tocar la capa del jugador ni emitir operaciones (R1.3).
    - Un conteo `≤ limiteDuro`, o `limiteDuroActivo` falso, pasa de largo y ejecuta como hoy
      (R1.4, R1.6, R1.7).
    - _Requirements: 1.3, 1.4, 1.6, 1.7_

  - [x]* 2.2 Tests de la guarda en `src/main.test.ts`
    - **Property 1: La guarda de límite duro ejecuta si y solo si el conteo cabe**
    - **Validates: Requirements 1.3, 1.4, 1.6, 1.7**
    - Con un reto del mundo 3 (`limiteDuroActivo`), un programa cuyo conteo supera `limiteDuro` no
      emite ninguna operación de tortuga, no cede la demostración ni reinicia la capa del jugador, y
      muestra `limiteDuroExcedido` (R1.3).
    - Un programa con conteo ≤ `limiteDuro` ejecuta normal (R1.4); uno con conteo igual a
      `presupuestoEstrella` ejecuta (R1.6); un rodeo equivalente con conteo `presupuesto + k`, `k ≤ 3`,
      ejecuta por caber en el límite (R1.7).

  - [x]* 2.3 Test de no-regresión de los mundos 0–2 en `src/main.test.ts`
    - **Property 2: En los mundos 0 a 2 el exceso de presupuesto ejecuta sin economía**
    - **Validates: Requirements 1.5, 10.3**
    - Con un reto de mundo 0–2 (`limiteDuroActivo` falso), un programa cuyo conteo supera
      `presupuestoEstrella` ejecuta, produce operaciones y no gana la estrella de economía (R1.5, R10.3).

- [x] 3. Aviso anticipado de bloqueo en el contador — `src/ui/editor.ts` (AMPLIAR)

  El contador ya marca el exceso de presupuesto; aquí anticipa el bloqueo por límite duro, por texto y
  en el nombre accesible, no solo por color.

  - [x] 3.1 Recibir el límite duro y señalar el bloqueo
    - Añadir `limiteDuro: number` y `limiteDuroActivo: boolean` a `DependenciasEditor` (y a
      `presentarReto`, o guardarlos mutables como ya se hace con `presupuesto`).
    - En `actualizarContador`, además del aviso de presupuesto existente, añadir el aviso de bloqueo
      cuando `limiteDuroActivo && estado.conteo > limiteDuro`: un `span` con texto en español («Este
      programa no se podrá ejecutar: pasa del límite») y una clase para el estilo, incorporando la
      misma frase al `aria-label` (R2.5).
    - Mientras el conteo sea ≤ límite, no aparece el aviso de bloqueo (R2.6). El aviso es independiente
      del de presupuesto: un conteo entre `presupuesto + 1` y `limiteDuro` muestra «te pasaste del
      presupuesto» pero no el de bloqueo.
    - _Requirements: 2.5, 2.6_

  - [x]* 3.2 Tests del aviso en `src/ui/editor.test.ts`
    - **Property 4: El contador del editor señala bloqueo si y solo si el conteo supera el límite activo**
    - **Validates: Requirements 2.5, 2.6**
    - Con `limiteDuroActivo` y conteo > `limiteDuro`, el contador muestra el aviso de bloqueo por texto
      y el `aria-label` lo nombra (R2.5); con conteo ≤ `limiteDuro`, no hay aviso de bloqueo (R2.6);
      con `limiteDuroActivo` falso, nunca hay aviso de bloqueo.

- [x] 4. Generadores del mundo 3 — `src/niveles/generadores/rosetón.ts` y `flor.ts` (NUEVOS)

  Dos `Generador` del contrato de `tipos.ts` (`(entrada: EntradaGenerador) => ResultadoGeneracion`),
  que solo importan de `lenguaje/` y `azar/`. Producen AST: construyen el texto KiroLogo, lo parsean
  con `{ mundo: 3 }` y devuelven el `Programa`. Miden la caja con su propia aritmética de polígono
  (como `anchoPoligono` en los generadores del mundo 2), sin importar de `motor/`.

  - [x] 4.1 Generador `roseton-m3` (nivel 3.2)
    - Forma `REPITE c [REPITE n [AV L GD 360/n] GD 360/c]`: un `REPITE` de copias que contiene el
      `REPITE` de la figura interna y el giro entre copias (R5.2).
    - `c ∈ {6, 8, 9, 12, 18, 36}` (copias) vía `prng.elegir`; `n ∈ {3, 4, 5, 6}` (lados) vía
      `prng.elegir`; `360/n` entero (120, 90, 72, 60) y `360/c` entero (60, 45, 40, 30, 20, 10):
      ángulos derivables (R5.1, R5.4). `L` múltiplo de 20 vía `prng.multiplo`, en rango acotado para
      encuadrar (R5.4).
    - El AST tiene `REPITE` anidado, de modo que su referencia gana `usaRepiteAnidado` (R5.8).
    - _Requirements: 5.1, 5.2, 5.4, 5.8_

  - [x] 4.2 Generador `flor-m3` (nivel 3.3)
    - Forma exacta `REPITE c [REPITE n [GD a AV L] GD 360/c]`: un giro previo al avance en cada pétalo
      (R5.3).
    - `c` (pétalos) de un conjunto cuyo `360/c` sea entero; `n` segmentos por pétalo; `a` ángulo
      derivable (`360/k` con `k` de 3 a 12, o múltiplo de 15); `L` múltiplo de 20 (R5.4). AST anidado
      (R5.8).
    - _Requirements: 5.3, 5.4, 5.8_

  - [x] 4.3 Lazo de reintento, encuadre y no degeneración (los dos)
    - Dentro de `entrada.intentosMaximos`, con `prng = crearPrng(entrada.semilla + intento)`: elegir
      parámetros, construir y parsear el texto, medir la caja envolvente alineada a los ejes sobre el
      recorrido calculado.
    - Descartar la semilla y probar la siguiente si la figura es degenerada (ancho o alto < 200 px,
      R5.6) o no encuadra (caja fuera de `[−400, 400]` en cualquier eje, R5.7).
    - Al aceptar, devolver `{ exito: true, referencia, semillaEfectiva: entrada.semilla + intento,
      descartes }`. Al agotar intentos,
      `{ exito: false, error: crearError('generadorSinCandidato', {}), intentos }`.
    - El presupuesto lo calcula `resolverReto` por el Conteo sobre la `referencia`, nunca el generador
      (R5.5).
    - _Requirements: 5.5, 5.6, 5.7_

  - [x]* 4.4 Tests de propiedad de `roseton-m3` en `src/niveles/generadores/rosetón.test.ts`
    - **Property 7: Toda referencia del mundo 3 aprueba su propio nivel con las tres estrellas**
    - **Property 8: El reto generado aceptado encuadra y no degenera**
    - **Property 9: Los generadores emiten solo números adivinables**
    - **Property 10: La forma del rosetón generado es un REPITE anidado con giro entre copias**
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.6, 5.7, 5.9**
    - Sobre 200 semillas consecutivas (`intentosMaximos: 200`): todas tienen `exito`, encuadran y no
      degeneran, usan solo longitudes múltiplos de 20 y ángulos derivables, tienen la forma
      `REPITE c [REPITE n [...] GD 360/c]` con `c ∈ {6,8,9,12,18,36}` y `n ∈ 3..6`, y su referencia
      gana las tres estrellas (precisión, economía y `usaRepiteAnidado`) contra el nivel 3.2.

  - [x]* 4.5 Tests de propiedad de `flor-m3` en `src/niveles/generadores/flor.test.ts`
    - **Property 7: Toda referencia del mundo 3 aprueba su propio nivel con las tres estrellas**
    - **Property 8: El reto generado aceptado encuadra y no degenera**
    - **Property 9: Los generadores emiten solo números adivinables**
    - **Property 11: La forma de la flor generada es la plantilla con giro previo al avance**
    - **Validates: Requirements 5.3, 5.4, 5.6, 5.7, 5.9**
    - Sobre 200 semillas consecutivas: todas tienen `exito`, encuadran y no degeneran, usan solo
      números adivinables, tienen la forma `REPITE c [REPITE n [GD a AV L] GD 360/c]`, y su referencia
      gana las tres estrellas contra el nivel 3.3.

- [x] 5. Registrar los generadores — `src/niveles/generadores/registro.ts` (AMPLIAR)

  Incorporar las dos entradas al registro que `reto.ts` consulta vía `buscarGenerador`.

  - [x] 5.1 Añadir `roseton-m3` y `flor-m3` al registro
    - `import { generarRoseton } from './rosetón.js';` e `import { generarFlor } from './flor.js';`.
    - Añadir `'roseton-m3': generarRoseton` y `'flor-m3': generarFlor` al record `GENERADORES`, sin
      alterar las entradas existentes.
    - _Requirements: 5.1, 5.3_

- [x] 6. Niveles del mundo 3 — `src/niveles/mundo-3-rosetones.ts` (NUEVO)

  Mismo molde que `mundo-2-composicion.ts`: `parsearReferencia(texto)` con `{ mundo: 3 }` para los
  autorados, semillas fijas, y el array `MUNDO_3`. La diferencia de datos es la normalización fija y
  la exigencia de abstracción `usaRepiteAnidado`. Ningún nivel escribe un número de presupuesto: lo
  calcula `resolverReto` por el Conteo (R4.2, R4.6, R5.5).

  - [x] 6.1 Referencias autoradas y normalización
    - `REFERENCIA_3_1 = parsearReferencia('REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]')` (rosetón de 36
      cuadrados, R4.1).
    - `REFERENCIA_3_4 = parsearReferencia('REPITE 8 [GD 45 REPITE 6 [REPITE 90 [AV 2 GD 2] GD 90]]')`
      (mandala, R4.3). Sus ≈ 4320 avances quedan muy por debajo de la guarda de 200 000 pasos (R4.4).
    - `NORMALIZACION_M3: NormalizacionNivel = { traslacion: 'fija', rotacion: 'fija', escala: 'exacta' }`
      (R3.5).
    - _Requirements: 4.1, 4.3, 3.5_

  - [x] 6.2 Declarar los cuatro niveles y exportar `MUNDO_3`
    - `NIVEL_3_1` (autorado, `REFERENCIA_3_1`, semilla 301) y `NIVEL_3_4` (autorado, `REFERENCIA_3_4`,
      semilla 304); `NIVEL_3_2` (generado `roseton-m3`) y `NIVEL_3_3` (generado `flor-m3`).
    - Los cuatro con `mundo: 3`, `concepto: 'simetria'`, `normalizacion: NORMALIZACION_M3`,
      `abstraccion: [{ clave: 'usaRepiteAnidado' }]` (R4.5, R5.8, R6.1) y `margenLimiteDuro` omitido
      (rige el margen por omisión, 3).
    - Pistas conceptual/matemática/esqueleto cuyo enunciado advierte que la posición y el rumbo de
      partida importan para aprobar (R3.6).
    - `export const MUNDO_3: readonly Nivel[] = [NIVEL_3_1, NIVEL_3_2, NIVEL_3_3, NIVEL_3_4];`.
    - _Requirements: 3.5, 3.6, 4.5, 5.8, 6.1_

  - [x]* 6.3 Tests de niveles autorados en `src/niveles/mundo-3-rosetones.test.ts`
    - **Property 6: El presupuesto de todo nivel del mundo 3 es el conteo de su referencia**
    - **Validates: Requirements 4.2, 4.6**
    - 3.1 y 3.4 parsean sin error; su `presupuestoEstrella` sale de `contarInstrucciones` sobre su
      referencia, sin número a mano (R4.2, R4.6).
    - La referencia de 3.4 se ejecuta hasta el final sin activar la guarda de 200 000 pasos (R4.4).
    - Los cuatro niveles declaran `normalizacion` fija (R3.5) y `usaRepiteAnidado` (R4.5, R6.1).

  - [x]* 6.4 Test de abstracción anidada en `src/juego/abstraccion.test.ts`
    - **Property 12: La estrella de abstracción se otorga si y solo si hay REPITE anidado, analizando el AST**
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - Un AST con `REPITE` dentro de `REPITE` cumple `usaRepiteAnidado`; una lista plana de `REPITE`
      consecutivos no lo cumple; dos textos distintos con el mismo AST obtienen el mismo veredicto
      (se analiza el AST, no el texto).

  - [x]* 6.5 Test de normalización fija en `src/motor/validador.test.ts`
    - **Property 5: La normalización fija niega la precisión a una figura trasladada o rotada**
    - **Validates: Requirements 3.3, 3.4**
    - Una figura correcta pero trasladada, y otra rotada, con `Normalizacion_Fija`, no alcanzan el IoU
      mínimo y niegan la precisión (R3.3, R3.4); la tolerancia de dilatación es la misma que la de los
      mundos 0–2 (R3.2).

- [x] 7. Registrar el mundo 3 en el catálogo — `src/niveles/catalogo.ts` (AMPLIAR)

  Incorporar los cuatro niveles al registro que resuelve `reto.ts`.

  - [x] 7.1 Añadir `MUNDO_3` al catálogo
    - `import { MUNDO_3 } from './mundo-3-rosetones.js';` y
      `CATALOGO = [...MUNDO_0, ...MUNDO_1, ...MUNDO_2, ...MUNDO_3]`.
    - `mundos.ts` ya declara el mundo 3 («Rosetones», insignia «Simetría»): no se toca.
    - _Requirements: 10.5_

  - [x]* 7.2 Test del catálogo en `src/niveles/catalogo.test.ts`
    - El mundo 3 tiene cuatro niveles (3.1–3.4) con `insignia: 'Simetría'` y `concepto: 'simetria'`.
    - Los cuatro declaran `normalizacion` fija y `usaRepiteAnidado`.
    - El `presupuestoEstrella` de un nivel autorado es el del Conteo, no un valor a mano.

- [x] 8. Checkpoint — Asegurar que la capa de lenguaje, niveles y generadores pasan

  Ejecutar los tests de errores, main, editor, generadores, niveles y catálogo antes del desafío
  infinito y las insignias.

  - [x] 8.1 Correr `npm test` y confirmar que pasan sin regresiones; ante dudas, preguntar al usuario.

- [x] 9. Desafío infinito — `src/juego/desafio-infinito.ts` (NUEVO)

  Módulo puro de `juego/` (importa de `niveles/` catálogo, `azar/` PRNG y `juego/` desbloqueo). No
  persiste estado propio: recalcula el reto de `(mundo, raíz, índice)`.

  - [x] 9.1 Implementar el módulo
    - `nivelesGeneradosDelMundo(mundo)`: los niveles con `origen.tipo === 'generado'` del mundo, en el
      orden del catálogo.
    - `desafioDisponible(mundo, progreso)`: falso si el mundo no tiene generados (R7.8); si no,
      `mundoDesbloqueado((mundo + 1), progreso)` (mundo completo ⇒ siguiente abierto) (R7.1, R7.2).
    - `retoDesafio(mundo, raiz, indice): RetoDesafio`: `idNivel = generados[indice % generados.length]`
      (rota, R7.6) y `semilla = derivarSemilla(raiz, indice)` (R7.3). La API solo avanza con
      `indice + 1`; no ofrece retroceso (R7.5).
    - `derivarSemilla(raiz, indice)`: con `crearPrng(raiz)` avanza `indice + 1` pasos y mapea al
      dominio `[SEMILLA_MINIMA, SEMILLA_MAXIMA]`; determinista, nunca `Math.random` (R7.3, R7.4).
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x]* 9.2 Tests del desafío en `src/juego/desafio-infinito.test.ts`
    - **Property 13: El desafío infinito es determinista por su raíz**
    - **Property 14: La secuencia del desafío rota entre los niveles generados del mundo**
    - **Property 15: El desafío está disponible si y solo si el mundo está completo y tiene generados**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8**
    - `retoDesafio(m, raíz, i)` es determinista: misma terna ⇒ mismo `(idNivel, semilla)` (R7.4);
      recorrer `i = 0..k` rota entre los generados del mundo en orden del catálogo (R7.6); todo el azar
      pasa por `crearPrng`, ninguna ruta usa `Math.random` (R7.3).
    - `desafioDisponible` es falso en un mundo incompleto (R7.2) y en un mundo sin generados (R7.8), y
      verdadero en un mundo completo con generados (R7.1); mundos 0, 1, 2 y 3 son retroactivos (R7.7).

- [x] 10. Insignia de concepto Simetría — `src/juego/insignias.ts` (AMPLIAR)

  Entrada más del patrón de las insignias de concepto, derivada solo del progreso y el catálogo.

  - [x] 10.1 Registrar la insignia Simetría
    - Añadir `'simetria'` a `IdInsignia` y a `MUNDO_DE_INSIGNIA` (`simetria: 3`).
    - `insigniaSimetriaOtorgada(progreso)` delega en `mundoCompletoConTresEstrellas(3, progreso)`
      (R8.1, R8.2) e incluir la rama del mundo 3 en `insigniasDelMundo` para que devuelva `['simetria']`
      cuando corresponde.
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x]* 10.2 Tests de la insignia Simetría en `src/juego/insignias.test.ts`
    - **Property 16: La insignia Simetría se otorga si y solo si el mundo 3 tiene las tres estrellas**
    - **Validates: Requirements 8.1, 8.2**
    - Con las tres estrellas en los cuatro niveles del mundo 3 → otorgada (R8.1); con una estrella
      faltante en algún nivel → no otorgada (R8.2); volver a completar con la insignia ya otorgada la
      mantiene una sola vez (R8.3, R8.4).

- [x] 11. Insignias transversales y señales del progreso — `src/juego/progreso.ts` e
  `src/juego/insignias.ts` (AMPLIAR)

  Cuatro predicados puros sobre el progreso. *Minimalista* ya es calculable con las estrellas
  guardadas; las otras tres necesitan señales anónimas nuevas en el progreso (banderas y contadores
  por `idNivel`), mínimas y derivables, compatibles con el formato versión 2 y la migración existente.

  - [x] 11.1 Extender `progreso.ts` con las señales anónimas
    - Añadir las señales mínimas por `idNivel` que las reglas necesitan: haber usado la reproducción en
      paralelo y las aprobaciones posteriores (*Depurador*), si se abrió una pista en el nivel (*Sin
      pistas*), y cuántas veces se vio la demostración del intento (*Buen ojo*).
    - Conservar la lectura tolerante y la migración existentes; las señales encajan en el formato
      versión 2 sin romper progresos guardados.
    - _Requirements: 9.1, 9.3, 9.4, 9.6_

  - [x] 11.2 Implementar los cuatro predicados en `insignias.ts`
    - Añadir `'depurador'`, `'minimalista'`, `'sinPistas'`, `'buenOjo'` a `IdInsignia`.
    - `insigniaMinimalistaOtorgada(progreso)`: estrella de economía en 10 niveles (R9.2).
    - `insigniaDepuradorOtorgada(progreso)`: 5 niveles aprobados tras usar la reproducción en paralelo
      (R9.1).
    - `insigniaSinPistasOtorgada(progreso)`: completar un mundo sin abrir ninguna pista en sus niveles
      (R9.3).
    - `insigniaBuenOjoOtorgada(progreso)`: resolver un nivel con la demostración vista una sola vez
      (R9.4).
    - Cada una es un predicado puro sobre el progreso guardado, sin estado propio, de modo que se
      otorga exactamente una vez (R9.5, R9.6).
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x]* 11.3 Tests de las transversales en `src/juego/insignias.test.ts`
    - **Property 17: El otorgamiento de toda insignia es función pura e idempotente del progreso**
    - **Property 18: Cada insignia transversal se deriva de su señal en el progreso**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**
    - Cada transversal se otorga exactamente cuando su condición se cumple sobre el progreso guardado,
      y evaluarla dos veces sobre el mismo progreso da el mismo booleano, sin segunda instancia (R9.5,
      R9.6).

- [x] 12. Verificación integral y regresión

  Correr la suite completa y los tests de propiedad, y confirmar que los mundos 0 a 2 no cambian de
  comportamiento.

  - [x] 12.1 Ejecutar `npm run typecheck`, `npm run build` y `npm test -- --maxWorkers=2` en verde.

  - [x]* 12.2 Regresión del catálogo del mundo 3
    - La referencia de cada nivel del mundo 3 gana las tres estrellas contra su propio nivel: 3.1 y 3.4
      directamente; 3.2 y 3.3 sobre al menos 200 semillas consecutivas (R4.7, R5.9).
    - La referencia de 3.4 no activa la guarda de 200 000 pasos (R4.4).

  - [x]* 12.3 No-regresión de los mundos 0–2
    - Los retos de referencia de los mundos 0, 1 y 2 producen las mismas operaciones, presupuestos y
      estrellas que antes de esta spec (R10.3).

- [ ] 13. Sugerencia de bloqueo por mundo — `src/lenguaje/errores.ts` y `src/main.ts` (AMPLIAR)

  Fusiona R2.2 a R2.4 con R13 en una sola tabla del catálogo de errores. La tarea 1 dejó
  `limiteDuroExcedido` con una única sugerencia (anidar `REPITE`); aquí gana el parámetro `mundo`.

  - [ ] 13.1 Añadir `mundo` y la tabla `SUGERENCIA_DE_BLOQUEO_POR_MUNDO`
    - `ParametrosPorError['limiteDuroExcedido']` pasa a `{ usadas; limite; mundo }`, los tres enteros.
      `crearError` valida los tres y que `usadas > limite`; si no, `solicitudDeErrorInvalida`.
    - Tabla `Readonly<Record<number, string>>` con entradas para los mundos 3 (anidar `REPITE`), 4
      (parámetros) y 5 (recursión), y constante `MUNDO_DE_SUGERENCIA_POR_OMISION = 3` para todo mundo
      sin entrada (R13.1, R13.3).
    - El texto compone `N`, `M` y `N − M` (calculada al componer, no recibida) más la sugerencia del
      mundo (R2.1 a R2.4, R13.2). Nunca incluye `presupuestoEstrella`, la palabra «presupuesto» ni
      texto de la referencia (R2.5). Ningún otro módulo escribe estos textos (R2.6).
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 13.1, 13.2, 13.3_

  - [ ]* 13.2 Tests del mensaje por mundo en `src/lenguaje/errores.test.ts`
    - **Property 3: El mensaje de bloqueo nombra la cuenta y usa la sugerencia de su mundo**
    - **Property 4: El mensaje de bloqueo no revela la figura ni el presupuesto**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 13.1, 13.2, 13.3, 13.4, 13.5**
    - Para los mundos 3, 4 y 5 y pares `N > M` generados, el mensaje contiene `N`, `M`, `N − M` y la
      sugerencia de su mundo; un mundo sin entrada (por ejemplo 9) usa la del mundo 3.
    - El texto no contiene la palabra «presupuesto» ni el valor de `presupuestoEstrella` del nivel.
    - Parámetros inválidos (`usadas ≤ limite`, no enteros, `mundo` no entero) caen en
      `solicitudDeErrorInvalida`. Actualizar los tests de la tarea 1.2 a la nueva firma.
    - _Requirements: 2.1 a 2.5, 13.4, 13.5_

  - [ ] 13.3 Pasar el mundo desde la guarda de `src/main.ts`
    - En `ejecutarPrograma`, la llamada pasa a
      `crearError('limiteDuroExcedido', { usadas, limite: reto.limiteDuro, mundo: reto.nivel.mundo })`.
      La guarda sigue sin emitir operaciones ni tocar la capa del jugador.
    - _Requirements: 2.2, 2.3, 2.4, 13.2_

  - [ ]* 13.4 Test de la guarda por mundo en `src/main.test.ts`
    - Un programa bloqueado en un reto del mundo 3 muestra la sugerencia de anidar `REPITE`, y la
      llamada a `crearError` recibe el `mundo` del reto. Se conservan los tests de la tarea 2.2.
    - _Requirements: 1.3, 2.2, 13.2_

- [ ] 14. Cableado de las señales transversales y «Ver en paralelo» — `src/ui/` y `src/main.ts`

  Hallazgo del diseño: `marcarPistaAbierta`, `registrarVistaDemostracion` y
  `marcarReproduccionParalelaUsada` no se invocan desde ningún módulo de producción, así que
  *Depurador*, *Sin pistas* y *Buen ojo* no se pueden ganar jugando. Además la reproducción en
  paralelo no está montada en la pantalla: se añade el disparador.

  - [ ] 14.1 Callback opcional `alAbrirPista` en `src/ui/globo-kiro.ts`
    - `DependenciasGlobo` gana `readonly alAbrirPista?: () => void`, opcional para no romper las
      pruebas existentes.
    - Se invoca en `pedirPista` solo cuando se muestra un escalón, no con el aviso «Ya te di todas las
      pistas de este reto».
    - _Requirements: 11.1_

  - [ ] 14.2 Cablear pista y demostración en `src/main.ts`
    - Añadir `registrarSenal(escribir: () => void)`: ejecuta la escritura y, si lanza, hace
      `console.error('No se pudo registrar la señal de progreso.', e)` y continúa (R11.11).
    - Pasar al globo `alAbrirPista` que llama `registrarSenal(() =>
      progreso.marcarPistaAbierta(reto.nivel.id))`, leyendo `reto` en el momento de la llamada.
    - Centralizar en `lanzarDemostracion(modo: 'reproducir' | 'repetir')` la llamada a
      `Demostracion` seguida de `registrarSenal(() => progreso.registrarVistaDemostracion(reto.nivel.id))`,
      una vez por demostración lanzada. Usarla desde `montarReto` y desde «Volver a ver la
      demostración» (R11.2). La demostración inicial del nivel cuenta como una vista.
    - _Requirements: 11.1, 11.2, 11.11_

  - [ ] 14.3 Acción «Ver en paralelo» en `src/ui/controles.ts`
    - `AccionId` gana `'paralelo'` con texto «Ver en paralelo» y nombre accesible «Ver mi recorrido y
      el de Kiro en paralelo». `CallbacksControles` gana `verEnParalelo: () => void`.
    - Nace deshabilitada; se habilita cuando existe un intento ejecutado del reto en curso y se
      deshabilita mientras hay una ejecución en curso, igual que `demostracion`.
    - _Requirements: 11.3_

  - [ ] 14.4 Montar la reproducción en paralelo en `src/main.ts`
    - Instanciar `crearReproduccionParalelo` con sus dependencias ya declaradas (lienzo paralelo,
      reloj, temas, `movimientoReducido`, `anunciar`) y definir `verEnParalelo()`: sin
      `estadoApp.operacionesJugador` no hace nada; si hay intento, llama `registrarSenal(() =>
      progreso.marcarReproduccionParalelaUsada())` **al iniciar** y luego
      `reproduccionParalelo.reproducir(reto.operaciones, estadoApp.operacionesJugador, ESTADO_INICIAL)`.
    - Cablear `verEnParalelo` en los callbacks de los controles y habilitar la acción tras cada
      intento ejecutado. Sin cambios en `guardar`: el orden de las llamadas basta para R11.4.
    - _Requirements: 11.3, 11.4_

  - [ ]* 14.5 Tests unitarios de `globo-kiro.ts` y `controles.ts`
    - En `src/ui/globo-kiro.test.ts`: `alAbrirPista` se invoca al mostrar cada escalón y no con «Ya te
      di todas las pistas».
    - En `src/ui/controles.test.ts`: `paralelo` nace deshabilitada, se habilita con un intento, se
      deshabilita durante la ejecución, y activarla invoca `verEnParalelo`.
    - _Requirements: 11.1, 11.3_

  - [ ]* 14.6 Test de resiliencia ante fallo de persistencia
    - **Property 19: Un fallo al persistir una señal no interrumpe la acción del jugador**
    - **Validates: Requirements 11.11**
    - En `src/main.senales.test.ts`, con un `Progreso` cuyos métodos de señal lanzan, pedir pista, ver
      la demostración y pulsar «Ver en paralelo» completan su efecto visible y no propagan el error.
    - _Requirements: 11.11_

- [ ] 15. Tipos separados de las insignias — `src/juego/insignias.ts` (AMPLIAR)

  - [ ] 15.1 Separar concepto de transversal y eliminar el `as`
    - Declarar `IdInsigniaDeConcepto` (`secuencia`, `iteracion`, `descomposicion`, `simetria`),
      `IdInsigniaTransversal` (`depurador`, `minimalista`, `sinPistas`, `buenOjo`) e `IdInsignia` como
      su unión (R14.1).
    - `MUNDO_DE_INSIGNIA: Readonly<Record<IdInsigniaDeConcepto, number>>` (R14.2) y
      `INSIGNIAS_DE_CONCEPTO: readonly IdInsigniaDeConcepto[]`; consultar el mundo de una transversal
      no compila (R14.3).
    - `OTORGADA_DE_CONCEPTO: Record<IdInsigniaDeConcepto, (p: Progreso) => boolean>` reúne los cuatro
      predicados existentes. `insigniasDelMundo` recorre `INSIGNIAS_DE_CONCEPTO` sin `Object.keys` ni
      `as` (R14.4). Los resultados existentes no cambian (R14.5).
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 15.2 Predicado derivado `insigniasTransversalesOtorgadas`
    - `export function insigniasTransversalesOtorgadas(progreso: Progreso): readonly IdInsigniaTransversal[]`,
      función pura que reúne los cuatro predicados transversales. Permite verificar la insignia
      otorgada en las pruebas de punta a punta sin añadir estado.
    - _Requirements: 9.5, 9.6, 11.10_

  - [ ]* 15.3 Tests de tipos y de no regresión en `src/juego/insignias.test.ts`
    - Las claves de `MUNDO_DE_INSIGNIA` igualan `INSIGNIAS_DE_CONCEPTO`.
    - Una línea con `// @ts-expect-error` comprueba que `MUNDO_DE_INSIGNIA['depurador']` no compila.
    - Las pruebas existentes pasan sin cambios de resultado. `insigniasTransversalesOtorgadas` es
      determinista e idempotente.
    - **Property 16: El otorgamiento de toda insignia es función pura e idempotente del progreso**
    - **Property 17: Cada insignia transversal se deriva de su señal en el progreso**
    - **Validates: Requirements 8.3, 8.4, 9.1 a 9.6, 11.5 a 11.8, 14.2, 14.3, 14.5**
    - _Requirements: 9.5, 9.6, 14.2, 14.3, 14.5_

- [ ] 16. Control mínimo del desafío infinito — `src/ui/control-desafio.ts` y `src/main.ts`

  La lógica de `juego/desafio-infinito.ts` ya existe y no cambia; aquí se le da una pantalla.

  - [ ] 16.1 Crear `src/ui/control-desafio.ts`
    - Mismo molde que `panel-semilla.ts`. Exporta `CallbacksControlDesafio { iniciar; siguiente }` y
      `ControlDesafio { raiz; boton; presentar(estado) }` con los estados `oculto`, `disponible
      { mundo }` y `enCurso { mundo, codigoRaiz, puedeAvanzar }`.
    - `<button>` nativo operable con Enter y Espacio y alcanzable con `Tab` (R12.7). Nombre accesible
      en español: «Iniciar el desafío infinito del mundo N» / «Ir al siguiente reto del desafío
      infinito». Texto «Desafío infinito» / «Siguiente reto».
    - En curso muestra el código de la raíz; la interfaz no ofrece ningún control de retroceso (R12.5).
    - _Requirements: 12.1, 12.2, 12.5, 12.6, 12.7_

  - [ ] 16.2 Cablear el control en `src/main.ts`
    - Estado no persistente `desafio: { mundo; raiz; indice } | null`, que solo incrementa `indice`.
    - Tras cada intento y cada cambio de nivel, `presentar` según `desafioDisponible(reto.nivel.mundo,
      progreso)` (R12.1, R12.2).
    - `iniciar`: raíz con la misma entropía de arranque que «Otro reto» (sin `Math.random`), `indice =
      0`, `retoDesafio(mundo, raiz, 0)` y `cambiarANivel(idNivel, semilla)`; muestra `codificar(raiz)`
      (si devuelve error, omite el código y avisa con el catálogo) (R12.3, R12.6).
    - `siguiente`: habilitado solo si el reto en curso está aprobado con precisión; `indice += 1` y
      carga `retoDesafio(mundo, raiz, indice)` (R12.4).
    - El estado se descarta si el jugador cambia de nivel por otro camino (menú, otro reto, reproducir
      código); `cambiarANivel` recibe un indicador interno para distinguir la llamada del control.
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ]* 16.3 Tests de `src/ui/control-desafio.test.ts`
    - **Property 20: El control del desafío es visible si y solo si el desafío está disponible**
    - **Property 21: La raíz del desafío se comparte sin pérdida**
    - **Validates: Requirements 12.1, 12.2, 12.5, 12.6, 12.7**
    - Oculto / disponible / en curso; sin control de retroceso; operable con teclado; nombre accesible
      en español; `decodificar(codificar(raiz))` devuelve la misma raíz.
    - _Requirements: 12.1, 12.2, 12.5, 12.6, 12.7_

- [ ] 17. Pruebas de punta a punta de señales, insignias y desafío — `crearAplicacion`

  Con un almacén en memoria y `Progreso` recargado con `cargarProgreso(almacen)`.

  - [ ]* 17.1 Señales e insignias en `src/main.senales.test.ts`
    - **Property 18: Cada acción del jugador escribe su señal en el nivel correcto**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10**
    - Pedir pista → `pistaAbiertaEn(nivel)` verdadero solo para ese nivel (R11.1).
    - Lanzar la demostración → `vistasDemostracionDe(nivel)` crece en uno por demostración (R11.2).
    - Ejecutar y pulsar «Ver en paralelo» → `reproduccionParalelaUsada()` verdadero; un nivel aprobado
      después devuelve verdadero en `aprobadoTrasReproduccionParalelaEn` (R11.3, R11.4).
    - `insigniasTransversalesOtorgadas` incluye `depurador` tras aprobar 5 niveles posteriores,
      `sinPistas` al completar un mundo sin pistas (y no si hubo una), y `buenOjo` con una sola
      demostración vista (R11.5 a R11.8, R11.10).
    - _Requirements: 11.1 a 11.10_

  - [ ]* 17.2 Desafío infinito en `src/main.desafio.test.ts`
    - Completar un mundo con generados, activar el control y verificar que se carga un reto generado
      de ese mundo y que se muestra el código de la raíz (R12.8, R12.3, R12.6).
    - Con el mundo incompleto el control no se muestra (R12.2).
    - _Requirements: 12.2, 12.3, 12.6, 12.8_

- [ ] 18. Timeout compartido de las regresiones de tres estrellas

  - [ ] 18.1 Crear `src/pruebas/tiempos.ts` y unificar los usos
    - `export const TIMEOUT_TRES_ESTRELLAS = 180_000;` con su comentario del *por qué* (R15.1).
    - `src/juego/generadores-mundo-2.test.ts` borra su constante local e importa esta (R15.3).
    - `src/juego/reto.test.ts` sustituye los dos `120_000` de las regresiones 3.2 y 3.3 (líneas ~211
      y ~357) por la constante (R15.2). Los `120_000` de `camino`, `zigzag`, `validador` y `main` no se
      tocan: no son regresiones de tres estrellas de los mundos 2 y 3.
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ]* 18.2 Test de lectura del repositorio en `src/pruebas/tiempos.test.ts`
    - Falla si en las regresiones de 200 semillas de los mundos 2 y 3 aparece un literal de timeout
      distinto de `TIMEOUT_TRES_ESTRELLAS`, y comprueba que su valor es 180 000.
    - _Requirements: 15.1, 15.4_

- [ ] 19. Documentación de los métodos de señal

  - [ ] 19.1 Escribir `docs/senales-de-progreso.md` en español y enlazarlo desde `docs/README.md`
    - Tabla de los siete `Metodos_De_Senal` (`marcarPistaAbierta`, `pistaAbiertaEn`,
      `registrarVistaDemostracion`, `vistasDemostracionDe`, `marcarReproduccionParalelaUsada`,
      `reproduccionParalelaUsada`, `aprobadoTrasReproduccionParalelaEn`) con: señal que registra,
      quién la escribe, quién la lee, insignia que habilita y efecto sobre `localStorage` (R16.1,
      R16.3).
    - Indicar que `marcarReproduccionParalelaUsada` y `aprobadoTrasReproduccionParalelaEn` no
      retroceden una vez verdaderos (R16.3) y que las señales son anónimas y no registran datos
      personales (R16.2).
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [ ] 20. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 21. Verificación final y reglas duras
  - [ ] 21.1 Validar contra el estado real
    - Ejecutar en verde `npm ci`, `npm run typecheck`, `npm run build` y `npm test -- --maxWorkers=2`
      (R17.3).
    - Revisar por búsqueda en `src/`: sin `Math.random` fuera de `azar/prng.ts`, sin `eval` ni
      `new Function`, `base: '/'` intacto en `vite.config.ts`, sin alias en inglés en el dominio y
      sin dependencias nuevas sin fijar (R17.4).
    - _Requirements: 17.3, 17.4_

## Notes

- Las tareas 1 a 12 están completadas y no se reabren. Las tareas 13 a 21 cubren lo que los
  requisitos 2 y 11 a 17 actualizados añaden. Los números de propiedad citados en las tareas 1 a 12
  corresponden a la versión anterior del diseño; la numeración vigente es la de `design.md` y es la
  que usan las tareas 13 a 21.
- La tarea 13.1 modifica la firma de `limiteDuroExcedido`: los tests de la tarea 1.2 se actualizan,
  no se reabre la tarea.
- Los requisitos 17.1 y 17.2 (`git merge origin/main` sin rebase, PR con merge commit) son proceso del
  equipo, no código; la tarea 21.1 cubre la parte verificable (17.3 y 17.4).
- Las sub-tareas marcadas con `*` son opcionales (tests) y pueden saltarse para un MVP más rápido.
- Cada tarea referencia requisitos concretos para trazabilidad; las de prueba referencian además la
  propiedad de corrección que validan.
- El trabajo es activar y extender: `reto.ts`, el validador, `abstraccion.ts` y el patrón de insignias
  ya existen y no se tocan en su lógica. No se modifica el lexer ni el parser (R10.1).
- El presupuesto de todos los niveles sale del Conteo sobre la referencia, nunca escrito a mano.
- Todo el azar (generadores y desafío infinito) pasa por `crearPrng`; ninguna ruta usa `Math.random`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3"] },
    { "id": 4, "tasks": ["4.4", "4.5", "5.1"] },
    { "id": 5, "tasks": ["6.1"] },
    { "id": 6, "tasks": ["6.2"] },
    { "id": 7, "tasks": ["6.3", "6.4", "6.5", "7.1"] },
    { "id": 8, "tasks": ["7.2", "9.1"] },
    { "id": 9, "tasks": ["9.2", "10.1", "11.1"] },
    { "id": 10, "tasks": ["10.2", "11.2"] },
    { "id": 11, "tasks": ["11.3"] },
    { "id": 12, "tasks": ["12.1"] },
    { "id": 13, "tasks": ["12.2", "12.3"] },
    { "id": 14, "tasks": ["13.1", "14.1", "14.3", "15.1", "16.1", "18.1", "19.1"] },
    { "id": 15, "tasks": ["13.2", "13.3", "14.5", "15.2", "16.3", "18.2"] },
    { "id": 16, "tasks": ["13.4", "14.2", "15.3"] },
    { "id": 17, "tasks": ["14.4"] },
    { "id": 18, "tasks": ["16.2"] },
    { "id": 19, "tasks": ["17.1", "17.2"] },
    { "id": 20, "tasks": ["14.6"] },
    { "id": 21, "tasks": ["21.1"] }
  ]
}
```
