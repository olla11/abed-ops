'use client'

type Piece = { path: string; nom: string }

async function openFile(path: string) {
  const res = await fetch(`/api/storage/signed-url?bucket=timesheets&path=${encodeURIComponent(path)}`)
  const json = await res.json()
  if (json.url) window.open(json.url, '_blank')
  else alert('Impossible d\'ouvrir : ' + (json.error ?? 'erreur'))
}

export default function PiecesJointesList({ pieces }: { pieces: Piece[] | null | undefined }) {
  const list = Array.isArray(pieces) ? pieces : []
  if (list.length === 0) return null

  return (
    <div style={{ marginTop: 12 }}>
      <strong style={{ fontSize: 13 }}>Pièces jointes :</strong>
      <ul style={{ marginTop: 6, display: 'grid', gap: 6, listStyle: 'none', padding: 0 }}>
        {list.map((p, i) => (
          <li key={i}>
            <button className="btn secondary" style={{ fontSize: 12 }} onClick={() => openFile(p.path)}>
              📎 {p.nom}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
