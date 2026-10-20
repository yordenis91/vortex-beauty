# Plan de ventas de Afilao

Documento vivo. Al terminar o decidir algo, marca la casilla (`[x]`), añade la fecha
y anota en el registro del final. Si una decisión cambia, tacha la anterior en lugar
de borrarla.

**Última actualización:** 2026-10-20

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

## 3. Pendiente por tu parte
- [ ] Ejecutar el checklist de pruebas con `@afilao_bot` (Telegram del dueño, del
      profesional y del cliente; staff; marca blanca; regresión)
- [ ] Comprar `afilao.app` (libre según RDAP al 2026-10)
- [ ] Reservar el usuario de Instagram y el nombre del bot de Telegram de Afilao
- [ ] Revisar en el móvil el logo y el color de un salón en su página pública
- [ ] Conseguir 1 o 2 salones piloto y llevarles la demo

## 4. Pendiente de desarrollo (por orden de prioridad)
1. [ ] Logo del salón en correos, mensajes de Telegram y un cartel con QR para imprimir
2. [ ] Obligar a cambiar la contraseña temporal en el primer acceso
3. [ ] Página pública del salón (servicios, galería, botón de reservar) para
       compartir por WhatsApp e Instagram
4. [ ] Dominio propio y salida a producción (hoy corre en el host de prueba de Easypanel)
5. [ ] Respaldos de la base de datos a Drive (script listo; falta autorizar Drive y el cron)
6. [ ] Logo definitivo hecho por un diseñador (el actual es provisional)
7. [ ] Cupones en la app de staff (`yorde-what-store-mobile`); pospuesto a propósito

## 5. Decisiones tomadas
- Un bot de Telegram por salón, creado por el propio salón en @BotFather. No un bot
  único de Afilao: se pierde la marca blanca.
- Sin pagos en línea por ahora.
- Los datos de la demo son de prueba y se pueden borrar.
- Despliegue: Easypanel construye desde `main`; se pulsa Deploy a mano, primero
  backend (aplica migraciones) y después frontend.

## 6. Cómo ofrecerlo a un salón piloto
1. Crear su salón y su cuenta de dueño desde el panel de plataforma.
2. El dueño sube su logo y color, carga servicios y profesionales.
3. Crear el bot en @BotFather y pegar el token en Ajustes → Reservas.
4. Crear las cuentas de sus profesionales en Equipo.
5. Imprimir o compartir el enlace de reserva y el QR.

## 7. Registro de cambios
| Fecha | Cambio |
|---|---|
| 2026-10-20 | Documento creado a partir de lo hecho hasta la pantalla Equipo |
