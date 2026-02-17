import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaPool: Pool | undefined;
}

function makePrisma() {
  const pool =
    globalThis.prismaPool ??
    new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // dev/corp network; we’ll harden later
    });

  const adapter = new PrismaPg(pool);

  const client =
    globalThis.prisma ??
    new PrismaClient({
      adapter,
      // log: ["warn", "error"], // optional
    });

  if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = client;
    globalThis.prismaPool = pool;
  }

  return client;
}

export const prisma = makePrisma();
