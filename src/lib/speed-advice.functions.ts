import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-gateway.server";

const AdviceInput = z.object({
  download: z.number(),
  upload: z.number(),
  ping: z.number(),
  connectionType: z.string(),
  device: z.string(),
  planSpeed: z.string(),
  issue: z.string(),
});

export type AdviceInputType = z.infer<typeof AdviceInput>;

const AdviceSchema = z.object({
  verdict: z.string(),
  summary: z.string(),
  factors: z.array(z.string()),
  steps: z.array(z.string()),
});

export type SpeedAdvice = z.infer<typeof AdviceSchema>;

export const getSpeedAdvice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdviceInput.parse(input))
  .handler(async ({ data }): Promise<SpeedAdvice> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const runIdFetch = createLovableAiGatewayRunIdFetch();
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({ schema: AdviceSchema }),
      system:
        "You are a home network performance expert. Given speed test results and connection details, explain the performance in plain, non-technical language and give practical troubleshooting steps. " +
        "verdict: a 3-6 word rating such as 'Fast enough for 4K streaming'. summary: 2-3 sentences. factors: 2-4 short bullet observations. steps: 3-6 short, concrete actions in priority order. Keep every string under 200 characters.",
      prompt: [
        `Download: ${data.download.toFixed(2)} Mbps`,
        `Upload: ${data.upload.toFixed(2)} Mbps`,
        `Ping: ${Math.round(data.ping)} ms`,
        `Connection type: ${data.connectionType || "unknown"}`,
        `Device: ${data.device || "unknown"}`,
        `Advertised plan speed: ${data.planSpeed || "unknown"}`,
        `Reported problem: ${data.issue || "none stated"}`,
      ].join("\n"),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    return await result.output;
  });
