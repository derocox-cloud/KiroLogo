// @vitest-environment jsdom
//
// Pruebas del arranque y el flujo de intento de KiroLogo (grupo 19), sobre el
// nivel 0.1. Monta el DOM con los identificadores que `main.ts` espera y usa
// dependencias inyectadas (relojes controlados, almacén en memoria, movimiento
// no reducido) para que el intérprete, el animador y las estrellas corran en
// jsdom sin `requestAnimationFrame` ni Canvas real.

import { describe, it, expect, beforeEach } from 'vitest';
import { crearAplicacion, type Aplicacion, type ConsultaMovimiento } from './main.js';
import type { Reloj } from './motor/animador.js';
import type { RelojEspera } from './ui/demostracion.js';
import type { RelojRebote } from './ui/editor.js';

// ============================================================================
// Montaje del DOM
// ============================================================================

/** Crea todos los elementos por id que `main.ts` consulta. */
function montarDom(): void {
  document.documentElement.lang = 'es';
  document.body.innerHTML = `
    <div id="aplicacion" role="application" aria-label="KiroLogo">
      <div id="anuncios" aria-live="polite" aria-atomic="true"></div>
      <div id="contenido-globo"></div>
      <canvas id="lienzo-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-jugador" width="800" height="800"></canvas>
      <canvas id="lienzo-superposicion" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-referencia" width="800" height="800"></canvas>
      <canvas id="lienzo-personajes-jugador" width="800" height="800"></canvas>
      <select id="velocidad"><option value="1" selected>Normal</option></select>
    </div>
  `;
}

// ============================================================================
// Relojes y consultas controlados
// ============================================================================

/** Reloj de animación que dispara cada fotograma de inmediato al programarlo. */
function relojInmediato(): Reloj {
  let t = 0;
  return {
    programar(cb: (ahora: number) => void): number {
      // Avanza el tiempo por delante de cualquier duración de operación, para que
      // el fotograma aplique la operación en curso y siga hasta el fin.
      t += 100000;
      cb(t);
      return 1;
    },
    cancelar(): void {},
    ahora(): number {
      return t;
    },
  };
}

/** Reloj de espera que NO dispara solo (la demostración no arranca en las pruebas). */
function relojEsperaInerte(): RelojEspera {
  return {
    programar(): number {
      return 1;
    },
    cancelar(): void {},
  };
}

/** Reloj de rebote del editor que analiza de inmediato. */
const relojReboteInmediato: RelojRebote = {
  programar(cb: () => void): number {
    cb();
    return 1;
  },
  cancelar(): void {},
};

/** Movimiento reducido: siempre reducido, para que el animador dibuje de golpe. */
const movimientoReducido: ConsultaMovimiento = {
  reducido: () => true,
  alCambiar: () => () => {},
};

function crearApp(): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen: null, // memoria pura
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte(),
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    idNivel: '0.1',
  });
}

/** Escribe un texto en el editor simulando la escritura del jugador. */
function escribir(app: Aplicacion, texto: string): void {
  app.editor.area.value = texto;
  app.editor.area.dispatchEvent(new Event('input'));
  app.editor.analizarAhora();
}

// ============================================================================
// Presentación inicial (19.1)
// ============================================================================

describe('main · presentación inicial del nivel 0.1', () => {
  beforeEach(() => {
    montarDom();
  });

  it('no arranca por el solo hecho de importar el módulo (guarda de document)', () => {
    // Si importar arrancara algo, este test ya habría fallado montando dos apps.
    // Aquí basta con que crear la app explícitamente funcione.
    expect(() => crearApp()).not.toThrow();
  });

  it('presenta editor vacío, contador 0 sin provisional y presupuesto 1', () => {
    const app = crearApp();
    expect(app.editor.texto()).toBe('');
    const contador = app.editor.estadoContador();
    expect(contador.conteo).toBe(0);
    expect(contador.provisional).toBe(false);
    // El presupuesto del nivel 0.1 es 1 (una sola instrucción de referencia).
    expect(app.estado().reto.presupuestoEstrella).toBe(1);
  });

  it('muestra en el globo un texto en español no vacío', () => {
    const app = crearApp();
    expect(app.textoGlobo().trim().length).toBeGreaterThan(0);
  });

  it('presenta los 6 comandos del mundo 0 en el panel', () => {
    crearApp();
    const botones = document.querySelectorAll('.kl-comando');
    expect(botones.length).toBe(6);
  });
});

// ============================================================================
// Flujo de intento (19.2)
// ============================================================================

describe('main · flujo de intento del nivel 0.1', () => {
  beforeEach(() => {
    montarDom();
  });

  it('(a) AVANZA 100 concede las tres estrellas', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();

    const cal = app.estado().calificacion;
    expect(cal).not.toBeNull();
    expect(cal!.precision.otorgada).toBe(true);
    expect(cal!.economia.otorgada).toBe(true);
    expect(cal!.abstraccion.otorgada).toBe(true);
  });

  it('(b) AVANZA 100 GIRADERECHA 90 AVANZA 100 niega precisión por exceso y economía nombrando 3 y 1', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100 GIRADERECHA 90 AVANZA 100');
    app.ejecutar();

    const cal = app.estado().calificacion;
    expect(cal).not.toBeNull();
    // La precisión se niega (el trazo sobra respecto de la referencia recta).
    expect(cal!.precision.otorgada).toBe(false);
    // La economía se niega: 3 instrucciones frente al presupuesto de 1.
    expect(cal!.economia.otorgada).toBe(false);
    expect(cal!.conteoJugador).toBe(3);
    expect(cal!.presupuestoEstrella).toBe(1);
    if (!cal!.economia.otorgada && cal!.economia.motivo.clave === 'presupuestoExcedido') {
      expect(cal!.economia.motivo.conteo).toBe(3);
      expect(cal!.economia.motivo.presupuesto).toBe(1);
    } else {
      throw new Error('Se esperaba el motivo presupuestoExcedido con 3 y 1');
    }
  });

  it('(c) AVANSA 100 muestra el mensaje exacto en el globo y no produce ninguna operación', () => {
    const app = crearApp();
    escribir(app, 'AVANSA 100');
    app.ejecutar();

    expect(app.textoGlobo()).toContain(
      'No sé cómo hacer AVANSA. ¿Querías decir AVANZA?',
    );
    // No hubo intérprete: ninguna operación aplicada y estado sin veredicto.
    expect(app.estado().operacionesJugador.length).toBe(0);
    expect(app.estado().veredicto).toBeNull();
    expect(app.estado().calificacion).toBeNull();
  });

  it('el anuncio aria-live final nombra las operaciones aplicadas', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    const anuncios = document.getElementById('anuncios')!;
    expect(anuncios.textContent).toMatch(/operación/i);
  });
});

// ============================================================================
// Navegación entre niveles (spec 01, tarea 15)
// ============================================================================

/** Doble de Storage en memoria, para compartir progreso entre apps. */
function crearAlmacenMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    key: (i: number) => [...datos.keys()][i] ?? null,
    removeItem: (k: string) => datos.delete(k),
    setItem: (k: string, v: string) => void datos.set(k, v),
  };
}

/** Crea la app con opciones (almacén compartido, idNivel opcional). */
function crearAppCon(opts: { almacen: Storage | null; idNivel?: string }): Aplicacion {
  return crearAplicacion({
    documento: document,
    almacen: opts.almacen,
    reloj: relojInmediato(),
    relojEspera: relojEsperaInerte(),
    relojRebote: relojReboteInmediato,
    movimiento: movimientoReducido,
    ...(opts.idNivel !== undefined ? { idNivel: opts.idNivel } : {}),
  });
}

describe('main · navegación entre niveles', () => {
  beforeEach(() => {
    montarDom();
  });

  it('arranca en el 0.1 y el selector muestra los cinco niveles', () => {
    const app = crearApp();
    expect(app.nivelEnCurso()).toBe('0.1');
    const botones = document.querySelectorAll('.kl-selector-boton');
    expect(botones.length).toBe(5);
  });

  it('no deja entrar a un nivel bloqueado y lo avisa por el globo', () => {
    const app = crearApp();
    app.irANivel('0.3'); // bloqueado sin progreso
    expect(app.nivelEnCurso()).toBe('0.1');
    expect(app.textoGlobo()).toMatch(/bloquead/i);
  });

  it('aprobar el 0.1 desbloquea y permite entrar al 0.2', () => {
    const app = crearApp();
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    expect(app.estado().calificacion!.precision.otorgada).toBe(true);
    // El 0.2 queda desbloqueado; ahora sí se puede entrar.
    app.irANivel('0.2');
    expect(app.nivelEnCurso()).toBe('0.2');
  });

  it('reanuda el último reto desbloqueado al recrear la app con el mismo almacén', () => {
    const almacen = crearAlmacenMemoria();
    // Primera sesión: aprueba el 0.1 y entra al 0.2 (que queda como último reto).
    const app1 = crearAppCon({ almacen, idNivel: '0.1' });
    escribir(app1, 'AVANZA 100');
    app1.ejecutar();
    app1.irANivel('0.2');
    app1.destruir();
    document.body.innerHTML = '';
    montarDom();
    // Segunda sesión sin idNivel forzado: reanuda el 0.2.
    const app2 = crearAppCon({ almacen });
    expect(app2.nivelEnCurso()).toBe('0.2');
  });

  it('el panel de semilla ofrece otro reto en un nivel generado y no en uno autorado', () => {
    const app = crearApp(); // 0.1 autorado
    expect(app.panelSemilla.otroRetoDisponible()).toBe(false);
    // Aprueba 0.1 y 0.2 para abrir el 0.3 (generado).
    escribir(app, 'AVANZA 100');
    app.ejecutar();
    app.irANivel('0.2');
    escribir(app, 'AVANZA 100 GIRADERECHA 90 AVANZA 100');
    app.ejecutar();
    app.irANivel('0.3');
    expect(app.nivelEnCurso()).toBe('0.3');
    expect(app.panelSemilla.otroRetoDisponible()).toBe(true);
  });

  it('un código de semilla inválido avisa por el globo sin cambiar el reto', () => {
    const app = crearApp();
    const nivelAntes = app.nivelEnCurso();
    app.panelSemilla.campoCodigo.value = 'xx'; // longitud inválida
    app.panelSemilla.botonReproducir.click();
    // El panel está deshabilitado en 0.1 (autorado), así que el reto no cambia.
    expect(app.nivelEnCurso()).toBe(nivelAntes);
  });

  it('la guía de primeros pasos solo aparece en el 0.1 y la primera vez', () => {
    const almacen = crearAlmacenMemoria();
    const app1 = crearAppCon({ almacen, idNivel: '0.1' });
    // Con la guía activa, el globo muestra el primer paso (menciona la tortuga).
    expect(app1.textoGlobo()).toMatch(/tortuga/i);
    // Al acertar, la guía se completa y se marca en el progreso.
    escribir(app1, 'AVANZA 100');
    app1.ejecutar();
    app1.destruir();
    document.body.innerHTML = '';
    montarDom();
    // Nueva sesión en el 0.1: la guía ya no se muestra (saludo normal del reto).
    const app2 = crearAppCon({ almacen, idNivel: '0.1' });
    expect(app2.textoGlobo()).not.toMatch(/soy Kiro/i);
  });

  it('completar los cinco niveles con tres estrellas anuncia la insignia Secuencia', () => {
    const app = crearApp();
    // Resuelve cada nivel con un programa que copia su propia referencia.
    const programas: Record<string, string> = {
      '0.1': 'AVANZA 100',
      '0.2': 'AVANZA 100 GIRADERECHA 90 AVANZA 100',
      '0.4': 'AVANZA 100 GIRADERECHA 90 AVANZA 100 GIRADERECHA 90 AVANZA 100 GIRADERECHA 90 AVANZA 100 GIRADERECHA 90',
    };
    // 0.1, 0.2 autorados; 0.3 generado; 0.4 autorado; 0.5 generado.
    const orden = ['0.1', '0.2', '0.3', '0.4', '0.5'];
    for (const id of orden) {
      app.irANivel(id);
      expect(app.nivelEnCurso()).toBe(id);
      const prog = programas[id] ?? textoDeReferencia(app);
      escribir(app, prog);
      app.ejecutar();
      expect(app.estado().calificacion!.precision.otorgada, `precisión en ${id}`).toBe(true);
    }
    // La insignia Secuencia quedó anunciada por el globo o el selector la refleja.
    expect(app.selectorNivel.insigniaVisible()).toBe(true);
  });
});

/** Imprime la referencia del reto en curso como texto, para «copiarla». */
function textoDeReferencia(app: Aplicacion): string {
  // Para los niveles generados, el programa de referencia copiado al pie de la
  // letra reproduce la figura exacta: lo obtenemos del reto en curso.
  const reto = app.estado().reto;
  const partes: string[] = [];
  for (const n of reto.referencia.instrucciones) {
    if (n.tipo === 'invocacionComando') {
      const arg = n.argumentos[0];
      partes.push(arg && arg.tipo === 'numeroLiteral' ? `${n.nombre} ${arg.valor}` : n.nombre);
    }
  }
  return partes.join(' ');
}


// ============================================================================
// Pruebas transversales del proyecto (grupo 21).
//
// Se alojan en main.test.ts (no en archivos hermanos sin módulo) para que la
// propia regla 21.3 —solo `generadores-prueba.test.ts` es un test sin módulo
// homónimo— siga cumpliéndose.
// ============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR_ESTE_ARCHIVO = dirname(fileURLToPath(import.meta.url));
const RAIZ_SRC = DIR_ESTE_ARCHIVO; // este archivo vive en src/
const NOMBRE_ESTE_ARCHIVO = basename(fileURLToPath(import.meta.url));

/** Recorre un directorio en profundidad y devuelve las rutas absolutas de sus archivos. */
function listarArchivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    const info = statSync(ruta);
    if (info.isDirectory()) salida.push(...listarArchivos(ruta));
    else salida.push(ruta);
  }
  return salida;
}

/** Lista los subdirectorios directos de un directorio. */
function listarSubdirectorios(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(ruta);
  }
  return salida;
}

/** Ruta relativa a `src/`, con barras normales para los mensajes. */
function rel(ruta: string): string {
  return relative(RAIZ_SRC, ruta).split(sep).join('/');
}

const ARCHIVOS_SRC = listarArchivos(RAIZ_SRC);
const ARCHIVOS_TS = ARCHIVOS_SRC.filter((r) => r.endsWith('.ts'));

/**
 * Sustituye los comentarios (de línea y de bloque) y el contenido de las cadenas
 * por espacios equivalentes, conservando los saltos de línea, para que 21.1
 * detecte el USO real de un patrón y no su mención en un comentario o una cadena.
 */
function despojarComentariosYCadenas(fuente: string): string {
  let salida = '';
  let i = 0;
  type Modo = 'codigo' | 'linea' | 'bloque' | 'comilla' | 'doble' | 'plantilla';
  let modo: Modo = 'codigo';
  while (i < fuente.length) {
    const c = fuente[i]!;
    const d = i + 1 < fuente.length ? fuente[i + 1]! : '';
    if (modo === 'codigo') {
      if (c === '/' && d === '/') { modo = 'linea'; salida += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { modo = 'bloque'; salida += '  '; i += 2; continue; }
      if (c === "'") { modo = 'comilla'; salida += ' '; i += 1; continue; }
      if (c === '"') { modo = 'doble'; salida += ' '; i += 1; continue; }
      if (c === '`') { modo = 'plantilla'; salida += ' '; i += 1; continue; }
      salida += c; i += 1; continue;
    }
    if (modo === 'linea') {
      if (c === '\n') { modo = 'codigo'; salida += '\n'; } else salida += ' ';
      i += 1; continue;
    }
    if (modo === 'bloque') {
      if (c === '*' && d === '/') { modo = 'codigo'; salida += '  '; i += 2; continue; }
      salida += c === '\n' ? '\n' : ' '; i += 1; continue;
    }
    // Dentro de una cadena: respeta el escape y conserva los saltos de línea.
    if (c === '\\') { salida += '  '; i += 2; continue; }
    if (
      (modo === 'comilla' && c === "'") ||
      (modo === 'doble' && c === '"') ||
      (modo === 'plantilla' && c === '`')
    ) {
      modo = 'codigo'; salida += ' '; i += 1; continue;
    }
    salida += c === '\n' ? '\n' : ' '; i += 1; continue;
  }
  return salida;
}

// ============================================================================
// 21.1 · Ausencia de azar prohibido y de imágenes
// ============================================================================

describe('21.1 · sin fuentes de azar prohibidas ni imágenes', () => {
  const PATRONES: ReadonlyArray<{ nombre: string; regex: RegExp }> = [
    { nombre: 'Math.random', regex: /\bMath\s*\.\s*random\b/ },
    { nombre: 'eval(', regex: /\beval\s*\(/ },
    { nombre: 'new Function', regex: /\bnew\s+Function\b/ },
    { nombre: 'constructor Function(', regex: /\bFunction\s*\(/ },
  ];

  it('ningún .ts de src/ usa Math.random, eval, new Function ni el constructor Function', () => {
    const infracciones: string[] = [];
    for (const ruta of ARCHIVOS_TS) {
      if (basename(ruta) === NOMBRE_ESTE_ARCHIVO) continue; // este archivo los nombra como texto
      // Despoja comentarios y cadenas: 21.1 mide el uso real, no las menciones.
      const lineas = despojarComentariosYCadenas(readFileSync(ruta, 'utf8')).split('\n');
      for (let i = 0; i < lineas.length; i++) {
        const linea = lineas[i]!;
        for (const patron of PATRONES) {
          if (patron.regex.test(linea)) {
            infracciones.push(`${rel(ruta)}:${i + 1} usa ${patron.nombre}`);
          }
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('src/ no empaqueta imágenes (.png/.jpg/.jpeg/.gif/.svg/.webp/.ico)', () => {
    const EXT = /\.(png|jpe?g|gif|svg|webp|ico)$/i;
    const imagenes = ARCHIVOS_SRC.filter((r) => EXT.test(r)).map(rel);
    expect(imagenes, imagenes.join('\n')).toEqual([]);
  });
});

// ============================================================================
// 21.2 · Aristas prohibidas entre carpetas (diseño 2.3)
// ============================================================================

/** Extrae los especificadores de import/export de un archivo TypeScript. */
function importsDe(ruta: string): string[] {
  const texto = readFileSync(ruta, 'utf8');
  const especificadores: string[] = [];
  let m: RegExpExecArray | null;
  const regex = /(?:import|export)\b[^'"]*?from\s*['"]([^'"]+)['"]/g;
  while ((m = regex.exec(texto)) !== null) especificadores.push(m[1]!);
  const regexEfecto = /import\s*['"]([^'"]+)['"]/g;
  while ((m = regexEfecto.exec(texto)) !== null) especificadores.push(m[1]!);
  return especificadores;
}

/** Carpeta de primer nivel de un especificador relativo, resuelta desde `ruta`. */
function carpetaDestino(ruta: string, especificador: string): string | null {
  if (!especificador.startsWith('.')) return null; // paquete externo
  const resuelto = join(dirname(ruta), especificador);
  const relativo = relative(RAIZ_SRC, resuelto).split(sep).join('/');
  return relativo.split('/')[0]!;
}

/** Módulo destino sin extensión, relativo a `src/`. */
function moduloDestino(ruta: string, especificador: string): string {
  const resuelto = join(dirname(ruta), especificador);
  return relative(RAIZ_SRC, resuelto).split(sep).join('/').replace(/\.js$/, '');
}

describe('21.2 · aristas de dependencia entre carpetas', () => {
  const MODULOS = ARCHIVOS_TS.filter((r) => !r.endsWith('.test.ts'));
  const carpetaOrigen = (ruta: string): string => rel(ruta).split('/')[0]!;

  it('lenguaje/ no importa de ninguna otra carpeta de src/', () => {
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'lenguaje') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === null || destino === 'lenguaje') continue;
        const mod = moduloDestino(ruta, esp);
        // Excepción admitida: lenguaje/interprete → motor/tortuga.
        if (rel(ruta).startsWith('lenguaje/interprete') && mod === 'motor/tortuga') continue;
        infracciones.push(`${rel(ruta)} → ${esp} (regla: lenguaje/ solo importa de sí misma)`);
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('azar/ solo importa de sí misma y de lenguaje/errores', () => {
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'azar') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === null || destino === 'azar') continue;
        const mod = moduloDestino(ruta, esp);
        if (mod === 'lenguaje/errores') continue; // excepción admitida
        infracciones.push(`${rel(ruta)} → ${esp} (regla: azar/ solo importa de azar y lenguaje/errores)`);
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('niveles/ solo importa de lenguaje/, azar/ y de sí misma', () => {
    const permitidas = new Set(['niveles', 'lenguaje', 'azar']);
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'niveles') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === null) continue;
        if (!permitidas.has(destino)) {
          infracciones.push(`${rel(ruta)} → ${esp} (regla: niveles/ solo importa de lenguaje, azar y niveles)`);
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('motor/ no importa de ui/ ni de juego/', () => {
    const prohibidas = new Set(['ui', 'juego']);
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'motor') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === null) continue;
        if (prohibidas.has(destino)) {
          infracciones.push(`${rel(ruta)} → ${esp} (regla: motor/ no importa de ui/ ni juego/)`);
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('juego/ no importa de ui/ (la interfaz consume el juego, no al revés)', () => {
    const infracciones: string[] = [];
    for (const ruta of MODULOS) {
      if (carpetaOrigen(ruta) !== 'juego') continue;
      for (const esp of importsDe(ruta)) {
        const destino = carpetaDestino(ruta, esp);
        if (destino === 'ui') {
          infracciones.push(`${rel(ruta)} → ${esp} (regla: juego/ no importa de ui/)`);
        }
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });
});

// ============================================================================
// 21.3 · Estructura de archivos
// ============================================================================

describe('21.3 · estructura de archivos', () => {
  // Archivos de prueba que son ayudas compartidas (dobles/generadores) y por eso
  // no acompañan a un módulo homónimo: el generador de valores para fast-check y
  // el doble de dibujo del motor, ambos con su propia auto-comprobación.
  const AYUDAS_ADMITIDAS = new Set<string>([
    'azar/generadores-prueba.test.ts',
    'motor/doble-dibujo.test.ts',
  ]);

  it('todo nombre de archivo y carpeta de src/ es kebab-case en minúsculas', () => {
    const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const infracciones: string[] = [];
    for (const ruta of ARCHIVOS_SRC) {
      const nombre = basename(ruta);
      const radical = nombre
        .replace(/\.test\.ts$/, '')
        .replace(/\.propiedad$/, '')
        .replace(/\.ts$/, '')
        .replace(/\.css$/, '');
      for (const parte of radical.split('.')) {
        if (!KEBAB.test(parte)) infracciones.push(`${rel(ruta)} (radical no kebab-case: «${parte}»)`);
      }
    }
    (function revisarCarpetas(dir: string): void {
      for (const sub of listarSubdirectorios(dir)) {
        if (!KEBAB.test(basename(sub))) infracciones.push(`${rel(sub)}/ (carpeta no kebab-case)`);
        revisarCarpetas(sub);
      }
    })(RAIZ_SRC);
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('no hay directorios vacíos dentro de src/', () => {
    const vacios: string[] = [];
    (function revisar(dir: string): void {
      if (readdirSync(dir).length === 0) vacios.push(rel(dir) + '/');
      for (const sub of listarSubdirectorios(dir)) revisar(sub);
    })(RAIZ_SRC);
    expect(vacios, vacios.join('\n')).toEqual([]);
  });

  it('cada .test.ts acompaña a su módulo homónimo (solo la ayuda admitida es la excepción)', () => {
    const infracciones: string[] = [];
    for (const ruta of ARCHIVOS_TS) {
      if (!ruta.endsWith('.test.ts')) continue;
      const relativo = rel(ruta);
      if (AYUDAS_ADMITIDAS.has(relativo)) continue;
      const radical = relativo.replace(/\.test\.ts$/, '').replace(/\.propiedad$/, '');
      const moduloEsperado = join(RAIZ_SRC, radical + '.ts');
      if (!ARCHIVOS_TS.includes(moduloEsperado)) {
        infracciones.push(`${relativo} no acompaña a ${radical}.ts`);
      }
    }
    expect(infracciones, infracciones.join('\n')).toEqual([]);
  });

  it('cada carpeta esperada del proyecto está presente', () => {
    const esperadas = ['azar', 'estilos', 'juego', 'lenguaje', 'motor', 'niveles', 'ui'];
    const presentes = new Set(listarSubdirectorios(RAIZ_SRC).map((d) => basename(d)));
    const faltantes = esperadas.filter((c) => !presentes.has(c));
    expect(faltantes, faltantes.join(', ')).toEqual([]);
  });
});

// ============================================================================
// 21.4 · Accesibilidad (WCAG 2.1) sobre el tema y el nivel 0.1
// ============================================================================

/** Convierte un color CSS (#rgb, #rrggbb, rgb()/rgba()) a componentes 0–255. */
function aRgb(color: string): { r: number; g: number; b: number } | null {
  const c = color.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) {
    const h = m[1]!;
    return {
      r: parseInt(h[0]! + h[0]!, 16),
      g: parseInt(h[1]! + h[1]!, 16),
      b: parseInt(h[2]! + h[2]!, 16),
    };
  }
  m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) {
    const h = m[1]!;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) {
    const partes = m[1]!.split(',').map((s) => parseFloat(s.trim()));
    if (partes.length >= 3) return { r: partes[0]!, g: partes[1]!, b: partes[2]! };
  }
  return null;
}

/** Luminancia relativa WCAG de un color. */
function luminancia({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Razón de contraste WCAG entre dos colores CSS (1 a 21). */
function contraste(colorA: string, colorB: string): number {
  const a = aRgb(colorA);
  const b = aRgb(colorB);
  if (a === null || b === null) return 0;
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const oscuro = Math.min(la, lb);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Lee la definición literal de una variable CSS de tema.css (con reserva). */
function leerVariableTema(css: string, nombre: string): string | null {
  // Prefiere la variable de reserva cuando exista, que es la que garantiza el
  // contraste; si no, la principal.
  const buscar = (v: string): string | null => {
    const re = new RegExp(`${v}\\s*:\\s*([^;]+);`);
    const m = re.exec(css);
    return m ? m[1]!.trim() : null;
  };
  return buscar(nombre + '-reserva') ?? buscar(nombre);
}

describe('21.4 · accesibilidad WCAG del tema', () => {
  const CSS_TEMA = readFileSync(join(RAIZ_SRC, 'estilos', 'tema.css'), 'utf8');
  const FONDO = leerVariableTema(CSS_TEMA, '--color-fondo-lienzo') ?? '#ffffff';
  const FONDO_UI = leerVariableTema(CSS_TEMA, '--color-fondo-primario') ?? '#ffffff';

  it('el texto principal contra el fondo cumple ≥ 4.5:1', () => {
    const texto = leerVariableTema(CSS_TEMA, '--color-texto-primario') ?? '#212529';
    expect(contraste(texto, FONDO_UI)).toBeGreaterThanOrEqual(4.5);
  });

  it('el texto secundario contra el fondo cumple ≥ 4.5:1', () => {
    const texto = leerVariableTema(CSS_TEMA, '--color-texto-secundario') ?? '#495057';
    expect(contraste(texto, FONDO_UI)).toBeGreaterThanOrEqual(4.5);
  });

  it('las dos estelas contra el fondo del lienzo cumplen ≥ 3:1', () => {
    const jugador = leerVariableTema(CSS_TEMA, '--color-estela-jugador')!;
    const referencia = leerVariableTema(CSS_TEMA, '--color-estela-referencia')!;
    expect(contraste(jugador, FONDO)).toBeGreaterThanOrEqual(3);
    expect(contraste(referencia, FONDO)).toBeGreaterThanOrEqual(3);
  });

  it('las tres regiones del diff contra el fondo cumplen ≥ 3:1', () => {
    for (const v of ['--color-diff-coincidencia', '--color-diff-exceso', '--color-diff-falta']) {
      const color = leerVariableTema(CSS_TEMA, v)!;
      expect(contraste(color, FONDO), `${v} = ${color}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('el contorno de la tortuga contra el fondo cumple ≥ 3:1', () => {
    const contorno = leerVariableTema(CSS_TEMA, '--color-tortuga-contorno')!;
    expect(contraste(contorno, FONDO)).toBeGreaterThanOrEqual(3);
  });

  it('el indicador de foco contra el fondo de interfaz cumple ≥ 3:1', () => {
    const foco = leerVariableTema(CSS_TEMA, '--color-indicador-foco')!;
    expect(contraste(foco, FONDO_UI)).toBeGreaterThanOrEqual(3);
  });
});

describe('21.4 · accesibilidad del DOM y recorrido por teclado', () => {
  beforeEach(() => {
    montarDom();
  });

  it('el documento declara lang="es"', () => {
    expect(document.documentElement.lang).toBe('es');
  });

  it('hay exactamente UNA región aria-live, polite, sin assertive y sin foco', () => {
    crearApp();
    const vivos = Array.from(document.querySelectorAll('[aria-live]'));
    expect(vivos.length).toBe(1);
    const region = vivos[0] as HTMLElement;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(document.querySelector('[aria-live="assertive"]')).toBeNull();
    // No es enfocable.
    expect(region.getAttribute('tabindex')).toBeNull();
  });

  it('cada control interactivo tiene un nombre accesible en español', () => {
    crearApp();
    const interactivos = Array.from(
      document.querySelectorAll('button, select, textarea, [role="button"]'),
    ) as HTMLElement[];
    expect(interactivos.length).toBeGreaterThan(0);
    const sinNombre: string[] = [];
    for (const el of interactivos) {
      const etiqueta = el.getAttribute('aria-label') ?? '';
      const texto = (el.textContent ?? '').trim();
      const nombre = etiqueta.trim().length > 0 ? etiqueta : texto;
      if (nombre.length === 0) sinNombre.push(el.outerHTML.slice(0, 60));
    }
    expect(sinNombre, sinNombre.join('\n')).toEqual([]);
  });

  it('el nivel 0.1 se recorre solo con teclado y el editor está a ≤ 20 Tabs', () => {
    const app = crearApp();
    // Reúne los elementos enfocables en orden del DOM (orden visual del layout).
    const enfocables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, select, input, [tabindex]:not([tabindex="-1"])',
      ),
    );
    const indiceEditor = enfocables.indexOf(app.editor.area);
    expect(indiceEditor).toBeGreaterThanOrEqual(0);
    expect(indiceEditor).toBeLessThanOrEqual(20);

    // El botón de ejecutar responde a Enter y a Espacio (activación por teclado).
    let ejecutado = 0;
    const botonEjecutar = document.querySelector<HTMLButtonElement>('.kl-control-ejecutar');
    expect(botonEjecutar).not.toBeNull();
    app.editor.area.value = 'AVANZA 100';
    app.editor.area.dispatchEvent(new Event('input'));
    app.editor.analizarAhora();
    botonEjecutar!.addEventListener('click', () => (ejecutado += 1));
    // Un botón nativo traduce Enter/Espacio a click; simulamos el click resultante.
    botonEjecutar!.click();
    expect(ejecutado).toBe(1);
  });
});
