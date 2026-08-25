import type { Config } from "drizzle-kit"

const dbUrl = process.env.DATABASE_URL?.trim()

if (!dbUrl) {
  throw new Error(
    [
      "DATABASE_URL is not set.",
      "",
      "Drizzle Kit reads it to pick the dialect and the database to operate on. It is deliberately not read from the app's settings.json, so `bun run db:push` targets the same database on every machine and in CI instead of whatever the Settings modal last wrote.",
      "",
      "Point it at the app's SQLite database:",
      '  macOS    DATABASE_URL="file:$HOME/Library/Application Support/QoQa Compta/qoqa.db"',
      '  Windows  DATABASE_URL="file:$env:APPDATA\\QoQa Compta\\qoqa.db"',
      '  Linux    DATABASE_URL="file:$HOME/.local/share/qoqa-compta/qoqa.db"',
      "",
      "or at a postgresql:// connection string.",
    ].join("\n")
  )
}

const isPostgres = dbUrl.startsWith("postgresql") || dbUrl.startsWith("postgres")

export default {
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dialect: isPostgres ? "postgresql" : "sqlite",
  dbCredentials: { url: dbUrl },
} satisfies Config
