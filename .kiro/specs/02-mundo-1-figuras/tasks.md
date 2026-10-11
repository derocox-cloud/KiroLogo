# Implementation Plan

**KiroLogo · Spec 02 · Mundo 1 · Figuras geométricas**

## Tasks

- [x] 1. Agregar soporte de `REPITE` en el lenguaje

  Ampliar la capa de lenguaje para reconocer, parsear, ejecutar y contar `REPITE`.
  No hay cambios de interfaz pública: se extienden los módulos existentes.

  - [x] 1.1 AST — añadir `NodoRepite` a `src/lenguaje/ast.ts`
    - Definir la interfaz `NodoRepite` con campos `tipo: 'repite'`, `veces: number`,
      `cuerpo: Instruccion[]`, y `lineaFuente?: number`.
    - Ampliar el tipo unión `Instruccion` para incluir `NodoRepite`.
    - Verificar que el resto del código que itera `Instruccion` compile sin errores (puede requerir
      un caso `default` o `never` en los switches existentes).

  - [x] 1.2 Lexer — tokens de corchete y número de línea en `src/lenguaje/lexer.ts`
    - Si los tokens `BRACKET_ABRE` (`[`) y `BRACKET_CIERRA` (`]`) no existen, añadirlos al enum de
      tipos de token.
    - Asegurar que cada token tenga la propiedad `linea: number` inicializada correctamente al
      tokenizar.
    - Añadir tests en `src/lenguaje/lexer.test.ts`:
      - `[` produce token `BRACKET_ABRE` con `linea` correcta.
      - `]` produce token `BRACKET_CIERRA` con `linea` correcta.
      - Token en segunda línea tiene `linea === 2`.

  - [x] 1.3 Parser — parsear `REPITE` en `src/lenguaje/parser.ts`
    - Añadir método `parsearRepite()` que consume `REPITE|RP`, número, `[`, lista de instrucciones,
      `]`, y devuelve `NodoRepite`.
    - `parsearListaInstrucciones()` llama a `parsearInstruccion()` en bucle hasta `BRACKET_CIERRA`
      o fin de entrada; si llega EOF sin `]`, lanza `errorCorcheteNoAbierto(lineaApertura)`.
    - Al encontrar `BRACKET_CIERRA` fuera de contexto de lista, lanzar
      `errorCorcheteSobrante(token.linea)`.
    - Mantener una pila interna de líneas de apertura de corchete para señalar el interior correcto
      en caso de anidación rota.
    - Añadir tests en `src/lenguaje/parser.test.ts`:
      - `REPITE 4 [AV 100 GD 90]` → `NodoRepite` con `veces=4`, `cuerpo` de 2 instrucciones.
      - `RP 3 [GD 120 AV 80]` → idéntico resultado (alias funciona).
      - `REPITE 2 [REPITE 3 [AV 50 GD 120]]` → `NodoRepite` anidado correcto.
      - `REPITE 4 [AV 100 GD 90` sin `]` → error con línea 1.
      - `AV 100 GD 90]` con `]` sobrante → error con línea correcta.

  - [x] 1.4 Intérprete — ejecutar `NodoRepite` en `src/lenguaje/interprete.ts`
    - Añadir caso `'repite'` en el switch del intérprete generador: iterar `nodo.veces` veces y
      hacer `yield*` de `ejecutarLista(nodo.cuerpo, estado)`.
    - `ejecutarLista` es la misma función recursiva que recorre el programa raíz; no se necesita
      código nuevo si ya existe, solo invocarla.
    - Añadir tests en `src/lenguaje/interprete.test.ts`:
      - `REPITE 4 [AV 100 GD 90]` produce las mismas operaciones que el cuadrado a mano (8 ops).
      - `REPITE 0 [AV 100]` no produce operaciones.
      - `REPITE 2 [REPITE 3 [AV 50 GD 60]]` produce 12 operaciones en el orden correcto.

  - [x] 1.5 Conteo — regla para `NodoRepite` en `src/lenguaje/conteo.ts`
    - Añadir caso `'repite'`: devolver `1 + contarLista(nodo.cuerpo)` sin multiplicar por `veces`.
    - Añadir tests en `src/lenguaje/conteo.test.ts`:
      - `REPITE 4 [AV 100 GD 90]` → 3.
      - `REPITE 36 [REPITE 4 [AV 100 GD 90] GD 10]` → 5.
      - `REPITE 360 [AV 2 GD 1]` → 3.

  - [x] 1.6 Errores — mensajes de corchete en `src/lenguaje/errores.ts`
    - Añadir función `errorCorcheteNoAbierto(linea: number)` con mensaje
      `Falta cerrar el corchete que abriste en la línea ${linea}.`
    - Añadir función `errorCorcheteSobrante(linea: number)` con mensaje
      `Hay un corchete de cierre en la línea ${linea} que no abriste.`
    - Añadir tests en `src/lenguaje/errores.test.ts` que verifican que los mensajes tienen el
      número de línea correcto.

- [x] 2. Implementar los cinco niveles del mundo 1

  Crear el archivo `src/niveles/mundo-1-figuras.ts` con los dos niveles autorados y los tres
  generadores, y registrarlo en el catálogo.

  - [x] 2.1 Niveles autorados 1.1 y 1.4
    - Definir `nivel_1_1` con `programaReferencia: 'REPITE 4 [AV 100 GD 90]'`,
      `estrellaAbstraccion: { tipo: 'usaRepite' }`, tres pistas y normalización libre.
    - Definir `nivel_1_4` con `programaReferencia: 'REPITE 360 [AV 2 GD 1]'`,
      `estrellaAbstraccion: { tipo: 'usaRepite' }`, tres pistas y normalización libre.
    - Verificar en test que `contarInstrucciones(parsear(nivel_1_1.programaReferencia)) === 3`
      y lo mismo para 1.4.

  - [x] 2.2 Generador 1.2 — polígono regular GD
    - Implementar `generador_1_2(semilla)` con `n` ∈ {3,4,5,6,8} (excluir 7) y `L` múltiplo de 20
      entre 60 y 140.
    - El ángulo es `360/n` en entero exacto para todos los `n` permitidos.
    - Si la figura no encuadra, reintentar con `semilla + 1`.
    - Test de propiedad: 200 semillas, todas encuadran y aprueban las tres estrellas.

  - [x] 2.3 Generador 1.3 — polígono regular GI
    - Igual que 1.2 pero usando `GI` en lugar de `GD`.
    - Mismo test de propiedad sobre 200 semillas.

  - [x] 2.4 Generador 1.5 — arco
    - Implementar `generador_1_5(semilla)` con `n` ∈ {4,5,6,7,8}, `k` ∈ [2, n-1], `L` igual que
      los otros generadores.
    - Verificar que la figura no es degenerada (más de un segmento visible).
    - Test de propiedad: 200 semillas, todas encuadran y aprueban las tres estrellas.

  - [x] 2.5 Registrar mundo 1 en el catálogo
    - En `src/niveles/catalogo.ts`, importar los cinco niveles del mundo 1 y añadir la entrada del
      mundo con `id: 1`, `nombre: 'Figuras geométricas'`, `insignia: 'Iteración'`.
    - Añadir test en `src/niveles/catalogo.test.ts` que verifica que el mundo 1 tiene cinco niveles
      y que el nivel 1.1 tiene `presupuestoEstrella === 3` (calculado, no hardcoded).

  - [x] 2.6 Mensaje de estrella de abstracción para el nivel 1.1
    - En el módulo de evaluación de estrellas, cuando el nivel tiene `usaRepite` y el AST del
      jugador no contiene ningún `NodoRepite`, producir el mensaje:
      *"Lo conseguiste. Pero dibujaste los cuatro lados uno a uno: yo los vi llegar de la misma
      forma, cuatro veces. ¿Puedes enseñarme a repetir con REPITE?"*
    - Test: un programa de cuadrado a mano (`AV 100 GD 90 AV 100 GD 90 ...`) en el nivel 1.1 no
      obtiene la estrella de abstracción y produce ese mensaje.

- [x] 3. Implementar la reproducción en paralelo

  Completar `src/motor/doble-dibujo.ts` con la comparación operación a operación y los mensajes
  de divergencia.

  - [x] 3.1 Algoritmo de comparación en `src/motor/doble-dibujo.ts`
    - Implementar `ejecutarEnParalelo(programaKiro, programaJugador)` que:
      1. Obtiene `opsKiro` y `opsJugador` ejecutando el intérprete en modo batch.
      2. Recorre las dos listas en paralelo hasta la longitud mínima.
      3. Devuelve `{ divergencia, excesoDespuesDeIgual, programaCortoSeLlamo }`.
    - Función `divergen(a, b)` compara posición acumulada (tolerancia 8 px) o ángulo acumulado
      (tolerancia 1°) según el tipo de operación.

  - [x] 3.2 Mensajes de divergencia
    - Cuando hay divergencia en un giro: *"hasta aquí íbamos igual; en este giro yo doblé N grados
      y tú M."*
    - Cuando hay divergencia en un avance: *"hasta aquí íbamos igual; en este paso yo avancé N y
      tú M."*
    - Cuando el programa del jugador es más corto: *"tu programa terminó aquí, pero todavía faltaban
      pasos."*
    - Cuando los programas son iguales pero hay exceso de trazo: *"llegaste al mismo lugar que yo;
      el problema es que dibujaste de más al final."*

  - [x] 3.3 Tests del doble dibujo en `src/motor/doble-dibujo.test.ts`
    - Programas idénticos → `divergencia: null`, `programaCortoSeLlamo: null`.
    - Pentágono con giro de 72° vs. giro de 90°: diverge en el primer giro (índice 1), Kiro=72,
      jugador=90.
    - Cuadrado a mano vs. `REPITE 4 [AV 100 GD 90]` → sin divergencia (equivalentes).
    - Programa más corto (jugador) → `programaCortoSeLlamo: 'jugador'`.
    - Programa más corto (Kiro, caso extremo) → `programaCortoSeLlamo: 'kiro'`.

  - [x] 3.4 Integrar la reproducción en paralelo en la UI
    - En el componente de ejecución, al terminar la animación del programa del jugador, si no se
      aprueba la precisión, invocar `ejecutarEnParalelo` y mostrar el mensaje resultante bajo el
      lienzo.
    - Las dos tortugas se renderizan simultáneamente durante la reproducción: tortuga de Kiro en su
      color habitual, tortuga del jugador en un color diferenciado (naranja o similar), ambas sobre
      la misma cuadrícula.

- [x] 4. Bloqueo de `REPITE` en el mundo 0

  Verificar que `REPITE` produce el error de vocabulario bloqueado cuando el jugador está en el
  mundo 0, y que se desbloquea al entrar al mundo 1.

  - [x] 4.1 Test de vocabulario bloqueado
    - Añadir test en `src/lenguaje/vocabulario.test.ts` que verifica que intentar usar `REPITE`
      en el mundo 0 produce el mensaje `REPITE todavía no está disponible. Se desbloquea en el
      mundo 1.`
    - Verificar que la comprobación ocurre antes del parsing (en la validación del vocabulario
      desbloqueado) y no lanza un error de parser genérico.

  - [x] 4.2 Panel lateral — mostrar `REPITE` al entrar al mundo 1
    - Verificar que el componente de vocabulario disponible incluye `REPITE` con descripción y
      ejemplo cuando el mundo activo es 1 o superior.
    - Test de snapshot o test de comportamiento del componente.

- [x] 5. Insignia Iteración

  Registrar la insignia del mundo 1 y conectarla al sistema de progreso existente.

  - [x] 5.1 Registrar la insignia
    - En `src/juego/estrellas.ts` (o donde vivan las insignias), registrar `{ id: 'iteracion',
      nombre: 'Iteración', mundo: 1 }`.
    - La condición de otorgamiento es: las tres estrellas en los cinco niveles del mundo 1.

  - [x] 5.2 Test de la insignia
    - Simular el estado de juego con las tres estrellas en 1.1–1.5 y verificar que
      `evaluarInsignia('iteracion', estado)` devuelve `true`.
    - Simular estado con solo dos estrellas en un nivel y verificar que devuelve `false`.

- [x] 6. Verificación integral

  Correr la suite completa, revisar que todos los criterios de aceptación del documento de
  requisitos se cumplen, y confirmar que la spec 00 (mundo 0) no se rompe.

  - [x] 6.1 Ejecutar `npm test` y confirmar que todos los tests pasan sin regresiones.
  - [x] 6.2 Verificar manualmente en el navegador:
    - `REPITE 4 [AV 100 GD 90]` dibuja un cuadrado y el contador muestra 3.
    - El nivel 1.1 niega la abstracción al resolver a mano y muestra el mensaje de invitación.
    - La reproducción en paralelo muestra el punto de divergencia en el pentágono con giros de 90°.
    - Un corchete sin cerrar muestra el número de línea correcto.
  - [x] 6.3 Correr los tests de propiedad de los generadores sobre 200 semillas cada uno.
