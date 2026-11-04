import { normalizarPalabra } from './vocabulario.js';

/**
 * Un color del mundo 2. Puede venir de un nombre del catálogo (ya resuelto a su
 * terna RGB) o de una terna `[r g b]` escrita directamente. El campo `nombre`
 * guarda el nombre canónico en español cuando vino por nombre, y es `null`
 * cuando vino de una terna RGB: así el renderizador y las pruebas pueden
 * distinguir el origen sin perder la información.
 */
export interface Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly nombre: string | null;
}

/**
 * Los once nombres válidos del mundo 2, en el orden exacto en que aparecen en el
 * mensaje de error `colorInvalido`. El orden es parte del contrato: la lista que
 * ve el jugador al equivocarse se construye recorriendo este arreglo.
 */
export const NOMBRES_COLOR: readonly string[] = [
  'rojo',
  'azul',
  'verde',
  'amarillo',
  'naranja',
  'morado',
  'rosa',
  'café',
  'negro',
  'blanco',
  'gris',
];

/**
 * Terna RGB de cada nombre del catálogo. Se eligen valores convencionales y
 * reconocibles (los nombres web usuales) para que el color dibujado coincida con
 * la expectativa del jugador. `negro` es el color por omisión del trazo: el
 * intérprete arranca el estado decorativo con él.
 */
const RGB_POR_NOMBRE: Readonly<Record<string, readonly [number, number, number]>> = {
  rojo: [255, 0, 0],
  azul: [0, 0, 255],
  verde: [0, 128, 0],
  amarillo: [255, 255, 0],
  naranja: [255, 165, 0],
  morado: [128, 0, 128],
  rosa: [255, 192, 203],
  café: [139, 69, 19],
  negro: [0, 0, 0],
  blanco: [255, 255, 255],
  gris: [128, 128, 128],
};

export type ResultadoColor =
  | { readonly ok: true; readonly color: Color }
  | { readonly ok: false };

/**
 * Resuelve una palabra de color a un `Color`. Normaliza acentos y mayúsculas con
 * `normalizarPalabra`, de modo que `cafe`, `CAFÉ`, `Café` y `café` resuelven al
 * mismo color. En caso de éxito devuelve el nombre canónico del catálogo (con su
 * acento, p. ej. `café`), no la palabra que escribió el jugador.
 */
export function resolverColorPorNombre(palabra: string): ResultadoColor {
  const buscada = normalizarPalabra(palabra);
  for (const nombre of NOMBRES_COLOR) {
    const rgb = RGB_POR_NOMBRE[nombre];
    if (rgb !== undefined && normalizarPalabra(nombre) === buscada) {
      const [r, g, b] = rgb;
      return { ok: true, color: { r, g, b, nombre } };
    }
  }
  return { ok: false };
}

/**
 * Resuelve una terna `[r g b]` a un `Color`. Solo es válida si los tres son
 * enteros en [0, 255]; una componente fraccionaria o fuera de rango descarta la
 * terna completa. El `nombre` queda en `null` porque no vino del catálogo.
 */
export function resolverColorRGB(r: number, g: number, b: number): ResultadoColor {
  if (!esComponenteValida(r) || !esComponenteValida(g) || !esComponenteValida(b)) {
    return { ok: false };
  }
  return { ok: true, color: { r, g, b, nombre: null } };
}

function esComponenteValida(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 0 && valor <= 255;
}
