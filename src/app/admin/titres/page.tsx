export const dynamic = 'force-dynamic'
import GestionTitres from '@/components/GestionTitres'

export default function TitresPage() {
  return (
    <div className="card page-container">
      <h3 style={{ marginBottom: 16, fontSize: 15 }}>Attribuer un titre / rôle</h3>
      <GestionTitres />
    </div>
  )
}
