/**
 * Rich text from the CMS is limited to a few safe tags so an edit can never inject scripts
 * or break the layout: p, br, strong, em, a (http/https/mailto/tel/relative), ul, ol, li.
 * Runs on the server and in the browser (no DOM needed).
 */
const ALLOWED = new Set(["p", "br", "strong", "em", "a", "ul", "ol", "li"]);

const escapeText = (s: string) => s.replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function safeHref(href: string): string {
  const h = href.trim();
  if (/^(https?:|mailto:|tel:)/i.test(h) || h.startsWith("/") || h.startsWith("#")) return h;
  return "#";
}

export function sanitizeRich(html: string | null | undefined): string {
  if (!html) return "";
  let out = "";
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)|(<)/g;
  let m: RegExpExecArray | null;
  const open: string[] = [];
  while ((m = re.exec(html))) {
    if (m[3] !== undefined) { out += escapeText(m[3]); continue; }
    if (m[4]) { out += "&lt;"; continue; }
    const tag = m[1].toLowerCase();
    const closing = m[0].startsWith("</");
    if (tag === "b") { out += closing ? "</strong>" : "<strong>"; continue; }
    if (tag === "i") { out += closing ? "</em>" : "<em>"; continue; }
    if (!ALLOWED.has(tag)) continue;
    if (tag === "br") { out += "<br>"; continue; }
    if (closing) {
      const idx = open.lastIndexOf(tag);
      if (idx === -1) continue;
      while (open.length > idx) out += `</${open.pop()}>`;
      continue;
    }
    if (tag === "a") {
      const href = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i.exec(m[2]);
      const url = safeHref(href ? (href[1] ?? href[2] ?? "") : "#");
      const external = /^https?:/i.test(url) && !/tplumphotography\.com/i.test(url);
      out += `<a href="${escapeAttr(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>`;
    } else out += `<${tag}>`;
    open.push(tag);
  }
  while (open.length) out += `</${open.pop()}>`;
  return out;
}

/** Plain text (for meta tags, alt text, JSON-LD). */
export const plainText = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
