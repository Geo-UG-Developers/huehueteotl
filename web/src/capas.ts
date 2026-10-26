// Capas sin conexión de Guanajuato (archivos PMTiles).
// Con señal se leen por partes desde GitHub Pages. Si el usuario las descarga, se guardan completas en el
// almacén del navegador (Cache Storage) y se leen desde ahí, sin red.
import { FileSource, PMTiles, Protocol } from 'pmtiles';

export type Capa = { id: 'capas' | 'relieve' | 'pendiente'; archivo: string; titulo: string; mb: number };

export const ARCHIVOS: Capa[] = [
  { id: 'capas', archivo: 'gto_capas.pmtiles', titulo: 'Combustibles, brechas, agua y límites', mb: 18 },
  { id: 'relieve', archivo: 'relieve.pmtiles', titulo: 'Relieve (sombreado)', mb: 27 },
  { id: 'pendiente', archivo: 'pendiente.pmtiles', titulo: 'Pendiente del terreno', mb: 7 },
];

const CACHE = 'huehue-capas-v1';
const BASE = import.meta.env.BASE_URL;
const urlDe = (c: Capa) => new URL(`${BASE}capas/${c.archivo}`, location.href).href;

export const protocolo = new Protocol();

/** Registra cada capa y devuelve la URL pmtiles:// que usa el estilo del mapa. */
export async function prepararFuentes(): Promise<Record<Capa['id'], string>> {
  const fuentes = {} as Record<Capa['id'], string>;
  let cache: Cache | null = null;
  try { cache = await caches.open(CACHE); } catch { /* navegador sin Cache Storage */ }
  for (const c of ARCHIVOS) {
    const guardado = cache ? await cache.match(urlDe(c)) : undefined;
    if (guardado) {
      const archivo = new File([await guardado.blob()], `local-${c.archivo}`);
      const p = new PMTiles(new FileSource(archivo));
      protocolo.add(p);
      fuentes[c.id] = `pmtiles://${p.source.getKey()}`;
    } else {
      fuentes[c.id] = `pmtiles://${urlDe(c)}`;
    }
  }
  return fuentes;
}

export async function descargadas(): Promise<Record<string, boolean>> {
  const r: Record<string, boolean> = {};
  try {
    const cache = await caches.open(CACHE);
    for (const c of ARCHIVOS) r[c.id] = !!(await cache.match(urlDe(c)));
  } catch { for (const c of ARCHIVOS) r[c.id] = false; }
  return r;
}

/** Descarga las capas que falten. avance(0..1, texto). */
export async function descargarTodo(avance: (f: number, txt: string) => void): Promise<void> {
  const cache = await caches.open(CACHE);
  const total = ARCHIVOS.reduce((s, c) => s + c.mb, 0);
  let hecho = 0;
  for (const c of ARCHIVOS) {
    if (await cache.match(urlDe(c))) { hecho += c.mb; avance(hecho / total, `${c.titulo}: ya estaba`); continue; }
    const r = await fetch(urlDe(c), { cache: 'no-store' });
    if (!r.ok || !r.body) throw new Error(`No se pudo descargar ${c.titulo} (${r.status}).`);
    const largo = Number(r.headers.get('content-length')) || c.mb * 1e6;
    const lector = r.body.getReader();
    const partes: Uint8Array[] = [];
    let recibido = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      partes.push(value); recibido += value.length;
      avance((hecho + (recibido / largo) * c.mb) / total, `${c.titulo}: ${(recibido / 1e6).toFixed(1)} de ${(largo / 1e6).toFixed(0)} MB`);
    }
    await cache.put(urlDe(c), new Response(new Blob(partes), { headers: { 'content-type': 'application/octet-stream' } }));
    hecho += c.mb;
  }
  try { await navigator.storage?.persist?.(); } catch { /* opcional */ }
  avance(1, 'Listo: los mapas funcionan sin señal.');
}

export async function borrarDescargas() {
  try { await caches.delete(CACHE); } catch { /* nada que borrar */ }
}
