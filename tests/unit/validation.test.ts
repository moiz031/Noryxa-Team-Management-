import {
  teamSchema,
  clientSchema,
  holidaySchema,
  leaveRequestSchema,
  dailyReportSchema,
  attendanceCorrectionSchema,
} from "@/lib/validation/batch2";
import { taskMutationSchema, timeEntrySchema } from "@/lib/validation/batch3";
import { announcementSchema, notificationPreferenceSchema, feedPostSchema } from "@/lib/validation/batch4";

describe("Unit Tests: Validation Schemas", () => {
  describe("Batch 2 Validation", () => {
    it("validates teamSchema correctly", () => {
      const valid = teamSchema.safeParse({ name: "Core Engineering", status: "active" });
      expect(valid.success).toBe(true);

      const invalidEmpty = teamSchema.safeParse({ name: "   " });
      expect(invalidEmpty.success).toBe(false);
    });

    it("validates clientSchema with email and status", () => {
      const valid = clientSchema.safeParse({
        name: "Acme Corp",
        email: "contact@acme.com",
        status: "active",
      });
      expect(valid.success).toBe(true);

      const invalidEmail = clientSchema.safeParse({
        name: "Acme Corp",
        email: "not-an-email",
      });
      expect(invalidEmail.success).toBe(false);
    });

    it("validates holidaySchema with valid ISO date", () => {
      const valid = holidaySchema.safeParse({
        name: "New Year",
        holiday_date: "2026-01-01",
        is_company_wide: true,
      });
      expect(valid.success).toBe(true);

      const invalidDate = holidaySchema.safeParse({
        name: "New Year",
        holiday_date: "01-01-2026",
      });
      expect(invalidDate.success).toBe(false);
    });

    it("enforces leaveRequestSchema date order", () => {
      const valid = leaveRequestSchema.safeParse({
        leaveType: "vacation",
        startsOn: "2026-06-01",
        endsOn: "2026-06-05",
      });
      expect(valid.success).toBe(true);

      const invalidOrder = leaveRequestSchema.safeParse({
        leaveType: "vacation",
        startsOn: "2026-06-10",
        endsOn: "2026-06-05",
      });
      expect(invalidOrder.success).toBe(false);
      if (!invalidOrder.success) {
        expect(invalidOrder.error.issues[0].message).toMatch(/End date must be on or after/);
      }
    });

    it("validates dailyReportSchema requirements", () => {
      const valid = dailyReportSchema.safeParse({
        reportDate: "2026-09-15",
        summary: "Completed prompt 16 database audit and started automated tests.",
        status: "submitted",
      });
      expect(valid.success).toBe(true);

      const emptySummary = dailyReportSchema.safeParse({
        reportDate: "2026-09-15",
        summary: "   ",
      });
      expect(emptySummary.success).toBe(false);
    });

    it("refines attendanceCorrectionSchema requires at least one field", () => {
      const empty = attendanceCorrectionSchema.safeParse({});
      expect(empty.success).toBe(false);

      const withStatus = attendanceCorrectionSchema.safeParse({ status: "remote" });
      expect(withStatus.success).toBe(true);
    });
  });

  describe("Batch 3 Validation", () => {
    it("validates taskMutationSchema statuses and priorities", () => {
      const valid = taskMutationSchema.safeParse({
        title: "Build automated test suite",
        status: "in_progress",
        priority: "urgent",
        due_date: "2026-09-20",
      });
      expect(valid.success).toBe(true);

      const invalidStatus = taskMutationSchema.safeParse({
        title: "Test task",
        status: "unknown_status" as any,
      });
      expect(invalidStatus.success).toBe(false);
    });

    it("validates timeEntrySchema", () => {
      const valid = timeEntrySchema.safeParse({
        task_id: "11111111-1111-4111-a111-111111111111",
        started_at: "2026-09-15T10:00:00.000Z",
      });
      expect(valid.success).toBe(true);

      const nonUuid = timeEntrySchema.safeParse({
        task_id: "not-a-uuid",
      });
      expect(nonUuid.success).toBe(false);
    });
  });

  describe("Batch 4 Validation", () => {
    it("validates feedPostSchema requires either team_id or project_id", () => {
      const validWithProject = feedPostSchema.safeParse({
        body: "Project kickoff announcement",
        project_id: "11111111-1111-4111-a111-111111111111",
      });
      expect(validWithProject.success).toBe(true);

      const invalidNoScope = feedPostSchema.safeParse({
        body: "Floating post with no team or project",
      });
      expect(invalidNoScope.success).toBe(false);
    });

    it("validates announcementSchema fields and audience", () => {
      const valid = announcementSchema.safeParse({
        title: "All-hands Meeting",
        body: "Join the quarterly review meeting on Friday.",
        audience: "all",
        isPinned: true,
      });
      expect(valid.success).toBe(true);

      const invalidAudience = announcementSchema.safeParse({
        title: "Meeting",
        body: "Details",
        audience: "secret" as any,
      });
      expect(invalidAudience.success).toBe(false);
    });

    it("validates notificationPreferenceSchema requires at least one toggle", () => {
      const empty = notificationPreferenceSchema.safeParse({});
      expect(empty.success).toBe(false);

      const valid = notificationPreferenceSchema.safeParse({
        task_notifications: true,
      });
      expect(valid.success).toBe(true);
    });
  });
});
