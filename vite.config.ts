import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  base: '/',
  test: {
    environment: 'node',
    // La validacion geometrica rasteriza mascaras de 800x800 por fuerza bruta,
    // y las pruebas de regresion ejercen cada generador sobre 200 semillas. Con
    // la suite completa en paralelo (maxWorkers=2) esos casos pesados compiten
    // por CPU y rozan el timeout por defecto de 5 s, aunque aislados corren en
    // segundos. Se sube el limite para que la contencion no los haga fallar; las
    // guardas del interprete (5 s de ejecucion) siguen atrapando cuelgues reales.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/node_modules/**'],
    globals: false,
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.test.ts',
        '**/test-utils/**',
        '**/generadores-prueba.test.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    typecheck: {
      enabled: true,
      include: ['src/**/*.test.ts']
    }
  },
  build: {
    target: 'es2023',
    // Minificación con oxc, el minificador integrado en esta versión de Vite
    // (basada en rolldown): no requiere `terser` ni `esbuild` como dependencias
    // opcionales aparte, que no están instaladas en este proyecto.
    minify: 'oxc',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    },
    sourcemap: true
  },
  server: {
    port: 5173,
    host: true,
    open: true
  },
  preview: {
    port: 4173,
    host: true
  }
});
