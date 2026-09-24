import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type EarningsEmployee = {
  id: string;
  profile_id: string;
  full_name: string | null;
  email: string | null;
  job_title: string | null;
  employment_status: string;
};

export type RevenueProject = {
  id: string;
  name: string;
  client_name: string | null;
  client_id: string | null;
  status: string;
};

export type CommissionEntry = {
  id: string;
  recipient_employee_id: string;
  commission_type: "closer" | "sponsor";
  percentage: number;
  amount: number;
  status: "pending" | "approved" | "paid";
  paid_at: string | null;
};

export type RevenueDeal = {
  id: string;
  project_id: string;
  total_amount: number;
  amount_paid: number;
  currency: string;
  payment_status: "pending" | "partially_paid" | "paid" | "cancelled";
  client_brought_by: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string;
  project: RevenueProject | null;
  commission_entries: CommissionEntry[];
};

function relation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function amount(value: unknown) {
  return Number(value ?? 0);
}

export async function listEarningsEmployees(): Promise<EarningsEmployee[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("employees")
    .select("id,profile_id,job_title,employment_status,profiles!employees_profile_id_fkey(full_name,email)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load earning members: ${error.message}`);
  return (data ?? []).map((row) => {
    const profile = relation(row.profiles as { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null);
    return { id: row.id, profile_id: row.profile_id, job_title: row.job_title, employment_status: row.employment_status, full_name: profile?.full_name ?? null, email: profile?.email ?? null };
  });
}

export async function listRevenueProjects(): Promise<RevenueProject[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("projects").select("id,name,client_name,client_id,status").order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load revenue projects: ${error.message}`);
  return (data ?? []) as RevenueProject[];
}

export async function listRevenueDeals(): Promise<RevenueDeal[]> {
  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .from("project_revenue")
    .select("id,project_id,total_amount,amount_paid,currency,payment_status,client_brought_by,closed_by,notes,created_at,projects(id,name,client_name,client_id,status),commission_entries(id,recipient_employee_id,commission_type,percentage,amount,status,paid_at)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load revenue deals: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    project_id: row.project_id,
    total_amount: amount(row.total_amount),
    amount_paid: amount(row.amount_paid),
    currency: row.currency,
    payment_status: row.payment_status,
    client_brought_by: row.client_brought_by,
    closed_by: row.closed_by,
    notes: row.notes,
    created_at: row.created_at,
    project: relation(row.projects as RevenueProject | RevenueProject[] | null),
    commission_entries: (row.commission_entries ?? []).map((entry: CommissionEntry) => ({ ...entry, percentage: amount(entry.percentage), amount: amount(entry.amount) })),
  }));
}

export type MemberEarningsSummary = {
  employee: EarningsEmployee | null;
  clientsGenerated: number;
  dealsClosed: number;
  personalSales: number;
  myCommission: number;
  pendingCommission: number;
  paidCommission: number;
  directMembers: number;
  activeMembers: number;
  theirProjects: number;
  teamRevenue: number;
  referralEarnings: number;
  monthlyEarnings: number;
  deals: RevenueDeal[];
  directMemberRows: EarningsEmployee[];
};

export async function getMemberEarningsSummary(employeeId: string): Promise<MemberEarningsSummary> {
  const db = createSupabaseAdminClient();
  const [employees, deals, { data: sponsorRows, error: sponsorError }] = await Promise.all([
    listEarningsEmployees(),
    listRevenueDeals(),
    db.from("member_sponsors").select("member_employee_id").eq("sponsor_employee_id", employeeId),
  ]);
  if (sponsorError) throw new Error(`Failed to load sponsor network: ${sponsorError.message}`);

  const employee = employees.find((item) => item.id === employeeId) ?? null;
  const directIds = (sponsorRows ?? []).map((row) => row.member_employee_id);
  const directMemberRows = employees.filter((item) => directIds.includes(item.id));
  const paidDeals = deals.filter((deal) => deal.payment_status === "paid");
  const personalDeals = paidDeals.filter((deal) => deal.closed_by === employeeId);
  const generatedDeals = paidDeals.filter((deal) => deal.client_brought_by === employeeId);
  const teamDeals = paidDeals.filter((deal) => directIds.includes(deal.closed_by ?? ""));
  const entries = deals.flatMap((deal) => deal.commission_entries.filter((entry) => entry.recipient_employee_id === employeeId));
  const sumEntries = (status?: CommissionEntry["status"]) => entries.filter((entry) => !status || entry.status === status).reduce((sum, entry) => sum + entry.amount, 0);
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthlyEarnings = entries.filter((entry) => {
    const deal = deals.find((item) => item.commission_entries.some((candidate) => candidate.id === entry.id));
    return deal ? new Date(deal.created_at) >= monthStart : false;
  }).reduce((sum, entry) => sum + entry.amount, 0);

  return {
    employee,
    clientsGenerated: generatedDeals.length,
    dealsClosed: personalDeals.length,
    personalSales: personalDeals.reduce((sum, deal) => sum + deal.amount_paid, 0),
    myCommission: sumEntries(),
    pendingCommission: entries.filter((entry) => entry.status !== "paid").reduce((sum, entry) => sum + entry.amount, 0),
    paidCommission: sumEntries("paid"),
    directMembers: directMemberRows.length,
    activeMembers: directMemberRows.filter((member) => member.employment_status === "active").length,
    theirProjects: teamDeals.length,
    teamRevenue: teamDeals.reduce((sum, deal) => sum + deal.amount_paid, 0),
    referralEarnings: entries.filter((entry) => entry.commission_type === "sponsor").reduce((sum, entry) => sum + entry.amount, 0),
    monthlyEarnings,
    deals: deals.filter((deal) => deal.client_brought_by === employeeId || deal.closed_by === employeeId || deal.commission_entries.some((entry) => entry.recipient_employee_id === employeeId)),
    directMemberRows,
  };
}

export function companyShare(deal: RevenueDeal) {
  return Math.max(0, deal.amount_paid - deal.commission_entries.reduce((sum, entry) => sum + entry.amount, 0));
}
