# Landing de Afilao (https://afilaoapp.com/)

Página única y estática: `frontend/public/landing.html` (HTML + CSS en línea, sin JavaScript).
nginx la sirve solo en la raíz exacta (`location = /` en `frontend/nginx.conf`); el resto de
rutas (`/login`, `/admin`, `/<salón>/reservar`...) sigue siendo la app. Las capturas están en
`frontend/public/landing/` y `robots.txt` y `sitemap.xml` en `frontend/public/`.

- **Un solo objetivo:** escribir por WhatsApp (+53 5535 4530). Hay cuatro botones (hero, precio,
  cierre y barra fija en móvil) y todos usan el mismo número. El enlace «Iniciar sesión» de la
  cabecera es solo para los salones que ya usan Afilao.
- **Precio:** sin cifras. «Gratis durante el piloto»; se avisa antes de cobrar. Cuando haya
  precio decidido, se cambia la sección `#precio` y la pregunta «¿Cuánto cuesta?».
- **Qué NO se promete** (la app no lo hace): avisos automáticos por WhatsApp, pagos en línea,
  página pública del salón con galería, acciones sin conexión. Un test lo vigila
  (`frontend/src/landing.test.ts`).
- Los usuarios que ya tienen la app instalada (service worker) siguen entrando a la app al abrir
  `/`; la landing la ven quienes llegan por primera vez.

## Testimonio (pendiente)
El bloque está comentado en `landing.html` (busca `TESTIMONIO`). Para activarlo:
1. Pedir a la dueña del salón que responda con sus palabras. Preguntas sugeridas para mandarle por WhatsApp:
   - ¿Cómo dabas las citas antes de usar Afilao?
   - ¿Qué ha cambiado en tu día a día desde que lo usas?
   - ¿Se lo recomendarías a otro salón? ¿Por qué?
2. Pegar su respuesta tal cual (solo recortes sin cambiar el sentido) y guardar su permiso por escrito.
3. Descomentar el bloque, quitar `hidden`, y colocar la sección dentro de `#confianza`.
No publicar cifras («−40 % de faltas»...) que no se hayan medido.

## Pruebas A/B
Titulares (el activo es A):
- **A:** Tus clientas reservan solas. Tú solo atiendes.
- **B:** Deja de dar horas por chat. Que reserven solas.
- **C:** Tu agenda llena y sin líos, desde el celular.

Botón (el activo es A):
- **A:** Escríbenos por WhatsApp
- **B:** Quiero Afilao en mi salón

Cada botón lleva `data-cta` (hero, precio, final, fijo) por si se mide más adelante. Hoy no hay
analítica: para medir sin cookies, activar Cloudflare Web Analytics y contar los clics a WhatsApp.

## SEO
- Título (56 caracteres) y descripción (menos de 160), canonical, Open Graph y datos
  estructurados `SoftwareApplication` (sin valoraciones inventadas).
- Pendiente: dar de alta el sitio en Google Search Console y enviar `sitemap.xml`.

## Cómo se hicieron las capturas
Entorno local desechable (base `afilao_landing` en el Postgres de pruebas, backend y Vite en
local), salón ficticio «Estudio Aura» con 5 servicios en CUP, 14 clientas y 20 citas, y la hora
del navegador fijada a las 08:40 con Chromium headless. No se tocó producción. Para rehacerlas,
repetir ese montaje; el nombre de los archivos debe mantenerse o actualizarse en `landing.html`.

## Cinco mejoras para probar después del lanzamiento
1. Primer mensaje de WhatsApp: probar un texto precargado más concreto («Tengo una barbería en…»)
   y medir cuántos conversan de verdad.
2. Un vídeo corto (15 s) del celular: la clienta reserva y la cita aparece en la agenda.
3. Titular B o C frente al actual, y botón B frente al A (una prueba cada vez, con tráfico suficiente).
4. Testimonio real de Yumi con su foto o la del salón, junto al hero.
5. Pregunta de calificación en el WhatsApp («¿Cuántas profesionales tienes?») para llegar a la demo mejor preparada.
