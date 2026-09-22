import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const adminEmail = "verify.admin@agency-os.internal";
const adminPassword = "VerifyAdminPassword#2026";
const employeeEmail = "verify.employee@agency-os.internal";
const employeePassword = "VerifyEmployeePassword#2026";

async function ensureUser(email, password, roleCode, fullName) {
  const { data: role, error: roleErr } = await supabase
    .from("roles")
    .select("id")
    .eq("code", roleCode)
    .single();
  if (roleErr || !role) throw new Error(`Role ${roleCode} not found: ${roleErr?.message}`);

  const { data: userPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = userPage?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!user) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createErr || !created.user) throw new Error(`Failed to create ${email}: ${createErr?.message}`);
    user = created.user;
  } else {
    // Update password to ensure it matches
    await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  }

  // Ensure profile
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
      role_id: role.id,
      is_active: true,
    },
    { onConflict: "id" }
  );

  // If employee role, ensure employees record exists
  if (roleCode === "employee") {
    const { data: existingEmp } = await supabase
      .from("employees")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (!existingEmp) {
      await supabase.from("employees").insert({
        profile_id: user.id,
        employment_status: "active",
        job_title: "Verification Engineer",
      });
    } else {
      await supabase
        .from("employees")
        .update({ employment_status: "active" })
        .eq("id", existingEmp.id);
    }
  }

  return user;
}

await ensureUser(adminEmail, adminPassword, "admin", "Verify Admin");
await ensureUser(employeeEmail, employeePassword, "employee", "Verify Employee");

// Update .env.local safely
const envPath = resolve(process.cwd(), ".env.local");
let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

function updateEnvVar(key, val) {
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `${key}=${val}`);
  } else {
    envContent = (envContent.trim() ? envContent.trim() + "\n" : "") + `${key}=${val}\n`;
  }
}

updateEnvVar("VERIFY_ADMIN_EMAIL", adminEmail);
updateEnvVar("VERIFY_ADMIN_PASSWORD", adminPassword);
updateEnvVar("VERIFY_EMPLOYEE_EMAIL", employeeEmail);
updateEnvVar("VERIFY_EMPLOYEE_PASSWORD", employeePassword);
updateEnvVar("VERIFY_APP_URL", "http://localhost:3000");

writeFileSync(envPath, envContent, "utf-8");
console.log("Verification accounts configured successfully.");
