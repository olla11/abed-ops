'use client'
import { useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

// Vue personnalisée du tampon de signature : data-drag-handle permet de le
// déplacer n'importe où dans le document (combiné à draggable: true côté
// schéma — voir tiptap-signature-stamp.ts), et la poignée au coin permet de
// l'agrandir/réduire à la souris, largeur persistée comme attribut du nœud.
export default function SignatureStampView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const { src, width } = node.attrs as { src: string; width: number | null }
  const imgRef = useRef<HTMLImageElement>(null)
  const [resizing, setResizing] = useState(false)
  const startRef = useRef({ startX: 0, startWidth: 0 })

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const w = imgRef.current?.offsetWidth ?? width ?? 160
    startRef.current = { startX: e.clientX, startWidth: w }
    setResizing(true)

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startRef.current.startX
      const newWidth = Math.max(40, Math.min(600, Math.round(startRef.current.startWidth + delta)))
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
      as="span"
      data-drag-handle
      style={{
        position: 'relative', display: 'inline-block', verticalAlign: 'middle', margin: '0 4px',
        outline: selected ? '2px solid #2563eb' : 'none', outlineOffset: 2, borderRadius: 4,
        cursor: editor.isEditable ? 'grab' : 'default',
      }}
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
