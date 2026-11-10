/**
 * Layout match check: for every text block measured on the original WordPress page (my-site-reference/styles/*.json),
 * finds the same text on the rebuilt page and reports position/size differences beyond a tolerance.
 * Usage: node scripts/layout-diff.mjs [base=http://localhost:4173] [pages] [widths] [tolerancePx=12]
 */
import { chromium } from "playwright";
import fs from "node:fs";

const base = process.argv[2] || "http://localhost:4173";
const PAGES = { home: "/", portfolio: "/portfolio/", about: "/about/", contact: "/contact/", "the-tplum-signature": "/the-tplum-signature/", faq: "/faq/" };
const pages = (process.argv[3] || Object.keys(PAGES).join(",")).split(",");
const widths = (process.argv[4] || "1440,390").split(",").map(Number);
const TOL = Number(process.argv[5] || 12);

const browser = await chromium.launch();
let issues = 0;
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 }, reducedMotion: "reduce" });
  for (const key of pages) {
    const file = `my-site-reference/styles/${key}-${w}.json`;
    if (!fs.existsSync(file)) continue;
    const orig = JSON.parse(fs.readFileSync(file, "utf8"));
    const texts = [];
    for (const e of orig.els) for (const t of e.texts ?? []) if (t.text && t.text.trim().length >= 6 && t.w > 0 && t.h > 0 && t.x >= 0 && t.x < w && !/^(instagram|facebook|twitter|youtube|tplum photography)$/i.test(t.text.trim())) texts.push(t);
    const page = await ctx.newPage();
    await page.goto(base + PAGES[key], { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
    await page.waitForTimeout(500);
    const found = await page.evaluate((list) => {
      const norm = (s) => s.replace(/\s+/g, "").toLowerCase();
      const all = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,a,span,label,button,div,summary,blockquote")];
      return list.map((t) => {
        const want = norm(t.text).slice(0, 34);
        let best = null;
        const tag = (t.tag || "").toUpperCase();
        const pool = all.filter((el) => el.tagName === tag && norm(el.innerText || "").startsWith(want));
        for (const el of pool.length ? pool : all) {
          const txt = norm(el.innerText || "");
          if (!txt.startsWith(want)) continue;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const st = getComputedStyle(el);
          if (st.visibility === "hidden" || st.display === "none") continue;
          // the innermost element whose text starts with the wanted text
          if (!best || best.area > r.width * r.height) best = { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), area: r.width * r.height, font: st.fontFamily.split(",")[0].replace(/"/g, ""), size: st.fontSize, lh: st.lineHeight, color: st.color, weight: st.fontWeight };
        }
        return best;
      });
    }, texts);
    const out = [];
    texts.forEach((t, i) => {
      const f = found[i];
      const label = `"${t.text.slice(0, 38)}"`;
      if (!f) { out.push(`  MISSING ${label}`); return; }
      const d = [];
      if (process.env.YDIFF && (process.env.YALL || Math.abs(f.y - t.y) > 20)) d.push(`y ${t.y}→${f.y} (${f.y - t.y > 0 ? "+" : ""}${f.y - t.y})`);
      if (Math.abs(f.x - t.x) > TOL) d.push(`x ${t.x}→${f.x}`);
      if (Math.abs(f.w - t.w) > TOL) d.push(`w ${t.w}→${f.w}`);
      if (Math.abs(f.h - t.h) > TOL) d.push(`h ${t.h}→${f.h}`);
      if (t.size && t.size !== f.size) d.push(`size ${t.size}→${f.size}`);
      if (t.lh && t.lh !== "normal" && f.lh !== "normal" && Math.abs(parseFloat(t.lh) - parseFloat(f.lh)) > 1) d.push(`lh ${t.lh}→${f.lh}`);
      if (t.color && t.color !== f.color) d.push(`color ${t.color}→${f.color}`);
      if (t.weight && String(t.weight) !== String(f.weight)) d.push(`weight ${t.weight}→${f.weight}`);
      if (t.font && !f.font.toLowerCase().includes(t.font.split(",")[0].replace(/"/g, "").toLowerCase())) d.push(`font ${t.font.split(",")[0]}→${f.font}`);
      if (d.length) out.push(`  ${label} y≈${t.y}: ${d.join(", ")}`);
    });
    issues += out.length;
    console.log(`${key} @${w}: ${texts.length} text blocks, ${out.length} differ`);
    for (const l of out) console.log(l);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${issues} differences`);
