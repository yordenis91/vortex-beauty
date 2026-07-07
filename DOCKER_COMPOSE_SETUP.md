# Docker Compose Setup

Este proyecto usa Docker Compose con una estructura separada entre desarrollo y producción.

## Archivos Compose

### 1. `docker-compose.yml` (Base)
La configuración base y neutral. Define los servicios generales (db, backend, frontend).

### 2. `docker-compose.override.yml` (Desarrollo)
Se carga **automáticamente** cuando ejecutas `docker compose up` sin argumentos.
- Volúmenes para hot-reload de código
- Variables de entorno de desarrollo
- Comando `npm run dev` para desarrollo
- Healthchecks reducidos

### 3. `docker-compose.prod.yml` (Producción)
Usada explícitamente con `-f` flag para producción.
- `restart: always` en todos los servicios
- Optimizaciones para producción
- Variables de entorno desde `.env` file

## Cómo usar

### Desarrollo Local

```bash
# Copiar archivo de entorno de desarrollo
cp .env.development .env

# Iniciar servicios (carga automáticamente docker-compose.override.yml)
docker compose up -d

# Ver logs
docker compose logs -f

# Parar servicios
docker compose down
```

**URLs en desarrollo:**
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- PostgreSQL: localhost:5432

### Producción

```bash
# Copiar archivo de entorno de producción y actualizar valores
cp .env.example .env

# Editar .env con valores reales
nano .env

# Iniciar servicios con compose específico de producción
docker compose -f docker-compose.prod.yml -f docker-compose.yml up --build -d

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Parar servicios
docker compose -f docker-compose.prod.yml down
```

**Cambio importante en producción:**
- Asegúrate de actualizar `VITE_API_BASE_URL` en `.env` al dominio público
- Ejemplo: `VITE_API_BASE_URL=https://api.tudominio.com/api`

## Variables de Entorno

### `.env.example`
Plantilla para producción. Copiar a `.env` y actualizar valores sensibles.

### `.env.development`
Configuración predefinida para desarrollo local.

### `.env` (en runtime)
Archivo local actual (no versionado por `.gitignore`).

## Diferencias Clave

| Aspecto | Desarrollo | Producción |
|--------|-----------|-----------|
| Compose file | `override.yml` + `docker-compose.yml` | `prod.yml` + `docker-compose.yml` |
| `restart` | `unless-stopped` | `always` |
| Volúmenes | Sí (hot-reload) | No |
| Backend comandoComando | `npm run dev` | `npm run start` |
| Frontend puerto | 5173 | 80 |
| Backend puerto | 3000 | 3000 |
| NODE_ENV | development | production |
| Healthchecks | Básicos | Completos |

## Migraciones de Prisma

### Desarrollo

```bash
# Dentro del contenedor backend
docker compose exec backend npx prisma migrate dev

# O desde el host (si tienes Node.js)
cd backend && npx prisma migrate dev
```

### Producción

```bash
# Las migraciones se ejecutan automáticamente al iniciar el backend
# (recomendado configurar un init script en el Dockerfile)

# O manualmente:
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

## Recomendaciones

1. **Nunca versionar `.env`** - Ya está en `.gitignore`
2. **Usar `.env.example`** para documentar variables requeridas
3. **En producción**, usar un `.env` file seguro en el servidor
4. **Base de datos**: PostgreSQL gestionado en producción (AWS RDS, DigitalOcean, etc.) en lugar de contenedor
5. **SSL/TLS**: Configurar reverse proxy (Nginx, Traefik) en producción

## Troubleshooting

### Backend no se conecta a la BD

- Verifica que `db` esté sano: `docker compose ps`
- Revisa logs: `docker compose logs db`
- En dev, asegúrate de que `docker-compose.override.yml` está siendo cargado

### Frontend no acede al backend

- Verifica `VITE_API_BASE_URL` en tu `.env`
- En dev: `http://localhost:3000/api`
- En prod: tu dominio público + `/api`

### Puertos en uso

```bash
# Cambiar puerto en .env
BACKEND_PORT=3001
FRONTEND_PORT=5174
```
