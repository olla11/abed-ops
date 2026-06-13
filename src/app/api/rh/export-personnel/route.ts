import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['rh', 'admin'].includes(me?.role ?? '')) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: personnel } = await service
    .from('profiles')
    .select('matricule, nom, prenoms, role, type_emploi, fonction, direction, email, telephone, ifu, date_naissance, lieu_naissance, nationalite, adresse, civilite, created_at')
    .order('prenoms')

  const headers = ['Matricule', 'Nom', 'Prénoms', 'Civilité', 'Rôle', 'Type emploi', 'Fonction', 'Direction', 'Email', 'Téléphone', 'IFU', 'Date naissance', 'Lieu naissance', 'Nationalité', 'Adresse', 'Date création']

  function esc(v: unknown) {
    if (v == null) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const rows = (personnel ?? []).map(p => [
    p.matricule, p.nom, p.prenoms, p.civilite, p.role, p.type_emploi,
    p.fonction, p.direction, p.email, p.telephone, p.ifu,
    p.date_naissance, p.lieu_naissance, p.nationalite, p.adresse,
    p.created_at?.split('T')[0],
  ].map(esc).join(','))

  const csv = [headers.join(','), ...rows].join('\r\n')
  const bom = '﻿'

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="personnel_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
