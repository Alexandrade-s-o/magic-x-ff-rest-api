import { ApiError } from '@/lib/api';
import { format, type Dictionary } from '@/i18n';

/**
 * Mensaje de error en el idioma activo. `byStatus` permite textos propios de
 * cada pantalla (p. ej. 401 en el login = credenciales incorrectas).
 */
export function errorText(
  error: unknown,
  dict: Dictionary,
  byStatus: Partial<Record<number, string>> = {},
): string {
  if (error instanceof ApiError) {
    const custom = byStatus[error.status];
    if (custom) return custom;
    if (error.status === 429) return dict.errors.tooMany;
    if (error.status === 503) return dict.errors.unavailable;
    if (error.status >= 500) {
      return format(dict.errors.server, { status: error.status });
    }
    return error.message || dict.errors.generic;
  }
  if (error instanceof TypeError) return dict.errors.network;
  return dict.errors.generic;
}
