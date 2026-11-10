import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: w > 500 ? 900 : 844 } });
  await p.goto('https://tplumphotography.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(5000);
  const id = w > 500 ? '505e53c6' : '678293e';
  const r = await p.evaluate((id) => {
    const W = document.querySelector(`[data-id="${id}"]`);
    const cs = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { cls: (el.className.baseVal ?? el.className).slice(0, 60), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), bg: s.backgroundColor, border: s.border, radius: s.borderRadius, color: s.color, margin: s.margin, padding: s.padding, transform: s.transform, opacity: s.opacity, transition: s.transition.slice(0, 80), anim: s.animation.slice(0, 80) }; };
    const q = (sel) => [...W.querySelectorAll(sel)].slice(0, 4).map(cs);
    const before = (el) => { const s = getComputedStyle(el, '::before'); return { content: s.content, w: s.width, h: s.height, border: s.border, bg: s.backgroundColor, radius: s.borderRadius, pos: s.position, top: s.top, left: s.left, transform: s.transform }; };
    const lis = [...W.querySelectorAll('.bdt-slideshow-nav li')];
    return { nav: q('.bdt-slideshow-nav'), li: lis.slice(0, 3).map(cs), a: lis.slice(4, 7).map((l) => ({ ...cs(l.querySelector('a')), before: before(l.querySelector('a')), active: l.classList.contains('bdt-active') })), prev: q('.bdt-prime-slider-previous'), next: q('.bdt-prime-slider-next'), item: q('.bdt-slideshow-item.bdt-active'), cover: q('.bdt-slideshow-item.bdt-active .bdt-position-cover'), img: q('.bdt-slideshow-item.bdt-active .bdt-ps-slide-img') };
  }, id);
  console.log(w, JSON.stringify(r, null, 0));
  await p.close();
}
await b.close();
