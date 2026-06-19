import { createClient as createServiceClient } from '@supabase/supabase-js'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

const fmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 13, color: '#111827' }}>{value}</span>
    </div>
  )
}

export default async function VerifyOMPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: m } = await service
    .from('missions')
    .select(`
      id, reference, objet, lieu, status, signe_le,
      date_depart, date_arrivee_destination, date_depart_destination, date_retour,
      moyen_transport, imputation,
      missionnaire:profiles!missions_missionnaire_id_fkey(nom, prenoms, fonction, grade_indice),
      signataire:profiles!missions_signe_par_fkey(nom, prenoms, role, civilite)
    `)
    .eq('id', id)
    .single()

  const isSigne = m && ['signe', 'cloture'].includes(m.status)
  const sg = (m?.signataire as any)
  const mn = (m?.missionnaire as any)

  let signataireLabel = ''
  if (isSigne) {
    if (sg?.role === 'caf') {
      const { data: de } = await service.from('profiles').select('civilite').eq('role', 'de').single()
      const deCiv = (de as any)?.civilite ?? 'M.'
      signataireLabel = deCiv === 'Mme'
        ? 'La Directrice Exécutive (P.O. CAF)'
        : 'Le Directeur Exécutif (P.O. CAF)'
    } else if (sg?.role === 'administrateur') {
      signataireLabel = sg?.civilite === 'Mme' ? 'Administratrice' : 'Administrateur'
    } else {
      signataireLabel = sg?.civilite === 'Mme' ? 'La Directrice Exécutive' : 'Le Directeur Exécutif'
    }
  }

  const green = '#2d7a31'

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Vérification OM — ABED ONG</title>
        <meta name="robots" content="noindex" />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb', minHeight: '100vh' }}>

        {/* Header */}
        <div style={{ background: green, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: 'white', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center' }}>
            <img src="/logoabed2.png" alt="ABED" style={{ height: 40, display: 'block' }} />
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 16 }}>ABED ONG</div>
            <div style={{ color: 'rgba(255,255,255,.8)', fontSize: 12 }}>Vérification d'Ordre de Mission</div>
          </div>
        </div>

        <div style={{ maxWidth: 640, margin: '32px auto', padding: '0 16px' }}>

          {!m ? (
            <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❓</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Document introuvable</div>
              <p style={{ color: '#6b7280', fontSize: 14 }}>Ce QR code ne correspond à aucun ordre de mission enregistré dans My ABED.</p>
            </div>
          ) : !isSigne ? (
            <div style={{ background: 'white', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>OM non encore signé</div>
              <p style={{ color: '#6b7280', fontSize: 14 }}>Cet ordre de mission est en cours de traitement et n'a pas encore été signé.</p>
            </div>
          ) : (
            <>
              {/* Bandeau certification */}
              <div style={{
                background: '#f0fdf4', border: '2px solid #86efac', borderRadius: 12,
                padding: '20px 24px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'flex-start',
              }}>
                <div style={{ fontSize: 36, flexShrink: 0 }}>✅</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#166534', marginBottom: 4 }}>
                    Ordre de Mission certifié
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#15803d', lineHeight: 1.6 }}>
                    Ce document a été émis et signé officiellement par <strong>ABED ONG</strong> via la plateforme <strong>My ABED</strong> le <strong>{fmt(m.signe_le)}</strong>.
                    Son authenticité est garantie par le système de gestion interne d'ABED.
                  </p>
                </div>
              </div>

              {/* Infos OM */}
              <div style={{ background: 'white', borderRadius: 12, padding: '24px 28px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: green, marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${green}` }}>
                  Ordre de Mission N° {m.reference ?? '—'}
                </div>

                <Row label="Missionnaire" value={`${mn?.prenoms ?? ''} ${mn?.nom ?? ''}`.trim()} />
                <Row label="Fonction" value={mn?.fonction ?? '—'} />
                {mn?.grade_indice && <Row label="Grade / Indice" value={mn.grade_indice} />}
                <Row label="Objet de la mission" value={m.objet ?? '—'} />
                <Row label="Lieu" value={m.lieu ?? '—'} />
                <Row label="Moyen de transport" value={(m as any).moyen_transport ?? '—'} />
                <Row label="Départ de l'origine" value={fmt(m.date_depart)} />
                <Row label="Arrivée à destination" value={fmt((m as any).date_arrivee_destination)} />
                <Row label="Départ de la destination" value={fmt((m as any).date_depart_destination)} />
                <Row label="Retour à l'origine" value={fmt(m.date_retour)} />
                <Row label="Imputation budgétaire" value={(m as any).imputation ?? 'ABED'} />

                <div style={{ marginTop: 20, padding: '14px 16px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Signé par</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>
                    {`${sg?.prenoms ?? ''} ${sg?.nom ?? ''}`.trim()}
                  </div>
                  <div style={{ fontSize: 12, color: green, fontWeight: 600 }}>{signataireLabel}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Date de signature : {fmt(m.signe_le)}</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', padding: '0 0 32px' }}>
                <div>Vérifié via My ABED — Système de gestion interne d'ABED ONG</div>
                <div style={{ marginTop: 4 }}>Agriculture pour le Bien-Être et le Développement Durable · Parakou, Bénin</div>
              </div>
            </>
          )}
        </div>
      </body>
    </html>
  )
}
