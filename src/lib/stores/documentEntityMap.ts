export type EntityMap<T> = Record<string, T>;

/** Builds a map keyed by `item.id`. Callers should only pass entities with stable string ids. */
export function toEntityMap<T>(items: T[]): EntityMap<T> {
  return Object.fromEntries(
    items.map((item) => [(item as { id: string }).id, item]),
  );
}

export function fromEntityMap<T>(map: Record<string, T>): T[] {
  return Object.values(map);
}
