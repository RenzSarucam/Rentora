import { uuid } from "@/lib/validation";

type Bucket = {
  list: (path: string, options: { limit: number; offset: number }) => Promise<{
    data: { name: string; id: string | null }[] | null; error: unknown;
  }>;
  remove: (paths: string[]) => Promise<{ error: unknown }>;
};
type Storage = { from: (bucket: string) => Bucket };

/** Only called after the RPC has removed membership and orphaned these uploads. */
export async function cleanupBoarderUploads(storage: Storage, organizationId: string, memberId: string): Promise<boolean> {
  if (!uuid.safeParse(organizationId).success || !uuid.safeParse(memberId).success) return false;
  const root = `${organizationId}/${memberId}`;
  // Bound each request; the persisted job lets another attempt continue safely.
  let requests = 100;
  const clear = async (bucket: Bucket, folder: string, depth: number): Promise<boolean> => {
    if (depth > 10 || (folder !== root && !folder.startsWith(`${root}/`))) return false;
    while (requests-- > 0) {
      const { data, error } = await bucket.list(folder, { limit: 100, offset: 0 });
      if (error || !data) return false;
      if (!data.length) return true;
      const paths: string[] = [];
      for (const item of data) {
        if (!item.name || item.name === "." || item.name === ".." || /[\\/]/.test(item.name)) return false;
        const path = `${folder}/${item.name}`;
        if (item.id === null) {
          if (!(await clear(bucket, path, depth + 1))) return false;
        } else paths.push(path);
      }
      if (paths.length) {
        if (requests-- <= 0) return false;
        if ((await bucket.remove(paths)).error) return false;
      }
    }
    return false;
  };
  try {
    for (const name of ["payment-proofs", "maintenance-photos"]) {
      if (!(await clear(storage.from(name), root, 0))) return false;
    }
    return true;
  } catch {
    return false;
  }
}
