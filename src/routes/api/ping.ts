import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ping")({
  server: {
    handlers: {
      GET: async () =>
        new Response("pong", {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        }),
      POST: async ({ request }) => {
        // Upload measurement endpoint: read and discard the body.
        const reader = request.body?.getReader();
        let bytes = 0;
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) bytes += value.byteLength;
          }
        }
        return new Response(JSON.stringify({ bytes }), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          },
        });
      },
    },
  },
});
