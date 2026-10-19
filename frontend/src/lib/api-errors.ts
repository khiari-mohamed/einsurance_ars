/** Returns every human-readable message of an API error (validation details first). */
export function extractApiErrors(error: any, fallback: string): string[] {
  const data = error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) return data.errors.map(String);
  const message = data?.message;
  if (Array.isArray(message)) return message.map(String);
  if (typeof message === 'string' && message) return [message];
  return [fallback];
}
