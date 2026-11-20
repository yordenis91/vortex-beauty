-- Campanita del panel: novedades de reservas (nueva, cambio, cancelación) y hasta dónde las ha visto cada persona.
CREATE TYPE "AppointmentEventKind" AS ENUM ('CREATED', 'RESCHEDULED', 'CANCELLED');

ALTER TABLE "User" ADD COLUMN "notificationsSeenAt" TIMESTAMP(3);

CREATE TABLE "AppointmentEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "AppointmentEventKind" NOT NULL,
    "appointmentId" TEXT,
    "professionalId" TEXT,
    "actor" "CancelledBy" NOT NULL,
    "actorUserId" TEXT,
    "source" "BookingSource" NOT NULL,
    "clientName" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "professionalName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "previousStartsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentEvent_tenantId_createdAt_idx" ON "AppointmentEvent"("tenantId", "createdAt");

ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AppointmentEvent"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');
