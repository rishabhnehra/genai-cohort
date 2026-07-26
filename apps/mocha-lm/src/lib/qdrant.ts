import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "./env";

declare global {
  var __mochaLmQdrant: QdrantClient | undefined;
}

export function getQdrant(): QdrantClient {
  if (!globalThis.__mochaLmQdrant) {
    globalThis.__mochaLmQdrant = new QdrantClient({
      url: env.QDRANT_URL,
      checkCompatibility: false,
    });
  }

  return globalThis.__mochaLmQdrant;
}

/** Back-compat singleton used by retrieval and indexing. */
export const qdrant = new Proxy({} as QdrantClient, {
  get(_target, prop, receiver) {
    const client = getQdrant();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Ensures the notebook chunks collection exists with the configured
 * embedding dimensions. Safe to call repeatedly (e.g. on worker boot).
 */
export async function ensureQdrantCollection() {
  const client = getQdrant();
  const exists = await client.collectionExists(env.QDRANT_COLLECTION);

  if (!exists.exists) {
    await client.createCollection(env.QDRANT_COLLECTION, {
      vectors: {
        size: env.EMBEDDING_DIMENSIONS,
        distance: "Cosine",
      },
    });
  }
}
