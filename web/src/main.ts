// Huehuetéotl · app para combatientes de incendios forestales y de pastizal (GEO UG Developers).
import './estilos.css';
import { guardar, leer, nuevoId } from './almacen';
import { calorFC, cercanos, obtenerCalor, type Calor } from './calor';
import { ARCHIVOS, borrarDescargas, descargadas, descargarTodo } from './capas';
import { cambioDeViento, climaGuardado, hace, haciaDonde, obtenerClima, regla303030, type Clima } from './clima';
import { cardinal, cardinalLargo, CENTRO_GTO, fmtDistancia, posicionActual, ultimaPosicion, type Punto } from './geo';
import { PRIVACIDAD, TERMINOS } from './legal';
import { alTocarMapa, alternarCapa, capaVisible, centrar, colocarMapa, COMBUSTIBLES, encuadrar, NOMBRE_CAPA, ponerDatos, puntoFC, type IdCapa } from './mapa';
import { pantallaPerimetro } from './perimetro';
import { pantallaReporte } from './reporte';
import { agregarZona, minutosAPie, pantallaSeguridad, rutaAZona, zonaMasCercana, zonasFC } from './seguridad';
import { $, app, aviso, BASE, cabecera, esc, flechaRumbo, fmtHora, IC, nav } from './ui';

// ---------------------------------------------------------------- datos compartidos
let calor: Calor | null = null;
async function cargarCalor() {
  try { calor = await obtenerCalor(); void ponerDatos('calor', calorFC(calor)); } catch { calor = null; }
}

let pidiendoClima = false;
async function actualizarClima(forzar = false): Promise<Clima | null> {
  const c = climaGuardado();
  if (!navigator.onLine || pidiendoClima) return c;
  const yo = ultimaPosicion();
  const viejo = !c || Date.now() - c.obtenido > 30 * 60_000;
  if (!forzar && !viejo) return c;
  pidiendoClima = true;
  try { return await obtenerClima(yo ?? CENTRO_GTO); }
  catch (e) { if (forzar) aviso((e as Error).message, 'error'); return c; }
  finally { pidiendoClima = false; if (/^#\/(mapa)?(\?|$)/.test(location.hash || '#/')) ir(); }
}

// ---------------------------------------------------------------- bienvenida
function bienvenida() {
  colocarMapa(null);
  app().innerHTML = `
  <main class="bienvenida">
    <img class="logo" src="${BASE}icon-192.png" alt="">
    <h1>HUEHUETÉOTL</h1>
    <p class="lema">Herramientas para combatientes de incendios forestales y de pastizal · Guanajuato</p>
    <ul class="lista-bv">
      <li>${IC.mapa}<span><b>Mapa sin señal</b> de combustibles, brechas, relieve y pendiente</span></li>
      <li>${IC.clima}<span><b>Viento y regla 30-30-30</b> en el punto del incendio</span></li>
      <li>${IC.llama}<span><b>Puntos de calor</b> satelitales de NASA FIRMS</span></li>
      <li>${IC.perimetro}<span><b>Perímetro GPS</b>, zonas seguras y reporte en PDF</span></li>
    </ul>
    <button class="btn rojo grande" id="seguir">Comenzar</button>
    <p class="legal-claro">Al continuar aceptas los <a href="#/terminos">términos de uso</a> y el <a href="#/privacidad">aviso de privacidad</a>.</p>
    <div class="credito"><img src="${BASE}geoug-clara.png" alt=""><span>Desarrollado por <b>GEO UG Developers</b> · Universidad de Guanajuato</span></div>
  </main>`;
  $('#seguir').addEventListener('click', () => { guardar('bienvenida', true); location.hash = '#/capas?primera'; });
}

// ---------------------------------------------------------------- mapa
function pantallaMapa(modo: string) {
  const c = climaGuardado();
  const r = c ? regla303030(c.actual) : null;
  const yo = ultimaPosicion();
  const cerca = calor && yo ? cercanos(calor, yo) : [];
  const zona = zonaMasCercana(yo);
  app().innerHTML = `
  ${cabecera('Mapa')}
  <a class="tira-clima" href="#/clima" aria-label="Ver condiciones del tiempo">
    ${c ? `
    <span class="celda"><small>VIENTO</small><b>${flechaRumbo(haciaDonde(c.actual.dir), 16)}${Math.round(c.actual.viento)}</b><small>km/h · del ${cardinal(c.actual.dir)}</small></span>
    <span class="celda"><small>HUMEDAD</small><b class="${r!.hr ? 'malo' : ''}">${Math.round(c.actual.hr)}%</b><small>relativa</small></span>
    <span class="celda"><small>TEMP.</small><b class="${r!.temp ? 'malo' : ''}">${Math.round(c.actual.temp)}°</b><small>${hace(c.obtenido)}</small></span>
    <span class="celda semaforo ${r!.nivel}"><small>30-30-30</small><b>${r!.cumplidas} de 3</b><small>${r!.nivel === 'peligro' ? 'Peligro' : r!.nivel === 'precaucion' ? 'Precaución' : 'Normal'}</small></span>`
    : `<span class="celda ancha"><b>Clima</b><small>${navigator.onLine && pidiendoClima ? 'Consultando…' : navigator.onLine ? 'Sin datos. Toca para consultar.' : 'Sin datos guardados. Se actualiza al tener señal.'}</small></span>`}
  </a>
  <div class="hueco-mapa" id="hueco">
    <div class="sobre-mapa arriba-izq chips-capas">
      ${(['brechas', 'combustibles', 'calor', 'pendiente', 'relieve', 'regimen'] as IdCapa[]).map((id) => `<button class="chip-capa ${capaVisible(id) ? 'si' : ''}" data-capa="${id}" aria-pressed="${capaVisible(id)}">${NOMBRE_CAPA[id]}</button>`).join('')}
    </div>
    <div class="sobre-mapa arriba-der">
      <button class="boton-mapa" id="leyenda" aria-label="Leyenda">${IC.info}</button>
      <button class="boton-mapa" id="ubicar" aria-label="Centrar en mi ubicación">${IC.ubicar}</button>
    </div>
    ${modo === 'marcar' ? `<div class="sobre-mapa abajo tarjeta-mapa"><b>Toca el mapa donde está la zona segura</b><a class="btn-chico" href="#/seguridad">Cancelar</a></div>`
    : modo === 'escape' && zona ? `<div class="sobre-mapa abajo tarjeta-mapa verde">${flechaRumbo(0, 28, '#fff')}<span class="col"><b>${fmtDistancia(zona.d)} a ${esc(zona.z.nombre)}</b><small>${minutosAPie(zona.d)} min a pie · línea recta, sigue la brecha más segura</small></span></div>`
    : cerca.length ? `<a class="sobre-mapa abajo tarjeta-mapa" href="#/mapa?calor"><span class="ic-calor">${IC.llama}</span><span class="col"><b>${cerca.length} punto${cerca.length > 1 ? 's' : ''} de calor a ${fmtDistancia(cerca[0].dist)}</b><small>${esc(cerca[0].satelite)} · ${hace(Date.now() - cerca[0].horas * 3.6e6)}${c ? ` · el viento empuja hacia el ${cardinalLargo(haciaDonde(c.actual.dir))}` : ''}</small></span></a>`
    : calor?.nota ? `<div class="sobre-mapa abajo tarjeta-mapa"><small>${esc(calor.nota)}</small></div>` : ''}
    <div id="caja-leyenda" class="sobre-mapa leyenda" hidden>
      <b>Combustibles (INEGI Serie VII)</b>
      ${COMBUSTIBLES.map(([n, col]) => `<span><i style="background:${col}"></i>${n}</span>`).join('')}
      <b>Brechas</b><span><i class="linea negra"></i>Carretera</span><span><i class="linea cafe"></i>Terracería</span><span><i class="linea cafe punteada"></i>Vereda</span>
      <b>Pendiente</b><span><i style="background:#F2C800"></i>15–30 %</span><span><i style="background:#F08200"></i>30–45 %</span><span><i style="background:#D23C14"></i>45–60 %</span><span><i style="background:#8C143C"></i>más de 60 %</span>
      <b>Régimen de fuego (preliminar)</b><span><i style="background:#3D7448"></i>Adaptado al fuego</span><span><i style="background:#B3261E"></i>Sensible al fuego</span><span><i style="background:#E8D36A"></i>Uso agropecuario</span>
    </div>
  </div>
  <div class="acciones-mapa">
    <a class="btn negro" href="#/perimetro">${IC.perimetro}Perímetro</a>
    <a class="btn verde" href="${zona ? '#/mapa?escape' : '#/seguridad'}">${IC.flecha}Escape</a>
    <a class="btn rojo" href="#/reporte/nuevo">${IC.doc}Reportar</a>
  </div>
  ${nav('mapa')}`;
  colocarMapa($('#hueco'));
  void ponerDatos('zonas', zonasFC());
  void ponerDatos('yo', puntoFC(yo));
  void ponerDatos('ruta', modo === 'escape' && zona ? rutaAZona(yo, zona.z) : rutaAZona(null, null));
  if (modo === 'escape' && zona && yo) void encuadrar([yo, zona.z]);
  if (modo === 'calor' && cerca[0]) void encuadrar([yo!, cerca[0]]);
  alTocarMapa(modo === 'marcar' ? (p: Punto) => { agregarZona(p); location.hash = '#/seguridad'; } : null);

  app().querySelectorAll<HTMLButtonElement>('[data-capa]').forEach((b) => b.addEventListener('click', () => {
    alternarCapa(b.dataset.capa as IdCapa);
    app().querySelectorAll<HTMLButtonElement>('[data-capa]').forEach((x) => { const v = capaVisible(x.dataset.capa as IdCapa); x.classList.toggle('si', v); x.setAttribute('aria-pressed', String(v)); });
  }));
  $('#leyenda').addEventListener('click', () => { const l = $('#caja-leyenda'); l.hidden = !l.hidden; });
  $('#ubicar').addEventListener('click', async () => {
    try { const p = await posicionActual(5000); void ponerDatos('yo', puntoFC(p)); void centrar(p, 14); }
    catch (e) { aviso((e as Error).message, 'error'); }
  });
}

// ---------------------------------------------------------------- clima
function pantallaClima() {
  colocarMapa(null);
  const c = climaGuardado();
  app().innerHTML = `
  ${cabecera('Condiciones', { derecha: `<button class="chip-red boton" id="actualizar">Actualizar</button>` })}
  <main class="pantalla con-nav">${c ? contenidoClima(c) : `<div class="tarjeta"><b>Sin datos del clima</b><p class="tenue">${navigator.onLine ? 'Toca «Actualizar» para consultarlo en tu ubicación.' : 'Se consultará cuando haya señal.'}</p></div>`}</main>
  ${nav('clima')}`;
  $('#actualizar').addEventListener('click', async () => {
    try { await posicionActual(60_000); } catch { aviso('Sin GPS: se usa la última ubicación conocida o el centro del estado.'); }
    const n = await actualizarClima(true); if (n && location.hash.startsWith('#/clima')) pantallaClima();
  });
}

function contenidoClima(c: Clima) {
  const a = c.actual, r = regla303030(a), cambio = cambioDeViento(c);
  const celda = (txt: string, valor: string, cumple: boolean) => `<div class="dato"><small>${txt}</small><b class="${cumple ? 'malo' : ''}">${valor}</b><small class="${cumple ? 'malo' : 'bien'}">${cumple ? 'Se cumple' : 'Aún no'}</small></div>`;
  return `
  <section class="tarjeta brujula-fila">
    <div class="brujula"><span class="n">N</span><span class="s">S</span><span class="o">O</span><span class="e">E</span>${flechaRumbo(haciaDonde(a.dir), 64, '#B3261E')}</div>
    <div class="col"><small class="sec">Viento del ${cardinalLargo(a.dir)}</small><b class="enorme">${Math.round(a.viento)} <span>km/h</span></b>
    <span>Rachas de ${Math.round(a.rachas)} km/h</span><small class="tenue">El fuego tiende a avanzar hacia el ${cardinalLargo(haciaDonde(a.dir))}</small></div>
  </section>
  <section class="tarjeta regla ${r.nivel}">
    <div class="fila-tit"><b class="titulo-chico">Regla 30-30-30</b><span class="pildora">${r.cumplidas} de 3 · ${r.nivel === 'peligro' ? 'Peligro' : r.nivel === 'precaucion' ? 'Precaución' : 'Normal'}</span></div>
    <div class="rejilla3">${celda('Temp. &gt; 30 °C', `${Math.round(a.temp)}°`, r.temp)}${celda('HR &lt; 30 %', `${Math.round(a.hr)}%`, r.hr)}${celda('Viento &gt; 30', `${Math.round(a.viento)}`, r.viento)}</div>
  </section>
  ${cambio ? `<section class="tarjeta alerta-roja">${IC.alerta}<span class="col"><b>Cambio de viento a las ${fmtHora(cambio.hora)}</b>
    <span>Gira del ${cardinalLargo(cambio.de)} al ${cardinalLargo(cambio.a)} (${cambio.giro}°). Un flanco puede convertirse en frente. Revisa rutas de escape.</span></span></section>` : ''}
  <section class="tarjeta">
    <small class="sec">Próximas horas</small>
    <div class="horas">${c.horas.slice(0, 8).map((h) => {
      const gira = Math.abs(((h.dir - a.dir + 540) % 360) - 180) >= 45 && h.viento >= 8;
      return `<div class="${gira ? 'gira' : ''}"><small>${fmtHora(h.hora)}</small>${flechaRumbo(haciaDonde(h.dir), 20)}<b>${Math.round(h.viento)}</b><small>${Math.round(h.hr)}%</small></div>`;
    }).join('')}</div>
    <small class="tenue">Viento en km/h · humedad relativa. Lluvia en las últimas 24 h: ${a.lluvia24} mm.</small>
  </section>
  <p class="tenue mini centro">Pronóstico de modelo de Open-Meteo para ${c.lugar.lat.toFixed(3)}, ${c.lugar.lon.toFixed(3)} · ${hace(c.obtenido)} · guardado para usar sin señal. Confirma siempre con lo que observas.</p>`;
}

// ---------------------------------------------------------------- mapas sin conexión
async function pantallaCapas(primera: boolean) {
  colocarMapa(null);
  const estado = await descargadas();
  const todas = ARCHIVOS.every((a) => estado[a.id]);
  let est: { usage?: number; quota?: number } = {};
  try { est = await navigator.storage.estimate(); } catch { /* opcional */ }
  app().innerHTML = `
  ${cabecera('Mapas sin señal', { atras: primera ? undefined : '#/mapa' })}
  <main class="pantalla">
    <p>Descarga los mapas de todo Guanajuato para usarlos en la sierra sin cobertura. Son <b>52 MB</b>: usa WiFi.</p>
    ${ARCHIVOS.map((a) => `<div class="tarjeta fila-tit"><span class="col"><b>${a.titulo}</b><small class="tenue">${a.mb} MB</small></span><span class="pildora ${estado[a.id] ? 'ok' : ''}">${estado[a.id] ? 'Descargado' : 'Pendiente'}</span></div>`).join('')}
    <div id="progreso" class="progreso" hidden><div id="barra"></div></div><small id="txt-progreso" class="tenue"></small>
    ${todas ? `<a class="btn negro grande" href="#/mapa">Ir al mapa</a><button class="btn-texto" id="borrar-capas">Borrar mapas descargados</button>`
      : `<button class="btn rojo grande" id="bajar">${IC.descarga} Descargar mapas (52 MB)</button>${primera ? '<a class="btn-texto" href="#/mapa">Ahora no, usar con señal</a>' : ''}`}
    ${est.quota ? `<p class="tenue mini">Espacio usado por la app: ${((est.usage ?? 0) / 1e6).toFixed(0)} MB.</p>` : ''}
    <h2 class="sec">Fuentes</h2>
    <p class="tenue mini">Vegetación: INEGI, Uso de Suelo y Vegetación Serie VII (1:250 000), reclasificada en grupos de combustible. Caminos: INEGI, Red Nacional de Caminos 2019. Límites: INEGI, Marco Geoestadístico 2020. Relieve y pendiente: Copernicus DEM GLO-30 (30 m). El régimen de fuego es una clasificación preliminar que falta validar con CONAFOR.</p>
  </main>`;
  $('#bajar')?.addEventListener('click', async () => {
    const b = $<HTMLButtonElement>('#bajar'); b.disabled = true; $('#progreso').hidden = false;
    try {
      await descargarTodo((f, t) => { $('#barra').style.width = `${Math.round(f * 100)}%`; $('#txt-progreso').textContent = t; });
      aviso('Mapas descargados. Reinicia la app para usarlos sin señal.', 'ok');
      setTimeout(() => location.reload(), 1200);
    } catch (e) { aviso((e as Error).message, 'error'); b.disabled = false; }
  });
  $('#borrar-capas')?.addEventListener('click', async () => { await borrarDescargas(); aviso('Mapas borrados'); void pantallaCapas(false); });
}

// ---------------------------------------------------------------- legal y acerca
function legal(cual: 'privacidad' | 'terminos') {
  colocarMapa(null);
  app().innerHTML = `${cabecera(cual === 'privacidad' ? 'Aviso de privacidad' : 'Términos de uso', { atras: leer('bienvenida', false) ? '#/acerca' : '#/inicio' })}
  <main class="pantalla"><article class="articulo">${cual === 'privacidad' ? PRIVACIDAD : TERMINOS}</article></main>`;
}

function acerca() {
  colocarMapa(null);
  app().innerHTML = `${cabecera('Acerca de', { atras: '#/mapa' })}
  <main class="pantalla">
    <div class="tarjeta"><b>Huehuetéotl</b><p>Herramientas gratuitas para combatientes de incendios forestales y de pastizal de Guanajuato. Sin publicidad.</p></div>
    <a class="tarjeta enlace" href="#/capas">${IC.descarga}<b>Mapas sin señal</b></a>
    <a class="tarjeta enlace" href="#/privacidad"><b>Aviso de privacidad</b></a>
    <a class="tarjeta enlace" href="#/terminos"><b>Términos de uso</b></a>
    <p class="credito oscuro"><img src="${BASE}geoug.png" alt=""><span>App desarrollada sin costo por <b>GEO UG Developers</b> · Universidad de Guanajuato</span></p>
  </main>`;
}

// ---------------------------------------------------------------- rutas
function ir() {
  const [ruta, arg] = location.hash.replace(/^#\/?/, '').split('?')[0].split('/');
  const q = location.hash.split('?')[1] ?? '';
  if (!leer('bienvenida', false) && !['privacidad', 'terminos'].includes(ruta)) return bienvenida();
  window.scrollTo(0, 0);
  alTocarMapa(null);
  switch (ruta) {
    case 'clima': return pantallaClima();
    case 'perimetro': return pantallaPerimetro();
    case 'seguridad': colocarMapa(null); return pantallaSeguridad();
    case 'reporte':
      colocarMapa(null);
      if (arg === 'nuevo') { location.replace(`#/reporte/${nuevoId()}`); return; }
      return pantallaReporte(arg || undefined);
    case 'capas': return void pantallaCapas(q.includes('primera'));
    case 'privacidad': return legal('privacidad');
    case 'terminos': return legal('terminos');
    case 'acerca': return acerca();
    default: return pantallaMapa(q);
  }
}

window.addEventListener('hashchange', ir);
window.addEventListener('online', () => { void actualizarClima().then(ir); void cargarCalor(); });
window.addEventListener('offline', ir);
document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.marca')) location.hash = '#/acerca'; });
ir();
void cargarCalor().then(() => { if (/^#\/(mapa)?(\?|$)/.test(location.hash || '#/')) ir(); });
void actualizarClima().then((c) => { if (c && /^#\/(mapa|clima)?(\?|$)/.test(location.hash || '#/')) ir(); });

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register(`${BASE}sw.js`).catch(() => {}); });
}
