import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const repoRoot = path.resolve(process.cwd());

const bannedWords = ['local' + 'Storage', 'session' + 'Storage'];
const banned = bannedWords.map((word) => new RegExp(`\\b${word}\\b`));

const ignoredDirNames = new Set([
  '.git',
  '.next',
  '.turbo',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  'postgres-data',
  'logs',
  'uploads',
]);

const allowedExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.txt',
]);

function shouldIgnoreDir(direntName) {
  return ignoredDirNames.has(direntName);
}

function shouldScanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (allowedExtensions.has(ext)) return true;

  // Cover common no-extension config files.
  const base = path.basename(filePath);
  return base === 'Dockerfile' || base === '.env' || base.startsWith('.env.');
}

async function* walk(currentDir) {
  const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) continue;
      yield* walk(fullPath);
      continue;
    }

    if (entry.isFile() && shouldScanFile(fullPath)) {
      yield fullPath;
    }
  }
}

async function scanFile(filePath) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  const hits = [];

  for await (const line of rl) {
    lineNumber += 1;
    for (const regex of banned) {
      if (regex.test(line)) {
        hits.push({ lineNumber, line: line.trimEnd() });
      }
    }
  }

  return hits;
}

async function main() {
  const allHits = [];

  for await (const filePath of walk(repoRoot)) {
    const hits = await scanFile(filePath);
    for (const hit of hits) {
      allHits.push({ filePath: path.relative(repoRoot, filePath), ...hit });
    }
  }

  if (allHits.length > 0) {
    console.error('Found forbidden browser storage references:');
    for (const hit of allHits) {
      console.error(`- ${hit.filePath}:${hit.lineNumber}: ${hit.line}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('OK: no browser storage references found in scanned files.');
}

await main();
