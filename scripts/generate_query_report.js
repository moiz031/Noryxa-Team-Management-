// scripts/generate_query_report.js
// Simple script to scan the codebase for Supabase `from` queries and output a markdown report.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const REPORT_PATH = path.resolve(__dirname, '..', 'audit', 'queries_report.md');

function getFiles() {
  return glob.sync('**/*.{ts,tsx}', { cwd: SRC_DIR, absolute: true, ignore: ['**/node_modules/**'] });
}

function extractQueries(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const results = [];
  const regex = /\b(?:supabase|db)\.from\s*\(\s*([`'\"])([^`'\"]+)\1\s*\)/g;
  lines.forEach((line, idx) => {
    let match;
    while ((match = regex.exec(line)) !== null) {
      results.push({ line: idx + 1, query: match[2] });
    }
  });
  return results;
}

function generateReport() {
  const files = getFiles();
  let report = '# Queries Report\n\nGenerated on ' + new Date().toISOString() + '\n\n';
  files.forEach((file) => {
    const rel = path.relative(SRC_DIR, file);
    const queries = extractQueries(file);
    if (queries.length) {
      report += `## ${rel}\n`;
      queries.forEach((q) => {
        report += `- Line ${q.line}: \`from('${q.query}')\`\n`;
      });
      report += '\n';
    }
  });
  if (!fs.existsSync(path.dirname(REPORT_PATH))) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  }
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log('Query report written to', REPORT_PATH);
}

generateReport();
