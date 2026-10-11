# Requirements Document

**KiroLogo · Spec 02 · Mundo 1 · Figuras geométricas**

## Introduction

Esta spec agrega `REPITE` al lenguaje y los cinco niveles del mundo 1. Es el momento pedagógico más
importante del juego: el jugador acaba de copiar cuatro veces `AV 100 GD 90` en el nivel 0.4 y
descubre ahora que la repetición se puede expresar directamente.

El concepto central es **iteración y la regla del ángulo exterior**: la tortuga siempre da una vuelta
completa de 360 grados, repartidos entre los lados. Todo el mundo 1 gira alrededor de ese principio.

### Decisiones cerradas

**Sincronización visual de la reproducción en paralelo** — Ambas ejecuciones corren a la misma
velocidad de pasos. Si un programa tiene más pasos que el otro, el más corto termina su último paso
y su tortuga queda estática mientras el más largo sigue avanzando. El punto de divergencia se reporta
en cuanto ocurre, sin esperar al final. Eso es lo correcto pedagógicamente: el jugador ve *dónde*
dejó de ir por el mismo camino, no solo que llegó a un destino distinto.

**Círculo del 1.4** — Se acepta cualquier programa que produzca geometría equivalente dentro de la
tolerancia estándar de 8 px. La referencia es `REPITE 360 [AV 2 GD 1]`; la tolerancia de dilatación
ya cubre variaciones mínimas (e.g. `REPITE 180 [AV 4 GD 2]`). Los niveles autorados no tienen
restricción de vocabulario: el validador compara geometría, no texto.

**Arco del 1.5 y la invariancia a rotación** — El arco es una figura abierta. En los mundos 0–2 la
normalización es traslación y rotación libres, escala fija. Esa permisividad rotacional se mantiene
para el 1.5: es coherente con el resto del mundo y la lección del nivel no es la orientación sino la
cuenta de pasos. No se endurece la validación solo para este nivel.

**Presentación de la negación de la estrella de abstracción** — El mensaje aparece solo si el jugador
ya ganó la estrella de precisión. Nunca bloquea la validación; es una invitación posterior. El tono
es afirmativo: *"Lo conseguiste. Pero dibujaste los cuatro lados uno a uno: yo los vi llegar de la
misma forma, cuatro veces. ¿Puedes enseñarme a repetir con REPITE?"*

### Patrones EARS en español

| Patrón | Forma en este documento | EARS |
|---|---|---|
| Ubicuo | EL/LA \<sistema\> DEBERÁ \<respuesta\> | THE … SHALL |
| Dirigido por evento | CUANDO \<disparador\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHEN … |
| Dirigido por estado | MIENTRAS \<condición\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHILE … |
| Evento no deseado | SI \<condición\>, ENTONCES EL/LA \<sistema\> DEBERÁ \<respuesta\> | IF … THEN … |
| Opcional | DONDE \<opción\>, EL/LA \<sistema\> DEBERÁ \<respuesta\> | WHERE … |

## Glossary

Términos nuevos o revisados en esta spec:

- **Nodo_Repite**: nodo del AST que representa `REPITE n [cuerpo]`. Campos: `veces: number`,
  `cuerpo: Instruccion[]`.
- **Lista_Instrucciones**: secuencia de instrucciones entre corchetes `[…]`, sintaxis del cuerpo de
  `REPITE`.
- **Presupuesto_Referencia**: conteo de instrucciones del programa de referencia según la regla de
  `lenguaje-kirologo`. Es el `presupuestoEstrella` del nivel; no se escribe a mano.
- **Reproduccion_Paralela**: mecanismo que ejecuta simultáneamente el programa de Kiro y el del
  jugador, compara operación a operación y señala el primer punto de divergencia.
- **Divergencia**: primer paso donde posición o rumbo de las dos tortugas difieren más allá de la
  tolerancia (8 px posición, 1° rumbo).
- **Arco**: figura generada por `REPITE k [AV L GD 360/n]` con `k < n`; no cierra el polígono.
- **Generador_M1**: función pura `(semilla: number) → ProgramaReferencia` para los niveles generados
  del mundo 1 (1.2, 1.3, 1.5).
- **Estrella_Abstraccion_Repite**: condición `usaRepite` — el AST del jugador contiene al menos un
  nodo `Nodo_Repite`.

## Requirements

### Requirement 1 — Nodo Repite en el lenguaje

**User Story**: Como jugador, quiero escribir `REPITE 4 [AV 100 GD 90]` y que la tortuga dibuje un
cuadrado, porque repetir a mano es tedioso.

#### Acceptance Criteria

1. CUANDO el jugador escribe `REPITE 4 [AV 100 GD 90]`, EL Intérprete DEBERÁ emitir exactamente las
   mismas operaciones que `AV 100 GD 90 AV 100 GD 90 AV 100 GD 90 AV 100 GD 90`.
2. EL Conteo DEBERÁ devolver 3 para `REPITE 4 [AV 100 GD 90]` (1 por `REPITE` + 1 por `AV` + 1 por
   `GD`), independientemente del número de repeticiones.
3. CUANDO el cuerpo de `REPITE` contiene otro `REPITE`, EL Parser DEBERÁ producir un
   `Nodo_Repite` anidado y EL Intérprete DEBERÁ ejecutarlo correctamente.
4. EL Vocabulario DEBERÁ aceptar tanto `REPITE` como `RP` como formas equivalentes del mismo comando.
5. CUANDO el jugador escribe `RP 3 [GD 120 AV 80]`, EL Intérprete DEBERÁ ejecutarlo igual que
   `REPITE 3 [GD 120 AV 80]`.

### Requirement 2 — Errores de corchete

**User Story**: Como jugador, quiero mensajes de error claros cuando olvido cerrar un corchete o
pongo uno de más, para encontrar el error sin releer todo el programa.

#### Acceptance Criteria

1. SI el jugador escribe `REPITE 4 [AV 100 GD 90` sin cerrar el corchete, ENTONCES EL Catalogo_Errores
   DEBERÁ producir el mensaje `Falta cerrar el corchete que abriste en la línea N.` donde N es el
   número de línea donde apareció `[`.
2. SI el jugador escribe `AV 100 GD 90]` con un corchete de cierre sin apertura, ENTONCES EL
   Catalogo_Errores DEBERÁ producir el mensaje `Hay un corchete de cierre en la línea N que no
   abriste.` donde N es el número de línea donde apareció `]`.
3. EL Lexer DEBERÁ rastrear el número de línea de cada token para que los errores de corchete
   incluyan la línea exacta.
4. SI hay corchetes anidados y el interior no cierra, ENTONCES EL mensaje DEBERÁ señalar la línea del
   corchete interior sin cerrar.

### Requirement 3 — Generadores del mundo 1

**User Story**: Como diseñador de niveles, quiero que los niveles 1.2, 1.3 y 1.5 generen retos
distintos por semilla y que su presupuesto salga del conteo de la referencia, sin números a mano.

#### Acceptance Criteria

1. EL Generador_M1 del nivel 1.2 DEBERÁ producir programas de la forma
   `REPITE n [AV L GD 360/n]` con `n` ∈ {3, 4, 5, 6, 7, 8} y `L` múltiplo de 20 entre 60 y 140.
2. EL Generador_M1 del nivel 1.3 DEBERÁ producir programas de la forma
   `REPITE n [AV L GI 360/n]` con los mismos rangos que el 1.2.
3. EL Generador_M1 del nivel 1.5 DEBERÁ producir programas de la forma
   `REPITE k [AV L GD 360/n]` con `k < n`, `k` ≥ 2, y la figura resultante no cierra el polígono.
4. EL campo `presupuestoEstrella` de cada nivel generado DEBERÁ calcularse en tiempo de ejecución
   mediante el Conteo aplicado al programa de referencia; ningún número de presupuesto se DEBERÁ
   escribir a mano en los datos del nivel.
5. CUANDO la figura generada no cabe en el lienzo (caja envolvente < 200 px de lado o desborda los
   800 × 800) EL Generador_M1 DEBERÁ descartar la semilla e intentar con la semilla siguiente.
6. Cada generador DEBERÁ pasar la verificación sobre al menos 200 semillas consecutivas: todas
   producen un reto encuadrado, no degenerado, y su referencia aprueba con las tres estrellas.

### Requirement 4 — Niveles autorados del mundo 1

**User Story**: Como jugador, quiero que los niveles 1.1 y 1.4 tengan retos fijos claros y bien
contrastados para que la lección sea evidente.

#### Acceptance Criteria

1. EL nivel 1.1 DEBERÁ tener como programa de referencia `REPITE 4 [AV 100 GD 90]` y su
   `presupuestoEstrella` DEBERÁ ser 3.
2. EL nivel 1.4 DEBERÁ tener como programa de referencia `REPITE 360 [AV 2 GD 1]` y su
   `presupuestoEstrella` DEBERÁ ser 3.
3. EL nivel 1.1 DEBERÁ declarar `usaRepite` como requisito de la estrella de abstracción.
4. EL nivel 1.4 DEBERÁ declarar `usaRepite` como requisito de la estrella de abstracción.
5. CUANDO el jugador aprueba el nivel 1.1 con precisión pero sin usar `REPITE`, EL sistema DEBERÁ
   otorgar precisión y economía (si corresponde) pero negar la estrella de abstracción, y mostrar el
   mensaje de invitación: *"Lo conseguiste. Pero dibujaste los cuatro lados uno a uno: yo los vi llegar
   de la misma forma, cuatro veces. ¿Puedes enseñarme a repetir con REPITE?"*

### Requirement 5 — Reproducción en paralelo

**User Story**: Como jugador, quiero ver las dos tortugas avanzar al mismo tiempo y que Kiro me diga
exactamente en qué paso dejaron de coincidir, para entender el error sin comparar líneas de código.

#### Acceptance Criteria

1. CUANDO el jugador ejecuta su programa, EL sistema DEBERÁ reproducir en paralelo las operaciones
   del programa de Kiro y las del programa del jugador, sincronizadas paso a paso.
2. EL sistema DEBERÁ detectar el primer paso donde la posición final difiere en más de 8 px o el
   rumbo difiere en más de 1°, y marcarlo como punto de Divergencia.
3. CUANDO se detecta Divergencia, EL sistema DEBERÁ mostrar el mensaje concreto:
   *"hasta aquí íbamos igual; en este giro yo doblé N grados y tú M."* (o la variante de posición
   según corresponda).
4. SI el programa del jugador tiene menos pasos que el de Kiro, ENTONCES EL sistema DEBERÁ reportar
   el punto donde el programa corto se agotó: *"tu programa terminó aquí, pero todavía faltaban
   pasos."*
5. SI los dos programas producen la misma secuencia de operaciones dentro de tolerancia y el jugador
   aun así falla la precisión, ENTONCES EL sistema DEBERÁ informar que el problema es exceso de
   trazo: *"llegaste al mismo lugar que yo; el problema es que dibujaste de más al final."*
6. EL sistema DEBERÁ comparar **operaciones de la tortuga**, no líneas de código: dos programas
   sintácticamente distintos pero geométricamente equivalentes no DEBERÁN divergir.
7. MIENTRAS la reproducción en paralelo está activa, EL sistema DEBERÁ mostrar ambas tortugas sobre
   la misma cuadrícula al mismo tiempo.

### Requirement 6 — Insignia Iteración

**User Story**: Como jugador, quiero ganar la insignia *Iteración* al completar el mundo 1 con las
tres estrellas en todos los niveles, como reconocimiento de que entendí el concepto.

#### Acceptance Criteria

1. CUANDO el jugador obtiene las tres estrellas (precisión, economía y abstracción) en los cinco
   niveles del mundo 1, EL sistema DEBERÁ otorgar la insignia *Iteración*.
2. EL sistema DEBERÁ mostrar la insignia en el perfil del jugador y en el mapa de progreso.
3. SI el jugador ya tiene la insignia y vuelve a completar los niveles, EL sistema DEBERÁ mostrar la
   insignia sin duplicarla.

### Requirement 7 — Vocabulario bloqueado

**User Story**: Como diseñador de producto, quiero que `REPITE` no esté disponible antes del mundo 1,
para que el desbloqueo se sienta como un logro.

#### Acceptance Criteria

1. MIENTRAS el jugador está en el mundo 0, SI escribe `REPITE`, ENTONCES EL Catalogo_Errores DEBERÁ
   producir el mensaje `REPITE todavía no está disponible. Se desbloquea en el mundo 1.`
2. CUANDO el jugador entra al mundo 1, EL sistema DEBERÁ mostrar `REPITE` en el panel lateral de
   vocabulario disponible, con su descripción y un ejemplo.
3. EL panel lateral DEBERÁ mostrar solo los comandos desbloqueados en el mundo actual del jugador.
