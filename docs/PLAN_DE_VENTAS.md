# Plan de ventas de Afilao

Documento vivo. Al terminar o decidir algo, marca la casilla (`[x]`), añade la fecha
y anota en el registro del final. Si una decisión cambia, tacha la anterior en lugar
de borrarla.

**Última actualización:** 2026-10-21 (noche)

## 1. Qué vendemos y a quién
- **Producto:** Afilao, reservas con turnos para negocios de servicios (barberías,
  manicura, gimnasios, etc.). Cada salón tiene su página de reserva, su agenda y su bot.
- **Mercado inicial:** Cuba, en español. Los primeros clientes son salones pequeños.
- **Cliente final:** reserva sin crear cuenta; gestiona su cita con un enlace secreto y,
  si quiere, recibe avisos y consulta `/historial` en el bot de Telegram del salón.
- **Otros países:** el mismo sistema con otra marca (ver `docs/MARCA.md`), no una copia.

## 2. Estado de la plataforma
- [x] Marca Afilao con configuración única (`brand.ts`)
- [x] Marca blanca por salón: logo y color en la página de reserva
- [x] Reserva pública sin cuentas de cliente (portal retirado)
- [x] Bot de Telegram por salón; `/historial` del cliente
- [x] Avisos de Telegram al dueño y a cada profesional (solo lo suyo)
- [x] Staff ve solo su agenda y sus clientes
- [x] Pantalla Equipo: el dueño crea, restablece, desactiva y elimina cuentas
- [x] Demo limpia: `barberia-demo` y `manicura-demo` (2026-10-20)
- [x] Reserva por cupos: cada profesional reserva por hora o por cupos (una cantidad fija por día, a horas exactas que él define por día de la semana). Desplegado (2026-10-21)
- [x] Primer salón piloto creado: Yumi Manicure (`yumi-manicure`). Yumi reserva por cupos: 9:00 y 13:00, de lunes a sábado; 4 servicios en CUP (acrílico y pedicura), plan Basic en prueba hasta 2026-11-03
- [x] El comando `/citas` del bot funciona para el dueño (próximas del salón), el profesional (las suyas) y el cliente (las suyas)
- [x] Interfaz adaptada al móvil (auditoría con navegador headless, 2026-10-21): diálogos con scroll y botones fijos, sin desbordes en el panel ni en el portal de plataforma, títulos legibles
- [x] Configuración por fichas (Negocio, Marca, Horarios, Cierres, Reservas, Avisos) en lugar de una página larguísima
- [x] Reserva pública más clara en móvil: «Paso X de N», resumen del servicio elegido, botón para copiar el enlace de la cita
- [x] Clientes sin credenciales de acceso (no hay portal): el formulario solo pide la ficha
- [x] Manual de usuario (`docs/manual/`): 20 capítulos, 43 capturas reales anotadas y mockups; versión web privada para compartir (2026-10-21)

## 3. Pendiente por tu parte
- [ ] **Yumi Manicure:** que entre con su correo y cambie la contraseña temporal en Mi perfil;
      subir su logo y elegir su color (Configuración → Marca); crear su bot en @BotFather y
      pegar el token (Configuración → Avisos); descargar el cartel QR (Configuración → Reservas)
      y mandárselo para imprimir
- [ ] Probar `/citas` desde el chat de Yumi (dueña y profesional) ya con el backend actualizado
- [ ] Ejecutar el checklist de pruebas con `@afilao_bot` (Telegram del dueño, del
      profesional y del cliente; staff; marca blanca; regresión)
- [ ] Comprar `afilao.app` (libre según RDAP al 2026-10)
- [ ] Reservar el usuario de Instagram y el nombre del bot de Telegram de Afilao
- [ ] Conseguir 1 o 2 salones piloto y llevarles la demo

## 4. Pendiente de desarrollo (por orden de prioridad)
1. [x] Logo y color del salón en los correos y en el cartel con QR (2026-10-20). Telegram solo envía texto: el logo del bot se pone en @BotFather → Edit Bot → Edit Botpic. `API_PUBLIC_URL` ya está definida en el backend (verificado)
2. [ ] **Siguiente paso:** archivar (desactivar) clientes. Hoy un cliente con citas no se puede borrar (2026-10-22), así que no hay forma de quitarlo de la lista. Añadir un estado «Archivado»: se oculta de la lista y del selector de citas nuevas, conserva su historial y se puede restaurar. Pide una migración de la base de datos.
3. [ ] Obligar a cambiar la contraseña temporal en el primer acceso
4. [ ] Página pública del salón (servicios, galería, botón de reservar) para
       compartir por WhatsApp e Instagram
5. [ ] Dominio propio y salida a producción (hoy corre en el host de prueba de Easypanel)
6. [ ] Respaldos de la base de datos a Drive (script listo; falta autorizar Drive y el cron)
7. [ ] Logo definitivo hecho por un diseñador (el actual es provisional)
8. [ ] Cupones en la app de staff (`yorde-what-store-mobile`); pospuesto a propósito
9. [ ] Cupos, fase 4 (solo si un salón lo pide): cupos solo para ciertos servicios y cantidad distinta en una fecha concreta

Hecho de esta lista:
- [x] El correo del cliente es opcional al crearlo a mano (2026-10-21)
- [x] El aviso «Completo» del calendario tiene en cuenta los cupos libres (2026-10-21)
- [x] CSS sobrante de la plantilla de Vite limpiado (2026-10-21)
- [x] Un cliente con citas ya no se puede borrar (2026-10-22)

## 5. Decisiones tomadas
- Un bot de Telegram por salón, creado por el propio salón en @BotFather. No un bot
  único de Afilao: se pierde la marca blanca.
- Sin pagos en línea por ahora.
- Los clientes no tienen portal ni cuenta: reservan sin registrarse y gestionan su cita con un enlace secreto.
- Reserva por cupos: el modo va por profesional, la duración del servicio no importa y cada
  hora es un cupo para un solo cliente. Un servicio de un profesional por cupos no usa recursos.
- Yumi Manicure empezó con el plan Basic (cambiable desde el panel de plataforma).
- Los datos de la demo son de prueba y se pueden borrar.
- Despliegue: Easypanel construye desde `main`; se pulsa Deploy a mano, primero
  backend (aplica migraciones) y después frontend.

## 6. Cómo ofrecerlo a un salón piloto
1. Crear su salón y su cuenta de dueño desde el panel de plataforma.
2. El dueño sube su logo y color (Configuración → Marca), carga servicios y profesionales, y elige por profesional si reserva por hora o por cupos.
3. Crear el bot en @BotFather y pegar el token en Configuración → Avisos.
4. Crear las cuentas de sus profesionales en Equipo.
5. Imprimir o compartir el enlace de reserva y el QR.

## 7. Registro de cambios
| Fecha | Cambio |
|---|---|
| 2026-10-20 | Documento creado a partir de lo hecho hasta la pantalla Equipo |
| 2026-10-21 | Logo y color del salón en correos y cartel QR (imagen PNG o impresión) |
| 2026-10-21 | Reserva por cupos: cada profesional reserva por hora o por cupos (horas exactas por día de la semana, un cliente por cupo). Salón piloto Yumi Manicure creado |
| 2026-10-21 | Reserva por cupos desplegada y Yumi configurada con cupos a las 9:00 y 13:00 (lunes a sábado) |
| 2026-10-21 | `/citas` del bot para dueño y profesionales (antes solo respondía a clientes) |
| 2026-10-21 | Auditoría de interfaces en móvil y PC: diálogos, desbordes, títulos, Configuración por fichas |
| 2026-10-21 | Reserva pública con pasos y resumen; clientes sin credenciales de acceso |
| 2026-10-21 | Manual de usuario de Afilao: capítulos, capturas anotadas, mockups y versión web |
| 2026-10-22 | Un cliente con citas ya no se puede borrar; archivar clientes queda como siguiente paso de desarrollo |
