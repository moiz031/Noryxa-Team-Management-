import { z } from "zod";

export const teamSchema = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(2000).nullable().optional(), department_id: z.string().uuid().nullable().optional(), lead_employee_id: z.string().uuid().nullable().optional(), status: z.enum(["active", "inactive", "archived"]).optional() });
export const clientSchema = z.object({ name: z.string().trim().min(1).max(160), company_name: z.string().trim().max(200).nullable().optional(), email: z.string().email().nullable().optional(), phone: z.string().max(40).nullable().optional(), notes: z.string().max(4000).nullable().optional(), status: z.enum(["lead", "active", "inactive", "archived"]).optional() });
export const holidaySchema = z.object({ name: z.string().trim().min(1).max(160), holiday_date: z.string().date(), description: z.string().max(2000).nullable().optional(), is_company_wide: z.boolean().optional(), department_id: z.string().uuid().nullable().optional() });
export const projectMemberSchema = z.object({ project_id: z.string().uuid(), employee_id: z.string().uuid(), role: z.enum(["owner", "manager", "member", "viewer"]) });
export const scheduleSchema = z.object({ name: z.string().trim().min(1).max(120), timezone: z.string().trim().min(1).max(80) });
export const scheduleAssignmentSchema = z.object({ schedule_id: z.string().uuid(), employee_id: z.string().uuid(), starts_on: z.string().date().optional(), ends_on: z.string().date().nullable().optional() });
export const attendanceCorrectionSchema = z.object({
  status: z.enum(["present", "late", "absent", "half_day", "remote", "excused"]).optional(),
  checkInAt: z.string().datetime({ offset: true }).nullable().optional(),
  checkOutAt: z.string().datetime({ offset: true }).nullable().optional(),
  note: z.string().trim().max(2000).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one attendance field is required");
export const leaveRequestSchema = z.object({
  leaveType: z.string().trim().min(1).max(120),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  reason: z.string().trim().max(4000).nullable().optional(),
}).refine((value) => value.endsOn >= value.startsOn, { message: "End date must be on or after start date", path: ["endsOn"] });
export const dailyReportSchema = z.object({
  reportDate: z.string().date(),
  summary: z.string().trim().min(1).max(10000),
  blockers: z.string().trim().max(4000).nullable().optional(),
  tomorrowPlan: z.string().trim().max(4000).nullable().optional(),
  status: z.enum(["draft", "submitted"]).optional(),
});
