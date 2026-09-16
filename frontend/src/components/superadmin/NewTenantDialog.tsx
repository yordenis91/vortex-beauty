import React, { useState } from 'react';
import { Copy, Check, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePlans, useCreateTenant, getErrorMessage } from '../../hooks/usePlatformQueries';
import type { CreateTenantResponse } from '../../types/superadmin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const emptyForm = {
  name: '',
  slug: '',
  planId: '',
  billingCycle: 'MONTHLY' as 'MONTHLY' | 'YEARLY',
  adminName: '',
  adminEmail: '',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CopyField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm break-all">{value}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="p-2 border border-border rounded-md hover:bg-muted transition shrink-0"
          title="Copiar"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
};

interface NewTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NewTenantDialog: React.FC<NewTenantDialogProps> = ({ open, onOpenChange }) => {
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [result, setResult] = useState<CreateTenantResponse | null>(null);

  const { data: plans = [] } = usePlans();
  const createTenant = useCreateTenant();

  const resetAndClose = () => {
    setForm(emptyForm);
    setSlugTouched(false);
    setResult(null);
    onOpenChange(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTenant.mutate(
      { ...form, slug: form.slug || undefined },
      {
        onSuccess: (data) => setResult(data),
        onError: (error) => toast.error(getErrorMessage(error, 'No se pudo crear el salón')),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetAndClose(); else onOpenChange(next); }}>
      <DialogContent className="sm:max-w-[520px]">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-500" />
                Salón creado: {result.tenant.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                Esta contraseña temporal solo se muestra <strong>una vez</strong>. Cópiala y compártela con el salón por un canal seguro.
              </p>
              <CopyField label="URL de registro para sus clientas" value={`${window.location.origin}${result.registerUrl}`} />
              <CopyField label="Email del administrador" value={result.admin.email} />
              <CopyField label="Contraseña temporal" value={result.tempPassword} />
              <div className="flex justify-end pt-2 border-t border-border">
                <button
                  onClick={resetAndClose}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition"
                >
                  Listo
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nuevo Salón</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nombre del salón *</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                  }}
                  placeholder="Salón Carla"
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Identificador (URL) *</label>
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-muted-foreground shrink-0">tuapp.com/</span>
                  <input
                    required
                    type="text"
                    value={form.slug}
                    onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }}
                    placeholder="salon-carla"
                    className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Plan *</label>
                  <select
                    required
                    value={form.planId}
                    onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="" disabled>Selecciona un plan</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Ciclo de cobro</label>
                  <select
                    value={form.billingCycle}
                    onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value as 'MONTHLY' | 'YEARLY' }))}
                    className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="MONTHLY">Mensual</option>
                    <option value="YEARLY">Anual</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-3">Primer administrador del salón</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Nombre *</label>
                    <input
                      required
                      type="text"
                      value={form.adminName}
                      onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Email *</label>
                    <input
                      required
                      type="email"
                      value={form.adminEmail}
                      onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={resetAndClose} className="px-4 py-2 text-sm text-foreground bg-muted rounded-md hover:bg-muted transition">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createTenant.isPending}
                  className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition disabled:opacity-50"
                >
                  {createTenant.isPending ? 'Creando...' : 'Crear salón'}
                </button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewTenantDialog;
