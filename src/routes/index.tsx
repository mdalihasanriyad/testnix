import { createFileRoute } from "@tanstack/react-router";
import { SpeedTest } from "../components/SpeedTest";
import logo from "../assets/testnix-logo.png";

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
      <header className="flex items-center justify-end px-6 py-5 text-sm text-neutral-600 md:px-10">
        <nav aria-label="Primary" className="flex items-center gap-6">
          <span>English (US)</span>
          <a href="/privacy" className="hover:text-neutral-900">Privacy</a>
        </nav>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center pb-16">
        <div className="mb-4 flex flex-col items-center">
          <img
            src={logo}
            alt="Testnix speedometer logo"
            width={96}
            height={96}
            className="h-20 w-20 md:h-24 md:w-24"
          />
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">
            TESTNIX
          </h1>
        </div>
        <SpeedTest />
      </section>

      <footer className="border-t border-neutral-200 px-6 py-6 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} Testnix.net — Free Internet Speed Test
      </footer>
    </main>
  );
}
