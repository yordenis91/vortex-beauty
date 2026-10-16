// Último salón en el que se inició sesión, para prerrellenar el login.
const TENANT_SLUG_KEY = 'tenantSlug';

export function getSavedTenantSlug(): string {
  try {
    return localStorage.getItem(TENANT_SLUG_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveTenantSlug(slug: string) {
  try {
    localStorage.setItem(TENANT_SLUG_KEY, slug);
  } catch {
    // almacenamiento no disponible: no es crítico
  }
}
