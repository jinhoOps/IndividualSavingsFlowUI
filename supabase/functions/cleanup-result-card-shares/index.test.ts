import { assertEquals } from "jsr:@std/assert@1";
let captured: (request: Request) => Promise<Response>;
const serve = Deno.serve;
Deno.serve = ((h: typeof captured) => {
  captured = h;
}) as typeof Deno.serve;
const module = await import("./index.ts");
Deno.serve = serve;
const handle =
  (module as unknown as { handleRequest?: typeof captured }).handleRequest ??
    captured!;
Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
Deno.env.set("RESULT_CARD_CLEANUP_SECRET", "cleanup-test");
const request = () =>
  new Request("https://test.supabase.co/cleanup", {
    method: "POST",
    headers: { "x-result-card-cleanup": "cleanup-test" },
  });
async function fixture(
  count: number,
  failures: number,
  unsettled: boolean,
  run: (
    result: {
      response: Response;
      remaining: number;
      heartbeat: boolean;
      attempts: number;
    },
  ) => Promise<void>,
  lease = true,
) {
  const original = fetch;
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    object_path: `shares/${i}.png`,
    state: "ready",
    byte_size: 100,
    upload_settled_at: unsettled ? null : "2026-01-01T00:00:00Z",
  }));
  const present = new Set(rows.map((r) => r.object_path));
  let heartbeat = false, attempts = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input)),
      method = init?.method ?? "GET",
      body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (url.pathname.endsWith("/rpc/claim_result_card_cleanup")) {
      return Response.json(
        lease ? "00000000-0000-4000-8000-ffffffffffff" : null,
      );
    }
    if (url.pathname.endsWith("/rpc/reconcile_result_card_storage")) {
      return Response.json({ valid: true });
    }
    if (url.pathname.endsWith("/rpc/finish_result_card_delete")) {
      const row = rows.find((r) => r.id === body.p_id)!;
      if (row.upload_settled_at) row.state = "deleted";
      return Response.json(!!row.upload_settled_at);
    }
    if (url.pathname.endsWith("/result_card_share_policy")) {
      if (method === "PATCH") {
        if (body.last_cleanup_success_at) heartbeat = true;
        return Response.json(null);
      }
      return Response.json({
        cleanup_cursor: null,
        cleanup_failed: false,
        last_inventory_success_at: new Date().toISOString(),
      });
    }
    if (url.pathname.endsWith("/result_card_share_runs")) {
      return Response.json(null);
    }
    if (url.pathname.endsWith("/result_card_shares")) {
      const id = url.searchParams.get("id");
      if (method === "PATCH") {
        const row = rows.find((r) => `eq.${r.id}` === id);
        if (row) row.state = "deleting";
        return Response.json(row ? [row] : []);
      }
      if (method === "DELETE") return Response.json(null);
      return Response.json(
        rows.filter((r) => r.state !== "deleted" && (!id || r.id > id.slice(3)))
          .slice(0, 100),
      );
    }
    if (url.pathname.includes("/storage/v1/object/") && method === "DELETE") {
      attempts++;
      const path = body.prefixes[0];
      if (Number(path.match(/\d+/)?.[0]) < failures) {
        return Response.json({ error: "offline" }, { status: 500 });
      }
      present.delete(path);
      return Response.json([]);
    }
    if (url.pathname.includes("/storage/v1/object/info/")) {
      return present.has(
          decodeURIComponent(url.pathname.split("result-card-shares/")[1]),
        )
        ? Response.json({ size: 100 })
        : Response.json({ statusCode: "404", error: "not_found" }, {
          status: 404,
        });
    }
    throw new Error(`Unexpected fake server call: ${method} ${url.pathname}`);
  }) as typeof fetch;
  try {
    const response = await handle(request());
    await run({
      response,
      remaining: rows.filter((r) => r.state !== "deleted").reduce(
        (n, r) => n + r.byte_size,
        0,
      ),
      heartbeat,
      attempts,
    });
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test("failed deletes remain charged and do not certify healthy cleanup", () =>
  fixture(1, 1, false, async (r) => {
    assertEquals(r.remaining, 100);
    assertEquals(r.heartbeat, false);
    assertEquals((await r.response.json()).failed, 1);
  }));
Deno.test("continues beyond first 100 including failed rows", () =>
  fixture(105, 5, false, async (r) => {
    assertEquals(r.attempts, 105);
    assertEquals(r.remaining, 500);
    assertEquals(r.heartbeat, false);
  }));
Deno.test("ambiguous upload is deleted but remains charged", () =>
  fixture(1, 0, true, async (r) => {
    assertEquals(r.remaining, 100);
    assertEquals((await r.response.json()).unsettled, 1);
  }));
Deno.test("empty successful scan refreshes health", () =>
  fixture(0, 0, false, async (r) => {
    assertEquals(r.heartbeat, true);
    assertEquals(r.response.status, 200);
  }));
Deno.test("overlapping cleanup does not acquire another writer", () =>
  fixture(1, 0, false, async (r) => {
    assertEquals(r.attempts, 0);
    assertEquals(r.remaining, 100);
  }, false));
Deno.test("missing configured secret never authenticates empty header", async () => {
  Deno.env.delete("RESULT_CARD_CLEANUP_SECRET");
  assertEquals(
    (await handle(new Request("https://local.test", { method: "POST" })))
      .status,
    401,
  );
  Deno.env.set("RESULT_CARD_CLEANUP_SECRET", "cleanup-test");
});
