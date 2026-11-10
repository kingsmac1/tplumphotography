// A1.3: Interactive states, captured precisely (menu, hero slides, testimonials, FAQ, lightbox, forms)
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://tplumphotography.com';
const OUT = path.resolve('my-site-reference/interactive');
const VPS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const fails = [];

async function open(ctx, p) {
  const page = await ctx.newPage();
  for (let i = 1; i <= 4; i++) {
    try { await page.goto(ORIGIN + p, { waitUntil: 'networkidle', timeout: 90000 }); break; }
    catch (e) { if (i === 4) fails.push(`${p}: ${e.message.split('\n')[0]}`); await page.waitForTimeout(4000); }
  }
  await page.waitForTimeout(2500);
  return page;
}

const browser = await chromium.launch();
for (const [vp, size] of Object.entries(VPS)) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const dir = path.join(OUT, '_states'); await fs.mkdir(dir, { recursive: true });
  const shot = (page, n, opts = {}) => page.screenshot({ path: path.join(dir, `${vp}-${n}.png`), ...opts }).catch((e) => fails.push(`${n}: ${e.message}`));

  // ---------- Menu ----------
  let page = await open(ctx, '/');
  try {
    await page.locator('[data-id="0eac09c"] a, [data-id="0eac09c"] .elementor-icon').first().click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    await shot(page, 'menu-open');
    const popup = await page.evaluate(() => {
      const m = document.querySelector('.elementor-popup-modal, [data-elementor-type="popup"]');
      if (!m) return null;
      const cs = (el) => { const s = getComputedStyle(el); return { font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, color: s.color, bg: s.backgroundColor, ls: s.letterSpacing, lh: s.lineHeight, tt: s.textTransform }; };
      return {
        html: m.outerHTML,
        links: [...m.querySelectorAll('a')].map((a) => ({ text: a.textContent.trim(), href: a.href, style: cs(a), rect: a.getBoundingClientRect().toJSON() })),
        imgs: [...m.querySelectorAll('img')].map((i) => i.src),
        boxes: [...m.querySelectorAll('[data-id]')].map((e) => ({ id: e.dataset.id, cls: e.className, rect: e.getBoundingClientRect().toJSON(), style: cs(e), bgImage: getComputedStyle(e).backgroundImage })),
        modalBg: getComputedStyle(m).backgroundColor,
      };
    });
    await fs.writeFile(path.join(dir, `${vp}-menu.json`), JSON.stringify(popup, null, 2));
    // hover state of first link
    const first = page.locator('.elementor-popup-modal a').filter({ hasText: /\w/ }).first();
    if (await first.count()) { await first.hover(); await page.waitForTimeout(500); await shot(page, 'menu-hover'); }
  } catch (e) { fails.push(`${vp} menu: ${e.message.split('\n')[0]}`); }
  await page.close();

  // ---------- Hero slider (each slide) ----------
  page = await open(ctx, '/');
  try {
    const sliderId = vp === 'desktop' ? '505e53c6' : '678293e';
    const info = await page.evaluate((id) => {
      const w = document.querySelector(`[data-id="${id}"]`);
      const slides = [...w.querySelectorAll('.swiper-slide')].map((s) => ({
        cls: s.className,
        bg: [...s.querySelectorAll('*')].map((e) => getComputedStyle(e).backgroundImage).filter((b) => b && b !== 'none'),
        imgs: [...s.querySelectorAll('img')].map((i) => i.currentSrc || i.src),
        text: s.innerText.trim(),
      }));
      return { settings: w.getAttribute('data-settings'), slides, html: w.outerHTML.slice(0, 20000) };
    }, sliderId);
    await fs.writeFile(path.join(dir, `${vp}-hero.json`), JSON.stringify(info, null, 2));
    for (let i = 0; i < 12; i++) {
      await shot(page, `hero-${String(i).padStart(2, '0')}`);
      await page.waitForTimeout(vp === 'desktop' ? 4200 : 4200);
    }
  } catch (e) { fails.push(`${vp} hero: ${e.message.split('\n')[0]}`); }

  // ---------- Testimonials ----------
  try {
    const t = page.locator('[data-id="f6cd43c"]');
    await t.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    const info = await page.evaluate(() => {
      const w = document.querySelector('[data-id="f6cd43c"]');
      return {
        settings: w.getAttribute('data-settings'),
        slides: [...w.querySelectorAll('.swiper-slide:not(.swiper-slide-duplicate)')].map((s) => ({ name: s.querySelector('.elementor-testimonial__name')?.textContent.trim(), title: s.querySelector('.elementor-testimonial__title')?.textContent.trim(), text: s.querySelector('.elementor-testimonial__text')?.textContent.trim(), img: s.querySelector('img')?.src, stars: s.querySelectorAll('.elementor-star-full, .e-font-icon-svg.e-fas-star').length, icon: s.querySelector('.elementor-testimonial__icon')?.className })),
        html: w.outerHTML.slice(0, 15000),
      };
    });
    await fs.writeFile(path.join(dir, `${vp}-testimonials.json`), JSON.stringify(info, null, 2));
    for (let i = 0; i < 4; i++) { await t.screenshot({ path: path.join(dir, `${vp}-testimonials-${i}.png`) }); await page.waitForTimeout(3500); }
  } catch (e) { fails.push(`${vp} testimonials: ${e.message.split('\n')[0]}`); }

  // ---------- Instagram strip ----------
  try {
    const ig = page.locator('[data-id="a1a76e3"]');
    await ig.scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
    await ig.screenshot({ path: path.join(dir, `${vp}-instagram.png`) });
    const igInfo = await page.evaluate(() => [...document.querySelectorAll('[data-id="a1a76e3"] a[href*="instagram.com/"]')].map((a) => ({ href: a.href, img: a.querySelector('img')?.src, alt: a.querySelector('img')?.alt })).filter((x) => x.img));
    await fs.writeFile(path.join(dir, `instagram-posts.json`), JSON.stringify(igInfo, null, 2));
    await ig.locator('a').nth(2).hover().catch(() => {}); await page.waitForTimeout(600);
    await ig.screenshot({ path: path.join(dir, `${vp}-instagram-hover.png`) });
  } catch (e) { fails.push(`${vp} instagram: ${e.message.split('\n')[0]}`); }

  // ---------- Recent work gallery + lightbox ----------
  try {
    const g = page.locator('[data-id="3ee1a7f"] a').first();
    await g.scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
    await g.hover(); await page.waitForTimeout(600);
    await shot(page, 'gallery-hover');
    await g.click(); await page.waitForTimeout(2000);
    await shot(page, 'lightbox-0');
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(1500);
    await shot(page, 'lightbox-1');
    const lb = await page.evaluate(() => { const m = document.querySelector('.elementor-lightbox, .dialog-lightbox-widget, [class*="lightbox"]'); return m ? { cls: m.className, html: m.outerHTML.slice(0, 6000), bg: getComputedStyle(m).backgroundColor } : null; });
    await fs.writeFile(path.join(dir, `${vp}-lightbox.json`), JSON.stringify(lb, null, 2));
    await page.keyboard.press('Escape');
  } catch (e) { fails.push(`${vp} lightbox: ${e.message.split('\n')[0]}`); }
  await page.close();

  // ---------- FAQ accordion ----------
  page = await open(ctx, '/faq/');
  try {
    const faq = page.locator('[data-id="6cd2caa"]');
    await faq.scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
    await faq.screenshot({ path: path.join(dir, `${vp}-faq-closed.png`) });
    const info = await page.evaluate(() => {
      const w = document.querySelector('[data-id="6cd2caa"]');
      return { settings: w.getAttribute('data-settings'), items: [...w.querySelectorAll('.uael-faq-accordion')].map((it) => ({ q: it.querySelector('.uael-question-span, h4')?.textContent.trim(), aHtml: it.querySelector('.uael-accordion-content')?.innerHTML.trim() })), html: w.outerHTML.slice(0, 12000) };
    });
    await fs.writeFile(path.join(dir, `faq.json`), JSON.stringify(info, null, 2));
    const heads = page.locator('[data-id="6cd2caa"] .uael-accordion-title');
    await heads.nth(0).click(); await page.waitForTimeout(900);
    await faq.screenshot({ path: path.join(dir, `${vp}-faq-open-0.png`) });
    await heads.nth(1).click(); await page.waitForTimeout(900);
    await faq.screenshot({ path: path.join(dir, `${vp}-faq-open-1.png`) });
  } catch (e) { fails.push(`${vp} faq: ${e.message.split('\n')[0]}`); }
  await page.close();

  // ---------- Contact form ----------
  page = await open(ctx, '/contact/');
  try {
    const f = page.locator('form.wpforms-form').first();
    await f.scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
    await f.screenshot({ path: path.join(dir, `${vp}-form.png`) });
    const fields = await page.evaluate(() => [...document.querySelectorAll('form.wpforms-form .wpforms-field')].map((fl) => ({
      id: fl.id, type: [...fl.classList].find((c) => c.startsWith('wpforms-field-') && c !== 'wpforms-field-container'),
      label: fl.querySelector('.wpforms-field-label')?.textContent.trim(), sublabels: [...fl.querySelectorAll('.wpforms-field-sublabel')].map((s) => s.textContent.trim()),
      required: !!fl.querySelector('[required], .wpforms-required-label'), placeholder: [...fl.querySelectorAll('input,textarea,select')].map((i) => i.placeholder || ''),
      options: [...fl.querySelectorAll('option, li label')].map((o) => o.textContent.trim()).slice(0, 40), desc: fl.querySelector('.wpforms-field-description')?.textContent.trim(),
    })));
    const submit = await page.evaluate(() => document.querySelector('form.wpforms-form [type=submit]')?.textContent.trim());
    await fs.writeFile(path.join(dir, `contact-form.json`), JSON.stringify({ fields, submit }, null, 2));
    await f.locator('[type=submit]').click(); await page.waitForTimeout(1200);
    await f.screenshot({ path: path.join(dir, `${vp}-form-errors.png`) });
  } catch (e) { fails.push(`${vp} form: ${e.message.split('\n')[0]}`); }
  await page.close();
  await ctx.close();
}
await browser.close();
await fs.writeFile(path.join(OUT, '_states', 'failures.json'), JSON.stringify(fails, null, 2));
console.log('interactive done, failures:', fails);
