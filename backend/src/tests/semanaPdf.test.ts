import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { dbTestsEnabled, setupAppDb } from './dbHarness';
import { isoWeekOf, MAX_PRINT_DAYS, parsePrintRange, renderWeekPdf, setPdfCompression, weekLabel, weekRange } from '../services/weekPdf';
import { localToInstant } from '../lib/time';

/** Texto de un PDF sin comprimir: pdfkit escribe las cadenas en hexadecimal dentro de los operadores TJ. */
function textOf(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  return Array.from(raw.matchAll(/<([0-9a-fA-F]{2,})>/g))
    .map((m) => Buffer.from(m[1], 'hex').toString('latin1'))
    .join('');
}
const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;

describe('semanas ISO', () => {
  it('lunes y domingo de una semana', () => {
    expect(weekRange('2026-W47')).toEqual({ monday: '2026-11-16', sunday: '2026-11-22' });
    expect(weekRange('2026-W01')).toEqual({ monday: '2025-12-29', sunday: '2026-01-04' }); // la semana 1 empieza en el año anterior
    expect(weekRange('2020-W53')).toEqual({ monday: '2020-12-28', sunday: '2021-01-03' });
  });

  it('rechaza semanas que no existen o mal escritas', () => {
    for (const w of ['2025-W53', '2026-W00', '2026-W54', '2026-47', '2026-W7', 'hola', '', '2026-W47; DROP']) expect(weekRange(w), w).toBeNull();
  });

  it('semana ISO de una fecha y rótulo en español', () => {
    expect(isoWeekOf('2026-11-16')).toBe('2026-W47');
    expect(isoWeekOf('2027-01-01')).toBe('2026-W53');
    expect(weekLabel('2026-11-16', '2026-11-22')).toBe('16 – 22 de noviembre de 2026');
    expect(weekLabel('2026-11-30', '2026-12-06')).toBe('30 de noviembre – 6 de diciembre de 2026');
  });
});

describe('rango a imprimir', () => {
  it('acepta un rango válido, de un día hasta el tope', () => {
    expect(parsePrintRange('2026-11-01', '2026-11-30')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(parsePrintRange('2026-11-16', '2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-16' });
    expect(parsePrintRange('2026-01-01', '2026-04-02')).toEqual({ from: '2026-01-01', to: '2026-04-02' }); // 92 días justos
  })

  it('rechaza lo que se pasa del tope, va al revés o está mal escrito', () => {
    expect(MAX_PRINT_DAYS).toBe(92)
    for (const [a, b] of [['2026-01-01', '2026-04-03'], ['2026-11-30', '2026-11-01'], ['2026-13-01', '2026-13-02'], ['2026-02-30', '2026-03-01'], ['hoy', 'mañana'], ['', '2026-11-01'], ['2026-11-01', '']]) {
      expect('error' in parsePrintRange(a, b), `${a}…${b}`).toBe(true)
    }
  })

  it('el rótulo de un mes y de un rango que cruza meses', () => {
    expect(weekLabel('2026-11-01', '2026-11-30')).toBe('1 – 30 de noviembre de 2026')
    expect(weekLabel('2026-12-15', '2027-01-15')).toBe('15 de diciembre de 2026 – 15 de enero de 2027')
  })
})

describe('dibujo de la hoja', () => {
  afterEach(() => setPdfCompression(true));
  const base = { salonName: 'Yumi Manicure', weekLabel: '16 – 22 de noviembre de 2026', qrUrl: 'https://afilaoapp.com/yumi/login', generatedAt: '16/11/2026 21:30' };
  const days = (rows: Parameters<typeof renderWeekPdf>[0]['days'][number]['rows'] = []) =>
    Array.from({ length: 7 }, (_, i) => ({ dateStr: `2026-11-${16 + i}`, rows: i === 1 ? rows : [] }));
  const row = (over = {}) => ({ startTime: '10:00', endTime: '11:00', clientName: 'Marta Pérez', clientPhone: '+53 5 555 1234', serviceName: 'Manicura', professionalName: 'Yumi', notes: null, fromPaper: false, ...over });

  it('es un PDF con el salón, los días, la clienta y la dirección del QR', async () => {
    setPdfCompression(false);
    const pdf = await renderWeekPdf({ ...base, days: days([row({ notes: 'Trae su esmalte' })]) });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = textOf(pdf);
    for (const t of ['Yumi Manicure', 'Lunes 16 de noviembre', 'Martes 17 de noviembre', 'Domingo 22 de noviembre', 'Marta Pérez', '10:00 – 11:00', 'Manicura', 'Trae su esmalte', 'Sin citas', 'https://afilaoapp.com/yumi/login', 'Página 1 de 1']) {
      expect(text, t).toContain(t.replace('–', '\u0096'));
    }
    expect(pdf.toString('latin1')).toContain('/Image'); // el QR
  });

  it('la leyenda del lápiz solo sale si hay citas del papel', async () => {
    setPdfCompression(false);
    expect(textOf(await renderWeekPdf({ ...base, days: days([row()]) }))).not.toContain('Anotada primero en el papel');
    expect(textOf(await renderWeekPdf({ ...base, days: days([row({ fromPaper: true })]) }))).toContain('Anotada primero en el papel');
  });

  it('la columna de profesional solo sale si hay varias', async () => {
    setPdfCompression(false);
    const one = textOf(await renderWeekPdf({ ...base, days: days([row({ professionalName: 'Pro Única' })]) }));
    const two = textOf(await renderWeekPdf({ ...base, days: days([row({ professionalName: 'Pro Única' }), row({ professionalName: 'Laura' })]) }));
    expect(one).not.toContain('Pro Única');
    expect(two).toContain('Laura');
    expect(two).toContain('Pro Única');
  });

  it('en un rango largo no pinta los días sin citas y lo avisa', async () => {
    setPdfCompression(false)
    const text = textOf(await renderWeekPdf({ ...base, hideEmptyDays: true, days: days([row()]) }))
    expect(text).toContain('Martes 17 de noviembre')
    expect(text).not.toContain('Miércoles 18 de noviembre')
    expect(text).not.toContain('Sin citas')
    expect(text).toContain('Los días sin citas no aparecen.')
    expect(text).not.toContain('Agenda de la semana')
  })

  it('un rango sin ninguna cita lo dice en vez de salir vacío', async () => {
    setPdfCompression(false)
    const text = textOf(await renderWeekPdf({ ...base, hideEmptyDays: true, days: days() }))
    expect(text).toContain('Sin citas en estas fechas.')
  })

  it('quita lo que las fuentes del PDF no pueden pintar (emojis) y no se cae', async () => {
    setPdfCompression(false);
    const text = textOf(await renderWeekPdf({ ...base, days: days([row({ clientName: 'Ana 💅 López', notes: '😀 ok' })]) }));
    expect(text).toContain('Ana  López');
    expect(text).toContain('Nota: ok');
  });

  it('una semana llena pasa a más hojas sin cortar nada', async () => {
    const many = Array.from({ length: 80 }, (_, i) => row({ startTime: '09:00', clientName: `Clienta ${i}` }));
    const pdf = await renderWeekPdf({ ...base, days: days(many) });
    expect(pageCount(pdf)).toBeGreaterThan(2);
  });

  it('nombres larguísimos se acortan en vez de salirse de la hoja', async () => {
    setPdfCompression(false);
    const text = textOf(await renderWeekPdf({ ...base, days: days([row({ clientName: 'A'.repeat(200), serviceName: 'S'.repeat(200) })]) }));
    expect(text).not.toContain('A'.repeat(200));
    expect(text).toContain('...');
  });
});

const describeIfDb = dbTestsEnabled ? describe : describe.skip;

describeIfDb('GET /api/appointments/print', () => {
  let adminPool: Pool;
  let prisma: typeof import('../prismaClient').default;
  let ctx: typeof import('../lib/tenantContext');
  let app: import('express').Express;
  let tenantId: string;
  let otherTenantId: string;
  let slug: string;
  const tokens: Record<string, string> = {};
  const WEEK = '2031-W10'; // lunes 3 de marzo de 2031
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const print = (who: string, week: string = WEEK) =>
    request(app).get('/api/appointments/print').query({ week }).set(as(who)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });

  beforeAll(async () => {
    ({ adminPool, prisma, ctx } = await setupAppDb());
    app = (await import('../app')).default;
    slug = `pdf-${Date.now().toString(36)}`;
    const hash = await bcrypt.hash('secret123', 4);
    await ctx.runAsAdmin(async () => {
      tenantId = (await prisma.tenant.create({ data: { name: 'Salón PDF', slug, timezone: 'America/Havana' } })).id;
      otherTenantId = (await prisma.tenant.create({ data: { name: 'Otro Salón', slug: `${slug}-otro`, timezone: 'America/Havana' } })).id;
      await prisma.tenantSettings.create({ data: { tenantId } });
      await prisma.tenantSettings.create({ data: { tenantId: otherTenantId } });
      const owner = await prisma.user.create({ data: { email: 'duena@pdf.com', password: hash, name: 'Dueña', role: 'OWNER', tenantId } });
      const staff = await prisma.user.create({ data: { email: 'staff@pdf.com', password: hash, name: 'Staff', role: 'STAFF', tenantId } });
      await prisma.user.create({ data: { email: 'staff-sin-perfil@pdf.com', password: hash, name: 'Sin perfil', role: 'STAFF', tenantId } });
      const category = await prisma.category.create({ data: { name: 'Uñas', tenantId } });
      const service = await prisma.service.create({ data: { name: 'Manicura', price: 10, durationMinutes: 60, categoryId: category.id, userId: owner.id, tenantId } });
      const proA = await prisma.professional.create({ data: { name: 'Yumi', tenantId, userId: staff.id } });
      const proB = await prisma.professional.create({ data: { name: 'Laura', tenantId } });
      const mk = async (name: string, phone: string) => (await prisma.client.create({ data: { name, phone, phoneKey: phone.replace(/\D/g, ''), userId: owner.id, tenantId } })).id;
      const [c1, c2, c3, c4] = [await mk('Marta Pérez', '+53 5 555 1111'), await mk('Luisa Gómez', '+53 5 555 2222'), await mk('Dayana Ruiz', '+53 5 555 3333'), await mk('Cancelada Cruz', '+53 5 555 4444')];
      const appt = (clientId: string, professionalId: string, date: string, time: string, extra: object = {}) => {
        const startsAt = localToInstant('America/Havana', date, time);
        const endsAt = new Date(startsAt.getTime() + 3_600_000);
        return prisma.appointment.create({
          data: { tenantId, clientId, serviceId: service.id, professionalId, serviceName: 'Manicura', priceAmount: 10, durationMin: 60, startsAt, endsAt, blockStartsAt: startsAt, blockEndsAt: endsAt, ...extra },
        });
      };
      await appt(c1, proA.id, '2031-03-03', '10:00', { source: 'PAPEL' });
      await appt(c2, proB.id, '2031-03-05', '11:00');
      await appt(c3, proA.id, '2031-03-09', '23:30'); // domingo, última hora del día: sigue en la semana
      await appt(c4, proA.id, '2031-03-04', '09:00', { status: 'CANCELLED' });
      await appt(c1, proA.id, '2031-03-10', '10:00'); // lunes siguiente: otra semana
    });
    for (const [who, email] of [['owner', 'duena@pdf.com'], ['staff', 'staff@pdf.com'], ['sinperfil', 'staff-sin-perfil@pdf.com']] as const) {
      const res = await request(app).post('/api/auth/login').send({ tenantSlug: slug, email, password: 'secret123' });
      tokens[who] = res.body.token;
    }
    setPdfCompression(false);
  });

  afterAll(async () => {
    setPdfCompression(true);
    await ctx.runAsAdmin(async () => {
      await prisma.tenant.delete({ where: { id: tenantId } });
      await prisma.tenant.delete({ where: { id: otherTenantId } });
    });
    await adminPool.end();
  });

  it('sin sesión: 401', async () => {
    expect((await request(app).get('/api/appointments/print').query({ week: WEEK })).status).toBe(401);
  });

  it('devuelve un PDF con las citas de esa semana, la marca del papel y el QR al login', async () => {
    const res = await print('owner');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain(`agenda-${WEEK}.pdf`);
    expect(res.headers['cache-control']).toContain('no-store');
    const text = textOf(res.body);
    expect(text).toContain('Salón PDF');
    expect(text).toContain('3 \u0096 9 de marzo de 2031');
    expect(text).toContain('Marta Pérez');
    expect(text).toContain('Luisa Gómez');
    expect(text).toContain('Dayana Ruiz');
    expect(text).toContain('Anotada primero en el papel');
    expect(text).toContain(`/${slug}/login`);
  });

  it('no incluye citas canceladas ni de otra semana', async () => {
    const text = textOf((await print('owner')).body);
    expect(text).not.toContain('Cancelada Cruz');
    const next = textOf((await print('owner', '2031-W11')).body);
    expect(next).toContain('Marta Pérez');
    expect(next).not.toContain('Luisa Gómez');
  });

  it('un STAFF solo imprime su propia agenda', async () => {
    const text = textOf((await print('staff')).body);
    expect(text).toContain('Marta Pérez');
    expect(text).toContain('Dayana Ruiz');
    expect(text).not.toContain('Luisa Gómez'); // es de la otra profesional
  });

  it('un STAFF sin perfil de profesional recibe la hoja vacía', async () => {
    const res = await print('sinperfil');
    expect(res.status).toBe(200);
    expect(textOf(res.body)).not.toContain('Marta Pérez');
    expect(textOf(res.body)).toContain('Sin citas');
  });

  it('no mezcla salones: otro salón no ve estas citas aunque pida la misma semana', async () => {
    const other = await request(app).post('/api/auth/login').send({ tenantSlug: `${slug}-otro`, email: 'x@x.com', password: 'x' });
    expect(other.status).not.toBe(200); // sin usuarios en el otro salón: ni siquiera entra
    expect(textOf((await print('owner')).body)).not.toContain('Otro Salón');
  });

  const range = (who: string, from: string, to: string) =>
    request(app).get('/api/appointments/print').query({ from, to }).set(as(who)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => cb(null, Buffer.concat(chunks)))
    })

  it('un rango imprime las citas de varias semanas, sin los días vacíos', async () => {
    const res = await range('owner', '2031-03-01', '2031-03-31')
    expect(res.status).toBe(200)
    expect(res.headers['content-disposition']).toContain('agenda-2031-03-01_2031-03-31.pdf')
    const text = textOf(res.body)
    expect(text).toContain('1 \u0096 31 de marzo de 2031')
    expect(text).toContain('Marta Pérez')
    expect(text).toContain('Luisa Gómez') // semana 10
    expect(text).toContain('Lunes 10 de marzo') // la cita de la semana siguiente también entra
    expect(text).not.toContain('Cancelada Cruz')
    expect(text).not.toContain('Sin citas')
    expect(text).not.toContain('Martes 4 de marzo') // día vacío
  })

  it('el rango respeta los extremos (inclusive) y el salón', async () => {
    const only = textOf((await range('owner', '2031-03-05', '2031-03-05')).body)
    expect(only).toContain('Luisa Gómez')
    expect(only).not.toContain('Marta Pérez')
    const empty = textOf((await range('owner', '2031-04-01', '2031-04-30')).body)
    expect(empty).toContain('Sin citas en estas fechas.')
  })

  it('un STAFF también ve solo lo suyo en un rango', async () => {
    const text = textOf((await range('staff', '2031-03-01', '2031-03-31')).body)
    expect(text).toContain('Marta Pérez')
    expect(text).not.toContain('Luisa Gómez')
  })

  it('rangos inválidos: 400 con el motivo', async () => {
    for (const [a, b] of [['2031-01-01', '2031-04-30'], ['2031-03-31', '2031-03-01'], ['x', 'y'], ['2031-03-01', '']]) {
      const res = await range('owner', a, b)
      expect(res.status, `${a}…${b}`).toBe(400)
    }
    const onlyFrom = await request(app).get('/api/appointments/print').query({ from: '2031-03-01' }).set(as('owner'))
    expect(onlyFrom.status).toBe(400)
    expect(onlyFrom.body.error).toBeTruthy()
  })

  it('semana mal escrita o inexistente: 400', async () => {
    for (const w of ['2031-W54', '2031-10', 'ayer', '2025-W53']) expect((await print('owner', w)).status, w).toBe(400);
  });

  it('sin semana imprime la actual', async () => {
    const res = await request(app).get('/api/appointments/print').set(as('owner'));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/agenda-\d{4}-W\d{2}\.pdf/);
  });

  it('una cita nueva aparece en la hoja siguiente sin esperar a que caduque el caché', async () => {
    const before = textOf((await print('owner')).body);
    expect(before).not.toContain('Recién Llegada');
    await ctx.runAsAdmin(async () => {
      const owner = await prisma.user.findFirstOrThrow({ where: { tenantId, role: 'OWNER' } });
      const client = await prisma.client.create({ data: { name: 'Recién Llegada', phone: '+53 5 555 9999', phoneKey: '5355559999', userId: owner.id, tenantId } });
      const service = await prisma.service.findFirstOrThrow({ where: { tenantId } });
      const startsAt = localToInstant('America/Havana', '2031-03-07', '15:00');
      const endsAt = new Date(startsAt.getTime() + 3_600_000);
      await prisma.appointment.create({ data: { tenantId, clientId: client.id, serviceId: service.id, serviceName: 'Manicura', priceAmount: 10, durationMin: 60, startsAt, endsAt, blockStartsAt: startsAt, blockEndsAt: endsAt } });
    });
    expect(textOf((await print('owner')).body)).toContain('Recién Llegada');
  });

  it('pedir la misma hoja dos veces da el mismo documento (caché)', async () => {
    const a = (await print('owner')).body as Buffer;
    const b = (await print('owner')).body as Buffer;
    expect(a.equals(b)).toBe(true);
  });
});
