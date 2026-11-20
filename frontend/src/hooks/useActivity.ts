import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import api from '../lib/api';

export type ActivityKind = 'CREATED' | 'RESCHEDULED' | 'CANCELLED';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  appointmentId: string | null;
  /** Quién lo provocó: la clienta, alguien del salón o el sistema. */
  actor: 'CUSTOMER' | 'STAFF' | 'SYSTEM';
  source: 'ADMIN' | 'PORTAL' | 'PUBLIC' | 'PAPEL';
  clientName: string;
  serviceName: string;
  professionalName: string | null;
  startsAt: string;
  previousStartsAt: string | null;
  createdAt: string;
  unread: boolean;
}

export interface ActivityPage {
  items: ActivityItem[];
  unread: number;
  nextCursor: string | null;
}

const KEY = ['activity'] as const;

/**
 * Novedades de reservas (nueva, cambio, cancelación) para la campanita del panel.
 * Se actualiza sola cada 30 s mientras la pestaña está a la vista, y al volver a ella.
 */
export const useActivityFeed = () =>
  useInfiniteQuery({
    queryKey: KEY,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => (await api.get<ActivityPage>('/activity', { params: { limit: 20, before: pageParam } })).data,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
  });

/** Marca como vistas las novedades hasta `upTo` (la más reciente que se mostró). */
export const useMarkActivitySeen = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (upTo?: string) => (await api.post('/activity/seen', upTo ? { upTo } : {})).data,
    onMutate: () => {
      // La campanita se apaga al instante; el servidor confirma en la siguiente consulta.
      queryClient.setQueryData<InfiniteData<ActivityPage>>(KEY, (data) =>
        data && {
          ...data,
          pages: data.pages.map((page, i) => ({ ...page, unread: i === 0 ? 0 : page.unread, items: page.items.map((e) => ({ ...e, unread: false })) })),
        },
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
};
