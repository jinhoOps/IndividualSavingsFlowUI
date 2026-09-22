import { assertEquals } from "jsr:@std/assert@1";
let captured: (request: Request) => Promise<Response>;
const serve = Deno.serve;
Deno.serve = ((handler: typeof captured) => {
  captured = handler;
}) as typeof Deno.serve;
const module = await import("./index.ts");
Deno.serve = serve;
const handle =
  (module as unknown as { handleRequest?: typeof captured }).handleRequest ??
    captured!;
Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "test-anon");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
const token = "a".repeat(43),
  requestId = "00000000-0000-4000-8000-000000000001";
const png = (length = 40) => {
  const bytes = new Uint8Array(length);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 1080);
  view.setUint32(20, 1440);
  return bytes;
};
const request = (bytes = png(), headers: Record<string, string> = {}) =>
  new Request("https://test.supabase.co/functions/v1/result-card-share", {
    method: "POST",
    headers: {
      authorization: "Bearer user",
      "content-type": "image/png",
      "x-result-card-request-id": requestId,
      "x-result-card-token": token,
      ...headers,
    },
    body: bytes,
  });
async function withServer(
  statuses: string[],
  run: (calls: string[]) => Promise<void>,
  uploadFails = false,
) {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.includes("/auth/v1/user")) {
      return Response.json({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    }
    if (url.includes("/rpc/reserve_result_card_share")) {
      return Response.json({
        status: statuses.shift() ?? "ready",
        id: requestId,
        objectPath: `shares/${requestId}.png`,
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
    }
    if (url.includes("/rpc/publish_result_card_share")) {
      return Response.json({
        status: "ready",
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
    }
    if (url.includes("/storage/v1/object/")) {
      return uploadFails
        ? Response.json({ error: "offline" }, { status: 503 })
        : Response.json({ Key: "image" });
    }
    return Response.json(null);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = original;
  }
}
Deno.test("rejects oversized body even with missing or forged length", async () => {
  for (
    const headers of [{}, { "content-length": "40" }] as Record<
      string,
      string
    >[]
  ) {
    await withServer(["reserved"], async (calls) => {
      assertEquals(
        (await handle(request(png(1_000_001), headers))).status,
        413,
      );
      assertEquals(calls.some((c) => c.includes("/storage/")), false);
    });
  }
});
Deno.test("validates real PNG and authentication before reserving", async () => {
  await withServer([], async (calls) => {
    assertEquals((await handle(request(new Uint8Array(40)))).status, 400);
    assertEquals(
      (await handle(request(png(), { authorization: "" }))).status,
      401,
    );
    assertEquals(calls.some((c) => c.includes("/rpc/")), false);
  });
});
Deno.test("retry after lost response uses one upload and the original expiry", async () => {
  await withServer(["reserved", "ready"], async (calls) => {
    const a = await handle(request());
    const b = await handle(request());
    assertEquals(a.status, 201);
    assertEquals(b.status, 201);
    assertEquals(await a.json(), await b.json());
    assertEquals(calls.filter((c) => c.includes("/storage/")).length, 1);
  });
});
Deno.test("reservation outcomes do not upload or manufacture links", async () => {
  for (
    const [state, status] of [
      ["pending", 202],
      ["expired", 410],
      ["conflict", 409],
      ["daily_limit", 429],
      ["capacity_reached", 503],
      ["cleanup_unhealthy", 503],
    ] as const
  ) {
    await withServer([state], async (calls) => {
      const response = await handle(request());
      assertEquals(response.status, status);
      assertEquals(calls.some((c) => c.includes("/storage/")), false);
      assertEquals((await response.json()).token, undefined);
    });
  }
});
Deno.test("storage failure leaves the charged reservation unpublished", async () => {
  await withServer(["reserved"], async (calls) => {
    assertEquals((await handle(request())).status, 503);
    assertEquals(calls.some((c) => c.includes("/rpc/publish")), false);
    assertEquals(calls.some((c) => c.startsWith("DELETE")), false);
  }, true);
});
