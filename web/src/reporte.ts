// Reporte de incendio (resumen basado en el formato SCI-201). Se guarda en el teléfono y se exporta a PDF.
// El envío a una central se activa cuando conectemos el servidor.
import { guardar, leer, nuevoId } from './almacen';
import { climaGuardado, regla303030 } from './clima';
import { cardinal, dentro, fmtCoord, posicionActual, ultimaPosicion, type Punto } from './geo';
import { combustibleEn } from './mapa';
import { ultimoPerimetro } from './perimetro';
import { $, app, aviso, BASE, bajarArchivo, cabecera, esc, fmtFecha, nav } from './ui';

export type Reporte = {
  id: string; creado: number; actualizado: number;
  nombre: string; deteccion: string; ubicacion: Punto | null; municipio: string;
  superficie: string; vegetacion: string[]; comportamiento: string[];
  combatientes: string; vehiculos: string; instituciones: string;
  clima: string; situacion: string; acciones: string; necesidades: string; responsable: string;
};

const MUNICIPIOS = ['Abasolo', 'Acámbaro', 'Apaseo el Alto', 'Apaseo el Grande', 'Atarjea', 'Celaya', 'Comonfort', 'Coroneo', 'Cortazar', 'Cuerámaro',
  'Doctor Mora', 'Dolores Hidalgo Cuna de la Independencia Nacional', 'Guanajuato', 'Huanímaro', 'Irapuato', 'Jaral del Progreso', 'Jerécuaro', 'León',
  'Manuel Doblado', 'Moroleón', 'Ocampo', 'Pénjamo', 'Pueblo Nuevo', 'Purísima del Rincón', 'Romita', 'Salamanca', 'Salvatierra', 'San Diego de la Unión',
  'San Felipe', 'San Francisco del Rincón', 'San José Iturbide', 'San Luis de la Paz', 'San Miguel de Allende', 'Santa Catarina', 'Santa Cruz de Juventino Rosas',
  'Santiago Maravatío', 'Silao de la Victoria', 'Tarandacuao', 'Tarimoro', 'Tierra Blanca', 'Uriangato', 'Valle de Santiago', 'Victoria', 'Villagrán', 'Xichú', 'Yuriria'];
const VEGETACION = ['Pastizal', 'Matorral', 'Encino', 'Pino-encino', 'Pino', 'Selva baja', 'Agrícola / rastrojo', 'Hojarasca'];
const COMPORTAMIENTO = ['Superficial', 'De copa', 'Subterráneo', 'Lento', 'Rápido', 'Con pavesas'];

export function reportes(): Reporte[] { return leer<Reporte[]>('reportes', []); }

function nuevo(): Reporte {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return { id: nuevoId(), creado: Date.now(), actualizado: Date.now(), nombre: '', deteccion: local, ubicacion: ultimaPosicion(), municipio: '',
    superficie: '', vegetacion: [], comportamiento: [], combatientes: '', vehiculos: '', instituciones: '', clima: '', situacion: '', acciones: '', necesidades: '', responsable: leer('responsable', '') };
}

let municipios: GeoJSON.FeatureCollection | null = null;
async function municipioDe(p: Punto): Promise<string> {
  try {
    municipios ??= await (await fetch(`${BASE}datos/municipios.geojson`)).json();
    for (const f of municipios!.features) {
      const g = f.geometry;
      if (g.type === 'Polygon' && dentro(p, g.coordinates)) return String(f.properties?.nombre);
      if (g.type === 'MultiPolygon' && g.coordinates.some((c) => dentro(p, c))) return String(f.properties?.nombre);
    }
  } catch { /* sin archivo */ }
  return '';
}

function textoClima(): string {
  const c = climaGuardado(); if (!c) return '';
  const a = c.actual, r = regla303030(a);
  return `${Math.round(a.temp)} °C, HR ${Math.round(a.hr)} %, viento ${Math.round(a.viento)} km/h del ${cardinal(a.dir)} (rachas ${Math.round(a.rachas)}). 30-30-30: ${r.cumplidas} de 3. Fuente: Open-Meteo, ${fmtFecha(c.obtenido)}.`;
}

export function pantallaReporte(id?: string) {
  if (!id) return listaReportes();
  const lista = reportes();
  let r = lista.find((x) => x.id === id);
  if (!r) { r = nuevo(); r.clima = textoClima(); const per = ultimoPerimetro(); if (per && Date.now() - per.fin < 12 * 3.6e6) r.superficie = per.ha.toFixed(2); }
  const rep = r;
  const chips = (campo: 'vegetacion' | 'comportamiento', opciones: string[]) => opciones.map((o) =>
    `<button type="button" class="chip ${rep[campo].includes(o) ? 'si' : ''}" data-chip="${campo}" data-valor="${esc(o)}" aria-pressed="${rep[campo].includes(o)}">${esc(o)}</button>`).join('');
  const campo = (id: keyof Reporte, txt: string, tipo = 'text', extra = '') =>
    `<div class="campo"><label for="f-${id}">${txt}</label><input id="f-${id}" name="${id}" type="${tipo}" value="${esc(rep[id] as string)}" ${extra}></div>`;
  const area = (id: keyof Reporte, txt: string, ph = '') =>
    `<div class="campo"><label for="f-${id}">${txt}</label><textarea id="f-${id}" name="${id}" rows="2" placeholder="${esc(ph)}">${esc(rep[id] as string)}</textarea></div>`;

  app().innerHTML = `
  ${cabecera('Reporte SCI-201', { atras: '#/reporte', derecha: '<span class="chip-red">Borrador</span>' })}
  <main class="pantalla con-nav">
    <form id="forma" class="forma">
      ${campo('nombre', 'Nombre del incendio', 'text', 'placeholder="Ej. Sierra de Santa Rosa – El Zangarro"')}
      <div class="rejilla2">
        <div class="campo"><span class="etq">Ubicación (GPS)</span><button type="button" class="valor-auto" id="gps">${rep.ubicacion ? fmtCoord(rep.ubicacion) : 'Tocar para obtener'}</button></div>
        <div class="campo"><label for="f-municipio">Municipio</label><select id="f-municipio" name="municipio">
          <option value="">Elegir…</option>${[...new Set([...(rep.municipio && !MUNICIPIOS.includes(rep.municipio) ? [rep.municipio] : []), ...MUNICIPIOS])].map((m) => `<option ${m === rep.municipio ? 'selected' : ''}>${esc(m)}</option>`).join('')}
        </select></div>
      </div>
      <div class="rejilla2">
        ${campo('deteccion', 'Detección', 'datetime-local')}
        ${campo('superficie', 'Superficie (ha)', 'text', 'inputmode="decimal"')}
      </div>
      <div class="campo"><span class="etq">Vegetación afectada</span><div class="chips">${chips('vegetacion', VEGETACION)}</div><small class="tenue" id="sugerencia"></small></div>
      <div class="campo"><span class="etq">Comportamiento del fuego</span><div class="chips">${chips('comportamiento', COMPORTAMIENTO)}</div></div>
      <div class="rejilla2">
        ${campo('combatientes', 'Combatientes', 'number', 'inputmode="numeric" min="0"')}
        ${campo('vehiculos', 'Vehículos', 'number', 'inputmode="numeric" min="0"')}
      </div>
      ${campo('instituciones', 'Instituciones en el lugar', 'text', 'placeholder="CONAFOR, brigada municipal, Protección Civil…"')}
      ${area('clima', 'Condiciones del tiempo')}
      ${area('situacion', 'Situación actual', 'Frentes activos, hacia dónde avanza, riesgos…')}
      ${area('acciones', 'Acciones realizadas', 'Línea negra, brecha, ataque directo…')}
      ${area('necesidades', 'Recursos que se necesitan')}
      ${campo('responsable', 'Responsable / brigada')}
      <div class="tarjeta aviso-verde"><i class="punto ok"></i><span>Se guarda en este teléfono mientras escribes.</span></div>
      <div class="botones2">
        <button type="button" class="btn borde" id="pdf">Generar PDF</button>
        <button type="button" class="btn rojo" disabled title="Disponible en la siguiente fase">Enviar a central</button>
      </div>
      <p class="tenue mini centro">El envío a una central se activa cuando conectemos el servidor. Mientras, comparte el PDF por WhatsApp o correo.</p>
      <button type="button" class="btn-texto" id="borrar">Borrar este reporte</button>
    </form>
  </main>
  ${nav('reporte')}`;

  const guardarYa = () => {
    const f = new FormData($('#forma') as HTMLFormElement);
    for (const k of ['nombre', 'municipio', 'deteccion', 'superficie', 'combatientes', 'vehiculos', 'instituciones', 'clima', 'situacion', 'acciones', 'necesidades', 'responsable'] as const) rep[k] = String(f.get(k) ?? '');
    rep.actualizado = Date.now();
    guardar('reportes', [rep, ...reportes().filter((x) => x.id !== rep.id)]);
    if (rep.responsable) guardar('responsable', rep.responsable);
  };
  $('#forma').addEventListener('input', guardarYa);
  app().querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.chip as 'vegetacion' | 'comportamiento', v = b.dataset.valor!;
    rep[c] = rep[c].includes(v) ? rep[c].filter((x) => x !== v) : [...rep[c], v];
    b.classList.toggle('si'); b.setAttribute('aria-pressed', String(rep[c].includes(v))); guardarYa();
  }));
  const completarLugar = async (p: Punto) => {
    rep.ubicacion = p; $('#gps').textContent = fmtCoord(p);
    const m = await municipioDe(p); const inp = $('#f-municipio') as HTMLSelectElement; if (m && !inp.value) inp.value = m;
    const c = await combustibleEn(p).catch(() => null);
    if (c) $('#sugerencia').textContent = `Según INEGI aquí hay: ${c.veg} (${c.combustible}).`;
    guardarYa();
  };
  $('#gps').addEventListener('click', async () => {
    try { aviso('Obteniendo ubicación…'); await completarLugar(await posicionActual(10_000)); } catch (e) { aviso((e as Error).message, 'error'); }
  });
  if (rep.ubicacion) void completarLugar(rep.ubicacion);
  $('#pdf').addEventListener('click', () => { guardarYa(); void pdf(rep); });
  $('#borrar').addEventListener('click', () => {
    const b = $('#borrar');
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toca otra vez para borrar'; return; }
    guardar('reportes', reportes().filter((x) => x.id !== rep.id)); location.hash = '#/reporte';
  });
}

function listaReportes() {
  const lista = reportes();
  app().innerHTML = `
  ${cabecera('Reportes')}
  <main class="pantalla con-nav">
    <a class="btn rojo grande" href="#/reporte/${nuevoId()}">Nuevo reporte de incendio</a>
    <h2 class="sec">Guardados en este teléfono</h2>
    ${lista.length ? lista.map((r) => `<a class="tarjeta enlace" href="#/reporte/${r.id}"><b>${esc(r.nombre || 'Sin nombre')}</b>
      <small class="tenue">${esc(r.municipio || 'Sin municipio')} · ${r.superficie ? esc(r.superficie) + ' ha · ' : ''}${fmtFecha(r.actualizado)}</small></a>`).join('')
      : '<p class="tenue">Aún no hay reportes.</p>'}
  </main>
  ${nav('reporte')}`;
}

async function pdf(r: Reporte) {
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'mm', format: 'letter' });
  let y = 18;
  d.setFillColor(20, 20, 20); d.rect(0, 0, 216, 12, 'F');
  d.setTextColor(255, 255, 255); d.setFontSize(11); d.text('HUEHUETÉOTL · Reporte de incendio (resumen SCI-201)', 10, 8);
  d.setTextColor(20, 20, 20);
  const linea = (etq: string, valor: string) => {
    d.setFont('helvetica', 'bold'); d.setFontSize(9); d.text(etq.toUpperCase(), 12, y);
    d.setFont('helvetica', 'normal'); d.setFontSize(11);
    const filas = d.splitTextToSize(valor || '—', 185) as string[];
    d.text(filas, 12, y + 5); y += 7 + filas.length * 5;
    if (y > 260) { d.addPage(); y = 18; }
  };
  linea('Nombre del incendio', r.nombre);
  linea('Ubicación', r.ubicacion ? `${fmtCoord(r.ubicacion)} (±${r.ubicacion.precision ?? '?'} m) · ${r.municipio}, Guanajuato` : r.municipio);
  linea('Detección', r.deteccion ? new Date(r.deteccion).toLocaleString('es-MX') : '');
  linea('Superficie', r.superficie ? `${r.superficie} ha` : '');
  linea('Vegetación afectada', r.vegetacion.join(', '));
  linea('Comportamiento del fuego', r.comportamiento.join(', '));
  linea('Recursos', `${r.combatientes || 0} combatientes · ${r.vehiculos || 0} vehículos · ${r.instituciones}`);
  linea('Condiciones del tiempo', r.clima);
  linea('Situación actual', r.situacion);
  linea('Acciones realizadas', r.acciones);
  linea('Recursos que se necesitan', r.necesidades);
  linea('Responsable / brigada', r.responsable);
  d.setFontSize(8); d.setTextColor(90, 90, 90);
  d.text(`Generado ${new Date().toLocaleString('es-MX')} con Huehuetéotl · GEO UG Developers, Universidad de Guanajuato`, 12, 272);
  bajarArchivo(`reporte_${(r.nombre || 'incendio').replace(/[^\w-]+/g, '_').slice(0, 40)}.pdf`, d.output('blob'));
  aviso('PDF listo', 'ok');
}
