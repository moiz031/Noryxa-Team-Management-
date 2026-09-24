export type NotificationSectionKey =
  | "dashboard"
  | "tasks"
  | "projects"
  | "employees"
  | "departments"
  | "teams"
  | "clients"
  | "reports"
  | "attendance"
  | "leave"
  | "schedules"
  | "announcements"
  | "feed"
  | "learning"
  | "earnings"
  | "documents"
  | "notifications"
  | "analytics"
  | "scorecard"
  | "settings";

/**
 * Keeps the notification badge mapping in one place for both admin and
 * employee navigation. Entity types are deliberately broad because audit
 * events use both singular and compound entity names.
 */
export function getNotificationSectionKey(
  entityType: string | null | undefined,
  type?: string | null,
): NotificationSectionKey {
  const value = `${entityType ?? ""} ${type ?? ""}`.toLowerCase();

  if (value.includes("notification")) return "notifications";
  if (value.includes("task") || value.includes("checklist") || value.includes("dependency")) return "tasks";
  if (value.includes("project") || value.includes("milestone")) return "projects";
  if (value.includes("employee") || value.includes("profile")) return "employees";
  if (value.includes("department")) return "departments";
  if (value.includes("team")) return "teams";
  if (value.includes("client")) return "clients";
  if (value.includes("report")) return "reports";
  if (value.includes("attendance") || value.includes("clock")) return "attendance";
  if (value.includes("leave")) return "leave";
  if (value.includes("schedule") || value.includes("holiday")) return "schedules";
  if (value.includes("announcement")) return "announcements";
  if (value.includes("feed") || value.includes("comment") || value.includes("mention") || value.includes("reaction")) return "feed";
  if (value.includes("learning") || value.includes("academy") || value.includes("sop") || value.includes("training")) return "learning";
  if (value.includes("earning") || value.includes("commission") || value.includes("payout") || value.includes("revenue")) return "earnings";
  if (value.includes("document") || value.includes("file") || value.includes("attachment")) return "documents";
  if (value.includes("analytic") || value.includes("scorecard")) return "analytics";
  if (value.includes("setting")) return "settings";

  return "notifications";
}
