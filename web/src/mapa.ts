// Un solo mapa para toda la app (crear varios es pesado en teléfonos sencillos).
// Cada pantalla deja un "hueco" y el mapa se coloca encima de él.
import maplibregl, { type GeoJSONSource, type Map as MapaML, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { prepararFuentes, protocolo } from './capas';
import { CENTRO_GTO, dentro, ultimaPosicion, type Punto } from './geo';
import { guardar, leer } from './almacen';

maplibregl.addProtocol('pmtiles', protocolo.tilev4);

export const COMBUSTIBLES: [string, string][] = [
  ['Pastizal', '#E8D36A'],
  ['Matorral y arbustivo', '#C8A46B'],
  ['Bosque de encino', '#86A85E'],
  ['Bosque de pino / pino-encino', '#3D7448'],
  ['Selva baja', '#A9BC63'],
  ['Agrícola', '#F1ECDD'],
  ['Humedal / halófila', '#8EC3D9'],
  ['No combustible', '#D8D8D8'],
];

export type IdCapa = 'combustibles' | 'brechas' | 'relieve' | 'pendiente' | 'calor' | 'regimen';
export const NOMBRE_CAPA: Record<IdCapa, string> = {
  combustibles: 'Combustibles', brechas: 'Brechas', relieve: 'Relieve', pendiente: 'Pendiente', calor: 'Calor', regimen: 'Régimen de fuego',
};
const CAPAS_ML: Record<IdCapa, string[]> = {
  combustibles: ['combustibles'],
  regimen: ['regimen'],
  brechas: ['cam-urb', 'cam-ter', 'cam-ver', 'cam-car'],
  relieve: ['relieve'],
  pendiente: ['pendiente'],
  calor: ['calor-halo', 'calor'],
};
let visibles: Record<IdCapa, boolean> = leer('capas-visibles', { combustibles: true, brechas: true, relieve: true, pendiente: false, calor: true, regimen: false });

let mapa: MapaML | null = null;
let listo: Promise<MapaML> | null = null;
const vacio = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });

function estilo(f: Record<string, string>): StyleSpecification {
  const v = (id: IdCapa) => (visibles[id] ? 'visible' : 'none');
  return {
    version: 8,
    sources: {
      v: { type: 'vector', url: f.capas, attribution: 'INEGI (USV Serie VII, RNC 2019, Marco Geoestadístico)' },
      r: { type: 'raster', url: f.relieve, tileSize: 256, attribution: 'Copernicus DEM GLO-30' },
      s: { type: 'raster', url: f.pendiente, tileSize: 256 },
      calor: { type: 'geojson', data: vacio(), attribution: 'NASA FIRMS' },
      perimetro: { type: 'geojson', data: vacio() },
      zonas: { type: 'geojson', data: vacio() },
      ruta: { type: 'geojson', data: vacio() },
      rutas: { type: 'geojson', data: vacio() },
      yo: { type: 'geojson', data: vacio() },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': '#E7EAE1' } },
      { id: 'combustibles', type: 'fill', source: 'v', 'source-layer': 'combustibles', layout: { visibility: v('combustibles') },
        paint: { 'fill-color': ['match', ['get', 'combustible'], ...COMBUSTIBLES.flat(), '#D8D8D8'] as never, 'fill-opacity': 0.85 } },
      { id: 'regimen', type: 'fill', source: 'v', 'source-layer': 'combustibles', layout: { visibility: v('regimen') },
        paint: { 'fill-color': ['match', ['get', 'regimen'], 'Adaptado / dependiente del fuego', '#3D7448', 'Sensible al fuego', '#B3261E', 'Uso humano (quemas agropecuarias)', '#E8D36A', '#D8D8D8'], 'fill-opacity': 0.7 } },
      { id: 'relieve', type: 'raster', source: 'r', layout: { visibility: v('relieve') }, paint: { 'raster-opacity': 0.55 } },
      { id: 'pendiente', type: 'raster', source: 's', layout: { visibility: v('pendiente') }, paint: { 'raster-opacity': 0.75 } },
      { id: 'agua', type: 'fill', source: 'v', 'source-layer': 'agua', paint: { 'fill-color': '#4F8FCC' } },
      { id: 'municipios', type: 'line', source: 'v', 'source-layer': 'limites', filter: ['==', 'nivel', 'municipio'], paint: { 'line-color': '#4A4A4A', 'line-width': 0.7, 'line-dasharray': [3, 2] } },
      { id: 'estado', type: 'line', source: 'v', 'source-layer': 'limites', filter: ['==', 'nivel', 'estado'], paint: { 'line-color': '#141414', 'line-width': 2 } },
      { id: 'cam-urb', type: 'line', source: 'v', 'source-layer': 'caminos', filter: ['==', 'clase', 'urbana'], layout: { visibility: v('brechas') }, paint: { 'line-color': '#8C8C8C', 'line-width': 0.7 } },
      { id: 'cam-ter', type: 'line', source: 'v', 'source-layer': 'caminos', filter: ['==', 'clase', 'terraceria'], layout: { visibility: v('brechas') },
        paint: { 'line-color': '#7A2E0E', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 3] } },
      { id: 'cam-ver', type: 'line', source: 'v', 'source-layer': 'caminos', filter: ['==', 'clase', 'vereda'], layout: { visibility: v('brechas') },
        paint: { 'line-color': '#7A2E0E', 'line-width': 2, 'line-dasharray': [1, 2] } },
      { id: 'cam-car', type: 'line', source: 'v', 'source-layer': 'caminos', filter: ['==', 'clase', 'carretera'], layout: { visibility: v('brechas') },
        paint: { 'line-color': '#141414', 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.8, 14, 4.5] } },
      { id: 'rutas-borde', type: 'line', source: 'rutas', paint: { 'line-color': '#FFFFFF', 'line-width': 8 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'rutas', type: 'line', source: 'rutas', paint: { 'line-color': '#1E7A46', 'line-width': 4.5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
      { id: 'ruta', type: 'line', source: 'ruta', paint: { 'line-color': '#1E7A46', 'line-width': 5, 'line-dasharray': [0.6, 1.6] }, layout: { 'line-cap': 'round' } },
      { id: 'perimetro-relleno', type: 'fill', source: 'perimetro', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#B3261E', 'fill-opacity': 0.2 } },
      { id: 'perimetro', type: 'line', source: 'perimetro', paint: { 'line-color': '#B3261E', 'line-width': 3.5 } },
      { id: 'zonas', type: 'circle', source: 'zonas', paint: { 'circle-radius': 11, 'circle-color': '#1E7A46', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } },
      { id: 'calor-halo', type: 'circle', source: 'calor', layout: { visibility: v('calor') },
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 6, 13, 16], 'circle-color': '#FF5A1F', 'circle-opacity': ['case', ['get', 'fija'], 0, ['interpolate', ['linear'], ['get', 'horas'], 0, 0.45, 24, 0.12]] } },
      { id: 'calor', type: 'circle', source: 'calor', layout: { visibility: v('calor') },
        paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 3, 13, 7], 'circle-color': ['case', ['get', 'fija'], '#8C8C8C', ['interpolate', ['linear'], ['get', 'horas'], 0, '#FF3D00', 12, '#FF8A3D', 48, '#9E7B6B']],
          'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 } },
      { id: 'yo-precision', type: 'circle', source: 'yo', paint: { 'circle-radius': 22, 'circle-color': '#1565C0', 'circle-opacity': 0.15 } },
      { id: 'yo', type: 'circle', source: 'yo', paint: { 'circle-radius': 8, 'circle-color': '#1565C0', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 3 } },
    ],
  };
}

export function obtenerMapa(): Promise<MapaML> {
  if (listo) return listo;
  listo = (async () => {
    const fuentes = await prepararFuentes();
    const p = ultimaPosicion() ?? CENTRO_GTO;
    const vista = leer<{ c: [number, number]; z: number } | null>('vista', null);
    const contenedor = document.getElementById('mapa')!;
    contenedor.hidden = false;
    mapa = new maplibregl.Map({
      container: contenedor, style: estilo(fuentes),
      center: vista?.c ?? [p.lon, p.lat], zoom: vista?.z ?? (ultimaPosicion() ? 11 : 7.4),
      minZoom: 6, maxZoom: 16, maxBounds: [[-103.5, 19.0], [-98.5, 22.8]],
      attributionControl: { compact: true }, fadeDuration: 0, pitchWithRotate: false, dragRotate: false,
    });
    mapa.touchZoomRotate.disableRotation();
    mapa.on('moveend', () => { const c = mapa!.getCenter(); guardar('vista', { c: [c.lng, c.lat], z: mapa!.getZoom() }); });
    await new Promise<void>((ok) => mapa!.once('load', () => ok()));
    // Créditos plegados para que no tapen el mapa (se abren con el botón ⓘ).
    contenedor.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    return mapa;
  })();
  return listo;
}

/** Coloca el mapa sobre el hueco de la pantalla actual, o lo oculta si es null. */
let observador: ResizeObserver | null = null;
export function colocarMapa(hueco: HTMLElement | null) {
  const cont = document.getElementById('mapa')!;
  observador?.disconnect();
  document.body.classList.toggle('con-mapa', !!hueco && !hueco.classList.contains('medio'));
  // Con el mapa a la vista, los toques en el hueco llegan al mapa (zoom con dos dedos) y no a la página.
  document.body.classList.toggle('mapa-activo', !!hueco);
  if (!hueco) { cont.style.visibility = 'hidden'; return; }
  const ajustar = () => {
    const r = hueco.getBoundingClientRect();
    Object.assign(cont.style, { visibility: 'visible', top: `${r.top + scrollY}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
    mapa?.resize();
  };
  ajustar();
  observador = new ResizeObserver(ajustar);
  observador.observe(hueco);
  void obtenerMapa().then(ajustar);
}

export function capaVisible(id: IdCapa) { return visibles[id]; }
export function alternarCapa(id: IdCapa, valor?: boolean) {
  visibles = { ...visibles, [id]: valor ?? !visibles[id] };
  if (id === 'regimen' && visibles.regimen) visibles.combustibles = false;
  if (id === 'combustibles' && visibles.combustibles) visibles.regimen = false;
  guardar('capas-visibles', visibles);
  if (!mapa) return;
  for (const [cid, capas] of Object.entries(CAPAS_ML)) for (const l of capas) mapa.setLayoutProperty(l, 'visibility', visibles[cid as IdCapa] ? 'visible' : 'none');
}

function fuente(id: string) { return mapa?.getSource(id) as GeoJSONSource | undefined; }
export async function ponerDatos(id: 'calor' | 'perimetro' | 'zonas' | 'ruta' | 'rutas' | 'yo', datos: GeoJSON.FeatureCollection) {
  await obtenerMapa();
  fuente(id)?.setData(datos);
}

export function puntoFC(p: Punto | null): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: p ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } }] : [] };
}

export async function centrar(p: Punto, zoom?: number) {
  const m = await obtenerMapa();
  m.easeTo({ center: [p.lon, p.lat], zoom: zoom ?? Math.max(m.getZoom(), 13), duration: 600 });
}

export async function encuadrar(pts: Punto[], relleno: number | { top: number; bottom: number; left: number; right: number } = 50) {
  const m = await obtenerMapa();
  if (pts.length < 2) { if (pts[0]) centrar(pts[0]); return; }
  const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat);
  m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: relleno, maxZoom: 16, duration: 500 });
}

/** Combustible y régimen bajo un punto (solo si esa zona está cargada en el mapa). */
export async function combustibleEn(p: Punto): Promise<{ combustible: string; regimen: string; veg: string } | null> {
  const m = await obtenerMapa();
  const px = m.project([p.lon, p.lat]);
  const f = m.queryRenderedFeatures(px, { layers: ['combustibles', 'regimen'].filter((l) => m.getLayoutProperty(l, 'visibility') !== 'none') })[0];
  if (f) return f.properties as { combustible: string; regimen: string; veg: string };
  const fs = m.querySourceFeatures('v', { sourceLayer: 'combustibles' });
  for (const g of fs) {
    if (g.geometry.type === 'Polygon' && dentro(p, g.geometry.coordinates)) return g.properties as never;
    if (g.geometry.type === 'MultiPolygon' && g.geometry.coordinates.some((c) => dentro(p, c))) return g.properties as never;
  }
  return null;
}
export function alTocarMapa(fn: ((p: Punto) => void) | null) {
  void obtenerMapa().then((m) => {
    m.off('click', manejador);
    tocar = fn;
    if (fn) m.on('click', manejador);
  });
}
let tocar: ((p: Punto) => void) | null = null;
function manejador(e: maplibregl.MapMouseEvent) { tocar?.({ lat: e.lngLat.lat, lon: e.lngLat.lng }); }
