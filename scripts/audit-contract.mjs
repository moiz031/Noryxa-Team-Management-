// scripts/audit-contract.mjs
// Simple audit script that extracts table schemas from Supabase migration files
import { promises as fs } from 'fs';
import path from 'path';

const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
const outputPath = path.resolve(process.cwd(), 'scripts', 'contract-schema.json');

async function parseMigrations() {
  const files = await fs.readdir(migrationsDir);
  const schema = {};
  const createTableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([^\s(]+)\s*\(([^;]+?)\);/gis;
  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const content = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
      const tableName = match[1].replace(/"/g, '');
      const columnsPart = match[2];
      const cols = columnsPart.split(',').map(c => c.trim()).filter(Boolean);
      const colDefs = cols.map(col => {
        const [name, ...rest] = col.split(/\s+/);
        return { name: name.replace(/"/g, ''), definition: rest.join(' ') };
      });
      schema[tableName] = colDefs;
    }
  }
  await fs.writeFile(outputPath, JSON.stringify(schema, null, 2), 'utf-8');
  console.log(`Schema extracted to ${outputPath}`);
}

parseMigrations().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
