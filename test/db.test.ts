import { describe, expect, test } from "bun:test";
import { getDb } from "../src/db.ts";

describe("sqlite configuration", () => {
  test("WAL mode so readers work while the scraper writes", () => {
    const mode = getDb().query("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(mode.journal_mode).toBe("wal");
  });

  test("busy_timeout is set, so concurrent writers wait instead of failing", () => {
    const t = getDb().query("PRAGMA busy_timeout").get() as { timeout: number };
    expect(t.timeout).toBeGreaterThan(0);
  });
});
