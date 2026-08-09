import { cookies } from 'next/headers'

export const VALID_ROLES = ['admin', 'rh', 'caf', 'de', 'dp', 'aaf', 'administrateur', 'manager', 'missionnaire', 'prestataire']

export async function getEffectiveRole(realRole: string): Promise<string> {
  // Le cookie de simulation peut être posé par un admin OU un superadmin
  // (voir /api/admin/role-preview) — il fallait aussi le respecter ici, sinon
  // le simulateur ne faisait strictement rien pour un compte superadmin.
  if (!['admin', 'superadmin'].includes(realRole)) return realRole
  const jar = await cookies()
  const preview = jar.get('role_preview')?.value
  if (preview && VALID_ROLES.includes(preview)) return preview
  return realRole
}

export async function getRolePreview(): Promise<string | null> {
  const jar = await cookies()
  const preview = jar.get('role_preview')?.value
  if (preview && VALID_ROLES.includes(preview)) return preview
  return null
}
