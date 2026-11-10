// Dumps geometry + computed styles of every Elementor element (by data-id) at 1440 and 390,
// so the rebuild can match spacing, fonts and colours exactly.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ORIGIN = 'https://tplumphotography.com';
const PAGES = [['home', '/'], ['portfolio', '/portfolio/'], ['about', '/about/'], ['contact', '/contact/'], ['the-tplum-signature', '/the-tplum-signature/'], ['faq', '/faq/']];
const VPS = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
const OUT = path.resolve('my-site-reference/styles');
await fs.mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
for (const [w, vp] of Object.entries(VPS)) {
  const ctx = await browser.newContext({ viewport: vp });
  for (const [key, p] of PAGES) {
    const page = await ctx.newPage();
    for (let i = 0; i < 4; i++) { try { await page.goto(ORIGIN + p, { waitUntil: 'networkidle', timeout: 90000 }); break; } catch { await page.waitForTimeout(4000); } }
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await page.waitForTimeout(1500);
    const data = await page.evaluate(() => {
      const pick = (el) => {
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const o = { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
        const keys = ['display', 'flexDirection', 'justifyContent', 'alignItems', 'gap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundAttachment', 'borderRadius', 'borderTop', 'borderBottom', 'maxWidth', 'minHeight', 'position', 'zIndex', 'opacity', 'boxShadow', 'overflow'];
        for (const k of keys) { const v = s[k]; if (v && v !== 'none' && v !== 'normal' && v !== '0px' && v !== 'rgba(0, 0, 0, 0)' && v !== 'auto' && v !== 'static' && v !== 'visible' && v !== '1') o[k] = v; }
        return o;
      };
      const text = (el) => { const s = getComputedStyle(el); return { tag: el.tagName, text: el.textContent.trim().slice(0, 80), font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, style: s.fontStyle, lh: s.lineHeight, ls: s.letterSpacing, color: s.color, tt: s.textTransform, align: s.textAlign, td: s.textDecorationLine, mb: s.marginBottom, mt: s.marginTop, ...((r) => ({ x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }))(el.getBoundingClientRect()) }; };
      const els = [...document.querySelectorAll('[data-id]')].map((el) => {
        const o = { id: el.dataset.id, type: el.dataset.element_type, widget: el.dataset.widget_type, ...pick(el) };
        if (el.dataset.element_type === 'widget') {
          const texts = [...el.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,span.elementor-button-text,li,.elementor-testimonial__text,.elementor-testimonial__name,.elementor-testimonial__title,.uael-question-span,.uael-accordion-content')].filter((t) => t.textContent.trim()).slice(0, 8);
          o.texts = texts.map(text);
          const imgs = [...el.querySelectorAll('img')].slice(0, 6).map((i) => { const r = i.getBoundingClientRect(); const s = getComputedStyle(i); return { src: i.currentSrc || i.src, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top + scrollY), fit: s.objectFit, radius: s.borderRadius, filter: s.filter }; });
          if (imgs.length) o.imgs = imgs;
          const btn = el.querySelector('.elementor-button, .elementor-social-icon, .elementor-icon');
          if (btn) { const s = getComputedStyle(btn); const r = btn.getBoundingClientRect(); o.button = { bg: s.backgroundColor, color: s.color, border: s.border, radius: s.borderRadius, padding: s.padding, font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, ls: s.letterSpacing, w: Math.round(r.width), h: Math.round(r.height), fill: btn.querySelector('svg') ? getComputedStyle(btn.querySelector('svg')).fill : null, svgSize: btn.querySelector('svg') ? btn.querySelector('svg').getBoundingClientRect().width : null }; }
          const dv = el.querySelector('.elementor-divider-separator');
          if (dv) { const s = getComputedStyle(dv); o.divider = { borderTop: s.borderTop, width: s.width, w: Math.round(dv.getBoundingClientRect().width) }; }
        }
        return o;
      });
      const body = getComputedStyle(document.body);
      return { url: location.href, scrollHeight: document.documentElement.scrollHeight, body: { bg: body.backgroundColor, font: body.fontFamily, color: body.color, size: body.fontSize }, els };
    });
    await fs.writeFile(path.join(OUT, `${key}-${w}.json`), JSON.stringify(data, null, 1));
    console.log('styles', key, w, data.els.length);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
