import "dotenv/config";
import bcrypt from 'bcryptjs';
import prisma from './prismaClient';

async function seedAdmin() {
  try {
    // Verificar si ya existe un usuario admin
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@vortex.com' }
    });

    if (existingAdmin) {
      console.log('✅ Usuario admin ya existe');
      return;
    }

    // Crear usuario admin por defecto
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@vortex.com',
        password: hashedPassword,
        name: 'Administrator'
      },
      select: { id: true, email: true, name: true }
    });

    console.log('✅ Usuario admin creado exitosamente');
    console.log('📧 Email: admin@vortex.com');
    console.log('🔑 Password: admin123');
    console.log('👤 Nombre: Administrator');

  } catch (error) {
    console.error('❌ Error creando usuario admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el seed si se llama directamente
if (require.main === module) {
  seedAdmin();
}

export default seedAdmin;