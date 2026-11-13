import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ImportableContact } from '../lib/contacts';
import { useImportClients } from '../hooks/useQueries';
import toast from 'react-hot-toast';

interface Props {
  contacts: ImportableContact[];
  onClose: () => void;
}

const MAX = 500;

/** Lista los contactos leídos para que se marquen los que se quieren importar. */
export default function ImportContactsDialog({ contacts, onClose }: Props) {
  // Se monta solo mientras hay contactos que revisar: el estado inicial parte con todos marcados.
  const [selected, setSelected] = useState<Set<number>>(() => new Set(contacts.slice(0, MAX).map((_, i) => i)));
  const [search, setSearch] = useState('');
  const importMutation = useImportClients();

  const term = search.trim().toLowerCase();
  const visible = contacts
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !term || c.name.toLowerCase().includes(term) || (c.phone ?? '').includes(term) || (c.email ?? '').toLowerCase().includes(term));

  const toggle = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else if (next.size < MAX) next.add(i);
      return next;
    });
  const allVisibleSelected = visible.length > 0 && visible.every(({ i }) => selected.has(i));
  const toggleVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const { i } of visible) {
        if (allVisibleSelected) next.delete(i);
        else if (next.size < MAX) next.add(i);
      }
      return next;
    });

  const submit = async () => {
    const chosen = contacts.filter((_, i) => selected.has(i));
    try {
      const result = await importMutation.mutateAsync(chosen);
      const skipped = result.skipped.length;
      toast.success(
        `${result.created} ${result.created === 1 ? 'importado' : 'importados'}` +
          (skipped ? `; ${skipped} ${skipped === 1 ? 'omitido' : 'omitidos'} (ya existían o sin teléfono/correo)` : '')
      );
      onClose();
    } catch {
      // el aviso de error ya lo muestra el hook
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar contactos</DialogTitle>
        </DialogHeader>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en los contactos..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} />
          Seleccionar todos ({visible.length})
        </label>
        <ul className="max-h-72 overflow-y-auto divide-y divide-border rounded-md border border-border">
          {visible.map(({ c, i }) => (
            <li key={i}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted">
                <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} aria-label={c.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(' · ')}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {contacts.length > MAX && <p className="text-xs text-muted-foreground">Se pueden importar hasta {MAX} contactos a la vez.</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={selected.size === 0 || importMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {importMutation.isPending ? 'Importando...' : `Importar ${selected.size}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
