# KiroLogo

Un juego web para aprender pensamiento algorítmico escribiendo instrucciones en un pseudo-lenguaje Logo en español. En cada nivel, Kiro montado sobre la tortuga **dibuja una figura en vivo** frente al jugador, y este debe escribir el programa que la reproduce. Al lograrlo, sube de nivel.

Inspirado en el Logo del MIT Media Lab, KiroLogo está diseñado para la comunidad de AWS en español en LATAM. Personas técnicas o en formación técnica, hispanohablantes, que quieren o necesitan afianzar las nociones base de programación: secuencia, iteración, descomposición, generalización y recursión.

## Características principales

- **Todo en español**: comandos, mensajes de error, interfaz y documentación
- **Tres personajes**: el jugador escribe, Kiro interpreta, la tortuga ejecuta
- **Demostración en vivo**: cada figura se dibuja frente al jugador, no hay imágenes objetivo
- **Tres estrellas**: precisión, economía y abstracción para premiar el buen código
- **Sin imágenes**: la tortuga y Kiro se dibujan con trazos de Canvas 2D
- **Sin backend**: el progreso se guarda en `localStorage`

## Desarrollo

### Requisitos

- Node.js 24 o superior (ver `.nvmrc`)
- npm

### Comandos

```bash
# Instalar dependencias
npm ci

# Levantar entorno de desarrollo
npm run dev

# Ejecutar pruebas
npm test

# Compilar para producción
npm run build

# Previsualizar compilación
npm run preview

# Verificar tipos TypeScript
npm run typecheck
```

### Estructura del proyecto

Consulta las reglas del proyecto en [.kiro/steering/](./.kiro/steering/) y la documentación en [docs/](./docs/).

- `src/lenguaje/` - lexer, parser, AST e intérprete de KiroLogo
- `src/motor/` - tortuga, lienzo, animación y validación geométrica
- `src/juego/` - retos, progreso, estrellas y desbloqueo
- `src/niveles/` - niveles autorados y generadores
- `src/ui/` - editor, panel de comandos, demostración y comparación
- `src/estilos/` - hojas de estilo CSS

## Despliegue

El proyecto se despliega en **AWS Amplify Hosting** con `amplify.yml` versionado en el repositorio. La compilación usa la versión de Node declarada en `.nvmrc` y `npm ci` para dependencias deterministas.

## Licencia

MIT - ver [LICENSE](./LICENSE)

## Próximos pasos

Este proyecto se desarrolla mediante especificaciones (specs). Consulta el [plan de specs](./docs/README.md) para entender la progresión completa.