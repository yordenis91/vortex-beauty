-- Fase 2: dominio multi-vertical (servicio + profesional + recurso + cita).
--
-- * Product -> Service, Staff -> Professional (renombrado, conserva los datos)
-- * Appointment pasa de date + "HH:mm" a instantes absolutos (timestamptz) y
--   congela precio, duración y nombre del servicio
-- * Nuevas tablas: horarios y ausencias de profesionales, recursos, ajustes
-- * Restricciones EXCLUDE: ni un profesional ni un recurso pueden tener dos
--   citas activas solapadas, aunque dos peticiones lleguen a la vez

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Product" RENAME TO "Service";
ALTER TABLE "Staff" RENAME TO "Professional";
ALTER TYPE "ProductStatus" RENAME TO "ServiceStatus";
ALTER TABLE "Appointment" RENAME COLUMN "productId" TO "serviceId";
ALTER TABLE "Appointment" RENAME COLUMN "staffId" TO "professionalId";
ALTER TABLE "GalleryItem" RENAME COLUMN "productId" TO "serviceId";

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ADMIN', 'PORTAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "Vertical" AS ENUM ('GENERIC', 'NAILS', 'BARBER', 'SPA', 'TATTOO', 'HAIR', 'FITNESS');

-- DropIndex
DROP INDEX "Appointment_date_idx";

-- DropIndex
DROP INDEX "Appointment_staffId_idx";

-- DropIndex
DROP INDEX "Appointment_status_idx";

-- DropIndex
DROP INDEX "Appointment_tenantId_idx";

-- AlterTable (columnas nuevas de Appointment; NOT NULL se aplica tras el backfill)
ALTER TABLE "Appointment"
ADD COLUMN     "blockEndsAt" TIMESTAMPTZ(3),
ADD COLUMN     "blockStartsAt" TIMESTAMPTZ(3),
ADD COLUMN     "bufferAfterMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" "CancelledBy",
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "durationMin" INTEGER,
ADD COLUMN     "endsAt" TIMESTAMPTZ(3),
ADD COLUMN     "priceAmount" DECIMAL(10,2),
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "serviceName" TEXT,
ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'ADMIN',
ADD COLUMN     "startsAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Professional" RENAME CONSTRAINT "Staff_pkey" TO "Professional_pkey";
ALTER TABLE "Professional"
ADD COLUMN     "acceptsOnlineBookings" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Service" RENAME CONSTRAINT "Product_pkey" TO "Service_pkey";
ALTER TABLE "Service"
ADD COLUMN     "bufferAfterMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBeforeMin" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "onlineBookable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProfessionalService" (
    "tenantId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "ProfessionalService_pkey" PRIMARY KEY ("professionalId","serviceId")
);

-- CreateTable
CREATE TABLE "ProfessionalSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "ProfessionalSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceResource" (
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,

    CONSTRAINT "ServiceResource_pkey" PRIMARY KEY ("serviceId","resourceId")
);

-- CreateTable
CREATE TABLE "TenantSettings" (
    "tenantId" TEXT NOT NULL,
    "vertical" "Vertical" NOT NULL DEFAULT 'GENERIC',
    "slotIntervalMin" INTEGER NOT NULL DEFAULT 30,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 2,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "cancelWindowHrs" INTEGER NOT NULL DEFAULT 12,
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "labels" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "ProfessionalService_tenantId_idx" ON "ProfessionalService"("tenantId");

-- CreateIndex
CREATE INDEX "ProfessionalService_serviceId_idx" ON "ProfessionalService"("serviceId");

-- CreateIndex
CREATE INDEX "ProfessionalSchedule_tenantId_idx" ON "ProfessionalSchedule"("tenantId");

-- CreateIndex
CREATE INDEX "ProfessionalSchedule_professionalId_dayOfWeek_idx" ON "ProfessionalSchedule"("professionalId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimeOff_tenantId_idx" ON "TimeOff"("tenantId");

-- CreateIndex
CREATE INDEX "TimeOff_professionalId_startsAt_idx" ON "TimeOff"("professionalId", "startsAt");

-- CreateIndex
CREATE INDEX "Location_tenantId_idx" ON "Location"("tenantId");

-- CreateIndex
CREATE INDEX "Resource_tenantId_idx" ON "Resource"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceResource_tenantId_idx" ON "ServiceResource"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceResource_resourceId_idx" ON "ServiceResource"("resourceId");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_startsAt_idx" ON "Appointment"("tenantId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_tenantId_status_idx" ON "Appointment"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Appointment_professionalId_startsAt_idx" ON "Appointment"("professionalId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_resourceId_startsAt_idx" ON "Appointment"("resourceId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Professional_userId_key" ON "Professional"("userId");

-- RenameForeignKey
ALTER TABLE "Appointment" RENAME CONSTRAINT "Appointment_productId_fkey" TO "Appointment_serviceId_fkey";

-- RenameForeignKey
ALTER TABLE "Appointment" RENAME CONSTRAINT "Appointment_staffId_fkey" TO "Appointment_professionalId_fkey";

-- RenameForeignKey
ALTER TABLE "GalleryItem" RENAME CONSTRAINT "GalleryItem_productId_fkey" TO "GalleryItem_serviceId_fkey";

-- RenameForeignKey
ALTER TABLE "Professional" RENAME CONSTRAINT "Staff_tenantId_fkey" TO "Professional_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "Service" RENAME CONSTRAINT "Product_categoryId_fkey" TO "Service_categoryId_fkey";

-- RenameForeignKey
ALTER TABLE "Service" RENAME CONSTRAINT "Product_tenantId_fkey" TO "Service_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "Service" RENAME CONSTRAINT "Product_userId_fkey" TO "Service_userId_fkey";

-- AddForeignKey
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalService" ADD CONSTRAINT "ProfessionalService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSchedule" ADD CONSTRAINT "ProfessionalSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfessionalSchedule" ADD CONSTRAINT "ProfessionalSchedule_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceResource" ADD CONSTRAINT "ServiceResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSettings" ADD CONSTRAINT "TenantSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Appointment_productId_idx" RENAME TO "Appointment_serviceId_idx";

-- RenameIndex
ALTER INDEX "GalleryItem_productId_idx" RENAME TO "GalleryItem_serviceId_idx";

-- RenameIndex
ALTER INDEX "Staff_isActive_idx" RENAME TO "Professional_isActive_idx";

-- RenameIndex
ALTER INDEX "Staff_tenantId_idx" RENAME TO "Professional_tenantId_idx";

-- RenameIndex
ALTER INDEX "Product_categoryId_idx" RENAME TO "Service_categoryId_idx";

-- RenameIndex
ALTER INDEX "Product_tenantId_idx" RENAME TO "Service_tenantId_idx";

-- RenameIndex
ALTER INDEX "Product_userId_idx" RENAME TO "Service_userId_idx";


-- ================= Datos existentes =================

-- Ajustes por defecto para cada salón.
INSERT INTO "TenantSettings" ("tenantId", "updatedAt")
SELECT id, now() FROM "Tenant"
ON CONFLICT DO NOTHING;

-- El primer administrador de cada salón pasa a ser su dueño.
UPDATE "User" u SET role = 'OWNER'
WHERE u.role = 'ADMIN'
  AND u.id = (SELECT u2.id FROM "User" u2 WHERE u2."tenantId" = u."tenantId" AND u2.role = 'ADMIN' ORDER BY u2."createdAt", u2.id LIMIT 1);

-- Todo salón necesita al menos un profesional: el modelo anterior trataba al
-- salón entero como un único recurso, que ahora pasa a ser "Principal".
INSERT INTO "Professional" (id, name, "tenantId", "updatedAt")
SELECT gen_random_uuid()::text, 'Principal', t.id, now()
FROM "Tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "Professional" p WHERE p."tenantId" = t.id);

-- Cada profesional realiza todos los servicios de su salón...
INSERT INTO "ProfessionalService" ("tenantId", "professionalId", "serviceId")
SELECT p."tenantId", p.id, s.id
FROM "Professional" p JOIN "Service" s ON s."tenantId" = p."tenantId";

-- ...y trabaja en el horario comercial del salón.
INSERT INTO "ProfessionalSchedule" (id, "tenantId", "professionalId", "dayOfWeek", "startTime", "endTime")
SELECT gen_random_uuid()::text, p."tenantId", p.id, bh."dayOfWeek", bh."startTime", bh."endTime"
FROM "Professional" p JOIN "BusinessHour" bh ON bh."tenantId" = p."tenantId" AND bh."isOpen";

-- Citas existentes sin profesional: al profesional más antiguo del salón.
UPDATE "Appointment" a SET "professionalId" = (
  SELECT p.id FROM "Professional" p WHERE p."tenantId" = a."tenantId" ORDER BY p."createdAt", p.id LIMIT 1
) WHERE a."professionalId" IS NULL;

-- Backfill de Appointment: hora local del salón -> instante absoluto.
UPDATE "Appointment" a SET
  "startsAt" = (a."date"::date + a."startTime"::time) AT TIME ZONE t.timezone,
  "endsAt" = (a."date"::date + a."endTime"::time) AT TIME ZONE t.timezone,
  "blockStartsAt" = (a."date"::date + a."startTime"::time) AT TIME ZONE t.timezone,
  "blockEndsAt" = (a."date"::date + a."endTime"::time) AT TIME ZONE t.timezone,
  "durationMin" = (EXTRACT(EPOCH FROM (a."endTime"::time - a."startTime"::time)) / 60)::int,
  "serviceName" = s.name,
  "priceAmount" = s.price,
  "currency" = s.currency,
  "cancelledBy" = CASE WHEN a.status = 'CANCELLED' THEN 'STAFF'::"CancelledBy" ELSE NULL END
FROM "Tenant" t, "Service" s
WHERE t.id = a."tenantId" AND s.id = a."serviceId";

ALTER TABLE "Appointment"
  ALTER COLUMN "startsAt" SET NOT NULL,
  ALTER COLUMN "endsAt" SET NOT NULL,
  ALTER COLUMN "blockStartsAt" SET NOT NULL,
  ALTER COLUMN "blockEndsAt" SET NOT NULL,
  ALTER COLUMN "durationMin" SET NOT NULL,
  ALTER COLUMN "serviceName" SET NOT NULL,
  ALTER COLUMN "priceAmount" SET NOT NULL,
  DROP COLUMN "date",
  DROP COLUMN "startTime",
  DROP COLUMN "endTime";

-- ================= Anti doble reserva =================

-- Ni un profesional ni un recurso pueden tener dos citas activas solapadas
-- (considerando preparación y limpieza). Es la garantía final: aunque el código
-- de reservas falle o dos peticiones compitan, la base rechaza el segundo INSERT.
ALTER TABLE "Appointment" ADD CONSTRAINT "appointment_no_overlap_professional"
  EXCLUDE USING gist ("professionalId" WITH =, tstzrange("blockStartsAt", "blockEndsAt", '[)') WITH &&)
  WHERE (status IN ('SCHEDULED', 'PENDING') AND "professionalId" IS NOT NULL);

ALTER TABLE "Appointment" ADD CONSTRAINT "appointment_no_overlap_resource"
  EXCLUDE USING gist ("resourceId" WITH =, tstzrange("blockStartsAt", "blockEndsAt", '[)') WITH &&)
  WHERE (status IN ('SCHEDULED', 'PENDING') AND "resourceId" IS NOT NULL);

-- ================= RLS en las tablas nuevas =================

ALTER TABLE "ProfessionalService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfessionalService" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProfessionalService"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "ProfessionalSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfessionalSchedule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProfessionalSchedule"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "TimeOff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TimeOff" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TimeOff"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "Location" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Location" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Location"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "Resource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Resource" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Resource"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "ServiceResource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceResource" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ServiceResource"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');

ALTER TABLE "TenantSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantSettings" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TenantSettings"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vortex_app;
