// Screenshot the rebuilt pages and place them next to the WordPress originals.
// Usage: node scripts/compare.mjs [base=http://localhost:3000] [pages=home,about] [widths=1440,390]
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
const base = process.argv[2] || 'http://localhost:3000';
const PAGES = { home: '/', portfolio: '/portfolio/', about: '/about/', contact: '/contact/', 'the-tplum-signature': '/the-tplum-signature/', faq: '/faq/', 'coming-soon': '/coming-soon/' };
const pages = (process.argv[3] || Object.keys(PAGES).join(',')).split(',');
const widths = (process.argv[4] || '1440,390').split(',').map(Number);
const OUT = process.env.OUT || 'test-results/compare';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 }, deviceScaleFactor: w > 500 ? 1 : 2, reducedMotion: 'reduce' });
  for (const key of pages) {
    const page = await ctx.newPage();
    await page.goto(base + PAGES[key], { waitUntil: 'networkidle', timeout: 90000 });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 600)); });
    const mine = `${OUT}/${key}-${w}-new.png`;
    await page.screenshot({ path: mine, fullPage: true });
    const orig = `my-site-reference/screenshots/${key}-${w}.png`;
    const a = sharp(orig), b = sharp(mine);
    const [ma, mb] = await Promise.all([a.metadata(), b.metadata()]);
    const scale = 700 / Math.max(ma.width, mb.width);
    const ha = Math.round(ma.height * (700 / ma.width)), hb = Math.round(mb.height * (700 / mb.width));
    const H = Math.max(ha, hb);
    const left = await sharp(orig).resize(700).toBuffer(), right = await sharp(mine).resize(700).toBuffer();
    await sharp({ create: { width: 1420, height: H, channels: 3, background: '#ff00ff' } }).composite([{ input: left, left: 0, top: 0 }, { input: right, left: 720, top: 0 }]).png().toFile(`${OUT}/${key}-${w}-side.png`);
    console.log(key, w, 'orig h', ma.height / (w > 500 ? 1 : 2), 'new h', mb.height / (w > 500 ? 1 : 2));
    void scale;
    await page.close();
  }
  await ctx.close();
}
await browser.close();
