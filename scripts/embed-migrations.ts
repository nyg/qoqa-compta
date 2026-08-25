import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

type JournalEntry = { idx: number; when: number; tag: string };
type Journal = { entries: JournalEntry[] };
type Dialect = { name: string; dir: string; exportName: string };

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const outputPath = path.join(repoRoot, "src", "server", "migrations.generated.ts");
const relativeOutputPath = path.relative(repoRoot, outputPath);

const dialects: Dialect[] = [
  { name: "sqlite", dir: "drizzle/sqlite", exportName: "sqliteMigrations" },
  { name: "pg", dir: "drizzle/pg", exportName: "pgMigrations" },
];

function readJournal(dir: string): JournalEntry[] {
  const journalPath = path.join(repoRoot, dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as Journal;
  return [...journal.entries].sort((a, b) => a.idx - b.idx);
}

function identifierFor(dialect: string, tag: string): string {
  const camel = tag.replace(/_(.)/g, (_, char: string) => char.toUpperCase());
  return `${dialect}_${camel}`;
}

function toTemplateLiteral(sql: string): string {
  const escaped = sql
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
  return `\`${escaped}\``;
}

function render(): string {
  const constants: string[] = [];
  const blocks: string[] = [];

  for (const dialect of dialects) {
    const rows: string[] = [];

    for (const entry of readJournal(dialect.dir)) {
      const identifier = identifierFor(dialect.name, entry.tag);
      const sqlPath = path.join(repoRoot, dialect.dir, `${entry.tag}.sql`);
      if (!existsSync(sqlPath)) {
        throw new Error(
          `${dialect.dir}/meta/_journal.json lists ${entry.tag}, but ${entry.tag}.sql is missing`
        );
      }
      const sql = readFileSync(sqlPath, "utf-8");
      constants.push(`const ${identifier} = ${toTemplateLiteral(sql)};`);
      rows.push(
        `  { tag: ${JSON.stringify(entry.tag)}, when: ${entry.when}, sql: ${identifier} },`
      );
    }

    blocks.push(
      `export const ${dialect.exportName}: EmbeddedMigration[] = [\n${rows.join("\n")}\n];`
    );
  }

  return [
    "export type EmbeddedMigration = {",
    "  tag: string;",
    "  when: number;",
    "  sql: string;",
    "};",
    "",
    constants.join("\n\n"),
    "",
    blocks.join("\n\n"),
    "",
  ].join("\n");
}

const expected = render();

if (process.argv.includes("--check")) {
  const actual = existsSync(outputPath) ? readFileSync(outputPath, "utf-8") : "";
  if (actual !== expected) {
    console.error(
      `embed-migrations: ${relativeOutputPath} is stale — run \`bun run db:embed\` and commit the result.`
    );
    process.exit(1);
  }
  console.log(`embed-migrations: ${relativeOutputPath} is up to date`);
} else {
  writeFileSync(outputPath, expected);
  console.log(`embed-migrations: wrote ${relativeOutputPath}`);
  for (const dialect of dialects) {
    console.log(`  ${dialect.name}: ${readJournal(dialect.dir).length} migration(s)`);
  }
}
