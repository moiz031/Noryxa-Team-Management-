// scripts/verify-data-minimization.mjs
/**
 * Data‑minimization audit script.
 * Scans Supabase migration SQL files to extract table schemas, then checks for:
 *   - Password/auth‑related columns in non‑auth tables.
 *   - Presence of sensitive PII columns (ssn, dob, address, phone) that are not required.
 *   - Generates a JSON summary of findings (PASS/FAIL/WARNING) and prints a markdown report.
 */
import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve('.');
const migrationsDir = path.join(projectRoot, 'supabase', 'migrations');

const findings = [];
function addFinding(area, description, status) {
  findings.push({ area, description, status });
}

// 1. Parse migration files for CREATE TABLE statements
if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const tableColumns = {};
  const createTableRegex = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([^\s(]+)\s*\(([^;]+)\);/gi;
  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    let match;
    while ((match = createTableRegex.exec(content)) !== null) {
      const table = match[1];
      const colsDef = match[2];
      const cols = colsDef.split(',').map(c => c.trim().split(' ')[0]);
      tableColumns[table] = cols;
    }
  }
  // Check each table for disallowed password columns
  const passwordColPatterns = [/password/i, /hash/i, /token/i];
  for (const [table, cols] of Object.entries(tableColumns)) {
    // Skip Supabase auth tables (auth.users)
    if (table.startsWith('auth.')) continue;
    const badCols = cols.filter(col => passwordColPatterns.some(p => p.test(col)));
    if (badCols.length) {
      addFinding('Password Column', `Table ${table} contains password‑like columns: ${badCols.join(', ')}`, 'FAIL');
    } else {
      addFinding('Password Column', `Table ${table} has no password‑like columns`, 'PASS');
    }
    // Sensitive PII columns check (example list)
    const piiCols = ['ssn', 'social_security_number', 'date_of_birth', 'dob', 'address', 'phone', 'email'];
    const presentPii = cols.filter(col => piiCols.includes(col));
    if (presentPii.length) {
      addFinding('PII Column', `Table ${table} stores PII columns: ${presentPii.join(', ')}`, 'WARNING');
    }
  }
} else {
  addFinding('Migration Scan', 'Migrations directory not found', 'FAIL');
}

// 2. Scan source code for select * on profiles or employee tables
function scanSourceForSelectStar(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.includes('node_modules') || full.includes('.git')) continue;
      scanSourceForSelectStar(full);
    } else if (full.match(/\.(ts|tsx|js|jsx)$/)) {
      const content = fs.readFileSync(full, 'utf8');
      const selectStarRegex = /select\s*\*\s*from\s+['"]?(profiles|employees?|employee_documents)['"]?/i;
      if (selectStarRegex.test(content)) {
        addFinding('Select *', `File ${full} uses SELECT * on a user table`, 'FAIL');
      }
    }
  }
}
scanSourceForSelectStar(projectRoot);

// Output JSON summary
console.log(JSON.stringify({ findings }, null, 2));

const hasFail = findings.some(f => f.status === 'FAIL' || f.status === 'WARNING');
process.exit(hasFail ? 1 : 0);
