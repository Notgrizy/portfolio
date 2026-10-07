#!/usr/bin/env node
/**
 * scan-thumbnails
 * ---------------
 * Reads every image inside ./thumbnails, ignores the logo, and writes
 * ./thumbnails/thumbnails.js — a plain global array that index.html loads
 * with a normal <script> tag (works over file:// too, unlike fetch()).
 *
 * Existing titles are preserved, so you can rename a project title in the
 * generated file and re-run the scan without losing it.
 *
 * NOTE: this script lists thumbnails, it does not process them. The image
 * files themselves are never read, decoded, resized or rewritten — only their
 * filenames are. The "© <year> Notgrizy" watermark on each thumbnail is drawn
 * by CSS (assets/styles.css) and gets its year from assets/main.js, so it is
 * never stamped into your original artwork.
 *
 *   node tools/scan-thumbnails.mjs
 *   npm run scan
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THUMB_DIR = path.join(ROOT, 'thumbnails');
const OUT_FILE = path.join(THUMB_DIR, 'thumbnails.js');
const HTML_FILE = path.join(ROOT, 'index.html');

const LOGO = 'd4viox.png'; // never treated as a portfolio piece
const EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif']);
const DEFAULT_TOOL = 'Photoshop';

const dim = (s) => `\u001b[2m${s}\u001b[0m`;
const cyan = (s) => `\u001b[36m${s}\u001b[0m`;
const green = (s) => `\u001b[32m${s}\u001b[0m`;
const yellow = (s) => `\u001b[33m${s}\u001b[0m`;

/** Pull { src: title } pairs out of a previously generated file. */
async function readExistingTitles() {
  const map = new Map();
  if (!existsSync(OUT_FILE)) return map;
  try {
    const text = await readFile(OUT_FILE, 'utf8');
    const re = /src:\s*"([^"]+)"\s*,\s*title:\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(text)) !== null) map.set(m[1], m[2]);
  } catch {
    /* unreadable / malformed — fall through and regenerate from filenames */
  }
  return map;
}

const baseName = (p) => path.basename(p).replace(/\.[a-z0-9]+$/i, '');
function titleFromFilename(file) {
  return path.basename(file)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Untitled';
}

/** Files already referenced directly in index.html. */
async function readHtmlSources() {
  const list = [];
  if (!existsSync(HTML_FILE)) return list;
  try {
    const html = await readFile(HTML_FILE, 'utf8');
    const re = /(?:src|data-src)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (/^thumbnails\//i.test(m[1]) && EXTS.has(path.extname(m[1]).toLowerCase())) {
        list.push(m[1].replace(/^\.\//, ''));
      }
    }
  } catch {
    /* ignore */
  }
  return list;
}

async function main() {
  if (!existsSync(THUMB_DIR)) {
    console.error(red('✖') + ` Missing folder: ${path.relative(ROOT, THUMB_DIR)}`);
    process.exitCode = 1;
    return;
  }

  const entries = await readdir(THUMB_DIR, { withFileTypes: true });
  const images = entries
    .filter((e) => e.isFile() && EXTS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .filter((n) => n.toLowerCase() !== LOGO)
    .sort((a, b) => baseName(a).localeCompare(baseName(b), undefined, { numeric: true, sensitivity: 'base' }));

  const titles = await readExistingTitles();
  const htmlSources = new Set(await readHtmlSources());

  const rel = path.relative(ROOT, OUT_FILE).split(path.sep).join('/');
  const lines = images.map((name) => {
    // encodeURIComponent per filename: spaces, # and ? would otherwise break the URL
    // (encodeURI leaves # and ? alone, and both are URL delimiters)
    const src = `thumbnails/${encodeURIComponent(name)}`;
    const title = titles.get(src) ?? titleFromFilename(name);
    return `  { src: "${src}", title: "${title.replace(/"/g, '\\"')}", tool: "${DEFAULT_TOOL}" },`;
  });

  const output =
`/* AUTO-GENERATED - do not add or remove entries by hand.
 * Source: /thumbnails   |   Regenerate: npm run scan
 * You may edit the "title" values; they are preserved on the next scan. */
window.THUMBNAILS = [${lines.length ? "\n" + lines.join("\n") + "\n" : ""}];
`;

  await writeFile(OUT_FILE, output, 'utf8');

  console.log('');
  console.log(cyan('  Notgrizy · thumbnail scan'));
  console.log(dim('  ' + '─'.repeat(46)));
  console.log(`  Folder   ${dim(path.relative(ROOT, THUMB_DIR) + '/')}`);
  console.log(`  Written  ${dim(rel)}`);
  console.log(`  Pieces   ${images.length === 0 ? dim('0') : green(String(images.length))}`);

  if (images.length === 0) {
    console.log('');
    console.log(yellow('  ! No thumbnails found.'));
    console.log(dim('    Drop .png / .jpg files into thumbnails/ and run this again.'));
    console.log(dim('    (The logo, ' + LOGO + ', is always ignored.)'));
  } else {
    console.log('');
    images.forEach((name) => console.log('    ' + green('✓') + ' ' + name));
  }

  const onDisk = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));
  const brokenRefs = [...htmlSources].filter((s) => !onDisk.has(path.basename(s)));
  if (brokenRefs.length) {
    console.log('');
    console.log(yellow(`  ! ${brokenRefs.length} image path(s) in index.html have no matching file:`));
    brokenRefs.forEach((s) => console.log(dim('    ' + s)));
  }

  console.log('');
}

function red(s) { return `\u001b[31m${s}\u001b[0m`; }

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});