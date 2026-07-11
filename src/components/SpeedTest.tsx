import { useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "ping" | "download" | "upload" | "done";

const TEST_DURATION_MS = 12_000;
const PARALLEL_STREAMS = 4;
const CHUNK_BYTES = 10 * 1024 * 1024;

function formatSpeed(mbps: number) {
  if (mbps >= 100) return mbps.toFixed(0);
  if (mbps >= 10) return mbps.toFixed(1);
  return mbps.toFixed(2);
}

function buildShareUrl(values: { download: number; upload: number; ping: number }) {
  const url = new URL("/results", window.location.href);
  url.searchParams.set("speed", values.download.toFixed(2));
  url.searchParams.set("upload", values.upload.toFixed(2));
  url.searchParams.set("ping", Math.round(values.ping).toString());
  url.searchParams.set("shared", "1");
  return url.toString();
}

type RecentTest = {
  id: string;
  download: number;
  upload: number;
  ping: number;
  at: number;
};

const RECENT_KEY = "testnix.recentTests";
const MAX_RECENT = 5;

function loadRecent(): RecentTest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) =>
        r &&
        typeof r.download === "number" &&
        typeof r.upload === "number" &&
        typeof r.ping === "number",
    );
  } catch {
    return [];
  }
}

function formatWhen(ts: number) {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatTimestamp(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeCsv(value: string | number) {
  const str = String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function buildRecentCsv(rows: RecentTest[]) {
  const header = ["Timestamp", "Download (Mbps)", "Upload (Mbps)", "Ping (ms)"];
  const lines = rows.map((r) => [
    new Date(r.at).toISOString(),
    r.download.toFixed(2),
    r.upload.toFixed(2),
    Math.round(r.ping),
  ]);
  return [header, ...lines].map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SpeedTest() {
  const search = useSearch({ from: "/" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayed, setDisplayed] = useState(0);
  const [final, setFinal] = useState<number | null>(null);
  const [pingUnloaded, setPingUnloaded] = useState<number | null>(null);
  const [pingLoaded, setPingLoaded] = useState<number | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [uploadedMB, setUploadedMB] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [extrasRunning, setExtrasRunning] = useState(false);
  const [livePing, setLivePing] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recent, setRecent] = useState<RecentTest[]>([]);
  const savedRunIdRef = useRef<number | null>(null);
  const fromSharedRef = useRef(false);
  const startedRef = useRef(false);
  const runIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  const abortActive = useCallback(() => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    runIdRef.current += 1;
  }, []);

  const measurePing = useCallback(async (setter: (n: number) => void, runId: number) => {
    const samples: number[] = [];
    const PROBES_PER_UPDATE = 3;
    const PING_DURATION_MS = 2_500;
    const startTime = performance.now();
    let probeIdx = 0;

    while (performance.now() - startTime < PING_DURATION_MS) {
      if (runId !== runIdRef.current) break;
      const batch: number[] = [];
      for (let j = 0; j < PROBES_PER_UPDATE; j++) {
        if (runId !== runIdRef.current) break;
        const t = performance.now();
        try {
          await fetch(`/api/ping?t=${Date.now()}-${probeIdx++}`, { cache: "no-store" });
          const dt = performance.now() - t;
          batch.push(dt);
          samples.push(dt);
        } catch {
          // ignore failed probes
        }
      }
      if (batch.length && runId === runIdRef.current) {
        const avg = Math.round(batch.reduce((a, b) => a + b, 0) / batch.length);
        setLivePing(avg);
      }
    }

    if (samples.length && runId === runIdRef.current) {
      const sorted = [...samples].sort((a, b) => a - b);
      const median = Math.round(sorted[Math.floor(sorted.length / 2)]);
      setter(median);
      setLivePing(median);
    }
  }, []);

  const runDownload = useCallback(async (runId: number) => {
    const controller = new AbortController();
    activeControllerRef.current = controller;
    let totalBytes = 0;
    const startTime = performance.now();
    let stopped = false;
    const samples: number[] = [];
    let lastBytes = 0;
    let lastTime = startTime;

    const tick = () => {
      if (stopped || runId !== runIdRef.current) return;
      const now = performance.now();
      const deltaBytes = totalBytes - lastBytes;
      const deltaTime = (now - lastTime) / 1000;
      if (deltaTime > 0) {
        const instantMbps = (deltaBytes * 8) / 1_000_000 / deltaTime;
        samples.push(instantMbps);
        if (samples.length > 5) samples.shift();
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        setDisplayed(avg);
      }
      setDownloadedMB(totalBytes / (1024 * 1024));
      lastBytes = totalBytes;
      lastTime = now;
    };
    const interval = setInterval(tick, 200);


    const stream = async () => {
      while (!stopped) {
        try {
          const res = await fetch(`/api/download-test?bytes=${CHUNK_BYTES}&r=${Math.random()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!res.body) {
            const buf = await res.arrayBuffer();
            totalBytes += buf.byteLength;
            continue;
          }
          const reader = res.body.getReader();
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) totalBytes += value.byteLength;
          }
        } catch {
          break;
        }
      }
    };

    const workers = Array.from({ length: PARALLEL_STREAMS }, () => stream());
    await new Promise((r) => setTimeout(r, TEST_DURATION_MS));
    stopped = true;
    controller.abort();
    clearInterval(interval);
    await Promise.allSettled(workers);

    if (runId !== runIdRef.current) return;
    const elapsed = (performance.now() - startTime) / 1000;
    const finalMbps = (totalBytes * 8) / 1_000_000 / Math.max(elapsed, 0.001);
    setDisplayed(finalMbps);
    setFinal(finalMbps);
    setDownloadedMB(totalBytes / (1024 * 1024));
    return finalMbps;
  }, []);

  const runUpload = useCallback(async (runId: number) => {
    const UPLOAD_CHUNK_BYTES = 1 * 1024 * 1024;
    const UPLOAD_STREAMS = 6;
    const UPLOAD_DURATION_MS = 10_000;
    const WARMUP_MS = 1_500;

    const payload = new Uint8Array(UPLOAD_CHUNK_BYTES);
    for (let off = 0; off < payload.byteLength; off += 65536) {
      crypto.getRandomValues(payload.subarray(off, Math.min(off + 65536, payload.byteLength)));
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    const start = performance.now();
    let totalBytes = 0;
    let measuredBytes = 0;
    let measureStart = start;
    let warmupDone = false;
    let stopped = false;

    setDisplayed(0);
    const samples: number[] = [];
    let lastBytes = 0;
    let lastTime = start;

    const tick = () => {
      if (stopped || runId !== runIdRef.current) return;
      const now = performance.now();
      if (!warmupDone && now - start >= WARMUP_MS) {
        warmupDone = true;
        measureStart = now;
        measuredBytes = 0;
        lastBytes = totalBytes;
        lastTime = now;
      }
      const deltaBytes = totalBytes - lastBytes;
      const deltaTime = (now - lastTime) / 1000;
      if (warmupDone && deltaTime > 0) {
        const instantMbps = (deltaBytes * 8) / 1_000_000 / deltaTime;
        samples.push(instantMbps);
        if (samples.length > 5) samples.shift();
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        setDisplayed(avg);
      }
      setUploadedMB(totalBytes / (1024 * 1024));
      lastBytes = totalBytes;
      lastTime = now;
    };
    const interval = setInterval(tick, 200);

    const worker = async () => {
      while (!stopped) {
        try {
          await fetch(`/api/ping?u=${Math.random()}`, {
            method: "POST",
            body: payload,
            cache: "no-store",
            signal: controller.signal,
          });
          totalBytes += payload.byteLength;
          if (warmupDone) measuredBytes += payload.byteLength;
        } catch {
          break;
        }
      }
    };

    const workers = Array.from({ length: UPLOAD_STREAMS }, () => worker());
    await new Promise((r) => setTimeout(r, UPLOAD_DURATION_MS));
    stopped = true;
    controller.abort();
    clearInterval(interval);
    await Promise.allSettled(workers);

    if (runId !== runIdRef.current) return;
    const elapsedSec = (performance.now() - measureStart) / 1000;
    const mbps = (measuredBytes * 8) / 1_000_000 / Math.max(elapsedSec, 0.001);
    setDisplayed(mbps);
    setUpload(mbps);
    setUploadedMB(totalBytes / (1024 * 1024));
  }, []);




  const runTest = useCallback(async () => {
    abortActive();
    const runId = runIdRef.current;
    setFinal(null);
    setPingUnloaded(null);
    setPingLoaded(null);
    setUpload(null);
    setDisplayed(0);
    setDownloadedMB(0);
    setUploadedMB(0);
    setShowMore(false);
    setLivePing(null);

    setPhase("ping");
    await measurePing(setPingUnloaded, runId);
    if (runId !== runIdRef.current) return;

    setPhase("download");
    await runDownload(runId);
    if (runId !== runIdRef.current) return;

    setPhase("upload");
    await measurePing(setPingLoaded, runId);
    await runUpload(runId);
    if (runId !== runIdRef.current) return;

    setPhase("done");
    setShowMore(true);
  }, [abortActive, measurePing, runDownload, runUpload]);

  const runExtras = useCallback(async () => {
    setShowMore(true);
  }, []);


  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    setRecent(loadRecent());

    const sharedSpeed = typeof search.speed === "string" ? parseFloat(search.speed) : null;
    const sharedUpload = typeof search.upload === "string" ? parseFloat(search.upload) : null;
    const sharedPing = typeof search.ping === "string" ? parseFloat(search.ping) : null;
    if (sharedSpeed && !Number.isNaN(sharedSpeed)) {
      fromSharedRef.current = true;
      setFinal(sharedSpeed);
      if (sharedUpload && !Number.isNaN(sharedUpload)) setUpload(sharedUpload);
      if (sharedPing && !Number.isNaN(sharedPing)) setPingLoaded(sharedPing);
      setPhase("done");
      setDisplayed(sharedSpeed);
      setShowMore(true);
      return;
    }

    void runTest();
  }, [runTest, search]);

  // Track elapsed seconds during active test phases
  useEffect(() => {
    if (phase === "idle" || phase === "done") {
      setElapsed(0);
      return;
    }
    const start = performance.now();
    const interval = setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 200);
    return () => clearInterval(interval);
  }, [phase]);

  // Save a completed run into recent tests (skip shared-URL loads and duplicate saves per run)
  useEffect(() => {
    if (phase !== "done") return;
    if (fromSharedRef.current) return;
    if (final === null || upload === null || pingLoaded === null) return;
    if (savedRunIdRef.current === runIdRef.current) return;
    savedRunIdRef.current = runIdRef.current;

    const entry: RecentTest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      download: final,
      upload,
      ping: pingLoaded,
      at: Date.now(),
    };
    setRecent((prev) => {
      const next = [entry, ...prev].slice(0, MAX_RECENT);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  }, [phase, final, upload, pingLoaded]);



  // Smoothly animate the displayed number
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      setAnimated((prev) => {
        const diff = displayed - prev;
        if (Math.abs(diff) < 0.05) return displayed;
        return prev + diff * 0.18;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [displayed]);


  const isDownloading = phase === "ping" || phase === "download";
  const heading =
    phase === "ping" || phase === "download"
      ? "Your Internet speed is"
      : phase === "upload"
        ? "Your Internet speed is"
        : "Your Internet speed is";

  const shownNumber = phase === "done" ? (final ?? 0) : animated;

  const handleShare = useCallback(async () => {
    if (final === null || upload === null || pingLoaded === null) return;
    const url = buildShareUrl({ download: final, upload, ping: pingLoaded });
    const text = `Testnix.net - Download: ${formatSpeed(final)} Mbps, Upload: ${formatSpeed(upload)} Mbps, Ping: ${pingLoaded}ms. Check your speed at ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [final, upload, pingLoaded]);

  const handleExportRecent = useCallback(() => {
    if (recent.length === 0) return;
    const csv = buildRecentCsv(recent);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`testnix-recent-tests-${date}.csv`, csv);
  }, [recent]);

  const showReload = phase === "done" && !extrasRunning;

  return (
    <section className="flex w-full max-w-5xl flex-col items-center px-4 text-center sm:px-6">
      <h2 className="fast-heading mb-1 text-neutral-900 sm:mb-2">
        {heading}
      </h2>

      <div className="flex items-start justify-center gap-2 sm:gap-4 md:gap-6">
        <span
          className="speed-number tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {formatSpeed(shownNumber)}
        </span>
        <div className="flex flex-col items-start pt-[8%] sm:pt-[6%]">
          <span className="mbps-label">Mbps</span>
          {isDownloading && (
            <span className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--testnix-red)]">
              <span className="flex gap-[4px]">
                <span className="h-4 w-[4px] bg-neutral-500" />
                <span className="h-4 w-[4px] bg-neutral-500" />
              </span>
            </span>
          )}
          {showReload && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void runTest()}
                aria-label="Restart speed test"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-green-500 bg-white text-neutral-900 shadow-sm transition hover:scale-105 hover:bg-neutral-50 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void handleShare()}
                aria-label="Share speed test result"
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-neutral-900 bg-neutral-900 text-white shadow-sm transition hover:scale-105 hover:bg-neutral-800 active:scale-95"
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                )}
              </button>
            </div>
          )}
          {phase === "upload" && (
            <span className="mt-4 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--testnix-red)]">
              <span className="flex gap-[4px]">
                <span className="h-4 w-[4px] bg-neutral-500" />
                <span className="h-4 w-[4px] bg-neutral-500" />
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Live stats row during active test, and locked final stats after done */}
      {phase !== "idle" && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-neutral-600 sm:text-base animate-fade-in">
          {phase !== "done" && (
            <span className="flex items-baseline gap-1.5">
              <span className="text-neutral-400">Time</span>
              <span className="font-bold tabular-nums text-neutral-900">
                {elapsed.toFixed(1)}
              </span>
              <span className="text-xs text-neutral-400">s</span>
            </span>
          )}
          <span className="flex items-baseline gap-1.5">
            <span className="text-neutral-400">Ping</span>
            <span className={`font-bold tabular-nums ${phase === "ping" ? "text-[var(--testnix-red)]" : "text-neutral-900"}`}>
              {phase === "done" ? (pingLoaded ?? livePing ?? "—") : (livePing ?? "—")}
            </span>
            <span className="text-xs text-neutral-400">ms</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-neutral-400">Download</span>
            <span className={`font-bold tabular-nums ${phase === "download" ? "text-[var(--testnix-red)]" : "text-neutral-900"}`}>
              {phase === "download" ? formatSpeed(animated) : final !== null ? formatSpeed(final) : "—"}
            </span>
            <span className="text-xs text-neutral-400">Mbps</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-neutral-400">Upload</span>
            <span className={`font-bold tabular-nums ${phase === "upload" ? "text-[var(--testnix-red)]" : "text-neutral-900"}`}>
              {phase === "upload" ? formatSpeed(animated) : upload !== null ? formatSpeed(upload) : "—"}
            </span>
            <span className="text-xs text-neutral-400">Mbps</span>
          </span>
        </div>
      )}

      {/* Restart button visible while the test is running */}
      {phase !== "idle" && phase !== "done" && (
        <div className="mt-6 animate-fade-in">
          <button
            type="button"
            onClick={() => void runTest()}
            className="rounded-lg border-2 border-neutral-900 bg-white px-6 py-2.5 text-sm font-semibold text-neutral-900 transition hover:bg-neutral-50 active:scale-95"
          >
            Run test again
          </button>
        </div>
      )}

      {/* Prominent run-again button after the test completes */}
      {phase === "done" && (
        <div className="mt-10 animate-fade-in">
          <button
            type="button"
            onClick={() => void runTest()}
            className="rounded-lg bg-[var(--testnix-red)] px-10 py-4 text-lg font-semibold text-white shadow-md transition hover:brightness-110 active:scale-95"
          >
            Run test again
          </button>
        </div>
      )}
      {phase === "done" && final !== null && upload !== null && pingLoaded !== null && (
        <div className="mt-4 animate-fade-in">
          <button
            type="button"
            onClick={() => void handleShare()}
            className="rounded-lg border-2 border-neutral-900 bg-white px-8 py-3 text-base font-semibold text-neutral-900 transition hover:bg-neutral-50 active:scale-95"
          >
            {copied ? "Copied!" : "Copy results link"}
          </button>
        </div>
      )}
      {phase === "done" && !showMore && (
        <div className="mt-10">
          <button
            type="button"
            onClick={() => void runExtras()}
            className="rounded-md border border-neutral-300 bg-white px-8 py-3 text-base text-neutral-600 transition hover:border-neutral-900 hover:text-neutral-900"
          >
            Show more info
          </button>
        </div>
      )}

      {/* Latency + Upload panels (revealed after Show more info) */}
      {showMore && (
        <>
          <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-10 pt-8 md:grid-cols-2 md:gap-16 animate-fade-in">
            <div className="text-left">
              <h3 className="text-lg font-bold text-neutral-900">Latency</h3>
              <div className="mt-3 grid grid-cols-2 gap-6 border-b border-neutral-200 pb-3">
                <p className="text-sm text-neutral-500">Unloaded</p>
                <p className="text-sm text-neutral-500">Loaded</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-6">
                <p className="text-3xl font-bold tabular-nums text-neutral-900">
                  {pingUnloaded ?? "—"}
                  <span className="ml-1 align-baseline text-sm font-normal text-neutral-500">ms</span>
                </p>
                <p className="text-3xl font-bold tabular-nums text-neutral-900">
                  {pingLoaded ?? "—"}
                  <span className="ml-1 align-baseline text-sm font-normal text-neutral-500">ms</span>
                </p>
              </div>
            </div>

            <div className="text-left">
              <h3 className={`text-lg font-bold ${upload !== null || phase === "upload" ? "text-neutral-900" : "text-neutral-300"}`}>
                Upload
              </h3>
              <div className="mt-3 border-b border-neutral-200 pb-3">
                <p className={`text-sm ${upload !== null || phase === "upload" ? "text-neutral-500" : "text-neutral-300"}`}>Speed</p>
              </div>
              <div className="mt-3">
                <p className={`text-3xl font-bold tabular-nums ${upload !== null ? "text-neutral-900" : "text-neutral-300"}`}>
                  {upload !== null ? formatSpeed(upload) : "—"}
                  <span className="ml-1 align-baseline text-sm font-normal">Mbps</span>
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex w-full max-w-3xl items-center justify-between rounded-md border border-neutral-200 px-4 py-3 text-sm text-neutral-500 animate-fade-in">
            <button
              type="button"
              onClick={() => phase === "done" && void runTest()}
              className="inline-flex items-center gap-2 transition hover:text-neutral-900"
              disabled={phase !== "done"}
            >
              <span aria-hidden>⚙</span> Settings
            </button>
            <span className="tabular-nums">
              {downloadedMB > 0 ? `${downloadedMB.toFixed(0)}MB ↓` : ""}
            </span>
            <span className="tabular-nums">
              {uploadedMB > 0 ? `${uploadedMB.toFixed(0)}MB ↑` : ""}
            </span>
          </div>
        </>
      )}

      {recent.length > 0 && (
        <div className="mt-12 w-full max-w-3xl animate-fade-in">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-left text-lg font-bold text-neutral-900">
              Recent tests
            </h3>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.removeItem(RECENT_KEY);
                } catch {
                  // ignore
                }
                setRecent([]);
              }}
              className="text-xs text-neutral-500 hover:text-neutral-900"
            >
              Clear
            </button>
          </div>
          <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {recent.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-baseline gap-2 px-4 py-3 text-left text-sm"
              >
                <div className="flex flex-col">
                  <span className="text-xs text-neutral-500">
                    {formatWhen(r.at)}
                  </span>
                  <time
                    className="text-[10px] text-neutral-400"
                    dateTime={new Date(r.at).toISOString()}
                    title={new Date(r.at).toLocaleString()}
                  >
                    {formatTimestamp(r.at)}
                  </time>
                </div>
                <span className="tabular-nums text-neutral-900">
                  <span className="font-semibold">{formatSpeed(r.download)}</span>
                  <span className="ml-1 text-xs text-neutral-400">↓ Mbps</span>
                </span>
                <span className="tabular-nums text-neutral-900">
                  <span className="font-semibold">{formatSpeed(r.upload)}</span>
                  <span className="ml-1 text-xs text-neutral-400">↑ Mbps</span>
                </span>
                <span className="tabular-nums text-neutral-900">
                  <span className="font-semibold">{Math.round(r.ping)}</span>
                  <span className="ml-1 text-xs text-neutral-400">ms</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
