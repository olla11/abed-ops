export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { describeLogEntry } from '@/lib/audit-log-labels'

const TONE_COLORS: Record<string, { fg: string; bg: string }> = {
  read: { fg: '#374151', bg: '#f3f4f6' },
  write: { fg: '#166534', bg: '#f0fdf4' },
  danger: { fg: '#991b1b', bg: '#fef2f2' },
}

function adminClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const fmtDateTime = (d: string) => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function SectionCard({ title, count, rows, cols }: { title: string; count: number; rows: Record<string, string>[]; cols: string[] }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ fontSize: 14, margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--abed-green)' }}>{count}</span>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--abed-muted)', margin: 0 }}>Aucun élément.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, padding: '6px 0', borderBottom: i < rows.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
              {cols.map(c => <span key={c} style={{ color: c === cols[0] ? '#111827' : 'var(--abed-muted)' }}>{r[c]}</span>)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default async function JournalUserPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'superadmin') redirect('/admin/comptes')

  const admin = adminClient()

  const [{ data: profile }, { data: activite }, { data: missions }, { data: conges }, { data: contrats }, { data: paiements }, { data: tdrs }] = await Promise.all([
    admin.from('profiles').select('*').eq('id', userId).single(),
    admin.from('audit_log').select('method, path, ip, created_at').eq('actor_id', userId).order('created_at', { ascending: false }).limit(100),
    admin.from('missions').select('id, reference, objet, status, created_at').eq('missionnaire_id', userId).order('created_at', { ascending: false }).limit(5),
    admin.from('conges').select('id, statut, date_debut, date_fin, created_at').eq('profile_id', userId).order('created_at', { ascending: false }).limit(5),
    admin.from('contrats').select('id, statut, type_contrat, date_debut, created_at').eq('profile_id', userId).order('created_at', { ascending: false }).limit(5),
    admin.from('demandes_paiement').select('id, statut, objet, montant, created_at').eq('demandeur_id', userId).order('created_at', { ascending: false }).limit(5),
    admin.from('tdrs').select('id, numero, titre_activite, statut, created_at').eq('initiateur_id', userId).order('created_at', { ascending: false }).limit(5),
  ])

  if (!profile) redirect('/admin/journal')

  const [{ count: nbMissions }, { count: nbConges }, { count: nbContrats }, { count: nbPaiements }, { count: nbTdrs }] = await Promise.all([
    admin.from('missions').select('id', { count: 'exact', head: true }).eq('missionnaire_id', userId),
    admin.from('conges').select('id', { count: 'exact', head: true }).eq('profile_id', userId),
    admin.from('contrats').select('id', { count: 'exact', head: true }).eq('profile_id', userId),
    admin.from('demandes_paiement').select('id', { count: 'exact', head: true }).eq('demandeur_id', userId),
    admin.from('tdrs').select('id', { count: 'exact', head: true }).eq('initiateur_id', userId),
  ])

  return (
    <div>
      <Link href="/admin/journal" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16, textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Retour au journal
      </Link>

      <div className="card" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', margin: '0 0 4px' }}>{profile.prenoms} {profile.nom}</h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>{profile.email} {profile.telephone ? `· ${profile.telephone}` : ''}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: '#f0fdf4', color: 'var(--abed-green)' }}>
            {profile.role}
          </span>
          {profile.fonction && <div style={{ fontSize: 12, color: 'var(--abed-muted)', marginTop: 6 }}>{profile.fonction}</div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        <div>
          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Activité récente ({activite?.length ?? 0})</h3>
            <div style={{ maxHeight: 560, overflowY: 'auto' }}>
              {(activite ?? []).length === 0 && <p style={{ fontSize: 12, color: 'var(--abed-muted)' }}>Aucune activité enregistrée.</p>}
              {(activite ?? []).map((a, i) => {
                const desc = describeLogEntry(a.method, a.path)
                const tone = TONE_COLORS[desc.tone]
                return (
                  <div key={i} style={{ padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                      <span style={{ color: 'var(--abed-muted)', whiteSpace: 'nowrap', fontSize: 11.5 }}>{fmtDateTime(a.created_at)}</span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: 6, background: tone.bg, flexShrink: 0,
                      }}>
                        <desc.Icon size={11} color={tone.fg} />
                      </span>
                      <span style={{ color: tone.fg }}>{desc.label}</span>
                    </div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#9ca3af', marginTop: 2, marginLeft: 62 }}>
                      {a.method} {a.path}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div>
          <SectionCard title="Missions" count={nbMissions ?? 0} cols={['reference', 'status']}
            rows={(missions ?? []).map(m => ({ reference: m.reference ?? m.objet ?? '—', status: m.status }))} />
          <SectionCard title="Congés" count={nbConges ?? 0} cols={['periode', 'statut']}
            rows={(conges ?? []).map(c => ({ periode: `${fmt(c.date_debut)} → ${fmt(c.date_fin)}`, statut: c.statut }))} />
          <SectionCard title="Contrats" count={nbContrats ?? 0} cols={['type', 'statut']}
            rows={(contrats ?? []).map(c => ({ type: c.type_contrat, statut: c.statut }))} />
          <SectionCard title="Demandes de paiement" count={nbPaiements ?? 0} cols={['objet', 'statut']}
            rows={(paiements ?? []).map(p => ({ objet: p.objet ?? '—', statut: p.statut }))} />
          <SectionCard title="TDR initiés" count={nbTdrs ?? 0} cols={['titre', 'statut']}
            rows={(tdrs ?? []).map(t => ({ titre: t.titre_activite ?? t.numero ?? '—', statut: t.statut }))} />
        </div>
      </div>
    </div>
  )
}
