/**
 * Canal de Telegram para avisos al dueño del salón. Cada salón usa su propio
 * bot (token de @BotFather) y el chat al que debe escribir.
 */
export type TelegramResult = { ok: true } | { ok: false; reason: string; retryable: boolean };

type Sender = (botToken: string, chatId: string, text: string) => Promise<TelegramResult>;

let customSender: Sender | null = null;

/** Sustituye el envío real (tests). `null` restaura Telegram. */
export function setTelegramSender(sender: Sender | null) {
  customSender = sender;
}

export async function sendTelegram(botToken: string, chatId: string, text: string): Promise<TelegramResult> {
  if (customSender) return customSender(botToken, chatId, text);
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return { ok: true };
    const body = await response.json().catch(() => ({}) as { description?: string });
    // 4xx (token o chat inválidos): no se arregla reintentando.
    return { ok: false, reason: `Telegram ${response.status}: ${body.description ?? 'error'}`, retryable: response.status >= 500 || response.status === 429 };
  } catch (error: any) {
    return { ok: false, reason: String(error?.message ?? error), retryable: true };
  }
}
