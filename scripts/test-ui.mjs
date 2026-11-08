// End-to-end UI check: import a drawn sketch image, resize, flip, screenshot. Usage: node scripts/test-ui.mjs image.png outdir
import puppeteer from 'puppeteer-core';
const [image, outDir] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/run/current-system/sw/bin/google-chrome-stable', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 950 });
const logs = [];
page.on('console', (m) => m.type() === 'error' && logs.push('console: ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:5178/', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle0' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(1500);
const input = await page.$('#image-input');
await input.uploadFile(image);
await wait(800);
await page.click('#image-dialog button[value=ok]');
await wait(3000);
await page.screenshot({ path: `${outDir}/ui-image.png` });
// opacity 0 -> see generated map
await page.evaluate(() => { const el = document.querySelector('#bg-opacity'); el.value = 0; el.dispatchEvent(new Event('input')); });
await wait(500);
await page.screenshot({ path: `${outDir}/ui-image-map.png` });
// resize + flip + undo
await page.evaluate(() => document.querySelector('[data-action=resize]').click());
await page.evaluate(() => { const f = document.querySelector('#resize-dialog form'); f.w.value = 260; });
await page.click('#resize-dialog button[value=ok]');
await wait(2500);
await page.evaluate(() => document.querySelector('[data-action=flip-x]').click());
await wait(800);
await page.screenshot({ path: `${outDir}/ui-resized.png` });
const size = await page.$eval('#map-size', (e) => e.textContent);
console.log('size after resize:', size);
console.log(logs.join('\n') || 'no errors');
await browser.close();
