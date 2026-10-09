// Panel de semilla de KiroLogo.
//
// Franja fija junto a los controles —nunca sobre los lienzos— que muestra el
// código de semilla del reto en curso y, en los niveles generados, ofrece pedir
// otro reto o reproducir uno a partir de un código. En los autorados muestra el
// código marcado por texto como no rejugable, sin la acción de otro reto.
//
// El panel no conoce el intérprete ni el reto: pide a `main.ts` por callbacks.
// La validación del código es responsabilidad de `main.ts` (decodifica con
// `codigo-semilla.ts` y, si falla, muestra el error del catálogo por el globo);
// el panel solo entrega el texto introducido.

// ============================================================================
// Callbacks hacia main.ts
// ============================================================================

export interface CallbacksPanelSemilla {
  /** Pide a `main.ts` resolver el mismo nivel con una semilla nueva. */
  readonly pedirOtroReto: () => void;
  /** Pide a `main.ts` reproducir el reto del código introducido. */
  readonly reproducirCodigo: (codigo: string) => void;
}

export interface DependenciasPanelSemilla {
  readonly contenedor: HTMLElement;
  readonly callbacks: CallbacksPanelSemilla;
}

// ============================================================================
// Estado que el panel presenta de un reto
// ============================================================================

export interface RetoEnPanel {
  /** Código de 7 caracteres de la semilla efectiva del reto. */
  readonly codigoSemilla: string;
  /** true si el nivel es generado (admite otro reto y reproducir código). */
  readonly generado: boolean;
}

// ============================================================================
// Interfaz pública
// ============================================================================

export interface PanelSemilla {
  readonly raiz: HTMLElement;
  /** Campo de solo lectura con el código de la semilla. */
  readonly salidaCodigo: HTMLOutputElement;
  /** Botón «Otro reto» (presente siempre; deshabilitado en autorados). */
  readonly botonOtroReto: HTMLButtonElement;
  /** Campo donde el jugador pega un código a reproducir. */
  readonly campoCodigo: HTMLInputElement;
  /** Botón «Reproducir código». */
  readonly botonReproducir: HTMLButtonElement;
  /** Presenta un reto: actualiza el código y el estado de las acciones. */
  presentarReto(reto: RetoEnPanel): void;
  /** Código mostrado en curso. */
  codigoMostrado(): string;
  /** ¿Está disponible la acción de otro reto? */
  otroRetoDisponible(): boolean;
}

// ============================================================================
// Textos accesibles (español)
// ============================================================================

const ETIQUETA_CODIGO = 'Código del reto';
const ETIQUETA_OTRO_RETO = 'Pedir otro reto';
const ETIQUETA_CAMPO = 'Escribe un código de reto para reproducirlo';
const ETIQUETA_REPRODUCIR = 'Reproducir el reto del código';
/** Texto que marca un nivel autorado como no rejugable con otra semilla. */
const TEXTO_NO_REJUGABLE = 'Este reto es fijo: siempre es el mismo.';
const TEXTO_GENERADO = 'Puedes pedir otro reto o reproducir uno con su código.';

// ============================================================================
// Creación
// ============================================================================

/**
 * Crea el panel de semilla sobre un contenedor. Construye su propio DOM con
 * clases `kl-*`, con nombres accesibles en español, e integrado en el orden de
 * foco sin atraparlo (son controles nativos). El estado no disponible se
 * comunica con `disabled`, una clase y texto, nunca solo con color.
 */
export function crearPanelSemilla(deps: DependenciasPanelSemilla): PanelSemilla {
  const doc = deps.contenedor.ownerDocument;
  const cb = deps.callbacks;

  const raiz = doc.createElement('div');
  raiz.className = 'kl-panel-semilla';
  raiz.setAttribute('role', 'group');
  raiz.setAttribute('aria-label', 'Semilla del reto');

  // --- Código de solo lectura ---
  const filaCodigo = doc.createElement('div');
  filaCodigo.className = 'kl-panel-semilla-codigo';

  const etiquetaCodigo = doc.createElement('span');
  etiquetaCodigo.className = 'kl-panel-semilla-etiqueta';
  etiquetaCodigo.textContent = `${ETIQUETA_CODIGO}:`;
  const idEtiqueta = 'kl-panel-semilla-etiqueta';
  etiquetaCodigo.id = idEtiqueta;

  const salidaCodigo = doc.createElement('output');
  salidaCodigo.className = 'kl-panel-semilla-valor';
  salidaCodigo.setAttribute('aria-labelledby', idEtiqueta);
  // Seleccionable con teclado para copiar.
  salidaCodigo.tabIndex = 0;

  filaCodigo.appendChild(etiquetaCodigo);
  filaCodigo.appendChild(salidaCodigo);
  raiz.appendChild(filaCodigo);

  // --- Nota de estado (texto, no solo color) ---
  const nota = doc.createElement('p');
  nota.className = 'kl-panel-semilla-nota';
  raiz.appendChild(nota);

  // --- Acción: otro reto ---
  const botonOtroReto = doc.createElement('button');
  botonOtroReto.type = 'button';
  botonOtroReto.className = 'kl-panel-semilla-otro';
  botonOtroReto.textContent = 'Otro reto';
  botonOtroReto.setAttribute('aria-label', ETIQUETA_OTRO_RETO);
  botonOtroReto.addEventListener('click', () => {
    if (botonOtroReto.disabled) return;
    cb.pedirOtroReto();
  });
  raiz.appendChild(botonOtroReto);

  // --- Acción: reproducir un código ---
  const filaReproducir = doc.createElement('div');
  filaReproducir.className = 'kl-panel-semilla-reproducir';

  const campoCodigo = doc.createElement('input');
  campoCodigo.type = 'text';
  campoCodigo.className = 'kl-panel-semilla-campo';
  campoCodigo.setAttribute('aria-label', ETIQUETA_CAMPO);
  campoCodigo.autocomplete = 'off';
  campoCodigo.maxLength = 7;

  const botonReproducir = doc.createElement('button');
  botonReproducir.type = 'button';
  botonReproducir.className = 'kl-panel-semilla-reproducir-boton';
  botonReproducir.textContent = 'Reproducir código';
  botonReproducir.setAttribute('aria-label', ETIQUETA_REPRODUCIR);
  botonReproducir.addEventListener('click', () => {
    if (botonReproducir.disabled) return;
    cb.reproducirCodigo(campoCodigo.value);
  });

  filaReproducir.appendChild(campoCodigo);
  filaReproducir.appendChild(botonReproducir);
  raiz.appendChild(filaReproducir);

  deps.contenedor.appendChild(raiz);

  // --- Estado interno ---
  let generadoActual = false;

  function fijarDisponibilidadGenerado(generado: boolean): void {
    generadoActual = generado;
    // En autorados, pedir otro reto y reproducir no tienen sentido.
    for (const b of [botonOtroReto, botonReproducir]) {
      b.disabled = !generado;
      b.classList.toggle('kl-deshabilitada', !generado);
      b.setAttribute('aria-disabled', generado ? 'false' : 'true');
    }
    campoCodigo.disabled = !generado;
    nota.textContent = generado ? TEXTO_GENERADO : TEXTO_NO_REJUGABLE;
  }

  return {
    raiz,
    salidaCodigo,
    botonOtroReto,
    campoCodigo,
    botonReproducir,

    presentarReto(reto: RetoEnPanel): void {
      salidaCodigo.textContent = reto.codigoSemilla;
      salidaCodigo.value = reto.codigoSemilla;
      fijarDisponibilidadGenerado(reto.generado);
    },

    codigoMostrado(): string {
      return salidaCodigo.textContent ?? '';
    },

    otroRetoDisponible(): boolean {
      return generadoActual && !botonOtroReto.disabled;
    },
  };
}
