// Seguridad del combatiente: LCES, zonas seguras, reporte periódico al vigía y SOS.
// En esta versión todo funciona en el teléfono. El seguimiento de la brigada en tiempo real llega con el servidor.
import { guardar, leer, nuevoId } from './almacen';
import { cardinalLargo, distancia, fmtCoord, fmtDistancia, posicionActual, rumbo, ultimaPosicion, type Punto } from './geo';
import { rutaMasCercana, rutasEscape } from './escape';
import { ponerDatos } from './mapa';
import { $, app, aviso, cabecera, esc, flechaRumbo, IC, nav, pantallaEncendida, pitido, vibrar } from './ui';

export type Zona = Punto & { id: string; nombre: string; creada: number };
const LCES = [
  ['L', 'Vigía', 'Hay un vigía con vista del fuego'],
  ['C', 'Comunicación', 'Radio o teléfono probado con el vigía y la brigada'],
  ['E', 'Ruta de escape', 'Todos conocen al menos dos rutas'],
  ['S', 'Zona segura', 'Marcada y a menos de 10 min a pie'],
] as const;

export function zonas(): Zona[] { return leer<Zona[]>('zonas', []); }
export function zonasFC(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: zonas().map((z) => ({ type: 'Feature', properties: { nombre: z.nombre }, geometry: { type: 'Point', coordinates: [z.lon, z.lat] } })) };
}
export function zonaMasCercana(yo: Punto | null) {
  if (!yo) return null;
  return zonas().map((z) => ({ z, d: distancia(yo, z) })).sort((a, b) => a.d - b.d)[0] ?? null;
}
/** Minutos a pie en línea recta (3 km/h en monte). Es un mínimo: con pendiente se tarda más. */
export const minutosAPie = (m: number) => Math.max(1, Math.round(m / 50));

export function rutaAZona(yo: Punto | null, z: Zona | null): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: yo && z ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[yo.lon, yo.lat], [z.lon, z.lat]] } }] : [] };
}

// ---------- Reporte periódico al vigía (temporizador local)
type Turno = { cadaMin: number; proximo: number } | null;
let turno: Turno = leer<Turno>('turno', null);
let reloj = 0;
function iniciarReloj() {
  clearInterval(reloj);
  if (!turno) return;
  void pantallaEncendida(true);
  reloj = window.setInterval(() => {
    if (!turno) return;
    if (Date.now() >= turno.proximo) { vibrar([400, 200, 400, 200, 400]); pitido(); }
    if (location.hash.startsWith('#/seguridad')) actualizarReloj();
  }, 1000);
}
iniciarReloj();

function actualizarReloj() {
  const el = document.getElementById('reloj'); if (!el || !turno) return;
  const s = Math.round((turno.proximo - Date.now()) / 1000);
  el.textContent = s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'AHORA';
  el.closest('.tarjeta')?.classList.toggle('vencido', s <= 0);
}

export function pantallaSeguridad() {
  const yo = ultimaPosicion();
  const cerca = zonaMasCercana(yo);
  const marcas = leer<Record<string, boolean>>('laces', {});
  app().innerHTML = `
  ${cabecera('Seguridad')}
  <main class="pantalla con-nav">
    <small class="sec">Lista LCES · antes de atacar el fuego</small>
    <div class="rejilla4">${LCES.map(([l, t, d]) => `
      <button class="laces ${marcas[l] ? 'ok' : ''}" data-laces="${l}" aria-pressed="${!!marcas[l]}" title="${esc(d)}"><b>${l}</b><span>${t}</span></button>`).join('')}
    </div>
    <p class="tenue mini">Toca cada letra cuando la brigada la confirme; se pone verde. Las cuatro deben estar en verde antes de entrar a la línea de fuego. Se borran al activar el recordatorio al vigía (nuevo turno).</p>
    <details class="tarjeta"><summary>¿Cómo se usa LCES?</summary>
      <p><b>L · Vigía (Lookout).</b> Una persona con vista del fuego y de la brigada, que avisa si el fuego cambia o se acerca.</p>
      <p><b>C · Comunicación.</b> Radio o teléfono probado entre el vigía, el jefe de brigada y cada combatiente. Si no hay comunicación, no se ataca.</p>
      <p><b>E · Rutas de escape.</b> Al menos dos caminos para salir hacia la zona segura, conocidos por todos y recorridos antes.</p>
      <p><b>S · Zona segura.</b> Lugar sin combustible (quemado, roca, agua, parcela limpia) donde cabe toda la brigada, a menos de 10 min a pie. Márcala abajo y la app te da distancia y rumbo.</p>
      <p class="tenue mini">Si cambian el viento o el frente, vuelve a revisar las cuatro. La app solo te ayuda a recordarlas: la decisión es del jefe de brigada.</p>
    </details>

    ${cerca ? `
    <a class="tarjeta-escape" href="#/mapa?escape">
      ${flechaRumbo(rumbo(yo!, cerca.z), 40, '#FFFFFF')}
      <span><small>RUMBO A ZONA SEGURA · ${esc(cerca.z.nombre)}</small>
      <b>${fmtDistancia(cerca.d)} en línea recta</b>
      <small>Hacia el ${cardinalLargo(rumbo(yo!, cerca.z))} · al menos ${minutosAPie(cerca.d)} min. No es una ruta: ver avisos en el mapa.</small></span>
    </a>` : `
    <div class="tarjeta aviso-ambar"><b>No hay zona segura marcada</b><p>Márcala al llegar al incendio, antes de empezar el ataque.</p></div>`}
    ${(() => { const rc = rutaMasCercana(yo), n = rutasEscape().length; return `
    <a class="tarjeta enlace" href="#/ruta-escape">${IC.flecha}<span class="col"><b>Rutas de escape grabadas: ${n}</b>
      <small class="tenue">${rc ? `La más cercana: ${esc(rc.r.nombre)} · ${fmtDistancia(rc.m)} · ${rc.min} min reales.` : 'Ninguna todavía.'} ${n < 2 ? 'LCES pide al menos dos. Toca para grabar.' : 'Toca para ver o grabar otra.'}</small></span></a>`; })()}
    <div class="botones2">
      <button class="btn verde" id="marcar-zona">Marcar zona segura aquí</button>
      <a class="btn borde" href="#/mapa?marcar">Marcar en el mapa</a>
    </div>
    ${zonas().length ? `<details class="tarjeta"><summary>Zonas seguras guardadas (${zonas().length})</summary>
      ${zonas().map((z) => `<div class="fila-tit"><span>${esc(z.nombre)}${yo ? ` · ${fmtDistancia(distancia(yo, z))}` : ''}</span><button class="btn-chico" data-borrar-zona="${z.id}">Borrar</button></div>`).join('')}</details>` : ''}

    <div class="tarjeta fila-tit ${turno && Date.now() >= turno.proximo ? 'vencido' : ''}">
      <span class="col"><small class="sec">Próximo reporte al vigía</small>
      <b class="reloj" id="reloj">${turno ? '' : 'Apagado'}</b></span>
      ${turno ? `<button class="btn borde" id="bien">Estoy bien</button>` : `<span class="col-der"><select id="cada" aria-label="Cada cuánto">${[10, 15, 20, 30].map((m) => `<option value="${m}" ${m === 15 ? 'selected' : ''}>cada ${m} min</option>`).join('')}</select><button class="btn borde" id="activar">Activar</button></span>`}
    </div>
    ${turno ? '<button class="btn-texto" id="apagar">Apagar recordatorio</button>' : ''}

    <div class="tarjeta">
      <b>Brigada en tiempo real</b>
      <p class="tenue">Ver la posición de cada combatiente y recibir alertas de quien no reporta. Se activa en la siguiente fase, cuando conectemos el servidor.</p>
    </div>

    <button class="btn-sos" id="sos"><b>SOS</b><span>Mantén presionado 3 segundos</span></button>
    <div id="sos-opciones" hidden class="tarjeta sos-opciones">
      <b>Emergencia</b>
      <a class="btn rojo" href="tel:911">Llamar al 911</a>
      <a class="btn borde" id="sms" href="#">Enviar mi ubicación por SMS</a>
      <a class="btn borde" id="wa" href="#" target="_blank" rel="noopener">Enviar mi ubicación por WhatsApp</a>
      <p class="tenue mini" id="sos-pos"></p>
    </div>
  </main>
  ${nav('seguridad')}`;
  actualizarReloj();

  app().querySelectorAll<HTMLButtonElement>('[data-laces]').forEach((b) => b.addEventListener('click', () => {
    const m = leer<Record<string, boolean>>('laces', {}); m[b.dataset.laces!] = !m[b.dataset.laces!]; guardar('laces', m); pantallaSeguridad();
  }));
  $('#marcar-zona').addEventListener('click', async () => {
    aviso('Obteniendo tu ubicación…');
    try { const p = await posicionActual(10_000); agregarZona(p); pantallaSeguridad(); }
    catch (e) { aviso((e as Error).message, 'error'); }
  });
  app().querySelectorAll<HTMLButtonElement>('[data-borrar-zona]').forEach((b) => b.addEventListener('click', () => {
    guardar('zonas', zonas().filter((z) => z.id !== b.dataset.borrarZona)); void ponerDatos('zonas', zonasFC()); pantallaSeguridad();
  }));
  $('#activar')?.addEventListener('click', () => {
    const cada = Number(($('#cada') as HTMLSelectElement).value);
    turno = { cadaMin: cada, proximo: Date.now() + cada * 60_000 }; guardar('turno', turno); guardar('laces', {}); iniciarReloj(); pantallaSeguridad();
  });
  $('#bien')?.addEventListener('click', () => {
    if (!turno) return; turno.proximo = Date.now() + turno.cadaMin * 60_000; guardar('turno', turno); vibrar(80); aviso('Registrado. Siguiente reporte en ' + turno.cadaMin + ' min.', 'ok'); pantallaSeguridad();
  });
  $('#apagar')?.addEventListener('click', () => { turno = null; guardar('turno', null); clearInterval(reloj); void pantallaEncendida(false); pantallaSeguridad(); });

  // SOS: mantener presionado 3 s para evitar toques accidentales.
  const sos = $('#sos'); let t = 0;
  const soltar = () => { clearTimeout(t); sos.classList.remove('cargando'); };
  sos.addEventListener('pointerdown', () => { sos.classList.add('cargando'); t = window.setTimeout(abrirSos, 3000); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => sos.addEventListener(ev, soltar));
}

export function agregarZona(p: Punto) {
  const lista = zonas();
  const z: Zona = { id: nuevoId(), nombre: `Zona segura ${lista.length + 1}`, lat: p.lat, lon: p.lon, creada: Date.now() };
  if (p.alt != null) z.alt = p.alt;
  guardar('zonas', [...lista, z]);
  void ponerDatos('zonas', zonasFC());
  aviso(`${z.nombre} guardada`, 'ok');
}

async function abrirSos() {
  vibrar([200, 100, 200]);
  const caja = $('#sos-opciones'); caja.hidden = false;
  caja.scrollIntoView({ behavior: 'smooth' });
  let p = ultimaPosicion();
  try { p = await posicionActual(15_000); } catch { /* se usa la última conocida */ }
  if (!p) { $('#sos-pos').textContent = 'Sin ubicación. Llama al 911 y describe dónde estás.'; return; }
  const msg = `EMERGENCIA combatiente forestal. Mi ubicación: ${fmtCoord(p)} (±${p.precision ?? '?'} m) https://maps.google.com/?q=${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
  ($('#sms') as HTMLAnchorElement).href = `sms:?&body=${encodeURIComponent(msg)}`;
  ($('#wa') as HTMLAnchorElement).href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  $('#sos-pos').textContent = `Tu ubicación: ${fmtCoord(p)}. Si no hay señal de datos, el SMS puede salir con poca cobertura.`;
}

