import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto('https://tplumphotography.com/contact/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(5000);
  const r = await p.evaluate(() => {
    const f = document.querySelector('form.wpforms-form');
    const fr = f.getBoundingClientRect();
    const pick = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return `${el.tagName}.${String(el.className).split(' ')[0]} "${(el.textContent||el.placeholder||'').trim().slice(0,30)}" @${Math.round(r.left)},${Math.round(r.top - fr.top)} ${Math.round(r.width)}x${Math.round(r.height)} font=${s.fontFamily.split(',')[0]} ${s.fontSize}/${s.lineHeight} w${s.fontWeight} color=${s.color} bg=${s.backgroundColor} border=${s.borderTop} radius=${s.borderRadius} pad=${s.padding} mb=${s.marginBottom} mt=${s.marginTop} tt=${s.textTransform}`; };
    const els = [...f.querySelectorAll('.wpforms-field-label, .wpforms-field-sublabel, .wpforms-required-label, input:not([type=hidden]), select, textarea, button, .wpforms-field-description, .iti__selected-country, .iti__flag')].filter((e) => e.getBoundingClientRect().width > 0);
    return [`form @${Math.round(fr.left)},${Math.round(fr.top + scrollY)} ${Math.round(fr.width)}x${Math.round(fr.height)}`, ...els.map(pick)].join('\n');
  });
  console.log('=====', w, '\n' + r);
  await p.close();
}
await b.close();
