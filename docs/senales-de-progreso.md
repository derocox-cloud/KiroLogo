# Señales de progreso

Tres insignias transversales (**Sin pistas**, **Buen ojo** y **Depurador**) no se ganan por
completar un mundo, sino por *cómo* se juega. Para saberlo, `Progreso` (`src/juego/progreso.ts`)
guarda unas señales pequeñas. Este documento describe los siete métodos que las manejan, tal como
funcionan hoy en el código.

## Qué se guarda y qué no

Las señales son **anónimas**: son banderas y contadores asociados a un id de nivel (por ejemplo,
«se abrió una pista en este nivel» o «la demostración se vio 2 veces»). No hay nombre, correo,
identificador de dispositivo ni **datos personales** del jugador, y nada sale del navegador. Viven
en el mismo valor de `localStorage` que el resto del progreso.

## Los siete métodos

| Método | Señal | Quién la escribe | Quién la lee | Insignia | Efecto en `localStorage` |
|---|---|---|---|---|---|
| `marcarPistaAbierta(id)` | se abrió una pista en el nivel | `main.ts`, mediante `alAbrirPista` del globo de Kiro | `pistaAbiertaEn` | Sin pistas | persiste solo la primera vez; las siguientes no escriben |
| `pistaAbiertaEn(id)` | lectura de la anterior | no escribe | `insignias.ts` | Sin pistas | ninguno |
| `registrarVistaDemostracion(id)` | suma una vista de la demostración | `main.ts` | `vistasDemostracionDe` | Buen ojo | persiste en cada llamada |
| `vistasDemostracionDe(id)` | lectura del contador (0 si no hay registro) | no escribe | `insignias.ts` | Buen ojo | ninguno |
| `marcarReproduccionParalelaUsada()` | bandera global: se usó la reproducción en paralelo | `main.ts`, mediante «Ver en paralelo» | `reproduccionParalelaUsada` y `guardar` | Depurador | persiste solo la primera vez; **no retrocede** |
| `reproduccionParalelaUsada()` | lectura de la bandera | no escribe | `guardar` | Depurador | ninguno |
| `aprobadoTrasReproduccionParalelaEn(id)` | el nivel se aprobó con precisión con la bandera ya activa | `guardar` (no tiene método de escritura propio) | `insignias.ts` | Depurador | se escribe dentro de `guardar`; **no retrocede** |

Los métodos de lectura nunca escriben. Todos los de escritura llaman a la persistencia ya existente
de `Progreso`: si el almacén falla (cuota agotada o no disponible), el valor queda en memoria y se
avisa una sola vez por sesión.

## Cómo se usa cada señal

- **Sin pistas.** Cada vez que el globo de Kiro muestra un escalón de pista por primera vez llama a
  `alAbrirPista`, y `main.ts` marca el nivel con el id del reto en curso. Abrir los tres escalones
  llama tres veces, pero solo la primera escribe. La insignia exige que, en un mundo, cada nivel
  tenga la estrella de precisión y ninguna pista abierta (`insignias.ts`).
- **Buen ojo.** `main.ts` registra una vista por cada demostración lanzada, desde un único punto
  (`lanzarDemostracion`). Cuenta **también la demostración automática** que Kiro hace al entrar al
  nivel, así que un jugador que nunca pulsa «Ver demostración» ya tiene 1 vista. La insignia se
  otorga si algún nivel tiene la estrella de precisión y exactamente 1 vista.
- **Depurador.** «Ver en paralelo» marca la bandera global **al iniciar** la reproducción, no al
  terminarla. Después, cada vez que `guardar` registra una aprobación con precisión y la bandera ya
  está activa, el nivel queda como `aprobadoTrasReproduccionParalela`. La insignia se otorga con 5
  niveles así.

## Qué nunca retrocede

- `marcarReproduccionParalelaUsada` solo cambia la bandera de falso a verdadero. No existe método
  para borrarla.
- `aprobadoTrasReproduccionParalelaEn`, una vez verdadero, se conserva al reaprobar el nivel, igual
  que las estrellas.
- Por la misma razón, `pistaAbiertaEn` tampoco vuelve a falso, y `vistasDemostracionDe` solo crece.

Un progreso guardado antes de estas señales no las trae. Se lee con los valores por defecto: sin
pista abierta, 0 vistas y bandera falsa.

## Limitación conocida

Una reproducción en paralelo en curso **no se detiene** al ejecutar el programa de nuevo ni al
cambiar de nivel. Sigue hasta terminar. Como la señal se marca al iniciar, esto no altera el
progreso guardado, pero sí puede mostrar un recorrido que ya no corresponde al intento o al nivel
actuales.
