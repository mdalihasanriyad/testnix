import { createFileRoute, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import logo from "../assets/testnix-logo.png";

const resultsSearchSchema = z.object({
  speed: fallback(z.coerce.number().nonnegative(), 0).default(0),
  upload: fallback(z.coerce.number().nonnegative(), 0).default(0),
  ping: fallback(z.coerce.number().nonnegative(), 0).default(0),
});

function formatSpeed(mbps: number) {
  if (mbps >= 100) return mbps.toFixed(0);
  if (mbps >= 10) return mbps.toFixed(1);
  return mbps.toFixed(2);
}

export const Route = createFileRoute("/results")({
  validateSearch: zodValidator(resultsSearchSchema),
  head: () => {
    const search = Route.useSearch();
    const title = `Testnix Result - ${formatSpeed(search.speed)} Mbps down, ${formatSpeed(search.upload)} Mbps up, ${Math.round(search.ping)}ms ping`;
    const description = `View this internet speed test result: Download ${formatSpeed(search.speed)} Mbps, Upload ${formatSpeed(search.upload)} Mbps, Ping ${Math.round(search.ping)}ms.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Testnix" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: "/results" }],
    };
  },
  component: ResultsPage,
});

function ResultsPage() {
  const { speed, upload, ping } = Route.useSearch();

  return (
    <main className="flex min-h-screen flex-col bg-white text-neutral-900">
      <header className="flex items-center justify-end px-6 py-5 text-sm text-neutral-600 md:px-10">
        <nav aria-label="Primary" className="flex items-center gap-6">
          <span>English (US)</span>
          <a href="/privacy" className="hover:text-neutral-900">Privacy</a>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-start px-4 pb-12 pt-4 sm:pt-8">
        <div className="mb-[clamp(2rem,5vw,4rem)] flex flex-col items-center">
          <img
            src={logo}
            alt="Testnix speedometer logo"
            width={140}
            height={140}
            className="h-[clamp(72px,11vw,128px)] w-[clamp(72px,11vw,128px)]"
            loading="eager"
          />
          <h1 className="fast-heading mt-1 tracking-tight">TESTNIX</h1>
        </div>

        <div className="flex w-full max-w-5xl flex-col items-center px-4 text-center sm:px-6">
          <h2 className="fast-heading mb-6 text-neutral-900">Speed test result</h2>

          <div className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 p-6 text-center">
              <p className="text-sm text-neutral-500">Download</p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-neutral-900">
                {formatSpeed(speed)}
              </p>
              <p className="text-sm text-neutral-400">Mbps</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-6 text-center">
              <p className="text-sm text-neutral-500">Upload</p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-neutral-900">
                {formatSpeed(upload)}
              </p>
              <p className="text-sm text-neutral-400">Mbps</p>
            </div>
            <div className="rounded-xl border border-neutral-200 p-6 text-center">
              <p className="text-sm text-neutral-500">Ping</p>
              <p className="mt-2 text-4xl font-bold tabular-nums text-neutral-900">
                {Math.round(ping)}
              </p>
              <p className="text-sm text-neutral-400">ms</p>
            </div>
          </div>

          <div className="mt-10">
            <Link
              to="/"
              className="rounded-lg bg-[var(--testnix-red)] px-8 py-3 text-lg font-semibold text-white shadow-md transition hover:brightness-110 active:scale-95"
            >
              Run your own test
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} Testnix.net — Free Internet Speed Test
      </footer>
    </main>
  );
}
