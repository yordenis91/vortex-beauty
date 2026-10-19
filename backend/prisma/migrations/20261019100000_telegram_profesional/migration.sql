-- Avisos de Telegram para cada profesional: chat enlazado y código de enlace de un solo uso.
ALTER TABLE "Professional"
  ADD COLUMN "telegramChatId" TEXT,
  ADD COLUMN "telegramLinkCode" TEXT;
