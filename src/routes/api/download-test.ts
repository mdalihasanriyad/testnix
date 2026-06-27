import { createFileRoute } from "@tanstack/react-router";

// Returns a random binary buffer for download speed measurement.
// Size is controlled by ?bytes= (default 10MB, max 25MB).
export const Route = createFileRoute("/api/download-test")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const requested = Number(url.searchParams.get("bytes") ?? 10 * 1024 * 1024);
        const size = Math.max(
          64 * 1024,
          Math.min(Number.isFinite(requested) ? requested : 10 * 1024 * 1024, 25 * 1024 * 1024),
        );

        // Stream random chunks so we don't hold the whole buffer in memory.
        const chunkSize = 64 * 1024;
        let sent = 0;
        const stream = new ReadableStream({
          pull(controller) {
            if (sent >= size) {
              controller.close();
              return;
            }
            const remaining = size - sent;
            const len = Math.min(chunkSize, remaining);
            const chunk = new Uint8Array(len);
            crypto.getRandomValues(chunk);
            controller.enqueue(chunk);
            sent += len;
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Length": String(size),
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Access-Control-Allow-Origin": "*",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
