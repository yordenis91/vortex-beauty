# Módulo de Usuarios, Clientes y Arquitectura RBAC

## Objetivos Generales

Los módulos de Usuarios y Clientes, junto con la arquitectura RBAC (Role-Based Access Control), están diseñados para proporcionar un sistema de gestión de usuarios robusto y seguro que separa claramente las responsabilidades entre administradores y clientes finales. Los objetivos principales incluyen:

- **Gestión Segura de Usuarios**: Proporcionar autenticación y autorización confiables con diferentes niveles de acceso.
- **Separación de Portales**: Mantener interfaces distintas y seguras para administradores y clientes.
- **Gestión Integral de Clientes**: Permitir a los administradores gestionar información detallada de clientes empresariales.
- **Control de Acceso Basado en Roles**: Implementar un sistema RBAC que prevenga accesos no autorizados y facilite la administración de permisos.
- **Escalabilidad y Mantenibilidad**: Crear una arquitectura modular que permita futuras expansiones y modificaciones.

## Módulo de Usuarios

### Objetivos Específicos

- **Autenticación Segura**: Proporcionar un sistema de login/registro con encriptación de contraseñas y tokens JWT.
- **Gestión de Perfiles**: Permitir a los usuarios gestionar su información personal y preferencias.
- **Asignación de Roles**: Vincular usuarios a roles específicos (ADMIN/CLIENT) para control de acceso.
- **Integración con Clientes**: Permitir que usuarios estén asociados a entidades cliente para acceso personalizado.

### Características Principales

#### Modelo de Datos (User)

- **id**: Identificador único (UUID).
- **email**: Correo electrónico único para autenticación.
- **username**: Nombre de usuario opcional único.
- **password**: Contraseña encriptada con bcrypt.
- **name**: Nombre completo del usuario.
- **role**: Rol del usuario (ADMIN o CLIENT).
- **clientId**: Referencia opcional a un cliente (para usuarios tipo CLIENT).
- **imageUrl**: Foto de perfil en Base64 (opcional).
- **createdAt/updatedAt**: Timestamps automáticos.

#### Funcionalidades de Autenticación

- **Registro**: Creación de nuevos usuarios con rol CLIENT por defecto.
- **Login**: Autenticación con email/contraseña y generación de JWT.
- **JWT Payload**: Incluye `userId`, `role` y `clientId` para autorización.
- **Middleware de Autenticación**: `authenticateToken` para validar tokens en rutas protegidas.

#### Relaciones

- **Proyectos**: Usuarios pueden crear y gestionar proyectos.
- **Clientes**: Administradores pueden gestionar múltiples clientes.
- **Facturas**: Vinculación con facturas creadas.
- **Productos/Suscripciones/Tickets**: Relaciones con módulos de HostBilling.
- **Cliente Asociado**: Para usuarios CLIENT, relación con entidad Client.

## Módulo de Clientes

### Objetivos Específicos

- **Gestión Empresarial**: Administrar información detallada de clientes comerciales.
- **Vinculación con Usuarios**: Permitir que clientes tengan usuarios asociados para acceso al portal.
- **Clasificación de Clientes**: Distinguir entre CUSTOMER y SUPPLIER.
- **Información Fiscal**: Almacenar datos necesarios para facturación (CIF/NIF/RUT, etc.).
- **Integración con Negocio**: Conectar clientes con proyectos, facturas y otros módulos.

### Características Principales

#### Modelo de Datos (Client)

- **id**: Identificador único (UUID).
- **name**: Nombre del cliente.
- **email**: Correo electrónico único.
- **code**: Código interno opcional.
- **displayName**: Nombre para mostrar opcional.
- **businessNumber**: Número de negocio.
- **type**: Tipo de cliente (CUSTOMER o SUPPLIER).
- **phone**: Teléfono de contacto.
- **company**: Nombre de la empresa.
- **address/city/state/zipCode/country**: Dirección completa.
- **secondaryEmail**: Correo secundario opcional.
- **currency**: Moneda por defecto (USD).
- **groupId/ownerId**: Identificadores de grupo y propietario.
- **taxId**: Identificación fiscal (CIF/NIF/RUT).
- **imageUrl**: Foto de perfil en Base64 (opcional).
- **userId**: Referencia al administrador que creó el cliente.
- **createdAt/updatedAt**: Timestamps automáticos.

#### Funcionalidades CRUD

- **Crear Cliente**: Con opción de crear usuario asociado automáticamente.
- **Leer Clientes**: Listado y detalle con proyectos e facturas relacionadas.
- **Actualizar Cliente**: Modificación de información con validaciones.
- **Eliminar Cliente**: Borrado en cascada con manejo de dependencias.

#### Creación de Usuario Asociado

Al crear un cliente, se puede opcionalmente crear un usuario con:
- Email del cliente.
- Username y password proporcionados.
- Rol CLIENT.
- Asociación automática al cliente creado.

#### Relaciones

- **Usuario Administrador**: Cliente creado por un admin específico.
- **Usuarios Asociados**: Múltiples usuarios pueden estar vinculados a un cliente.
- **Proyectos**: Clientes pueden tener múltiples proyectos.
- **Facturas**: Vinculación con facturas emitidas.
- **Suscripciones/Tickets**: Relaciones con módulos de HostBilling.
- **Citas**: Integración con sistema de appointments.

## Arquitectura RBAC (Role-Based Access Control)

### Objetivos Específicos

- **Separación de Interfaces**: Proporcionar portales distintos para administradores y clientes.
- **Control de Acceso Granular**: Restringir operaciones según roles de usuario.
- **Seguridad por Defecto**: Implementar principio de menor privilegio.
- **Experiencia Personalizada**: Adaptar la interfaz según el rol del usuario.
- **Mantenibilidad**: Facilitar la gestión de permisos y futuras expansiones.

### Características Principales

#### Roles Definidos

- **ADMIN**: Acceso completo a todas las funcionalidades de administración.
- **CLIENT**: Acceso limitado al portal cliente con datos propios.

#### Middleware de Autorización

- **authenticateToken**: Valida JWT y extrae información de usuario/rol.
- **requireAdmin**: Verifica que el usuario tenga rol ADMIN para rutas sensibles.

#### Enrutamiento Basado en Roles

##### Portal de Administrador (`/admin`)
- **Layout**: AdminLayout con sidebar completo.
- **Rutas Protegidas**: Dashboard, clientes, proyectos, facturas, productos, etc.
- **Acceso**: Solo usuarios con `role === 'ADMIN'`.

##### Portal de Cliente (`/portal`)
- **Layout**: ClientLayout con topbar minimalista.
- **Rutas Protegidas**: Mis facturas, mis suscripciones, mi perfil.
- **Acceso**: Solo usuarios con `role === 'CLIENT'`.

#### Componentes de Protección de Rutas

- **AdminRoute**: Redirige a `/portal` si el usuario es CLIENT.
- **ClientRoute**: Redirige a `/admin` si el usuario es ADMIN.
- **RootRedirect**: Envía automáticamente a `/admin` o `/portal` según rol.

#### Filtrado de Datos

- **Backend**: Rutas de admin filtran por `userId` del administrador.
- **Portal**: Rutas de cliente filtran por `clientId` del usuario.
- **Aislamiento**: Los clientes solo ven sus propios datos.

#### Flujo de Autenticación RBAC

1. **Registro/Login**: Usuario obtiene JWT con `role` y `clientId`.
2. **Frontend**: AuthContext distribuye rol globalmente.
3. **Enrutamiento**: RootRedirect envía al portal apropiado.
4. **Protección**: Routes validadas por AdminRoute/ClientRoute.
5. **API**: JWT incluye contexto para filtrado backend.

### Consideraciones de Seguridad

- **Principio de Menor Privilegio**: Usuarios solo acceden a lo necesario.
- **Validación en Backend**: Todas las operaciones verifican permisos.
- **Separación de Datos**: Aislamiento completo entre clientes.
- **Auditoría**: Posibilidad de tracking de acciones por rol.

### Escalabilidad

- **Roles Extensibles**: Fácil agregar nuevos roles al enum.
- **Permisos Granulares**: Base para implementar permisos específicos.
- **Módulos Independientes**: Arquitectura permite agregar nuevos módulos con RBAC.

Esta implementación proporciona una base sólida para un sistema multi-tenant con control de acceso robusto, facilitando la expansión y mantenimiento del sistema Vortex SaaS.</content>
<parameter name="filePath">/var/www/html/VortexBeauty/USERS_CLIENTS_RBAC_MODULE.md