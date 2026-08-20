import express from 'express';
import { authenticateToken } from '../middleware/auth';
import prisma from '../prismaClient';
import notificationService from '../services/notificationService';
import {
  AvailabilityError,
  createAppointmentSafely,
  isSerializationConflict,
  dayOfWeekFromDateString,
  dayRangeUTC,
  timeToMinutes,
  addMinutesToTime,
} from '../services/availabilityService';

const router = express.Router();

interface AuthRequest extends express.Request {
  userId?: string;
  user?: {
    userId: string;
    role: 'ADMIN' | 'CLIENT';
    clientId?: string;
  };
}

/**
 * GET /api/portal/my-invoices
 * Retorna las facturas del cliente autenticado
 * Solo pueden ver facturas donde clientId coincida con su clientId en el token
 */
router.get('/my-invoices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Si el usuario es CLIENT pero no tiene un clientId asignado, retornar array vacío
    if (!clientId) {
      return res.json([]);
    }

    // Obtener facturas del cliente
    const invoices = await prisma.invoice.findMany({
      where: {
        clientId: clientId, // Filtrar por clientId del usuario
      },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        project: {
          select: { id: true, name: true },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching client invoices:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/portal/my-profile
 * Retorna información del perfil del cliente autenticado
 */
router.get('/my-profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        imageUrl: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/portal/my-profile
 * Actualiza el perfil del cliente autenticado
 */
router.put('/my-profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const clientId = req.user?.clientId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, email, phone, address, imageUrl } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      // Actualizar User si name, email o imageUrl
      let updatedUser = null;
      if (name !== undefined || email !== undefined || imageUrl !== undefined) {
        updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(imageUrl !== undefined && { imageUrl }),
          },
        });
      }

      // Actualizar Client si phone, address, email o imageUrl
      let updatedClient = null;
      if (clientId && (phone !== undefined || address !== undefined || email !== undefined || imageUrl !== undefined)) {
        updatedClient = await tx.client.update({
          where: { id: clientId },
          data: {
            ...(phone !== undefined && { phone }),
            ...(address !== undefined && { address }),
            ...(email !== undefined && { email }),
            ...(imageUrl !== undefined && { imageUrl }),
          },
        });
      }

      return { updatedUser, updatedClient };
    });

    // Retornar el perfil actualizado
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        imageUrl: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            imageUrl: true,
          },
        },
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/portal/my-subscriptions
 * Retorna las suscripciones del cliente autenticado
 */
router.get('/my-subscriptions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.json([]);
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        clientId: clientId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            billingCycle: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching client subscriptions:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/portal/my-appointments
 * Retorna las citas del cliente autenticado
 */
router.get('/my-appointments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const clientId = req.user?.clientId;

    if (!clientId) {
      return res.json([]);
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        clientId: clientId,
      },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        product: {
          select: { id: true, name: true, price: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json(appointments);
  } catch (error) {
    console.error('Error fetching client appointments:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/portal/appointments
 * Crea una nueva cita para el cliente autenticado
 */
router.post('/appointments', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { productId, date, startTime, notes } = req.body;
    const clientId = req.user?.clientId;
    const userId = req.user?.userId;

    // Validar que el cliente existe
    if (!clientId) {
      return res.status(400).json({ error: 'Cliente no identificado' });
    }

    // Validar campos requeridos
    if (!productId || !date || !startTime) {
      return res.status(400).json({ error: 'Campos requeridos faltantes' });
    }

    // Verificar que el producto existe
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(400).json({ error: 'Servicio no encontrado' });
    }

    // La hora de fin se calcula a partir de la duración del servicio, no de
    // lo que mande el cliente.
    const endTime = addMinutesToTime(startTime, product.durationMinutes);

    // Disponibilidad + creación: misma regla que usa la administración, en
    // una sola transacción serializable para que dos clientas no puedan
    // reservar el mismo hueco al mismo tiempo.
    let appointment;
    try {
      appointment = await createAppointmentSafely({
        dateStr: date.split('T')[0],
        startTime,
        endTime,
        clientId,
        productId,
        notes: notes || '',
      });
    } catch (availabilityError: any) {
      if (availabilityError instanceof AvailabilityError) {
        return res.status(availabilityError.status).json({ error: availabilityError.message });
      }
      if (isSerializationConflict(availabilityError)) {
        return res.status(409).json({ error: 'Alguien reservó ese horario justo antes que tú. Prueba con otro horario.' });
      }
      throw availabilityError;
    }

    // Crear notificación para admin
    try {
      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: 'ADMIN',
        content: `Nueva cita agendada: cliente ${appointment.client.name} (${appointment.client.email}) - servicio ${appointment.product.name}, fecha ${new Date(appointment.date).toLocaleDateString('es-ES')} ${appointment.startTime}-${appointment.endTime}`,
      });

      // Notificación para el cliente
      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: clientId,
        clientId,
        content: `Tu cita ha sido agendada correctamente: ${appointment.product.name} el ${new Date(appointment.date).toLocaleDateString('es-ES')} a las ${appointment.startTime}.`,
      });
    } catch (notifError) {
      console.error('Error creating appointment notifications:', notifError);
    }

    res.status(201).json(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    return res.status(500).json({ error: 'Error al crear la cita' });
  }
});

/**
 * GET /api/portal/products
 * Retorna los productos/servicios disponibles para clientes
 */
router.get('/products', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        isPublic: true,
      },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PATCH /api/portal/appointments/:id/cancel
 * Permite al cliente cancelar su propia cita
 */
router.patch('/appointments/:id/cancel', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const clientId = req.user?.clientId;
    const userId = req.user?.userId;

    if (!clientId || !userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verificar que la cita existe y pertenece al cliente autenticado
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        product: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }

    if (appointment.clientId !== clientId) {
      return res.status(403).json({ error: 'No tienes permiso para cancelar esta cita' });
    }

    // No permitir cancelar citas ya canceladas
    if (appointment.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Esta cita ya ha sido cancelada' });
    }

    // No permitir cancelar citas completadas
    if (appointment.status === 'COMPLETED') {
      return res.status(400).json({ error: 'No puedes cancelar una cita completada' });
    }

    // Actualizar estado a CANCELLED
    const updatedAppointment = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' as const },
      include: {
        client: true,
        product: true,
      },
    });

    // Enviar notificación al cliente y admin
    try {
      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: clientId,
        clientId: clientId,
        content: `Tu cita para ${updatedAppointment.product?.name ?? 'este servicio'} el ${new Date(updatedAppointment.date).toLocaleDateString('es-ES')} a las ${updatedAppointment.startTime} ha sido cancelada exitosamente.`,
      });

      await notificationService.createNotification({
        type: 'SYSTEM',
        recipient: 'ADMIN',
        content: `La cita #${updatedAppointment.id} del cliente ${updatedAppointment.client?.name ?? 'desconocido'} para ${updatedAppointment.product?.name ?? 'este servicio'} el ${new Date(updatedAppointment.date).toLocaleDateString('es-ES')} a las ${updatedAppointment.startTime} ha sido cancelada por el cliente.`,
      });
    } catch (notifError) {
      console.error('Error creating cancellation notifications:', notifError);
    }

    res.json({
      message: 'Cita cancelada exitosamente',
      appointment: updatedAppointment,
    });
  } catch (error: any) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: 'Error al cancelar la cita' });
  }
});

/**
 * GET /api/portal/available-slots
 * Retorna los slots disponibles para una fecha específica
 * Query params: date (YYYY-MM-DD), productId (opcional)
 *
 * Si se indica productId, el solape se calcula con la duración real de ese
 * servicio; si no, se usa la comprobación antigua (solo el instante de
 * inicio), que es una aproximación — la validación real y vinculante ocurre
 * de todas formas en el servidor al crear la cita (availabilityService).
 */
router.get('/available-slots', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { date, productId } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'Fecha requerida (formato YYYY-MM-DD)' });
    }

    let durationMinutes: number | null = null;
    if (productId && typeof productId === 'string') {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { durationMinutes: true },
      });
      durationMinutes = product?.durationMinutes ?? null;
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Formato de fecha inválido (YYYY-MM-DD)' });
    }

    // Día de la semana (misma regla que availabilityService: se interpreta la
    // fecha como fecha de calendario, no como instante, para no depender del
    // huso horario del servidor).
    const dayOfWeek = dayOfWeekFromDateString(date);

    // Validar fecha cerrada
    const closedDate = await prisma.closedDate.findUnique({ where: { date } });
    if (closedDate) {
      return res.json([]);
    }

    // Buscar override para el día solicitado
    const scheduleOverride = await prisma.scheduleOverride.findUnique({ where: { date } });

    // Verificar si hay un horario comercial para el día de semana (fallback)
    const businessHour = await prisma.businessHour.findUnique({
      where: { dayOfWeek },
    });

    // Si el día no tiene horario comercial o está cerrado y no hay override, no slots
    if (!scheduleOverride && (!businessHour || !businessHour.isOpen)) {
      return res.json([]);
    }

    // ===== VALIDACIÓN DE CUPO MÁXIMO DIARIO =====
    // Calcular rango de fecha completo (para DateTime) del día solicitado
    const { start: startOfDay, end: endOfDay } = dayRangeUTC(date);

    // Contar citas agendadas para ese día
    const currentAppointmentsCount = await prisma.appointment.count({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: 'SCHEDULED',
      },
    });

    // Si se alcanzó el límite máximo de citas para el día, retornar array vacío
    if (businessHour && businessHour.maxAppointments > 0 && currentAppointmentsCount >= businessHour.maxAppointments) {
      return res.json([]); // No hay más cupos disponibles para este día
    }

    const availableSlots = scheduleOverride
      ? (Array.isArray(scheduleOverride.timeSlots) ? scheduleOverride.timeSlots : [])
      : (Array.isArray(businessHour?.timeSlots) ? businessHour.timeSlots : []);

    // Buscar citas agendadas para ese día (rango completo de fecha)
    const scheduledAppointments = await prisma.appointment.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: 'SCHEDULED',
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    // Filter available slots by checking for overlaps with existing appointments
    const finalAvailableSlots = availableSlots.filter((slot) => {
      const slotStartMinutes = timeToMinutes(slot);

      const conflict = scheduledAppointments.some((apt) => {
        const aptStartMinutes = timeToMinutes(apt.startTime);
        const aptEndMinutes = timeToMinutes(apt.endTime);

        if (durationMinutes != null) {
          // Se conoce el servicio: comparar el rango completo que ocuparía la cita.
          const slotEndMinutes = slotStartMinutes + durationMinutes;
          return slotStartMinutes < aptEndMinutes && slotEndMinutes > aptStartMinutes;
        }

        // Sin servicio seleccionado todavía: aproximación antigua (solo el
        // instante de inicio). La comprobación real ocurre al crear la cita.
        return slotStartMinutes >= aptStartMinutes && slotStartMinutes < aptEndMinutes;
      });

      return !conflict;
    });

    res.json(finalAvailableSlots);
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
