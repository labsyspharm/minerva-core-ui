/** Columns of every stored table, Parquet or legacy CSV. */
export const PERSISTED_COLUMNS = { id: "class_id", name: "class_name" };

type StoredTableFormat = { kind: "parquet" } | { kind: "csv" };

/**
 * Stored bytes start with `PAR1` when they are Parquet. Older stories stored
 * normalized CSV, which the blob writer always gave a `class_id,class_name`
 * header, whatever the original file had.
 */
export function storedTableFormat(bytes: Uint8Array): StoredTableFormat {
  const parquet =
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x41 &&
    bytes[2] === 0x52 &&
    bytes[3] === 0x31;
  if (parquet) return { kind: "parquet" };
  return { kind: "csv" };
}
