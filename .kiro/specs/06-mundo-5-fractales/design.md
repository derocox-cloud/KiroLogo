# Diseño · Spec 06 · Mundo 5 · Fractales

## Lenguaje
- **Lexer:** token `comparador` para `=`, `<`, `>`.
- **AST:** `ExpresionAritmetica` admite `= < >` (valen 1 o 0); nodo nuevo `llamadaConValor` en `Expresion`.
- **Parser:** `analizarCondicional`, `analizarCondicion`, `analizarAlto`, `analizarDevuelve`, `analizarLlamadaConValor`.
  La primera pasada marca en cada firma si el `PARA` contiene `DEVUELVE`; solo esos nombres se leen como valor.
- **Evaluador:** `comparar` con tolerancia; `ContextoEvaluacion.llamar` deja que el intérprete resuelva las llamadas con valor.
- **Intérprete:** la rama de un condicional se apila como marco del mismo procedimiento; `ALTO` desapila hasta el marco del
  procedimiento. Las llamadas con valor se ejecutan de forma sincrónica y solo calculan.
- **Errores:** 9 ids nuevos y `argumentoFaltante` con `parte: 'lista'`.

## Niveles y generadores
`mundo-5-fractales.ts`, `generadores/espiral.ts` y `generadores/arbol.ts`. `cajaDeReferencia` entiende `SI`, `SINO`
y `ALTO`. Las pistas de los generados rellenan `{limite}`, `{incremento}`, `{factor}`, `{ladosEspiral}`, `{inicio}`,
`{profundidad}` y `{anguloRama}` desde la referencia.

## Interfaz
`ui/indicador-profundidad.ts`: ranura vacía antes del mundo 5, número y casillas decorativas; `main.ts` lo muestra en el
paso a paso y añade la profundidad al anuncio de cada paso.

## Decisiones
Ver la sección de la spec 06 en `docs/bitacora.md`.
