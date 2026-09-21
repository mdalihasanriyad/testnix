import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

export type SpeedAdvice = {
  verdict: string;
  summary: string;
  factors: string[];
  steps: string[];
};

export const getSpeedAdvice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AdviceInput.parse(input))
  .handler(async ({ data }): Promise<SpeedAdvice> => {
    const { generateSpeedAdvice } = await import("./speed-advice.server");
    return await generateSpeedAdvice(data);
  });
