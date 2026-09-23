"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ClipboardCheck, FilePlus2, Loader2, Trash2, Video, Image as ImageIcon, BookOpen } from "lucide-react";
import type { LearningResource } from "@/components/learning/learning-library";

const inputClass = "h-10 w-full rounded-xl border border-white/10 bg-[#11151C] px-3 text-sm text-[#F5F7FA] outline-none placeholder:text-[#6B7280] focus:border-[#39FF14]/50";
const textAreaClass = "w-full rounded-xl border border-white/10 bg-[#11151C] px-3 py-2.5 text-sm text-[#F5F7FA] outline-none placeholder:text-[#6B7280] focus:border-[#39FF14]/50";

export function LearningAdminPanel() {
  const [resources, setResources] = React.useState<LearningResource[]>([]);
  const [form, setForm] = React.useState({ title: "", description: "", resource_type: "guide", category: "onboarding", difficulty: "beginner", content: "", media_url: "", image_url: "", duration_minutes: "", quiz_questions: "", is_published: false });
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function load() {
    const response = await fetch("/api/learning-resources", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { resources: LearningResource[] };
    setResources(data.resources ?? []);
  }

  React.useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, []);

  function updateForm(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function createResource(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      let questions: unknown[] = [];
      if (form.quiz_questions.trim()) {
        questions = JSON.parse(form.quiz_questions) as unknown[];
      }
      const response = await fetch("/api/learning-resources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null, media_url: form.media_url || null, image_url: form.image_url || null, quiz_questions: questions }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Resource could not be created.");
      setMessage("Resource published to Learn & Tips.");
      setForm({ title: "", description: "", resource_type: "guide", category: "onboarding", difficulty: "beginner", content: "", media_url: "", image_url: "", duration_minutes: "", quiz_questions: "", is_published: false });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Resource could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePublished(resource: LearningResource) {
    const response = await fetch(`/api/learning-resources/${resource.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ is_published: !resource.is_published }) });
    if (response.ok) await load();
  }

  async function removeResource(id: string) {
    if (!window.confirm("Delete this learning resource?")) return;
    const response = await fetch(`/api/learning-resources/${id}`, { method: "DELETE" });
    if (response.ok) await load();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#39FF14]/20 bg-[#0E1117]/90 p-5 sm:p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#39FF14]"><FilePlus2 className="size-4" /> Academy publishing desk</div><h1 className="mt-2 text-3xl font-black text-[#F5F7FA]">Learn &amp; Tips Manager</h1><p className="mt-1 max-w-2xl text-sm text-[#A7AFBC]">Publish practical videos, screenshots, SOP guidance, and knowledge checks for the whole team.</p></div>

      <form onSubmit={createResource} className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/90 p-5 sm:p-6"><div className="mb-5 flex items-center gap-2"><FilePlus2 className="size-4 text-[#39FF14]" /><h2 className="text-sm font-bold text-[#F5F7FA]">Create a learning resource</h2></div><div className="grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="label-text">Title</span><input required value={form.title} onChange={(event) => updateForm("title", event.target.value)} placeholder="e.g. How we write a client-ready daily report" className={`${inputClass} mt-2`} /></label><label><span className="label-text">Format</span><select value={form.resource_type} onChange={(event) => updateForm("resource_type", event.target.value)} className={`${inputClass} mt-2`}><option value="guide">Guide</option><option value="video">Video</option><option value="image">Visual guide</option><option value="test">Knowledge test</option></select></label><label><span className="label-text">Difficulty</span><select value={form.difficulty} onChange={(event) => updateForm("difficulty", event.target.value)} className={`${inputClass} mt-2`}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label><label><span className="label-text">Category</span><input value={form.category} onChange={(event) => updateForm("category", event.target.value)} placeholder="onboarding, tools, process..." className={`${inputClass} mt-2`} /></label><label><span className="label-text">Duration (minutes)</span><input type="number" min="1" value={form.duration_minutes} onChange={(event) => updateForm("duration_minutes", event.target.value)} placeholder="Optional" className={`${inputClass} mt-2`} /></label><label className="sm:col-span-2"><span className="label-text">Short description</span><textarea rows={2} value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="What will a new team member learn?" className={`${textAreaClass} mt-2`} /></label><label className="sm:col-span-2"><span className="label-text">Guidance / lesson content</span><textarea rows={6} value={form.content} onChange={(event) => updateForm("content", event.target.value)} placeholder="Write the steps, context, examples, and tips here..." className={`${textAreaClass} mt-2`} /></label><label><span className="label-text">Video or media URL</span><input type="url" value={form.media_url} onChange={(event) => updateForm("media_url", event.target.value)} placeholder="YouTube, Vimeo, or hosted file URL" className={`${inputClass} mt-2`} /></label><label><span className="label-text">Cover / image URL</span><input type="url" value={form.image_url} onChange={(event) => updateForm("image_url", event.target.value)} placeholder="Optional image URL" className={`${inputClass} mt-2`} /></label><label className="sm:col-span-2"><span className="label-text">Test questions JSON (for Knowledge test)</span><textarea rows={4} value={form.quiz_questions} onChange={(event) => updateForm("quiz_questions", event.target.value)} placeholder={'[{"question":"What is our first step?","options":["Plan","Skip","Guess"],"answer":0}]'} className={`${textAreaClass} mt-2 font-mono text-xs`} /></label></div><div className="mt-5 flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-xs text-[#A7AFBC]"><input type="checkbox" checked={form.is_published} onChange={(event) => updateForm("is_published", event.target.checked)} className="size-4 accent-[#39FF14]" /> Publish immediately for employees</label><Button type="submit" variant="primary" disabled={busy}>{busy ? <><Loader2 className="size-4 animate-spin" />Publishing...</> : "Save resource"}</Button>{message && <span className="text-xs text-[#24C5E3]">{message}</span>}</div></form>

      <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wider text-[#A7AFBC]">All academy resources</h2><span className="text-xs text-[#6B7280]">{resources.length} total</span></div>{resources.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-[#6B7280]">No resources yet. Publish the first guide above.</div> : resources.map((resource) => <article key={resource.id} className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-[#24C5E3]">{resource.resource_type === "video" ? <Video className="size-5" /> : resource.resource_type === "image" ? <ImageIcon className="size-5" /> : resource.resource_type === "test" ? <ClipboardCheck className="size-5" /> : <BookOpen className="size-5" />}</div><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#F5F7FA]">{resource.title}</h3><p className="mt-1 text-xs text-[#6B7280]">{resource.category} · {resource.difficulty} · {resource.resource_type}</p></div></div><div className="flex items-center gap-2"><button type="button" onClick={() => void togglePublished(resource)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${resource.is_published ? "bg-[#39FF14]/10 text-[#39FF14]" : "bg-white/5 text-[#6B7280]"}`}>{resource.is_published && <CheckCircle2 className="size-3.5" />}{resource.is_published ? "Published" : "Draft"}</button><button type="button" onClick={() => void removeResource(resource.id)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#FF4D67]/10 hover:text-[#FF4D67]"><Trash2 className="size-4" /></button></div></article>)}</div>
    </div>
  );
}
