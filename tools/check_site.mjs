#!/usr/bin/env node
// Headless smoke test: loads the site in Chromium, clicks through the main flows,
// reports console/page errors and saves screenshots.
//
// Needs Playwright (npm i playwright && npx playwright install chromium) and a local server:
//   python3 -m http.server 8765 &
//   node tools/check_site.mjs [baseUrl=http://localhost:8765/index.html] [outDir=/tmp/modubox-shots]
// WSL without sudo: if Chromium is missing libnss3/libnspr4/libasound2t64, `apt-get download` them,
// `dpkg-deb -x` into a folder and point LD_LIBRARY_PATH at its usr/lib/x86_64-linux-gnu.
import { chromium } from 'playwright';
import fs from 'node:fs';

const U = process.argv[2] || 'http://localhost:8765/index.html';
const OUT = process.argv[3] || '/tmp/modubox-shots';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (/Alpine|Error/.test(m.text()) && !/WebGL|GPU stall|favicon/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });

await p.goto(U); await p.waitForTimeout(2000);
const files = await p.locator('text=/\\d+ files/').first().textContent();
if (/^0 files/.test(files.trim())) errs.push('Find a box shows 0 files');
await p.locator('button:has-text("4H")').first().click();
await p.locator('button.cell:not([disabled])').nth(9).click(); await p.waitForTimeout(500); await shot('1-find');
await p.locator('header button[title^="Theme"]').click(); await p.locator('header button[title^="Theme"]').click();
await p.getByRole('button', { name: 'Cut-away' }).click(); await shot('2-dark');
await p.getByRole('button', { name: 'Search', exact: true }).first().click();
await p.locator('input[type=search]').fill('stack 2x3 4h'); await p.waitForTimeout(400); await shot('3-search');
await p.getByRole('button', { name: 'Browse', exact: true }).first().click(); await p.waitForTimeout(300); await shot('4-browse');
await p.goto(U + '#f=' + encodeURIComponent('Case cart (for v1)/ModuBOX case cart.pdf')); await p.reload(); await p.waitForTimeout(2000); await shot('5-deeplink');

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO ERRORS', '\nScreenshots in', OUT);
await b.close();
process.exit(errs.length ? 1 : 0);
