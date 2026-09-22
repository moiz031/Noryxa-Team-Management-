"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { OrganizationSettings } from "@/lib/db/organization-settings";

export function OrganizationSettingsForm({ initial }: { initial: OrganizationSettings | null }) {
  const [form, setForm] = useState({
    organization_name: initial?.organization_name ?? "",
    timezone: initial?.timezone ?? "UTC",
    default_work_start_time: initial?.default_work_start_time ?? "09:00",
    default_work_end_time: initial?.default_work_end_time ?? "17:00",
    max_file_upload_mb: initial?.max_file_upload_mb ?? 10,
    default_leave_days_per_year: initial?.default_leave_days_per_year ?? 20,
    allow_employee_feed_post: initial?.allow_employee_feed_post ?? true,
    allow_employee_comment: initial?.allow_employee_comment ?? true,
  });
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings/organization", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, max_file_upload_mb: Number(form.max_file_upload_mb), default_leave_days_per_year: Number(form.default_leave_days_per_year) }) });
      const data = await response.json();
      setMessage(response.ok ? "Organization settings saved." : data.error ?? "Settings could not be saved.");
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Organization name" value={form.organization_name} onChange={(value) => setForm({ ...form, organization_name: value })} />
        <Field label="Timezone" value={form.timezone} onChange={(value) => setForm({ ...form, timezone: value })} />
        <Field label="Workday starts" type="time" value={form.default_work_start_time} onChange={(value) => setForm({ ...form, default_work_start_time: value })} />
        <Field label="Workday ends" type="time" value={form.default_work_end_time} onChange={(value) => setForm({ ...form, default_work_end_time: value })} />
        <Field label="Max upload (MB)" type="number" value={String(form.max_file_upload_mb)} onChange={(value) => setForm({ ...form, max_file_upload_mb: Number(value) })} />
        <Field label="Leave days per year" type="number" value={String(form.default_leave_days_per_year)} onChange={(value) => setForm({ ...form, default_leave_days_per_year: Number(value) })} />
      </div>
      <div className="flex flex-wrap gap-5 text-sm text-[#A7AFBC]">
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_employee_feed_post} onChange={(event) => setForm({ ...form, allow_employee_feed_post: event.target.checked })} /> Allow employee feed posts</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={form.allow_employee_comment} onChange={(event) => setForm({ ...form, allow_employee_comment: event.target.checked })} /> Allow employee comments</label>
      </div>
      <div className="flex items-center gap-4"><Button type="submit" variant="primary" disabled={pending}>{pending ? "Saving..." : "Save settings"}</Button>{message && <span className="text-sm text-[#39FF14]">{message}</span>}</div>
    </form>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">{label}<input required={type !== "number"} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3 text-sm font-normal normal-case tracking-normal text-[#F5F7FA] focus:border-[#39FF14]/50 focus:outline-none" /></label>;
}
