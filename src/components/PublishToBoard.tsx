import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { publishResult } from "@/lib/public-board.functions";

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

export default function PublishToBoard({ download, upload, ping }: Props) {
  const publish = useServerFn(publishResult);
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [city, setCity] = useState("");
  const [connectionType, setConnectionType] = useState("Wi-Fi (5 GHz)");
  const [device, setDevice] = useState("");
  const [planSpeed, setPlanSpeed] = useState("");
  const [issue, setIssue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const ready = download !== null && upload !== null && ping !== null;
  if (!ready) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await publish({
        data: {
          download: download!,
          upload: upload!,
          ping: ping!,
          nickname,
          city,
          connectionType,
          device,
          planSpeed,
          issue,
        },
      });
      setDone(true);
    } catch {
      setError("We couldn't publish your result right now. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 w-full max-w-3xl animate-fade-in text-left">
      <div className="rounded-lg border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Share on the public board</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Publish this result so anyone can see it, with an AI explanation attached.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link
              to="/board"
              className="rounded-md px-3 py-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
            >
              View board
            </Link>
            {!done && (
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
                aria-expanded={open}
              >
                {open ? "Cancel" : "Publish result"}
              </button>
            )}
          </div>
        </div>

        {done ? (
          <p className="mt-4 rounded-md bg-neutral-50 px-3 py-3 text-sm text-neutral-700">
            Published. <Link to="/board" className="font-semibold underline">See it on the public board</Link>.
          </p>
        ) : (
          open && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-neutral-700">Display name</span>
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={40}
                    placeholder="Anonymous"
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-neutral-700">City (optional)</span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    maxLength={60}
                    placeholder="Dhaka"
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                </label>
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
                    maxLength={60}
                    placeholder="Laptop, phone, smart TV…"
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-neutral-700">Plan speed (optional)</span>
                  <input
                    value={planSpeed}
                    onChange={(e) => setPlanSpeed(e.target.value)}
                    maxLength={40}
                    placeholder="e.g. 300 Mbps"
                    className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-neutral-700">What's the problem?</span>
                  <input
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                    maxLength={200}
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
                  {loading ? "Publishing…" : "Publish to board"}
                </button>
                <span className="text-xs text-neutral-400 tabular-nums">
                  {download!.toFixed(1)} Mbps ↓ · {upload!.toFixed(1)} Mbps ↑ · {Math.round(ping!)} ms
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Anything you enter here becomes publicly visible. Don't include personal details.
              </p>
            </form>
          )
        )}

        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
