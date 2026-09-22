import { getTestContext, itDb, isSupabaseReachable } from "../helpers/test-client";
import { logAuditEvent } from "../../src/lib/audit/logger";

describe("Integration Tests: Audit Log Hardening (Batch 19)", () => {
  let ctx: Awaited<ReturnType<typeof getTestContext>>;
  let createdLogId: string | null = null;

  beforeAll(async () => {
    if (await isSupabaseReachable()) {
      ctx = await getTestContext();
    }
  });

  itDb("inserts an audit log with forensic fields (source, ip_address, org_context)", async () => {
    const { data: logEntry, error } = await ctx.serviceClient
      .from("activity_logs")
      .insert({
        actor_id: ctx.adminId,
        action_type: "employee.suspended",
        entity_type: "employee",
        entity_id: ctx.employeeId,
        metadata: { reason: "Security verification test" },
        source: "api",
        org_context: { tenant: "default" },
      })
      .select("id, action_type, source, org_context")
      .single();

    expect(error).toBeNull();
    expect(logEntry).toBeDefined();
    expect(logEntry?.action_type).toBe("employee.suspended");
    expect(logEntry?.source).toBe("api");
    expect((logEntry?.org_context as any)?.tenant).toBe("default");

    createdLogId = logEntry!.id;
  });

  itDb("prevents UPDATE mutations via database immutability trigger", async () => {
    expect(createdLogId).toBeDefined();

    // Attempting to update a historical audit record (even via serviceClient) MUST fail
    const { error } = await ctx.serviceClient
      .from("activity_logs")
      .update({ action_type: "tampered.event" })
      .eq("id", createdLogId!);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/immutable|cannot be updated or deleted/i);
  });

  itDb("prevents direct DELETE mutations via database immutability trigger", async () => {
    expect(createdLogId).toBeDefined();

    // Attempting to delete a historical audit record (even via serviceClient) MUST fail
    const { error } = await ctx.serviceClient
      .from("activity_logs")
      .delete()
      .eq("id", createdLogId!);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/immutable|cannot be updated or deleted/i);
  });

  itDb("enforces RLS: normal employees cannot read activity_logs", async () => {
    const { data, error } = await ctx.employeeClient
      .from("activity_logs")
      .select("id");

    // Employee query should either return an RLS error or an empty dataset
    if (error) {
      expect(error.message).toBeDefined();
    } else {
      expect(data?.length ?? 0).toBe(0);
    }
  });

  itDb("enforces RLS: administrators can read activity_logs", async () => {
    const { data, error } = await ctx.adminClient
      .from("activity_logs")
      .select("id, action_type")
      .limit(10);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  itDb("enforces RLS on activity_logs_archive: employees cannot read archive", async () => {
    const { data, error } = await ctx.employeeClient
      .from("activity_logs_archive")
      .select("id");

    if (error) {
      expect(error.message).toBeDefined();
    } else {
      expect(data?.length ?? 0).toBe(0);
    }
  });

  itDb("prevents non-admins from executing the archival procedure", async () => {
    const { error } = await ctx.employeeClient.rpc("archive_old_audit_logs", {
      p_days_retention: 90,
    });

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/administrator/i);
  });
});
