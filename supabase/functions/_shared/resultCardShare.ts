import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0";
export const BUCKET = "result-card-shares";
export const MAX_RESULT_CARD_BYTES = 1_000_000;
export const required = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error("Missing server configuration");
  return value;
};
export function serviceClient() {
  return createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: timedFetch },
    },
  );
}
export const timedFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
      : AbortSignal.timeout(30_000),
  });
export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = createClient(
    required("SUPABASE_URL"),
    required("SUPABASE_ANON_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization }, fetch: timedFetch },
    },
  );
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}
export async function sha256(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string"
    ? new TextEncoder().encode(value)
    : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}
export function json(
  body: unknown,
  status = 200,
  headers = new Headers(),
): Response {
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}
export async function readLimitedPng(request: Request): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > MAX_RESULT_CARD_BYTES) {
    throw json({ code: "image_too_large" }, 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw json({ code: "invalid_image" }, 400);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const consume = async () => {
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_RESULT_CARD_BYTES) {
        await reader.cancel();
        throw json({ code: "image_too_large" }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    if (
      length < 33 ||
      ![137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82].every((
        v,
        i,
      ) => bytes[i] === v)
    ) throw json({ code: "invalid_image" }, 400);
    const view = new DataView(bytes.buffer);
    if (view.getUint32(16) !== 1080 || view.getUint32(20) !== 1440) {
      throw json({ code: "invalid_image" }, 400);
    }
    return bytes;
  };
  try {
    return await Promise.race([
      consume(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void reader.cancel();
          reject(json({ code: "request_timeout" }, 408));
        }, 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
