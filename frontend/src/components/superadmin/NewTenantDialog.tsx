import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Check, Building2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlans, useCreateTenant, useSlugAvailability, useTenantTemplates, getErrorMessage } from '../../hooks/usePlatformQueries';
import type { CreateTenantResponse, TenantHours, Vertical } from '../../types/superadmin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BookingQr from '../BookingQr';
import { shortBookingLink } from '../../lib/bookingLink';

/**
 * Alta asistida de un salón en 3 pasos (negocio → servicios y horario → dueño),
 * pensada para dejarlo listo en un par de minutos delante del cliente. El resultado
 * trae el enlace de reservas, el QR, las credenciales y un mensaje listo para enviar.
 */

const VERTICALS: Array<{ value: Vertical; label: string }> = [
  { value: 'BARBER', label: 'Barbería' },
  { value: 'NAILS', label: 'Manicura y uñas' },
  { value: 'HAIR', label: 'Peluquería' },
  { value: 'SPA', label: 'Spa y masajes' },
  { value: 'TATTOO', label: 'Tatuajes' },
  { value: 'FITNESS', label: 'Entrenamiento personal' },
  { value: 'GENERIC', label: 'Otro negocio con citas' },
];

const TIMEZONES = [
  'America/Havana', 'America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Caracas', 'America/Santiago',
  'America/Argentina/Buenos_Aires', 'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'America/Panama', 'America/Santo_Domingo', 'Europe/Madrid', 'UTC',
];
const CURRENCIES = ['CUP', 'USD', 'EUR', 'MXN', 'COP', 'CLP', 'ARS', 'PEN'];
const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // se muestra de lunes a domingo

const STEPS = ['Negocio', 'Servicios y horario', 'Dueño y bot'];

interface ServiceRow {
  name: string;
  price: string;
  durationMinutes: string;
}

const inputClass = 'w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-card';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={copy} className="px-3 py-2 border border-border rounded-md hover:bg-muted transition shrink-0 text-sm inline-flex items-center gap-2" title="Copiar">
      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
      {label}
    </button>
  );
};

const CopyField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
    <div className="flex items-center gap-2">
      <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm break-all">{value}</code>
      <CopyButton value={value} />
    </div>
  </div>
);

interface NewTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewTenantDialog: React.FC<NewTenantDialogProps> = ({ open, onOpenChange }) => {
  const { data: plans = [] } = usePlans();
  const { data: templateData } = useTenantTemplates();
  const createTenant = useCreateTenant();

  const [step, setStep] = useState(0);
  const [result, setResult] = useState<CreateTenantResponse | null>(null);

  // Paso 1
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [vertical, setVertical] = useState<Vertical>('BARBER');
  const [timezone, setTimezone] = useState('America/Havana');
  const [currency, setCurrency] = useState('CUP');
  const [planId, setPlanId] = useState('');
  // Paso 2
  const [professionals, setProfessionals] = useState<string[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [hours, setHours] = useState<TenantHours[]>([]);
  // Paso 3
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [botToken, setBotToken] = useState('');

  const slugCheck = useSlugAvailability(slug);

  // Si no se elige otro, el plan por defecto es el que se llama "Pro" (o el primero).
  useEffect(() => {
    if (!planId && plans.length) setPlanId((plans.find((p) => p.name.toLowerCase() === 'pro') ?? plans[0]).id);
  }, [plans, planId]);

  // Precarga servicios y profesional al elegir el oficio, y el horario de fábrica la primera vez.
  const loadTemplate = (v: Vertical) => {
    const t = templateData?.templates[v];
    if (!t) return;
    setServices(t.services.map((s) => ({ name: s.name, price: String(s.price), durationMinutes: String(s.durationMinutes) })));
    setProfessionals([t.professional]);
  };
  useEffect(() => {
    if (templateData && !services.length && !hours.length) {
      loadTemplate(vertical);
      setHours(templateData.hours);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateData]);

  const reset = () => {
    setStep(0);
    setResult(null);
    setName('');
    setSlug('');
    setSlugTouched(false);
    setVertical('BARBER');
    setTimezone('America/Havana');
    setCurrency('CUP');
    setAdminName('');
    setAdminEmail('');
    setBotToken('');
    if (templateData) {
      loadTemplate('BARBER');
      setHours(templateData.hours);
    }
  };
  const close = () => {
    reset();
    onOpenChange(false);
  };

  const plan = plans.find((p) => p.id === planId);
  const slugOk = slug.length >= 2 && (slugCheck.data ? slugCheck.data.available : true);

  const validStep = useMemo(() => {
    if (step === 0) return name.trim().length >= 2 && slugOk && !slugCheck.isFetching && !!planId;
    if (step === 1) {
      const cleanServices = services.filter((s) => s.name.trim());
      const okServices = cleanServices.length > 0 && cleanServices.every((s) => Number(s.price) >= 0 && s.price !== '' && Number(s.durationMinutes) >= 5);
      const okPros = professionals.filter((p) => p.trim().length >= 2).length > 0;
      const okPlan = !plan || plan.maxStaff == null || professionals.filter((p) => p.trim()).length <= plan.maxStaff;
      const okHours = hours.some((h) => h.isOpen) && hours.every((h) => !h.isOpen || h.startTime < h.endTime);
      return okServices && okPros && okPlan && okHours;
    }
    return adminName.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(adminEmail);
  }, [step, name, slugOk, slugCheck.isFetching, planId, services, professionals, hours, plan, adminName, adminEmail]);

  const submit = () => {
    createTenant.mutate(
      {
        name: name.trim(),
        slug,
        planId,
        billingCycle: 'MONTHLY',
        vertical,
        timezone,
        currency,
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        professionals: professionals.map((p) => p.trim()).filter(Boolean),
        services: services
          .filter((s) => s.name.trim())
          .map((s) => ({ name: s.name.trim(), price: Number(s.price), durationMinutes: Number(s.durationMinutes) })),
        hours,
        ...(botToken.trim() && { telegramBotToken: botToken.trim() }),
      },
      {
        onSuccess: setResult,
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo crear el salón')),
      }
    );
  };

  const setHour = (day: number, patch: Partial<TenantHours>) => setHours((hs) => hs.map((h) => (h.dayOfWeek === day ? { ...h, ...patch } : h)));
  const applyFirstOpenToAll = () => {
    const ref = hours.find((h) => h.isOpen);
    if (ref) setHours((hs) => hs.map((h) => (h.isOpen ? { ...h, startTime: ref.startTime, endTime: ref.endTime } : h)));
  };

  // ---------- Resultado ----------
  if (result) {
    const bookingLink = shortBookingLink(result.tenant.slug);
    const panelUrl = `${window.location.origin}${result.loginUrl}`;
    const bot = result.telegram;
    const message = [
      `Hola ${result.admin.name}, ya tienes tu agenda de reservas en ${result.tenant.name} 🎉`,
      '',
      `Enlace para tus clientes: ${bookingLink}`,
      `Tu panel: ${panelUrl}`,
      `Correo: ${result.admin.email}`,
      `Contraseña temporal: ${result.tempPassword}`,
      ...(bot?.ok ? ['', `Para recibir aquí los avisos de cada reserva, abre @${bot.botUsername} en Telegram y escríbele: /vincular ${bot.ownerCode}`] : []),
    ].join('\n');

    return (
      <Dialog open={open} onOpenChange={(next) => { if (!next) close(); else onOpenChange(next); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-500" />
              Salón creado: {result.tenant.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md p-3">
              La contraseña temporal solo se muestra <strong>una vez</strong>. Copia el mensaje y envíaselo al dueño.
            </p>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Mensaje para el dueño (WhatsApp o Telegram)</label>
              <pre className="px-3 py-2 bg-muted rounded-md text-sm whitespace-pre-wrap break-words font-sans">{message}</pre>
              <div className="mt-2"><CopyButton value={message} label="Copiar mensaje" /></div>
            </div>

            {bot && !bot.ok && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                El salón se creó, pero el bot de Telegram no se conectó: {bot.error} Puedes pegar el token de nuevo en Ajustes del salón.
              </p>
            )}
            {bot?.ok && (
              <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
                Bot @{bot.botUsername} conectado. Los clientes podrán activar sus avisos desde la confirmación de su reserva.
              </p>
            )}

            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium mb-2">QR de reservas</p>
              <BookingQr url={bookingLink} salonName={result.tenant.name} />
            </div>

            <CopyField label="Enlace de reservas" value={bookingLink} />

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <a href={bookingLink} target="_blank" rel="noreferrer" className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted">
                Ver página de reservas
              </a>
              <button onClick={close} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition">
                Listo
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ---------- Asistente ----------
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); else onOpenChange(next); }}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Nuevo salón</DialogTitle>
        </DialogHeader>

        <ol className="flex items-center gap-2 text-xs" aria-label="Pasos">
          {STEPS.map((label, i) => (
            <li key={label} className={`flex items-center gap-2 ${i === step ? 'text-indigo-600 font-semibold' : i < step ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center border ${i === step ? 'border-indigo-600' : i < step ? 'border-emerald-600' : 'border-border'}`}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {label}
              {i < STEPS.length - 1 && <span className="text-border">—</span>}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nombre del negocio *</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder="Barbería El Elegante"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Enlace de reservas *</label>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-muted-foreground shrink-0">{window.location.host}/r/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                  placeholder="barberia-el-elegante"
                  className={inputClass}
                />
              </div>
              {slug.length >= 2 && !slugCheck.isFetching && slugCheck.data && (
                <p className={`mt-1 text-xs ${slugCheck.data.available ? 'text-emerald-600' : 'text-red-600'}`}>
                  {slugCheck.data.available ? '✓ Disponible' : slugCheck.data.reason}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Oficio</label>
                <select
                  value={vertical}
                  onChange={(e) => {
                    const v = e.target.value as Vertical;
                    setVertical(v);
                    loadTemplate(v);
                  }}
                  className={inputClass}
                >
                  {VERTICALS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Plan</label>
                <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputClass}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Zona horaria</label>
                <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={inputClass}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Moneda de los precios</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputClass}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <section>
              <h4 className="text-sm font-semibold mb-2">{vertical === 'BARBER' ? 'Barberos' : 'Profesionales'}</h4>
              <div className="space-y-2">
                {professionals.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={p}
                      onChange={(e) => setProfessionals((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))}
                      placeholder="Nombre"
                      aria-label={`Profesional ${i + 1}`}
                      className={inputClass}
                    />
                    {professionals.length > 1 && (
                      <button type="button" onClick={() => setProfessionals((ps) => ps.filter((_, j) => j !== i))} className="p-2 border border-border rounded-md hover:bg-muted" aria-label="Quitar profesional">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setProfessionals((ps) => [...ps, ''])} className="mt-2 text-sm text-indigo-600 inline-flex items-center gap-1">
                <Plus className="h-4 w-4" /> Añadir
              </button>
              {plan?.maxStaff != null && professionals.filter((p) => p.trim()).length > plan.maxStaff && (
                <p className="mt-1 text-xs text-red-600">El plan {plan.name} admite hasta {plan.maxStaff}.</p>
              )}
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-2">Servicios ({currency})</h4>
              <div className="grid grid-cols-[1fr_5.5rem_5rem_2.25rem] gap-2 text-xs text-muted-foreground mb-1 px-1">
                <span>Nombre</span><span>Precio</span><span>Minutos</span><span />
              </div>
              <div className="space-y-2">
                {services.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5.5rem_5rem_2.25rem] gap-2">
                    <input value={s.name} onChange={(e) => setServices((ss) => ss.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label={`Servicio ${i + 1}`} className={inputClass} />
                    <input type="number" min={0} value={s.price} onChange={(e) => setServices((ss) => ss.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} aria-label={`Precio ${i + 1}`} className={inputClass} />
                    <input type="number" min={5} step={5} value={s.durationMinutes} onChange={(e) => setServices((ss) => ss.map((x, j) => (j === i ? { ...x, durationMinutes: e.target.value } : x)))} aria-label={`Minutos ${i + 1}`} className={inputClass} />
                    <button type="button" onClick={() => setServices((ss) => ss.filter((_, j) => j !== i))} className="border border-border rounded-md hover:bg-muted flex items-center justify-center" aria-label="Quitar servicio">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setServices((ss) => [...ss, { name: '', price: '', durationMinutes: '30' }])} className="mt-2 text-sm text-indigo-600 inline-flex items-center gap-1">
                <Plus className="h-4 w-4" /> Añadir servicio
              </button>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Horario</h4>
                <button type="button" onClick={applyFirstOpenToAll} className="text-xs text-indigo-600">Copiar el primer día a todos</button>
              </div>
              <div className="space-y-1.5">
                {DAY_ORDER.map((d) => {
                  const h = hours.find((x) => x.dayOfWeek === d);
                  if (!h) return null;
                  return (
                    <div key={d} className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[7rem_1fr_1fr] items-center gap-2 text-sm">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={h.isOpen} onChange={(e) => setHour(d, { isOpen: e.target.checked })} />
                        {DAYS[d]}
                      </label>
                      {h.isOpen ? (
                        <div className="col-span-2 sm:col-span-2 flex items-center gap-2">
                          <input type="time" value={h.startTime} onChange={(e) => setHour(d, { startTime: e.target.value })} aria-label={`${DAYS[d]} apertura`} className={inputClass} />
                          <span className="text-muted-foreground">a</span>
                          <input type="time" value={h.endTime} onChange={(e) => setHour(d, { endTime: e.target.value })} aria-label={`${DAYS[d]} cierre`} className={inputClass} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground sm:col-span-2">Cerrado</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Nombre del dueño *</label>
              <input autoFocus value={adminName} onChange={(e) => setAdminName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Correo del dueño *</label>
              <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className={inputClass} />
              <p className="mt-1 text-xs text-muted-foreground">Es su usuario para entrar al panel; recibe también los avisos de reservas.</p>
            </div>
            <div className="pt-3 border-t border-border">
              <label className="block text-sm font-medium mb-1.5">Token del bot de Telegram (opcional)</label>
              <input type="password" autoComplete="off" value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123456:ABC..." className={inputClass} />
              <p className="mt-1 text-xs text-muted-foreground">
                Crea el bot con @BotFather (/newbot). Los clientes recibirán confirmaciones y recordatorios por Telegram. Puedes dejarlo para después.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between gap-3 pt-4 border-t border-border">
          <button type="button" onClick={step === 0 ? close : () => setStep(step - 1)} className="px-4 py-2 text-sm text-foreground bg-muted rounded-md hover:opacity-80 transition">
            {step === 0 ? 'Cancelar' : 'Atrás'}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" disabled={!validStep} onClick={() => setStep(step + 1)} className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition disabled:opacity-50">
              Siguiente
            </button>
          ) : (
            <button type="button" disabled={!validStep || createTenant.isPending} onClick={submit} className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition disabled:opacity-50">
              {createTenant.isPending ? 'Creando…' : 'Crear salón'}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewTenantDialog;
