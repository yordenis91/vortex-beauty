# Módulo de Citas

## Objetivos

El módulo de citas está diseñado para gestionar de manera eficiente las reservas de servicios en un salón de belleza. Sus principales objetivos incluyen:

- **Facilitar la programación de citas**: Permitir a los administradores agendar servicios para clientes de forma intuitiva y segura.
- **Optimizar la gestión de horarios**: Asegurar que las citas se programen dentro de los horarios comerciales definidos, evitando conflictos y maximizando la eficiencia operativa.
- **Mejorar la experiencia del cliente**: Proporcionar notificaciones automáticas sobre cambios en las citas y mantener un registro claro de todas las reservas.
- **Prevenir errores y conflictos**: Implementar validaciones robustas para evitar citas duplicadas, horarios inválidos o reservas en días cerrados.
- **Integrar con otros módulos**: Conectar con clientes, productos/servicios, horarios comerciales y sistema de notificaciones para una experiencia cohesiva.

## Características Principales

### Modelo de Datos

El módulo se basa en el modelo `Appointment` con las siguientes propiedades:

- **id**: Identificador único (UUID).
- **date**: Fecha exacta de la cita (DateTime).
- **startTime**: Hora de inicio en formato HH:mm (String).
- **endTime**: Hora de fin en formato HH:mm (String).
- **status**: Estado de la cita (SCHEDULED, COMPLETED, CANCELLED).
- **notes**: Notas adicionales (opcional, Text).
- **clientId**: ID del cliente (relación con Client).
- **productId**: ID del producto/servicio (relación con Product).
- **createdAt/updatedAt**: Timestamps automáticos.

### Estados de las Citas

- **SCHEDULED**: Cita programada y activa.
- **COMPLETED**: Cita completada exitosamente.
- **CANCELLED**: Cita cancelada.

### Funcionalidades del API

#### Endpoints Disponibles

- **GET /api/appointments**: Obtiene todas las citas (solo administradores).
- **GET /api/appointments/:id**: Obtiene una cita específica por ID.
- **POST /api/appointments**: Crea una nueva cita con validaciones completas.
- **PUT /api/appointments/:id**: Actualiza una cita existente.
- **DELETE /api/appointments/:id**: Elimina una cita del sistema.

#### Validaciones Implementadas

1. **Validación de Horarios Comerciales**:
   - Verifica que la fecha caiga en un día abierto según `BusinessHour`.
   - Si se configuran `timeSlots` explícitos, la hora de inicio debe coincidir con uno permitido.
   - Las horas deben estar dentro del rango de apertura del salón.

2. **Prevención de Conflictos**:
   - No permite citas en el mismo horario (startTime) si ya existe una programada.
   - Evita que un cliente tenga múltiples citas en el mismo día (opcional pero implementado).

3. **Integración con Fechas Cerradas**:
   - Verifica contra el modelo `ClosedDate` para fechas especiales cerradas.

4. **Límite de Citas Diarias**:
   - Respeta el `maxAppointments` configurado en `BusinessHour` (0 = sin límite).

### Sistema de Notificaciones

El módulo integra automáticamente notificaciones para mantener informados a administradores y clientes:

- **Creación de Cita**: Notificación al admin con detalles y al cliente confirmando la reserva.
- **Cancelación**: Alerta al cliente sobre la cancelación y notificación al admin.
- **Eliminación**: Notificación al cliente sobre la eliminación y al admin del cambio.

Las notificaciones se envían vía sistema interno, pudiendo expandirse a WhatsApp o email.

### Integraciones

- **Clientes (Client)**: Cada cita está vinculada a un cliente existente.
- **Productos/Servicios (Product)**: Define el tipo de servicio para la cita.
- **Horarios Comerciales (BusinessHour)**: Controla la disponibilidad horaria.
- **Fechas Cerradas (ClosedDate)**: Maneja excepciones como feriados.
- **Notificaciones (NotificationService)**: Envía alertas automáticas.

### Seguridad y Acceso

- Todas las operaciones requieren autenticación JWT.
- Solo usuarios con rol ADMIN pueden gestionar citas.
- Validaciones de entrada usando Zod para asegurar integridad de datos.

### Consideraciones Técnicas

- **Base de Datos**: PostgreSQL con Prisma ORM.
- **Backend**: Node.js con Express y TypeScript.
- **Validación**: Esquemas Zod para requests.
- **Índices**: Optimizados en clientId, productId, date y status para consultas eficientes.
- **Manejo de Errores**: Respuestas estructuradas con códigos HTTP apropiados y mensajes en español.

Este módulo proporciona una base sólida para la gestión de citas en entornos de servicios personales, con énfasis en la usabilidad, integridad de datos y automatización de procesos.</content>
<parameter name="filePath">/var/www/html/VortexBeauty/APPOINTMENTS_MODULE.md