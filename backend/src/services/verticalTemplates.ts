import { Prisma, Vertical } from '@prisma/client';

/**
 * Plantillas por vertical: lo que un salón nuevo recibe de fábrica según su
 * tipo de negocio (servicios de ejemplo, recursos, vocabulario). Todo es
 * editable después desde el panel; la plantilla solo evita empezar de cero.
 */

interface TemplateService {
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  bufferAfterMin?: number;
  bufferBeforeMin?: number;
  category: string;
}

interface VerticalTemplate {
  labels: Record<string, string>;
  categories: string[];
  services: TemplateService[];
  resources: string[];
  defaultProfessional: string;
}

const labels = (customer: string, customers: string, appointment: string, appointments: string, professional: string, professionals: string) => ({
  customer,
  customers,
  appointment,
  appointments,
  professional,
  professionals,
  service: 'servicio',
  services: 'servicios',
});

export const TEMPLATES: Record<Vertical, VerticalTemplate> = {
  GENERIC: {
    labels: labels('cliente', 'clientes', 'cita', 'citas', 'profesional', 'profesionales'),
    categories: ['Servicios'],
    services: [{ name: 'Servicio general', price: 20, durationMinutes: 30, category: 'Servicios' }],
    resources: [],
    defaultProfessional: 'Principal',
  },
  NAILS: {
    labels: labels('clienta', 'clientas', 'cita', 'citas', 'manicurista', 'manicuristas'),
    categories: ['Manicura', 'Pedicura'],
    services: [
      { name: 'Manicura básica', price: 25, durationMinutes: 45, bufferAfterMin: 10, category: 'Manicura' },
      { name: 'Esmaltado en gel', price: 35, durationMinutes: 60, bufferAfterMin: 10, category: 'Manicura' },
      { name: 'Diseño artístico', price: 15, durationMinutes: 30, category: 'Manicura' },
      { name: 'Pedicura completa', price: 40, durationMinutes: 60, bufferAfterMin: 10, category: 'Pedicura' },
    ],
    resources: [],
    defaultProfessional: 'Manicurista principal',
  },
  BARBER: {
    labels: labels('cliente', 'clientes', 'turno', 'turnos', 'barbero', 'barberos'),
    categories: ['Cortes', 'Barba'],
    services: [
      { name: 'Corte de cabello', price: 15, durationMinutes: 30, category: 'Cortes' },
      { name: 'Corte + barba', price: 22, durationMinutes: 45, category: 'Cortes' },
      { name: 'Arreglo de barba', price: 10, durationMinutes: 20, category: 'Barba' },
    ],
    resources: ['Silla 1', 'Silla 2'],
    defaultProfessional: 'Barbero principal',
  },
  SPA: {
    labels: labels('cliente', 'clientes', 'reserva', 'reservas', 'terapeuta', 'terapeutas'),
    categories: ['Masajes', 'Faciales'],
    services: [
      { name: 'Masaje relajante', price: 50, durationMinutes: 60, bufferAfterMin: 15, category: 'Masajes' },
      { name: 'Masaje descontracturante', price: 60, durationMinutes: 60, bufferAfterMin: 15, category: 'Masajes' },
      { name: 'Limpieza facial', price: 40, durationMinutes: 45, bufferAfterMin: 10, category: 'Faciales' },
    ],
    resources: ['Cabina 1', 'Cabina 2'],
    defaultProfessional: 'Terapeuta principal',
  },
  TATTOO: {
    labels: labels('cliente', 'clientes', 'sesión', 'sesiones', 'tatuador', 'tatuadores'),
    categories: ['Tatuajes'],
    services: [
      { name: 'Consulta de diseño', price: 0, durationMinutes: 30, category: 'Tatuajes' },
      { name: 'Tatuaje pequeño', price: 80, durationMinutes: 120, bufferAfterMin: 30, category: 'Tatuajes' },
      { name: 'Tatuaje mediano', price: 200, durationMinutes: 240, bufferAfterMin: 30, category: 'Tatuajes' },
    ],
    resources: [],
    defaultProfessional: 'Tatuador principal',
  },
  HAIR: {
    labels: labels('cliente', 'clientes', 'cita', 'citas', 'estilista', 'estilistas'),
    categories: ['Corte y peinado', 'Color'],
    services: [
      { name: 'Corte y peinado', price: 25, durationMinutes: 45, category: 'Corte y peinado' },
      { name: 'Peinado de evento', price: 35, durationMinutes: 60, category: 'Corte y peinado' },
      { name: 'Tinte completo', price: 60, durationMinutes: 120, bufferAfterMin: 10, category: 'Color' },
    ],
    resources: ['Sillón 1', 'Sillón 2'],
    defaultProfessional: 'Estilista principal',
  },
  FITNESS: {
    labels: labels('cliente', 'clientes', 'sesión', 'sesiones', 'entrenador', 'entrenadores'),
    categories: ['Entrenamiento'],
    services: [
      { name: 'Sesión personal', price: 25, durationMinutes: 60, category: 'Entrenamiento' },
      { name: 'Evaluación inicial', price: 15, durationMinutes: 30, category: 'Entrenamiento' },
    ],
    resources: [],
    defaultProfessional: 'Entrenador principal',
  },
};

/** Lunes a sábado de 09:00 a 18:00; domingo cerrado. */
export const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: '09:00',
  endTime: '18:00',
  isOpen: dayOfWeek !== 0,
}));

export interface TemplateOverrides {
  /** Servicios a crear en lugar de los de la plantilla. */
  services?: Array<{ name: string; price: number; durationMinutes: number; category?: string; bufferAfterMin?: number }>;
  /** Nombres de los profesionales (todos atienden todos los servicios). */
  professionals?: string[];
  /** Horario comercial; también es el horario de cada profesional. */
  hours?: Array<{ dayOfWeek: number; isOpen: boolean; startTime: string; endTime: string }>;
}

/**
 * Crea la configuración inicial de un salón: ajustes, horario comercial,
 * categorías, servicios, recursos y profesionales con horario. Idempotente por
 * tenant: si ya tiene ajustes, no hace nada. Con `overrides` (alta asistida) el
 * operador sustituye servicios, profesionales y horario de la plantilla; el
 * vocabulario y los recursos (sillas, cabinas) siguen siendo los del vertical.
 */
export async function applyVerticalTemplate(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; adminUserId: string; vertical: Vertical; overrides?: TemplateOverrides }
): Promise<void> {
  const { tenantId, adminUserId, vertical, overrides } = params;
  const existing = await tx.tenantSettings.findUnique({ where: { tenantId }, select: { tenantId: true } });
  if (existing) return;

  const template = TEMPLATES[vertical];
  const hours = overrides?.hours ?? DEFAULT_HOURS;
  const services: TemplateService[] = overrides?.services?.map((s) => ({ ...s, category: s.category?.trim() || template.categories[0] })) ?? template.services;
  const professionalNames = overrides?.professionals?.length ? overrides.professionals : [template.defaultProfessional];

  await tx.tenantSettings.create({ data: { tenantId, vertical, labels: template.labels } });

  await tx.businessHour.createMany({
    data: hours.map((h) => ({ ...h, tenantId })),
    skipDuplicates: true,
  });

  const categoryNames = [...new Set([...(overrides?.services ? [] : template.categories), ...services.map((s) => s.category)])];
  const categoryIds = new Map<string, string>();
  for (const [order, name] of categoryNames.entries()) {
    const category = await tx.category.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { tenantId, name, order },
    });
    categoryIds.set(name, category.id);
  }

  const resources: string[] = [];
  for (const name of template.resources) {
    const resource = await tx.resource.create({ data: { tenantId, name } });
    resources.push(resource.id);
  }

  const professionals = [];
  for (const name of professionalNames) {
    const professional = await tx.professional.create({ data: { tenantId, name } });
    await tx.professionalSchedule.createMany({
      data: hours
        .filter((h) => h.isOpen)
        .map((h) => ({ tenantId, professionalId: professional.id, dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime })),
    });
    professionals.push(professional);
  }

  for (const s of services) {
    const service = await tx.service.create({
      data: {
        tenantId,
        userId: adminUserId,
        categoryId: categoryIds.get(s.category)!,
        name: s.name,
        description: s.description,
        price: s.price,
        durationMinutes: s.durationMinutes,
        bufferAfterMin: s.bufferAfterMin ?? 0,
        bufferBeforeMin: s.bufferBeforeMin ?? 0,
      },
    });
    await tx.professionalService.createMany({ data: professionals.map((p) => ({ tenantId, professionalId: p.id, serviceId: service.id })) });
    if (resources.length) {
      await tx.serviceResource.createMany({ data: resources.map((resourceId) => ({ tenantId, serviceId: service.id, resourceId })) });
    }
  }
}
