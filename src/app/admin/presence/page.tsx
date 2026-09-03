export const dynamic = 'force-dynamic'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import QRCode from 'qrcode'
import PresenceAdminClient from './PresenceAdminClient'

export default async function PresenceAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) redirect('/admin/comptes')

  const admin = createAdminClient()
  const { data: config } = await admin
    .from('presence_config').select('id, slug, questions, motifs').order('updated_at', { ascending: false }).limit(1).single()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
  const lien = `${appUrl}/presence/${config?.slug ?? ''}`
  const qrDataUrl = config ? await QRCode.toDataURL(lien, { width: 320, margin: 1 }) : null

  const { data: enregistrements } = await admin
    .from('presence_enregistrements').select('*').order('created_at', { ascending: false }).limit(500)

  return (
    <div className="page-container">
      <PresenceAdminClient
        config={config as any}
        lien={lien}
        qrDataUrl={qrDataUrl}
        enregistrements={(enregistrements ?? []) as any[]}
      />
    </div>
  )
}
