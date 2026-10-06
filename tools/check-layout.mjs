/**
 * Dev-only QA probe.
 *
 * Chrome on Windows refuses to create a window narrower than ~484 CSS px, so
 * narrow viewports are produced by rendering index.html inside an iframe of a
 * fixed pixel width (file access is enabled for the child frame).
 *
 * Reports, per width, whether the document scrolls horizontally and which
 * elements stick out past the viewport.
 *
 *   node tools/check-layout.mjs
 */
import { readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = path.join(ROOT, 'index.html');
const WRAP = path.join(ROOT, '__wrap.html');
const TARGET = path.join(ROOT, '__target.html');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));

const WIDTHS = [320, 360, 390, 414, 480, 600, 768, 1024, 1280, 1600];

if (!CHROME) {
  console.error('  ! No Chrome or Edge found - skipping layout check.\n');
  process.exit(0);
}

/** Runs inside the wrapper page, after the target iframe has loaded. */
const HARNESS = `
function report(w, doc) {
  var d = doc.documentElement;
  var vw = d.clientWidth;
  var offenders = [];
  var all = doc.querySelectorAll('body *');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (doc.defaultView.getComputedStyle(el).position === 'fixed') continue;
    if (r.right > vw + 1) offenders.push((el.className || el.tagName) + '@' + Math.round(r.right));
  }
  document.title = 'PROBE|' + w + '|' + vw + '|' + d.scrollWidth + '|' +
    offenders.slice(0, 3).join(' ~ ');
}
`;

const wrapper = (w, h) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#111}
  iframe{display:block;border:0;width:${w}px;height:${h}px}
</style></head><body>
<iframe id="f" src="__target.html"></iframe>
<script>${HARNESS}
document.getElementById('f').addEventListener('load', function () {
  var fr = this;
  var d = fr.contentDocument;
  if (!d || !d.documentElement) { document.title = 'PROBE|${w}|-|-|no-access'; return; }
  // let fonts + reveal observers settle
  setTimeout(function () { report(${w}, d); }, 400);
});
</script></body></html>`;

const fileUrl = (p) => `file:///${p.replace(/\\/g, '/')}`;

let failed = 0;
const rows = [];

try {
  const html = await readFile(HTML, 'utf8');
  await writeFile(TARGET, html, 'utf8');

  for (const css of WIDTHS) {
    await writeFile(WRAP, wrapper(css, 2200), 'utf8');

    const out = execFileSync(
      CHROME,
      [
        '--headless=new', '--disable-gpu', '--hide-scrollbars',
        '--allow-file-access-from-files',
        '--virtual-time-budget=9000',
        '--window-size=1700,2400',
        '--dump-dom',
        fileUrl(WRAP),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }
    );

    const m = out.match(/<title>PROBE\|(\d+)\|(-?\d+)\|(-?\d+)\|([^<]*)<\/title>/);
    if (!m) { rows.push([css, '?', '?', 'probe failed', true]); failed++; continue; }

    const [, requested, vw, scrollW, offenders] = m;
    const overflowing = Number(scrollW) > Number(vw) + 1;
    const mismatched = Number(requested) !== css;
    const bad = overflowing || mismatched;
    if (bad) failed++;
    rows.push([css, vw, scrollW, offenders, bad]);
  }

  console.log('');
  console.log('  Notgrizy · layout check');
  console.log('  ' + '-'.repeat(58));
  console.log('  viewport   scrollW   overflow   offenders');
  console.log('  ' + '-'.repeat(58));
  rows.forEach(([css, vw, scrollW, offenders]) => {
    const bad = Number(scrollW) > Number(vw) + 1 || Number(vw) === 0;
    console.log(
      `  ${(css + 'px').padEnd(11)} ${String(scrollW).padEnd(9)} ${(bad ? 'YES' : 'no').padEnd(10)} ${offenders}`
    );
  });
  console.log('  ' + '-'.repeat(58));
  console.log(failed === 0
    ? `  Result: no horizontal overflow at ${WIDTHS.join(' / ')} px.\n`
    : `  Result: ${failed} width(s) failed.\n`);
  process.exitCode = failed === 0 ? 0 : 1;
} finally {
  await rm(WRAP, { force: true });
  await rm(TARGET, { force: true });
}