import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DB = DatabaseSync;

const MIGRATIONS = join(import.meta.dirname, 'migrations');

/** Open the database and run new migrations. Use ':memory:' for tests. */
export function openDb(file: string): DB {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
  migrate(db);
  return db;
}

function migrate(db: DB) {
  const current = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  const files = readdirSync(MIGRATIONS).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
  for (const f of files) {
    const version = parseInt(f, 10);
    if (version <= current) continue;
    db.exec('BEGIN');
    try {
      db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}
