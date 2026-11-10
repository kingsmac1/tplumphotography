// A1.4: WordPress REST API dump (pages, posts, media originals)
import fs from 'node:fs/promises';
import path from 'node:path';

const API = 'https://tplumphotography.com/wp-json/wp/v2';
const OUT = path.resolve('my-site-reference/wp-api');
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh) site-migration' };
const failures = [];

async function getAll(type) {
  const items = [];
  for (let page = 1; ; page++) {
    const r = await fetch(`${API}/${type}?per_page=100&page=${page}&context=view`, { headers: UA });
    if (!r.ok) { if (page === 1) failures.push(`${type}: HTTP ${r.status}`); break; }
    const batch = await r.json();
    items.push(...batch);
    if (page >= Number(r.headers.get('x-wp-totalpages') || 1)) break;
  }
  return items;
}

async function download(url, dest) {
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
      return;
    } catch (e) {
      if (i === 4) failures.push(`media ${url}: ${e.message}`);
      else await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

await fs.mkdir(OUT, { recursive: true });
for (const t of ['pages', 'posts', 'media', 'categories', 'tags']) {
  const items = await getAll(t);
  await fs.writeFile(path.join(OUT, `${t}.json`), JSON.stringify(items, null, 2));
  console.log(t, items.length);
  if (t === 'media') {
    const queue = [...items];
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const m = queue.shift();
        const u = new URL(m.source_url);
        await download(m.source_url, path.join(OUT, 'media', decodeURIComponent(u.pathname.replace('/wp-content/uploads/', ''))));
      }
    });
    await Promise.all(workers);
  }
}
for (const extra of ['', '/settings']) {
  try {
    const r = await fetch(`https://tplumphotography.com/wp-json${extra}`, { headers: UA });
    if (r.ok) await fs.writeFile(path.join(OUT, `root${extra.replace('/', '-')}.json`), await r.text());
  } catch {}
}
await fs.writeFile(path.join(OUT, 'failures.json'), JSON.stringify(failures, null, 2));
console.log('api done, failures:', failures.length);
