import React, { useState } from 'react';
import { Plus, Trash2, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { useResources, useCreateResource, useUpdateResource, useDeleteResource } from '../hooks/useQueries';
import ConfirmModal from '../components/ConfirmModal';

const Resources: React.FC = () => {
  const { data: resources = [], isLoading } = useResources();
  const [name, setName] = useState('');
  const [toDelete, setToDelete] = useState<string | null>(null);
  const create = useCreateResource({ onSuccess: () => { toast.success('Recurso creado'); setName(''); } });
  const update = useUpdateResource();
  const remove = useDeleteResource({ onSuccess: () => toast.success('Recurso eliminado') });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Recursos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sillas, cabinas, camillas o salas. Un servicio que necesita recurso solo admite tantas citas a la vez como recursos libres haya.
          Asigna recursos a cada servicio desde la pantalla de Servicios.
        </p>
      </div>

      <form
        className="bg-card shadow rounded-lg p-4 flex flex-col sm:flex-row gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate({ name: name.trim() });
        }}
      >
        <input
          className="flex-1 px-3 py-2 border border-border rounded-lg bg-card"
          placeholder="Nombre (ej. Silla 1, Cabina 2)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="inline-flex items-center justify-center px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700">
          <Plus className="h-5 w-5 mr-2" /> Agregar
        </button>
      </form>

      <div className="bg-card shadow overflow-hidden sm:rounded-md">
        {isLoading ? (
          <div className="p-6 text-muted-foreground">Cargando...</div>
        ) : resources.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">
            <DoorOpen className="mx-auto h-12 w-12" />
            <p className="mt-2 text-sm">Sin recursos. Si tu negocio no usa sillas o cabinas, no necesitas crear ninguno.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {resources.map((r) => (
              <li key={r.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {r.name} {!r.isActive && <span className="text-xs text-muted-foreground">(inactivo)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{(r.serviceIds ?? []).length} servicios lo usan</div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={r.isActive} onChange={(e) => update.mutate({ id: r.id, data: { isActive: e.target.checked } })} />
                    Activo
                  </label>
                  <button onClick={() => setToDelete(r.id)} className="p-2 text-red-600 hover:bg-muted rounded-md" aria-label="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmModal
        isOpen={toDelete !== null}
        title="Eliminar recurso"
        message="¿Seguro que quieres eliminar este recurso?"
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete);
          setToDelete(null);
        }}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default Resources;
