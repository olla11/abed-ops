'use client'
import { useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Trash2 } from 'lucide-react'

// Vue personnalisée du tampon de signature :
// - déplacement : décalage visuel libre en pixels (transform: translate),
//   pas un repositionnement dans le document — voir le commentaire dans
//   tiptap-signature-stamp.ts sur pourquoi le drag natif ProseMirror ne
//   convenait pas ici (retombait sur la position de départ).
// - redimensionnement : poignée au coin, largeur ajustée (la hauteur suit
//   automatiquement le ratio naturel de l'image).
// - suppression : bouton dédié affiché à la sélection.
export default function SignatureStampView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const { src, width, offset } = node.attrs as { src: string; width: number | null; offset: { x: number; y: number } }
  const imgRef = useRef<HTMLImageElement>(null)
  const [resizing, setResizing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const resizeStartRef = useRef({ startX: 0, startWidth: 0 })
  const dragStartRef = useRef({ startX: 0, startY: 0, baseX: 0, baseY: 0 })

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const w = imgRef.current?.offsetWidth ?? width ?? 160
    resizeStartRef.current = { startX: e.clientX, startWidth: w }
    setResizing(true)

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - resizeStartRef.current.startX
      const newWidth = Math.max(40, Math.min(600, Math.round(resizeStartRef.current.startWidth + delta)))
      updateAttributes({ width: newWidth })
    }
    function onUp() {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function startDrag(e: React.MouseEvent) {
    if (!editor.isEditable) return
    e.preventDefault()
    const base = offset ?? { x: 0, y: 0 }
    dragStartRef.current = { startX: e.clientX, startY: e.clientY, baseX: base.x, baseY: base.y }
    setDragging(true)

    function onMove(ev: MouseEvent) {
      const { startX, startY, baseX, baseY } = dragStartRef.current
      updateAttributes({ offset: { x: baseX + (ev.clientX - startX), y: baseY + (ev.clientY - startY) } })
    }
    function onUp() {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function supprimer(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const from = getPos()
    if (typeof from !== 'number') return
    const view = editor.view
    view.dispatch(view.state.tr.delete(from, from + node.nodeSize))
  }

  const tx = offset?.x ?? 0
  const ty = offset?.y ?? 0

  return (
    <NodeViewWrapper
      as="span"
      onMouseDown={startDrag}
      style={{
        position: 'relative', display: 'inline-block', verticalAlign: 'middle', margin: '0 4px',
        transform: (tx || ty) ? `translate(${tx}px, ${ty}px)` : undefined,
        outline: selected ? '2px solid #2563eb' : 'none', outlineOffset: 2, borderRadius: 4,
        cursor: editor.isEditable ? (dragging ? 'grabbing' : 'grab') : 'default',
        zIndex: selected ? 5 : undefined,
      }}
    >
      <img ref={imgRef} src={src} alt="Signature" className="doc-signature-stamp"
        style={{ width: width ? `${width}px` : undefined, display: 'block', pointerEvents: 'none' }} draggable={false} />
      {editor.isEditable && selected && (
        <>
          <span
            onMouseDown={startResize}
            title="Glisser pour redimensionner"
            style={{
              position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: '50%',
              background: 'white', border: '2px solid #2563eb', cursor: 'nwse-resize',
              boxShadow: resizing ? '0 2px 6px rgba(0,0,0,.4)' : '0 1px 3px rgba(0,0,0,.3)', zIndex: 2,
            }}
          />
          <button
            type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={supprimer}
            title="Supprimer la signature"
            style={{
              position: 'absolute', right: -10, top: -10, width: 20, height: 20, borderRadius: '50%',
              background: '#dc2626', border: '2px solid white', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,.4)', zIndex: 2,
            }}
          >
            <Trash2 size={10} />
          </button>
        </>
      )}
    </NodeViewWrapper>
  )
}
