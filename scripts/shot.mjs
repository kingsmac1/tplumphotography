// node scripts/shot.mjs <url> <out.png> [width] [clickSelector]
import { chromium } from 'playwright';
const [url, out, w = '1440', click] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
if (click) { for (const c of click.split('||')) { await p.locator(c).first().click(); await p.waitForTimeout(700); } }
await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true });
console.log('errors:', errors.slice(0, 8));
await b.close();
