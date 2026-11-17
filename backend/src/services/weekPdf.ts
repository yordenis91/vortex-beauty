import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { DateTime } from 'luxon';

/**
 * «Imprimir mi semana»: la agenda de siete días en una hoja A4, para quien trabaja con el cuaderno al lado.
 * Lleva un QR al login del salón (el celular abre la agenda y se anota lo que se acordó en papel).
 */

export interface PrintRow {
  startTime: string;
  endTime: string;
  clientName: string;
  clientPhone: string | null;
  serviceName: string;
  professionalName: string | null;
  notes: string | null;
  fromPaper: boolean;
}

export interface PrintDay {
  dateStr: string; // YYYY-MM-DD
  rows: PrintRow[];
}

export interface WeekPdfInput {
  salonName: string;
  weekLabel: string; // «16 – 22 de noviembre de 2026»
  days: PrintDay[];
  qrUrl: string;
  generatedAt: string; // «16/11/2026 21:30»
  /** En un rango largo no se pintan los días sin citas (la hoja de una semana sí los lleva, para anotar en ellos). */
  hideEmptyDays?: boolean;
}

/** Tope del rango a imprimir: un trimestre. Más páginas ya no es una agenda para tener al lado. */
export const MAX_PRINT_DAYS = 92;

/** Valida un rango «desde–hasta» (YYYY-MM-DD, inclusive). Devuelve los extremos o el motivo del rechazo. */
export function parsePrintRange(from: string, to: string): { from: string; to: string } | { error: string } {
  const a = DateTime.fromISO(from, { zone: 'utc' });
  const b = DateTime.fromISO(to, { zone: 'utc' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !a.isValid || !b.isValid) return { error: 'Las fechas deben tener formato AAAA-MM-DD.' };
  if (b < a) return { error: 'La fecha final no puede ser anterior a la inicial.' };
  if (b.diff(a, 'days').days + 1 > MAX_PRINT_DAYS) return { error: `Elige hasta ${MAX_PRINT_DAYS} días como máximo.` };
  return { from, to };
}

/** Solo para pruebas: sin comprimir, el texto del PDF se puede leer y comprobar. */
let compressPdf = true;
export const setPdfCompression = (on: boolean) => void (compressPdf = on);

const WEEK_RE = /^(\d{4})-W(\d{2})$/;

/** Lunes y domingo (YYYY-MM-DD) de una semana ISO «2026-W47», o null si no existe. */
export function weekRange(week: string): { monday: string; sunday: string } | null {
  const m = WEEK_RE.exec(week);
  if (!m) return null;
  const monday = DateTime.fromObject({ weekYear: Number(m[1]), weekNumber: Number(m[2]), weekday: 1 }, { zone: 'utc' });
  // Luxon corrige las semanas que no existen (la 53 de un año de 52): se rechaza si no vuelve igual.
  if (!monday.isValid || monday.weekNumber !== Number(m[2]) || monday.weekYear !== Number(m[1])) return null;
  return { monday: monday.toISODate()!, sunday: monday.plus({ days: 6 }).toISODate()! };
}

/** Semana ISO («2026-W47») de una fecha local YYYY-MM-DD. */
export function isoWeekOf(dateStr: string): string {
  const d = DateTime.fromISO(dateStr, { zone: 'utc' });
  return `${d.weekYear}-W${String(d.weekNumber).padStart(2, '0')}`;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const parts = (dateStr: string) => {
  const d = DateTime.fromISO(dateStr, { zone: 'utc' });
  return { day: d.day, month: MONTHS[d.month - 1], year: d.year, weekday: WEEKDAYS[d.weekday - 1] };
};

export function weekLabel(monday: string, sunday: string): string {
  const a = parts(monday);
  const b = parts(sunday);
  if (a.month === b.month && a.year === b.year) return `${a.day} – ${b.day} de ${b.month} de ${b.year}`;
  if (a.year === b.year) return `${a.day} de ${a.month} – ${b.day} de ${b.month} de ${b.year}`;
  return `${a.day} de ${a.month} de ${a.year} – ${b.day} de ${b.month} de ${b.year}`;
}

export const dayLabel = (dateStr: string) => {
  const p = parts(dateStr);
  return `${p.weekday[0].toUpperCase()}${p.weekday.slice(1)} ${p.day} de ${p.month}`;
};

/** Las fuentes estándar del PDF solo traen Latin-1: lo que no esté (emojis, otros alfabetos) se quita en vez de salir como basura. */
const safe = (text: string | null | undefined) =>
  (text ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^ -~ -ÿ–—‘’“”•€]/g, '')
    .trim();

const INK = '#111111';
const MUTED = '#555555';
const LINE = '#BBBBBB';
const MARGIN = 40;

/** Lápiz dibujado (las fuentes del PDF no traen emojis): marca de la cita anotada primero en papel. */
function pencil(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.save();
  doc.translate(x, y).rotate(-45);
  doc.rect(0, -1.6, 7, 3.2).fill(INK); // cuerpo
  doc.polygon([7, -1.6], [11, 0], [7, 1.6]).fill(INK); // punta
  doc.restore();
}

const fit = (doc: PDFKit.PDFDocument, text: string, width: number) => {
  if (doc.widthOfString(text) <= width) return text;
  let out = text;
  while (out.length > 1 && doc.widthOfString(`${out.trimEnd()}...`) > width) out = out.slice(0, -1);
  return `${out.trimEnd()}...`;
};

export async function renderWeekPdf(input: WeekPdfInput): Promise<Buffer> {
  const qr = await QRCode.toBuffer(input.qrUrl, { type: 'png', margin: 1, width: 280, errorCorrectionLevel: 'M' });
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, compress: compressPdf, info: { Title: `Agenda ${input.weekLabel}`, Author: 'Afilao' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const width = doc.page.width - MARGIN * 2;
  const bottom = () => doc.page.height - MARGIN - 18; // deja sitio al pie con el número de página
  const manyPros = new Set(input.days.flatMap((d) => d.rows.map((r) => r.professionalName ?? ''))).size > 1;
  const anyPaper = input.days.some((d) => d.rows.some((r) => r.fromPaper));

  // Columnas: hora | clienta y teléfono | servicio | profesional (solo si hay varias) | marca de papel
  const colTime = MARGIN;
  const colClient = MARGIN + 82;
  const colService = MARGIN + 82 + (manyPros ? 150 : 170);
  const colPro = manyPros ? colService + 130 : colService;
  const colEnd = MARGIN + width - 16;
  const widthClient = colService - colClient - 8;
  const widthService = (manyPros ? colPro : colEnd) - colService - 8;
  const widthPro = colEnd - colPro - 8;

  doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text(safe(input.salonName) || 'Agenda', MARGIN, MARGIN, { width, lineBreak: false });
  doc.font('Helvetica').fontSize(11).fillColor(MUTED).text(`${input.hideEmptyDays ? 'Agenda' : 'Agenda de la semana'}: ${input.weekLabel}`, MARGIN, doc.y + 2, { width });
  if (anyPaper) {
    const y = doc.y + 4;
    pencil(doc, MARGIN + 1, y + 8);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Anotada primero en el papel', MARGIN + 16, y + 1, { width: 200, lineBreak: false });
    doc.y = y + 14;
  }
  doc.moveDown(0.6);

  const ensure = (needed: number) => {
    if (doc.y + needed > bottom()) doc.addPage();
  };

  const shown = input.hideEmptyDays ? input.days.filter((d) => d.rows.length > 0) : input.days;
  if (shown.length === 0) {
    doc.font('Helvetica-Oblique').fontSize(11).fillColor(MUTED).text('Sin citas en estas fechas.', MARGIN, doc.y + 6, { width, lineBreak: false });
    doc.y += 24;
  } else if (input.hideEmptyDays) {
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Los días sin citas no aparecen.', MARGIN, doc.y, { width, lineBreak: false });
    doc.y += 8;
  }

  for (const day of shown) {
    ensure(20 + 22); // el título del día no se queda solo al final de la página
    const y = doc.y + 6;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(dayLabel(day.dateStr), MARGIN, y, { width, lineBreak: false });
    doc.moveTo(MARGIN, y + 16).lineTo(MARGIN + width, y + 16).lineWidth(1).strokeColor(INK).stroke();
    doc.y = y + 21;

    if (day.rows.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text('Sin citas', colTime, doc.y, { width, lineBreak: false });
      doc.y += 16;
      continue;
    }

    for (const row of day.rows) {
      const note = safe(row.notes);
      const rowHeight = note ? 30 : 18;
      ensure(rowHeight);
      const top = doc.y;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`${row.startTime} – ${row.endTime}`, colTime, top, { width: 78, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(10);
      const clientName = fit(doc, safe(row.clientName) || 'Sin nombre', widthClient);
      doc.text(clientName, colClient, top, { width: widthClient, lineBreak: false });
      doc.font('Helvetica').fontSize(10);
      doc.text(fit(doc, safe(row.serviceName), widthService), colService, top, { width: widthService, lineBreak: false });
      if (manyPros) doc.fillColor(MUTED).text(fit(doc, safe(row.professionalName), widthPro), colPro, top, { width: widthPro, lineBreak: false });
      if (row.fromPaper) pencil(doc, colEnd + 2, top + 9);
      doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
      const phone = safe(row.clientPhone);
      if (phone) doc.text(fit(doc, phone, widthClient), colClient, top + 12, { width: widthClient, lineBreak: false });
      if (note) doc.text(fit(doc, `Nota: ${note}`, width - 82), colTime + 82, top + 22, { width: width - 82, lineBreak: false });
      const next = top + rowHeight + (phone ? 4 : 0);
      doc.moveTo(MARGIN, next - 2).lineTo(MARGIN + width, next - 2).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.y = next + 2;
    }
    doc.y += 4;
  }

  // QR al login del salón, con su explicación; si no cabe, hoja nueva.
  ensure(110);
  const qrTop = doc.y + 14;
  doc.moveTo(MARGIN, qrTop - 8).lineTo(MARGIN + width, qrTop - 8).lineWidth(0.6).strokeColor(LINE).stroke();
  doc.image(qr, MARGIN, qrTop, { width: 84, height: 84 });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text('Abre tu agenda en el celular', MARGIN + 98, qrTop + 8, { width: width - 98 });
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Escanea el código, entra con tu usuario y anota ahí lo que acordaste en el papel.', MARGIN + 98, doc.y + 2, { width: width - 98 });
  doc.fontSize(9).text(safe(input.qrUrl), MARGIN + 98, doc.y + 4, { width: width - 98 });

  // Pie con el número de página y cuándo se imprimió.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    // margin inferior a 0 mientras se escribe el pie: si no, pdfkit abre una hoja nueva por cada línea.
    const prevBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.text(`Página ${i + 1} de ${range.count}  ·  Impreso el ${input.generatedAt}  ·  Afilao`, MARGIN, doc.page.height - MARGIN + 4, { width, align: 'center', lineBreak: false });
    doc.page.margins.bottom = prevBottom;
  }
  doc.end();
  return done;
}
