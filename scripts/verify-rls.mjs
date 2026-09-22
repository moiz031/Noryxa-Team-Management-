import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const required = ["VERIFY_ADMIN_EMAIL", "VERIFY_ADMIN_PASSWORD", "VERIFY_EMPLOYEE_EMAIL", "VERIFY_EMPLOYEE_PASSWORD"];
if (!url || !key || required.some((name) => !process.env[name])) throw new Error(`Set Supabase URL/key and ${required.join(", ")} in .env.local`);

function client() { return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }); }
async function signIn(email, password) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`Could not sign in verification user: ${error?.message ?? "missing user"}`);
  return { supabase, user: data.user };
}
function pass(name) { console.log(`PASS ${name}`); }
function fail(message) { throw new Error(`FAIL ${message}`); }

const anonymous = client();
const admin = await signIn(process.env.VERIFY_ADMIN_EMAIL, process.env.VERIFY_ADMIN_PASSWORD);
const employee = await signIn(process.env.VERIFY_EMPLOYEE_EMAIL, process.env.VERIFY_EMPLOYEE_PASSWORD);
const adminProfile = await admin.supabase.from("profiles").select("id, role_id").eq("id", admin.user.id).single();
if (adminProfile.error || !adminProfile.data) fail(`admin cannot read own profile: ${adminProfile.error?.message}`);
const employeeProfile = await employee.supabase.from("profiles").select("id, role_id").eq("id", employee.user.id).single();
if (employeeProfile.error || !employeeProfile.data) fail(`employee cannot read own profile: ${employeeProfile.error?.message}`);
pass("admin profile access"); pass("employee self profile access");

const employeeAdminProfile = await employee.supabase.from("profiles").select("id").eq("id", admin.user.id);
if (employeeAdminProfile.data?.length) fail("employee can read another profile");
pass("employee cannot read admin profile");
const adminRoles = await admin.supabase.from("roles").select("id, code");
const employeeRoles = await employee.supabase.from("roles").select("id, code");
if (adminRoles.error || employeeRoles.error) fail("roles read policy failed");
pass("roles read for authenticated users");
const departments = await employee.supabase.from("departments").select("id");
if (departments.error) fail(`employee department read failed: ${departments.error.message}`);
pass("department read policy");
const employeeRecord = await employee.supabase.from("employees").select("id").eq("profile_id", employee.user.id).single();
if (employeeRecord.error || !employeeRecord.data) fail("employee self employee access failed");
pass("employee self employee access");
const adminEmployeeFromEmployee = await employee.supabase.from("employees").select("id").eq("profile_id", admin.user.id);
if (adminEmployeeFromEmployee.data?.length) fail("employee can read admin employee record");
pass("employee cannot read admin employee record");

const adminRoleId = adminRoles.data?.find((role) => role.code === "admin")?.id;
if (!adminRoleId) fail("admin role is missing");
const escalation = await employee.supabase.from("profiles").update({ role_id: adminRoleId }).eq("id", employee.user.id);
if (!escalation.error) {
  const employeeRoleId = employeeRoles.data?.find((role) => role.code === "employee")?.id;
  if (employeeRoleId) await employee.supabase.from("profiles").update({ role_id: employeeRoleId }).eq("id", employee.user.id);
  fail("employee role escalation unexpectedly succeeded");
}
pass("employee role escalation blocked");
const anonymousProfile = await anonymous.from("profiles").select("id").eq("id", admin.user.id);
if (anonymousProfile.data?.length) fail("anonymous profile access is open");
pass("anonymous profile access blocked");
console.log("RLS verification completed.");
