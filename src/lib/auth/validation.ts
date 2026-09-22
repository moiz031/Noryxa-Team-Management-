import { z } from "zod";

export const employeeOnboardingSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  departmentId: z.string().uuid().nullable().optional(),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  joinedOn: z.string().date().nullable().optional(),
  employmentStatus: z.enum(["pending", "active", "suspended", "inactive"]).default("pending"),
  role: z.literal("employee").default("employee"),
});

export type EmployeeOnboardingInput = z.infer<typeof employeeOnboardingSchema>;
