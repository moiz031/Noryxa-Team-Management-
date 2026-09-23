"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CheckSquare,
  FolderKanban,
  Users,
  Building,
  FileText,
  Megaphone,
  ArrowRight,
  Sparkles,
  Command,
  X,
  Clock,
} from "lucide-react";

interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  url?: string;
}

interface SearchResponseData {
  results?: {
    tasks?: SearchResultItem[];
    projects?: SearchResultItem[];
    employees?: SearchResultItem[];
    teams?: SearchResultItem[];
    clients?: SearchResultItem[];
    documents?: SearchResultItem[];
    announcements?: SearchResultItem[];
  };
  totalResults?: number;
}

const quickLinks = [
  { label: "Dashboard", href: "/dashboard", icon: Sparkles, category: "Navigation" },
  { label: "Tasks", href: "/tasks", icon: CheckSquare, category: "Navigation" },
  { label: "Projects", href: "/projects", icon: FolderKanban, category: "Navigation" },
  { label: "Daily Reports", href: "/reports", icon: Clock, category: "Navigation" },
  { label: "Attendance", href: "/attendance", icon: Clock, category: "Navigation" },
  { label: "Announcements", href: "/announcements", icon: Megaphone, category: "Navigation" },
  { label: "Team Feed", href: "/feed", icon: Users, category: "Navigation" },
  { label: "Community", href: "/community", icon: Users, category: "Navigation" },
  { label: "Learn & Tips", href: "/learn", icon: FileText, category: "Navigation" },
  { label: "Documents", href: "/documents", icon: FileText, category: "Navigation" },
];

export function CommandPalette({
  open,
  onClose,
  role = "employee",
}: {
  open: boolean;
  onClose: () => void;
  role?: "admin" | "employee";
}) {
  const router = useRouter() as { push(path: string): void };
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SearchResponseData | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      const focusTimer = setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
      return () => clearTimeout(focusTimer);
    } else {
      document.body.style.overflow = "";
      const resetTimer = setTimeout(() => {
        setQuery("");
        setResults(null);
      }, 0);
      return () => clearTimeout(resetTimer);
    }
  }, [open]);

  // Debounced search query
  React.useEffect(() => {
    if (query.trim().length < 2) {
      const clearTimer = setTimeout(() => {
        setResults(null);
        setLoading(false);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
        }
      } catch {
        // Search error gracefully ignored in command palette
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Global keyboard listener
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function handleSelect(href?: string) {
    if (!href) return;
    onClose();
    router.push(href);
  }

  const categoryIcons: Record<string, typeof CheckSquare> = {
    tasks: CheckSquare,
    projects: FolderKanban,
    employees: Users,
    teams: Users,
    clients: Building,
    documents: FileText,
    announcements: Megaphone,
  };

  const hasResults =
    results?.results &&
    Object.values(results.results).some((arr) => arr && arr.length > 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center p-4 pt-20 sm:pt-28">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#07090D]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette Box */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/[0.14] bg-[#0E1117] shadow-[0_24px_60px_rgba(0,0,0,0.85)] animate-modal-in">
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-white/[0.08] px-4 py-3.5">
          <Search className="size-5 text-[#39FF14]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search tasks, projects, people..."
            className="ml-3 flex-1 bg-transparent text-sm text-[#F5F7FA] placeholder-[#6B7280] outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mr-2 text-[#6B7280] hover:text-white"
            >
              <X className="size-4" />
            </button>
          )}
          <span className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[#A7AFBC]">
            ESC
          </span>
        </div>

        {/* Results Area */}
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-[#A7AFBC]">
              <div className="size-4 animate-spin rounded-full border-2 border-[#39FF14] border-t-transparent mr-2.5" />
              Searching NORYXA systems...
            </div>
          )}

          {!loading && query.trim().length >= 2 && !hasResults && (
            <div className="py-10 text-center text-sm text-[#6B7280]">
              No results found for &ldquo;<span className="text-[#F5F7FA]">{query}</span>&rdquo;.
            </div>
          )}

          {!loading && results?.results && hasResults && (
            <div className="space-y-4">
              {Object.entries(results.results).map(([category, items]) => {
                if (!items || items.length === 0) return null;
                const IconComponent = categoryIcons[category] || FileText;

                return (
                  <div key={category}>
                    <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                      {category}
                    </p>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const targetUrl =
                          item.url ??
                          (category === "tasks"
                            ? role === "admin"
                              ? `/admin/tasks`
                              : `/tasks`
                            : category === "projects"
                            ? role === "admin"
                              ? `/admin/projects`
                              : `/projects`
                            : category === "employees"
                            ? `/admin/employees/${item.id}`
                            : category === "clients"
                            ? `/admin/clients/${item.id}`
                            : category === "documents"
                            ? `/documents`
                            : category === "announcements"
                            ? `/announcements`
                            : `/dashboard`);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(targetUrl)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[#F5F7FA] transition-colors hover:bg-white/[0.06] group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <IconComponent className="size-4 text-[#24C5E3] shrink-0" />
                              <div className="truncate">
                                <p className="font-medium text-[#F5F7FA] truncate group-hover:text-[#39FF14] transition-colors">
                                  {item.title}
                                </p>
                                {item.subtitle && (
                                  <p className="text-xs text-[#A7AFBC] truncate">
                                    {item.subtitle}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="size-3.5 text-[#6B7280] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!query && (
            <div>
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                Quick Navigation
              </p>
              <div className="grid grid-cols-2 gap-1">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.href}
                      type="button"
                      onClick={() => handleSelect(link.href)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[#A7AFBC] transition-colors hover:bg-white/[0.06] hover:text-[#F5F7FA]"
                    >
                      <Icon className="size-4 text-[#39FF14]" />
                      <span>{link.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.06] bg-[#07090D] px-4 py-2.5 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <Command className="size-3" />
            <span>NORYXA Global Search</span>
          </div>
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px]">↑</kbd>{" "}
              <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px]">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px]">↵</kbd> to select
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
