-- Reserva por cupos: cada profesional reserva por hora (TIMED, como hasta ahora) o por
-- cupos (QUOTA): una cantidad fija de clientes por día, a las horas exactas que él defina.
CREATE TYPE "BookingMode" AS ENUM ('TIMED', 'QUOTA');

ALTER TABLE "Professional" ADD COLUMN "bookingMode" "BookingMode" NOT NULL DEFAULT 'TIMED';

CREATE TABLE "ProfessionalQuotaSlot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "time" TEXT NOT NULL,

    CONSTRAINT "ProfessionalQuotaSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalQuotaSlot_professionalId_dayOfWeek_time_key" ON "ProfessionalQuotaSlot"("professionalId", "dayOfWeek", "time");
CREATE INDEX "ProfessionalQuotaSlot_tenantId_idx" ON "ProfessionalQuotaSlot"("tenantId");

ALTER TABLE "ProfessionalQuotaSlot" ADD CONSTRAINT "ProfessionalQuotaSlot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalQuotaSlot" ADD CONSTRAINT "ProfessionalQuotaSlot_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfessionalQuotaSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfessionalQuotaSlot" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProfessionalQuotaSlot"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');
