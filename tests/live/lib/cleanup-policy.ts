import type { OwnedFixture } from "./fixture-journal.js";
export interface SweepItem extends OwnedFixture { name: string; remove(): Promise<unknown> }
export function ownedItems(items: SweepItem[], journal: OwnedFixture[]): SweepItem[] {
  return items.filter(item => journal.some(owned => owned.kind === item.kind && owned.id === item.id && owned.workspaceId === item.workspaceId));
}
/** A delete response is not proof: re-enumeration must succeed and show absence. */
export async function cleanOwned(items: SweepItem[], enumerate: () => Promise<SweepItem[]>): Promise<void> {
  const errors: string[] = [];
  for (const item of items) {
    try { await item.remove(); } catch { errors.push(`${item.kind} ${item.id}: deletion failed`); }
  }
  const remaining = await enumerate();
  for (const item of items) if (remaining.some(r => r.kind === item.kind && r.id === item.id)) errors.push(`${item.kind} ${item.id}: still present`);
  if (errors.length) throw new Error(`Cleanup unverified: ${errors.join("; ")}`);
}

/** Detect ignored pagination parameters as well as an excessive or cyclic result set. */
export async function paginate<T>(fetchPage: (offset: number, limit: number) => Promise<{ items: T[]; total?: number }>, id: (item: T) => string, limit = 100): Promise<T[]> {
  const rows: T[] = []; const seen = new Set<string>();
  for (let offset = 0; offset < 100000; offset += limit) {
    const page = await fetchPage(offset, limit);
    for (const row of page.items) {
      const key = id(row);
      if (!key || seen.has(key)) throw new Error("Pagination returned missing or repeated identifiers; cleanup cannot be verified");
      seen.add(key); rows.push(row);
    }
    if (page.total !== undefined && rows.length >= page.total) return rows;
    if (page.items.length < limit) {
      if (page.total !== undefined && rows.length < page.total) throw new Error("Incomplete listing; cleanup cannot be verified");
      return rows;
    }
  }
  throw new Error("Listing exceeded safe pagination bound");
}

/** ActivePieces cursor lists must terminate, with no duplicate page or record identities. */
export async function paginateCursor<T>(fetchPage: (cursor?: string) => Promise<unknown>, parseItems: (value: unknown) => T[], id: (item: T) => string): Promise<T[]> {
  const rows: T[] = []; const cursors = new Set<string>(); const ids = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const value = await fetchPage(cursor);
    const items = parseItems(value);
    for (const item of items) {
      const key = id(item);
      if (!key || ids.has(key)) throw new Error("Cursor listing repeated or omitted an ID");
      ids.add(key); rows.push(item);
    }
    if (!value || typeof value !== "object") throw new Error("Invalid cursor listing");
    const envelope = value as { next?: unknown; nextCursor?: unknown; next_cursor?: unknown; total?: unknown };
    const next = envelope.nextCursor ?? envelope.next_cursor ?? envelope.next;
    if (next == null || next === "") {
      if (typeof envelope.total === "number" && rows.length < envelope.total) throw new Error("Incomplete cursor listing");
      return rows;
    }
    if (typeof next !== "string" || cursors.has(next)) throw new Error("Invalid or cyclic pagination cursor");
    cursors.add(next); cursor = next;
  }
  throw new Error("Cursor listing exceeded safe bound");
}
