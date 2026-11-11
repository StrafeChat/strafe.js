// Fails when Discord's nouns show up in code, comments or docs.
//
// StrafeChat uses Discord's interaction model with its own vocabulary (root AGENTS.md):
// Space (not guild), Room (not channel), Section (not category), PM (not DM).
// A line may opt out with the marker `terms-ok` (for example a discord.js comparison or a
// server wire field that predates the rule). Files whose path matches ALLOWED_FILES are skipped
// entirely (the "Coming from discord.js" guide must name both sides).
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const ROOTS = ['src', 'test', 'examples', 'docs', 'scripts', 'README.md', 'CHANGELOG.md'];
const EXTENSIONS = /\.(ts|mts|js|cjs|mjs|vue|css|md|json)$/;
const SKIP_DIRS = ['node_modules', 'dist', 'coverage', 'docs/.vitepress/cache', 'docs/.vitepress/dist', 'docs/public/api'];
const ALLOWED_FILES = [/coming-from-discord/i, /^scripts\/check-terms\.js$/];

// Server wire fields that carry the old word; the library maps them to our nouns.
const WIRE_TOKENS = [/\bbirthday_channel_id\b/g, /\bchannel_id\b/g];

const RULES = [
  { re: /guild/i, say: 'Space' },
  { re: /channel/i, say: 'Room' },
  { re: /categor(y|ies)/i, say: 'Section' },
  { re: /(\bDMs?\b|\bdms?\b|[a-z]DMs?(?![a-z])|\bDM(?=[A-Z]))/, say: 'PM' },
];

async function* walk(path) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOTDIR') {
      yield path;
      return;
    }
    if (error.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const full = join(path, entry.name);
    const rel = relative(root, full);
    if (SKIP_DIRS.some((dir) => rel === dir || rel.startsWith(`${dir}/`) || rel.split('/').includes('node_modules'))) {
      continue;
    }
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.test(entry.name)) yield full;
  }
}

let failures = 0;
for (const start of ROOTS) {
  for await (const file of walk(join(root, start))) {
    const rel = relative(root, file);
    if (ALLOWED_FILES.some((re) => re.test(rel))) continue;
    const lines = (await readFile(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      if (line.includes('terms-ok')) return;
      let text = line;
      for (const token of WIRE_TOKENS) text = text.replace(token, '');
      for (const rule of RULES) {
        const match = rule.re.exec(text);
        if (match) {
          failures++;
          console.error(`${rel}:${index + 1}: "${match[0]}" - say ${rule.say} (or mark the line terms-ok)`);
        }
      }
    });
  }
}

if (failures > 0) {
  console.error(`\n${failures} line(s) use Discord's nouns. See AGENTS.md "Terminology".`);
  process.exit(1);
}
console.log('terms ok');
