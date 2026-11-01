// Runs an example with tsx: `npm run example -- <name>` (hello, counter, form, list, dashboard, shared-code).
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const examplesDir = fileURLToPath(new URL('../examples/', import.meta.url));
const [name, ...args] = process.argv.slice(2);
const available = readdirSync(examplesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

if (!name || !available.includes(name)) {
  console.error(`Usage: npm run example -- <name> [args]\nExamples: ${available.join(', ')}`);
  process.exit(1);
}

const entry = new URL(`../examples/${name}/index.tsx`, import.meta.url);
if (!existsSync(entry)) {
  console.error(`Missing ${fileURLToPath(entry)}`);
  process.exit(1);
}

const tsx = fileURLToPath(import.meta.resolve('tsx/cli'));
const child = spawn(process.execPath, [tsx, fileURLToPath(entry), ...args], { stdio: 'inherit' });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
