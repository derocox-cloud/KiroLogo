import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// R10.13: la consola cumple AA (4,5:1 el texto, 3:1 el borde del botón y el foco) y toma
// todos sus colores de las fichas de tema.css. La razón y la resolución de fichas siguen
// la misma fórmula que el bloque «21.4 · contraste» de main.test.ts, cuyas ayudas son
// privadas de ese archivo.

const RAIZ_ESTILOS = join(dirname(fileURLToPath(import.meta.url)), '..', 'estilos');
const sinComentarios = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS_TEMA = sinComentarios(readFileSync(join(RAIZ_ESTILOS, 'tema.css'), 'utf8'));
const CSS_PANTALLA = sinComentarios(readFileSync(join(RAIZ_ESTILOS, 'pantalla.css'), 'utf8'));

/** Declaraciones `--nombre: valor;` de tema.css; la primera de cada nombre manda. */
function declaraciones(css: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!mapa.has(m[1]!)) mapa.set(m[1]!, m[2]!.trim());
  }
  return mapa;
}

const VARIABLES = declaraciones(CSS_TEMA);

/** Sigue los `var()` hasta un #rrggbb y resuelve las mezclas `color-mix` con negro o blanco. */
function resolver(valor: string | null, saltos = 0): string | null {
  if (valor === null || saltos > 10) return null;
  const v = valor.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  if (ref) return resolver(VARIABLES.get(ref[1]!) ?? null, saltos + 1);
  const mezcla = /^color-mix\(in srgb,\s*(.+?)\s+(\d+)%,\s*(#000|#fff)\)$/.exec(v);
  if (mezcla) {
    const base = resolver(mezcla[1]!, saltos + 1);
    if (base === null) return null;
    const otro = mezcla[3] === '#000' ? 0 : 255;
    const peso = Number(mezcla[2]) / 100;
    return (
      '#' +
      [1, 3, 5]
        .map((i) => parseInt(base.slice(i, i + 2), 16))
        .map((c) => Math.round(c * peso + otro * (1 - peso)).toString(16).padStart(2, '0'))
        .join('')
    );
  }
  return null;
}

function luminancia(hex: string): number {
  const lin = (i: number): number => {
    const s = parseInt(hex.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}

/** Razón de contraste WCAG 2.1 entre dos #rrggbb (1 a 21). */
function contraste(a: string, b: string): number {
  const [la, lb] = [luminancia(a), luminancia(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * [primer plano, fondo, mínimo]. El botón de plegado tiene fondo transparente, así que su
 * texto y su borde se leen sobre el fondo de la consola; el foco (contorno a 3 px del botón
 * o del registro) cae dentro del relleno de la consola, sobre el mismo fondo.
 */
const PARES: ReadonlyArray<readonly [string, string, number]> = [
  ['--color-consola-texto', '--color-consola-fondo', 4.5],
  ['--color-consola-titulo', '--color-consola-fondo', 4.5],
  ['--color-consola-borde', '--color-consola-fondo', 3],
  ['--color-indicador-foco', '--color-consola-fondo', 3],
];

describe('consola: contraste AA con las fichas de tema.css (R10.13)', () => {
  it('cada ficha de la consola resuelve a un color de la paleta', () => {
    for (const nombre of ['--color-consola-fondo', '--color-consola-texto', '--color-consola-titulo', '--color-consola-borde']) {
      expect(resolver(VARIABLES.get(nombre) ?? null), nombre).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('el texto cumple 4,5:1 y el borde del botón y el foco 3:1 sobre el fondo de la consola', () => {
    const fallos: string[] = [];
    for (const [a, b, minimo] of PARES) {
      const ca = resolver(VARIABLES.get(a) ?? null);
      const cb = resolver(VARIABLES.get(b) ?? null);
      if (ca === null || cb === null) {
        fallos.push(`${a} / ${b}: no se pudo resolver (${ca}, ${cb})`);
        continue;
      }
      const razon = contraste(ca, cb);
      if (razon < minimo) fallos.push(`${a} ${ca} sobre ${b} ${cb}: ${razon.toFixed(2)}:1 < ${minimo}:1`);
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });
});

describe('consola: sin colores literales en pantalla.css (R10.13)', () => {
  const reglas = [...CSS_PANTALLA.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selector: m[1]!.trim(), cuerpo: m[2]! }))
    .filter((r) => r.selector.includes('.kl-consola'));

  it('hay reglas .kl-consola* que revisar', () => {
    expect(reglas.length).toBeGreaterThan(0);
  });

  it('ninguna regla .kl-consola* escribe un color literal ni una reserva literal', () => {
    const literal = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
    const fallos = reglas.filter((r) => literal.test(r.cuerpo)).map((r) => r.selector);
    expect(fallos).toEqual([]);
  });

  it('los colores de .kl-consola* salen de las fichas de la consola', () => {
    const fallos: string[] = [];
    for (const { selector, cuerpo } of reglas) {
      for (const m of cuerpo.matchAll(/(?:^|;)\s*((?:background-)?color|border(?:-[a-z]+)*|outline(?:-color)?)\s*:\s*([^;]+)/g)) {
        if (/-(?:radius|width|style|offset)$/.test(m[1]!)) continue;
        const valor = m[2]!.trim();
        const usaFicha = /var\(--color-consola-[a-z]+\)/.test(valor);
        const neutro = /^(?:transparent|inherit|currentcolor)$/i.test(valor);
        if (!usaFicha && !neutro) fallos.push(`${selector} { ${m[1]}: ${valor} }`);
      }
    }
    expect(fallos, fallos.join('\n')).toEqual([]);
  });
});
