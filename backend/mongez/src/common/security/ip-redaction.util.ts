const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./,
];

export const REDACTED_PRIVATE_IP = 'Private network';

export function isPrivateIpAddress(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '::1' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(normalized))
  );
}

export function redactPrivateIp<T extends string | null | undefined>(value: T): T | string {
  return isPrivateIpAddress(value) ? REDACTED_PRIVATE_IP : value;
}
