'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'

// Départ minimum : aujourd'hui (mais un avertissement s'affiche si c'est aujourd'hui)
function minDepart() {
  return new Date().toISOString().split('T')[0]
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split('T')[0]
}

// Retour maximum : départ + 1 an
function maxRetour(depart: string) {
  if (!depart) return ''
  const d = new Date(depart)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().split('T')[0]
}

export default function NouvelleMission() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [pourTiers, setPourTiers] = useState(false)
  const [form, setForm] = useState({
    objet: '',
    lieu: '',
    moyen_transport: '',
    conducteur_a_bord: '',
    date_depart: '',
    date_arrivee_destination: '',
    date_depart_destination: '',
    date_retour: '',
    imputation: '',
    a_charge_partenaire: false,
  })
  // Identité du missionnaire quand l'OM est demandé pour un tiers hors
  // système (pas de compte My ABED) — mêmes champs que ceux imprimés sur le
  // PDF de l'OM depuis un profil, mais saisis à la main.
  const [externe, setExterne] = useState({
    missionnaire_externe_civilite: '',
    missionnaire_externe_prenoms: '',
    missionnaire_externe_nom: '',
    missionnaire_externe_email: '',
    missionnaire_externe_telephone: '',
    missionnaire_externe_fonction: '',
    missionnaire_externe_ifu: '',
    missionnaire_externe_nationalite: '',
    missionnaire_externe_date_naissance: '',
    missionnaire_externe_lieu_naissance: '',
    missionnaire_externe_adresse: '',
    missionnaire_externe_grade_indice: '',
  })

  function set(k: keyof typeof form, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }))
  }

  function setExt(k: keyof typeof externe, v: string) {
    setExterne(f => ({ ...f, [k]: v }))
  }

  function validate(): string | null {
    const today = minDepart()
    if (form.date_depart && form.date_depart < today) {
      return `La date de départ ne peut pas être dans le passé.`
    }
    if (form.date_retour && form.date_depart && form.date_retour <= form.date_depart) {
      return 'La date de retour doit être après la date de départ.'
    }
    if (form.date_retour && form.date_depart) {
      const max = maxRetour(form.date_depart)
      if (form.date_retour > max) return 'La durée de la mission ne peut pas dépasser 1 an.'
    }
    if (pourTiers && (!externe.missionnaire_externe_prenoms.trim() || !externe.missionnaire_externe_nom.trim())) {
      return 'Prénoms et nom du missionnaire sont obligatoires.'
    }
    return null
  }

  async function submit(e: React.FormEvent, statut: 'brouillon' | 'soumis') {
    e.preventDefault()
    if (statut === 'soumis' || pourTiers) {
      const validErr = validate()
      if (validErr) { setErr(validErr); return }
    }
    setSaving(true); setErr('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const payload = { ...form, ...(pourTiers ? externe : {}) }

    if (statut === 'soumis') {
      // Passer par l'API pour déclencher les notifications aux signataires (DE, CAF, administrateur)
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, pourTiers, status: statut }),
      })
      const data = await res.json()
      setSaving(false)
      if (!res.ok) setErr(data.error ?? 'Erreur lors de la soumission')
      else router.push('/dashboard')
    } else {
      const { error } = await supabase.from('missions').insert({
        ...payload,
        missionnaire_id: pourTiers ? null : user.id,
        demandeur_id: user.id,
        status: statut,
      })
      setSaving(false)
      if (error) setErr(error.message)
      else router.push('/dashboard')
    }
  }

  const today = minDepart()
  const sameDayWarning = form.date_depart && isToday(form.date_depart)

  return (
    <div className="page-container">
      <Link href="/dashboard" style={{ fontSize: 13, color: 'var(--abed-muted)' }}>← Retour</Link>
      <h2 style={{ color: 'var(--abed-green)', margin: '12px 0 24px' }}>Demander un Ordre de Mission</h2>
      <div className="card">
        <form>

          <div className="field">
            <label className="label">Cet OM est demandé pour</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setPourTiers(false)}
                className={pourTiers ? 'btn secondary' : 'btn'} style={{ flex: 1 }}>
                Moi-même
              </button>
              <button type="button" onClick={() => setPourTiers(true)}
                className={pourTiers ? 'btn' : 'btn secondary'} style={{ flex: 1 }}>
                Un tiers (sans compte My ABED)
              </button>
            </div>
          </div>

          {pourTiers && (
            <div style={{ background: '#f9fafb', border: '1px solid var(--abed-border)', borderRadius: 8, padding: 16, marginBottom: 18 }}>
              <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--abed-muted)' }}>
                Identité du missionnaire — cette personne n&apos;a pas de compte My ABED, ces informations remplacent son profil sur l&apos;OM.
              </p>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="label">Civilité</label>
                  <select className="input" value={externe.missionnaire_externe_civilite}
                    onChange={e => setExt('missionnaire_externe_civilite', e.target.value)}>
                    <option value="">—</option>
                    <option value="M.">M.</option>
                    <option value="Mme">Mme</option>
                  </select>
                </div>
                <div className="field">
                  <label className="label">Prénoms *</label>
                  <input className="input" value={externe.missionnaire_externe_prenoms}
                    onChange={e => setExt('missionnaire_externe_prenoms', e.target.value)} required={pourTiers} />
                </div>
                <div className="field">
                  <label className="label">Nom *</label>
                  <input className="input" value={externe.missionnaire_externe_nom}
                    onChange={e => setExt('missionnaire_externe_nom', e.target.value)} required={pourTiers} />
                </div>
              </div>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="label">Email (pour lui envoyer l&apos;OM signé)</label>
                  <input className="input" type="email" value={externe.missionnaire_externe_email}
                    onChange={e => setExt('missionnaire_externe_email', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Téléphone</label>
                  <input className="input" value={externe.missionnaire_externe_telephone}
                    onChange={e => setExt('missionnaire_externe_telephone', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Fonction</label>
                  <input className="input" value={externe.missionnaire_externe_fonction}
                    onChange={e => setExt('missionnaire_externe_fonction', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Qualité / Grade / Indice</label>
                  <input className="input" value={externe.missionnaire_externe_grade_indice}
                    onChange={e => setExt('missionnaire_externe_grade_indice', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Numéro IFU</label>
                  <input className="input" value={externe.missionnaire_externe_ifu}
                    onChange={e => setExt('missionnaire_externe_ifu', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Nationalité</label>
                  <input className="input" value={externe.missionnaire_externe_nationalite}
                    onChange={e => setExt('missionnaire_externe_nationalite', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Date de naissance</label>
                  <input className="input" type="date" value={externe.missionnaire_externe_date_naissance}
                    onChange={e => setExt('missionnaire_externe_date_naissance', e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">Lieu de naissance</label>
                  <input className="input" value={externe.missionnaire_externe_lieu_naissance}
                    onChange={e => setExt('missionnaire_externe_lieu_naissance', e.target.value)} />
                </div>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label className="label">Adresse</label>
                  <input className="input" value={externe.missionnaire_externe_adresse}
                    onChange={e => setExt('missionnaire_externe_adresse', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <label className="label">Objet de la mission *</label>
            <input className="input" value={form.objet} onChange={e => set('objet', e.target.value)} required />
          </div>

          <div className="field">
            <label className="label">Lieu de la mission *</label>
            <input className="input" value={form.lieu} onChange={e => set('lieu', e.target.value)} required />
          </div>

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label className="label">Moyen de transport</label>
              <select className="input" value={form.moyen_transport} onChange={e => set('moyen_transport', e.target.value)}>
                <option value="">— Choisir —</option>
                <option>Véhicule de service</option>
                <option>Moto</option>
                <option>Bus / transport commun</option>
                <option>Avion</option>
              </select>
            </div>
            <div className="field">
              <label className="label">Conducteur à bord</label>
              <input className="input" placeholder="Nom du conducteur (si véhicule de service)"
                value={form.conducteur_a_bord} onChange={e => set('conducteur_a_bord', e.target.value)} />
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: '4px 0 12px' }}>
            Dates du voyage — le départ peut être aujourd&apos;hui ou plus tard.
          </p>
          {sameDayWarning && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
                <strong>Attention :</strong> Vous effectuez une demande d&apos;ordre de mission le jour même de la mission. Cela n&apos;est pas conforme aux procédures internes qui exigent que la demande soit soumise à l&apos;avance. Votre demande sera traitée, mais veuillez respecter les délais à l&apos;avenir.
              </p>
            </div>
          )}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label className="label">Départ de l'origine *</label>
              <input className="input" type="date" value={form.date_depart}
                min={today}
                onChange={e => set('date_depart', e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Arrivée à destination</label>
              <input className="input" type="date" value={form.date_arrivee_destination}
                min={form.date_depart || today}
                onChange={e => set('date_arrivee_destination', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Départ de la destination</label>
              <input className="input" type="date" value={form.date_depart_destination}
                min={form.date_arrivee_destination || form.date_depart || today}
                onChange={e => set('date_depart_destination', e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Retour à l'origine *</label>
              <input className="input" type="date" value={form.date_retour}
                min={form.date_depart_destination || form.date_depart || today}
                max={maxRetour(form.date_depart)}
                onChange={e => set('date_retour', e.target.value)} required />
            </div>
          </div>

          <div className="field">
            <label className="label">Imputation budgétaire</label>
            <input className="input" placeholder="ex : IYBA-SEED, FEDSAEI…"
              value={form.imputation} onChange={e => set('imputation', e.target.value)} />
          </div>

          <div className="field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.a_charge_partenaire}
                onChange={e => set('a_charge_partenaire', e.target.checked)} />
              <span>Mission à charge d'un partenaire (prélèvement 20 % applicable)</span>
            </label>
          </div>

          {err && <p style={{ color: 'var(--abed-danger)', fontSize: 13, marginBottom: 12 }}>{err}</p>}

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn secondary" disabled={saving}
              onClick={e => submit(e, 'brouillon')}>
              {saving ? '…' : 'Enregistrer brouillon'}
            </button>
            <button type="button" className="btn"
              disabled={saving || !form.objet || !form.lieu || !form.date_depart || !form.date_retour
                || (pourTiers && (!externe.missionnaire_externe_prenoms.trim() || !externe.missionnaire_externe_nom.trim()))}
              onClick={e => submit(e, 'soumis')}>
              {saving ? 'Envoi…' : 'Soumettre pour signature'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
