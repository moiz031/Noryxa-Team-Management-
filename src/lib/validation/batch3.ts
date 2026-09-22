import { z } from "zod";

export const taskMutationSchema = z.object({
  project_id: z.string().uuid().nullable().optional(),
  parent_task_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(["backlog", "todo", "in_progress", "blocked", "review", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  due_date: z.string().date().nullable().optional(),
});
export const checklistSchema = z.object({ title: z.string().trim().min(1).max(500), is_completed: z.boolean().optional(), position: z.number().int().min(0).optional() });
export const dependencySchema = z.object({ depends_on_task_id: z.string().uuid() });
export const timeEntrySchema = z.object({
  task_id: z.string().uuid(),
  employee_id: z.string().uuid().optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
