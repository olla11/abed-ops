'use client'
import { useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

// Vue personnalisée des images de contenu (import Word, insertion manuelle) :
// - déplacement : drag natif ProseMirror (data-drag-handle) — contrairement
//   au tampon de signature (tiptap-signature-stamp.ts), une image de contenu
//   doit pouvoir changer de paragraphe dans le flux du document, pas juste
//   se décaler visuellement.
// - redimensionnement : poignée au coin, largeur ajustée (la hauteur suit
//   le ratio naturel de l'image, comme le tampon de signature).
// - copier/couper/coller : natif ProseMirror (aucun code custom nécessaire
//   dès lors que le noeud est correctement sélectionnable — c'est le cas
//   par défaut).
export default function ResizableImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { src, alt, title, width } = node.attrs as { src: string; alt: string | null; title: string | null; width: number | null }
  const imgRef = useRef<HTMLImageElement>(null)
  const [resizing, setResizing] = useState(false)
  const resizeStartRef = useRef({ startX: 0, startWidth: 0 })

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const w = imgRef.current?.offsetWidth ?? width ?? 300
    resizeStartRef.current = { startX: e.clientX, startWidth: w }
    setResizing(true)

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - resizeStartRef.current.startX
      const newWidth = Math.max(40, Math.round(resizeStartRef.current.startWidth + delta))
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

  return (
    <NodeViewWrapper
      as="div"
      data-drag-handle
      style={{
        position: 'relative', display: 'inline-block', maxWidth: '100%', lineHeight: 0,
        outline: selected ? '2px solid #2563eb' : 'none', outlineOffset: 2, borderRadius: 2,
        cursor: editor.isEditable ? 'grab' : 'default',
      }}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt ?? ''}
        title={title ?? undefined}
        style={{ width: width ? `${width}px` : undefined, maxWidth: '100%', height: 'auto', display: 'block' }}
      />
      {editor.isEditable && selected && (
        <span
          onMouseDown={startResize}
          title="Glisser pour redimensionner"
          style={{
            position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: '50%',
            background: 'white', border: '2px solid #2563eb', cursor: 'nwse-resize',
            boxShadow: resizing ? '0 2px 6px rgba(0,0,0,.4)' : '0 1px 3px rgba(0,0,0,.3)', zIndex: 2,
          }}
        />
      )}
    </NodeViewWrapper>
  )
}
