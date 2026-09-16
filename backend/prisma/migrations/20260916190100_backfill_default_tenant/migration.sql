-- Backfill: crea un tenant "de arranque" para los datos que ya existían
-- antes del soporte multitenant, y se lo asigna a cada fila que todavía no
-- tiene tenantId. El nombre es un placeholder genérico ("Salón Principal");
-- se puede renombrar más adelante desde una futura pantalla de
-- configuración del salón — no bloquea esta migración.
DO $$
DECLARE
  default_tenant_id TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Tenant" LIMIT 1) THEN
    default_tenant_id := gen_random_uuid()::text;
    INSERT INTO "Tenant" (id, name, slug, currency, timezone, status, "createdAt", "updatedAt")
    VALUES (default_tenant_id, 'Salón Principal', 'salon-principal', 'USD', 'UTC', 'ACTIVE', now(), now());
  ELSE
    SELECT id INTO default_tenant_id FROM "Tenant" ORDER BY "createdAt" ASC LIMIT 1;
  END IF;

  UPDATE "User" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Client" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Product" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Category" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Staff" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Appointment" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "BusinessHour" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "ClosedDate" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "ScheduleOverride" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Invoice" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Subscription" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Ticket" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "KnowledgeBase" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "Notification" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
  UPDATE "GalleryItem" SET "tenantId" = default_tenant_id WHERE "tenantId" IS NULL;
END $$;
