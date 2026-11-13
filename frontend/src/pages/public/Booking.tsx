import PhoneInput from '../../components/PhoneInput';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, addMonths, endOfMonth, format, isBefore, startOfDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale/es';
import toast from 'react-hot-toast';
import { CalendarCheck, Check, ChevronLeft, ChevronRight, Clock, Copy, User, Users } from 'lucide-react';
import {
  apiErrorMessage,
  publicApi,
  type PublicAppointment,
  type PublicCatalog,
  takePrefetchedCatalog,
  type PublicSlot,
} from '../../lib/publicApi';
import BookingCalendar from './BookingCalendar';
import CategorySection from './CategorySection';
import { loadCalendar } from './calendarLoader';
import TelegramOptIn from './TelegramOptIn';
import AddToCalendar from '../../components/AddToCalendar';
import PublicShell from './PublicShell';
import { money } from './format';
import { Spinner } from './shared';
import { useTurnstile } from './useTurnstile';

type Step = 'service' | 'professional' | 'date' | 'time' | 'details' | 'done';

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const inputClass =
  'w-full px-4 py-3 border border-border rounded-xl bg-card text-foreground focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';

/** Ficha tocable (servicio, profesional): borde y sombra, relieve al pasar el cursor y «se hunde» al pulsarla. */
const choiceCardClass =
  'group w-full text-left bg-card rounded-2xl border border-border p-4 shadow-sm transition active:scale-[0.99] active:bg-muted/60 hover:border-blue-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none motion-reduce:active:scale-100';

const slotClass =
  'min-h-12 rounded-xl border border-border bg-card text-base font-semibold text-foreground shadow-sm transition active:scale-95 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-900/40 dark:hover:text-blue-200 motion-reduce:transition-none motion-reduce:active:scale-100';

const PERIODS = [
  { key: 'morning', label: 'Mañana', matches: (hour: number) => hour < 12 },
  { key: 'afternoon', label: 'Tarde', matches: (hour: number) => hour >= 12 && hour < 18 },
  { key: 'evening', label: 'Noche', matches: (hour: number) => hour >= 18 },
];

/** Rango de fechas que se pide al servidor para un mes: nunca antes de hoy. */
function monthRange(month: Date, today: Date) {
  const start = startOfMonth(month);
  return { from: format(isBefore(start, today) ? today : start, 'yyyy-MM-dd'), to: format(endOfMonth(month), 'yyyy-MM-dd') };
}

/** Consulta de los días con huecos de un mes; la usan tanto la pantalla como la precarga, con la misma clave de caché. */
function calendarQuery(tenantSlug: string, serviceId: string, professionalId: string, month: Date, today: Date) {
  const { from, to } = monthRange(month, today);
  return {
    queryKey: ['public-calendar', tenantSlug, serviceId, professionalId, from, to],
    queryFn: async () =>
      (await publicApi.get<{ availableDates: string[] }>(`/${tenantSlug}/calendar`, { params: { serviceId, professionalId, from, to } })).data
        .availableDates,
    // Sin esto cada precarga y cada visita al mes volvería a pedir lo mismo (por defecto los datos nacen caducados).
    staleTime: 60_000,
  };
}

const Booking: React.FC = () => {
  const { tenantSlug = '' } = useParams<{ tenantSlug: string }>();
  const queryClient = useQueryClient();
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
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

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
  const maxDate = addDays(today, data?.maxAdvanceDays ?? 0);

  // Días del mes visible que tienen algún hueco
  const calendar = useQuery({
    ...calendarQuery(tenantSlug, serviceId, professionalId, month, today),
    enabled: !!serviceId && step === 'date',
  });

  // Los días con huecos se piden en cuanto se sabe servicio y profesional (no al abrir el calendario), así que al llegar
  // al paso del día los datos ya suelen estar. Se precargan también los meses vecinos para que cambiar de mes sea instantáneo.
  const prefetchCalendar = (svc: string, pro: string, around: Date) => {
    const months = [around, addMonths(around, 1)];
    if (startOfMonth(around) > startOfMonth(today)) months.push(addMonths(around, -1));
    for (const m of months) {
      if (startOfMonth(m) <= maxDate) void queryClient.prefetchQuery(calendarQuery(tenantSlug, svc, pro, m, today));
    }
  };
  const visibleMonthKey = format(month, 'yyyy-MM');
  useEffect(() => {
    if (step === 'date' && calendar.isSuccess) prefetchCalendar(serviceId, professionalId, month);
    // Solo cuando cambia lo que se está mirando: prefetchCalendar se redefine en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, calendar.isSuccess, serviceId, professionalId, visibleMonthKey]);

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
    setMonth(new Date());
    const pros = data.professionals.filter((p) => p.serviceIds.includes(id));
    const proId = pros.length === 1 ? pros[0].id : 'any';
    setProfessionalId(proId);
    // Con varios profesionales todavía falta elegir; con uno solo (o ninguna elección posible) ya se puede pedir el calendario.
    if (pros.length <= 1) prefetchCalendar(id, proId, new Date());
    setStep(pros.length > 1 ? 'professional' : 'date');
  };

  const chooseProfessional = (id: string) => {
    setProfessionalId(id);
    prefetchCalendar(serviceId, id, month);
    setStep('date');
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

  const availableDates = calendar.data ? new Set(calendar.data) : undefined;

  // Horas agrupadas por parte del día; los rótulos solo aparecen si hay horarios en más de una.
  const slotGroups = PERIODS.map((p) => ({ ...p, items: (slots.data ?? []).filter((s) => p.matches(Number(s.startTime.slice(0, 2)))) })).filter((g) => g.items.length > 0);

  return (
    <PublicShell title={data.name} salon={data} subtitle={`Reserva tu ${word('appointment', 'cita')} en línea`}>
      {step !== 'service' && step !== 'done' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-foreground/80 transition hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ChevronLeft className="h-4 w-4" /> Atrás
            </button>
            <span className="text-xs font-medium text-muted-foreground">Paso {stepNumber} de {stepCount}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progreso de la reserva"
            aria-valuemin={1}
            aria-valuemax={stepCount}
            aria-valuenow={stepNumber}
            className="flex gap-1.5"
          >
            {Array.from({ length: stepCount }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < stepNumber ? 'bg-blue-600' : 'bg-border'}`} />
            ))}
          </div>
          {service && step !== 'details' && (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm shadow-sm">
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40">
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="font-medium text-foreground">{service.name}</span>
                <span className="text-muted-foreground">
                  {' · '}{money(service.price, service.currency)}
                  {professionalName && step !== 'professional' ? ` · ${professionalName}` : ''}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {error && <div role="alert" className="rounded-xl bg-red-50 text-red-800 px-4 py-3 text-sm border border-red-200">{error}</div>}

      {step === 'service' && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">¿Qué {word('service', 'servicio')} quieres?</h2>
          {data.services.length === 0 && <p className="text-muted-foreground">Este negocio aún no tiene {word('services', 'servicios')} disponibles.</p>}
          <div className="space-y-1">
            {Object.entries(grouped).map(([category, items]) => (
              <CategorySection
                key={category}
                title={category}
                count={items.length}
                collapsible={Object.keys(grouped).length > 1}
                open={!collapsedCategories[category]}
                onToggle={() => setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }))}
              >
                {items.map((s) => (
                  <button key={s.id} type="button" onClick={() => chooseService(s.id)} className={choiceCardClass}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 font-semibold text-foreground">{s.name}</div>
                      <div className="shrink-0 whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-0.5 text-sm font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        {money(s.price, s.currency)}
                      </div>
                    </div>
                    {s.description && <div className="mt-0.5 text-sm text-muted-foreground">{s.description}</div>}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" /> {s.durationMinutes} min
                      </div>
                      <span aria-hidden="true" className="inline-flex items-center gap-0.5 text-sm font-semibold text-blue-600">
                        Elegir <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </button>
                ))}
              </CategorySection>
            ))}
          </div>
        </section>
      )}

      {step === 'professional' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">¿Con quién?</h2>
          <button type="button" onClick={() => chooseProfessional('any')} className={`${choiceCardClass} flex items-center gap-3`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/40">
              <Users className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">Cualquiera disponible</div>
              <div className="text-sm text-muted-foreground">Te asignamos quien tenga hueco a esa hora</div>
            </div>
            <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
          {professionals.map((p) => (
            <button key={p.id} type="button" onClick={() => chooseProfessional(p.id)} className={`${choiceCardClass} flex items-center gap-3`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: p.color || '#3B82F6' }}>
                <User className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 font-semibold text-foreground">{p.name}</span>
              <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </section>
      )}

      {step === 'date' && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Elige el día</h2>
            <p className="text-sm text-muted-foreground">Toca un día resaltado para ver sus horarios.</p>
          </div>
          <BookingCalendar
            month={month}
            onMonthChange={(m) => { setMonth(m); setError(''); }}
            selected={date}
            onSelect={(d) => { setDate(d); setStartTime(''); setStep('time'); }}
            today={today}
            maxDate={maxDate}
            availableDates={availableDates}
            error={calendar.isError}
            onRetry={() => void calendar.refetch()}
          />
        </section>
      )}

      {step === 'time' && date && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{cap(format(date, "EEEE d 'de' MMMM", { locale: es }))}</h2>
            <p className="text-sm text-muted-foreground">
              Selecciona la hora de tu {word('appointment', 'cita')}{service ? ` · dura ${service.durationMinutes} min` : ''}
            </p>
          </div>
          {slots.isLoading ? (
            <div role="status" aria-label="Cargando horarios" className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} aria-hidden="true" className="h-12 animate-pulse rounded-xl bg-card ring-1 ring-border motion-reduce:animate-none" style={{ animationDelay: `${i * 70}ms` }} />
              ))}
            </div>
          ) : (slots.data ?? []).length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-6 text-center text-muted-foreground">
              No quedan horarios este día.{' '}
              <button className="text-blue-600 underline" onClick={() => setStep('date')}>Elegir otro día</button>
            </div>
          ) : (
            <div className="space-y-4">
              {slotGroups.map((group) => (
                <div key={group.key} className="space-y-2">
                  {slotGroups.length > 1 && <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h3>}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {group.items.map((s) => (
                      <button
                        key={s.startTime}
                        type="button"
                        onClick={() => { setStartTime(s.startTime); setError(''); setStep('details'); }}
                        className={slotClass}
                      >
                        {s.startTime}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {step === 'details' && service && date && (
        <form onSubmit={submit} className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 font-semibold text-foreground">{service.name}</div>
              <div className="shrink-0 whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-0.5 text-sm font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                {money(service.price, service.currency)}
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CalendarCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {cap(format(date, "EEEE d 'de' MMMM", { locale: es }))} · {startTime}
                {professionalName ? ` · ${professionalName}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{service.durationMinutes} min</span>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-foreground">Tus datos</h2>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
            <input id="name" className={inputClass} autoComplete="name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} required minLength={2} />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-foreground mb-1">Teléfono</label>
            <PhoneInput id="phone" className={inputClass} value={customer.phone} onValueChange={(phone) => setCustomer({ ...customer, phone })} />
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
            className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-semibold shadow-sm transition hover:bg-blue-700 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50"
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
          <AddToCalendar event={{ title: `${booked.serviceName} en ${data.name}`, startsAt: booked.startsAt, endsAt: booked.endsAt, location: data.name, details: booked.professionalName ? `Con ${booked.professionalName}` : undefined, uid: booked.id }} />
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
