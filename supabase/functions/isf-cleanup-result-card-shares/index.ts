import { BUCKET, json, serviceClient } from "../_shared/resultCardShare.ts";

export async function handleRequest(request: Request): Promise<Response> {
  const secret = Deno.env.get("RESULT_CARD_CLEANUP_SECRET");
  if (
    request.method !== "POST" || !secret ||
    request.headers.get("x-result-card-cleanup") !== secret
  ) return json({ code: "unauthorized" }, 401);
  const control = serviceClient();
  const deadline = new AbortController();
  const service = serviceClient(deadline.signal);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation: string | null = null;
  const result = {
    processed: 0,
    deleted: 0,
    failed: 0,
    unsettled: 0,
    complete: false,
  };
  try {
    const claim = await control.rpc("claim_result_card_cleanup");
    if (claim.error) throw claim.error;
    generation = claim.data;
    if (!generation) return json({ ...result, skipped: true });
    timer = setTimeout(() => deadline.abort(), 45_000);
    const started = performance.now();
    const policy = await service.from("result_card_share_policy").select("*")
      .eq("id", 1).single();
    if (policy.error) throw policy.error;
    let cursor: string | null = policy.data.cleanup_cursor,
      failedPass: boolean = policy.data.cleanup_failed;
    const now = new Date().toISOString(),
      pendingBefore = new Date(Date.now() - 15 * 60_000).toISOString();
    while (!deadline.signal.aborted && performance.now() - started < 45_000) {
      let query = service.from("result_card_shares").select(
        "id,object_path,upload_settled_at,state",
      ).neq("state", "deleted")
        .or(
          `owner_id.is.null,expires_at.lte.${now},and(state.eq.pending,created_at.lte.${pendingBefore}),state.eq.deleting`,
        ).order("id").limit(100);
      if (cursor) query = query.gt("id", cursor);
      const batch = await query;
      if (batch.error) {
        result.failed++;
        failedPass = true;
        break;
      }
      if (batch.data.length === 0) {
        result.complete = true;
        cursor = null;
        break;
      }
      for (const row of batch.data) {
        if (deadline.signal.aborted || performance.now() - started >= 45_000) {
          break;
        }
        cursor = row.id;
        result.processed++;
        try {
          const claimed = await service.from("result_card_shares").update({
            state: "deleting",
          }).eq("id", row.id).neq("state", "deleted")
            .or(
              `owner_id.is.null,expires_at.lte.${now},and(state.eq.pending,created_at.lte.${pendingBefore}),state.eq.deleting`,
            ).select("id,upload_settled_at");
          if (claimed.error) throw claimed.error;
          if (!claimed.data?.length) continue;
          const removed = await service.storage.from(BUCKET).remove([
            row.object_path,
          ]);
          if (removed.error) throw removed.error;
          const absence = await service.storage.from(BUCKET).info(
            row.object_path,
          );
          // A transport error or successful metadata read is not proof of absence.
          if (
            !absence.error ||
            String((absence.error as { statusCode?: string }).statusCode) !==
              "404"
          ) throw new Error("unconfirmed deletion");
          if (!claimed.data[0].upload_settled_at) {
            result.unsettled++;
            continue;
          }
          const released = await service.rpc("finish_result_card_delete", {
            p_id: row.id,
          });
          if (released.error || released.data !== true) {
            throw new Error("release failed");
          }
          result.deleted++;
        } catch {
          result.failed++;
          failedPass = true;
        }
      }
    }
    const progress: Record<string, unknown> = {
      cleanup_cursor: cursor,
      cleanup_failed: result.complete ? false : failedPass,
    };
    const saved = await control.from("result_card_share_policy").update(
      progress,
    ).eq("id", 1).eq("cleanup_generation", generation);
    if (saved.error) throw saved.error;
    // Cursor is durable before optional maintenance; reserve time outside the work deadline.
    if (deadline.signal.aborted) return json(result, 503);
    const tombstones = await service.from("result_card_shares").delete().eq(
      "state",
      "deleted",
    ).lt("created_at", new Date(Date.now() - 86400_000).toISOString()).lt(
      "deleted_at",
      new Date(Date.now() - 86400_000).toISOString(),
    );
    if (tombstones.error) {
      result.failed++;
      failedPass = true;
    }
    // Reconcile before the 24h freshness deadline; daily Cron can also request it.
    const body = await request.text();
    const inventoryRequested = body
      ? JSON.parse(body).mode === "inventory"
      : false;
    if (
      inventoryRequested || !policy.data.last_inventory_success_at ||
      Date.parse(policy.data.last_inventory_success_at) <
        Date.now() - 23 * 3600_000
    ) {
      const inventory = await service.rpc("reconcile_result_card_storage");
      if (inventory.error || !inventory.data?.valid) {
        await service.from("result_card_share_policy").update({
          inventory_valid: false,
        }).eq("id", 1);
        throw new Error("inventory failed");
      }
    }
    const logged = await service.from("result_card_share_runs").insert({
      mode: "cleanup",
      summary: result,
    });
    if (logged.error) throw logged.error;
    const pruned = await service.from("result_card_share_runs").delete().lt(
      "created_at",
      new Date(Date.now() - 7 * 86400_000).toISOString(),
    );
    if (pruned.error) throw pruned.error;
    if (result.complete && !failedPass) {
      const healthy = await control.from("result_card_share_policy").update({
        last_cleanup_success_at: new Date().toISOString(),
      }).eq("id", 1).eq("cleanup_generation", generation);
      if (healthy.error) throw healthy.error;
    }
    return json(result, result.failed ? 503 : 200);
  } catch {
    return json({ ...result, code: "cleanup_failed" }, 503);
  } finally {
    clearTimeout(timer);
    if (generation) {
      await control.from("result_card_share_policy").update({
        cleanup_lease_until: null,
      }).eq("id", 1).eq("cleanup_generation", generation);
    }
  }
}
if (import.meta.main) Deno.serve(handleRequest);
