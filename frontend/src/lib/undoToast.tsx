import toast from 'react-hot-toast';

/** Aviso con un botón «Deshacer». Se cierra solo; al pulsarlo ejecuta `onUndo`. */
export function toastUndo(message: string, onUndo: () => void, duration = 6000) {
  return toast.custom(
    (t) => (
      <div
        role="status"
        className={`flex max-w-[92vw] items-center gap-4 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-white shadow-lg transition ${t.visible ? 'opacity-100' : 'opacity-0'}`}
      >
        <span>{message}</span>
        <button
          type="button"
          className="rounded-md px-2 py-1 font-semibold text-blue-300 underline-offset-2 hover:underline"
          onClick={() => {
            toast.dismiss(t.id);
            onUndo();
          }}
        >
          Deshacer
        </button>
      </div>
    ),
    { duration }
  );
}
