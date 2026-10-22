-- Clientes archivados: se ocultan de las listas y de las citas nuevas, pero conservan su historial.
ALTER TABLE "Client" ADD COLUMN "archivedAt" TIMESTAMP(3);
