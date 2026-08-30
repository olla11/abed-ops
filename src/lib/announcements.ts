import type { SupabaseClient } from '@supabase/supabase-js'

export type PieceJointeMeta = { path: string; filename: string; contentType: string; size?: number }

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineFormat(line: string): string {
  let s = escapeHtml(line)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>')
  return s
}

// Mise en forme légère du corps d'un message de communication ciblée —
// **gras**, *italique*, lignes "- " en liste à puces — convertie en HTML
// pour l'email. Volontairement minimal (pas de vrai markdown) pour rester
// simple à taper et à comprendre dans le textarea côté admin.
export function corpsToHtml(corps: string): string {
  const lines = corps.split('\n')
  const parts: string[] = []
  let inList = false
  for (const line of lines) {
    const bullet = line.match(/^\s*-\s+(.*)$/)
    if (bullet) {
      if (!inList) { parts.push('<ul style="margin:8px 0;padding-left:22px;">'); inList = true }
      parts.push(`<li style="margin-bottom:4px;">${inlineFormat(bullet[1])}</li>`)
    } else {
      if (inList) { parts.push('</ul>'); inList = false }
      if (line.trim() === '') parts.push('<div style="height:10px;"></div>')
      else parts.push(`<div>${inlineFormat(line)}</div>`)
    }
  }
  if (inList) parts.push('</ul>')
  return parts.join('\n')
}

// Version texte brut (sans balises) pour les notifications in-app, qui
// n'interprètent pas le HTML.
export function corpsToPlainText(corps: string): string {
  return corps.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
}

// Télécharge les pièces jointes stockées dans le bucket announcement-attachments
// et les encode en base64 pour sendEmail() — utilisé aussi bien à l'envoi
// immédiat que par le cron d'envoi programmé.
export async function resolveAttachments(
  admin: SupabaseClient,
  piecesJointes: PieceJointeMeta[]
): Promise<{ filename: string; content: string }[]> {
  const attachments: { filename: string; content: string }[] = []
  for (const pj of piecesJointes) {
    const { data, error } = await admin.storage.from('announcement-attachments').download(pj.path)
    if (error || !data) {
      console.error('[announcements] échec téléchargement pièce jointe', pj.path, error?.message)
      continue
    }
    const buffer = Buffer.from(await data.arrayBuffer())
    attachments.push({ filename: pj.filename, content: buffer.toString('base64') })
  }
  return attachments
}
