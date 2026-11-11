// Builds src/cms/seed.json (the exact WordPress content) and optimised images in public/media/.
// Text is read straight from the captured HTML so nothing is retyped by hand.
// Usage: node scripts/build-seed.mjs
import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const REF = 'my-site-reference';
const OUT_MEDIA = 'public/media';
const WIDTHS = [480, 960, 1600, 2400];
fs.mkdirSync(OUT_MEDIA, { recursive: true });

const pages = {};
const load = (p, vp = 'desktop') => (pages[p + vp] ??= cheerio.load(fs.readFileSync(`${REF}/html/${p}.${vp}.html`, 'utf8')));
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const el = (p, id, vp) => { const $ = load(p, vp); const e = $(`[data-id="${id}"]`); if (!e.length) throw new Error(`${p} #${id} not found`); return { $, e }; };
const text = (p, id, sel = '.elementor-heading-title, h1, h2, h3, h4, p') => { const { e } = el(p, id); return clean(e.find(sel).first().text()); };
// Rich text: keep only p, strong, em, a, br, ul/ol/li (no styles, no data-* attributes)
function rich(p, id) {
  const { $, e } = el(p, id);
  const root = e.find('p, ul, ol').first().parent();
  const allow = new Set(['p', 'strong', 'b', 'em', 'i', 'a', 'br', 'ul', 'ol', 'li']);
  const walk = (node) => {
    if (node.type === 'text') return node.data.replace(/\s+/g, ' ');
    if (node.type !== 'tag') return '';
    const inner = (node.children || []).map(walk).join('');
    const tag = node.name === 'b' ? 'strong' : node.name === 'i' ? 'em' : node.name;
    if (!allow.has(tag)) return inner;
    if (tag === 'br') return '<br>';
    if (tag === 'a') return `<a href="${localHref($(node).attr('href'))}">${inner}</a>`;
    return `<${tag}>${inner.trim()}</${tag}>`;
  };
  return root.children().toArray().map(walk).join('').replace(/\s*<br>\s*/g, '<br>').trim();
}
const localHref = (h = '') => {
  if (!h) return '';
  try {
    const u = new URL(h, 'https://tplumphotography.com');
    if (u.hostname.replace('www.', '') === 'tplumphotography.com') { let p = u.pathname; if (p !== '/' && !p.endsWith('/')) p += '/'; return p + u.hash; }
    return h;
  } catch { return h; }
};
const link = (p, id) => { const { e } = el(p, id); const a = e.is('a') ? e : e.find('a').first(); return { label: clean(a.find('.elementor-button-text').text() || a.text()), href: localHref(a.attr('href')) }; };

// ---------------- images ----------------
const mediaIndex = new Map();
function findFile(url) {
  const u = new URL(url);
  const rel = decodeURIComponent(u.pathname.replace('/wp-content/uploads/', ''));
  const candidates = [];
  if (u.hostname.includes('cdninstagram')) candidates.push(path.join(REF, 'images', u.hostname, decodeURIComponent(u.pathname)));
  const base = rel.replace(/-\d+x\d+(\.\w+)$/, '$1');
  candidates.push(path.join(REF, 'wp-api/media', base), path.join(REF, 'wp-api/media', rel), path.join(REF, 'images/tplumphotography.com/wp-content/uploads', base), path.join(REF, 'images/tplumphotography.com/wp-content/uploads', rel));
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}
const pending = [];
function img(url, alt = '') {
  if (!url) return null;
  url = url.replace(/^\/\//, 'https://');
  const file = findFile(url);
  if (!file) throw new Error('image file missing for ' + url);
  let slug = path.basename(file).replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 60);
  if (url.includes('cdninstagram')) slug = 'ig-' + slug.slice(0, 40);
  if (!mediaIndex.has(file)) { mediaIndex.set(file, slug); pending.push({ file, slug }); }
  return { key: mediaIndex.get(file), alt };
}
const bg = (p, id, media = '') => {
  const css = fs.readdirSync(`${REF}/raw/assets/tplumphotography.com/wp-content/uploads/elementor/css`).map((f) => fs.readFileSync(`${REF}/raw/assets/tplumphotography.com/wp-content/uploads/elementor/css/${f}`, 'utf8')).join('\n');
  const re = new RegExp(`elementor-element-${id}:not\\(\\.elementor-motion-effects-element-type-background\\)[^{]*\\{[^}]*background-image:url\\("([^"]+)"`, 'g');
  const found = [...css.matchAll(re)].map((m) => m[1]);
  return media === 'mobile' ? found[found.length - 1] : media === 'tablet' ? found[1] ?? found[0] : found[0];
};
const imgSrc = (p, id, vp) => { const { e } = el(p, id, vp); const i = e.find('img').first(); const ss = i.attr('srcset'); if (ss) { const best = ss.split(',').map((x) => x.trim().split(/\s+/)).sort((a, b) => parseInt(b[1]) - parseInt(a[1]))[0][0]; return best; } return i.attr('src'); };

// ---------------- site-wide ----------------
const home = 'home';
const igPosts = JSON.parse(fs.readFileSync(`${REF}/interactive/_states/instagram-posts.json`, 'utf8'));
const menu = JSON.parse(fs.readFileSync(`${REF}/interactive/_states/desktop-menu.json`, 'utf8'));
const footer$ = load(home);
const copyright = clean(footer$('.ast-footer-copyright p').text());
const site = {
  brand: {
    logoLight: img(imgSrc(home, 'c437514'), 'Tplum Photography'),
    menuLogo: img(menu.imgs[0], 'Tplum Photography'),
    shareImage: img('https://tplumphotography.com/wp-content/uploads/2026/01/cropped-TPlum-Logo-Dark.png', 'Tplum Photography'),
    siteName: 'Tplum Photography',
  },
  contact: {
    email: clean(load('contact')('[data-id="884f111"] p').first().text()),
    phone: clean(load('contact')('[data-id="5a7baab"] p').first().text()),
    instagramUrl: 'https://www.instagram.com/tplumphotography',
    facebookUrl: 'https://facebook.com/tplumphotograph',
    instagramHandle: '@tplumphotography',
    instagramProfileUrl: 'https://www.instagram.com/tplumphotography/',
  },
  menu: {
    items: menu.links.filter((l) => l.text && l.rect.width > 0 && !/instagram|facebook/i.test(l.text)).map((l) => ({ label: l.text, href: localHref(l.href) })),
  },
  instagramSection: {
    followText: clean(load(home)('[data-id="0498c67"] p').first().text()),
    posts: igPosts.map((p) => ({ image: img(p.img, ''), caption: p.alt, url: p.href })),
  },
  footer: {
    copyright: copyright.replace(/\s*\|\s*Developed by.*$/, ''),
    creditPrefix: 'Developed by',
    creditLabel: clean(footer$('.ast-footer-copyright a').text()),
    creditUrl: footer$('.ast-footer-copyright a').attr('href'),
  },
};

// ---------------- SEO ----------------
const seo = (p) => {
  const m = JSON.parse(fs.readFileSync(`${REF}/meta/${p}.json`, 'utf8'));
  const get = (k) => m.tags.find((t) => t.name === k || t.property === k)?.content ?? '';
  return { title: m.title, description: get('description'), ogTitle: get('og:title'), ogDescription: get('og:description'), ogType: get('og:type'), twitterTitle: get('twitter:title'), twitterDescription: get('twitter:description'), shareImage: get('og:image') ? img(get('og:image'), '') : null };
};

// ---------------- hero slides ----------------
const slides = (id) => { const { $, e } = el(home, id); return e.find('.bdt-ps-slide-img').toArray().map((s) => img(($(s).attr('style') || '').match(/url\('?([^')]+)'?\)/)[1], 'Tplum Photography')); };

// ---------------- testimonials ----------------
const testi = JSON.parse(fs.readFileSync(`${REF}/interactive/_states/desktop-testimonials.json`, 'utf8'));
const seen = new Set();
const order = el(home, 'f6cd43c').e.find('.elementor-testimonial__name').toArray().map((n) => clean(load(home)(n).text()));
testi.slides.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
const testimonials = testi.slides.filter((s) => s.name && !seen.has(s.name) && seen.add(s.name)).map((s) => ({ name: s.name, title: s.title ?? '', text: s.text, rating: s.stars || 5, source: (s.icon || '').match(/elementor-icon-([a-z-]+)/)?.[1] ?? '', image: img(s.img, s.name) }));

const gallery = (p, id) => { const { $, e } = el(p, id); return e.find('a[href]').toArray().map((a) => $(a).attr('href')).filter((h) => /\.(jpe?g|png|webp)$/i.test(h)).map((h) => img(h, '')); };

const content = {
  site,
  home: {
    seo: seo('home'),
    hero: { slidesDesktop: slides('505e53c6'), slidesMobile: slides('678293e') },
    intro: { eyebrow: text(home, '743569fb'), title: rich(home, 'fdc8197').replace(/^<p>|<\/p>$/g, '').replace(/<br>/g, '\n'), body: rich(home, '65875172') },
    about: { image: img(imgSrc(home, '55fa10a'), 'Jeremy, creative lead at Tplum Photography'), heading: text(home, '0891842'), body: rich(home, '9cfc1d5'), button: link(home, '5b3a104') },
    quote: { image: img(bg(home, '2ac08a9'), ''), text: rich(home, '62b1693'), imageMobile: img(bg(home, 'c4b8432', 'mobile'), ''), textMobile: rich(home, '6a54253') },
    candid: { heading: clean(el(home, '0d46168').e.find('h2').html().replace(/<br\s*\/?>/g, '@@BR@@')).replace(/ ?@@BR@@ ?/g, '\n'), images: ['84954d1', 'b8cae05', 'e5e1e9f', 'a0f5b60'].map((id) => img(imgSrc(home, id), '')) },
    recentWork: { heading: text(home, 'ac1f17f'), images: gallery(home, '3ee1a7f'), button: link(home, 'cb747ce') },
    testimonials: { heading: text(home, '1ffeb57'), items: testimonials },
    cta: { heading: text(home, 'fcac06d'), button: link(home, '379dd54'), image: img(bg(home, '19fb528c'), ''), imageTablet: img(bg(home, '19fb528c', 'tablet'), ''), imageMobile: img(bg(home, '19fb528c', 'mobile'), '') },
  },
  portfolio: {
    seo: seo('portfolio'),
    hero: { heading: text('portfolio', '3e9f530e'), image: img(bg('portfolio', '388adb41'), '') },
    gallery: { images: gallery('portfolio', 'dcafe2b') },
    book: { heading: text('portfolio', '0ded77f'), text: text('portfolio', '27a5c99'), href: localHref(el('portfolio', '015f816').e.attr('href')), image: img(bg('portfolio', '015f816'), '') },
  },
  about: {
    seo: seo('about'),
    hero: { heading: text('about', '132ac05e'), image: img(bg('about', '75cbfb78'), '') },
    profile: { image: img(imgSrc('about', 'd310cae'), 'Jeremy, creative lead at Tplum Photography'), heading: text('about', '5ef5526'), body: rich('about', 'c3bc58a'), button: link('about', '485d4dc') },
  },
  contact: {
    seo: seo('contact'),
    hero: { heading: text('contact', 'd4b3a1d'), image: img(bg('contact', '9935a6d'), '') },
    intro: { heading: text('contact', '80847f9'), body: rich('contact', '37eb55d') },
    form: (() => {
      const f = JSON.parse(fs.readFileSync(`${REF}/interactive/_states/contact-form.json`, 'utf8'));
      const by = (t, label) => f.fields.find((x) => x.type === t && (!label || x.label.startsWith(label)));
      const lbl = (x) => x.label.replace(/\s*\*$/, '').trim();
      const name = by('wpforms-field-name'), sel = f.fields.filter((x) => x.type === 'wpforms-field-select'), txt = f.fields.filter((x) => x.type === 'wpforms-field-text');
      return {
        labels: {
          name: lbl(name), first: name.sublabels[0], last: name.sublabels[1], email: lbl(by('wpforms-field-email')), phone: lbl(by('wpforms-field-phone')),
          service: lbl(sel[0]), others: lbl(txt[0]), othersHelp: txt[0].desc, date: lbl(by('wpforms-field-date-time')), location: lbl(txt[1]),
          instagram: lbl(txt[2]), instagramPlaceholder: txt[2].placeholder[0], heardFrom: lbl(sel[1]), message: lbl(by('wpforms-field-textarea')),
        },
        serviceOptions: sel[0].options,
        heardOptions: sel[1].options,
        submit: f.submit,
        success: 'Thanks for contacting us! We will be in touch with you shortly.',
      };
    })(),
  },
  'the-tplum-signature': {
    seo: seo('the-tplum-signature'),
    hero: { heading: clean(el('the-tplum-signature', '371de17d').e.find('h2').html().replace(/<br\s*\/?>/g, '@@BR@@')).replace(/ ?@@BR@@ ?/g, '\n'), image: img(bg('the-tplum-signature', '52090214'), '') },
    intro: { body: rich('the-tplum-signature', '190fc8d2') },
    banner: { image: img(bg('the-tplum-signature', '3fb0aef'), '') },
    process: {
      heading: text('the-tplum-signature', '319546b'),
      steps: ['37fc6b7', '7d35a87', 'a8f5e7c', '5c2b96a', 'b942673', 'fe85c13', '2df8c4d', '4d103ba'].map((id) => ({ title: clean(el('the-tplum-signature', id).e.find('.elementor-icon-box-title').text()), body: clean(el('the-tplum-signature', id).e.find('.elementor-icon-box-description').text()) })),
    },
    book: { heading: text('the-tplum-signature', '7fa0f5f'), text: text('the-tplum-signature', 'b817e8f'), href: localHref(el('the-tplum-signature', 'f7e3361').e.closest('a').attr('href') || el('the-tplum-signature', 'f7e3361').e.attr('href') || '/contact/'), image: img(bg('the-tplum-signature', 'f7e3361'), '') },
  },
  faq: {
    seo: seo('faq'),
    hero: { heading: text('faq', '48699b0a'), image: img(bg('faq', '17bc76bd'), '') },
    intro: { heading: text('faq', '4301b0d') },
    items: JSON.parse(fs.readFileSync(`${REF}/interactive/_states/faq.json`, 'utf8')).items.map((i) => ({ question: i.q, answer: sanitizeAnswer(i.aHtml) })),
    contactLine: rich('faq', '1fa2395'),
  },
  'coming-soon': {
    seo: seo('coming-soon'),
    heading: clean(el('coming-soon', '2736462').e.find('h2').html().replace(/<br\s*\/?>/g, '@@BR@@')).replace(/ ?@@BR@@ ?/g, '\n'),
    body: rich('coming-soon', '723e8fe'),
  },
};
function sanitizeAnswer(html) {
  const $ = cheerio.load(`<div id="r">${html}</div>`);
  $('#r *').each((_, n) => { for (const a of Object.keys(n.attribs || {})) if (!(n.name === 'a' && a === 'href')) $(n).removeAttr(a); if (n.name === 'a') $(n).attr('href', localHref($(n).attr('href'))); });
  $('#r span, #r div').each((_, n) => { $(n).replaceWith($(n).html()); });
  return clean($('#r').html()).replace(/<\/?span>/g, '').replace(/<p>\s*<\/p>/g, '').trim();
}

// ---------------- write images ----------------
const manifest = {};
for (const { file, slug } of pending) {
  const meta = await sharp(file).rotate().metadata();
  const w0 = meta.autoOrient?.width ?? meta.width, h0 = meta.autoOrient?.height ?? meta.height;
  const widths = WIDTHS.filter((w) => w < w0).concat(w0 <= 2400 ? [w0] : []).slice(0, 5);
  const variants = [];
  for (const w of [...new Set(widths)]) {
    const out = `${OUT_MEDIA}/${slug}-${w}.webp`;
    if (!fs.existsSync(out)) await sharp(file).rotate().resize({ width: w }).webp({ quality: slug.startsWith('ig-') ? 78 : 82 }).toFile(out);
    variants.push(w);
  }
  manifest[slug] = { width: w0, height: h0, widths: variants, source: path.relative(REF, file) };
}
fs.mkdirSync('src/cms', { recursive: true });
fs.writeFileSync('src/cms/media-manifest.json', JSON.stringify(manifest, null, 1));
// Image values in content: { src (largest local variant), srcset, width, height, alt }
const resolve = (v) => {
  if (Array.isArray(v)) return v.map(resolve);
  if (v && typeof v === 'object') {
    if ('key' in v && 'alt' in v && Object.keys(v).length === 2) {
      const m = manifest[v.key];
      const max = Math.max(...m.widths);
      return { src: `/media/${v.key}-${max}.webp`, srcset: m.widths.map((w) => `/media/${v.key}-${w}.webp ${w}w`).join(', '), width: m.width, height: m.height, alt: v.alt };
    }
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
  }
  return v;
};
fs.writeFileSync('src/cms/seed.json', JSON.stringify(resolve(content), null, 1));
console.log('seed written; images:', pending.length);
// Content added after the WordPress copy (booking page, "Book now" buttons).
await import('./seed-additions.mjs');
