import { useSearch } from "@tanstack/react-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";


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

function buildChartCsv(rows: RecentTest[]) {
  const header = ["Timestamp", "Time", "Download (Mbps)", "Upload (Mbps)", "Ping (ms)"];
  const lines = rows.map((r) => [
    new Date(r.at).toISOString(),
    formatTimestamp(r.at),
    r.download.toFixed(2),
    r.upload.toFixed(2),
    Math.round(r.ping),
  ]);
  return [header, ...lines].map((row) => row.map(escapeCsv).join(",")).join("\n");
}



async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2) {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  // Recharts leaves animation dash values inline, which hide the lines when rasterized.
  clone.querySelectorAll("path").forEach((path) => {
    path.style.removeProperty("stroke-dasharray");
    path.style.removeProperty("stroke-dashoffset");
    path.style.removeProperty("opacity");
    const dash = path.getAttribute("stroke-dasharray");
    if (dash && /^0px/.test(dash)) path.removeAttribute("stroke-dasharray");
  });
  const source = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to render chart"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function findChartSvg(root: HTMLElement | null): SVGSVGElement | null {
  if (!root) return null;
  const svgs = Array.from(root.querySelectorAll("svg"));
  let best: SVGSVGElement | null = null;
  let bestArea = 0;
  for (const svg of svgs) {
    const r = svg.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea) {
      bestArea = area;
      best = svg as SVGSVGElement;
    }
  }
  return best;
}

function computeStats(rows: RecentTest[]) {
  if (rows.length === 0) return null;
  const download = rows.map((r) => r.download);
  const upload = rows.map((r) => r.upload);
  const ping = rows.map((r) => r.ping);
  return {
    download: {
      min: Math.min(...download),
      max: Math.max(...download),
      avg: download.reduce((a, b) => a + b, 0) / download.length,
    },
    upload: {
      min: Math.min(...upload),
      max: Math.max(...upload),
      avg: upload.reduce((a, b) => a + b, 0) / upload.length,
    },
    ping: {
      min: Math.min(...ping),
      max: Math.max(...ping),
      avg: ping.reduce((a, b) => a + b, 0) / ping.length,
    },
  };
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

function downloadJson(filename: string, jsonText: string) {
  const blob = new Blob([jsonText], { type: "application/json;charset=utf-8;" });
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
  const search = useSearch({ from: "/" }) as {
    speed?: string;
    upload?: string;
    ping?: string;
    reportRange?: string;
    reportFrom?: string;
    reportTo?: string;
  };
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
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [recentError, setRecentError] = useState(false);
  const [selectedTest, setSelectedTest] = useState<RecentTest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [minDownload, setMinDownload] = useState("");
  const [maxDownload, setMaxDownload] = useState("");
  const [minUpload, setMinUpload] = useState("");
  const [maxUpload, setMaxUpload] = useState("");
  const [minPing, setMinPing] = useState("");
  const [maxPing, setMaxPing] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "highestDownload" | "highestUpload" | "lowestPing">("newest");
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const [chartRange, setChartRange] = useState<"all" | "7d" | "30d" | "custom">("all");
  const [chartFrom, setChartFrom] = useState("");
  const [chartTo, setChartTo] = useState("");
  const [exportingPng, setExportingPng] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printing, setPrinting] = useState(false);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [ChartComponent, setChartComponent] = useState<React.ComponentType<{ data: { at: number; label: string; download: number; upload: number; ping: number }[] }> | null>(null);
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
    fetchRecent();

    const sharedSpeed = typeof search.speed === "string" ? parseFloat(search.speed) : null;
    const sharedUpload = typeof search.upload === "string" ? parseFloat(search.upload) : null;
    const sharedPing = typeof search.ping === "string" ? parseFloat(search.ping) : null;

    // Apply a shared report time range (chart view) if present in the URL.
    const sharedRange = typeof search.reportRange === "string" ? search.reportRange : null;
    if (sharedRange && ["all", "7d", "30d", "custom"].includes(sharedRange)) {
      setViewMode("chart");
      setChartRange(sharedRange as "all" | "7d" | "30d" | "custom");
      if (sharedRange === "custom") {
        if (typeof search.reportFrom === "string") setChartFrom(search.reportFrom);
        if (typeof search.reportTo === "string") setChartTo(search.reportTo);
      }
    }

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
    setSelectedTest(entry);
  }, [phase, final, upload, pingLoaded]);

  // Dynamically import the chart component only on the client to avoid SSR issues.
  useEffect(() => {
    let mounted = true;
    import("./SpeedTrendChart")
      .then((mod) => {
        if (mounted) setChartComponent(() => mod.SpeedTrendChart);
      })
      .catch(() => {
        // ignore failed import
      });
    return () => {
      mounted = false;
    };
  }, []);





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

  const handleExportJsonRecent = useCallback(() => {
    if (recent.length === 0) return;
    const payload = recent.map((r) => ({
      timestamp: new Date(r.at).toISOString(),
      downloadMbps: Number(r.download.toFixed(2)),
      uploadMbps: Number(r.upload.toFixed(2)),
      pingMs: Math.round(r.ping),
      url: buildShareUrl({ download: r.download, upload: r.upload, ping: r.ping }),
    }));
    const date = new Date().toISOString().slice(0, 10);
    downloadJson(`testnix-recent-tests-${date}.json`, JSON.stringify(payload, null, 2));
  }, [recent]);


  const handleClearRecent = useCallback(() => {
    const ok = window.confirm("Clear all recent test history? This cannot be undone.");
    if (!ok) return;
    try {
      window.localStorage.removeItem(RECENT_KEY);
    } catch {
      // ignore
    }
    setRecent([]);
  }, []);


  const fetchRecent = useCallback(() => {
    setLoadingRecent(true);
    try {
      setRecent(loadRecent());
      setRecentError(false);
    } catch {
      setRecentError(true);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  const handleRetryRecent = useCallback(() => {
    fetchRecent();
  }, [fetchRecent]);

  const filteredRecent = recent.filter((r) => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const text = `${formatSpeed(r.download)} ${formatSpeed(r.upload)} ${Math.round(r.ping)} ${new Date(r.at).toLocaleString()}`.toLowerCase();
      if (!text.includes(q)) return false;
    }
    if (dateFilter !== "all") {
      const now = new Date();
      const d = new Date(r.at);
      const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (dateFilter === "today" && !sameDay) return false;
      const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      if (dateFilter === "week" && diffDays > 7) return false;
      if (dateFilter === "month" && diffDays > 30) return false;
    }
    const minD = parseFloat(minDownload);
    const maxD = parseFloat(maxDownload);
    if (!isNaN(minD) && r.download < minD) return false;
    if (!isNaN(maxD) && r.download > maxD) return false;
    const minU = parseFloat(minUpload);
    const maxU = parseFloat(maxUpload);
    if (!isNaN(minU) && r.upload < minU) return false;
    if (!isNaN(maxU) && r.upload > maxU) return false;
    const minP = parseFloat(minPing);
    const maxP = parseFloat(maxPing);
    if (!isNaN(minP) && r.ping < minP) return false;
    if (!isNaN(maxP) && r.ping > maxP) return false;
    return true;
  });

  const sortedRecent = [...filteredRecent].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return b.at - a.at;
      case "highestDownload":
        return b.download - a.download;
      case "highestUpload":
        return b.upload - a.upload;
      case "lowestPing":
        return a.ping - b.ping;
      default:
        return 0;
    }
  });

  // Chart-only time range filtering (independent of the list filters)
  const chartRecent = [...filteredRecent]
    .filter((r) => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      if (chartRange === "7d") return now - r.at <= 7 * day;
      if (chartRange === "30d") return now - r.at <= 30 * day;
      if (chartRange === "custom") {
        if (chartFrom) {
          const from = new Date(`${chartFrom}T00:00:00`).getTime();
          if (!isNaN(from) && r.at < from) return false;
        }
        if (chartTo) {
          const to = new Date(`${chartTo}T23:59:59.999`).getTime();
          if (!isNaN(to) && r.at > to) return false;
        }
      }
      return true;
    })
    .sort((a, b) => a.at - b.at);

  const stats = computeStats(chartRecent);

  const handleExportChartCsv = useCallback(() => {
    if (chartRecent.length === 0) return;
    const csv = buildChartCsv(chartRecent);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`testnix-trend-chart-${date}.csv`, csv);
  }, [chartRecent]);

  const handleExportChartPng = useCallback(async () => {
    const svg = findChartSvg(chartRef.current);
    if (!svg) return;
    setExportingPng(true);
    try {
      const { dataUrl } = await svgToPngDataUrl(svg);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `testnix-trend-chart-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* ignore export failure */
    } finally {
      setExportingPng(false);
    }
  }, []);

  const handleExportPdf = useCallback(async () => {
    if (chartRecent.length === 0 || !stats) return;
    setExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 40;
      const contentW = pageW - margin * 2;

      const rangeLabel =
        chartRange === "all"
          ? "All time"
          : chartRange === "7d"
            ? "Last 7 days"
            : chartRange === "30d"
              ? "Last 30 days"
              : `${chartFrom || "start"} to ${chartTo || "now"}`;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("Testnix Speed Test Report", margin, 60);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(115);
      doc.text(`Range: ${rangeLabel}`, margin, 78);
      doc.text(
        `${chartRecent.length} test${chartRecent.length === 1 ? "" : "s"}  ·  Generated ${formatTimestamp(Date.now())}`,
        margin,
        92,
      );
      doc.setDrawColor(229);
      doc.line(margin, 104, pageW - margin, 104);

      // Summary stats table
      doc.setTextColor(23);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Summary", margin, 128);

      const cols = [margin, margin + 150, margin + 260, margin + 370];
      let y = 150;
      doc.setFontSize(10);
      doc.setTextColor(115);
      doc.text("Metric", cols[0], y);
      doc.text("Min", cols[1], y);
      doc.text("Avg", cols[2], y);
      doc.text("Max", cols[3], y);
      doc.setDrawColor(240);
      doc.line(margin, y + 6, pageW - margin, y + 6);

      const rows: [string, string, string, string][] = [
        [
          "Download (Mbps)",
          formatSpeed(stats.download.min),
          formatSpeed(stats.download.avg),
          formatSpeed(stats.download.max),
        ],
        [
          "Upload (Mbps)",
          formatSpeed(stats.upload.min),
          formatSpeed(stats.upload.avg),
          formatSpeed(stats.upload.max),
        ],
        [
          "Ping (ms)",
          String(Math.round(stats.ping.min)),
          String(Math.round(stats.ping.avg)),
          String(Math.round(stats.ping.max)),
        ],
      ];
      doc.setFont("helvetica", "normal");
      for (const row of rows) {
        y += 24;
        doc.setTextColor(23);
        doc.text(row[0], cols[0], y);
        doc.text(row[1], cols[1], y);
        doc.text(row[2], cols[2], y);
        doc.text(row[3], cols[3], y);
        doc.setDrawColor(245);
        doc.line(margin, y + 7, pageW - margin, y + 7);
      }

      // Trend chart image
      y += 40;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(23);
      doc.text("Speed trend", margin, y);
      y += 14;

      const svg = findChartSvg(chartRef.current);
      if (svg) {
        try {
          const { dataUrl, width, height } = await svgToPngDataUrl(svg);
          const imgH = Math.min((contentW * height) / width, 260);
          doc.addImage(dataUrl, "PNG", margin, y, contentW, imgH);
          y += imgH + 14;
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          let lx = margin;
          const legend: [string, [number, number, number]][] = [
            ["Download (Mbps)", [23, 23, 23]],
            ["Upload (Mbps)", [160, 160, 160]],
            ["Ping (ms)", [239, 68, 68]],
          ];
          for (const [label, color] of legend) {
            doc.setDrawColor(color[0], color[1], color[2]);
            doc.setLineWidth(2);
            doc.line(lx, y - 3, lx + 16, y - 3);
            doc.setTextColor(80);
            doc.text(label, lx + 22, y);
            lx += 22 + doc.getTextWidth(label) + 24;
          }
          doc.setLineWidth(1);
        } catch {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(115);
          doc.text("Chart image unavailable.", margin, y + 16);
          y += 24;
        }
      }

      // Test list
      y += 30;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("Tests", margin, y);
      y += 20;
      doc.setFontSize(9);
      doc.setTextColor(115);
      doc.text("When", cols[0], y);
      doc.text("Download", cols[1], y);
      doc.text("Upload", cols[2], y);
      doc.text("Ping", cols[3], y);
      doc.setDrawColor(240);
      doc.line(margin, y + 5, pageW - margin, y + 5);
      doc.setFont("helvetica", "normal");
      const listRows = [...chartRecent].sort((a, b) => b.at - a.at).slice(0, 12);
      for (const r of listRows) {
        if (y + 16 > 780) break;
        y += 16;
        doc.setTextColor(23);
        doc.text(formatTimestamp(r.at), cols[0], y);
        doc.text(`${formatSpeed(r.download)} Mbps`, cols[1], y);
        doc.text(`${formatSpeed(r.upload)} Mbps`, cols[2], y);
        doc.text(`${Math.round(r.ping)} ms`, cols[3], y);
      }

      doc.setFontSize(8);
      doc.setTextColor(160);
      doc.text("Generated with Testnix.net — free internet speed test", margin, 812);

      doc.save(`testnix-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      /* ignore export failure */
    } finally {
      setExportingPdf(false);
    }
  }, [chartRecent, stats, chartRange, chartFrom, chartTo]);

  const handlePrintReport = useCallback(async () => {
    if (chartRecent.length === 0 || !stats) return;
    setPrinting(true);
    try {
      const rangeLabel =
        chartRange === "all"
          ? "All time"
          : chartRange === "7d"
            ? "Last 7 days"
            : chartRange === "30d"
              ? "Last 30 days"
              : `${chartFrom || "start"} to ${chartTo || "now"}`;

      let chartImageHtml = "";
      const svg = findChartSvg(chartRef.current);
      if (svg) {
        try {
          const { dataUrl } = await svgToPngDataUrl(svg);
          chartImageHtml = `<img src="${dataUrl}" alt="Speed trend chart" style="width:100%;max-width:100%;height:auto;margin:0 0 16px;" />`;
        } catch {
          chartImageHtml = `<p style="color:#737373;font-size:12px;">Chart image unavailable.</p>`;
        }
      }

      const listRows = [...chartRecent].sort((a, b) => b.at - a.at).slice(0, 20);
      const rowsHtml = listRows
        .map(
          (r) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:12px;color:#171717;">${formatTimestamp(r.at)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:12px;color:#171717;text-align:right;">${formatSpeed(r.download)} Mbps</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:12px;color:#171717;text-align:right;">${formatSpeed(r.upload)} Mbps</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;font-size:12px;color:#171717;text-align:right;">${Math.round(r.ping)} ms</td>
          </tr>
        `,
        )
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Testnix Speed Test Report</title>
            <style>
              @page { margin: 16mm; }
              body { font-family: Helvetica, Arial, sans-serif; color: #171717; margin: 0; padding: 24px; background: #fff; }
              h1 { font-size: 22px; margin: 0 0 6px; }
              .meta { font-size: 11px; color: #737373; margin-bottom: 18px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
              th { text-align: left; padding: 8px 12px; font-size: 11px; color: #737373; border-bottom: 1px solid #d4d4d4; font-weight: 600; }
              td { padding: 8px 12px; }
              .footer { font-size: 10px; color: #a3a3a3; margin-top: 24px; border-top: 1px solid #e5e5e5; padding-top: 12px; }
            </style>
          </head>
          <body>
            <h1>Testnix Speed Test Report</h1>
            <p class="meta">
              Range: ${rangeLabel} &nbsp;·&nbsp; ${chartRecent.length} test${chartRecent.length === 1 ? "" : "s"} &nbsp;·&nbsp; Generated ${formatTimestamp(Date.now())}
            </p>

            <h2 style="font-size:15px;margin:0 0 10px;">Summary</h2>
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th style="text-align:right;">Min</th>
                  <th style="text-align:right;">Avg</th>
                  <th style="text-align:right;">Max</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight:600;">Download (Mbps)</td>
                  <td style="text-align:right;">${formatSpeed(stats.download.min)}</td>
                  <td style="text-align:right;">${formatSpeed(stats.download.avg)}</td>
                  <td style="text-align:right;">${formatSpeed(stats.download.max)}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;">Upload (Mbps)</td>
                  <td style="text-align:right;">${formatSpeed(stats.upload.min)}</td>
                  <td style="text-align:right;">${formatSpeed(stats.upload.avg)}</td>
                  <td style="text-align:right;">${formatSpeed(stats.upload.max)}</td>
                </tr>
                <tr>
                  <td style="font-weight:600;">Ping (ms)</td>
                  <td style="text-align:right;">${Math.round(stats.ping.min)}</td>
                  <td style="text-align:right;">${Math.round(stats.ping.avg)}</td>
                  <td style="text-align:right;">${Math.round(stats.ping.max)}</td>
                </tr>
              </tbody>
            </table>

            <h2 style="font-size:15px;margin:0 0 10px;">Speed trend</h2>
            ${chartImageHtml}
            <div style="display:flex;flex-wrap:wrap;gap:18px;margin-bottom:18px;font-size:12px;color:#525252;">
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:16px;height:3px;background:#171717;"></span>
                Download (Mbps)
              </span>
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:16px;height:3px;background:#a0a0a0;"></span>
                Upload (Mbps)
              </span>
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:16px;height:3px;background:#ef4444;"></span>
                Ping (ms)
              </span>
            </div>

            <h2 style="font-size:15px;margin:24px 0 10px;">Tests</h2>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th style="text-align:right;">Download</th>
                  <th style="text-align:right;">Upload</th>
                  <th style="text-align:right;">Ping</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <p class="footer">Generated with Testnix.net — free internet speed test</p>
          </body>
        </html>
      `;

      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) return;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Wait for the image to render before printing.
      const img = printWindow.document.querySelector("img");
      if (img && !img.complete) {
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 500);
        });
      }
      printWindow.print();
      printWindow.addEventListener("afterprint", () => printWindow.close());
    } catch {
      /* ignore print failure */
    } finally {
      setPrinting(false);
    }
  }, [chartRecent, stats, chartRange, chartFrom, chartTo]);


  const activeFilterCount = [
    searchQuery.trim(),
    dateFilter !== "all",
    minDownload || maxDownload,
    minUpload || maxUpload,
    minPing || maxPing,
  ].filter(Boolean).length;


  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setDateFilter("all");
    setMinDownload("");
    setMaxDownload("");
    setMinUpload("");
    setMaxUpload("");
    setMinPing("");
    setMaxPing("");
  }, []);

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

      <div className="mt-12 w-full max-w-3xl animate-fade-in">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-left text-lg font-bold text-neutral-900">
            Recent tests
          </h3>
          <div className="flex items-center gap-2 sm:gap-3">
            {recent.length > 0 && !loadingRecent && (
              <>
                <button
                  type="button"
                  onClick={() => setShowFilters((s) => !s)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${showFilters ? "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800" : "border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900"}`}
                  aria-expanded={showFilters}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--testnix-red)] text-[10px] font-bold text-white">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-600 focus:border-neutral-900 focus:outline-none"
                  aria-label="Sort recent tests"
                >
                  <option value="newest">Newest</option>
                  <option value="highestDownload">Highest download</option>
                  <option value="highestUpload">Highest upload</option>
                  <option value="lowestPing">Lowest ping</option>
                </select>
                <div className="inline-flex rounded-md border border-neutral-200 bg-white text-xs font-medium" role="group" aria-label="Recent tests view">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`px-2.5 py-1.5 transition ${viewMode === "list" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
                    aria-pressed={viewMode === "list"}
                  >
                    List
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("chart")}
                    className={`px-2.5 py-1.5 transition ${viewMode === "chart" ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
                    aria-pressed={viewMode === "chart"}
                  >
                    Chart
                  </button>
                </div>
                <button
                  onClick={handleExportRecent}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportJsonRecent}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={handleClearRecent}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                  <span className="hidden sm:inline">Clear recent history</span>
                  <span className="sm:hidden">Clear</span>
                </button>
              </>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mb-4 rounded-md border border-neutral-200 bg-white p-4 text-left animate-fade-in">
            <div className="mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-neutral-400">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search speed, ping, or date…"
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Date</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as "all" | "today" | "week" | "month")}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-neutral-900 focus:outline-none"
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Download (Mbps)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={minDownload}
                    onChange={(e) => setMinDownload(e.target.value)}
                    placeholder="Min"
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                  />
                  <span className="text-neutral-400">-</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={maxDownload}
                    onChange={(e) => setMaxDownload(e.target.value)}
                    placeholder="Max"
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Upload (Mbps)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={minUpload}
                    onChange={(e) => setMinUpload(e.target.value)}
                    placeholder="Min"
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                  />
                  <span className="text-neutral-400">-</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={maxUpload}
                    onChange={(e) => setMaxUpload(e.target.value)}
                    placeholder="Max"
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-500">Ping (ms)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minPing}
                    onChange={(e) => setMinPing(e.target.value)}
                    placeholder="Min"
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                  />
                  <span className="text-neutral-400">-</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={maxPing}
                    onChange={(e) => setMaxPing(e.target.value)}
                    placeholder="Max"
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            {activeFilterCount > 0 && (
              <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                <span className="text-xs text-neutral-500">{sortedRecent.length} result{sortedRecent.length === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs font-medium text-neutral-600 transition hover:text-neutral-900"
                >
                  Reset filters
                </button>
              </div>
            )}
          </div>
        )}

        {recentError ? (
          <div className="rounded-md border border-neutral-200 px-4 py-8 text-center">
            <p className="text-sm text-neutral-600">
              Couldn’t load your recent test history.
            </p>
            <button
              type="button"
              onClick={handleRetryRecent}
              disabled={loadingRecent}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--testnix-red)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingRecent ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  Retrying…
                </>
              ) : (
                "Retry"
              )}
            </button>
          </div>
        ) : loadingRecent ? (
          viewMode === "chart" ? (
            <div className="rounded-md border border-neutral-200 px-4 py-8">
              <div className="skeleton h-64 w-full rounded" />
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
              {Array.from({ length: 3 }).map((_, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-2 px-4 py-3"
                  aria-hidden="true"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="skeleton h-3.5 w-16 rounded" />
                    <span className="skeleton h-3 w-24 rounded" />
                  </div>
                  <span className="skeleton h-4 w-16 rounded" />
                  <span className="skeleton h-4 w-16 rounded" />
                  <span className="skeleton h-4 w-12 rounded" />
                </li>
              ))}
            </ul>
          )
        ) : sortedRecent.length > 0 ? (
          viewMode === "chart" ? (
            <div className="rounded-md border border-neutral-200 bg-white p-4 animate-fade-in">
              {stats && (
                <div className="mb-4 grid grid-cols-3 gap-3 border-b border-neutral-100 pb-4">
                  {[
                    { label: "Download", unit: "Mbps", key: "download" as const },
                    { label: "Upload", unit: "Mbps", key: "upload" as const },
                    { label: "Ping", unit: "ms", key: "ping" as const },
                  ].map(({ label, unit, key }) => {
                    const s = stats[key];
                    return (
                      <div key={key} className="text-center">
                        <p className="text-xs font-medium text-neutral-500">{label}</p>
                        <div className="mt-1.5 flex items-center justify-center gap-2 text-xs">
                          <span className="flex flex-col items-center">
                            <span className="text-[10px] text-neutral-400">Min</span>
                            <span className="font-semibold tabular-nums text-neutral-900">
                              {key === "ping" ? Math.round(s.min) : formatSpeed(s.min)}
                            </span>
                          </span>
                          <span className="flex flex-col items-center">
                            <span className="text-[10px] text-neutral-400">Avg</span>
                            <span className="font-semibold tabular-nums text-neutral-900">
                              {key === "ping" ? Math.round(s.avg) : formatSpeed(s.avg)}
                            </span>
                          </span>
                          <span className="flex flex-col items-center">
                            <span className="text-[10px] text-neutral-400">Max</span>
                            <span className="font-semibold tabular-nums text-neutral-900">
                              {key === "ping" ? Math.round(s.max) : formatSpeed(s.max)}
                            </span>
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-neutral-400">{unit}</p>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-neutral-200 text-xs font-medium" role="group" aria-label="Chart time range">
                  {([
                    ["all", "All"],
                    ["7d", "Last 7 days"],
                    ["30d", "Last 30 days"],
                    ["custom", "Custom"],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setChartRange(val)}
                      aria-pressed={chartRange === val}
                      className={`px-2.5 py-1.5 transition ${chartRange === val ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {chartRange === "custom" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-neutral-500">
                      From
                      <input
                        type="date"
                        value={chartFrom}
                        onChange={(e) => setChartFrom(e.target.value)}
                        className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 focus:border-neutral-900 focus:outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-neutral-500">
                      To
                      <input
                        type="date"
                        value={chartTo}
                        onChange={(e) => setChartTo(e.target.value)}
                        className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-700 focus:border-neutral-900 focus:outline-none"
                      />
                    </label>
                  </div>
                )}
                <span className="ml-auto text-xs text-neutral-500">
                  {chartRecent.length} point{chartRecent.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={handleExportChartCsv}
                  disabled={chartRecent.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportChartPng}
                  disabled={chartRecent.length === 0 || !ChartComponent || exportingPng}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-4.5-4.5L3 21" />
                  </svg>
                  {exportingPng ? "Exporting…" : "Export PNG"}
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={chartRecent.length === 0 || !ChartComponent || exportingPdf}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  {exportingPdf ? "Building PDF…" : "Export PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePrintReport()}
                  disabled={chartRecent.length === 0 || !ChartComponent || printing}
                  className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  {printing ? "Preparing…" : "Print Report"}
                </button>


              </div>
              {!ChartComponent ? (
                <div className="skeleton h-64 w-full rounded" />
              ) : chartRecent.length > 0 ? (
                <div ref={chartRef}>
                  <ChartComponent
                    data={chartRecent.map((r) => ({
                      at: r.at,
                      label: formatTimestamp(r.at),
                      download: Number(r.download.toFixed(2)),
                      upload: Number(r.upload.toFixed(2)),
                      ping: Math.round(r.ping),
                    }))}
                  />
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-neutral-500">No tests in this time range.</p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200">
              {sortedRecent.map((r) => (
                <li
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTest(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTest(r);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[1.5fr_1fr_1fr_1fr] items-baseline gap-2 px-4 py-3 text-left text-sm transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
          )
        ) : (
          <div className="rounded-md border border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500">
            {recent.length > 0 ? "No tests match your filters. Try adjusting or reset filters." : "No completed tests yet. Run a test to see your recent results here."}
          </div>
        )}
      </div>

      <Sheet
        open={selectedTest !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTest(null);
        }}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Test details</SheetTitle>
            <SheetDescription>
              {selectedTest && (
                <time
                  dateTime={new Date(selectedTest.at).toISOString()}
                  title={new Date(selectedTest.at).toLocaleString()}
                >
                  {new Date(selectedTest.at).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              )}
            </SheetDescription>
          </SheetHeader>
          {selectedTest && (
            <div className="mt-2 grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">Download</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
                  {formatSpeed(selectedTest.download)}
                </p>
                <p className="text-xs text-neutral-400">Mbps</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">Upload</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
                  {formatSpeed(selectedTest.upload)}
                </p>
                <p className="text-xs text-neutral-400">Mbps</p>
              </div>
              <div className="rounded-lg border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">Ping</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">
                  {Math.round(selectedTest.ping)}
                </p>
                <p className="text-xs text-neutral-400">ms</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </section>
  );
}
