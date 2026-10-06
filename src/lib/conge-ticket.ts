import { escapeHtml } from '@/lib/html'

// "Ticket de congé" — email envoyé à l'employé une fois les 3 étapes du
// circuit franchies (responsable technique → RH/CAF → Direction Exécutive).
// Visuellement distinct des emails d'étape intermédiaire (cartes vertes
// simples) : présenté comme un vrai billet, pour que ce soit l'email qu'on
// garde/imprime avant de partir en congé.

export type EtapeValidation = { label: string; nom: string | null; date: string | null }

export type TicketCongeData = {
  employeNom: string
  employePrenoms: string
  typeConge: string
  dateDebut: string
  dateFin: string
  nbJours: number | null
  motif: string | null
  etapes: EtapeValidation[]
  appUrl: string
}

function formatDateLongue(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatDateCourte(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function construireTicketCongeHtml(d: TicketCongeData): { subject: string; html: string } {
  const nomComplet = `${d.employePrenoms} ${d.employeNom}`.trim()
  const reference = `CONGE-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

  const etapesHtml = d.etapes.map(e => `
    <tr>
      <td style="padding:10px 0;width:28px;vertical-align:top">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#16a34a;color:white;font-size:13px;font-weight:700">✓</span>
      </td>
      <td style="padding:10px 0 10px 10px;border-bottom:1px solid #f3f4f6">
        <p style="margin:0;font-size:13px;font-weight:700;color:#111827">${escapeHtml(e.label)}</p>
        <p style="margin:2px 0 0;font-size:12.5px;color:#6b7280">${e.nom ? escapeHtml(e.nom) : '—'}${e.date ? ` · ${formatDateCourte(e.date)}` : ''}</p>
      </td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f3f4f6">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1)">

  <!-- Bandeau -->
  <div style="background:linear-gradient(135deg,#2d6a4f,#1f7a1f);padding:28px 32px">
    <img src="${d.appUrl}/logo.png" alt="ABED" height="36" style="height:36px" onerror="this.style.display='none'" />
    <h1 style="color:white;margin:14px 0 2px;font-size:22px">🎫 Ticket de congé</h1>
    <p style="color:#b7e4c7;margin:0;font-size:13px">Demande autorisée — référence ${reference}</p>
  </div>

  <!-- Corps du billet -->
  <div style="padding:28px 32px 8px">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Titulaire</p>
    <p style="margin:0 0 20px;font-size:19px;font-weight:800;color:#111827">${escapeHtml(nomComplet)}</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
      <tr>
        <td style="padding:6px 0;width:50%">
          <p style="margin:0;font-size:12px;color:#6b7280">Type de congé</p>
          <p style="margin:2px 0 0;font-size:15px;font-weight:700;color:#111827">${escapeHtml(d.typeConge)}</p>
        </td>
        <td style="padding:6px 0">
          <p style="margin:0;font-size:12px;color:#6b7280">Durée</p>
          <p style="margin:2px 0 0;font-size:15px;font-weight:700;color:#111827">${d.nbJours ?? '—'} jour${(d.nbJours ?? 0) > 1 ? 's' : ''} ouvrable${(d.nbJours ?? 0) > 1 ? 's' : ''}</p>
        </td>
      </tr>
    </table>
  </div>

  <!-- Ligne perforée -->
  <div style="position:relative;margin:8px 0;border-top:2px dashed #d1d5db">
    <span style="position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;background:#f3f4f6"></span>
    <span style="position:absolute;right:-14px;top:-14px;width:28px;height:28px;border-radius:50%;background:#f3f4f6"></span>
  </div>

  <!-- Départ / Retour -->
  <div style="padding:20px 32px 8px;display:flex;background:#f0fdf4">
    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:4px 0;width:50%">
          <p style="margin:0;font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:.04em">Départ</p>
          <p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#166534">${formatDateLongue(d.dateDebut)}</p>
        </td>
        <td style="padding:4px 0">
          <p style="margin:0;font-size:11px;color:#166534;text-transform:uppercase;letter-spacing:.04em">Retour</p>
          <p style="margin:2px 0 0;font-size:14px;font-weight:700;color:#166534">${formatDateLongue(d.dateFin)}</p>
        </td>
      </tr>
    </table>
  </div>
  <div style="height:16px;background:#f0fdf4"></div>

  ${d.motif ? `
  <div style="padding:20px 32px 0">
    <p style="margin:0;font-size:12px;color:#6b7280">Motif</p>
    <p style="margin:4px 0 0;font-size:13.5px;color:#374151;line-height:1.5">${escapeHtml(d.motif)}</p>
  </div>` : ''}

  <!-- Circuit de validation -->
  <div style="padding:20px 32px 8px">
    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Circuit de validation</p>
    <table style="width:100%;border-collapse:collapse">
      ${etapesHtml}
    </table>
  </div>

  <div style="padding:8px 32px 28px">
    <a href="${d.appUrl}/conges" style="display:block;text-align:center;background:#16a34a;color:white;padding:13px 0;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">
      Voir mes congés →
    </a>
    <p style="text-align:center;font-size:13px;color:#166534;margin:16px 0 0;font-weight:600">Bonne période de congé !</p>
  </div>

  <div style="background:#f9fafb;padding:14px 32px;border-top:1px solid #f3f4f6">
    <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center">ABED ONG — My ABED · Conservez cet email comme justificatif</p>
  </div>
</div>
</body></html>`

  return { subject: `🎫 Votre ticket de congé — ${formatDateCourte(d.dateDebut)} → ${formatDateCourte(d.dateFin)}`, html }
}
