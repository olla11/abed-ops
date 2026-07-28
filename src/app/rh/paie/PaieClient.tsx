'use client'
import { useMemo } from 'react'
import { Wallet } from 'lucide-react'
import { calculerFichePaie, type TrancheITS } from '@/lib/paie'

type Contrat = {
  id: string; type_contrat: string; poste: string | null; salaire_brut: number | null
  source_financement: string | null
  profile: { nom: string; prenoms: string } | null
}

const card: React.CSSProperties = {
  background: 'white', border: '1px solid var(--abed-border)',
  borderRadius: 10, padding: '20px 24px',
}

const fmtFCFA = (n: number) => n.toLocaleString('fr-FR') + ' FCFA'

export default function PaieClient({ contrats, tauxCnss, bareme }: { contrats: Contrat[]; tauxCnss: number; bareme: TrancheITS[] }) {
  const lignes = useMemo(() => contrats
    .filter(c => (c.salaire_brut ?? 0) > 0)
    .map(c => ({ contrat: c, fiche: calculerFichePaie(c.salaire_brut ?? 0, tauxCnss, bareme) }))
    .sort((a, b) => (b.contrat.profile?.nom ?? '').localeCompare(a.contrat.profile?.nom ?? '')),
  [contrats, tauxCnss, bareme])

  const totaux = lignes.reduce((acc, l) => ({
    brut: acc.brut + l.fiche.salaireBrut,
    cnss: acc.cnss + l.fiche.cnss,
    its: acc.its + l.fiche.its,
    net: acc.net + l.fiche.salaireNet,
  }), { brut: 0, cnss: 0, its: 0, net: 0 })

  function exportCSV() {
    const BOM = '﻿'
    const headers = ['Employé', 'Poste', 'Type contrat', 'Source financement', 'Salaire brut', 'CNSS', 'ITS', 'Salaire net']
    const rows = lignes.map(({ contrat: c, fiche }) => [
      `${c.profile?.prenoms ?? ''} ${c.profile?.nom ?? ''}`.trim(),
      c.poste ?? '', c.type_contrat, c.source_financement ?? '',
      fiche.salaireBrut, fiche.cnss, fiche.its, fiche.salaireNet,
    ])
    const csv = BOM + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paie_abed_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: 'var(--abed-green)', fontSize: 22, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wallet size={22} /> Paie
          </h2>
          <p style={{ fontSize: 13, color: 'var(--abed-muted)', margin: 0 }}>
            Calculée en direct à partir des contrats actifs et des paramètres de paie (CNSS {tauxCnss}% + barème ITS) —
            réglables dans <a href="/rh/parametres" style={{ color: 'var(--abed-blue)' }}>Paramètres RH</a>.
          </p>
        </div>
        <button onClick={exportCSV} style={{
          padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          background: 'var(--abed-green)', color: 'white', border: 'none',
        }}>
          Exporter CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Salaire brut total', value: totaux.brut, color: '#374151' },
          { label: 'CNSS retenue', value: totaux.cnss, color: '#92400e' },
          { label: 'ITS retenu', value: totaux.its, color: '#991b1b' },
          { label: 'Salaire net total', value: totaux.net, color: '#166534' },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 18, fontWeight: 800, color: k.color }}>{fmtFCFA(k.value)}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap">
          <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Employé', 'Poste', 'Type contrat', 'Bailleur', 'Salaire brut', 'CNSS', 'ITS', 'Salaire net'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', borderBottom: '1px solid var(--abed-border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ contrat: c, fiche }, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{c.profile?.prenoms} {c.profile?.nom}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{c.poste ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{c.type_contrat}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#374151' }}>{c.source_financement ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12.5 }}>{fmtFCFA(fiche.salaireBrut)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12.5, color: '#92400e' }}>{fmtFCFA(fiche.cnss)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12.5, color: '#991b1b' }}>{fmtFCFA(fiche.its)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12.5, fontWeight: 700, color: '#166534' }}>{fmtFCFA(fiche.salaireNet)}</td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun contrat actif avec un salaire renseigné.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
