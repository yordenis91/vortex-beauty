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
