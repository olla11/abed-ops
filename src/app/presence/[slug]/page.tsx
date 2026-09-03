// Formulaire public d'enregistrement de présence — aucun compte My ABED
// nécessaire, accessible via un lien/QR distribué aux visiteurs. Le slug
// dans l'URL doit correspondre au lien courant (presence_config.slug) ;
// un ancien lien remplacé par un nouveau (personnalisé ou régénéré) cesse
// de fonctionner, comme pour les autres liens publics de l'app.
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase-server'
import PresenceForm from './PresenceForm'
import type { PresenceQuestion } from '@/lib/presence'

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f4f6f9', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#991b1b', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>{title}</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}

export default async function PresencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: config } = await admin
    .from('presence_config').select('id, slug, questions, motifs').eq('slug', slug).single()

  if (!config) {
    return <ErrorCard title="Lien invalide" message="Ce lien d'enregistrement n'est plus actif. Demandez le lien ou le QR code à jour à l'accueil." />
  }

  return (
    <PresenceForm
      slug={config.slug}
      motifs={(config.motifs as string[]) ?? []}
      questions={(config.questions as PresenceQuestion[]) ?? []}
    />
  )
}
