export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase-server'
import { verifyExternalSignerToken } from '@/lib/external-signer-token'
import ExterneSignerClient from './ExterneSignerClient'

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: '#f4f6f9' }}>
      <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 32px rgba(0,0,0,.10)', padding: '40px 36px', maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ color: '#991b1b', fontSize: 20, fontWeight: 800, margin: '0 0 12px' }}>{title}</h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>{message}</p>
      </div>
    </div>
  )
}

export default async function SignatureExterneePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  const token = t ?? ''

  const payload = verifyExternalSignerToken(token)
  if (!payload) {
    return <ErrorCard title="Lien invalide ou expiré" message="Ce lien de signature n'est plus valide. Contactez la personne qui vous a envoyé la demande pour en recevoir un nouveau." />
  }

  const admin = createAdminClient()

  const { data: signataire } = await admin
    .from('signataires')
    .select('id, demande_id, email, nom_externe, signe, signe_le')
    .eq('id', payload.signataireId)
    .single()

  if (!signataire || signataire.email !== payload.email) {
    return <ErrorCard title="Lien invalide" message="Ce lien de signature est introuvable ou ne correspond plus à une demande active." />
  }

  const { data: demande } = await admin
    .from('demandes_signature')
    .select('id, titre, description, fichier_url, statut')
    .eq('id', signataire.demande_id)
    .single()

  if (!demande) {
    return <ErrorCard title="Document introuvable" message="La demande de signature associée à ce lien n'existe plus." />
  }

  return (
    <ExterneSignerClient
      token={token}
      titre={demande.titre}
      description={demande.description}
      fichierUrl={demande.fichier_url ?? null}
      demandeComplete={demande.statut === 'complete'}
      dejaSigne={signataire.signe}
      signeLe={signataire.signe_le}
      nomExterne={signataire.nom_externe}
      email={signataire.email ?? ''}
    />
  )
}
