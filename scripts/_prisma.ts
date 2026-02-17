import path from "node:path";
import dotenv from "dotenv";

// Load env from project root (.env.local first, then .env)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Reuse the app Prisma client (already configured with pg Pool + SSL)
export { prisma } from "@/lib/prisma";
