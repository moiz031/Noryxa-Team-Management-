import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const fullName = process.env.INITIAL_ADMIN_FULL_NAME?.trim() || email;

if (!url || !serviceRoleKey || !email) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and INITIAL_ADMIN_EMAIL in .env.local");
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: adminRole, error: roleError } = await supabase.from("roles").select("id").eq("code", "admin").single();
if (roleError || !adminRole) throw new Error(`Admin role is unavailable: ${roleError?.message ?? "missing role"}`);
const { data: existingAdmins, error: existingError } = await supabase.from("profiles").select("id").eq("role_id", adminRole.id).limit(1);
if (existingError) throw new Error(`Could not check existing admins: ${existingError.message}`);
if (existingAdmins?.length) throw new Error("An administrator already exists; first-admin provisioning is one-time only.");

const { data: userPage, error: userLookupError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (userLookupError) throw new Error(`Could not check Auth users: ${userLookupError.message}`);
let user = userPage.users.find((candidate) => candidate.email?.toLowerCase() === email);
if (!user) {
  const result = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: fullName } });
  if (result.error || !result.data.user) throw new Error(`Could not create admin Auth user: ${result.error?.message ?? "unknown error"}`);
  user = result.data.user;
}

const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, email, full_name: fullName, role_id: adminRole.id, is_active: true }, { onConflict: "id" });
if (profileError) throw new Error(`Could not provision admin profile: ${profileError.message}`);
console.log(`First administrator provisioned for ${email}. Sign in using the configured Supabase Auth email flow.`);
