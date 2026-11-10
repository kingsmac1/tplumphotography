// node scripts/capture/probe-el.mjs <url> <width> <css selector> [pseudo]
import { chromium } from 'playwright';
const [url, w, sel, pseudo] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +w > 500 ? 900 : 844 } });
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForTimeout(4000);
const r = await p.evaluate(([sel, pseudo]) => [...document.querySelectorAll(sel)].slice(0, 6).map((el) => {
  const s = getComputedStyle(el, pseudo || null); const r = el.getBoundingClientRect();
  return { tag: el.tagName, cls: String(el.className).slice(0, 50), x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, bgi: s.backgroundImage.slice(0, 90), bgs: s.backgroundSize, bgp: s.backgroundPosition, op: s.opacity, content: s.content, pos: s.position, mt: s.marginTop, pt: s.paddingTop, disp: s.display, tr: s.transform };
}), [sel, pseudo]);
console.log(JSON.stringify(r, null, 0));
await b.close();
