import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
    env: {
      // prismaClient.ts exige DATABASE_URL con solo importarlo, y varios
      // servicios lo importan aunque el test no toque la base de datos.
      // Este valor de relleno solo evita ese fallo en tests puros; las
      // pruebas de integración exigen además RUN_DB_TESTS=1 con una
      // DATABASE_URL real (ver availabilityService.integration.test.ts).
      QUEUE_MODE: 'memory',
      // Los límites por IP se prueban aparte; aquí todas las peticiones salen de la misma IP.
      PUBLIC_WRITE_LIMIT: '100000',
      PUBLIC_READ_LIMIT: '100000',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder',
    },
  },
});
