import { cookies } from 'next/headers'

export const VALID_ROLES = ['admin', 'rh', 'caf', 'de', 'dp', 'aaf', 'administrateur', 'manager', 'missionnaire', 'prestataire']

export async function getEffectiveRole(realRole: string): Promise<string> {
  if (realRole !== 'admin') return realRole
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
