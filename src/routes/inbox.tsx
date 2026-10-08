import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const TITLE = "Report inbox — Testnix";
const DESCRIPTION = "See every Testnix speed test report as it arrives, with subject, summary and PDF download.";

export const Route = createFileRoute("/inbox")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InboxPage,
});

type Run = { id: string; download: number; upload: number; ping: number; at: number };
const KEY = "testnix.recentTests";
const SUBJECT = "Testnix speed test report";

function read(): Run[] {
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(p)
      ? p.filter((r) => r && typeof r.download === "number" && typeof r.upload === "number" && typeof r.ping === "number" && Number.isFinite(r.at))
      : [];
  } catch {
    return [];
  }
}

function summary(r: Run) {
  return `Download ${r.download.toFixed(1)} Mbps · Upload ${r.upload.toFixed(1)} Mbps · Ping ${Math.round(r.ping)} ms`;
}

async function downloadPdf(r: Run) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(20);
  doc.text(SUBJECT, 48, 72);
  doc.setFontSize(11);
  doc.text(new Date(r.at).toLocaleString(), 48, 96);
  doc.setFontSize(14);
  doc.text(`Download: ${r.download.toFixed(1)} Mbps`, 48, 140);
  doc.text(`Upload: ${r.upload.toFixed(1)} Mbps`, 48, 164);
  doc.text(`Ping: ${Math.round(r.ping)} ms`, 48, 188);
  doc.save(`testnix-report-${new Date(r.at).toISOString().slice(0, 10)}.pdf`);
}

function InboxPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const load = () => setRuns(read().sort((a, b) => b.at - a.at));
    load();
    const t = window.setInterval(load, 5000);
    window.addEventListener("storage", load);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("storage", load);
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Report inbox</h1>
        <Link to="/" className="text-sm font-semibold text-[var(--testnix-red)] hover:underline">← Back to test</Link>
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        Each finished test (including scheduled runs) lands here with the same subject and summary as the emailed PDF. Updates live while open.
      </p>

      {runs === null ? (
        <div className="mt-8 h-20 animate-pulse rounded-lg bg-neutral-100" />
      ) : runs.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          No reports yet — run a test or turn on auto-run.
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {runs.map((r) => (
            <li key={r.id ?? r.at}>
              <button
                type="button"
                onClick={() => setOpen(open === r.id ? null : r.id)}
                className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-neutral-900">{SUBJECT}</span>
                  <span className="block truncate text-xs text-neutral-500">{summary(r)}</span>
                </span>
                <span className="shrink-0 text-xs text-neutral-400">{new Date(r.at).toLocaleString()}</span>
              </button>
              {open === r.id && (
                <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-4 text-sm text-neutral-700">
                  <p>{summary(r)}</p>
                  <button
                    type="button"
                    onClick={() => downloadPdf(r)}
                    className="mt-3 rounded-lg bg-[var(--testnix-red)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
                  >
                    Download PDF
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
