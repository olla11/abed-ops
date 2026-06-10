// Validation des fichiers uploadés (type + taille).
// Le contentType est déterminé côté serveur à partir de l'extension validée,
// jamais à partir de file.type qui est contrôlé par le client.

const MIME_BY_EXT: Record<string, string> = {
  pdf:  'application/pdf',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

// Justificatifs, timesheets, factures…
export const DOCUMENT_EXTS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx', 'xls', 'xlsx']
// Signatures / cachets : images uniquement
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp']

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024 // 10 Mo

type ValidateOk = { ok: true; ext: string; contentType: string }
type ValidateErr = { ok: false; error: string }

export function validateUpload(
  file: File,
  { allowed, maxBytes = DEFAULT_MAX_BYTES }: { allowed: string[]; maxBytes?: number }
): ValidateOk | ValidateErr {
  if (file.size === 0) return { ok: false, error: 'Fichier vide' }
  if (file.size > maxBytes) {
    return { ok: false, error: `Fichier trop volumineux (max ${Math.round(maxBytes / 1024 / 1024)} Mo)` }
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!allowed.includes(ext)) {
    return { ok: false, error: `Type de fichier non autorisé (.${ext}). Autorisés : ${allowed.join(', ')}` }
  }
  return { ok: true, ext, contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream' }
}
