// Puntos de calor satelitales. GitHub los descarga de NASA FIRMS cada hora (ver .github/workflows/web.yml)
// y los publica en datos/calor.geojson. La app solo lee ese archivo pequeño.
import { distancia, type Punto } from './geo';

export type PuntoCalor = { lat: number; lon: number; fecha: string; satelite: string; confianza: string; frp: number; horas: number };
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
      confianza: String(p.confianza), frp: Number(p.frp) || 0, horas: Math.max(0, (ahora - Date.parse(String(p.fecha))) / 3.6e6) };
  });
  return { generado: fc.generado ?? null, nota: fc.nota, puntos };
}

export function calorFC(c: Calor): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: c.puntos.map((p) => ({ type: 'Feature', properties: { horas: p.horas, satelite: p.satelite }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })) };
}

/** Puntos recientes (≤ 24 h) cercanos a una posición, ordenados por distancia. */
export function cercanos(c: Calor, yo: Punto, radioKm = 25) {
  return c.puntos.filter((p) => p.horas <= 24).map((p) => ({ ...p, dist: distancia(yo, p) }))
    .filter((p) => p.dist <= radioKm * 1000).sort((a, b) => a.dist - b.dist);
}
