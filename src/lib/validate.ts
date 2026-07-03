import { z } from 'zod'
import { NextResponse } from 'next/server'

/** Run Zod validation and return a 400 response on failure, or null on success */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { error: NextResponse } | { data: T } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issues = result.error.issues ?? (result.error as any).errors ?? []
    const message = issues.map((e: any) => e.message).join(', ')
    return { error: NextResponse.json({ error: message }, { status: 400 }) }
  }
  return { data: result.data }
}

// ── Shared field schemas ──────────────────────────────────────────────────────
export const s = {
  nom:         z.string().min(1, 'Nom requis').max(100, 'Nom trop long'),
  prenoms:     z.string().min(1, 'Prénom requis').max(100, 'Prénom trop long'),
  email:       z.string().email('Email invalide').max(254),
  password:    z.string().min(8, 'Mot de passe trop court').max(128, 'Mot de passe trop long'),
  text:        z.string().max(5000, 'Texte trop long').optional(),
  shortText:   z.string().max(255, 'Texte trop long').optional(),
  uuid:        z.string().uuid('ID invalide'),
  montant:     z.number().min(0, 'Montant invalide').max(1_000_000_000, 'Montant trop élevé'),
  couleur:     z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide').optional(),
  date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (YYYY-MM-DD)').nullable().optional(),
  statut:      (values: [string, ...string[]]) => z.enum(values).optional(),
}
