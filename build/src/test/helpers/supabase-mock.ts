import { vi } from "vitest";

/**
 * In-memory stand-in for the Supabase client, covering exactly the query-builder
 * surface the Week 1+2 route handlers use.
 *
 * Deliberately enforces NO row-level security. Postgres RLS is the real
 * boundary, but it cannot run here, and a mock that re-implemented it would make
 * the isolation tests tautological — they would pass because the mock refused to
 * return the row, telling us nothing about the code under test. With the store
 * wide open, any cross-user test that passes proves the *application layer*
 * isolates on its own, which is the strictly stronger result and the only one
 * these tests can honestly claim.
 */

export type Row = Record<string, unknown>;

type Filter = { column: string; value: unknown };

let uuidCounter = 0;

/** Deterministic v4-shaped uuid, so tests never depend on randomness. */
export function testUuid(seed?: number): string {
  const n = seed ?? ++uuidCounter;
  const hex = n.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
}

export class MockDatabase {
  tables = new Map<string, Row[]>();
  /** Set to force the next write to fail, exercising the 500 branches. */
  failNextWrite: { message: string } | null = null;
  /** 1-based index of the write to fail, for routes that write more than once. */
  failWriteAt: number | null = null;
  writeCount = 0;

  seed(table: string, rows: Row[]): void {
    this.tables.set(table, [...(this.tables.get(table) ?? []), ...rows.map((r) => ({ ...r }))]);
  }

  rows(table: string): Row[] {
    let existing = this.tables.get(table);
    if (!existing) {
      existing = [];
      this.tables.set(table, existing);
    }
    return existing;
  }
}

class MockQuery implements PromiseLike<{ data: unknown; error: unknown }> {
  private filters: Filter[] = [];

  constructor(
    private db: MockDatabase,
    private table: string,
    private op: "select" | "insert" | "update",
    private payload?: Row,
  ) {}

  select(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  /** Only `.is("deleted_at", null)` is used in this codebase. */
  is(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  order(): this {
    return this;
  }

  private matching(): Row[] {
    return this.db
      .rows(this.table)
      .filter((row) =>
        this.filters.every((filter) => (row[filter.column] ?? null) === filter.value),
      );
  }

  private run(): { data: Row[]; error: unknown } {
    if (this.op !== "select") {
      this.db.writeCount += 1;

      if (this.db.failNextWrite) {
        const error = this.db.failNextWrite;
        this.db.failNextWrite = null;
        return { data: [], error };
      }
      if (this.db.failWriteAt === this.db.writeCount) {
        return { data: [], error: { message: "simulated write failure" } };
      }
    }

    if (this.op === "insert") {
      const inserted: Row = { id: testUuid(), deleted_at: null, ...this.payload };
      this.db.rows(this.table).push(inserted);
      return { data: [inserted], error: null };
    }

    if (this.op === "update") {
      const hit = this.matching();
      for (const row of hit) Object.assign(row, this.payload);
      return { data: hit, error: null };
    }

    return { data: this.matching(), error: null };
  }

  async maybeSingle() {
    const { data, error } = this.run();
    return { data: data[0] ?? null, error };
  }

  async single() {
    const { data, error } = this.run();
    if (error) return { data: null, error };
    if (data.length !== 1) {
      return { data: null, error: { message: "expected exactly one row" } };
    }
    return { data: data[0], error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

export type MockUser = { id: string; email?: string; user_metadata?: Row } | null;

export function createMockSupabase(db: MockDatabase, user: MockUser) {
  return {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      exchangeCodeForSession: vi.fn(async () => ({ data: {}, error: null })),
    },
    from(table: string) {
      return {
        select: () => new MockQuery(db, table, "select"),
        insert: (payload: Row) => new MockQuery(db, table, "insert", payload),
        update: (payload: Row) => new MockQuery(db, table, "update", payload),
      };
    },
  };
}

/**
 * Shared mutable handle the `@/lib/supabase/server` module mock reads from, so a
 * test can swap the signed-in user between requests without re-mocking.
 */
export const activeSession: { db: MockDatabase; user: MockUser } = {
  db: new MockDatabase(),
  user: null,
};

export function signIn(user: MockUser): void {
  activeSession.user = user;
}

export function resetDatabase(): MockDatabase {
  activeSession.db = new MockDatabase();
  activeSession.user = null;
  return activeSession.db;
}
