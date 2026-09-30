"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  Plus,
  Search,
  X,
  CheckCircle2,
  Send,
  ArrowLeft,
  UserPlus,
  UserMinus,
  Trash2,
  MessageCircle,
  Phone,
  Video,
  MoreVertical,
  Check,
  CheckCheck,
  Mic,
  Smile,
  Building2,
  Layers,
  Shield,
  Edit2,
  Activity,
  PhoneOff,
  ChevronRight,
} from "lucide-react";

type Team = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  department_id: string | null;
};

type Department = {
  id: string;
  name: string;
};

type EmployeeProfile = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  avatar_path?: string | null;
  phone?: string | null;
  timezone?: string;
  is_active?: boolean;
};

type Employee = {
  id: string;
  employee_code?: string | null;
  job_title?: string | null;
  employment_status: string;
  department_id?: string | null;
  profiles?: EmployeeProfile | null;
  departments?: { id: string; name: string } | null;
};

type ChatMessage = {
  id: string;
  text: string;
  time: string;
  isMine: boolean;
  status?: "sent" | "delivered" | "read";
};

const DEFAULT_CONVERSATIONS: Record<string, ChatMessage[]> = {};

const SAMPLE_STATUS_LIST = [
  "Available for sprint tasks 🚀",
  "In client sync · back at 3 PM 🕒",
  "Focus mode on deep work 💻",
  "Working on design system revamp ✨",
  "Urgent pings only please ⚡",
  "Online & ready to collaborate 🙌",
];

const EMOJI_PALETTE = ["👍", "❤️", "🔥", "🚀", "😂", "🎉", "✅", "🙌", "👋", "💡"];

function getSafeName(emp?: Employee | null): string {
  if (!emp) return "Unknown";
  return emp.profiles?.full_name?.trim() || emp.profiles?.email?.split("@")[0] || "Team Member";
}

function getSafeEmail(emp?: Employee | null): string {
  return emp?.profiles?.email || "";
}

function getSafePhone(emp?: Employee | null): string {
  return emp?.profiles?.phone || "+1 (555) 019-2834";
}

function Avatar({
  name,
  size = "md",
  status = "online",
}: {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  status?: "online" | "offline" | "busy";
}) {
  const sizes = {
    sm: "size-8 text-xs",
    md: "size-11 text-sm",
    lg: "size-14 text-lg",
    xl: "size-20 text-2xl",
  };
  const colors = [
    "from-[#8B5CF6] to-[#24C5E3]",
    "from-[#24C5E3] to-[#39FF14]",
    "from-[#FF4D67] to-[#8B5CF6]",
    "from-[#F59E0B] to-[#FF4D67]",
    "from-[#39FF14] to-[#24C5E3]",
    "from-[#7928CA] to-[#FF0080]",
  ];
  const char = (name.trim().charAt(0) || "U").toUpperCase();
  const colorIndex = (name.charCodeAt(0) || 0) % colors.length;

  return (
    <div className="relative shrink-0 inline-block">
      <div
        className={`${sizes[size]} grid place-items-center rounded-full bg-gradient-to-br ${colors[colorIndex]} font-black text-white shadow-md select-none`}
      >
        {char}
      </div>
      {status === "online" && (
        <span className="absolute bottom-0 right-0 size-3 rounded-full bg-[#39FF14] border-2 border-[#07090D] shadow" />
      )}
      {status === "busy" && (
        <span className="absolute bottom-0 right-0 size-3 rounded-full bg-[#F59E0B] border-2 border-[#07090D] shadow" />
      )}
    </div>
  );
}

export default function TeamsClientPage() {
  const [mainTab, setMainTab] = useState<"members" | "teams" | "activity">("members");
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected views & modals
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<Employee[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [view, setView] = useState<"main" | "chat" | "profile" | "team-detail" | "create-team">("main");

  // Chat State
  const [chatTarget, setChatTarget] = useState<Employee | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [msgInput, setMsgInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Call simulation modal
  const [callState, setCallState] = useState<{
    active: boolean;
    type: "audio" | "video";
    target: Employee | null;
    status: "ringing" | "connected";
    duration: number;
  }>({ active: false, type: "audio", target: null, status: "ringing", duration: 0 });

  // Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "online">("all");

  // Create team form
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createDeptId, setCreateDeptId] = useState("");
  const [createStatus, setCreateStatus] = useState("active");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Team detail member add/edit
  const [memberSearch, setMemberSearch] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Feedback notifications
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, dRes, eRes] = await Promise.all([
        fetch("/api/admin/teams"),
        fetch("/api/admin/departments?activeOnly=false&pageSize=100"),
        fetch("/api/admin/employees?pageSize=200"),
      ]);
      const [tData, dData, eData] = await Promise.all([tRes.json(), dRes.json(), eRes.json()]);
      setTeams(tData.teams ?? []);
      setDepartments(dData.departments ?? []);
      setEmployees(eData.employees ?? []);
    } catch {
      setError("Failed to load teams data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  // Call timer simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (callState.active && callState.status === "connected") {
      timer = setInterval(() => {
        setCallState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callState.active, callState.status]);

  const startCall = (target: Employee, type: "audio" | "video") => {
    setCallState({ active: true, type, target, status: "ringing", duration: 0 });
    setTimeout(() => {
      setCallState((prev) => (prev.active ? { ...prev, status: "connected" } : prev));
    }, 2500);
  };

  const endCall = () => {
    setCallState({ active: false, type: "audio", target: null, status: "ringing", duration: 0 });
  };

  const loadMembers = useCallback(async (team: Team) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}/members`);
      const data = await res.json();
      const rawMembers = data.members ?? [];
      const memberEmployees: Employee[] = rawMembers
        .map((m: { employees: Employee }) => m.employees)
        .filter(Boolean);
      setTeamMembers(memberEmployees);
    } catch {
      setTeamMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const openTeamDetail = useCallback(
    (team: Team) => {
      setSelectedTeam(team);
      setView("team-detail");
      void loadMembers(team);
    },
    [loadMembers]
  );

  const openChatWithMember = (emp: Employee) => {
    setChatTarget(emp);
    if (!DEFAULT_CONVERSATIONS[emp.id]) {
      // eslint-disable-next-line react-hooks/immutability
      DEFAULT_CONVERSATIONS[emp.id] = [
        {
          id: "m-0",
          text: `Hey there! Welcome to ${emp.job_title ? `${emp.job_title} sync` : "chat"}. How can I assist today?`,
          time: "10:15 AM",
          isMine: false,
          status: "read",
        },
      ];
    }
    setMessages(DEFAULT_CONVERSATIONS[emp.id]);
    setView("chat");
  };

  const openProfileView = (emp: Employee) => {
    setChatTarget(emp);
    setView("profile");
  };

  const handleSendMessage = () => {
    if (!msgInput.trim() || !chatTarget) return;
    const text = msgInput.trim();
    const newMsg: ChatMessage = {
      id: Date.now().toString(),
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isMine: true,
      status: "sent",
    };

    const updated = [...(DEFAULT_CONVERSATIONS[chatTarget.id] ?? []), newMsg];
    DEFAULT_CONVERSATIONS[chatTarget.id] = updated;
    setMessages(updated);
    setMsgInput("");
    setShowEmojiPicker(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);

    // Auto-reply simulation
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const replyMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: `Got your message! I'm on it right now. Let me check and ping you shortly 👍`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isMine: false,
        status: "read",
      };
      const withReply = [...(DEFAULT_CONVERSATIONS[chatTarget.id] ?? []), replyMsg];
      DEFAULT_CONVERSATIONS[chatTarget.id] = withReply;
      setMessages(withReply);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    }, 1400);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDesc.trim() || null,
          department_id: createDeptId || null,
          status: createStatus,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create team");
      const { team } = await res.json();

      if (selectedMemberIds.length > 0) {
        await Promise.all(
          selectedMemberIds.map((eid) =>
            fetch(`/api/admin/teams/${team.id}/members`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ employee_id: eid }),
            })
          )
        );
      }

      setSuccess(`Team "${createName}" created with ${selectedMemberIds.length} member(s)!`);
      setCreateName("");
      setCreateDesc("");
      setCreateDeptId("");
      setSelectedMemberIds([]);
      await fetchData();
      setView("main");
      setMainTab("teams");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setCreating(false);
    }
  };

  const handleAddMemberToTeam = async (employeeId: string) => {
    if (!selectedTeam) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/admin/teams/${selectedTeam.id}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      if (!res.ok) throw new Error("Failed to add member");
      await loadMembers(selectedTeam);
      setSuccess("Member added to team!");
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("Failed to add member to team");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMemberFromTeam = async (employeeId: string) => {
    if (!selectedTeam) return;
    try {
      await fetch(`/api/admin/teams/${selectedTeam.id}/members`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employee_id: employeeId }),
      });
      await loadMembers(selectedTeam);
    } catch {
      setError("Failed to remove member");
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam || !confirm(`Delete team "${selectedTeam.name}"?`)) return;
    try {
      await fetch(`/api/admin/teams/${selectedTeam.id}`, { method: "DELETE" });
      setSelectedTeam(null);
      setView("main");
      await fetchData();
    } catch {
      setError("Failed to delete team");
    }
  };

  // Filtered lists
  const filteredEmployees = employees.filter((emp) => {
    const name = getSafeName(emp).toLowerCase();
    const title = (emp.job_title ?? "").toLowerCase();
    const email = getSafeEmail(emp).toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || title.includes(query) || email.includes(query);

    const matchesDept =
      deptFilter === "all" ||
      emp.department_id === deptFilter ||
      emp.departments?.id === deptFilter;

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "online" && emp.employment_status === "active");

    return matchesSearch && matchesDept && matchesStatus;
  });

  const filteredTeams = teams.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === "all" || t.department_id === deptFilter;
    return matchesSearch && matchesDept;
  });

  const nonTeamMembers = employees.filter(
    (e) =>
      !teamMembers.some((m) => m.id === e.id) &&
      getSafeName(e).toLowerCase().includes(memberSearch.toLowerCase())
  );

  const activeDepartment = selectedTeam
    ? departments.find((d) => d.id === selectedTeam.department_id)
    : null;

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  const renderCallModal = () => {
    if (!callState.active || !callState.target) return null;
    const targetName = getSafeName(callState.target);
    const formatDuration = (sec: number) => {
      const m = Math.floor(sec / 60).toString().padStart(2, "0");
      const s = (sec % 60).toString().padStart(2, "0");
      return `${m}:${s}`;
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0E1117] p-8 text-center shadow-2xl flex flex-col items-center">
          <div className="relative mb-6">
            <Avatar name={targetName} size="xl" status="online" />
            {callState.status === "ringing" && (
              <span className="absolute -inset-2 rounded-full border-2 border-[#24C5E3] animate-ping opacity-40 pointer-events-none" />
            )}
          </div>
          <h3 className="text-xl font-bold text-[#F5F7FA]">{targetName}</h3>
          <p className="text-xs text-[#A7AFBC] mt-1">
            {callState.target.job_title ?? "Team Member"}
          </p>

          <div className="my-6 rounded-full px-4 py-1.5 border border-white/10 bg-white/[0.04] text-xs font-mono">
            {callState.status === "ringing" ? (
              <span className="text-[#24C5E3] animate-pulse">Ringing WhatsApp Call...</span>
            ) : (
              <span className="text-[#39FF14]">{formatDuration(callState.duration)}</span>
            )}
          </div>

          <div className="flex items-center gap-6 mt-4">
            <button
              onClick={endCall}
              className="grid size-14 place-items-center rounded-full bg-[#FF4D67] text-white shadow-[0_0_20px_rgba(255,77,103,0.5)] hover:scale-105 transition-transform"
            >
              <PhoneOff className="size-6" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "chat" && chatTarget) {
    const targetName = getSafeName(chatTarget);
    const targetDept = departments.find(
      (d) => d.id === chatTarget.department_id || d.id === chatTarget.departments?.id
    );

    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#07090D]">
        {renderCallModal()}
        {/* Top Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0E1117] border-b border-white/[0.08] sticky top-0 z-20">
          <button
            onClick={() => setView("main")}
            className="rounded-xl p-2 text-[#A7AFBC] hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>

          <div
            onClick={() => openProfileView(chatTarget)}
            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
          >
            <Avatar name={targetName} size="md" status="online" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors truncate">
                {targetName}
              </p>
              <p className="text-xs text-[#6B7280] flex items-center gap-1.5 truncate">
                {isTyping ? (
                  <span className="text-[#39FF14] font-medium animate-pulse">typing...</span>
                ) : (
                  <>
                    <span className="size-1.5 rounded-full bg-[#39FF14]" />
                    <span>online</span>
                    {targetDept && <span>· {targetDept.name}</span>}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => startCall(chatTarget, "audio")}
              title="Voice Call"
              className="rounded-xl p-2.5 text-[#A7AFBC] hover:text-[#39FF14] hover:bg-white/5 transition-colors"
            >
              <Phone className="size-4" />
            </button>
            <button
              onClick={() => startCall(chatTarget, "video")}
              title="Video Call"
              className="rounded-xl p-2.5 text-[#A7AFBC] hover:text-[#24C5E3] hover:bg-white/5 transition-colors"
            >
              <Video className="size-4" />
            </button>
            <button
              onClick={() => openProfileView(chatTarget)}
              title="Contact Info"
              className="rounded-xl p-2.5 text-[#A7AFBC] hover:text-white hover:bg-white/5 transition-colors"
            >
              <MoreVertical className="size-4" />
            </button>
          </div>
        </div>

        {/* WhatsApp Background Chat Area */}
        <div
          className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-3 relative"
          style={{
            backgroundColor: "#07090D",
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.03) 0%, transparent 80%)`,
          }}
        >
          {/* Security Banner */}
          <div className="flex justify-center my-2">
            <div className="rounded-xl border border-white/[0.06] bg-[#0E1117]/80 px-4 py-2 text-center max-w-md shadow-sm">
              <p className="text-[11px] text-[#A7AFBC] flex items-center justify-center gap-1.5">
                <Shield className="size-3.5 text-[#8B5CF6]" />
                Messages are synced across your agency workspace.
              </p>
            </div>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${msg.isMine ? "justify-end" : "justify-start"}`}
            >
              {!msg.isMine && <Avatar name={targetName} size="sm" />}
              <div
                className={`max-w-[78%] sm:max-w-md rounded-2xl px-4 py-2.5 shadow-lg ${
                  msg.isMine
                    ? "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white rounded-br-sm"
                    : "bg-[#0E1117] border border-white/[0.08] text-[#F5F7FA] rounded-bl-sm"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                  <span className="text-[10px] opacity-60 font-mono">{msg.time}</span>
                  {msg.isMine && <CheckCheck className="size-3.5 text-[#24C5E3]" />}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-[#39FF14] pl-10">
              <span className="size-1.5 rounded-full bg-[#39FF14] animate-bounce" />
              <span className="size-1.5 rounded-full bg-[#39FF14] animate-bounce [animation-delay:0.2s]" />
              <span className="size-1.5 rounded-full bg-[#39FF14] animate-bounce [animation-delay:0.4s]" />
              <span className="ml-1 text-[#6B7280]">{targetName} is typing...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Emoji Bar */}
        {showEmojiPicker && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#0E1117] border-t border-white/[0.06] overflow-x-auto">
            {EMOJI_PALETTE.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setMsgInput((prev) => prev + emoji)}
                className="text-lg hover:scale-125 transition-transform p-1.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-center gap-2 px-3 sm:px-4 py-3 bg-[#0E1117] border-t border-white/[0.08]">
          <button
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`rounded-xl p-2.5 transition-colors ${
              showEmojiPicker ? "text-[#8B5CF6] bg-white/5" : "text-[#6B7280] hover:text-[#A7AFBC]"
            }`}
          >
            <Smile className="size-5" />
          </button>

          <div className="flex-1 rounded-2xl border border-white/[0.08] bg-[#11151C] flex items-center px-4 py-2">
            <input
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="w-full bg-transparent text-sm text-[#F5F7FA] placeholder-[#6B7280] outline-none"
            />
          </div>

          <button
            onClick={() => {
              setIsRecordingVoice(true);
              setTimeout(() => {
                setIsRecordingVoice(false);
                setMsgInput("🎙️ [Voice Note 0:14]");
              }, 1200);
            }}
            title="Send Voice Note"
            className={`rounded-xl p-2.5 transition-colors ${
              isRecordingVoice
                ? "text-[#FF4D67] bg-[#FF4D67]/10 animate-pulse"
                : "text-[#6B7280] hover:text-[#A7AFBC]"
            }`}
          >
            <Mic className="size-5" />
          </button>

          <button
            onClick={handleSendMessage}
            disabled={!msgInput.trim()}
            className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#24C5E3] text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] hover:opacity-90 transition-opacity disabled:opacity-30"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "profile" && chatTarget) {
    const targetName = getSafeName(chatTarget);
    const targetEmail = getSafeEmail(chatTarget);
    const targetPhone = getSafePhone(chatTarget);
    const targetDept = departments.find(
      (d) => d.id === chatTarget.department_id || d.id === chatTarget.departments?.id
    );

    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#07090D] overflow-y-auto">
        {renderCallModal()}
        <div className="flex items-center gap-3 px-4 py-4 bg-[#0E1117] border-b border-white/[0.08] sticky top-0 z-10">
          <button
            onClick={() => setView("chat")}
            className="rounded-xl p-2 text-[#A7AFBC] hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h2 className="font-bold text-[#F5F7FA]">Contact Info</h2>
        </div>

        {/* Hero Card */}
        <div className="bg-gradient-to-b from-[#0E1117] to-[#07090D] px-6 py-10 text-center border-b border-white/[0.06]">
          <div className="mx-auto mb-4 inline-block">
            <Avatar name={targetName} size="xl" status="online" />
          </div>
          <h1 className="text-2xl font-black text-[#F5F7FA]">{targetName}</h1>
          <p className="text-sm text-[#A7AFBC] mt-1">
            {chatTarget.job_title ?? "Team Member"}
            {targetDept && ` · ${targetDept.name}`}
          </p>

          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-[#39FF14]/30 bg-[#39FF14]/10 px-3 py-1 text-xs font-semibold text-[#39FF14]">
              <span className="size-1.5 rounded-full bg-[#39FF14] animate-pulse" />
              Online in Agency Hub
            </span>
          </div>

          {/* Quick Call / Message Actions */}
          <div className="flex justify-center gap-6 mt-8">
            <button
              onClick={() => setView("chat")}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="grid size-12 place-items-center rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#8B5CF6] group-hover:bg-[#8B5CF6]/25 transition-colors">
                <MessageCircle className="size-5" />
              </div>
              <span className="text-xs text-[#A7AFBC]">Chat</span>
            </button>
            <button
              onClick={() => startCall(chatTarget, "audio")}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="grid size-12 place-items-center rounded-full bg-[#39FF14]/15 border border-[#39FF14]/30 text-[#39FF14] group-hover:bg-[#39FF14]/25 transition-colors">
                <Phone className="size-5" />
              </div>
              <span className="text-xs text-[#A7AFBC]">Audio</span>
            </button>
            <button
              onClick={() => startCall(chatTarget, "video")}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="grid size-12 place-items-center rounded-full bg-[#24C5E3]/15 border border-[#24C5E3]/30 text-[#24C5E3] group-hover:bg-[#24C5E3]/25 transition-colors">
                <Video className="size-5" />
              </div>
              <span className="text-xs text-[#A7AFBC]">Video</span>
            </button>
          </div>
        </div>

        {/* Details list */}
        <div className="max-w-xl mx-auto w-full px-4 py-6 space-y-3">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0E1117] p-4 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">About / Status</p>
            <p className="text-sm text-[#F5F7FA] font-medium pt-1">
              {SAMPLE_STATUS_LIST[(targetName.charCodeAt(0) || 0) % SAMPLE_STATUS_LIST.length]}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#0E1117] divide-y divide-white/[0.06]">
            <div className="flex items-center gap-4 px-4 py-3.5">
              <Phone className="size-4 text-[#39FF14]" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#6B7280]">WhatsApp Phone</p>
                <p className="text-sm font-semibold text-[#F5F7FA]">{targetPhone}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-3.5">
              <MessageCircle className="size-4 text-[#8B5CF6]" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#6B7280]">Email Address</p>
                <p className="text-sm font-semibold text-[#F5F7FA] truncate">{targetEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-3.5">
              <Building2 className="size-4 text-[#24C5E3]" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#6B7280]">Department</p>
                <p className="text-sm font-semibold text-[#F5F7FA]">{targetDept?.name ?? "General Agency"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-3.5">
              <Shield className="size-4 text-[#F59E0B]" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#6B7280]">Employment Status</p>
                <p className="text-sm font-semibold capitalize text-[#F5F7FA]">{chatTarget.employment_status}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATE TEAM VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "create-team") {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#07090D] overflow-y-auto">
        <div className="flex items-center gap-3 px-4 py-4 bg-[#0E1117] border-b border-white/[0.08]">
          <button
            onClick={() => setView("main")}
            className="rounded-xl p-2 text-[#A7AFBC] hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h2 className="font-bold text-[#F5F7FA]">Create New Team Squad</h2>
        </div>

        {error && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-[#FF4D67]/30 bg-[#FF4D67]/10 px-4 py-3 text-sm text-[#FF4D67]">
            <X className="size-4" /> {error}
          </div>
        )}

        <form onSubmit={handleCreateTeam} className="flex-1 px-4 py-6 space-y-5 max-w-xl mx-auto w-full">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-[#24C5E3]/30 to-[#8B5CF6]/20 border-2 border-[#24C5E3]/40 text-3xl font-black text-[#24C5E3]">
              {createName.charAt(0).toUpperCase() || <Users className="size-8" />}
            </div>
            <p className="text-xs text-[#6B7280]">Set team identity and select members</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
              Team Name <span className="text-[#FF4D67]">*</span>
            </label>
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              placeholder="e.g. Design Systems & UI"
              className="w-full rounded-xl border border-white/[0.08] bg-[#11151C] px-4 py-3 text-sm text-[#F5F7FA] outline-none focus:border-[#24C5E3]/60 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
              Description
            </label>
            <textarea
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              rows={3}
              placeholder="Core focus & responsibilities of this team..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#11151C] px-4 py-3 text-sm text-[#F5F7FA] outline-none focus:border-[#24C5E3]/60 transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                Department Link
              </label>
              <select
                value={createDeptId}
                onChange={(e) => setCreateDeptId(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-3 text-sm text-[#F5F7FA] outline-none focus:border-[#24C5E3]/60 transition-all cursor-pointer"
              >
                <option value="">No Department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                Status
              </label>
              <select
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value)}
                className="w-full rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-3 text-sm text-[#F5F7FA] outline-none focus:border-[#24C5E3]/60 transition-all cursor-pointer"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Member picker with WhatsApp checklist */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC] flex items-center justify-between">
              <span>Select Team Members</span>
              <span className="text-[#39FF14]">{selectedMemberIds.length} chosen</span>
            </label>
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117] divide-y divide-white/[0.04] max-h-60 overflow-y-auto">
              {employees.map((emp) => {
                const name = getSafeName(emp);
                const isSelected = selectedMemberIds.includes(emp.id);
                return (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] cursor-pointer transition-colors"
                  >
                    <div
                      className={`size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? "border-[#24C5E3] bg-[#24C5E3]" : "border-white/20"
                      }`}
                    >
                      {isSelected && <Check className="size-3 text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={(e) =>
                        setSelectedMemberIds((prev) =>
                          e.target.checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id)
                        )
                      }
                    />
                    <Avatar name={name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#F5F7FA] truncate">{name}</p>
                      <p className="text-[10px] text-[#6B7280] truncate">
                        {emp.job_title ?? getSafeEmail(emp)}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || !createName.trim()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#24C5E3] to-[#8B5CF6] px-4 py-3.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40 shadow-[0_0_20px_rgba(36,197,227,0.3)]"
          >
            {creating ? "Creating Team..." : "Create Team & Assign Members"}
          </button>
        </form>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEAM DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === "team-detail" && selectedTeam) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#07090D] overflow-hidden">
        {renderCallModal()}
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#0E1117] border-b border-white/[0.08] sticky top-0 z-10">
          <button
            onClick={() => {
              setView("main");
              setSelectedTeam(null);
            }}
            className="rounded-xl p-2 text-[#A7AFBC] hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-[#24C5E3]/30 to-[#8B5CF6]/20 border border-white/10 font-bold text-[#24C5E3]">
            {selectedTeam.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#F5F7FA] truncate">{selectedTeam.name}</p>
            <p className="text-xs text-[#6B7280]">
              {membersLoading ? "Loading..." : `${teamMembers.length} member(s)`}
              {activeDepartment && ` · ${activeDepartment.name}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditMode(true);
                setEditName(selectedTeam.name);
                setEditDesc(selectedTeam.description ?? "");
              }}
              className="rounded-xl border border-white/[0.08] p-2 text-[#A7AFBC] hover:text-[#F5F7FA] hover:bg-white/5 transition-colors"
            >
              <Edit2 className="size-4" />
            </button>
            <button
              onClick={handleDeleteTeam}
              className="rounded-xl border border-white/[0.08] p-2 text-[#A7AFBC] hover:text-[#FF4D67] transition-colors"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </div>

        {/* Edit Panel */}
        {editMode && (
          <div className="bg-[#0E1117] border-b border-white/[0.08] px-5 py-4 space-y-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-[#11151C] px-4 py-2.5 text-sm text-[#F5F7FA] outline-none"
            />
            <input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description..."
              className="w-full rounded-xl border border-white/[0.08] bg-[#11151C] px-4 py-2.5 text-sm text-[#A7AFBC] outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (!editName.trim()) return;
                  await fetch(`/api/admin/teams/${selectedTeam.id}`, {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ name: editName, description: editDesc || null }),
                  });
                  setSelectedTeam((t) => (t ? { ...t, name: editName, description: editDesc || null } : t));
                  setEditMode(false);
                  await fetchData();
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 px-4 py-2 text-xs text-[#8B5CF6]"
              >
                <Check className="size-3.5" /> Save
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs text-[#A7AFBC]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Members List */}
          <div className="px-5 py-3 border-b border-white/[0.04]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">
              Members in {selectedTeam.name} ({teamMembers.length})
            </p>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {teamMembers.map((emp) => {
              const name = getSafeName(emp);
              return (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors group cursor-pointer"
                  onClick={() => openChatWithMember(emp)}
                >
                  <Avatar name={name} size="md" status="online" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors truncate">
                        {name}
                      </p>
                      <span className="text-[10px] text-[#39FF14]">online</span>
                    </div>
                    <p className="text-xs text-[#6B7280] truncate mt-0.5">
                      {emp.job_title ?? getSafeEmail(emp)}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => openChatWithMember(emp)}
                      className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-[#6B7280] hover:text-[#8B5CF6]"
                      title="Chat on WhatsApp"
                    >
                      <MessageCircle className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveMemberFromTeam(emp.id)}
                      className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-[#6B7280] hover:text-[#FF4D67]"
                      title="Remove from Team"
                    >
                      <UserMinus className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Members to Team */}
          <div className="border-t border-white/[0.08] px-4 py-4 bg-[#0A0D12] mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-3">
              Add More Members
            </p>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#6B7280]" />
              <input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search other members..."
                className="w-full rounded-xl border border-white/[0.08] bg-[#11151C] pl-9 pr-3 py-2 text-xs text-[#F5F7FA] placeholder-[#6B7280] outline-none"
              />
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {nonTeamMembers.slice(0, 15).map((emp) => {
                const name = getSafeName(emp);
                return (
                  <button
                    key={emp.id}
                    onClick={() => handleAddMemberToTeam(emp.id)}
                    disabled={addingMember}
                    className="w-full flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-white/[0.05] transition-all text-left group"
                  >
                    <Avatar name={name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#F5F7FA] group-hover:text-[#39FF14] truncate">
                        {name}
                      </p>
                      <p className="text-[10px] text-[#6B7280] truncate">{emp.job_title ?? ""}</p>
                    </div>
                    <UserPlus className="size-4 text-[#6B7280] group-hover:text-[#8B5CF6]" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN HUB VIEW (WhatsApp style Tabs)
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#07090D] overflow-hidden">
      {renderCallModal()}
      {/* Top Hub Bar */}
      <div className="px-4 py-3.5 bg-[#0E1117] border-b border-white/[0.08]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#39FF14] to-[#24C5E3] text-[#07090D]">
              <MessageCircle className="size-5 fill-current" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-[#F5F7FA] flex items-center gap-2">
                Agency Team WhatsApp Hub
                <span className="size-2 rounded-full bg-[#39FF14] animate-pulse" />
              </h1>
              <p className="text-[11px] text-[#6B7280]">
                {employees.length} Members · {teams.length} Squads · {departments.length} Departments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("create-team")}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#24C5E3] to-[#8B5CF6] px-3.5 py-2 text-xs font-bold text-white hover:opacity-90 shadow-[0_0_15px_rgba(36,197,227,0.3)] transition-all"
            >
              <Plus className="size-3.5" />
              <span>New Team</span>
            </button>
          </div>
        </div>

        {/* WhatsApp-Style Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 border-b border-white/[0.06] -mx-4 px-4">
          {[
            { id: "members" as const, label: "All Members & Direct Chats", count: employees.length, icon: MessageCircle },
            { id: "teams" as const, label: "Teams & Squads", count: teams.length, icon: Layers },
            { id: "activity" as const, label: "Live Activity", count: null, icon: Activity },
          ].map(({ id, label, count, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMainTab(id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-xs font-bold border-b-2 transition-all ${
                mainTab === id
                  ? "border-[#39FF14] text-[#39FF14]"
                  : "border-transparent text-[#6B7280] hover:text-[#A7AFBC]"
              }`}
            >
              <Icon className="size-3.5" />
              <span>{label}</span>
              {count !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    mainTab === id ? "bg-[#39FF14]/20 text-[#39FF14]" : "bg-white/5 text-[#6B7280]"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {success && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-[#39FF14]/30 bg-[#39FF14]/10 px-4 py-2.5 text-xs text-[#39FF14]">
          <CheckCircle2 className="size-3.5" /> {success}
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="px-4 py-3 bg-[#0A0D12] border-b border-white/[0.04] space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#6B7280]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              mainTab === "members"
                ? "Search team members by name, role, email..."
                : mainTab === "teams"
                ? "Search teams by name..."
                : "Filter activity..."
            }
            className="w-full rounded-xl border border-white/[0.08] bg-[#11151C] pl-10 pr-4 py-2.5 text-xs text-[#F5F7FA] placeholder-[#6B7280] outline-none focus:border-[#39FF14]/50 transition-colors"
          />
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[#6B7280] text-[11px] shrink-0">Department:</span>
          <button
            onClick={() => setDeptFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold shrink-0 transition-colors ${
              deptFilter === "all"
                ? "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30"
                : "bg-white/[0.04] text-[#A7AFBC] border border-white/[0.06] hover:bg-white/[0.08]"
            }`}
          >
            All Departments
          </button>
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeptFilter(d.id)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold shrink-0 transition-colors ${
                deptFilter === d.id
                  ? "bg-[#8B5CF6]/20 text-[#8B5CF6] border border-[#8B5CF6]/40"
                  : "bg-white/[0.04] text-[#A7AFBC] border border-white/[0.06] hover:bg-white/[0.08]"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="flex-1 overflow-y-auto">
        {/* ── TAB 1: ALL MEMBERS (WhatsApp Contact List) ── */}
        {mainTab === "members" && (
          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl animate-pulse">
                    <div className="size-11 rounded-full bg-white/[0.05]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 rounded bg-white/[0.05]" />
                      <div className="h-2.5 w-48 rounded bg-white/[0.05]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="py-20 text-center px-4">
                <Users className="size-12 mx-auto text-[#6B7280] opacity-40 mb-3" />
                <p className="text-sm font-semibold text-[#A7AFBC]">No members matched your search</p>
                <p className="text-xs text-[#6B7280] mt-1">Try adjusting the department filter or search term</p>
              </div>
            ) : (
              filteredEmployees.map((emp) => {
                const name = getSafeName(emp);
                const email = getSafeEmail(emp);
                const dept = departments.find(
                  (d) => d.id === emp.department_id || d.id === emp.departments?.id
                );
                const statusSnippet =
                  SAMPLE_STATUS_LIST[(name.charCodeAt(0) || 0) % SAMPLE_STATUS_LIST.length];

                return (
                  <div
                    key={emp.id}
                    onClick={() => openChatWithMember(emp)}
                    className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    <Avatar name={name} size="md" status="online" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <p className="font-bold text-sm text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors truncate">
                            {name}
                          </p>
                          {dept && (
                            <span className="rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] px-2 py-0.5 text-[9px] font-semibold shrink-0">
                              {dept.name}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#6B7280] font-mono shrink-0">Just now</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-[#6B7280] truncate">
                          <span className="text-[#39FF14] font-medium mr-1">💬</span>
                          {statusSnippet}
                        </p>
                        <span className="text-[10px] text-[#A7AFBC] shrink-0 font-medium">
                          {emp.job_title ?? "Member"}
                        </span>
                      </div>
                    </div>

                    {/* Quick Action Icons */}
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openChatWithMember(emp)}
                        title="Chat"
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[#6B7280] hover:text-[#39FF14] hover:border-[#39FF14]/30"
                      >
                        <MessageCircle className="size-3.5" />
                      </button>
                      <button
                        onClick={() => startCall(emp, "audio")}
                        title="Call"
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[#6B7280] hover:text-[#24C5E3] hover:border-[#24C5E3]/30"
                      >
                        <Phone className="size-3.5" />
                      </button>
                      <button
                        onClick={() => openProfileView(emp)}
                        title="Profile"
                        className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-[#6B7280] hover:text-[#8B5CF6] hover:border-[#8B5CF6]/30"
                      >
                        <MoreVertical className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TAB 2: TEAMS & SQUADS ── */}
        {mainTab === "teams" && (
          <div className="divide-y divide-white/[0.04]">
            {filteredTeams.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
                <Layers className="size-12 text-[#6B7280] opacity-40" />
                <p className="text-sm font-semibold text-[#A7AFBC]">No teams found</p>
                <button
                  onClick={() => setView("create-team")}
                  className="rounded-xl bg-gradient-to-r from-[#24C5E3] to-[#8B5CF6] px-5 py-2.5 text-xs font-bold text-white hover:opacity-90"
                >
                  Create Team Squad
                </button>
              </div>
            ) : (
              filteredTeams.map((team) => {
                const teamDept = departments.find((d) => d.id === team.department_id);
                return (
                  <div
                    key={team.id}
                    onClick={() => openTeamDetail(team)}
                    className="flex items-center gap-4 px-4 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                  >
                    <div className="relative shrink-0">
                      <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#24C5E3]/30 to-[#8B5CF6]/20 border border-white/10 text-lg font-black text-[#24C5E3]">
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm text-[#F5F7FA] group-hover:text-[#24C5E3] transition-colors truncate">
                          {team.name}
                        </p>
                        <span
                          className={`text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${
                            team.status === "active"
                              ? "text-[#39FF14] bg-[#39FF14]/10"
                              : "text-[#6B7280] bg-white/5"
                          }`}
                        >
                          {team.status}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] truncate mt-0.5">
                        {team.description ?? (teamDept ? `${teamDept.name} Department` : "Tap to view squad members")}
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {teamDept && (
                        <span className="text-[10px] font-semibold rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] px-2 py-0.5">
                          {teamDept.name}
                        </span>
                      )}
                      <ChevronRight className="size-4 text-[#6B7280] group-hover:text-white transition-colors" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── TAB 3: LIVE ACTIVITY ── */}
        {mainTab === "activity" && (
          <div className="p-4 sm:p-6 space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117] p-5">
              <h3 className="text-sm font-bold text-[#F5F7FA] flex items-center gap-2 mb-4">
                <Activity className="size-4 text-[#39FF14]" />
                Live Agency Activity Feed
              </h3>
              <div className="space-y-4">
                {employees.slice(0, 8).map((emp, idx) => {
                  const name = getSafeName(emp);
                  const actions = [
                    "joined the Engineering squad",
                    "updated their WhatsApp Business status",
                    "completed sprint tasks in Design unit",
                    "checked in for daily sync",
                    "assigned to Marketing campaign team",
                  ];
                  const action = actions[idx % actions.length];

                  return (
                    <div key={emp.id} className="flex items-center gap-3 text-xs">
                      <Avatar name={name} size="sm" status="online" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#F5F7FA]">
                          <span className="font-semibold">{name}</span>{" "}
                          <span className="text-[#A7AFBC]">{action}</span>
                        </p>
                        <p className="text-[10px] text-[#6B7280] mt-0.5">{idx * 12 + 4} minutes ago</p>
                      </div>
                      <button
                        onClick={() => openChatWithMember(emp)}
                        className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-[#39FF14] hover:bg-[#39FF14]/10 transition-colors"
                      >
                        Ping
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
