// Pruebas de las insignias Secuencia (mundo 0), Iteración (mundo 1) y
// Descomposición (mundo 2), requisito 8 (specs 00-01) y requisito 11 (spec 03).
import { describe, it, expect } from 'vitest';
import { cargarProgreso, type Progreso } from './progreso.js';
import type { Calificacion } from './estrellas.js';
import {
  insigniaSecuenciaOtorgada,
  insigniaIteracionOtorgada,
  insigniaDescomposicionOtorgada,
  insigniaSimetriaOtorgada,
  insigniasDelMundo,
} from './insignias.js';
import { CATALOGO } from '../niveles/catalogo.js';

// ============================================================================
// Ayudas
// ============================================================================

const IDS = ['0.1', '0.2', '0.3', '0.4', '0.5'] as const;

/** Ids de los niveles del mundo 1, derivados del catálogo (no hardcodeados). */
const IDS_MUNDO_1 = CATALOGO.filter((n) => n.mundo === 1).map((n) => n.id);

/** Ids de los niveles del mundo 2, derivados del catálogo (no hardcodeados). */
const IDS_MUNDO_2 = CATALOGO.filter((n) => n.mundo === 2).map((n) => n.id);

/** Ids de los niveles del mundo 3, derivados del catálogo (no hardcodeados). */
const IDS_MUNDO_3 = CATALOGO.filter((n) => n.mundo === 3).map((n) => n.id);

function calif(p: boolean, e: boolean, a: boolean): Calificacion {
  const est = (o: boolean) => (o ? { otorgada: true as const } : { otorgada: false as const, motivo: { clave: 'sinPrecision' as const } });
  return { precision: est(p), economia: est(e), abstraccion: est(a), conteoJugador: 1, presupuestoEstrella: 1, mensajeAbstraccion: null };
}

/** Progreso con cada nivel dado completado con las tres estrellas. */
function conTresEstrellas(...ids: string[]): Progreso {
  const progreso = cargarProgreso(null);
  for (const id of ids) progreso.guardar(id, 1, calif(true, true, true), 1);
  return progreso;
}

// ============================================================================
// Otorgamiento
// ============================================================================

describe('insignia Secuencia', () => {
  it('se otorga con las tres estrellas en los cinco niveles del mundo 0', () => {
    const progreso = conTresEstrellas(...IDS);
    expect(insigniaSecuenciaOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(0, progreso)).toEqual(['secuencia']);
  });

  it('no se otorga si falta algún nivel por completo', () => {
    const progreso = conTresEstrellas('0.1', '0.2', '0.3', '0.4'); // falta el 0.5
    expect(insigniaSecuenciaOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(0, progreso)).toEqual([]);
  });

  it('no se otorga si a un nivel le falta una sola estrella', () => {
    // Cuatro niveles completos y el 0.3 con solo dos estrellas (falta abstracción).
    const parcial = cargarProgreso(null);
    for (const id of ['0.1', '0.2', '0.4', '0.5']) parcial.guardar(id, 1, calif(true, true, true), 1);
    parcial.guardar('0.3', 1, calif(true, true, false), 1);
    expect(insigniaSecuenciaOtorgada(parcial)).toBe(false);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaSecuenciaOtorgada(cargarProgreso(null))).toBe(false);
  });

  it('aprobar los cinco niveles solo con precisión no basta: exige las tres', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS) progreso.guardar(id, 1, calif(true, false, false), 1);
    expect(insigniaSecuenciaOtorgada(progreso)).toBe(false);
  });
});

// ============================================================================
// Insignia Iteración (mundo 1)
// ============================================================================

describe('insignia Iteración', () => {
  it('el catálogo tiene cinco niveles en el mundo 1', () => {
    expect(IDS_MUNDO_1).toHaveLength(5);
  });

  it('se otorga con las tres estrellas en todos los niveles del mundo 1', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_1);
    expect(insigniaIteracionOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(1, progreso)).toEqual(['iteracion']);
  });

  it('no se otorga si a un nivel le falta la estrella de abstracción', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS_MUNDO_1.slice(1)) progreso.guardar(id, 1, calif(true, true, true), 1);
    progreso.guardar(IDS_MUNDO_1[0]!, 1, calif(true, true, false), 1);
    expect(insigniaIteracionOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(1, progreso)).toEqual([]);
  });

  it('no se otorga si un nivel del mundo está sin jugar', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_1.slice(1)); // falta el primero
    expect(insigniaIteracionOtorgada(progreso)).toBe(false);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaIteracionOtorgada(cargarProgreso(null))).toBe(false);
  });
});

// ============================================================================
// Insignia Descomposición (mundo 2), requisito 11
// ============================================================================

describe('insignia Descomposición', () => {
  it('el catálogo tiene seis niveles en el mundo 2', () => {
    expect(IDS_MUNDO_2).toEqual(['2.1', '2.2', '2.3', '2.4', '2.5', '2.6']);
  });

  it('se otorga con las tres estrellas en todos los niveles del mundo 2 (R11.1)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_2);
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(2, progreso)).toEqual(['descomposicion']);
  });

  it('no se otorga si a un nivel le falta una sola estrella (R11.2)', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS_MUNDO_2.slice(1)) progreso.guardar(id, 1, calif(true, true, true), 1);
    // El 2.1 queda con precisión y economía pero sin abstracción.
    progreso.guardar(IDS_MUNDO_2[0]!, 1, calif(true, true, false), 1);
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(2, progreso)).toEqual([]);
  });

  it('no se otorga si un nivel del mundo está sin jugar (R11.2)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_2.slice(1)); // falta el primero
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(2, progreso)).toEqual([]);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaDescomposicionOtorgada(cargarProgreso(null))).toBe(false);
  });

  it('se mantiene otorgada exactamente una vez al recompletar el mundo (R11.5)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_2);
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(true);
    // "Recompletar" un nivel ya completo no crea una segunda instancia: la
    // insignia se deriva del progreso, así que sigue otorgada y sin duplicar.
    progreso.guardar(IDS_MUNDO_2[0]!, 1, calif(true, true, true), 1);
    expect(insigniaDescomposicionOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(2, progreso)).toEqual(['descomposicion']);
  });
});

// ============================================================================
// Insignia Simetría (mundo 3), requisito 8
// ============================================================================
// Property 16: La insignia Simetría se otorga si y solo si el mundo 3 tiene las
// tres estrellas en sus cuatro niveles.
// Validates: Requirements 8.1, 8.2
describe('insignia Simetría', () => {
  it('el catálogo tiene cuatro niveles en el mundo 3', () => {
    expect(IDS_MUNDO_3).toEqual(['3.1', '3.2', '3.3', '3.4']);
  });

  it('se otorga con las tres estrellas en los cuatro niveles del mundo 3 (R8.1)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_3);
    expect(insigniaSimetriaOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(3, progreso)).toEqual(['simetria']);
  });

  it('no se otorga si a un nivel le falta una sola estrella (R8.2)', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS_MUNDO_3.slice(1)) progreso.guardar(id, 1, calif(true, true, true), 1);
    // El 3.1 queda con precisión y economía pero sin abstracción.
    progreso.guardar(IDS_MUNDO_3[0]!, 1, calif(true, true, false), 1);
    expect(insigniaSimetriaOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(3, progreso)).toEqual([]);
  });

  it('no se otorga si un nivel del mundo está sin jugar (R8.2)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_3.slice(1)); // falta el primero
    expect(insigniaSimetriaOtorgada(progreso)).toBe(false);
    expect(insigniasDelMundo(3, progreso)).toEqual([]);
  });

  it('no se otorga sin ningún progreso (R8.2)', () => {
    expect(insigniaSimetriaOtorgada(cargarProgreso(null))).toBe(false);
  });

  it('es función pura: evaluar dos veces el mismo progreso da el mismo booleano (R8.3, R8.4)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_3);
    const primera = insigniaSimetriaOtorgada(progreso);
    const segunda = insigniaSimetriaOtorgada(progreso);
    expect(primera).toBe(true);
    expect(segunda).toBe(primera);
  });

  it('se mantiene otorgada exactamente una vez al recompletar el mundo (R8.3, R8.4)', () => {
    const progreso = conTresEstrellas(...IDS_MUNDO_3);
    expect(insigniaSimetriaOtorgada(progreso)).toBe(true);
    // "Recompletar" un nivel ya completo no crea una segunda instancia: la
    // insignia se deriva del progreso, así que sigue otorgada y sin duplicar.
    progreso.guardar(IDS_MUNDO_3[0]!, 1, calif(true, true, true), 1);
    expect(insigniaSimetriaOtorgada(progreso)).toBe(true);
    expect(insigniasDelMundo(3, progreso)).toEqual(['simetria']);
  });
});

// ============================================================================
describe('insignias · derivado del progreso y alcance', () => {
  it('reconstruir el progreso desde las mismas estrellas da el mismo otorgamiento', () => {
    const a = conTresEstrellas(...IDS);
    const b = conTresEstrellas(...[...IDS].reverse()); // otro orden de guardado
    expect(insigniaSecuenciaOtorgada(a)).toBe(insigniaSecuenciaOtorgada(b));
  });

  it('ningún mundo sin insignia declarada la otorga en esta spec', () => {
    // Mundos 4 y 5 no tienen insignia declarada todavía; aunque se completaran
    // sus niveles, insigniasDelMundo no devolvería nada para ellos.
    const progreso = conTresEstrellas(...IDS, ...IDS_MUNDO_1, ...IDS_MUNDO_2, ...IDS_MUNDO_3);
    for (const mundo of [4, 5]) {
      expect(insigniasDelMundo(mundo, progreso)).toEqual([]);
    }
  });
});

// ============================================================================
// Insignias transversales (spec 04, requisito 9)
// ============================================================================
// Property 17: El otorgamiento de toda insignia es función pura e idempotente
// del progreso.
// Property 18: Cada insignia transversal se deriva de su señal en el progreso.
// Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6

// Importadas aparte para no alterar el bloque de imports original del archivo.
import {
  insigniaMinimalistaOtorgada,
  insigniaDepuradorOtorgada,
  insigniaSinPistasOtorgada,
  insigniaBuenOjoOtorgada,
} from './insignias.js';

/** Diez ids de niveles reales del catálogo, para las reglas que cuentan diez. */
const DIEZ_IDS = CATALOGO.slice(0, 10).map((n) => n.id);

describe('insignia Minimalista (R9.2)', () => {
  it('se otorga con la estrella de economía en 10 niveles', () => {
    const progreso = cargarProgreso(null);
    for (const id of DIEZ_IDS) progreso.guardar(id, 1, calif(true, true, false), 1);
    expect(insigniaMinimalistaOtorgada(progreso)).toBe(true);
  });

  it('no se otorga con economía en solo 9 niveles', () => {
    const progreso = cargarProgreso(null);
    for (const id of DIEZ_IDS.slice(0, 9)) progreso.guardar(id, 1, calif(true, true, false), 1);
    expect(insigniaMinimalistaOtorgada(progreso)).toBe(false);
  });

  it('la precisión sin economía no cuenta para Minimalista', () => {
    const progreso = cargarProgreso(null);
    for (const id of DIEZ_IDS) progreso.guardar(id, 1, calif(true, false, false), 1);
    expect(insigniaMinimalistaOtorgada(progreso)).toBe(false);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaMinimalistaOtorgada(cargarProgreso(null))).toBe(false);
  });
});

describe('insignia Depurador (R9.1)', () => {
  it('se otorga con 5 niveles aprobados tras usar la reproducción en paralelo', () => {
    const progreso = cargarProgreso(null);
    progreso.marcarReproduccionParalelaUsada();
    for (const id of CATALOGO.slice(0, 5).map((n) => n.id)) {
      progreso.guardar(id, 1, calif(true, false, false), 1);
    }
    expect(insigniaDepuradorOtorgada(progreso)).toBe(true);
  });

  it('no se otorga si los 5 aprobados fueron antes de usar la reproducción', () => {
    const progreso = cargarProgreso(null);
    // Aprobados ANTES de marcar la reproducción: no cuentan.
    for (const id of CATALOGO.slice(0, 5).map((n) => n.id)) {
      progreso.guardar(id, 1, calif(true, false, false), 1);
    }
    progreso.marcarReproduccionParalelaUsada();
    expect(insigniaDepuradorOtorgada(progreso)).toBe(false);
  });

  it('no se otorga con solo 4 aprobaciones posteriores', () => {
    const progreso = cargarProgreso(null);
    progreso.marcarReproduccionParalelaUsada();
    for (const id of CATALOGO.slice(0, 4).map((n) => n.id)) {
      progreso.guardar(id, 1, calif(true, false, false), 1);
    }
    expect(insigniaDepuradorOtorgada(progreso)).toBe(false);
  });

  it('no se otorga sin haber usado nunca la reproducción en paralelo', () => {
    const progreso = cargarProgreso(null);
    for (const id of CATALOGO.slice(0, 6).map((n) => n.id)) {
      progreso.guardar(id, 1, calif(true, false, false), 1);
    }
    expect(insigniaDepuradorOtorgada(progreso)).toBe(false);
  });
});

describe('insignia Sin pistas (R9.3)', () => {
  it('se otorga al completar un mundo entero sin abrir ninguna pista', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS) progreso.guardar(id, 1, calif(true, false, false), 1); // mundo 0, sin pistas
    expect(insigniaSinPistasOtorgada(progreso)).toBe(true);
  });

  it('no se otorga si se abrió una pista en algún nivel del mundo completado', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS) progreso.guardar(id, 1, calif(true, false, false), 1);
    progreso.marcarPistaAbierta('0.3');
    expect(insigniaSinPistasOtorgada(progreso)).toBe(false);
  });

  it('no se otorga si el mundo no está completo, aunque no haya pistas abiertas', () => {
    const progreso = cargarProgreso(null);
    for (const id of IDS.slice(0, 4)) progreso.guardar(id, 1, calif(true, false, false), 1); // falta 0.5
    expect(insigniaSinPistasOtorgada(progreso)).toBe(false);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaSinPistasOtorgada(cargarProgreso(null))).toBe(false);
  });
});

describe('insignia Buen ojo (R9.4)', () => {
  it('se otorga al resolver un nivel con la demostración vista una sola vez', () => {
    const progreso = cargarProgreso(null);
    progreso.registrarVistaDemostracion('0.1');
    progreso.guardar('0.1', 1, calif(true, false, false), 1);
    expect(insigniaBuenOjoOtorgada(progreso)).toBe(true);
  });

  it('no se otorga si se vio la demostración dos veces', () => {
    const progreso = cargarProgreso(null);
    progreso.registrarVistaDemostracion('0.1');
    progreso.registrarVistaDemostracion('0.1');
    progreso.guardar('0.1', 1, calif(true, false, false), 1);
    expect(insigniaBuenOjoOtorgada(progreso)).toBe(false);
  });

  it('no se otorga si el nivel visto una vez no fue resuelto con precisión', () => {
    const progreso = cargarProgreso(null);
    progreso.registrarVistaDemostracion('0.1');
    progreso.guardar('0.1', 1, calif(false, false, false), 1);
    expect(insigniaBuenOjoOtorgada(progreso)).toBe(false);
  });

  it('no se otorga sin ningún progreso', () => {
    expect(insigniaBuenOjoOtorgada(cargarProgreso(null))).toBe(false);
  });
});

// ============================================================================
// Property 17: pureza e idempotencia de TODAS las insignias (R9.5, R9.6)
// ============================================================================
describe('Property 17: el otorgamiento es función pura e idempotente del progreso', () => {
  it('evaluar dos veces cada transversal sobre el mismo progreso da el mismo booleano', () => {
    const progreso = cargarProgreso(null);
    // Un progreso que dispara las cuatro transversales a la vez.
    progreso.marcarReproduccionParalelaUsada();
    for (const id of DIEZ_IDS) progreso.guardar(id, 1, calif(true, true, false), 1); // economía ×10, aprobados posteriores
    progreso.registrarVistaDemostracion('0.1'); // una sola vista
    for (const id of IDS) progreso.guardar(id, 1, calif(true, true, false), 1); // mundo 0 completo sin pistas

    for (const predicado of [
      insigniaMinimalistaOtorgada,
      insigniaDepuradorOtorgada,
      insigniaSinPistasOtorgada,
      insigniaBuenOjoOtorgada,
    ]) {
      const primera = predicado(progreso);
      const segunda = predicado(progreso);
      expect(segunda).toBe(primera);
    }
  });

  it('reconstruir el progreso desde las mismas señales da el mismo otorgamiento (sin segunda instancia)', () => {
    const construir = () => {
      const p = cargarProgreso(null);
      p.marcarReproduccionParalelaUsada();
      for (const id of DIEZ_IDS) p.guardar(id, 1, calif(true, true, false), 1);
      return p;
    };
    expect(insigniaMinimalistaOtorgada(construir())).toBe(insigniaMinimalistaOtorgada(construir()));
    expect(insigniaDepuradorOtorgada(construir())).toBe(insigniaDepuradorOtorgada(construir()));
  });
});

// ============================================================================
// Tipos separados de las insignias (spec 04, requisito 14) y predicado derivado
// ============================================================================
// Property 16: El otorgamiento de toda insignia es función pura e idempotente
// del progreso.
// Property 17: Cada insignia transversal se deriva de su señal en el progreso.
// Validates: Requirements 8.3, 8.4, 9.1 a 9.6, 11.5 a 11.8, 14.2, 14.3, 14.5

import {
  INSIGNIAS_DE_CONCEPTO,
  MUNDO_DE_INSIGNIA,
  insigniasTransversalesOtorgadas,
  type IdInsignia,
  type IdInsigniaDeConcepto,
  type IdInsigniaTransversal,
} from './insignias.js';

describe('tipos de insignia separados (R14)', () => {
  it('las claves de MUNDO_DE_INSIGNIA igualan INSIGNIAS_DE_CONCEPTO (R14.2)', () => {
    expect(Object.keys(MUNDO_DE_INSIGNIA).sort()).toEqual([...INSIGNIAS_DE_CONCEPTO].sort());
    expect(new Set(INSIGNIAS_DE_CONCEPTO).size).toBe(INSIGNIAS_DE_CONCEPTO.length);
  });

  it('consultar el mundo de una transversal no compila (R14.3)', () => {
    // @ts-expect-error las transversales no tienen mundo: la clave no existe en el Record.
    const mundo: number | undefined = MUNDO_DE_INSIGNIA['depurador'];
    expect(mundo).toBeUndefined();
  });

  it('una transversal no es un IdInsigniaDeConcepto y la unión admite ambas (R14.1)', () => {
    // @ts-expect-error 'depurador' es transversal, no de concepto.
    const mala: IdInsigniaDeConcepto = 'depurador';
    const concepto: IdInsignia = 'simetria';
    const transversal: IdInsignia = 'buenOjo';
    expect([mala, concepto, transversal]).toHaveLength(3);
  });

  it('los resultados de insigniasDelMundo no cambian (R14.5)', () => {
    const todo = conTresEstrellas(...IDS, ...IDS_MUNDO_1, ...IDS_MUNDO_2, ...IDS_MUNDO_3);
    expect([0, 1, 2, 3, 4, 5].map((m) => insigniasDelMundo(m, todo))).toEqual([
      ['secuencia'],
      ['iteracion'],
      ['descomposicion'],
      ['simetria'],
      [],
      [],
    ]);
    const parcial = conTresEstrellas(...IDS, ...IDS_MUNDO_3.slice(0, -1));
    expect(insigniasDelMundo(0, parcial)).toEqual(['secuencia']);
    expect(insigniasDelMundo(3, parcial)).toEqual([]);
    expect(insigniasDelMundo(0, cargarProgreso(null))).toEqual([]);
  });
});

describe('insigniasTransversalesOtorgadas (R9.5, R9.6, R11.10)', () => {
  it('sin progreso no otorga ninguna', () => {
    expect(insigniasTransversalesOtorgadas(cargarProgreso(null))).toEqual([]);
  });

  it('reúne exactamente las transversales cuyo predicado es verdadero', () => {
    const progreso = cargarProgreso(null);
    progreso.registrarVistaDemostracion('0.1');
    progreso.guardar('0.1', 1, calif(true, false, false), 1);
    expect(insigniasTransversalesOtorgadas(progreso)).toEqual(['buenOjo']);
  });

  it('otorga las cuatro a la vez cuando todas las señales están presentes', () => {
    const progreso = cargarProgreso(null);
    progreso.marcarReproduccionParalelaUsada();
    for (const id of DIEZ_IDS) progreso.guardar(id, 1, calif(true, true, false), 1);
    progreso.registrarVistaDemostracion('0.1');
    const esperado: IdInsigniaTransversal[] = ['depurador', 'minimalista', 'sinPistas', 'buenOjo'];
    expect([...insigniasTransversalesOtorgadas(progreso)].sort()).toEqual([...esperado].sort());
  });

  it('es pura e idempotente: no muta el progreso y repetirla da lo mismo', () => {
    const progreso = cargarProgreso(null);
    progreso.marcarReproduccionParalelaUsada();
    for (const id of DIEZ_IDS) progreso.guardar(id, 1, calif(true, true, false), 1);
    const antes = JSON.stringify(progreso);
    const primera = insigniasTransversalesOtorgadas(progreso);
    const segunda = insigniasTransversalesOtorgadas(progreso);
    expect(segunda).toEqual(primera);
    expect(JSON.stringify(progreso)).toBe(antes);
  });
});
