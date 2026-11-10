import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto('https://tplumphotography.com/about/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    const cs = (el) => { if (!el) return null; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return { tag: el.tagName, cls: el.className?.toString().slice(0, 80), text: el.textContent.trim().slice(0, 80), font: s.fontFamily, size: s.fontSize, w8: s.fontWeight, lh: s.lineHeight, color: s.color, bg: s.backgroundColor, pad: s.padding, style: s.fontStyle, ls: s.letterSpacing, align: s.textAlign, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top + scrollY), radius: s.borderRadius, pos: s.position, right: s.right, bottom: s.bottom, border: s.border }; };
    const f = document.querySelector('footer.site-footer');
    const out = { footerHtml: f?.outerHTML.slice(0, 2500), footer: [...(f?.querySelectorAll('*') ?? [])].slice(0, 25).map(cs) };
    out.top = cs(document.querySelector('#ast-scroll-top, .ast-scroll-top-icon, [id*=scroll-top]'));
    out.topHtml = document.querySelector('#ast-scroll-top')?.outerHTML;
    return out;
  });
  console.log(w, JSON.stringify({top:r.top, topHtml:r.topHtml}));
  await p.close();
}
await b.close();
