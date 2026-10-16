import { config } from '../config';

/**
 * Verificación anti-bots (Cloudflare Turnstile). Si TURNSTILE_SECRET no está
 * definido, la verificación se omite (desarrollo y pruebas).
 */
let override: ((token: string | undefined, ip: string | undefined) => Promise<boolean>) | null = null;

/** Sustituye la verificación (tests). */
export function setCaptchaVerifier(fn: typeof override) {
  override = fn;
}

export const captchaSiteKey = () => process.env.TURNSTILE_SITE_KEY || null;

export async function verifyCaptcha(token: string | undefined, ip: string | undefined): Promise<boolean> {
  if (override) return override(token, ip);
  if (!config.turnstileSecret) return true;
  if (!token) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: config.turnstileSecret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json()) as { success?: boolean };
    return body.success === true;
  } catch (error) {
    console.error('[captcha] no se pudo verificar Turnstile:', error);
    return false;
  }
}
