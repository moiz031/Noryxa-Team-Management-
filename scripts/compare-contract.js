// scripts/compare-contract.js
// Simple comparison script that reads the extracted DB schema and reports basic mismatches
// against a very naive representation of the DAL (list of tables used in src/lib/db/*.ts)
import { promises as fs } from 'fs';
import path from 'path';

const schemaPath = path.resolve(process.cwd(), 'scripts', 'contract-schema.json');
const dbDir = path.resolve(process.cwd(), 'src', 'lib', 'db');
const reportPath = path.resolve(process.cwd(), 'docs', 'api-contract-audit.md');

async function getDbTables() {
  const files = await fs.readdir(dbDir);
  const tables = new Set();
  const tableRegex = /from\s*\(\s*['"]([^'\"]+)['"]\s*\)/gi;
  for (const file of files) {
    if (!file.endsWith('.ts')) continue;
    const content = await fs.readFile(path.join(dbDir, file), 'utf-8');
    let match;
    while ((match = tableRegex.exec(content)) !== null) {
      tables.add(match[1]);
    }
  }
  return Array.from(tables);
}

async function generateReport() {
  const schemaExists = await fs.stat(schemaPath).then(() => true).catch(() => false);
  if (!schemaExists) {
    console.error('Schema file not found. Run audit-contract.mjs first.');
    process.exit(1);
  }
  const schemaContent = await fs.readFile(schemaPath, 'utf-8');
  const schema = JSON.parse(schemaContent);
  const dbTables = await getDbTables();

  const missingInDal = Object.keys(schema).filter(t => !dbTables.includes(t));
  const extraInDal = dbTables.filter(t => !(t in schema));

  let report = '# API / Database Contract Audit Report\n\n';
  report += '## Table Coverage\n\n';
  report += '| Table | Present in DB Schema | Used in DAL |\n';
  report += '|-------|----------------------|-------------|\n';
  const allTables = new Set([...Object.keys(schema), ...dbTables]);
  for (const table of allTables) {
    const inSchema = table in schema ? '✅' : '❌';
    const inDal = dbTables.includes(table) ? '✅' : '❌';
    report += `| ${table} | ${inSchema} | ${inDal} |\n`;
  }
  report += '\n';
  if (missingInDal.length) {
    report += '### Tables missing in DAL (present in DB)\n';
    report += missingInDal.map(t => `- ${t}`).join('\n') + '\n\n';
  }
  if (extraInDal.length) {
    report += '### Tables present in DAL but not found in DB schema\n';
    report += extraInDal.map(t => `- ${t}`).join('\n') + '\n\n';
  }
  if (!missingInDal.length && !extraInDal.length) {
    report += 'No mismatches detected between DB schema and DAL table usage.\n';
  }

  await fs.writeFile(reportPath, report, 'utf-8');
  console.log(`Audit report written to ${reportPath}`);
}

generateReport().catch(err => {
  console.error('Comparison failed:', err);
  process.exit(1);
});
