// Escaneos del repositorio para lo que agrega el mundo 4 (spec 05, tarea 15.6).
//
// Leen las fuentes con `fs`, sin red ni historial de git. No repiten lo que ya mide
// `main.test.ts` (21.1: sin `Math.random`, `eval`, `new Function` ni el constructor
// `Function` en ningún .ts de src/); aquí van las reglas que el mundo 4 vuelve
// fáciles de romper: `Date.now` como reloj, mensajes nuevos copiados fuera del
// catálogo, presupuestos escritos a mano, listas paralelas de los operadores y
// procedimientos de referencia que chocan con el vocabulario nuevo.
//
// Vive junto a `main.ts` por la regla de estructura (el nombre hasta el primer
// punto tiene que ser un módulo de la misma carpeta).

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOCABULARIO, normalizarPalabra } from './lenguaje/vocabulario.js';
import type { Instruccion } from './lenguaje/ast.js';
import { CATALOGO } from './niveles/catalogo.js';
import { resolverReto } from './juego/reto.js';
import { SEMILLA_MINIMA } from './azar/prng.js';
import { TIMEOUT_TRES_ESTRELLAS } from './pruebas/tiempos.js';

const RAIZ_SRC = dirname(fileURLToPath(import.meta.url));
const RAIZ_PROYECTO = join(RAIZ_SRC, '..');

function listarArchivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...listarArchivos(ruta));
    else salida.push(ruta);
  }
  return salida;
}

/** Ruta relativa a `src/`, con barras normales para los mensajes. */
function rel(ruta: string): string {
  return relative(RAIZ_SRC, ruta).split(sep).join('/');
}

/** Los .ts del juego: todo src/ menos las pruebas. */
const MODULOS = listarArchivos(RAIZ_SRC).filter((r) => r.endsWith('.ts') && !r.endsWith('.test.ts'));

/**
 * Cambia por espacios los comentarios y, si `cadenas` es verdadero, también el contenido
 * de las cadenas. Conserva la longitud y los saltos de línea, así que una posición del
 * texto despojado es la misma posición en la fuente.
 */
function despojar(fuente: string, cadenas: boolean): string {
  let salida = '';
  let i = 0;
  type Modo = 'codigo' | 'linea' | 'bloque' | 'comilla' | 'doble' | 'plantilla';
  let modo: Modo = 'codigo';
  const blanco = (c: string): string => (c === '\n' ? '\n' : ' ');
  const enCadena = (c: string): string => (cadenas ? blanco(c) : c);
  while (i < fuente.length) {
    const c = fuente[i]!;
    const d = fuente[i + 1] ?? '';
    if (modo === 'codigo') {
      if (c === '/' && d === '/') { modo = 'linea'; salida += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { modo = 'bloque'; salida += '  '; i += 2; continue; }
      if (c === "'") modo = 'comilla';
      else if (c === '"') modo = 'doble';
      else if (c === '`') modo = 'plantilla';
      salida += c; i += 1; continue;
    }
    if (modo === 'linea') {
      if (c === '\n') modo = 'codigo';
      salida += blanco(c); i += 1; continue;
    }
    if (modo === 'bloque') {
      if (c === '*' && d === '/') { modo = 'codigo'; salida += '  '; i += 2; continue; }
      salida += blanco(c); i += 1; continue;
    }
    if (c === '\\') { salida += enCadena(c) + enCadena(d); i += 2; continue; }
    if ((modo === 'comilla' && c === "'") || (modo === 'doble' && c === '"') || (modo === 'plantilla' && c === '`')) {
      modo = 'codigo'; salida += c; i += 1; continue;
    }
    salida += enCadena(c); i += 1;
  }
  return salida;
}

// ============================================================================
// Reloj y configuración de despliegue (R8.9, R27.5a, R27.5c)
// ============================================================================

describe('15.6 · reloj y despliegue', () => {
  it('ningún módulo de src/ usa Date.now (fuera de las pruebas)', () => {
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      const lineas = despojar(readFileSync(ruta, 'utf8'), true).split('\n');
      lineas.forEach((linea, i) => {
        if (/\bDate\s*\.\s*now\b/.test(linea)) infracciones.push(`${rel(ruta)}:${i + 1} usa Date.now`);
      });
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it("vite.config.ts conserva base: '/'", () => {
    const config = despojar(readFileSync(join(RAIZ_PROYECTO, 'vite.config.ts'), 'utf8'), false);
    expect(config).toMatch(/\bbase\s*:\s*['"]\/['"]/);
  });
});

// ============================================================================
// Los 17 mensajes nuevos solo viven en errores.ts (R15.2)
// ============================================================================

/** Los 15 de R15 y las dos invitaciones de R22. */
const IDS_NUEVOS = [
  'variableNoDefinida', 'parametroDuplicado',
  'procedimientoArgumentosFaltantes', 'procedimientoArgumentosDeMas',
  'operadorSinUso', 'aritmeticaBloqueada',
  'parentesisSinCerrar', 'parentesisDeMas', 'expresionIncompleta', 'expresionDemasiadoProfunda',
  'divisionPorCero', 'numeroFueraDeRango', 'vecesInvalidas', 'azarRangoInvalido',
  'guardaEscrituras',
  'invitacionAbstraccionParametros', 'invitacionAbstraccionProcedimientos',
] as const;

// Un fragmento corto («argumentos (») aparece en cualquier parte; desde 15 caracteres con un
// espacio ya es texto de la plantilla y no una coincidencia.
const LARGO_MINIMO_FRAGMENTO = 15;

/**
 * Fragmentos fijos de las cadenas de un bloque `case`: el texto de cada cadena simple y
 * los tramos de cada plantilla entre sus `${…}`.
 */
function fragmentosDeCadenas(bloque: string): string[] {
  const fragmentos: string[] = [];
  let i = 0;
  while (i < bloque.length) {
    const c = bloque[i]!;
    if (c === "'" || c === '"') {
      let texto = '';
      i += 1;
      while (i < bloque.length && bloque[i] !== c) {
        if (bloque[i] === '\\') { texto += bloque[i + 1] ?? ''; i += 2; continue; }
        texto += bloque[i]; i += 1;
      }
      fragmentos.push(texto);
      i += 1;
      continue;
    }
    if (c === '`') {
      let texto = '';
      i += 1;
      while (i < bloque.length && bloque[i] !== '`') {
        if (bloque[i] === '\\') { texto += bloque[i + 1] ?? ''; i += 2; continue; }
        if (bloque[i] === '$' && bloque[i + 1] === '{') {
          fragmentos.push(texto);
          texto = '';
          // Salta la expresión interpolada, que puede traer llaves y comillas propias.
          let profundidad = 1;
          i += 2;
          while (i < bloque.length && profundidad > 0) {
            const e = bloque[i]!;
            if (e === "'" || e === '"') {
              const cierre = bloque.indexOf(e, i + 1);
              i = cierre < 0 ? bloque.length : cierre + 1;
              continue;
            }
            if (e === '{') profundidad += 1;
            if (e === '}') profundidad -= 1;
            i += 1;
          }
          continue;
        }
        texto += bloque[i]; i += 1;
      }
      fragmentos.push(texto);
      i += 1;
      continue;
    }
    i += 1;
  }
  return fragmentos.map((f) => f.trim()).filter((f) => f.length >= LARGO_MINIMO_FRAGMENTO && f.includes(' '));
}

/**
 * Los cuerpos de cada `case 'id':` de errores.ts, hasta el siguiente `case` o `default`.
 * Un id aparece en más de un `switch` (validación de parámetros y redacción), así que se
 * juntan todos: solo el de la redacción trae las cadenas del mensaje.
 */
function bloquesDelCaso(fuenteErrores: string, id: string): string {
  const etiqueta = `case '${id}':`;
  const bloques: string[] = [];
  for (let inicio = fuenteErrores.indexOf(etiqueta); inicio >= 0; inicio = fuenteErrores.indexOf(etiqueta, inicio + 1)) {
    const resto = fuenteErrores.slice(inicio + etiqueta.length);
    const fin = resto.search(/\n\s*(case\s+'|default\s*:)/);
    bloques.push(fin < 0 ? resto : resto.slice(0, fin));
  }
  return bloques.join('\n');
}

describe('15.6 · los mensajes nuevos no se copian fuera de errores.ts (R15.2)', () => {
  const RUTA_ERRORES = join(RAIZ_SRC, 'lenguaje', 'errores.ts');
  const FUENTE_ERRORES = despojar(readFileSync(RUTA_ERRORES, 'utf8'), false);
  const FRAGMENTOS = new Map(IDS_NUEVOS.map((id) => [id, fragmentosDeCadenas(bloquesDelCaso(FUENTE_ERRORES, id))]));

  it('cada uno de los 17 ids tiene en errores.ts al menos un fragmento de plantilla que buscar', () => {
    const sinFragmento = IDS_NUEVOS.filter((id) => FRAGMENTOS.get(id)!.length === 0);
    expect(sinFragmento, sinFragmento.join(', ')).toEqual([]);
  });

  it('ningún otro módulo de src/ contiene un fragmento de esas plantillas', () => {
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (ruta === RUTA_ERRORES) continue;
      const fuente = readFileSync(ruta, 'utf8');
      for (const [id, fragmentos] of FRAGMENTOS) {
        for (const fragmento of fragmentos) {
          if (fuente.includes(fragmento)) infracciones.push(`${rel(ruta)} copia el texto de ${id}: «${fragmento}»`);
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });
});

// ============================================================================
// Ningún presupuesto escrito a mano en src/niveles/ (R20.12, R27.5f)
// ============================================================================

describe('15.6 · src/niveles/ no escribe presupuestoEstrella ni limiteDuro (R20.12)', () => {
  it('ningún módulo de niveles nombra esos campos en su código (los comentarios no cuentan)', () => {
    const infracciones: string[] = [];
    const niveles = MODULOS.filter((r) => rel(r).startsWith('niveles/'));
    expect(niveles.length).toBeGreaterThan(0);
    for (const ruta of niveles) {
      // Con las cadenas a la vista: una clave entre comillas ('limiteDuro': 9) también cuenta.
      const lineas = despojar(readFileSync(ruta, 'utf8'), false).split('\n');
      lineas.forEach((linea, i) => {
        const m = /\b(presupuestoEstrella|limiteDuro)\b/.exec(linea);
        if (m) infracciones.push(`${rel(ruta)}:${i + 1} escribe ${m[1]}`);
      });
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });
});

// ============================================================================
// Ninguna lista literal de los seis operadores fuera de vocabulario y evaluador (R6.2)
// ============================================================================

const OPERADORES = VOCABULARIO.filter((e) => e.produceValor).map((e) => e.nombre);
const NOMBRES_DEL_VOCABULARIO = new Set(VOCABULARIO.map((e) => e.nombre));

/**
 * Busca grupos `[…]` o `{…}` que nombran los seis operadores y ningún otro comando del
 * vocabulario: eso es una lista de operadores. Una tabla que traduce todos los comandos
 * (como la del Logo en inglés de errores.ts) no lo es, porque nombra también comandos de
 * acción. Devuelve la línea donde abre cada grupo encontrado.
 */
function listasDeOperadores(fuente: string): number[] {
  const sinComentarios = despojar(fuente, false);
  const soloCodigo = despojar(fuente, true);
  const lineas: number[] = [];
  const abiertos: number[] = [];
  for (let i = 0; i < soloCodigo.length; i++) {
    const c = soloCodigo[i];
    if (c === '[' || c === '{') abiertos.push(i);
    else if ((c === ']' || c === '}') && abiertos.length > 0) {
      const inicio = abiertos.pop()!;
      const nombres = new Set(
        [...sinComentarios.slice(inicio, i + 1).matchAll(/\b[A-ZÁÉÍÓÚÑ]{2,}\b/g)]
          .map((m) => normalizarPalabra(m[0]))
          .filter((n) => NOMBRES_DEL_VOCABULARIO.has(n)),
      );
      const todos = OPERADORES.every((o) => nombres.has(o));
      const soloOperadores = [...nombres].every((n) => OPERADORES.includes(n));
      if (todos && soloOperadores) lineas.push(soloCodigo.slice(0, inicio).split('\n').length);
    }
  }
  return lineas;
}

describe('15.6 · la clasificación de operadores sale solo del vocabulario (R6.2)', () => {
  it('el vocabulario declara exactamente seis operadores', () => {
    expect(OPERADORES).toHaveLength(6);
  });

  it('el detector reconoce una lista de los seis y deja pasar una tabla de todos los comandos', () => {
    const lista = `const X = new Set([${OPERADORES.map((o) => `'${o}'`).join(', ')}]);`;
    const tabla = `const T = { ${OPERADORES.map((o) => `'${o}': 1`).join(', ')}, 'AVANZA': 2 };`;
    const comentada = `// [${OPERADORES.join(', ')}]`;
    expect(listasDeOperadores(lista)).toEqual([1]);
    expect(listasDeOperadores(tabla)).toEqual([]);
    expect(listasDeOperadores(comentada)).toEqual([]);
  });

  it('fuera de vocabulario.ts y evaluador.ts ningún módulo tiene una lista literal de los seis', () => {
    const permitidos = new Set(['lenguaje/vocabulario.ts', 'lenguaje/evaluador.ts']);
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (permitidos.has(rel(ruta))) continue;
      for (const linea of listasDeOperadores(readFileSync(ruta, 'utf8'))) {
        infracciones.push(`${rel(ruta)}:${linea} lista los seis operadores`);
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });
});

// ============================================================================
// Las referencias de los mundos 0 a 3 no chocan con el vocabulario del mundo 4 (R12.10)
// ============================================================================

const SEMILLAS = 200;

/** Nombre y abreviatura de cada entrada del mundo 4, normalizados como los lee el lexer. */
const PALABRAS_MUNDO_4 = new Set(
  VOCABULARIO.filter((e) => e.mundo === 4)
    .flatMap((e) => [e.nombre, e.abreviatura])
    .filter((p): p is string => p !== null)
    .map(normalizarPalabra),
);

function procedimientosDefinidos(instrucciones: readonly Instruccion[]): string[] {
  const nombres: string[] = [];
  for (const ins of instrucciones) {
    if (ins.tipo === 'definicionProcedimiento') nombres.push(ins.nombre, ...procedimientosDefinidos(ins.cuerpo));
    else if (ins.tipo === 'repeticion') nombres.push(...procedimientosDefinidos(ins.cuerpo));
  }
  return nombres;
}

describe('15.6 · las referencias de los mundos 0 a 3 no definen procedimientos del mundo 4 (R12.10)', () => {
  it('el mundo 4 aporta las palabras que se comparan (nombres y abreviaturas)', () => {
    expect(PALABRAS_MUNDO_4.size).toBeGreaterThanOrEqual(8);
    expect(PALABRAS_MUNDO_4.has('ES')).toBe(true);
    expect(PALABRAS_MUNDO_4.has('RO')).toBe(true);
  });

  it(`ninguna referencia (autorada, o generada sobre ${SEMILLAS} semillas) usa un nombre del mundo 4`, () => {
    const niveles = CATALOGO.filter((n) => n.mundo <= 3);
    expect(niveles.length).toBeGreaterThan(0);
    // Piso: hay niveles generados y alguna referencia define un PARA (mundo 2 en adelante),
    // o la prueba pasaría sin mirar nada.
    expect(niveles.some((n) => n.origen.tipo === 'generado')).toBe(true);
    let definiciones = 0;
    const infracciones: string[] = [];
    for (const nivel of niveles) {
      const semillas =
        nivel.origen.tipo === 'autorado'
          ? [nivel.origen.semilla]
          : Array.from({ length: SEMILLAS }, (_, i) => SEMILLA_MINIMA + i);
      for (const semilla of semillas) {
        const r = resolverReto(nivel.id, semilla);
        if (!r.exito) {
          infracciones.push(`${nivel.id} con semilla ${semilla} no se resolvió: ${r.error.id}`);
          continue;
        }
        for (const nombre of procedimientosDefinidos(r.reto.referencia.instrucciones)) {
          definiciones += 1;
          if (PALABRAS_MUNDO_4.has(normalizarPalabra(nombre))) {
            infracciones.push(`${nivel.id} con semilla ${semilla} define ${nombre}`);
          }
        }
      }
    }
    expect(definiciones).toBeGreaterThan(0);
    expect(infracciones, infracciones.slice(0, 20).join('\n')).toEqual([]);
  }, TIMEOUT_TRES_ESTRELLAS);
});
