export function storeErrorCode(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
