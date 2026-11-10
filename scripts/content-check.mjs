/**
 * Content check (A5): every heading, paragraph, button label and form label in the WordPress content inventory must
 * appear word for word in the CMS seed the rebuilt site renders from. Prints anything missing.
 * Run: node scripts/content-check.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, "src/cms/seed.json"), "utf8"));
const norm = (s) => String(s).replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/&amp;/g, "&").replace(/⏎/g, " ").replace(/\s+/g, " ").replace(/\s+([,.;:!?’)])/g, "$1").trim().toLowerCase();
const flat = (v, out = []) => {
  if (typeof v === "string") out.push(norm(v));
  else if (Array.isArray(v)) v.forEach((x) => flat(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => flat(x, out));
  return out;
};
const site = flat(seed.site).join(" ¦ ");
let missingTotal = 0;
for (const file of fs.readdirSync(path.join(ROOT, "my-site-reference/content-inventory"))) {
  const key = file.replace(/\.md$/, "");
  const hay = `${flat(seed[key] ?? {}).join(" ¦ ")} ¦ ${site}`;
  const md = fs.readFileSync(path.join(ROOT, "my-site-reference/content-inventory", file), "utf8");
  const items = [];
  for (const line of md.split("\n")) {
    let m;
    if ((m = /^- \*\*H\d\*\*: (.+)$/.exec(line))) items.push(["heading", m[1]]);
    else if ((m = /^- Text: (.+)$/.exec(line))) items.push(["text", m[1]]);
    else if ((m = /^- Button: “(.+?)”/.exec(line))) items.push(["button", m[1]]);
    else if ((m = /^- Form field: (.+?) \[/.exec(line))) items.push(["form label", m[1]]);
    else if ((m = /^- Form button: “(.+?)”/.exec(line))) items.push(["form button", m[1]]);
  }
  const missing = [...new Set(items.map(([k, t]) => `${k}: ${t}`))].filter((s) => !hay.includes(norm(s.replace(/^[a-z ]+: /, ""))));
  missingTotal += missing.length;
  console.log(`${key}: ${items.length} items, ${missing.length} not found`);
  for (const m of missing) console.log(`   - ${m.slice(0, 160)}`);
}
process.exitCode = missingTotal ? 1 : 0;
