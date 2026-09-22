import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SearchEntityType =
  | "tasks"
  | "projects"
  | "employees"
  | "teams"
  | "clients"
  | "documents"
  | "announcements";

export interface SearchResult {
  entity: SearchEntityType;
  id: string;
  title: string;
  subtitle?: string;
  url?: string;
  score?: number;
}

export interface SearchOptions {
  q: string;
  entities?: SearchEntityType[];
  limit?: number;
  page?: number;
  role: "admin" | "employee";
  userId: string;
  employeeId?: string;
}

export interface SearchResponse {
  q: string;
  results: Record<SearchEntityType, SearchResult[]>;
  totalResults: number;
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
  scope: "organization" | "employee";
}

type EmployeeSearchRow = {
  id: string;
  job_title: string | null;
  profiles:
    | { full_name: string | null; email: string | null }
    | Array<{ full_name: string | null; email: string | null }>
    | null;
};

function calculateRank(title: string, query: string, subtitle?: string): number {
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const words = t.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  if (subtitle && subtitle.toLowerCase().includes(q)) return 20;
  return 10;
}

function sortByRank(items: SearchResult[], query: string): SearchResult[] {
  return items
    .map((item) => ({ ...item, score: calculateRank(item.title, query, item.subtitle) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function normalizeSearchQuery(q: string): string {
  return q.trim().replace(/\s+/g, " ");
}

export async function multiEntitySearch(options: SearchOptions): Promise<SearchResponse> {
  const { q, entities, limit = 10, page = 1, role, employeeId } = options;
  const normalizedQ = normalizeSearchQuery(q);
  const term = `%${normalizedQ}%`;
  const offset = Math.max(0, (page - 1) * limit);

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const allEntities: SearchEntityType[] = [
    "tasks",
    "projects",
    "employees",
    "teams",
    "clients",
    "documents",
    "announcements",
  ];

  const activeEntities: SearchEntityType[] = entities?.length
    ? entities.filter((e) => allEntities.includes(e))
    : allEntities;

  const results: Record<SearchEntityType, SearchResult[]> = {
    tasks: [],
    projects: [],
    employees: [],
    teams: [],
    clients: [],
    documents: [],
    announcements: [],
  };

  // Get employee's accessible project IDs and team IDs if searching as an employee
  let accessibleProjectIds: string[] = [];
  let accessibleTeamIds: string[] = [];
  let employeeDepartmentId: string | null = null;

  if (role === "employee" && employeeId) {
    const [{ data: memberProjects }, { data: empData }, { data: memberTeams }] = await Promise.all([
      adminClient.from("project_members").select("project_id").eq("employee_id", employeeId),
      adminClient.from("employees").select("department_id").eq("id", employeeId).maybeSingle(),
      activeEntities.includes("teams")
        ? adminClient.from("team_members").select("team_id").eq("employee_id", employeeId)
        : Promise.resolve({ data: [] as { team_id: string }[] }),
    ]);
    accessibleProjectIds = (memberProjects ?? []).map((p) => p.project_id);
    accessibleTeamIds = (memberTeams ?? []).map((m) => m.team_id);
    employeeDepartmentId = empData?.department_id ?? null;
  }

  await Promise.all(
    activeEntities.map(async (entity) => {
      try {
        switch (entity) {
          case "tasks": {
            let query = supabase
              .from("tasks")
              .select("id, title, status, project_id")
              .ilike("title", term)
              .range(offset, offset + limit - 1);

            if (role === "employee" && employeeId) {
              if (accessibleProjectIds.length > 0) {
                query = query.or(`assigned_to.eq.${employeeId},project_id.in.(${accessibleProjectIds.join(",")})`);
              } else {
                query = query.eq("assigned_to", employeeId);
              }
            }

            const { data } = await query;
            results.tasks = sortByRank(
              (data ?? []).map((t) => ({
                entity: "tasks",
                id: t.id,
                title: t.title,
                subtitle: t.status,
                url: `/tasks`,
              })),
              normalizedQ
            );
            break;
          }

          case "projects": {
            let query = supabase
              .from("projects")
              .select("id, name, status")
              .ilike("name", term)
              .range(offset, offset + limit - 1);

            if (role === "employee" && employeeId) {
              if (accessibleProjectIds.length > 0) {
                query = query.in("id", accessibleProjectIds);
              } else {
                results.projects = [];
                break;
              }
            }

            const { data } = await query;
            results.projects = sortByRank(
              (data ?? []).map((p) => ({
                entity: "projects",
                id: p.id,
                title: p.name,
                subtitle: p.status,
                url: `/projects`,
              })),
              normalizedQ
            );
            break;
          }

          case "employees": {
            if (role === "admin") {
              const { data } = await adminClient
                .from("profiles")
                .select("id, full_name, email")
                .or(`full_name.ilike.${term},email.ilike.${term}`)
                .range(offset, offset + limit - 1);

              results.employees = sortByRank(
                (data ?? []).map((e) => ({
                  entity: "employees",
                  id: e.id,
                  title: e.full_name ?? e.email,
                  subtitle: e.email,
                  url: `/admin/employees`,
                })),
                normalizedQ
              );
            } else {
              // Employee search: Directory mode only for active coworkers
              const { data } = await adminClient
                .from("employees")
                .select("id, job_title, department_id, profiles!inner(id, full_name, email)")
                .eq("employment_status", "active")
                .or(`profiles.full_name.ilike.${term},job_title.ilike.${term}`)
                .range(offset, offset + limit - 1);

              results.employees = sortByRank(
                (data as EmployeeSearchRow[] ?? []).map((e) => ({
                  entity: "employees",
                  id: e.id,
                  title: Array.isArray(e.profiles) ? e.profiles[0]?.full_name || "Coworker" : e.profiles?.full_name || "Coworker",
                  subtitle: e.job_title || "Team Member",
                  url: `/directory`,
                })),
                normalizedQ
              );
            }
            break;
          }

          case "teams": {
            let query = adminClient
              .from("teams")
              .select("id, name, description, department_id, status")
              .ilike("name", term)
              .range(offset, offset + limit - 1);

            if (role === "employee" && employeeId) {
              if (accessibleTeamIds.length > 0 || employeeDepartmentId) {
                const filters: string[] = [];
                if (accessibleTeamIds.length > 0) filters.push(`id.in.(${accessibleTeamIds.join(",")})`);
                if (employeeDepartmentId) filters.push(`department_id.eq.${employeeDepartmentId}`);
                query = query.or(filters.join(","));
              } else {
                results.teams = [];
                break;
              }
            }

            const { data } = await query;
            results.teams = sortByRank(
              (data ?? []).map((t) => ({
                entity: "teams",
                id: t.id,
                title: t.name,
                subtitle: t.description || undefined,
                url: `/teams`,
              })),
              normalizedQ
            );
            break;
          }

          case "clients": {
            let query = adminClient
              .from("clients")
              .select("id, name, company_name, status")
              .or(`name.ilike.${term},company_name.ilike.${term}`)
              .range(offset, offset + limit - 1);

            if (role === "employee" && employeeId) {
              // Employee can only see clients for projects they are assigned to
              if (accessibleProjectIds.length > 0) {
                const { data: clientProjects } = await adminClient
                  .from("projects")
                  .select("client_id")
                  .in("id", accessibleProjectIds)
                  .not("client_id", "is", null);

                const clientIds = (clientProjects ?? [])
                  .map((cp) => cp.client_id)
                  .filter((id): id is string => Boolean(id));

                if (clientIds.length > 0) {
                  query = query.in("id", clientIds);
                } else {
                  results.clients = [];
                  break;
                }
              } else {
                results.clients = [];
                break;
              }
            }

            const { data } = await query;
            results.clients = sortByRank(
              (data ?? []).map((c) => ({
                entity: "clients",
                id: c.id,
                title: c.name,
                subtitle: c.company_name || c.status,
                url: `/clients`,
              })),
              normalizedQ
            );
            break;
          }

          case "documents": {
            // Uses RLS on documents via authenticated server client
            const { data } = await supabase
              .from("documents")
              .select("id, title, category")
              .ilike("title", term)
              .range(offset, offset + limit - 1);

            results.documents = sortByRank(
              (data ?? []).map((d) => ({
                entity: "documents",
                id: d.id,
                title: d.title,
                subtitle: d.category,
                url: `/documents`,
              })),
              normalizedQ
            );
            break;
          }

          case "announcements": {
            // Uses RLS on announcements via authenticated server client
            const { data } = await supabase
              .from("announcements")
              .select("id, title, priority, published_at")
              .ilike("title", term)
              .range(offset, offset + limit - 1);

            results.announcements = sortByRank(
              (data ?? []).map((a) => ({
                entity: "announcements",
                id: a.id,
                title: a.title,
                subtitle: a.priority,
                url: `/announcements`,
              })),
              normalizedQ
            );
            break;
          }
        }
      } catch {
        // Individual entity search error is safely isolated
      }
    })
  );

  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);
  const hasMore = Object.values(results).some((arr) => arr.length === limit);

  return {
    q: normalizedQ,
    results,
    totalResults,
    pagination: {
      page,
      limit,
      hasMore,
    },
    scope: role === "admin" ? "organization" : "employee",
  };
}
