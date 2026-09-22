import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AuditEventType =
  // Employee events
  | "employee.invited"
  | "employee.activated"
  | "employee.suspended"
  | "employee.reactivated"
  | "employee.role_changed"
  | "employee.updated"
  | "employee.deleted"
  // Project events
  | "project.created"
  | "project.updated"
  | "project.deleted"
  // Project membership events
  | "project_member.added"
  | "project_member.removed"
  | "project_member.role_changed"
  // Leave events
  | "leave.requested"
  | "leave.approved"
  | "leave.rejected"
  | "leave.cancelled"
  // Task events
  | "task.created"
  | "task.updated"
  | "task.assigned"
  | "task.status_changed"
  | "task.completed"
  | "task.deleted"
  // File and document events
  | "file.uploaded"
  | "file.updated"
  | "file.deleted"
  | "document.created"
  | "document.updated"
  | "document.deleted"
  // Announcement events
  | "announcement.created"
  | "announcement.updated"
  | "announcement.deleted"
  // Daily report events
  | "daily_report.submitted"
  | "daily_report.reviewed"
  // Attendance events
  | "attendance.checked_in"
  | "attendance.checked_out"
  | "attendance.corrected"
  // Settings events
  | "settings.updated"
  // Notification events
  | "notification.generated"
  // Department events
  | "department.created"
  | "department.updated"
  | "department.deleted"
  // Extensible union fallback
  | (string & {});

export type AuditSource = "api" | "rpc" | "automation" | "system";

export interface LogAuditParams {
  actorId?: string | null;
  event: AuditEventType;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  source?: AuditSource;
  ipAddress?: string | null;
  orgContext?: Record<string, unknown>;
  request?: Request | Headers | null;
}

const SENSITIVE_KEY_SUBSTRINGS = [
  "password",
  "token",
  "secret",
  "key",
  "authorization",
  "cookie",
  "credential",
  "hash",
  "bearer",
  "private",
];

/**
 * Recursively scrubs known sensitive keys from audit log metadata.
 */
export function scrubMetadata(data: unknown, depth = 0): unknown {
  if (depth > 5) return "[TRUNCATED_DEPTH]";
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    if (data.length > 50) {
      return [
        ...data.slice(0, 50).map((item) => scrubMetadata(item, depth + 1)),
        `[...${data.length - 50} more items]`,
      ];
    }
    return data.map((item) => scrubMetadata(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    const isSensitive = SENSITIVE_KEY_SUBSTRINGS.some((sub) => lower.includes(sub));
    if (isSensitive) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = scrubMetadata(value, depth + 1);
    }
  }
  return result;
}

/**
 * Bounds metadata size to prevent storage bloat and performance degradation.
 */
export function boundMetadata(
  metadata: Record<string, unknown> | undefined,
  maxBytes = 8192
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const scrubbed = scrubMetadata(metadata) as Record<string, unknown>;
  try {
    const serialized = JSON.stringify(scrubbed);
    if (serialized.length > maxBytes) {
      return {
        _truncated: true,
        _original_byte_length: serialized.length,
        preview: serialized.slice(0, 1024),
      };
    }
  } catch {
    return { _error: "Failed to serialize audit metadata" };
  }
  return scrubbed;
}

/**
 * Extracts client IP from standard proxy / gateway headers.
 */
export function extractClientIp(req?: Request | Headers | null): string | null {
  if (!req) return null;
  const headers = req instanceof Request ? req.headers : req;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0].trim();
    if (ip) return ip;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }
  return null;
}

/**
 * Type-safe, scrubbed enterprise audit logger.
 * 
 * - Enforces append-oriented design
 * - Scrubs credentials and secrets
 * - Bounds metadata to prevent leaks
 * - Captures actor, event, entity, ip, source, org context
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const {
      actorId,
      event,
      entityType = null,
      entityId = null,
      metadata = {},
      source = "api",
      ipAddress: explicitIp,
      orgContext = {},
      request,
    } = params;

    const safeMetadata = boundMetadata(metadata);
    const ip = explicitIp || extractClientIp(request);

    // Attempt RPC call via user server client if actor matches session
    try {
      const serverClient = await createSupabaseServerClient();
      const sessionUser = (await serverClient.auth.getUser()).data.user;

      if (sessionUser && (!actorId || actorId === sessionUser.id)) {
        const { error } = await serverClient.rpc("log_activity", {
          p_action_type: event,
          p_entity_type: entityType,
          p_entity_id: entityId,
          p_metadata: safeMetadata,
          p_source: source,
          p_ip_address: ip,
          p_org_context: orgContext,
        });

        if (!error) return;
      }
    } catch {
      // If serverClient cannot be initialized (e.g. background worker or no cookies), continue to admin client
    }

    // Direct insert via privileged admin client (service_role)
    const admin = createSupabaseAdminClient();
    await admin.from("activity_logs").insert({
      actor_id: actorId || null,
      action_type: event,
      entity_type: entityType,
      entity_id: entityId,
      metadata: safeMetadata,
      source: source,
      ip_address: ip,
      org_context: orgContext,
    });
  } catch (err) {
    // Audit logging failure must not crash the parent transaction/request
    console.error("Audit logger encountered an error:", err);
  }
}
