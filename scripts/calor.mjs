// Descarga los puntos de calor de NASA FIRMS para Guanajuato y alrededores (últimas 48 h)
// y escribe web/public/datos/calor.geojson. Lo ejecuta GitHub Actions cada hora (web.yml).
// Necesita el secreto FIRMS_MAP_KEY; sin él escribe un archivo vacío con una nota.
import { writeFileSync, mkdirSync } from 'node:fs';

const CLAVE = process.env.FIRMS_MAP_KEY?.trim();
const AREA = '-102.4,19.7,-99.4,22.1'; // oeste,sur,este,norte (Gto. + 20 km)
const FUENTES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'];
const SALIDA = new URL('../web/public/datos/calor.geojson', import.meta.url);

function csv(texto) {
  const [cab, ...filas] = texto.trim().split(/\r?\n/);
  const cols = cab.split(',');
  return filas.filter(Boolean).map((f) => Object.fromEntries(f.split(',').map((v, i) => [cols[i], v])));
}

const features = [];
let nota;
if (!CLAVE) {
  nota = 'Puntos de calor no configurados (falta FIRMS_MAP_KEY en GitHub).';
} else {
  for (const fuente of FUENTES) {
    try {
      const r = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${CLAVE}/${fuente}/${AREA}/2`);
      const t = await r.text();
      if (!r.ok || !t.startsWith('latitude')) { console.log(`${fuente}: sin datos (${r.status}) ${t.slice(0, 80)}`); continue; }
      const filas = csv(t);
      for (const p of filas) {
        const hhmm = p.acq_time.padStart(4, '0');
        const conf = p.confidence;
        // VIIRS: l/n/h · MODIS: 0-100. Se omiten las de baja confianza.
        if (conf === 'l' || (/^\d+$/.test(conf) && Number(conf) < 30)) continue;
        features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [Number(p.longitude), Number(p.latitude)] },
          properties: { fecha: `${p.acq_date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`, satelite: fuente.startsWith('MODIS') ? 'MODIS' : `VIIRS ${fuente.split('_')[1]}`,
            confianza: conf === 'h' ? 'alta' : conf === 'n' ? 'nominal' : conf, frp: Number(p.frp) || 0, dia_noche: p.daynight } });
      }
      console.log(`${fuente}: ${filas.length} detecciones`);
    } catch (e) { console.log(`${fuente}: error ${e.message}`); }
  }
  if (!features.length) nota = 'Sin puntos de calor en las últimas 48 h.';
}
mkdirSync(new URL('.', SALIDA), { recursive: true });
writeFileSync(SALIDA, JSON.stringify({ type: 'FeatureCollection', generado: new Date().toISOString(), fuente: 'NASA FIRMS', ...(nota ? { nota } : {}), features }));
console.log(`Escrito calor.geojson con ${features.length} puntos.`);
