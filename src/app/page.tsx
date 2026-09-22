import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Shield,
  Zap,
  ArrowRight,
  Activity,
  Layers,
  Lock,
  Cpu,
  CheckCircle2,
} from "lucide-react";

const capabilities = [
  {
    icon: Cpu,
    title: "AI Automation Core",
    text: "Automated report ingestion, attendance telemetry, and intelligence workflows tailored for modern agency scale.",
    badge: "Automation",
  },
  {
    icon: Shield,
    title: "Role-Enforced Security",
    text: "Administrative and employee boundaries validated in the database with strict Row Level Security (RLS).",
    badge: "Security",
  },
  {
    icon: Zap,
    title: "Realtime Telemetry",
    text: "Sub-second event bus delivering instant operational counters, notifications, and live team feed broadcasts.",
    badge: "Realtime",
  },
  {
    icon: Layers,
    title: "Unified Project Hub",
    text: "Milestones, client accounts, task lifecycles, and team assignments synchronized in a central control tower.",
    badge: "Operations",
  },
  {
    icon: Lock,
    title: "Isolated File Storage",
    text: "Private S3-compatible buckets with uploader-scoped paths and signed download authorization for critical assets.",
    badge: "Storage",
  },
  {
    icon: Activity,
    title: "Forensic Audit Logging",
    text: "Append-only immutable operational logs with source metadata, IP attribution, and tamper-resistant triggers.",
    badge: "Compliance",
  },
];

const telemetryStats = [
  { label: "Active Systems", value: "99.98%", subtext: "Operational uptime" },
  { label: "Role Isolation", value: "Strict RLS", subtext: "Postgres-enforced" },
  { label: "Realtime Latency", value: "< 24ms", subtext: "WebSocket stream" },
  { label: "Data Integrity", value: "Zero Loss", subtext: "Immutable logging" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[#07090D] text-[#F5F7FA] overflow-hidden noryxa-grid-bg">
      {/* Background ambient light orbs */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-gradient-to-b from-[#39FF14]/15 via-[#24C5E3]/10 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 size-[500px] rounded-full bg-[#8B5CF6]/10 blur-[150px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-10 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <Image src="/noryxa-logo.svg" alt="Noryxa Digital Solution" width={180} height={68} priority className="h-12 w-auto" />
          <div className="hidden sm:block">
            <span className="block text-[10px] tracking-tight text-[#6B7280]">
              Agency Command Center
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1 text-xs text-[#A7AFBC]">
            <span className="size-2 rounded-full bg-[#39FF14] animate-pulse-glow" />
            <span className="font-mono text-[11px]">System Online</span>
          </div>

          <Link
            href="/admin/login"
            className="text-xs font-medium text-[#A7AFBC] hover:text-white transition-colors"
          >
            Admin Portal
          </Link>

          <Link href="/login">
            <Button size="sm" variant="primary">
              Sign In
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-6 pt-20 pb-16 text-center lg:px-10 lg:pt-28">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#39FF14]/30 bg-[#39FF14]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#39FF14] shadow-[0_0_20px_rgba(57,255,20,0.2)]">
          <Sparkles className="size-3.5" />
          <span>Agency Operating System</span>
        </div>

        <h1 className="mt-8 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl leading-[1.1]">
          The Intelligent Operating System for Modern Agency Scale.
        </h1>

        <p className="mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-[#A7AFBC]">
          NORYXA orchestrates people, client deliverables, daily telemetry, attendance, secure knowledge, and audit trails inside one unified digital headquarters.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/login">
            <Button size="lg" variant="primary" className="px-8 shadow-[0_0_30px_rgba(57,255,20,0.3)]">
              Launch Workspace
              <ArrowRight className="size-4" />
            </Button>
          </Link>

          <Link href="/admin/login">
            <Button size="lg" variant="secondary" className="px-6">
              <Shield className="size-4 text-[#24C5E3]" />
              Admin Command Console
            </Button>
          </Link>
        </div>

        {/* Telemetry Stat Bar */}
        <div className="mt-16 grid w-full grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4 sm:p-6 backdrop-blur-md">
          {telemetryStats.map((stat) => (
            <div key={stat.label} className="text-left px-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-[#F5F7FA]">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-[#39FF14] flex items-center gap-1">
                <CheckCircle2 className="size-3" />
                {stat.subtext}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-20 lg:px-10 border-t border-white/[0.06]">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#24C5E3]">
            Engineered For High-Performance Teams
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl text-[#F5F7FA]">
            Agency architecture built without compromises.
          </h2>
          <p className="mt-3 text-sm text-[#A7AFBC]">
            Designed from day one with enterprise authorization, realtime event synchronization, and structured observability.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map(({ icon: Icon, title, text, badge }) => (
            <div
              key={title}
              className="group relative rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-6 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="grid size-11 place-items-center rounded-xl border border-white/10 bg-[#11151C] text-[#39FF14] transition-transform duration-200 group-hover:scale-110 shadow-[0_0_15px_rgba(57,255,20,0.15)]">
                  <Icon className="size-5" />
                </div>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold text-[#A7AFBC] border border-white/10">
                  {badge}
                </span>
              </div>
              <h3 className="text-base font-semibold text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors">
                {title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#A7AFBC]">
                {text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] bg-[#07090D] py-10 px-6 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#F5F7FA]">NORYXA</span>
            <span>•</span>
            <span>AI Automation • Digital Marketing • eCommerce • Software • Growth</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} NORYXA Agency Team Hub. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
