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

Las migraciones (`prisma migrate deploy`) siguen corriendo con el usuario administrador: usa una `DATABASE_URL` distinta para el paso de migración, o ejecútalo desde un job aparte.

## Acceso por salón

El login y el registro son siempre por salón: `/:slug/login` y `/:slug/register`. El mismo email puede existir en salones distintos.

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
