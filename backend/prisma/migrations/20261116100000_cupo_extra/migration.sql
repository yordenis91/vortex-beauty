-- Cupo extra: una hora más para un profesional por cupos en una fecha concreta, sin tocar sus cupos semanales.
CREATE TABLE "ProfessionalQuotaExtra" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalQuotaExtra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalQuotaExtra_professionalId_date_time_key" ON "ProfessionalQuotaExtra"("professionalId", "date", "time");
CREATE INDEX "ProfessionalQuotaExtra_tenantId_date_idx" ON "ProfessionalQuotaExtra"("tenantId", "date");

ALTER TABLE "ProfessionalQuotaExtra" ADD CONSTRAINT "ProfessionalQuotaExtra_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalQuotaExtra" ADD CONSTRAINT "ProfessionalQuotaExtra_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfessionalQuotaExtra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfessionalQuotaExtra" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProfessionalQuotaExtra"
  USING ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true) OR current_setting('app.bypass_rls', true) = 'on');
