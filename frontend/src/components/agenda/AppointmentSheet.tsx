import React from 'react';
import { Check, Pencil, Phone, MessageCircle, UserX, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import type { Appointment, AppointmentStatus } from '../../types';
import { confirmationMessage, whatsappLink } from '../../lib/whatsapp';

interface Props {
  appointment: Appointment | null;
  salonName?: string;
  onClose: () => void;
  onStatus: (appointment: Appointment, status: AppointmentStatus) => void;
  onEdit: (appointment: Appointment) => void;
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: 'Pendiente',
  SCHEDULED: 'Agendada',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

const action = 'flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-medium hover:bg-muted active:bg-muted';

/** Hoja que sube desde abajo al tocar una cita: contactar al cliente y cambiar su estado. */
const AppointmentSheet: React.FC<Props> = ({ appointment, salonName, onClose, onStatus, onEdit }) => {
  const a = appointment;
  const phone = a?.client?.phone ?? null;
  const date = a?.date.split('T')[0] ?? '';
  const wa = a ? whatsappLink(phone, confirmationMessage({ clientName: a.client?.name, salonName, serviceName: a.serviceName, date, time: a.startTime })) : null;
  const active = a?.status === 'SCHEDULED' || a?.status === 'PENDING';

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <Drawer open={!!a} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        {a && (
          <>
            <DrawerHeader className="text-left">
              <DrawerTitle className="text-xl">{a.client?.name ?? 'Cliente'}</DrawerTitle>
              <DrawerDescription>
                {a.serviceName} · {a.startTime}–{a.endTime}
                {a.professional ? ` · ${a.professional.name}` : ''} · {STATUS_LABEL[a.status]}
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-1 px-4 pb-6">
              {phone && (
                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className={action}>
                  <Phone className="h-5 w-5 text-muted-foreground" /> Llamar
                </a>
              )}
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className={action}>
                  <MessageCircle className="h-5 w-5 text-green-600" /> Enviar confirmación por WhatsApp
                </a>
              )}
              {a.status === 'PENDING' && (
                <button type="button" className={action} onClick={run(() => onStatus(a, 'SCHEDULED'))}>
                  <Check className="h-5 w-5 text-blue-600" /> Confirmar
                </button>
              )}
              {active && (
                <>
                  <button type="button" className={action} onClick={run(() => onStatus(a, 'COMPLETED'))}>
                    <Check className="h-5 w-5 text-green-600" /> Completar
                  </button>
                  <button type="button" className={action} onClick={run(() => onStatus(a, 'NO_SHOW'))}>
                    <UserX className="h-5 w-5 text-muted-foreground" /> No asistió
                  </button>
                </>
              )}
              <button type="button" className={action} onClick={run(() => onEdit(a))}>
                <Pencil className="h-5 w-5 text-muted-foreground" /> Editar cita
              </button>
              {active && (
                <button type="button" className={`${action} text-red-600`} onClick={run(() => onStatus(a, 'CANCELLED'))}>
                  <X className="h-5 w-5" /> Cancelar cita
                </button>
              )}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default AppointmentSheet;
