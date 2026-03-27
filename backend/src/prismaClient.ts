import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// 1. Tomamos la URL de la variable de entorno
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required for PrismaClient');
}

// 2. Inicializamos un pool de Postgres para resolver concurrencia y evitar warning de `client.query()` activo.
//    Se mantiene compatibilidad con la API de Prisma 7.x, usando adapter en el constructor.
const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);

// 3. Instanciamos Prisma con la opción mínima válida (adapter) y logs opcionales (debug útil en dev).
const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn', 'query'],
});

// 4. Exportamos la instancia para usarla en cualquier parte de la app
export default prisma;
