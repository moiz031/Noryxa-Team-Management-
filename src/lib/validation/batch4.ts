import { z } from "zod";

export const feedPostSchema = z.object({
  body: z.string().trim().min(1).max(10000),
  team_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
}).refine((value) => value.team_id || value.project_id, { message: "A team or project is required" });

export const feedCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  parent_comment_id: z.string().uuid().nullable().optional(),
});

export const reactionSchema = z.object({
  entity_type: z.enum(["feed_post", "feed_comment", "announcement", "task_comment"]),
  entity_id: z.string().uuid(),
  reaction: z.enum(["like", "celebrate", "support", "important"]),
});

export const notificationPreferenceSchema = z.object({
  task_notifications: z.boolean().optional(),
  report_notifications: z.boolean().optional(),
  leave_notifications: z.boolean().optional(),
  mention_notifications: z.boolean().optional(),
  announcement_notifications: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

export const announcementSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
  audience: z.enum(["all", "department"]).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isPinned: z.boolean().optional(),
});
