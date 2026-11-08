// Screenshot the editor with headless Chrome. Usage: node scripts/shot.mjs out.png [script.js-to-eval-after-load]
import puppeteer from 'puppeteer-core';
import fs from 'fs';
const [out, evalFile] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/run/current-system/sw/bin/google-chrome-stable', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 900 });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:5178/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));
if (evalFile) { await page.evaluate(fs.readFileSync(evalFile, 'utf8')); await new Promise((r) => setTimeout(r, 2500)); }
await page.screenshot({ path: out });
console.log(logs.join('\n') || 'no console output');
await browser.close();
