import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Tomamos la URL de la variable de entorno
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required for PrismaClient');
}

// 2. Inicializamos el Pool nativo de Postgres
const pool = new Pool({ connectionString });

// 3. Creamos el adaptador oficial
const adapter = new PrismaPg(pool);

// 4. Instanciamos Prisma PASÁNDOLE EL ADAPTADOR (esto es lo que pedía el error)
const prisma = new PrismaClient({ adapter });

// Exportamos la instancia para usarla en cualquier parte de la app
export default prisma;
