// Clima en el punto del incendio con Open-Meteo (gratis, sin llave). El último resultado se guarda para verlo sin señal.
import { guardar, leer } from './almacen';
import type { Punto } from './geo';

export type Hora = { hora: string; temp: number; hr: number; viento: number; dir: number; rachas: number; lluvia: number };
export type Clima = {
  lugar: Punto; obtenido: number;
  actual: { temp: number; hr: number; viento: number; dir: number; rachas: number; lluvia24: number };
  horas: Hora[];
};
export type Regla = { temp: boolean; hr: boolean; viento: boolean; cumplidas: number; nivel: 'normal' | 'precaucion' | 'peligro' };
export type CambioViento = { hora: string; de: number; a: number; giro: number } | null;

const API = 'https://api.open-meteo.com/v1/forecast';

export function climaGuardado(): Clima | null { return leer<Clima | null>('clima', null); }

export async function obtenerClima(p: Punto): Promise<Clima> {
  const q = new URLSearchParams({
    latitude: p.lat.toFixed(3), longitude: p.lon.toFixed(3),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation',
    past_hours: '24', forecast_hours: '12', wind_speed_unit: 'kmh', timezone: 'America/Mexico_City',
  });
  const r = await fetch(`${API}?${q}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.reason ? `Open-Meteo: ${d.reason}` : 'No se pudo consultar el clima.');
  const h = d.hourly;
  const ahora = d.current.time as string;
  const horas: Hora[] = [];
  let lluvia24 = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (h.time[i] <= ahora) { lluvia24 += h.precipitation[i] ?? 0; continue; }
    horas.push({ hora: h.time[i], temp: h.temperature_2m[i], hr: h.relative_humidity_2m[i], viento: h.wind_speed_10m[i],
      dir: h.wind_direction_10m[i], rachas: h.wind_gusts_10m[i], lluvia: h.precipitation[i] });
  }
  const c = d.current;
  const clima: Clima = {
    lugar: { lat: p.lat, lon: p.lon }, obtenido: Date.now(), horas,
    actual: { temp: c.temperature_2m, hr: c.relative_humidity_2m, viento: c.wind_speed_10m, dir: c.wind_direction_10m, rachas: c.wind_gusts_10m, lluvia24: Math.round(lluvia24 * 10) / 10 },
  };
  guardar('clima', clima);
  return clima;
}

/** Regla 30-30-30: temperatura > 30 °C, humedad < 30 %, viento > 30 km/h. */
export function regla303030(a: Clima['actual']): Regla {
  const temp = a.temp > 30, hr = a.hr < 30, viento = a.viento > 30;
  const cumplidas = Number(temp) + Number(hr) + Number(viento);
  return { temp, hr, viento, cumplidas, nivel: cumplidas >= 3 ? 'peligro' : cumplidas === 2 ? 'precaucion' : 'normal' };
}

/** Primer giro de viento de 45° o más en las próximas 6 horas (con viento de al menos 8 km/h). */
export function cambioDeViento(c: Clima): CambioViento {
  const base = c.actual.dir;
  for (const h of c.horas.slice(0, 6)) {
    const giro = Math.abs(((h.dir - base + 540) % 360) - 180);
    if (giro >= 45 && h.viento >= 8) return { hora: h.hora, de: base, a: h.dir, giro: Math.round(giro) };
  }
  return null;
}

/** Hacia dónde empuja el viento (la dirección meteorológica indica de dónde viene). */
export const haciaDonde = (dir: number) => (dir + 180) % 360;

export function hace(ms: number): string {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}
