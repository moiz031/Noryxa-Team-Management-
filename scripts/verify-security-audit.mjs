// scripts/verify-security-audit.mjs
/**
 * Simple security audit verification script.
 * It performs static checks:
 *   - Detects missing RLS policies for sensitive tables.
 *   - Scans source files for hard‑coded secret patterns.
 *   - Runs ESLint with security plugin (if installed).
 *   - Checks storage bucket configuration (public flag).
 *   - Ensures API routes contain auth/role guards.
 *
 * The script exits with code 0 if no FAIL/WARNING findings.
 * Otherwise it prints a JSON summary and exits with code 1.
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const projectRoot = path.resolve('.');

// Helper to push finding
const findings = [];
function addFinding(area, description, status) {
  findings.push({ area, description, status });
}

// 1. Check RLS policies existence for known sensitive tables
const sensitiveTables = [
  'activity_logs',
  'documents',
  'notifications',
  'project_members',
  'team_members',
  'clients',
];
const policiesDir = fs.existsSync(path.join(projectRoot, 'supabase', 'policies'))
  ? path.join(projectRoot, 'supabase', 'policies')
  : path.join(projectRoot, 'supabase', 'migrations');

if (fs.existsSync(policiesDir)) {
  const policyFiles = fs.readdirSync(policiesDir).filter(f => f.endsWith('.sql'));
  for (const table of sensitiveTables) {
    const hasPolicy = policyFiles.some(f => {
      const c = fs.readFileSync(path.join(policiesDir, f), 'utf8');
      return c.includes(table) && /POLICY|Row Level Security|enable row level security/i.test(c);
    });
    addFinding(
      'RLS Policy',
      `Policy for table ${table}`,
      hasPolicy ? 'PASS' : 'FAIL'
    );
  }
} else {
  addFinding('RLS Policy', 'Policies directory missing', 'FAIL');
}

// 2. Scan for hard‑coded secrets (simple regex for aws keys, jwt secrets, etc.)
const secretPatterns = [
  /AKIA[0-9A-Z]{16}/, // AWS Access Key ID
  /[A-Za-z0-9_-]{40,}/, // generic long token
];
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  for (const pat of secretPatterns) {
    if (pat.test(content)) {
      addFinding('Hard‑coded Secret', `${filePath}`, 'FAIL');
      break;
    }
  }
}
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!full.includes('node_modules') && !full.includes('.git') && !full.includes('.next') && !full.includes('.gemini')) walk(full);
    } else if (full.match(/\.(ts|tsx|js|jsx)$/)) {
      scanFile(full);
    }
  }
}
walk(projectRoot);

// 3. Run ESLint security plugin if available
try {
  const cmd = process.platform === 'win32' ? 'cmd /c npx eslint src --max-warnings=999' : 'npx eslint src --max-warnings=999';
  execSync(cmd, { stdio: 'pipe' });
  // If ESLint exits with non‑zero, it will throw; we capture via catch.
  addFinding('ESLint Security', 'No lint errors found', 'PASS');
} catch (e) {
  addFinding('ESLint Security', 'Lint errors detected', 'FAIL');
}

// 4. Verify storage bucket policies (look for src/lib/storage config)
const storageConfigPath = path.join(projectRoot, 'src', 'lib', 'storage');
if (fs.existsSync(storageConfigPath)) {
  // Very naive check: ensure any bucket creation sets public: false
  const files = fs.readdirSync(storageConfigPath).filter(f => f.endsWith('.ts'));
  let allPrivate = true;
  for (const f of files) {
    const content = fs.readFileSync(path.join(storageConfigPath, f), 'utf8');
    if (/public:\s*true/.test(content)) {
      allPrivate = false;
      addFinding('Storage Policy', `${f} sets public true`, 'FAIL');
    }
  }
  if (allPrivate) addFinding('Storage Policy', 'All buckets private', 'PASS');
} else {
  addFinding('Storage Policy', 'Storage config directory missing', 'WARNING');
}

// 5. Ensure API routes contain auth guards (search for requireAuth/requireAdmin/requireUser/requireEmployee)
const apiDir = path.join(projectRoot, 'src', 'app', 'api');
function checkApiGuard(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const hasGuard = /requireAuth|requireAdmin|requireUser|requireEmployee/.test(content);
  addFinding('API Auth Guard', filePath, hasGuard ? 'PASS' : 'FAIL');
}
if (fs.existsSync(apiDir)) {
  const apiFiles = [];
  function collect(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!full.includes('node_modules')) collect(full);
      } else if (full.endsWith('.ts')) {
        apiFiles.push(full);
      }
    }
  }
  collect(apiDir);
  apiFiles.forEach(checkApiGuard);
}

// Output summary JSON
console.log(JSON.stringify({ findings }, null, 2));

// Determine exit code
const hasFail = findings.some(f => f.status === 'FAIL' || f.status === 'WARNING');
process.exit(hasFail ? 1 : 0);
