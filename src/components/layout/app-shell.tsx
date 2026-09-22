"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  CheckSquare,
  FolderKanban,
  Clock,
  Calendar,
  Megaphone,
  Users,
  FileText,
  Bell,
  Search,
  LogOut,
  Shield,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Zap,
  Building2,
  CalendarDays,
  UserCheck,
  ClipboardList,
  Layers,
  Activity,
  Settings,
} from "lucide-react";
import { CommandPalette } from "@/components/ui/command-palette";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  role?: "admin" | "employee";
  userEmail?: string;
  unreadCount?: number;
}

export function AppShell({
  children,
  role = "employee",
  userEmail,
  unreadCount = 0,
}: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

  // Global Cmd+K / Ctrl+K shortcut listener
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Employee navigation groups
  const employeeNavSections = [
    {
      title: "Core Hub",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: Sparkles },
        { label: "My Tasks", href: "/tasks", icon: CheckSquare },
        { label: "Projects", href: "/projects", icon: FolderKanban },
      ],
    },
    {
      title: "Operations",
      items: [
        { label: "Daily Reports", href: "/reports", icon: Clock },
        { label: "Attendance", href: "/attendance", icon: UserCheck },
        { label: "Leave Requests", href: "/leave", icon: Calendar },
        { label: "Announcements", href: "/announcements", icon: Megaphone },
        { label: "Team Feed", href: "/feed", icon: Users },
        { label: "Documents", href: "/documents", icon: FileText },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Analytics", href: "/analytics", icon: Activity },
        { label: "My Scorecard", href: "/scorecard", icon: Zap },
      ],
    },
  ];

  // Admin navigation groups
  const adminNavSections = [
    {
      title: "Command Center",
      items: [
        { label: "Overview", href: "/admin", icon: Shield },
        { label: "Projects", href: "/admin/projects", icon: FolderKanban },
        { label: "Tasks", href: "/admin/tasks", icon: CheckSquare },
        { label: "Employees", href: "/admin/employees", icon: Users },
        { label: "Departments", href: "/admin/departments", icon: Building2 },
        { label: "Teams", href: "/admin/teams", icon: Layers },
      ],
    },
    {
      title: "Agency Operations",
      items: [
        { label: "Clients", href: "/admin/clients", icon: Building2 },
        { label: "Daily Reports", href: "/admin/daily-reports", icon: ClipboardList },
        { label: "Attendance", href: "/admin/attendance", icon: UserCheck },
        { label: "Leave Requests", href: "/admin/leave", icon: Calendar },
        { label: "Schedules", href: "/admin/schedules", icon: Clock },
        { label: "Holidays", href: "/admin/holidays", icon: CalendarDays },
        { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
        { label: "Activity Audit", href: "/admin/activity", icon: Activity },
        { label: "Analytics", href: "/admin/analytics", icon: Activity },
        { label: "Team Scorecards", href: "/admin/scorecards", icon: Zap },
        { label: "Organization Settings", href: "/admin/settings", icon: Settings },
      ],
    },
  ];

  const navSections = role === "admin" ? adminNavSections : employeeNavSections;

  return (
    <div className="min-h-screen bg-[#07090D] text-[#F5F7FA] flex flex-col antialiased noryxa-grid-bg">
      {/* Top Command Bar */}
      <header className="sticky top-0 z-40 h-16 border-b border-white/[0.08] bg-[#07090D]/85 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          {/* Left Brand & Mobile Toggle */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden rounded-lg p-2 text-[#A7AFBC] hover:bg-white/5 hover:text-white"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <Link href={role === "admin" ? "/admin" : "/dashboard"} className="flex items-center gap-3">
              <div className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#39FF14] to-[#24C5E3] font-black text-[#07090D] shadow-[0_0_16px_rgba(57,255,20,0.35)]">
                <span className="text-base font-extrabold tracking-tighter">N</span>
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-wider text-[#F5F7FA]">NORYXA</span>
                  <span className="rounded-full bg-[#39FF14]/10 px-2 py-0.5 text-[10px] font-semibold text-[#39FF14] border border-[#39FF14]/20">
                    {role === "admin" ? "ADMIN" : "OS"}
                  </span>
                </div>
                <p className="text-[10px] font-medium tracking-tight text-[#6B7280]">
                  Agency Operating System
                </p>
              </div>
            </Link>
          </div>

          {/* Center Search / Command Launcher */}
          <div className="flex-1 max-w-md mx-4 hidden md:block">
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-[#0E1117]/90 px-3.5 py-2 text-xs text-[#A7AFBC] transition-all hover:border-white/20 hover:bg-[#11151C] hover:text-white group"
            >
              <div className="flex items-center gap-2.5">
                <Search className="size-4 text-[#39FF14] transition-transform group-hover:scale-110" />
                <span>Search tasks, projects, people...</span>
              </div>
              <kbd className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[#A7AFBC]">
                <span>⌘</span>K
              </kbd>
            </button>
          </div>

          {/* Right Status & Profile Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live System Telemetry */}
            <div className="hidden xl:flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1 text-xs text-[#A7AFBC]">
              <span className="size-2 rounded-full bg-[#39FF14] animate-pulse-glow" />
              <span className="font-mono text-[11px] text-[#A7AFBC]">All systems operational</span>
            </div>

            {/* Notifications Button */}
            <Link
              href="/notifications"
              className="relative rounded-xl border border-white/[0.08] bg-[#0E1117] p-2 text-[#A7AFBC] hover:border-white/20 hover:text-white transition-colors"
              title="Notifications"
            >
              <Bell className="size-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-[#39FF14] text-[9px] font-bold text-[#07090D] shadow-[0_0_8px_rgba(57,255,20,0.6)]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* User Profile / Status */}
            <div className="flex items-center gap-3 border-l border-white/[0.08] pl-3 sm:pl-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-medium text-[#F5F7FA] truncate max-w-[140px]">
                  {userEmail ?? "Team Member"}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-[#39FF14] font-semibold">
                  {role}
                </p>
              </div>

              {/* Sign out */}
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  title="Sign out"
                  className="rounded-xl border border-white/[0.08] bg-[#0E1117] p-2 text-[#A7AFBC] hover:border-[#FF4D67]/30 hover:bg-[#FF4D67]/10 hover:text-[#FF4D67] transition-all duration-150"
                >
                  <LogOut className="size-4" />
                  <span className="sr-only">Sign out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            "hidden lg:flex flex-col border-r border-white/[0.08] bg-[#0A0D12]/90 backdrop-blur-lg transition-all duration-200 z-30",
            collapsed ? "w-20" : "w-64"
          )}
        >
          {/* Workspace Switcher Pill */}
          <div className="p-4 border-b border-white/[0.06]">
            {!collapsed ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#11151C] p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-[#39FF14]" />
                    <span className="text-xs font-semibold text-[#F5F7FA]">NORYXA Workspace</span>
                  </div>
                  <span className="size-1.5 rounded-full bg-[#39FF14] animate-pulse" />
                </div>
                <p className="mt-1 text-[11px] text-[#6B7280]">Production Environment</p>
              </div>
            ) : (
              <div className="grid size-11 mx-auto place-items-center rounded-xl bg-[#11151C] border border-white/[0.08]">
                <Zap className="size-4 text-[#39FF14]" />
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {!collapsed && (
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
                    {section.title}
                  </p>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/admin" && item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150",
                        isActive
                          ? "bg-white/[0.08] text-[#39FF14] font-semibold shadow-inner"
                          : "text-[#A7AFBC] hover:bg-white/[0.04] hover:text-[#F5F7FA]",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      {/* Active Left Accent Line */}
                      {isActive && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.8)]" />
                      )}
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-transform group-hover:scale-110",
                          isActive ? "text-[#39FF14]" : "text-[#A7AFBC] group-hover:text-white"
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Collapse Toggle */}
          <div className="p-3 border-t border-white/[0.06] flex items-center justify-between">
            {!collapsed && (
              <span className="text-[11px] text-[#6B7280]">Collapse navigation</span>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-lg p-1.5 text-[#A7AFBC] hover:bg-white/5 hover:text-white transition-colors"
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </div>
        </aside>

        {/* Mobile Slide-Over Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-[#07090D]/80 backdrop-blur-md"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 w-72 h-full bg-[#0A0D12] border-r border-white/10 p-5 flex flex-col animate-drawer-in">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-[#39FF14] to-[#24C5E3] font-bold text-[#07090D]">
                    N
                  </div>
                  <span className="text-sm font-bold tracking-wider">NORYXA</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1 text-[#A7AFBC] hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-6">
                {navSections.map((section) => (
                  <div key={section.title} className="space-y-1">
                    <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">
                      {section.title}
                    </p>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-white/10 text-[#39FF14]"
                              : "text-[#A7AFBC] hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        role={role}
      />
    </div>
  );
}
