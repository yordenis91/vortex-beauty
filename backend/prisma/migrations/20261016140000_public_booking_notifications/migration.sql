-- Fase 3: reserva pública sin cuenta, avisos por correo/Telegram y recordatorios.
--
-- * Client.email pasa a ser opcional (se puede identificar solo por teléfono) y
--   Client.phoneKey (teléfono normalizado) reconoce al mismo cliente entre reservas
-- * Appointment.cancelToken: enlace para cancelar o reprogramar sin cuenta
-- * TenantSettings: recordatorios, avisos al dueño y bot de Telegram
-- * Notification.dedupeKey: evita avisos duplicados cuando un trabajo se reintenta

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TELEGRAM';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "cancelToken" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "phoneKey" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "maxActivePerCustomer" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "ownerAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderHours" INTEGER[] DEFAULT ARRAY[24, 2]::INTEGER[],
ADD COLUMN     "telegramBotToken" TEXT,
ADD COLUMN     "telegramChatId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_cancelToken_key" ON "Appointment"("cancelToken");


-- CreateIndex
CREATE UNIQUE INDEX "Notification_tenantId_dedupeKey_key" ON "Notification"("tenantId", "dedupeKey");


-- Teléfonos de clientes existentes: solo dígitos, y solo si no chocan dentro del salón.
UPDATE "Client" c SET "phoneKey" = regexp_replace(c.phone, '\D', '', 'g')
WHERE c.phone IS NOT NULL
  AND length(regexp_replace(c.phone, '\D', '', 'g')) >= 6
  AND NOT EXISTS (
    SELECT 1 FROM "Client" o
    WHERE o."tenantId" = c."tenantId" AND o.id <> c.id AND regexp_replace(o.phone, '\D', '', 'g') = regexp_replace(c.phone, '\D', '', 'g')
  );

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_phoneKey_key" ON "Client"("tenantId", "phoneKey");
