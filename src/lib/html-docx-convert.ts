import { parseDocument } from 'htmlparser2'
import type { AnyNode, Element } from 'domhandler'
import {
  Document, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, WidthType, Packer,
  type IRunOptions,
} from 'docx'

/**
 * Conversion HTML -> .docx maison, en remplacement de la librairie
 * html-to-docx dont la sortie s'est avérée invalide pour Word (schéma OOXML
 * mal formé, <w:sectPr> mal placé et vraisemblablement d'autres écarts que
 * la triple vérification zip/python-docx/mammoth ne suffisait pas à
 * détecter — seul Word lui-même les rejette). `docx` est une librairie
 * TypeScript activement maintenue qui construit directement l'arbre OOXML
 * plutôt que de le générer par templating, donc structurellement fiable.
 *
 * Couvre le vocabulaire HTML réellement produit par notre éditeur (Tiptap)
 * et par la conversion mammoth des .docx importés : paragraphes, titres,
 * gras/italique/souligné, liens, surlignage (couleurs de la palette de
 * RichTextEditor), couleur de texte, police, interligne, alignement,
 * listes à puces/numérotées, tableaux simples, images (dont les tampons de
 * signature). Ne gère pas les tableaux à cellules fusionnées ni les listes
 * imbriquées — non rencontrés dans le contenu généré par cette app.
 */

const HEADING_LEVELS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2, h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6,
}

// Correspondance avec la palette fixe de RichTextEditor (HIGHLIGHT_COLORS) —
// docx n'accepte qu'un jeu de couleurs de surlignage nommées, pas de hex
// arbitraire.
const HIGHLIGHT_MAP: Record<string, string> = {
  '#fde047': 'yellow', '#86efac': 'green', '#93c5fd': 'blue',
  '#fca5a5': 'red', '#d8b4fe': 'magenta', '#fdba74': 'darkYellow',
}

function isElement(node: AnyNode): node is Element {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style'
}

function getPngDimensions(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function styleValue(style: string | undefined, prop: string): string | null {
  if (!style) return null
  const m = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, 'i'))
  return m ? m[1].trim() : null
}

type InlineStyle = { bold?: boolean; italics?: boolean; underline?: boolean; strike?: boolean; color?: string; highlight?: string; font?: string }

function walkInline(nodes: AnyNode[], style: InlineStyle): (TextRun | ImageRun)[] {
  const out: (TextRun | ImageRun)[] = []
  for (const node of nodes) {
    if (node.type === 'text') {
      if (!node.data) continue
      const opts: IRunOptions = {
        text: node.data, bold: style.bold, italics: style.italics, strike: style.strike,
        underline: style.underline ? {} : undefined,
        color: style.color ? style.color.replace('#', '') : undefined,
        highlight: style.highlight as IRunOptions['highlight'] | undefined,
        font: style.font,
      }
      out.push(new TextRun(opts))
      continue
    }
    if (!isElement(node)) continue
    const tag = node.name

    if (tag === 'img') {
      const src = node.attribs.src
      if (src?.startsWith('data:image')) {
        try {
          const base64 = src.split(',')[1] ?? ''
          const buf = Buffer.from(base64, 'base64')
          const { width: naturalW, height: naturalH } = getPngDimensions(buf)
          const styleW = styleValue(node.attribs.style, 'width')
          const targetW = styleW ? parseFloat(styleW) : Math.min(naturalW, 400)
          const targetH = naturalW > 0 ? targetW * (naturalH / naturalW) : targetW
          out.push(new ImageRun({ type: 'png', data: buf, transformation: { width: Math.round(targetW), height: Math.round(targetH) } }))
        } catch {
          // image illisible (format non-PNG imprévu) — on l'ignore plutôt que
          // de faire échouer toute la conversion du document.
        }
      }
      continue
    }
    if (tag === 'br') { out.push(new TextRun({ text: '', break: 1 })); continue }

    const child: InlineStyle = { ...style }
    if (tag === 'strong' || tag === 'b') child.bold = true
    if (tag === 'em' || tag === 'i') child.italics = true
    if (tag === 'u') child.underline = true
    if (tag === 's' || tag === 'strike' || tag === 'del') child.strike = true
    if (tag === 'a') child.color = child.color ?? '2563eb'
    if (tag === 'mark') {
      const color = node.attribs['data-color'] || styleValue(node.attribs.style, 'background-color')
      child.highlight = (color && HIGHLIGHT_MAP[color]) || 'yellow'
    }
    if (tag === 'span' || tag === 'a') {
      const colorStyle = styleValue(node.attribs.style, 'color')
      if (colorStyle) {
        const hex = colorStyle.match(/#[0-9a-fA-F]{3,6}/)
        if (hex) child.color = hex[0].replace('#', '')
      }
      const fontStyle = styleValue(node.attribs.style, 'font-family')
      if (fontStyle) child.font = fontStyle.split(',')[0].trim().replace(/["']/g, '')
    }
    out.push(...walkInline(node.children ?? [], child))
  }
  return out
}

function alignmentFor(style: string | undefined): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const v = styleValue(style, 'text-align')
  if (v === 'center') return AlignmentType.CENTER
  if (v === 'right') return AlignmentType.RIGHT
  if (v === 'justify') return AlignmentType.JUSTIFIED
  if (v === 'left') return AlignmentType.LEFT
  return undefined
}

function spacingFor(style: string | undefined) {
  const v = styleValue(style, 'line-height')
  if (!v) return undefined
  const mult = parseFloat(v)
  if (!mult || Number.isNaN(mult)) return undefined
  return { line: Math.round(mult * 240), lineRule: 'auto' as const }
}

function walkBlock(node: Element, out: (Paragraph | Table)[], listRef?: { type: 'bullet' | 'ordered'; level: number }) {
  const tag = node.name

  if (tag === 'p' || tag === 'div') {
    const runs = walkInline(node.children ?? [], {})
    out.push(new Paragraph({
      children: runs.length ? runs : [new TextRun('')],
      alignment: alignmentFor(node.attribs.style),
      spacing: spacingFor(node.attribs.style),
      ...(listRef?.type === 'bullet' ? { bullet: { level: listRef.level } } : {}),
      ...(listRef?.type === 'ordered' ? { numbering: { reference: 'doc-numbering', level: listRef.level } } : {}),
    }))
    return
  }
  if (HEADING_LEVELS[tag]) {
    const runs = walkInline(node.children ?? [], {})
    out.push(new Paragraph({ heading: HEADING_LEVELS[tag], children: runs, alignment: alignmentFor(node.attribs.style) }))
    return
  }
  if (tag === 'ul' || tag === 'ol') {
    for (const li of (node.children ?? []).filter(isElement)) {
      if (li.name !== 'li') continue
      const runs = walkInline(li.children ?? [], {})
      out.push(new Paragraph({
        children: runs,
        ...(tag === 'ul' ? { bullet: { level: 0 } } : { numbering: { reference: 'doc-numbering', level: 0 } }),
      }))
    }
    return
  }
  if (tag === 'table') {
    const rows: TableRow[] = []
    const sections = (node.children ?? []).filter(isElement)
    const trGroups = sections.flatMap(s => (s.name === 'tbody' || s.name === 'thead') ? (s.children ?? []).filter(isElement) : [s])
    for (const tr of trGroups) {
      if (tr.name !== 'tr') continue
      const cells: TableCell[] = []
      for (const td of (tr.children ?? []).filter(isElement)) {
        if (td.name !== 'td' && td.name !== 'th') continue
        const runs = walkInline(td.children ?? [], td.name === 'th' ? { bold: true } : {})
        cells.push(new TableCell({ children: [new Paragraph({ children: runs.length ? runs : [new TextRun('')] })] }))
      }
      if (cells.length) rows.push(new TableRow({ children: cells }))
    }
    if (rows.length) out.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }))
    return
  }

  // Balise inconnue (ex: mark/span isolé hors paragraphe) : on ne perd pas
  // son texte, on le remonte comme un paragraphe simple.
  const runs = walkInline(node.children ?? [], {})
  if (runs.length) out.push(new Paragraph({ children: runs }))
}

export async function convertHtmlToDocx(html: string, title: string): Promise<Buffer> {
  const dom = parseDocument(html || '<p></p>')
  const blocks: (Paragraph | Table)[] = []
  for (const node of dom.children) {
    if (isElement(node)) walkBlock(node, blocks)
  }
  if (blocks.length === 0) blocks.push(new Paragraph({ children: [new TextRun('')] }))

  const doc = new Document({
    title,
    numbering: {
      config: [{
        reference: 'doc-numbering',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{ children: blocks }],
  })

  return Packer.toBuffer(doc)
}
