'use client'
import { Download } from 'lucide-react'

export default function ProfileQrCode({ dataUrl, fileName }: { dataUrl: string; fileName: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <img
        src={dataUrl}
        alt="QR code d'identification"
        style={{ width: 160, height: 160, borderRadius: 8, border: '1px solid var(--abed-border)' }}
      />
      <div>
        <a
          href={dataUrl}
          download={fileName}
          className="btn secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12.5 }}
        >
          <Download size={14} /> Télécharger le QR
        </a>
      </div>
    </div>
  )
}
