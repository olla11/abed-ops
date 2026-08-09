import { cookies } from 'next/headers'

export interface ImpersonationInfo {
  adminId: string
  adminNom: string
  adminPrenoms: string
  targetNom: string
  targetPrenoms: string
  targetRole: string
}

export async function getImpersonationInfo(): Promise<ImpersonationInfo | null> {
  const jar = await cookies()
  const raw = jar.get('impersonation_info')?.value
  if (!raw) return null
  try {
    return JSON.parse(raw) as ImpersonationInfo
  } catch {
    return null
  }
}
