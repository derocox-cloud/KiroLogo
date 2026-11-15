// Property 21 (spec 05): toda referencia del mundo 4 aprueba su nivel con tres estrellas.
//
// Regresión obligatoria del steering: el 4.1 una vez y los generados 4.2, 4.3 y 4.4 sobre sus
// primeras 200 semillas, cada uno en su propia prueba para que un fallo diga qué nivel se rompió.
// La referencia se vuelve a ejecutar con el mismo intérprete y los mismos comandos que recibe el
// jugador, y sus operaciones tienen que ser las mismas que mostró la demostración. Además se
// comprueba que ninguna referencia usa AZAR (un reto con azar en la referencia no sería
// reproducible) y que un programa de un solo PARA, con otros nombres de procedimiento y de
// parámetros, también gana las tres estrellas: la calificación no depende de copiar a Kiro letra
// por letra.
//
// **Validates: Requirements 8.10, 16.6, 16.9, 17.7, 18.8, 19.5, 20.15, 20.16, 25.1, 27.7**

import { describe, it, expect } from 'vitest';
import type { Programa } from '../lenguaje/ast.js';
import { analizarLexico } from '../lenguaje/lexer.js';
import { analizar } from '../lenguaje/parser.js';
import { imprimir } from '../lenguaje/impresor.js';
import { ejecutar, type Operacion } from '../lenguaje/interprete.js';
import { contarInstrucciones } from '../lenguaje/conteo.js';
import { comandosDelMundo } from '../lenguaje/vocabulario.js';
import { ESTADO_INICIAL } from '../motor/tortuga.js';
import { extraerSegmentos } from '../motor/segmentos.js';
import { validar } from '../motor/validador.js';
import { resolverReto, type Reto } from '../juego/reto.js';
import { calificar } from '../juego/estrellas.js';
import { TIMEOUT_TRES_ESTRELLAS } from '../pruebas/tiempos.js';

const SEMILLAS = 200;

// ============================================================================
// Ayudas
// ============================================================================

function retoDe(idNivel: string, semilla: number): Reto {
  const r = resolverReto(idNivel, semilla);
  if (!r.exito) throw new Error(`${idNivel} (semilla ${semilla}): no se resolvió (${r.error.id})`);
  return r.reto;
}

/** Ejecuta un programa como lo hace el juego con el del jugador: mundo 4, sin fabricaAzar. */
function ejecutarComoJugador(programa: Programa): readonly Operacion[] | string {
  const gen = ejecutar(programa, {
    estadoInicial: ESTADO_INICIAL,
    comandosPermitidos: comandosDelMundo(4),
    semilla: 0,
  });
  let paso = gen.next();
  while (!paso.done) paso = gen.next();
  if (paso.value.error !== null) return `error ${paso.value.error.mensaje}`;
  if (paso.value.guardaActivada !== null) return `guarda ${String(paso.value.guardaActivada)}`;
  return paso.value.operaciones;
}

/** Recorre el AST entero sin conocer su forma: cualquier objeto con `tipo` es un nodo. */
function nodosDe(valor: unknown, encontrados: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(valor)) {
    for (const v of valor) nodosDe(v, encontrados);
  } else if (valor !== null && typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>;
    if (typeof objeto.tipo === 'string') encontrados.push(objeto);
    for (const v of Object.values(objeto)) nodosDe(v, encontrados);
  }
  return encontrados;
}

function usaAzar(programa: Programa): boolean {
  return nodosDe(programa).some((n) => n.tipo === 'comandoOperador' && n.nombre === 'AZAR');
}

/**
 * Copia de la referencia con el procedimiento y sus parámetros renombrados. Es el programa de un
 * jugador que entendió la idea pero eligió sus propios nombres.
 */
function renombrar(programa: Programa): Programa {
  const nombresParametro = new Map<string, string>();
  const copia = structuredClone(programa) as Programa;
  for (const nodo of nodosDe(copia)) {
    if (nodo.tipo === 'definicionProcedimiento') {
      const parametros = nodo.parametros as string[];
      parametros.forEach((p, i) => nombresParametro.set(p, `dato${i + 1}`));
      (nodo as { parametros: string[] }).parametros = parametros.map((p) => nombresParametro.get(p)!);
    }
    if (nodo.tipo === 'definicionProcedimiento' || nodo.tipo === 'invocacionProcedimiento') {
      (nodo as { nombre: string }).nombre = 'MIFIGURA';
    }
  }
  for (const nodo of nodosDe(copia)) {
    if (nodo.tipo === 'referenciaParametro') {
      const nuevo = nombresParametro.get(nodo.nombre as string);
      if (nuevo === undefined) throw new Error(`parámetro sin definición: ${String(nodo.nombre)}`);
      (nodo as { nombre: string }).nombre = nuevo;
    }
  }
  return copia;
}

/** Imprime el AST y lo vuelve a leer como lo leería el editor del jugador en el mundo 4. */
function comoTextoDelJugador(programa: Programa): Programa | string {
  const impreso = imprimir(programa);
  if (!impreso.exito) return `no imprimible (${impreso.error.id})`;
  const lexico = analizarLexico(impreso.texto);
  if (lexico.errores.length > 0) return `lexer: ${lexico.errores.map((e) => e.mensaje).join('; ')}`;
  const { programa: leido, errores } = analizar(lexico.tokens, { mundo: 4 });
  if (leido === null || errores.length > 0) return `parser: ${errores.map((e) => e.mensaje).join('; ')}`;
  return leido;
}

/** Califica un programa del jugador contra el reto con el flujo real; devuelve los fallos. */
function fallosDeTresEstrellas(etiqueta: string, programa: Programa, reto: Reto): string[] {
  const operaciones = ejecutarComoJugador(programa);
  if (typeof operaciones === 'string') return [`${etiqueta}: ${operaciones}`];
  const veredicto = validar(extraerSegmentos(operaciones), reto.segmentos, reto.nivel.normalizacion);
  const cal = calificar(programa, veredicto, reto);
  const fallos: string[] = [];
  if (!cal.precision.otorgada) fallos.push(`${etiqueta}: precisión negada — ${JSON.stringify(cal.precision)}`);
  if (!cal.economia.otorgada) fallos.push(`${etiqueta}: economía negada — ${JSON.stringify(cal.economia)}`);
  if (!cal.abstraccion.otorgada) fallos.push(`${etiqueta}: abstracción negada — ${JSON.stringify(cal.abstraccion)}`);
  return fallos;
}

/** Todo lo que la Property 21 exige de un reto del mundo 4. */
function fallosDelReto(reto: Reto, semillaPedida: number): string[] {
  const id = `${reto.nivel.id} (semilla ${semillaPedida}, efectiva ${reto.semillaEfectiva})`;
  const fallos: string[] = [];

  if (usaAzar(reto.referencia)) fallos.push(`${id}: la referencia usa AZAR`);

  // La demostración muestra `reto.operaciones`; la ejecución del jugador tiene que dar lo mismo.
  const operaciones = ejecutarComoJugador(reto.referencia);
  if (typeof operaciones === 'string') {
    fallos.push(`${id}: la referencia no corre como programa del jugador (${operaciones})`);
  } else if (JSON.stringify(operaciones) !== JSON.stringify(reto.operaciones)) {
    fallos.push(`${id}: la ejecución del jugador difiere de la demostración`);
  }

  fallos.push(...fallosDeTresEstrellas(`${id} referencia`, reto.referencia, reto));

  // Un solo PARA con parámetros usados, otros nombres y conteo dentro del presupuesto.
  const alternativo = comoTextoDelJugador(renombrar(reto.referencia));
  if (typeof alternativo === 'string') {
    fallos.push(`${id} renombrado: ${alternativo}`);
  } else {
    const definiciones = nodosDe(alternativo).filter((n) => n.tipo === 'definicionProcedimiento');
    if (definiciones.length !== 1) fallos.push(`${id} renombrado: ${definiciones.length} definiciones`);
    const conteo = contarInstrucciones(alternativo);
    if (!conteo.exito || conteo.instrucciones > reto.presupuestoEstrella) {
      fallos.push(`${id} renombrado: conteo fuera del presupuesto ${reto.presupuestoEstrella}`);
    }
    fallos.push(...fallosDeTresEstrellas(`${id} renombrado`, alternativo, reto));
  }

  return fallos;
}

// ============================================================================
// Property 21
// ============================================================================

describe('Property 21 · toda referencia del mundo 4 aprueba su nivel con tres estrellas', () => {
  it('4.1: la referencia autorada y su versión renombrada ganan las tres estrellas', () => {
    const fallos = fallosDelReto(retoDe('4.1', 0), 0);
    expect(fallos, fallos.join('\n')).toEqual([]);
  });

  for (const idNivel of ['4.2', '4.3', '4.4'] as const) {
    it(`${idNivel}: las tres estrellas en las primeras 200 semillas`, () => {
      const fallos: string[] = [];
      for (let semilla = 0; semilla < SEMILLAS; semilla++) {
        fallos.push(...fallosDelReto(retoDe(idNivel, semilla), semilla));
      }
      expect(fallos, fallos.join('\n')).toEqual([]);
    }, TIMEOUT_TRES_ESTRELLAS);
  }
});
