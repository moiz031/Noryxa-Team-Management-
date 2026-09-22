import { requireEmployee } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentDownloadButton } from "@/components/document-download-button";
import { FileText, Calendar } from "lucide-react";

export default async function DocumentsPage() {
  const context = await requireEmployee();
  const db = await createSupabaseServerClient();

  const { data } = await db
    .from("documents")
    .select("id,title,description,file_name,mime_type,created_at")
    .order("created_at", { ascending: false });

  const docs = data ?? [];

  return (
    <AppShell
      role="employee"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8B5CF6]">
              <FileText className="size-3.5" />
              <span>Agency Knowledge Base</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Documents & Assets
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Internal agency operating procedures, templates, and shared file assets.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-2 text-xs">
            <span className="text-[#6B7280]">Files: </span>
            <span className="font-bold text-[#F5F7FA]">{docs.length}</span>
          </div>
        </div>

        {/* Documents Grid */}
        {docs.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6" />}
            title="No documents uploaded"
            description="Knowledge base documents and templates will be accessible here once published."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {docs.map((doc) => (
              <article
                key={doc.id}
                className="group flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0E1117]/85 p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#11151C]"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#8B5CF6]">
                      <FileText className="size-5" />
                    </div>
                    <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] uppercase font-bold text-[#A7AFBC]">
                      {doc.mime_type ? doc.mime_type.split("/")[1] || "file" : "doc"}
                    </span>
                  </div>

                  <h2 className="mt-3.5 text-base font-bold text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors">
                    {doc.title}
                  </h2>

                  <p className="mt-1 font-mono text-xs text-[#24C5E3] truncate">
                    {doc.file_name}
                  </p>

                  {doc.description && (
                    <p className="mt-2 text-xs text-[#A7AFBC] line-clamp-2 leading-relaxed">
                      {doc.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#6B7280]">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3 text-[#6B7280]" />
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </span>
                  <DocumentDownloadButton id={doc.id} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
