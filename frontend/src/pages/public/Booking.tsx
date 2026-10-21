import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { addDays, endOfMonth, format, isBefore, startOfDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale/es';
import toast from 'react-hot-toast';
import { CalendarCheck, Check, ChevronLeft, Clock, Copy, User, Users } from 'lucide-react';
import {
  apiErrorMessage,
  publicApi,
  type PublicAppointment,
  type PublicCatalog,
  takePrefetchedCatalog,
  type PublicSlot,
} from '../../lib/publicApi';
import LazyCalendar from './LazyCalendar';
import { loadCalendar } from './calendarLoader';
import TelegramOptIn from './TelegramOptIn';
import PublicShell from './PublicShell';
import { money } from './format';
import { Spinner } from './shared';
import { useTurnstile } from './useTurnstile';

type Step = 'service' | 'professional' | 'date' | 'time' | 'details' | 'done';

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const inputClass =
  'w-full px-4 py-3 border border-border rounded-xl bg-card text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';

const Booking: React.FC = () => {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const [step, setStep] = useState<Step>('service');
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState<string>('any');
  const [date, setDate] = useState<Date | undefined>();
  const [month, setMonth] = useState(new Date());
  const [startTime, setStartTime] = useState('');
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // campo trampa para bots
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<PublicAppointment | null>(null);

  // Cada paso empieza arriba: con una lista larga de servicios u horas, el siguiente paso no debe quedar a media pantalla.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  // Con la primera pantalla ya pintada, descarga el calendario en segundo plano para que el paso 2 sea instantáneo.
  useEffect(() => {
    const id = window.setTimeout(() => void loadCalendar(), 800);
    return () => window.clearTimeout(id);
  }, []);

  const catalog = useQuery({
    queryKey: ['public-catalog', tenantSlug],
    queryFn: async () => (await takePrefetchedCatalog(tenantSlug)) ?? (await publicApi.get<PublicCatalog>(`/${tenantSlug}`)).data,
    retry: false,
  });
  const data = catalog.data;
  const word = (key: string, fallback: string) => data?.labels?.[key] || fallback;
  const turnstile = useTurnstile(data?.captchaSiteKey);

  const service = data?.services.find((s) => s.id === serviceId);
  const professionals = useMemo(
    () => (data?.professionals ?? []).filter((p) => p.serviceIds.includes(serviceId)),
    [data, serviceId]
  );

  const dateStr = date ? format(date, 'yyyy-MM-dd') : '';
  const today = startOfDay(new Date());

  // Días del mes visible que tienen algún hueco
  const monthStart = startOfMonth(month);
  const from = format(isBefore(monthStart, today) ? today : monthStart, 'yyyy-MM-dd');
  const to = format(endOfMonth(month), 'yyyy-MM-dd');
  const calendar = useQuery({
    queryKey: ['public-calendar', tenantSlug, serviceId, professionalId, from, to],
    queryFn: async () =>
      (await publicApi.get<{ availableDates: string[] }>(`/${tenantSlug}/calendar`, { params: { serviceId, professionalId, from, to } })).data
        .availableDates,
    enabled: !!serviceId && step === 'date' && from <= to,
  });

  const slots = useQuery({
    queryKey: ['public-slots', tenantSlug, serviceId, professionalId, dateStr],
    queryFn: async () =>
      (await publicApi.get<{ slots: PublicSlot[] }>(`/${tenantSlug}/availability`, { params: { serviceId, professionalId, date: dateStr } })).data.slots,
    enabled: !!serviceId && !!dateStr && step === 'time',
  });

  const book = useMutation({
    mutationFn: async () =>
      (
        await publicApi.post<PublicAppointment>(`/${tenantSlug}/bookings`, {
          serviceId,
          professionalId,
          date: dateStr,
          startTime,
          customer: {
            name: customer.name,
            phone: customer.phone || undefined,
            email: customer.email || undefined,
          },
          notes: notes || undefined,
          captchaToken: turnstile.token || undefined,
          website,
        })
      ).data,
    onSuccess: (appointment) => {
      setBooked(appointment);
      setStep('done');
      setError('');
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      // Si el hueco se ocupó justo antes, se vuelve a elegir hora
      if ((err as { response?: { status?: number } }).response?.status === 409) setStep('time');
    },
  });

  if (catalog.isLoading) return <PublicShell title="Reservar"><Spinner /></PublicShell>;
  if (catalog.isError || !data) {
    return (
      <PublicShell title="Reservar">
        <p className="text-center text-muted-foreground py-12">No encontramos este negocio. Revisa el enlace.</p>
      </PublicShell>
    );
  }
  if (!data.bookingEnabled) {
    return (
      <PublicShell title={data.name} salon={data}>
        <p className="text-center text-muted-foreground py-12">Este negocio no acepta reservas en línea por ahora.</p>
      </PublicShell>
    );
  }

  const back = () => {
    const order: Step[] = ['service', 'professional', 'date', 'time', 'details'];
    let index = order.indexOf(step) - 1;
    // Si solo hay un profesional, ese paso no existe
    if (order[index] === 'professional' && professionals.length <= 1) index -= 1;
    if (index >= 0) setStep(order[index]);
  };

  const chooseService = (id: string) => {
    setServiceId(id);
    setDate(undefined);
    setStartTime('');
    const pros = data.professionals.filter((p) => p.serviceIds.includes(id));
    setProfessionalId(pros.length === 1 ? pros[0].id : 'any');
    setStep(pros.length > 1 ? 'professional' : 'date');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!customer.name.trim()) return setError('Escribe tu nombre');
    if (!customer.phone.trim() && !customer.email.trim()) return setError('Indica un teléfono o un correo para confirmarte la reserva');
    if (turnstile.required && !turnstile.token) return setError('Completa la verificación de seguridad');
    book.mutate();
  };

  const professionalName =
    professionalId === 'any' ? null : data.professionals.find((p) => p.id === professionalId)?.name ?? null;
  const grouped = data.services.reduce<Record<string, PublicCatalog['services']>>((acc, s) => {
    const key = s.category?.name ?? 'Servicios';
    (acc[key] ??= []).push(s);
    return acc;
  }, {});

  // Con un solo profesional no hay paso para elegirlo.
  const visibleSteps: Step[] = professionals.length > 1 ? ['service', 'professional', 'date', 'time', 'details'] : ['service', 'date', 'time', 'details'];
  const stepCount = visibleSteps.length;
  const stepNumber = Math.max(1, visibleSteps.indexOf(step) + 1);

  const copyManageLink = async () => {
    if (!booked?.manageUrl) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${booked.manageUrl}`);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar. Mantén pulsado «Cambiar o cancelar» para copiar el enlace.');
    }
  };

  const maxDate = addDays(today, data.maxAdvanceDays);
  const availableSet = new Set(calendar.data ?? []);

  return (
    <PublicShell title={data.name} salon={data} subtitle={`Reserva tu ${word('appointment', 'cita')} en línea`}>
      {step !== 'service' && step !== 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={back} className="inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <span className="text-xs text-muted-foreground">Paso {stepNumber} de {stepCount}</span>
          </div>
          {service && step !== 'details' && (
            <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
              <span className="font-medium text-foreground">{service.name}</span>
              <span className="text-muted-foreground">
                {' · '}{money(service.price, service.currency)}
                {professionalName && step !== 'professional' ? ` · ${professionalName}` : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {error && <div role="alert" className="rounded-xl bg-red-50 text-red-800 px-4 py-3 text-sm border border-red-200">{error}</div>}

      {step === 'service' && (
        <section className="space-y-5">
          <h2 className="text-lg font-semibold text-foreground">¿Qué {word('service', 'servicio')} quieres?</h2>
          {data.services.length === 0 && <p className="text-muted-foreground">Este negocio aún no tiene {word('services', 'servicios')} disponibles.</p>}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">{category}</h3>
              {items.map((s) => (
                <button
                  key={s.id}
                  onClick={() => chooseService(s.id)}
                  className="w-full text-left bg-card rounded-2xl border border-border p-4 hover:border-blue-400 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{s.name}</div>
                      {s.description && <div className="text-sm text-muted-foreground mt-0.5">{s.description}</div>}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Clock className="h-3.5 w-3.5" /> {s.durationMinutes} min
                      </div>
                    </div>
                    <div className="font-semibold text-foreground whitespace-nowrap">{money(s.price, s.currency)}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </section>
      )}

      {step === 'professional' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">¿Con quién?</h2>
          <button
            onClick={() => { setProfessionalId('any'); setStep('date'); }}
            className="w-full text-left bg-card rounded-2xl border border-border p-4 hover:border-blue-400 flex items-center gap-3"
          >
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-medium text-foreground">Cualquiera disponible</div>
              <div className="text-sm text-muted-foreground">Te asignamos quien tenga hueco a esa hora</div>
            </div>
          </button>
          {professionals.map((p) => (
            <button
              key={p.id}
              onClick={() => { setProfessionalId(p.id); setStep('date'); }}
              className="w-full text-left bg-card rounded-2xl border border-border p-4 hover:border-blue-400 flex items-center gap-3"
            >
              <span className="h-9 w-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: p.color || '#3B82F6' }}>
                <User className="h-4 w-4" />
              </span>
              <span className="font-medium text-foreground">{p.name}</span>
            </button>
          ))}
        </section>
      )}

      {step === 'date' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Elige el día</h2>
          <div className="bg-card rounded-2xl border border-border p-3 overflow-x-auto">
            <LazyCalendar
              mode="single"
              locale={es}
              month={month}
              onMonthChange={(m) => { setMonth(m); setError(''); }}
              selected={date}
              onSelect={(d) => { if (d) { setDate(d); setStartTime(''); setStep('time'); } }}
              disabled={(d) => isBefore(startOfDay(d), today) || d > maxDate || (calendar.isSuccess && !availableSet.has(format(d, 'yyyy-MM-dd')))}
              className="w-full min-w-[17rem]"
            />
          </div>
          {calendar.isFetching && <p className="text-xs text-muted-foreground text-center">Buscando días con horarios…</p>}
          {calendar.isSuccess && availableSet.size === 0 && (
            <p className="text-sm text-muted-foreground text-center">No hay días disponibles este mes. Prueba con el siguiente.</p>
          )}
        </section>
      )}

      {step === 'time' && date && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{cap(format(date, "EEEE d 'de' MMMM", { locale: es }))}</h2>
          {slots.isLoading ? (
            <Spinner />
          ) : (slots.data ?? []).length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-6 text-center text-muted-foreground">
              No quedan horarios este día.{' '}
              <button className="text-blue-600 underline" onClick={() => setStep('date')}>Elegir otro día</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.data!.map((s) => (
                <button
                  key={s.startTime}
                  onClick={() => { setStartTime(s.startTime); setError(''); setStep('details'); }}
                  className="py-3 rounded-xl border border-border bg-card text-foreground font-medium hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                >
                  {s.startTime}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 'details' && service && date && (
        <form onSubmit={submit} className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-4 space-y-1">
            <div className="font-medium text-foreground">{service.name}</div>
            <div className="text-sm text-muted-foreground">
              {cap(format(date, "EEEE d 'de' MMMM", { locale: es }))} · {startTime}
              {professionalName ? ` · ${professionalName}` : ''}
            </div>
            <div className="text-sm text-muted-foreground">{service.durationMinutes} min · {money(service.price, service.currency)}</div>
          </div>

          <h2 className="text-lg font-semibold text-foreground">Tus datos</h2>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
            <input id="name" className={inputClass} autoComplete="name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required minLength={2} />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">Teléfono</label>
            <input id="phone" type="tel" inputMode="tel" className={inputClass} autoComplete="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">Correo (para enviarte la confirmación)</label>
            <input id="email" type="email" className={inputClass} autoComplete="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-1">Notas (opcional)</label>
            <textarea id="notes" rows={2} maxLength={500} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {/* Campo trampa: invisible para personas */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>Sitio web<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          </div>
          <div ref={turnstile.containerRef} />
          <p className="text-xs text-muted-foreground">
            Necesitamos un teléfono o un correo para confirmarte. Podrás cambiar o cancelar tu {word('appointment', 'cita')}
            {data.cancelWindowHrs > 0 ? ` hasta ${data.cancelWindowHrs} horas antes` : ''} con un enlace.
          </p>
          <button
            type="submit"
            disabled={book.isPending}
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {book.isPending ? 'Reservando…' : `Confirmar ${word('appointment', 'cita')}`}
          </button>
        </form>
      )}

      {step === 'done' && booked && (
        <section className="bg-card rounded-2xl border border-border p-6 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">¡Listo! Ya tienes tu {word('appointment', 'cita')}</h2>
          <div className="text-left bg-muted rounded-xl p-4 space-y-1 text-sm">
            <div className="font-medium text-foreground">{booked.serviceName}</div>
            <div className="text-muted-foreground">
              {cap(format(new Date(`${booked.date.split('T')[0]}T00:00:00`), "EEEE d 'de' MMMM", { locale: es }))} · {booked.startTime}–{booked.endTime}
            </div>
            {booked.professionalName && <div className="text-muted-foreground">Con {booked.professionalName}</div>}
            <div className="text-muted-foreground">{money(booked.priceAmount, booked.currency)}</div>
          </div>
          {customer.email && <p className="text-sm text-muted-foreground">Te enviamos la confirmación a {customer.email}.</p>}
          <TelegramOptIn telegram={booked.telegram} />
          {booked.manageUrl && (
            <div className="flex flex-col items-center gap-3">
              <Link to={booked.manageUrl} className="inline-flex items-center gap-2 py-1 text-blue-600 font-medium">
                <CalendarCheck className="h-4 w-4" /> Cambiar o cancelar mi {word('appointment', 'cita')}
              </Link>
              <button
                type="button"
                onClick={() => void copyManageLink()}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                <Copy className="h-4 w-4" /> Copiar enlace de mi {word('appointment', 'cita')}
              </button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Guarda este enlace: es la única forma de gestionar tu {word('appointment', 'cita')} sin cuenta.</p>
        </section>
      )}
    </PublicShell>
  );
};

export default Booking;
