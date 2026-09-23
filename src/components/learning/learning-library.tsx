"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  CheckCircle2,
  ChevronRight,
  CheckCircle2 as ClipboardCheck,
  Clock3,
  Eye as ImageIcon,
  PlayCircle,
  Search,
  Zap as Trophy,
  X,
} from "lucide-react";

type Question = { question: string; options: string[]; answer: number };
type Progress = { status: "started" | "completed"; score: number | null; completed_at: string | null } | null;
export type LearningResource = {
  id: string;
  title: string;
  description: string | null;
  resource_type: "video" | "image" | "guide" | "test";
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  content: string | null;
  media_url: string | null;
  image_url: string | null;
  duration_minutes: number | null;
  quiz_questions: Question[];
  is_published: boolean;
  created_at: string;
  progress: Progress;
};

const resourceMeta = {
  video: { label: "Video", icon: PlayCircle, color: "#24C5E3" },
  image: { label: "Visual guide", icon: ImageIcon, color: "#8B5CF6" },
  guide: { label: "Guide", icon: FileText, color: "#39FF14" },
  test: { label: "Knowledge check", icon: ClipboardCheck, color: "#F5B942" },
} as const;

function embedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("youtube.com")) return `https://www.youtube.com/embed/${parsed.searchParams.get("v") ?? ""}`;
    if (parsed.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${parsed.pathname.split("/").filter(Boolean).pop()}`;
  } catch {
    return url;
  }
  return url;
}

export function LearningLibrary() {
  const [resources, setResources] = React.useState<LearningResource[]>([]);
  const [selected, setSelected] = React.useState<LearningResource | null>(null);
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState("all");
  const [category, setCategory] = React.useState("all");
  const [answers, setAnswers] = React.useState<Record<number, number>>({});
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const loadResources = React.useCallback(async () => {
    try {
      const response = await fetch("/api/learning-resources", { cache: "no-store" });
      if (!response.ok) throw new Error("Learning library could not be loaded.");
      const data = (await response.json()) as { resources: LearningResource[] };
      setResources(data.resources ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Learning library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => void loadResources(), 0);
    return () => clearTimeout(timer);
  }, [loadResources]);

  async function openResource(resource: LearningResource) {
    setSelected(resource);
    setAnswers({});
    setMessage("");
    if (!resource.progress) {
      await fetch(`/api/learning-resources/${resource.id}/progress`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "started" }) });
    }
  }

  async function completeResource(score?: number) {
    if (!selected) return;
    const response = await fetch(`/api/learning-resources/${selected.id}/progress`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "completed", score: score ?? null, answers }) });
    if (!response.ok) { setMessage("Progress could not be saved. Please try again."); return; }
    setMessage("Completed — your progress has been saved.");
    await loadResources();
    const updated = resources.find((resource) => resource.id === selected.id);
    if (updated) setSelected({ ...updated, progress: { status: "completed", score: score ?? null, completed_at: new Date().toISOString() } });
  }

  function submitQuiz() {
    if (!selected?.quiz_questions.length) return void completeResource(100);
    const score = Math.round((selected.quiz_questions.reduce((total, question, index) => total + (answers[index] === question.answer ? 1 : 0), 0) / selected.quiz_questions.length) * 100);
    void completeResource(score);
  }

  const categories = Array.from(new Set(resources.map((resource) => resource.category))).sort();
  const filteredResources = resources.filter((resource) => {
    const matchesText = !search.trim() || `${resource.title} ${resource.description ?? ""} ${resource.category}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (type === "all" || resource.resource_type === type) && (category === "all" || resource.category === category);
  });
  const completedCount = resources.filter((resource) => resource.progress?.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#39FF14]/15 bg-gradient-to-br from-[#0E1117] via-[#0E1117] to-[#101C12] p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#39FF14]"><BookOpen className="size-3.5" /> NORYXA Academy</div><h1 className="mt-2 text-3xl font-black tracking-tight text-[#F5F7FA]">Learn &amp; Tips</h1><p className="mt-1 max-w-2xl text-sm text-[#A7AFBC]">Practical videos, visual explainers, SOP guidance, and quick tests to help every beginner grow with the team.</p></div>
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#07090D]/40 px-4 py-3"><Trophy className="size-5 text-[#F5B942]" /><div><p className="text-lg font-bold text-[#F5F7FA]">{completedCount}/{resources.length}</p><p className="text-[10px] uppercase tracking-wider text-[#6B7280]">Completed</p></div></div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative flex-1 lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6B7280]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search guides, videos, tips..." className="h-10 w-full rounded-xl border border-white/10 bg-[#0E1117] pl-9 pr-3 text-sm text-[#F5F7FA] outline-none placeholder:text-[#6B7280] focus:border-[#39FF14]/50" /></div><div className="flex flex-wrap gap-2"><select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#0E1117] px-3 text-xs text-[#A7AFBC] outline-none"><option value="all">All formats</option><option value="video">Videos</option><option value="image">Visual guides</option><option value="guide">Guides</option><option value="test">Tests</option></select><select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#0E1117] px-3 text-xs text-[#A7AFBC] outline-none"><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>

      {message && !selected && <div className="rounded-xl border border-[#24C5E3]/20 bg-[#24C5E3]/10 px-4 py-3 text-xs text-[#24C5E3]">{message}</div>}
      {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl border border-white/5 bg-[#0E1117]" />)}</div> : filteredResources.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-[#0E1117]/60 p-12 text-center"><BookOpen className="mx-auto size-8 text-[#39FF14]" /><h2 className="mt-3 text-base font-semibold text-[#F5F7FA]">Your learning shelf is ready</h2><p className="mx-auto mt-1 max-w-md text-sm text-[#6B7280]">Admin-published videos, guides, and tests will appear here as the academy grows.</p></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filteredResources.map((resource) => { const meta = resourceMeta[resource.resource_type]; const Icon = meta.icon; return <button key={resource.id} type="button" onClick={() => void openResource(resource)} className="group text-left rounded-2xl border border-white/[0.08] bg-[#0E1117]/90 p-4 transition-all hover:-translate-y-0.5 hover:border-white/20"><div className="relative flex h-32 items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-[#11151C]">{resource.image_url ? <img src={resource.image_url} alt="" className="size-full object-cover opacity-80 transition-transform group-hover:scale-105" /> : <Icon className="size-10" style={{ color: meta.color }} />}{resource.progress?.status === "completed" && <span className="absolute right-2 top-2 rounded-full bg-[#39FF14] p-1 text-[#07090D]"><CheckCircle2 className="size-3.5" /></span>}</div><div className="mt-4 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.color }}><Icon className="size-3" />{meta.label}</span><span className="text-[10px] capitalize text-[#6B7280]">{resource.difficulty}</span></div><h2 className="mt-2 line-clamp-2 text-sm font-bold text-[#F5F7FA] group-hover:text-[#39FF14]">{resource.title}</h2>{resource.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#A7AFBC]">{resource.description}</p>}<div className="mt-4 flex items-center gap-3 text-[10px] text-[#6B7280]"><span>{resource.category}</span>{resource.duration_minutes && <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{resource.duration_minutes} min</span>}<ChevronRight className="ml-auto size-4" /></div></button>})}</div>}

      {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#07090D]/85 p-0 backdrop-blur-sm sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0E1117] p-5 shadow-2xl sm:rounded-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><button type="button" onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7280] hover:text-white"><ArrowLeft className="size-3.5" /> Back to library</button><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: resourceMeta[selected.resource_type].color }}>{React.createElement(resourceMeta[selected.resource_type].icon, { className: "size-4" })}{resourceMeta[selected.resource_type].label}</div><h2 className="mt-2 text-2xl font-black text-[#F5F7FA]">{selected.title}</h2>{selected.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A7AFBC]">{selected.description}</p>}</div><button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 text-[#6B7280] hover:bg-white/5 hover:text-white"><X className="size-5" /></button></div>{selected.resource_type === "video" && selected.media_url && <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black"><iframe src={embedUrl(selected.media_url)} title={selected.title} className="size-full" allowFullScreen /></div>}{selected.resource_type === "image" && (selected.media_url || selected.image_url) && <img src={selected.media_url || selected.image_url || ""} alt={selected.title} className="mt-6 max-h-[420px] w-full rounded-2xl border border-white/10 object-contain bg-[#07090D]" />}{selected.content && <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-white/[0.08] bg-[#11151C] p-5 text-sm leading-7 text-[#D7DCE3]">{selected.content}</div>}{selected.resource_type === "test" && selected.quiz_questions.length > 0 && <div className="mt-6 space-y-4">{selected.quiz_questions.map((question, index) => <div key={`${question.question}-${index}`} className="rounded-2xl border border-white/[0.08] bg-[#11151C] p-4"><p className="text-sm font-semibold text-[#F5F7FA]">{index + 1}. {question.question}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition-colors ${answers[index] === optionIndex ? "border-[#F5B942]/50 bg-[#F5B942]/10 text-[#F5F7FA]" : "border-white/10 text-[#A7AFBC] hover:bg-white/5"}`}><input type="radio" name={`question-${index}`} checked={answers[index] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [index]: optionIndex }))} className="accent-[#F5B942]" />{option}</label>)}</div></div>)}</div>}{message && <div className="mt-5 rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/10 px-4 py-3 text-xs text-[#39FF14]">{message}</div>}<div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-5"><div className="text-xs text-[#6B7280]">{selected.progress?.status === "completed" ? `Completed${selected.progress.score !== null ? ` · ${selected.progress.score}%` : ""}` : "Not completed yet"}</div>{selected.resource_type === "test" ? <Button type="button" variant="primary" onClick={submitQuiz}>{selected.progress?.status === "completed" ? "Retake test" : "Submit test"}</Button> : <Button type="button" variant="primary" onClick={() => void completeResource()}>{selected.progress?.status === "completed" ? "Completed" : "Mark as completed"}</Button>}</div></div></div>}
    </div>
  );
}
