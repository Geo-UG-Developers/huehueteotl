// GPS y cálculos geográficos ligeros (sin librerías).
import { guardar, leer } from './almacen';

export type Punto = { lat: number; lon: number; precision?: number; t?: number };

// Centro aproximado de Guanajuato, por si nunca hubo GPS.
export const CENTRO_GTO: Punto = { lat: 20.92, lon: -101.0 };

export function ultimaPosicion(): Punto | null {
  return leer<Punto | null>('ultima-pos', null);
}

function aPunto(p: GeolocationPosition): Punto {
  const pt = { lat: p.coords.latitude, lon: p.coords.longitude, precision: Math.round(p.coords.accuracy), t: p.timestamp };
  guardar('ultima-pos', pt);
  return pt;
}

export function posicionActual(maxEdadMs = 60_000): Promise<Punto> {
  return new Promise((ok, mal) => {
    if (!('geolocation' in navigator)) { mal(new Error('Este teléfono no tiene GPS disponible.')); return; }
    navigator.geolocation.getCurrentPosition((p) => ok(aPunto(p)), (e) => mal(new Error(errorGps(e))),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: maxEdadMs });
  });
}

export function seguirPosicion(cada: (p: Punto) => void, error?: (msg: string) => void): () => void {
  if (!('geolocation' in navigator)) { error?.('Este teléfono no tiene GPS disponible.'); return () => {}; }
  const id = navigator.geolocation.watchPosition((p) => cada(aPunto(p)), (e) => error?.(errorGps(e)),
    { enableHighAccuracy: true, maximumAge: 2_000, timeout: 30_000 });
  return () => navigator.geolocation.clearWatch(id);
}

function errorGps(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return 'Permite el acceso a tu ubicación en los ajustes del navegador.';
  if (e.code === e.TIMEOUT) return 'El GPS tardó demasiado. Sal a cielo abierto e inténtalo de nuevo.';
  return 'No se pudo obtener la ubicación.';
}

const R = 6_371_000;
const rad = (g: number) => (g * Math.PI) / 180;

/** Distancia en metros. */
export function distancia(a: Punto, b: Punto): number {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Rumbo de a hacia b en grados (0 = norte, sentido horario). */
export function rumbo(a: Punto, b: Punto): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** Área en m² de un polígono (se cierra solo). Proyección local, precisa para incendios de unos km. */
export function area(pts: Punto[]): number {
  if (pts.length < 3) return 0;
  const lat0 = rad(pts.reduce((s, p) => s + p.lat, 0) / pts.length);
  const xy = pts.map((p) => [rad(p.lon) * R * Math.cos(lat0), rad(p.lat) * R]);
  let s = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i], [x2, y2] = xy[(i + 1) % xy.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function longitud(pts: Punto[], cerrar = false): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += distancia(pts[i - 1], pts[i]);
  if (cerrar && pts.length > 2) s += distancia(pts[pts.length - 1], pts[0]);
  return s;
}

const PUNTOS_CARDINALES = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
export function cardinal(grados: number): string {
  return PUNTOS_CARDINALES[Math.round(((grados % 360) + 360) % 360 / 45) % 8];
}
const NOMBRES = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
export function cardinalLargo(grados: number): string {
  return NOMBRES[Math.round(((grados % 360) + 360) % 360 / 45) % 8];
}

export function fmtDistancia(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

export function fmtCoord(p: Punto): string {
  return `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
}

/** Punto dentro de polígono (anillos GeoJSON [lon, lat]). */
export function dentro(p: Punto, anillos: number[][][]): boolean {
  let adentro = false;
  for (const anillo of anillos) {
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
      if ((yi > p.lat) !== (yj > p.lat) && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) adentro = !adentro;
    }
  }
  return adentro;
}
