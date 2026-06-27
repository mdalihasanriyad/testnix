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

export function SpeedTest() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayed, setDisplayed] = useState(0);
  const [final, setFinal] = useState<number | null>(null);
  const [pingUnloaded, setPingUnloaded] = useState<number | null>(null);
  const [pingLoaded, setPingLoaded] = useState<number | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [downloadedMB, setDownloadedMB] = useState(0);
  const [uploadedMB, setUploadedMB] = useState(0);
  const startedRef = useRef(false);

  const measurePing = useCallback(async (setter: (n: number) => void) => {
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const t = performance.now();
      try {
        await fetch(`/api/ping?t=${Date.now()}-${i}`, { cache: "no-store" });
        samples.push(performance.now() - t);
      } catch {
        // ignore
      }
    }
    if (samples.length) {
      samples.sort((a, b) => a - b);
      setter(Math.round(samples[Math.floor(samples.length / 2)]));
    }
  }, []);

  const runDownload = useCallback(async () => {
    const controller = new AbortController();
    let totalBytes = 0;
    const startTime = performance.now();
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const elapsed = (performance.now() - startTime) / 1000;
      if (elapsed > 0) {
        const mbps = (totalBytes * 8) / 1_000_000 / elapsed;
        setDisplayed(mbps);
        setDownloadedMB(totalBytes / (1024 * 1024));
      }
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

    const worker = async () => {
      while (!stopped) {
        try {
          await fetch(`/api/ping?u=${Math.random()}`, {
            method: "POST",
            body: payload,
            cache: "no-store",
          });
          totalBytes += payload.byteLength;
          setUploadedMB(totalBytes / (1024 * 1024));
        } catch {
          break;
        }
      }
    };

    const workers = [worker(), worker()];
    await new Promise((r) => setTimeout(r, DURATION));
    stopped = true;
    await Promise.allSettled(workers);

    const elapsed = (performance.now() - start) / 1000;
    const mbps = (totalBytes * 8) / 1_000_000 / Math.max(elapsed, 0.001);
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

    setPhase("ping");
    await measurePing(setPingUnloaded);

    setPhase("download");
    await runDownload();

    setPhase("upload");
    // measure loaded latency in parallel-ish before upload finishes; simple sequential is fine
    await measurePing(setPingLoaded);
    await runUpload();

    setPhase("done");
  }, [measurePing, runDownload, runUpload]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void runTest();
  }, [runTest]);

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

  const isRunning = phase !== "done" && phase !== "idle";
  const heading =
    phase === "done"
      ? "Your Internet speed is"
      : phase === "ping"
        ? "Checking latency…"
        : phase === "upload"
          ? "Measuring upload…"
          : "Your Internet speed is";

  const shownNumber = phase === "done" ? (final ?? 0) : animated;

  return (
    <section className="flex w-full max-w-5xl flex-col items-center px-6 text-center">
      <h2 className="mb-6 text-2xl font-bold text-neutral-900 md:text-4xl">
        {heading}
      </h2>

      <div className="flex items-start justify-center gap-4 md:gap-6">
        <span
          className="speed-number tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {formatSpeed(shownNumber)}
        </span>
        <div className="flex flex-col items-start pt-4 md:pt-8">
          <span className="text-3xl font-bold text-neutral-900 md:text-6xl">
            Mbps
          </span>
          {isRunning && (
            <span className="mt-4 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--testnix-red)]">
              <span className="flex gap-[3px]">
                <span className="h-3 w-[3px] bg-neutral-700" />
                <span className="h-3 w-[3px] bg-neutral-700" />
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-10 border-t border-neutral-200 pt-8 md:grid-cols-2 md:gap-16">
        <div className="text-left">
          <h3 className="text-lg font-bold text-neutral-900">Latency</h3>
          <div className="mt-3 grid grid-cols-2 gap-6 border-b border-neutral-200 pb-3">
            <div>
              <p className="text-sm text-neutral-500">Unloaded</p>
            </div>
            <div>
              <p className="text-sm text-neutral-500">Loaded</p>
            </div>
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

      <div className="mt-6 flex w-full max-w-3xl items-center justify-between rounded-md border border-neutral-200 px-4 py-3 text-sm text-neutral-500">
        <button
          type="button"
          onClick={() => phase === "done" && void runTest()}
          className="inline-flex items-center gap-2 transition hover:text-neutral-900"
          disabled={isRunning}
        >
          <span aria-hidden>⚙</span> {phase === "done" ? "Test again" : "Settings"}
        </button>
        <span className="tabular-nums">
          {downloadedMB > 0 ? `${downloadedMB.toFixed(0)}MB ↓` : ""}
        </span>
        <span className="tabular-nums">
          {uploadedMB > 0 ? `${uploadedMB.toFixed(0)}MB ↑` : ""}
        </span>
      </div>
    </section>
  );
}
