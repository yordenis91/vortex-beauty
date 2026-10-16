import 'dotenv/config';
import { Role, } from '@prisma/client';
import bcrypt from 'bcryptjs';
import prisma from './prismaClient';
import { runAsAdmin } from './lib/tenantContext';
import { runInTransaction } from './lib/db';
import { applyVerticalTemplate } from './services/verticalTemplates';

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Crear el salón (tenant) por defecto
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'salon-principal' },
      update: {},
      create: {
        name: 'Vortex Beauty',
        slug: 'salon-principal',
        currency: 'USD',
        timezone: 'UTC',
      },
    });
    console.log('✅ Tenant created:', tenant.name);

    // Dueño del salón
    const owner = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'admin@vortexbeauty.com' } },
      update: {},
      create: {
        email: 'admin@vortexbeauty.com',
        username: 'admin',
        password: await bcrypt.hash('admin123', 10),
        name: 'Administrador',
        role: Role.OWNER,
        tenantId: tenant.id,
      },
    });
    console.log('✅ Owner created:', owner.email);

    // Configuración de fábrica del vertical (ajustes, horario, servicios, profesional)
    await runInTransaction((tx) =>
      applyVerticalTemplate(tx, { tenantId: tenant.id, adminUserId: owner.id, vertical: 'NAILS' })
    );

    // Segunda profesional con su propia cuenta (rol STAFF) y horario reducido
    const lucia = await prisma.professional.findFirst({ where: { tenantId: tenant.id, name: 'Lucía' } });
    if (!lucia) {
      const staffUser = await prisma.user.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: 'lucia@vortexbeauty.com' } },
        update: {},
        create: {
          email: 'lucia@vortexbeauty.com',
          username: 'lucia',
          password: await bcrypt.hash('staff123', 10),
          name: 'Lucía',
          role: Role.STAFF,
          tenantId: tenant.id,
        },
      });
      const professional = await prisma.professional.create({
        data: { tenantId: tenant.id, name: 'Lucía', userId: staffUser.id, color: '#ec4899' },
      });
      await prisma.professionalSchedule.createMany({
        data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
          tenantId: tenant.id,
          professionalId: professional.id,
          dayOfWeek,
          startTime: '10:00',
          endTime: '16:00',
        })),
      });
      const services = await prisma.service.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
      await prisma.professionalService.createMany({
        data: services.map((service) => ({ tenantId: tenant.id, professionalId: professional.id, serviceId: service.id })),
      });
      console.log('✅ Staff professional created: Lucía');
    }

    // Clientas de ejemplo (cuenta + ficha de cliente)
    const clients = [
      { email: 'cliente1@example.com', username: 'cliente1', name: 'María García' },
      { email: 'cliente2@example.com', username: 'cliente2', name: 'Ana López' },
      { email: 'cliente3@example.com', username: 'cliente3', name: 'Carmen Rodríguez' },
    ];
    const clientPassword = await bcrypt.hash('cliente123', 10);
    for (const c of clients) {
      const client = await prisma.client.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: c.email } },
        update: {},
        create: { name: c.name, email: c.email, userId: owner.id, tenantId: tenant.id },
      });
      await prisma.user.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: c.email } },
        update: { clientId: client.id },
        create: { ...c, password: clientPassword, role: Role.CLIENT, clientId: client.id, tenantId: tenant.id },
      });
      console.log('✅ Client created:', c.email);
    }

    // ===== Datos de plataforma (Super Admin) =====

    const platformAdminPassword = await bcrypt.hash('super123', 10);
    const platformAdmin = await prisma.platformAdmin.upsert({
      where: { email: 'superadmin@vortexbeauty.com' },
      update: {},
      create: {
        email: 'superadmin@vortexbeauty.com',
        password: platformAdminPassword,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
      },
    });
    console.log('✅ Platform admin created:', platformAdmin.email);

    const planDefs = [
      {
        name: 'Free', slug: 'free', description: 'Para probar la plataforma.',
        priceMonthly: 0, priceYearly: 0, trialDays: 0,
        maxStaff: 1, maxAppointmentsPerMonth: 50, maxLocations: 1,
        features: ['citas_online'], sortOrder: 0,
      },
      {
        name: 'Basic', slug: 'basic', description: 'Para salones pequeños.',
        priceMonthly: 19, priceYearly: 190, trialDays: 14,
        maxStaff: 3, maxAppointmentsPerMonth: 300, maxLocations: 1,
        features: ['citas_online', 'notificaciones_whatsapp'], sortOrder: 1,
      },
      {
        name: 'Pro', slug: 'pro', description: 'Para salones en crecimiento.',
        priceMonthly: 49, priceYearly: 490, trialDays: 14,
        maxStaff: 10, maxAppointmentsPerMonth: null, maxLocations: 1,
        features: ['citas_online', 'notificaciones_whatsapp', 'reportes_avanzados'], sortOrder: 2,
      },
      {
        name: 'Enterprise', slug: 'enterprise', description: 'Para cadenas de salones.',
        priceMonthly: 149, priceYearly: 1490, trialDays: 30,
        maxStaff: null, maxAppointmentsPerMonth: null, maxLocations: null,
        features: ['citas_online', 'notificaciones_whatsapp', 'reportes_avanzados', 'multi_sede'], sortOrder: 3,
      },
    ] as const;

    const plans: Record<string, { id: string }> = {};
    for (const planDef of planDefs) {
      const plan = await prisma.plan.upsert({
        where: { slug: planDef.slug },
        update: {},
        create: { ...planDef, currency: 'USD' },
      });
      plans[planDef.slug] = plan;
      console.log('✅ Plan created:', plan.name);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await prisma.tenantSubscription.upsert({
      where: { tenantId: tenant.id },
      update: {},
      create: {
        tenantId: tenant.id,
        planId: plans['pro'].id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        gateway: 'manual',
      },
    });
    console.log('✅ Tenant subscription created for', tenant.name);

    console.log('🎉 Database seeded successfully!');
    console.log('\n📋 Credenciales de acceso:');
    console.log('Salón: salon-principal (login en /salon-principal/login)');
    console.log('Dueño: admin@vortexbeauty.com / admin123');
    console.log('Profesional (STAFF): lucia@vortexbeauty.com / staff123');
    console.log('Clientes: cliente1@example.com, cliente2@example.com, cliente3@example.com / cliente123');
    console.log('Super Admin: superadmin@vortexbeauty.com / super123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAsAdmin(seed);