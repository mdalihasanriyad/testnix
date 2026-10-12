import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DEFAULT_SCHEDULE, nextRun, readSchedule, saveSchedule, type TimedSchedule } from "@/lib/schedule-times";

const TITLE = "Scheduled tests — Testnix";
const DESCRIPTION = "Pick the times Testnix runs a speed test automatically and where the report should go.";

export const Route = createFileRoute("/schedule")({
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
  component: SchedulePage,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SchedulePage() {
  const [s, setS] = useState<TimedSchedule>(DEFAULT_SCHEDULE);
  const [newTime, setNewTime] = useState("09:00");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setS(readSchedule());
    setLoaded(true);
  }, []);

  const update = (next: TimedSchedule) => {
    setS(next);
    saveSchedule(next);
  };

  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(newTime) || s.times.includes(newTime)) return;
    update({ ...s, times: [...s.times, newTime].sort() });
  };

  const next = loaded ? nextRun(s, new Date()) : null;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-white px-4 py-8 text-neutral-900 sm:px-6">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">← Back to test</Link>
      <h1 className="mt-4 text-2xl font-semibold">Scheduled tests</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Tests run at these times while the Testnix test page is open in this browser. Each result shows up in the Report inbox.
      </p>

      <section className="mt-6 rounded-lg border border-neutral-200 p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          Scheduled tests on
          <input type="checkbox" checked={s.enabled} onChange={(e) => update({ ...s, enabled: e.target.checked })} className="h-5 w-5" />
        </label>
      </section>

      <section className="mt-4 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium">Times</h2>
        <div className="mt-3 flex gap-2">
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm" aria-label="New time" />
          <button onClick={addTime} className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white">Add</button>
        </div>
        {s.times.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No times yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {s.times.map((t) => (
              <li key={t} className="flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-1 text-sm">
                {t}
                <button aria-label={`Remove ${t}`} onClick={() => update({ ...s, times: s.times.filter((x) => x !== t) })} className="text-neutral-500 hover:text-neutral-900">×</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium">Days</h2>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => {
            const on = s.days.includes(i);
            return (
              <button key={d} aria-pressed={on} onClick={() => update({ ...s, days: on ? s.days.filter((x) => x !== i) : [...s.days, i] })}
                className={`rounded py-2 text-xs font-medium ${on ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-600"}`}>
                {d}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-neutral-200 p-4">
        <h2 className="text-sm font-medium">Email report to</h2>
        <input type="email" value={s.email} placeholder="you@example.com" onChange={(e) => update({ ...s, email: e.target.value.trim() })}
          className="mt-3 w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
        <p className="mt-2 text-xs text-neutral-500">Emails start once your sending domain is connected. Until then, reports appear in the Report inbox.</p>
      </section>

      <p className="mt-6 text-sm text-neutral-700">
        {next ? `Next test: ${next.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : "No upcoming test."}
      </p>
    </main>
  );
}
