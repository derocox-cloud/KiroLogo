# Implementation Plan: poncolor-mensaje-error-incorrecto

## Overview

Plan en español para corregir los mensajes de error de `PONCOLOR` y de `PARA` (sin nombre, anidado y con
parámetros). Las pruebas exploratorias y de preservación se escriben primero; las exploratorias deben
fallar antes del arreglo. **Fuera de alcance:** el mensaje de `REPITE` y los mensajes del catálogo con
texto fijo (decisión del dueño en la reseña del PR #24).

El trabajo se entrega en el PR #24 en commits separados, uno por tema, todos con typecheck y pruebas en
verde antes de cada commit:

1. `fix(mundo-2): deriva del tipo de argumento los mensajes de PONCOLOR` (tareas 1 a 3.3).
2. `fix(mundo-2): ...` de `PARA` sin nombre, anidado y con parámetros (tareas 4 a 5).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3"] },
    { "id": 5, "tasks": ["5"] }
  ]
}
```

## Tasks

- [x] 1. Escribir la prueba exploratoria de `PONCOLOR`
  - **Property 1: Bug Condition** - Mensajes de argumento de `PONCOLOR`
  - Ubicación: `src/lenguaje/errores.test.ts`, `parser.test.ts` y `vocabulario.test.ts`, con `crearPrng` y semilla fija donde haga falta; sin `Math.random` ni dependencias nuevas
  - Casos:
    - `PONCOLOR` sin argumento: el mensaje no contiene "número", dice "color" y el ejemplo se analiza sin errores
    - `PONCOLOR 5`, `PONCOLOR [` y `PONCOLOR :largo`: el mensaje dice "color" y nombra la clase exacta (número, corchete, parámetro)
    - `PONCOLOR [255 "a 0]` y `PONCOLOR [255 0`: terna de tres números entre corchetes, ejemplo `PONCOLOR [255 0 0]`
    - Ejemplo del vocabulario: `PONCOLOR "rojo"` produce `comillaSinPalabra` (causa 6 del diseño)
    - Para todo comando de color del vocabulario, el mensaje habla de un color y usa su `ejemplo` (cubre a `RELLENA` cuando lleve argumento)
  - **RESULTADO**: la prueba FALLA sobre el código sin corregir (22 pruebas)
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 2. Escribir las pruebas de preservación (antes de implementar el arreglo)
  - **Property 2: Preservation** - Comandos numéricos, `REPITE`, `PONCOLOR` válido
  - Fijar, con valores escritos a mano:
    - Los cinco comandos numéricos: mensajes de faltante y de tipo equivocado idénticos a los de antes
    - `REPITE`: sus dos mensajes no cambian (fuera de alcance)
    - `PONCOLOR` válido (`"naranja`, `naranja`, `[255 0 0]`): sin errores de parseo
    - Un nombre de comando desconocido cae al texto numérico
    - `errores.ts` no importa `lexer`, `parser` ni `colores`; `vocabulario.ts` no importa `errores`, `lexer` ni `parser`
  - **RESULTADO**: las pruebas PASAN sobre el código sin corregir
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8_

- [x] 3. Arreglo de los mensajes de argumento no numéricos

  - [x] 3.1 Implementar el arreglo
    - `vocabulario.ts`: `TipoArgumento` agrega `'color'` y `'nombre'`; `PONCOLOR` pasa a `['color']` con `ejemplo` e `insercion` = `PONCOLOR "rojo`; `PARA` pasa a `['nombre']`
    - `errores.ts`: parámetro opcional `parte?: 'terna'` en los dos ids; tabla total `Record<TipoArgumento, PlantillaArgumento>`; `clasificarRecibido`; los dos `case` consultan `buscarComando` y los comandos numéricos y `REPITE` conservan su texto
    - `parser.ts`: `analizarComandoColor` pasa `parte: 'terna'` en los dos errores de la terna
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 3.1, 3.2, 3.3_

  - [x] 3.2 Verificar que la prueba exploratoria ahora pasa
    - Volver a ejecutar las MISMAS pruebas de la tarea 1; **RESULTADO**: PASAN
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 3.3 Verificar que las pruebas de preservación siguen pasando
    - Volver a ejecutar las MISMAS pruebas de la tarea 2 y el resto de `src/lenguaje`; **RESULTADO**: PASAN
    - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8_

- [x] 4. Errores de `PARA`: sin nombre, anidado y con parámetros

  - [x] 4.1 Escribir las pruebas (fallan antes del arreglo)
    - `errores.test.ts`: mensajes de `paraSinNombre`, `paraAnidado` y `paraConParametros` (≤ 200 caracteres, sin líneas ni números fijos); `paraSinFin` conserva su único significado
    - `parser.test.ts`: `PARA` solo, `PARA 5 …` y `PARA [` → `paraSinNombre` en la posición del `PARA`; `REPITE 2 [PARA X AV 100 FIN] X` y `PARA A PARA B AV 100 FIN FIN B` → un solo `paraAnidado`, sin "No sé cómo hacer B"; un `PARA` anidado sin `FIN` no se come el `FIN` de un `PARA` posterior; en el mundo 1 `PARA` sigue bloqueado; `PARA X :lado …` → `paraConParametros` una sola vez, en el primer `:param`; desde el mundo 4 el `:param` se acepta
    - `main.test.ts`: cada caso se muestra en el globo y no califica el intento
    - **RESULTADO**: 20 pruebas FALLAN sobre el código sin corregir
    - _Requirements: 1.5, 1.7, 1.8_

  - [x] 4.2 Implementar el arreglo
    - `errores.ts`: ids `paraSinNombre`, `paraAnidado` y `paraConParametros` con mensajes derivados del ejemplo de `PARA`
    - `parser.ts`: `anidamiento` en el `Estado` (listas de `REPITE` y cuerpos de `PARA`); `reportarParaAnidado` descarta el `PARA` anidado hasta su `FIN` y registra su nombre; `analizarDefinicion` reporta `paraSinNombre` y `paraConParametros` (mundo < 4)
    - Actualizar la prueba existente que fijaba el descarte silencioso del `:param`
    - _Requirements: 2.5, 2.7, 2.8, 3.4, 3.5_

  - [x] 4.3 Verificar exploratorias y preservación
    - `src/lenguaje` y `src/main.test.ts` en verde; `PARA … FIN` bien formado sin cambios
    - _Requirements: 2.5, 2.7, 2.8, 3.4, 3.5_

- [ ] 5. `RELLENA` con argumento de color (se cierra al implementar el punto 7 de la reseña)
  - `vocabulario.ts`: `RELLENA` pasa a `aridad: 1` y `tiposArgumento: ['color']`, con `ejemplo` e `insercion` = `RELLENA "azul`
  - El mensaje de argumento faltante o equivocado sale de la plantilla de color sin código nuevo: `RELLENA necesita un color. Por ejemplo: RELLENA "azul`
  - Ya está cubierto por la prueba "para todo comando de color del vocabulario" de la tarea 1
  - _Requirements: 2.9, 3.6_

## Notes

- Commits separados, en español, scope `mundo-2`, con la verificación en verde antes de cada uno.
- Las pruebas son lentas en esta máquina: usar `--no-file-parallelism` para la suite completa y subir el timeout solo de la prueba que falle sola, nunca uno global.
- Seguimiento fuera de alcance: mensaje de `REPITE`; `AVANZA [` sigue diciendo "una palabra" (requisito 3.2); el ejemplo de `ESCRIBE` conserva comilla de cierre; mensajes con texto fijo del catálogo (issue aparte del dueño).
