import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "idle" | "ping" | "download" | "upload" | "done";

const TEST_DURATION_MS = 12_000;
const PARALLEL_STREAMS = 4;
const CHUNK_BYTES = 10 * 1024 * 1024; // 10MB per request

function formatSpeed(mbps: number) {
  if (mbps >= 100) return mbps.toFixed(0);
  if (mbps >= 10) return mbps.toFixed(1);
  return mbps.toFixed(2);
}

export function SpeedTest() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [displayed, setDisplayed] = useState(0);
  const [final, setFinal] = useState<number | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);
  const startedRef = useRef(false);

  const measurePing = useCallback(async () => {
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
      setPing(Math.round(samples[Math.floor(samples.length / 2)]));
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
          // network/abort errors ignored; loop ends when stopped
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
    return finalMbps;
  }, []);

  const runUpload = useCallback(async () => {
    const payload = new Uint8Array(2 * 1024 * 1024); // 2MB
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
  }, []);

  const runTest = useCallback(async () => {
    setFinal(null);
    setPing(null);
    setUpload(null);
    setDisplayed(0);

    setPhase("ping");
    await measurePing();

    setPhase("download");
    await runDownload();

    setPhase("upload");
    await runUpload();

    setPhase("done");
  }, [measurePing, runDownload, runUpload]);

  // Auto-start on mount
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

  const status =
    phase === "ping"
      ? "Measuring latency…"
      : phase === "download"
        ? final === null
          ? displayed > 0
            ? "Testing your download speed…"
            : "Connecting…"
          : "Almost done…"
        : phase === "upload"
          ? "Measuring upload…"
          : phase === "done"
            ? `Your download speed is ${formatSpeed(final ?? 0)} Mbps`
            : "Starting…";

  const shownNumber = phase === "done" ? (final ?? 0) : animated;

  return (
    <section className="flex w-full max-w-3xl flex-col items-center gap-8 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
        Your download speed
      </p>

      <div className="flex items-baseline justify-center gap-3">
        <span
          className="speed-number tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {formatSpeed(shownNumber)}
        </span>
        <span className="text-2xl font-light text-neutral-400 md:text-3xl">Mbps</span>
      </div>

      <p
        className={`min-h-6 text-base text-neutral-600 transition-opacity duration-300 md:text-lg ${
          phase === "done" ? "opacity-100" : "opacity-80"
        }`}
      >
        {status}
      </p>

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-900 transition hover:border-neutral-900 hover:bg-neutral-900 hover:text-white"
        >
          {showMore ? "Hide details" : "Show more info"}
        </button>

        {showMore && (
          <dl className="grid w-full grid-cols-3 gap-6 pt-2 text-left animate-fade-in">
            <div>
              <dt className="text-xs uppercase tracking-widest text-neutral-500">Ping</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {ping !== null ? `${ping}` : "—"}
                <span className="ml-1 text-sm font-normal text-neutral-400">ms</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-neutral-500">Download</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {final !== null ? formatSpeed(final) : formatSpeed(animated)}
                <span className="ml-1 text-sm font-normal text-neutral-400">Mbps</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-widest text-neutral-500">Upload</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {upload !== null ? formatSpeed(upload) : "—"}
                <span className="ml-1 text-sm font-normal text-neutral-400">Mbps</span>
              </dd>
            </div>
          </dl>
        )}

        {phase === "done" && (
          <button
            type="button"
            onClick={() => void runTest()}
            className="mt-2 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            Test again
          </button>
        )}
      </div>
    </section>
  );
}
