/**
 * Neon serverless PostgreSQL client.
 *
 * Uses the @neondatabase/serverless driver which works in Edge and serverless
 * environments (Vercel, Cloudflare Workers, etc.) without native binaries.
 */
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
      "Copy frontend/.env.example to frontend/.env.local and fill in the value."
  );
}

/** Pre-configured Neon SQL tag function — use as: sql`SELECT ...` */
export const sql = neon(process.env.DATABASE_URL);
