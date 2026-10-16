# vortex-beauty

Sistema de reservas de citas multi-tenant para negocios de servicios (manicura, barbería, spa, tatuajes y cualquier negocio con agenda). El cliente final reserva solo, sin intermediarios.

## Stack

- **Backend:** Node 22, Express 5, TypeScript, Prisma 7 + PostgreSQL, JWT, Zod
- **Frontend:** React 19, Vite, Tailwind 4, shadcn/Radix, TanStack Query
- **Multi-tenant:** una base de datos, columna `tenantId` en cada tabla de negocio con Row-Level Security (ver `docs/ARQUITECTURA.md`)

## Desarrollo

```bash
# Base de datos
docker compose up -d db

# Backend
cd backend
cp .env.example .env        # ajusta DATABASE_URL y JWT_SECRET
npm ci
npx prisma migrate deploy
npm run seed
npm run dev                 # http://localhost:3001

# Frontend
cd frontend
npm ci --legacy-peer-deps
npm run dev                 # http://localhost:5173
```

Variables obligatorias del backend: `DATABASE_URL`, `JWT_SECRET`. Recomendadas en producción: `PLATFORM_JWT_SECRET` (distinta de `JWT_SECRET`) y `CORS_ORIGINS`.

## Tests

```bash
cd backend
RUN_DB_TESTS=1 DATABASE_URL=postgresql://user:pass@localhost:5432/vortex_test npm test
```

## Documentación

- `docs/ARQUITECTURA.md`: multi-tenant (RLS), modelo de dominio, disponibilidad y roles
- `docs/DEPLOYMENT.md`: despliegue en Easypanel
- `docs/legacy/`: notas de implementación del sistema original (pueden estar desactualizadas)
