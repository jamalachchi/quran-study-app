import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// quran_study.db is located in the parent folder of the 'web' project
const dbPath = path.resolve(process.cwd(), '../quran_study.db');

let db: any = null;

if (fs.existsSync(dbPath)) {
  try {
    db = new Database(dbPath, { readonly: false });
    console.log("Database initialized successfully at:", dbPath);
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
} else {
  console.warn("Database file not found at:", dbPath, ". Running in stateless cloud mode.");
}

export default db;
