import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import { qdrant } from "@/lib/qdrant";

export const runtime = "nodejs";

type CheckStatus = "ok" | "error";

async function checkDatabase(): Promise<CheckStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<CheckStatus> {
  try {
    await redis.ping();
    return "ok";
  } catch {
    return "error";
  }
}

async function checkQdrant(): Promise<CheckStatus> {
  try {
    await qdrant.getCollections();
    return "ok";
  } catch {
    return "error";
  }
}

/** Liveness/readiness endpoint checking the app's core dependencies. */
export async function GET() {
  const [database, redisCheck, qdrantCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQdrant(),
  ]);

  const checks = { database, redis: redisCheck, qdrant: qdrantCheck };
  const healthy = Object.values(checks).every((status) => status === "ok");

  return NextResponse.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503 },
  );
}
