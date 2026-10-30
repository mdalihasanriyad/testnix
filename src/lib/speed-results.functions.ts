import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SpeedResultRow = {
  id: string;
  download: number;
  upload: number;
  ping: number;
  at: string;
};

const DeviceKey = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

const SaveInput = z.object({
  deviceKey: DeviceKey,
  download: z.number().min(0).max(100000),
  upload: z.number().min(0).max(100000),
  ping: z.number().min(0).max(100000),
  at: z.number().int().min(0),
});

const MergeInput = z.object({
  deviceKey: DeviceKey,
  rows: z
    .array(
      z.object({
        download: z.number().min(0).max(100000),
        upload: z.number().min(0).max(100000),
        ping: z.number().min(0).max(100000),
        at: z.number().int().min(0),
      }),
    )
    .max(100),
});

async function deviceClient(deviceKey: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { "x-device-key": deviceKey },
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
}

export const listSpeedResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ deviceKey: DeviceKey }).parse(input))
  .handler(async ({ data }): Promise<SpeedResultRow[]> => {
    const supabase = await deviceClient(data.deviceKey);
    const { data: rows, error } = await supabase
      .from("speed_results")
      .select("id, download, upload, ping, at")
      .order("at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as SpeedResultRow[];
  });

export const saveSpeedResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data }): Promise<SpeedResultRow> => {
    const supabase = await deviceClient(data.deviceKey);
    const { data: inserted, error } = await supabase
      .from("speed_results")
      .insert({
        download: data.download,
        upload: data.upload,
        ping: data.ping,
        at: new Date(data.at).toISOString(),
      })
      .select("id, download, upload, ping, at")
      .single();
    if (error) throw new Error(error.message);
    return inserted as SpeedResultRow;
  });

export const mergeSpeedResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MergeInput.parse(input))
  .handler(async ({ data }): Promise<number> => {
    if (data.rows.length === 0) return 0;
    const supabase = await deviceClient(data.deviceKey);
    const { data: existing, error } = await supabase
      .from("speed_results")
      .select("at");
    if (error) throw new Error(error.message);
    const known = new Set((existing ?? []).map((r) => new Date((r as { at: string }).at).getTime()));
    const missing = data.rows.filter((r) => !known.has(r.at));
    if (missing.length === 0) return 0;
    const { error: insertError } = await supabase.from("speed_results").insert(
      missing.map((r) => ({
        download: r.download,
        upload: r.upload,
        ping: r.ping,
        at: new Date(r.at).toISOString(),
      })),
    );
    if (insertError) throw new Error(insertError.message);
    return missing.length;
  });

export const clearSpeedResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ deviceKey: DeviceKey }).parse(input))
  .handler(async ({ data }): Promise<void> => {
    const supabase = await deviceClient(data.deviceKey);
    const { error } = await supabase.from("speed_results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) throw new Error(error.message);
  });
