const siteUrl = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const publicRoutes = [
  "",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/community",
  "/feed",
];

const adminRoutes = [
  "/admin",
  "/admin/projects",
  "/admin/tasks",
  "/admin/employees",
  "/admin/departments",
  "/admin/teams",
  "/admin/clients",
  "/admin/daily-reports",
  "/admin/attendance",
  "/admin/leave",
  "/admin/schedules",
  "/admin/holidays",
  "/admin/announcements",
  "/admin/learn",
  "/admin/earnings",
  "/admin/activity",
  "/admin/analytics",
  "/admin/scorecards",
  "/admin/settings",
];

const employeeRoutes = [
  "/dashboard",
  "/tasks",
  "/projects",
  "/reports",
  "/attendance",
  "/leave",
  "/announcements",
  "/feed",
  "/community",
  "/learn",
  "/earnings",
  "/documents",
  "/notifications",
  "/analytics",
  "/scorecard",
];

export default function sitemap() {
  const routes = [...publicRoutes, ...adminRoutes, ...employeeRoutes];

  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route.startsWith("/admin") || route.startsWith("/dashboard") ? 0.5 : 0.7,
  }));
}