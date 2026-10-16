# Seguridad multi-tenant: checklist

Estado real de este repo. Cada punto indica dónde se garantiza y cómo se comprueba.

## Aislamiento entre salones

- [x] Toda tabla de negocio con `tenantId` tiene RLS activa y forzada. *Test:* `tenantIsolation.test.ts` falla si una tabla nueva con `tenantId` no la tiene (salvo las de plataforma listadas allí).
- [x] Sin contexto de tenant no se ve ninguna fila (falla "cerrado"). *Test:* `tenantIsolation.test.ts`.
- [x] El tenant sale del JWT o del slug de la URL, nunca del body ni de la query. Las rutas públicas lo resuelven por slug y corren dentro de su contexto.
- [x] No se puede leer, escribir, modificar ni borrar una fila de otro salón, ni con IDs adivinados. *Test:* matriz de rutas en `tenantIsolation.test.ts`.
- [x] Transacciones solo con `runInTransaction`. *Test:* `noExtendedTransactions.test.ts`.
- [ ] **Pendiente de operación:** que el API se conecte con un rol que no sea superusuario (`vortex_app`); si no, RLS no se aplica y el API lo avisa al arrancar (`docs/DEPLOYMENT.md`).
- [x] Rutas de plataforma con otro JWT, otro secreto (recomendado `PLATFORM_JWT_SECRET`) y contexto de bypass explícito.

## Sesiones y cuentas

- [x] Access token de 15 minutos solo en memoria del navegador; refresh token opaco en cookie `httpOnly`, `Secure` en producción, `SameSite=Lax`, ruta `/api/auth`.
- [x] Refresh token rotativo, solo se guarda su hash, y la reutilización de uno ya rotado revoca todas las sesiones del usuario. *Test:* `sessions.test.ts`.
- [x] Defensa CSRF en refresh y logout (cabecera `X-Requested-With` + CORS con orígenes permitidos).
- [x] Un usuario desactivado o un salón suspendido pierde el acceso: no puede renovar y el token vigente deja de servir en el siguiente chequeo del salón (caché de 15 s) o en 15 minutos como máximo.
- [x] Desactivar a un profesional desactiva su cuenta y revoca sus sesiones.
- [x] Contraseñas de 8 a 128 caracteres; `bcrypt`. Login con el mismo error para salón, correo o contraseña incorrectos.
- [x] Impersonación de soporte: 1 hora, queda en `AuditLog`, viaja en el hash de la URL y se muestra un aviso permanente.
- [ ] Sin bloqueo de cuenta por intentos fallidos (solo límite por IP en login y registro).
- [ ] La sesión del Super Admin sigue en `localStorage` (12 h); migrarla al mismo esquema de cookie queda pendiente.

## Endpoints públicos

- [x] Límite por IP (lectura 120/min, escritura 12/15 min), `trust proxy` configurado para Traefik.
- [x] Campo trampa, Turnstile opcional y tope de reservas activas por cliente.
- [x] Enlaces de gestión con token de 256 bits, válidos hasta 7 días después de la cita; cancelar o mover respeta la ventana del salón.
- [x] La reserva pública no revela si un cliente ya existía.
- [ ] El registro de cuentas (`/auth/register`) sí distingue "ya existe una cuenta con ese correo" (necesario para que el usuario sepa qué hacer).

## Datos y entrada

- [x] Esquema Zod en todas las rutas que leen `req.body`; errores 400 legibles.
- [x] Imágenes: solo PNG/JPG/WebP de hasta 1,5 MB (`lib/images.ts`); el navegador las reduce antes de subirlas. Cuerpo máximo 3 MB.
- [ ] Las imágenes siguen guardadas como data URL en Postgres; pasarlas a almacenamiento de objetos con URL firmada queda pendiente (requiere elegir proveedor).
- [x] Citas: `EXCLUDE` en la base impide solapes por profesional y recurso aunque falle el código.
- [x] Listados acotados (citas por rango y máximo 3000, clientes 2000, notificaciones 300).

## Operación

- [x] Logs JSON con `requestId` y `tenantId`; sin cabeceras `authorization` ni `cookie`.
- [x] Sentry opcional (`SENTRY_DSN`), sin datos personales.
- [x] `/api/health` comprueba la base de datos (503 si no responde).
- [x] Secretos obligatorios al arrancar (`JWT_SECRET`, `DATABASE_URL`); sin valores por defecto en el código.
- [x] Webhook de Mercado Pago: firma validada, el detalle se pide a su API y el registro es idempotente (`PLAT-MP-<id>`). *Test:* `webhookIdempotency.test.ts`.
- [x] CI: lint, build, tipos, tests con Postgres real y `npm audit` informativo.
- [x] nginx del frontend con cabeceras de seguridad básicas.
