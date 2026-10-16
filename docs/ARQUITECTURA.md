# Arquitectura

## Multi-tenant

Una sola base de datos y un solo schema. Cada tabla de negocio lleva `tenantId` y está protegida con Row-Level Security.

```mermaid
flowchart TB
    subgraph Clientes
        PUB[Reserva pública /:slug/reservar]
        ADM[Panel del salón]
        SA[Super Admin]
    end
    subgraph API["API Express"]
        MW1[helmet, CORS, rate limit]
        AUTH[authenticateToken: JWT + salón activo]
        CTX["AsyncLocalStorage: tenantId o bypass"]
        CAN[can: permisos por rol]
        R[Rutas]
        S["Servicios: availability, booking, planLimits"]
    end
    subgraph Datos
        PG[("Postgres + RLS + EXCLUDE")]
        Q[pg-boss: recordatorios]
    end
    PUB --> MW1
    ADM --> MW1
    SA --> MW1
    MW1 --> AUTH --> CTX --> CAN --> R --> S
    S -->|"set_config('app.tenant_id')"| PG
    S --> Q
```

Cómo se garantiza el aislamiento (de la capa más externa a la última defensa):

1. `authenticateToken` verifica el JWT, comprueba que el salón exista y no esté suspendido, y abre un contexto de tenant (`lib/tenantContext.ts`).
2. El cliente Prisma (`prismaClient.ts`) ejecuta cada consulta en una transacción que fija `app.tenant_id` (`set_config(..., true)`).
3. Las políticas RLS (migración `row_level_security`) solo dejan ver y escribir filas de ese tenant. Sin contexto no se ve ninguna fila.
4. Los tests de `src/tests/tenantIsolation.test.ts` fallan si una tabla con `tenantId` no tiene RLS forzada.

Reglas para el código nuevo:

- Transacciones: `runInTransaction` de `lib/db.ts`, nunca `prisma.$transaction` (hay un test que lo vigila).
- Una consulta Prisma es perezosa: dentro de `runWithTenant(id, () => prisma.x.findMany())` el helper ya la convierte en Promise; fuera de él, haz `await` dentro del callback.
- Rutas de plataforma: `runAsAdmin` (lo aplica `authenticatePlatformAdmin`).

## Modelo de dominio

Una cita es un servicio, hecho por un profesional, opcionalmente en un recurso, en un intervalo de tiempo.

```mermaid
erDiagram
    TENANT ||--|| TENANT_SETTINGS : configura
    TENANT ||--o{ SERVICE : ofrece
    TENANT ||--o{ PROFESSIONAL : emplea
    TENANT ||--o{ RESOURCE : posee
    TENANT ||--o{ CLIENT : atiende
    TENANT ||--o{ APPOINTMENT : agenda
    TENANT ||--o{ USER : tiene

    SERVICE }o--|| CATEGORY : pertenece
    SERVICE }o--o{ PROFESSIONAL : "lo realizan (ProfessionalService)"
    SERVICE }o--o{ RESOURCE : "puede usar (ServiceResource)"
    PROFESSIONAL ||--o{ PROFESSIONAL_SCHEDULE : "horario semanal"
    PROFESSIONAL ||--o{ TIME_OFF : ausencias
    PROFESSIONAL |o--o| USER : "cuenta STAFF"
    CLIENT |o--o| USER : "cuenta CLIENT"

    APPOINTMENT }o--|| CLIENT : reserva
    APPOINTMENT }o--|| SERVICE : servicio
    APPOINTMENT }o--o| PROFESSIONAL : atiende
    APPOINTMENT }o--o| RESOURCE : ocupa

    APPOINTMENT {
        timestamptz startsAt
        timestamptz endsAt
        timestamptz blockStartsAt "incluye preparación"
        timestamptz blockEndsAt "incluye limpieza"
        string serviceName "congelado"
        decimal priceAmount "congelado"
        int durationMin "congelado"
        enum status "PENDING SCHEDULED COMPLETED CANCELLED NO_SHOW"
    }
```

Garantías de la base de datos sobre `Appointment`:

- `EXCLUDE USING gist` por profesional y por recurso sobre `[blockStartsAt, blockEndsAt)` para citas `SCHEDULED`/`PENDING`: dos reservas simultáneas del mismo hueco nunca se confirman las dos.
- El precio, nombre y duración del servicio se congelan al reservar.

## Disponibilidad

`services/availability/engine.ts` calcula los huecos; `booking.ts` crea, reprograma y cancela recalculando dentro de una transacción SERIALIZABLE. Capas que se aplican, en orden: día cerrado, excepción de fecha, horario comercial, tope diario, antelación mínima y máxima (solo clientes), horario del profesional, ausencias, citas existentes con sus buffers, recurso libre.

La hora local de cada salón se guarda como instante absoluto usando `Tenant.timezone` (`lib/time.ts`).

## Roles

| Rol | Alcance |
|---|---|
| `OWNER` | Todo, incluidos plan y cuentas de profesionales |
| `ADMIN` | Opera el salón (agenda, catálogo, clientes, ajustes) |
| `STAFF` | Solo su propia agenda; lee clientes y catálogo |
| `CLIENT` | Cuenta de cliente final (portal) |
| `PlatformAdmin` | Super Admin, JWT y secreto aparte |

Tabla de permisos en `middleware/can.ts`.

## Verticales

`TenantSettings.vertical` + `services/verticalTemplates.ts`: al crear un salón se precargan servicios, recursos, horario y vocabulario según el tipo de negocio (manicura, barbería, spa, tatuajes, peluquería, entrenamiento, genérico). El vocabulario (`labels`) lo usa la interfaz vía `useLabels`.
