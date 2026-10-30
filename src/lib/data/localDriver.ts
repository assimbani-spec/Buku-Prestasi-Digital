/**
 * Driver data berbasis localStorage.
 *
 * Driver ini meniru sebagian kecil API `firebase/firestore` yang dipakai
 * aplikasi, supaya seluruh layar bisa berjalan tanpa server. Yang ditiru:
 * doc, collection, query, where (== dan in), orderBy, limit, getDoc, getDocs,
 * onSnapshot, setDoc (termasuk merge), addDoc, updateDoc, deleteDoc,
 * writeBatch, increment, serverTimestamp, dan Timestamp.
 *
 * Batas yang disengaja:
 * - Tidak ada aturan keamanan di sisi data. Pembatasan akses di mode lokal
 *   hanya berasal dari query yang dikirim layar (sama seperti query Firestore
 *   yang ditulis untuk memenuhi `firestore.rules`). Siapa pun yang membuka
 *   peramban bisa membaca seluruh isi localStorage. Karena itu mode ini untuk
 *   pengembangan dan demo, bukan untuk data santri sungguhan.
 * - Tidak ada sinkronisasi antar perangkat. Data hanya ada di peramban ini.
 * - Ukuran dibatasi kuota localStorage (umumnya 5 MB).
 *
 * Untuk produksi, lihat `docs/data-backend.md`: kontrak fungsi di bawah adalah
 * yang perlu dipenuhi adapter Supabase atau Cloudflare D1.
 */

const STORE_KEY = 'bkp.localdb.v2';

export class LocalTimestamp {
  constructor(public readonly ms: number) {}
  toMillis(): number {
    return this.ms;
  }
  toDate(): Date {
    return new Date(this.ms);
  }
  toJSON(): { __type: 'timestamp'; ms: number } {
    return { __type: 'timestamp', ms: this.ms };
  }
  static fromDate(d: Date): LocalTimestamp {
    return new LocalTimestamp(d.getTime());
  }
  static now(): LocalTimestamp {
    return new LocalTimestamp(Date.now());
  }
}

export const Timestamp = LocalTimestamp;

type Sentinel = { __type: 'serverTimestamp' } | { __type: 'increment'; value: number };

export const serverTimestamp = (): Sentinel => ({ __type: 'serverTimestamp' });
export const increment = (value: number): Sentinel => ({ __type: 'increment', value });

export interface LocalRef {
  readonly __kind: 'doc';
  readonly id: string;
  readonly path: string;
}

interface LocalCollectionRef {
  readonly __kind: 'collection';
  readonly path: string;
}

type Constraint =
  | { type: 'where'; field: string; op: string; value: unknown }
  | { type: 'orderBy'; field: string; dir: 'asc' | 'desc' }
  | { type: 'limit'; count: number };

interface LocalQuery {
  readonly __kind: 'query';
  readonly path: string;
  readonly constraints: Constraint[];
}

type Store = {
  version: 2;
  collections: Record<string, Record<string, Record<string, any>>>;
};

// ── Penyimpanan ─────────────────────────────────────────────────────────────

let injectedStorage: Storage | null = null;

/** Dipakai tes Node agar tidak membutuhkan peramban. */
export function setStorageForTests(storage: Storage): void {
  injectedStorage = storage;
}

function storage(): Storage {
  if (injectedStorage) return injectedStorage;
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage tidak tersedia di lingkungan ini');
  }
  return localStorage;
}

function revive(value: any): any {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    if (value.__type === 'timestamp' && typeof value.ms === 'number') {
      return new LocalTimestamp(value.ms);
    }
    const out: Record<string, any> = {};
    Object.keys(value).forEach((key) => {
      out[key] = revive(value[key]);
    });
    return out;
  }
  return value;
}

function readStore(): Store {
  try {
    const raw = storage().getItem(STORE_KEY);
    if (!raw) return { version: 2, collections: {} };
    const parsed = revive(JSON.parse(raw));
    if (!parsed || typeof parsed !== 'object' || !parsed.collections) {
      return { version: 2, collections: {} };
    }
    return parsed as Store;
  } catch {
    return { version: 2, collections: {} };
  }
}

function writeStore(store: Store): void {
  storage().setItem(STORE_KEY, JSON.stringify(store));
  emit();
}

export function clone<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return revive(JSON.parse(JSON.stringify(value)));
}

// ── Langganan (pengganti onSnapshot) ────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Pendengar yang gagal tidak boleh menghentikan pendengar lain.
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORE_KEY) emit();
  });
}

// ── Referensi ──────────────────────────────────────────────────────────────

function randomId(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-6);
}

export function collection(_db: unknown, path: string): LocalCollectionRef {
  return { __kind: 'collection', path };
}

export function doc(target: any, ...rest: string[]): LocalRef {
  // doc(collection(db, 'x')): id dibuat sekarang, seperti Firestore.
  if (target && target.__kind === 'collection') {
    const id = rest[0] ?? randomId();
    return { __kind: 'doc', id, path: `${target.path}/${id}` };
  }
  const collectionName = rest[0];
  if (!collectionName) throw new Error('doc() butuh nama koleksi');
  const id = rest[1] ?? randomId();
  return { __kind: 'doc', id, path: `${collectionName}/${id}` };
}

function pathParts(path: string): [string, string] {
  const [collectionName, id] = path.split('/');
  return [collectionName, id];
}

// ── Query ──────────────────────────────────────────────────────────────────

export function query(target: LocalCollectionRef | LocalQuery, ...constraints: Constraint[]): LocalQuery {
  const base = (target as any).__kind === 'query' ? (target as LocalQuery) : null;
  const path = base ? base.path : (target as LocalCollectionRef).path;
  const merged = [...(base ? base.constraints : []), ...constraints];
  return { __kind: 'query', path, constraints: merged };
}

export const where = (field: string, op: string, value: unknown): Constraint => ({
  type: 'where',
  field,
  op,
  value,
});

export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc'): Constraint => ({
  type: 'orderBy',
  field,
  dir,
});

export const limit = (count: number): Constraint => ({ type: 'limit', count });

function fieldValue(data: any, field: string): any {
  return field.split('.').reduce((acc: any, key) => (acc == null ? acc : acc[key]), data);
}

function sortValue(value: any): number | string {
  if (value instanceof LocalTimestamp) return value.ms;
  if (typeof value === 'number') return value;
  if (value == null) return '';
  return String(value);
}

function matchesWhere(data: any, constraint: Extract<Constraint, { type: 'where' }>): boolean {
  const value = fieldValue(data, constraint.field);
  switch (constraint.op) {
    case '==':
      return value === constraint.value;
    case '!=':
      return value !== constraint.value;
    case 'in':
      return Array.isArray(constraint.value) && constraint.value.includes(value);
    case 'not-in':
      return Array.isArray(constraint.value) && !constraint.value.includes(value);
    case 'array-contains':
      return Array.isArray(value) && value.includes(constraint.value);
    case 'array-contains-any':
      return (
        Array.isArray(value) &&
        Array.isArray(constraint.value) &&
        constraint.value.some((candidate: unknown) => value.includes(candidate))
      );
    case '<':
      return sortValue(value) < sortValue(constraint.value);
    case '<=':
      return sortValue(value) <= sortValue(constraint.value);
    case '>':
      return sortValue(value) > sortValue(constraint.value);
    case '>=':
      return sortValue(value) >= sortValue(constraint.value);
    default:
      return false;
  }
}

function rowsFor(store: Store, path: string, constraints: Constraint[]): Array<{ id: string; data: any }> {
  const bucket = store.collections[path] ?? {};
  let rows = Object.keys(bucket).map((id) => ({ id, data: bucket[id] }));

  constraints
    .filter((c): c is Extract<Constraint, { type: 'where' }> => c.type === 'where')
    .forEach((c) => {
      rows = rows.filter((row) => matchesWhere(row.data, c));
    });

  constraints
    .filter((c): c is Extract<Constraint, { type: 'orderBy' }> => c.type === 'orderBy')
    .forEach((c) => {
      rows = [...rows].sort((a, b) => {
        const left = sortValue(fieldValue(a.data, c.field));
        const right = sortValue(fieldValue(b.data, c.field));
        if (left === right) return 0;
        const result = left < right ? -1 : 1;
        return c.dir === 'desc' ? -result : result;
      });
    });

  const limitConstraint = constraints.find((c) => c.type === 'limit') as
    | Extract<Constraint, { type: 'limit' }>
    | undefined;
  if (limitConstraint) rows = rows.slice(0, limitConstraint.count);

  return rows;
}

function docSnapshot(ref: LocalRef, store: Store) {
  const [collectionName, id] = pathParts(ref.path);
  const data = store.collections[collectionName]?.[id];
  const exists = data !== undefined;
  return {
    id,
    ref,
    exists: () => exists,
    data: () => (exists ? clone(data) : undefined),
    get: (field: string) => (exists ? clone(fieldValue(data, field)) : undefined),
  };
}

function querySnapshot(store: Store, q: LocalQuery) {
  const docs = rowsFor(store, q.path, q.constraints).map((row) => {
    const ref: LocalRef = { __kind: 'doc', id: row.id, path: `${q.path}/${row.id}` };
    return {
      id: row.id,
      ref,
      exists: () => true,
      data: () => clone(row.data),
      get: (field: string) => clone(fieldValue(row.data, field)),
    };
  });
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: (snap: (typeof docs)[number]) => void) => docs.forEach(cb),
  };
}

// ── Baca ───────────────────────────────────────────────────────────────────

export async function getDoc(ref: LocalRef) {
  return docSnapshot(ref, readStore());
}

export async function getDocFromServer(ref: LocalRef) {
  return getDoc(ref);
}

export async function getDocs(target: LocalCollectionRef | LocalQuery) {
  const store = readStore();
  if ((target as any).__kind === 'query') return querySnapshot(store, target as LocalQuery);
  return querySnapshot(store, { __kind: 'query', path: (target as LocalCollectionRef).path, constraints: [] });
}

// ── Tulis ──────────────────────────────────────────────────────────────────

function resolveValue(value: any, existing: any): any {
  if (value instanceof LocalTimestamp) return value;
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, undefined));
  if (value && typeof value === 'object') {
    if (value.__type === 'serverTimestamp') return new LocalTimestamp(Date.now());
    if (value.__type === 'increment') {
      const current = typeof existing === 'number' ? existing : 0;
      return current + value.value;
    }
    const out: Record<string, any> = {};
    Object.keys(value).forEach((key) => {
      out[key] = resolveValue(value[key], existing ? existing[key] : undefined);
    });
    return out;
  }
  return value;
}

function ensureCollection(store: Store, collectionName: string): Record<string, any> {
  if (!store.collections[collectionName]) store.collections[collectionName] = {};
  return store.collections[collectionName];
}

function applyWrite(store: Store, op: 'set' | 'update' | 'delete', ref: LocalRef, data?: any, merge?: boolean): void {
  const [collectionName, id] = pathParts(ref.path);
  const bucket = ensureCollection(store, collectionName);

  if (op === 'delete') {
    delete bucket[id];
    return;
  }

  if (op === 'update') {
    if (!bucket[id]) {
      throw new Error(`Dokumen ${ref.path} tidak ditemukan (update ditolak).`);
    }
    const resolved = resolveValue(data ?? {}, bucket[id]);
    bucket[id] = { ...bucket[id], ...resolved };
    return;
  }

  const resolved = resolveValue(data ?? {}, merge ? bucket[id] : undefined);
  bucket[id] = merge && bucket[id] ? { ...bucket[id], ...resolved } : resolved;
}

export async function setDoc(ref: LocalRef, data: any, options?: { merge?: boolean }): Promise<void> {
  const store = readStore();
  applyWrite(store, 'set', ref, data, options?.merge === true);
  writeStore(store);
}

export async function addDoc(target: LocalCollectionRef, data: any) {
  const id = randomId();
  const ref: LocalRef = { __kind: 'doc', id, path: `${target.path}/${id}` };
  const store = readStore();
  applyWrite(store, 'set', ref, data, false);
  writeStore(store);
  return ref;
}

export async function updateDoc(ref: LocalRef, data: any): Promise<void> {
  const store = readStore();
  applyWrite(store, 'update', ref, data, false);
  writeStore(store);
}

export async function deleteDoc(ref: LocalRef): Promise<void> {
  const store = readStore();
  applyWrite(store, 'delete', ref);
  writeStore(store);
}

export function writeBatch(_db: unknown) {
  const ops: Array<{ op: 'set' | 'update' | 'delete'; ref: LocalRef; data?: any; merge?: boolean }> = [];
  return {
    set(ref: LocalRef, data: any, options?: { merge?: boolean }) {
      ops.push({ op: 'set', ref, data, merge: options?.merge === true });
      return this;
    },
    update(ref: LocalRef, data: any) {
      ops.push({ op: 'update', ref, data });
      return this;
    },
    delete(ref: LocalRef) {
      ops.push({ op: 'delete', ref });
      return this;
    },
    async commit() {
      const store = readStore();
      ops.forEach((operation) => {
        applyWrite(store, operation.op, operation.ref, operation.data, operation.merge);
      });
      writeStore(store);
    },
  };
}

// ── Langganan data ─────────────────────────────────────────────────────────

export function onSnapshot(
  target: LocalRef | LocalCollectionRef | LocalQuery,
  next: (snapshot: any) => void,
  error?: (err: Error) => void
): () => void {
  let lastSerialized = '';

  const deliver = () => {
    try {
      const store = readStore();
      const snap = (target as any).__kind === 'doc'
        ? docSnapshot(target as LocalRef, store)
        : querySnapshot(
            store,
            (target as any).__kind === 'query'
              ? (target as LocalQuery)
              : { __kind: 'query', path: (target as LocalCollectionRef).path, constraints: [] }
          );
      const serialized = JSON.stringify(
        (target as any).__kind === 'doc'
          ? (snap as any).data()
          : (snap as any).docs.map((d: any) => d.data())
      );
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        next(snap);
      }
    } catch (err) {
      error?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  listeners.add(deliver);
  deliver();
  return () => listeners.delete(deliver);
}

// ── Utilitas mode lokal ────────────────────────────────────────────────────

/** Menghapus seluruh data mode lokal. Dipakai tombol reset dan tes. */
export function clearLocalDatabase(): void {
  try {
    storage().removeItem(STORE_KEY);
  } catch {
    /* tidak ada yang perlu dihapus */
  }
  emit();
}

export function localDatabaseExists(): boolean {
  try {
    return Boolean(storage().getItem(STORE_KEY));
  } catch {
    return false;
  }
}
