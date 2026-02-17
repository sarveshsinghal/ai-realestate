// lib/storage/deleteListingFolder.ts
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "listing-media";

export async function deleteListingFolder(listingId: string): Promise<void> {
  const supabase = createSupabaseAdmin();
  const prefix = `listings/${listingId}`;

  // Supabase list works per "folder" path (without leading slash)
  // We'll paginate in case there are many images.
  let page = 0;
  const pageSize = 100;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: pageSize, offset: page * pageSize });

    if (error) {
      throw new Error(`Storage list failed: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    const paths = data
      .filter((o) => o.name && o.name !== ".emptyFolderPlaceholder")
      .map((o) => `${prefix}/${o.name}`);

    if (paths.length > 0) {
      const { error: removeErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (removeErr) {
        throw new Error(`Storage remove failed: ${removeErr.message}`);
      }
    }

    if (data.length < pageSize) break;
    page += 1;
  }
}
