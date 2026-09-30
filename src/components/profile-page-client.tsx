"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Edit2,
  Check,
  X,
  Camera,
  Phone,
  Mail,
  Globe,
  Clock,
  Shield,
  Building2,
  Layers,
  Hash,
  Save,
  RefreshCw,
  CheckCircle2,
  Bell,
  Lock,
  ChevronRight,
  MessageCircle,
  Activity,
  Briefcase,
  Award,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Sparkles,
  ExternalLink,
  CheckCheck,
} from "lucide-react";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  timezone: string;
  avatar_path: string | null;
  is_active: boolean;
  role_id: string;
  updated_at: string;
};

type Employee = {
  id: string;
  employee_code: string | null;
  job_title: string | null;
  employment_status: string;
  joined_on: string | null;
  departments?: { id: string; name: string } | null;
};

const TIMEZONES = [
  "UTC", "Asia/Karachi", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore",
  "Europe/London", "Europe/Paris", "America/New_York", "America/Chicago",
  "America/Los_Angeles", "Australia/Sydney", "Pacific/Auckland",
];

const STATUS_MESSAGES = [
  "Available",
  "In a meeting",
  "Working from home",
  "On vacation",
  "Do not disturb",
  "Be right back",
];

function Avatar({ name, size = "xl", avatarPath }: { name: string; size?: "sm" | "md" | "lg" | "xl" | "2xl"; avatarPath?: string | null }) {
  const sizes = {
    sm: "size-10 text-sm",
    md: "size-12 text-base",
    lg: "size-16 text-xl",
    xl: "size-24 text-3xl",
    "2xl": "size-32 text-4xl",
  };
  const colors = [
    "from-[#8B5CF6] to-[#24C5E3]",
    "from-[#39FF14] to-[#24C5E3]",
    "from-[#FF4D67] to-[#8B5CF6]",
    "from-[#24C5E3] to-[#8B5CF6]",
    "from-[#F59E0B] to-[#EF4444]",
  ];
  const colorIndex = name.charCodeAt(0) % colors.length;
  return (
    <div className={`${sizes[size]} shrink-0 grid place-items-center rounded-full bg-gradient-to-br ${colors[colorIndex]} font-black text-white shadow-2xl ring-4 ring-white/10`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit states
  const [editField, setEditField] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTimezone, setEditTimezone] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "business" | "privacy">("profile");

  // Business profile fields
  const [bizAbout, setBizAbout] = useState("We deliver exceptional digital solutions.");
  const [bizWebsite, setBizWebsite] = useState("https://agencyhub.digital");
  const [bizAddress, setBizAddress] = useState("Tech Hub Floor 4, Agency Central");
  const [bizCategory, setBizCategory] = useState("Digital Creative Agency");
  const [bizHours, setBizHours] = useState("Mon - Fri: 09:00 AM - 06:00 PM");
  const [bizAwayMsg, setBizAwayMsg] = useState("Hi! Thanks for reaching out. We are currently offline and will reply during business hours.");
  const [awayMsgEnabled, setAwayMsgEnabled] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const [pRes, eRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/employee"),
        ]);
        const pData = await pRes.json();
        if (pData.profile) {
          setProfile(pData.profile);
          setEditFullName(pData.profile.full_name ?? "");
          setEditPhone(pData.profile.phone ?? "");
          setEditTimezone(pData.profile.timezone ?? "UTC");
        }
        if (eRes.ok) {
          const eData = await eRes.json();
          if (eData.employee) setEmployee(eData.employee);
        }
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  const saveField = async (field: string, value: string) => {
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, string | null> = {};
      if (field === "full_name") payload.full_name = value;
      if (field === "phone") payload.phone = value || null;
      if (field === "timezone") payload.timezone = value;

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      const { profile: updated } = await res.json();
      setProfile(updated);
      setEditField(null);
      setSuccess("Profile updated!");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="space-y-4 text-center">
          <div className="size-16 rounded-full bg-gradient-to-br from-[#8B5CF6]/30 to-[#24C5E3]/20 border border-white/10 mx-auto animate-pulse" />
          <p className="text-sm text-[#6B7280]">Loading profile...</p>
        </div>
      </div>
    );
  }

  const displayName = profile?.full_name ?? profile?.email ?? "User";
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#07090D]">
      {/* Header Banner - WhatsApp Business style */}
      <div className="relative bg-gradient-to-r from-[#0A0D12] via-[#0E1117] to-[#0A0D12] border-b border-white/[0.06] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#8B5CF6]/10 via-transparent to-[#24C5E3]/10" />
        <div className="absolute top-0 left-1/3 size-64 rounded-full bg-[#8B5CF6]/8 blur-[80px] pointer-events-none" />
        <div className="absolute top-0 right-1/4 size-48 rounded-full bg-[#24C5E3]/8 blur-[60px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative shrink-0 group cursor-pointer">
              <Avatar name={displayName} size="2xl" />
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="size-7 text-white" />
              </div>
              <span className="absolute bottom-1 right-1 size-5 rounded-full bg-[#39FF14] border-2 border-[#07090D] shadow-lg" />
            </div>

            {/* Name & Status */}
            <div className="flex-1 text-center sm:text-left">
              {editField === "full_name" ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    autoFocus
                    className="text-2xl font-extrabold bg-transparent border-b-2 border-[#8B5CF6] text-[#F5F7FA] outline-none flex-1 pb-1"
                    onKeyDown={(e) => { if (e.key === "Enter") void saveField("full_name", editFullName); if (e.key === "Escape") setEditField(null); }}
                  />
                  <button onClick={() => void saveField("full_name", editFullName)} className="p-1 text-[#39FF14] hover:opacity-80 transition-opacity">
                    {saving ? <RefreshCw className="size-5 animate-spin" /> : <Check className="size-5" />}
                  </button>
                  <button onClick={() => setEditField(null)} className="p-1 text-[#FF4D67] hover:opacity-80 transition-opacity">
                    <X className="size-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start gap-2 group">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F5F7FA]">{displayName}</h1>
                  <button
                    onClick={() => { setEditField("full_name"); setEditFullName(profile?.full_name ?? ""); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#6B7280] hover:text-[#8B5CF6]"
                  >
                    <Edit2 className="size-4" />
                  </button>
                </div>
              )}
              <p className="text-sm text-[#8B5CF6] font-semibold mt-1">
                {employee?.job_title ?? "Administrator"}
              </p>
              {/* Status */}
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                <span className="size-2 rounded-full bg-[#39FF14] animate-pulse" />
                <span className="text-xs text-[#A7AFBC]">{editStatus || "Available"}</span>
                <button onClick={() => setEditField("status")} className="text-[#6B7280] hover:text-[#8B5CF6] transition-colors">
                  <Edit2 className="size-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {employee && (
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { icon: Hash, label: "Emp Code", value: employee.employee_code ?? "—", color: "#8B5CF6" },
                { icon: Activity, label: "Status", value: employee.employment_status ?? "—", color: "#39FF14" },
                { icon: Calendar, label: "Joined", value: employee.joined_on ? new Date(employee.joined_on).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—", color: "#24C5E3" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-center">
                  <Icon className="size-4 mx-auto mb-1" style={{ color }} />
                  <p className="text-sm font-bold" style={{ color }}>{value}</p>
                  <p className="text-[10px] text-[#6B7280]">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="relative z-10 max-w-2xl mx-auto px-6">
          <div className="flex border-b border-white/[0.06]">
            {[
              { id: "profile" as const, label: "Profile", icon: User },
              { id: "business" as const, label: "Business", icon: Briefcase },
              { id: "privacy" as const, label: "Privacy", icon: Lock },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === id
                    ? "border-[#8B5CF6] text-[#8B5CF6]"
                    : "border-transparent text-[#6B7280] hover:text-[#A7AFBC]"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(error || success) && (
        <div className={`max-w-2xl mx-auto mt-4 mx-6 px-6`}>
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            error
              ? "border-[#FF4D67]/30 bg-[#FF4D67]/10 text-[#FF4D67]"
              : "border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14]"
          }`}>
            {error ? <X className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
            {error || success}
            <button onClick={() => { setError(""); setSuccess(""); }} className="ml-auto"><X className="size-4" /></button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-6 space-y-3">
        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <>
            {/* Status Message */}
            {editField === "status" && (
              <div className="rounded-2xl border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-5 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-[#8B5CF6]">Set Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_MESSAGES.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setEditStatus(s); setEditField(null); }}
                      className={`text-left rounded-xl border px-3 py-2 text-xs transition-all ${
                        editStatus === s
                          ? "border-[#8B5CF6] bg-[#8B5CF6]/20 text-[#8B5CF6]"
                          : "border-white/10 bg-white/[0.03] text-[#A7AFBC] hover:border-[#8B5CF6]/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    placeholder="Custom status..."
                    className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs text-[#F5F7FA] placeholder-[#6B7280] outline-none focus:border-[#8B5CF6]/60"
                  />
                  <button
                    onClick={() => { setEditStatus(customStatus); setEditField(null); }}
                    disabled={!customStatus.trim()}
                    className="rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 px-3 py-2 text-xs text-[#8B5CF6] disabled:opacity-40 hover:bg-[#8B5CF6]/30 transition-colors"
                  >
                    Set
                  </button>
                </div>
                <button onClick={() => setEditField(null)} className="text-xs text-[#6B7280] hover:text-white transition-colors">Cancel</button>
              </div>
            )}

            {/* Profile Fields */}
            {[
              {
                field: "full_name",
                icon: User,
                label: "Display Name",
                value: profile?.full_name ?? "",
                placeholder: "Your full name",
                color: "#8B5CF6",
                editable: true,
                editValue: editFullName,
                setEditValue: setEditFullName,
              },
              {
                field: "email",
                icon: Mail,
                label: "Email Address",
                value: profile?.email ?? "",
                placeholder: "—",
                color: "#24C5E3",
                editable: false,
              },
              {
                field: "phone",
                icon: Phone,
                label: "Phone Number",
                value: profile?.phone ?? "",
                placeholder: "Add phone number",
                color: "#39FF14",
                editable: true,
                editValue: editPhone,
                setEditValue: setEditPhone,
              },
              {
                field: "timezone",
                icon: Globe,
                label: "Timezone",
                value: profile?.timezone ?? "UTC",
                placeholder: "UTC",
                color: "#F59E0B",
                editable: true,
                editValue: editTimezone,
                setEditValue: setEditTimezone,
                isSelect: true,
              },
            ].map(({ field, icon: Icon, label, value, placeholder, color, editable, editValue, setEditValue, isSelect }) => (
              <div
                key={field}
                className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1117] px-5 py-4 group hover:border-white/10 transition-all"
              >
                <div className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] shrink-0" style={{ color }}>
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">{label}</p>
                  {editField === field && editable ? (
                    isSelect ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue!(e.target.value)}
                        className="mt-1 w-full bg-transparent text-sm text-[#F5F7FA] outline-none border-b border-[#8B5CF6] pb-0.5"
                      >
                        {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                      </select>
                    ) : (
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue!(e.target.value)}
                        autoFocus
                        placeholder={placeholder}
                        className="mt-1 w-full bg-transparent text-sm text-[#F5F7FA] outline-none border-b border-[#8B5CF6] pb-0.5"
                        onKeyDown={(e) => { if (e.key === "Enter") void saveField(field, editValue ?? ""); if (e.key === "Escape") setEditField(null); }}
                      />
                    )
                  ) : (
                    <p className={`mt-0.5 text-sm ${value ? "text-[#F5F7FA]" : "text-[#6B7280] italic"}`}>
                      {value || placeholder}
                    </p>
                  )}
                </div>
                {editable && (
                  editField === field ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => void saveField(field, editValue ?? "")}
                        disabled={saving}
                        className="grid size-8 place-items-center rounded-lg bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/25 transition-colors disabled:opacity-50"
                      >
                        {saving ? <RefreshCw className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditField(null)}
                        className="grid size-8 place-items-center rounded-lg bg-white/5 border border-white/10 text-[#A7AFBC] hover:bg-white/10 transition-colors"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditField(field); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[#6B7280] hover:text-[#8B5CF6] hover:border-[#8B5CF6]/30"
                    >
                      <Edit2 className="size-3.5" />
                    </button>
                  )
                )}
              </div>
            ))}

            {/* Employee Info (read-only) */}
            {employee && (
              <div className="rounded-2xl border border-white/[0.06] bg-[#0E1117] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.06]">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Work Information</p>
                </div>
                {[
                  { icon: Briefcase, label: "Job Title", value: employee.job_title },
                  { icon: Building2, label: "Department", value: employee.departments?.name },
                  { icon: Hash, label: "Employee Code", value: employee.employee_code },
                  { icon: Activity, label: "Employment Status", value: employee.employment_status },
                  { icon: Calendar, label: "Joined On", value: employee.joined_on ? new Date(employee.joined_on).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null },
                ].filter((row) => row.value).map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.04] last:border-0">
                    <Icon className="size-4 text-[#6B7280] shrink-0" />
                    <div>
                      <p className="text-[10px] text-[#6B7280]">{label}</p>
                      <p className="text-sm text-[#F5F7FA] mt-0.5">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── BUSINESS TAB ── */}
        {activeTab === "business" && (
          <div className="space-y-4">
            {/* Header intro */}
            <div className="rounded-2xl border border-[#39FF14]/20 bg-gradient-to-br from-[#39FF14]/10 via-[#24C5E3]/5 to-[#8B5CF6]/10 p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <Briefcase className="size-4 text-[#39FF14]" />
                <h3 className="text-sm font-bold text-[#F5F7FA]">WhatsApp Business Profile</h3>
              </div>
              <p className="text-xs text-[#A7AFBC] leading-relaxed">
                Customize your professional agency identity, business category, operating hours, and away greeting just like WhatsApp Business.
              </p>
            </div>

            {/* LIVE WHATSAPP BUSINESS CARD PREVIEW */}
            <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0E1117] to-[#0A0D12] p-5 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#39FF14]">
                  <Sparkles className="size-3.5" />
                  <span>Live WhatsApp Business Card Preview</span>
                </div>
                <span className="text-[10px] font-mono text-[#6B7280]">Public to Team</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <Avatar name={profile?.full_name ?? "User"} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-1.5">
                    <h4 className="text-base font-black text-[#F5F7FA] truncate">
                      {profile?.full_name ?? "Agency Member"}
                    </h4>
                    <span className="grid size-4 place-items-center rounded-full bg-[#39FF14] text-[#07090D] text-[10px] font-bold">
                      ✓
                    </span>
                  </div>
                  <p className="text-xs text-[#24C5E3] font-semibold mt-0.5">{bizCategory}</p>
                  <p className="text-xs text-[#A7AFBC] mt-2 italic leading-relaxed">&quot;{bizAbout}&quot;</p>

                  <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/25 px-2.5 py-0.5 text-[#39FF14] font-medium">
                      <span className="size-1.5 rounded-full bg-[#39FF14] animate-pulse" />
                      Open Now · {bizHours}
                    </span>
                    {bizWebsite && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-[#A7AFBC]">
                        <Globe className="size-3 text-[#24C5E3]" />
                        {bizWebsite.replace(/^https?:\/\//, "")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Business Customization Fields */}
            <div className="space-y-3">
              {[
                {
                  icon: Briefcase,
                  label: "Business / Agency Category",
                  value: bizCategory,
                  setValue: setBizCategory,
                  placeholder: "e.g. Digital Creative Agency, UI/UX Studio",
                  multiline: false,
                },
                {
                  icon: MessageCircle,
                  label: "About / Business Bio",
                  value: bizAbout,
                  setValue: setBizAbout,
                  placeholder: "Short description displayed on your WhatsApp profile...",
                  multiline: true,
                },
                {
                  icon: Clock,
                  label: "Business Hours / Schedule",
                  value: bizHours,
                  setValue: setBizHours,
                  placeholder: "Mon - Fri: 09:00 AM - 06:00 PM",
                  multiline: false,
                },
                {
                  icon: LinkIcon,
                  label: "Official Website",
                  value: bizWebsite,
                  setValue: setBizWebsite,
                  placeholder: "https://youragency.com",
                  multiline: false,
                },
                {
                  icon: MapPin,
                  label: "Office Location / Address",
                  value: bizAddress,
                  setValue: setBizAddress,
                  placeholder: "e.g. Silicon Avenue Floor 5, Central Office",
                  multiline: false,
                },
              ].map(({ icon: Icon, label, value, setValue, placeholder, multiline }) => (
                <div key={label} className="rounded-2xl border border-white/[0.06] bg-[#0E1117] p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-[#8B5CF6]" />
                    <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">{label}</label>
                  </div>
                  {multiline ? (
                    <textarea
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={placeholder}
                      rows={3}
                      className="w-full bg-white/[0.03] rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-[#F5F7FA] placeholder-[#6B7280] outline-none focus:border-[#8B5CF6]/60 resize-none transition-all"
                    />
                  ) : (
                    <input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={placeholder}
                      className="w-full bg-white/[0.03] rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-[#F5F7FA] placeholder-[#6B7280] outline-none focus:border-[#8B5CF6]/60 transition-all"
                    />
                  )}
                </div>
              ))}

              {/* Away Auto-Reply Message Setting */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#0E1117] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="size-4 text-[#39FF14]" />
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
                        Automated Away / Greeting Message
                      </label>
                      <p className="text-[10px] text-[#A7AFBC]">Auto-reply when teammates ping outside business hours</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={awayMsgEnabled}
                      onChange={(e) => setAwayMsgEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-white/10 peer-checked:bg-[#39FF14] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
                  </label>
                </div>

                {awayMsgEnabled && (
                  <textarea
                    value={bizAwayMsg}
                    onChange={(e) => setBizAwayMsg(e.target.value)}
                    rows={2}
                    className="w-full bg-white/[0.03] rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm text-[#F5F7FA] outline-none focus:border-[#39FF14]/60 resize-none transition-all"
                  />
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setSuccess("WhatsApp Business profile updated successfully!");
                setTimeout(() => setSuccess(""), 3000);
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#39FF14] via-[#24C5E3] to-[#8B5CF6] px-4 py-3.5 text-sm font-bold text-[#07090D] hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(57,255,20,0.3)]"
            >
              <Save className="size-4" />
              Save WhatsApp Business Settings
            </button>
          </div>
        )}

        {/* ── PRIVACY TAB ── */}
        {activeTab === "privacy" && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0E1117] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Privacy Settings</p>
              </div>
              {[
                { icon: User, label: "Last Seen", sub: "Who can see your last seen", options: ["Everyone", "Team Only", "Nobody"] },
                { icon: Camera, label: "Profile Photo", sub: "Who can see your profile photo", options: ["Everyone", "Team Only", "Nobody"] },
                { icon: MessageCircle, label: "About", sub: "Who can see your about", options: ["Everyone", "Team Only", "Nobody"] },
                { icon: Activity, label: "Status Updates", sub: "Who can see your status", options: ["Everyone", "Team Only", "Nobody"] },
              ].map(({ icon: Icon, label, sub, options }) => (
                <div key={label} className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] last:border-0 group">
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-[#6B7280] shrink-0" />
                    <div>
                      <p className="text-sm text-[#F5F7FA]">{label}</p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">{sub}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#A7AFBC]">
                    Everyone
                    <ChevronRight className="size-3.5" />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#0E1117] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Notifications</p>
              </div>
              {[
                { icon: Bell, label: "Team Messages", desc: "Notifications for team chats" },
                { icon: Activity, label: "Activity Updates", desc: "System activity alerts" },
                { icon: Award, label: "Scorecard Updates", desc: "Performance notifications" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04] last:border-0">
                  <div className="flex items-center gap-3">
                    <Icon className="size-4 text-[#6B7280] shrink-0" />
                    <div>
                      <p className="text-sm text-[#F5F7FA]">{label}</p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-10 h-5 bg-white/10 peer-checked:bg-[#8B5CF6] rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
                  </label>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[#FF4D67]/20 bg-[#FF4D67]/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="size-4 text-[#FF4D67]" />
                <p className="text-sm font-bold text-[#FF4D67]">Danger Zone</p>
              </div>
              <button className="w-full rounded-xl border border-[#FF4D67]/30 bg-[#FF4D67]/10 px-4 py-3 text-sm text-[#FF4D67] hover:bg-[#FF4D67]/20 transition-colors">
                Request Account Deletion
              </button>
            </div>
          </div>
        )}

        <div className="pb-8" />
      </div>
    </div>
  );
}
