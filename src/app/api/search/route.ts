import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { multiEntitySearch, SearchEntityType } from "@/lib/db/search";

const VALID_ENTITIES: SearchEntityType[] = [
  "tasks",
  "projects",
  "employees",
  "teams",
  "clients",
  "documents",
  "announcements",
];

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const entitiesParam = url.searchParams.get("entities");
    const limitParam = url.searchParams.get("limit");
    const pageParam = url.searchParams.get("page");

    if (q.trim().length < 2) {
      return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
    }
    if (q.trim().length > 100) {
      return NextResponse.json({ error: "Query too long (max 100 characters)" }, { status: 400 });
    }

    const requestedEntities = entitiesParam
      ? entitiesParam
          .split(",")
          .map((e) => e.trim())
          .filter((e): e is SearchEntityType => VALID_ENTITIES.includes(e as SearchEntityType))
      : undefined;

    const limit = Math.min(50, Math.max(1, parseInt(limitParam ?? "10", 10)));
    const page = Math.max(1, parseInt(pageParam ?? "1", 10));

    const employeeId = auth.profile.employees?.[0]?.id;

    const response = await multiEntitySearch({
      q: q.trim(),
      entities: requestedEntities,
      limit,
      page,
      role: auth.role as "admin" | "employee",
      userId: auth.user.id,
      employeeId,
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
