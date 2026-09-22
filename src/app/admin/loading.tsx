export default function AdminLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center bg-[#07090D] p-8">
      <div className="flex items-center gap-3 text-sm text-[#A7AFBC]" role="status" aria-live="polite">
        <span className="size-3 animate-pulse rounded-full bg-[#24C5E3] shadow-[0_0_14px_rgba(36,197,227,.8)]" />
        Loading command center...
      </div>
    </div>
  );
}
