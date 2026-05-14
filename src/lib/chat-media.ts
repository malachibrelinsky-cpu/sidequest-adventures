import { supabase } from "@/integrations/supabase/client";

export const MAX_CHAT_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB
// Long-lived signed URL (~10 years). Bucket is private; access is gated by
// holding this URL, which is only ever stored in the message body that RLS
// restricts to participants.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

export async function uploadChatMedia(file: File, userId: string): Promise<string> {
  if (file.size > MAX_CHAT_MEDIA_BYTES) {
    throw new Error("File too large (max 50 MB)");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("chat-media").upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from("chat-media")
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signErr || !data?.signedUrl) throw signErr ?? new Error("Failed to sign URL");
  return data.signedUrl;
}

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|heic)(\?.*)?$/i;
const VID_RE = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i;

export type ChatMediaKind = "image" | "video" | null;

// Only render media that is hosted on our own Supabase storage. This prevents
// a malicious sender from embedding a third-party tracking pixel that would
// leak the recipient's IP / user-agent when the chat auto-renders the URL.
function isTrustedStorageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const supaUrl = (import.meta.env.VITE_SUPABASE_URL || "") as string;
    let supaHost = "";
    try { supaHost = new URL(supaUrl).host; } catch { supaHost = ""; }
    // Accept the project's own Supabase host, and only storage paths.
    const isSupabaseHost = supaHost && u.host === supaHost;
    const isSupabaseDomain = u.host.endsWith(".supabase.co") || u.host.endsWith(".supabase.in");
    if (!isSupabaseHost && !isSupabaseDomain) return false;
    return u.pathname.startsWith("/storage/v1/");
  } catch {
    return false;
  }
}

export function detectChatMedia(body: string): { url: string; kind: ChatMediaKind } | null {
  const trimmed = body.trim();
  if (!/^https:\/\/\S+$/.test(trimmed)) return null;
  if (!isTrustedStorageUrl(trimmed)) return null;
  if (IMG_RE.test(trimmed)) return { url: trimmed, kind: "image" };
  if (VID_RE.test(trimmed)) return { url: trimmed, kind: "video" };
  return null;
}
