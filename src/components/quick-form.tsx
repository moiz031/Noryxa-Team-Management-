"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export interface QuickFormField {
  name: string;
  label: string;
  type?: string;
  multiline?: boolean;
}

export function QuickForm({
  endpoint,
  fields,
  submitLabel = "Save",
}: {
  endpoint: string;
  fields: QuickFormField[];
  submitLabel?: string;
}) {
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.ok) {
        setIsSuccess(true);
        setMessage("Action completed successfully.");
        event.currentTarget.reset();
      } else {
        setIsSuccess(false);
        setMessage(data.error ?? "Operation failed. Please try again.");
      }
    } catch {
      setIsSuccess(false);
      setMessage("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="mt-6 space-y-4 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-6 backdrop-blur-sm"
      onSubmit={handleSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.name} className={field.multiline ? "sm:col-span-2" : ""}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                required
                name={field.name}
                rows={3}
                className="mt-2 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
              />
            ) : (
              <input
                required
                name={field.name}
                type={field.type ?? "text"}
                className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium ${
              isSuccess
                ? "bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/20"
                : "bg-[#FF4D67]/10 text-[#FF4D67] border border-[#FF4D67]/20"
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <AlertCircle className="size-3.5" />
            )}
            <span>{message}</span>
          </div>
        )}
      </div>
    </form>
  );
}
