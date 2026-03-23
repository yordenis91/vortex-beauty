"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
// 1. Tomamos la URL de la variable de entorno
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required for PrismaClient');
}
// 2. Inicializamos el Pool nativo de Postgres
const pool = new pg_1.Pool({ connectionString });
// 3. Creamos el adaptador oficial
const adapter = new adapter_pg_1.PrismaPg(pool);
// 4. Instanciamos Prisma PASÁNDOLE EL ADAPTADOR (esto es lo que pedía el error)
const prisma = new client_1.PrismaClient({ adapter });
// Exportamos la instancia para usarla en cualquier parte de la app
exports.default = prisma;
//# sourceMappingURL=prismaClient.js.map