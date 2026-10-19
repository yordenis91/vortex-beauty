# Despliegue - Backend

Este documento resume los pasos, variables y comandos recomendados para desplegar el servicio `backend` en Easypanel (servicio separado: backend, frontend, bd).

## Archivos relevantes
- Ejemplo de variables: [backend/.env.example](backend/.env.example)
- Scripts de producción: [backend/package.json](backend/package.json)

## Variables de entorno mínimas
- `DATABASE_URL` — URL de Postgres (p. ej. `postgresql://user:pass@db:5432/dbname?schema=public`)
- `NODE_ENV=production`
- `PORT=3000`
- `JWT_SECRET`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (si usas email)
- Cualquier clave de terceros (S3, Twilio, etc.)

No subir `.env` al repo; usar la sección de Secrets/Environment en Easypanel.

## Comandos útiles (local / debugging)
Para construir y ejecutar localmente (requiere variables de entorno configuradas):

```bash
cd backend
npm ci
npm run build:prod      # genera cliente Prisma y compila TS
npm run start:prod      # aplica migraciones (migrate:deploy) y arranca
```

Si sólo quieres correr en modo dev:

```bash
npm run dev
```

## Configuración recomendada en Easypanel
- Build: usar el Dockerfile del repo (o imagen build automática de Easypanel).
- Environment / Secrets: pegar `DATABASE_URL`, `NODE_ENV`, `JWT_SECRET`, etc.
- Command / Start: dejar el `CMD` del Dockerfile o forzar el comando de arranque a:

```bash
npm run start:prod
```

- Healthcheck: configurar healthcheck hacia `http://<service_host>:3000/health` o el endpoint que exponga la app.
- Ports: exponer el puerto `3000` internamente; Easypanel se encarga del proxy/ingress.
- Restart policy: reinicio automático on-failure.
- Dockerignore: usar [backend/.dockerignore](backend/.dockerignore) para excluir `node_modules`, `dist`, `.env`, y archivos de desarrollo.
- Non-root: el Dockerfile usa un usuario no-root (`appuser`) en runtime.

## Migraciones y seeds
Recomiendo ejecutar migraciones durante el arranque del contenedor para evitar inconsistencias.

- El proyecto incluye los scripts:
  - `migrate:deploy` — aplica migraciones en producción
  - `prisma:generate` — genera el cliente Prisma
  - `seed` — corre las semillas

- Opción A (post-deploy manual en Easypanel): configurar un comando post-deploy:

```bash
cd /app
npx prisma migrate deploy
npm run seed   # opcional
```

- Opción B (arranque automático): usar `npm run start:prod` como comando de inicio (ya ejecuta `migrate:deploy` antes de arrancar).

## Logs, métricas y salud
- Exponer un endpoint `/health` que devuelva 200 simple.
- Enviar stdout/stderr a logs (Easypanel recoge automáticamente los logs del contenedor).
- Considerar integrar un exporter o APM si necesitas métricas (Prometheus, Datadog).

## Backups y rollback
- Backups: programar `pg_dump` o usar snapshot del servicio de DB que provea Easypanel.
- Rollback: mantener tags de imagen y redeployar la versión anterior en caso de fallo.

## Seguridad y buenas prácticas
- No correr como root en producción (configurar user en Dockerfile).
- Usar `NODE_ENV=production` y eliminar devDependencies en la imagen final.
- Limitar permisos del usuario DB.
- Rotar `JWT_SECRET` y claves regularmente.

## Checklist rápido antes de desplegar
- Variables de entorno configuradas en Easypanel
- Imagen construida con `prisma generate` y `tsc`
- Migraciones probadas (staging) y `migrate:deploy` preparado
- Healthcheck configurado
- Backups habilitados para BD

---
Si quieres, puedo:
- crear un `health` endpoint si no existe (revisar `src/index.ts`),
- o preparar un pequeño `runbook.md` con comandos de emergencia (rollback, restauración DB).

## Aislamiento entre salones (RLS)

La base aplica Row-Level Security: cada petición fija `app.tenant_id` y las políticas solo dejan ver filas de ese salón. **RLS no se aplica a superusuarios ni a roles con BYPASSRLS.** Si la app se conecta con el usuario por defecto de Postgres (superusuario), el aislamiento depende solo del código; al arrancar, el API avisa con `[seguridad] ... las políticas RLS NO se aplican`.

Para activarlo en producción, la migración `row_level_security` crea el rol `vortex_app` (sin login). Crea un usuario que lo herede y apunta `DATABASE_URL` a él en el servicio del API:

```sql
CREATE ROLE vortex_api LOGIN PASSWORD '<una-clave-larga>' IN ROLE vortex_app;
```

Las migraciones (`prisma migrate deploy`, que `start:prod` ejecuta al arrancar) corren con el usuario administrador: define `MIGRATE_DATABASE_URL` con sus credenciales y deja `DATABASE_URL` con `vortex_api`. Si falta, se usa `DATABASE_URL`. Para que pg-boss cree su schema sin `QUEUE_DATABASE_URL`, da `GRANT CREATE ON DATABASE <base> TO vortex_api;`.

## Acceso por salón

El login es siempre por salón: `/:slug/login`. El mismo email puede existir en salones distintos. No hay registro público de clientas: reservan sin cuenta.

## Reserva pública, correos y recordatorios

Cada salón tiene una página pública de reserva sin cuenta en `https://<tu-dominio>/<slug>/reservar`. El cliente recibe un enlace secreto (`/<slug>/mi-cita/<token>`) para cambiar o cancelar.

Variables del API para los avisos:

| Variable | Para qué |
|---|---|
| `APP_PUBLIC_URL` | URL pública del frontend; se usa en los enlaces de los correos (`https://app.ejemplo.com`) |
| `SMTP_URL` o `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` | Envío de correos con cualquier proveedor SMTP (Resend, Brevo, Gmail...). Sin esto, los avisos quedan registrados como `FAILED` |
| `MAIL_FROM` | Remitente, p. ej. `Mi Salón <reservas@misalon.com>` |
| `TURNSTILE_SECRET` y `TURNSTILE_SITE_KEY` | Verificación anti-bots de Cloudflare Turnstile en la reserva pública (opcional) |
| `QUEUE_DATABASE_URL` | Conexión de la cola de trabajos con permiso para crear el schema `pgboss`. Por defecto usa `DATABASE_URL` |
| `WORKER_EMBEDDED` | `false` si ejecutas el worker aparte (`node dist/src/worker.js`) |
| `TRUST_PROXY` | Saltos de proxy delante de la API (por defecto 1: Traefik) para que los límites por IP vean la IP real |

La cola usa `pg-boss` sobre la propia Postgres: no hace falta Redis. Los recordatorios (por defecto 24 h y 2 h antes) y las confirmaciones los procesa el worker, que corre dentro de la API salvo que se desactive. Los avisos al dueño pueden ir también a Telegram (token del bot y chat en Ajustes).

## Sesiones, logs y monitoreo

| Variable | Para qué |
|---|---|
| `COOKIE_SAMESITE` | `lax` por defecto (frontend y API en el mismo dominio registrable, p. ej. `app.x.com` y `api.x.com`). Si están en dominios distintos usa `none` (exige HTTPS) |
| `REFRESH_TTL_DAYS` | Duración máxima de una sesión (30 por defecto); el access token dura 15 minutos |
| `LOG_LEVEL` | `info` por defecto; los logs salen en JSON, uno por línea |
| `SENTRY_DSN` | Envía errores no controlados a Sentry (opcional) |
| `PRISMA_LOG_QUERIES=1` | Registra las consultas SQL (solo para depurar) |

`GET /api/health` responde 200 si la base de datos contesta y 503 si no: úsalo como health check de Easypanel.

## Telegram para clientes

Cada salón usa su propio bot (token de @BotFather) que pega en Ajustes → Reservas. Al guardar, el API valida el token y registra el webhook `POST /api/telegram/webhook/:tenantId` en Telegram con un secreto propio del salón. Requisitos:

- El API debe ser accesible por **HTTPS público** (Telegram no llama a `http` ni a hosts internos). La URL se toma de la propia petición; si hay un proxy que la cambia, define `API_PUBLIC_URL=https://tu-api`.
- El cliente enlaza su chat desde la confirmación de su reserva (botón «Recibir avisos por Telegram»); desde entonces los avisos le llegan por Telegram y, si bloquea el bot, vuelven al correo.
- El dueño recibe los avisos del salón enviando `/vincular <código>` al bot (el código aparece en Ajustes y se renueva al usarse).
- Comandos del bot para clientes: `/citas` (próximas citas), `/historial` (últimos 5 trabajos completados) y `/parar` (dejar de recibir avisos).
- **Avisos al profesional:** cada profesional con cuenta enlaza su Telegram desde Mi perfil: abre el bot del salón y envía `/vincular <código>` (el código es de un solo uso). Desde entonces recibe solo el aviso de sus citas nuevas y canceladas; `/parar` o «Desvincular» en Mi perfil lo corta. Si el dueño es también el chat enlazado, no recibe el aviso duplicado. Desconectar el bot del salón desvincula a todos.

## Respaldos automáticos

Cada día (03:00 UTC por defecto) el worker hace `pg_dump --format=custom` de la base y lo sube a un bucket S3 compatible (MinIO en Easypanel). El horario vive en pg-boss: con varias réplicas solo una lo ejecuta. Sin las variables `BACKUP_S3_*` el API arranca igual pero avisa `[backup] DESACTIVADO` en los logs: **sin ellas no hay copias**.

| Variable | Descripción |
|---|---|
| `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | Obligatorias. Pónlas como secretos en Easypanel, nunca en el repo. |
| `BACKUP_S3_REGION` | `us-east-1` por defecto (los S3 no-AWS lo ignoran). |
| `BACKUP_CRON` / `BACKUP_TZ` | `0 3 * * *` / `UTC`. |
| `BACKUP_RETENTION_DAYS` | 30. Se borran las copias más viejas tras subir la nueva; la más reciente nunca se borra. |
| `BACKUP_DATABASE_URL` | Usuario para el dump. Por defecto `MIGRATE_DATABASE_URL` y luego `DATABASE_URL`. **No debe ser `vortex_api`**: RLS ocultaría filas y el respaldo saldría incompleto o fallaría. |
| `BACKUP_HEARTBEAT_URL` | Opcional: monitor tipo healthchecks.io; recibe un aviso en cada éxito y en cada fallo (`/fail`). |

Detalles:
- Las copias van bajo el prefijo `vortex-beauty-db/` del bucket; la retención solo toca ese prefijo, así que el bucket puede compartirse. Lo recomendable es un bucket y credenciales propios por proyecto.
- El dump incluye todo el schema público, las extensiones (`btree_gist`) y las imágenes (viven en la base). Excluye el schema `pgboss` (estado de la cola): restaurarlo reviviría recordatorios ya enviados.
- La imagen del API trae `pg_dump` (`postgresql17-client`); debe ser de la misma versión mayor que el servidor o superior.
- Si un respaldo falla, pg-boss reintenta 2 veces cada 10 minutos y deja el error en los logs (`[backup] FALLÓ`).

### Comprobar que funcionan

Dentro del contenedor del API (o con `npm run backup:status` en local):

```bash
node dist/src/scripts/backupCli.js status      # lista las copias; sale con error si la última tiene más de 26 h
node dist/src/scripts/backupCli.js run         # hace un respaldo ahora mismo
node dist/src/scripts/backupCli.js download x.dump   # baja la más reciente
```

### Restaurar (siempre primero en una base de prueba)

```bash
createdb vortex_restore_test
pg_restore --dbname="postgresql://<usuario>:<clave>@<host>/vortex_restore_test" --no-owner --clean --if-exists --exit-on-error x.dump
```

`--clean --if-exists` evita el choque con el schema `public` que ya trae toda base nueva. Después comprueba tablas y conteos (`Tenant`, `User`, `Appointment`, `_prisma_migrations`). Para restaurar en producción con RLS, el rol `vortex_app` debe existir antes (lo crea la migración `row_level_security`, o créalo a mano: `CREATE ROLE vortex_app NOLOGIN`) y reaplica `GRANT` si cambias de usuario de la app. Haz un ensayo de restauración al menos una vez al mes.

## Alta de un salón nuevo (Super Admin)

Super Admin → Salones → **Nuevo salón** abre un asistente de 3 pasos:

1. **Negocio:** nombre, enlace de reservas (`/r/<slug>`, comprobado en vivo; hay nombres reservados como `admin`, `r` o `login`), oficio, zona horaria, moneda y plan.
2. **Servicios y horario:** servicios, profesionales y horario precargados con la plantilla del oficio y editables. Todos los profesionales atienden todos los servicios; el horario del negocio es también el de cada profesional. Respeta el límite de profesionales del plan.
3. **Dueño y bot:** nombre y correo del dueño (su usuario) y, opcionalmente, el token del bot de Telegram del salón.

Al terminar muestra un mensaje listo para enviar al dueño (enlace de reservas, panel, correo y contraseña temporal, que solo se ve una vez), el QR con cartel imprimible y, si se indicó el bot, el comando `/vincular <código>` para que el dueño reciba los avisos. Si el bot falla, el salón se crea igual y se puede conectar luego en Ajustes. Los servicios nacen en la moneda del salón.

API: `POST /api/platform/tenants` (acepta `timezone`, `currency`, `professionals`, `services`, `hours`, `telegramBotToken`), `GET /api/platform/tenants/templates` y `GET /api/platform/tenants/slug-available?slug=`.
