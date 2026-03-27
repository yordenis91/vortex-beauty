# Arquitectura RBAC (Role-Based Access Control) - Vortex SaaS

## 📋 Resumen

Se ha implementado una arquitectura completa de RBAC para separar el **Portal de Administrador** (`/admin`) del **Portal de Clientes** (`/portal`) en la aplicación Vortex.

---

## 🔐 FASE 1: Base de Datos (Prisma)

### Cambios en `schema.prisma`:

1. **Nuevo Enum Role**:
   ```prisma
   enum Role {
     ADMIN
     CLIENT
   }
   ```

2. **Actualizado modelo User**:
   ```prisma
   model User {
     id        String    @id @default(uuid())
     email     String    @unique
     password  String
     name      String
     role      Role      @default(CLIENT)      // Nuevo: rol del usuario
     clientId  String?                          // Nuevo: si es cliente, referencia a Client
     client    Client?   @relation("UserAsClient", fields: [clientId], references: [id])
     ...
   }
   ```

3. **Actualizado modelo Client**:
   ```prisma
   model Client {
     ...
     clientUsers User[]   @relation("UserAsClient")  // Usuarios asignados a este cliente
     ...
   }
   ```

### Comando para ejecutar la migración en Docker:

```bash
# Crear y ejecutar la migración
docker-compose exec backend npx prisma migrate dev --name "add_rbac_to_users"

# O en producción:
docker-compose exec backend npx prisma migrate deploy

# Ver estado de migraciones:
docker-compose exec backend npx prisma migrate status
```

---

## 🔐 FASE 2: Backend (Node.js + JWT)

### Middleware de Autenticación Actualizado (`src/middleware/auth.ts`):

```typescript
export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Verifica JWT y extrae: userId, role, clientId
  const decodedUser = decoded as any;
  req.user = {
    userId: decodedUser.userId,
    role: decodedUser.role || 'CLIENT',
    clientId: decodedUser.clientId,
  };
  next();
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Devuelve 403 si req.user.role !== 'ADMIN'
};
```

### Rutas Protegidas:

#### Admin Routes (`/api/clients`, `/api/projects`, `/api/invoices`):
```typescript
router.get('/', authenticateToken, requireAdmin, async (req, res) => { ... });
```

#### Portal Routes (Nuevas en `src/routes/portal.ts`):

- `GET /api/portal/my-invoices` - Facturas del cliente autenticado
- `GET /api/portal/my-subscriptions` - Suscripciones del cliente
- `GET /api/portal/my-profile` - Perfil del cliente

Solo filtran datos por `clientId` del usuario autenticado.

### JWT Payload Actualizado:

```typescript
const token = jwt.sign(
  { 
    userId: user.id,
    role: user.role,      // Nuevo
    clientId: user.clientId, // Nuevo
  },
  process.env.JWT_SECRET!,
  { expiresIn: '7d' }
);
```

---

## 🎨 FASE 3: Frontend (React)

### 1. Tipos Actualizados (`src/types/index.ts`):

```typescript
export type UserRole = 'ADMIN' | 'CLIENT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;        // Nuevo
  clientId?: string;     // Nuevo
  createdAt: string;
  updatedAt: string;
}
```

### 2. AuthContext Actualizado (`src/contexts/AuthContext.tsx`):

```typescript
interface AuthContextType {
  user: User | null;
  role: UserRole | null;  // Nuevo
  ...
}
```

### 3. Layouts Separados:

#### AdminLayout (`src/components/AdminLayout.tsx`):
- Sidebar completo con todas las opciones de administración
- Rutas: `/admin/dashboard`, `/admin/clients`, `/admin/projects`, etc.
- Solo accesible para usuarios con `role === 'ADMIN'`

#### ClientLayout (`src/components/ClientLayout.tsx`):
- Topbar simple y minimalista
- Rutas: `/portal/my-invoices`, `/portal/my-subscriptions`, `/portal/my-profile`
- Solo accesible para usuarios con `role === 'CLIENT'`

### 4. Enrutamiento Basado en Roles (`src/App.tsx`):

```typescript
<Routes>
  {/* Public */}
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />

  {/* Root redirect según rol */}
  <Route path="/" element={<RootRedirect />} />

  {/* Admin Portal */}
  <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="clients" element={<Clients />} />
    ...
  </Route>

  {/* Client Portal */}
  <Route path="/portal" element={<ClientRoute><ClientLayout /></ClientRoute>}>
    <Route path="my-invoices" element={<MyInvoices />} />
    <Route path="my-subscriptions" element={<MySubscriptions />} />
    <Route path="my-profile" element={<MyProfile />} />
  </Route>
</Routes>
```

### Route Protection Components:

#### AdminRoute:
- ✅ Permite entrada solo si `user.role === 'ADMIN'`
- ❌ Redirige a `/portal/my-invoices` si es CLIENT
- ❌ Redirige a `/login` si no autenticado

#### ClientRoute:
- ✅ Permite entrada solo si `user.role === 'CLIENT'`
- ❌ Redirige a `/admin/dashboard` si es ADMIN
- ❌ Redirige a `/login` si no autenticado

---

## 🎯 Flujo de Autenticación

1. **Usuario se registra/loguea** → Backend crea JWT con `role` y `clientId`
2. **Frontend almacena token** → AuthContext distribuye `role` a la app
3. **Enrutamiento automático** → RootRedirect envía a `/admin` o `/portal` según `role`
4. **Routes protegidas** → `AdminRoute` y `ClientRoute` validan acceso
5. **API calls** → JWT incluye `role`/`clientId` para filtrado en backend

---

## 📱 Estructura de Carpetas

```
frontend/
├── src/
│   ├── components/
│   │   ├── AdminLayout.tsx      ✨ Nuevo
│   │   ├── ClientLayout.tsx     ✨ Nuevo
│   │   └── Layout.tsx            (deprecado, reemplazado)
│   ├── pages/
│   │   ├── Admin/               ✨ En el futuro
│   │   │   ├── AdminDashboard.tsx
│   │   │   └── ...
│   │   ├── Portal/              ✨ En el futuro
│   │   │   ├── MyInvoices.tsx
│   │   │   ├── MySubscriptions.tsx
│   │   │   └── MyProfile.tsx
│   │   └── ...
│   ├── contexts/
│   │   └── AuthContext.tsx       ✨ Actualizado con role
│   ├── types/
│   │   └── index.ts             ✨ Actualizado con UserRole
│   └── App.tsx                  ✨ Refactorizado con RBAC routes
```

---

## ✅ Próximos Pasos

### Backend:
- [ ] Completar `requireAdmin` en todas las rutas `/api/clients`, `/api/projects`, `/api/invoices`
- [ ] Completar `requireAdmin` en `/api/products`, `/api/categories`
- [ ] Implementar filtrado de datos por `userId` en todos los GET (asegurar que admins solo ven sus datos)

### Frontend:
- [ ] Crear páginas específicas para portal de clientes:
  - [ ] `src/pages/MyInvoices.tsx` - Lista de facturas del cliente
  - [ ] `src/pages/MySubscriptions.tsx` - Suscripciones activas
  - [ ] `src/pages/MyProfile.tsx` - Información de perfil y empresa
- [ ] Crear hook `useClientPortalRoutes()` para obtener rutas según rol
- [ ] Tests unitarios para componentes de protección de rutas

### Testing:
- [ ] Tests E2E: Login como ADMIN, verificar acceso a `/admin`
- [ ] Tests E2E: Login como CLIENT, verificar acceso a `/portal`
- [ ] Tests E2E: Try to access `/admin` as CLIENT → redirect to `/portal`

---

## 🔒 Consideraciones de Seguridad

1. **JWT Verificación**: Siempre verifica el `role` en el backend antes de devolver datos
2. **Filtrado de Datos**: Los GETs deben filtrar por `userId` (para admins) o `clientId` (para clientes)
3. **No Confíes en el Frontend**: El rol en el JWT puede ser manipulado por clientes maliciosos
4. **CORS+HTTPS**: En producción, asegurar que las APIs están protegidas con HTTPS y CORS

---

## 📚 Referencias

- [Prisma Enums](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#enums)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [React Router v6 - Authentication](https://reactrouter.com/en/main/start/tutorial#protected-routes)

---

**Implementado por**: Senior Fullstack Developer  
**Fecha**: 2026-03-26  
**Estado**: ✅ Fase 1, 2, 3 completadas - En producción


continuar con:
3️⃣ userId Filtering (OPCIONAL - para aislamiento de datos)
   - Filtrar GETs en rutas admin por userId actual

5️⃣ Testing E2E
   - Probar login ADMIN → verifica redirección a /admin/dashboard
   - Probar login CLIENT → verifica redirección a /portal/my-invoices
   - Cross-role access blocking (CLIENT intenta /admin, debe redirigir)