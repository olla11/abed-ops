'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'

type Soumission = {
  id: string; titre: string; status: string; periode_mois: number; periode_annee: number
  heures_declarees: number; heures_retenues: number | null; montant_caf: number | null
  commentaire_manager: string | null; commentaire_caf: string | null
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  soumis:           { label: 'En attente manager',          color: '#92660b' },
  valide_tech:      { label: 'Validé techn. — attente CAF', color: '#1e40af' },
  valide_caf:       { label: 'Validé ✓',                   color: '#166534' },
  corrections_tech: { label: 'Corrections demandées',       color: '#9a3412' },
  corrections_caf:  { label: 'Corrections CAF',             color: '#9a3412' },
  rejete_tech:      { label: 'Rejeté (manager)',            color: '#991b1b' },
  rejete_caf:       { label: 'Rejeté (CAF)',                color: '#991b1b' },
}

async function uploadFile(file: File, slot: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('slot', slot)
  const res = await fetch('/api/timesheets/upload', { method: 'POST', body: fd })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? 'upload échoué')
  return json.path as string
}

export default function SoumissionForm({ managerId }: { managerId: string }) {
  const supabase = createClient()
  const [titre, setTitre] = useState('')
  const [mois, setMois] = useState(new Date().getMonth() + 1)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [heures, setHeures] = useState<number | ''>('')
  const [fileTS, setFileTS] = useState<File | null>(null)
  const [fileLiv, setFileLiv] = useState<File | null>(null)
  const [fileFac, setFileFac] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<Soumission[]>([])
  const tsRef = useRef<HTMLInputElement>(null)
  const livRef = useRef<HTMLInputElement>(null)
  const facRef = useRef<HTMLInputElement>(null)

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('soumissions')
      .select('id,titre,status,periode_mois,periode_annee,heures_declarees,heures_retenues,montant_caf,commentaire_manager,commentaire_caf')
      .eq('prestataire_id', user.id)
      .order('created_at', { ascending: false })
    setHistory((data as any) ?? [])
  }

  useEffect(() => { loadHistory() }, [])

  async function submit() {
    if (!titre.trim()) { setMsg('Donnez un titre à votre soumission.'); return }
    if (!heures || heures <= 0) { setMsg('Saisissez le nombre d\'heures déclarées.'); return }
    if (!fileTS) { setMsg('Le fichier Excel timesheet est obligatoire.'); return }
    if (!fileLiv) { setMsg('Le fichier PDF livrable est obligatoire.'); return }
    if (!fileFac) { setMsg('Le fichier PDF facture est obligatoire.'); return }

    setLoading(true); setMsg('Envoi des fichiers…')
    try {
      const [urlTS, urlLiv, urlFac] = await Promise.all([
        uploadFile(fileTS, 'timesheet'),
        uploadFile(fileLiv, 'livrable'),
        uploadFile(fileFac, 'facture'),
      ])
      setMsg('Création de la soumission…')
      const res = await fetch('/api/timesheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre, periode_mois: mois, periode_annee: annee,
          heures_declarees: heures,
          fichier_timesheet_url: urlTS,
          fichier_livrable_url: urlLiv,
          fichier_facture_url: urlFac,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg('Erreur : ' + json.error); setLoading(false); return }
      setMsg('✓ Soumission envoyée à votre responsable technique.')
      setTitre(''); setHeures('')
      setFileTS(null); setFileLiv(null); setFileFac(null)
      if (tsRef.current) tsRef.current.value = ''
      if (livRef.current) livRef.current.value = ''
      if (facRef.current) facRef.current.value = ''
      loadHistory()
    } catch (e: any) {
      setMsg('Erreur : ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const msgBg = msg.startsWith('✓') ? '#dcfce7' : (msg.startsWith('Envoi') || msg.startsWith('Création')) ? '#e0f2fe' : '#fee2e2'
  const msgColor = msg.startsWith('✓') ? '#166534' : (msg.startsWith('Envoi') || msg.startsWith('Création')) ? '#1e40af' : '#991b1b'

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Soumettre un dossier mensuel</h3>
        <p style={{ fontSize: 13, color: 'var(--abed-muted)', marginBottom: 20 }}>
          Joignez obligatoirement les trois fichiers. Taux : <strong>1 h = 1 500 FCFA</strong>.
        </p>

        <div className="field">
          <label className="label">Titre de la soumission *</label>
          <input className="input" value={titre}
            placeholder="Ex : Timesheet juin 2026 — Accompagnement startups"
            onChange={e => setTitre(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">Mois *</label>
            <input className="input" type="number" min={1} max={12} value={mois}
              onChange={e => setMois(+e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Année *</label>
            <input className="input" type="number" value={annee}
              onChange={e => setAnnee(+e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Heures déclarées *</label>
            <input className="input" type="number" min={0.5} step={0.5}
              value={heures} placeholder="ex : 20"
              onChange={e => setHeures(e.target.value ? +e.target.value : '')} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">📊 Timesheet Excel *</label>
            <input ref={tsRef} className="input" type="file" accept=".xlsx,.xls,.csv"
              onChange={e => setFileTS(e.target.files?.[0] ?? null)} />
            {fileTS && <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>{fileTS.name}</p>}
          </div>
          <div className="field">
            <label className="label">📄 Livrable PDF *</label>
            <input ref={livRef} className="input" type="file" accept=".pdf,.doc,.docx"
              onChange={e => setFileLiv(e.target.files?.[0] ?? null)} />
            {fileLiv && <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>{fileLiv.name}</p>}
          </div>
          <div className="field">
            <label className="label">🧾 Facture PDF *</label>
            <input ref={facRef} className="input" type="file" accept=".pdf"
              onChange={e => setFileFac(e.target.files?.[0] ?? null)} />
            {fileFac && <p style={{ fontSize: 11, color: 'var(--abed-muted)', marginTop: 4 }}>{fileFac.name}</p>}
          </div>
        </div>

        {msg && (
          <p style={{ fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 12,
            background: msgBg, color: msgColor }}>
            {msg}
          </p>
        )}
        <button className="btn" onClick={submit} disabled={loading}>
          {loading ? '⏳ Envoi en cours…' : 'Soumettre pour validation'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Mes soumissions</h3>
          <div className="table-wrap">
          <table style={{ minWidth: 680 }}>
            <colgroup>
              <col style={{ width: '28%' }} /><col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} /><col style={{ width: '9%' }} />
              <col style={{ width: '12%' }} /><col />
            </colgroup>
            <thead>
              <tr>
                <th>Titre</th><th>Période</th><th>H décl.</th>
                <th>H ret.</th><th>Montant</th><th>Statut / Commentaire</th>
              </tr>
            </thead>
            <tbody>
              {history.map(s => {
                const st = STATUS_LABEL[s.status] ?? { label: s.status, color: '#374151' }
                const comment = s.commentaire_manager || s.commentaire_caf
                return (
                  <tr key={s.id}>
                    <td title={s.titre} style={{ fontWeight: 500 }}>{s.titre}</td>
                    <td style={{ fontSize: 12 }}>{s.periode_mois}/{s.periode_annee}</td>
                    <td style={{ fontSize: 12 }}>{s.heures_declarees} h</td>
                    <td style={{ fontSize: 12 }}>{s.heures_retenues != null ? `${s.heures_retenues} h` : '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {s.montant_caf != null ? `${s.montant_caf.toLocaleString('fr-FR')} F` : '—'}
                    </td>
                    <td>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                        fontSize: 11, fontWeight: 600,
                        background: st.color + '22', color: st.color }}>
                        {st.label}
                      </span>
                      {comment && (
                        <p style={{ fontSize: 11, color: '#991b1b', marginTop: 3, fontStyle: 'italic' }}>
                          {comment}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
