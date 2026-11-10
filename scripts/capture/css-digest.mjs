// Condensed view of an Elementor post CSS file: "<media> #id suffix { decls }"
// Usage: node scripts/capture/css-digest.mjs 853 [id-filter]
import fs from 'node:fs';
const [post, filter] = process.argv.slice(2);
const css = fs.readFileSync(`my-site-reference/raw/assets/tplumphotography.com/wp-content/uploads/elementor/css/post-${post}.css`, 'utf8');
const out = [];
function walk(text, media) {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const sel = text.slice(i, open).trim();
    if (sel.startsWith('@media') || sel.startsWith('@supports')) {
      let depth = 1, j = open + 1;
      while (depth && j < text.length) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++; }
      walk(text.slice(open + 1, j - 1), sel.replace('@media', '').trim());
      i = j;
      continue;
    }
    const close = text.indexOf('}', open);
    const decl = text.slice(open + 1, close).trim();
    i = close + 1;
    if (sel.startsWith('@font-face') || !decl) continue;
    const parts = sel.split(',').map((s) => s.trim()).map((s) => {
      const m = s.match(/elementor-element-([0-9a-f]{6,8})(.*)$/);
      if (!m) return s.replace(/\.elementor-\d+ /g, '');
      return '#' + m[1] + m[2].replace(/\.elementor-\d+ /g, '').replace(/> \.elementor-widget-container/g, '').replace(/\.elementor-element\.elementor-element-/g, '#').trim();
    });
    const sels = [...new Set(parts.filter((p) => !/motion-effects-layer|background-video-container|background-slideshow|e-con-inner > \.elementor-background/.test(p)))].join(', ');
    if (filter && !sels.includes(filter)) continue;
    out.push(`${media ? '[' + media + '] ' : ''}${sels} { ${decl.replace(/--container-widget-[a-z-]+:[^;]*;?/g, '').replace(/--flex-wrap-mobile:wrap;?/g, '')} }`);
  }
}
walk(css.replace(/\/\*[\s\S]*?\*\//g, ''), '');
console.log(out.join('\n'));
