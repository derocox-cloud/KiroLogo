// Pruebas del registro de generadores.
import { describe, it, expect } from 'vitest';
import { buscarGenerador, idsGenerador } from './registro.js';
import { generarCamino } from './camino.js';
import { generarZigzag } from './zigzag.js';
import type { EntradaGenerador } from '../tipos.js';

describe('registro de generadores', () => {
  it('devuelve generarCamino para el id "camino"', () => {
    expect(buscarGenerador('camino')).toBe(generarCamino);
  });

  it('devuelve generarZigzag para el id "zigzag"', () => {
    expect(buscarGenerador('zigzag')).toBe(generarZigzag);
  });

  it('devuelve null para un id desconocido', () => {
    expect(buscarGenerador('poligono')).toBeNull();
    expect(buscarGenerador('')).toBeNull();
    expect(buscarGenerador('CAMINO')).toBeNull(); // distingue mayúsculas
  });

  it('idsGenerador lista los dos arquetipos de esta spec en orden', () => {
    expect(idsGenerador()).toEqual(['camino', 'zigzag']);
  });

  it('la función devuelta es invocable y produce un reto del arquetipo pedido', () => {
    // El camino usa giros de 90°; el zigzag, giros de 90° alternados. Comprobamos
    // que la función resuelta genera, en efecto, un programa resoluble.
    const entrada: EntradaGenerador = {
      semilla: 1,
      parametros: { tramosMin: 3, tramosMax: 5, largoMin: 80, largoMax: 160 },
      intentosMaximos: 200,
    };
    const generador = buscarGenerador('camino');
    expect(generador).not.toBeNull();
    const resultado = generador!(entrada);
    expect(resultado.exito).toBe(true);
    if (resultado.exito) {
      expect(resultado.referencia.tipo).toBe('programa');
      expect(resultado.referencia.instrucciones.length).toBeGreaterThan(0);
    }
  });
});
