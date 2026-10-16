/* Static import/export check — no browser needed.
 *
 *   node tools/check-imports.mjs
 *
 * Walks every ES module under js/ and verifies that each named import actually
 * exists in the target module's exports, and that every `data-action` used in
 * index.html has a handler in js/events.js. Catches the refactor drift that a
 * running app only shows as a console error.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.name.endsWith('.js')) files.push(path);
  }
  return files;
}

const files = await walk(join(ROOT, 'js'));
const sources = new Map();
for (const file of files) sources.set(file, await readFile(file, 'utf8'));

/* Named exports of a module (declaration + re-export forms). */
function exportsOf(source) {
  const names = new Set();
  const push = list => list.split(',').forEach(part => {
    const name = part.trim().split(/\s+as\s+/).pop().trim();
    if (name) names.add(name);
  });
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z0-9_$]+)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) names.add(match[1]);
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/g)) push(match[1]);
  return names;
}

const exportCache = new Map();
const exportsFor = file => {
  if (!exportCache.has(file)) exportCache.set(file, exportsOf(sources.get(file) || ''));
  return exportCache.get(file);
};

const problems = [];

for (const [file, source] of sources) {
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file), match[2]);
    if (!sources.has(target)) {
      problems.push(`${file.replace(ROOT, '.')}: cannot resolve '${match[2]}'`);
      continue;
    }
    const available = exportsFor(target);
    match[1].split(',').forEach(part => {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !available.has(name)) {
        problems.push(`${file.replace(ROOT, '.')}: '${name}' is not exported by ${match[2]}`);
      }
    });
  }
}

/* Every action in the markup must be wired in the declarative action table. */
const html = await readFile(join(ROOT, 'index.html'), 'utf8');
const events = sources.get(join(ROOT, 'js', 'events.js')) || '';
const wired = new Set([...events.matchAll(/'([a-z][a-z0-9-]+)':/g)].map(match => match[1]));
[...events.matchAll(/'([a-z][a-z0-9-]+)'/g)].forEach(match => wired.add(match[1]));
const actions = [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]))];
const unwired = actions.filter(action => !wired.has(action) && !events.includes(`'${action}'`));

for (const action of unwired) problems.push(`index.html: data-action="${action}" has no handler in js/events.js`);

/* data-i18n keys must exist in the dictionary. */
const i18n = sources.get(join(ROOT, 'js', 'i18n.js')) || '';
const keys = [...new Set([...html.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)].map(match => match[1]))];
const missingKeys = keys.filter(key => !i18n.includes(`'${key}'`) && !i18n.includes(`"${key}"`));

for (const key of missingKeys) problems.push(`index.html: data-i18n="${key}" is missing from js/i18n.js`);

/* Element ids the UI modules read must exist in the markup (and vice versa is not required). */
const ids = [...new Set([...html.matchAll(/id="([^"]+)"/g)].map(match => match[1]))];
const idSet = new Set(ids);
const referenced = new Set();
for (const [file, source] of sources) {
  const base = file.replace(ROOT, '.');
  if (base.includes('admin.js') || base.includes('fares.js')) {
    // admin + fare panels build rows dynamically; their containers are checked normally
  }
  for (const match of source.matchAll(/getElementById\('([^']+)'\)/g)) referenced.add(`${base}\u0000${match[1]}`);
  for (const match of source.matchAll(/count\('([^']+)'\)/g)) referenced.add(`${base}\u0000${match[1]}`);
}

for (const entry of referenced) {
  const [file, id] = entry.split('\u0000');
  if (!idSet.has(id)) problems.push(`${file}: reads #${id}, which index.html does not define`);
}

if (problems.length) {
  console.log(`✗ ${problems.length} problem(s):`);
  problems.forEach(problem => console.log(`  · ${problem}`));
  process.exit(1);
}

console.log(`✓ imports, actions, i18n keys and ${referenced.size} element lookups all resolve (${sources.size} modules)`);
