import type { Config } from "drizzle-kit"
import { readSettings } from "./src/server/settings"

const settings = readSettings()
const dbUrl = process.env.DATABASE_URL ?? settings.databaseUrl ?? ""

export default {
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dialect: dbUrl.startsWith("postgresql") || dbUrl.startsWith("postgres") ? "postgresql" : "sqlite",
  dbCredentials: dbUrl.startsWith("postgresql") || dbUrl.startsWith("postgres")
    ? { url: dbUrl }
    : { url: dbUrl || "file:./qoqa.db" },
} satisfies Config
