'use client'
import { useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

// Vue personnalisée du tampon de signature :
// - déplacement : mousedown sur le tampon (hors poignée) puis relâcher
//   ailleurs dans le texte le déplace à cet endroit — repose sur
//   posAtCoords + une transaction delete/insert classique (pas le drag HTML5
//   natif de ProseMirror, qui ne se combine pas de façon fiable à Yjs ici).
// - redimensionnement : poignée au coin, largeur ET hauteur ajustées
//   ensemble selon le ratio naturel de l'image pour ne jamais la déformer.
export default function SignatureStampView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const { src, width } = node.attrs as { src: string; width: number | null }
  const imgRef = useRef<HTMLImageElement>(null)
  const [resizing, setResizing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const resizeStartRef = useRef({ startX: 0, startWidth: 0 })

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    // La hauteur n'est jamais fixée explicitement (ni ici ni en CSS) — elle
    // suit automatiquement le ratio naturel de l'image tant que seule la
    // largeur est pilotée, donc pas besoin de la calculer à la main ici.
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
    e.stopPropagation()
    setDragging(true)

    function onUp(ev: MouseEvent) {
      setDragging(false)
      window.removeEventListener('mouseup', onUp)

      const from = getPos()
      if (typeof from !== 'number') return
      const view = editor.view
      const coords = view.posAtCoords({ left: ev.clientX, top: ev.clientY })
      if (!coords) return
      const nodeSize = node.nodeSize
      // Rien à faire si on relâche sur le tampon lui-même.
      if (coords.pos >= from && coords.pos <= from + nodeSize) return

      const tr = view.state.tr
      tr.delete(from, from + nodeSize)
      const dropPos = tr.mapping.map(coords.pos)
      tr.insert(dropPos, view.state.schema.nodes.signatureStamp.create(node.attrs))
      view.dispatch(tr)
    }
    window.addEventListener('mouseup', onUp)
  }

  return (
    <NodeViewWrapper
      as="span"
      style={{
        position: 'relative', display: 'inline-block', verticalAlign: 'middle', margin: '0 4px',
        outline: selected ? '2px solid #2563eb' : 'none', outlineOffset: 2, borderRadius: 4,
        cursor: editor.isEditable ? (dragging ? 'grabbing' : 'grab') : 'default',
        opacity: dragging ? 0.5 : 1,
      }}
      onMouseDown={startDrag}
    >
      <img ref={imgRef} src={src} alt="Signature" className="doc-signature-stamp"
        style={{ width: width ? `${width}px` : undefined, display: 'block', pointerEvents: 'none' }} draggable={false} />
      {editor.isEditable && selected && (
        <span
          onMouseDown={startResize}
          title="Glisser pour redimensionner"
          style={{
            position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: '50%',
            background: 'white', border: '2px solid #2563eb', cursor: 'nwse-resize',
            boxShadow: resizing ? '0 2px 6px rgba(0,0,0,.4)' : '0 1px 3px rgba(0,0,0,.3)',
          }}
        />
      )}
    </NodeViewWrapper>
  )
}
