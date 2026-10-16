/**
 * Respuesta 400 uniforme para un ZodError: `error` es un mensaje legible (el
 * primero de los problemas) y `details` trae todos. (Zod 4 ya no tiene
 * `error.errors`, solo `error.issues`.)
 */
export function zodResponse(error: { issues?: Array<{ message?: string }> }) {
  const issues = error.issues ?? [];
  return { error: issues[0]?.message || 'Datos inválidos', details: issues };
}
