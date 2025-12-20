/**
 * Validates if a string is a valid UUID v4 format
 * Used to prevent SQL injection in .or() filter queries
 */
export function isValidUUID(uuid: string | undefined | null): boolean {
  if (!uuid) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Throws an error if the provided UUID is invalid
 */
export function validateUUID(uuid: string | undefined | null, fieldName: string = 'ID'): string {
  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return uuid as string;
}
