import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PublishInput = z.object({
  download: z.number().min(0).max(100000),
  upload: z.number().min(0).max(100000),
  ping: z.number().min(0).max(100000),
  nickname: z.string().max(40),
  city: z.string().max(60),
  connectionType: z.string().max(60),
  device: z.string().max(60),
  planSpeed: z.string().max(40),
  issue: z.string().max(200),
});

export type PublishInputType = z.infer<typeof PublishInput>;

export type BoardEntry = {
  id: string;
  nickname: string | null;
  city: string | null;
  connection_type: string | null;
  device: string | null;
  plan_speed: string | null;
  issue: string | null;
  download: number;
  upload: number;
  ping: number;
  verdict: string;
  summary: string;
  factors: string[];
  steps: string[];
  created_at: string;
};

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export const listBoardEntries = createServerFn({ method: "GET" }).handler(
  async (): Promise<BoardEntry[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data, error } = await supabasePublic
      .from("public_results")
      .select(
        "id, nickname, city, connection_type, device, plan_speed, issue, download, upload, ping, verdict, summary, factors, steps, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      ...(row as Omit<BoardEntry, "factors" | "steps">),
      factors: toStringArray((row as { factors: unknown }).factors),
      steps: toStringArray((row as { steps: unknown }).steps),
    }));
  },
);

export const publishResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PublishInput.parse(input))
  .handler(async ({ data }): Promise<BoardEntry> => {
    const { generateSpeedAdvice } = await import("./speed-advice.server");
    const advice = await generateSpeedAdvice({
      download: data.download,
      upload: data.upload,
      ping: data.ping,
      connectionType: data.connectionType,
      device: data.device,
      planSpeed: data.planSpeed,
      issue: data.issue,
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("public_results")
      .insert({
        nickname: data.nickname.trim() || "Anonymous",
        city: data.city.trim() || null,
        connection_type: data.connectionType || null,
        device: data.device.trim() || null,
        plan_speed: data.planSpeed.trim() || null,
        issue: data.issue.trim() || null,
        download: data.download,
        upload: data.upload,
        ping: data.ping,
        verdict: advice.verdict,
        summary: advice.summary,
        factors: advice.factors,
        steps: advice.steps,
      })
      .select(
        "id, nickname, city, connection_type, device, plan_speed, issue, download, upload, ping, verdict, summary, factors, steps, created_at",
      )
      .single();

    if (error) throw new Error(error.message);

    return {
      ...(inserted as Omit<BoardEntry, "factors" | "steps">),
      factors: toStringArray((inserted as { factors: unknown }).factors),
      steps: toStringArray((inserted as { steps: unknown }).steps),
    };
  });
