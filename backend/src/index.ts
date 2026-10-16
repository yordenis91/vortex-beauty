import { config } from './config';
import app from './app';
import { basePrisma } from './prismaClient';

// RLS no se aplica a superusuarios ni a roles con BYPASSRLS: si la app se
// conecta con uno, el aislamiento entre salones depende solo del código.
async function warnIfRlsBypassed() {
  try {
    const rows = await basePrisma.$queryRaw<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    if (rows[0]?.rolsuper || rows[0]?.rolbypassrls) {
      console.warn('[seguridad] La conexión a la base de datos es superusuario/BYPASSRLS: las políticas RLS NO se aplican. Usa el rol vortex_app (ver docs/DEPLOYMENT.md).');
    }
  } catch (error) {
    console.error('No se pudo comprobar el rol de la base de datos:', error);
  }
}

app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
  void warnIfRlsBypassed();
});
