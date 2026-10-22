import express from 'express';
import { zodResponse } from '../lib/validation';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { imageSchema } from '../lib/images';
import { phoneKey } from '../lib/phone';
import { runInTransaction } from '../lib/db';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { appointmentScope, requirePermission } from '../middleware/can';

const router = express.Router();

// Lectura: dueño y administradores ven todos los clientes; un STAFF solo los que
// tienen o tuvieron citas con él (ver clientScope). Escritura: dueño y administradores.
router.use(authenticateToken);

/** Filtro de clientes visibles: sin filtro para quien ve toda la agenda; para un STAFF, los de sus citas. */
async function clientScope(req: express.Request): Promise<Prisma.ClientWhereInput | null> {
  const scope = await appointmentScope(req);
  if (scope.none) return null;
  return scope.professionalId ? { appointments: { some: { professionalId: scope.professionalId } } } : {};
}

const clientSchema = z.object({
  name: z.string().min(1),
  // Opcional: quien reserva solo con teléfono no tiene correo. '' = sin correo.
  email: z.string().email().optional().or(z.literal('')),
  code: z.string().optional(),
  displayName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  imageUrl: imageSchema.optional(),
});

// Los clientes no tienen portal ni cuenta de acceso: solo la ficha. Hace falta al menos
// un teléfono o un correo para reconocerlos (igual que en la reserva pública).
const createClientSchema = clientSchema.refine((b) => !!b.email || !!phoneKey(b.phone), {
  message: 'Indica un teléfono o un correo',
  path: ['email'],
});

/** Vacíos a null y teléfono normalizado (phoneKey), para que la reserva pública reconozca al mismo cliente. */
function normalizeContact<T extends { email?: string; phone?: string }>(data: T) {
  const out: Record<string, unknown> = { ...data };
  if ('email' in data) out.email = data.email || null;
  if ('phone' in data) {
    out.phone = data.phone || null;
    out.phoneKey = phoneKey(data.phone);
  }
  return out;
}

/** 409 legible cuando el correo o el teléfono ya pertenecen a otra ficha del salón. */
function duplicateContact(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return null;
  // Con el adaptador de Postgres el campo viene en el nombre de la restricción (Client_tenantId_phoneKey_key).
  const detail = JSON.stringify(error.meta ?? {});
  return detail.includes('phoneKey') ? 'Ya existe un cliente con ese teléfono' : 'Ya existe un cliente con ese correo';
}

const updateClientSchema = clientSchema.partial();

// GET /api/clients - List all clients
router.get('/', requirePermission('customers:read'), async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 80) : '';
    const visible = await clientScope(req);
    if (!visible) return res.json([]);
    // Por defecto solo los activos; ?archived=true devuelve los archivados.
    const archived = req.query.archived === 'true';
    const clients = await prisma.client.findMany({
      where: {
        tenantId: req.user!.tenantId,
        archivedAt: archived ? { not: null } : null,
        ...visible,
        ...(search
          ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }, { phone: { contains: search } }] }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 2000,
    });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/clients/:id - Get single client
router.get('/:id', requirePermission('customers:read'), async (req, res) => {
  try {
    const visible = await clientScope(req);
    if (!visible) return res.status(404).json({ error: 'Client not found' });
    const client = await prisma.client.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId, ...visible },
          });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/clients - Create new client
router.post('/', requireAdmin, async (req, res) => {
  try {
    const parsed = createClientSchema.parse(req.body);
    const clientData = parsed;

    const tenantId = req.user!.tenantId;
    const newClient = await runInTransaction((tx) =>
      tx.client.create({
        data: {
          ...normalizeContact(clientData),
          name: clientData.name,
          userId: req.userId!,
          tenantId,
        },
      })
    );

    res.status(201).json(newClient);
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }
    const duplicate = duplicateContact(error);
    if (duplicate) return res.status(409).json({ error: duplicate });

    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /api/clients/:id - Update client
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const data = updateClientSchema.parse(req.body);

    const client = await prisma.client.updateMany({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
      data: normalizeContact(data),
    });

    if (client.count === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const updatedClient = await prisma.client.findUnique({
      where: { id: req.params.id as string },
    });

    res.json(updatedClient);
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }
    const duplicate = duplicateContact(error);
    if (duplicate) return res.status(409).json({ error: duplicate });

    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /api/clients/:id/archive y /restore - Archivar o restaurar (el historial no se toca)
for (const action of ['archive', 'restore'] as const) {
  router.post(`/:id/${action}`, requireAdmin, async (req, res) => {
    try {
      const { count } = await prisma.client.updateMany({
        where: { id: req.params.id as string, tenantId: req.user!.tenantId },
        data: { archivedAt: action === 'archive' ? new Date() : null },
      });
      if (count === 0) return res.status(404).json({ error: 'Client not found' });
      res.json(await prisma.client.findUnique({ where: { id: req.params.id as string } }));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
}

// DELETE /api/clients/:id - Delete client
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    // Verify client exists and belongs to user
    const existingClient = await prisma.client.findFirst({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId },
    });

    if (!existingClient) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Un cliente con citas no se borra: el borrado arrastraría su historial. La condición va
    // dentro del propio borrado para que una cita creada justo ahora tampoco se pierda.
    const { count } = await prisma.client.deleteMany({
      where: { id: req.params.id as string, tenantId: req.user!.tenantId, appointments: { none: {} } },
    });
    if (count === 0) {
      const appointments = await prisma.appointment.count({ where: { clientId: existingClient.id, tenantId: req.user!.tenantId } });
      return res.status(409).json({
        error: `Este cliente tiene ${appointments} ${appointments === 1 ? 'cita registrada' : 'citas registradas'}. Para no perder tu historial, no se puede eliminar: archívalo y dejará de aparecer en tus listas.`,
        appointments,
      });
    }

    res.json({ message: 'Client deleted successfully' });
  } catch (error: any) { // Le decimos a TS que confíe en nosotros aquí temporalmente
    // Usamos el método interno de Zod para verificar o simplemente asumimos si tiene name
    if (error?.name === 'ZodError') {
      return res.status(400).json(zodResponse(error));
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({
        error: 'No se puede eliminar este registro porque tiene datos asociados en el sistema (ej. facturas, proyectos o suscripciones).',
      });
    }
    
    console.error(error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;