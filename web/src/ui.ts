// Piezas de interfaz compartidas: íconos, cabecera, navegación y avisos.
export const BASE = import.meta.env.BASE_URL;
export const $ = <T extends HTMLElement = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector(sel) as T;
export const app = () => document.getElementById('app')!;

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

const svg = (d: string, extra = '') => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const IC = {
  llama: svg('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-1 1-3 1-9z"/>'),
  mapa: svg('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  clima: svg('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>'),
  escudo: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
  doc: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/>'),
  capas: svg('<path d="M12 3 2 8l10 5 10-5z"/><path d="m2 13 10 5 10-5"/>'),
  ubicar: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  perimetro: svg('<path d="M4 7l6-3 8 4 2 9-9 3-7-5z"/>'),
  flecha: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  atras: svg('<path d="M15 6l-6 6 6 6"/>'),
  alerta: svg('<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>'),
  descarga: svg('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  camara: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
};

/** Flecha que apunta hacia `grados` (0 = arriba/norte). */
export function flechaRumbo(grados: number, tam = 18, color = 'currentColor') {
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 24 24" aria-hidden="true" style="transform:rotate(${Math.round(grados)}deg)"><path d="M12 3v18M6 9l6-6 6 6" stroke="${color}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function cabecera(titulo: string, opciones: { atras?: string; derecha?: string } = {}) {
  return `<header class="cab">
    ${opciones.atras ? `<a class="cab-atras" href="${opciones.atras}" aria-label="Regresar">${IC.atras}</a>` : `<span class="marca"><img src="${BASE}icon-192.png" alt=""><b>HUEHUETÉOTL</b></span>`}
    ${opciones.atras ? `<h1>${esc(titulo)}</h1>` : ''}
    <span class="cab-der">${opciones.derecha ?? estadoRed()}</span>
  </header>`;
}

export function estadoRed() {
  return navigator.onLine
    ? `<span class="chip-red"><i class="punto ok"></i>Con señal</span>`
    : `<span class="chip-red"><i class="punto"></i>Sin señal · datos guardados</span>`;
}

export function nav(activa: 'mapa' | 'clima' | 'seguridad' | 'reporte') {
  const item = (id: typeof activa, txt: string, ic: string) => `<a href="#/${id}" class="${id === activa ? 'activa' : ''}" ${id === activa ? 'aria-current="page"' : ''}>${ic}<span>${txt}</span></a>`;
  return `<nav class="nav">${item('mapa', 'Mapa', IC.mapa)}${item('clima', 'Clima', IC.clima)}${item('seguridad', 'Seguridad', IC.escudo)}${item('reporte', 'Reporte', IC.doc)}</nav>`;
}

let temporizador = 0;
export function aviso(txt: string, tipo: 'ok' | 'error' | 'info' = 'info') {
  let t = document.getElementById('aviso');
  if (!t) { t = document.createElement('div'); t.id = 'aviso'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.className = `aviso ${tipo}`; t.textContent = txt; t.hidden = false;
  clearTimeout(temporizador);
  temporizador = window.setTimeout(() => { t!.hidden = true; }, 4200);
}

export function fmtHora(iso: string | number) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}
export function fmtFecha(iso: string | number) {
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Descarga un archivo generado en el teléfono. */
export function bajarArchivo(nombre: string, contenido: Blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(contenido); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Pantalla siempre encendida mientras se graba o se vigila (si el teléfono lo permite). */
let bloqueo: { release: () => Promise<void> } | null = null;
export async function pantallaEncendida(si: boolean) {
  try {
    if (si && !bloqueo && 'wakeLock' in navigator) bloqueo = await (navigator as unknown as { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen');
    if (!si && bloqueo) { await bloqueo.release(); bloqueo = null; }
  } catch { /* no soportado */ }
}

export function vibrar(patron: number | number[]) { try { navigator.vibrate?.(patron); } catch { /* no soportado */ } }

export function pitido() {
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.4, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch { /* sin audio */ }
}
