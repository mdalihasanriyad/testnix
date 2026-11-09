import { getCookie, setCookie } from "@tanstack/react-start/server";

const OWNER_COOKIE = "testnix_speed_owner";
const OWNER_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function getOrCreateOwnerId(): string {
  const existing = getCookie(OWNER_COOKIE);
  if (existing && OWNER_PATTERN.test(existing)) return existing;

  const ownerId = crypto.randomUUID();
  setCookie(OWNER_COOKIE, ownerId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return ownerId;
}

export async function getSpeedResultsAccess() {
  const ownerId = getOrCreateOwnerId();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return { ownerId, supabase: supabaseAdmin };
}