-- Marca blanca por salón: logo (data URL pequeño) y color de acción de su página de reserva.
ALTER TABLE "TenantSettings"
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "brandColor" TEXT;
