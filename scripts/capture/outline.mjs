// Prints an indented outline of an Elementor page: containers + widgets with their text, images, links.
// Usage: node scripts/capture/outline.mjs my-site-reference/html/home.desktop.html [--css]
import * as cheerio from 'cheerio';
import fs from 'node:fs';

const file = process.argv[2];
const withCss = process.argv.includes('--css');
const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
const out = [];
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

function walk(el, depth) {
  const $el = $(el);
  const type = $el.attr('data-element_type');
  const id = $el.attr('data-id');
  const pad = '  '.repeat(depth);
  if (type === 'widget') {
    const w = $el.attr('data-widget_type');
    out.push(`${pad}- [${w}] #${id} .${($el.attr('class') || '').split(' ').filter((c) => c.startsWith('elementor-widget-') === false && !c.startsWith('elementor-element')).join('.')}`);
    $el.find('h1,h2,h3,h4,h5,h6').each((_, h) => out.push(`${pad}    ${h.tagName}: ${clean($(h).text())}`));
    $el.find('p,li,blockquote,.elementor-testimonial__text,.elementor-heading-title').not('h1,h2,h3,h4,h5,h6').each((_, p) => { const t = clean($(p).text()); if (t) out.push(`${pad}    ${p.tagName}: ${t}`); });
    $el.find('img').each((_, img) => out.push(`${pad}    img: ${($(img).attr("src")||"").slice(0,140)} alt="${($(img).attr("alt") || "").slice(0,60).replace(/\n/g," ")}"`));
    $el.find('a[href]').each((_, a) => out.push(`${pad}    a: "${clean($(a).text())}" -> ${$(a).attr('href')}`));
    if (!$el.find('h1,h2,h3,h4,h5,h6,p,li,img,a').length) { const t = clean($el.text()); if (t) out.push(`${pad}    text: ${t.slice(0, 400)}`); }
    const ds = $el.attr('data-settings');
    if (ds && withCss) out.push(`${pad}    settings: ${ds.slice(0, 500)}`);
    return;
  }
  if (type === 'container' || type === 'section' || type === 'column') {
    const bg = $el.attr('data-settings');
    out.push(`${pad}${type} #${id}${bg && withCss ? ' ' + bg.slice(0, 300) : ''}`);
    $el.children().each((_, c) => walk(c, depth + 1));
    return;
  }
  $el.children().each((_, c) => walk(c, depth));
}
$('body').children().each((_, c) => walk(c, 0));
console.log(out.join('\n'));
