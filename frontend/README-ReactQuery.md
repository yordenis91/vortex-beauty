# React Query Integration

Este proyecto ahora usa **TanStack React Query** para manejar todas las peticiones HTTP de manera eficiente y con cache inteligente.

## Configuración

React Query está configurado en `App.tsx` con las siguientes opciones por defecto:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      gcTime: 1000 * 60 * 10, // 10 minutos
      retry: (failureCount, error) => {
        // No reintentar en errores 4xx
        if (error instanceof Error && 'status' in error && typeof error.status === 'number') {
          return error.status >= 500 && failureCount < 3;
        }
        return failureCount < 3;
      },
    },
  },
});
```

## Hooks Personalizados

Usa los hooks personalizados en `src/hooks/useQueries.ts` para mantener consistencia:

### Queries
```typescript
import { useClients, useProjects, useInvoices } from '../hooks/useQueries';

const MyComponent = () => {
  const { data: clients, isLoading, error } = useClients();
  const { data: projects } = useProjects();
  const { data: invoices } = useInvoices();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Tu JSX */}</div>;
};
```

### Mutations
```typescript
import { useCreateClient } from '../hooks/useQueries';

const MyComponent = () => {
  const createClient = useCreateClient();

  const handleSubmit = async (clientData) => {
    try {
      await createClient.mutateAsync(clientData);
      // El cache se invalida automáticamente
    } catch (error) {
      console.error('Error creating client:', error);
    }
  };

  return (
    <button
      onClick={() => handleSubmit({ name: 'John', email: 'john@example.com' })}
      disabled={createClient.isPending}
    >
      {createClient.isPending ? 'Creating...' : 'Create Client'}
    </button>
  );
};
```

## Beneficios

1. **Cache Inteligente**: Las peticiones se cachean automáticamente
2. **Sincronización**: Múltiples componentes pueden usar la misma data sin duplicar peticiones
3. **Invalidación Automática**: Las mutations invalidan el cache automáticamente
4. **Estados de Loading/Error**: Manejo automático de estados de carga y error
5. **Reintentos**: Reintentos automáticos en caso de fallos de red
6. **DevTools**: React Query DevTools para debugging en desarrollo

## DevTools

Los React Query DevTools están habilitados en desarrollo. Presiona `F12` y busca la pestaña "React Query" para inspeccionar el estado del cache.

## Migración de Componentes

Para migrar un componente que usa `useEffect` y `useState`:

**Antes:**
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  api.get('/endpoint').then(response => {
    setData(response.data);
    setLoading(false);
  });
}, []);
```

**Después:**
```typescript
const { data = [], isLoading: loading } = useQuery({
  queryKey: ['endpoint'],
  queryFn: async () => {
    const response = await api.get('/endpoint');
    return response.data;
  },
});
```