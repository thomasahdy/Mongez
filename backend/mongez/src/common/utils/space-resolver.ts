import { Request } from 'express';

/**
 * Standardized utility to extract spaceId from an HTTP request.
 * Checks params, body, query parameters, and route path fallbacks.
 */
export function resolveSpaceId(req: any): string | undefined {
  if (!req) return undefined;

  // 1. Explicit spaceId in route parameters
  if (req.params?.spaceId) {
    return req.params.spaceId;
  }

  // 2. ID parameter on space-scoped routes (e.g. GET /spaces/:id)
  if (req.params?.id && req.path && (req.path.startsWith('/spaces') || req.path.startsWith('/api/v1/spaces'))) {
    return req.params.id;
  }

  // 3. Body payload
  if (req.body?.spaceId) {
    return req.body.spaceId;
  }

  // 4. Query parameters
  if (req.query?.spaceId) {
    return req.query.spaceId as string;
  }

  return undefined;
}
