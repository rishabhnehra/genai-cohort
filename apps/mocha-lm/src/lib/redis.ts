import { Redis } from "ioredis";
import { env } from "./env";

declare global {
  var __mochaLmRedis: Redis | undefined;
}

/**
 * Creates a new ioredis connection suitable for BullMQ.
 * Queue and Worker must use separate connections (Workers use blocking commands).
 * Uses lazyConnect so importing this module during Next.js build does not
 * immediately open a socket against a possibly-offline Redis.
 */
export function createRedisConnection(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: true,
  });

  client.on("error", (error) => {
    console.warn("[redis]", error.message);
  });

  return client;
}

/**
 * Shared Redis connection for the producer Queue and health checks.
 * Reused across hot reloads in development to avoid exhausting connections.
 * Do not pass this to a BullMQ Worker — use {@link createRedisConnection} instead.
 */
export function getRedis(): Redis {
  if (!globalThis.__mochaLmRedis) {
    globalThis.__mochaLmRedis = createRedisConnection();
  }

  return globalThis.__mochaLmRedis;
}

/** Back-compat singleton accessor used by BullMQ queues and health checks. */
export const redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    const client = getRedis();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
