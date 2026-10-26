// Puntos de calor satelitales. GitHub los descarga de NASA FIRMS cada hora (ver .github/workflows/web.yml)
// y los publica en datos/calor.geojson. La app solo lee ese archivo pequeño.
import { distancia, type Punto } from './geo';

export type PuntoCalor = { lat: number; lon: number; fecha: string; satelite: string; confianza: string; frp: number; horas: number; fija: string | null };

/** Fuentes de calor fijas (industria) que el satélite detecta seguido y no son incendios. Agregar aquí las que se identifiquen. */
export const FUENTES_FIJAS: { nombre: string; lat: number; lon: number; radioKm: number }[] = [
  { nombre: 'Refinería de Salamanca (Pemex) y termoeléctrica', lat: 20.5816, lon: -101.1797, radioKm: 3 },
];
const fijaEn = (p: Punto) => FUENTES_FIJAS.find((f) => distancia(p, f) <= f.radioKm * 1000)?.nombre ?? null;
export type Calor = { generado: string | null; nota?: string; puntos: PuntoCalor[] };

const URL_CALOR = `${import.meta.env.BASE_URL}datos/calor.geojson`;

export async function obtenerCalor(): Promise<Calor> {
  const r = await fetch(URL_CALOR, { cache: 'no-cache' });
  if (!r.ok) throw new Error('Sin datos de puntos de calor.');
  const fc = await r.json();
  const ahora = Date.now();
  const puntos: PuntoCalor[] = (fc.features ?? []).map((f: GeoJSON.Feature<GeoJSON.Point>) => {
    const p = f.properties as Record<string, string | number>;
    return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], fecha: String(p.fecha), satelite: String(p.satelite),
      confianza: String(p.confianza), frp: Number(p.frp) || 0, horas: Math.max(0, (ahora - Date.parse(String(p.fecha))) / 3.6e6),
      fija: fijaEn({ lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }) };
  });
  return { generado: fc.generado ?? null, nota: fc.nota, puntos };
}

export function calorFC(c: Calor): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: c.puntos.map((p) => ({ type: 'Feature', properties: { horas: p.horas, satelite: p.satelite, fija: !!p.fija }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })) };
}

/** Puntos recientes (≤ 24 h) cercanos a una posición, ordenados por distancia. No incluye fuentes industriales. */
export function cercanos(c: Calor, yo: Punto, radioKm = 25) {
  return c.puntos.filter((p) => p.horas <= 24 && !p.fija).map((p) => ({ ...p, dist: distancia(yo, p) }))
    .filter((p) => p.dist <= radioKm * 1000).sort((a, b) => a.dist - b.dist);
}
