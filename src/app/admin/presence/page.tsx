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
  const { data: config, error: configError } = await admin
    .from('presence_config').select('id, slug, questions, motifs').order('updated_at', { ascending: false }).limit(1).single()
  // Diagnostic temporaire : la cause exacte d'un échec ici (table absente du
  // cache PostgREST, RLS, etc.) était invisible jusqu'ici — l'erreur était
  // récupérée mais jamais journalisée ni affichée.
  if (configError) console.error('[admin/presence] échec lecture presence_config:', configError)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myabed.vercel.app'
  const lien = `${appUrl}/presence/${config?.slug ?? ''}`
  const qrDataUrl = config ? await QRCode.toDataURL(lien, { width: 320, margin: 1 }) : null

  const { data: enregistrements, error: enregistrementsError } = await admin
    .from('presence_enregistrements').select('*').order('created_at', { ascending: false }).limit(500)
  if (enregistrementsError) console.error('[admin/presence] échec lecture presence_enregistrements:', enregistrementsError)

  return (
    <div className="page-container">
      <PresenceAdminClient
        config={config as any}
        configError={configError ? `${configError.message} (${configError.code ?? '?'})` : null}
        lien={lien}
        qrDataUrl={qrDataUrl}
        enregistrements={(enregistrements ?? []) as any[]}
      />
    </div>
  )
}
