// Rutas de escape grabadas: la brigada camina con GPS desde la zona de trabajo hasta la zona segura.
// La ruta queda guardada en el teléfono y se dibuja en el mapa con su distancia y el tiempo que realmente tomó.
import { guardar, leer, nuevoId } from './almacen';
import { distancia, fmtDistancia, longitud, seguirPosicion, type Punto } from './geo';
import { centrar, colocarMapa, encuadrar, ponerDatos, puntoFC } from './mapa';
import { agregarZona, zonas } from './seguridad';
import { avisosHTML, revisarCamino } from './terreno';
import { $, app, aviso, bajarArchivo, cabecera, esc, fmtFecha, IC, pantallaEncendida } from './ui';

export type RutaEscape = { id: string; nombre: string; inicio: number; fin: number; puntos: Punto[]; m: number; min: number; zonaId: string | null };

const PRECISION_MAX = 30; // m
const PASO_MIN = 5;       // m
const RADIO_ZONA = 150;   // m: si al llegar hay una zona segura a menos de esto, la ruta se une a ella

type Grabacion = { inicio: number; puntos: Punto[]; pausado: boolean; pausas: number; desde: number | null };
let grabando: Grabacion | null = leer<Grabacion | null>('ruta-actual', null);
let detener: (() => void) | null = null;
let ultimaPrecision: number | null = null;

export function rutasEscape(): RutaEscape[] { return leer<RutaEscape[]>('rutas-escape', []); }
export function rutasFC(): GeoJSON.FeatureCollection {
  const lista = rutasEscape().map((r) => r.puntos);
  if (grabando && grabando.puntos.length >= 2) lista.push(grabando.puntos);
  return { type: 'FeatureCollection', features: lista.filter((p) => p.length >= 2).map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: p.map((x) => [x.lon, x.lat]) } })) };
}

/** Ruta grabada más cercana a `yo`, con lo que falta desde el punto más cercano de la ruta hasta la zona segura. */
export function rutaMasCercana(yo: Punto | null) {
  if (!yo) return null;
  let mejor: { r: RutaEscape; i: number; d: number } | null = null;
  for (const r of rutasEscape()) r.puntos.forEach((p, i) => { const d = distancia(yo, p); if (!mejor || d < mejor.d) mejor = { r, i, d }; });
  if (!mejor) return null;
  const { r, i, d } = mejor as { r: RutaEscape; i: number; d: number };
  const resto = r.puntos.slice(i);
  const m = longitud(resto);
  return { r, aRuta: d, inicio: r.puntos[i], resto, m, min: Math.max(1, Math.round(r.min * (r.m ? m / r.m : 1))) };
}

const minutos = (g: Grabacion) => Math.round((Date.now() - g.inicio - g.pausas - (g.pausado && g.desde ? Date.now() - g.desde : 0)) / 60000);

export function pantallaRutaEscape() {
  const g = grabando;
  const pts = g?.puntos ?? [];
  const lista = rutasEscape();
  app().innerHTML = `
  ${cabecera('Ruta de escape', { atras: '#/seguridad', derecha: g ? (g.pausado ? '<span class="chip-red">En pausa</span>' : '<span class="chip-red grabando"><i class="punto rojo"></i>Grabando</span>') : '' })}
  <div class="hueco-mapa medio" id="hueco">
    <div class="sobre-mapa arriba-izq"><span class="pildora">${ultimaPrecision ? `Precisión GPS ±${ultimaPrecision} m` : g ? 'Esperando GPS…' : 'Rutas grabadas en verde'}</span></div>
  </div>
  <main class="panel-inferior">
    ${g ? `
    <div class="rejilla3">
      <div class="dato"><small>Recorrido</small><b>${fmtDistancia(longitud(pts))}</b></div>
      <div class="dato"><small>Tiempo real</small><b>${minutos(g)} min</b></div>
      <div class="dato"><small>Puntos</small><b>${pts.length}</b></div>
    </div>
    <p class="tenue">Camina a paso normal, con el equipo puesto, por donde la brigada saldría de verdad. Al llegar a la zona segura toca el botón verde.</p>
    <button class="btn verde grande" id="llegue" ${pts.length < 2 ? 'disabled' : ''}>Llegué a la zona segura</button>
    <div class="botones2">
      <button class="btn borde" id="pausa">${g.pausado ? 'Continuar' : 'Pausar'}</button>
      <button class="btn-texto" id="descartar">Descartar</button>
    </div>`
    : `
    <div class="tarjeta">
      <b>Cómo grabar una ruta de escape</b>
      <p>1. Ve al punto donde la brigada va a trabajar (la línea de fuego o el ancla).</p>
      <p>2. Toca <b>Iniciar</b> y camina hasta la zona segura por el camino real: brecha, vereda o terreno limpio.</p>
      <p>3. Al llegar, toca <b>Llegué a la zona segura</b>. Si ahí no hay una zona marcada, la app la marca.</p>
      <p class="tenue mini">LCES pide al menos dos rutas. El tiempo que guarda es el real: si alguien va más lento o hay humo, será mayor.</p>
    </div>
    <button class="btn verde grande" id="iniciar">${IC.flecha} Iniciar ruta de escape</button>
    <h2 class="sec">Rutas grabadas</h2>
    ${lista.length ? lista.map((r) => `
      <div class="tarjeta fila-tit">
        <span class="col"><b>${esc(r.nombre)}</b><small class="tenue">${fmtFecha(r.inicio)} · ${fmtDistancia(r.m)} · ${r.min} min reales</small></span>
        <span class="acciones">
          <button class="btn-chico" data-ver="${r.id}">Ver</button>
          <button class="btn-chico" data-bajar="${r.id}" aria-label="Descargar GeoJSON">${IC.descarga}</button>
          <button class="btn-chico" data-borrar="${r.id}" aria-label="Borrar">✕</button>
        </span>
      </div>
      <ul class="avisos" data-avisos="${r.id}"><li class="aviso-info">Revisando pendiente, desnivel y viento…</li></ul>`).join('') : '<p class="tenue">Aún no hay rutas grabadas.</p>'}`}
  </main>`;
  colocarMapa($('#hueco'));
  void ponerDatos('rutas', rutasFC());

  $('#iniciar')?.addEventListener('click', () => {
    grabando = { inicio: Date.now(), puntos: [], pausado: false, pausas: 0, desde: null };
    guardar('ruta-actual', grabando); escuchar(); pantallaRutaEscape();
  });
  $('#pausa')?.addEventListener('click', () => {
    if (!grabando) return;
    if (grabando.pausado) { grabando.pausas += Date.now() - (grabando.desde ?? Date.now()); grabando.desde = null; } else grabando.desde = Date.now();
    grabando.pausado = !grabando.pausado; guardar('ruta-actual', grabando); pantallaRutaEscape();
  });
  $('#llegue')?.addEventListener('click', terminar);
  $('#descartar')?.addEventListener('click', () => {
    const b = $('#descartar');
    if (b.dataset.confirmar) { parar(); grabando = null; guardar('ruta-actual', null); pantallaRutaEscape(); }
    else { b.dataset.confirmar = '1'; b.textContent = 'Toca otra vez para descartar'; }
  });
  app().querySelectorAll<HTMLButtonElement>('[data-ver]').forEach((b) => b.addEventListener('click', () => {
    const r = rutasEscape().find((x) => x.id === b.dataset.ver); if (r) void encuadrar(r.puntos);
  }));
  app().querySelectorAll<HTMLButtonElement>('[data-bajar]').forEach((b) => b.addEventListener('click', () => {
    const r = rutasEscape().find((x) => x.id === b.dataset.bajar); if (!r) return;
    const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { nombre: r.nombre, metros: Math.round(r.m), minutos: r.min, inicio: new Date(r.inicio).toISOString(), fin: new Date(r.fin).toISOString() },
      geometry: { type: 'LineString', coordinates: r.puntos.map((p) => (p.alt != null ? [p.lon, p.lat, p.alt] : [p.lon, p.lat])) } }] };
    bajarArchivo(`ruta_escape_${r.id}.geojson`, new Blob([JSON.stringify(gj)], { type: 'application/geo+json' }));
  }));
  app().querySelectorAll<HTMLButtonElement>('[data-borrar]').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = '¿Borrar?'; return; }
    guardar('rutas-escape', rutasEscape().filter((x) => x.id !== b.dataset.borrar)); pantallaRutaEscape();
  }));
  // Avisos de cada ruta guardada (pendiente, desnivel, viento).
  for (const r of lista) void revisarCamino(r.puntos, false).then((rv) => {
    const ul = app().querySelector(`[data-avisos="${r.id}"]`); if (ul) ul.innerHTML = avisosHTML(rv.avisos);
  });
  if (grabando && !detener) escuchar();
}

function escuchar() {
  void pantallaEncendida(true);
  detener = seguirPosicion((p) => {
    ultimaPrecision = p.precision ?? null;
    void ponerDatos('yo', puntoFC(p));
    if (!grabando || grabando.pausado || (p.precision ?? 99) > PRECISION_MAX) return refrescar();
    const ult = grabando.puntos[grabando.puntos.length - 1];
    if (ult && distancia(ult, p) < PASO_MIN) return refrescar();
    const pt: Punto = { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), t: p.t };
    if (p.alt != null) pt.alt = p.alt;
    grabando.puntos.push(pt);
    guardar('ruta-actual', grabando);
    if (grabando.puntos.length === 1) void centrar(p, 16);
    refrescar();
  }, (msg) => aviso(msg, 'error'));
}

let ultimoDibujo = 0;
function refrescar() {
  if (!location.hash.startsWith('#/ruta-escape') || Date.now() - ultimoDibujo < 3000) return;
  ultimoDibujo = Date.now(); pantallaRutaEscape();
}

function parar() { detener?.(); detener = null; void pantallaEncendida(false); }

function terminar() {
  if (!grabando || grabando.puntos.length < 2) return;
  const pts = grabando.puntos, fin = pts[pts.length - 1];
  let zona = zonas().map((z) => ({ z, d: distancia(fin, z) })).filter((x) => x.d <= RADIO_ZONA).sort((a, b) => a.d - b.d)[0]?.z;
  if (!zona) { agregarZona(fin); zona = zonas()[zonas().length - 1]; }
  const n = rutasEscape().filter((r) => r.zonaId === zona!.id).length + 1;
  const r: RutaEscape = { id: nuevoId(), nombre: `Ruta ${n} a ${zona.nombre}`, inicio: grabando.inicio, fin: Date.now(), puntos: pts, m: longitud(pts), min: Math.max(1, minutos(grabando)), zonaId: zona.id };
  guardar('rutas-escape', [r, ...rutasEscape()]);
  parar(); grabando = null; guardar('ruta-actual', null);
  aviso(`Guardada: ${fmtDistancia(r.m)} en ${r.min} min`, 'ok');
  pantallaRutaEscape();
  void encuadrar(pts);
}
