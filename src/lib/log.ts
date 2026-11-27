/**
 * Minimal logger. Never pass user content (titles, amounts, diary text) here:
 * only operation names and error messages.
 */
export function logError(context: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[KorosGunce] ${context}: ${msg}`);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
