// Aviso de privacidad y términos de uso de Huehuetéotl.
// Borrador basado en la LFPDPPP; lo debe revisar la Universidad antes de publicar en tiendas. Los [corchetes] son datos pendientes.
// IMPORTANTE: cuando se active el servidor (seguimiento de brigada, envío de reportes) hay que actualizar este aviso.
export const FECHA_LEGAL = '26 de octubre de 2026';

export const PRIVACIDAD = `
<h2>Aviso de privacidad integral</h2>
<p><b>Responsable.</b> GEO UG Developers (Universidad de Guanajuato / GeoUG), con domicilio en [domicilio], Guanajuato, Gto.,
desarrolla y mantiene Huehuetéotl sin fines de lucro para combatientes de incendios forestales y de pastizal.</p>
<h3>Qué datos usa la app</h3>
<ul>
<li><b>Tu ubicación (GPS):</b> para mostrarte en el mapa, medir perímetros, calcular la distancia a zonas seguras y consultar el clima del lugar.</li>
<li><b>Lo que capturas:</b> perímetros, zonas seguras, reportes de incendio (nombre del incendio, recursos, observaciones y, si lo escribes, tu nombre o el de tu brigada).</li>
</ul>
<p><b>En esta versión todo se guarda solo en tu teléfono.</b> No enviamos tus perímetros, reportes ni tu recorrido a ningún servidor.
No pedimos correo, contraseña ni datos sensibles.</p>
<h3>Con quién se comparte</h3>
<p>Para el clima, la app envía a Open-Meteo (servicio meteorológico gratuito) las coordenadas aproximadas del punto consultado, sin ningún dato que te identifique.
Los puntos de calor provienen de NASA FIRMS y los mapas de INEGI y Copernicus; la app los descarga, pero no les envía tus datos.
La app se aloja en GitHub Pages. Si generas un PDF o compartes tu ubicación por mensaje, tú decides a quién se envía.</p>
<h3>Cuánto tiempo se guardan</h3>
<p>Mientras no los borres. Puedes eliminar perímetros y reportes desde la app, o todo borrando los datos del sitio en tu navegador.</p>
<h3>Tus derechos (ARCO)</h3>
<p>Como los datos están en tu teléfono, tú los controlas. Para cualquier duda escribe a [correo de contacto de GEO UG Developers].</p>
<h3>Cambios a este aviso</h3>
<p>Cuando la app empiece a compartir datos con tu brigada o con una central, este aviso cambiará y te lo mostraremos antes. Última actualización: ${FECHA_LEGAL}.</p>`;

export const TERMINOS = `
<h2>Términos de uso</h2>
<p><b>Herramienta de apoyo, no de decisión.</b> Huehuetéotl muestra información de referencia. Las decisiones de combate y de seguridad
las toma el jefe de brigada con lo que observa en campo. Si hay vidas en riesgo, llama al 911.</p>
<p><b>Los datos pueden estar desactualizados o tener errores.</b> La vegetación es de INEGI escala 1:250 000 (Serie VII), los caminos de la
Red Nacional de Caminos 2019, el clima es un pronóstico de modelo (Open-Meteo) y los puntos de calor son detecciones satelitales
con horas de retraso que pueden incluir falsas alarmas (quemas agrícolas, industrias) o no detectar incendios pequeños.
No todas las terracerías sirven como brecha cortafuego.</p>
<p><b>El GPS tiene margen de error.</b> Bajo árboles o en cañadas la precisión empeora; revisa el valor que muestra la app.</p>
<p><b>Servicio gratuito.</b> La app es gratuita, sin publicidad, y puede cambiar o suspenderse para mantenimiento. Última actualización: ${FECHA_LEGAL}.</p>`;
