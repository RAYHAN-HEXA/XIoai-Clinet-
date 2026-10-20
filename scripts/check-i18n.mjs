#!/usr/bin/env node
/**
 * i18n coverage check — run from the repo root:  node scripts/check-i18n.mjs
 *
 * 1. en.json and zh.json must have byte-identical key structures.
 * 2. Every statically referenced translation key must exist in both files.
 *
 * Dynamic keys (t(someVariable)) cannot be checked statically; they are listed
 * as "dynamic" so the reviewer can eyeball them.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webSrc = path.join(root, 'apps/web/src');
const en = JSON.parse(readFileSync(path.join(webSrc, 'messages/en.json'), 'utf8'));
const zh = JSON.parse(readFileSync(path.join(webSrc, 'messages/zh.json'), 'utf8'));

function flatten(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.add(key);
  }
  return out;
}

const enKeys = flatten(en);
const zhKeys = flatten(zh);
const problems = [];

for (const k of enKeys) if (!zhKeys.has(k)) problems.push(`missing in zh.json: ${k}`);
for (const k of zhKeys) if (!enKeys.has(k)) problems.push(`missing in en.json: ${k}`);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) files.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(p);
  }
  return files;
}

const dynamic = [];
let checked = 0;

for (const file of walk(webSrc)) {
  const src = readFileSync(file, 'utf8');
  const nsMatches = [...src.matchAll(/(?:use|get)Translations(?:<[^>]*>)?\(\s*'([^']+)'/g)];
  const nsList = nsMatches.map((m) => m[1]).filter(Boolean);

  // t('key') calls — resolve against every namespace bound in this file
  for (const m of src.matchAll(/\bt\(\s*'([^']+)'/g)) {
    const key = m[1];
    if (key.includes('{')) continue;
    checked += 1;
    if (nsList.length === 0) {
      problems.push(`${path.relative(root, file)}: t('${key}') with no bound namespace`);
      continue;
    }
    const found = nsList.some((ns) => enKeys.has(`${ns}.${key}`));
    if (!found) problems.push(`${path.relative(root, file)}: missing key ${nsList.map((n) => `${n}.${key}`).join(' | ')}`);
  }

  // dynamic keys
  for (const m of src.matchAll(/\bt\(\s*([A-Za-z_][\w.]*)(?:\)|,)/g)) {
    dynamic.push(`${path.relative(root, file)}: ${m[1]}`);
  }
}

if (problems.length) {
  console.error(`i18n check FAILED (${problems.length} problems):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`i18n check OK — ${enKeys.size} keys × 2 locales, ${checked} static references verified.`);
if (dynamic.length) {
  console.log(`Dynamic keys to review manually (${dynamic.length}):`);
  for (const d of [...new Set(dynamic)]) console.log('  · ' + d);
}
