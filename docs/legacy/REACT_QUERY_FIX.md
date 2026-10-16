# React Query Version Conflict Fix

## Problem

The application was throwing an `Invalid hook call` runtime error in the browser console:

```
Invalid hook call. Hooks can only be called inside of the body of a function component.
TypeError: Cannot read properties of null (reading 'useEffect')`
```

### Root Cause

A **React dependency version mismatch** was occurring due to:

- `react` and `react-dom` being resolved from `/var/www/html/Vortex/frontend/node_modules`
- `@tanstack/react-query` and `@tanstack/react-query-devtools` being resolved from `/var/www/html/Vortex/node_modules` (root)

This caused React Query's `QueryClientProvider` to access a different React context (null), breaking hooks.

---

## Solution

### Step 1: Update Frontend Package Versions

Update `frontend/package.json` to align `@tanstack/react-query` versions:

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.95.2",
    "@tanstack/react-query-devtools": "^5.95.2",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    ...
  }
}
```

**Changed from:** `^5.59.0` → **To:** `^5.95.2`

### Step 2: Clean Install

Remove old node_modules and reinstall:

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Step 3: Verify Build

Confirm TypeScript compilation and Vite build work:

```bash
npm run build
```

Expected output:
```
✓ 1857 modules transformed.
✓ built in 1.30s
```

### Step 4: Run Development Server

Start the dev server:

```bash
npm run dev
```

The app should now run without hooks errors.

---

## Security: Address Audit Warnings

After installation, you may see a high-severity vulnerability warning:

```
1 high severity vulnerability
```

To fix:

```bash
npm audit fix
```

Or manually review with:

```bash
npm audit
```

---

## Prevention

Maintain **version parity** between:
- Root `package.json` (@tanstack packages)
- `frontend/package.json` (React + React Query versions)

Always verify:
```bash
npm ls react react-dom @tanstack/react-query
```

Should show no duplicate entries and consistent versions across dependencies.

---

## Commit Hash

```
Commit: 0132c0d
Message: fix: resolve React hooks version conflict and add missing useCreate hooks
```

---

## Related Changes

This fix also included:

✅ Added missing `useCreate*` hooks in `src/hooks/useQueries.ts`:
  - `useCreateClient`
  - `useCreateProject`
  - `useCreateInvoice`
  - `useCreateProduct`

✅ Fixed TypeScript type imports in pages

✅ Fixed `parseFloat` → `Number()` for invoice totalAmount

✅ Removed unused imports and variables

---

## References

- [React: Invalid Hook Call](https://react.dev/link/invalid-hook-call)
- [TanStack React Query Documentation](https://tanstack.com/query/latest)
- [npm dedupe](https://docs.npmjs.com/cli/v10/commands/npm-dedupe)
