import nodemailer, { Transporter } from 'nodemailer';

/**
 * Canal de correo. Se configura con SMTP (cualquier proveedor: Resend, Brevo,
 * Gmail, un servidor propio):
 *
 *   SMTP_URL=smtps://usuario:clave@smtp.proveedor.com:465   (o SMTP_HOST/PORT/USER/PASS)
 *   MAIL_FROM="Mi Salón <reservas@misalon.com>"
 *
 * Sin configurar, los correos no se envían y el aviso queda registrado como FAILED.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export type EmailResult = { ok: true } | { ok: false; reason: string; retryable: boolean };

type Sender = (message: EmailMessage) => Promise<EmailResult>;

let customSender: Sender | null = null;
let transporter: Transporter | null = null;

/** Sustituye el envío real (tests). `null` restaura el SMTP. */
export function setEmailSender(sender: Sender | null) {
  customSender = sender;
}

export function isEmailConfigured(): boolean {
  return !!customSender || !!(process.env.SMTP_URL || process.env.SMTP_HOST);
}

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = process.env.SMTP_URL
      ? nodemailer.createTransport(process.env.SMTP_URL)
      : nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        });
  }
  return transporter;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (customSender) return customSender(message);
  if (!isEmailConfigured()) {
    return { ok: false, reason: 'SMTP no configurado (define SMTP_URL y MAIL_FROM)', retryable: false };
  }
  try {
    await getTransporter().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true };
  } catch (error: any) {
    // 5xx del servidor SMTP: dirección inválida o rechazo definitivo; no tiene sentido reintentar.
    const permanent = typeof error?.responseCode === 'number' && error.responseCode >= 500;
    return { ok: false, reason: String(error?.message ?? error), retryable: !permanent };
  }
}
