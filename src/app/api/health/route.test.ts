import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The contract these tests defend: the uptime monitor gets a truthful verdict
// from a REAL query, and nothing else ever escapes: no driver error text, no
// guest or booking data, no cached answer.

const execute = vi.fn();

vi.mock("@/db", () => ({
  db: () => ({ execute }),
}));

const { GET, HEAD } = await import("./route");

beforeEach(() => {
  execute.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("GET /api/health", () => {
  it("really queries the database rather than answering from static config", async () => {
    execute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    await GET();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("returns 200 with the monitor's exact success shape", async () => {
    execute.mockResolvedValue({ rows: [] });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, checks: { db: "ok" } });
  });

  it("returns 503 with a fixed literal when the database is unreachable", async () => {
    execute.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "database_unreachable" });
  });

  it("never echoes the raw driver error, which can carry the connection string", async () => {
    const secret = "postgres://user:hunter2@db.example.com/stay";
    execute.mockRejectedValue(new Error(`password authentication failed ${secret}`));
    const body = await (await GET()).text();
    expect(body).not.toContain(secret);
    expect(body).not.toContain("hunter2");
    expect(body).not.toContain("password authentication failed");
  });

  it("logs a constant string only, so the leak does not move to the log sink", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValue(new Error("password authentication failed for user 'stay'"));
    await GET();
    expect(logged).toHaveBeenCalledWith("[health] database liveness check failed");
    for (const call of logged.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("password");
    }
  });

  it("is never cached", async () => {
    execute.mockResolvedValue({ rows: [] });
    expect((await GET()).headers.get("cache-control")).toContain("no-store");
    execute.mockRejectedValue(new Error("down"));
    expect((await GET()).headers.get("cache-control")).toContain("no-store");
  });

  it("carries no row data, count, or anything implying booking volume", async () => {
    execute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    const body = await (await GET()).text();
    expect(JSON.parse(body)).toEqual({ ok: true, checks: { db: "ok" } });
    for (const word of ["guest", "booking", "count", "rows", "tenant", "hotel", "email", "phone"]) {
      expect(body.toLowerCase()).not.toContain(word);
    }
  });

  it("gives up at 4s instead of hanging with the monitor", async () => {
    vi.useFakeTimers();
    execute.mockReturnValue(new Promise(() => {}));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(4_000);
    const res = await pending;
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "database_unreachable" });
  });

  it("clears the timer on the happy path so the function can settle", async () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, "clearTimeout");
    execute.mockResolvedValue({ rows: [] });
    await GET();
    expect(clear).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("HEAD /api/health", () => {
  it("mirrors the verdict with no body", async () => {
    execute.mockResolvedValue({ rows: [] });
    const up = await HEAD();
    expect(up.status).toBe(200);
    await expect(up.text()).resolves.toBe("");

    execute.mockRejectedValue(new Error("down"));
    const down = await HEAD();
    expect(down.status).toBe(503);
    await expect(down.text()).resolves.toBe("");
  });
});
