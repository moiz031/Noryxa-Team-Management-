// scripts/extract-api.mjs
// Simple script that walks the `src/pages/api` (or `src/app/api`) directory
// and records each API route file path in JSON.
import { promises as fs } from 'fs';
import path from 'path';

const apiDirs = [
  path.resolve(process.cwd(), 'src', 'pages', 'api'),
  path.resolve(process.cwd(), 'src', 'app', 'api')
];
const outPath = path.resolve(process.cwd(), 'scripts', 'api-routes.json');

async function collectRoutes() {
  const routes: string[] = [];
  for (const dir of apiDirs) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.ts')) {
          // Derive route path by stripping extension and leading directories
          const rel = path.relative(path.resolve(process.cwd(), 'src'), path.join(dir, entry.name));
          const route = '/' + rel.replace(/\\/g, '/').replace(/\.ts$/, '');
          routes.push(route);
        }
      }
    } catch (e) {
      // ignore if directory does not exist
    }
  }
  await fs.writeFile(outPath, JSON.stringify(routes, null, 2), 'utf-8');
  console.log(`Extracted ${routes.length} API routes to ${outPath}`);
}

collectRoutes().catch(err => {
  console.error('API extraction failed:', err);
  process.exit(1);
});
