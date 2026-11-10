/**
 * Content inventory (A1 step 7): one Markdown file per captured WordPress page, listing every section in order with
 * its headings, text, images, buttons and links, read from the original rendered HTML in my-site-reference/html.
 * Run: node scripts/capture/inventory.mjs
 */
import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const HTML = path.join(ROOT, "my-site-reference/html");
const OUT = path.join(ROOT, "my-site-reference/content-inventory");
fs.mkdirSync(OUT, { recursive: true });

const clean = (s) => String(s ?? "").replace(/ /g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
const short = (u) => String(u ?? "").replace(/^https?:\/\/(www\.)?tplumphotography\.com/, "");
const bgFrom = (el, $) => {
  const out = [];
  const style = $(el).attr("style") ?? "";
  for (const m of style.matchAll(/url\(["']?([^"')]+)["']?\)/g)) out.push(m[1]);
  const settings = $(el).attr("data-settings");
  if (settings) {
    try {
      const s = JSON.parse(settings);
      for (const v of Object.values(s)) {
        if (v && typeof v === "object" && typeof v.url === "string" && /\.(jpe?g|png|webp|gif|svg)/i.test(v.url)) out.push(v.url);
        if (Array.isArray(v)) for (const x of v) if (x?.background_image?.url) out.push(x.background_image.url);
      }
    } catch { /* not JSON */ }
  }
  return out;
};
const visibility = (cls) => {
  const hid = ["desktop", "tablet", "mobile"].filter((d) => cls.includes(`elementor-hidden-${d}`));
  return hid.length ? ` _(hidden on ${hid.join(", ")})_` : "";
};

function widgetLines($, w) {
  const type = ($(w).attr("data-widget_type") ?? "widget").replace(/\.default$/, "");
  const lines = [];
  const add = (s) => lines.push(s);
  $(w).find("h1,h2,h3,h4,h5,h6").each((_, h) => { const t = clean($(h).text()); if (t) add(`- **${h.tagName.toUpperCase()}**: ${t.replace(/\n/g, " ⏎ ")}`); });
  if (type === "text-editor" || type === "testimonial" || type === "nested-accordion" || type === "accordion" || type === "toggle" || type === "icon-list") {
    $(w).find("p, li, .elementor-testimonial-content, .elementor-testimonial-name, .elementor-testimonial-job, summary, .e-n-accordion-item-title-text, .elementor-icon-list-text").each((_, p) => {
      if ($(p).parents("p, li").length) return;
      const t = clean($(p).text());
      if (t) add(`- Text: ${t.replace(/\n/g, " ⏎ ")}`);
    });
    if (!$(w).find("p, li").length) { const t = clean($(w).find(".elementor-widget-container").text()); if (t && !lines.length) add(`- Text: ${t.replace(/\n/g, " ⏎ ")}`); }
  }
  $(w).find("img").each((_, i) => {
    const src = $(i).attr("data-src") || $(i).attr("src") || "";
    if (!src || src.startsWith("data:")) return;
    add(`- Image: \`${short(src)}\`${$(i).attr("alt") ? ` (alt: “${clean($(i).attr("alt"))}”)` : " (no alt)"}`);
  });
  for (const u of [...new Set([w, ...$(w).find("[style*='url(']").toArray()].flatMap((x) => bgFrom(x, $)))]) add(`- Background image: \`${short(u)}\``);
  $(w).find("a").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    const t = clean($(a).text()) || $(a).attr("aria-label") || "(icon)";
    const isBtn = $(a).hasClass("elementor-button") || type === "button";
    add(`- ${isBtn ? "Button" : "Link"}: “${t.replace(/\n/g, " ")}” → \`${short(href)}\``);
  });
  if (type === "form") {
    $(w).find(".elementor-field-group").each((_, g) => {
      const label = clean($(g).find("label").first().text());
      const input = $(g).find("input, select, textarea").first();
      const opts = $(g).find("option, .elementor-field-option label").map((_, o) => clean($(o).text())).get().filter(Boolean);
      const name = input.attr("name") ?? "";
      if (input.attr("type") === "hidden" || /honeypot/i.test(name)) return;
      add(`- Form field: ${label || input.attr("placeholder") || name} [${input.prop("tagName")?.toLowerCase() ?? "?"}${input.attr("type") ? `:${input.attr("type")}` : ""}${input.attr("required") !== undefined ? ", required" : ""}]${opts.length ? ` options: ${opts.join(" / ")}` : ""}`);
    });
    const submit = clean($(w).find("button[type=submit]").text());
    if (submit) add(`- Form button: “${submit}”`);
  }
  if (type === "image-carousel" || type === "media-carousel" || type === "slides") add(`- Slides: ${$(w).find(".swiper-slide:not(.swiper-slide-duplicate)").length}`);
  if (type === "gallery" || type === "image-gallery") add(`- Gallery images: ${$(w).find("img, a.e-gallery-item").length}`);
  // de-duplicate (links often repeat image wrappers)
  return { type, lines: [...new Set(lines)] };
}

function sectionMd($, el, title) {
  const cls = $(el).attr("class") ?? "";
  const md = [`## ${title}${visibility(cls)}`, ""];
  const bgs = bgFrom(el, $);
  $(el).find("[data-element_type=container], [data-element_type=section], [data-element_type=column]").each((_, c) => { for (const u of bgFrom(c, $)) bgs.push(u); });
  for (const u of [...new Set(bgs)]) md.push(`- Background image: \`${short(u)}\``);
  let any = bgs.length > 0;
  $(el).find("[data-element_type=widget]").each((_, w) => {
    const { type, lines } = widgetLines($, w);
    if (!lines.length) return;
    any = true;
    md.push(`**${type}**${visibility($(w).attr("class") ?? "")}`, ...lines, "");
  });
  if (!any) md.push("_(no content)_", "");
  return md.join("\n");
}

const pages = fs.readdirSync(HTML).filter((f) => f.endsWith(".desktop.html"));
for (const file of pages) {
  const name = file.replace(".desktop.html", "");
  const $ = cheerio.load(fs.readFileSync(path.join(HTML, file), "utf8"));
  $("br").replaceWith("\n");
  const meta = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "my-site-reference/meta", `${name}.json`), "utf8")); } catch { return {}; } })();
  const out = [
    `# Content inventory: ${name === "home" ? "Home (/)" : `/${name}/`}`,
    "",
    "Generated from the original WordPress page (`my-site-reference/html/" + file + "`). Text is exactly as on the old site.",
    "⏎ marks a line break inside a heading or paragraph.",
    "",
    "## SEO",
    "",
    `- Title: ${clean($("title").first().text())}`,
    `- Description: ${$('meta[name="description"]').attr("content") ?? meta.description ?? "(none)"}`,
    ...["og:title", "og:description", "og:image", "og:type"].map((p) => `- ${p}: ${$(`meta[property="${p}"]`).attr("content") ?? "(none)"}`),
    ...["twitter:card", "twitter:title", "twitter:description"].map((p) => `- ${p}: ${$(`meta[name="${p}"]`).attr("content") ?? "(none)"}`),
    "",
  ];
  const header = $("[data-elementor-type=header]").first();
  if (header.length) out.push(sectionMd($, header, "Header"));
  const body = $("[data-elementor-type=wp-page], [data-elementor-type=single-page], [data-elementor-type=page]").first();
  const top = body.children(".elementor-element, .elementor-section, .e-con, .elementor-inner, .elementor-section-wrap");
  let n = 0;
  top.each((_, el) => { out.push(sectionMd($, el, `Section ${++n}`)); });
  const footer = $("[data-elementor-type=footer]").first();
  if (footer.length) out.push(sectionMd($, footer, "Footer"));
  $("[data-elementor-type=popup]").each((i, p) => { out.push(sectionMd($, p, `Pop-up ${i + 1}`)); });
  fs.writeFileSync(path.join(OUT, `${name}.md`), out.join("\n") + "\n");
  console.log(`${name}: ${n} sections`);
}
