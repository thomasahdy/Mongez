export function toArrayPayload(payload, keys = ["data", "items", "results", "logs", "events", "tasks"]) {
  if (Array.isArray(payload)) {
    return payload;
  }

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  return [];
}

export function toPagedPayload(payload, itemKeys) {
  const items = toArrayPayload(payload, itemKeys);
  const metaSource = payload?.meta || payload?.pagination || payload?.pageInfo || {};
  const totalValue = metaSource.total ?? payload?.total ?? items.length;
  const pageValue = metaSource.page ?? payload?.page ?? 1;
  const limitValue = metaSource.limit ?? metaSource.pageSize ?? payload?.limit ?? payload?.pageSize ?? items.length ?? 10;
  const total = Number(totalValue) || 0;
  const page = Number(pageValue) || 1;
  const limit = Number(limitValue) || 10;

  return {
    items,
    total,
    page,
    limit,
    meta: {
      ...metaSource,
      total,
      page,
      limit,
    },
  };
}
