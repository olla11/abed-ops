'use client'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Clock, Wallet, Palmtree, PenTool, FileText, ClipboardCheck } from 'lucide-react'
import SectionSideNav, { type SideNavItem } from '@/components/SectionSideNav'

const RAPPORT_TYPES = ['benevole', 'stagiaire_n1', 'stagiaire_n2', 'cdd', 'cdi']

// Barre latérale permanente pour les pages de "Mon espace" (dashboard,
// timesheets, demandes, congés, documents, signatures, mes-contrats,
// évaluations) — remplace l'ancien menu déroulant du haut (voir AppHeader,
// qui n'a plus qu'un lien simple vers /dashboard). "Doc & Sign" et "Contrats
// & Évaluations" étaient des sous-menus en survol latéral (flyout) ; ce sont
// maintenant de simples regroupements (titre + items) dans la même liste.
export default function MonEspaceNav({ typeEmploi }: { typeEmploi?: string | null }) {
  const t = useTranslations('nav')
  const estRapport = RAPPORT_TYPES.includes(typeEmploi ?? '')

  const items: SideNavItem[] = [
    { href: '/dashboard', label: t('missions'), Icon: LayoutDashboard },
    { href: '/timesheets', label: estRapport ? t('monthlyReport') : t('timesheets'), Icon: Clock },
    { href: '/demandes', label: t('payments'), Icon: Wallet },
    { href: '/conges', label: t('leaves'), Icon: Palmtree },
    { kind: 'heading', label: 'Doc & Sign' },
    { href: '/signatures', label: 'Signature directe', Icon: PenTool },
    { href: '/documents', label: 'Documents', Icon: FileText },
    { kind: 'heading', label: t('contractsGroup') },
    { href: '/mes-contrats', label: t('contracts'), Icon: FileText },
    { href: '/evaluations', label: t('evaluations'), Icon: ClipboardCheck },
  ]

  return <SectionSideNav items={items} />
}
