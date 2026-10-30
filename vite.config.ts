import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  base: '/',
  test: {
    environment: 'node',
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