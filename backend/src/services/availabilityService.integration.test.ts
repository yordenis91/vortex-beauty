import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../prismaClient';
import {
  assertSlotAvailable,
  createAppointmentSafely,
  AvailabilityError,
  isSerializationConflict,
} from './availabilityService';

/**
 * Pruebas de integración contra una base Postgres real (no un doble/mock):
 * las reglas de disponibilidad dependen de transacciones SERIALIZABLE, y esa
 * garantía solo la da el motor de la base de datos, no se puede simular con
 * un cliente Prisma falso.
 *
 * Se saltan salvo que se pida explícitamente con RUN_DB_TESTS=1 (además de
 * una DATABASE_URL real apuntando a una base de test desechable). El CI las
 * ejecuta contra un servicio Postgres; en local:
 *
 *   RUN_DB_TESTS=1 DATABASE_URL="postgresql://user:pass@localhost:5432/vortex_test" npm test
 */
const hasDb = process.env.RUN_DB_TESTS === '1';
const describeIfDb = hasDb ? describe : describe.skip;

describeIfDb('availabilityService (integración con Postgres)', () => {
  let clientId: string;
  let productId: string;
  let userId: string;
  let categoryId: string;

  const MONDAY = '2026-08-17'; // día de semana de prueba, abierto en el fixture
  const SUNDAY = '2026-08-16'; // cerrado en el fixture

  beforeAll(async () => {
    // Limpieza total: estas pruebas son dueñas de su base de datos de test.
    await prisma.appointment.deleteMany();
    await prisma.scheduleOverride.deleteMany();
    await prisma.closedDate.deleteMany();
    await prisma.businessHour.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: 'admin@test.local', password: 'x', name: 'Admin Test', role: 'ADMIN' },
    });
    userId = user.id;

    const client = await prisma.client.create({
      data: { name: 'Clienta Test', email: 'clienta@test.local', userId },
    });
    clientId = client.id;

    const category = await prisma.category.create({
      data: { name: 'Manicura', type: 'PRODUCT' },
    });
    categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: 'Manicura básica',
        type: 'MANICURA_BASICA',
        price: 20,
        billingCycle: 'ONE_TIME',
        categoryId,
        userId,
      },
    });
    productId = product.id;

    await prisma.businessHour.createMany({
      data: [
        { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', timeSlots: [], isOpen: false, maxAppointments: 0 },
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', timeSlots: ['10:00', '11:00', '12:00'], isOpen: true, maxAppointments: 2 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany();
    await prisma.scheduleOverride.deleteMany();
    await prisma.closedDate.deleteMany();
    await prisma.businessHour.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.client.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.appointment.deleteMany();
  });

  it('rechaza un día cerrado (F7/F8: businessHour.isOpen)', async () => {
    await expect(
      prisma.$transaction((tx) =>
        assertSlotAvailable(tx, { dateStr: SUNDAY, startTime: '10:00', endTime: '11:00' })
      )
    ).rejects.toBeInstanceOf(AvailabilityError);
  });

  it('rechaza un horario fuera de los timeSlots explícitos del día', async () => {
    await expect(
      prisma.$transaction((tx) =>
        assertSlotAvailable(tx, { dateStr: MONDAY, startTime: '09:00', endTime: '10:00' })
      )
    ).rejects.toBeInstanceOf(AvailabilityError);
  });

  it('acepta un horario válido dentro de los timeSlots configurados', async () => {
    await expect(
      prisma.$transaction((tx) =>
        assertSlotAvailable(tx, { dateStr: MONDAY, startTime: '10:00', endTime: '11:00' })
      )
    ).resolves.toBeUndefined();
  });

  it('respeta el cupo máximo diario (maxAppointments)', async () => {
    // El fixture del lunes permite como máximo 2 citas ese día.
    await createAppointmentSafely({ dateStr: MONDAY, startTime: '10:00', endTime: '11:00', clientId, productId });
    await createAppointmentSafely({ dateStr: MONDAY, startTime: '11:00', endTime: '12:00', clientId, productId });

    await expect(
      createAppointmentSafely({ dateStr: MONDAY, startTime: '12:00', endTime: '13:00', clientId, productId })
    ).rejects.toMatchObject({ message: expect.stringContaining('cupos') });
  });

  it('rechaza un hueco que solapa con una cita ya existente', async () => {
    await createAppointmentSafely({ dateStr: MONDAY, startTime: '10:00', endTime: '11:00', clientId, productId });

    await expect(
      prisma.$transaction((tx) =>
        assertSlotAvailable(tx, { dateStr: MONDAY, startTime: '10:00', endTime: '11:00' })
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('F6: dos reservas simultáneas para el mismo hueco — solo una gana', async () => {
    const attempt = () =>
      createAppointmentSafely({ dateStr: MONDAY, startTime: '10:00', endTime: '11:00', clientId, productId });

    const results = await Promise.allSettled([attempt(), attempt()]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
    // El perdedor de la carrera puede fallar por conflicto de horario
    // (detectado dentro de la transacción) o por conflicto de serialización
    // de Postgres (dos transacciones SERIALIZABLE en pugna) — ambos son
    // resultados correctos, lo que no puede pasar es que ganen las dos.
    const isExpectedFailure =
      rejectedReason instanceof AvailabilityError || isSerializationConflict(rejectedReason);
    expect(isExpectedFailure).toBe(true);

    const stored = await prisma.appointment.findMany({
      where: { startTime: '10:00', date: new Date('2026-08-17T00:00:00.000Z') },
    });
    expect(stored).toHaveLength(1);
  });
});
