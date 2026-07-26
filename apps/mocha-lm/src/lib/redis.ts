import { Redis } from "ioredis";
import { env } from "./env";

declare global {
  var __mochaLmRedis: Redis | undefined;
}

/**
 * Shared ioredis connection, reused across BullMQ queues/workers and hot
 * reloads in development to avoid exhausting Redis connections.
 * Uses lazyConnect so importing this module during Next.js build does not
 * immediately open a socket against a possibly-offline Redis.
 */
export function getRedis(): Redis {
  if (!globalThis.__mochaLmRedis) {
    globalThis.__mochaLmRedis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: true,
    });

    globalThis.__mochaLmRedis.on("error", (error) => {
      if (env.NODE_ENV === "development") {
        console.warn("[redis]", error.message);
      }
    });
  }

  return globalThis.__mochaLmRedis;
}

/** Back-compat singleton accessor used by BullMQ and health checks. */
export const redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    const client = getRedis();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
