import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listBoardEntries, type BoardEntry } from "@/lib/public-board.functions";

const TITLE = "Community Speed Test Board | Testnix.net";
const DESCRIPTION =
  "See real internet speed test results shared by visitors, each with an AI explanation of what the numbers mean and how to improve them.";

const boardQueryOptions = queryOptions({
  queryKey: ["public-board"],
  queryFn: () => listBoardEntries(),
});

export const Route = createFileRoute("/board")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Testnix" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "/board" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQueryOptions),
  errorComponent: () => (
    <Shell>
      <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        We couldn't load the board right now. Please refresh in a moment.
      </p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-sm text-neutral-500">Nothing here.</p>
    </Shell>
  ),
  component: Board,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <header className="flex items-center justify-between px-6 py-5 text-sm text-neutral-600 md:px-10">
        <Link to="/" className="font-bold tracking-tight text-neutral-900">
          TESTNIX
        </Link>
        <Link to="/" className="hover:text-neutral-900">
          Run a test
        </Link>
      </header>
      <section className="mx-auto w-full max-w-4xl px-4 pb-16">{children}</section>
    </main>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Board() {
  const { data } = useSuspenseQuery(boardQueryOptions);
  const entries = data as BoardEntry[];

  const avg = (key: "download" | "upload" | "ping") =>
    entries.length
      ? entries.reduce((sum, e) => sum + e[key], 0) / entries.length
      : 0;

  return (
    <Shell>
      <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Community speed board</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-500">
        Real results shared by visitors, each with an AI explanation of what the numbers mean.
      </p>

      {entries.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {(
            [
              ["Avg download", `${avg("download").toFixed(1)} Mbps`],
              ["Avg upload", `${avg("upload").toFixed(1)} Mbps`],
              ["Avg ping", `${Math.round(avg("ping"))} ms`],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-neutral-200 p-3">
              <p className="text-xs text-neutral-500">{label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-neutral-300 p-10 text-center">
          <p className="text-sm text-neutral-500">No results shared yet.</p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-[var(--testnix-red)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Be the first — run a test
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-neutral-200 p-4 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-bold text-neutral-900">
                  {entry.nickname || "Anonymous"}
                  {entry.city ? <span className="font-normal text-neutral-500"> · {entry.city}</span> : null}
                </p>
                <p className="text-xs text-neutral-400">{formatDate(entry.created_at)}</p>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums text-neutral-700">
                <span><strong>{entry.download.toFixed(1)}</strong> Mbps ↓</span>
                <span><strong>{entry.upload.toFixed(1)}</strong> Mbps ↑</span>
                <span><strong>{Math.round(entry.ping)}</strong> ms</span>
                {entry.connection_type && <span className="text-neutral-400">{entry.connection_type}</span>}
                {entry.device && <span className="text-neutral-400">{entry.device}</span>}
              </div>

              {entry.verdict && (
                <p className="mt-4 text-base font-bold text-neutral-900">{entry.verdict}</p>
              )}
              {entry.summary && (
                <p className="mt-1 text-sm leading-relaxed text-neutral-600">{entry.summary}</p>
              )}

              {entry.factors.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {entry.factors.map((f, i) => (
                    <li key={i} className="flex gap-2 text-sm text-neutral-600">
                      <span className="text-neutral-400" aria-hidden>•</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              {entry.steps.length > 0 && (
                <ol className="mt-3 space-y-1">
                  {entry.steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-neutral-600">
                      <span className="font-semibold tabular-nums text-[var(--testnix-red)]">{i + 1}.</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
