type ApiErrorBody = { message?: string | string[] };

/** Error de la API con su código HTTP, para mostrar un mensaje traducido. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, {
    ...options,
    headers,
    cache: 'no-store',
  });

  let payload: unknown = null;
  if (response.status !== 204) {
    try {
      payload = await response.json();
    } catch {
      if (response.ok) {
        throw new Error('El servidor devolvió una respuesta JSON inválida');
      }
    }
  }

  if (!response.ok) {
    const apiError = payload as ApiErrorBody | null;
    const message = Array.isArray(apiError?.message)
      ? apiError.message.join(', ')
      : apiError?.message;
    throw new ApiError(
      message || `Request failed (${response.status})`,
      response.status,
    );
  }

  return payload as T;
}
