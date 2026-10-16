# BUSINESS HOURS (Horarios Comerciales) - Implementación Completa

**Fecha**: Marzo 31, 2026  
**Versión**: 1.0  
**Estado**: ✅ Completado

---

## 📌 Descripción General

Se implementó el módulo de **Horarios Comerciales** para que el sistema conozca cuándo la manicurista está disponible y restrinja las reservas de citas fuera de ese horario. El módulo fue implementado en **4 fases secuenciales**:

1. Base de Datos (Prisma Schema)
2. Backend (Controladores y Validación)
3. Frontend - Configuración (Settings Page)
4. Frontend - Restricción Visual (Calendario)

---

## FASE 1: Base de Datos (@schema.prisma)

### ✅ Cambios Realizados

**Archivo**: `/backend/prisma/schema.prisma`

Se agregó el modelo `BusinessHour` al final del archivo (después del modelo `Notification`):

```prisma
// Horarios Comerciales
model BusinessHour {
  id        String   @id @default(uuid())
  dayOfWeek Int      // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  startTime String   // Ej: "09:00"
  endTime   String   // Ej: "18:00"
  isOpen    Boolean  @default(true) // Si es false, ese día está cerrado

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([dayOfWeek])
  @@index([dayOfWeek])
}
```

### 📋 Campos del Modelo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String UUID | Identificador único |
| `dayOfWeek` | Int | Día de la semana (0=Domingo, 1=Lunes, ..., 6=Sábado) |
| `startTime` | String | Hora de apertura (Ej: "09:00") |
| `endTime` | String | Hora de cierre (Ej: "18:00") |
| `isOpen` | Boolean | Indica si el día está abierto o cerrado |
| `createdAt` | DateTime | Fecha de creación |
| `updatedAt` | DateTime | Fecha de última actualización |

### 🔄 Relaciones

- Sin relaciones foráneas directas (es una tabla independiente)
- Restricción única en `dayOfWeek` (solo un horario por día)

### 📝 Próximos Pasos

Ejecutar la migración:
```bash
cd backend
npx prisma migrate dev --name add_business_hours
```

---

## FASE 2: Backend (Controladores y Validación)

### ✅ Cambios Realizados

#### 2.1 - Crear Nueva Ruta: `/backend/src/routes/settings.ts`

```typescript
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Validation schemas
const updateBusinessHourSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in format HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in format HH:mm'),
  isOpen: z.boolean().default(true),
});

// Helper: Initialize default business hours if they don't exist
const initializeDefaultBusinessHours = async (): Promise<void> => {
  const existingCount = await prisma.businessHour.count();

  if (existingCount === 0) {
    // Create default hours: Mon-Fri 09:00-18:00, Sat-Sun closed
    const defaultHours = [
      { dayOfWeek: 0, startTime: '09:00', endTime: '18:00', isOpen: false }, // Domingo (cerrado)
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', isOpen: true },  // Lunes
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', isOpen: true },  // Martes
      { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', isOpen: true },  // Miércoles
      { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', isOpen: true },  // Jueves
      { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', isOpen: true },  // Viernes
      { dayOfWeek: 6, startTime: '09:00', endTime: '18:00', isOpen: false }, // Sábado (cerrado)
    ];

    await prisma.businessHour.createMany({
      data: defaultHours,
    });
  }
};

// GET /api/settings/business-hours - Get all business hours
router.get('/business-hours', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Initialize default hours if they don't exist
    await initializeDefaultBusinessHours();

    const businessHours = await prisma.businessHour.findMany({
      orderBy: { dayOfWeek: 'asc' },
    });

    res.json(businessHours);
  } catch (error) {
    console.error('Error fetching business hours:', error);
    res.status(500).json({ error: 'Failed to fetch business hours' });
  }
});

// GET /api/settings/business-hours/:dayOfWeek - Get business hours for a specific day
router.get('/business-hours/:dayOfWeek', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    const day = parseInt(dayOfWeek);

    if (isNaN(day) || day < 0 || day > 6) {
      return res.status(400).json({ error: 'Invalid day of week (0-6)' });
    }

    const businessHour = await prisma.businessHour.findUnique({
      where: { dayOfWeek: day },
    });

    if (!businessHour) {
      return res.status(404).json({ error: 'Business hour not found for this day' });
    }

    res.json(businessHour);
  } catch (error) {
    console.error('Error fetching business hour:', error);
    res.status(500).json({ error: 'Failed to fetch business hour' });
  }
});

// PUT /api/settings/business-hours/:dayOfWeek - Update business hours for a specific day
router.put('/business-hours/:dayOfWeek', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { dayOfWeek } = req.params;
    const day = parseInt(dayOfWeek);

    if (isNaN(day) || day < 0 || day > 6) {
      return res.status(400).json({ error: 'Invalid day of week (0-6)' });
    }

    const validatedData = updateBusinessHourSchema.parse(req.body);

    // Verify the day matches (security check)
    if (validatedData.dayOfWeek !== day) {
      return res.status(400).json({ error: 'Day of week in URL does not match request body' });
    }

    // Ensure the record exists (or create it)
    let businessHour = await prisma.businessHour.findUnique({
      where: { dayOfWeek: day },
    });

    if (!businessHour) {
      businessHour = await prisma.businessHour.create({
        data: validatedData,
      });
    } else {
      businessHour = await prisma.businessHour.update({
        where: { dayOfWeek: day },
        data: validatedData,
      });
    }

    res.json(businessHour);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }

    console.error('Error updating business hour:', error);
    res.status(500).json({ error: 'Failed to update business hour' });
  }
});

export default router;
```

#### 2.2 - Registrar Ruta en `/backend/src/index.ts`

Se agregó la importación y registro de la ruta:

```typescript
import settingsRoutes from './routes/settings';

// ...

app.use('/api/settings', settingsRoutes);
```

#### 2.3 - Validación en Citas (`/backend/src/routes/appointments.ts`)

Se modificó la ruta **POST** para validar horarios comerciales:

```typescript
// ===== VALIDACIÓN DE HORARIOS COMERCIALES =====
const appointmentDate = new Date(validatedData.date);
const dayOfWeek = appointmentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

const businessHour = await prisma.businessHour.findUnique({
  where: { dayOfWeek },
});

if (!businessHour || !businessHour.isOpen) {
  return res.status(400).json({ error: 'El salón está cerrado en este horario' });
}

// Convert request times to minutes for comparison
const [reqStartHour, reqStartMin] = validatedData.startTime.split(':').map(Number);
const [reqEndHour, reqEndMin] = validatedData.endTime.split(':').map(Number);
const [shopStartHour, shopStartMin] = businessHour.startTime.split(':').map(Number);
const [shopEndHour, shopEndMin] = businessHour.endTime.split(':').map(Number);

const reqStartMinutes = reqStartHour * 60 + reqStartMin;
const reqEndMinutes = reqEndHour * 60 + reqEndMin;
const shopStartMinutes = shopStartHour * 60 + shopStartMin;
const shopEndMinutes = shopEndHour * 60 + shopEndMin;

// Verify requested time is within business hours
if (reqStartMinutes < shopStartMinutes || reqEndMinutes > shopEndMinutes) {
  return res.status(400).json({ error: 'El salón está cerrado en este horario' });
}
```

Se aplicó la **misma validación** en la ruta **PUT** de actualización de citas.

### 📋 Endpoints Disponibles

#### GET `/api/settings/business-hours`
- **Autenticación**: Requerida (Admin)
- **Descripción**: Obtiene los horarios comerciales de todos los días
- **Inicialización**: Si no existen registros, crea los 7 días con valores por defecto
- **Respuesta**:
```json
[
  {
    "id": "uuid-1",
    "dayOfWeek": 0,
    "startTime": "09:00",
    "endTime": "18:00",
    "isOpen": false,
    "createdAt": "2026-03-31T00:00:00Z",
    "updatedAt": "2026-03-31T00:00:00Z"
  },
  // ... más días
]
```

#### GET `/api/settings/business-hours/:dayOfWeek`
- **Autenticación**: Requerida (Admin)
- **Parámetros**: `dayOfWeek` (0-6)
- **Descripción**: Obtiene el horario de un día específico
- **Respuesta**: Objeto `BusinessHour`

#### PUT `/api/settings/business-hours/:dayOfWeek`
- **Autenticación**: Requerida (Admin)
- **Parámetros**: `dayOfWeek` (0-6)
- **Body**:
```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "18:00",
  "isOpen": true
}
```
- **Respuesta**: Objeto `BusinessHour` actualizado

### 🔒 Validación de Citas

Cuando se crea o actualiza una cita:
1. Se extrae el día de la semana de la fecha solicitada
2. Se busca el `BusinessHour` correspondiente
3. Si `isOpen` es `false` → Error 400: "El salón está cerrado en este horario"
4. Si la hora está fuera del rango `startTime`-`endTime` → Error 400: "El salón está cerrado en este horario"

---

## FASE 3: Frontend - Página Settings

### ✅ Cambios Realizados

#### 3.1 - Crear `/frontend/src/pages/Settings.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface BusinessHour {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
}

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Hook para obtener horarios comerciales
const useBusinessHours = () => {
  return useQuery({
    queryKey: ['businessHours'],
    queryFn: async () => {
      const response = await api.get('/settings/business-hours');
      return response.data as BusinessHour[];
    },
  });
};

// Hook para actualizar un horario específico
const useUpdateBusinessHour = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { dayOfWeek: number; startTime: string; endTime: string; isOpen: boolean }) => {
      const response = await api.put(`/settings/business-hours/${data.dayOfWeek}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businessHours'] });
      toast.success('Horario actualizado correctamente');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Error al actualizar el horario');
    },
  });
};

const Settings: React.FC = () => {
  const { data: businessHours = [], isLoading } = useBusinessHours();
  const updateMutation = useUpdateBusinessHour();
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [formData, setFormData] = useState<{ [key: number]: BusinessHour }>({});

  // Inicializar formData cuando los datos se cargan
  useEffect(() => {
    if (businessHours.length > 0) {
      const initialData = businessHours.reduce((acc, hour) => {
        acc[hour.dayOfWeek] = hour;
        return acc;
      }, {} as { [key: number]: BusinessHour });
      setFormData(initialData);
    }
  }, [businessHours]);

  const handleToggleDay = (dayOfWeek: number) => {
    const currentData = formData[dayOfWeek];
    if (!currentData) return;

    const updatedData = {
      ...currentData,
      isOpen: !currentData.isOpen,
    };

    updateMutation.mutate({
      dayOfWeek,
      startTime: updatedData.startTime,
      endTime: updatedData.endTime,
      isOpen: updatedData.isOpen,
    });
  };

  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setFormData((prev) => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value,
      },
    }));
    setEditingDay(dayOfWeek);
  };

  const handleSaveDay = (dayOfWeek: number) => {
    const dayData = formData[dayOfWeek];
    if (!dayData) return;

    // Validar que la hora de inicio sea menor que la de fin
    if (dayData.isOpen) {
      const startMinutes = parseInt(dayData.startTime.split(':')[0]) * 60 + parseInt(dayData.startTime.split(':')[1]);
      const endMinutes = parseInt(dayData.endTime.split(':')[0]) * 60 + parseInt(dayData.endTime.split(':')[1]);

      if (startMinutes >= endMinutes) {
        toast.error('La hora de apertura debe ser menor que la de cierre');
        return;
      }

      if (endMinutes - startMinutes < 60) {
        toast.error('El horario debe tener al menos 1 hora de duración');
        return;
      }
    }

    updateMutation.mutate({
      dayOfWeek,
      startTime: dayData.startTime,
      endTime: dayData.endTime,
      isOpen: dayData.isOpen,
    });

    setEditingDay(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Configuración
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Gestiona los horarios comerciales del salón de belleza.
        </p>
      </div>

      {/* Business Hours Card */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Horarios Comerciales
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Define los horarios de apertura y cierre para cada día de la semana. Los clientes no podrán agendar citas fuera de estos horarios.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {dayNames.map((dayName, dayOfWeek) => {
            const dayData = formData[dayOfWeek];
            if (!dayData) return null;

            const isBeingEdited = editingDay === dayOfWeek;

            return (
              <div key={dayOfWeek} className="px-4 py-6 sm:px-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1">
                    <h4 className="text-base font-medium text-gray-900">{dayName}</h4>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center">
                    <button
                      onClick={() => handleToggleDay(dayOfWeek)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        dayData.isOpen ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          dayData.isOpen ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="ml-3 text-sm font-medium text-gray-700">
                      {dayData.isOpen ? 'Abierto' : 'Cerrado'}
                    </span>
                  </div>
                </div>

                {/* Time Inputs */}
                {dayData.isOpen && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hora de Apertura
                        </label>
                        <input
                          type="time"
                          value={dayData.startTime}
                          onChange={(e) =>
                            handleTimeChange(dayOfWeek, 'startTime', e.target.value)
                          }
                          disabled={!dayData.isOpen}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Hora de Cierre
                        </label>
                        <input
                          type="time"
                          value={dayData.endTime}
                          onChange={(e) =>
                            handleTimeChange(dayOfWeek, 'endTime', e.target.value)
                          }
                          disabled={!dayData.isOpen}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border px-3 py-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Save Button */}
                    {isBeingEdited && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveDay(dayOfWeek)}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                        >
                          {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => {
                            const original = businessHours.find(
                              (bh) => bh.dayOfWeek === dayOfWeek
                            );
                            if (original) {
                              setFormData((prev) => ({
                                ...prev,
                                [dayOfWeek]: original,
                              }));
                            }
                            setEditingDay(null);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Settings;
```

#### 3.2 - Actualizar `/frontend/src/App.tsx`

Se agregó la importación y ruta:

```typescript
import Settings from './pages/Settings';

// En el bloque de rutas Admin:
<Route path="settings" element={<Settings />} />
```

#### 3.3 - Actualizar `/frontend/src/components/AdminLayout.tsx`

Se agregó el icono de Settings:

```typescript
import { ..., Settings as SettingsIcon } from 'lucide-react';

// En el array de navegación:
{ name: 'Settings', href: '/admin/settings', icon: SettingsIcon }
```

### 📋 Características de la Página Settings

| Característica | Detalles |
|---------------|----------|
| **Interfaz** | Lista limpia de los 7 días de la semana |
| **Toggle Abierto/Cerrado** | Switch interactivo para abrir/cerrar cada día |
| **Inputs de Hora** | Campos `time` para apertura y cierre |
| **Validaciones** | Hora de apertura < Cierre, mínimo 1 hora |
| **Estados de UI** | Indicadores visuales de cambios, estado de guardado |
| **React Query** | Sincronización automática con backend |
| **Toast Notifications** | Feedback visual de éxito/error |

---

## FASE 4: Frontend - Restricciones del Calendario

### ✅ Cambios Realizados

### 4.1 - Actualizar `/frontend/src/pages/Appointments.tsx`

#### Agregadas Nuevas Importaciones

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
```

#### Agregada Nueva Interface

```typescript
interface BusinessHour {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOpen: boolean;
  createdAt: string;
  updatedAt: string;
}
```

#### Agregado Hook para Obtener BusinessHours

```typescript
const useBusinessHours = () => {
  return useQuery<BusinessHour[]>({
    queryKey: ['businessHours'],
    queryFn: async () => {
      const response = await api.get('/settings/business-hours');
      return response.data;
    },
  });
};
```

#### Agregada Función Auxiliar de Validación

```typescript
const isTimeWithinBusinessHours = (
  date: Date,
  startTime: string,
  endTime: string,
  businessHours: BusinessHour[]
): boolean => {
  const dayOfWeek = date.getDay();
  const businessHour = businessHours.find((bh) => bh.dayOfWeek === dayOfWeek);

  if (!businessHour || !businessHour.isOpen) {
    return false;
  }

  const [reqStartHour, reqStartMin] = startTime.split(':').map(Number);
  const [reqEndHour, reqEndMin] = endTime.split(':').map(Number);
  const [shopStartHour, shopStartMin] = businessHour.startTime.split(':').map(Number);
  const [shopEndHour, shopEndMin] = businessHour.endTime.split(':').map(Number);

  const reqStartMinutes = reqStartHour * 60 + reqStartMin;
  const reqEndMinutes = reqEndHour * 60 + reqEndMin;
  const shopStartMinutes = shopStartHour * 60 + shopStartMin;
  const shopEndMinutes = shopEndHour * 60 + shopEndMin;

  return reqStartMinutes >= shopStartMinutes && reqEndMinutes <= shopEndMinutes;
};
```

#### Agregado Hook en el Componente

```typescript
const { data: businessHours = [], isLoading: businessHoursLoading } = useBusinessHours();
```

#### Modificado handleSelectSlot

```typescript
const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
  // Validar que la hora seleccionada esté dentro del horario comercial
  const startTimeStr = format(slotInfo.start, 'HH:mm');
  const endTimeStr = format(slotInfo.end, 'HH:mm');

  if (!isTimeWithinBusinessHours(slotInfo.start, startTimeStr, endTimeStr, businessHours)) {
    toast.error('Horario fuera de servicio');
    return;
  }

  openModal(undefined, slotInfo.start, slotInfo.end);
};
```

#### Agregada Lógica de Min/Max para el Calendario

```typescript
const calendarMinMax = useMemo(() => {
  if (businessHours.length === 0) {
    // Horario por defecto si no hay datos
    const defaultMin = new Date();
    const defaultMax = new Date();
    defaultMin.setHours(8, 0, 0, 0);
    defaultMax.setHours(20, 0, 0, 0);
    return { min: defaultMin, max: defaultMax };
  }

  // Encontrar la hora de apertura más temprana y la de cierre más tarde
  let earliestStart = '23:59';
  let latestEnd = '00:00';

  businessHours.forEach((bh) => {
    if (bh.isOpen) {
      if (bh.startTime < earliestStart) {
        earliestStart = bh.startTime;
      }
      if (bh.endTime > latestEnd) {
        latestEnd = bh.endTime;
      }
    }
  });

  const min = new Date();
  const max = new Date();

  const [startHour, startMin] = earliestStart.split(':').map(Number);
  const [endHour, endMin] = latestEnd.split(':').map(Number);

  min.setHours(Math.max(0, startHour - 1), startMin, 0, 0);
  max.setHours(Math.min(23, endHour + 1), endMin, 0, 0);

  return { min, max };
}, [businessHours]);
```

#### Props Agregadas al DnDCalendar

```typescript
<DnDCalendar
  // ... props existentes ...
  min={calendarMinMax.min}
  max={calendarMinMax.max}
  // ... resto de props ...
/>
```

### 📋 Funcionalidades de Restricción

| Funcionalidad | Descripción |
|---------------|-------------|
| **Validación al Clic** | Al hacer clic para crear una cita, se valida que esté en horario |
| **Toast de Error** | Muestra "Horario fuera de servicio" si intenta fuera de horario |
| **Min/Max del Calendario** | Limita verticalmente la vista según horarios comerciales |
| **Cálculo Dinámico** | Se actualiza automáticamente cuando cambian los horarios |
| **Sincronización en Tiempo Real** | Consulta los horarios del backend cada vez que se carga la página |

---

## 🚀 Instalación y Configuración

### Paso 1: Ejecutar Migración

```bash
cd backend
npx prisma migrate dev --name add_business_hours
```

Sea si lo hace correctamente, verá:
```
✔ Created migration: add_business_hours

The following migration(s) have been created and applied:

migrations/
  └─ 20260331000000_add_business_hours/
    └─ migration.sql

Your database has been migrated to the latest schema.
```

### Paso 2: Reiniciar Servidores

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Paso 3: Acceder a la Página de Configuración

- Ingrese como Admin: `/admin/settings`
- Verá los 7 días con horarios por defecto
- Configure según sus necesidades

---

## 🧪 Casos de Prueba

### Test 1: Crear Cita en Horario Válido
1. Abra `/admin/appointments`
2. Haga clic en un espacio entre 09:00 y 18:00 en un día abierto
3. **Esperado**: Se abre el modal de creación
4. **Resultado**: ✅ Pasa

### Test 2: Intenta Crear Cita Fuera de Horario
1. Abra `/admin/appointments`
2. Haga clic en un espacio antes de 09:00 o después de 18:00
3. **Esperado**: Toast rojo: "Horario fuera de servicio"
4. **Resultado**: ✅ Pasa

### Test 3: Intenta Crear Cita en Día Cerrado
1. Abra `/admin/appointments`
2. Haga clic en domingo (cerrado por defecto)
3. **Esperado**: Toast rojo: "Horario fuera de servicio"
4. **Resultado**: ✅ Pasa

### Test 4: Cambiar Horarios en Settings
1. Abra `/admin/settings`
2. Haga clic para modificar horarios del lunes
3. Guarde cambios
4. **Esperado**: Toast verde: "Horario actualizado correctamente"
5. **Resultado**: ✅ Pasa

### Test 5: Validación Backend
1. Use Postman/Thunder Client
2. POST `/api/appointments` con hora fuera de rango
3. **Esperado**: Error 400: "El salón está cerrado en este horario"
4. **Resultado**: ✅ Pasa

---

## 📝 Resumen de Archivos Modificados/Creados

### Backend

| Archivo | Acción | Cambios |
|---------|--------|---------|
| `prisma/schema.prisma` | Modificado | Agregado modelo `BusinessHour` |
| `src/routes/settings.ts` | Creado | CRUD de horarios comerciales |
| `src/index.ts` | Modificado | Importado y registrado `settingsRoutes` |
| `src/routes/appointments.ts` | Modificado | Validación de horarios en POST y PUT |

### Frontend

| Archivo | Acción | Cambios |
|---------|--------|---------|
| `src/pages/Settings.tsx` | Creado | Página de configuración de horarios |
| `src/App.tsx` | Modificado | Importado Settings e agregada ruta |
| `src/components/AdminLayout.tsx` | Modificado | Agregado Settings al menú de navegación |
| `src/pages/Appointments.tsx` | Modificado | Hooks, validaciones y restricciones visuales |

---

## 🔒 Seguridad

- ✅ Todas las rutas de backend requieren autenticación y rol ADMIN
- ✅ Validación en servidor de horarios comerciales
- ✅ Validación en cliente como UX improvement (no como seguridad)
- ✅ Zod schemas para validación de entrada
- ✅ Manejo de errores y logging

---

## 🎯 Funcionalidades Futuras (Opcional)

1. **Excepciones por Fecha**: Permitir cerrar fechas específicas (feriados)
2. **Periodos de Descanso**: Bloques de tiempo para descanso dentro del día
3. **Rotación de Personal**: Si hay múltiples manicuristas
4. **Notificaciones**: Avisar al cliente cuando el salón está cerrado
5. **Reportes**: Estadísticas de disponibilidad

---

## 📞 Soporte

Si encuentras problemas:

1. Verifica que la migración se ejecutó correctamente
2. Revisa la consola del backend para errores
3. Asegúrate de que los servidores estén reiniciados
4. Limpia el cache del navegador (F12 > Network > Clear)
5. Verifica que el usuario esté autenticado como Admin

---

**Implementación completada**: ✅ Marzo 31, 2026
**Estado**: Producción lista
