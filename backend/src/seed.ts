import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Crear usuario administrador
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@vortexbeauty.com' },
      update: {},
      create: {
        email: 'admin@vortexbeauty.com',
        username: 'admin',
        password: adminPassword,
        name: 'Administrador',
        role: Role.ADMIN,
      },
    });
    console.log('✅ Admin user created:', admin.email);

    // Crear usuarios clientes
    const clients = [
      {
        email: 'cliente1@example.com',
        username: 'cliente1',
        password: await bcrypt.hash('cliente123', 10),
        name: 'María García',
        role: Role.CLIENT,
      },
      {
        email: 'cliente2@example.com',
        username: 'cliente2',
        password: await bcrypt.hash('cliente123', 10),
        name: 'Ana López',
        role: Role.CLIENT,
      },
      {
        email: 'cliente3@example.com',
        username: 'cliente3',
        password: await bcrypt.hash('cliente123', 10),
        name: 'Carmen Rodríguez',
        role: Role.CLIENT,
      },
    ];

    for (const clientData of clients) {
      const client = await prisma.user.upsert({
        where: { email: clientData.email },
        update: {},
        create: clientData,
      });
      console.log('✅ Client user created:', client.email);
    }

    // Crear productos/servicios
    const products = [
      {
        name: 'Manicura Básica',
        description: 'Servicio de manicura básica con esmaltado',
        price: 25.00,
        categoryId: null, // Se asignará después si hay categorías
      },
      {
        name: 'Manicura Francesa',
        description: 'Manicura con diseño francés elegante',
        price: 35.00,
        categoryId: null,
      },
      {
        name: 'Pedicura Completa',
        description: 'Servicio completo de pedicura con masaje',
        price: 40.00,
        categoryId: null,
      },
      {
        name: 'Tratamiento Facial',
        description: 'Tratamiento facial rejuvenecedor',
        price: 60.00,
        categoryId: null,
      },
    ];

    for (const productData of products) {
      const product = await prisma.product.upsert({
        where: { name: productData.name },
        update: {},
        create: productData,
      });
      console.log('✅ Product created:', product.name);
    }

    // Crear horarios de negocio por defecto
    const businessHours = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isOpen: true }, // Lunes
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isOpen: true }, // Martes
      { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isOpen: true }, // Miércoles
      { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isOpen: true }, // Jueves
      { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isOpen: true }, // Viernes
      { dayOfWeek: 6, startTime: '09:00', endTime: '16:00', isOpen: true }, // Sábado
      { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', isOpen: false }, // Domingo
    ];

    for (const hours of businessHours) {
      const existing = await prisma.businessHour.findFirst({
        where: { dayOfWeek: hours.dayOfWeek }
      });

      if (!existing) {
        await prisma.businessHour.create({ data: hours });
        console.log(`✅ Business hours created for day ${hours.dayOfWeek}`);
      }
    }

    console.log('🎉 Database seeded successfully!');
    console.log('\n📋 Credenciales de acceso:');
    console.log('Admin: admin@vortexbeauty.com / admin123');
    console.log('Clientes: cliente1@example.com, cliente2@example.com, cliente3@example.com / cliente123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();