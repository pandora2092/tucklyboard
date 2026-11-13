import { z } from 'zod';

import { telegramHeaders } from '../lib/telegram';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map(issue => issue.message).join('. ');
  }
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос';
}
async function responseError(response: Response) {
  const value: unknown = await response.json().catch(() => null);
  if (value && typeof value === 'object' && 'message' in value) {
    const message = value.message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.join('. ');
    }
    if (message && typeof message === 'object' && 'fieldErrors' in message) {
      const fields = message.fieldErrors;
      if (fields && typeof fields === 'object') {
        return (
          Object.values(fields)
            .flat()
            .filter(v => typeof v === 'string')
            .join('. ') || 'Проверьте поля карточки'
        );
      }
    }
  }
  return 'Не удалось выполнить запрос';
}
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const multipart = options.body instanceof FormData;
  const response = await fetch(`/api/${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(!multipart ? { 'Content-Type': 'application/json' } : {}),
      ...telegramHeaders(),
    },
    body: multipart
      ? (options.body as FormData)
      : options.body === undefined
        ? undefined
        : JSON.stringify(options.body),
    signal: options.signal,
  });
  if (!response.ok) {
    throw new ApiError(await responseError(response), response.status);
  }
  const result = schema.safeParse(await response.json());
  if (!result.success) {
    throw new Error('Сервер вернул неподдерживаемые данные. Обновите приложение');
  }
  return result.data;
}
export async function fetchPreview(path: string, signal: AbortSignal) {
  if (!path.startsWith('/api/items/')) {
    throw new Error('Неверный адрес превью');
  }
  const response = await fetch(path, { headers: telegramHeaders(), signal });
  if (!response.ok) {
    throw new Error(await responseError(response));
  }
  return response.blob();
}
