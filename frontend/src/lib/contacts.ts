/** Contacto listo para importar como cliente. */
export interface ImportableContact {
  name: string;
  phone?: string;
  email?: string;
}

interface PickerContact {
  name?: string[];
  tel?: string[];
  email?: string[];
}
type ContactsApi = { select: (props: string[], opts: { multiple: boolean }) => Promise<PickerContact[]> };

const contactsApi = (): ContactsApi | undefined =>
  typeof navigator !== 'undefined' && 'contacts' in navigator && typeof window !== 'undefined' && 'ContactsManager' in window
    ? ((navigator as unknown as { contacts: ContactsApi }).contacts)
    : undefined;

/** El selector nativo de contactos solo existe en Chrome para Android (con HTTPS). */
export const canPickContacts = () => !!contactsApi();

/** Abre el selector de contactos del teléfono. Devuelve [] si se cancela. */
export async function pickContacts(): Promise<ImportableContact[]> {
  const api = contactsApi();
  if (!api) return [];
  try {
    const picked = await api.select(['name', 'tel', 'email'], { multiple: true });
    return picked
      .map((c) => ({ name: c.name?.[0]?.trim() ?? '', phone: c.tel?.[0]?.trim(), email: c.email?.[0]?.trim() }))
      .filter((c) => c.name || c.phone || c.email)
      .map((c) => ({ ...c, name: c.name || c.phone || c.email || '' }));
  } catch {
    return []; // cancelado o sin permiso
  }
}

/** Lee un archivo vCard (.vcf, versiones 2.1, 3.0 y 4.0): el formato que exportan todos los teléfonos. */
export function parseVcf(text: string): ImportableContact[] {
  // Líneas largas plegadas: la continuación empieza por espacio o tabulador.
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: ImportableContact[] = [];
  let current: { fn?: string; n?: string; phone?: string; email?: string } | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('BEGIN:VCARD')) {
      current = {};
      continue;
    }
    if (upper.startsWith('END:VCARD')) {
      if (current) {
        const name = (current.fn || current.n || current.phone || current.email || '').trim();
        if (name && (current.phone || current.email)) out.push({ name, phone: current.phone, email: current.email });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).split(';')[0].toUpperCase().replace(/^ITEM\d+\./, '');
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    if (key === 'FN') current.fn = unescapeVcf(value);
    else if (key === 'N' && !current.n) current.n = unescapeVcf(value.split(';').filter(Boolean).slice(0, 2).reverse().join(' '));
    else if (key === 'TEL' && !current.phone) current.phone = value.replace(/^tel:/i, '');
    else if (key === 'EMAIL' && !current.email) current.email = value;
  }
  return out;
}

const unescapeVcf = (v: string) => v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
