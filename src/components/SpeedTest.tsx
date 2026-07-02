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

function buildShareUrl(mbps: number) {
  const url = new URL(window.location.href);
  url.searchParams.set("speed", mbps.toFixed(2));
  url.searchParams.set("shared", "1");
  return url.toString();
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
  const startedRef = useRef(false);


  const measurePing = useCallback(async (setter: (n: number) => void) => {
    const samples: number[] = [];
    const PROBES_PER_UPDATE = 3;
    const PING_DURATION_MS = 2_500;
    const startTime = performance.now();
    let probeIdx = 0;

    while (performance.now() - startTime < PING_DURATION_MS) {
      const batch: number[] = [];
      for (let j = 0; j < PROBES_PER_UPDATE; j++) {
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
      if (batch.length) {
        const avg = Math.round(batch.reduce((a, b) => a + b, 0) / batch.length);
        setLivePing(avg);
      }
    }

    if (samples.length) {
      const sorted = [...samples].sort((a, b) => a - b);
      const median = Math.round(sorted[Math.floor(sorted.length / 2)]);
      setter(median);
      setLivePing(median);
    }
  }, []);

  const runDownload = useCallback(async () => {
    const controller = new AbortController();
    let totalBytes = 0;
    const startTime = performance.now();
    let stopped = false;
    const samples: number[] = [];
    let lastBytes = 0;
    let lastTime = startTime;

    const tick = () => {
      if (stopped) return;
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

    const elapsed = (performance.now() - startTime) / 1000;
    const finalMbps = (totalBytes * 8) / 1_000_000 / Math.max(elapsed, 0.001);
    setDisplayed(finalMbps);
    setFinal(finalMbps);
    setDownloadedMB(totalBytes / (1024 * 1024));
    return finalMbps;
  }, []);

  const runUpload = useCallback(async () => {
    const payload = new Uint8Array(2 * 1024 * 1024);
    crypto.getRandomValues(payload);
    const DURATION = 5_000;
    const start = performance.now();
    let totalBytes = 0;
    let stopped = false;

    setDisplayed(0);
    const samples: number[] = [];
    let lastBytes = 0;
    let lastTime = start;

    const tick = () => {
      if (stopped) return;
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
          });
          totalBytes += payload.byteLength;
        } catch {
          break;
        }
      }
    };

    const workers = [worker(), worker()];
    await new Promise((r) => setTimeout(r, DURATION));
    stopped = true;
    clearInterval(interval);
    await Promise.allSettled(workers);

    const elapsed = (performance.now() - start) / 1000;
    const mbps = (totalBytes * 8) / 1_000_000 / Math.max(elapsed, 0.001);
    setDisplayed(mbps);
    setUpload(mbps);
    setUploadedMB(totalBytes / (1024 * 1024));
  }, []);

  const runTest = useCallback(async () => {
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
    await measurePing(setPingUnloaded);

    setPhase("download");
    await runDownload();

    setPhase("upload");
    await measurePing(setPingLoaded);
    await runUpload();

    setPhase("done");
    setShowMore(true);
  }, [measurePing, runDownload, runUpload]);

  const runExtras = useCallback(async () => {
    setShowMore(true);
  }, []);

  useEffect(() => {
    if (phase === "done" && final !== null && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("speed", final.toFixed(2));
      url.searchParams.set("shared", "1");
      window.history.replaceState({}, "", url);
    }
  }, [phase, final]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const sharedSpeed = typeof search.speed === "string" ? parseFloat(search.speed) : null;
    if (sharedSpeed && !Number.isNaN(sharedSpeed)) {
      setFinal(sharedSpeed);
      setPhase("done");
      setDisplayed(sharedSpeed);
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
    if (final === null) return;
    const url = buildShareUrl(final);
    const text = `Testnix.net - My internet speed is ${formatSpeed(final)} Mbps. Check your speed at ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [final]);

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


      {/* Show more info button (fast.com style) */}
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
    </section>
  );
}
