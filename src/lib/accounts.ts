import { supabase } from "./supabase";

const BUCKET = "item-images";

/** Paths of every photo a person uploaded (their folder is named after their user id). */
export async function listUserPhotos(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(userId, { limit: 1000 });
    return (data ?? []).map((f) => `${userId}/${f.name}`);
  } catch {
    return [];
  }
}

/** Best-effort cleanup after an account is deleted. */
export async function removePhotos(paths: string[]) {
  if (!paths.length) return;
  try { await supabase.storage.from(BUCKET).remove(paths); } catch { /* orphaned files are harmless */ }
}
