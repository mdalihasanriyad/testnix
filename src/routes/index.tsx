import { createFileRoute } from "@tanstack/react-router";
import { SpeedTest } from "../components/SpeedTest";

const TITLE = "Testnix.net - Free Internet Speed Test Tool";
const DESCRIPTION =
  "Test your internet speed instantly with Testnix. Fast, accurate and free speed test tool measuring download, upload and ping.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "keywords", content: "internet speed test, speed test, broadband test, download speed, upload speed, ping test, testnix" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Testnix" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Testnix",
          url: "https://testnix.net/",
          description: DESCRIPTION,
          applicationCategory: "UtilityApplication",
          operatingSystem: "Any",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col bg-white text-neutral-900">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <a href="/" className="text-lg font-bold tracking-tight">
          Testnix<span className="text-neutral-400">.net</span>
        </a>
        <nav aria-label="Primary" className="text-sm text-neutral-500">
          <span className="hidden sm:inline">Test Your Internet Speed Instantly</span>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center pb-16">
        <h1 className="sr-only">Testnix.net — Free Internet Speed Test</h1>
        <SpeedTest />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16 text-center text-sm text-neutral-500">
        <h2 className="mb-2 text-base font-semibold text-neutral-700">
          About this speed test
        </h2>
        <p>
          Testnix measures your real-world internet performance by downloading data
          from our servers using multiple parallel connections, then reports
          download, upload and latency in seconds. No login. No tracking. Just speed.
        </p>
      </section>

      <footer className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} Testnix.net — Free Internet Speed Test
      </footer>
    </main>
  );
}
