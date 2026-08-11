'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { TITRES, TITRE_LABELS, TYPES_EMPLOI, TYPE_EMPLOI_LABELS, type Titre, type TypeEmploi } from '@/lib/roles'
import { getNiveauFonction, NIVEAUX_AVEC_SENIORITE, SENIORITES, SENIORITE_LABELS, type Seniorite } from '@/lib/bareme'

type Profil = { id: string; prenoms: string; nom: string; email: string; titre: string | null; type_emploi: string | null; role: string; seniorite: string | null }

function requiertSeniorite(titre: string | null) {
  const niveau = getNiveauFonction(titre)
  return !!niveau && NIVEAUX_AVEC_SENIORITE.includes(niveau)
}

export default function GestionTitres() {
  const supabase = createClient()
  const [profils, setProfils] = useState<Profil[]>([])
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('id,prenoms,nom,email,titre,type_emploi,role,seniorite')
      .order('nom')
    setProfils((data as any) ?? [])
  }
  useEffect(() => { load() }, [])

  async function attribuer(cible: string, titre: Titre, type: TypeEmploi | '', seniorite: Seniorite | '') {
    setMsg('')
    const { error } = await supabase.rpc('attribuer_titre', {
      cible,
      nouveau_titre: titre,
      nouveau_type: type || null,
      nouvelle_seniorite: seniorite || null,
    })
    if (error) setMsg('Erreur : ' + error.message)
    else { setMsg('Titre mis à jour.'); load() }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Attribution des titres &amp; accès</h3>
      <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 16 }}>
        Choisissez le titre (poste) et le type d'emploi. Le changement de rôle/accès système se fait depuis Comptes (réservé au superadmin).
        Pour les postes concernés (Représentant Pays, Programme Lead, Responsable Communication, Chargé de Projet), l'ancienneté est requise pour que le barème de rémunération s'applique correctement lors de la validation des timesheets.
      </p>
      {msg && <p style={{ fontSize: 13, marginBottom: 12, color: msg.startsWith('Erreur') ? '#991b1b' : '#166534' }}>{msg}</p>}
      <div className="table-wrap">
      <table style={{ minWidth: 560 }}>
        <thead>
          <tr>
            <th>Personnel</th>
            <th>Type d'emploi</th>
            <th>Titre / Poste</th>
            <th>Ancienneté</th>
          </tr>
        </thead>
        <tbody>
          {profils.map(p => (
            <tr key={p.id}>
              <td>
                {p.prenoms} {p.nom}
                <br /><span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>{p.email}</span>
              </td>
              <td>
                <select className="select" defaultValue={p.type_emploi ?? ''}
                  onChange={e => attribuer(p.id, (p.titre as Titre) ?? 'assistant_admin', e.target.value as TypeEmploi, (p.seniorite as Seniorite) ?? '')}>
                  <option value="">—</option>
                  {TYPES_EMPLOI.map(t => <option key={t} value={t}>{TYPE_EMPLOI_LABELS[t]}</option>)}
                </select>
              </td>
              <td>
                <select className="select" defaultValue={p.titre ?? ''}
                  onChange={e => attribuer(p.id, e.target.value as Titre, (p.type_emploi as TypeEmploi) ?? '', (p.seniorite as Seniorite) ?? '')}>
                  <option value="">—</option>
                  {TITRES.map(t => <option key={t} value={t}>{TITRE_LABELS[t]}</option>)}
                </select>
              </td>
              <td>
                {requiertSeniorite(p.titre) ? (
                  <select className="select" defaultValue={p.seniorite ?? ''}
                    onChange={e => attribuer(p.id, (p.titre as Titre) ?? 'assistant_admin', (p.type_emploi as TypeEmploi) ?? '', e.target.value as Seniorite)}>
                    <option value="">—</option>
                    {SENIORITES.map(s => <option key={s} value={s}>{SENIORITE_LABELS[s]}</option>)}
                  </select>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--abed-muted)' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}
