/**
 * Builds the invoice PDF in the browser (pdf-lib and the font are loaded only when a PDF is asked for). The same bytes
 * are downloaded and emailed. Noto Sans is embedded (only the letters used), so $ and Yoruba/Igbo letters such as Ọ, ẹ
 * and ṣ print as typed. A character even Noto Sans lacks (an emoji, say) is reduced to its plain letter or left out.
 */
import { STAGE_STAMP, bankLines, bare, invoiceTotals, money, parseTerms, shortDate, type InvoiceDoc } from './model'
import { DEFAULT_LOGO } from './logo'

const W = 595.28
const H = 841.89
const M = 50
const CONTENT = W - M * 2
const INK = [0.13, 0.13, 0.13] as const
const SOFT = [0.42, 0.42, 0.42] as const

const fontCache = new Map<string, Promise<ArrayBuffer>>()
const fontBytes = (name: string) => {
  if (!fontCache.has(name)) {
    fontCache.set(name, fetch(`/fonts/${name}`).then((r) => {
      if (!r.ok) throw new Error('The invoice font could not be loaded. Check your connection and try again.')
      return r.arrayBuffer()
    }))
    fontCache.get(name)!.catch(() => fontCache.delete(name))
  }
  return fontCache.get(name)!
}

export async function buildInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, { default: fontkit }, regularBytes, boldBytes] = await Promise.all([
    import('pdf-lib'), import('@pdf-lib/fontkit'), fontBytes('NotoSans-Regular.ttf'), fontBytes('NotoSans-Bold.ttf'),
  ])
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`${doc.title} ${doc.number}`.trim())
  pdf.setAuthor(doc.fromName)
  pdf.setCreator('DMI Studios')
  const regular = await pdf.embedFont(regularBytes, { subset: true })
  const bold = await pdf.embedFont(boldBytes, { subset: true })
  const known = new Set(regular.getCharacterSet())
  const clean = (str: string) =>
    Array.from((str ?? '').replace(/\t/g, ' ').normalize('NFC'))
      .map((c) => {
        if (c === '\n' || c === '\r' || known.has(c.codePointAt(0)!)) return c // line breaks are handled by wrap()
        const base = c.normalize('NFD')
        return Array.from(base).every((x) => known.has(x.codePointAt(0)!)) ? base : base.replace(/\p{M}/gu, '').replace(/[^\x20-\x7e]/g, '')
      })
      .join('')

  type Font = typeof regular
  type Color = readonly [number, number, number]
  let page = pdf.addPage([W, H])
  let y = H - 50
  const newPage = () => { page = pdf.addPage([W, H]); y = H - 50 }
  const widthOf = (str: string, f: Font, size: number) => f.widthOfTextAtSize(str, size)
  /*
   * pdf-lib does not position accents the way the font asks (no GPOS), so an accent that has no ready-made letter, like
   * the tone mark in Ọ̀ or Ẹ̀, would land at lowercase height inside a capital. Letters with such marks are drawn one by
   * one and each mark is centred on its letter and lifted clear of it, using the font's own measurements.
   */
  const metrics = new Map<Font, ReturnType<typeof fontkit.create>>([[regular, fontkit.create(new Uint8Array(regularBytes))], [bold, fontkit.create(new Uint8Array(boldBytes))]])
  const MARK = /\p{M}/u
  const drawMarked = (s: string, x: number, at: number, size: number, f: Font, color: ReturnType<typeof rgb>) => {
    const fk = metrics.get(f)!
    const k = size / fk.unitsPerEm
    const xHeight = fk.glyphForCodePoint(0x78).bbox.maxY
    let px = x
    for (const cluster of s.match(/\p{M}+|\P{M}\p{M}*/gu) ?? []) {
      const [base, ...marks] = Array.from(cluster)
      if (MARK.test(base)) continue // a mark with no letter before it: leave it out
      page.drawText(base, { x: px, y: at, size, font: f, color })
      const bb = fk.glyphForCodePoint(base.codePointAt(0)!).bbox
      const centre = px + ((bb.minX + bb.maxX) / 2) * k
      let above = Math.max(0, bb.maxY - xHeight) // how far a capital (or a letter with an accent already) is taller than x
      let below = Math.min(0, bb.minY)
      for (const m of marks) {
        const mb = fk.glyphForCodePoint(m.codePointAt(0)!).bbox
        const under = mb.maxY < xHeight / 2
        const dy = under ? below : above
        if (under) below -= mb.maxY - mb.minY + 40
        else above += mb.maxY - mb.minY + 40
        page.drawText(m, { x: centre - ((mb.minX + mb.maxX) / 2) * k, y: at + dy * k, size, font: f, color })
      }
      px += widthOf(base, f, size)
    }
  }
  const text = (str: string, x: number, at: number, size: number, f: Font = regular, c: Color = INK) => {
    const s = clean(str)
    const color = rgb(c[0], c[1], c[2])
    if (MARK.test(s)) drawMarked(s, x, at, size, f, color)
    else page.drawText(s, { x, y: at, size, font: f, color })
  }
  const right = (str: string, xr: number, at: number, size: number, f: Font = regular, c: Color = INK) => text(str, xr - widthOf(clean(str), f, size), at, size, f, c)
  /** word wrap; a word wider than the column is cut so it can never run off the page */
  const wrap = (str: string, f: Font, size: number, width: number) => {
    const out: string[] = []
    for (const para of clean(str).split(/\r?\n/)) {
      let line = ''
      for (let word of para.split(/\s+/)) {
        while (widthOf(word, f, size) > width) {
          let n = word.length - 1
          while (n > 1 && widthOf(word.slice(0, n), f, size) > width) n--
          if (line) { out.push(line); line = '' }
          out.push(word.slice(0, n))
          word = word.slice(n)
        }
        const next = line ? `${line} ${word}` : word
        if (widthOf(next, f, size) > width && line) { out.push(line); line = word } else line = next
      }
      out.push(line)
    }
    return out
  }

  /* header */
  try {
    const bytes = doc.logo ? doc.logo : await (await fetch(DEFAULT_LOGO)).arrayBuffer()
    const img = typeof bytes === 'string' && bytes.startsWith('data:image/jp') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
    const scale = Math.min(150 / img.width, 62 / img.height)
    page.drawImage(img, { x: M, y: H - 50 - img.height * scale, width: img.width * scale, height: img.height * scale })
  } catch { /* an unreadable logo must not stop the invoice */ }
  const t = invoiceTotals(doc)
  const xr = W - M
  right(doc.title, xr, H - 72, 28)
  right(`Invoice# ${doc.number}`, xr, H - 88, 9, bold)
  right('Balance Due', xr, H - 112, 8, bold)
  right(money(t.balance), xr, H - 128, 13, bold)
  const stamp = STAGE_STAMP[t.stage]
  if (stamp) {
    const c: Color = t.stage === 'paid' ? [0.09, 0.5, 0.24] : [0.11, 0.31, 0.85]
    const w = widthOf(stamp, bold, 10) + 16
    page.drawRectangle({ x: xr - w, y: H - 152, width: w, height: 18, borderColor: rgb(c[0], c[1], c[2]), borderWidth: 1.2 })
    right(stamp, xr - 8, H - 147, 10, bold, c)
  }

  /* from */
  y = H - 180
  for (const l of wrap(doc.fromName, bold, 9.5, 300)) { text(l, M, y, 9.5, bold); y -= 13 }
  for (const l of wrap(doc.fromAddress, regular, 9, 300)) { text(l, M, y, 9, regular, SOFT); y -= 12.5 }

  /* bill to + dates */
  y -= 24
  const top = y
  const metaLabelX = xr - 80
  ;[['Invoice Date :', shortDate(doc.invoiceDate)], ['Terms :', doc.terms], ['Due Date :', shortDate(doc.dueDate)]].forEach(([k, v], i) => {
    right(k, metaLabelX - 16, top - i * 21, 10, regular, SOFT)
    right(v, xr, top - i * 21, 9.5)
  })
  y = top - 21
  text('Bill To', M, y, 10, regular, SOFT)
  y -= 13
  for (const l of wrap(doc.billName, bold, 9.5, 260)) { text(l, M, y, 9.5, bold); y -= 13 }
  for (const v of [doc.billAddress, doc.billPhone, doc.billEmail]) if (v?.trim()) for (const l of wrap(v, regular, 9, 260)) { text(l, M, y, 9, regular, SOFT); y -= 12.5 }
  y = Math.min(y, top - 63) - 16

  /* items */
  const col = { n: M + 10, item: M + 46, qty: M + 318, rate: M + 400, amount: xr - 9 }
  const tableHead = () => {
    page.drawRectangle({ x: M, y: y - 8, width: CONTENT, height: 27, color: rgb(0.235, 0.235, 0.235) })
    const white: Color = [1, 1, 1]
    text('#', col.n, y, 9.5, regular, white)
    text('Item & Description', col.item, y, 9.5, regular, white)
    right('Qty', col.qty, y, 9.5, regular, white)
    right('Rate', col.rate, y, 9.5, regular, white)
    right('Amount', col.amount, y, 9.5, regular, white)
    y -= 29
  }
  tableHead()
  const figure = (v: string) => (v.trim() ? bare(Number(v) || 0) : '')
  const items = doc.items.filter((i) => i.title.trim() || i.description.trim() || i.amount.trim())
  items.forEach((it, n) => {
    const width = col.qty - col.item - 40
    const title = wrap(it.title, regular, 9.5, width)
    const desc = it.description.trim() ? wrap(it.description, regular, 9, width) : []
    const height = title.length * 13 + desc.length * 12.5 + 14
    if (y - height < 60) { newPage(); tableHead() }
    text(String(n + 1), col.n, y, 9.5)
    right(it.qty, col.qty, y, 9.5)
    right(figure(it.rate), col.rate, y, 9.5)
    right(figure(it.amount), col.amount, y, 9.5)
    for (const l of title) { text(l, col.item, y, 9.5); y -= 13 }
    for (const l of desc) { text(l, col.item, y, 9, regular, SOFT); y -= 12.5 }
    y -= 4
    page.drawLine({ start: { x: M, y: y + 3 }, end: { x: xr, y: y + 3 }, thickness: 0.6, color: rgb(0.72, 0.72, 0.72) })
    y -= 11
  })

  /* totals */
  const payments = doc.payments.filter((p) => p.amount.trim())
  const rows: [string, string, 'plain' | 'strong' | 'balance'][] = [
    ['Sub Total', bare(t.subtotal), 'plain'],
    ...(t.discount !== 0 ? [[doc.discountLabel, `-${bare(t.discount)}`, 'plain'] as [string, string, 'plain']] : []),
    ...(t.tax > 0 ? [[`${doc.taxName || 'Tax'} (${doc.taxRate}%)`, bare(t.tax), 'plain'] as [string, string, 'plain']] : []),
    ['Total (CAD)', money(t.total), 'strong'],
    ...payments.map((p) => [`Payment made${p.date ? ` on ${shortDate(p.date)}` : ''}${p.method ? ` (${p.method})` : ''}`, `-${money(Number(p.amount) || 0)}`, 'plain'] as [string, string, 'plain']),
    ['Balance Due', money(t.balance), 'balance'],
  ]
  const labelR = xr - 110
  for (const [label, value, kind] of rows) {
    const lines = wrap(label, kind === 'plain' ? regular : bold, 9.5, 200)
    const height = lines.length * 12 + 13
    if (y - height < 60) newPage()
    if (kind === 'balance') page.drawRectangle({ x: xr - 250, y: y - 11, width: 250, height: 28, color: rgb(0.955, 0.95, 0.94) })
    const f = kind === 'plain' ? regular : bold
    lines.forEach((l, i) => right(l, labelR, y - i * 12, 9.5, f))
    right(value, col.amount, y, 9.5, f)
    y -= height + (kind === 'balance' ? 8 : 4)
  }

  /* notes + bank details */
  const bank = bankLines(doc)
  const extra = [
    ...(t.balance > 0 && doc.paymentInstructions?.trim() ? [doc.paymentInstructions] : []),
    ...bank,
    ...(doc.taxEnabled && doc.taxNumber?.trim() ? [`${doc.taxName || 'Tax'} number: ${doc.taxNumber.trim()}`] : []),
    ...(doc.footerText?.trim() && !/^\[/.test(doc.footerText) ? ['', doc.footerText] : []),
  ]
  const noteLines = [...(doc.notes.trim() ? wrap(doc.notes, regular, 8.5, CONTENT) : []), ...extra.flatMap((b) => (b ? wrap(b, regular, 8.5, CONTENT) : ['']))]
  if (noteLines.length) {
    y -= 14
    if (y - 18 - noteLines.length * 11.5 < 50) newPage()
    text('Notes', M, y, 10, regular, SOFT)
    y -= 14
    for (const l of noteLines) { text(l, M, y, 8.5); y -= 11.5 }
  }

  /* terms on their own page */
  const terms = parseTerms(doc.termsText)
  if (terms.some((l) => l.text)) {
    newPage()
    text(doc.termsTitle, M, y, 12, bold)
    y -= 22
    for (const l of terms) {
      if (l.kind === 'gap') { y -= 8; continue }
      const f = l.kind === 'head' ? bold : regular
      const indent = l.kind === 'bullet' ? 24 : 0
      for (const [i, line] of wrap(l.text, f, 8.5, CONTENT - indent).entries()) {
        if (y < 56) newPage()
        if (l.kind === 'bullet' && i === 0) text('•', M + 12, y, 8.5)
        text(line, M + indent, y, 8.5, f)
        y -= 11.5
      }
    }
  }

  /* page numbers */
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 38 }, end: { x: xr, y: 38 }, thickness: 0.6, color: rgb(0.72, 0.72, 0.72) })
    const label = String(i + 1)
    p.drawText(label, { x: xr - regular.widthOfTextAtSize(label, 8), y: 24, size: 8, font: regular, color: rgb(SOFT[0], SOFT[1], SOFT[2]) })
  })
  return pdf.save()
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function toBase64(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
