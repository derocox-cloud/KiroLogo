/**
 * Tiempo máximo de las regresiones de tres estrellas sobre 200 semillas.
 *
 * La validación geométrica es costosa (giro sobre máscara 800×800) y cada una
 * de estas regresiones tarda decenas de segundos; con la suite corriendo en
 * paralelo o en un equipo lento, 120 s dejaba poco margen (issue #27). Vive
 * aquí para que los mundos 2 y 3 compartan un solo valor.
 */
export const TIMEOUT_TRES_ESTRELLAS = 180_000;
