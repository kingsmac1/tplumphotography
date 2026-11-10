// A1: Full capture of https://tplumphotography.com into /my-site-reference
// Usage: node scripts/capture/capture-site.mjs
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://tplumphotography.com';
const OUT = path.resolve('my-site-reference');
const RAW = path.join(OUT, 'raw');
const PAGES = [
  ['home', '/'],
  ['portfolio', '/portfolio/'],
  ['about', '/about/'],
  ['contact', '/contact/'],
  ['the-tplum-signature', '/the-tplum-signature/'],
  ['faq', '/faq/'],
  ['coming-soon', '/coming-soon/'],
];
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const failures = [];
const assetIndex = {};

async function ensure(p) { await fs.mkdir(p, { recursive: true }); }

function localPathFor(url) {
  const u = new URL(url);
  let p = u.pathname;
  if (p.endsWith('/')) p += 'index';
  return path.join(RAW, 'assets', u.hostname, decodeURIComponent(p));
}

async function slowScroll(page) {
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const h = () => document.documentElement.scrollHeight;
    for (let y = 0; y < h(); y += 300) { window.scrollTo(0, y); await sleep(180); }
    window.scrollTo(0, h()); await sleep(800);
    for (let y = h(); y > 0; y -= 600) { window.scrollTo(0, y); await sleep(60); }
    window.scrollTo(0, 0); await sleep(500);
  });
}

async function attachRecorder(page) {
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (!/^https?:/.test(url) || res.status() >= 300) return;
      const type = res.request().resourceType();
      if (!['stylesheet', 'script', 'font', 'image', 'media'].includes(type)) return;
      if (assetIndex[url]) return;
      const body = await res.body();
      const lp = localPathFor(url);
      await ensure(path.dirname(lp));
      await fs.writeFile(lp, body);
      assetIndex[url] = { type, file: path.relative(OUT, lp), bytes: body.length };
    } catch { /* body unavailable for some responses */ }
  });
}

async function gotoWithRetry(page, url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 * i });
      return true;
    } catch (e) {
      console.warn(`retry ${i} ${url}: ${e.message.split('\n')[0]}`);
      await page.waitForTimeout(3000 * i);
    }
  }
  failures.push(`page load: ${url}`);
  return false;
}

async function extractMeta(page) {
  return page.evaluate(() => {
    const meta = {};
    meta.title = document.title;
    meta.lang = document.documentElement.lang;
    meta.tags = [...document.querySelectorAll('head meta')].map((m) => ({
      name: m.getAttribute('name'), property: m.getAttribute('property'), content: m.getAttribute('content'),
    })).filter((m) => m.name || m.property);
    meta.links = [...document.querySelectorAll('head link')].map((l) => ({ rel: l.rel, href: l.href, sizes: l.getAttribute('sizes') }));
    meta.jsonld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent);
    return meta;
  });
}

async function extractImageUrls(page) {
  return page.evaluate(() => {
    const urls = new Set();
    const best = (srcset) => {
      let top = null, w = 0;
      for (const part of srcset.split(',')) {
        const [u, d] = part.trim().split(/\s+/);
        const n = parseInt(d || '0', 10) || 1;
        if (n >= w) { w = n; top = u; }
      }
      return top;
    };
    document.querySelectorAll('img').forEach((img) => {
      ['src', 'data-src', 'data-lazy-src'].forEach((a) => img.getAttribute(a) && urls.add(new URL(img.getAttribute(a), location.href).href));
      const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset');
      if (ss) { ss.split(',').forEach((p) => urls.add(new URL(p.trim().split(/\s+/)[0], location.href).href)); const b = best(ss); if (b) urls.add(new URL(b, location.href).href); }
    });
    document.querySelectorAll('source[srcset]').forEach((s) => s.srcset.split(',').forEach((p) => urls.add(new URL(p.trim().split(/\s+/)[0], location.href).href)));
    document.querySelectorAll('*').forEach((el) => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(new URL(m[1], location.href).href);
      const ds = el.getAttribute('data-settings');
      if (ds && ds.includes('http')) for (const m of ds.matchAll(/https?:\\?\/\\?\/[^"\s]+?\.(?:jpe?g|png|webp|gif|svg)/gi)) urls.add(m[0].replace(/\\\//g, '/'));
    });
    return [...urls].filter((u) => !u.startsWith('data:'));
  });
}

async function download(url, dest) {
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) site-migration' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      await ensure(path.dirname(dest));
      await fs.writeFile(dest, buf);
      return buf.length;
    } catch (e) {
      if (i === 4) { failures.push(`download ${url}: ${e.message}`); return 0; }
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function captureInteractive(page, key, vpName) {
  const dir = path.join(OUT, 'interactive', key);
  await ensure(dir);
  const shot = (name) => page.screenshot({ path: path.join(dir, `${vpName}-${name}.png`) }).catch(() => {});
  // Pop-out menu
  try {
    const toggle = page.locator('.elementor-menu-toggle, [class*="hamburger"], [aria-label*="enu" i], .elementor-icon').filter({ visible: true }).first();
    if (await toggle.count()) {
      await toggle.click({ timeout: 3000 });
      await page.waitForTimeout(1200);
      await shot('menu-open');
      const html = await page.content();
      await fs.writeFile(path.join(dir, `${vpName}-menu-open.html`), html);
      await page.keyboard.press('Escape');
      const close = page.locator('.dialog-close-button, .elementor-menu-toggle.elementor-active, [class*="close"]').filter({ visible: true }).first();
      if (await close.count()) await close.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  } catch (e) { failures.push(`${key} ${vpName} menu: ${e.message.split('\n')[0]}`); }
  // Slider slides
  try {
    const nexts = page.locator('.swiper-button-next, .elementor-swiper-button-next').filter({ visible: true });
    const n = await nexts.count();
    for (let s = 0; s < n; s++) {
      const btn = nexts.nth(s);
      await btn.scrollIntoViewIfNeeded();
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(900);
        const box = await btn.locator('xpath=ancestor::*[contains(@class,"elementor-widget")][1]').screenshot({ path: path.join(dir, `${vpName}-slider${s}-${i}.png`) }).catch(() => null);
        await btn.click({ timeout: 2000 }).catch(() => {});
      }
    }
  } catch (e) { failures.push(`${key} ${vpName} slider: ${e.message.split('\n')[0]}`); }
  // Accordion (FAQ)
  try {
    const items = page.locator('.elementor-tab-title, .e-n-accordion-item-title, details > summary, .elementor-accordion-title, .elementor-toggle-title').filter({ visible: true });
    const n = await items.count();
    if (n) {
      await shot('accordion-initial');
      for (let i = 0; i < n; i++) {
        await items.nth(i).scrollIntoViewIfNeeded();
        await items.nth(i).click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(600);
        await shot(`accordion-open-${i}`);
      }
      await fs.writeFile(path.join(dir, `${vpName}-accordion-all-opened.html`), await page.content());
    }
  } catch (e) { failures.push(`${key} ${vpName} accordion: ${e.message.split('\n')[0]}`); }
  // Lightbox (first gallery image)
  try {
    const links = page.locator('a[data-elementor-open-lightbox], a.e-gallery-item, .elementor-gallery-item, a[href$=".jpg"]').filter({ visible: true });
    const n = await links.count();
    if (n) {
      await links.first().scrollIntoViewIfNeeded();
      await links.first().click({ timeout: 3000 });
      await page.waitForTimeout(1500);
      await shot('lightbox-open');
      const next = page.locator('.elementor-swiper-button-next, .elementor-lightbox .swiper-button-next').filter({ visible: true }).first();
      if (await next.count()) { await next.click().catch(() => {}); await page.waitForTimeout(1000); await shot('lightbox-next'); }
      await fs.writeFile(path.join(dir, `${vpName}-lightbox-open.html`), await page.content());
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }
  } catch (e) { failures.push(`${key} ${vpName} lightbox: ${e.message.split('\n')[0]}`); }
  // Forms
  try {
    const forms = page.locator('form').filter({ visible: true });
    const n = await forms.count();
    for (let i = 0; i < n; i++) {
      await forms.nth(i).scrollIntoViewIfNeeded();
      await forms.nth(i).screenshot({ path: path.join(dir, `${vpName}-form-${i}.png`) }).catch(() => {});
      await fs.writeFile(path.join(dir, `form-${i}.html`), await forms.nth(i).evaluate((f) => f.outerHTML));
    }
  } catch (e) { failures.push(`${key} ${vpName} forms: ${e.message.split('\n')[0]}`); }
}

async function main() {
  await ensure(RAW);
  for (const d of ['html', 'screenshots', 'meta', 'images']) await ensure(path.join(OUT, d));
  const browser = await chromium.launch();
  const allImages = new Set();

  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vpName === 'mobile' ? 2 : 1, userAgent: vpName === 'mobile' ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined });
    for (const [key, p] of PAGES) {
      const page = await ctx.newPage();
      await attachRecorder(page);
      console.log(`[${vpName}] ${p}`);
      if (!(await gotoWithRetry(page, ORIGIN + p))) { await page.close(); continue; }
      await slowScroll(page);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1500);
      await fs.writeFile(path.join(OUT, 'html', `${key}.${vpName}.html`), await page.content());
      await page.screenshot({ path: path.join(OUT, 'screenshots', `${key}-${vp.width}.png`), fullPage: true }).catch((e) => failures.push(`screenshot ${key} ${vpName}: ${e.message}`));
      if (vpName === 'desktop') await fs.writeFile(path.join(OUT, 'meta', `${key}.json`), JSON.stringify(await extractMeta(page), null, 2));
      (await extractImageUrls(page)).forEach((u) => allImages.add(u));
      await captureInteractive(page, key, vpName);
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();

  // Download every referenced image (including full-size originals behind -WxH suffixes)
  const want = new Set();
  for (const u of allImages) {
    if (!u.startsWith(ORIGIN) && !/instagram|cdninstagram|fbcdn/.test(u)) continue;
    want.add(u);
    const m = u.match(/^(.*)-\d+x\d+(\.\w+)$/);
    if (m) want.add(m[1] + m[2]);
  }
  for (const u of want) {
    const dest = path.join(OUT, 'images', new URL(u).hostname, decodeURIComponent(new URL(u).pathname));
    await download(u, dest);
  }
  await fs.writeFile(path.join(OUT, 'meta', 'asset-index.json'), JSON.stringify(assetIndex, null, 2));
  await fs.writeFile(path.join(OUT, 'meta', 'page-images.json'), JSON.stringify([...want].sort(), null, 2));
  await fs.writeFile(path.join(OUT, 'meta', 'capture-failures.json'), JSON.stringify(failures, null, 2));
  console.log(`done. assets=${Object.keys(assetIndex).length} images=${want.size} failures=${failures.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
