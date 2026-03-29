import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Iniciando la siembra de la base de datos...');

  // Encriptamos la contraseña temporal
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Usamos upsert para que si corres el script 2 veces, no de error por duplicado
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@vortexbeauty.com' },
    update: {},
    create: {
      name: 'Admin Beauty',
      email: 'admin@vortexbeauty.com',
      username: 'admin_beauty',
      password: hashedPassword,
      role: 'ADMIN', // O el rol que uses en tu schema
    },
  });

  console.log('✅ Usuario Administrador creado exitosamente:');
  console.log(`Email: ${adminUser.email}`);
  console.log(`Password: admin123`);
}

main()
  .catch((e) => {
    console.error('❌ Error al sembrar la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });