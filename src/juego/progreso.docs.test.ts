/**
 * Prueba de lectura de la documentación de los métodos de señal (spec 04, R16).
 * Solo lee archivos locales: no usa la red ni el historial de git.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const RUTA_DOC = join(RAIZ, 'docs', 'senales-de-progreso.md');
const RUTA_INDICE = join(RAIZ, 'docs', 'README.md');

const METODOS = [
  'marcarPistaAbierta',
  'pistaAbiertaEn',
  'registrarVistaDemostracion',
  'vistasDemostracionDe',
  'marcarReproduccionParalelaUsada',
  'reproduccionParalelaUsada',
  'aprobadoTrasReproduccionParalelaEn',
] as const;

describe('R16 · docs/senales-de-progreso.md', () => {
  it('el documento existe', () => {
    expect(existsSync(RUTA_DOC)).toBe(true);
  });

  it.each(METODOS)('documenta el método %s', (metodo) => {
    const texto = readFileSync(RUTA_DOC, 'utf8');
    expect(texto).toContain(metodo);
  });

  it('dice que las señales son anónimas y que dos de ellas no retroceden', () => {
    const texto = readFileSync(RUTA_DOC, 'utf8').toLowerCase();
    expect(texto).toContain('anónimas');
    expect(texto).toContain('datos personales');
    expect(texto).toContain('no retroced');
  });

  it('docs/README.md enlaza el documento', () => {
    const indice = readFileSync(RUTA_INDICE, 'utf8');
    expect(indice).toContain('(senales-de-progreso.md)');
  });
});
