# Huehuetéotl · Combatientes forestales

App gratuita para **combatientes de incendios forestales y de pastizal de Guanajuato**, desarrollada sin costo por
**GEO UG Developers** (Universidad de Guanajuato / GeoUG).

- App: https://geo-ug-developers.github.io/huehueteotl/

## Qué hace (versión 0.1, sin servidor)

| Pantalla | Qué hace |
|---|---|
| Mapa | Capas de todo Guanajuato **sin señal**: combustibles (INEGI Serie VII), brechas y caminos (RNC 2019), relieve, pendiente, régimen de fuego (preliminar), agua y límites. Puntos de calor de NASA FIRMS. |
| Clima | Viento, rachas, humedad y temperatura (Open-Meteo), **regla 30-30-30** y aviso de **cambio de viento** en las próximas 6 h. Se guarda para verlo sin señal. |
| Perímetro | Caminar el borde con GPS → hectáreas, distancia y tiempo. Exporta GeoJSON. |
| Seguridad | LACES, zonas seguras con distancia y rumbo, recordatorio para reportar al vigía y SOS (911, SMS o WhatsApp con la ubicación). |
| Reporte | Resumen SCI-201 que se llena solo con GPS, municipio, perímetro y clima. Genera PDF. |

Todo se guarda **solo en el teléfono**. El seguimiento de brigada en tiempo real y el envío de reportes a una central
llegan en la siguiente fase, con Supabase.

## Estructura

```
web/                   app (Vite + TypeScript + MapLibre)
web/public/capas/      mapas de Guanajuato en PMTiles (52 MB)
web/public/datos/      municipios y puntos de calor (calor.geojson lo genera GitHub cada hora)
web/src/               pantallas: main, mapa, clima, calor, perimetro, seguridad, reporte, legal
scripts/calor.mjs      descarga puntos de calor de NASA FIRMS
.github/workflows/     web.yml: compila y publica en GitHub Pages (al subir cambios y cada hora)
```

## Secretos (GitHub › Settings › Secrets and variables › Actions)

- `FIRMS_MAP_KEY`: llave gratuita de NASA FIRMS (https://firms.modaps.eosdis.nasa.gov/api/map_key/). Sin ella la app funciona, pero no muestra puntos de calor.

## Fuentes de datos

INEGI (Uso de Suelo y Vegetación Serie VII, Red Nacional de Caminos 2019, Marco Geoestadístico 2020) ·
Copernicus DEM GLO-30 © DLR e.V. y © Airbus Defence and Space GmbH, provisto por la ESA ·
NASA FIRMS · Open-Meteo (CC BY 4.0).

## Probar en la computadora

```
cd web
npm install
npm run dev
```
