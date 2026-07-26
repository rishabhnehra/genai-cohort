import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Always load apps/mocha-lm/.env regardless of the process cwd (pnpm filter,
// turbo, etc. may invoke Prisma from the monorepo root).
dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
