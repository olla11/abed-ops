'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Soumission = {
  id: string; titre: string; type: string; status: string
  montant: number | null; periode_mois: number | null; periode_annee: number | null
  date_limite: string | null
  prestataire: { prenoms: string; nom: string } | null
}

// Le responsable direct (manager_id) valide les soumissions de son équipe,
// conformément à PO-03 : validation technique avant transmission au paiement.
export default function ValidationManager() {
  const supabase = createClient()
  const [items, setItems] = useState<Soumission[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('soumissions')
      .select('id,titre,type,status,montant,periode_mois,periode_annee,date_limite,prestataire:profiles!soumissions_prestataire_id_fkey(prenoms,nom)')
      .eq('manager_id', user.id)
      .order('created_at', { ascending: false })
    setItems((data as any) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function decider(id: string, status: 'valide' | 'rejete' | 'corrections', commentaire?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('soumissions').update({
      status,
      commentaire_validation: commentaire ?? null,
      valide_par: user?.id,
      valide_le: new Date().toISOString(),
    }).eq('id', id)
    load()
  }

  if (loading) return <p>Chargement…</p>

  return (
    <div className="card">
      <h3 style={{ marginBottom: 16 }}>Soumissions à valider</h3>
      <table>
        <thead>
          <tr><th>Prestataire</th><th>Titre</th><th>Type</th><th>Période</th><th>Échéance</th><th>Statut</th><th>Action</th></tr>
        </thead>
        <tbody>
          {items.map(s => (
            <tr key={s.id}>
              <td>{s.prestataire?.prenoms} {s.prestataire?.nom}</td>
              <td>{s.titre}</td>
              <td>{s.type}</td>
              <td>{s.periode_mois ? `${s.periode_mois}/${s.periode_annee}` : '—'}</td>
              <td style={{ fontSize: 13 }}>{s.date_limite ? new Date(s.date_limite).toLocaleDateString('fr-FR') : '—'}</td>
              <td><span className={`badge ${s.status}`}>{s.status}</span></td>
              <td>
                {s.status === 'soumis' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => decider(s.id, 'valide')}>Valider</button>
                    <button className="btn danger" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => { const c = prompt('Motif du rejet ?') ?? ''; decider(s.id, 'rejete', c) }}>Rejeter</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--abed-muted)' }}>Aucune soumission.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
