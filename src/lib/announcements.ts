import type { SupabaseClient } from '@supabase/supabase-js'

export type PieceJointeMeta = { path: string; filename: string; contentType: string; size?: number }

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
