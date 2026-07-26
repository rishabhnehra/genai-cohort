import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type StorageBucket = "uploads" | "extracted" | "web-snapshots";

const DATA_ROOT = path.join(process.cwd(), ".data");

function resolveKey(bucket: StorageBucket, key: string) {
  const safeKey = key.replace(/\.\./g, "");
  return path.join(DATA_ROOT, bucket, safeKey);
}

/**
 * Minimal local-disk storage abstraction for source files (Phase 1).
 * A future phase can swap this for S3/R2 without changing call sites.
 */
export const storage = {
  /**
   * Generates a collision-resistant storage key scoped to a user/notebook/
   * source, e.g. `{userId}/{notebookId}/{sourceId}/original.pdf`. The
   * returned key is *relative to the bucket* — do not include the bucket
   * name in it (that's the first argument to `write`/`read`/etc).
   */
  createKey(
    userId: string,
    notebookId: string,
    sourceId: string,
    filename: string,
  ) {
    return path.posix.join(userId, notebookId, sourceId, filename);
  },

  /** Generates a random, extension-preserving filename for ad-hoc keys. */
  randomFilename(originalFilename: string) {
    const ext = path.extname(originalFilename);
    return `${randomUUID()}${ext}`;
  },

  async write(bucket: StorageBucket, key: string, data: Buffer | string) {
    const filePath = resolveKey(bucket, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return key;
  },

  async read(bucket: StorageBucket, key: string) {
    return readFile(resolveKey(bucket, key));
  },

  async delete(bucket: StorageBucket, key: string) {
    await rm(resolveKey(bucket, key), { force: true });
  },

  async exists(bucket: StorageBucket, key: string) {
    try {
      await stat(resolveKey(bucket, key));
      return true;
    } catch {
      return false;
    }
  },

  resolvePath(bucket: StorageBucket, key: string) {
    return resolveKey(bucket, key);
  },
};
