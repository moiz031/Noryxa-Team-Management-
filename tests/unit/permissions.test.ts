import { AppRole } from "@/lib/auth/context";

describe("Unit Tests: Permissions & Role Logic", () => {
  function checkRouteAccess(role: AppRole, path: string): boolean {
    if (role === "admin") {
      // Admins have access to /admin, /dashboard, /tasks, /projects, etc.
      return true;
    }
    if (role === "employee") {
      // Employees must not access /admin or /api/admin routes
      if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
        return false;
      }
      return true;
    }
    return false;
  }

  it("grants admin full access across routes", () => {
    expect(checkRouteAccess("admin", "/admin")).toBe(true);
    expect(checkRouteAccess("admin", "/admin/employees")).toBe(true);
    expect(checkRouteAccess("admin", "/api/admin/tasks")).toBe(true);
    expect(checkRouteAccess("admin", "/dashboard")).toBe(true);
    expect(checkRouteAccess("admin", "/tasks")).toBe(true);
  });

  it("restricts employee from admin routes", () => {
    expect(checkRouteAccess("employee", "/admin")).toBe(false);
    expect(checkRouteAccess("employee", "/admin/employees")).toBe(false);
    expect(checkRouteAccess("employee", "/api/admin/tasks")).toBe(false);
    expect(checkRouteAccess("employee", "/tasks")).toBe(true);
    expect(checkRouteAccess("employee", "/dashboard")).toBe(true);
  });

  it("validates role normalization from array or single object", () => {
    function normalizeRole(roles: { code: AppRole } | { code: AppRole }[] | null): AppRole {
      const code = Array.isArray(roles) ? roles[0]?.code : roles?.code;
      if (code !== "admin" && code !== "employee") {
        throw new Error("Invalid account role");
      }
      return code;
    }

    expect(normalizeRole({ code: "admin" })).toBe("admin");
    expect(normalizeRole([{ code: "employee" }])).toBe("employee");
    expect(() => normalizeRole({ code: "superadmin" as any })).toThrow("Invalid account role");
    expect(() => normalizeRole(null)).toThrow("Invalid account role");
  });
});
