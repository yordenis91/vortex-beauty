-- Telegram para clientes: chat del cliente y datos del bot/webhook del salón.
ALTER TABLE "Client" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "TenantSettings"
  ADD COLUMN "telegramBotUsername" TEXT,
  ADD COLUMN "telegramWebhookSecret" TEXT,
  ADD COLUMN "telegramOwnerCode" TEXT;
CREATE INDEX "Client_tenantId_telegramChatId_idx" ON "Client"("tenantId", "telegramChatId");
