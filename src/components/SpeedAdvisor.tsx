import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSpeedAdvice, type SpeedAdvice } from "@/lib/speed-advice.functions";

type Props = {
  download: number | null;
  upload: number | null;
  ping: number | null;
};

const CONNECTION_TYPES = [
  "Wi-Fi (2.4 GHz)",
  "Wi-Fi (5 GHz)",
  "Wired / Ethernet",
  "Mobile data (4G/5G)",
  "Satellite",
  "Not sure",
];

export default function SpeedAdvisor({ download, upload, ping }: Props) {
  const runAdvice = useServerFn(getSpeedAdvice);
  const [open, setOpen] = useState(false);
  const [connectionType, setConnectionType] = useState("Wi-Fi (5 GHz)");
  const [device, setDevice] = useState("");
  const [planSpeed, setPlanSpeed] = useState("");
  const [issue, setIssue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advice, setAdvice] = useState<SpeedAdvice | null>(null);

  const ready = download !== null && upload !== null && ping !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      const result = await runAdvice({
        data: {
          download: download!,
          upload: upload!,
          ping: ping!,
          connectionType,
          device,
          planSpeed,
          issue,
        },
      });
      setAdvice(result);
    } catch {
      setError("We couldn't generate advice right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="mt-12 w-full max-w-3xl animate-fade-in text-left">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Explain my results</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Tell us about your setup and get a plain-language explanation plus fixes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
            aria-expanded={open}
          >
            {open ? "Hide" : "Get advice"}
          </button>
        </div>

        {open && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-neutral-700">Connection type</span>
                <select
                  value={connectionType}
                  onChange={(e) => setConnectionType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                >
                  {CONNECTION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-neutral-700">Device</span>
                <input
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  placeholder="Laptop, phone, smart TV…"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-neutral-700">Plan speed (optional)</span>
                <input
                  value={planSpeed}
                  onChange={(e) => setPlanSpeed(e.target.value)}
                  placeholder="e.g. 300 Mbps"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-neutral-700">What's the problem?</span>
                <input
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Video keeps buffering…"
                  className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--testnix-red)] px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-60"
              >
                {loading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                )}
                {loading ? "Analyzing…" : "Analyze my connection"}
              </button>
              <span className="text-xs text-neutral-400 tabular-nums">
                {download!.toFixed(1)} Mbps ↓ · {upload!.toFixed(1)} Mbps ↑ · {Math.round(ping!)} ms
              </span>
            </div>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {advice && (
          <div className="mt-6 border-t border-neutral-200 pt-5">
            <p className="text-base font-bold text-neutral-900">{advice.verdict}</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{advice.summary}</p>

            {advice.factors.length > 0 && (
              <>
                <h4 className="mt-5 text-sm font-semibold text-neutral-900">What's affecting your speed</h4>
                <ul className="mt-2 space-y-1.5">
                  {advice.factors.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm text-neutral-600">
                      <span className="text-neutral-400" aria-hidden>•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {advice.steps.length > 0 && (
              <>
                <h4 className="mt-5 text-sm font-semibold text-neutral-900">Try these steps</h4>
                <ol className="mt-2 space-y-1.5">
                  {advice.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-neutral-600">
                      <span className="font-semibold tabular-nums text-[var(--testnix-red)]">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
