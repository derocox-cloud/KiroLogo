export type TipoArgumento = 'numero' | 'palabra' | 'lista' | 'expresion' | 'color' | 'nombre';
export type Aridad = 0 | 1 | 2 | 3 | 'variable';
export type Mundo = 0 | 1 | 2 | 3 | 4 | 5;

export interface EntradaVocabulario {
  readonly nombre: string;                              // largo, MAYÚSCULAS sin acentos
  readonly abreviatura: string | null;
  readonly aridad: Aridad;
  readonly tiposArgumento: readonly TipoArgumento[];
  readonly mundo: Mundo;
  readonly descripcion: string;                         // español, 1 línea, ≤ 120 caracteres
  readonly ejemplo: string;
  readonly insercion: string;                           // texto que inserta el panel: nombre+' ', nombre, o ejemplo
}

// Tabla completa del vocabulario
export const VOCABULARIO: readonly EntradaVocabulario[] = [
  // Mundo 0
  {
    nombre: 'AVANZA',
    abreviatura: 'AV',
    aridad: 1,
    tiposArgumento: ['numero'],
    mundo: 0,
    descripcion: 'La tortuga camina hacia adelante los pasos que le digas.',
    ejemplo: 'AVANZA 100',
    insercion: 'AVANZA ',
  },
  {
    nombre: 'RETROCEDE',
    abreviatura: 'RE',
    aridad: 1,
    tiposArgumento: ['numero'],
    mundo: 0,
    descripcion: 'La tortuga camina hacia atrás sin cambiar de rumbo.',
    ejemplo: 'RETROCEDE 50',
    insercion: 'RETROCEDE ',
  },
  {
    nombre: 'GIRADERECHA',
    abreviatura: 'GD',
    aridad: 1,
    tiposArgumento: ['numero'],
    mundo: 0,
    descripcion: 'Gira a la derecha los grados que le digas.',
    ejemplo: 'GIRADERECHA 90',
    insercion: 'GIRADERECHA ',
  },
  {
    nombre: 'GIRAIZQUIERDA',
    abreviatura: 'GI',
    aridad: 1,
    tiposArgumento: ['numero'],
    mundo: 0,
    descripcion: 'Gira a la izquierda los grados que le digas.',
    ejemplo: 'GIRAIZQUIERDA 45',
    insercion: 'GIRAIZQUIERDA ',
  },
  {
    nombre: 'CENTRO',
    abreviatura: 'CE',
    aridad: 0,
    tiposArgumento: [],
    mundo: 0,
    descripcion: 'Vuelve al centro del lienzo mirando hacia arriba.',
    ejemplo: 'CENTRO',
    insercion: 'CENTRO',
  },
  {
    nombre: 'BORRAPANTALLA',
    abreviatura: 'BP',
    aridad: 0,
    tiposArgumento: [],
    mundo: 0,
    descripcion: 'Limpia el lienzo y vuelve al centro mirando hacia arriba.',
    ejemplo: 'BORRAPANTALLA',
    insercion: 'BORRAPANTALLA',
  },

  // Mundo 1: REPITE (bloqueado en mundo 0)
  {
    nombre: 'REPITE',
    abreviatura: 'RP',
    aridad: 2,
    tiposArgumento: ['numero', 'lista'],
    mundo: 1,
    descripcion: 'Repite una secuencia de comandos varias veces.',
    ejemplo: 'REPITE 4 [AVANZA 100 GIRADERECHA 90]',
    insercion: 'REPITE 4 [AVANZA 100 GIRADERECHA 90]',
  },

  // Mundo 2: comandos de lápiz y estructura (bloqueados)
  {
    nombre: 'SUBELAPIZ',
    abreviatura: 'SL',
    aridad: 0,
    tiposArgumento: [],
    mundo: 2,
    descripcion: 'Levanta el lápiz para mover la tortuga sin dibujar.',
    ejemplo: 'SUBELAPIZ',
    insercion: 'SUBELAPIZ',
  },
  {
    nombre: 'BAJALAPIZ',
    abreviatura: 'BL',
    aridad: 0,
    tiposArgumento: [],
    mundo: 2,
    descripcion: 'Baja el lápiz para dibujar al mover la tortuga.',
    ejemplo: 'BAJALAPIZ',
    insercion: 'BAJALAPIZ',
  },
  {
    nombre: 'PONCOLOR',
    abreviatura: 'PC',
    aridad: 1,
    tiposArgumento: ['color'],
    mundo: 2,
    descripcion: 'Cambia el color del trazo.',
    ejemplo: 'PONCOLOR "rojo',
    insercion: 'PONCOLOR "rojo',
  },
  {
    nombre: 'PONGROSOR',
    abreviatura: 'PG',
    aridad: 1,
    tiposArgumento: ['numero'],
    mundo: 2,
    descripcion: 'Cambia el grosor del trazo.',
    ejemplo: 'PONGROSOR 3',
    insercion: 'PONGROSOR ',
  },
  {
    nombre: 'RELLENA',
    abreviatura: 'RL',
    aridad: 1,
    tiposArgumento: ['color'],
    mundo: 2,
    descripcion: 'Rellena con un color la figura cerrada donde está la tortuga.',
    ejemplo: 'RELLENA "azul',
    insercion: 'RELLENA "azul',
  },
  {
    nombre: 'PARA',
    abreviatura: null,
    aridad: 'variable',
    tiposArgumento: ['nombre'],
    mundo: 2,
    descripcion: 'Le enseña a Kiro un comando nuevo con un nombre.',
    ejemplo: 'PARA cuadrado',
    insercion: 'PARA cuadrado',
  },
  {
    nombre: 'FIN',
    abreviatura: null,
    aridad: 0,
    tiposArgumento: [],
    mundo: 2,
    descripcion: 'Marca el final de un procedimiento.',
    ejemplo: 'FIN',
    insercion: 'FIN',
  },
  {
    nombre: 'OCULTATORTUGA',
    abreviatura: 'OT',
    aridad: 0,
    tiposArgumento: [],
    mundo: 2,
    descripcion: 'Oculta la tortuga de la pantalla.',
    ejemplo: 'OCULTATORTUGA',
    insercion: 'OCULTATORTUGA',
  },
  {
    nombre: 'MUESTRATORTUGA',
    abreviatura: 'MT',
    aridad: 0,
    tiposArgumento: [],
    mundo: 2,
    descripcion: 'Muestra la tortuga en la pantalla.',
    ejemplo: 'MUESTRATORTUGA',
    insercion: 'MUESTRATORTUGA',
  },

  // Mundo 3: no agrega vocabulario (anida el que ya hay)

  // Mundo 4: operaciones y escritura (bloqueadas)
  {
    nombre: 'SUMA',
    abreviatura: null,
    aridad: 2,
    tiposArgumento: ['numero', 'numero'],
    mundo: 4,
    descripcion: 'Suma dos números.',
    ejemplo: 'SUMA 5 3',
    insercion: 'SUMA 5 3',
  },
  {
    nombre: 'RESTA',
    abreviatura: null,
    aridad: 2,
    tiposArgumento: ['numero', 'numero'],
    mundo: 4,
    descripcion: 'Resta el segundo número del primero.',
    ejemplo: 'RESTA 10 4',
    insercion: 'RESTA 10 4',
  },
  {
    nombre: 'PRODUCTO',
    abreviatura: null,
    aridad: 2,
    tiposArgumento: ['numero', 'numero'],
    mundo: 4,
    descripcion: 'Multiplica dos números.',
    ejemplo: 'PRODUCTO 7 8',
    insercion: 'PRODUCTO 7 8',
  },
  {
    nombre: 'COCIENTE',
    abreviatura: null,
    aridad: 2,
    tiposArgumento: ['numero', 'numero'],
    mundo: 4,
    descripcion: 'Divide el primer número por el segundo.',
    ejemplo: 'COCIENTE 20 5',
    insercion: 'COCIENTE 20 5',
  },
  {
    nombre: 'RESTO',
    abreviatura: null,
    aridad: 2,
    tiposArgumento: ['numero', 'numero'],
    mundo: 4,
    descripcion: 'Calcula el resto de la división.',
    ejemplo: 'RESTO 17 5',
    insercion: 'RESTO 17 5',
  },
  {
    nombre: 'AZAR',
    abreviatura: null,
    aridad: 2,
    tiposArgumento: ['numero', 'numero'],
    mundo: 4,
    descripcion: 'Elige un número al azar entre dos límites.',
    ejemplo: 'AZAR 1 10',
    insercion: 'AZAR 1 10',
  },
  {
    nombre: 'ESCRIBE',
    abreviatura: 'ES',
    aridad: 1,
    tiposArgumento: ['palabra'],
    mundo: 4,
    descripcion: 'Escribe texto en la pantalla.',
    ejemplo: 'ESCRIBE "Hola"',
    insercion: 'ESCRIBE "Hola"',
  },
  {
    nombre: 'ROTULA',
    abreviatura: 'RO',
    aridad: 1,
    tiposArgumento: ['numero'],
    mundo: 4,
    descripcion: 'Escribe el valor de un número en la pantalla.',
    ejemplo: 'ROTULA 42',
    insercion: 'ROTULA ',
  },

  // Mundo 5: control de flujo (bloqueado)
  {
    nombre: 'SI',
    abreviatura: null,
    aridad: 2,
    tiposArgumento: ['expresion', 'lista'],
    mundo: 5,
    descripcion: 'Ejecuta comandos solo si una condición es verdadera.',
    ejemplo: 'SI 5 > 3 [AVANZA 100]',
    insercion: 'SI 5 > 3 [AVANZA 100]',
  },
  {
    nombre: 'SINO',
    abreviatura: null,
    aridad: 2,
    tiposArgumento: ['lista', 'lista'],
    mundo: 5,
    descripcion: 'Ejecuta unos comandos si es verdadero, otros si es falso.',
    ejemplo: 'SINO [AVANZA 100] [RETROCEDE 50]',
    insercion: 'SINO [AVANZA 100] [RETROCEDE 50]',
  },
  {
    nombre: 'ALTO',
    abreviatura: null,
    aridad: 0,
    tiposArgumento: [],
    mundo: 5,
    descripcion: 'Detiene la ejecución del programa.',
    ejemplo: 'ALTO',
    insercion: 'ALTO',
  },
  {
    nombre: 'DEVUELVE',
    abreviatura: 'DV',
    aridad: 1,
    tiposArgumento: ['numero'],
    mundo: 5,
    descripcion: 'Devuelve un valor desde un procedimiento.',
    ejemplo: 'DEVUELVE 10',
    insercion: 'DEVUELVE ',
  },
] as const;

/**
 * Normaliza una palabra convirtiendo a mayúsculas y reemplazando vocales acentuadas.
 * Preserva la `ñ` como `Ñ` y no usa normalize('NFD').
 * @param texto Palabra a normalizar
 * @returns Texto normalizado
 */
export function normalizarPalabra(texto: string): string {
  let resultado = '';
  for (const caracter of texto) {
    switch (caracter) {
      case 'á': case 'Á': resultado += 'A'; break;
      case 'é': case 'É': resultado += 'E'; break;
      case 'í': case 'Í': resultado += 'I'; break;
      case 'ó': case 'Ó': resultado += 'O'; break;
      case 'ú': case 'Ú': resultado += 'U'; break;
      case 'ü': case 'Ü': resultado += 'U'; break;
      case 'ñ': case 'Ñ': resultado += 'Ñ'; break;
      default: resultado += caracter.toUpperCase();
    }
  }
  return resultado;
}

export type ResultadoBusqueda =
  | { readonly hallada: true;  readonly entrada: EntradaVocabulario }
  | { readonly hallada: false };

/**
 * Busca un comando en el vocabulario comparando contra todas las entradas sin filtrar por mundo.
 * @param palabra Palabra a buscar (se normaliza automáticamente)
 * @returns Resultado explícito de búsqueda
 */
export function buscarComando(palabra: string): ResultadoBusqueda {
  const normalizada = normalizarPalabra(palabra);
  
  for (const entrada of VOCABULARIO) {
    if (normalizada === normalizarPalabra(entrada.nombre)) {
      return { hallada: true, entrada };
    }
    if (entrada.abreviatura !== null && normalizada === normalizarPalabra(entrada.abreviatura)) {
      return { hallada: true, entrada };
    }
  }
  
  return { hallada: false };
}

/**
 * Devuelve las entradas del vocabulario que pertenecen al mundo dado o mundos anteriores.
 * @param mundo Mundo máximo a incluir
 * @returns Entradas con mundo ≤ n, en el orden de declaración
 */
export function comandosDelMundo(mundo: Mundo): readonly EntradaVocabulario[] {
  return VOCABULARIO.filter(entrada => entrada.mundo <= mundo);
}