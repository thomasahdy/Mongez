import { ConfigService } from '@nestjs/config';

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[?::1\]?$/i,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

export function buildPublicStorageUrl(config: ConfigService, pathnameWithQuery: string): string {
  const appUrl = config.get<string>('APP_URL');

  if (!appUrl) {
    return pathnameWithQuery;
  }

  try {
    const parsed = new URL(appUrl);
    if (isPrivateHost(parsed.hostname)) {
      return pathnameWithQuery;
    }

    return `${parsed.origin}${pathnameWithQuery}`;
  } catch {
    return pathnameWithQuery;
  }
}
