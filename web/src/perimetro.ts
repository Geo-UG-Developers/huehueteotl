// Perímetro GPS: el combatiente camina el borde del incendio y la app calcula hectáreas.
import { guardar, leer, nuevoId } from './almacen';
import { area, distancia, fmtDistancia, longitud, seguirPosicion, type Punto } from './geo';
import { centrar, colocarMapa, encuadrar, ponerDatos, puntoFC } from './mapa';
import { $, app, aviso, bajarArchivo, cabecera, esc, fmtFecha, IC, pantallaEncendida } from './ui';

export type Perimetro = { id: string; nombre: string; inicio: number; fin: number; puntos: Punto[]; ha: number; km: number };

const PRECISION_MAX = 25; // m: lecturas peores se descartan
const PASO_MIN = 4;       // m: no guardar puntos encimados

type Grabacion = { inicio: number; puntos: Punto[]; pausado: boolean };
let grabando: Grabacion | null = leer<Grabacion | null>('perimetro-actual', null);
let detener: (() => void) | null = null;
let ultimaPrecision: number | null = null;

export function perimetros(): Perimetro[] { return leer<Perimetro[]>('perimetros', []); }
export function ultimoPerimetro(): Perimetro | null { return perimetros()[0] ?? null; }

function fc(pts: Punto[], cerrado: boolean): GeoJSON.FeatureCollection {
  const c = pts.map((p) => [p.lon, p.lat]);
  const features: GeoJSON.Feature[] = [];
  if (c.length >= 3 && cerrado) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...c, c[0]]] } });
  if (c.length >= 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: cerrado ? [...c, c[0]] : c } });
  return { type: 'FeatureCollection', features };
}

export function pantallaPerimetro() {
  const g = grabando;
  const pts = g?.puntos ?? [];
  const ha = area(pts) / 10_000;
  const km = longitud(pts) / 1000;
  const falta = pts.length > 2 ? distancia(pts[pts.length - 1], pts[0]) : null;
  const min = g ? Math.floor((Date.now() - g.inicio) / 60000) : 0;
  const lista = perimetros();
  app().innerHTML = `
  ${cabecera('Perímetro', { atras: '#/mapa', derecha: g ? (g.pausado ? '<span class="chip-red">En pausa</span>' : '<span class="chip-red grabando"><i class="punto rojo"></i>Grabando</span>') : '' })}
  <div class="hueco-mapa medio" id="hueco">
    <div class="sobre-mapa arriba-izq">
      <span class="pildora">${ultimaPrecision ? `Precisión GPS ±${ultimaPrecision} m` : 'Esperando GPS…'}</span>
      ${falta !== null && falta > 30 ? `<span class="pildora oscura">Falta cerrar ${fmtDistancia(falta)}</span>` : ''}
    </div>
  </div>
  <main class="panel-inferior">
    ${g ? `
    <div class="cifra-grande"><b>${ha < 10 ? ha.toFixed(2) : ha.toFixed(1)}</b><span>ha</span><small>superficie dentro del recorrido</small></div>
    <div class="rejilla3">
      <div class="dato"><small>Recorrido</small><b>${km.toFixed(2)} km</b></div>
      <div class="dato"><small>Tiempo</small><b>${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}</b></div>
      <div class="dato"><small>Puntos</small><b>${pts.length}</b></div>
    </div>
    <p class="tenue">Mantén la app abierta y la pantalla encendida mientras caminas. La versión Android grabará también con la pantalla apagada.</p>
    <div class="botones2">
      <button class="btn borde" id="pausa">${g.pausado ? 'Continuar' : 'Pausar'}</button>
      <button class="btn rojo" id="cerrar" ${pts.length < 3 ? 'disabled' : ''}>Cerrar y guardar</button>
    </div>
    <button class="btn-texto" id="descartar">Descartar este recorrido</button>`
    : `
    <p>Camina por el borde del incendio con el teléfono. Al cerrar, la app calcula la superficie en hectáreas.</p>
    <button class="btn rojo grande" id="iniciar">${IC.perimetro} Iniciar perímetro</button>
    <h2 class="sec">Perímetros guardados</h2>
    ${lista.length ? lista.map((p) => `
      <div class="tarjeta fila-tit">
        <span class="col"><b>${esc(p.nombre)}</b><small class="tenue">${fmtFecha(p.inicio)} · ${p.ha.toFixed(2)} ha · ${p.km.toFixed(2)} km</small></span>
        <span class="acciones">
          <button class="btn-chico" data-ver="${p.id}">Ver</button>
          <button class="btn-chico" data-bajar="${p.id}" aria-label="Descargar GeoJSON">${IC.descarga}</button>
          <button class="btn-chico" data-borrar="${p.id}" aria-label="Borrar">✕</button>
        </span>
      </div>`).join('') : '<p class="tenue">Aún no hay perímetros.</p>'}`}
  </main>`;
  colocarMapa($('#hueco'));
  void ponerDatos('perimetro', fc(pts, !!g && pts.length > 2));

  $('#iniciar')?.addEventListener('click', iniciar);
  $('#pausa')?.addEventListener('click', () => { if (!grabando) return; grabando.pausado = !grabando.pausado; guardar('perimetro-actual', grabando); pantallaPerimetro(); });
  $('#cerrar')?.addEventListener('click', cerrar);
  $('#descartar')?.addEventListener('click', () => {
    const b = $('#descartar');
    if (b.dataset.confirmar) { parar(); grabando = null; guardar('perimetro-actual', null); pantallaPerimetro(); }
    else { b.dataset.confirmar = '1'; b.textContent = 'Toca otra vez para descartar'; }
  });
  app().querySelectorAll<HTMLButtonElement>('[data-ver]').forEach((b) => b.addEventListener('click', () => {
    const p = perimetros().find((x) => x.id === b.dataset.ver); if (!p) return;
    void ponerDatos('perimetro', fc(p.puntos, true)); void encuadrar(p.puntos);
  }));
  app().querySelectorAll<HTMLButtonElement>('[data-bajar]').forEach((b) => b.addEventListener('click', () => {
    const p = perimetros().find((x) => x.id === b.dataset.bajar); if (!p) return;
    const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { nombre: p.nombre, hectareas: +p.ha.toFixed(2), inicio: new Date(p.inicio).toISOString(), fin: new Date(p.fin).toISOString() },
      geometry: fc(p.puntos, true).features[0].geometry }] };
    bajarArchivo(`perimetro_${p.id}.geojson`, new Blob([JSON.stringify(gj)], { type: 'application/geo+json' }));
  }));
  app().querySelectorAll<HTMLButtonElement>('[data-borrar]').forEach((b) => b.addEventListener('click', () => {
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = '¿Borrar?'; return; }
    guardar('perimetros', perimetros().filter((x) => x.id !== b.dataset.borrar)); pantallaPerimetro();
  }));
  if (grabando && !detener) escuchar();
}

function iniciar() {
  grabando = { inicio: Date.now(), puntos: [], pausado: false };
  guardar('perimetro-actual', grabando);
  escuchar();
  pantallaPerimetro();
}

function escuchar() {
  void pantallaEncendida(true);
  detener = seguirPosicion((p) => {
    ultimaPrecision = p.precision ?? null;
    void ponerDatos('yo', puntoFC(p));
    if (!grabando || grabando.pausado) return refrescar();
    if ((p.precision ?? 99) > PRECISION_MAX) return refrescar();
    const ult = grabando.puntos[grabando.puntos.length - 1];
    if (ult && distancia(ult, p) < PASO_MIN) return refrescar();
    grabando.puntos.push({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), t: p.t });
    guardar('perimetro-actual', grabando);
    if (grabando.puntos.length === 1) void centrar(p, 16);
    refrescar();
  }, (msg) => aviso(msg, 'error'));
}

// Redibuja como máximo cada 3 s para no cansar a teléfonos sencillos.
let ultimoDibujo = 0;
function refrescar() {
  if (!location.hash.startsWith('#/perimetro') || Date.now() - ultimoDibujo < 3000) return;
  ultimoDibujo = Date.now(); pantallaPerimetro();
}

function parar() { detener?.(); detener = null; void pantallaEncendida(false); }

function cerrar() {
  if (!grabando || grabando.puntos.length < 3) return;
  const pts = grabando.puntos;
  const p: Perimetro = { id: nuevoId(), nombre: `Perímetro ${new Date(grabando.inicio).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} ${new Date(grabando.inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`,
    inicio: grabando.inicio, fin: Date.now(), puntos: pts, ha: area(pts) / 10_000, km: longitud(pts, true) / 1000 };
  guardar('perimetros', [p, ...perimetros()]);
  parar(); grabando = null; guardar('perimetro-actual', null);
  aviso(`Guardado: ${p.ha.toFixed(2)} ha`, 'ok');
  pantallaPerimetro();
  void ponerDatos('perimetro', fc(pts, true));
}
