// Compact, readable view of my-site-reference/styles/<page>-<width>.json
import fs from 'node:fs';
const [page, width] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(`my-site-reference/styles/${page}-${width}.json`, 'utf8'));
const short = (v) => String(v ?? '').replace(/rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/g, (_, r, g, b, a) => '#' + [r, g, b].map((n) => (+n).toString(16).padStart(2, '0')).join('') + (a && a !== '1' ? `/${a}` : '')).replace(/"?([A-Za-z]+)"?, (sans-serif|serif)/g, '$1');
console.log(`page h=${d.scrollHeight} body: ${short(JSON.stringify(d.body))}`);
for (const e of d.els) {
  if (!e.w || !e.h) { console.log(`  [hidden] ${e.id} ${e.widget || e.type}`); continue; }
  const box = [];
  for (const k of ['display', 'flexDirection', 'justifyContent', 'alignItems', 'gap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'backgroundColor', 'backgroundSize', 'backgroundPosition', 'backgroundAttachment', 'borderRadius', 'borderTop', 'borderBottom', 'maxWidth', 'minHeight', 'position', 'opacity', 'boxShadow'])
    if (e[k] && !(k === 'display' && e[k] === 'block')) box.push(`${k}=${short(e[k])}`);
  if (e.backgroundImage) box.push(`bgimg=${e.backgroundImage.slice(0, 140)}`);
  console.log(`${e.id} ${e.widget || e.type} @${e.x},${e.y} ${e.w}x${e.h} ${box.join(' ')}`);
  for (const t of e.texts || []) console.log(`    ${t.tag} "${t.text.slice(0, 50)}" ${short(t.font)} ${t.size}/${t.lh} w${t.weight}${t.style !== 'normal' ? ' ' + t.style : ''} ls=${t.ls} ${short(t.color)} ${t.tt !== 'none' ? t.tt : ''} ${t.align} mb=${t.mb} @${t.x},${t.y} ${t.w}x${t.h}`);
  for (const i of e.imgs || []) console.log(`    img ${i.src.split('/').slice(-1)[0].slice(0, 60)} ${i.w}x${i.h} @${i.x},${i.y} fit=${i.fit} r=${i.radius}${i.filter !== 'none' ? ' filter=' + i.filter : ''}`);
  if (e.button) console.log(`    button ${short(JSON.stringify(e.button))}`);
  if (e.divider) console.log(`    divider ${short(JSON.stringify(e.divider))}`);
}
