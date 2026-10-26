// Revisión del terreno de un camino hacia la zona segura: pendiente (capa sin señal), desnivel, viento y perímetro.
// No calcula rutas: solo avisa de peligros sobre la línea o el recorrido que se le da.
import { pmtilesDe } from './capas';
import { cambioDeViento, climaGuardado, haciaDonde } from './clima';
import { cardinalLargo, dentro, difRumbo, distancia, fmtDistancia, intermedio, longitud, rumbo, type Punto } from './geo';
import { ultimoPerimetro } from './perimetro';
import { fmtHora } from './ui';

export type Aviso = { nivel: 'peligro' | 'precaucion' | 'info'; texto: string };
export type Revision = { avisos: Aviso[]; subida: number | null; minutos: number };

// ---------- Pendiente: se lee de pendiente.pmtiles (teselas WebP, zoom 12 ≈ 35 m por píxel).
const Z = 12;
const CLASES: [number, [number, number, number]][] = [[15, [242, 200, 0]], [30, [240, 130, 0]], [45, [210, 60, 20]], [60, [140, 20, 60]]];
const teselas = new Map<string, Promise<ImageData | null>>();

function tesela(x: number, y: number): Promise<ImageData | null> {
  const k = `${x}/${y}`;
  if (!teselas.has(k)) teselas.set(k, (async () => {
    try {
      const t = await (await pmtilesDe('pendiente')).getZxy(Z, x, y);
      if (!t) return null; // sin tesela = terreno plano (< 15 %)
      const bmp = await createImageBitmap(new Blob([t.data], { type: 'image/webp' }));
      const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
      const cx = cv.getContext('2d', { willReadFrequently: true })!; cx.drawImage(bmp, 0, 0);
      return cx.getImageData(0, 0, bmp.width, bmp.height);
    } catch { teselas.delete(k); throw new Error('sin capa'); }
  })());
  return teselas.get(k)!;
}

/** Clase de pendiente en un punto: 0 (< 15 %), 15, 30, 45 o 60 (más de 60 %). */
export async function pendienteEn(p: Punto): Promise<number> {
  const n = 2 ** Z;
  const gx = ((p.lon + 180) / 360) * n;
  const gy = ((1 - Math.asinh(Math.tan((p.lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const img = await tesela(Math.floor(gx), Math.floor(gy));
  if (!img) return 0;
  const px = Math.min(img.width - 1, Math.floor((gx % 1) * img.width)), py = Math.min(img.height - 1, Math.floor((gy % 1) * img.height));
  const i = (py * img.width + px) * 4, [r, g, b, a] = [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
  if (a < 60) return 0;
  let mejor = 0, dmin = Infinity;
  for (const [min, [cr, cg, cb]] of CLASES) { const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2; if (d < dmin) { dmin = d; mejor = min; } }
  return mejor;
}

/** Puntos cada `paso` metros a lo largo de un recorrido. */
function muestrear(pts: Punto[], paso: number, max = 240): Punto[] {
  const total = longitud(pts);
  const cada = Math.max(paso, total / max);
  const salida: Punto[] = [pts[0]];
  let acumulado = 0, siguiente = cada;
  for (let i = 1; i < pts.length; i++) {
    const d = distancia(pts[i - 1], pts[i]);
    while (d > 0 && acumulado + d >= siguiente) { salida.push(intermedio(pts[i - 1], pts[i], (siguiente - acumulado) / d)); siguiente += cada; }
    acumulado += d;
  }
  salida.push(pts[pts.length - 1]);
  return salida;
}

// ---------- Desnivel: con señal se consulta la elevación (Open-Meteo, modelo Copernicus 90 m). Sin señal, la altitud del GPS.
const elevaciones = new Map<string, number[]>();
async function perfil(pts: Punto[]): Promise<number[] | null> {
  const m = muestrear(pts, 50, 60);
  const k = m.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|');
  if (elevaciones.has(k)) return elevaciones.get(k)!;
  if (!navigator.onLine) return null;
  try {
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${m.map((p) => p.lat.toFixed(5)).join(',')}&longitude=${m.map((p) => p.lon.toFixed(5)).join(',')}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const e = (await r.json()).elevation as number[];
    if (!Array.isArray(e) || e.length !== m.length) return null;
    elevaciones.set(k, e); return e;
  } catch { return null; }
}
function subidaDe(alturas: number[], umbral = 3): number {
  let s = 0, base = alturas[0];
  for (const h of alturas.slice(1)) { if (Math.abs(h - base) >= umbral) { if (h > base) s += h - base; base = h; } }
  return Math.round(s);
}

/** Minutos a pie: 3 km/h en monte + 1 min por cada 10 m de subida (regla de Naismith). Es un mínimo, no una promesa. */
export const minutosEstimados = (metros: number, subida: number | null) => Math.max(1, Math.round(metros / 50 + (subida ?? 0) / 10));

/**
 * Revisa un recorrido (línea recta [yo, zona] o una ruta grabada) y devuelve avisos de peligro.
 * `recta` indica que no es una ruta real sino la dirección en línea recta.
 */
export async function revisarCamino(pts: Punto[], recta: boolean): Promise<Revision> {
  const avisos: Aviso[] = [];
  const total = longitud(pts);
  const ini = pts[0], fin = pts[pts.length - 1];

  // Pendiente a lo largo del camino.
  try {
    const m = muestrear(pts, 25);
    const clases = await Promise.all(m.map(pendienteEn));
    const tramo = total / Math.max(1, m.length - 1);
    const fuerte = clases.filter((c) => c >= 30).length * tramo, muyFuerte = clases.filter((c) => c >= 45).length * tramo;
    if (muyFuerte >= 50) avisos.push({ nivel: 'peligro', texto: `${recta ? 'La línea cruza' : 'La ruta pasa por'} unos ${fmtDistancia(muyFuerte)} de pendiente mayor a 45 %.` });
    else if (fuerte >= 75) avisos.push({ nivel: 'precaucion', texto: `${recta ? 'La línea cruza' : 'La ruta pasa por'} unos ${fmtDistancia(fuerte)} de pendiente mayor a 30 %.` });
  } catch {
    avisos.push({ nivel: 'info', texto: 'No se pudo revisar la pendiente: descarga los mapas sin señal o conéctate.' });
  }

  // Desnivel: ¿la zona segura queda cuesta arriba?
  let subida: number | null = null, neto: number | null = null;
  const alturas = await perfil(pts);
  if (alturas) { subida = subidaDe(alturas); neto = Math.round(alturas[alturas.length - 1] - alturas[0]); }
  else {
    const conAlt = pts.filter((p) => p.alt != null);
    if (conAlt.length >= 2 && (recta ? ini.alt != null && fin.alt != null : conAlt.length >= pts.length / 2)) {
      subida = subidaDe(conAlt.map((p) => p.alt!), 8); neto = conAlt[conAlt.length - 1].alt! - conAlt[0].alt!;
    }
  }
  if (neto != null && neto >= 30) avisos.push({ nivel: neto >= 80 ? 'peligro' : 'precaucion', texto: `La zona segura queda ${neto} m cuesta arriba. El fuego sube más rápido que una persona: tardarás más de lo estimado.` });
  else if (subida != null && subida >= 40) avisos.push({ nivel: 'precaucion', texto: `Hay unos ${subida} m de subida en el camino.` });

  // Viento: caminar hacia donde el viento empuja el fuego.
  const c = climaGuardado();
  if (c && total > 30) {
    const empuja = haciaDonde(c.actual.dir), dir = rumbo(ini, fin);
    if (c.actual.viento >= 8 && difRumbo(dir, empuja) <= 45)
      avisos.push({ nivel: c.actual.viento >= 20 ? 'peligro' : 'precaucion', texto: `Caminas hacia el ${cardinalLargo(dir)}, hacia donde el viento (${Math.round(c.actual.viento)} km/h) empuja el fuego. Si el fuego queda detrás de ti, puede alcanzarte.` });
    const cambio = cambioDeViento(c);
    if (cambio && difRumbo(dir, haciaDonde(cambio.a)) <= 45)
      avisos.push({ nivel: 'precaucion', texto: `A las ${fmtHora(cambio.hora)} el viento gira y empujará el fuego hacia el ${cardinalLargo(haciaDonde(cambio.a))}, en la dirección de este camino.` });
  }

  // Perímetro grabado en las últimas 12 h: ¿el camino lo cruza?
  const per = ultimoPerimetro();
  if (per && Date.now() - per.fin < 12 * 3.6e6 && per.puntos.length >= 3) {
    const anillo = [[...per.puntos.map((p) => [p.lon, p.lat]), [per.puntos[0].lon, per.puntos[0].lat]]];
    if (muestrear(pts, 20).slice(1, -1).some((p) => dentro(p, anillo)))
      avisos.push({ nivel: 'peligro', texto: `${recta ? 'La línea cruza' : 'La ruta cruza'} el perímetro del incendio que grabaste (${per.nombre}).` });
  }

  return { avisos, subida, minutos: minutosEstimados(total, subida) };
}

export function avisosHTML(avisos: Aviso[]): string {
  if (!avisos.length) return '<li class="aviso-ok">Sin alertas de pendiente, desnivel ni viento. Revisa tú mismo el terreno.</li>';
  return avisos.map((a) => `<li class="aviso-${a.nivel}">${a.texto}</li>`).join('');
}
