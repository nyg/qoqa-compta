import { initDb } from "./db";
import { isSchemaReady, runMigrations } from "./migrate";
import { backfillOrderSubuniverses } from "./queries";

export async function prepareDatabase(): Promise<void> {
  try {
    await initDb();

    if (!(await isSchemaReady())) {
      console.log("○ No database yet — the first sync will create it");
      return;
    }

    await runMigrations();
    await backfillOrderSubuniverses();
    console.log("✓ Database ready");
  } catch (err) {
    console.error("✗ Database initialisation failed:", err);
  }
}
