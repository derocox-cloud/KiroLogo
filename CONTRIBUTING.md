# Cómo contribuir a KiroLogo

¡Gracias por querer aportar! KiroLogo es un proyecto abierto para aprender pensamiento algorítmico, y
está pensado también para que colaborar en él sea una buena primera experiencia con un proyecto real.

Esta guía nace de la colaboración con la comunidad de la **Universidad del Valle (Univalle)** a través
del **Student Builders Group (SBG)**: muchas de las personas que contribuyen aquí están dando sus
primeros pasos en software libre. Si eres una de ellas, esta guía es para ti. Si ya tienes
experiencia, también: las mismas reglas aplican para todo el mundo.

Todo el proyecto es **en español**: el código del dominio, los mensajes, la interfaz, la
documentación y también los mensajes de confirmación y los pull request. No hay alias en inglés.

## Antes de empezar

1. Lee el [README](./README.md) para entender qué es el juego y cómo se ejecuta.
2. Revisa las reglas del proyecto en [`.kiro/steering/`](./.kiro/steering/). Son la fuente de verdad:
   `producto.md` (qué es y para quién), `tecnologia.md` (stack y reglas duras) y `estructura.md`
   (dónde va cada cosa). No son notas sueltas, se versionan con el código.
3. Para el *por qué* de cada decisión, está la [bitácora](./docs/bitacora.md).

## Preparar el entorno

Necesitas **Node.js 24 o superior** (ver [`.nvmrc`](./.nvmrc)) y npm.

```bash
# Clona tu fork y entra a la carpeta
git clone https://github.com/<tu-usuario>/KiroLogo.git
cd KiroLogo

# Instala dependencias exactamente como están fijadas
npm ci

# Levanta el entorno de desarrollo
npm run dev
```

Antes de abrir un pull request, deja todo esto en verde:

```bash
npm run typecheck      # tipos de TypeScript en modo estricto
npm run build          # compilación de producción
npm test               # suite completa de pruebas
```

Para correr un solo archivo de pruebas mientras trabajas:

```bash
npm test -- vocabulario      # corre los *.test.ts que coincidan con "vocabulario"
```

## Busca un "good first issue"

Si es tu primera contribución, filtra los issues por la etiqueta
[`good first issue`](https://github.com/derocox-cloud/KiroLogo/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
Son tareas pequeñas, acotadas y de bajo riesgo, pensadas para empezar sin tener que entender todo el
proyecto. Comenta en el issue que quieres tomarlo para que nadie más trabaje en lo mismo en paralelo.

## El flujo de trabajo

1. **Haz un fork** del repositorio y crea una rama desde `main` con un nombre descriptivo en español,
   por ejemplo `nivel-escalera-mundo-0` o `error-corchete-con-linea`.
2. **Haz cambios pequeños y enfocados.** Un pull request resuelve una cosa. Si te encuentras tocando
   medio proyecto para un `good first issue`, es señal de que conviene dividirlo.
3. **Escribe mensajes de confirmación en español que expliquen el *por qué*,** no solo el qué. En vez
   de «cambio errores.ts», algo como «muestro la línea real del corchete sin cerrar en vez de una
   fija, porque un número inventado confunde a quien aprende».
4. **Deja la suite en verde** (`typecheck`, `build`, `test`) antes de abrir el PR.
5. **Abre el pull request** contra `main`, describe qué cambiaste, qué probaste y enlaza el issue que
   cierra (por ejemplo, «Cierra #12»).

Sobre la fusión: los pull request se integran con **merge commit**, nunca con squash ni rebase. No
tienes que hacer nada especial, solo tenlo en cuenta al mirar el historial.

## Reglas duras que todo PR debe respetar

Estas salen del steering y no son negociables. Un PR que las rompa no se puede fusionar:

- **Nada de `Math.random`.** Todo el azar pasa por `src/azar/prng.ts` con semilla explícita, o los
  retos dejan de ser reproducibles.
- **Nada de `eval` ni `new Function`.** El intérprete se escribe a mano. Esto es lo que permite servir
  el juego con una CSP estricta.
- **Todo en español, sin alias en inglés** en comandos, errores, interfaz ni documentación.
- **Dependencias nuevas con versión fija** (sin rangos abiertos) y licencia compatible con MIT.
- **`base: '/'` en Vite** se queda como está: Amplify sirve en la raíz del dominio.
- **Nombres de archivo y carpeta en `kebab-case`** y en español; tipos en `PascalCase`, funciones y
  variables en `camelCase`. El dominio se nombra en español (`Tortuga`, `rumbo`, `lapizAbajo`).
- **Los mensajes de error visibles al jugador viven en `src/lenguaje/errores.ts`.** No escribas
  literales sueltos en el intérprete.

## Cómo agregar un nivel (la contribución más común)

**Los niveles son datos, no código.** Agregar un nivel es agregar un objeto a un arreglo; nunca
escribir lógica nueva. Si un nivel necesita código especial, es señal de que falta una capacidad en el
motor, y eso es otra conversación.

El mejor ejemplo para copiar es [`src/niveles/mundo-0-primeros-pasos.ts`](./src/niveles/mundo-0-primeros-pasos.ts):

1. Para un nivel **autorado**, construye su programa de referencia con el ayudante `invocacion(...)`,
   envuélvelo en un `Programa` y descríbelo con un objeto `Nivel` (id, mundo, título, concepto,
   origen, normalización, abstracción y las tres pistas en escalones).
2. Agrega el nuevo nivel al arreglo del mundo (por ejemplo `MUNDO_0`).
3. Corre las pruebas. Hay una regresión obligatoria: **todo reto del catálogo debe aprobar su propio
   nivel con las tres estrellas** ejecutando su programa de referencia. Si tu nivel no pasa, el
   programa de referencia no coincide con lo que describiste.

Ojo con los números: deben ser **adivinables** desde la cuadrícula visible. Longitudes en múltiplos
de 20 y ángulos derivables (360/n o múltiplos de 15). Nunca `AVANZA 87`.

## Agregar o cambiar un comando del vocabulario

`src/lenguaje/vocabulario.ts` es la **única fuente de verdad** de los comandos. El lexer, el panel de
la interfaz, la ayuda y las sugerencias de error leen de ahí. Agregar un comando o una abreviatura se
hace en ese único archivo, con su mundo de desbloqueo, y se acompaña de su prueba.

## Accesibilidad

La accesibilidad es requisito de producto, no un extra. Todo lo nuevo debe ser navegable por teclado,
no depender solo del color para comunicar estado, y respetar el contraste AA. Mira
`src/ui/panel-semilla.ts` y `src/ui/menu-mundos.ts` como ejemplos de las convenciones del proyecto
(`aria-label`, `aria-labelledby`, estados anunciados por texto además de color).

## ¿Dudas?

Abre un issue con la etiqueta `question`. Preguntar es parte de contribuir, y una buena pregunta
muchas veces mejora la documentación para quien venga después.
