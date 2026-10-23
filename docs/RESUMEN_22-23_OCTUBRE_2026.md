# Resumen de trabajo · 22 y 23 de octubre de 2026

Todo lo de este documento está en `main`, desplegado y verificado en los contenedores.

## Qué se hizo

### 1. Agenda móvil y mejoras de uso diario (tres olas)
**Ola 1: agenda en dos mitades**
- Calendario de mes o semana arriba (con puntos en los días con citas) y citas del día abajo, con huecos libres, bloqueos y línea de «ahora». El asa pasa de mes a semana y recuerda la elección.
- Hoja de acciones al tocar una cita: llamar, WhatsApp, confirmar, completar, no asistió, editar, cancelar.
- Sin cuadros de «¿seguro?»: cada cambio se puede **deshacer**. Cancelar espera 5 s antes de avisar al cliente.
- Buscador real en la barra superior (clientes y citas); la API acepta el parámetro `q`.
- Tarjeta «Siguiente cita» en el Panel (llamar, WhatsApp, completar).

**Ola 2**
- Cita nueva en una hoja, con cliente creado al vuelo.
- Próxima cita en 2, 3 o 4 semanas con un toque.
- Bloquear horas de un día y copiar las horas libres como texto para WhatsApp.
- Confirmación por WhatsApp con el mensaje ya redactado.

**Ola 3**
- Calendario suscrito (iCal) en Mi perfil, para Google, Apple u Outlook. Enlace secreto, solo se guarda su hash; el profesional ve solo lo suyo.
- «Añadir a mi calendario» (Google y .ics) para el cliente al reservar.
- Resumen del día por Telegram a las 8:00 hora del salón, con interruptor en Configuración → Avisos (activo por defecto).
- Migración: tabla `CalendarFeed` y `TenantSettings.dailySummary`.

### 2. Archivar clientes
- Un cliente archivado desaparece de las listas, del buscador y de las citas nuevas, pero conserva su historial. Se restaura cuando se quiera.
- Reservar de nuevo desde la página pública lo restaura solo. Desde el panel no se agenda a un archivado.
- Solo el dueño y los administradores pueden archivar o restaurar.
- Migración: `Client.archivedAt`.

### 3. Modo sin conexión (solo lectura)
- PWA instalable: icono, pantalla completa y service worker que guarda la app en el dispositivo.
- La agenda, los clientes, los servicios, los profesionales y los horarios se guardan en el celular (IndexedDB, una semana) y se ven sin internet.
- Sin red abre con el usuario guardado, sin pedir el login. Un cartel dice «datos guardados a las HH:MM».
- Las acciones que escriben se rechazan al instante con un mensaje claro: nada queda a medias.
- Los datos guardados se borran al cerrar sesión, al expirar la sesión de verdad o al entrar otra cuenta en el mismo celular.

### 4. Corrección del despliegue
- El primer Deploy del frontend con la PWA falló sin avisar: el `Dockerfile` usaba `npm ci` sin `--legacy-peer-deps`, y el lock del proyecto se genera con esa bandera. Producción siguió con la versión anterior hasta que se corrigió.
- Se arregló en el Dockerfile y después se ajustó nginx: el manifiesto sale como `application/manifest+json` y `sw.js` sin caché.

### 5. Documentación
- Manual de usuario: 20 capítulos y 50 capturas anotadas; capítulos 6, 7, 8, 9, 10 y 14, preguntas frecuentes y solución de problemas actualizados. Versión web: https://claude.ai/artifact/CMrgo9mf5dnEL3T63xniqY (versión 6).
- `PLAN_DE_VENTAS.md` actualizado con todo lo anterior.

## Calidad y pruebas
- Backend: 194 pruebas pasan (incluye aislamiento entre salones, feed iCal, resumen diario y archivar).
- Frontend: más de 250 pruebas; algunas pruebas lentas fallan solo cuando el servidor está saturado y pasan aisladas.
- Se verificó en navegador headless: agenda móvil, buscador, hojas, y la app abriendo con la red cortada.
- Se corrigieron dos fallos reales encontrados al probar: el asa del calendario no respondía al teclado y el escape de `;` en el archivo .ics del cliente.

## Despliegues realizados
| Cambio | Migración | Verificación |
|---|---|---|
| Olas 1-3 | Sí (`calendario_y_resumen`) | Contenedores sanos, tabla creada |
| Archivar clientes | Sí (`archivar_clientes`) | Contenedores sanos, columna creada |
| PWA y modo sin conexión | No | Falló el primer build; ver punto 4 |
| Dockerfile (`--legacy-peer-deps`) | No | `sw.js`, manifiesto e iconos dentro del contenedor |
| Ajustes de nginx | No | Cabeceras correctas medidas en el contenedor |

## Pendiente
- **Prueba en un teléfono real** del modo sin conexión (instalar, modo avión) con el celular de Yumi. Solo se probó en Chromium con la red cortada.
- Limitaciones conocidas del modo sin conexión: hay que abrir la app con internet al menos una vez; las reservas nuevas de clientes no aparecen hasta volver la conexión; en iPhone la instalación es más limitada.
- Acciones sin conexión con cola de envío (crear, completar, cancelar): solo si algún salón lo pide. Lo difícil son los conflictos.
- Siguientes pasos del plan de ventas: obligar a cambiar la contraseña temporal en el primer acceso, página pública del salón, dominio propio, respaldos a Drive.
- Cosas aún por resolver con el cliente: horario y zona de soporte en el manual, y el marcador `[el enlace de tu salón]` hasta tener `afilao.app`.
- Easypanel MCP sin token API: no se pueden leer los logs de build desde aquí; la verificación se hace con Docker en el servidor.
