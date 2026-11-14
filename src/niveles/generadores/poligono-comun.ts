// Piezas compartidas por los generadores del mundo 4 que usan `POLIGONO`
// (niveles 4.2 y 4.3). Produce AST con las expresiones sin evaluar.

import type { DefinicionProcedimiento, InvocacionProcedimiento } from '../../lenguaje/ast.js';
import { avanza, giro, repite, parametro, numero, operacion, definicion, llamada } from './comun.js';

/** Nombre del procedimiento compartido. */
export const NOMBRE_POLIGONO = 'POLIGONO';

/**
 * `PARA POLIGONO :lados :largo REPITE :lados [AVANZA :largo GIRADERECHA 360 / :lados] FIN`.
 * El giro queda como expresión `360 / :lados`, no como número: es la lección del nivel.
 * Las líneas siguen el orden del texto impreso (cabecera 1, REPITE 2, cuerpo 3 y 4).
 */
export function definicionPoligono(): DefinicionProcedimiento {
  const cuerpo = [
    repite(
      parametro('lados', 2),
      [avanza(parametro('largo', 3), 3), giro('GIRADERECHA', operacion('/', numero(360, 4), parametro('lados', 4), 4), 4)],
      2,
    ),
  ];
  return definicion(NOMBRE_POLIGONO, ['lados', 'largo'], cuerpo, 1);
}

/** `POLIGONO lados largo` en la línea indicada. */
export function llamadaPoligono(lados: number, largo: number, linea: number): InvocacionProcedimiento {
  return llamada(NOMBRE_POLIGONO, [numero(lados, linea), numero(largo, linea)], linea);
}
