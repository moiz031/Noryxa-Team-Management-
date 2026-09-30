"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  Building2,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  Layers,
  ChevronRight,
  X,
  Search,
  UserPlus,
  Trash2,
  Edit2,
  Check,
  Shield,
  Activity,
  ArrowUpRight,
} from "lucide-react";

type Department = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

type Team = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  department_id: string | null;
};

type Employee = {
  id: string;
  job_title: string | null;
  employee_code: string | null;
  profiles: { full_name: string | null; email: string | null; avatar_path: string | null };
};

export default function DepartmentsClientPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Selected department for detail view
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [deptTeams, setDeptTeams] = useState<Team[]>([]);
  const [deptEmployees, setDeptEmployees] = useState<Employee[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [assigningTeam, setAssigningTeam] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, tRes, eRes] = await Promise.all([
        fetch("/api/admin/departments?activeOnly=false&pageSize=100"),
        fetch("/api/admin/teams"),
        fetch("/api/admin/employees?pageSize=200"),
      ]);
      const [dData, tData, eData] = await Promise.all([
        dRes.json(),
        tRes.json(),
        eRes.json(),
      ]);
      setDepartments(dData.departments ?? []);
      setTotal(dData.total ?? 0);
      setTeams(tData.teams ?? []);
      setEmployees(eData.employees ?? []);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchAll();
  }, [fetchAll]);

  const loadDeptDetail = useCallback(
    async (dept: Department) => {
      setSelectedDept(dept);
      setDetailLoading(true);
      setDeptTeams(teams.filter((t) => t.department_id === dept.id));
      setDeptEmployees(employees.filter((e: Employee & { department_id?: string }) => (e as Employee & { department_id?: string }).department_id === dept.id));
      setDetailLoading(false);
    },
    [teams, employees]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create");
      const { department } = await res.json();

      // Assign selected teams to department
      await Promise.all(
        selectedTeams.map((tid) =>
          fetch(`/api/admin/teams/${tid}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ department_id: department.id }),
          })
        )
      );

      setSuccess(`Department "${name}" created successfully!`);
      setName("");
      setDescription("");
      setSelectedTeams([]);
      startTransition(() => void fetchAll());
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create department");
    } finally {
      setCreating(false);
    }
  };

  const handleAssignTeam = async (teamId: string) => {
    if (!selectedDept) return;
    setAssigningTeam(true);
    try {
      await fetch(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ department_id: selectedDept.id }),
      });
      await fetchAll();
      setDeptTeams((prev) => [...prev, teams.find((t) => t.id === teamId)!].filter(Boolean));
      setSuccess("Team assigned!");
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("Failed to assign team");
    } finally {
      setAssigningTeam(false);
    }
  };

  const handleUnassignTeam = async (teamId: string) => {
    if (!selectedDept) return;
    try {
      await fetch(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ department_id: null }),
      });
      await fetchAll();
      setDeptTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch {
      setError("Failed to unassign team");
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedDept || !editName.trim()) return;
    try {
      const res = await fetch(`/api/admin/departments/${selectedDept.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setEditing(false);
      await fetchAll();
      setSelectedDept((d) => d ? { ...d, name: editName, description: editDesc || null } : d);
    } catch {
      setError("Failed to update department");
    }
  };

  const unassignedTeams = teams.filter((t) => !t.department_id || t.department_id === selectedDept?.id);
  const availableTeamsForAssign = teams.filter(
    (t) => !t.department_id && t.id !== selectedDept?.id
  );
  const filteredAvailableTeams = availableTeamsForAssign.filter((t) =>
    t.name.toLowerCase().includes(teamSearch.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8B5CF6]">
            <Building2 className="size-3.5" />
            <span>Organization Structure</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Departments
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Manage departments, assign teams & members with live activity tracking.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-2 text-xs flex items-center gap-2">
          <Activity className="size-3.5 text-[#39FF14]" />
          <span className="text-[#6B7280]">Total: </span>
          <span className="font-bold text-[#F5F7FA]">{total}</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-[#FF4D67]/30 bg-[#FF4D67]/10 px-4 py-3 text-sm text-[#FF4D67]">
          <XCircle className="size-4 shrink-0" />
          {error}
          <button onClick={() => setError("")} className="ml-auto"><X className="size-4" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/10 px-4 py-3 text-sm text-[#39FF14]">
          <CheckCircle2 className="size-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Departments List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] px-1">All Departments</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-2xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-[#0E1117]/60 py-12 text-center">
              <Building2 className="size-8 text-[#6B7280]" />
              <p className="text-sm font-medium text-[#A7AFBC]">No departments yet</p>
              <p className="text-xs text-[#6B7280]">Create your first one →</p>
            </div>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => {
                const teamCount = teams.filter((t) => t.department_id === dept.id).length;
                const isSelected = selectedDept?.id === dept.id;
                return (
                  <button
                    key={dept.id}
                    onClick={() => loadDeptDetail(dept)}
                    className={`w-full group flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150 ${
                      isSelected
                        ? "border-[#8B5CF6]/50 bg-[#8B5CF6]/10 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                        : "border-white/[0.06] bg-[#0E1117]/80 hover:border-white/20 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className={`shrink-0 grid size-9 place-items-center rounded-xl border text-sm font-bold ${
                      isSelected
                        ? "border-[#8B5CF6]/40 bg-gradient-to-br from-[#8B5CF6]/30 to-[#24C5E3]/20 text-[#8B5CF6]"
                        : "border-white/10 bg-gradient-to-br from-[#8B5CF6]/15 to-[#24C5E3]/10 text-[#8B5CF6]"
                    }`}>
                      {dept.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={`truncate text-sm font-semibold ${isSelected ? "text-[#8B5CF6]" : "text-[#F5F7FA] group-hover:text-[#8B5CF6]"} transition-colors`}>
                          {dept.name}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold border ${
                            dept.is_active
                              ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/25"
                              : "bg-white/5 text-[#6B7280] border-white/10"
                          }`}>
                            {dept.is_active ? <CheckCircle2 className="size-2" /> : <XCircle className="size-2" />}
                            {dept.is_active ? "Active" : "Off"}
                          </span>
                          <ChevronRight className={`size-3.5 ${isSelected ? "text-[#8B5CF6]" : "text-[#6B7280]"}`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {teamCount > 0 && (
                          <span className="flex items-center gap-1 text-[10px] text-[#6B7280]">
                            <Layers className="size-2.5" />
                            {teamCount} team{teamCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {dept.description && (
                          <p className="text-[10px] text-[#6B7280] truncate">{dept.description}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel: Detail or Create */}
        <div className="lg:col-span-2 space-y-4">
          {selectedDept ? (
            /* Department Detail View */
            <div className="space-y-4">
              {/* Header */}
              <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0E1117] to-[#11151C] p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 size-40 rounded-full bg-[#8B5CF6]/8 blur-[60px] pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#8B5CF6]/30 to-[#24C5E3]/20 border border-[#8B5CF6]/30 text-xl font-black text-[#8B5CF6]">
                        {selectedDept.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        {editing ? (
                          <div className="space-y-2">
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 text-sm font-semibold text-[#F5F7FA] outline-none focus:border-[#8B5CF6]/60"
                            />
                            <input
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Description..."
                              className="w-full rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 text-xs text-[#A7AFBC] outline-none focus:border-[#8B5CF6]/60"
                            />
                            <div className="flex gap-2">
                              <button onClick={handleSaveEdit} className="flex items-center gap-1 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 px-3 py-1 text-xs text-[#8B5CF6] hover:bg-[#8B5CF6]/30 transition-colors">
                                <Check className="size-3" /> Save
                              </button>
                              <button onClick={() => setEditing(false)} className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1 text-xs text-[#A7AFBC] hover:bg-white/10 transition-colors">
                                <X className="size-3" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <h2 className="text-xl font-extrabold text-[#F5F7FA]">{selectedDept.name}</h2>
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                selectedDept.is_active
                                  ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/25"
                                  : "bg-white/5 text-[#6B7280] border-white/10"
                              }`}>
                                {selectedDept.is_active ? <CheckCircle2 className="size-2.5" /> : <XCircle className="size-2.5" />}
                                {selectedDept.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>
                            {selectedDept.description && (
                              <p className="mt-0.5 text-xs text-[#A7AFBC]">{selectedDept.description}</p>
                            )}
                            <p className="mt-1 text-[10px] text-[#6B7280]">
                              Created {new Date(selectedDept.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    {!editing && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditing(true); setEditName(selectedDept.name); setEditDesc(selectedDept.description ?? ""); }}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-[#A7AFBC] hover:border-white/20 hover:text-[#F5F7FA] transition-all"
                        >
                          <Edit2 className="size-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => setSelectedDept(null)}
                          className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-[#A7AFBC] hover:text-white transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: "Teams", value: deptTeams.length, icon: Layers, color: "#8B5CF6" },
                      { label: "Members", value: deptEmployees.length, icon: Users, color: "#24C5E3" },
                      { label: "Status", value: selectedDept.is_active ? "Active" : "Inactive", icon: Shield, color: "#39FF14" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
                        <Icon className="size-4 mx-auto mb-1" style={{ color }} />
                        <p className="text-lg font-extrabold" style={{ color }}>{value}</p>
                        <p className="text-[10px] text-[#6B7280]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Teams in Department */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-[#8B5CF6]" />
                    <h3 className="text-sm font-semibold text-[#F5F7FA]">Assigned Teams</h3>
                    <span className="rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/25 px-2 py-0.5 text-[10px] font-bold text-[#8B5CF6]">
                      {deptTeams.length}
                    </span>
                  </div>
                </div>

                {deptTeams.length === 0 ? (
                  <div className="py-8 text-center">
                    <Layers className="size-8 mx-auto text-[#6B7280] mb-2 opacity-50" />
                    <p className="text-xs text-[#6B7280]">No teams assigned yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {deptTeams.map((team) => (
                      <div key={team.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] group transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#24C5E3]/20 to-[#8B5CF6]/15 border border-white/10 text-[#24C5E3]">
                            <Users className="size-3.5" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors">{team.name}</p>
                            {team.description && <p className="text-[10px] text-[#6B7280] truncate max-w-[200px]">{team.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
                            team.status === "active"
                              ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/25"
                              : "bg-white/5 text-[#6B7280] border-white/10"
                          }`}>{team.status}</span>
                          <a href={`/admin/teams/${team.id}`} className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-[#6B7280] hover:text-[#24C5E3] transition-colors">
                            <ArrowUpRight className="size-3" />
                          </a>
                          <button
                            onClick={() => handleUnassignTeam(team.id)}
                            className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-[#6B7280] hover:border-[#FF4D67]/30 hover:text-[#FF4D67] transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Team */}
                <div className="px-5 py-4 border-t border-white/[0.06] bg-white/[0.01]">
                  <p className="text-xs font-semibold text-[#6B7280] mb-3 uppercase tracking-wider">Assign Existing Team</p>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#6B7280]" />
                    <input
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      placeholder="Search unassigned teams..."
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-8 pr-3 py-2 text-xs text-[#F5F7FA] placeholder-[#6B7280] outline-none focus:border-[#8B5CF6]/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {filteredAvailableTeams.length === 0 ? (
                      <p className="text-center text-[10px] text-[#6B7280] py-3">
                        {availableTeamsForAssign.length === 0 ? "All teams are assigned" : "No teams match search"}
                      </p>
                    ) : (
                      filteredAvailableTeams.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => handleAssignTeam(team.id)}
                          disabled={assigningTeam}
                          className="w-full flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/10 transition-all group disabled:opacity-50"
                        >
                          <div className="flex items-center gap-2">
                            <Users className="size-3.5 text-[#6B7280] group-hover:text-[#8B5CF6]" />
                            <span className="text-xs text-[#A7AFBC] group-hover:text-[#F5F7FA]">{team.name}</span>
                          </div>
                          <UserPlus className="size-3.5 text-[#6B7280] group-hover:text-[#8B5CF6]" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Create Department Form */
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-6 space-y-5">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-[#8B5CF6]/30 to-[#24C5E3]/20 border border-[#8B5CF6]/30">
                  <Plus className="size-4 text-[#8B5CF6]" />
                </div>
                <h2 className="text-sm font-semibold text-[#F5F7FA]">New Department</h2>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                    Name <span className="text-[#FF4D67]">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="e.g. Design & UX"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-[#F5F7FA] placeholder-[#6B7280] outline-none focus:border-[#8B5CF6]/60 focus:ring-1 focus:ring-[#8B5CF6]/20 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of this department's function…"
                    rows={3}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-[#F5F7FA] placeholder-[#6B7280] outline-none focus:border-[#8B5CF6]/60 focus:ring-1 focus:ring-[#8B5CF6]/20 transition-all resize-none"
                  />
                </div>

                {/* Team Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                    Assign Teams <span className="text-[#6B7280] normal-case font-normal">(optional)</span>
                  </label>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 max-h-40 overflow-y-auto space-y-1.5">
                    {teams.filter((t) => !t.department_id).length === 0 ? (
                      <p className="text-xs text-[#6B7280] text-center py-2">No unassigned teams available</p>
                    ) : (
                      teams
                        .filter((t) => !t.department_id)
                        .map((team) => (
                          <label
                            key={team.id}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] cursor-pointer transition-colors group"
                          >
                            <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                              selectedTeams.includes(team.id)
                                ? "border-[#8B5CF6] bg-[#8B5CF6]"
                                : "border-white/20 bg-transparent group-hover:border-[#8B5CF6]/50"
                            }`}>
                              {selectedTeams.includes(team.id) && <Check className="size-2.5 text-white" />}
                            </div>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={selectedTeams.includes(team.id)}
                              onChange={(e) =>
                                setSelectedTeams((prev) =>
                                  e.target.checked
                                    ? [...prev, team.id]
                                    : prev.filter((id) => id !== team.id)
                                )
                              }
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-[#F5F7FA]">{team.name}</p>
                              {team.description && (
                                <p className="text-[10px] text-[#6B7280] truncate">{team.description}</p>
                              )}
                            </div>
                            <span className={`text-[9px] rounded-full px-1.5 py-0.5 font-semibold ${
                              team.status === "active"
                                ? "bg-[#39FF14]/10 text-[#39FF14]"
                                : "bg-white/5 text-[#6B7280]"
                            }`}>{team.status}</span>
                          </label>
                        ))
                    )}
                  </div>
                  {selectedTeams.length > 0 && (
                    <p className="text-[10px] text-[#8B5CF6]">
                      {selectedTeams.length} team{selectedTeams.length !== 1 ? "s" : ""} will be assigned
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={creating || !name.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#24C5E3] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                >
                  {creating ? (
                    <>
                      <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="size-4" />
                      Create Department
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
