export type TimedSchedule = { times: string[]; days: number[]; email: string; enabled: boolean };

export const TIMED_SCHEDULE_KEY = "testnix.timedSchedule";
export const LAST_FIRED_KEY = "testnix.timedSchedule.lastFired";

export const DEFAULT_SCHEDULE: TimedSchedule = { times: [], days: [0, 1, 2, 3, 4, 5, 6], email: "", enabled: true };

export function readSchedule(): TimedSchedule {
  try {
    const p = JSON.parse(window.localStorage.getItem(TIMED_SCHEDULE_KEY) || "null");
    if (!p || !Array.isArray(p.times)) return DEFAULT_SCHEDULE;
    return {
      times: p.times.filter((t: unknown) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t)).sort(),
      days: Array.isArray(p.days) ? p.days.filter((d: unknown) => typeof d === "number") : DEFAULT_SCHEDULE.days,
      email: typeof p.email === "string" ? p.email : "",
      enabled: p.enabled !== false,
    };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export function saveSchedule(s: TimedSchedule) {
  window.localStorage.setItem(TIMED_SCHEDULE_KEY, JSON.stringify(s));
}

/** Returns a slot key (e.g. "2026-10-12 09:00") when a scheduled time is due now, else null. */
export function dueSlot(s: TimedSchedule, now: Date): string | null {
  if (!s.enabled || !s.days.includes(now.getDay())) return null;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (!s.times.includes(hhmm)) return null;
  const date = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  return `${date} ${hhmm}`;
}

export function nextRun(s: TimedSchedule, from: Date): Date | null {
  if (!s.enabled || !s.times.length || !s.days.length) return null;
  for (let d = 0; d < 8; d++) {
    const day = new Date(from);
    day.setDate(from.getDate() + d);
    if (!s.days.includes(day.getDay())) continue;
    for (const t of s.times) {
      const [h, m] = t.split(":").map(Number);
      const c = new Date(day);
      c.setHours(h, m, 0, 0);
      if (c > from) return c;
    }
  }
  return null;
}
