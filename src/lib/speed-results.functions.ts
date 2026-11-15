import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DEVICE_KEY = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
const SPEED_VALUE = z.number().finite().min(0).max(100_000);
const TEST_TIME = z.number().int().min(Date.UTC(2000, 0, 1)).max(Date.UTC(2100, 0, 1));

const ResultInput = z.object({
  download: SPEED_VALUE,
  upload: SPEED_VALUE,
  ping: SPEED_VALUE,
  at: TEST_TIME,
});

const DeviceInput = z.object({ deviceKey: DEVICE_KEY });

const SaveInput = DeviceInput.extend(ResultInput.shape);

const MergeInput = DeviceInput.extend({ rows: z.array(ResultInput).max(50) });

export type SpeedResultRow = {
  id: string;
  download: number;
  upload: number;
  ping: number;
  at: string;
};

export const listSpeedResults = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => DeviceInput.parse(input))
  .handler(async (): Promise<SpeedResultRow[]> => {
    const { ownerId, supabase } = await import("./speed-results.server").then((m) => m.getSpeedResultsAccess());
    const { data, error } = await supabase
      .from("speed_results")
      .select("id, download, upload, ping, at")
      .eq("owner_id", ownerId)
      .order("at", { ascending: false })
      .limit(50);

    if (error) throw new Error("Could not load speed results");
    return (data ?? []).map((row) => ({
      id: row.id,
      download: row.download,
      upload: row.upload,
      ping: row.ping,
      at: row.at,
    }));
  });

export const saveSpeedResult = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SaveInput.parse(input))
  .handler(async ({ data }) => {
    const { ownerId, supabase } = await import("./speed-results.server").then((m) => m.getSpeedResultsAccess());
    const { error } = await supabase.from("speed_results").insert({
      owner_id: ownerId,
      device_key: data.deviceKey,
      download: data.download,
      upload: data.upload,
      ping: data.ping,
      at: new Date(data.at).toISOString(),
    });

    if (error) throw new Error("Could not save speed result");
    return { ok: true };
  });

export const mergeSpeedResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MergeInput.parse(input))
  .handler(async ({ data }) => {
    const { ownerId, supabase } = await import("./speed-results.server").then((m) => m.getSpeedResultsAccess());
    const { data: stored, error: readError } = await supabase
      .from("speed_results")
      .select("at")
      .eq("owner_id", ownerId)
      .limit(50);

    if (readError) throw new Error("Could not load speed results");

    const knownTimes = new Set((stored ?? []).map((row) => new Date(row.at).getTime()));
    const inserts = data.rows
      .filter((row) => !knownTimes.has(row.at))
      .map((row) => ({
        owner_id: ownerId,
        device_key: data.deviceKey,
        download: row.download,
        upload: row.upload,
        ping: row.ping,
        at: new Date(row.at).toISOString(),
      }));

    if (inserts.length === 0) return { ok: true, inserted: 0 };

    const { error } = await supabase.from("speed_results").insert(inserts);
    if (error) throw new Error("Could not merge speed results");
    return { ok: true, inserted: inserts.length };
  });

export const clearSpeedResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeviceInput.parse(input))
  .handler(async () => {
    const { ownerId, supabase } = await import("./speed-results.server").then((m) => m.getSpeedResultsAccess());
    const { error } = await supabase.from("speed_results").delete().eq("owner_id", ownerId);

    if (error) throw new Error("Could not clear speed results");
    return { ok: true };
  });