import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { CalendarDays, Search, User } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { canManage, type Appointment, type Client } from '../types';

const MIN_CHARS = 2;

type Result =
  | { kind: 'client'; id: string; title: string; detail: string; to: string }
  | { kind: 'appointment'; id: string; title: string; detail: string; to: string };

/** Buscador de la barra superior: clientes (por nombre, teléfono o correo) y citas (por cliente o servicio). */
const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const manager = canManage(role);
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(text.trim()), 250);
    return () => window.clearTimeout(id);
  }, [text]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);

  const enabled = debounced.length >= MIN_CHARS;
  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced, manager],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const from = format(addDays(new Date(), -90), 'yyyy-MM-dd');
      const to = format(addDays(new Date(), 180), 'yyyy-MM-dd');
      const [clients, appointments] = await Promise.all([
        manager ? api.get<Client[]>('/clients', { params: { search: debounced } }).then((r) => r.data) : Promise.resolve([] as Client[]),
        api.get<Appointment[]>('/appointments', { params: { q: debounced, from, to } }).then((r) => r.data),
      ]);
      return { clients, appointments };
    },
  });

  const results = useMemo<Result[]>(() => {
    if (!data) return [];
    const today = format(new Date(), 'yyyy-MM-dd');
    const list: Result[] = data.clients.slice(0, 5).map((c) => ({
      kind: 'client',
      id: c.id,
      title: c.name,
      detail: [c.phone, c.email].filter(Boolean).join(' · ') || 'Sin contacto',
      to: `/admin/clients?buscar=${encodeURIComponent(c.name)}`,
    }));
    // Primero las citas que vienen; después, las pasadas, de la más reciente a la más antigua.
    const sorted = [...data.appointments].sort((a, b) => {
      const da = a.date.split('T')[0];
      const db = b.date.split('T')[0];
      const fa = da >= today;
      const fb = db >= today;
      if (fa !== fb) return fa ? -1 : 1;
      return fa ? (da + a.startTime).localeCompare(db + b.startTime) : (db + b.startTime).localeCompare(da + a.startTime);
    });
    for (const a of sorted.slice(0, 6)) {
      const day = a.date.split('T')[0];
      list.push({
        kind: 'appointment',
        id: a.id,
        title: `${a.client?.name ?? 'Cliente'} · ${a.serviceName}`,
        detail: `${format(new Date(`${day}T00:00:00`), "EEE d 'de' MMM", { locale: es })}, ${a.startTime}`,
        to: `/admin/appointments?fecha=${day}&cita=${a.id}`,
      });
    }
    return list;
  }, [data]);

  const go = (r: Result) => {
    setOpen(false);
    setText('');
    setDebounced('');
    navigate(r.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.max(0, Math.min(results.length - 1, i + 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  const showPanel = open && text.trim().length >= MIN_CHARS;
  const clients = results.filter((r) => r.kind === 'client');
  const appointments = results.filter((r) => r.kind === 'appointment');

  const section = (title: string, items: Result[]) =>
    items.length > 0 && (
      <div role="group" aria-label={title}>
        <div className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
        {items.map((r) => {
          const index = results.indexOf(r);
          return (
            <button
              key={`${r.kind}-${r.id}`}
              type="button"
              role="option"
              aria-selected={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(r)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${index === active ? 'bg-muted' : ''}`}
            >
              {r.kind === 'client' ? <User className="h-4 w-4 shrink-0 text-muted-foreground" /> : <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    );

  return (
    <div ref={box} className="relative w-full min-w-0 text-muted-foreground">
      <label htmlFor="search-field" className="sr-only">
        Buscar cliente o cita
      </label>
      <Search className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2" aria-hidden="true" />
      <input
        id="search-field"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="resultados-busqueda"
        aria-autocomplete="list"
        autoComplete="off"
        className="block h-10 w-full border-0 bg-transparent py-2 pl-8 pr-3 text-foreground placeholder:text-muted-foreground focus:outline-none sm:text-sm"
        placeholder={manager ? 'Buscar…' : 'Buscar cita…'}
        type="text"
        enterKeyHint="search"
        name="search"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showPanel && (
        <div
          id="resultados-busqueda"
          role="listbox"
          aria-label="Resultados de la búsqueda"
          className="fixed inset-x-4 top-16 z-30 mt-1 max-h-[70vh] sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:w-[26rem] overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{isFetching || debounced !== text.trim() ? 'Buscando…' : 'No encontré nada con ese texto.'}</p>
          ) : (
            <>
              {section('Clientes', clients)}
              {section('Citas', appointments)}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
